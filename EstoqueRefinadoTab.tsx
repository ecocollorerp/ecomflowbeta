import React from 'react';
import {
    TrendingDown,
    Download,
    Package,
    CheckCircle,
    History,
    ArrowRight,
    Search,
    X,
    Loader2
} from 'lucide-react';

interface StockItem {
    id?: string;
    codigo?: string;
    descricao?: string;
    saldoFisico?: number;
    saldoVirtual?: number;
    preco?: number;
    estoqueAtual?: number;
    estoqueVirtual?: number;
    readyQty?: number;
    ready_location?: string;
    reserved_qty?: number;
}

interface AdjustStockModalState {
    item: StockItem;
}

interface EstoqueRefinadoTabProps {
    activeTab: string;
    isLoadingStock: boolean;
    stockItems: StockItem[];
    stockTab: 'todos' | 'pronto' | 'movimentos' | 'comparacao';
    setStockTab: (tab: 'todos' | 'pronto' | 'movimentos' | 'comparacao') => void;
    stockSearch: string;
    setStockSearch: (search: string) => void;
    stockFilter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente';
    setStockFilter: (filter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente') => void;
    stockSort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc';
    setStockSort: (sort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc') => void;
    adjustStockModal: AdjustStockModalState | null;
    setAdjustStockModal: (modal: AdjustStockModalState | null) => void;
    adjustQty: string;
    setAdjustQty: (qty: string) => void;
    adjustOp: 'B' | 'E' | 'S';
    setAdjustOp: (op: 'B' | 'E' | 'S') => void;
    adjustObs: string;
    setAdjustObs: (obs: string) => void;
    isSavingAdjust: boolean;
    handleFetchStock: () => void;
    handleAdjustStock: () => void;
    erpStockMap?: Map<string, number>;
}

export const EstoqueRefinadoTab: React.FC<EstoqueRefinadoTabProps> = ({
    activeTab,
    isLoadingStock,
    stockItems,
    stockTab,
    setStockTab,
    stockSearch,
    setStockSearch,
    stockFilter,
    setStockFilter,
    stockSort,
    setStockSort,
    adjustStockModal,
    setAdjustStockModal,
    adjustQty,
    setAdjustQty,
    adjustOp,
    setAdjustOp,
    adjustObs,
    setAdjustObs,
    isSavingAdjust,
    handleFetchStock,
    handleAdjustStock,
    erpStockMap = new Map()
}) => {
    if (activeTab !== 'estoque') {
        return null;
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl">
                {/* Header */}
                <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                            <TrendingDown className="text-emerald-600" size={32}/>
                            Gestão de Estoque
                        </h2>
                        <p className="text-sm text-slate-400 mt-1 font-bold">
                            📊 Sincronize com o Bling e visualize estoque pronto e movimentações
                        </p>
                    </div>
                    <button
                        onClick={handleFetchStock}
                        disabled={isLoadingStock}
                        className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xl shadow-emerald-100 active:scale-95"
                    >
                        {isLoadingStock ? <Loader2 className="animate-spin" /> : <Download />}
                        {isLoadingStock ? 'Carregando...' : 'Sincronizar Bling'}
                    </button>
                </div>

                {/* Abas de visualização */}
                <div className="flex border-b mb-6 gap-1 overflow-x-auto">
                    {[
                        { id: 'todos', label: '📦 Todos', icon: Package },
                        { id: 'pronto', label: '✅ Pronto para Venda', icon: CheckCircle },
                        { id: 'movimentos', label: '📜 Movimentações', icon: History },
                        { id: 'comparacao', label: '🔄 Bling vs ERP', icon: ArrowRight },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setStockTab(tab.id as any)}
                            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                                stockTab === tab.id
                                    ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Filtros gerais */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                    <div className="relative md:col-span-2">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={stockSearch}
                            onChange={e => setStockSearch(e.target.value)}
                            placeholder="Buscar SKU, código ou nome..."
                            className="w-full pl-10 p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Filtro Status */}
                    <select
                        value={stockFilter}
                        onChange={e => setStockFilter(e.target.value as any)}
                        className="p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500"
                    >
                        <option value="todos">Todos os Status</option>
                        <option value="zerado">🔴 Zerado</option>
                        <option value="baixo">🟡 Baixo (≤5)</option>
                        <option value="ok">🟢 OK</option>
                        <option value="divergente">⚠️ Divergência Bling/ERP</option>
                    </select>

                    {/* Ordenação */}
                    <select
                        value={stockSort}
                        onChange={e => setStockSort(e.target.value as any)}
                        className="p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500"
                    >
                        <option value="sku">Ordenar: SKU ↑</option>
                        <option value="nome">Ordenar: Nome ↑</option>
                        <option value="fisico_asc">Ordenar: Qtd ↑</option>
                        <option value="fisico_desc">Ordenar: Qtd ↓</option>
                    </select>
                </div>

                {/* Aba: Todos os Produtos */}
                {stockTab === 'todos' && (
                    <div className="space-y-4">
                        {stockItems.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <Package size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="font-bold text-sm">Nenhum item de estoque carregado.</p>
                                <p className="text-xs mt-1">Clique em <strong>Sincronizar Bling</strong> acima para carregar.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-slate-200 rounded-2xl">
                                <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-900 text-white sticky top-0">
                                            <tr>
                                                {['SKU', 'Descrição', 'Bling', 'Virtual', 'ERP', 'Divergência', 'Preço', 'Ações'].map(h =>
                                                    <th key={h} className="p-4 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {stockItems
                                                .filter(item => {
                                                    const sku = (item.codigo || '').toUpperCase();
                                                    if (stockSearch && !sku.includes(stockSearch.toUpperCase()) &&
                                                        !(item.descricao || '').toUpperCase().includes(stockSearch.toUpperCase())) {
                                                        return false;
                                                    }

                                                    const saldo = item.saldoFisico ?? item.estoqueAtual ?? 0;
                                                    if (stockFilter === 'zerado' && saldo > 0) return false;
                                                    if (stockFilter === 'baixo' && (saldo > 5 || saldo <= 0)) return false;
                                                    if (stockFilter === 'ok' && (saldo <= 0 || saldo <= 5)) return false;
                                                    
                                                    const erpQty = erpStockMap.get(sku);
                                                    if (stockFilter === 'divergente' && (erpQty === undefined || saldo === erpQty)) return false;

                                                    return true;
                                                })
                                                .sort((a, b) => {
                                                    const aQty = a.saldoFisico ?? 0;
                                                    const bQty = b.saldoFisico ?? 0;
                                                    const aCode = (a.codigo || '').toUpperCase();
                                                    const bCode = (b.codigo || '').toUpperCase();

                                                    switch (stockSort) {
                                                        case 'sku': return aCode.localeCompare(bCode);
                                                        case 'nome': return (a.descricao || '').localeCompare(b.descricao || '');
                                                        case 'fisico_asc': return aQty - bQty;
                                                        case 'fisico_desc': return bQty - aQty;
                                                        default: return 0;
                                                    }
                                                })
                                                .map((item, i) => {
                                                    const saldo = item.saldoFisico ?? item.estoqueAtual ?? 0;
                                                    const saldoV = item.saldoVirtual ?? item.estoqueVirtual ?? 0;
                                                    const sku = (item.codigo || '').toUpperCase();
                                                    const erpQty = erpStockMap.get(sku);
                                                    const diff = erpQty !== undefined ? saldo - erpQty : null;
                                                    
                                                    const cor = saldo <= 0 ? 'text-red-600 bg-red-50' :
                                                               saldo <= 5 ? 'text-orange-600 bg-orange-50' :
                                                               'text-emerald-700 bg-emerald-50';
                                                    const dot = saldo <= 0 ? '🔴' : saldo <= 5 ? '🟡' : '🟢';
                                                    
                                                    const erpCor = erpQty === undefined ? '' :
                                                                  diff === 0 ? 'bg-emerald-50 text-emerald-700' :
                                                                  'bg-red-50 text-red-600';
                                                    
                                                    const rowHighlight = diff !== null && diff !== 0 ? 'bg-violet-50/40' : '';

                                                    return (
                                                        <tr key={item.id || i} className={`hover:bg-slate-50 transition-colors ${rowHighlight}`}>
                                                            <td className="p-3 font-mono font-black text-slate-700 text-sm">{item.codigo || '-'}</td>
                                                            <td className="p-3 font-bold text-slate-600 max-w-[280px] truncate text-sm">{item.descricao || '-'}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`text-xs font-black px-2.5 py-1 rounded-full ${cor}`}>
                                                                    {dot} {saldo}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-black text-purple-600 text-center text-xs">{saldoV}</td>
                                                            <td className="p-3 text-center">
                                                                {erpQty !== undefined ? (
                                                                    <span className={`text-xs font-black px-2.5 py-1 rounded-full ${erpCor}`}>{erpQty}</span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-300 font-bold">—</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                {diff === null ? (
                                                                    <span className="text-xs text-slate-300 font-bold">—</span>
                                                                ) : diff === 0 ? (
                                                                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">✓ OK</span>
                                                                ) : (
                                                                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-red-100 text-red-600">
                                                                        {diff > 0 ? `+${diff}` : diff}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-black text-emerald-600 whitespace-nowrap text-xs">
                                                                {item.preco != null ? Number(item.preco).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '-'}
                                                            </td>
                                                            <td className="p-3">
                                                                <button
                                                                    onClick={() => { 
                                                                        setAdjustStockModal({ item }); 
                                                                        setAdjustQty(String(saldo)); 
                                                                        setAdjustOp('B'); 
                                                                        setAdjustObs(''); 
                                                                    }}
                                                                    className="flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 transition-all whitespace-nowrap"
                                                                >
                                                                    <TrendingDown size={10}/> Ajustar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {stockItems.length > 0 && (
                            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 rounded-b-xl">
                                <p className="text-[10px] text-slate-400 font-bold">
                                    {stockItems.length} produto(s) carregado(s) • 
                                    Última atualização: {new Date().toLocaleString('pt-BR')}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Aba: Estoque Pronto */}
                {stockTab === 'pronto' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Total Pronto</p>
                                <p className="text-2xl font-black text-emerald-700">{stockItems.reduce((acc, i) => acc + (i.readyQty || 0), 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Reservado</p>
                                <p className="text-2xl font-black text-orange-700">{stockItems.reduce((acc, i) => acc + (i.reserved_qty || 0), 0).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Disponível</p>
                                <p className="text-2xl font-black text-blue-700">
                                    {stockItems.reduce((acc, i) => acc + (((i.readyQty || 0) - (i.reserved_qty || 0))), 0).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Produtos</p>
                                <p className="text-2xl font-black text-slate-700">{stockItems.filter(i => (i.readyQty || 0) > 0).length}</p>
                            </div>
                        </div>

                        {stockItems.filter(i => (i.readyQty || 0) > 0).length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <CheckCircle size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="font-bold text-sm">Nenhum item pronto para venda.</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-emerald-200 rounded-2xl">
                                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-emerald-900 text-white sticky top-0">
                                            <tr>
                                                {['SKU', 'Descrição', 'Pronto', 'Reservado', 'Disponível', 'Localização', 'Ações'].map(h =>
                                                    <th key={h} className="p-4 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-emerald-100">
                                            {stockItems
                                                .filter(i => (i.readyQty || 0) > 0)
                                                .map((item, i) => {
                                                    const pronto = item.readyQty || 0;
                                                    const reservado = item.reserved_qty || 0;
                                                    const disponivel = Math.max(0, pronto - reservado);

                                                    return (
                                                        <tr key={item.id || i} className="hover:bg-emerald-50 transition-colors">
                                                            <td className="p-4 font-mono font-black text-slate-700">{item.codigo}</td>
                                                            <td className="p-4 font-bold text-slate-600 max-w-[280px] truncate">{item.descricao}</td>
                                                            <td className="p-4 text-center">
                                                                <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2.5 py-1 rounded-full">
                                                                    ✅ {pronto}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <span className="bg-orange-100 text-orange-700 text-xs font-black px-2.5 py-1 rounded-full">
                                                                    🔶 {reservado}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-center font-black text-blue-700">
                                                                {disponivel > 0 ? (
                                                                    <span className="bg-blue-100 text-blue-700 text-xs font-black px-2.5 py-1 rounded-full">
                                                                        {disponivel}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-500 font-bold">Esgotado</span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-sm text-slate-600 font-mono">
                                                                {item.ready_location || '—'}
                                                            </td>
                                                            <td className="p-4 flex gap-1">
                                                                <button className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 transition-all">
                                                                    Detalhes
                                                                </button>
                                                                <button className="text-[9px] font-black uppercase px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 transition-all">
                                                                    Mover
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                    </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Aba: Movimentações */}
                {stockTab === 'movimentos' && (
                    <div className="text-center py-20 text-slate-400">
                        <History size={48} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold text-sm">Histórico de movimentações em breve.</p>
                        <p className="text-xs mt-1">Integração com `stock_movements` será habilitada na próxima versão.</p>
                    </div>
                )}

                {/* Aba: Comparação */}
                {stockTab === 'comparacao' && (
                    <div className="text-center py-20 text-slate-400">
                        <ArrowRight size={48} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold text-sm">Comparação Bling vs ERP</p>
                        <p className="text-xs mt-1">Veja itens com divergência na aba "Status" usando o filtro "⚠️ Divergência".</p>
                    </div>
                )}
            </div>

            {/* Modal de ajuste — SEM MUDANÇAS */}
            {adjustStockModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Ajustar Estoque Bling</h3>
                                <p className="text-xs text-slate-400 mt-0.5 font-bold">{adjustStockModal.item.codigo} — {adjustStockModal.item.descricao}</p>
                            </div>
                            <button onClick={() => setAdjustStockModal(null)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Operação</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([['B', 'Balanço', 'bg-blue-600'], ['E', 'Entrada', 'bg-emerald-600'], ['S', 'Saída', 'bg-red-500']] as const).map(([op, label, cls]) => (
                                        <button key={op} onClick={() => setAdjustOp(op)}
                                            className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adjustOp === op ? cls + ' text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                    {adjustOp === 'B' ? '🔵 Define o saldo exato.' :
                                     adjustOp === 'E' ? '🟢 Soma à quantidade atual.' :
                                                       '🔴 Subtrai da quantidade atual.'}
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Quantidade</label>
                                <input type="number" min="0" step="1" value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-black text-lg outline-none focus:border-emerald-500 text-center"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Observações (opcional)</label>
                                <input type="text" value={adjustObs} onChange={e => setAdjustObs(e.target.value)} placeholder="Ex: Inventário Feb/2026…"
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"/>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setAdjustStockModal(null)} className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                            <button onClick={handleAdjustStock} disabled={isSavingAdjust || !adjustQty}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100">
                                {isSavingAdjust ? <Loader2 size={14} className="animate-spin"/> : <TrendingDown size={14}/>} Salvar no Bling
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
