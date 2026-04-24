// components/InsumoCategoryManagerModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Edit, ListChecks, Database, Tag } from 'lucide-react';
import CategoryAssignmentModal from './CategoryAssignmentModal';
import { StockItem, CategoryConfig } from '../types';

interface InsumoCategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCategories: string[];
    onSave: (newCategories: string[]) => void;
    allProducts?: StockItem[];
    onAssignProducts?: (category: string, productCodes: string[]) => Promise<void>;
    // New props for base configuration
    currentConfigs?: CategoryConfig[];
    onSaveConfigs?: (newConfigs: CategoryConfig[]) => void;
    showBaseConfig?: boolean;
    title?: string;
}

const InsumoCategoryManagerModal: React.FC<InsumoCategoryManagerModalProps> = ({ 
    isOpen, onClose, currentCategories, onSave, allProducts, onAssignProducts,
    currentConfigs = [], onSaveConfigs, showBaseConfig = false
}) => {
    const [categories, setCategories] = useState<string[]>([]);
    const [configs, setConfigs] = useState<CategoryConfig[]>([]);
    const [newCategory, setNewCategory] = useState('');
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editedName, setEditedName] = useState('');
    
    // Config state for the currently editing category
    const [tempConfig, setTempConfig] = useState<CategoryConfig | null>(null);
    const [newBaseName, setNewBaseName] = useState('');

    const [assignmentCategory, setAssignmentCategory] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setCategories(currentCategories);
            setConfigs(currentConfigs);
        }
    }, [isOpen, currentCategories, currentConfigs]);

    if (!isOpen) return null;

    const handleAdd = () => {
        const trimmed = newCategory.trim();
        if (trimmed && !categories.includes(trimmed)) {
            const nextCategories = [...categories, trimmed].sort();
            setCategories(nextCategories);
            
            if (showBaseConfig) {
                const newCfg: CategoryConfig = { name: trimmed, hasBase: false, baseNames: [] };
                setConfigs([...configs, newCfg]);
            }
            
            setNewCategory('');
        }
    };

    const handleRemove = (categoryToRemove: string) => {
        if(window.confirm(`Tem certeza que deseja remover "${categoryToRemove}"?`)) {
            setCategories(categories.filter(c => c !== categoryToRemove));
            setConfigs(configs.filter(c => c.name !== categoryToRemove));
        }
    };
    
    const handleStartEdit = (category: string) => {
        setEditingCategory(category);
        setEditedName(category);
        
        if (showBaseConfig) {
            const existing = configs.find(c => c.name === category);
            setTempConfig(existing || { name: category, hasBase: false, baseNames: [] });
        }
    };

    const handleCancelEdit = () => {
        setEditingCategory(null);
        setEditedName('');
        setTempConfig(null);
        setNewBaseName('');
    };

    const handleSaveEdit = () => {
        const trimmedName = editedName.trim();
        if (!trimmedName || !editingCategory) return;
        
        if (trimmedName !== editingCategory && categories.includes(trimmedName)) {
            alert('Esta categoria já existe.');
            return;
        }

        const nextCategories = categories.map(c => c === editingCategory ? trimmedName : c).sort();
        setCategories(nextCategories);

        if (showBaseConfig && tempConfig) {
            const updatedConfig = { ...tempConfig, name: trimmedName };
            const nextConfigs = configs.filter(c => c.name !== editingCategory);
            setConfigs([...nextConfigs, updatedConfig]);
        }

        handleCancelEdit();
    };

    const handleSave = () => {
        onSave(categories);
        if (showBaseConfig && onSaveConfigs) {
            onSaveConfigs(configs);
        }
        onClose();
    };

    const handleAddBase = () => {
        if (!tempConfig || !newBaseName.trim()) return;
        const trimmed = newBaseName.trim().toUpperCase();
        if (tempConfig.baseNames?.includes(trimmed)) return;
        
        setTempConfig({
            ...tempConfig,
            baseNames: [...(tempConfig.baseNames || []), trimmed]
        });
        setNewBaseName('');
    };

    const handleRemoveBase = (base: string) => {
        if (!tempConfig) return;
        setTempConfig({
            ...tempConfig,
            baseNames: tempConfig.baseNames?.filter(b => b !== base)
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-slate-800">
            <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 w-full max-w-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">{title || 'Gerenciar Categorias'}</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {showBaseConfig ? `${title || 'Configure categorias'} e definições de base` : `Crie e organize ${title ? title.toLowerCase() : 'categorias'}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all"><X size={24} /></button>
                </div>
                
                <div className="flex gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-6 shrink-0">
                    <input 
                        type="text"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleAdd()}
                        placeholder={title ? `Nome da nova ${title.toLowerCase()}...` : 'Nome da nova categoria...'}
                        className="flex-grow p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-500 transition-all"
                    />
                    <button onClick={handleAdd} className="px-6 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                        <Plus size={20}/> ADICIONAR
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {categories.length > 0 ? categories.map(cat => (
                        <div key={cat} className={`border-2 rounded-3xl transition-all ${editingCategory === cat ? 'border-blue-500 bg-blue-50/30' : 'border-slate-50 bg-white hover:border-slate-200'}`}>
                            {editingCategory === cat ? (
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center gap-3">
                                        <input 
                                            type="text"
                                            value={editedName}
                                            onChange={e => setEditedName(e.target.value)}
                                            autoFocus
                                            className="flex-grow p-3 border-2 border-slate-200 rounded-xl text-sm bg-white outline-none font-bold focus:border-blue-500"
                                        />
                                        <button onClick={handleSaveEdit} className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-600 transition-all"><Save size={20}/></button>
                                        <button onClick={handleCancelEdit} className="p-3 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-all"><X size={20}/></button>
                                    </div>

                                    {showBaseConfig && tempConfig && (
                                        <div className="bg-white p-4 rounded-2xl border border-blue-100 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Database size={16} className="text-blue-500" />
                                                    <span className="text-xs font-black uppercase tracking-tight">Utiliza Base?</span>
                                                </div>
                                                <button 
                                                    onClick={() => setTempConfig({...tempConfig, hasBase: !tempConfig.hasBase})}
                                                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${tempConfig.hasBase ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                                                >
                                                    {tempConfig.hasBase ? 'SIM' : 'NÃO'}
                                                </button>
                                            </div>

                                            {tempConfig.hasBase && (
                                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomes das Bases (Ex: Branca, Preta)</label>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="text"
                                                            value={newBaseName}
                                                            onChange={e => setNewBaseName(e.target.value)}
                                                            onKeyPress={e => e.key === 'Enter' && handleAddBase()}
                                                            placeholder="Nova base..."
                                                            className="flex-grow p-2 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                                                        />
                                                        <button onClick={handleAddBase} className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"><Plus size={16}/></button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {tempConfig.baseNames?.map(base => (
                                                            <span key={base} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black border border-blue-100 group/base">
                                                                <Tag size={10} />
                                                                {base}
                                                                <button onClick={() => handleRemoveBase(base)} className="hover:text-red-600 transition-colors ml-1"><X size={12} /></button>
                                                            </span>
                                                        ))}
                                                        {(!tempConfig.baseNames || tempConfig.baseNames.length === 0) && (
                                                            <p className="text-[10px] text-slate-400 italic">Nenhuma base definida</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 flex justify-between items-center group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <Tag size={20} />
                                        </div>
                                        <div>
                                            <span className="font-black text-slate-700 text-sm uppercase tracking-tight">{cat}</span>
                                            {showBaseConfig && (
                                                <div className="flex gap-2 mt-0.5">
                                                    {configs.find(c => c.name === cat)?.hasBase ? (
                                                        <span className="text-[8px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-widest border border-blue-200">
                                                            {configs.find(c => c.name === cat)?.baseNames?.length || 0} Bases
                                                        </span>
                                                    ) : (
                                                        <span className="text-[8px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-widest">Sem Base</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {onAssignProducts && allProducts && (
                                            <button onClick={() => setAssignmentCategory(cat)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all" title="Atribuir Produtos"><ListChecks size={20}/></button>
                                        )}
                                        <button onClick={() => handleStartEdit(cat)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-all" title="Editar"><Edit size={20}/></button>
                                        <button onClick={() => handleRemove(cat)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all" title="Remover"><Trash2 size={20}/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )) : (
                        <div className="py-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                            <Tag size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="font-black text-sm text-slate-400 uppercase tracking-widest">Nenhuma categoria cadastrada</p>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-slate-100 shrink-0">
                    <button onClick={onClose} className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                    <button onClick={handleSave} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2">
                        <Save size={18}/> SALVAR ALTERAÇÕES
                    </button>
                </div>
            </div>

            {assignmentCategory && allProducts && onAssignProducts && (
                <CategoryAssignmentModal 
                    isOpen={!!assignmentCategory}
                    onClose={() => setAssignmentCategory(null)}
                    categoryName={assignmentCategory}
                    allProducts={allProducts}
                    onSave={(productCodes) => onAssignProducts(assignmentCategory, productCodes)}
                />
            )}
        </div>
    );
};

export default InsumoCategoryManagerModal;
