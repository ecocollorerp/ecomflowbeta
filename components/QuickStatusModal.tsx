import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { OrderItem, OrderStatusValue, ORDER_STATUS_VALUES } from '../types';

interface QuickStatusModalProps {
    isOpen: boolean;
    onClose: () => void;
    orders: OrderItem[];
    onConfirm: (orderIds: string[], newStatus: OrderStatusValue, notes: string) => Promise<boolean>;
}

const QuickStatusModal: React.FC<QuickStatusModalProps> = ({ isOpen, onClose, orders, onConfirm }) => {
    const [newStatus, setNewStatus] = useState<OrderStatusValue>('SOLUCIONADO');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsSaving(true);
        const success = await onConfirm(orders.map(o => o.id), newStatus, notes);
        setIsSaving(false);
        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-md border border-slate-100 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Atualizar Status</h2>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Alteração em massa ({orders.length} pedidos)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Novo Estado</label>
                        <div className="grid grid-cols-1 gap-2">
                            {ORDER_STATUS_VALUES.map(status => (
                                <button
                                    key={status}
                                    onClick={() => setNewStatus(status)}
                                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                                        newStatus === status 
                                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg shadow-blue-100' 
                                            : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                                    }`}
                                >
                                    <span>{status}</span>
                                    {newStatus === status && <CheckCircle size={18} className="text-blue-600" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Observações (Opcional)</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Descreva o motivo da alteração..."
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all min-h-[100px] resize-none"
                        />
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase">
                            Atenção: Esta ação atualizará o status de todos os pedidos selecionados permanentemente no banco de dados.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={isSaving}
                        className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Confirmar Alteração
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickStatusModal;
