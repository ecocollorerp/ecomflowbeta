
import React, { useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Package, Search } from 'lucide-react';
import { StockItem, StockPackGroup } from '../types';

interface VolatilMovementModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: StockPackGroup;
    stockItems: StockItem[];
    onConfirm: (groupId: string, delta: number, ref: string, skuCode?: string) => Promise<void>;
    movementType: 'entrada' | 'saida';
}

const VolatilMovementModal: React.FC<VolatilMovementModalProps> = ({ isOpen, onClose, group, stockItems, onConfirm, movementType }) => {
    const [quantity, setQuantity] = useState(1);
    const [reference, setReference] = useState('');
    const [selectedSku, setSelectedSku] = useState('');
    const [skuSearch, setSkuSearch] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const isEntrada = movementType === 'entrada';

    // SKUs do grupo
    const groupSkus = stockItems.filter(i => group.item_codes.includes(i.code));

    // Busca de SKUs
    const filteredSkus = groupSkus.filter(s =>
        !skuSearch || s.name.toLowerCase().includes(skuSearch.toLowerCase()) || s.code.toLowerCase().includes(skuSearch.toLowerCase())
    );

    // Todos os SKUs disponíveis para adicionar (se grupo não tem SKUs vinculados)
    const allAvailableSkus = stockItems.filter(i =>
        i.kind === 'PRODUTO' && (!skuSearch || i.name.toLowerCase().includes(skuSearch.toLowerCase()) || i.code.toLowerCase().includes(skuSearch.toLowerCase()))
    );

    const displaySkus = groupSkus.length > 0 ? filteredSkus : allAvailableSkus.slice(0, 20);

    const handleSave = async () => {
        if (quantity <= 0) return;
        setIsSaving(true);
        try {
            const delta = isEntrada ? quantity : -quantity;
            await onConfirm(group.id, delta, reference, selectedSku || undefined);
            onClose();
            setQuantity(1);
            setReference('');
            setSelectedSku('');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className={`px-6 py-5 ${isEntrada ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            {isEntrada ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-wider">
                                    {isEntrada ? 'Entrada' : 'Saída'} — {group.name}
                                </h2>
                                <p className="text-sm opacity-80">
                                    Estoque atual: {group.quantidade_volatil || 0} UN
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    {/* Quantidade */}
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                            Quantidade
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                            className={`w-full text-3xl font-black text-center py-4 border-2 rounded-2xl focus:outline-none transition-all ${isEntrada
                                    ? 'border-emerald-300 focus:border-emerald-500 text-emerald-700 bg-emerald-50'
                                    : 'border-red-300 focus:border-red-500 text-red-700 bg-red-50'
                                }`}
                            autoFocus
                        />
                        {!isEntrada && quantity > (group.quantidade_volatil || 0) && (
                            <p className="text-xs text-red-500 mt-1 font-bold">
                                ⚠️ Quantidade maior que o estoque atual ({group.quantidade_volatil || 0})
                            </p>
                        )}
                    </div>

                    {/* SKU (opcional) */}
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                            SKU / Produto (opcional)
                        </label>
                        {selectedSku ? (
                            <div className="flex items-center justify-between p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                                <div>
                                    <p className="font-bold text-blue-800 text-sm">{selectedSku}</p>
                                    <p className="text-xs text-blue-500">
                                        {stockItems.find(s => s.code === selectedSku)?.name || ''}
                                    </p>
                                </div>
                                <button onClick={() => setSelectedSku('')} className="text-blue-400 hover:text-blue-600">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="relative mb-2">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Buscar SKU ou nome..."
                                        value={skuSearch}
                                        onChange={(e) => setSkuSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                                    />
                                </div>
                                {displaySkus.length > 0 && (
                                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-xl">
                                        {displaySkus.map(sku => (
                                            <button
                                                key={sku.id}
                                                onClick={() => { setSelectedSku(sku.code); setSkuSearch(''); }}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0 transition-all"
                                            >
                                                <span className="font-bold text-xs text-gray-800">{sku.code}</span>
                                                <span className="text-xs text-gray-500 ml-2">{sku.name}</span>
                                                <span className="text-xs text-gray-400 ml-2">({sku.current_qty} un)</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Referência */}
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                            Referência / Observação
                        </label>
                        <input
                            type="text"
                            placeholder="Ex: Produção lote #42, Venda cliente XYZ..."
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400"
                        />
                    </div>

                    {/* Preview */}
                    <div className={`p-4 rounded-2xl ${isEntrada ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-500 uppercase">Resultado</span>
                            <span className={`text-xl font-black ${isEntrada ? 'text-emerald-700' : 'text-red-700'}`}>
                                {(group.quantidade_volatil || 0)} → {Math.max(0, (group.quantidade_volatil || 0) + (isEntrada ? quantity : -quantity))} UN
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-black uppercase tracking-widest text-gray-600 hover:bg-gray-200 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || quantity <= 0}
                        className={`px-8 py-3 text-sm font-black uppercase tracking-widest text-white rounded-xl transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 ${isEntrada
                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                                : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                            }`}
                    >
                        {isEntrada ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                        {isSaving ? 'Salvando...' : `Confirmar ${isEntrada ? 'Entrada' : 'Saída'}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VolatilMovementModal;
