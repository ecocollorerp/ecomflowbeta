// components/BulkLinkSKUsModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Check, Plus, Tag, Database, Box } from 'lucide-react';
import { GeneralSettings } from '../types';

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
  generalSettings: GeneralSettings;
}

export function BulkLinkSKUsModal({
  isOpen,
  onClose,
  importedProducts,
  existingProducts,
  onLinkBulk,
  onCreateAndLink,
  generalSettings
}: BulkLinkSKUsModalProps) {
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCode, setNewProductCode] = useState('');
  
  // Novas lógicas de categoria e base
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBase, setSelectedBase] = useState('');
  const [productType, setProductType] = useState<'papel_de_parede' | 'miudos'>('papel_de_parede');

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && importedProducts.length > 0) {
        // Pré-preenchimento opcional se apenas um SKU selecionado fora do modal anteriormente
        // Mas geralmente o App passa a lista filtrada
    }
  }, [isOpen, importedProducts]);

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
          setIsLoading(false);
          return;
        }
        await onCreateAndLink(Array.from(selectedSkus), {
          name: newProductName,
          code: newProductCode,
          category: selectedCategory,
          base_type: selectedBase,
          product_type: productType
        });
      } else {
        await onLinkBulk(Array.from(selectedSkus), targetProductId);
      }
      setSelectedSkus(new Set());
      setTargetProductId('');
      setNewProductName('');
      setNewProductCode('');
      setSelectedCategory('');
      setSelectedBase('');
      setIsCreatingNew(false);
      onClose();
    } catch (err) {
      console.error('Erro ao vincular SKUs:', err);
      alert('Erro ao vincular SKUs');
    } finally {
      setIsLoading(false);
    }
  };

  const currentCatConfig = generalSettings.productCategoryConfigs?.find(c => c.name === selectedCategory);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white p-8 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Vincular SKUs em Massa</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Associe múltiplos canais a um produto mestre</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="px-8 pb-8 space-y-8 overflow-y-auto custom-scrollbar">
          {/* Selection Controls */}
          <div className="bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight flex items-center gap-2">
                <Box size={16} className="text-blue-600" />
                Produtos Importados ({selectedSkus.size}/{importedProducts.length})
              </h3>
              <button
                onClick={handleSelectAll}
                className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-full hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all"
              >
                {selectedSkus.size === importedProducts.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </button>
            </div>

            {/* Product List */}
            <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-slate-100 rounded-2xl p-4 bg-white custom-scrollbar">
              {importedProducts.map((product) => (
                <label key={product.sku} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedSkus.has(product.sku) ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50 border-transparent'} border`}>
                  <div className="relative flex items-center">
                    <input
                        type="checkbox"
                        checked={selectedSkus.has(product.sku)}
                        onChange={() => handleSkuToggle(product.sku)}
                        className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-slate-200 rounded-md peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                        <Check size={12} className={`text-white transition-opacity ${selectedSkus.has(product.sku) ? 'opacity-100' : 'opacity-0'}`} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-xs text-slate-700 uppercase tracking-tight">{product.sku}</div>
                    <div className="text-[10px] font-bold text-slate-400 truncate max-w-[400px]">{product.name}</div>
                  </div>
                  {product.price && <div className="text-[10px] font-black text-slate-500">R$ {product.price.toFixed(2)}</div>}
                </label>
              ))}
            </div>
          </div>

          {/* Link To Product Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setIsCreatingNew(false)}
                    className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${!isCreatingNew ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                >
                    Produto Existente
                </button>
                <button 
                    onClick={() => setIsCreatingNew(true)}
                    className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 transition-all ${isCreatingNew ? 'bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}
                >
                    Criar Novo Produto
                </button>
            </div>

            {!isCreatingNew ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm focus:border-blue-500 outline-none transition-all"
                >
                  <option value="">Selecione um produto existente...</option>
                  {existingProducts.sort((a,b) => a.name.localeCompare(b.name)).map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-1 duration-200 bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Código do Produto</label>
                        <input
                            type="text"
                            placeholder="ex: PPL-PREM"
                            value={newProductCode}
                            onChange={(e) => setNewProductCode(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-xs focus:border-blue-500 outline-none transition-all uppercase"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Produto</label>
                        <input
                            type="text"
                            placeholder="ex: Papel Premium"
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-xs focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Produto</label>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setProductType('papel_de_parede')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${productType === 'papel_de_parede' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Papel</button>
                        <button onClick={() => setProductType('miudos')} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${productType === 'miudos' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>Miúdos</button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                        <div className="relative">
                            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                value={selectedCategory}
                                onChange={(e) => {
                                    setSelectedCategory(e.target.value);
                                    setSelectedBase(''); // Reset base when category changes
                                }}
                                className="w-full pl-9 p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-xs focus:border-blue-500 outline-none transition-all"
                            >
                                <option value="">Sem Categoria</option>
                                {generalSettings.productCategoryList.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base do Produto</label>
                        {currentCatConfig?.hasBase ? (
                            <select
                                value={selectedBase}
                                onChange={(e) => setSelectedBase(e.target.value)}
                                className="w-full p-3 bg-blue-50 border-2 border-blue-100 rounded-xl font-black text-xs text-blue-700 outline-none transition-all uppercase"
                            >
                                <option value="">Selecione...</option>
                                {currentCatConfig.baseNames?.map(b => (
                                    <option key={b} value={b.toUpperCase()}>{b.toUpperCase()}</option>
                                ))}
                                <option value="PERSONALIZADA">+ Personalizada</option>
                            </select>
                        ) : (
                            <div className="p-3 bg-slate-100 border-2 border-slate-100 rounded-xl text-[9px] font-black text-slate-400 uppercase text-center border-dashed">
                                Sem bases
                            </div>
                        )}
                    </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Summary */}
          <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedSkus.size > 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
            <div className={`p-2 rounded-xl ${selectedSkus.size > 0 ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <Check size={20} />
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-tight">{selectedSkus.size} SKUs selecionados</p>
                <p className="text-[10px] font-bold opacity-60">
                    {isCreatingNew ? `Novos produtos: ${newProductCode || '...'}` : `Vinculando a: ${existingProducts.find(p => p.id === targetProductId)?.name || '...'}`}
                </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-white border-t border-slate-100 flex gap-3 justify-end shrink-0">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleLinkToExisting}
            disabled={isLoading || selectedSkus.size === 0 || (!targetProductId && !isCreatingNew)}
            className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center gap-2"
          >
            {isLoading ? <Check className="animate-pulse" size={18} /> : <Database size={18} />}
            {isLoading ? 'VINCULANDO...' : `CONFIRMAR VINCULAÇÃO`}
          </button>
        </div>
      </div>
    </div>
  );
}
