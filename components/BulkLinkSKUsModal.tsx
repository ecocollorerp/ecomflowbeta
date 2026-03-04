import React, { useState } from 'react';
import { X, Check, Plus } from 'lucide-react';

interface ImportedProduct {
  sku: string;
  name: string;
  price?: number;
  selected?: boolean;
}

interface BulkLinkSKUsModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedProducts: ImportedProduct[];
  existingProducts: Array<{ id: string; code: string; name: string }>;
  onLinkBulk: (selectedSkus: string[], targetProductId?: string) => Promise<void>;
  onCreateAndLink: (selectedSkus: string[], newProductData: any) => Promise<void>;
}

export function BulkLinkSKUsModal({
  isOpen,
  onClose,
  importedProducts,
  existingProducts,
  onLinkBulk,
  onCreateAndLink,
}: BulkLinkSKUsModalProps) {
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSkuToggle = (sku: string) => {
    const newSelected = new Set(selectedSkus);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedSkus(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSkus.size === importedProducts.length) {
      setSelectedSkus(new Set());
    } else {
      setSelectedSkus(new Set(importedProducts.map(p => p.sku)));
    }
  };

  const handleLinkToExisting = async () => {
    if (selectedSkus.size === 0) {
      alert('Selecione pelo menos um SKU');
      return;
    }
    if (!targetProductId && !isCreatingNew) {
      alert('Selecione um produto ou marque para criar novo');
      return;
    }

    setIsLoading(true);
    try {
      if (isCreatingNew) {
        if (!newProductName || !newProductCode) {
          alert('Preencha nome e código do novo produto');
          return;
        }
        await onCreateAndLink(Array.from(selectedSkus), {
          name: newProductName,
          code: newProductCode,
        });
      } else {
        await onLinkBulk(Array.from(selectedSkus), targetProductId);
      }
      setSelectedSkus(new Set());
      setTargetProductId('');
      setNewProductName('');
      setNewProductCode('');
      setIsCreatingNew(false);
      onClose();
    } catch (err) {
      console.error('Erro ao vincular SKUs:', err);
      alert('Erro ao vincular SKUs');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Vincular SKUs em Massa</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Selection Controls */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Produtos Importados ({selectedSkus.size}/{importedProducts.length})
              </h3>
              <button
                onClick={handleSelectAll}
                className="text-sm px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {selectedSkus.size === importedProducts.length ? 'Desselecionar Tudo' : 'Selecionar Tudo'}
              </button>
            </div>

            {/* Product List */}
            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded p-3 bg-white">
              {importedProducts.map((product) => (
                <label key={product.sku} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSkus.has(product.sku)}
                    onChange={() => handleSkuToggle(product.sku)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{product.sku}</div>
                    <div className="text-sm text-gray-600">{product.name}</div>
                    {product.price && <div className="text-sm text-gray-500">R$ {product.price.toFixed(2)}</div>}
                  </div>
                  {selectedSkus.has(product.sku) && <Check size={18} className="text-green-600" />}
                </label>
              ))}
            </div>
          </div>

          {/* Link To Product Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Vincular a Produto</h3>

            {!isCreatingNew ? (
              <div className="space-y-3">
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecione um produto existente...</option>
                  {existingProducts.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.code})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-blue-600 border-2 border-blue-600 rounded-lg hover:bg-blue-50"
                >
                  <Plus size={18} />
                  Ou criar novo produto
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome do novo produto"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Código do produto"
                  value={newProductCode}
                  onChange={(e) => setNewProductCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setIsCreatingNew(false)}
                  className="w-full px-4 py-2 text-gray-600 border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Usar produto existente
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            💡 <strong>{selectedSkus.size} SKU(s)</strong> serão vinculados ao{' '}
            {isCreatingNew ? (
              <>
                novo produto <strong>"{newProductName || '...'}"</strong>
              </>
            ) : targetProductId ? (
              <>
                produto <strong>"{existingProducts.find(p => p.id === targetProductId)?.name}"</strong>
              </>
            ) : (
              'produto selecionado'
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleLinkToExisting}
            disabled={isLoading || selectedSkus.size === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Check size={18} />
            {isLoading ? 'Vinculando...' : `Vincular ${selectedSkus.size} SKU(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
