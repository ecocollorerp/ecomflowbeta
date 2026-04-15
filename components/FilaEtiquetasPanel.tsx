/**
 * FilaEtiquetasPanel.tsx — Painel de fila de etiquetas unificada.
 * Acumula pedidos, busca ZPL de transporte + DANFE simplificada,
 * e une automaticamente (DANFE primeiro, depois etiqueta).
 */
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Printer, Trash2, Download, Copy, Loader2, Plus, CheckCircle2,
  XCircle, AlertTriangle, Zap, RotateCcw, Package, FileText,
  ClipboardPaste, Hash, ChevronDown, ChevronUp, X, Eye, Clock
} from "lucide-react";
import { fetchNfeDetalhe } from "../lib/blingApi";
import { nfeJsonToDanfeZplData, gerarDanfeSimplificadaZPL, mergeZplBlocks } from "../lib/danfeSimplificadaZpl";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilaItem {
  id: string;                   // ID único para tracking
  inputId: string;              // O que o usuário digitou (número pedido loja, ID NF-e, etc.)
  status: "pendente" | "processando" | "sucesso" | "erro";
  errorMsg?: string;
  nfeId?: number;
  nfeNumero?: string;
  cliente?: string;
  rastreio?: string;
  transportadora?: string;
  zplDanfe?: string;            // ZPL da DANFE simplificada
  zplEtiqueta?: string;         // ZPL da etiqueta de transporte
  zplMerged?: string;           // DANFE + Etiqueta unidos
  processedAt?: string;
}

interface Props {
  token: string | undefined;
  addToast: (msg: string, type: string) => void;
  danfeZplConfig?: {
    offsetTop: number;
    offsetLeft: number;
    showLogo: boolean;
  };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const FILA_STORAGE_KEY = "bling_fila_etiquetas";

function loadFila(): FilaItem[] {
  try {
    const raw = localStorage.getItem(FILA_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveFila(fila: FilaItem[]) {
  try {
    localStorage.setItem(FILA_STORAGE_KEY, JSON.stringify(fila.slice(0, 200)));
  } catch { /* quota */ }
}

function downloadBlob(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const FilaEtiquetasPanel: React.FC<Props> = ({ token, addToast, danfeZplConfig }) => {
  const [fila, setFilaRaw] = useState<FilaItem[]>(loadFila);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDetalhes, setShowDetalhes] = useState<string | null>(null);
  const [autoProcess, setAutoProcess] = useState(true);
  const abortRef = useRef(false);

  const setFila = useCallback((update: FilaItem[] | ((prev: FilaItem[]) => FilaItem[])) => {
    setFilaRaw((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      saveFila(next);
      return next;
    });
  }, []);

  // ── Parse input: aceita vírgula, quebra de linha, espaço, ponto-e-vírgula ──
  const parseIds = (text: string): string[] => {
    return text
      .split(/[,;\n\r\t]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50);
  };

  // ── Add items to queue ──
  const handleAddToFila = () => {
    const ids = parseIds(inputText);
    if (ids.length === 0) {
      addToast("Cole ou digite ao menos um ID de pedido/NF-e.", "warning");
      return;
    }

    const existingIds = new Set(fila.map(f => f.inputId));
    const newItems: FilaItem[] = ids
      .filter(id => !existingIds.has(id))
      .map(id => ({
        id: `fila_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        inputId: id,
        status: "pendente" as const,
      }));

    if (newItems.length === 0) {
      addToast("Todos os IDs já estão na fila.", "info");
      return;
    }

    setFila(prev => [...prev, ...newItems]);
    setInputText("");
    addToast(`${newItems.length} item(ns) adicionado(s) à fila.`, "success");
  };

  useEffect(() => {
    const handleEvent = (e: any) => {
      const externalIds: string[] = e.detail?.ids || [];
      if (!externalIds || externalIds.length === 0) return;

      let adicionados = 0;
      setFilaRaw(currentFila => {
        const existingIds = new Set(currentFila.map(f => f.inputId));
        const newItems: FilaItem[] = externalIds
          .filter(id => !existingIds.has(String(id)))
          .map(id => ({
            id: `fila_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            inputId: String(id),
            status: "pendente" as const,
          }));

        if (newItems.length > 0) {
          adicionados = newItems.length;
          const next = [...currentFila, ...newItems];
          saveFila(next);
          return next;
        }
        return currentFila;
      });

      // Dispara o toast pós atualizacao de setup com base em uma variavel local
      setTimeout(() => {
         if (adicionados > 0) {
            addToast(`${adicionados} etiqueta(s) carregada(s) na fila.`, "success");
         } else {
            addToast("As notas selecionadas já estavam listadas na fila.", "info");
         }
      }, 0);
    };

    window.addEventListener("ADD_TO_FILA_ETIQUETAS", handleEvent);
    return () => window.removeEventListener("ADD_TO_FILA_ETIQUETAS", handleEvent);
  }, [addToast]);

  // ── Process single item ──
  const processItem = async (item: FilaItem): Promise<FilaItem> => {
    if (!token) return { ...item, status: "erro", errorMsg: "Token não disponível" };

    const authH = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

    try {
      // 1. Buscar etiquetas via endpoint do server (que faz NF-e → Objeto → ZPL)
      const resp = await fetch("/api/bling/etiquetas/buscar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authH,
        },
        body: JSON.stringify({ pedidoVendaIds: [item.inputId] }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return {
          ...item,
          status: "erro",
          errorMsg: err?.error || `Erro HTTP ${resp.status}`,
        };
      }

      const data = await resp.json();
      const result = data?.results?.[0];

      if (!result?.success) {
        return {
          ...item,
          status: "erro",
          errorMsg: result?.error || "Etiqueta não encontrada no Bling",
        };
      }

      const zplEtiqueta = result.zpl;
      const nfeNumero = result.numero;
      const cliente = result.nomeCliente;

      // 2. Gerar DANFE simplificada ZPL
      let zplDanfe: string | null = null;
      try {
        // Buscar detalhe da NF-e para gerar DANFE
        // Primeiro, precisamos do ID da NF-e — buscar via API
        const nfeSearchResp = await fetch(
          `/api/bling/nfe/listar-saida?numeroPedidoLoja=${encodeURIComponent(item.inputId)}`,
          { headers: { Authorization: authH } }
        );

        if (nfeSearchResp.ok) {
          const nfeSearchData = await nfeSearchResp.json();
          const nfes = nfeSearchData?.data || nfeSearchData?.nfes || [];
          const nfe = nfes[0];

          if (nfe?.id) {
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const d = detalhe?.data || detalhe;
            if (d) {
              const danfeData = nfeJsonToDanfeZplData(d, nfe);
              zplDanfe = gerarDanfeSimplificadaZPL(danfeData, danfeZplConfig);
            }
          }
        }
      } catch (danfeErr) {
        console.warn("[FilaEtiquetas] DANFE simplificada não gerada:", danfeErr);
        // Não é erro fatal — a etiqueta de transporte já foi obtida
      }

      // 3. Merge: DANFE primeiro, depois etiqueta de transporte
      const zplMerged = zplDanfe
        ? mergeZplBlocks(zplDanfe, zplEtiqueta)
        : zplEtiqueta;

      return {
        ...item,
        status: "sucesso",
        nfeNumero,
        cliente,
        zplDanfe: zplDanfe || undefined,
        zplEtiqueta,
        zplMerged,
        processedAt: new Date().toISOString(),
      };
    } catch (e: any) {
      return {
        ...item,
        status: "erro",
        errorMsg: e.message || "Erro desconhecido",
      };
    }
  };

  // ── Process all pending items ──
  const handleProcessarFila = async () => {
    if (!token) {
      addToast("Token do Bling não disponível.", "error");
      return;
    }

    const pendentes = fila.filter(f => f.status === "pendente" || f.status === "erro");
    if (pendentes.length === 0) {
      addToast("Nenhum item pendente na fila.", "info");
      return;
    }

    setIsProcessing(true);
    abortRef.current = false;

    let processed = 0;
    let errors = 0;

    for (const item of pendentes) {
      if (abortRef.current) break;

      // Mark as processing
      setFila(prev => prev.map(f => f.id === item.id ? { ...f, status: "processando" as const } : f));

      const result = await processItem(item);
      if (result.status === "erro") errors++;
      else processed++;

      setFila(prev => prev.map(f => f.id === item.id ? result : f));

      // Rate limiting delay between items
      if (!abortRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setIsProcessing(false);
    addToast(
      `Fila processada: ${processed} sucesso(s), ${errors} erro(s).`,
      errors > 0 ? "warning" : "success"
    );
  };

  // ── Auto-process when items are added ──
  useEffect(() => {
    if (autoProcess && !isProcessing) {
      const pendentes = fila.filter(f => f.status === "pendente");
      if (pendentes.length > 0) {
        handleProcessarFila();
      }
    }
  }, [fila.length, autoProcess]);

  // ── Download all merged ZPL ──
  const handleDownloadAll = () => {
    const successItems = fila.filter(f => f.status === "sucesso" && f.zplMerged);
    if (successItems.length === 0) {
      addToast("Nenhuma etiqueta processada para download.", "warning");
      return;
    }

    const allZpl = successItems.map(f => f.zplMerged!).join("\n\n");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(allZpl, `Etiquetas_Fila_${timestamp}.txt`);
    addToast(`${successItems.length} etiqueta(s) baixada(s).`, "success");
  };

  // ── Copy all to clipboard ──
  const handleCopyAll = async () => {
    const successItems = fila.filter(f => f.status === "sucesso" && f.zplMerged);
    if (successItems.length === 0) {
      addToast("Nenhuma etiqueta para copiar.", "warning");
      return;
    }

    const allZpl = successItems.map(f => f.zplMerged!).join("\n\n");
    try {
      await navigator.clipboard.writeText(allZpl);
      addToast("ZPL copiado para a área de transferência!", "success");
    } catch {
      addToast("Erro ao copiar.", "error");
    }
  };

  // ── Remove item ──
  const handleRemove = (id: string) => {
    setFila(prev => prev.filter(f => f.id !== id));
  };

  // ── Clear all ──
  const handleClearAll = () => {
    setFila([]);
    addToast("Fila limpa.", "info");
  };

  // ── Retry failed ──
  const handleRetryFailed = () => {
    setFila(prev => prev.map(f => f.status === "erro" ? { ...f, status: "pendente" as const, errorMsg: undefined } : f));
  };

  // ── Stats ──
  const stats = {
    total: fila.length,
    pendente: fila.filter(f => f.status === "pendente").length,
    processando: fila.filter(f => f.status === "processando").length,
    sucesso: fila.filter(f => f.status === "sucesso").length,
    erro: fila.filter(f => f.status === "erro").length,
  };

  // ── Add from external (exposed via ref if needed) ──
  const addExternalIds = useCallback((ids: string[]) => {
    const existingIds = new Set(fila.map(f => f.inputId));
    const newItems: FilaItem[] = ids
      .filter(id => !existingIds.has(id))
      .map(id => ({
        id: `fila_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        inputId: id,
        status: "pendente" as const,
      }));
    if (newItems.length > 0) {
      setFila(prev => [...prev, ...newItems]);
    }
  }, [fila, setFila]);

  return (
    <div className="space-y-4">
      {/* ── Header + Input ── */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
<h3 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Printer size={16} className="text-cyan-600" />
              Impressão de Pedidos/Notas
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Cole IDs de pedidos ou notas fiscais. Gera DANFE simplificada + etiqueta de transporte automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={autoProcess}
                onChange={e => setAutoProcess(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-orange-500"
              />
              Auto-processar
            </label>
          </div>
        </div>

        {/* Input area */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ClipboardPaste size={14} className="absolute left-3 top-3 text-slate-300" />
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Cole IDs separados por vírgula, espaço ou quebra de linha. Ex: 12345, 67890, 11223..."
              className="w-full pl-9 pr-3 py-2.5 text-xs font-mono border-2 border-slate-100 rounded-xl bg-slate-50 outline-none focus:border-orange-400 resize-none transition-all"
              rows={2}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddToFila();
                }
              }}
            />
          </div>
          <button
            onClick={handleAddToFila}
            disabled={!inputText.trim()}
            className="self-start px-4 py-3 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-700 disabled:opacity-40 transition-all shadow-lg shadow-orange-100 flex items-center gap-1.5"
          >
            <Plus size={13} />
            Adicionar
          </button>
        </div>

        {/* Stats bar */}
        {stats.total > 0 && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[10px] font-black text-slate-400">
              {stats.total} na fila
            </span>
            {stats.pendente > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                <Clock size={9} /> {stats.pendente} pendente(s)
              </span>
            )}
            {stats.processando > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <Loader2 size={9} className="animate-spin" /> {stats.processando} processando
              </span>
            )}
            {stats.sucesso > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={9} /> {stats.sucesso} sucesso
              </span>
            )}
            {stats.erro > 0 && (
              <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                <XCircle size={9} /> {stats.erro} erro(s)
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      {stats.total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {!isProcessing ? (
            <button
              onClick={handleProcessarFila}
              disabled={stats.pendente === 0 && stats.erro === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-700 disabled:opacity-40 transition-all shadow-lg shadow-orange-100"
            >
              <Zap size={12} />
              Processar Fila ({stats.pendente + stats.erro})
            </button>
          ) : (
            <button
              onClick={() => { abortRef.current = true; }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all"
            >
              <X size={12} />
              Parar
            </button>
          )}

          <button
            onClick={handleDownloadAll}
            disabled={stats.sucesso === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-all"
          >
            <Download size={11} />
            Baixar Tudo ({stats.sucesso})
          </button>

          <button
            onClick={handleCopyAll}
            disabled={stats.sucesso === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all"
          >
            <Copy size={11} />
            Copiar ZPL
          </button>

          {stats.erro > 0 && (
            <button
              onClick={handleRetryFailed}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-700 transition-all"
            >
              <RotateCcw size={11} />
              Retentar Erros ({stats.erro})
            </button>
          )}

          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-all ml-auto"
          >
            <Trash2 size={11} />
            Limpar
          </button>
        </div>
      )}

      {/* ── Queue items list ── */}
      {fila.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="max-h-[420px] overflow-y-auto">
            {fila.map(item => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 transition-all ${
                  item.status === "processando" ? "bg-blue-50/30" :
                  item.status === "erro" ? "bg-red-50/30" :
                  item.status === "sucesso" ? "bg-emerald-50/20" : ""
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {item.status === "pendente" && <Clock size={14} className="text-amber-400" />}
                  {item.status === "processando" && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                  {item.status === "sucesso" && <CheckCircle2 size={14} className="text-emerald-500" />}
                  {item.status === "erro" && <XCircle size={14} className="text-red-500" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-700 font-mono">
                      #{item.inputId}
                    </span>
                    {item.nfeNumero && (
                      <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">
                        NF-e {item.nfeNumero}
                      </span>
                    )}
                    {item.cliente && (
                      <span className="text-[9px] text-slate-400 truncate max-w-[180px]">
                        {item.cliente}
                      </span>
                    )}
                  </div>
                  {item.errorMsg && (
                    <p className="text-[9px] text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle size={8} />
                      {item.errorMsg}
                    </p>
                  )}
                  {item.status === "sucesso" && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.zplDanfe && (
                        <span className="text-[8px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                          DANFE ✓
                        </span>
                      )}
                      {item.zplEtiqueta && (
                        <span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                          Etiqueta ✓
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === "sucesso" && item.zplMerged && (
                    <>
                      <button
                        onClick={() => {
                          downloadBlob(item.zplMerged!, `Etiqueta_${item.inputId}.txt`);
                          addToast(`Etiqueta #${item.inputId} baixada.`, "success");
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-emerald-600 transition-all"
                        title="Baixar ZPL"
                      >
                        <Download size={12} />
                      </button>
                      <button
                        onClick={() => setShowDetalhes(showDetalhes === item.id ? null : item.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-all"
                        title="Ver detalhes"
                      >
                        <Eye size={12} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                    title="Remover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {fila.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <Package size={32} className="mx-auto text-slate-200 mb-3" />
          <p className="text-xs font-bold text-slate-400">
            Nenhuma etiqueta na fila.
          </p>
          <p className="text-[10px] text-slate-300 mt-1">
            Cole IDs de pedidos acima para começar a processar etiquetas em lote.
          </p>
        </div>
      )}
    </div>
  );
};
