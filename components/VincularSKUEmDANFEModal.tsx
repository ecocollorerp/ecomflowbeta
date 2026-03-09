// ============================================================================
// components/VincularSKUEmDANFEModal.tsx
// Modal para vincular SKU da DANFE com Produto Principal do Estoque
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { X, Link2, Search, AlertCircle, CheckCircle } from 'lucide-react';

interface VincularSKUEmDANFEModalProps {
  isOpen: boolean;
  onClose: () => void;
  skuImportado: string;
  descricaoItem?: string;
  stockItems: any[];
  skuLinks: any[];
  onVincular: (skuImportado: string, masterSku: string) => Promise<void>;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

interface StockItemSearch {
  id: string;
  sku: string;
  nome: string;
  descricao?: string;
  categoria?: string;
  preco?: number;
  estoque?: number;
}

export const VincularSKUEmDANFEModal: React.FC<VincularSKUEmDANFEModalProps> = ({
  isOpen,
  onClose,
  skuImportado,
  descricaoItem,
  stockItems = [],
  skuLinks = [],
  onVincular,
  addToast,
}) => {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [isCarregando, setIsCarregando] = useState(false);

  // Verificar se SKU já está vinculado
  const jáVinculado = useMemo(() => {
    return skuLinks.find(link => link.imported_sku === skuImportado)?.master_product_sku;
  }, [skuImportado, skuLinks]);

  // Filtrar produtos do estoque
  const produtosDisponiveis = useMemo(() => {
    if (!busca.trim()) {
      return stockItems.map(item => ({
        id: item.id,
        sku: item.sku || item.imported_sku || '',
        nome: item.nome || item.product_name || 'Sem nome',
        descricao: item.descricao || item.description || '',
        categoria: item.categoria || item.category || '',
        preco: item.preco || item.price || 0,
        estoque: item.quantidade || item.quantity || 0,
      }));
    }

    const searchLower = busca.toLowerCase().trim();
    return stockItems
      .filter(item => {
        const sku = (item.sku || item.imported_sku || '').toLowerCase();
        const nome = (item.nome || item.product_name || '').toLowerCase();
        const descricao = (item.descricao || item.description || '').toLowerCase();

        return (
          sku.includes(searchLower) ||
          nome.includes(searchLower) ||
          descricao.includes(searchLower)
        );
      })
      .map(item => ({
        id: item.id,
        sku: item.sku || item.imported_sku || '',
        nome: item.nome || item.product_name || 'Sem nome',
        descricao: item.descricao || item.description || '',
        categoria: item.categoria || item.category || '',
        preco: item.preco || item.price || 0,
        estoque: item.quantidade || item.quantity || 0,
      }));
  }, [busca, stockItems]);

  const handleVincular = useCallback(async () => {
    if (!selecionado) {
      addToast?.('Selecione um produto principal', 'error');
      return;
    }

    setIsCarregando(true);
    try {
      await onVincular(skuImportado, selecionado);
      addToast?.(`✅ SKU vinculado com sucesso!`, 'success');
      onClose();
    } catch (error: any) {
      addToast?.(`❌ Erro ao vincular: ${error.message}`, 'error');
    } finally {
      setIsCarregando(false);
    }
  }, [selecionado, skuImportado, onVincular, addToast, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Link2 size={20} />
              Vincular SKU com Produto Principal
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              SKU Importado: <span className="font-mono font-bold">{skuImportado}</span>
            </p>
            {descricaoItem && (
              <p className="text-blue-100 text-sm">
                Item: <span className="font-semibold">{descricaoItem}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-500 rounded-lg transition"
          >
            <X size={20} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Aviso se já vinculado */}
          {jáVinculado && (
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">SKU já vinculado</p>
                <p className="text-amber-800 text-sm">
                  Este SKU está vinculado com: <span className="font-mono font-bold">{jáVinculado}</span>
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Selecione outro produto para alterar o vínculo
                </p>
              </div>
            </div>
          )}

          {/* Busca */}
          <div className="p-4 border-b">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              🔍 Buscar Produto Principal
            </label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Busque por SKU, nome ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isCarregando}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {produtosDisponiveis.length} produto(s) encontrado(s)
            </p>
          </div>

          {/* Lista de produtos */}
          <div className="flex-1 overflow-y-auto">
            {produtosDisponiveis.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="divide-y">
                {produtosDisponiveis.map((produto) => (
                  <div
                    key={produto.id}
                    onClick={() => setSelecionado(produto.sku)}
                    className={`p-4 cursor-pointer transition ${
                      selecionado === produto.sku
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* SKU */}
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {produto.sku || 'SEM SKU'}
                          </span>
                          {selecionado === produto.sku && (
                            <CheckCircle size={18} className="text-green-600" />
                          )}
                        </div>

                        {/* Nome e Descrição */}
                        <p className="font-semibold text-slate-900 mt-1">{produto.nome}</p>
                        {produto.descricao && (
                          <p className="text-sm text-slate-600 mt-0.5 truncate">
                            {produto.descricao}
                          </p>
                        )}

                        {/* Metadados */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          {produto.categoria && (
                            <span className="bg-slate-100 px-2 py-1 rounded">
                              📁 {produto.categoria}
                            </span>
                          )}
                          {produto.estoque !== undefined && (
                            <span className={produto.estoque > 0 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                              📦 {produto.estoque} em estoque
                            </span>
                          )}
                          {produto.preco > 0 && (
                            <span className="text-blue-600">
                              💰 R$ {produto.preco.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Visual */}
                      <div className="text-right">
                        {selecionado === produto.sku && (
                          <div className="text-center">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                              <CheckCircle size={18} className="text-green-600" />
                            </div>
                            <p className="text-xs text-green-700 font-semibold mt-1">
                              Selecionado
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t p-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isCarregando}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
          >
            ✕ Cancelar
          </button>
          <button
            onClick={handleVincular}
            disabled={!selecionado || isCarregando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
          >
            {isCarregando ? (
              <>
                <span className="animate-spin">⏳</span> Vinculando...
              </>
            ) : (
              <>
                <Link2 size={18} /> Vincular Agora
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VincularSKUEmDANFEModal;
