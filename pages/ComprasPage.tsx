import React, { useState, useMemo } from 'react';
import { ShoppingListItem, StockItem } from '../types';
import {
    ShoppingCart, Trash2, Share2, Search, PlusCircle, FileDown, Printer,
    CheckCircle2, Clock, Package, TrendingUp, X, Info
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ComprasPageProps {
    shoppingList: ShoppingListItem[];
    onClearList: () => void;
    onUpdateItem: (itemCode: string, isPurchased: boolean) => void;
    stockItems: StockItem[];
}

const ComprasPage: React.FC<ComprasPageProps> = ({ shoppingList, onClearList, onUpdateItem, stockItems }) => {

    const [manualList, setManualList] = useState<ShoppingListItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [selectedInsumo, setSelectedInsumo] = useState<StockItem | null>(null);
    const [planSearch, setPlanSearch] = useState('');

    // ── KPIs do planejamento ──────────────────────────────────────────
    const stats = useMemo(() => {
        const total     = shoppingList.length;
        const purchased = shoppingList.filter(i => i.is_purchased).length;
        const pending   = total - purchased;
        const pct       = total > 0 ? Math.round((purchased / total) * 100) : 0;
        return { total, purchased, pending, pct };
    }, [shoppingList]);

    // ── Lista de planejamento filtrada e ordenada ─────────────────────
    const sortedPlanningList = useMemo(() => {
        const lower = planSearch.toLowerCase();
        return [...shoppingList]
            .filter(i => !planSearch || i.name.toLowerCase().includes(lower) || i.id.toLowerCase().includes(lower))
            .sort((a, b) => {
                if (a.is_purchased && !b.is_purchased) return 1;
                if (!a.is_purchased && b.is_purchased) return -1;
                return a.name.localeCompare(b.name);
            });
    }, [shoppingList, planSearch]);

    const handleSharePlanning = () => {
        if (shoppingList.length === 0) return;
        let text = `*Lista de Compras - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
        text += "*PENDENTES:*\n";
        shoppingList.filter(i => !i.is_purchased).forEach(item => {
            text += `- ${item.name}: ${item.quantity.toFixed(2)} ${item.unit}\n`;
        });
        text += "\n*COMPRADOS:*\n";
        shoppingList.filter(i => i.is_purchased).forEach(item => {
            text += `~- ${item.name}: ${item.quantity.toFixed(2)} ${item.unit}~\n`;
        });
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleClearPlanning = () => {
        if (window.confirm('Limpar toda a lista de compras do planejamento?')) onClearList();
    };

    // ── Manual list logic ─────────────────────────────────────────────
    const insumos = useMemo(() => stockItems.filter(item => item.kind === 'INSUMO'), [stockItems]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lower = searchTerm.toLowerCase();
        return insumos.filter(insumo =>
            !manualList.some(item => item.id === insumo.code) &&
            (insumo.name.toLowerCase().includes(lower) || insumo.code.toLowerCase().includes(lower))
        ).slice(0, 5);
    }, [searchTerm, insumos, manualList]);

    const handleSelectInsumo = (insumo: StockItem) => { setSelectedInsumo(insumo); setSearchTerm(''); };

    const handleAddToManualList = () => {
        if (selectedInsumo && quantity > 0) {
            setManualList(prev => [...prev, { id: selectedInsumo.code, name: selectedInsumo.name, quantity, unit: selectedInsumo.unit }]);
            setSelectedInsumo(null);
            setQuantity(1);
        }
    };

    const handleRemoveFromManualList = (code: string) => setManualList(prev => prev.filter(i => i.id !== code));
    const handleClearManualList = () => { if (window.confirm('Limpar a lista manual?')) setManualList([]); };

    const generatePdfForManualList = (action: 'download' | 'print') => {
        if (manualList.length === 0) return;
        const doc = new jsPDF();
        doc.text(`Lista de Compras Manual - ${new Date().toLocaleDateString('pt-BR')}`, 14, 15);
        autoTable(doc, {
            startY: 20,
            head: [['Item', 'Quantidade', 'Unidade']],
            body: manualList.map(item => [item.name, item.quantity.toString(), item.unit]),
            theme: 'striped',
        });
        if (action === 'download') doc.save('lista_compras_manual.pdf');
        else { doc.autoPrint(); window.open(doc.output('bloburl'), '_blank'); }
    };

    const handleShareManual = () => {
        if (manualList.length === 0) return;
        let text = `*Lista de Compras Manual - ${new Date().toLocaleDateString('pt-BR')}*\n\n`;
        manualList.forEach(item => { text += `- ${item.name}: ${item.quantity} ${item.unit}\n`; });
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <ShoppingCart size={40} className="text-orange-600 bg-orange-100 p-2 rounded-2xl shadow-sm" />
                    Compras
                </h1>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Itens', value: stats.total, icon: Package, color: 'bg-slate-100 text-slate-700', iconColor: 'text-slate-500' },
                    { label: 'Pendentes',   value: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-700', iconColor: 'text-amber-500' },
                    { label: 'Comprados',   value: stats.purchased, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700', iconColor: 'text-emerald-500' },
                    { label: 'Progresso',   value: `${stats.pct}%`, icon: TrendingUp, color: 'bg-blue-50 text-blue-700', iconColor: 'text-blue-500' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <card.icon size={16} className={card.iconColor} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${card.color.split(' ')[1]}`}>{card.value}</p>
                        {card.label === 'Progresso' && (
                            <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                                <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${stats.pct}%` }} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                {/* ══════════════════════════════════════════════════════
                    LISTA DE PLANEJAMENTO
                   ══════════════════════════════════════════════════════ */}
                <div className="space-y-4">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-6 py-4 flex justify-between items-center flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <ShoppingCart size={20} className="text-white/80" />
                                <div>
                                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Lista do Planejamento</h2>
                                    <p className="text-[10px] text-white/70 font-bold">{stats.pending} pendente(s) · {stats.purchased} comprado(s)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSharePlanning} disabled={shoppingList.length === 0} className="flex items-center gap-1 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 disabled:opacity-40 transition-all">
                                    <Share2 size={12} /> WhatsApp
                                </button>
                                <button onClick={handleClearPlanning} disabled={shoppingList.length === 0} className="flex items-center gap-1 text-[9px] font-black uppercase px-3 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 disabled:opacity-40 transition-all">
                                    <Trash2 size={12} /> Limpar
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        {shoppingList.length > 0 && (
                            <div className="px-5 pt-4 pb-2">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input type="text" value={planSearch} onChange={e => setPlanSearch(e.target.value)} placeholder="Buscar insumo…"
                                        className="w-full pl-9 p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:border-orange-400" />
                                </div>
                            </div>
                        )}

                        {/* List items */}
                        {sortedPlanningList.length > 0 ? (
                            <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                                <div className="divide-y divide-slate-100">
                                    {sortedPlanningList.map(item => (
                                        <div key={item.id}
                                            className={`flex items-center gap-3 px-5 py-3 transition-all cursor-pointer hover:bg-slate-50 ${item.is_purchased ? 'bg-emerald-50/40' : ''}`}
                                            onClick={() => onUpdateItem(item.id, !item.is_purchased)}
                                        >
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all
                                                ${item.is_purchased ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-orange-400'}`}>
                                                {item.is_purchased && <CheckCircle2 size={14} className="text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold ${item.is_purchased ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.name}</p>
                                            </div>
                                            <span className={`text-xs font-black px-2.5 py-1 rounded-full ${item.is_purchased ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                {item.quantity.toFixed(2)} {item.unit}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 py-14 text-center">
                                <ShoppingCart size={40} className="mx-auto mb-3 text-slate-200" />
                                <p className="font-black text-sm text-slate-400">Lista vazia</p>
                                <p className="text-[11px] text-slate-300 mt-1">Gere uma lista na tela de <span className="font-black">Planejamento</span>.</p>
                            </div>
                        )}

                        {/* Footer */}
                        {shoppingList.length > 0 && (
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                                <p className="text-[10px] text-slate-400 font-bold">{sortedPlanningList.length} de {shoppingList.length} item(s) exibido(s)</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3.5 bg-blue-50 rounded-xl flex items-center gap-3 border border-blue-100">
                        <Info size={16} className="text-blue-500 flex-shrink-0" />
                        <p className="text-[11px] text-blue-700 font-bold">Preenchida automaticamente pelo Planejamento com insumos em déficit.</p>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════
                    LISTA MANUAL
                   ══════════════════════════════════════════════════════ */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <PlusCircle size={20} className="text-white/80" />
                            <div>
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">Lista Manual</h2>
                                <p className="text-[10px] text-white/70 font-bold">{manualList.length} ite{manualList.length === 1 ? 'm' : 'ns'} adicionado(s)</p>
                            </div>
                        </div>
                    </div>

                    {/* Add Insumo */}
                    <div className="p-5 border-b border-slate-100">
                        <div className="relative">
                            {selectedInsumo ? (
                                <div className="flex items-end gap-2">
                                    <div className="flex-1 min-w-0">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Item Selecionado</label>
                                        <div className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl border border-blue-200">
                                            <span className="text-sm font-bold text-blue-700 truncate">{selectedInsumo.name}</span>
                                            <button onClick={() => setSelectedInsumo(null)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={14}/></button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Qtd.</label>
                                        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                                            className="w-20 p-2.5 border-2 border-slate-200 rounded-xl font-black text-center outline-none focus:border-blue-500" min="1" />
                                    </div>
                                    <button onClick={handleAddToManualList}
                                        className="px-4 py-2.5 bg-blue-600 text-white font-black text-xs uppercase rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                                        <PlusCircle size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Buscar Insumo</label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="text" placeholder="Digite para buscar…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                            className="w-full pl-9 p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:border-blue-400" />
                                    </div>
                                </div>
                            )}
                            {searchResults.length > 0 && (
                                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                                    {searchResults.map(insumo => (
                                        <div key={insumo.id} className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors" onClick={() => handleSelectInsumo(insumo)}>
                                            <p className="text-sm font-bold text-slate-700">{insumo.name}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{insumo.code}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Table */}
                    {manualList.length > 0 ? (
                        <div className="max-h-[40vh] overflow-y-auto overflow-x-auto custom-scrollbar">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-900 text-white sticky top-0 z-10">
                                    <tr>
                                        {['Insumo', 'Quantidade', ''].map(h =>
                                            <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {manualList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="p-3">
                                                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{item.quantity} {item.unit}</span>
                                            </td>
                                            <td className="p-3">
                                                <button onClick={() => handleRemoveFromManualList(item.id)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="px-6 py-14 text-center">
                            <PlusCircle size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="font-black text-sm text-slate-400">Nenhum item</p>
                            <p className="text-[11px] text-slate-300 mt-1">Busque e adicione insumos acima.</p>
                        </div>
                    )}

                    {/* Action bar */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2 flex-wrap">
                        <button onClick={() => generatePdfForManualList('download')} disabled={manualList.length === 0}
                            className="flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40 transition-all">
                            <FileDown size={12} /> PDF
                        </button>
                        <button onClick={() => generatePdfForManualList('print')} disabled={manualList.length === 0}
                            className="flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 transition-all">
                            <Printer size={12} /> Imprimir
                        </button>
                        <button onClick={handleShareManual} disabled={manualList.length === 0}
                            className="flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 disabled:opacity-40 transition-all">
                            <Share2 size={12} /> WhatsApp
                        </button>
                        <button onClick={handleClearManualList} disabled={manualList.length === 0}
                            className="flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 disabled:opacity-40 transition-all ml-auto">
                            <Trash2 size={12} /> Limpar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComprasPage;
