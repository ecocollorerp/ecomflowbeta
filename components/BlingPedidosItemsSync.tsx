// ============================================================================
// BlingPedidosItemsSync.tsx - Sincronizar Itens dos Pedidos com Bling
// Componente para gerenciar sincronização de itens entre ERP e Bling
// ============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
    RefreshCw,
    Check,
    AlertCircle,
    Loader2,
    Download,
    Upload,
    Search,
    Filter,
    Eye,
    X,
    ExternalLink,
    TrendingUp,
    Package,
    ShoppingCart,
    CheckCircle,
    Clock,
    Zap,
    Settings
} from 'lucide-react';

interface PedidoItem {
    id: string;
    orderId: string;
    blingId?: string;
    sku: string;
    nome: string;
    quantidade: number;
    preco_unitario: number;
    preco_total: number;
    status: 'nao_sincronizado' | 'sincronizado' | 'erro' | 'pendente';
    data_criacao: number;
    ultima_sincronizacao?: number;
    erro_mensagem?: string;
}

interface BlingPedidosItemsSyncProps {
    itens: PedidoItem[];
    isLoading?: boolean;
    onSincronizar?: (itens: string[]) => Promise<void>;
    onDownloadBling?: () => Promise<void>;
    onBlingSyncConfig?: () => void;
}

const statusConfig = {
    nao_sincronizado: {
        label: 'Não Sincronizado',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
        icon: '⭕',
        bg: 'bg-gray-50'
    },
    sincronizado: {
        label: 'Sincronizado',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        icon: '✅',
        bg: 'bg-emerald-50'
    },
    pendente: {
        label: 'Pendente',
        color: 'bg-amber-100 text-amber-700 border-amber-300',
        icon: '⏳',
        bg: 'bg-amber-50'
    },
    erro: {
        label: 'Erro',
        color: 'bg-red-100 text-red-700 border-red-300',
        icon: '❌',
        bg: 'bg-red-50'
    }
};

export const BlingPedidosItemsSync: React.FC<BlingPedidosItemsSyncProps> = ({
    itens = [],
    isLoading = false,
    onSincronizar,
    onDownloadBling,
    onBlingSyncConfig
}) => {
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'nao_sincronizado' | 'sincronizado' | 'pendente' | 'erro'>('todos');
    const [itemsSelecionados, setItemsSelecionados] = useState<Set<string>>(new Set());
    const [isSyncing, setIsSyncing] = useState(false);
    const [showDetalhes, setShowDetalhes] = useState<PedidoItem | null>(null);
    const [autoSync, setAutoSync] = useState(false);

    // Filtrar itens
    const itensFiltrados = useMemo(() => {
        let resultado = itens;

        if (busca.trim()) {
            const termo = busca.toLowerCase();
            resultado = resultado.filter(i =>
                i.nome.toLowerCase().includes(termo) ||
                i.sku.toLowerCase().includes(termo) ||
                i.orderId.toLowerCase().includes(termo)
            );
        }

        if (filtroStatus !== 'todos') {
            resultado = resultado.filter(i => i.status === filtroStatus);
        }

        return resultado;
    }, [itens, busca, filtroStatus]);

    // Estatísticas
    const stats = useMemo(() => ({
        total: itens.length,
        sincronizado: itens.filter(i => i.status === 'sincronizado').length,
        naoSincronizado: itens.filter(i => i.status === 'nao_sincronizado').length,
        pendente: itens.filter(i => i.status === 'pendente').length,
        erro: itens.filter(i => i.status === 'erro').length,
        percentualSincronizado: itens.length > 0 ? Math.round((itens.filter(i => i.status === 'sincronizado').length / itens.length) * 100) : 0
    }), [itens]);

    // Sincronizar selecionados
    const handleSincronizar = useCallback(async () => {
        if (itemsSelecionados.size === 0 || !onSincronizar) return;

        try {
            setIsSyncing(true);
            await onSincronizar(Array.from(itemsSelecionados));
            setItemsSelecionados(new Set());
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            alert('Erro ao sincronizar. Verifique o console.');
        } finally {
            setIsSyncing(false);
        }
    }, [itemsSelecionados, onSincronizar]);

    return (
        <div className="space-y-6 p-6 bg-gradient-to-b from-slate-50 to-white rounded-2xl">
            {/* Header */}
            <div>
                <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                            <ShoppingCart className="text-blue-600" size={36} />
                            Itens dos Pedidos
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-bold">
                            Sincronize itens entre ERP e Bling
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {onBlingSyncConfig && (
                            <button
                                onClick={onBlingSyncConfig}
                                className="flex items-center gap-2 px-4 py-3 bg-slate-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-slate-700 transition-all"
                                title="Configurar sincronização com Bling"
                            >
                                <Settings size={16} />
                                Config
                            </button>
                        )}
                        {onDownloadBling && (
                            <button
                                onClick={onDownloadBling}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                            >
                                <Download size={16} />
                                Download Bling
                            </button>
                        )}
                    </div>
                </div>

                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Total</p>
                        <p className="text-2xl font-black text-slate-800 mt-2">{stats.total}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <p className="text-[10px] font-black text-emerald-600 uppercase">Sincronizado</p>
                        <p className="text-2xl font-black text-emerald-700 mt-2">✅ {stats.sincronizado}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <p className="text-[10px] font-black text-gray-600 uppercase">Não Sincronizado</p>
                        <p className="text-2xl font-black text-gray-700 mt-2">⭕ {stats.naoSincronizado}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-[10px] font-black text-amber-600 uppercase">Pendente</p>
                        <p className="text-2xl font-black text-amber-700 mt-2">⏳ {stats.pendente}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                        <p className="text-[10px] font-black text-red-600 uppercase">Erro</p>
                        <p className="text-2xl font-black text-red-700 mt-2">❌ {stats.erro}</p>
                        </div>
                </div>

                {/* Barra de Progresso */}
                <div className="mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-black text-slate-700">Progresso de Sincronização</p>
                        <span className="text-lg font-black text-emerald-600">{stats.percentualSincronizado}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-full transition-all duration-500"
                            style={{ width: `${stats.percentualSincronizado}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Filtros e Busca */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-slate-100 rounded-xl border border-slate-200">
                <div className="relative md:col-span-2">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar por SKU, nome ou pedido..."
                        className="w-full pl-10 p-3 border-2 border-slate-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-blue-500"
                    />
                </div>
                <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as any)}
                    className="p-3 border-2 border-slate-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-blue-500"
                >
                    <option value="todos">Todos os Status</option>
                    <option value="sincronizado">✅ Sincronizado</option>
                    <option value="nao_sincronizado">⭕ Não Sincronizado</option>
                    <option value="pendente">⏳ Pendente</option>
                    <option value="erro">❌ Erro</option>
                </select>
                <div className="flex gap-2">
                    {itemsSelecionados.size > 0 && onSincronizar && (
                        <button
                            onClick={handleSincronizar}
                            disabled={isSyncing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white font-black uppercase text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
                        >
                            {isSyncing ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Sincronizando...
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    Sincronizar ({itemsSelecionados.size})
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabela de Itens */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : itensFiltrados.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">Nenhum item encontrado</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-slate-900 text-white sticky top-0">
                            <tr>
                                <th className="p-4 text-left">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setItemsSelecionados(new Set(itensFiltrados.map(i => i.id)));
                                            } else {
                                                setItemsSelecionados(new Set());
                                            }
                                        }}
                                        checked={itemsSelecionados.size === itensFiltrados.length && itensFiltrados.length > 0}
                                        className="w-5 h-5 cursor-pointer"
                                    />
                                </th>
                                {['Pedido', 'SKU', 'Produto', 'Qtd', 'Preço', 'Status', 'Última Sincronização', 'Ações'].map(h =>
                                    <th key={h} className="p-4 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {itensFiltrados.map((item) => {
                                const config = statusConfig[item.status];
                                return (
                                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${config.bg}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={itemsSelecionados.has(item.id)}
                                                onChange={(e) => {
                                                    const novo = new Set(itemsSelecionados);
                                                    if (e.target.checked) {
                                                        novo.add(item.id);
                                                    } else {
                                                        novo.delete(item.id);
                                                    }
                                                    setItemsSelecionados(novo);
                                                }}
                                                disabled={item.status === 'sincronizado'}
                                                className="w-5 h-5 cursor-pointer disabled:opacity-50"
                                            />
                                        </td>
                                        <td className="p-4 font-black text-slate-700">{item.orderId}</td>
                                        <td className="p-4 font-mono font-black text-slate-600 text-xs">{item.sku}</td>
                                        <td className="p-4 font-bold text-slate-800 max-w-xs truncate">{item.nome}</td>
                                        <td className="p-4 text-center font-black">{item.quantidade}</td>
                                        <td className="p-4 font-black text-emerald-600">
                                            R$ {item.preco_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                        </td>
                                        <td className="p-4">
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border font-black text-xs uppercase ${config.color}`}>
                                                {config.icon}
                                                {config.label}
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-slate-600">
                                            {item.ultima_sincronizacao ? (
                                                new Date(item.ultima_sincronizacao).toLocaleString('pt-BR')
                                            ) : (
                                                <span className="text-slate-400">Nunca</span>
                                            )}
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <button
                                                onClick={() => setShowDetalhes(item)}
                                                className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                                title="Ver detalhes"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {item.status === 'erro' && item.erro_mensagem && (
                                                <button
                                                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                                                    title={item.erro_mensagem}
                                                >
                                                    <AlertCircle size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Detalhes */}
            {showDetalhes && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">{showDetalhes.nome}</h2>
                                <p className="text-sm text-slate-400 mt-1 font-bold">Pedido: {showDetalhes.orderId}</p>
                            </div>
                            <button
                                onClick={() => setShowDetalhes(null)}
                                className="p-2 text-slate-400 hover:text-slate-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* SKU */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">SKU</p>
                                <p className="font-mono font-black text-slate-800 text-lg">{showDetalhes.sku}</p>
                            </div>

                            {/* Preços */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-100 rounded-lg">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Preço Unitário</p>
                                    <p className="font-black text-slate-800 mt-2">
                                        R$ {showDetalhes.preco_unitario.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                                <div className="p-3 bg-emerald-100 rounded-lg">
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase">Total Item</p>
                                    <p className="font-black text-emerald-700 mt-2">
                                        R$ {showDetalhes.preco_total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Status</p>
                                <div className={`flex items-center gap-2 w-fit px-4 py-2 rounded-lg border font-black text-sm ${statusConfig[showDetalhes.status].color}`}>
                                    {statusConfig[showDetalhes.status].icon}
                                    {statusConfig[showDetalhes.status].label}
                                </div>
                            </div>

                            {/* Erro */}
                            {showDetalhes.erro_mensagem && (
                                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Mensagem de Erro</p>
                                    <p className="text-sm text-red-700 font-bold">{showDetalhes.erro_mensagem}</p>
                                </div>
                            )}

                            {/* Datas */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 rounded-lg text-sm">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Criado em</p>
                                    <p className="font-bold text-slate-800 mt-1">
                                        {new Date(showDetalhes.data_criacao).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Última Sincronização</p>
                                    <p className="font-bold text-slate-800 mt-1">
                                        {showDetalhes.ultima_sincronizacao ? 
                                            new Date(showDetalhes.ultima_sincronizacao).toLocaleString('pt-BR') :
                                            'Nunca'
                                        }
                                    </p>
                                </div>
                            </div>

                            {showDetalhes.blingId && (
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-[9px] font-bold text-blue-600 uppercase mb-1">ID Bling</p>
                                    <p className="font-mono font-bold text-blue-700">{showDetalhes.blingId}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6 pt-6 border-t">
                            <button
                                onClick={() => setShowDetalhes(null)}
                                className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-600 font-black uppercase hover:bg-slate-200 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
