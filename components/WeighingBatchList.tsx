import React, { useState } from 'react';
import { WeighingBatch, User } from '../types';
import { Trash2 } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';

interface WeighingBatchListProps {
    weighingBatches: WeighingBatch[];
    currentUser: User;
    onDeleteBatch: (batchId: string) => Promise<boolean>;
}

const WeighingBatchList: React.FC<WeighingBatchListProps> = ({ weighingBatches, currentUser, onDeleteBatch }) => {
    const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; item: WeighingBatch | null }>({ isOpen: false, item: null });

    const handleOpenDeleteModal = (batch: WeighingBatch) => {
        setDeleteModalState({ isOpen: true, item: batch });
    };

    const handleConfirmDelete = async () => {
        if (deleteModalState.item) {
            const success = await onDeleteBatch(deleteModalState.item.id);
            if (success) {
                setDeleteModalState({ isOpen: false, item: null });
            }
        }
    };

    return (
        <>
            {/* Mobile View */}
            <div className="md:hidden space-y-3">
                {weighingBatches.length > 0 ? weighingBatches.map(batch => (
                    <div key={batch.id} className="bg-[var(--color-surface-secondary)] p-3 rounded-xl border border-[var(--color-border)] shadow-sm">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-black text-[var(--color-text-primary)] uppercase text-sm">Lote: {batch.batchName || 'S/N'}</p>
                                <p className="text-xs font-bold text-violet-600 uppercase">{batch.stockItemName}</p>
                            </div>
                            {currentUser.role === 'SUPER_ADMIN' && (
                                <button onClick={() => handleOpenDeleteModal(batch)} className="p-1.5 text-red-500 bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                            )}
                        </div>
                        
                        {/* Lista de Produtos no Lote (Mobile) */}
                        {batch.produtos && batch.produtos.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produtos / Cores:</p>
                                <div className="flex flex-wrap gap-1">
                                    {batch.produtos.map((p, idx) => (
                                        <div key={idx} className="bg-slate-50 border border-slate-200 px-2 py-1 rounded text-[9px] font-bold">
                                            {p.nome} {p.cor ? `- ${p.cor}` : ''} | <span className="text-violet-600">{p.qty_ensacada}kg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="text-[10px] text-[var(--color-text-secondary)] mt-2 pt-2 border-t border-[var(--color-border)] grid grid-cols-2 gap-2">
                            <p><strong>Total:</strong> {batch.initialQty.toFixed(1)}kg</p>
                            <p><strong>Saldo:</strong> {(batch.initialQty - batch.usedQty).toFixed(1)}kg</p>
                            <p className="col-span-2"><strong>Operador:</strong> {batch.createdBy}</p>
                            <p className="col-span-2"><strong>Equipe:</strong> {batch.operador_maquina || 'N/A'}</p>
                            <p className="col-span-2"><strong>Data:</strong> {batch.createdAt?.toLocaleString('pt-BR') || 'N/A'}</p>
                        </div>
                    </div>
                )) : <p className="text-center py-8">Nenhum lote de pesagem.</p>}
            </div>
            
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--color-border)] shadow-sm">
                <table className="min-w-full bg-white text-xs">
                    <thead className="bg-slate-50">
                        <tr>
                            {['Data', 'Item Pesado', 'Produtos/Cores', 'Qtd (kg)', 'Saldo (kg)', 'Operadores', 'Lote', 'Ações'].map(h =>
                                <th key={h} className="py-3 px-4 text-left font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {weighingBatches.length > 0 ? weighingBatches.map(batch => {
                            const remaining = batch.initialQty - batch.usedQty;
                            return (
                                <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 text-slate-600 font-medium">
                                        {batch.createdAt && !isNaN(batch.createdAt.getTime()) ? batch.createdAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Data inválida'}
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="font-black text-slate-800 uppercase tracking-tighter">{batch.stockItemName}</p>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase ${batch.weighingType === 'hourly' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                            {batch.weighingType === 'hourly' ? 'Por Hora' : 'Diário'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col gap-1">
                                            {batch.produtos && batch.produtos.length > 0 ? (
                                                batch.produtos.map((p, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-[10px]">
                                                        <span className="font-bold text-slate-700 uppercase leading-none">{p.nome}</span>
                                                        {p.cor && <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded-sm font-black uppercase text-[8px]">{p.cor}</span>}
                                                        <span className="text-violet-600 font-black">{p.qty_ensacada}kg</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 italic">Detalhes não registrados</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 font-black text-slate-700 text-right pr-6">{batch.initialQty.toFixed(1)}</td>
                                    <td className={`py-3 px-4 font-black text-right pr-6 ${remaining < 0.001 ? 'text-slate-300' : 'text-emerald-600'}`}>{remaining.toFixed(1)}</td>
                                    <td className="py-3 px-4">
                                        <p className="text-slate-700 font-bold uppercase truncate max-w-[150px]" title={batch.operador_maquina || batch.createdBy}>
                                            {batch.operador_maquina || batch.createdBy}
                                        </p>
                                        <span className="text-[9px] text-slate-400 font-black uppercase">{batch.tipo_operacao?.replace(/_/g, ' ') || 'Processamento'}</span>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-slate-500 uppercase">{batch.batchName || '---'}</td>
                                    <td className="py-3 px-4 text-center">
                                        {currentUser.role === 'SUPER_ADMIN' && (
                                            <button onClick={() => handleOpenDeleteModal(batch)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Excluir Lote">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={8} className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">Nenhum lote encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {deleteModalState.isOpen && deleteModalState.item && (
                 <ConfirmDeleteModal
                    isOpen={deleteModalState.isOpen}
                    onClose={() => setDeleteModalState({ isOpen: false, item: null })}
                    onConfirm={handleConfirmDelete}
                    itemName={`${deleteModalState.item.stockItemName} (${deleteModalState.item.initialQty}kg)`}
                    itemType="Lote de Pesagem"
                />
            )}
        </>
    );
};

export default WeighingBatchList;
