// components/AddItemModal.tsx
import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Scan, Tag, Sliders, Box, Zap, Package } from 'lucide-react';
import { StockItem, StockItemKind, GeneralSettings } from '../types';

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemType: StockItemKind;
    onConfirm: (item: Omit<StockItem, 'id'>, configureBom: boolean) => void;
    prefillData?: Partial<StockItem>;
    generalSettings: GeneralSettings;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, itemType, onConfirm, prefillData, generalSettings }) => {
    const initialState = {
        code: '',
        name: '',
        unit: 'un' as 'kg' | 'un' | 'm' | 'L',
        current_qty: 0,
        min_qty: 0,
        category: '',
        color: '',
        barcode: '',
        product_type: 'papel_de_parede' as 'papel_de_parede' | 'miudos',
        base_type: '' as string,
    };

    const [newItem, setNewItem] = useState(initialState);
    const [configureBom, setConfigureBom] = useState(false);
    const [isVolatileInfinite, setIsVolatileInfinite] = useState(false);
    const [tipoEstoque, setTipoEstoque] = useState<'PRODUTO_PRINCIPAL' | 'VOLATIL'>('PRODUTO_PRINCIPAL');
    const isProduct = itemType === 'PRODUTO';
    const isProcessado = itemType === 'PROCESSADO';

    useEffect(() => {
        if (isOpen) {
            let stateToSet = { ...initialState };
            if (prefillData) {
                stateToSet = { ...stateToSet, ...prefillData };
            }
            if (itemType === 'PRODUTO') {
                stateToSet = { ...stateToSet, current_qty: 0, min_qty: 0, unit: 'un' };
            }
            if (itemType === 'PROCESSADO') {
                stateToSet = { ...stateToSet, unit: 'kg' };
            }
            if (itemType === 'PRODUTO') {
                setTipoEstoque('PRODUTO_PRINCIPAL'); 
            }
            if (itemType === 'INSUMO' && generalSettings.insumoCategoryList.length > 0) {
                stateToSet.category = generalSettings.insumoCategoryList[0];
            }
            setNewItem(stateToSet);
            setConfigureBom(false);
        }
    }, [isOpen, itemType, prefillData, generalSettings]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (newItem.code.trim() && newItem.name.trim()) {
            const itemToConfirm: any = {
                ...newItem,
                kind: itemType,
                color: isProduct ? newItem.color : undefined,
                barcode: newItem.barcode || undefined,
                is_volatile_infinite: itemType === 'INSUMO' ? isVolatileInfinite : false,
                stockType: isProduct ? tipoEstoque : undefined,
            };

            if (itemType === 'INSUMO' || isProduct) {
                itemToConfirm.category = newItem.category || '';
            }

            onConfirm(itemToConfirm, configureBom);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (isProduct && (name === 'current_qty' || name === 'min_qty')) {
            return;
        }
        const isNumberField = name === 'current_qty' || name === 'min_qty';
        setNewItem(prev => ({
            ...prev,
            [name]: isNumberField ? Number(value) : value,
        }));
    };

    const isFormValid = newItem.code.trim() !== '' && newItem.name.trim() !== '' && !isNaN(newItem.min_qty) && newItem.min_qty >= 0;
    
    const getTitle = () => {
        switch (itemType) {
            case 'INSUMO': return 'Cadastrar Novo Insumo';
            case 'PROCESSADO': return 'Cadastrar Novo Material Processado';
            case 'PRODUTO': return `Cadastrar Novo ${generalSettings.productTypeNames.papel_de_parede}`;
            default: return 'Cadastrar Novo Item';
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black flex items-center uppercase tracking-tighter">
                        <PlusCircle className="mr-3 text-blue-600" size={28} />
                        {getTitle()}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Básico: Código e Nome */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código / SKU</label>
                            <input
                                name="code"
                                value={newItem.code}
                                onChange={handleInputChange}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-500 focus:bg-white outline-none transition-all uppercase"
                                placeholder={itemType === 'INSUMO' ? 'ex: COLA_BASE_KG' : 'ex: PPL-BRC-PREM'}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Item</label>
                            <input
                                name="name"
                                value={newItem.name}
                                onChange={handleInputChange}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-500 focus:bg-white outline-none transition-all"
                                placeholder={itemType === 'INSUMO' ? 'ex: Cola Base Adesiva' : 'ex: Papel de Parede Branco Premium'}
                            />
                        </div>
                    </div>

                    {/* Categorias e Bases */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {(isProduct || itemType === 'INSUMO') && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                                <div className="relative">
                                    <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <select
                                        name="category"
                                        value={newItem.category}
                                        onChange={handleInputChange}
                                        className="w-full pl-10 p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-500 focus:bg-white outline-none transition-all appearance-none"
                                    >
                                        <option value="">Sem Categoria</option>
                                        {(itemType === 'INSUMO' ? generalSettings.insumoCategoryList : generalSettings.productCategoryList).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {isProduct && newItem.product_type !== 'miudos' && (
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Base</label>
                                {(() => {
                                    const catConfig = generalSettings.productCategoryConfigs?.find(c => c.name === newItem.category);
                                    if (catConfig?.hasBase) {
                                        return (
                                            <>
                                                <select
                                                    name="base_type"
                                                    value={newItem.base_type === 'PERSONALIZADA' ? 'PERSONALIZADA' : (catConfig.baseNames?.includes(newItem.base_type) ? newItem.base_type : (newItem.base_type ? 'PERSONALIZADA' : ''))}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setNewItem(prev => ({ ...prev, base_type: val === 'PERSONALIZADA' ? '' : val }));
                                                    }}
                                                    className="w-full p-3 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-sm text-blue-700 outline-none transition-all"
                                                >
                                                    <option value="">Selecione a Base...</option>
                                                    {catConfig.baseNames?.map(base => (
                                                        <option key={base} value={base.toUpperCase()}>{base.toUpperCase()}</option>
                                                    ))}
                                                    <option value="PERSONALIZADA">+ Personalizada...</option>
                                                </select>
                                                {(!catConfig.baseNames?.includes(newItem.base_type) && newItem.base_type !== '' || newItem.base_type === '') && (
                                                    <div className="mt-2 animate-in slide-in-from-top-1">
                                                        <input 
                                                            type="text"
                                                            value={newItem.base_type}
                                                            onChange={(e) => setNewItem(prev => ({ ...prev, base_type: e.target.value.toUpperCase() }))}
                                                            placeholder="DIGITE O NOME DA BASE..."
                                                            className="w-full p-3 bg-white border-2 border-blue-200 rounded-2xl font-black text-xs text-blue-600 outline-none focus:border-blue-400 placeholder:text-blue-200"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        );
                                    }
                                    return (
                                        <div className="p-3 bg-slate-100 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase text-center border-dashed">
                                            Categoria sem bases
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {/* Especificidades de Produto */}
                    {isProduct && (
                        <div className="space-y-5 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Produto</label>
                                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                                        <button onClick={() => setNewItem({...newItem, product_type: 'papel_de_parede'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${newItem.product_type === 'papel_de_parede' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                                            <Box size={14}/> Papel
                                        </button>
                                        <button onClick={() => setNewItem({...newItem, product_type: 'miudos'})} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${newItem.product_type === 'miudos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
                                            <Box size={14} className="scale-75"/> Miúdos
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Principal</label>
                                    <input
                                        name="color"
                                        value={newItem.color}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:border-blue-500 outline-none transition-all uppercase"
                                        placeholder="EX: BRANCO"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Modelo de Controle</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTipoEstoque('PRODUTO_PRINCIPAL')}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${tipoEstoque === 'PRODUTO_PRINCIPAL' ? 'border-blue-500 bg-white shadow-lg shadow-blue-50' : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-blue-200'}`}
                                    >
                                        <p className="text-[10px] font-black text-blue-600 uppercase mb-0.5 flex items-center gap-1.5"><Package size={12}/> Tradicional</p>
                                        <p className="text-[8px] text-slate-500 leading-tight">Controlado por produção e receita</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTipoEstoque('VOLATIL')}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all ${tipoEstoque === 'VOLATIL' ? 'border-orange-500 bg-white shadow-lg shadow-orange-50' : 'border-slate-200 opacity-60 hover:opacity-100 hover:border-orange-200'}`}
                                    >
                                        <p className="text-[10px] font-black text-orange-600 uppercase mb-0.5 flex items-center gap-1.5"><Zap size={12}/> Volátil</p>
                                        <p className="text-[8px] text-slate-500 leading-tight">Lançamentos manuais diretos</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Lógica de Estoque e Unidade */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Unidade</label>
                            <select
                                name="unit"
                                value={newItem.unit}
                                onChange={handleInputChange}
                                disabled={isProduct || isProcessado}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm disabled:bg-slate-100 outline-none transition-all"
                            >
                                <option value="un">un</option>
                                <option value="kg">kg</option>
                                <option value="m">m</option>
                                <option value="L">L</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mínimo</label>
                            <input
                                name="min_qty"
                                type="number"
                                value={newItem.min_qty}
                                onChange={handleInputChange}
                                disabled={isProduct}
                                className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm disabled:bg-slate-100 outline-none transition-all"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Barras</label>
                            <div className="relative">
                                <Scan size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    name="barcode"
                                    value={newItem.barcode}
                                    onChange={(e) => setNewItem(prev => ({ ...prev, barcode: e.target.value.toUpperCase() }))}
                                    className="w-full pl-10 p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-500 focus:bg-white outline-none transition-all"
                                    placeholder="ESCANEAR EAN..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Flags Adicionais */}
                    <div className="space-y-3 pt-2">
                        {itemType === 'INSUMO' && (
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative w-10 h-6">
                                    <input type="checkbox" checked={isVolatileInfinite} onChange={e => setIsVolatileInfinite(e.target.checked)} className="sr-only peer" />
                                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">Estoque Infinito (Quantidade não diminui)</span>
                            </label>
                        )}
                        {(isProduct || isProcessado) && (
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative w-10 h-6">
                                    <input type="checkbox" checked={configureBom} onChange={e => setConfigureBom(e.target.checked)} className="sr-only peer" />
                                    <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </div>
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 transition-colors">Configurar Receita (BOM) após salvar</span>
                            </label>
                        )}
                    </div>
                </div>

                <div className="mt-10 flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!isFormValid}
                        className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                    >
                        SALVAR ITEM
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddItemModal;
