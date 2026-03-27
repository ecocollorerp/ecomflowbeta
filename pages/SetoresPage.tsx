import React, { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Shield, User as UserIcon, LayoutGrid, Info } from 'lucide-react';
import { User, Setor } from '../types';
import ConfirmActionModal from '../components/ConfirmActionModal';

interface SetoresPageProps {
    sectors: Setor[];
    users: User[];
    onAddSector: (name: string) => Promise<boolean>;
    onDeleteSector: (id: string) => Promise<boolean>;
    onEditSector: (id: string, name: string) => Promise<boolean>;
}

export const SetoresPage: React.FC<SetoresPageProps> = ({ sectors, users, onAddSector, onDeleteSector, onEditSector }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');
    const [sectorToEdit, setSectorToEdit] = useState<Setor | null>(null);
    const [sectorToDelete, setSectorToDelete] = useState<Setor | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAdd = async () => {
        if (!newSectorName.trim()) return;
        setIsProcessing(true);
        const success = await onAddSector(newSectorName.trim());
        setIsProcessing(false);
        if (success) {
            setNewSectorName('');
            setIsAddModalOpen(false);
        }
    };

    const handleEdit = async () => {
        if (!sectorToEdit || !newSectorName.trim()) return;
        setIsProcessing(true);
        const success = await onEditSector(sectorToEdit.id, newSectorName.trim());
        setIsProcessing(false);
        if (success) {
            setSectorToEdit(null);
            setNewSectorName('');
            setIsEditModalOpen(false);
        }
    };

    const handleDelete = async () => {
        if (!sectorToDelete) return;
        setIsProcessing(true);
        const success = await onDeleteSector(sectorToDelete.id);
        setIsProcessing(false);
        if (success) {
            setSectorToDelete(null);
            setIsDeleteModalOpen(false);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                        <LayoutGrid size={40} className="text-indigo-600 bg-indigo-50 p-2 rounded-2xl shadow-sm" />
                        Gestão de Setores
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Organização de equipes e fluxos de trabalho</p>
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 group"
                >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                    Novo Setor
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sectors.map(sector => {
                    const sectorUsers = users.filter(u => Array.isArray(u.setor) && u.setor.includes(sector.name));
                    
                    return (
                        <div key={sector.id} className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all hover:-translate-y-1">
                            <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-slate-50/50">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">{sector.name}</h3>
                                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full w-fit">
                                        <Users size={12} />
                                        {sectorUsers.length} {sectorUsers.length === 1 ? 'Membro' : 'Membros'}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            setSectorToEdit(sector);
                                            setNewSectorName(sector.name);
                                            setIsEditModalOpen(true);
                                        }}
                                        className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-2xl shadow-sm transition-all hover:scale-110"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setSectorToDelete(sector);
                                            setIsDeleteModalOpen(true);
                                        }}
                                        className="p-3 bg-white text-slate-400 hover:text-red-500 rounded-2xl shadow-sm transition-all hover:scale-110"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="p-8 flex-1 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">Membros do Setor</h4>
                                {sectorUsers.length > 0 ? (
                                    <div className="space-y-3">
                                        {sectorUsers.map(user => (
                                            <div key={user.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 group/user hover:bg-white hover:border-indigo-100 transition-all">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover/user:text-indigo-500 group-hover/user:border-indigo-100 transition-all">
                                                    {user.role === 'SUPER_ADMIN' ? <Shield size={20} /> : <UserIcon size={20} />}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-xs uppercase tracking-tight">{user.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-8 flex flex-col items-center justify-center text-slate-300 space-y-2 opacity-50">
                                        <Users size={32} />
                                        <p className="text-xs font-bold uppercase tracking-widest">Nenhum membro</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Modal de Adição/Edição */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                                {isAddModalOpen ? <Plus className="text-indigo-600" /> : <Pencil className="text-indigo-600" />}
                                {isAddModalOpen ? 'Novo Setor' : 'Editar Setor'}
                            </h2>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Setor</label>
                                <input 
                                    type="text"
                                    value={newSectorName}
                                    onChange={(e) => setNewSectorName(e.target.value)}
                                    placeholder="Ex: Expedição, Fiscal, etc."
                                    className="w-full h-16 bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 font-black text-slate-700 placeholder:text-slate-300 focus:border-indigo-500 focus:bg-white transition-all outline-none shadow-inner"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <button 
                                onClick={() => {
                                    setIsAddModalOpen(false);
                                    setIsEditModalOpen(false);
                                    setSectorToEdit(null);
                                    setNewSectorName('');
                                }}
                                className="flex-1 py-4 bg-white text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={isAddModalOpen ? handleAdd : handleEdit}
                                disabled={isProcessing || !newSectorName.trim()}
                                className="flex-2 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Processando...' : 'Salvar Setor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmActionModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setSectorToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Excluir Setor"
                message={
                    <div className="space-y-4">
                        <p>Tem certeza que deseja excluir o setor <strong>{sectorToDelete?.name}</strong>?</p>
                        <div className="bg-amber-50 p-4 rounded-2xl flex items-start gap-3 border border-amber-100">
                            <Info className="text-amber-500 shrink-0" size={20} />
                            <p className="text-xs font-bold text-amber-700 uppercase leading-relaxed">
                                Isso não apagará os usuários, mas eles deixarão de estar vinculados a este setor.
                            </p>
                        </div>
                    </div>
                }
                confirmButtonText="Confirmar Exclusão"
                isConfirming={isProcessing}
            />
        </div>
    );
};
