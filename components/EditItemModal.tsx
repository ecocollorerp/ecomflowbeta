
// components/EditItemModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { StockItem, User, GeneralSettings } from '../types';

interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: StockItem;
    currentUser: User;
    onConfirm: (itemId: string, updates: Partial<Pick<StockItem, 'name' | 'category' | 'description'>>) => Promise<boolean>;
    generalSettings: GeneralSettings;
    products: StockItem[]; // All products to choose as substitute
}

const EditItemModal: React.FC<EditItemModalProps> = ({ isOpen, onClose, item, currentUser, onConfirm, generalSettings, products }) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && item) {
            setName(item.name);
            setCategory(item.category || '');
            setDescription(item.description || '');
            setError('');
        }
    }, [isOpen, item]);

    if (!isOpen || !item) return null;

    const handleConfirm = async () => {
        setError('');
        if (!name.trim()) {
            setError('O nome do item não pode ser vazio.');
            return;
        }
        
        const updates: Partial<Pick<StockItem, 'name' | 'category' | 'description'>> = {
            name: name.trim(),
            category: category.trim() || undefined,
            description: description.trim() || undefined,
        };

        const success = await onConfirm(item.id, updates);
        if (!success) {
            setError('Falha ao salvar. Verifique a conexão com o banco de dados.');
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <Edit3 className="mr-2 text-blue-600" />
                        Editar Item
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                    Editando: <strong>{item.code}</strong>.
                </p>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="edit-item-name" className="block text-sm font-medium text-gray-700">Nome do Item</label>
                        <input
                            id="edit-item-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full p-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="edit-item-category" className="block text-sm font-medium text-gray-700">Categoria</label>
                        <input
                            id="edit-item-category"
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="mt-1 w-full p-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ex: Matéria-prima, Acabado..."
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="edit-item-description" className="block text-sm font-medium text-gray-700">Descrição (Opcional)</label>
                        <textarea
                            id="edit-item-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 w-full p-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Informações adicionais sobre o item..."
                        />
                    </div>
                    
                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancelar</button>
                    <button onClick={handleConfirm} disabled={!name.trim()} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50">Confirmar Alteração</button>
                </div>
            </div>
        </div>
    );
};

export default EditItemModal;
