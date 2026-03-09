import React, { useState, useMemo, useCallback } from 'react';
import { Filter, X, Search, Eye, Download, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';
import { StockItem, SkuLink } from '../types';

interface AutorizadoSemDANFEItem {
  pedidoId: string;
  pedidoNumero: string;
  skuImportado: string;
  skuMestre?: string;
  quantidade: number;
  cliente: string;
  status: 'autorizado_nf_pendente' | 'autorizado_nf_processando' | 'autorizado_sku_invalido';
  erroMsg?: string;
  dataAutorizacao: string;
}

interface FiltroAutorisadoSemDANFEProps {
  isOpen: boolean;
  onClose: () => void;
  itens: AutorizadoSemDANFEItem[];
  stockItems: StockItem[];
  skuLinks: SkuLink[];
  onProcessarPedidos: (selecionados: AutorizadoSemDANFEItem[]) => void;
  onGerar DANFE: (item: AutorizadoSemDANFEItem) => void;
  addToast: (msg: string, type: string) => void;
}

const FiltroAutorisadoSemDANFE: React.FC<FiltroAutorisadoSemDANFEProps> = ({
  isOpen,
  onClose,
  itens,
  stockItems,
  skuLinks,
  onProcessarPedidos,
  onGerarDANFE,
  addToast
}) => {
  const [filtroSku, setFiltroSku] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'validos' | 'invalidos'>('todos');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'data' | 'numero'>('data');

  // Map de SKU mestre para StockItem
  const skuMestreMap = useMemo(() => {
    const map = new Map<string, StockItem>();
    stockItems.forEach(item => {
      map.set(item.code, item);
    });
    return map;
  }, [stockItems]);

  // Resolver SKU mestre
  const resolverSkuMestre = useCallback((skuImportado: string): string | undefined => {
    const link = skuLinks.find(l => l.imported_sku === skuImportado);
    return link?.master_product_sku;
  }, [skuLinks]);

  // Validar se SKU existe no estoque
  const validarSku = useCallback((skuMestre: string | undefined): boolean => {
    if (!skuMestre) return false;
    return skuMestreMap.has(skuMestre);
  }, [skuMestreMap]);

  // Filtrar e enriquecer itens
  const itensFiltrados = useMemo(() => {
    return itens
      .map(item => {
        const skuMestre = resolverSkuMestre(item.skuImportado);
        const ehValido = validarSku(skuMestre);
        const stockInfo = skuMestre ? skuMestreMap.get(skuMestre) : undefined;

        return {
          ...item,
          skuMestre,
          status: ehValido ? 'autorizado_nf_pendente' : 'autorizado_sku_invalido'
        } as AutorizadoSemDANFEItem;
      })
      .filter(item => {
        // Filtro por SKU (importado ou mestre)
        if (filtroSku) {
          const termo = filtroSku.toLowerCase();
          const matchImportado = item.skuImportado.toLowerCase().includes(termo);
          const matchMestre = item.skuMestre?.toLowerCase().includes(termo);
          if (!matchImportado && !matchMestre) return false;
        }

        // Filtro por status
        if (filtroStatus === 'validos' && item.status === 'autorizado_sku_invalido') return false;
        if (filtroStatus === 'invalidos' && item.status !== 'autorizado_sku_invalido') return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'data') {
          return new Date(b.dataAutorizacao).getTime() - new Date(a.dataAutorizacao).getTime();
        }
        return parseInt(b.pedidoNumero) - parseInt(a.pedidoNumero);
      });
  }, [itens, filtroSku, filtroStatus, sortBy, resolverSkuMestre, validarSku, skuMestreMap]);

  const handleToggleSelecao = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) {
      novo.delete(id);
    } else {
      novo.add(id);
    }
    setSelecionados(novo);
  };

  const handleSelecionarTodos = () => {
    if (selecionados.size === itensFiltrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(itensFiltrados.map(i => i.pedidoId)));
    }
  };

  const handleProcessar = () => {
    const itensSelecionados = itensFiltrados.filter(i => selecionados.has(i.pedidoId));
    if (itensSelecionados.length === 0) {
      addToast('Selecione ao menos um pedido', 'warning');
      return;
    }
    onProcessarPedidos(itensSelecionados);
  };

  if (!isOpen) return null;

  const statsValidos = itensFiltrados.filter(i => i.status !== 'autorizado_sku_invalido').length;
  const statsInvalidos = itensFiltrados.filter(i => i.status === 'autorizado_sku_invalido').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Filter size={24} className="text-blue-600" />
              Autorizado sem DANFE - Filtro por SKU
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pedidos autorizados no Bling aguardando emissão de NFe
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Estatísticas */}
        <div className="bg-gray-50 px-6 py-3 border-b flex gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-green-600" size={18} />
            <span className="text-sm">
              <strong>{statsValidos}</strong> com SKU válido
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={18} />
            <span className="text-sm">
              <strong>{statsInvalidos}</strong> com SKU inválido
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              <strong>{itensFiltrados.length}</strong> total
            </span>
          </div>
        </div>

        {/* Controles de Filtro */}
        <div className="bg-white px-6 py-4 border-b space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Busca por SKU */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Buscar por SKU
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="SKU importado ou principal..."
                  value={filtroSku}
                  onChange={(e) => setFiltroSku(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtro Status */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="todos">Todos</option>
                <option value="validos">SKU Válidos</option>
                <option value="invalidos">SKU Inválidos</option>
              </select>
            </div>

            {/* Ordenação */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Ordenar por
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="data">Data (Recente)</option>
                <option value="numero">Número Pedido</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selecionados.size === itensFiltrados.length && itensFiltrados.length > 0}
                    onChange={handleSelecionarTodos}
                    className="rounded cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Pedido</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SKU Importado</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">SKU Mestre</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Qtd</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : (
                itensFiltrados.map(item => (
                  <tr
                    key={item.pedidoId}
                    className={`hover:bg-blue-50 ${
                      item.status === 'autorizado_sku_invalido' ? 'bg-red-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selecionados.has(item.pedidoId)}
                        onChange={() => handleToggleSelecao(item.pedidoId)}
                        className="rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">#{item.pedidoNumero}</td>
                    <td className="px-4 py-3 font-mono text-blue-600">{item.skuImportado}</td>
                    <td className="px-4 py-3 font-mono">
                      {item.skuMestre ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                          {item.skuMestre}
                        </span>
                      ) : (
                        <span className="text-red-600 font-semibold text-xs">NÃO VINCULADO</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{item.quantidade}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs">{item.cliente}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onGerarDANFE(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                      >
                        <Download size={12} />
                        DANFE
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {selecionados.size > 0 && `${selecionados.size} pedido(s) selecionado(s)`}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleProcessar}
              disabled={selecionados.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              <SkipForward size={16} className="inline mr-2" />
              Processar Selecionados
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiltroAutorisadoSemDANFE;
