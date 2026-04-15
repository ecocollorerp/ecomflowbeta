import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Truck, RefreshCw, Copy, Loader2, Search, Package,
  Trash2, CheckSquare, Square, Download, MapPin, Calendar,
  Hash, User, Box, Weight, Clock, CheckCircle2, XCircle,
  ArrowUpRight, Ruler, FileText, Printer, Zap, RotateCcw,
  Filter, Tag, ShoppingBag, AlertTriangle, Send, ChevronDown,
  ListChecks, History, X,
} from "lucide-react";
import { fetchLogisticas, fetchLogisticasObjetos, fetchNfeDetalhe } from "../lib/blingApi";
import { nfeJsonToDanfeZplData, gerarDanfeSimplificadaZPL } from "../lib/danfeSimplificadaZpl";

// ─── Types ───────────────────────────────────────────────────────────────────

interface LogObj {
  id: number;
  numero: string;          // pedidoLoja.numeroPedido
  nfeNumero: string;       // nota.numero
  nfeId: number | null;
  nfeSerie: string;
  idVenda: number | null;
  contato: string;
  rastreio: string;
  servico: string;
  transportadora: string;
  idTransportadora: number | null;
  situacaoId: number;
  situacaoNome: string;
  loja: string;
  dataCriacao: string;
  prazoEntrega: string;
  quantidade: number; // Qtd de itens no pedido
  raw: any;
}

interface HistoricoEtiq {
  ts: string;
  numero: string;
  nfe: string;
  transp: string;
  tipo: "zpl_envio" | "zpl_danfe" | "pdf";
  conteudo?: string;
}

interface Props {
  token: string | undefined;
  addToast: (msg: string, type: string) => void;
  startDate: string;
  endDate: string;
  nfeSaida?: any[];
  onAddLote?: (lote: { id: string; timestamp: string; total: number; success: number; successIds: string[]; failed: any[]; zplContent: string }) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HISTORICO_KEY = "logistica_etiq_historico";
const IMPRESSAS_KEY = "logistica_impressas";

function loadImpressas(): Set<number> {
  try { return new Set(JSON.parse(localStorage.getItem(IMPRESSAS_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveImpressas(ids: Set<number>) {
  localStorage.setItem(IMPRESSAS_KEY, JSON.stringify([...ids]));
}
function loadHistorico(): HistoricoEtiq[] {
  try { return JSON.parse(localStorage.getItem(HISTORICO_KEY) || "[]"); }
  catch { return []; }
}
function saveHistorico(h: HistoricoEtiq[]) {
  try { localStorage.setItem(HISTORICO_KEY, JSON.stringify(h.slice(0, 200))); }
  catch { /* quota */ }
}

function downloadBlob(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function mapObj(obj: any): LogObj {
  const situacao = obj.situacao;
  const situacaoId = typeof situacao === "object" ? (situacao?.id || 0) : Number(situacao || 0);
  const situacaoNome = typeof situacao === "object" ? (situacao?.nome || "—") : String(situacao || "—");
  return {
    id: obj.id,
    numero: obj.pedidoLoja?.numeroPedido || obj.pedidoLoja?.id || String(obj.id),
    nfeNumero: obj.nota?.numero || "",
    nfeId: obj.nota?.id ? Number(obj.nota.id) : null,
    nfeSerie: obj.nota?.serie || "1",
    idVenda: obj.idVenda ? Number(obj.idVenda) : null,
    contato: obj.contato?.nome || "—",
    rastreio: obj.rastreamento?.codigo || obj.codigoRastreamento || "",
    servico: obj.servico?.nome || obj.servico?.codigo || "—",
    transportadora: obj.logistica?.descricao || obj.logistica?.nome || "—",
    idTransportadora: obj.logistica?.id ? Number(obj.logistica.id) : null,
    situacaoId,
    situacaoNome,
    loja: obj.pedidoLoja?.origem || obj.loja?.descricao || obj.loja?.nome || "—",
    dataCriacao: obj.dataCriacao || "",
    prazoEntrega: obj.prazoEntrega || "",
    quantidade: obj.itens?.reduce((acc: number, item: any) => acc + (item.quantidade || 0), 0) || 0,
    raw: obj,
  };
}

// ─── Situação Badge ───────────────────────────────────────────────────────────

const SitBadge: React.FC<{ id: number; nome: string }> = ({ id, nome }) => {
  let cls = "bg-slate-100 text-slate-600";
  let Icon = Clock;
  if (id === 1) { cls = "bg-blue-100 text-blue-700"; }
  else if (id === 2 || id === 3) { cls = "bg-amber-100 text-amber-700"; Icon = Tag; }
  else if (id === 4 || id === 6) { cls = "bg-sky-100 text-sky-700"; Icon = Truck; }
  else if (id === 5) { cls = "bg-emerald-100 text-emerald-700"; Icon = CheckCircle2; }
  else if (id === 7 || id === 8) { cls = "bg-red-100 text-red-700"; Icon = XCircle; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cls}`}>
      <Icon size={9} />{nome || `#${id}`}
    </span>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AbaLogistica: React.FC<Props> = ({ token, addToast, startDate, endDate, onAddLote }) => {
  const authH = token ? (token.startsWith("Bearer ") ? token : `Bearer ${token}`) : "";

  // ── Data ──
  const [objetos, setObjetos] = useState<LogObj[]>([]);
  const [transportadoras, setTransportadoras] = useState<{ id: number; nome: string }[]>([]);
  const [lojas, setLojas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Selection ──
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Filters ──
  const [filtroTransp, setFiltroTransp] = useState("todos");
  const [filtroLoja, setFiltroLoja] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState<"todos" | "impressa" | "nao_impressa">("todos");
  const [filtroVinculo, setFiltroVinculo] = useState<"todos" | "vinculado" | "desvinculado">("todos");
  const [filtroSituacao, setFiltroSituacao] = useState("todos");
  const [busca, setBusca] = useState("");

  // ── Track "impressa" locally ──
  const [impressasIds, setImpressasIds] = useState<Set<number>>(loadImpressas);

  // ── History ──
  const [historico, setHistorico] = useState<HistoricoEtiq[]>(loadHistorico);
  const [activeView, setActiveView] = useState<"lista" | "historico">("lista");
  const [remessasExistentes, setRemessasExistentes] = useState<any[]>([]);
  const [selectedRemessaId, setSelectedRemessaId] = useState<string>("");
  const [isAddingToRemessa, setIsAddingToRemessa] = useState(false);

  // ── Operations ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number; label: string } | null>(null);

  // ─── helpers ─────────────────────────────────────────────────────────────

  const addHistorico = useCallback((items: HistoricoEtiq[]) => {
    setHistorico(prev => {
      const next = [...items, ...prev].slice(0, 200);
      saveHistorico(next);
      return next;
    });
  }, []);

  const markImpressas = useCallback((ids: number[]) => {
    setImpressasIds(prev => {
      const next = new Set([...prev, ...ids]);
      saveImpressas(next);
      return next;
    });
  }, []);

  // ─── Fetch all objects from Bling ─────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const all: any[] = [];
      let pagina = 1;
      let hasMore = true;
      while (hasMore && pagina <= 30) {
        const { data, hasMore: more } = await fetchLogisticasObjetos(token, {
          pagina,
          limite: 100,
          dataInicial: startDate,
          dataFinal: endDate,
        });
        all.push(...data);
        hasMore = more;
        pagina++;
        // small yield to avoid blocking UI
        if (pagina % 3 === 0) await new Promise(r => setTimeout(r, 50));
      }
      const mapped = all.map(mapObj);
      setObjetos(mapped);

      // Extract unique transportadoras and lojas
      const transpMap = new Map<number, string>();
      const lojasSet = new Set<string>();
      mapped.forEach(o => {
        if (o.idTransportadora) transpMap.set(o.idTransportadora, o.transportadora);
        if (o.loja && o.loja !== "—") lojasSet.add(o.loja);
      });
      setTransportadoras([...transpMap.entries()].map(([id, nome]) => ({ id, nome })));
      setLojas([...lojasSet]);
    } catch (err: any) {
      addToast(`Erro ao buscar objetos: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [token, startDate, endDate, addToast]);

  const fetchRemessas = useCallback(async () => {
    if (!token) return;
    try {
      const resp = await fetch("/api/bling/logisticas/remessas?limite=50", {
        headers: { Authorization: authH }
      });
      if (resp.ok) {
        const data = await resp.json();
        setRemessasExistentes(data?.data || []);
      }
    } catch (err) {
      console.error("Erro ao buscar remessas:", err);
    }
  }, [token, authH]);

  // Auto-fetch removido de propósito conforme ordens. Uso estrito do botão Atualizar.

  // ─── Filtered + sorted list ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    return objetos
      .filter(o => {
        if (filtroTransp !== "todos" && String(o.idTransportadora) !== filtroTransp) return false;
        if (filtroLoja !== "todos" && o.loja !== filtroLoja) return false;
        if (filtroEtiqueta === "impressa" && !impressasIds.has(o.id)) return false;
        if (filtroEtiqueta === "nao_impressa" && impressasIds.has(o.id)) return false;
        if (filtroVinculo === "vinculado" && !o.idVenda) return false;
        if (filtroVinculo === "desvinculado" && !!o.idVenda) return false;
        if (filtroSituacao !== "todos" && String(o.situacaoId) !== filtroSituacao) return false;
        if (busca) {
          const q = busca.toLowerCase();
          return (
            o.numero.toLowerCase().includes(q) ||
            o.nfeNumero.toLowerCase().includes(q) ||
            o.contato.toLowerCase().includes(q) ||
            o.rastreio.toLowerCase().includes(q) ||
            o.transportadora.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());
  }, [objetos, filtroTransp, filtroLoja, filtroEtiqueta, filtroVinculo, filtroSituacao, busca, impressasIds]);

  // ─── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(o => o.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ─── Get ZPL label from Bling per object ──────────────────────────────────

  const fetchZplEnvio = async (idObjeto: number): Promise<string | null> => {
    try {
      const resp = await fetch(`/api/bling/logisticas/etiquetas/zpl?idsObjetos[]=${idObjeto}`, {
        headers: { Authorization: authH },
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.data?.[0]?.zpl || data?.[0]?.zpl || null;
    } catch { return null; }
  };

  // ─── Get DANFE ZPL from NF-e ───────────────────────────────────────────────

  const fetchDanfeZpl = async (nfeId: number, obj: LogObj): Promise<string | null> => {
    try {
      const detalhe = await fetchNfeDetalhe(token!, nfeId);
      const d = detalhe?.data || detalhe;
      if (!d) return null;
      const danfe = nfeJsonToDanfeZplData(d, {
        id: obj.idVenda || nfeId,
        numero: obj.nfeNumero,
        contato: { nome: obj.contato },
        valorTotal: d.total?.ICMSTot?.vNF || 0,
      } as any);
      return gerarDanfeSimplificadaZPL(danfe);
    } catch { return null; }
  };

  // ─── Single: generate ZPL Envio + DANFE for one object ────────────────────

  const handleGerarUnico = async (obj: LogObj) => {
    if (!token) return;
    addToast(`Gerando etiqueta para #${obj.numero}...`, "info");
    const newHist: HistoricoEtiq[] = [];

    const zplEnvio = await fetchZplEnvio(obj.id);
    if (zplEnvio) {
      downloadBlob(zplEnvio, `Etiqueta_Envio_${obj.numero}.txt`);
      newHist.push({ ts: new Date().toISOString(), numero: obj.numero, nfe: obj.nfeNumero, transp: obj.transportadora, tipo: "zpl_envio", conteudo: zplEnvio });
    } else {
      addToast(`Etiqueta de envio não disponível para #${obj.numero}`, "warning");
    }

    if (obj.nfeId) {
      const zplDanfe = await fetchDanfeZpl(obj.nfeId, obj);
      if (zplDanfe) {
        downloadBlob(zplDanfe, `DANFE_${obj.nfeNumero || obj.numero}.txt`);
        newHist.push({ ts: new Date().toISOString(), numero: obj.numero, nfe: obj.nfeNumero, transp: obj.transportadora, tipo: "zpl_danfe", conteudo: zplDanfe });
      }
    }

    if (newHist.length > 0) {
      addHistorico(newHist);
      markImpressas([obj.id]);
      addToast(`✅ Etiqueta(s) de #${obj.numero} gerada(s) e salvas!`, "success");
    }
  };

  // ─── Batch: generate ZPL Envio + DANFE for all selected ──────────────────

  const handleGerarSelecionados = async () => {
    if (selectedIds.size === 0) { addToast("Selecione ao menos um objeto.", "warning"); return; }
    if (!token) return;
    const selecionados = filtered.filter(o => selectedIds.has(o.id));
    setIsGenerating(true);
    const newHist: HistoricoEtiq[] = [];
    const impIds: number[] = [];
    let successCount = 0;
    const successIds: string[] = [];
    let zplAll = "";
    const failedItems: { orderId: string; blingId: string; error: string }[] = [];

    for (let i = 0; i < selecionados.length; i++) {
      const obj = selecionados[i];
      setGenProgress({ current: i + 1, total: selecionados.length, label: `#${obj.numero}` });

      try {
        const zplEnvio = await fetchZplEnvio(obj.id);
        if (zplEnvio) {
          downloadBlob(zplEnvio, `Etiqueta_${obj.numero}.txt`);
          zplAll += zplEnvio + "\n";
          newHist.push({ ts: new Date().toISOString(), numero: obj.numero, nfe: obj.nfeNumero, transp: obj.transportadora, tipo: "zpl_envio", conteudo: zplEnvio });
          successIds.push(obj.numero);
        }

        if (obj.nfeId) {
          const zplDanfe = await fetchDanfeZpl(obj.nfeId, obj);
          if (zplDanfe) {
            downloadBlob(zplDanfe, `DANFE_${obj.nfeNumero || obj.numero}.txt`);
            newHist.push({ ts: new Date().toISOString(), numero: obj.numero, nfe: obj.nfeNumero, transp: obj.transportadora, tipo: "zpl_danfe", conteudo: zplDanfe });
          }
        }
        impIds.push(obj.id);
        successCount++;
      } catch (e: any) {
        failedItems.push({ orderId: obj.numero, blingId: String(obj.id), error: e.message });
      }

      if (i < selecionados.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    if (newHist.length > 0) addHistorico(newHist);
    if (impIds.length > 0) markImpressas(impIds);

    // Save lote to BlingPage zplLotes
    if (onAddLote && zplAll) {
      onAddLote({
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        total: selecionados.length,
        success: successCount,
        successIds,
        failed: failedItems,
        zplContent: zplAll,
      });
    }

    setIsGenerating(false);
    setGenProgress(null);
    clearSelection();
    addToast(`✅ ${successCount}/${selecionados.length} etiqueta(s) gerada(s) e salvas!`, "success");
  };

  // ─── Batch: create remessas (50/carrier) ─────────────────────────────────

  const handleCriarRemessas = async () => {
    if (selectedIds.size === 0) { addToast("Selecione objetos para criar remessas.", "warning"); return; }
    if (!token) return;
    const selecionados = filtered.filter(o => selectedIds.has(o.id));

    // Group by idTransportadora
    const byTransp = new Map<number, LogObj[]>();
    selecionados.forEach(o => {
      const key = o.idTransportadora || 0;
      if (!byTransp.has(key)) byTransp.set(key, []);
      byTransp.get(key)!.push(o);
    });

    setIsGenerating(true);
    let totalRemessas = 0;
    let errors = 0;

    for (const [transpId, objs] of byTransp) {
      // Split into chunks of 50
      for (let i = 0; i < objs.length; i += 50) {
        const chunk = objs.slice(i, i + 50);
        setGenProgress({ current: totalRemessas + 1, total: Math.ceil(selecionados.length / 50), label: `Remessa ${totalRemessas + 1}` });
        try {
          const body: any = { objetos: chunk.map(o => ({ id: o.id })) };
          if (transpId > 0) body.logistica = { id: transpId };
          const resp = await fetch("/api/bling/logisticas/remessas", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authH },
            body: JSON.stringify(body),
          });
          if (resp.ok) {
            totalRemessas++;
          } else {
            errors++;
          }
        } catch { errors++; }
        await new Promise(r => setTimeout(r, 400));
      }
    }

    setIsGenerating(false);
    setGenProgress(null);
    clearSelection();
    addToast(`${errors === 0 ? "✅" : "⚠️"} ${totalRemessas} remessa(s) criada(s)${errors ? `, ${errors} erro(s)` : ""}.`, errors ? "warning" : "success");
    fetchRemessas();
  };

  const handleAdicionarObjetosRemessa = async () => {
    if (selectedIds.size === 0) { addToast("Selecione objetos para adicionar.", "warning"); return; }
    if (!selectedRemessaId) { addToast("Selecione uma remessa existente.", "warning"); return; }
    if (!token) return;

    const selecionados = filtered.filter(o => selectedIds.has(o.id));
    setIsAddingToRemessa(true);

    try {
      const body = { objetos: selecionados.map(o => ({ id: o.id })) };
      const resp = await fetch(`/api/bling/logisticas/remessas/${selectedRemessaId}/objetos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authH },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        addToast(`✅ Objetos adicionados à remessa ${selectedRemessaId} com sucesso!`, "success");
        clearSelection();
        setSelectedRemessaId("");
      } else {
        const err = await resp.json();
        addToast(`Erro ao adicionar: ${err.error || "Erro desconhecido"}`, "error");
      }
    } catch (e: any) {
      addToast(`Erro de conexão: ${e.message}`, "error");
    } finally {
      setIsAddingToRemessa(false);
    }
  };

  // ─── Batch: get PDF from Bling ─────────────────────────────────────────────

  const handlePDFBling = async () => {
    if (selectedIds.size === 0) { addToast("Selecione objetos para gerar PDF.", "warning"); return; }
    if (!token) return;
    const idsObjetos = filtered.filter(o => selectedIds.has(o.id)).map(o => o.id);
    setIsGenerating(true);
    try {
      const resp = await fetch("/api/bling/logisticas/etiquetas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authH },
        body: JSON.stringify({ idsObjetos }),
      });
      const json = await resp.json();
      const url = json?.data?.url || json?.url;
      if (url) {
        window.open(url, "_blank");
        addToast("✅ PDF de etiquetas aberto!", "success");
        markImpressas(idsObjetos);
      } else {
        addToast("PDF não disponível. Certifique-se que as etiquetas estão geradas no Bling.", "warning");
      }
    } catch (err: any) {
      addToast(`Erro: ${err.message}`, "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // ─── Batch: sync tracking with marketplace ────────────────────────────────

  const handleSincronizarRastreio = async () => {
    if (selectedIds.size === 0) { addToast("Selecione objetos para sincronizar.", "warning"); return; }
    if (!token) return;
    const selecionados = filtered.filter(o => selectedIds.has(o.id) && !!o.idVenda && !!o.rastreio);
    if (selecionados.length === 0) {
      addToast("Nenhum objeto selecionado tem idVenda + rastreio para sincronizar.", "warning");
      return;
    }
    setIsGenerating(true);
    let ok = 0; let fail = 0;
    for (const obj of selecionados) {
      try {
        // Update the venda with the tracking code — Bling syncs automatically
        const resp = await fetch(`/api/bling/pedido-venda/${obj.idVenda}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: authH },
          body: JSON.stringify({ transporte: { volumes: [{ numeracao: obj.rastreio }] } }),
        });
        if (resp.ok) ok++; else fail++;
      } catch { fail++; }
      await new Promise(r => setTimeout(r, 300));
    }
    setIsGenerating(false);
    clearSelection();
    addToast(`${ok} rastreio(s) sincronizado(s) com a loja virtual${fail ? `, ${fail} erro(s)` : ""}.`, fail ? "warning" : "success");
  };

  // ─── Copy tracking ────────────────────────────────────────────────────────

  const handleCopyRastreio = async (codigo: string) => {
    try { await navigator.clipboard.writeText(codigo); addToast("Rastreio copiado!", "success"); }
    catch { addToast("Não foi possível copiar.", "error"); }
  };

  // ─── Situations list ─────────────────────────────────────────────────────────

  const situacoesDistintas = useMemo(() => {
    const m = new Map<string, string>();
    objetos.forEach(o => { if (o.situacaoId) m.set(String(o.situacaoId), o.situacaoNome); });
    return [...m.entries()];
  }, [objetos]);

  // ─── Format date ─────────────────────────────────────────────────────────────

  const fmtDate = (d: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };

  const fmtDateFull = (d: string) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
  };

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              <Package size={18} className="text-orange-600" /> Logística — Objetos de Postagem
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Busca direta do Bling. Gere etiquetas, DANFE e sincronize rastreios com a loja virtual.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border border-slate-200">
              <button
                onClick={() => setActiveView("lista")}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "lista" ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <ListChecks size={12} /> Lista ({objetos.length})
              </button>
              <button
                onClick={() => setActiveView("historico")}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "historico" ? "bg-orange-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
              >
                <History size={12} /> Histórico ({historico.length})
              </button>
            </div>
            <button
              onClick={fetchAll}
              disabled={isLoading || !token}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Atualizar
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Transportadora */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Truck size={9} /> Transportadora
            </label>
            <select
              value={filtroTransp}
              onChange={e => setFiltroTransp(e.target.value)}
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            >
              <option value="todos">Todas</option>
              {transportadoras.map(t => (
                <option key={t.id} value={String(t.id)}>{t.nome}</option>
              ))}
            </select>
          </div>

          {/* Adicionar a Remessa Existente */}
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
              <Box size={9} /> Add a Remessa Existente
            </label>
            <div className="flex gap-1">
              <select
                value={selectedRemessaId}
                onChange={e => setSelectedRemessaId(e.target.value)}
                className="flex-1 border-2 border-blue-50 rounded-xl px-2 py-1.5 text-[10px] font-bold bg-blue-50/50 outline-none focus:border-blue-400"
              >
                <option value="">Selecionar Remessa...</option>
                {remessasExistentes.map(r => (
                  <option key={r.id} value={r.id}>
                    #{r.id} ({r.situacao === 0 ? 'Aberta' : 'Fechada'}) - {fmtDate(r.dataCriacao)}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAdicionarObjetosRemessa}
                disabled={isAddingToRemessa || !selectedRemessaId || selectedIds.size === 0}
                className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-1 shrink-0 shadow-lg shadow-blue-100"
              >
                {isAddingToRemessa ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Add
              </button>
            </div>
          </div>

          {/* Loja */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <ShoppingBag size={9} /> Loja
            </label>
            <select
              value={filtroLoja}
              onChange={e => setFiltroLoja(e.target.value)}
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            >
              <option value="todos">Todas</option>
              {lojas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Etiqueta */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Printer size={9} /> Etiqueta
            </label>
            <select
              value={filtroEtiqueta}
              onChange={e => setFiltroEtiqueta(e.target.value as any)}
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            >
              <option value="todos">Todas</option>
              <option value="nao_impressa">Não impressa</option>
              <option value="impressa">Impressa ✓</option>
            </select>
          </div>

          {/* Vínculo */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Tag size={9} /> Vínculo
            </label>
            <select
              value={filtroVinculo}
              onChange={e => setFiltroVinculo(e.target.value as any)}
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            >
              <option value="todos">Todos</option>
              <option value="vinculado">Vinculado (tem NF/venda)</option>
              <option value="desvinculado">Desvinculado</option>
            </select>
          </div>

          {/* Situação */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Clock size={9} /> Situação
            </label>
            <select
              value={filtroSituacao}
              onChange={e => setFiltroSituacao(e.target.value)}
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            >
              <option value="todos">Todas</option>
              {situacoesDistintas.map(([id, nome]) => (
                <option key={id} value={id}>{nome}</option>
              ))}
            </select>
          </div>

          {/* Busca */}
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Search size={9} /> Busca
            </label>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Pedido, NF-e, cliente..."
              className="border-2 border-slate-100 rounded-xl px-2 py-1.5 text-xs font-bold bg-slate-50 outline-none focus:border-orange-400"
            />
          </div>
        </div>
      </div>

      {/* ── Batch actions bar ── */}
      {selectedIds.size > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full flex items-center gap-1">
            <CheckSquare size={11} /> {selectedIds.size} selecionado(s)
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={clearSelection}
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white text-slate-400 hover:bg-slate-50 border border-slate-200"
            >
              Limpar
            </button>
            <button
              onClick={handleGerarSelecionados}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-orange-600 text-white hover:bg-orange-700 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
              ZPL + DANFE
            </button>
            <button
              onClick={handlePDFBling}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              <FileText size={11} /> PDF Bling
            </button>
            <button
              onClick={handleCriarRemessas}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all disabled:opacity-50"
            >
              <Box size={11} /> Criar Remessa(s) 50/50
            </button>
            <button
              onClick={handleSincronizarRastreio}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              <Send size={11} /> Sincronizar Rastreio
            </button>
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {genProgress && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-orange-700 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" /> {genProgress.label}
            </span>
            <span className="text-xs font-bold text-orange-600">{genProgress.current}/{genProgress.total}</span>
          </div>
          <div className="w-full bg-orange-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-orange-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.round((genProgress.current / genProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* ── LISTA VIEW ── */}
      {activeView === "lista" && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-orange-500" />
              <span className="text-sm font-bold">Buscando objetos de postagem do Bling...</span>
              <span className="text-xs">Isso pode levar alguns segundos para períodos longos</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Package size={40} strokeWidth={1.5} />
              <p className="text-sm font-bold">Nenhum objeto encontrado.</p>
              <p className="text-[11px]">{objetos.length === 0 ? "Verifique o período e a conexão com o Bling." : "Ajuste os filtros."}</p>
            </div>
          ) : (
            <>
              <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                <span className="text-[11px] font-black text-orange-700 uppercase tracking-widest">
                  {filtered.length} objeto(s){busca || filtroTransp !== "todos" || filtroLoja !== "todos" || filtroEtiqueta !== "todos" || filtroVinculo !== "todos" || filtroSituacao !== "todos" ? " (filtrado)" : ""}
                </span>
                <span className="text-[10px] text-slate-400">Direto do Bling — ordenado por data ↓</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-3 py-3 text-center w-8">
                        <button onClick={toggleAll} className="text-slate-400 hover:text-orange-600">
                          {selectedIds.size === filtered.length && filtered.length > 0
                            ? <CheckSquare size={14} className="text-orange-600" />
                            : <Square size={14} />}
                        </button>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><Hash size={10} /># Pedido / NF-e</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><User size={10} /> Cliente</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><MapPin size={10} /> Rastreio</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><Truck size={10} /> Serviço / Transp.</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><ShoppingBag size={10} /> Loja</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Situação</th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><Printer size={10} /> Etiqueta</div>
                      </th>
                      <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                        <div className="flex items-center gap-1"><Calendar size={10} /> Data</div>
                      </th>
                      <th className="px-3 py-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(obj => (
                      <tr
                        key={obj.id}
                        className={`border-b border-slate-50 hover:bg-orange-50/20 transition-colors ${selectedIds.has(obj.id) ? "bg-orange-50/40" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => toggleSelect(obj.id)} className="text-slate-400 hover:text-orange-600">
                            {selectedIds.has(obj.id)
                              ? <CheckSquare size={14} className="text-orange-600" />
                              : <Square size={14} />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-black text-slate-700 text-[11px]">#{obj.numero}</div>
                          {obj.nfeNumero && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <FileText size={8} /> NF-e {obj.nfeNumero}
                            </div>
                          )}
                          {obj.idVenda && (
                            <div className="text-[9px] text-emerald-600 font-bold">✓ Vinculado</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-[11px] max-w-[140px] truncate" title={obj.contato}>
                          {obj.contato}
                        </td>
                        <td className="px-3 py-2.5">
                          {obj.rastreio ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-lg text-[10px]">
                              {obj.rastreio}
                              <button onClick={() => handleCopyRastreio(obj.rastreio)} className="text-emerald-400 hover:text-emerald-700">
                                <Copy size={10} />
                              </button>
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">sem rastreio</span>
                          )}
                        </td>
                        <td className="px-4 py-4 border-b border-slate-50 text-center font-black text-slate-700 text-xs">
                          {obj.quantidade}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-600">
                          <div>{obj.servico}</div>
                          <div className="text-[10px] text-slate-400">{obj.transportadora}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          {obj.loja !== "—" ? (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{obj.loja}</span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <SitBadge id={obj.situacaoId} nome={obj.situacaoNome} />
                        </td>
                        <td className="px-3 py-2.5">
                          {impressasIds.has(obj.id) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              <CheckCircle2 size={9} /> Impressa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <Printer size={9} /> Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[10px] text-slate-500">{fmtDate(obj.dataCriacao)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={() => handleGerarUnico(obj)}
                              disabled={isGenerating}
                              className="inline-flex items-center text-orange-500 hover:text-orange-700 text-[10px] font-bold px-1.5 py-1 rounded hover:bg-orange-50 disabled:opacity-40"
                              title="Gerar ZPL Envio + DANFE"
                            >
                              <Zap size={12} />
                            </button>
                            {obj.rastreio && (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(obj.rastreio)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-500 hover:text-blue-700 text-[10px] font-bold px-1.5 py-1 rounded hover:bg-blue-50"
                                title="Rastrear"
                              >
                                <ArrowUpRight size={12} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── HISTORICO VIEW ── */}
      {activeView === "historico" && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <History size={13} /> Histórico de Etiquetas Geradas
            </span>
            {historico.length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Limpar todo o histórico?")) {
                    setHistorico([]);
                    saveHistorico([]);
                  }
                }}
                className="text-[10px] font-black text-red-500 uppercase px-2 py-1 hover:bg-red-50 rounded"
              >
                <Trash2 size={11} className="inline" /> Limpar
              </button>
            )}
          </div>
          {historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <History size={40} strokeWidth={1.5} />
              <p className="text-sm font-bold">Nenhuma etiqueta gerada ainda.</p>
              <p className="text-[11px]">Após gerar etiquetas, elas aparecerão aqui e ficam salvas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Data/Hora</th>
                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]"># Pedido</th>
                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">NF-e / Pedido</th>
                    <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Qtd</th>
                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Transportadora</th>
                    <th className="px-4 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">Tipo</th>
                    <th className="px-4 py-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">Baixar</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 text-slate-500 text-[10px]">{fmtDateFull(item.ts)}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-700">#{item.numero}</td>
                      <td className="px-4 py-2.5 text-slate-600">{item.nfe || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-[11px]">{item.transp}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${item.tipo === "zpl_envio" ? "bg-orange-100 text-orange-700" : item.tipo === "zpl_danfe" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {item.tipo === "zpl_envio" ? "Etiqueta ZPL" : item.tipo === "zpl_danfe" ? "DANFE ZPL" : "PDF"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {item.conteudo && (
                          <button
                            onClick={() => downloadBlob(item.conteudo!, `${item.tipo}_${item.numero}.txt`)}
                            className="inline-flex items-center text-blue-500 hover:text-blue-700 text-[10px] font-bold px-2 py-1 rounded hover:bg-blue-50"
                          >
                            <Download size={11} />
                          </button>
                        )}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-blue-500 hover:text-blue-700 text-[10px] font-bold px-2 py-1 rounded hover:bg-blue-50">
                            <ArrowUpRight size={11} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AbaLogistica;
