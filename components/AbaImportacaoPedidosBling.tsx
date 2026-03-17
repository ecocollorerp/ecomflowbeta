// ============================================================================
// components/AbaImportacaoPedidosBling.tsx  — v2.0 (redesign completo)
// Importação de pedidos do Bling com filtros avançados, campos editáveis
// por accordion e fluxo NF-e com persistência de lotes no Supabase.
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Package,
  Truck,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
  FileText,
  Tag,
  ChevronDown,
  ChevronUp,
  Edit,
  X,
  ArrowRight
} from "lucide-react";
import { ImportacaoControllerService } from "../services/importacaoControllerService";
import type { PedidoOverride, LoteNfe } from "../types";

// ────────────────────────────────────────────────────────────────────────────
// Tipos locais
// ────────────────────────────────────────────────────────────────────────────

interface PedidoEmAberto {
  id: string;
  numero: string;
  numeroLoja: string;
  dataCompra: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
  };
  origem: string;
  itens: Array<{
    descricao: string;
    sku: string;
    quantidade: number;
    valor: number;
    ncm?: string;
  }>;
  total: number;
  status: string;
  jaImportado: boolean;
  rastreamento?: string;
  loja?: { id?: string; nome?: string };
}

// Situações Bling v3: id → rótulo
const SITUACOES_BLING: { id: number; label: string; cor: string }[] = [
  { id: 6, label: "Em Aberto", cor: "blue" },
  { id: 15, label: "Em Andamento", cor: "amber" },
  { id: 9, label: "Atendido", cor: "green" },
  { id: 12, label: "Cancelado", cor: "red" },
  { id: 14, label: "Verificado", cor: "purple" }
];

const ORIGENS_PRODUTO = [
  { value: 0, label: "0 — Nacional" },
  { value: 1, label: "1 — Estrangeira (importação direta)" },
  { value: 2, label: "2 — Estrangeira (adquirida no mercado interno)" },
  { value: 3, label: "3 — Nacional (> 40% importado)" },
  { value: 4, label: "4 — Nacional (CIDE)" },
  { value: 5, label: "5 — Nacional (básica)" },
  { value: 6, label: "6 — Estrangeira (importação direta sem similar)" },
  { value: 7, label: "7 — Estrangeira (adquirida sem similar)" },
  { value: 8, label: "8 — Nacional (especial)" }
];

// ────────────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────────────

interface AbaImportacaoPedidosBlingProps {
  token?: string;
  addToast?: (
    msg: string,
    tipo: "success" | "error" | "info" | "warning"
  ) => void;
  canaisVenda?: Array<{ id: string; descricao: string; tipo?: string }>;
  /** Callback quando um lote é gerado — usado pela BlingPage para exibir na aba NF-e */
  onLoteGerado?: (lote: LoteNfe) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Retorna o nome da loja real do pedido (usado nos badges e filtros).
 *  Resolve por canaisVenda quando loja.nome não está disponível na API de listagem. */
function getLojaNome(
  pedido: PedidoEmAberto,
  canaisVenda: Array<{ id: string; descricao: string }> = []
): string {
  // 1) Se a API já trouxe o nome, usa direto
  if (pedido.loja?.nome) return pedido.loja.nome;
  // 2) Resolve pelo ID da loja usando os canais de venda carregados
  if (pedido.loja?.id && canaisVenda.length > 0) {
    const canal = canaisVenda.find((c) => String(c.id) === String(pedido.loja!.id));
    if (canal) return canal.descricao;
  }
  // 3) Fallback: venda_origem ou origem genérica
  return pedido.origem || "—";
}

/** Strip prefixo bling_ se existir (legado). */
function blingRawId(id: string): string {
  return id.replace(/^bling_/, "");
}

function LojaBadge({ nome }: { nome: string }) {
  const upper = nome.toUpperCase();
  let cls = "bg-slate-100 text-slate-600 border-slate-200";
  if (
    upper.includes("MERCADO") ||
    upper.includes("LIVRE") ||
    upper.includes("ML")
  )
    cls = "bg-yellow-100 text-yellow-800 border-yellow-300";
  else if (upper.includes("SHOPEE"))
    cls = "bg-orange-100 text-orange-700 border-orange-300";
  return (
    <span
      className={`text-[9px] font-black px-1.5 py-0.5 rounded border leading-none truncate max-w-[120px] ${cls}`}
      title={nome}
    >
      {nome}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Componente principal
// ────────────────────────────────────────────────────────────────────────────

export const AbaImportacaoPedidosBling: React.FC<
  AbaImportacaoPedidosBlingProps
> = ({ token, addToast, canaisVenda = [], onLoteGerado }) => {
  // ── Estado de pedidos ──────────────────────────────────────────────────────
  const [pedidos, setPedidos] = useState<PedidoEmAberto[]>([]);
  const [isCarregando, setIsCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // ── Estado de ações NF-e ───────────────────────────────────────────────────
  const [gerandoNfeId, setGerandoNfeId] = useState<string | null>(null);
  const [isGerandoLote, setIsGerandoLote] = useState(false);
  const [isGerandoEmitindoLote, setIsGerandoEmitindoLote] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState<{
    atual: number;
    total: number;
    erros: number;
  } | null>(null);
  const [lotesGerados, setLotesGerados] = useState<LoteNfe[]>([]);

  // ── Campos editáveis por pedido (accordion) ────────────────────────────────
  const [expandedOverride, setExpandedOverride] = useState<string | null>(null);
  const [pedidoOverrides, setPedidoOverrides] = useState<
    Record<string, PedidoOverride>
  >({});

  // ── Filtros de busca ───────────────────────────────────────────────────────
  const [situacoesFiltro, setSituacoesFiltro] = useState<number[]>([6, 15]);
  const [idLojaFiltro, setIdLojaFiltro] = useState("");
  const [apenasComEtiqueta, setApenasComEtiqueta] = useState(false);
  const [quantidadeDesejada, setQuantidadeDesejada] = useState(200);
  const [pagina, setPagina] = useState(1);
  const [ordenacao, setOrdenacao] = useState<"asc" | "desc">("desc");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  // ── Filtros de exibição ────────────────────────────────────────────────────
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroSku, setFiltroSku] = useState("");
  const [lojaFiltroNome, setLojaFiltroNome] = useState<string>("TODOS");

  // ── Limpar lista ao trocar filtros que afetam o resultado da API ──────────
  useEffect(() => {
    if (token) {
      setPedidos([]);
      setSelecionados(new Set());
    }
  }, [
    apenasComEtiqueta,
    quantidadeDesejada,
    idLojaFiltro,
    ordenacao,
    dataInicial,
    dataFinal,
    situacoesFiltro.join(",")
  ]);

  // ── Auto-carregamento na primeira montagem ─────────────────────────────
  const [jaCarregou, setJaCarregou] = useState(false);
  useEffect(() => {
    if (token && !jaCarregou) {
      setJaCarregou(true);
      buscarPedidosRef.current?.();
    }
  }, [token]);
  // ── Lista filtrada ─────────────────────────────────────────────────────────
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      const texto = filtroTexto.toLowerCase();
      const passTexto =
        !filtroTexto ||
        p.numero.toLowerCase().includes(texto) ||
        p.numeroLoja.toLowerCase().includes(texto) ||
        p.cliente.nome.toLowerCase().includes(texto) ||
        (p.loja?.nome || getLojaNome(p, canaisVenda) || "").toLowerCase().includes(texto);

      const passSku =
        !filtroSku ||
        p.itens.some((it) =>
          it.sku.toLowerCase().includes(filtroSku.toLowerCase())
        );

      const passLoja =
        lojaFiltroNome === "TODOS" || getLojaNome(p, canaisVenda) === lojaFiltroNome;

      return passTexto && passSku && passLoja;
    });
  }, [pedidos, filtroTexto, filtroSku, lojaFiltroNome, canaisVenda]);

  // ── Lojas distintas (para as tabs de filtro) ──────────────────────────────
  const lojasDistintas = useMemo(() => {
    const contagem: Record<string, number> = {};
    pedidos.forEach((p) => {
      const nome = getLojaNome(p, canaisVenda);
      contagem[nome] = (contagem[nome] || 0) + 1;
    });
    return contagem;
  }, [pedidos, canaisVenda]);

  // ────────────────────────────────────────────────────────────────────────────
  // Funções de negócio
  // ────────────────────────────────────────────────────────────────────────────

  const buscarPedidos = async () => {
    if (!token) {
      addToast?.("Token Bling não configurado", "error");
      return;
    }
    setIsCarregando(true);
    try {
      const resultado =
        await ImportacaoControllerService.buscarPedidosEmAbertoPorPlataforma(
          token,
          "TODOS",
          {
            quantidadeDesejada,
            apenasComEtiqueta,
            pagina,
            limite: 100,
            idsSituacoes: situacoesFiltro,
            idLoja: idLojaFiltro || undefined,
            ordenar: ordenacao,
            dataInicial: dataInicial || undefined,
            dataFinal: dataFinal || undefined
          }
        );
      setPedidos(resultado.pedidosDisponiveis);
      addToast?.(
        `${resultado.pedidosDisponiveis.length} pedidos carregados`,
        "success"
      );
    } catch (err: any) {
      addToast?.(`Erro ao buscar pedidos: ${err.message}`, "error");
    } finally {
      setIsCarregando(false);
    }
  };

  // Ref para o auto-load poder chamar buscarPedidos no mount
  const buscarPedidosRef = useRef(buscarPedidos);
  buscarPedidosRef.current = buscarPedidos;

  const gerarNfeLote = async (emitir: boolean) => {
    if (selecionados.size === 0) {
      addToast?.("Selecione ao menos um pedido", "error");
      return;
    }
    const setLoading = emitir ? setIsGerandoEmitindoLote : setIsGerandoLote;
    setLoading(true);

    const ids: string[] = Array.from(selecionados);
    const resultados: Array<{
      pedidoVendaId: string;
      success: boolean;
      nfe?: any;
      error?: string;
    }> = [];
    setLoteProgresso({ atual: 0, total: ids.length, erros: 0 });

    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const override = pedidoOverrides[id];
      setGerandoNfeId(id);
      setLoteProgresso((prev) => (prev ? { ...prev, atual: i + 1 } : null));

      try {
        const resp = await fetch("/api/bling/nfe/criar-emitir", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ blingOrderId: id, emitir, override })
        });
        const data = await resp.json();
        const ok = data.success || resp.ok;
        resultados.push({
          pedidoVendaId: id,
          success: ok,
          nfe: data.nfe,
          error: data.error || data.message
        });

        if (ok) {
          setPedidos((prev) => prev.filter((p) => p.id !== id));
          setSelecionados((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } else {
          setLoteProgresso((prev) =>
            prev ? { ...prev, erros: prev.erros + 1 } : null
          );
          const pedido = pedidos.find((p) => p.id === id);
          addToast?.(
            `Falha NF-e #${pedido?.numero || id}: ${data.error || data.message || "Erro desconhecido"}`,
            "error"
          );
        }
      } catch (err: any) {
        resultados.push({
          pedidoVendaId: id,
          success: false,
          error: err.message
        });
        setLoteProgresso((prev) =>
          prev ? { ...prev, erros: prev.erros + 1 } : null
        );
        addToast?.(`Erro rede #${id}: ${err.message}`, "error");
      }

      // Delay entre chamadas — cada criar-emitir faz 3-4 chamadas Bling internamente
      if (i < ids.length - 1) await new Promise((r) => setTimeout(r, 3000));
    }

    setGerandoNfeId(null);
    setLoteProgresso(null);
    setLoading(false);

    const ok = resultados.filter((r) => r.success).length;
    const fail = resultados.length - ok;

    if (ok > 0) {
      const lote: LoteNfe = {
        id: `LOTE-${Date.now()}`,
        data: new Date().toISOString(),
        tipo: emitir ? "GERACAO_EMISSAO" : "GERACAO_APENAS",
        total: resultados.length,
        ok,
        fail,
        nfes: resultados
          .filter((r) => r.success)
          .map((r) => ({
            pedidoVendaId: r.pedidoVendaId,
            nfeId: r.nfe?.id,
            nfeNumero: r.nfe?.numero
          }))
      };
      setLotesGerados((prev) => [lote, ...prev]);
      onLoteGerado?.(lote);
      addToast?.(
        `${ok}/${resultados.length} NF-e${emitir ? " geradas e emitidas" : " geradas"} — Lote ${lote.id}`,
        fail > 0 ? "warning" : "success"
      );
    } else {
      addToast?.("Nenhuma NF-e gerada com sucesso.", "error");
    }
  };

  const gerarNfeIndividual = async (pedido: PedidoEmAberto) => {
    if (!token) return;
    setGerandoNfeId(pedido.id);
    try {
      const override = pedidoOverrides[pedido.id];
      const resp = await fetch("/api/bling/nfe/criar-emitir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          blingOrderId: pedido.id,
          emitir: true,
          override
        })
      });
      const data = await resp.json();
      if (data.success) {
        const lote: LoteNfe = {
          id: `LOTE-${Date.now()}`,
          data: new Date().toISOString(),
          tipo: "GERACAO_EMISSAO",
          total: 1,
          ok: 1,
          fail: 0,
          nfes: [
            {
              pedidoVendaId: String(pedido.id),
              nfeId: data.nfe?.id,
              nfeNumero: data.nfe?.numero
            }
          ]
        };
        setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
        setLotesGerados((prev) => [lote, ...prev]);
        onLoteGerado?.(lote);
        addToast?.(
          `NF-e gerada para pedido #${pedido.numero} — Lote ${lote.id}`,
          "success"
        );
      } else {
        addToast?.(
          `Falha NF-e #${pedido.numero}: ${data.error || data.message}`,
          "error"
        );
      }
    } catch (err: any) {
      addToast?.(`Erro: ${err.message}`, "error");
    } finally {
      setGerandoNfeId(null);
    }
  };

  // ── Toggle accordion ───────────────────────────────────────────────────────
  const toggleOverride = (id: string) =>
    setExpandedOverride((prev) => (prev === id ? null : id));

  const updateOverride = (id: string, patch: Partial<PedidoOverride>) =>
    setPedidoOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch }
    }));

  // ── Seleção ────────────────────────────────────────────────────────────────
  const toggleTodos = () => {
    const allIds = pedidosFiltrados.map((p) => p.id);
    const todosJaSelecionados = allIds.every((id) => selecionados.has(id));
    const next = new Set(selecionados);
    if (todosJaSelecionados) allIds.forEach((id) => next.delete(id));
    else allIds.forEach((id) => next.add(id));
    setSelecionados(next);
  };

  const toggleSelecao = (id: string) => {
    const next = new Set(selecionados);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelecionados(next);
  };

  const totalSelecionados = selecionados.size;
  const todosVisivelSelecionados =
    pedidosFiltrados.length > 0 &&
    pedidosFiltrados.every((p) => selecionados.has(p.id));

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
        <AlertCircle size={40} className="text-red-400" />
        <p className="font-semibold text-slate-700">
          Token Bling não configurado
        </p>
        <p className="text-sm">
          Acesse as configurações e conecte sua conta Bling.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Lotes gerados (banners) ─────────────────────────────────────────── */}
      {lotesGerados.length > 0 && (
        <div className="flex flex-col gap-2">
          {lotesGerados.map((lote) => (
            <div
              key={lote.id}
              className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-green-200 bg-green-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <CheckCircle
                  size={16}
                  className="text-green-600 flex-shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-black text-green-800 truncate">
                    Lote {lote.id} — {lote.ok}/{lote.total} NF-e
                    {lote.tipo === "GERACAO_EMISSAO"
                      ? " geradas e emitidas"
                      : " geradas"}
                  </p>
                  <p className="text-[10px] text-green-600 truncate">
                    {new Date(lote.data).toLocaleString("pt-BR")}
                    {lote.fail > 0 && (
                      <span className="text-orange-600 ml-2">
                        {lote.fail} com falha
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <ArrowRight size={10} /> Ver na aba NF-e
                </span>
                <button
                  onClick={() =>
                    setLotesGerados((prev) =>
                      prev.filter((l) => l.id !== lote.id)
                    )
                  }
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Painel de filtros ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Situações */}
          <div className="flex flex-col gap-1 min-w-0">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Situação
            </label>
            <div className="flex flex-wrap gap-1">
              {SITUACOES_BLING.map((sit) => {
                const ativo = situacoesFiltro.includes(sit.id);
                return (
                  <button
                    key={sit.id}
                    onClick={() =>
                      setSituacoesFiltro((prev) =>
                        ativo
                          ? prev.filter((s) => s !== sit.id)
                          : [...prev, sit.id]
                      )
                    }
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                      ativo
                        ? "bg-blue-600 text-white border-blue-700"
                        : "bg-white text-slate-600 border-slate-200 hover:border-blue-400"
                    }`}
                  >
                    {sit.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loja */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Loja / Integração
            </label>
            {canaisVenda.length > 0 ? (
              <select
                value={idLojaFiltro}
                onChange={(e) => setIdLojaFiltro(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todas as lojas</option>
                {canaisVenda.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={idLojaFiltro}
                onChange={(e) => setIdLojaFiltro(e.target.value)}
                placeholder="ID da loja"
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 w-28 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {/* Data Inicial */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Data Inicial
            </label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Data Final */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Data Final
            </label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Quantidade */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Máx. pedidos
            </label>
            <select
              value={quantidadeDesejada}
              onChange={(e) => setQuantidadeDesejada(Number(e.target.value))}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              {[50, 100, 200, 500, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          {/* Ordenação */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Ordenação
            </label>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Novo → Antigo</option>
              <option value="asc">Antigo → Novo</option>
            </select>
          </div>

          {/* Com etiqueta */}
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer pb-1">
            <input
              type="checkbox"
              checked={apenasComEtiqueta}
              onChange={(e) => setApenasComEtiqueta(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-blue-600"
            />
            Apenas com etiqueta
          </label>

          {/* Botão buscar */}
          <button
            onClick={buscarPedidos}
            disabled={isCarregando}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 uppercase tracking-wide ml-auto"
          >
            {isCarregando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Buscar Pedidos
          </button>
        </div>
      </div>

      {/* ── Barra de filtro de exibição + canal ───────────────────────────── */}
      {pedidos.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* Tabs por loja */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl flex-wrap">
            <button
              onClick={() => setLojaFiltroNome("TODOS")}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                lojaFiltroNome === "TODOS"
                  ? "bg-white shadow text-blue-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos <span className="ml-1 opacity-70">({pedidos.length})</span>
            </button>
            {Object.entries(lojasDistintas).map(([nome, qtd]) => (
              <button
                key={nome}
                onClick={() => setLojaFiltroNome(nome)}
                className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all truncate max-w-[160px] ${
                  lojaFiltroNome === nome
                    ? "bg-white shadow text-blue-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title={nome}
              >
                {nome} <span className="ml-1 opacity-70">({qtd})</span>
              </button>
            ))}
          </div>

          {/* Busca + SKU */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar por número, cliente, loja..."
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="relative w-44">
              <Tag
                size={14}
                className="absolute left-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                placeholder="Filtrar por SKU"
                value={filtroSku}
                onChange={(e) => setFiltroSku(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de ações em lote ─────────────────────────────────────────── */}
      {pedidosFiltrados.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={todosVisivelSelecionados}
                onChange={toggleTodos}
                className="w-4 h-4 rounded accent-blue-600"
              />
              {totalSelecionados > 0
                ? `${totalSelecionados} selecionado${totalSelecionados > 1 ? "s" : ""}`
                : `Todos (${pedidosFiltrados.length})`}
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-medium">
                {pedidosFiltrados.length} de {pedidos.length} pedidos
              </span>
              <button
                onClick={() => gerarNfeLote(false)}
                disabled={
                  totalSelecionados === 0 ||
                  isGerandoLote ||
                  isGerandoEmitindoLote
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg hover:bg-emerald-700 disabled:opacity-40 uppercase"
              >
                {isGerandoLote ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                Gerar NF-e ({totalSelecionados})
              </button>
              <button
                onClick={() => gerarNfeLote(true)}
                disabled={
                  totalSelecionados === 0 ||
                  isGerandoLote ||
                  isGerandoEmitindoLote
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 disabled:opacity-40 uppercase"
              >
                {isGerandoEmitindoLote ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <CheckCircle size={12} />
                )}
                Gerar e Emitir ({totalSelecionados})
              </button>
            </div>
          </div>

          {/* Barra de progresso */}
          {loteProgresso && (
            <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Processando {loteProgresso.atual}/{loteProgresso.total}...
                </span>
                {loteProgresso.erros > 0 && (
                  <span className="text-[10px] font-bold text-red-600">
                    {loteProgresso.erros} erro
                    {loteProgresso.erros > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(loteProgresso.atual / loteProgresso.total) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lista de pedidos ──────────────────────────────────────────────── */}
      {isCarregando && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 size={24} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium">Carregando pedidos...</span>
        </div>
      )}

      {!isCarregando && pedidos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Package size={40} className="opacity-40" />
          <p className="text-sm font-medium text-slate-500">
            Nenhum pedido carregado
          </p>
          <p className="text-xs">
            Ajuste os filtros e clique em "Buscar Pedidos"
          </p>
        </div>
      )}

      {!isCarregando && pedidosFiltrados.length === 0 && pedidos.length > 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
          <Filter size={28} className="opacity-40" />
          <p className="text-sm text-slate-500">
            Nenhum pedido corresponde ao filtro atual
          </p>
        </div>
      )}

      {!isCarregando && pedidosFiltrados.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {pedidosFiltrados.map((pedido) => {
            const isSelecionado = selecionados.has(pedido.id);
            const isExpandido = expandedOverride === pedido.id;
            const override = pedidoOverrides[pedido.id] || {};
            const lojaNome = getLojaNome(pedido, canaisVenda);
            const isGerandoThis = gerandoNfeId === pedido.id;

            return (
              <div
                key={pedido.id}
                className={`transition-colors ${isSelecionado ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
              >
                {/* Linha principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelecionado}
                    onChange={() => toggleSelecao(pedido.id)}
                    className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                  />

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">
                        #{pedido.numero}
                      </span>
                      {pedido.numeroLoja && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({pedido.numeroLoja})
                        </span>
                      )}
                      <LojaBadge nome={lojaNome} />
                      {pedido.rastreamento && (
                        <span
                          title={pedido.rastreamento}
                          className="text-[9px] bg-teal-100 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded font-bold"
                        >
                          <Truck size={9} className="inline mr-0.5" />
                          RASTREIO
                        </span>
                      )}
                      {pedido.jaImportado && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-bold">
                          JÁ IMPORTADO
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-slate-600 truncate max-w-[180px]">
                        {pedido.cliente.nome}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(pedido.dataCompra).toLocaleDateString(
                          "pt-BR"
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {pedido.itens.length} item
                        {pedido.itens.length !== 1 ? "s" : ""} · R${" "}
                        {pedido.total.toFixed(2)}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {pedido.status}
                      </span>
                    </div>
                    {/* SKUs dos itens */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {pedido.itens.slice(0, 4).map((it, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono"
                        >
                          {it.sku || "—"}
                        </span>
                      ))}
                      {pedido.itens.length > 4 && (
                        <span className="text-[9px] text-slate-400">
                          +{pedido.itens.length - 4}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Editar dados NF-e */}
                    <button
                      onClick={() => toggleOverride(pedido.id)}
                      title="Editar dados NF-e"
                      className={`flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                        isExpandido
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600"
                      }`}
                    >
                      <Edit size={11} />
                      {isExpandido ? (
                        <ChevronUp size={11} />
                      ) : (
                        <ChevronDown size={11} />
                      )}
                    </button>

                    {/* Gerar NF-e individual */}
                    <button
                      onClick={() => gerarNfeIndividual(pedido)}
                      disabled={isGerandoThis}
                      title="Gerar e emitir NF-e"
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold bg-indigo-600 text-white border border-indigo-700 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isGerandoThis ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <FileText size={11} />
                      )}
                      NF-e
                    </button>
                  </div>
                </div>

                {/* Accordion — campos editáveis */}
                {isExpandido && (
                  <div className="px-4 pb-4 pt-1 bg-amber-50 border-t border-amber-100">
                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Edit size={11} /> Dados personalizados para NF-e
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* NCM */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                          NCM
                        </label>
                        <input
                          type="text"
                          value={override.ncm ?? pedido.itens[0]?.ncm ?? ""}
                          onChange={(e) =>
                            updateOverride(pedido.id, { ncm: e.target.value })
                          }
                          placeholder="ex: 3304.99.90"
                          maxLength={10}
                          className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-400 placeholder-slate-300"
                        />
                      </div>

                      {/* Origem do produto */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                          Origem
                        </label>
                        <select
                          value={override.origemProduto ?? 0}
                          onChange={(e) =>
                            updateOverride(pedido.id, {
                              origemProduto: Number(e.target.value)
                            })
                          }
                          className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-400"
                        >
                          {ORIGENS_PRODUTO.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Desconto */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                          Desconto (R$)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={override.desconto ?? 0}
                          onChange={(e) =>
                            updateOverride(pedido.id, {
                              desconto: Number(e.target.value)
                            })
                          }
                          className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-400"
                        />
                      </div>

                      {/* Nome do cliente */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                          Nome do Cliente
                        </label>
                        <input
                          type="text"
                          value={override.clienteNome ?? pedido.cliente.nome}
                          onChange={(e) =>
                            updateOverride(pedido.id, {
                              clienteNome: e.target.value
                            })
                          }
                          className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Paginação ──────────────────────────────────────────────────────── */}
      {pedidos.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <button
            onClick={() => {
              setPagina((p) => Math.max(1, p - 1));
              buscarPedidos();
            }}
            disabled={pagina <= 1}
            className="text-xs text-blue-600 font-bold disabled:opacity-40"
          >
            « Anterior
          </button>
          <span className="text-xs text-slate-500">Página {pagina}</span>
          <button
            onClick={() => {
              setPagina((p) => p + 1);
              buscarPedidos();
            }}
            className="text-xs text-blue-600 font-bold"
          >
            Próxima »
          </button>
        </div>
      )}
    </div>
  );
};
