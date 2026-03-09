// ============================================================================
// components/FluxoCompleteEtiquetasDobling.tsx
// Componente para execur fluxo completo: TXT → Upload → ZPL → Processar
// ============================================================================

import React, { useState } from 'react';
import {
  Download,
  Upload,
  Zap,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Package,
  Plus,
  Minus,
} from 'lucide-react';
import { etiquetaBlingFluxoCompleto } from '../services/etiquetaBlingFluxoCompleto';
import { importacaoControllerService } from '../services/importacaoControllerService';

interface FluxoCompleteEtiquetasProps {
  token?: string;
  tipoPedidos?: 'nfe' | 'mercado_livre';
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const FluxoCompleteEtiquetas: React.FC<FluxoCompleteEtiquetasProps> = ({
  token,
  tipoPedidos = 'nfe',
  addToast,
}) => {
  const [pedidosSelecionados, setPedidosSelecionados] = useState<any[]>([]);
  const [quantidadeDesejada, setQuantidadeDesejada] = useState(10);
  const [isCarregando, setIsCarregando] = useState(false);
  const [isProcessando, setIsProcessando] = useState(false);
  const [progresso, setProgresso] = useState<{
    total: number;
    processados: number;
    erros: number;
  } | null>(null);
  const [resultados, setResultados] = useState<any[]>([]);

  // Buscar pedidos
  const handleBuscarPedidos = async () => {
    if (!token) {
      addToast?.('❌ Token não configurado', 'error');
      return;
    }

    setIsCarregando(true);
    try {
      if (tipoPedidos === 'nfe') {
        const { pedidosDisponiveis, total, quantidadeDesejada: qtd } =
          await importacaoControllerService.buscarPedidosNfeComSelecaoCustomizada(
            token,
            { quantidadeDesejada }
          );
        setPedidosSelecionados(pedidosDisponiveis);
        addToast?.(
          `✅ Carregado ${pedidosDisponiveis.length} de ${total} pedidos`,
          'success'
        );
      } else if (tipoPedidos === 'mercado_livre') {
        const { pedidos } =
          await importacaoControllerService.buscarMercadoLivreComEtiquetaPronta(
            token
          );
        setPedidosSelecionados(pedidos);
        addToast?.(
          `✅ Carregado ${pedidos.length} pedidos Mercado Livre com etiqueta`,
          'success'
        );
      }
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setIsCarregando(false);
    }
  };

  // Executar fluxo completo
  const handleExecutarFluxoCompleto = async () => {
    if (pedidosSelecionados.length === 0) {
      addToast?.('❌ Selecione pedidos primeiro', 'error');
      return;
    }

    if (!token) {
      addToast?.('❌ Token não configurado', 'error');
      return;
    }

    setIsProcessando(true);
    setProgresso({ total: pedidosSelecionados.length, processados: 0, erros: 0 });

    try {
      const pedidoIds = pedidosSelecionados.map(p => p.numero);

      const resultadoFluxo = await etiquetaBlingFluxoCompleto.executarFluxoCompleto(
        pedidoIds,
        token,
        token,
        'usuario@email.com'
      );

      setResultados(resultadoFluxo);

      const sucesso = resultadoFluxo.filter(r => r.sucesso).length;
      const falhas = resultadoFluxo.filter(r => !r.sucesso).length;

      addToast?.(
        `✅ ${sucesso} processada(s) com sucesso, ${falhas} falha(s)`,
        sucesso > 0 ? 'success' : 'error'
      );
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setIsProcessando(false);
      setProgresso(null);
    }
  };

  // Download dos arquivos
  const handleDownloar = (resultado: any, tipo: 'txt' | 'zpl') => {
    if (!resultado.arquivos?.[tipo]) {
      addToast?.(`Arquivo não disponível`, 'error');
      return;
    }

    const blob = resultado.arquivos[tipo];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resultado.pedidoId}-${tipo.toUpperCase()}.${tipo === 'txt' ? 'txt' : 'zpl'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
      {/* Header */}
      <div>
        <h3 className="font-bold text-lg mb-2">
          {tipoPedidos === 'nfe' ? '📋 NFe - Geração de Etiquetas' : '🎫 Mercado Livre - Etiquetas Prontas'}
        </h3>
        <p className="text-sm text-slate-600">
          {tipoPedidos === 'nfe'
            ? 'Selecione quantos pedidos deseja processar (sem limite)'
            : 'Processando apenas pedidos com etiqueta pronta'}
        </p>
      </div>

      {/* Seleção de Quantidade (NFe apenas) */}
      {tipoPedidos === 'nfe' && (
        <div className="bg-white p-4 rounded-lg border">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Quantidade de Pedidos
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuantidadeDesejada(Math.max(1, quantidadeDesejada - 5))}
              className="p-2 bg-slate-200 hover:bg-slate-300 rounded"
            >
              <Minus size={18} />
            </button>

            <input
              type="number"
              value={quantidadeDesejada}
              onChange={(e) => setQuantidadeDesejada(Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 border border-slate-300 rounded text-center font-bold"
              min="1"
            />

            <button
              onClick={() => setQuantidadeDesejada(quantidadeDesejada + 5)}
              className="p-2 bg-slate-200 hover:bg-slate-300 rounded"
            >
              <Plus size={18} />
            </button>

            <span className="text-sm text-slate-600 ml-4">
              {quantidadeDesejada} pedidos serão processados
            </span>
          </div>
        </div>
      )}

      {/* Botões de Ação */}
      <div className="bg-white p-4 rounded-lg border flex gap-2 flex-wrap">
        <button
          onClick={handleBuscarPedidos}
          disabled={isCarregando || isProcessando}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2 font-semibold"
        >
          {isCarregando ? (
            <Loader size={18} className="animate-spin" />
          ) : (
            <Download size={18} />
          )}
          {isCarregando ? 'Buscando...' : '🔍 Buscar Pedidos'}
        </button>

        {pedidosSelecionados.length > 0 && (
          <button
            onClick={handleExecutarFluxoCompleto}
            disabled={isProcessando}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2 font-semibold animate-pulse"
          >
            {isProcessando ? <Loader size={18} className="animate-spin" /> : <Zap size={18} />}
            {isProcessando
              ? `Processando... [${progresso?.processados || 0}/${progresso?.total || 0}]`
              : `⚡ Executar Fluxo (${pedidosSelecionados.length})`}
          </button>
        )}
      </div>

      {/* Lista de Pedidos Selecionados */}
      {pedidosSelecionados.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            📦 {pedidosSelecionados.length} Pedido(s) Selecionado(s)
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {pedidosSelecionados.map((pedido, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-slate-50 rounded border-l-4 border-blue-500"
              >
                <div>
                  <p className="font-semibold text-slate-900">{pedido.numero}</p>
                  <p className="text-sm text-slate-600">{pedido.cliente.nome}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">
                  {pedido.origem}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="bg-white p-4 rounded-lg border">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            ✅ Resultados do Fluxo
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {resultados.map((resultado, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border-l-4 ${
                  resultado.sucesso
                    ? 'bg-green-50 border-green-500'
                    : 'bg-red-50 border-red-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold flex items-center gap-2">
                      {resultado.sucesso ? (
                        <CheckCircle2 size={16} className="text-green-600" />
                      ) : (
                        <AlertTriangle size={16} className="text-red-600" />
                      )}
                      Pedido: {resultado.pedidoId}
                    </p>
                    <p className="text-sm text-slate-700 mt-1">{resultado.mensagem}</p>
                    {resultado.erro && (
                      <p className="text-xs text-red-600 mt-1">{resultado.erro}</p>
                    )}
                  </div>

                  {resultado.sucesso && resultado.arquivos && (
                    <div className="flex gap-2 ml-4">
                      {resultado.arquivos.txt && (
                        <button
                          onClick={() => handleDownloar(resultado, 'txt')}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition flex items-center gap-1"
                        >
                          <Download size={12} /> TXT
                        </button>
                      )}
                      {resultado.arquivos.zpl && (
                        <button
                          onClick={() => handleDownloar(resultado, 'zpl')}
                          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition flex items-center gap-1"
                        >
                          <Download size={12} /> ZPL
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div className="mt-4 p-3 bg-slate-100 rounded flex justify-around text-sm font-semibold">
            <div className="text-center">
              <p className="text-slate-600">Total</p>
              <p className="text-lg text-slate-900">{resultados.length}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-600">Sucesso</p>
              <p className="text-lg text-green-600">
                {resultados.filter(r => r.sucesso).length}
              </p>
            </div>
            <div className="text-center">
              <p className="text-slate-600">Falhas</p>
              <p className="text-lg text-red-600">
                {resultados.filter(r => !r.sucesso).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FluxoCompleteEtiquetas;
