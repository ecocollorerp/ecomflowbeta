import React, { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Package, Search } from 'lucide-react';
import { StockItem, StockPackGroup } from '../types';

interface VolatilMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: StockPackGroup;
    stockItems: StockItem[];
    onConfirmAll: (groupId: string, entries: { skuCode: string, delta: number }[], ref: string) => Promise<void>;
    movementType: 'entrada' | 'saida';
}

const VolatilMovementModal: React.FC<VolatilMovementModalProps> = ({ isOpen, onClose, group, stockItems, onConfirmAll, movementType }) => {
    const isEntrada = movementType === 'entrada';
    const [reference, setReference] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Estado dos inputs de cada SKU do grupo { [skuCode]: { packCount: number, packSize: number } }
    const [inputs, setInputs] = useState<Record<string, { packCount: number, packSize: number }>>({});

    const handleInputChange = (skuCode: string, field: 'packCount' | 'packSize', val: number) => {
        setInputs(prev => {
            const current = prev[skuCode] || { packCount: 0, packSize: 1 };
            return {
                ...prev,
                [skuCode]: {
                    ...current,
                    [field]: val
                }
            };
        });
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const movementEntries = Object.entries(inputs)
                .map(([skuCode, data]: [string, any]) => ({
                    skuCode,
                    delta: isEntrada ? (data.packCount * data.packSize) : -(data.packCount * data.packSize)
                }))
                .filter(m => Math.abs(m.delta) > 0);

            if (movementEntries.length > 0) {
                await onConfirmAll(group.id, movementEntries, reference);
            }
            onClose();
            setInputs({});
            setReference('');
        } finally {
            setIsSaving(false);
        }
    };

    const totalToChange = Object.values(inputs).reduce((sum: number, data: any) => sum + (data.packCount * data.packSize), 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 md:p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[95vw] overflow-hidden flex flex-col h-[95vh] md:h-[90vh]">
                {/* Header */}
                <div className={`px-6 py-5 ${isEntrada ? 'bg-emerald-600' : 'bg-red-600'} text-white shrink-0`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {isEntrada ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-wider">
                                    {isEntrada ? 'Entrada' : 'Saída'} — {group.name}
                                </h2>
                                <p className="text-sm opacity-80">
                                    Estoque atual do Grupo: {group.quantidade_volatil || 0} UN
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1">

                    <div className="flex items-center justify-between text-xs font-black text-gray-400 tracking-widest uppercase mb-1">
                        <span>SKUs do Grupo ({group.item_codes?.length || 0})</span>
                        <span>Preencha as Quantidades</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {stockItems
                            .filter(s => group.item_codes?.some(c => c.toUpperCase() === s.code.toUpperCase()))
                            .map(item => {
                                const state = inputs[item.code] || { packCount: 0, packSize: 1 };
                                const itemTotal = state.packCount * state.packSize;

                                return (
                                    <div key={item.id} className={`p-4 rounded-xl border-2 transition-all ${itemTotal > 0 ? (isEntrada ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-gray-100 bg-white'}`}>
                                        <div className="mb-3 flex justify-between items-start">
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 uppercase leading-tight">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.code}</p>
                                                    <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase border border-blue-100">
                                                        Saldo: {item.current_qty} UN
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-gray-400 uppercase">Saldo Atual</p>
                                                <p className="text-xs font-black text-gray-700">{item.current_qty} UN</p>
                                                {!isEntrada && (
                                                    <p className="text-[9px] font-black text-blue-500 mt-0.5">Máx saída: {Math.floor(item.current_qty || 0)} UN</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Pacotes</label>
                                                <input
                                                    type="number" min={0} value={state.packCount}
                                                    onChange={(e) => handleInputChange(item.code, 'packCount', Math.max(0, Number(e.target.value)))}
                                                    className={`w-full text-center py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 font-bold ${itemTotal > 0 ? (isEntrada ? 'border-emerald-200 focus:ring-emerald-500' : 'border-red-200 focus:ring-red-500') : 'border-gray-200 focus:border-gray-300'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 block">Unidades / Pacote</label>
                                                <input
                                                    type="number" min={1} value={state.packSize}
                                                    onChange={(e) => handleInputChange(item.code, 'packSize', Math.max(1, Number(e.target.value)))}
                                                    className={`w-full text-center py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 font-bold ${itemTotal > 0 ? (isEntrada ? 'border-emerald-200 focus:ring-emerald-500' : 'border-red-200 focus:ring-red-500') : 'border-gray-200 focus:border-gray-300'}`}
                                                />
                                            </div>
                                        </div>

                                        {itemTotal > 0 && (
                                            <div className="mt-4 flex justify-between items-center p-2 bg-white rounded-lg border border-dashed">
                                                {!isEntrada && itemTotal > (item.current_qty || 0) && (
                                                    <span className="text-[10px] font-black text-red-500 animate-pulse">⚠️ SALDO INSUFICIENTE</span>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-gray-400 uppercase">Subtotal SKU</span>
                                                    <span className={`text-sm font-black uppercase tracking-widest ${isEntrada ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {isEntrada ? '+' : '-'} {itemTotal} UN
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        {(!group.item_codes || group.item_codes.length === 0) && (
                            <p className="col-span-full text-sm text-gray-500 italic text-center py-4 border-2 border-dashed rounded-xl">Nenhum SKU principal vinculado a este pacote.</p>
                        )}
                    </div>

                    {!isEntrada && totalToChange > (group.quantidade_volatil || 0) && (
                        <p className="text-xs text-red-500 font-bold text-center bg-red-100 p-2 rounded-lg">
                            ⚠️ A quantidade total de saída ({totalToChange}) é maior que o estoque atual ({group.quantidade_volatil || 0})
                        </p>
                    )}

                    {/* Referência */}
                    <div className="pt-2 border-t">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                            Referência / Observação (Geral)
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Fabricação própria, Ajuste inventário..."
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                        />
                    </div>

                    {/* Preview Global */}
                    <div className={`p-4 rounded-2xl border-2 ${isEntrada ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saldo do Grupo Após Operação</span>
                                <span className="text-[9px] font-bold text-gray-400 capitalize opacity-70">({group.name})</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-2xl font-black ${isEntrada ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {(group.quantidade_volatil || 0)} → {Math.max(0, (group.quantidade_volatil || 0) + (isEntrada ? totalToChange : -totalToChange))} UN
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving || totalToChange === 0}
                        className={`px-8 py-3 text-sm font-black uppercase tracking-widest text-white rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${isEntrada
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                            : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                            }`}
                    >
                        {isEntrada ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                        {isSaving ? 'Salvando...' : `Confirmar Tudo (${totalToChange} UN)`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VolatilMovementModal;
