// ============================================================================
// components/AbaImportacaoPedidosBling.tsx
// Aba para importação de pedidos em aberto do Bling
// ============================================================================

import React, { useState } from 'react';
import {
  ShoppingCart,
  Package,
  Truck,
  Loader2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Filter,
  Search,
} from 'lucide-react';
import { importacaoControllerService } from '../services/importacaoControllerService';
import { getPlatformLabel } from '../utils/platformLabels';

interface AbaImportacaoPedidosBlingProps {
  token?: string;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

type PlataformaSelecionada = 'MERCADO_LIVRE' | 'SHOPEE' | null;

interface PedidoEmAberto {
  id: string;
  numero: string;
  numeroLoja: string;
  dataCompra: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
  };
  origem: string;
  itens: Array<{
    descricao: string;
    sku: string;
    quantidade: number;
    valor: number;
  }>;
  total: number;
  status: string;
  jaImportado: boolean;
}

export const AbaImportacaoPedidosBling: React.FC<AbaImportacaoPedidosBlingProps> = ({
  token,
  addToast,
}) => {
  const [plataformaSelecionada, setPlataformaSelecionada] = useState<PlataformaSelecionada>(null);
  const [pedidosEmAberto, setPedidosEmAberto] = useState<PedidoEmAberto[]>([]);
  const [isCarregandoPedidos, setIsCarregandoPedidos] = useState(false);
  const [pedidosSelecionados, setPedidosSelecionados] = useState<Set<string>>(new Set());
  const [isGerandoNfe, setIsGerandoNfe] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [apenasComEtiqueta, setApenasComEtiqueta] = useState(false);

  // Buscar pedidos em aberto por plataforma
  const buscarPedidosEmAberto = async () => {
    if (!token || !plataformaSelecionada) {
      addToast?.('❌ Selecione uma plataforma primeiro', 'error');
      return;
    }

    setIsCarregandoPedidos(true);
    try {
      const resultado = await importacaoControllerService.buscarPedidosEmAbertoPorPlataforma(
        token,
        plataformaSelecionada,
        { 
          quantidadeDesejada: 100,
          apenasComEtiqueta: plataformaSelecionada === 'MERCADO_LIVRE' && apenasComEtiqueta
        }
      );

      setPedidosEmAberto(resultado.pedidosDisponiveis);
      addToast?.(
        `✅ Encontrados ${resultado.pedidosDisponiveis.length} pedidos em aberto`,
        'success'
      );
    } catch (error: any) {
      addToast?.(`❌ Erro ao buscar pedidos: ${error.message}`, 'error');
    } finally {
      setIsCarregandoPedidos(false);
    }
  };

  // Gerar NF-e para pedidos selecionados
  const gerarNfeParaSelecionados = async () => {
    if (pedidosSelecionados.size === 0) {
      addToast?.('❌ Selecione pelo menos um pedido', 'error');
      return;
    }

    // Perguntar se deseja salvar e vincular
    const confirmar = window.confirm(
      `Deseja gerar NF-e para ${pedidosSelecionados.size} pedido(s) selecionado(s)?\n\n` +
      'Isso irá:\n' +
      '1. Gerar a NF-e no Bling\n' +
      '2. Emitir a NF-e automaticamente\n' +
      '3. Salvar no ERP\n' +
      '4. Vincular o pedido à NF-e'
    );

    if (!confirmar) return;

    setIsGerandoNfe(true);
    try {
      const response = await fetch('/api/bling/nfe/gerar-lote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          pedidoVendaIds: Array.from(pedidosSelecionados),
          salvar: true,
          vincular: true
        })
      });

      const data = await response.json();

      if (data.success) {
        addToast?.(`✅ ${data.ok}/${data.total} NF-e(s) gerada(s) com sucesso!`, 'success');
        
        // Limpar seleção após sucesso
        setPedidosSelecionados(new Set());
        
        // Opcional: recarregar lista de pedidos
        buscarPedidosEmAberto();
      } else {
        addToast?.(`❌ ${data.fail}/${data.total} NF-e(s) falharam. Verifique os detalhes.`, 'error');
        console.error('Detalhes dos erros:', data.resultados);
      }
    } catch (error: any) {
      addToast?.(`❌ Erro ao gerar NF-e: ${error.message}`, 'error');
    } finally {
      setIsGerandoNfe(false);
    }
  };

  // Filtrar pedidos baseado no texto
  const pedidosFiltrados = pedidosEmAberto.filter(pedido =>
    filtroTexto === '' ||
    pedido.numero.toLowerCase().includes(filtroTexto.toLowerCase()) ||
    pedido.cliente.nome.toLowerCase().includes(filtroTexto.toLowerCase()) ||
    pedido.numeroLoja.toLowerCase().includes(filtroTexto.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <ShoppingCart size={32} className="text-blue-600 flex-shrink-0" />
          <div>
            <h2 className="text-2xl font-bold text-blue-900">
              📦 Importação de Pedidos (Bling)
            </h2>
            <p className="text-sm text-blue-700 mt-2">
              Importe pedidos em aberto do Bling, filtre por plataforma e gere NF-e automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Aviso se não tem token */}
      {!token && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-1" />
          <div>
            <p className="font-bold text-red-900">Token Bling não configurado</p>
            <p className="text-sm text-red-800 mt-1">
              Acesse as configurações e configure seu token Bling para usar esta funcionalidade.
            </p>
          </div>
        </div>
      )}

      {token && (
        <>
          {/* Seleção de Plataforma */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Selecionar Plataforma</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setPlataformaSelecionada('MERCADO_LIVRE')}
                className={`p-4 rounded-lg border-2 transition ${
                  plataformaSelecionada === 'MERCADO_LIVRE'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-200 hover:border-yellow-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Package size={24} className="text-yellow-600" />
                  <div>
                    <p className="font-bold text-gray-900">{getPlatformLabel('ML').displayName}</p>
                    <p className="text-sm text-gray-600">Pedidos com etiqueta disponível</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setPlataformaSelecionada('SHOPEE')}
                className={`p-4 rounded-lg border-2 transition ${
                  plataformaSelecionada === 'SHOPEE'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart size={24} className="text-red-600" />
                  <div>
                    <p className="font-bold text-gray-900">{getPlatformLabel('SHOPEE').displayName}</p>
                    <p className="text-sm text-gray-600">Todos os pedidos em aberto</p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Buscar Pedidos */}
          {plataformaSelecionada && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4 gap-4">
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-gray-900">
                    Pedidos de {plataformaSelecionada === 'MERCADO_LIVRE' ? getPlatformLabel('ML').displayName : getPlatformLabel('SHOPEE').displayName}
                  </h3>
                  
                  {/* Checkbox para filtrar por etiqueta disponível no MercadoLivre */}
                  {plataformaSelecionada === 'MERCADO_LIVRE' && (
                    <label className="flex items-center gap-2 mt-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apenasComEtiqueta}
                        onChange={(e) => setApenasComEtiqueta(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-gray-700">Apenas pedidos com etiqueta disponível</span>
                    </label>
                  )}
                </div>
                <button
                  onClick={buscarPedidosEmAberto}
                  disabled={isCarregandoPedidos}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                >
                  {isCarregandoPedidos ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  Buscar Pedidos
                </button>
              </div>

              {/* Barra de Filtro */}
              {pedidosEmAberto.length > 0 && (
                <div className="mb-4">
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por número do pedido, cliente..."
                      value={filtroTexto}
                      onChange={(e) => setFiltroTexto(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {/* Lista de Pedidos */}
              {pedidosFiltrados.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      {pedidosFiltrados.length} de {pedidosEmAberto.length} pedidos
                    </p>
                    <button
                      onClick={gerarNfeParaSelecionados}
                      disabled={pedidosSelecionados.size === 0 || isGerandoNfe}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {isGerandoNfe ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Truck size={16} />
                      )}
                      Gerar NF-e ({pedidosSelecionados.size})
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    {pedidosFiltrados.map((pedido) => (
                      <div
                        key={pedido.id}
                        className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                          pedidosSelecionados.has(pedido.id) ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={pedidosSelecionados.has(pedido.id)}
                            onChange={(e) => {
                              const newSelecionados = new Set(pedidosSelecionados);
                              if (e.target.checked) {
                                newSelecionados.add(pedido.id);
                              } else {
                                newSelecionados.delete(pedido.id);
                              }
                              setPedidosSelecionados(newSelecionados);
                            }}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">
                                Pedido #{pedido.numero}
                                {pedido.numeroLoja && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    (Loja: {pedido.numeroLoja})
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-gray-500">
                                {new Date(pedido.dataCompra).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600">
                              Cliente: {pedido.cliente.nome}
                            </p>
                            <p className="text-sm text-gray-600">
                              {pedido.itens.length} itens • R$ {pedido.total.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Status: {pedido.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pedidosEmAberto.length === 0 && !isCarregandoPedidos && (
                <div className="text-center py-8 text-gray-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Nenhum pedido encontrado. Clique em "Buscar Pedidos" para carregar.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};