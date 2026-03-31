import React, { useMemo, useState } from 'react';
import { DollarSign, Calendar, Building2, Tag, CreditCard, User, Package, ChevronDown, ChevronUp, Trash2, Filter, FileText, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { DespesaLancamento } from '../types';

interface DespesasLancamentosCardProps {
    lancamentos: DespesaLancamento[];
    competenciaFiltro: string; // "YYYY-MM"
    onDelete: (id: string) => void;
}

const DespesasLancamentosCard: React.FC<DespesasLancamentosCardProps> = ({ lancamentos, competenciaFiltro, onDelete }) => {
    const [expanded, setExpanded] = useState(true);
    const [filterCategoria, setFilterCategoria] = useState('');

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Filtra lançamentos pela competência selecionada (suporta competencias[] múltiplas)
    const lancamentosDoMes = useMemo(() => {
        return lancamentos.filter(l => {
            if (l.tipo === 'mensal') {
                // Suporta múltiplas competências
                if (l.competencias && l.competencias.length > 0) {
                    return l.competencias.includes(competenciaFiltro);
                }
                return l.competencia === competenciaFiltro;
            }
            if (l.tipo === 'faturado' && l.parcelasGeradas) {
                return l.parcelasGeradas.some(p => p.competencia === competenciaFiltro);
            }
            return false;
        });
    }, [lancamentos, competenciaFiltro]);

    // Notificações de vencimento (parcelas vencendo nos próximos 7 dias)
    const notificacoesVencimento = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const em7dias = new Date(hoje);
        em7dias.setDate(em7dias.getDate() + 7);
        const notifs: { lancamento: DespesaLancamento; parcela: any; diasRestantes: number }[] = [];

        lancamentos.forEach(l => {
            if (l.tipo === 'faturado' && l.parcelasGeradas) {
                l.parcelasGeradas.forEach(p => {
                    if (p.pago) return;
                    const vencDate = new Date(p.dataVencimento + 'T12:00:00');
                    vencDate.setHours(0, 0, 0, 0);
                    const diasRestantes = Math.ceil((vencDate.getTime() - hoje.getTime()) / 86400000);
                    if (diasRestantes <= 7 && diasRestantes >= -30) {
                        notifs.push({ lancamento: l, parcela: p, diasRestantes });
                    }
                });
            }
        });
        return notifs.sort((a, b) => a.diasRestantes - b.diasRestantes);
    }, [lancamentos]);

    const filteredLancamentos = useMemo(() => {
        if (!filterCategoria) return lancamentosDoMes;
        return lancamentosDoMes.filter(l => l.categoriaId === filterCategoria);
    }, [lancamentosDoMes, filterCategoria]);

    // Calcula total no mês
    const totalMes = useMemo(() => {
        return filteredLancamentos.reduce((sum, l) => {
            if (l.tipo === 'mensal') return sum + l.valor;
            if (l.tipo === 'faturado' && l.parcelasGeradas) {
                const parcelaDoMes = l.parcelasGeradas.filter(p => p.competencia === competenciaFiltro);
                return sum + parcelaDoMes.reduce((s, p) => s + p.valor, 0);
            }
            return sum;
        }, 0);
    }, [filteredLancamentos, competenciaFiltro]);

    // Agrupa por categoria
    const porCategoria = useMemo(() => {
        const map = new Map<string, { nome: string; total: number; count: number }>();
        filteredLancamentos.forEach(l => {
            const existing = map.get(l.categoriaId) || { nome: l.categoriaNome, total: 0, count: 0 };
            if (l.tipo === 'mensal') {
                existing.total += l.valor;
            } else if (l.tipo === 'faturado' && l.parcelasGeradas) {
                const parcelaDoMes = l.parcelasGeradas.filter(p => p.competencia === competenciaFiltro);
                existing.total += parcelaDoMes.reduce((s, p) => s + p.valor, 0);
            }
            existing.count++;
            map.set(l.categoriaId, existing);
        });
        return Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
    }, [filteredLancamentos, competenciaFiltro]);

    const categorias = useMemo(() => {
        const cats = new Map<string, string>();
        lancamentos.forEach(l => cats.set(l.categoriaId, l.categoriaNome));
        return Array.from(cats.entries());
    }, [lancamentos]);

    const mesLabel = competenciaFiltro
        ? new Date(competenciaFiltro + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : '';

    if (lancamentos.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2 mb-3">
                    <FileText size={14} className="text-purple-500" /> Despesas Lançadas
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <AlertCircle size={32} className="mb-2 opacity-40" />
                    <p className="text-xs font-bold">Nenhuma despesa lançada ainda</p>
                    <p className="text-[10px]">Use o botão "Lançar Pagamento" para começar</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div
                className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-xl">
                        <FileText size={16} className="text-purple-600" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">
                            Despesas Lançadas
                        </h3>
                        <p className="text-[10px] text-slate-400 font-bold capitalize">{mesLabel}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-lg font-black text-red-600">{fmt(totalMes)}</p>
                        <p className="text-[9px] font-bold text-slate-400">{filteredLancamentos.length} lançamento(s)</p>
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100">
                    {/* Notificações de vencimento */}
                    {notificacoesVencimento.length > 0 && (
                        <div className="p-4 bg-amber-50 border-b border-amber-100">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={12} className="text-amber-600" />
                                <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">
                                    Vencimentos Próximos ({notificacoesVencimento.length})
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                {notificacoesVencimento.map((n, i) => (
                                    <div key={i} className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-[10px] font-bold ${n.diasRestantes < 0 ? 'bg-red-100 text-red-800' : n.diasRestantes <= 2 ? 'bg-orange-100 text-orange-800' : 'bg-amber-100/50 text-amber-800'}`}>
                                        <div className="flex items-center gap-2">
                                            <Clock size={10} />
                                            <span>{n.lancamento.fornecedorNome} — {n.lancamento.categoriaNome}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-black">{fmt(n.parcela.valor)}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${n.diasRestantes < 0 ? 'bg-red-600 text-white' : n.diasRestantes === 0 ? 'bg-orange-600 text-white' : 'bg-amber-200 text-amber-800'}`}>
                                                {n.diasRestantes < 0 ? `Vencido há ${Math.abs(n.diasRestantes)}d` : n.diasRestantes === 0 ? 'VENCE HOJE' : `Vence em ${n.diasRestantes}d`}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Resumo por categoria */}
                    {porCategoria.length > 0 && (
                        <div className="p-4 bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Filter size={10} className="text-slate-400" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Distribuição por Categoria</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setFilterCategoria('')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${!filterCategoria ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300'}`}
                                >
                                    Todas ({lancamentosDoMes.length})
                                </button>
                                {porCategoria.map(([catId, data]) => (
                                    <button
                                        key={catId}
                                        onClick={() => setFilterCategoria(catId === filterCategoria ? '' : catId)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${filterCategoria === catId ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-500 border-slate-200 hover:border-purple-300'}`}
                                    >
                                        {data.nome} ({data.count}) · {fmt(data.total)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Lista de lançamentos */}
                    <div className="divide-y divide-slate-50">
                        {filteredLancamentos.map(l => {
                            const valorExibido = l.tipo === 'faturado' && l.parcelasGeradas
                                ? l.parcelasGeradas.filter(p => p.competencia === competenciaFiltro).reduce((s, p) => s + p.valor, 0)
                                : l.valor;

                            const parcelaInfo = l.tipo === 'faturado' && l.parcelasGeradas
                                ? l.parcelasGeradas.find(p => p.competencia === competenciaFiltro)
                                : null;

                            return (
                                <div key={l.id} className="p-4 hover:bg-slate-50/50 transition-colors group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${l.tipo === 'mensal' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {l.tipo}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600">
                                                    <Tag size={8} className="inline mr-1" />{l.categoriaNome}
                                                </span>
                                                {l.pagoCartao && (
                                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-600">
                                                        <CreditCard size={8} className="inline mr-1" />Cartão
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Building2 size={10} /> {l.fornecedorNome}
                                                </span>
                                                {l.produtoNome && (
                                                    <span className="flex items-center gap-1">
                                                        <Package size={10} /> {l.produtoNome}
                                                    </span>
                                                )}
                                                {l.funcionarioNome && (
                                                    <span className="flex items-center gap-1">
                                                        <User size={10} /> {l.funcionarioNome}
                                                    </span>
                                                )}
                                            </div>
                                            {l.observacao && (
                                                <p className="text-[10px] text-slate-400 italic">{l.observacao}</p>
                                            )}
                                            {l.tipo === 'faturado' && parcelaInfo && (
                                                <p className="text-[9px] text-blue-500 font-bold">
                                                    Parcela venc. {new Date(parcelaInfo.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')} · Total NF: {fmt(l.valor)} ({l.parcelasGeradas?.length || 0}x)
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-black text-red-600">{fmt(valorExibido)}</p>
                                                <p className="text-[9px] text-slate-400 font-bold">
                                                    {new Date(l.dataLancamento).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => onDelete(l.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Remover lançamento"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DespesasLancamentosCard;
