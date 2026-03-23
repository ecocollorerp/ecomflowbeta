// components/CreateProductFromImportModal.tsx
import React, { useState, useEffect } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { StockItem, GeneralSettings } from '../types';

interface CreateProductFromImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    unlinkedSkuData: { skus: string[]; colorSugerida: string; baseSugerida?: 'branca' | 'preta' | 'especial'; isMiudoSugerido?: boolean } | null;
    onConfirm: (item: Omit<StockItem, 'id'>) => void;
    generalSettings: GeneralSettings;
}

const CreateProductFromImportModal: React.FC<CreateProductFromImportModalProps> = ({ isOpen, onClose, unlinkedSkuData, onConfirm, generalSettings }) => {
    const [newItemName, setNewItemName] = useState('');
    const [newItemColor, setNewItemColor] = useState('');
    const [productType, setProductType] = useState<'papel_de_parede' | 'miudos'>('papel_de_parede');
    const [baseType, setBaseType] = useState<'branca' | 'preta' | 'especial'>('branca');

    const primarySku = unlinkedSkuData?.skus[0] || '';

    useEffect(() => {
        if (isOpen && unlinkedSkuData && primarySku) {
            // Suggest a cleaned-up name based on the SKU - only on initial open
            const suggestedName = primarySku
                .replace(/_/g, ' ')
                .replace(/-/g, ' ')
                .replace(/PPL/i, 'Papel de Parede Líquido')
                .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize words
            setNewItemName(suggestedName);
            setNewItemColor(unlinkedSkuData.colorSugerida);
            setProductType(unlinkedSkuData.isMiudoSugerido ? 'miudos' : 'papel_de_parede');
            setBaseType(unlinkedSkuData.baseSugerida || 'branca');
        }
    }, [isOpen, unlinkedSkuData, primarySku]);

    if (!isOpen || !unlinkedSkuData) return null;

    const handleConfirm = () => {
        if (newItemName.trim() && primarySku) {
            const newItem: Omit<StockItem, 'id'> = {
                code: primarySku,
                name: newItemName.trim(),
                kind: 'PRODUTO',
                unit: 'un',
                current_qty: 0,
                reserved_qty: 0,
                ready_qty: 0,
                min_qty: 0,
                color: newItemColor.trim(),
                product_type: productType,
                base_type: baseType,
                description: `Criado da importação - Base: ${baseType}`,
            };
            onConfirm(newItem);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <PlusCircle className="mr-2 text-blue-600" />
                        Criar Novo Produto de Venda
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Código / SKU (Será usado como SKU Mestre)</label>
                        <p className="text-md font-semibold text-gray-900 bg-gray-100 p-2 rounded">{primarySku}</p>
                        {unlinkedSkuData.skus.length > 1 && (
                            <p className="text-xs text-gray-500 mt-1">
                                e outros {unlinkedSkuData.skus.length - 1} SKU(s) serão vinculados a este novo produto.
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tipo de Produto</label>
                            <select
                                value={productType}
                                onChange={(e) => setProductType(e.target.value as any)}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                                <option value="papel_de_parede">{generalSettings.productTypeNames.papel_de_parede}</option>
                                <option value="miudos">{generalSettings.productTypeNames.miudos}</option>
                            </select>
                        </div>
                        {productType !== 'miudos' && (
                        <div>
                            <label className="text-sm font-medium text-gray-700">Tipo de Base</label>
                            <select
                                value={baseType}
                                onChange={(e) => setBaseType(e.target.value as any)}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            >
                                <option value="branca">⚪ Base Branca</option>
                                <option value="preta">⚫ Base Preta</option>
                                <option value="especial">🎨 Base Especial</option>
                            </select>
                        </div>
                        )}
                    </div>
                    <div>
                        <label htmlFor="name" className="text-sm font-medium text-gray-700">Nome do Produto</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="ex: Papel de Parede Branco Premium"
                        />
                    </div>
                    <div>
                        <label htmlFor="color" className="text-sm font-medium text-gray-700">Cor do Produto</label>
                        <input
                            id="color"
                            name="color"
                            type="text"
                            value={newItemColor}
                            onChange={e => setNewItemColor(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="ex: BRANCO"
                        />
                    </div>
                    <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                        <b>Nota:</b> O estoque para este produto será "flexível", calculado com base nos insumos definidos na sua Bill of Materials (BOM), que pode ser configurada na tela de Estoque.
                    </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!newItemName.trim()}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        Criar e Vincular Produto
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateProductFromImportModal;