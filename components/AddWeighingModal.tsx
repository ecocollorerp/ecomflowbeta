import React, { useState, useEffect, useMemo } from 'react';
import { X, Weight, User as UserIcon, AlertTriangle, Check } from 'lucide-react';
import { StockItem, WeighingType, User, GeneralSettings } from '../types';

interface AddWeighingModalProps {
    isOpen: boolean;
    onClose: () => void;
    insumos: StockItem[];
    stockItems: StockItem[];
    onConfirm: (payload: {
        insumoCode: string; // SKU principal do lote (pode ser o do primeiro item)
        quantity: number;   // Qtd total ensacada
        type: WeighingType;
        userId: string;
        operador_maquina: string;
        operador_batedor: string;
        quantidade_batedor: number; // Qtd total batida
        com_cor: boolean;
        tipo_operacao: 'SO_BATEU' | 'SO_ENSACADEIRA' | 'BATEU_ENSACOU';
        equipe_mistura: string;
        destino: 'ESTOQUE_PRONTO' | 'PRODUCAO_DIA';
        base_sku: string;
        produtos: any[]; 
    }) => void;
    users: User[];
    currentUser: User;
    skuLinks?: any[];
    generalSettings: GeneralSettings;
}

const AddWeighingModal: React.FC<AddWeighingModalProps> = ({ isOpen, onClose, insumos, stockItems, onConfirm, users, currentUser, generalSettings }) => {
    const [selectedItemCode, setSelectedItemCode] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [weighingType, setWeighingType] = useState<WeighingType>('daily');
    const [selectedUserId, setSelectedUserId] = useState(''); // Compatibility for single selection if needed
    const [equipeEnsacamento, setEquipeEnsacamento] = useState<string[]>([]);
    const [equipeBatedor, setEquipeBatedor] = useState<string[]>([]);
    const [showStaffListEnsacamento, setShowStaffListEnsacamento] = useState(false);
    const [showStaffListBatedor, setShowStaffListBatedor] = useState(false);
    const [quantidadeBatedor, setQuantidadeBatedor] = useState(0);
    const [comCor, setComCor] = useState(false);
    const [tipoOperacao, setTipoOperacao] = useState<'SO_BATEU' | 'SO_ENSACADEIRA' | 'BATEU_ENSACOU'>('BATEU_ENSACOU');
    const [equipeMistura, setEquipeMistura] = useState('');
    const [destino, setDestino] = useState<'ESTOQUE_PRONTO' | 'PRODUCAO_DIA'>('PRODUCAO_DIA');
    const [produtosLote, setProdutosLote] = useState<Array<{sku: string, nome: string, qty_batida: number, qty_ensacada: number}>>([]);
    const [currentQtyBatida, setCurrentQtyBatida] = useState(0);
    const [currentQtyEnsacada, setCurrentQtyEnsacada] = useState(0);
    const [linkedBatchId, setLinkedBatchId] = useState('');
    
    // Novos estados para filtragem por setor
    const [selectedSectorEnsacamento, setSelectedSectorEnsacamento] = useState('');
    const [selectedSectorBatedor, setSelectedSectorBatedor] = useState('');

    const sectorDisplayName = 'Máquinas';

    useEffect(() => {
        if (isOpen) {
            setSelectedItemCode(insumos.length > 0 ? insumos[0].code : '');
            setQuantity(1);
            setWeighingType('daily');
            setQuantidadeBatedor(0);
            setComCor(false);
            setTipoOperacao('BATEU_ENSACOU');
            setEquipeMistura('');
            setDestino('PRODUCAO_DIA');
            setProdutosLote([]);
            setCurrentQtyBatida(1);
            setCurrentQtyEnsacada(1);
            setLinkedBatchId('');
        }
    }, [isOpen, insumos, users, currentUser]);

    // Filtragem dinâmica de usuários por setor selecionado
    const filteredUsersEnsacamento = useMemo(() => {
        if (!selectedSectorEnsacamento) return [];
        return users.filter(u => Array.isArray(u.setor) && u.setor.includes(selectedSectorEnsacamento));
    }, [users, selectedSectorEnsacamento]);

    const filteredUsersBatedor = useMemo(() => {
        if (!selectedSectorBatedor) return [];
        return users.filter(u => Array.isArray(u.setor) && u.setor.includes(selectedSectorBatedor));
    }, [users, selectedSectorBatedor]);

    const handleAddProduto = () => {
        if (!selectedItemCode) return;
        const item = availableItems.find(i => i.code === selectedItemCode);
        if (!item) return;

        setProdutosLote(prev => [...prev, {
            sku: selectedItemCode,
            nome: item.name,
            qty_batida: currentQtyBatida,
            qty_ensacada: currentQtyEnsacada
        }]);
        
        // Reset local item inputs
        setCurrentQtyBatida(1);
        setCurrentQtyEnsacada(1);
    };

    const handleRemoveProduto = (index: number) => {
        setProdutosLote(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        if (produtosLote.length === 0) return;

        const totalBatida = produtosLote.reduce((sum, p) => sum + p.qty_batida, 0);
        const totalEnsacada = produtosLote.reduce((sum, p) => sum + p.qty_ensacada, 0);

        onConfirm({
            insumoCode: produtosLote[0].sku,
            quantity: totalEnsacada,
            type: weighingType,
            userId: currentUser.id,
            operador_maquina: tipoOperacao === 'SO_BATEU' ? '' : equipeEnsacamento.join(', '),
            operador_batedor: tipoOperacao === 'SO_ENSACADEIRA' ? '' : equipeBatedor.join(', '),
            quantidade_batedor: totalBatida,
            com_cor: comCor,
            tipo_operacao: tipoOperacao,
            equipe_mistura: equipeMistura,
            destino: destino,
            base_sku: linkedBatchId, // Usando linkedBatchId como referência se houver
            produtos: produtosLote
        });
    };

    const availableItems = useMemo(() => {
        if (tipoOperacao === 'SO_ENSACADEIRA') {
            return stockItems.filter(i => (i.mixed_qty || 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
        }
        if (comCor) {
            // "Com Cor" should show the Final Products that are produced by mixing
            return stockItems.filter(i => i.kind === 'PRODUTO' || i.kind === 'PROCESSADO').sort((a, b) => a.name.localeCompare(b.name));
        }
        return insumos.sort((a,b) => a.name.localeCompare(b.name));
    }, [stockItems, insumos, comCor, tipoOperacao]);

    const itemDetails = useMemo(() => availableItems.find(i => i.code === selectedItemCode), [availableItems, selectedItemCode]);
    
    const substituteItemDetails = useMemo(() => {
        if (!itemDetails || !itemDetails.substitute_product_code) return null;
        return stockItems.find(i => i.code === itemDetails.substitute_product_code);
    }, [itemDetails, stockItems]);

    const combinedStock = useMemo(() => {
        const base = (itemDetails?.current_qty || 0);
        const sub = (substituteItemDetails?.current_qty || 0);
        return base + sub;
    }, [itemDetails, substituteItemDetails]);

    // Lógica de Composição / BOM
    const resolveComposition = (item: StockItem, qty: number): Record<string, {name: string, qty: number}> => {
        const composition: Record<string, {name: string, qty: number}> = {};
        
        if (item.bom_composition?.items && item.bom_composition.items.length > 0) {
            item.bom_composition.items.forEach(comp => {
                const compCode = comp.stockItemCode || comp.code || '';
                if (!compCode) return;
                
                const factor = comp.qty || 0;
                const totalCompQty = qty * factor;
                
                // Recursivamente busca se o componente também tem composição (ex: Neutro Base)
                const nestedItem = stockItems.find(i => i.code === compCode);
                if (nestedItem && nestedItem.bom_composition?.items && nestedItem.bom_composition.items.length > 0) {
                    const nested = resolveComposition(nestedItem, totalCompQty);
                    Object.entries(nested).forEach(([code, data]) => {
                        if (composition[code]) composition[code].qty += data.qty;
                        else composition[code] = data;
                    });
                } else {
                    if (composition[compCode]) composition[compCode].qty += totalCompQty;
                    else composition[compCode] = { name: comp.name || nestedItem?.name || compCode, qty: totalCompQty };
                }
            });
        } else {
            // Se não tem composição, ele mesmo é o insumo base
            composition[item.code] = { name: item.name, qty: qty };
        }
        
        return composition;
    };

    const totalMaterials = useMemo(() => {
        const totals: Record<string, {name: string, qty: number}> = {};
        
        produtosLote.forEach(p => {
            const item = stockItems.find(i => i.code === p.sku) || insumos.find(i => i.code === p.sku);
            if (!item) return;
            
            const comp = resolveComposition(item, p.qty_batida);
            Object.entries(comp).forEach(([code, data]) => {
                if (totals[code]) totals[code].qty += data.qty;
                else totals[code] = data;
            });
        });
        
        return Object.entries(totals).sort((a, b) => b[1].qty - a[1].qty);
    }, [produtosLote, stockItems, insumos]);

    const currentItemComposition = useMemo(() => {
        if (!itemDetails) return [];
        return Object.entries(resolveComposition(itemDetails, currentQtyBatida || 1)).sort((a, b) => b[1].qty - a[1].qty);
    }, [itemDetails, currentQtyBatida]);

    // Reset selection when comCor or tipoOperacao toggles
    useEffect(() => {
        if (availableItems.length > 0) {
            setSelectedItemCode(availableItems[0].code);
        } else {
            setSelectedItemCode('');
        }
    }, [comCor, tipoOperacao, availableItems]);

    // Automate Mode based on Destination
    useEffect(() => {
        if (destino === 'ESTOQUE_PRONTO') {
            setTipoOperacao('BATEU_ENSACOU');
        }
    }, [destino]);

    const isFormValid = !!itemDetails && quantity > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col border border-slate-100">
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 flex items-center uppercase tracking-tighter">
                            <Weight className="mr-3 text-violet-600 bg-violet-100 p-3 rounded-2xl" size={48} />
                            Painel de Produção (Máquinas)
                        </h2>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Configuração de Lotes, Mistura e Ensacamento</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors"><X size={32} className="text-slate-300" /></button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* ── Coluna Esquerda: Configuração Geral ── */}
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">1. Modo e Equipamentos</h3>
                                
                                <div className="grid grid-cols-3 gap-2 p-1 bg-white rounded-2xl border border-slate-200">
                                    {['SO_BATEU', 'SO_ENSACADEIRA', 'BATEU_ENSACOU'].map((mode) => (
                                        <button 
                                            key={mode}
                                            disabled={destino === 'ESTOQUE_PRONTO' && mode !== 'BATEU_ENSACOU'}
                                            onClick={() => setTipoOperacao(mode as any)}
                                            className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${tipoOperacao === mode ? 'bg-violet-600 text-white shadow-lg shadow-violet-100' : 'text-slate-400 hover:bg-slate-50 disabled:opacity-20'}`}
                                        >
                                            {mode === 'SO_BATEU' ? 'Batedor' : mode === 'SO_ENSACADEIRA' ? 'Ensacadeira' : 'Ambos'}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    {(tipoOperacao === 'BATEU_ENSACOU' || tipoOperacao === 'SO_ENSACADEIRA') && (
                                        <div className="relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5 px-1">
                                                <span className="flex items-center"><UserIcon size={12} className="mr-1.5" /> Equipe {sectorDisplayName}</span>
                                                <button onClick={() => setShowStaffListEnsacamento(!showStaffListEnsacamento)} className="w-6 h-6 flex items-center justify-center bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-colors">+</button>
                                            </label>
                                            <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-slate-200 min-h-[48px]">
                                                {equipeEnsacamento.length === 0 && <span className="text-xs text-slate-400 italic font-bold">Ninguém selecionado</span>}
                                                {equipeEnsacamento.map(name => (
                                                    <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                        {name}
                                                        <button onClick={() => setEquipeEnsacamento(prev => prev.filter(n => n !== name))} className="hover:text-violet-200"><X size={12} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            {showStaffListEnsacamento && (
                                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 max-h-56 overflow-y-auto p-2 space-y-1">
                                                    <div className="flex flex-col gap-2 px-3 py-2 border-b border-slate-50 mb-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">1. Selecionar Setor</span>
                                                        <select 
                                                            value={selectedSectorEnsacamento} 
                                                            onChange={e => setSelectedSectorEnsacamento(e.target.value)}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                                                        >
                                                            <option value="">Escolha um setor...</option>
                                                            {generalSettings.customSectors.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    {selectedSectorEnsacamento && (
                                                        <>
                                                            <div className="px-3 py-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase">2. Selecionar Pessoas</span>
                                                            </div>
                                                            {filteredUsersEnsacamento.length > 0 ? filteredUsersEnsacamento.map(u => {
                                                                const isSelected = equipeEnsacamento.includes(u.name);
                                                                return (
                                                                    <button 
                                                                        key={u.id} 
                                                                        onClick={() => { 
                                                                            if (isSelected) setEquipeEnsacamento(prev => prev.filter(n => n !== u.name));
                                                                            else setEquipeEnsacamento(prev => [...prev, u.name]);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors rounded-lg flex justify-between items-center ${isSelected ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                    >
                                                                        {u.name}
                                                                        {isSelected && <Check size={14} />}
                                                                    </button>
                                                                );
                                                            }) : (
                                                                <p className="text-[10px] text-slate-400 italic px-3 py-2">Nenhum funcionário neste setor.</p>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex justify-end p-1">
                                                        <button onClick={() => setShowStaffListEnsacamento(false)} className="text-violet-600 hover:text-violet-700 font-bold text-[10px] uppercase p-2">Pronto</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {(tipoOperacao === 'BATEU_ENSACOU' || tipoOperacao === 'SO_BATEU') && (
                                        <div className="relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between mb-1.5 px-1">
                                                <span className="flex items-center"><UserIcon size={12} className="mr-1.5" /> Equipe Batedor</span>
                                                <button onClick={() => setShowStaffListBatedor(!showStaffListBatedor)} className="w-6 h-6 flex items-center justify-center bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-colors">+</button>
                                            </label>
                                            <div className="flex flex-wrap gap-2 p-3 bg-white rounded-xl border border-slate-200 min-h-[48px]">
                                                {equipeBatedor.length === 0 && <span className="text-xs text-slate-400 italic font-bold">Ninguém selecionado</span>}
                                                {equipeBatedor.map(name => (
                                                    <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider">
                                                        {name}
                                                        <button onClick={() => setEquipeBatedor(prev => prev.filter(n => n !== name))} className="hover:text-violet-200"><X size={12} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            {showStaffListBatedor && (
                                                <div className="absolute top-full left-0 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 max-h-56 overflow-y-auto p-2 space-y-1">
                                                    <div className="flex flex-col gap-2 px-3 py-2 border-b border-slate-50 mb-1">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">1. Selecionar Setor</span>
                                                        <select 
                                                            value={selectedSectorBatedor} 
                                                            onChange={e => setSelectedSectorBatedor(e.target.value)}
                                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                                                        >
                                                            <option value="">Escolha um setor...</option>
                                                            {generalSettings.customSectors.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    
                                                    {selectedSectorBatedor && (
                                                        <>
                                                            <div className="px-3 py-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase">2. Selecionar Pessoas</span>
                                                            </div>
                                                            {filteredUsersBatedor.length > 0 ? filteredUsersBatedor.map(u => {
                                                                const isSelected = equipeBatedor.includes(u.name);
                                                                return (
                                                                    <button 
                                                                        key={u.id} 
                                                                        onClick={() => { 
                                                                            if (isSelected) setEquipeBatedor(prev => prev.filter(n => n !== u.name));
                                                                            else setEquipeBatedor(prev => [...prev, u.name]);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors rounded-lg flex justify-between items-center ${isSelected ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                    >
                                                                        {u.name}
                                                                        {isSelected && <Check size={14} />}
                                                                    </button>
                                                                );
                                                            }) : (
                                                                <p className="text-[10px] text-slate-400 italic px-3 py-2">Nenhum funcionário neste setor.</p>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex justify-end p-1">
                                                        <button onClick={() => setShowStaffListBatedor(false)} className="text-violet-600 hover:text-violet-700 font-bold text-[10px] uppercase p-2">Pronto</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Coluna Direita: Seleção de Itens e Resumo ── */}
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">2. Adicionar Itens</h3>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <div className={`w-10 h-5 rounded-full transition-all relative ${comCor ? 'bg-violet-600' : 'bg-slate-300'}`} onClick={() => setComCor(!comCor)}>
                                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${comCor ? 'left-5.5' : 'left-0.5'}`} />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Possui Cor/Pigmento?</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Selecione o Produto</label>
                                            <select
                                                value={selectedItemCode}
                                                onChange={(e) => setSelectedItemCode(e.target.value)}
                                                className="block w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-black text-sm text-slate-700 focus:ring-4 focus:ring-violet-500/10 transition-all font-mono shadow-sm"
                                            >
                                                {availableItems.length === 0 && <option value="" disabled>Nenhum disponível</option>}
                                                {availableItems.map(i => (
                                                    <option key={i.id} value={i.code}>[{i.code}] {i.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Qtd. Mistura (kg)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={currentQtyBatida}
                                                    onChange={(e) => setCurrentQtyBatida(Number(e.target.value))}
                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-lg text-slate-800 shadow-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Qtd. Pronta (kg)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={currentQtyEnsacada}
                                                    onChange={(e) => setCurrentQtyEnsacada(Number(e.target.value))}
                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-lg text-slate-800 shadow-sm focus:ring-2 focus:ring-violet-500 outline-none"
                                                />
                                            </div>
                                        </div>

                                        {tipoOperacao === 'SO_ENSACADEIRA' && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vincular a Lote de Mistura Existente</label>
                                                <select
                                                    value={linkedBatchId}
                                                    onChange={e => setLinkedBatchId(e.target.value)}
                                                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-xs text-slate-700 shadow-sm"
                                                >
                                                    <option value="">Lote não especificado (Manual)...</option>
                                                    {availableItems.find(i => i.code === selectedItemCode)?.mixed_qty && (
                                                        <option value="AUTO">Automático (Puxar do Saldo de Mistura)</option>
                                                    )}
                                                </select>
                                            </div>
                                        )}

                                        <button 
                                            onClick={handleAddProduto}
                                            disabled={!selectedItemCode || (currentQtyBatida <= 0 && currentQtyEnsacada <= 0)}
                                            className="w-full py-4 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-violet-700 transition-all shadow-xl shadow-violet-100 disabled:opacity-30 flex items-center justify-center gap-2"
                                        >
                                            <Check size={18} /> Adicionar ao Lote Atual
                                        </button>

                                        {currentItemComposition.length > 0 && (
                                            <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-2 shadow-sm">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Materiais Necessários ({currentQtyBatida}kg)</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {currentItemComposition.map(([code, data]) => (
                                                        <div key={code} className="flex justify-between items-center text-[10px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                                                            <span className="truncate pr-2">{data.name}</span>
                                                            <span className="text-violet-600 shrink-0">{data.qty.toFixed(2)}kg</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-slate-100 space-y-4 shadow-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">3. Resumo da Carga</h3>
                                    <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black">{produtosLote.length} itens</span>
                                </div>
                                
                                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                    {produtosLote.length === 0 ? (
                                        <div className="py-12 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                                            <p className="text-xs font-bold text-slate-300 uppercase italic">Nenhum item adicionado à carga ainda</p>
                                        </div>
                                    ) : produtosLote.map((p, idx) => (
                                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4 group">
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-700 uppercase tracking-tight">{p.nome}</p>
                                                <div className="flex gap-3 mt-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-400 underline">MISTURA</span>
                                                        <span className="text-sm font-black text-blue-600">{p.qty_batida.toFixed(1)}kg</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-400 underline">PRONTO</span>
                                                        <span className="text-sm font-black text-violet-600">{p.qty_ensacada.toFixed(1)}kg</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveProduto(idx)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                                <X size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {totalMaterials.length > 0 && (
                                    <div className="pt-4 border-t border-slate-100 space-y-3">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de Insumos (Lote Inteiro)</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {totalMaterials.map(([code, data]) => (
                                                <div key={code} className="flex justify-between items-center p-3 bg-violet-50 rounded-xl border border-violet-100 group hover:bg-violet-100 transition-all">
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate pr-4">{data.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-violet-700">{data.qty.toFixed(2)}</span>
                                                        <span className="text-[8px] font-bold text-violet-400">KG</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Total Geral</p>
                                        <p className="text-2xl font-black text-slate-800">{produtosLote.reduce((s,p) => s + p.qty_ensacada, 0).toFixed(1)} <span className="text-sm text-slate-400">kg</span></p>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destino</label>
                                        <select 
                                            value={destino} 
                                            onChange={e => setDestino(e.target.value as any)}
                                            className="bg-slate-100 border-none rounded-xl font-black text-[10px] text-slate-600 py-2 px-3 focus:ring-2 focus:ring-violet-500 uppercase"
                                        >
                                            <option value="PRODUCAO_DIA">Produção do Dia</option>
                                            <option value="ESTOQUE_PRONTO">Estoque Pronto</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex gap-4 flex-shrink-0">
                    <button onClick={onClose} className="px-8 py-4 bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-slate-100 transition-all border border-slate-200">Descartar Lote</button>
                    <button 
                        onClick={handleConfirm} 
                        disabled={produtosLote.length === 0 || (tipoOperacao === 'BATEU_ENSACOU' && (equipeEnsacamento.length === 0 || equipeBatedor.length === 0)) || (tipoOperacao === 'SO_BATEU' && equipeBatedor.length === 0) || (tipoOperacao === 'SO_ENSACADEIRA' && equipeEnsacamento.length === 0)} 
                        className="flex-1 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-2xl shadow-violet-200 disabled:opacity-20 disabled:shadow-none"
                    >
                        Finalizar Lançamento de Máquinas
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddWeighingModal;