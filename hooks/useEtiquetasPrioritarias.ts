// ============================================================================
// hooks/useEtiquetasPrioritarias.ts
// Hook customizado para gerenciar Etiquetas Prioritárias
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { dbClient as supabaseClient } from '../lib/supabaseClient';
import { etiquetasPrioritariasService, EtiquetaPrioritariaDTO } from '../services/etiquetasPrioritariasService';

interface EtiquetaInfo {
  id: string;
  pedidoId: string;
  numeroBling: string;
  nfeLote: string;
  dataGeracao: string;
  statusProcessamento: 'pendente' | 'processando' | 'concluido' | 'salvo_no_pc' | 'erro';
  armazenagem: 'zpl' | 'pc';
  rastreabilidade: {
    numeroBling: string;
    lojaVirtual: string;
    canalVendas: string;
  };
}

interface UseEtiquetasPrioritariasReturn {
  etiquetas: EtiquetaInfo[];
  isCarregando: boolean;
  erro: string | null;
  
  // Ações
  carregarEtiquetas: () => Promise<void>;
  carregarPorLote: (lote: string) => Promise<EtiquetaInfo[]>;
  buscarEtiquetaBling: (
    numeroPedido: string,
    tokenBling: string
  ) => Promise<any | null>;
  gerarEtiquetaZPL: (
    etiquetaBling: any,
    pedidoInfo: any
  ) => string;
  salvarEtiqueta: (dto: EtiquetaPrioritariaDTO) => Promise<string | null>;
  salvarComoArquivo: (dto: EtiquetaPrioritariaDTO) => Promise<Blob | null>;
  reabrirEtiqueta: (etiquetaId: string) => Promise<EtiquetaInfo | null>;
  deletarEtiqueta: (etiquetaId: string) => Promise<boolean>;
  gerarRelatorio: (
    dataInicio: string,
    dataFim: string
  ) => Promise<any | null>;
  
  // Dados agregados
  totalEtiquetas: number;
  totalProcessadas: number;
  totalNoPC: number;
  etiquetasPorLote: Record<string, EtiquetaInfo[]>;
  etiquetasPorCanal: Record<string, EtiquetaInfo[]>;
}

/**
 * Hook para gerenciar o fluxo completo de Etiquetas Prioritárias
 */
export const useEtiquetasPrioritarias = (): UseEtiquetasPrioritariasReturn => {
  const [etiquetas, setEtiquetas] = useState<EtiquetaInfo[]>([]);
  const [isCarregando, setIsCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar todas as etiquetas
  const carregarEtiquetas = useCallback(async () => {
    setIsCarregando(true);
    setErro(null);
    try {
      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .select('*')
        .order('data_geracao', { ascending: false });

      if (error) throw error;

      setEtiquetas(data || []);
    } catch (err: any) {
      const mensagem = err.message || 'Erro ao carregar etiquetas';
      setErro(mensagem);
      console.error('❌ [useEtiquetasPrioritarias] Erro:', err);
    } finally {
      setIsCarregando(false);
    }
  }, []);

  // Carregar etiquetas por lote
  const carregarPorLote = useCallback(
    async (lote: string): Promise<EtiquetaInfo[]> => {
      try {
        const resultado = await etiquetasPrioritariasService.listarPorLote(lote);
        if (resultado.sucesso && resultado.etiquetas) {
          return resultado.etiquetas;
        }
        return [];
      } catch (err: any) {
        console.error('❌ [useEtiquetasPrioritarias] Erro ao listar por lote:', err);
        return [];
      }
    },
    []
  );

  // Buscar etiqueta do Bling
  const buscarEtiquetaBling = useCallback(
    async (numeroPedido: string, tokenBling: string) => {
      try {
        const resultado = await etiquetasPrioritariasService.buscarEtiquetaBlingReal(
          numeroPedido,
          tokenBling
        );
        if (resultado.sucesso) {
          return resultado.etiqueta;
        }
        throw new Error(resultado.erro);
      } catch (err: any) {
        console.error('❌ [useEtiquetasPrioritarias] Erro ao buscar Bling:', err);
        return null;
      }
    },
    []
  );

  // Gerar ZPL
  const gerarEtiquetaZPL = useCallback((etiquetaBling: any, pedidoInfo: any) => {
    try {
      return etiquetasPrioritariasService.converterParaZPL(etiquetaBling, pedidoInfo);
    } catch (err: any) {
      console.error('❌ [useEtiquetasPrioritarias] Erro ao gerar ZPL:', err);
      return '';
    }
  }, []);

  // Salvar etiqueta
  const salvarEtiqueta = useCallback(async (dto: EtiquetaPrioritariaDTO) => {
    try {
      const resultado = await etiquetasPrioritariasService.salvarEtiquetaZPL(dto);
      if (resultado.sucesso) {
        // Recarregar etiquetas
        await carregarEtiquetas();
        return resultado.id || null;
      }
      throw new Error(resultado.erro);
    } catch (err: any) {
      console.error('❌ [useEtiquetasPrioritarias] Erro ao salvar:', err);
      return null;
    }
  }, [carregarEtiquetas]);

  // Salvar como arquivo
  const salvarComoArquivo = useCallback(
    async (dto: EtiquetaPrioritariaDTO): Promise<Blob | null> => {
      try {
        const resultado = await etiquetasPrioritariasService.salvarEtiquetaArquivo(
          dto,
          'blob'
        );
        if (resultado.sucesso && resultado.arquivo) {
          return resultado.arquivo as Blob;
        }
        throw new Error(resultado.erro);
      } catch (err: any) {
        console.error('❌ [useEtiquetasPrioritarias] Erro ao salvar arquivo:', err);
        return null;
      }
    },
    []
  );

  // Reabrir etiqueta
  const reabrirEtiqueta = useCallback(async (etiquetaId: string) => {
    try {
      const resultado = await etiquetasPrioritariasService.reabrirEtiqueta(etiquetaId);
      if (resultado.sucesso && resultado.etiqueta) {
        return resultado.etiqueta;
      }
      throw new Error(resultado.erro);
    } catch (err: any) {
      console.error('❌ [useEtiquetasPrioritarias] Erro ao reabrir:', err);
      return null;
    }
  }, []);

  // Deletar etiqueta
  const deletarEtiqueta = useCallback(
    async (etiquetaId: string) => {
      try {
        const resultado = await etiquetasPrioritariasService.deletarEtiqueta(etiquetaId);
        if (resultado.sucesso) {
          // Recarregar etiquetas
          await carregarEtiquetas();
          return true;
        }
        throw new Error(resultado.erro);
      } catch (err: any) {
        console.error('❌ [useEtiquetasPrioritarias] Erro ao deletar:', err);
        return false;
      }
    },
    [carregarEtiquetas]
  );

  // Gerar relatório
  const gerarRelatorio = useCallback(async (dataInicio: string, dataFim: string) => {
    try {
      const resultado = await etiquetasPrioritariasService.gerarRelatorio(
        dataInicio,
        dataFim
      );
      if (resultado.sucesso) {
        return resultado.relatorio;
      }
      throw new Error(resultado.erro);
    } catch (err: any) {
      console.error('❌ [useEtiquetasPrioritarias] Erro ao gerar relatório:', err);
      return null;
    }
  }, []);

  // Effet para carregar etiquetas ao montar
  useEffect(() => {
    carregarEtiquetas();
  }, [carregarEtiquetas]);

  // Calcular agregações
  const totalEtiquetas = etiquetas.length;
  const totalProcessadas = etiquetas.filter(
    (e) => e.statusProcessamento === 'concluido'
  ).length;
  const totalNoPC = etiquetas.filter((e) => e.armazenagem === 'pc').length;

  // Agrupar por lote
  const etiquetasPorLote: Record<string, EtiquetaInfo[]> = {};
  etiquetas.forEach((e) => {
    if (!etiquetasPorLote[e.nfeLote]) {
      etiquetasPorLote[e.nfeLote] = [];
    }
    etiquetasPorLote[e.nfeLote].push(e);
  });

  // Agrupar por canal
  const etiquetasPorCanal: Record<string, EtiquetaInfo[]> = {};
  etiquetas.forEach((e) => {
    const canal = e.rastreabilidade.canalVendas;
    if (!etiquetasPorCanal[canal]) {
      etiquetasPorCanal[canal] = [];
    }
    etiquetasPorCanal[canal].push(e);
  });

  return {
    etiquetas,
    isCarregando,
    erro,
    carregarEtiquetas,
    carregarPorLote,
    buscarEtiquetaBling,
    gerarEtiquetaZPL,
    salvarEtiqueta,
    salvarComoArquivo,
    reabrirEtiqueta,
    deletarEtiqueta,
    gerarRelatorio,
    totalEtiquetas,
    totalProcessadas,
    totalNoPC,
    etiquetasPorLote,
    etiquetasPorCanal,
  };
};
