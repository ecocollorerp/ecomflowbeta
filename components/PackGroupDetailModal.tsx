
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { X, Box, AlertTriangle, CheckCircle2, ArrowRight, Settings, ArrowDownCircle, ArrowUpCircle, History } from 'lucide-react';
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
    const [movements, setMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(false);

    const loadMovements = useCallback(async () => {
        if (!group) return;
        setLoadingMovements(true);
        try {
            const packCode = `PACK:${group.name}`;
            const { data } = await dbClient
                .from('stock_movements')
                .select('*')
                .eq('stock_item_code', packCode)
                .order('created_at', { ascending: false })
                .limit(30);
            setMovements(data || []);
        } catch (e) {
            console.error('Erro ao carregar movimentações:', e);
        } finally {
            setLoadingMovements(false);
        }
    }, [group]);

    useEffect(() => {
        if (isOpen && group) loadMovements();
    }, [isOpen, group, loadMovements]);

    const handleMovement = async (groupId: string, delta: number, ref: string, skuCode?: string) => {
        if (!group) return;

        // 1. Buscar saldo ATUALIZADO do grupo direto do banco
        const { data: freshGroup } = await dbClient.from('stock_pack_groups').select('quantidade_volatil').eq('id', groupId).single();
        const currentVolatil = freshGroup?.quantidade_volatil || group.quantidade_volatil || 0;
        const newQty = Math.max(0, currentVolatil + delta);

        // 2. Atualiza o saldo global do grupo
        await dbClient.from('stock_pack_groups').update({ quantidade_volatil: newQty }).eq('id', groupId);

        // 3. Registra a movimentação do pacote (colunas corretas de stock_movements)
        const skuItem = skuCode ? stockItems.find(i => i.code === skuCode) : null;
        await dbClient.from('stock_movements').insert({
            stock_item_code: `PACK:${group.name}`,
            stock_item_name: group.name,
            origin: delta > 0 ? 'ENTRADA_PACOTE' : 'SAIDA_PACOTE',
            qty_delta: delta,
            ref: ref || (delta > 0 ? 'Entrada manual volátil' : 'Saída manual volátil'),
            product_sku: skuCode || null,
            created_by_name: 'Sistema',
        });

        // 4. Sincroniza o saldo do SKU individual envolvido (busca saldo fresco do banco)
        if (skuCode) {
            const { data: freshItem } = await dbClient.from('stock_items').select('current_qty, name').eq('code', skuCode).single();
            if (freshItem) {
                const itemNewQty = Math.max(0, (freshItem.current_qty || 0) + delta);
                await dbClient.from('stock_items').update({ current_qty: itemNewQty }).eq('code', skuCode);

                // Registra o log individual para o SKU
                await dbClient.from('stock_movements').insert({
                    stock_item_code: skuCode,
                    stock_item_name: freshItem.name || skuCode,
                    origin: delta > 0 ? 'ENTRADA_PACOTE' : 'SAIDA_PACOTE',
                    qty_delta: delta,
                    ref: `Pacote: ${group.name}${ref ? ' - ' + ref : ''}`,
                    created_by_name: 'Sistema',
                });
            } else {
                // Item não existe em stock_items — busca info do BOM e cria
                const item = stockItems.find(i => i.code.toUpperCase() === skuCode.toUpperCase());
                await dbClient.from('stock_items').upsert({
                    code: skuCode,
                    name: item?.name || skuCode,
                    kind: 'PRODUTO',
                    unit: 'un',
                    current_qty: Math.max(0, delta),
                    min_qty: 0,
                });
            }
        }

        await loadMovements();
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
            // Quantos pacotes inteiros podem ser montados a partir deste item
            const maxPacks = Math.floor(currentStock);

            return {
                code,
                name: item?.name || 'Item não encontrado',
                currentStock,
                percentage,
                isLow: currentStock < target,
                maxPacks,
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
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-700 uppercase truncate">{item.name}</p>
                                        <p className="text-[9px] font-mono text-slate-400">{item.code}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-right">
                                        <div>
                                            <p className={`text-sm font-black ${item.isLow ? 'text-red-500' : 'text-slate-700'}`}>{item.currentStock.toFixed(0)} <span className="text-[9px]">UN</span></p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${item.percentage < 50 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${item.percentage}%` }} />
                                                </div>
                                                <span className={`text-[9px] font-black ${item.percentage < 50 ? 'text-red-500' : item.percentage < 100 ? 'text-orange-500' : 'text-emerald-500'}`}>{item.percentage.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="border-l pl-3 ml-1">
                                            <p className="text-[8px] font-black text-slate-400 uppercase">Saída</p>
                                            <p className={`text-sm font-black ${item.maxPacks > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{item.maxPacks} <span className="text-[8px]">PCT</span></p>
                                        </div>
                                        {item.isLow ? <AlertTriangle size={14} className="text-red-500" /> : <CheckCircle2 size={14} className="text-emerald-500" />}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Histórico de Movimentações */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b pb-2 flex items-center gap-2">
                            <History size={12} /> Histórico de Entradas / Saídas ({movements.length})
                        </p>
                        {loadingMovements ? (
                            <p className="text-xs text-slate-400 text-center py-4">Carregando...</p>
                        ) : movements.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4 border-2 border-dashed rounded-xl">Nenhuma movimentação registrada para este pacote.</p>
                        ) : (
                            <div className="max-h-48 overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
                                {movements.map((mov, idx) => {
                                    const isEntrada = (mov.qty_delta || 0) > 0;
                                    const dateStr = mov.created_at ? new Date(mov.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
                                    return (
                                        <div key={mov.id || idx} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isEntrada ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                                            <div className={`p-1 rounded-full ${isEntrada ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                {isEntrada ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-bold text-slate-700 truncate">
                                                    {mov.ref || mov.origin || '—'}
                                                </p>
                                                {mov.product_sku && (
                                                    <p className="text-[9px] font-mono text-slate-400">SKU: {mov.product_sku}</p>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`text-xs font-black ${isEntrada ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isEntrada ? '+' : ''}{mov.qty_delta} UN
                                                </p>
                                                <p className="text-[8px] text-slate-400">{dateStr}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
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
