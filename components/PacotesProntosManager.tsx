// ============================================================================
// PacotesProntosManager.tsx - Gerenciador de Pacotes Prontos
// Componente completo para gerenciar e visualizar pacotes prontos
// ============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import {
    Package,
    Plus,
    Edit2,
    Trash2,
    Search,
    Filter,
    Eye,
    CheckCircle,
    AlertCircle,
    TrendingUp,
    Calendar,
    User,
    MapPin,
    Loader2,
    X,
    Save,
    ArrowRight,
    BarChart3,
    Clock,
    QrCode
} from 'lucide-react';
import { BarcodeLabelModal } from './BarcodeLabelModal';

interface PacoteProto {
    id: string;
    nome: string;
    sku_primario: string;
    quantidade_total: number;
    quantidade_disponivel: number;
    quantidade_reservada: number;
    localizacao: string;
    status: 'PRONTO' | 'RESERVADO' | 'EXPEDIDO' | 'DEVOLVIDO';
    data_preparacao: number;
    data_disponibilidade: number;
    operador: string;
    observacoes?: string;
    produtos: Array<{
        sku: string;
        nome: string;
        quantidade: number;
    }>;
}

interface PacotesProntosManagerProps {
    pacotes: PacoteProto[];
    isLoading?: boolean;
    onAdicionar?: () => void;
    onEditar?: (pacote: PacoteProto) => void;
    onDeletar?: (id: string) => void;
    onMoverPacote?: (id: string, novaLocalizacao: string) => void;
    onMarcarExpedido?: (id: string) => void;
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const PacotesProntosManager: React.FC<PacotesProntosManagerProps> = ({
    pacotes = [],
    isLoading = false,
    onAdicionar,
    onEditar,
    onDeletar,
    onMoverPacote,
    onMarcarExpedido,
    addToast
}) => {
    const [busca, setBusca] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<'todos' | 'PRONTO' | 'RESERVADO' | 'EXPEDIDO'>('PRONTO');
    const [ordenacao, setOrdenacao] = useState<'data' | 'disponibilidade' | 'localizacao'>('data');
    const [pacoteSelecionado, setPacoteSelecionado] = useState<PacoteProto | null>(null);
    const [showDetalhes, setShowDetalhes] = useState(false);
    const [showLabelModal, setShowLabelModal] = useState(false);
    const [novaLocalizacao, setNovaLocalizacao] = useState('');

    // Filtragem e ordenação
    const pacotesFiltrados = useMemo(() => {
        let resultado = pacotes;

        // Filtro de busca
        if (busca.trim()) {
            const termo = busca.toLowerCase();
            resultado = resultado.filter(p =>
                p.nome.toLowerCase().includes(termo) ||
                p.sku_primario.toLowerCase().includes(termo) ||
                p.localizacao.toLowerCase().includes(termo)
            );
        }

        // Filtro de status
        if (filtroStatus !== 'todos') {
            resultado = resultado.filter(p => p.status === filtroStatus);
        }

        // Ordenação
        resultado.sort((a, b) => {
            switch (ordenacao) {
                case 'data':
                    return b.data_preparacao - a.data_preparacao;
                case 'disponibilidade':
                    return b.quantidade_disponivel - a.quantidade_disponivel;
                case 'localizacao':
                    return a.localizacao.localeCompare(b.localizacao);
                default:
                    return 0;
            }
        });

        return resultado;
    }, [pacotes, busca, filtroStatus, ordenacao]);

    // Estatísticas
    const stats = useMemo(() => ({
        totalPacotes: pacotes.length,
        totalPronto: pacotes.filter(p => p.status === 'PRONTO').length,
        totalReservado: pacotes.filter(p => p.status === 'RESERVADO').length,
        totalExpedido: pacotes.filter(p => p.status === 'EXPEDIDO').length,
        dispositivoTotal: pacotes.reduce((acc, p) => acc + p.quantidade_disponivel, 0),
    }), [pacotes]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'PRONTO': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
            case 'RESERVADO': return 'bg-amber-100 text-amber-700 border-amber-300';
            case 'EXPEDIDO': return 'bg-blue-100 text-blue-700 border-blue-300';
            case 'DEVOLVIDO': return 'bg-red-100 text-red-700 border-red-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getStatusIcon = (status: string) => {
        switch(status) {
            case 'PRONTO': return <CheckCircle size={16} />;
            case 'RESERVADO': return <AlertCircle size={16} />;
            case 'EXPEDIDO': return <ArrowRight size={16} />;
            case 'DEVOLVIDO': return <X size={16} />;
            default: return <Package size={16} />;
        }
    };

    return (
        <div className="space-y-6 p-6 bg-gradient-to-b from-slate-50 to-white rounded-2xl">
            {/* Header com Estatísticas */}
            <div>
                <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
                            <Package className="text-emerald-600" size={36} />
                            Pacotes Prontos
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-bold">
                            Gerenciar estoque pronto para expedição
                        </p>
                    </div>
                    {onAdicionar && (
                        <button
                            onClick={onAdicionar}
                            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-200"
                        >
                            <Plus size={20} />
                            Novo Pacote
                        </button>
                    )}
                </div>

                {/* Cards de Estatísticas */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Pacotes</p>
                        <p className="text-3xl font-black text-slate-800 mt-2">{stats.totalPacotes}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <p className="text-[10px] font-black text-emerald-600 uppercase">Pronto</p>
                        <p className="text-3xl font-black text-emerald-700 mt-2">✅ {stats.totalPronto}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <p className="text-[10px] font-black text-amber-600 uppercase">Reservado</p>
                        <p className="text-3xl font-black text-amber-700 mt-2">🔶 {stats.totalReservado}</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-[10px] font-black text-blue-600 uppercase">Expedido</p>
                        <p className="text-3xl font-black text-blue-700 mt-2">📦 {stats.totalExpedido}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                        <p className="text-[10px] font-black text-purple-600 uppercase">Total Disponível</p>
                        <p className="text-3xl font-black text-purple-700 mt-2">{stats.dispositivoTotal}</p>
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
                        placeholder="Buscar pacote, SKU ou localização..."
                        className="w-full pl-10 p-3 border-2 border-slate-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-emerald-500"
                    />
                </div>
                <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value as any)}
                    className="p-3 border-2 border-slate-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-emerald-500"
                >
                    <option value="todos">Todos os Status</option>
                    <option value="PRONTO">✅ Pronto</option>
                    <option value="RESERVADO">🔶 Reservado</option>
                    <option value="EXPEDIDO">📦 Expedido</option>
                </select>
                <select
                    value={ordenacao}
                    onChange={(e) => setOrdenacao(e.target.value as any)}
                    className="p-3 border-2 border-slate-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-emerald-500"
                >
                    <option value="data">Mais Recentes</option>
                    <option value="disponibilidade">Maior Disponibilidade</option>
                    <option value="localizacao">Por Localização</option>
                </select>
            </div>

            {/* Tabela de Pacotes */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="animate-spin text-emerald-600" size={40} />
                </div>
            ) : pacotesFiltrados.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <Package size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-bold">Nenhum pacote encontrado</p>
                    <p className="text-sm mt-1">Crie um novo pacote para começar</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                    <table className="min-w-full bg-white text-sm">
                        <thead className="bg-slate-900 text-white sticky top-0">
                            <tr>
                                {['Nome', 'SKU', 'Status', 'Localização', 'Disponível', 'Operador', 'Data', 'Ações'].map(h =>
                                    <th key={h} className="p-4 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pacotesFiltrados.map((pacote) => (
                                <tr key={pacote.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-bold text-slate-800">{pacote.nome}</td>
                                    <td className="p-4 font-mono font-black text-slate-600">{pacote.sku_primario}</td>
                                    <td className="p-4">
                                        <div className={`flex items-center gap-2 w-fit px-3 py-1 rounded-full border font-black text-xs uppercase ${getStatusColor(pacote.status)}`}>
                                            {getStatusIcon(pacote.status)}
                                            {pacote.status}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <MapPin size={14} />
                                            <span className="font-mono font-bold">{pacote.localizacao}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="font-black text-emerald-700 text-lg">{pacote.quantidade_disponivel}</span>
                                        <span className="text-[10px] text-slate-400 block">de {pacote.quantidade_total}</span>
                                    </td>
                                    <td className="p-4 text-slate-600 text-sm">
                                        <div className="flex items-center gap-1">
                                            <User size={14} />
                                            {pacote.operador}
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-500 text-xs">
                                        <div className="flex items-center gap-1">
                                            <Clock size={14} />
                                            {new Date(pacote.data_preparacao).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="p-4 flex gap-2">
                                        <button
                                            onClick={() => {
                                                setPacoteSelecionado(pacote);
                                                setShowDetalhes(true);
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                            title="Ver detalhes"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        {onEditar && (
                                            <button
                                                onClick={() => onEditar(pacote)}
                                                className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                        {onDeletar && (
                                            <button
                                                onClick={() => onDeletar(pacote.id)}
                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                                                title="Deletar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        {pacote.status === 'PRONTO' && onMarcarExpedido && (
                                            <button
                                                onClick={() => onMarcarExpedido(pacote.id)}
                                                className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all"
                                                title="Marcar como expedido"
                                            >
                                                <ArrowRight size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                setPacoteSelecionado(pacote);
                                                setShowLabelModal(true);
                                            }}
                                            className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-all"
                                            title="Gerar Etiquetas"
                                        >
                                            <QrCode size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Detalhes */}
            {showDetalhes && pacoteSelecionado && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-8">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase">{pacoteSelecionado.nome}</h2>
                                <p className="text-sm text-slate-400 mt-1 font-bold">SKU: {pacoteSelecionado.sku_primario}</p>
                            </div>
                            <button
                                onClick={() => setShowDetalhes(false)}
                                className="p-2 text-slate-400 hover:text-slate-700"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Status e Localização */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Status</p>
                                    <div className={`flex items-center gap-2 w-fit px-3 py-2 rounded-lg border font-black text-sm ${getStatusColor(pacoteSelecionado.status)}`}>
                                        {getStatusIcon(pacoteSelecionado.status)}
                                        {pacoteSelecionado.status}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Localização</p>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg font-bold text-slate-700">
                                        <MapPin size={16} />
                                        {pacoteSelecionado.localizacao}
                                    </div>
                                </div>
                            </div>

                            {/* Quantidades */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-3">Quantidades</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                                        <p className="text-[9px] font-bold text-slate-500 uppercase">Total</p>
                                        <p className="text-2xl font-black text-slate-800 mt-2">{pacoteSelecionado.quantidade_total}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-100 rounded-lg border border-emerald-200">
                                        <p className="text-[9px] font-bold text-emerald-600 uppercase">Disponível</p>
                                        <p className="text-2xl font-black text-emerald-700 mt-2">{pacoteSelecionado.quantidade_disponivel}</p>
                                    </div>
                                    <div className="p-4 bg-amber-100 rounded-lg border border-amber-200">
                                        <p className="text-[9px] font-bold text-amber-600 uppercase">Reservado</p>
                                        <p className="text-2xl font-black text-amber-700 mt-2">{pacoteSelecionado.quantidade_reservada}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Produtos Inclusos */}
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-3">Produtos Inclusos</p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {pacoteSelecionado.produtos.map((prod, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div>
                                                <p className="font-bold text-slate-800">{prod.nome}</p>
                                                <p className="text-xs text-slate-500 font-mono">{prod.sku}</p>
                                            </div>
                                            <span className="font-black text-lg text-emerald-600">{prod.quantidade}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Informações Adicionais */}
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-100 rounded-lg">
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Operador</p>
                                    <p className="font-bold text-slate-800 mt-1">{pacoteSelecionado.operador}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-bold text-slate-500 uppercase">Data Preparação</p>
                                    <p className="font-bold text-slate-800 mt-1">
                                        {new Date(pacoteSelecionado.data_preparacao).toLocaleString('pt-BR')}
                                    </p>
                                </div>
                            </div>

                            {pacoteSelecionado.observacoes && (
                                <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Observações</p>
                                    <p className="p-3 bg-blue-50 rounded-lg text-slate-700 border border-blue-200">
                                        {pacoteSelecionado.observacoes}
                                    </p>
                                </div>
                            )}

                            {/* Mover Pacote */}
                            {onMoverPacote && pacoteSelecionado.status === 'PRONTO' && (
                                <div className="border-t pt-4">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-3">Mover Pacote</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={novaLocalizacao}
                                            onChange={(e) => setNovaLocalizacao(e.target.value)}
                                            placeholder="Nova localização..."
                                            className="flex-1 p-3 border-2 border-slate-200 rounded-lg font-bold outline-none focus:border-emerald-500"
                                        />
                                        <button
                                            onClick={() => {
                                                if (novaLocalizacao.trim()) {
                                                    onMoverPacote(pacoteSelecionado.id, novaLocalizacao);
                                                    setNovaLocalizacao('');
                                                    setShowDetalhes(false);
                                                }
                                            }}
                                            className="px-6 py-3 bg-emerald-600 text-white font-black rounded-lg hover:bg-emerald-700 transition-all"
                                        >
                                            Mover
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6 pt-6 border-t">
                            <button
                                onClick={() => setShowDetalhes(false)}
                                className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-600 font-black uppercase hover:bg-slate-200 transition-all"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Etiquetas */}
            {showLabelModal && pacoteSelecionado && (
                <BarcodeLabelModal
                    isOpen={showLabelModal}
                    onClose={() => setShowLabelModal(false)}
                    pacote={pacoteSelecionado}
                    addToast={addToast}
                />
            )}
        </div>
    );
};
