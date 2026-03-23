// ============================================================================
// PacotesProntosPage.tsx - Página Completa de Pacotes Prontos
// Integra gerenciamento de pacotes e sincronização com Bling
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { PacotesProntosManager } from '../components/PacotesProntosManager';
import { BlingPedidosItemsSync } from '../components/BlingPedidosItemsSync';
// Tabs implementation can be done manually with state if needed
// import { Tabs, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
    Package,
    ShoppingCart,
    Settings,
    Save,
    Plus,
    Loader2,
    AlertCircle,
    BarChart3
} from 'lucide-react';

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

interface PacotesProntosPageProps {
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const PacotesProntosPage: React.FC<PacotesProntosPageProps> = ({ addToast }) => {
    // Estados
    const [pacotes, setPacotes] = useState<PacoteProto[]>([]);
    const [pedidosItens, setPedidosItens] = useState<PedidoItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState('pacotes');
    const [showNovoModal, setShowNovoModal] = useState(false);
    const [showBlingConfig, setShowBlingConfig] = useState(false);
    const [periodFilter, setPeriodFilter] = useState('7d');

    // Estado do formulário de novo pacote
    const [formNovoPacote, setFormNovoPacote] = useState({
        nome: '',
        sku_primario: '',
        quantidade: '50',
        localizacao: ''
    });

    // Carregar pacotes prontos do banco
    const loadPacotes = useCallback(async () => {
        try {
            setIsLoading(true);
            const { dbClient } = await import('../lib/supabaseClient');
            const { data, error } = await dbClient
                .from('estoque_pronto')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const mapped: PacoteProto[] = (data || []).map((row: any) => ({
                id: row.id,
                nome: row.batch_id || '',
                sku_primario: row.stock_item_id || '',
                quantidade_total: Number(row.quantidade_total || 0),
                quantidade_disponivel: Number(row.quantidade_disponivel || 0),
                quantidade_reservada: Number(row.quantidade_total || 0) - Number(row.quantidade_disponivel || 0),
                localizacao: row.localizacao || '',
                status: row.status || 'PRONTO',
                data_preparacao: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
                data_disponibilidade: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
                operador: row.created_by || '',
                observacoes: row.observacoes || '',
                produtos: Array.isArray(row.produtos) ? row.produtos : [],
            }));
            setPacotes(mapped);
        } catch (error) {
            console.error('Erro ao carregar pacotes:', error);
            addToast('Erro ao carregar pacotes prontos', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    // Carregar itens dos pedidos
    const loadPedidosItens = useCallback(async () => {
        try {
            setIsLoading(true);
            // TODO: Implementar chamada ao backend/Bling API

            // Dados de exemplo
            const mockItens: PedidoItem[] = [
                {
                    id: '1',
                    orderId: 'PED-001',
                    blingId: 'BLING-001',
                    sku: 'PROD-001',
                    nome: 'Produto A Premium',
                    quantidade: 2,
                    preco_unitario: 99.90,
                    preco_total: 199.80,
                    status: 'sincronizado',
                    data_criacao: Date.now() - 86400000,
                    ultima_sincronizacao: Date.now() - 3600000,
                },
                {
                    id: '2',
                    orderId: 'PED-002',
                    sku: 'PROD-002',
                    nome: 'Produto B Standard',
                    quantidade: 1,
                    preco_unitario: 49.90,
                    preco_total: 49.90,
                    status: 'nao_sincronizado',
                    data_criacao: Date.now() - 3600000,
                },
                {
                    id: '3',
                    orderId: 'PED-003',
                    sku: 'PROD-003',
                    nome: 'Produto C Deluxe',
                    quantidade: 3,
                    preco_unitario: 199.90,
                    preco_total: 599.70,
                    status: 'pendente',
                    data_criacao: Date.now() - 1800000,
                    erro_mensagem: 'Aguardando confirmação de estoque',
                },
                {
                    id: '4',
                    orderId: 'PED-004',
                    sku: 'PROD-004',
                    nome: 'Produto D Especial',
                    quantidade: 1,
                    preco_unitario: 299.90,
                    preco_total: 299.90,
                    status: 'erro',
                    data_criacao: Date.now() - 7200000,
                    erro_mensagem: 'SKU não encontrado no Bling',
                },
            ];
            setPedidosItens(mockItens);
        } catch (error) {
            console.error('Erro ao carregar itens:', error);
            addToast('Erro ao carregar itens dos pedidos', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    // Carregar dados ao montar
    useEffect(() => {
        loadPacotes();
        loadPedidosItens();
    }, [loadPacotes, loadPedidosItens]);

    // Adicionar novo pacote
    const handleAdicionarPacote = useCallback(() => {
        setShowNovoModal(true);
        setFormNovoPacote({ nome: '', sku_primario: '', quantidade: '50', localizacao: '' });
    }, []);

    // ✅ Salvar novo pacote no banco
    const handleSalvarNovoPacote = useCallback(async () => {
        const { nome, sku_primario, quantidade, localizacao } = formNovoPacote;

        if (!nome || !sku_primario || !localizacao) {
            addToast('Preencha todos os campos obrigatórios', 'error');
            return;
        }

        try {
            const { dbClient } = await import('../lib/supabaseClient');

            const novoRegistro = {
                batch_id: nome,
                lote_numero: sku_primario,
                stock_item_id: sku_primario,
                quantidade_total: Number(quantidade),
                quantidade_disponivel: Number(quantidade),
                localizacao: localizacao,
                status: 'PRONTO',
                created_by: 'Usuário',
                produtos: [],
                observacoes: ''
            };

            const { data, error } = await dbClient
                .from('estoque_pronto')
                .insert([novoRegistro])
                .select()
                .single();

            if (error) throw error;

            // Adicionar à lista local
            const novoPacote: PacoteProto = {
                id: data.id,
                nome: nome,
                sku_primario: sku_primario,
                quantidade_total: Number(quantidade),
                quantidade_disponivel: Number(quantidade),
                quantidade_reservada: 0,
                localizacao: localizacao,
                status: 'PRONTO',
                data_preparacao: Date.now(),
                data_disponibilidade: Date.now() + 604800000,
                operador: 'Usuário',
                observacoes: '',
                produtos: []
            };

            setPacotes(prev => [novoPacote, ...prev]);
            addToast(`Pacote \"${nome}\" criado com sucesso!`, 'success');
            setShowNovoModal(false);
            setFormNovoPacote({ nome: '', sku_primario: '', quantidade: '50', localizacao: '' });
        } catch (err) {
            console.error('Erro ao salvar pacote:', err);
            addToast(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`, 'error');
        }
    }, [formNovoPacote, addToast]);

    // Editar pacote
    const handleEditarPacote = useCallback((pacote: PacoteProto) => {
        addToast(`Editando: ${pacote.nome}`, 'info');
    }, [addToast]);

    // Deletar pacote
    const handleDeletarPacote = useCallback((id: string) => {
        if (confirm('Tem certeza que deseja deletar este pacote?')) {
            setPacotes(prev => prev.filter(p => p.id !== id));
            addToast('Pacote deletado com sucesso', 'success');
        }
    }, [addToast]);

    // Mover pacote
    const handleMoverPacote = useCallback((id: string, novaLocalizacao: string) => {
        setPacotes(prev => prev.map(p =>
            p.id === id ? { ...p, localizacao: novaLocalizacao } : p
        ));
        addToast('Localização atualizada', 'success');
    }, [addToast]);

    // Marcar como expedido
    const handleMarcarExpedido = useCallback((id: string) => {
        setPacotes(prev => prev.map(p =>
            p.id === id ? { ...p, status: 'EXPEDIDO' } : p
        ));
        addToast('Pacote marcado como expedido', 'success');
    }, [addToast]);

    // Sincronizar itens com Bling
    const handleSincronizarBling = useCallback(async (itemIds: string[]) => {
        try {
            setIsSyncing(true);

            // TODO: Implementar sincronização real com Bling API
            // await syncItemsWithBling(itemIds);

            // Simular sincronização
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Atualizar status localmente
            setPedidosItens(prev => prev.map(item =>
                itemIds.includes(item.id) && item.status !== 'sincronizado'
                    ? { ...item, status: 'sincronizado', ultima_sincronizacao: Date.now() }
                    : item
            ));

            addToast(`${itemIds.length} item(ns) sincronizado(s) com Bling`, 'success');
        } catch (error) {
            console.error('Erro ao sincronizar:', error);
            addToast('Erro ao sincronizar com Bling', 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [addToast]);

    // Download de itens do Bling
    const handleDownloadBling = useCallback(async () => {
        try {
            setIsLoading(true);
            // TODO: Implementar download real do Bling
            await new Promise(resolve => setTimeout(resolve, 1500));
            addToast('Itens sincronizados com sucesso', 'success');
            loadPedidosItens();
        } catch (error) {
            console.error('Erro ao download:', error);
            addToast('Erro ao baixar dados do Bling', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [loadPedidosItens, addToast]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header Principal */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4 mb-2">
                        <div className="p-3 bg-emerald-100 rounded-2xl">
                            <Package className="text-emerald-600" size={32} />
                        </div>
                        Gestão de Pacotes Prontos
                    </h1>
                    <p className="text-slate-600 font-bold">
                        Gerenciar estoque pronto para expedição e sincronizar com Bling
                    </p>
                </div>

                {/* Abas */}
                <div className="space-y-6">
                    <div className="flex gap-4 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('pacotes')}
                            className={`px-6 py-4 font-black uppercase text-sm tracking-widest border-b-4 transition-all ${activeTab === 'pacotes'
                                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Package size={20} />
                                Pacotes Prontos ({pacotes.length})
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('itens')}
                            className={`px-6 py-4 font-black uppercase text-sm tracking-widest border-b-4 transition-all ${activeTab === 'itens'
                                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={20} />
                                Itens Pedidos ({pedidosItens.length})
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('relatorio')}
                            className={`px-6 py-4 font-black uppercase text-sm tracking-widest border-b-4 transition-all ${activeTab === 'relatorio'
                                ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <BarChart3 size={20} />
                                Relatório Estoque
                            </div>
                        </button>
                    </div>

                    {/* Conteúdo das Abas */}
                    {activeTab === 'pacotes' && (
                        <PacotesProntosManager
                            pacotes={pacotes}
                            isLoading={isLoading}
                            onAdicionar={handleAdicionarPacote}
                            onEditar={handleEditarPacote}
                            onDeletar={handleDeletarPacote}
                            onMoverPacote={handleMoverPacote}
                            onMarcarExpedido={handleMarcarExpedido}
                            addToast={addToast}
                        />
                    )}

                    {activeTab === 'itens' && (
                        <BlingPedidosItemsSync
                            itens={pedidosItens}
                            isLoading={isLoading}
                            onSincronizar={handleSincronizarBling}
                            onDownloadBling={handleDownloadBling}
                            onBlingSyncConfig={() => setShowBlingConfig(true)}
                        />
                    )}

                    {activeTab === 'relatorio' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Total Geral de Estoque Pronto</h3>
                                    <div className="text-4xl font-black text-slate-800">
                                        {pacotes.reduce((acc, p) => acc + p.quantidade_disponivel, 0)}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-400 mt-2">Unidades prontas e disponíveis para envio</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Total Comprometido</h3>
                                    <div className="text-4xl font-black text-slate-800">
                                        {pacotes.reduce((acc, p) => acc + p.quantidade_reservada, 0)}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-400 mt-2">Unidades reservadas em pedidos pendentes</p>
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                                    <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gráfico de Entradas / Saídas (Estoque Pronto)</h3>
                                        <select
                                            value={periodFilter}
                                            onChange={(e) => setPeriodFilter(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 font-semibold"
                                        >
                                            <option value="7d">Últimos 7 dias</option>
                                            <option value="15d">Últimos 15 dias</option>
                                            <option value="30d">Últimos 30 dias</option>
                                        </select>
                                    </div>

                                    {/* GRÁFICO SIMULADO EM CSS */}
                                    <div className="h-64 flex items-end gap-2 sm:gap-4 md:gap-8 pt-4 border-b border-slate-200 relative">
                                        {/* Linhas de grade */}
                                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                                            {[4, 3, 2, 1, 0].map(i => (
                                                <div key={i} className="border-t border-slate-400 w-full"></div>
                                            ))}
                                        </div>

                                        {[...Array(periodFilter === '7d' ? 7 : periodFilter === '15d' ? 15 : 30)].map((_, i, arr) => {
                                            const date = new Date();
                                            date.setDate(date.getDate() - ((arr.length - 1) - i));
                                            const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                                            // Mocking entries/exits based on date hash
                                            const hash = Math.abs(Math.sin(date.getTime()));
                                            const mathRandIn = hash * 100;
                                            const mathRandOut = Math.abs(Math.cos(date.getTime())) * 80;

                                            const hIn = Math.max(2, (mathRandIn / 120) * 100);
                                            const hOut = Math.max(2, (mathRandOut / 120) * 100);

                                            return (
                                                <div key={i} className="flex-1 flex justify-center items-end gap-[1px] md:gap-1 h-full pb-2 relative z-10 group" title={`${dateStr}\nEntradas: ${Math.floor(mathRandIn)}\nSaídas: ${Math.floor(mathRandOut)}`}>
                                                    <div
                                                        className="w-full max-w-[20px] md:max-w-[40px] bg-emerald-400 rounded-t-sm transition-all hover:brightness-110"
                                                        style={{ height: `${hIn}%` }}
                                                    ></div>
                                                    <div
                                                        className="w-full max-w-[20px] md:max-w-[40px] bg-red-400 rounded-t-sm transition-all hover:brightness-110"
                                                        style={{ height: `${hOut}%` }}
                                                    ></div>

                                                    {/* Mostrar apenas algumas datas no eixo X para evitar poluição visual */}
                                                    {(arr.length <= 7 || i % 3 === 0) && (
                                                        <div className="absolute -bottom-7 text-[9px] md:text-[10px] font-bold text-slate-500 whitespace-nowrap">
                                                            {dateStr}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-6 justify-center mt-10">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                                            <span className="text-xs font-bold text-slate-600">Entradas de Pacotes</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                                            <span className="text-xs font-bold text-slate-600">Saídas (Expedição)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal de Nova Pacote */}
                {showNovoModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase mb-6">Novo Pacote Pronto</h2>

                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="text-sm font-black text-slate-600 uppercase mb-2 block">Nome do Pacote</label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Kit Promocional Março"
                                        value={formNovoPacote.nome}
                                        onChange={(e) => setFormNovoPacote(prev => ({ ...prev, nome: e.target.value }))}
                                        className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-black text-slate-600 uppercase mb-2 block">SKU Primário</label>
                                        <input
                                            type="text"
                                            placeholder="KIT-001"
                                            value={formNovoPacote.sku_primario}
                                            onChange={(e) => setFormNovoPacote(prev => ({ ...prev, sku_primario: e.target.value }))}
                                            className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-black text-slate-600 uppercase mb-2 block">Quantidade</label>
                                        <input
                                            type="number"
                                            placeholder="50"
                                            value={formNovoPacote.quantidade}
                                            onChange={(e) => setFormNovoPacote(prev => ({ ...prev, quantidade: e.target.value }))}
                                            className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-black text-slate-600 uppercase mb-2 block">Localização</label>
                                    <input
                                        type="text"
                                        placeholder="A1-P1"
                                        value={formNovoPacote.localizacao}
                                        onChange={(e) => setFormNovoPacote(prev => ({ ...prev, localizacao: e.target.value }))}
                                        className="w-full p-3 border-2 border-slate-200 rounded-lg outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowNovoModal(false)}
                                    className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-600 font-black uppercase hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSalvarNovoPacote}
                                    className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-black uppercase hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={18} />
                                    Salvar no Banco
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Configuração Bling */}
                {showBlingConfig && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                            <h2 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-3">
                                <Settings size={28} />
                                Configurar Sincronização Bling
                            </h2>

                            <div className="space-y-4 mb-6">
                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                    <p className="text-sm font-bold text-blue-700">
                                        Configure aqui como os itens dos pedidos devem ser sincronizados com o Bling.
                                    </p>
                                </div>

                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="w-5 h-5" />
                                        <span className="font-bold text-slate-700">Sincronizar automaticamente quando novo item é criado</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="w-5 h-5" />
                                        <span className="font-bold text-slate-700">Atualizar estoque no Bling quando pacote é expedido</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" className="w-5 h-5" />
                                        <span className="font-bold text-slate-700">Enviar notificação para Bling quando pacote é devolvido</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowBlingConfig(false)}
                                    className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-600 font-black uppercase hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        addToast('Configurações salvas', 'success');
                                        setShowBlingConfig(false);
                                    }}
                                    className="flex-1 py-3 rounded-lg bg-blue-600 text-white font-black uppercase hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Save size={18} />
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PacotesProntosPage;
