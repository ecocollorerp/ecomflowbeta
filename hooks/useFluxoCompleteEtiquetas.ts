// ============================================================================
// hooks/useFluxoCompleteEtiquetas.ts
// Hook customizado para gerenciar fluxo completo de etiquetas
// ============================================================================

import { useState, useCallback } from 'react';
import { etiquetaBlingFluxoCompleto } from '../services/etiquetaBlingFluxoCompleto';
import { importacaoControllerService } from '../services/importacaoControllerService';

export interface UseFluxoCompleteProps {
  tipoPedidos?: 'nfe' | 'mercado_livre' | 'shopee';
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export interface ResultadoFluxo {
  pedidoId: string;
  sucesso: boolean;
  etapa: string;
  mensagem: string;
  arquivos?: {
    txt?: Blob;
    zpl?: Blob;
  };
  erro?: string;
}

export const useFluxoCompleteEtiquetas = ({
  tipoPedidos = 'nfe',
  addToast,
}: UseFluxoCompleteProps) => {
  const [pedidosSelecionados, setPedidosSelecionados] = useState<any[]>([]);
  const [quantidadeDesejada, setQuantidadeDesejada] = useState(10);
  const [isCarregando, setIsCarregando] = useState(false);
  const [isProcessando, setIsProcessando] = useState(false);
  const [progresso, setProgresso] = useState<{
    total: number;
    processados: number;
    erros: number;
    etapas: string[];
  } | null>(null);
  const [resultados, setResultados] = useState<ResultadoFluxo[]>([]);

  // Buscar pedidos
  const buscarPedidos = useCallback(
    async (token: string) => {
      if (!token) {
        addToast?.('❌ Token não configurado', 'error');
        return false;
      }

      setIsCarregando(true);
      try {
        if (tipoPedidos === 'nfe') {
          const resultado =
            await importacaoControllerService.buscarPedidosNfeComSelecaoCustomizada(
              token,
              { quantidadeDesejada }
            );
          setPedidosSelecionados(resultado.pedidosDisponiveis);
          addToast?.(
            `✅ Carregado ${resultado.pedidosDisponiveis.length} de ${resultado.total} pedidos`,
            'success'
          );
          return true;
        } else if (tipoPedidos === 'mercado_livre') {
          const resultado =
            await importacaoControllerService.buscarPedidosEmAbertoPorPlataforma(
              token,
              'MERCADO_LIVRE',
              { quantidadeDesejada }
            );
          setPedidosSelecionados(resultado.pedidosDisponiveis);
          addToast?.(
            `✅ Carregado ${resultado.pedidosDisponiveis.length} de ${resultado.total} pedidos Mercado Livre em aberto`,
            'success'
          );
          return true;
        } else if (tipoPedidos === 'shopee') {
          const resultado =
            await importacaoControllerService.buscarPedidosEmAbertoPorPlataforma(
              token,
              'SHOPEE',
              { quantidadeDesejada }
            );
          setPedidosSelecionados(resultado.pedidosDisponiveis);
          addToast?.(
            `✅ Carregado ${resultado.pedidosDisponiveis.length} de ${resultado.total} pedidos Shopee em aberto`,
            'success'
          );
          return true;
        }
      } catch (error: any) {
        addToast?.(`❌ Erro ao buscar pedidos: ${error.message}`, 'error');
        return false;
      } finally {
        setIsCarregando(false);
      }
    },
    [tipoPedidos, quantidadeDesejada, addToast]
  );

  // Executar fluxo completo
  const executarFluxoCompleto = useCallback(
    async (token: string, usuarioId: string = 'usuario@email.com') => {
      if (pedidosSelecionados.length === 0) {
        addToast?.('❌ Selecione pedidos primeiro', 'error');
        return false;
      }

      if (!token) {
        addToast?.('❌ Token não configurado', 'error');
        return false;
      }

      setIsProcessando(true);
      setProgresso({
        total: pedidosSelecionados.length,
        processados: 0,
        erros: 0,
        etapas: [],
      });

      try {
        const pedidoIds = pedidosSelecionados.map(p => p.numero);
        const resultado = await etiquetaBlingFluxoCompleto.executarFluxoCompleto(
          pedidoIds,
          token,
          token,
          usuarioId
        );

        setResultados(resultado);

        const sucesso = resultado.filter(r => r.sucesso).length;
        const falhas = resultado.filter(r => !r.sucesso).length;

        addToast?.(
          `✅ ${sucesso} processada(s) com sucesso, ${falhas} falha(s)`,
          sucesso > 0 ? 'success' : 'error'
        );

        return true;
      } catch (error: any) {
        addToast?.(`❌ Erro: ${error.message}`, 'error');
        return false;
      } finally {
        setIsProcessando(false);
        setProgresso(null);
      }
    },
    [pedidosSelecionados, addToast]
  );

  // Limpar resultados
  const limparResultados = useCallback(() => {
    setResultados([]);
    setProgresso(null);
  }, []);

  // Limpar pedidos
  const limparPedidos = useCallback(() => {
    setPedidosSelecionados([]);
    setResultados([]);
  }, []);

  // Retornar estado e ações
  return {
    // Estado
    pedidosSelecionados,
    quantidadeDesejada,
    isCarregando,
    isProcessando,
    progresso,
    resultados,

    // Setters
    setQuantidadeDesejada,
    setPedidosSelecionados,

    // Ações
    buscarPedidos,
    executarFluxoCompleto,
    limparResultados,
    limparPedidos,

    // Estatísticas
    totalPedidos: pedidosSelecionados.length,
    resultadoSucesso: resultados.filter(r => r.sucesso).length,
    resultadoFalhas: resultados.filter(r => !r.sucesso).length,
  };
};

export default useFluxoCompleteEtiquetas;
