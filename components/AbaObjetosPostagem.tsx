import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  RefreshCw,
  Copy,
  Loader2,
  Search,
  Package,
  ExternalLink,
  Filter,
  Trash2,
  CheckSquare,
  Square,
  Download,
  MapPin,
  Calendar,
  Hash,
  User,
  Box,
  Weight,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Ruler,
} from "lucide-react";
import {
  fetchLogisticas,
  fetchLogisticasObjetos,
} from "../lib/blingApi";

interface NfeSaidaMinimal {
  id: number;
  numero?: string;
  numeroLoja?: string;
  numeroPedidoLoja?: string;
  contato?: { nome?: string; numeroDocumento?: string };
  valorTotal?: number;
  situacao?: number;
  rastreamento?: string;
}

interface Props {
  token: string | undefined;
  addToast: (msg: string, type: string) => void;
  startDate: string;
  endDate: string;
  nfeSaida: NfeSaidaMinimal[];
}

interface ObjetoPostagem {
  id?: number;
  bling_id: string;
  nfe_id: number;
  nfe_numero: string;
  numero_pedido_loja: string;
  destinatario: string;
  rastreio: string;
  servico: string;
  transportadora: string;
  situacao: string;
  valor_nota: number;
  data_criacao: string;
  prazo_entrega: string;
  dimensoes: {
    peso?: number;
    altura?: number;
    largura?: number;
    comprimento?: number;
  };
  dados_bling: any;
}

export const AbaObjetosPostagem: React.FC<Props> = ({
  token,
  addToast,
  startDate,
  endDate,
}) => {
  const [transportadoras, setTransportadoras] = useState<any[]>([]);
  const [selectedTransp, setSelectedTransp] = useState<string>("todos");
  const [objetos, setObjetos] = useState<ObjetoPostagem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTransp, setIsLoadingTransp] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Fetch directly from Bling API (paginado) ──
  const fetchFromBling = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const allObjetos: any[] = [];
      let pagina = 1;
      let hasMore = true;
      const idTransp = selectedTransp !== "todos" ? selectedTransp : undefined;
      while (hasMore) {
        const { data, hasMore: more } = await fetchLogisticasObjetos(token, {
          idTransportador: idTransp,
          pagina,
          limite: 100,
          dataInicial: startDate,
          dataFinal: endDate,
        });
        allObjetos.push(...data);
        hasMore = more;
        pagina++;
        if (pagina > 20) break; // safety limit
      }
      const mapped: ObjetoPostagem[] = allObjetos.map((obj: any) => ({
        bling_id: String(obj.id || Math.random()),
        nfe_id: 0,
        nfe_numero: obj.nota?.numero || obj.nfe?.numero || "—",
        numero_pedido_loja: obj.pedidoLoja?.numeroPedido || obj.numeroPedidoLoja || "—",
        destinatario: obj.contato?.nome || "—",
        rastreio: obj.rastreamento?.codigo || obj.codigoRastreamento || "",
        servico: obj.servico?.nome || obj.servico?.codigo || "—",
        transportadora: obj.logistica?.descricao || obj.logistica?.nome || "—",
        situacao: typeof obj.situacao === "object"
          ? (obj.situacao?.nome || String(obj.situacao?.id || ""))
          : String(obj.situacao || "—"),
        valor_nota: obj.valorNota || 0,
        data_criacao: obj.dataCriacao || "",
        prazo_entrega: obj.prazoEntregaPrevisto || obj.prazoEntrega || "",
        dimensoes: {
          peso: obj.dimensoes?.peso || 0,
          altura: obj.dimensoes?.altura || 0,
          largura: obj.dimensoes?.largura || 0,
          comprimento: obj.dimensoes?.comprimento || 0,
        },
        dados_bling: obj,
      }));
      setObjetos(mapped);
    } catch (err: any) {
      addToast(`Erro ao buscar objetos: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [token, startDate, endDate, selectedTransp, addToast]);

  const loadTransportadoras = useCallback(async () => {
    if (!token) return;
    setIsLoadingTransp(true);
    try {
      const list = await fetchLogisticas(token, "H");
      setTransportadoras(list);
    } catch (err: any) {
      addToast(`Erro ao carregar transportadoras: ${err.message}`, "error");
    } finally {
      setIsLoadingTransp(false);
    }
  }, [token, addToast]);

  // ── Delete from UI state only ──
  const handleDelete = (blingId: string) => {
    setObjetos((prev) => prev.filter((o) => o.bling_id !== blingId));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(blingId); return next; });
    addToast("Objeto removido da visualização.", "success");
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setObjetos((prev) => prev.filter((o) => !selectedIds.has(o.bling_id)));
    setSelectedIds(new Set());
    addToast(`${count} objeto(s) removido(s) da visualização.`, "success");
  };

  useEffect(() => { loadTransportadoras(); }, [loadTransportadoras]);
  useEffect(() => { fetchFromBling(); }, [fetchFromBling]);

  const handleCopyRastreio = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo);
      addToast("Código de rastreio copiado!", "success");
    } catch { addToast("Não foi possível copiar.", "error"); }
  };

  const toggleSelect = (blingId: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(blingId)) next.delete(blingId); else next.add(blingId); return next; });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((o) => o.bling_id)));
  };

  const filtered = objetos.filter((obj) => {
    if (selectedTransp !== "todos") {
      const transpMatch = transportadoras.find((t) => String(t.id) === selectedTransp);
      const transpName = transpMatch?.descricao || transpMatch?.nome || "";
      if (transpName && !obj.transportadora.toLowerCase().includes(transpName.toLowerCase())) return false;
    }
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return (
      (obj.rastreio || "").toLowerCase().includes(q) ||
      (obj.numero_pedido_loja || "").toLowerCase().includes(q) ||
      (obj.destinatario || "").toLowerCase().includes(q) ||
      (obj.servico || "").toLowerCase().includes(q) ||
      (obj.nfe_numero || "").toLowerCase().includes(q) ||
      (obj.transportadora || "").toLowerCase().includes(q)
    );
  });

  const formatDate = (d: string | undefined) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              <Package size={18} className="text-blue-600" /> Objetos de Postagem
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Objetos de logística do Bling. Removeção afeta apenas a visualização local.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchFromBling()}
              disabled={isLoading || !token}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Atualizar
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Truck size={10} /> Transportadora
            </label>
            <select
              value={selectedTransp}
              onChange={(e) => setSelectedTransp(e.target.value)}
              disabled={isLoadingTransp}
              className="border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 outline-none focus:border-blue-400 min-w-[200px]"
            >
              <option value="todos">Todas</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.descricao || t.nome || `ID ${t.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-grow">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Search size={10} /> Filtrar
            </label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Rastreio, pedido, destinatário, transportadora..."
              className="border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200">
          <span className="text-[10px] font-black text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-white text-slate-400 hover:bg-slate-50 border border-slate-200">
              Limpar
            </button>
            <button onClick={handleDeleteSelected} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all">
              <Trash2 size={11} /> Remover da visualização
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-blue-500" />
            <span className="text-sm font-bold">Buscando objetos do Bling...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <Package size={40} strokeWidth={1.5} />
            <p className="text-sm font-bold">Nenhum objeto de postagem encontrado.</p>
            <p className="text-[11px]">{objetos.length === 0 ? "Verifique o período selecionado ou a conexão com o Bling." : "Tente ajustar os filtros."}</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-700 uppercase tracking-widest">
                {filtered.length} objeto(s){searchFilter ? " (filtrado)" : ""}
              </span>
              <span className="text-[10px] text-slate-400">
                Bling API — peíodo selecionado
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-3 py-3 text-center w-8">
                      <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                        {selectedIds.size === filtered.length && filtered.length > 0 ? <CheckSquare size={14} /> : <Square size={14} />}
                      </button>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Hash size={10} /> NF-e</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Box size={10} /> Pedido</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><User size={10} /> Destinatário</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><MapPin size={10} /> Rastreio</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Truck size={10} /> Serviço</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      Transportadora
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Clock size={10} /> Situação</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Ruler size={10} /> Dimensões</div>
                    </th>
                    <th className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      <div className="flex items-center gap-1"><Calendar size={10} /> Data</div>
                    </th>
                    <th className="px-3 py-3 text-center font-black text-slate-500 uppercase tracking-widest text-[10px]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((obj) => {
                    const dim = obj.dimensoes || {};
                    const hasDim = dim.peso || dim.altura || dim.largura || dim.comprimento;
                    return (
                      <tr
                        key={obj.bling_id}
                        className={`border-b border-slate-50 hover:bg-blue-50/30 transition-colors ${selectedIds.has(obj.bling_id) ? "bg-blue-50/50" : ""}`}
                      >
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => toggleSelect(obj.bling_id)} className="text-slate-400 hover:text-blue-600">
                            {selectedIds.has(obj.bling_id) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-700">{obj.nfe_numero}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-600 text-[11px]">{obj.numero_pedido_loja}</td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate" title={obj.destinatario}>{obj.destinatario}</td>
                        <td className="px-3 py-2.5">
                          {obj.rastreio ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-lg text-[11px]">
                              {obj.rastreio}
                              <button onClick={() => handleCopyRastreio(obj.rastreio)} className="text-emerald-400 hover:text-emerald-700" title="Copiar rastreio">
                                <Copy size={11} />
                              </button>
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">sem rastreio</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 text-[11px]">{obj.servico}</td>
                        <td className="px-3 py-2.5 text-slate-600 text-[11px]">{obj.transportadora}</td>
                        <td className="px-3 py-2.5"><SituacaoBadge situacao={obj.situacao} /></td>
                        <td className="px-3 py-2.5 text-[10px] text-slate-500">
                          {hasDim ? (
                            <div className="flex flex-col gap-0.5">
                              {dim.peso ? <span className="flex items-center gap-1"><Weight size={9} /> {dim.peso}kg</span> : null}
                              {(dim.altura || dim.largura || dim.comprimento) ? <span>{dim.altura || 0}x{dim.largura || 0}x{dim.comprimento || 0}cm</span> : null}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 text-[10px]">{formatDate(obj.data_criacao)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center gap-1 justify-center">
                            {obj.rastreio && (
                              <a
                                href={`https://www.google.com/search?q=${encodeURIComponent(obj.rastreio)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-500 hover:text-blue-700 text-[10px] font-bold px-1.5 py-1 rounded hover:bg-blue-50"
                                title="Rastrear"
                              >
                                <ArrowUpRight size={11} />
                              </a>
                            )}
                            <button
                              onClick={() => handleDelete(obj.bling_id)}
                              className="inline-flex items-center text-red-400 hover:text-red-600 text-[10px] font-bold px-1.5 py-1 rounded hover:bg-red-50"
                              title="Remover da visualização (não afeta o Bling)"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SituacaoBadge: React.FC<{ situacao: string }> = ({ situacao }) => {
  const s = (situacao || "").toLowerCase();
  let color = "bg-slate-100 text-slate-600";
  let Icon = AlertCircle;

  if (s.includes("entregue") || s.includes("delivered") || s.includes("conclu")) {
    color = "bg-emerald-100 text-emerald-700";
    Icon = CheckCircle2;
  } else if (s.includes("trânsito") || s.includes("transit") || s.includes("postado") || s.includes("caminho")) {
    color = "bg-blue-100 text-blue-700";
    Icon = Truck;
  } else if (s.includes("aguardando") || s.includes("pendente") || s.includes("sem objeto")) {
    color = "bg-yellow-100 text-yellow-700";
    Icon = Clock;
  } else if (s.includes("cancel") || s.includes("devol") || s.includes("extrav")) {
    color = "bg-red-100 text-red-700";
    Icon = XCircle;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${color}`}>
      <Icon size={10} />
      {situacao}
    </span>
  );
};
