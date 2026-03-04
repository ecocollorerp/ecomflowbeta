// ============================================================================
// EstoqueRefiner.tsx - Componente de Gestão de Estoque Pronto
// Use dentro de BlingPage.tsx no lugar da aba estoque
// ============================================================================

import React, { useEffect } from 'react';
import {
    TrendingDown, Download, Package, CheckCircle, History,
    ArrowRight, Search, X, Loader2
} from 'lucide-react';

interface EstoqueRefinadorProps {
    isLoadingStock: boolean;
    stockItems: any[];
    stockTab: 'todos' | 'pronto' | 'movimentos' | 'comparacao';
    setStockTab: (tab: 'todos' | 'pronto' | 'movimentos' | 'comparacao') => void;
    stockSearch: string;
    setStockSearch: (search: string) => void;
    stockFilter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente';
    setStockFilter: (filter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente') => void;
    stockSort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc';
    setStockSort: (sort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc') => void;
    adjustStockModal: any;
    setAdjustStockModal: (modal: any) => void;
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

export const EstoqueRefiner: React.FC<EstoqueRefinadorProps> = ({
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
    useEffect(() => {
        // Auto-carregar ao montar
        if (stockItems.length === 0) {
            handleFetchStock();
        }
    }, []);

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
                            📊 Sincronize com Bling e visualize estoque pronto
                        </p>
                    </div>
                    <button
                        onClick={handleFetchStock}
                        disabled={isLoadingStock}
                        className="flex items-center gap-3 px-8 py-3 bg-emerald-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-xl shadow-emerald-100 active:scale-95"
                    >
                        {isLoadingStock ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                        {isLoadingStock ? 'Carregando...' : 'Sincronizar Bling'}
                    </button>
                </div>

                {/* Abas */}
                <div className="flex border-b mb-6 gap-1 overflow-x-auto">
                    {[
                        { id: 'todos', label: '📦 Todos' },
                        { id: 'pronto', label: '✅ Pronto' },
                        { id: 'movimentos', label: '📜 Movimentos' },
                        { id: 'comparacao', label: '🔄 Comparação' },
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

                {/* Filtros */}
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
                    <select
                        value={stockFilter}
                        onChange={e => setStockFilter(e.target.value as any)}
                        className="p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500"
                    >
                        <option value="todos">Todos</option>
                        <option value="zerado">🔴 Zerado</option>
                        <option value="baixo">🟡 Baixo (≤5)</option>
                        <option value="ok">🟢 OK</option>
                        <option value="divergente">⚠️ Divergência</option>
                    </select>
                    <select
                        value={stockSort}
                        onChange={e => setStockSort(e.target.value as any)}
                        className="p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-emerald-500"
                    >
                        <option value="sku">SKU ↑</option>
                        <option value="nome">Nome ↑</option>
                        <option value="fisico_asc">Qtd ↑</option>
                        <option value="fisico_desc">Qtd ↓</option>
                    </select>
                </div>

                {/* TAB: Todos */}
                {stockTab === 'todos' && (
                    <div className="space-y-4">
                        {stockItems.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <Package size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="font-bold">Nenhum item carregado</p>
                                <p className="text-xs mt-1">Clique em <strong>Sincronizar Bling</strong></p>
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-slate-200 rounded-2xl">
                                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-900 text-white sticky top-0">
                                            <tr>
                                                {['SKU', 'Descrição', 'Bling', 'Virtual', 'ERP', 'Div.', 'Preço', 'Ações'].map(h =>
                                                    <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
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
                                                    const saldo = item.saldoFisico ?? 0;
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
                                                    const saldo = item.saldoFisico ?? 0;
                                                    const saldoV = item.saldoVirtual ?? 0;
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
                                                            <td className="p-3 font-mono font-black text-slate-700 text-xs">{item.codigo || '-'}</td>
                                                            <td className="p-3 font-bold text-slate-600 max-w-[200px] truncate text-xs">{item.descricao || '-'}</td>
                                                            <td className="p-3 text-center">
                                                                <span className={`text-xs font-black px-2 py-1 rounded-full ${cor}`}>
                                                                    {dot} {saldo}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-black text-purple-600 text-center text-xs">{saldoV}</td>
                                                            <td className="p-3 text-center">
                                                                {erpQty !== undefined ? (
                                                                    <span className={`text-xs font-black px-2 py-1 rounded-full ${erpCor}`}>{erpQty}</span>
                                                                ) : (
                                                                    <span className="text-xs text-slate-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-center text-xs">
                                                                {diff === null ? '—' : diff === 0 ? '✓' : <span className="font-black">{diff > 0 ? '+' : ''}{diff}</span>}
                                                            </td>
                                                            <td className="p-3 font-black text-emerald-600 text-xs">
                                                                {item.preco ? Number(item.preco).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) : '-'}
                                                            </td>
                                                            <td className="p-3">
                                                                <button
                                                                    onClick={() => {
                                                                        setAdjustStockModal({ item });
                                                                        setAdjustQty(String(saldo));
                                                                        setAdjustOp('B');
                                                                        setAdjustObs('');
                                                                    }}
                                                                    className="text-[9px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700 transition-all"
                                                                >
                                                                    Ajustar
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

                {/* TAB: Pronto */}
                {stockTab === 'pronto' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">Total Pronto</p>
                                <p className="text-2xl font-black text-emerald-700">
                                    {stockItems.reduce((acc, i) => acc + (i.readyQty || 0), 0).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">Reservado</p>
                                <p className="text-2xl font-black text-orange-700">
                                    {stockItems.reduce((acc, i) => acc + (i.reserved_qty || 0), 0).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">Disponível</p>
                                <p className="text-2xl font-black text-blue-700">
                                    {stockItems.reduce((acc, i) => acc + (((i.readyQty || 0) - (i.reserved_qty || 0))), 0).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase">Produtos</p>
                                <p className="text-2xl font-black text-slate-700">
                                    {stockItems.filter(i => (i.readyQty || 0) > 0).length}
                                </p>
                            </div>
                        </div>

                        {stockItems.filter(i => (i.readyQty || 0) > 0).length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <CheckCircle size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="font-bold">Nenhum item pronto</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-emerald-200 rounded-2xl">
                                <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-emerald-900 text-white sticky top-0">
                                            <tr>
                                                {['SKU', 'Descrição', 'Pronto', 'Reservado', 'Disponível', 'Localização'].map(h =>
                                                    <th key={h} className="p-3 text-left text-[9px] font-black uppercase">{h}</th>
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
                                                        <tr key={item.id || i} className="hover:bg-emerald-50">
                                                            <td className="p-3 font-mono font-black text-slate-700 text-xs">{item.codigo}</td>
                                                            <td className="p-3 font-bold text-slate-600 max-w-[200px] truncate text-xs">{item.descricao}</td>
                                                            <td className="p-3 text-center">
                                                                <span className="bg-emerald-100 text-emerald-700 text-xs font-black px-2 py-1 rounded-full">
                                                                    ✅ {pronto}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className="bg-orange-100 text-orange-700 text-xs font-black px-2 py-1 rounded-full">
                                                                    🔶 {reservado}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 text-center font-black text-blue-700">
                                                                {disponivel > 0 ? (
                                                                    <span className="bg-blue-100 text-blue-700 text-xs font-black px-2 py-1 rounded-full">
                                                                        {disponivel}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-red-500 font-bold text-xs">Esgotado</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-xs text-slate-600 font-mono">
                                                                {item.ready_location || '—'}
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

                {/* TAB: Movimentos e Comparação */}
                {stockTab === 'movimentos' && (
                    <div className="text-center py-20 text-slate-400">
                        <History size={48} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold">Histórico em breve</p>
                    </div>
                )}
                {stockTab === 'comparacao' && (
                    <div className="text-center py-20 text-slate-400">
                        <ArrowRight size={48} className="mx-auto mb-4 opacity-20"/>
                        <p className="font-bold">Use o filtro ⚠️ Divergência</p>
                    </div>
                )}
            </div>

            {/* Modal de Ajuste */}
            {adjustStockModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 animate-in zoom-in-95">
                        <div className="flex items-start justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase">Ajustar Estoque</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {adjustStockModal.item.codigo} — {adjustStockModal.item.descricao}
                                </p>
                            </div>
                            <button 
                                onClick={() => setAdjustStockModal(null)} 
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Operação */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">
                                    Operação
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[['B', 'Balanço', 'bg-blue-600'], ['E', 'Entrada', 'bg-emerald-600'], ['S', 'Saída', 'bg-red-500']].map(([op, label, cls]: any) => (
                                        <button key={op}
                                            onClick={() => setAdjustOp(op as any)}
                                            className={`py-2 rounded-xl text-xs font-black uppercase transition-all ${
                                                adjustOp === op 
                                                    ? `${cls} text-white shadow-lg` 
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                    {adjustOp === 'B' ? '🔵 Define saldo exato' :
                                     adjustOp === 'E' ? '🟢 Soma à quantidade' :
                                                       '🔴 Subtrai da quantidade'}
                                </p>
                            </div>

                            {/* Quantidade */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                                    Quantidade
                                </label>
                                <input 
                                    type="number" 
                                    min="0" 
                                    step="1" 
                                    value={adjustQty}
                                    onChange={e => setAdjustQty(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-black text-lg outline-none focus:border-emerald-500 text-center"
                                />
                            </div>

                            {/* Observações */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase mb-1.5 block">
                                    Observações
                                </label>
                                <input 
                                    type="text" 
                                    value={adjustObs}
                                    onChange={e => setAdjustObs(e.target.value)}
                                    placeholder="Ex: Inventário Feb/2026..."
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 mt-6">
                            <button 
                                onClick={() => setAdjustStockModal(null)}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-xs uppercase hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAdjustStock}
                                disabled={isSavingAdjust || !adjustQty}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase hover:bg-emerald-700 disabled:opacity-50 transition-all"
                            >
                                {isSavingAdjust ? <Loader2 size={14} className="animate-spin"/> : <TrendingDown size={14}/>}
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
