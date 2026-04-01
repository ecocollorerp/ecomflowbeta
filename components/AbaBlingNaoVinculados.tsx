// ============================================================================
// components/AbaBlingNaoVinculados.tsx
// Aba para visualizar e importar pedidos Bling que não estão no ERP
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  DownloadCloud,
  AlertTriangle,
  CheckCircle2,
  Package,
  DollarSign,
  Calendar,
  Warehouse,
  Loader,
  Store,
  TrendingUp,
} from 'lucide-react';
import { importacaoControllerService } from '../services/importacaoControllerService';
import type { PedidoblingNaoVinculado } from '../services/importacaoControllerService';

interface AbaBlingNaoVinculadosProps {
  token?: string;
  onImportarSucesso?: () => void;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
  usuarioId?: string;
}

type OrigemFiltro = 'TODOS' | 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' | 'OUTRO';

export const AbaBlingNaoVinculados: React.FC<AbaBlingNaoVinculadosProps> = ({
  token,
  onImportarSucesso,
  addToast,
  usuarioId = 'sistema',
}) => {
  const [pedidos, setPedidos] = useState<PedidoblingNaoVinculado[]>([]);
  const [isCarregando, setIsCarregando] = useState(false);
  const [isProcessando, setIsProcessando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [filtroOrigem, setFiltroOrigem] = useState<OrigemFiltro>('TODOS');
  const [busca, setBusca] = useState('');

  // Carregar pedidos não vinculados
  const handleCarregarPedidos = async () => {
    if (!token) {
      addToast?.('❌ Token Bling não configurado', 'error');
      return;
    }

    setIsCarregando(true);
    try {
      const { pedidosNaoVinculados, avisos } =
        await importacaoControllerService.buscarPedidosNaoVinculados(token);

      setPedidos(pedidosNaoVinculados);
      
      avisos.forEach(aviso => {
        addToast?.(aviso, 'info');
      });

      if (pedidosNaoVinculados.length === 0) {
        addToast?.('✅ Todos os pedidos já estão vinculados!', 'success');
      }
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsCarregando(false);
    }
  };

  // Importar pedidos selecionados
  const handleImportarSelecionados = async () => {
    if (selecionados.size === 0) {
      addToast?.('❌ Selecione pelo menos um pedido', 'error');
      return;
    }

    setIsProcessando(true);
    try {
      const pedidoIds = Array.from(selecionados)
        .map(id => {
          const pedido = pedidos.find(p => p.id === id);
          return pedido?.numero || id;
        });

      const importacao = await importacaoControllerService.solicitarImportacao(
        pedidoIds,
        usuarioId
      );

      addToast?.(`📥 ${selecionados.size} pedido(s) marcado(s) para importação`, 'success');
      onImportarSucesso?.();
      setSelecionados(new Set());
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setIsProcessando(false);
    }
  };

  // Filtrar pedidos
  const pedidosFiltrados = pedidos
    .filter(p => filtroOrigem === 'TODOS' || p.origem === filtroOrigem)
    .filter(p => {
      const searchLower = busca.toLowerCase();
      return (
        p.numero.toLowerCase().includes(searchLower) ||
        p.cliente.nome.toLowerCase().includes(searchLower) ||
        p.cliente.cpfCnpj.includes(searchLower)
      );
    });

  // Análises
  const origens = importacaoControllerService.analisarOrigens(pedidos);
  const valorTotal = importacaoControllerService.calcularValorTotal(pedidos);
  const porStatus = importacaoControllerService.agruparPorStatus(pedidos);

  // Auto-carregar ao montar
  useEffect(() => {
    if (token) {
      handleCarregarPedidos();
    }
  }, [token]);

  const badges: Record<OrigemFiltro, { label: string; bg: string; icon: string }> = {
    TODOS: { label: 'Todos', bg: 'bg-slate-100', icon: '📦' },
    SHOPEE: { label: 'Shopee', bg: 'bg-red-100', icon: '🔴' },
    MERCADO_LIVRE: { label: 'Mercado Livre', bg: 'bg-yellow-100', icon: '🟡' },
    SITE: { label: 'Site', bg: 'bg-blue-100', icon: '🌐' },
    OUTRO: { label: 'Outro', bg: 'bg-slate-100', icon: '❓' },
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header com Botões */}
      <div className="bg-white border-b p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-900">
            <Warehouse size={20} />
            Pedidos Bling Não Vinculados
          </h3>
          <p className="text-sm text-slate-500">
            Lista de pedidos do Bling que ainda não foram importados para o ERP
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCarregarPedidos}
            disabled={isCarregando || isProcessando}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 font-semibold"
          >
            {isCarregando ? <Loader size={18} className="animate-spin" /> : <DownloadCloud size={18} />}
            {isCarregando ? 'Carregando...' : 'Recarregar'}
          </button>

          {selecionados.size > 0 && (
            <button
              onClick={handleImportarSelecionados}
              disabled={isProcessando}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 font-semibold animate-pulse"
            >
              <Package size={18} />
              Importar {selecionados.size}
            </button>
          )}
        </div>
      </div>

      {/* Estatísticas Rápidas */}
      {pedidos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-slate-100">
          <div className="bg-white rounded-lg p-3 border-l-4 border-blue-500">
            <div className="text-xs text-slate-500 uppercase font-bold">Total Pedidos</div>
            <div className="text-2xl font-bold text-blue-600">{pedidos.length}</div>
          </div>

          <div className="bg-white rounded-lg p-3 border-l-4 border-green-500">
            <div className="text-xs text-slate-500 uppercase font-bold">Valor Total</div>
            <div className="text-xl font-bold text-green-600">
              R$ {valorTotal.toFixed(2)}
            </div>
          </div>

          {Object.entries(origens).map(([origem, count]) => {
            const origem_key = origem as OrigemFiltro;
            const badge = badges[origem_key] || badges.OUTRO;
            return (
              <div key={origem} className="bg-white rounded-lg p-3 border-l-4 border-amber-500">
                <div className="text-xs text-slate-500 uppercase font-bold">{badge.icon} {badge.label}</div>
                <div className="text-2xl font-bold text-amber-600">{count}</div>
              </div>
            );
          })}

          <div className="bg-white rounded-lg p-3 border-l-4 border-purple-500">
            <div className="text-xs text-slate-500 uppercase font-bold">Selecionados</div>
            <div className="text-2xl font-bold text-purple-600">{selecionados.size}</div>
          </div>
        </div>
      )}

      {/* Controles de Filtro */}
      <div className="bg-white border-b p-4 flex flex-wrap gap-3">
        {/* Filtro por Origem */}
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Origem da Loja:</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(badges).map(([key, badge]) => (
              <button
                key={key}
                onClick={() => setFiltroOrigem(key as OrigemFiltro)}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition ${
                  filtroOrigem === key
                    ? 'bg-blue-600 text-white'
                    : `${badge.bg} text-slate-700 hover:bg-opacity-70`
                }`}
              >
                {badge.icon} {badge.label}
              </button>
            ))}
          </div>
        </div>

        {/* Busca */}
        <div className="flex-1 min-w-[250px]">
          <label className="text-sm font-semibold text-slate-700 block mb-2">Buscar:</label>
          <input
            type="text"
            placeholder="Número do pedido, cliente, CPF..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="flex-1 overflow-y-auto">
        {pedidos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            {isCarregando ? (
              <>
                <Loader size={40} className="animate-spin mb-3" />
                <p>Carregando pedidos...</p>
              </>
            ) : (
              <>
                <CheckCircle2 size={40} className="mb-3 text-green-500" />
                <p className="text-lg font-semibold">Nenhum pedido não vinculado</p>
                <p className="text-sm">Todos os pedidos do Bling já estão importados! 🎉</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {pedidosFiltrados.map((pedido) => (
              <div
                key={pedido.id}
                className={`p-4 hover:bg-slate-50 transition ${
                  selecionados.has(pedido.id) ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selecionados.has(pedido.id)}
                    onChange={(e) => {
                      const novo = new Set(selecionados);
                      if (e.target.checked) {
                        novo.add(pedido.id);
                      } else {
                        novo.delete(pedido.id);
                      }
                      setSelecionados(novo);
                    }}
                    className="mt-1.5 w-5 h-5 cursor-pointer"
                  />

                  {/* Conteúdo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Badge Origem */}
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${badges[pedido.origem as OrigemFiltro]?.bg || 'bg-slate-100'}`}>
                        {pedido.origem}
                      </span>
                      {/* Número */}
                      <span className="font-mono font-bold text-blue-600">PED-{pedido.numero}</span>
                      {pedido.numeroLoja && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-semibold">
                          Loja: {pedido.numeroLoja}
                        </span>
                      )}
                    </div>

                    {/* Cliente */}
                    <p className="font-semibold text-slate-900">{pedido.cliente.nome}</p>
                    <p className="text-sm text-slate-600">
                      {pedido.cliente.cpfCnpj}
                      {pedido.cliente.email && ` • ${pedido.cliente.email}`}
                    </p>

                    {/* Itens e Valor */}
                    <div className="mt-2 text-sm text-slate-700">
                      <p>📦 {pedido.itens.length} item(ns)</p>
                      <p className="font-semibold text-green-600">
                        💰 R$ {pedido.total.toFixed(2)}
                      </p>
                    </div>

                    {/* Status e Data */}
                    <div className="flex gap-4 mt-2 text-xs text-slate-500">
                      <span className="uppercase px-2 py-0.5 bg-slate-100 rounded">
                        Status: {pedido.status || 'desconhecido'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(pedido.dataCompra).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Check Visual */}
                  {selecionados.has(pedido.id) && (
                    <div className="text-green-600 mt-1">
                      <CheckCircle2 size={20} />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {pedidosFiltrados.length === 0 && pedidos.length > 0 && (
              <div className="p-4 sm:p-8 text-center text-slate-500">
                <AlertTriangle size={40} className="mx-auto mb-2 opacity-50" />
                <p>Nenhum pedido encontrado com os filtros aplicados</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer com Stats */}
      {pedidosFiltrados.length > 0 && (
        <div className="bg-white border-t p-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            Mostrando <strong>{pedidosFiltrados.length}</strong> de{' '}
            <strong>{pedidos.length}</strong> pedido(s)
          </span>
          {selecionados.size > 0 && (
            <span className="text-blue-600 font-semibold">
              {selecionados.size} selecionado(s) • R${' '}
              {Array.from(selecionados)
                .reduce((sum, id) => {
                  const p = pedidos.find(x => x.id === id);
                  return sum + (p?.total || 0);
                }, 0)
                .toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AbaBlingNaoVinculados;
