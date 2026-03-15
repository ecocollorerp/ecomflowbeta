
import React, { useMemo, useState } from 'react';
import { X, Box, AlertTriangle, CheckCircle2, ArrowRight, Settings, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { StockItem, StockPackGroup } from '../types';
import { dbClient } from '../lib/supabaseClient';
import VolatilMovementModal from './VolatilMovementModal';

interface PackGroupDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: StockPackGroup | null;
    stockItems: StockItem[];
    onEdit: (group: StockPackGroup) => void;
    onRefresh?: () => void;
}

const PackGroupDetailModal: React.FC<PackGroupDetailModalProps> = ({ isOpen, onClose, group, stockItems, onEdit, onRefresh }) => {
    const [movementModal, setMovementModal] = useState<'entrada' | 'saida' | null>(null);

    const handleMovement = async (groupId: string, delta: number, ref: string, skuCode?: string) => {
        if (!group) return;
        const newQty = Math.max(0, (group.quantidade_volatil || 0) + delta);

        // 1. Atualiza o saldo global do grupo
        await dbClient.from('stock_pack_groups').update({ quantidade_volatil: newQty }).eq('id', groupId);

        // 2. Registra a movimentação do pacote
        await dbClient.from('stock_movements').insert({
            stock_item_code: `PACK:${group.name}`,
            movement_type: delta > 0 ? 'ENTRADA' : 'SAIDA',
            product_sku: skuCode || null,
            quantity: Math.abs(delta),
            reference: ref || (delta > 0 ? 'Entrada manual volátil' : 'Saída manual volátil'),
            previous_qty: group.quantidade_volatil || 0,
            new_qty: newQty,
        });

        // 3. Sincroniza o saldo do SKU individual envolvido
        if (skuCode) {
            const item = stockItems.find(i => i.code === skuCode);
            if (item) {
                const itemNewQty = Math.max(0, (item.current_qty || 0) + delta);
                await dbClient.from('stock_items').update({ current_qty: itemNewQty }).eq('code', skuCode);

                // Registra o log individual para o SKU
                await dbClient.from('stock_movements').insert({
                    stock_item_code: skuCode,
                    movement_type: delta > 0 ? 'ENTRADA' : 'SAIDA',
                    quantity: Math.abs(delta),
                    reference: `Sincronização via Pacote: ${group.name}${ref ? ' - ' + ref : ''}`,
                    previous_qty: item.current_qty || 0,
                    new_qty: itemNewQty,
                });
            }
        }

        if (onRefresh) onRefresh();
    };

    const items = useMemo(() => {
        if (!group?.item_codes) return [];
        return group.item_codes.map(code => {
            const item = stockItems.find(i => i.code.toUpperCase() === code.toUpperCase());
            const currentStock = item?.current_qty || 0;
            // A disponibilidade é baseada na meta do pacote ou no mínimo individual
            const target = group.min_pack_qty || item?.min_qty || 1;
            const percentage = Math.min(100, (currentStock / target) * 100);

            return {
                code,
                name: item?.name || 'Item não encontrado',
                currentStock,
                percentage,
                isLow: currentStock < target
            };
        }).sort((a, b) => a.percentage - b.percentage); // Itens críticos primeiro
    }, [group, stockItems]);

    if (!isOpen || !group) return null;

    const groupTotal = items.reduce((sum, i) => sum + i.currentStock, 0);
    const overallPercentage = Math.min(100, (groupTotal / (group.min_pack_qty || 1)) * 100);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b flex justify-between items-start bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <Box className="text-blue-600" />
                            {group.name}
                        </h2>
                        <div className="flex gap-2 mt-1">
                            {group.barcode && <span className="text-[10px] font-mono font-bold bg-white border px-2 py-0.5 rounded text-slate-500 uppercase">{group.barcode}</span>}
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{group.tipo === 'volatil' ? 'ESTOQUE VOLÁTIL' : 'Visualização Padrão'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {group.tipo === 'volatil' && (
                            <>
                                <button onClick={() => setMovementModal('entrada')} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs font-black uppercase tracking-widest transition-all"><ArrowDownCircle size={14} /> + ENTRADA</button>
                                <button onClick={() => setMovementModal('saida')} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-black uppercase tracking-widest transition-all"><ArrowUpCircle size={14} /> - SAÍDA</button>
                            </>
                        )}
                        <button onClick={onClose} className="p-2 bg-white rounded-full border shadow-sm hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Resumo Geral */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-[9px] font-black text-blue-400 uppercase mb-1">{group.tipo === 'volatil' ? 'Estoque Lançado (Pronto)' : 'Estoque Total'}</p>
                            <p className="text-3xl font-black text-blue-700">{group.tipo === 'volatil' ? (group.quantidade_volatil || 0).toFixed(0) : groupTotal.toFixed(0)} <span className="text-xs">UN</span></p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Meta de Estoque</p>
                            <p className="text-3xl font-black text-slate-700">{group.min_pack_qty} <span className="text-xs">UN</span></p>
                        </div>
                    </div>

                    {/* Barra de Progresso Geral */}
                    <div>
                        <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                            <span className="text-slate-400">Capacidade de Produção</span>
                            <span className={overallPercentage < 100 ? 'text-orange-500' : 'text-emerald-500'}>{overallPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border">
                            <div className={`h-full transition-all duration-1000 ${overallPercentage < 50 ? 'bg-red-500' : overallPercentage < 100 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${overallPercentage}%` }} />
                        </div>
                    </div>

                    {/* Lista de Itens Individuais */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b pb-2">Composição do Pacote ({items.length} Itens)</p>
                        <div className="max-h-60 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                            {items.map(item => (
                                <div key={item.code} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center justify-between group hover:border-blue-200 transition-all">
                                    <div className="flex-1">
                                        <p className="text-xs font-black text-slate-700 uppercase truncate">{item.name}</p>
                                        <p className="text-[9px] font-mono text-slate-400">{item.code}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className={`text-sm font-black ${item.isLow ? 'text-red-500' : 'text-slate-700'}`}>{item.currentStock.toFixed(0)} <span className="text-[9px]">UN</span></p>
                                            <div className="w-20 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                <div className={`h-full ${item.percentage < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${item.percentage}%` }} />
                                            </div>
                                        </div>
                                        {item.isLow ? <AlertTriangle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                    <button
                        onClick={() => onEdit(group)}
                        className="flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest"
                    >
                        <Settings size={16} /> Configurar Itens
                    </button>
                    <button
                        onClick={onClose}
                        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>

            {movementModal && (
                <VolatilMovementModal
                    isOpen={true}
                    onClose={() => setMovementModal(null)}
                    group={group}
                    stockItems={stockItems}
                    onConfirm={handleMovement}
                    movementType={movementModal}
                />
            )}
        </div>
    );
};

export default PackGroupDetailModal;
