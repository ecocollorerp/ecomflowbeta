import React, { useState, useEffect } from 'react';
import { X, Trash2, Link2 } from 'lucide-react';
import { StockItem, SkuLink } from '../types';

interface EditProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: StockItem | null;
    linkedSkus: SkuLink[];
    onSaves: (updatedProduct: Partial<StockItem>) => Promise<void>;
    onUnlinkSku: (importedSku: string) => Promise<void>;
}

const EditProductModal: React.FC<EditProductModalProps> = ({
    isOpen,
    onClose,
    product,
    linkedSkus,
    onSaves,
    onUnlinkSku
}) => {
    const [productName, setProductName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);

    useEffect(() => {
        if (isOpen && product) {
            setProductName(product.name);
        }
    }, [isOpen, product]);

    if (!isOpen || !product) return null;

    // Encontrar todos os SKUs vinculados a este produto
    const skusLinked = linkedSkus.filter(link => link.masterProductSku === product.code);

    const handleSave = async () => {
        if (!productName.trim()) {
            alert('Nome do produto não pode estar vazio');
            return;
        }
        setIsSaving(true);
        try {
            await onSaves({
                id: product.id,
                name: productName.trim()
            });
            onClose();
        } catch (err) {
            console.error('Erro ao salvar produto:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlinkSku = async (importedSku: string) => {
        if (!confirm(`Desvinculr ${importedSku} deste produto?`)) return;
        setIsUnlinking(true);
        try {
            await onUnlinkSku(importedSku);
        } catch (err) {
            console.error('Erro ao desvinculr SKU:', err);
        } finally {
            setIsUnlinking(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800">
                        Editar Produto: {product.code}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Nome do Produto */}
                    <div>
                        <label className="text-sm font-medium text-gray-700">Nome do Produto</label>
                        <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                            placeholder="ex: Papel de Parede Premium"
                        />
                    </div>

                    {/* SKUs Vinculados */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                            <Link2 size={16} className="mr-2" />
                            SKUs Vinculados ({skusLinked.length})
                        </h3>

                        {skusLinked.length === 0 ? (
                            <div className="bg-gray-50 p-3 rounded text-sm text-gray-500 text-center">
                                Nenhum SKU vinculado a este produto
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {skusLinked.map((link) => (
                                    <div
                                        key={link.importedSku}
                                        className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200"
                                    >
                                        <div>
                                            <p className="font-medium text-gray-800">{link.importedSku}</p>
                                            <p className="text-xs text-gray-500">
                                                Vinculado: {new Date(link.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleUnlinkSku(link.importedSku)}
                                            disabled={isUnlinking}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                            title="Desvincular SKU"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Informações adicionais */}
                    <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-800">
                        <p>
                            <strong>Código do Produto:</strong> {product.code}
                        </p>
                        <p className="mt-1">
                            <strong>Tipo:</strong> {product.kind}
                        </p>
                        <p className="mt-1">
                            <strong>Status:</strong> {product.status}
                        </p>
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
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditProductModal;
