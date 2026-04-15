import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  RefreshCw,
  Loader2,
  Search,
  Package,
  Hash,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Printer,
  FileText,
  Copy,
  Box,
  User,
  MapPin,
} from "lucide-react";
import {
  fetchRemessas,
  fetchRemessaObjetos,
  fetchLogisticas,
  fetchEtiquetaZplByObjetos,
} from "../lib/blingApi";

interface Props {
  token: string | undefined;
  addToast: (msg: string, type: string) => void;
  onAddLote?: (lote: {
    id: string;
    zplContent: string;
    success: number;
    failed: { id: string; error: string }[];
    total: number;
    timestamp: string;
    successIds?: string[];
  }) => void;
  refreshTrigger?: number;
}

interface RemessaItem {
  id: number;
  numero?: string;
  logistica?: { id?: number; descricao?: string };
  situacao?: { id?: number; nome?: string } | string;
  dataCriacao?: string;
  quantidadeObjetos?: number;
  objetos?: any[];
}

export const AbaRemessas: React.FC<Props> = ({
  token,
  addToast,
  onAddLote,
  refreshTrigger,
}) => {
  const [remessas, setRemessas] = useState<RemessaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedObjetos, setExpandedObjetos] = useState<any[]>([]);
  const [isLoadingObjetos, setIsLoadingObjetos] = useState(false);
  const [isGenerating, setIsGenerating] = useState<number | null>(null);

  const loadRemessas = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const all: any[] = [];
      let pagina = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await fetchRemessas(token, { pagina, limite: 100 });
        all.push(...result.data);
        hasMore = result.hasMore;
        pagina++;
        if (pagina > 10) break;
      }
      setRemessas(all);
    } catch (err: any) {
      addToast(`Erro ao buscar remessas: ${err.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => {
    loadRemessas();
  }, [loadRemessas, refreshTrigger]);

  const handleExpand = async (remessaId: number) => {
    if (expandedId === remessaId) {
      setExpandedId(null);
      setExpandedObjetos([]);
      return;
    }
    setExpandedId(remessaId);
    setIsLoadingObjetos(true);
    try {
      const objs = await fetchRemessaObjetos(token!, remessaId);
      setExpandedObjetos(objs);
    } catch {
      setExpandedObjetos([]);
    } finally {
      setIsLoadingObjetos(false);
    }
  };

  const handleGerarEtiquetasRemessa = async (remessa: RemessaItem) => {
    if (!token) return;
    setIsGenerating(remessa.id);
    try {
      // Buscar objetos da remessa se não estiverem expandidos
      let objs = expandedId === remessa.id ? expandedObjetos : [];
      if (objs.length === 0) {
        objs = await fetchRemessaObjetos(token, remessa.id);
      }
      if (objs.length === 0) {
        addToast("Nenhum objeto encontrado nesta remessa.", "warning");
        return;
      }

      const ids = objs.map((o: any) => Number(o.id)).filter((id: number) => !isNaN(id) && id > 0);
      if (ids.length === 0) {
        addToast("IDs de objetos inválidos.", "warning");
        return;
      }

      const results = await fetchEtiquetaZplByObjetos(token, ids);
      const zpls = results.filter((r) => r.zpl).map((r) => r.zpl);
      const successIds = results.filter((r) => r.zpl).map((r) => String(r.id));
      const failed = ids
        .filter((id) => !results.find((r) => r.id === id && r.zpl))
        .map((id) => ({ id: String(id), error: "Sem etiqueta" }));

      if (zpls.length === 0) {
        addToast("Nenhuma etiqueta ZPL disponível para esta remessa.", "warning");
        return;
      }

      const lote = {
        id: `remessa_${remessa.id}_${Date.now()}`,
        zplContent: zpls.join("\n"),
        success: zpls.length,
        failed,
        total: ids.length,
        timestamp: new Date().toISOString(),
        successIds,
      };

      onAddLote?.(lote);
      addToast(`${zpls.length} etiqueta(s) gerada(s) da remessa #${remessa.id}`, "success");
    } catch (err: any) {
      addToast(`Erro ao gerar etiquetas: ${err.message}`, "error");
    } finally {
      setIsGenerating(null);
    }
  };

  const getSituacao = (remessa: RemessaItem) => {
    if (typeof remessa.situacao === "object" && remessa.situacao) {
      return remessa.situacao.nome || String(remessa.situacao.id || "—");
    }
    return String(remessa.situacao || "—");
  };

  const getSituacaoColor = (sit: string) => {
    const s = sit.toLowerCase();
    if (s.includes("aberta") || s.includes("pendente"))
      return "bg-yellow-100 text-yellow-700";
    if (s.includes("fechada") || s.includes("conclu") || s.includes("finaliz"))
      return "bg-emerald-100 text-emerald-700";
    if (s.includes("cancel")) return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-600";
  };

  const formatDate = (d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("pt-BR");
    } catch {
      return d;
    }
  };

  const filtered = remessas.filter((r) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    const sit = getSituacao(r);
    return (
      String(r.id).includes(q) ||
      (r.numero || "").toLowerCase().includes(q) ||
      (r.logistica?.descricao || "").toLowerCase().includes(q) ||
      sit.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
              <FileText size={18} className="text-orange-600" /> Remessas
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Remessas logísticas geradas no Bling. Expanda para ver objetos e gerar etiquetas.
            </p>
          </div>
          <button
            onClick={loadRemessas}
            disabled={isLoading || !token}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all border border-slate-200 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}{" "}
            Atualizar
          </button>
        </div>

        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex flex-col gap-1 flex-grow">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Search size={10} /> Filtrar
            </label>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="ID, logística, situação..."
              className="border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold bg-slate-50 outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={24} className="animate-spin text-orange-500" />
            <span className="text-sm font-bold">Buscando remessas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <FileText size={40} strokeWidth={1.5} />
            <p className="text-sm font-bold">Nenhuma remessa encontrada.</p>
            <p className="text-[11px]">
              Crie remessas na aba "Objetos de Postagem" selecionando objetos.
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-orange-700 uppercase tracking-widest">
                {filtered.length} remessa(s)
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map((remessa) => {
                const sit = getSituacao(remessa);
                const isExpanded = expandedId === remessa.id;
                return (
                  <div key={remessa.id}>
                    <div
                      className={`flex items-center gap-4 px-6 py-4 hover:bg-orange-50/30 transition-colors cursor-pointer ${isExpanded ? "bg-orange-50/50" : ""}`}
                      onClick={() => handleExpand(remessa.id)}
                    >
                      <div className="flex items-center gap-1 text-slate-400">
                        {isExpanded ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </div>
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            ID
                          </p>
                          <p className="font-black text-slate-700">
                            #{remessa.id}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Logística
                          </p>
                          <p className="font-bold text-slate-600 truncate">
                            {remessa.logistica?.descricao || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Situação
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${getSituacaoColor(sit)}`}
                          >
                            {sit}
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Objetos
                          </p>
                          <p className="font-bold text-slate-600">
                            {remessa.quantidadeObjetos ?? "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                            Data
                          </p>
                          <p className="font-bold text-slate-500">
                            {formatDate(remessa.dataCriacao)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGerarEtiquetasRemessa(remessa);
                        }}
                        disabled={isGenerating === remessa.id}
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shrink-0"
                      >
                        {isGenerating === remessa.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Printer size={11} />
                        )}{" "}
                        Etiquetas
                      </button>
                    </div>

                    {/* Expanded: Objetos da remessa */}
                    {isExpanded && (
                      <div className="px-6 pb-4 bg-orange-50/30">
                        {isLoadingObjetos ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
                            <Loader2
                              size={14}
                              className="animate-spin text-orange-500"
                            />
                            Carregando objetos...
                          </div>
                        ) : expandedObjetos.length === 0 ? (
                          <p className="text-xs text-slate-400 py-4">
                            Nenhum objeto encontrado nesta remessa.
                          </p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-orange-100">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-orange-100/50">
                                  <th className="px-3 py-2 text-left font-black text-orange-700 uppercase tracking-widest text-[9px]">
                                    ID
                                  </th>
                                  <th className="px-3 py-2 text-left font-black text-orange-700 uppercase tracking-widest text-[9px]">
                                    Pedido
                                  </th>
                                  <th className="px-3 py-2 text-left font-black text-orange-700 uppercase tracking-widest text-[9px]">
                                    Rastreio
                                  </th>
                                  <th className="px-3 py-2 text-left font-black text-orange-700 uppercase tracking-widest text-[9px]">
                                    Serviço
                                  </th>
                                  <th className="px-3 py-2 text-left font-black text-orange-700 uppercase tracking-widest text-[9px]">
                                    Situação
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-orange-100/50">
                                {expandedObjetos.map((obj: any, idx: number) => (
                                  <tr
                                    key={obj.id || idx}
                                    className="hover:bg-white/50"
                                  >
                                    <td className="px-3 py-2 font-mono font-bold text-slate-600">
                                      {obj.id || "—"}
                                    </td>
                                    <td className="px-3 py-2 font-bold text-slate-600">
                                      {obj.numeroPedidoLoja ||
                                        obj.pedidoLoja?.numeroPedido ||
                                        "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                      {obj.rastreamento?.codigo ||
                                      obj.codigoRastreamento ? (
                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-lg text-[10px]">
                                          {obj.rastreamento?.codigo ||
                                            obj.codigoRastreamento}
                                          <button
                                            onClick={() => {
                                              navigator.clipboard.writeText(
                                                obj.rastreamento?.codigo ||
                                                  obj.codigoRastreamento
                                              );
                                              addToast("Copiado!", "success");
                                            }}
                                            className="text-emerald-400 hover:text-emerald-700"
                                          >
                                            <Copy size={10} />
                                          </button>
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 italic text-[10px]">
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">
                                      {obj.servico?.nome ||
                                        obj.servico?.codigo ||
                                        "—"}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className="text-[10px] font-bold text-slate-500">
                                        {typeof obj.situacao === "object"
                                          ? obj.situacao?.nome || "—"
                                          : obj.situacao || "—"}
                                      </span>
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
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
