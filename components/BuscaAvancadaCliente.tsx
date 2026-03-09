import React, { useState, useCallback, useMemo } from 'react';
import { Search, X, Eye, Download, Filter, AlertCircle, CheckCircle } from 'lucide-react';

interface ClienteAvancado {
  id: string;
  nome: string;
  cpfCnpj: string;
  email?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
}

interface PedidoAvancado {
  id: string;
  numeroPedidoVirtual?: string;
  numeroPedidoBling?: string;
  numeroNotaFiscal?: string;
  cliente: ClienteAvancado;
  data: string;
  total: number;
  status: string;
  itens: number;
}

interface BuscaAvancadaClienteProps {
  pedidos: PedidoAvancado[];
  onSelecionarPedido?: (pedido: PedidoAvancado) => void;
  onExportarSelecionados?: (pedidos: PedidoAvancado[]) => void;
  titulo?: string;
  addToast?: (msg: string, tipo: string) => void;
}

const BuscaAvancadaCliente: React.FC<BuscaAvancadaClienteProps> = ({
  pedidos,
  onSelecionarPedido,
  onExportarSelecionados,
  titulo = 'Busca Avançada de Pedidos',
  addToast = () => {}
}) => {
  const [busca, setBusca] = useState('');
  const [tipoBusca, setTipoBusca] = useState<'todos' | 'cpf_cnpj' | 'numero_pedido' | 'nfe' | 'nome_cliente'>('todos');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'aberto' | 'autorizado' | 'cancelado'>('todos');

  // Sanitizar entrada para busca
  const sanitizarBusca = (texto: string): string => {
    return texto.toLowerCase().trim().replace(/[^\w\s\-]/g, '');
  };

  // Extrair números de CPF/CNPJ
  const normalizarDocumento = (doc: string): string => {
    return doc.replace(/[^\d]/g, '');
  };

  // Realizar busca avançada
  const resultados = useMemo(() => {
    if (!busca.trim()) return pedidos;

    const buscaSanitizada = sanitizarBusca(busca);
    const buscaNumeros = normalizarDocumento(busca);

    return pedidos.filter(pedido => {
      // Filtro de status
      if (statusFiltro !== 'todos' && pedido.status.toLowerCase() !== statusFiltro) {
        return false;
      }

      // Pesquisa por tipo
      switch (tipoBusca) {
        case 'todos': {
          // Busca em todos os campos
          const tempoNome = pedido.cliente.nome.toLowerCase().includes(buscaSanitizada);
          const tempoDocumento = normalizarDocumento(pedido.cliente.cpfCnpj).includes(buscaNumeros);
          const tempoPedidoVirtual = pedido.numeroPedidoVirtual?.toLowerCase().includes(buscaSanitizada);
          const tempoPedidoBling = pedido.numeroPedidoBling?.toLowerCase().includes(buscaSanitizada);
          const tempoNFe = pedido.numeroNotaFiscal?.toLowerCase().includes(buscaSanitizada);

          return tempoNome || tempoDocumento || tempoPedidoVirtual || tempoPedidoBling || tempoNFe;
        }

        case 'cpf_cnpj':
          return normalizarDocumento(pedido.cliente.cpfCnpj).includes(buscaNumeros);

        case 'numero_pedido':
          return (
            pedido.numeroPedidoVirtual?.toLowerCase().includes(buscaSanitizada) ||
            pedido.numeroPedidoBling?.toLowerCase().includes(buscaSanitizada)
          );

        case 'nfe':
          return pedido.numeroNotaFiscal?.toLowerCase().includes(buscaSanitizada);

        case 'nome_cliente':
          return pedido.cliente.nome.toLowerCase().includes(buscaSanitizada);

        default:
          return true;
      }
    });
  }, [busca, tipoBusca, statusFiltro, pedidos]);

  // Lidar com seleção
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
    if (selecionados.size === resultados.length && resultados.length > 0) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(resultados.map(p => p.id)));
    }
  };

  const handleExportarSelecionados = () => {
    if (selecionados.size === 0) {
      addToast('Selecione ao menos um pedido', 'warning');
      return;
    }

    const pedidosSelecionados = resultados.filter(p => selecionados.has(p.id));
    onExportarSelecionados?.(pedidosSelecionados);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Search size={24} className="text-blue-600" />
          {titulo}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Busque por CPF/CNPJ, número do pedido virtual, número Bling ou número de NFe
        </p>
      </div>

      {/* Controles de Busca */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Campo de Busca*/}
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            O que você procura?
          </label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="CPF, CNPJ, número pedido, NFe..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Tipo de Busca */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Tipo de Busca
          </label>
          <select
            value={tipoBusca}
            onChange={(e) => setTipoBusca(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="todos">Todos os campos</option>
            <option value="cpf_cnpj">CPF / CNPJ</option>
            <option value="numero_pedido">Número Pedido</option>
            <option value="nfe">Nota Fiscal (NFe)</option>
            <option value="nome_cliente">Nome Cliente</option>
          </select>
        </div>

        {/* Filtro Status */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Status
          </label>
          <select
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="aberto">Aberto</option>
            <option value="autorizado">Autorizado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Resultados Info */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-sm text-blue-800">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={16} />
          <strong>{resultados.length} resultado(s) encontrado(s)</strong>
        </div>
        {selecionados.size > 0 && (
          <p className="text-blue-700 mt-2">
            {selecionados.size} pedido(s) selecionado(s)
          </p>
        )}
      </div>

      {/* Tabela de Resultados */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selecionados.size === resultados.length && resultados.length > 0}
                  onChange={handleSelecionarTodos}
                  className="rounded cursor-pointer"
                />
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">CPF/CNPJ</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Pedido Virtual</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Pedido Bling</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">NFe</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Data</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {resultados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  <AlertCircle size={24} className="mx-auto mb-2 text-gray-400" />
                  Nenhum pedido encontrado para essa busca
                </td>
              </tr>
            ) : (
              resultados.map(pedido => (
                <tr
                  key={pedido.id}
                  className="hover:bg-blue-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selecionados.has(pedido.id)}
                      onChange={() => handleToggleSelecao(pedido.id)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div>
                      <p className="font-semibold">{pedido.cliente.nome}</p>
                      {pedido.cliente.cidade && (
                        <p className="text-xs text-gray-500">{pedido.cliente.cidade}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-gray-700">
                    {pedido.cliente.cpfCnpj}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pedido.numeroPedidoVirtual ? (
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-mono">
                        {pedido.numeroPedidoVirtual}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pedido.numeroPedidoBling ? (
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-mono">
                        {pedido.numeroPedidoBling}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {pedido.numeroNotaFiscal ? (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-mono flex items-center justify-center gap-1 w-fit mx-auto">
                        <CheckCircle size={12} />
                        {pedido.numeroNotaFiscal}
                      </span>
                    ) : (
                      <span className="text-gray-400">Pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    {new Date(pedido.data).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      pedido.status === 'aberto' ? 'bg-amber-100 text-amber-800' :
                      pedido.status === 'autorizado' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {pedido.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelecionarPedido?.(pedido)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition"
                    >
                      <Eye size={12} />
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {resultados.length > 0 && (
        <div className="flex justify-between items-center p-4 bg-gray-50 border-t rounded-b">
          <span className="text-sm text-gray-600">
            {selecionados.size > 0 ? `${selecionados.size} selecionado(s)` : 'Nenhum selecionado'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelecionados(new Set())}
              className="px-3 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 text-sm transition"
            >
              Limpar Seleção
            </button>
            <button
              onClick={handleExportarSelecionados}
              disabled={selecionados.size === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm transition flex items-center gap-2"
            >
              <Download size={14} />
              Exportar Selecionados
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuscaAvancadaCliente;
