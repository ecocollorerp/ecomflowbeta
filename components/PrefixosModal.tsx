import React, { useState } from 'react';
import { User } from '../types';
import { X, Save, User as UserIcon } from 'lucide-react';

interface PrefixosModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: User[];
    onSaveUser: (user: User) => Promise<boolean>;
    currentUser: User;
}

const PrefixosModal: React.FC<PrefixosModalProps> = ({ isOpen, onClose, users, onSaveUser, currentUser }) => {
    const [savingId, setSavingId] = useState<string | null>(null);
    const [localPrefixes, setLocalPrefixes] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    // Apenas operadores ou usuários que podem bipar
    const operators = users.filter(u => u.role === 'OPERATOR' || u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');

    const handlePrefixChange = (userId: string, value: string) => {
        setLocalPrefixes(prev => ({ ...prev, [userId]: value.toUpperCase().trim() }));
    };

    const handleSave = async (user: User) => {
        const newPrefix = localPrefixes[user.id];
        if (newPrefix === undefined) return;

        setSavingId(user.id);
        const updatedUser = { ...user, prefix: newPrefix };
        await onSaveUser(updatedUser);
        setSavingId(null);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                            <UserIcon className="text-blue-500" />
                            Prefixos de Operador
                        </h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mt-1">
                            Atribua bipagens se compartilharem a máquina
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-xs font-medium mb-4 flex gap-3">
                        <div className="shrink-0 text-2xl">💡</div>
                        <p>
                            Se vários operadores usam o mesmo leitor/computador, cadastre um prefixo curto (ex: <strong>JOAO</strong>).
                            Quando o operador ler o código, ele deve bipar no formato <strong>(JOAO)ID_DO_PEDIDO</strong> para a bipagem sair em seu nome.
                        </p>
                    </div>

                    <div className="space-y-3">
                        {operators.map(user => {
                            const currentVal = localPrefixes[user.id] !== undefined ? localPrefixes[user.id] : (user.prefix || '');
                            const isDirty = localPrefixes[user.id] !== undefined && localPrefixes[user.id] !== (user.prefix || '');

                            return (
                                <div key={user.id} className="flex items-center gap-4 p-3 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-slate-800 uppercase truncate">{user.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-black">(</span>
                                        <input
                                            type="text"
                                            value={currentVal}
                                            onChange={(e) => handlePrefixChange(user.id, e.target.value)}
                                            placeholder="PREFIXO"
                                            className="w-24 p-2 text-sm font-black text-center bg-white border border-slate-200 rounded-lg focus:border-blue-500 outline-none uppercase"
                                            maxLength={10}
                                        />
                                        <span className="text-slate-400 font-black">)</span>
                                    </div>
                                    <button
                                        onClick={() => handleSave(user)}
                                        disabled={!isDirty || savingId === user.id || currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN'}
                                        className={`p-2 rounded-xl flex items-center justify-center transition-all ${savingId === user.id
                                                ? 'bg-slate-200 text-slate-500'
                                                : isDirty
                                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                    : 'bg-slate-100 text-slate-300'
                                            }`}
                                        title={isDirty ? "Salvar Prefixo" : "Sem alterações"}
                                    >
                                        <Save size={18} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="border-t border-gray-100 p-6 bg-slate-50 flex justify-end">
                    <button onClick={onClose} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-black text-sm uppercase rounded-xl hover:bg-slate-100 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrefixosModal;
