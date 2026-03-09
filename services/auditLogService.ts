// ============================================================================
// services/auditLogService.ts - Sistema de Auditoria JSON Diária
// Registra todas as operações (NFe, importação, etc) em arquivo JSON
// ============================================================================

import { dbClient } from '../lib/supabaseClient';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  usuario: string;
  acao: string;
  modulo: 'nfe' | 'importacao' | 'bling' | 'estoque' | 'etiquetas' | 'danfe';
  tipo: 'criacao' | 'atualizacao' | 'deletacao' | 'sincronizacao' | 'geracao' | 'exportacao';
  resultado: 'sucesso' | 'erro' | 'aviso';
  dados: {
    pedidoNumero?: string;
    notaFiscalNumero?: string;
    skuAfetados?: string[];
    quantidadeItens?: number;
    valor?: number;
    detalhes?: Record<string, any>;
  };
  erro?: {
    mensagem: string;
    stack?: string;
  };
  duracao_ms?: number;
}

export interface AuditLog {
  data: string;
  versao: '1.0';
  empresa: string;
  resumo: {
    totalEntradas: number;
    sucessos: number;
    erros: number;
    avisos: number;
    operacoesPorModulo: Record<string, number>;
    operacoesPorTipo: Record<string, number>;
  };
  entradas: AuditLogEntry[];
}

/**
 * Serviço de auditoria com persistência em database
 */
export const auditLogService = {
  /**
   * Registra uma operação no log de auditoria
   */
  async registrar(
    entrada: Omit<AuditLogEntry, 'id' | 'timestamp'>,
    usuario: string = 'sistema'
  ): Promise<AuditLogEntry> {
    const now = new Date();
    const novaEntrada: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: now.toISOString(),
      usuario,
      acao: entrada.acao,
      modulo: entrada.modulo,
      tipo: entrada.tipo,
      resultado: entrada.resultado,
      dados: entrada.dados,
      erro: entrada.erro,
      duracao_ms: entrada.duracao_ms
    };

    try {
      // Salvar no banco de dados
      const { error } = await dbClient
        .from('audit_logs')
        .insert([
          {
            timestamp: novaEntrada.timestamp,
            usuario: novaEntrada.usuario,
            acao: novaEntrada.acao,
            modulo: novaEntrada.modulo,
            tipo: novaEntrada.tipo,
            resultado: novaEntrada.resultado,
            dados: novaEntrada.dados,
            erro: novaEntrada.erro,
            duracao_ms: novaEntrada.duracao_ms
          }
        ]);

      if (error) {
        console.warn('⚠️ Erro ao salvar auditoria no BD:', error);
        // Fallback: salvar em localStorage
        await this.salvarLocalStorage(novaEntrada);
      }

      console.log(`📝 [${novaEntrada.modulo}] ${novaEntrada.acao} - ${novaEntrada.resultado}`);
    } catch (err) {
      console.error('Erro ao registrar auditoria:', err);
    }

    return novaEntrada;
  },

  /**
   * Registra operação de NFe
   */
  async registrarNFe(
    acao: string,
    tipo: 'criacao' | 'atualizacao' | 'geracao',
    resultado: 'sucesso' | 'erro',
    dados: any,
    usuario?: string,
    erro?: { mensagem: string }
  ) {
    return this.registrar(
      {
        acao,
        modulo: 'nfe',
        tipo,
        resultado,
        dados: {
          notaFiscalNumero: dados.notaFiscalNumero,
          pedidoNumero: dados.pedidoNumero,
          detalhes: dados
        },
        erro: erro ? { mensagem: erro.mensagem, stack: erro.stack } : undefined
      },
      usuario
    );
  },

  /**
   * Registra operação de importação
   */
  async registrarImportacao(
    acao: string,
    tipo: 'criacao' | 'sincronizacao',
    resultado: 'sucesso' | 'erro',
    dados: {
      canal: string;
      totalPedidos: number;
      totalItens: number;
      valor?: number;
      erros?: string[];
    },
    usuario?: string
  ) {
    return this.registrar(
      {
        acao,
        modulo: 'importacao',
        tipo,
        resultado,
        dados: {
          quantidadeItens: dados.totalItens,
          valor: dados.valor,
          detalhes: dados
        }
      },
      usuario
    );
  },

  /**
   * Registra operação do Bling
   */
  async registrarBling(
    acao: string,
    tipo: 'sincronizacao' | 'atualizacao',
    resultado: 'sucesso' | 'erro' | 'aviso',
    dados: {
      pedidosCarregados?: number;
      pedidosProcessados?: number;
      valor?: number;
      detalhes?: Record<string, any>;
    },
    usuario?: string,
    erro?: { mensagem: string }
  ) {
    return this.registrar(
      {
        acao,
        modulo: 'bling',
        tipo,
        resultado,
        dados: {
          quantidadeItens: dados.pedidosCarregados,
          valor: dados.valor,
          detalhes: dados
        },
        erro: erro ? { mensagem: erro.mensagem } : undefined
      },
      usuario
    );
  },

  /**
   * Registra operação de geração de DANFE/Etiquetas
   */
  async registrarDANFE(
    acao: string,
    resultado: 'sucesso' | 'erro',
    dados: {
      notaFiscalNumero: string;
      pedidoNumero: string;
      quantidadeDocumentos: number;
      formato: string;
    },
    usuario?: string,
    erro?: { mensagem: string }
  ) {
    return this.registrar(
      {
        acao,
        modulo: 'danfe',
        tipo: 'geracao',
        resultado,
        dados: {
          notaFiscalNumero: dados.notaFiscalNumero,
          pedidoNumero: dados.pedidoNumero,
          detalhes: dados
        },
        erro: erro ? { mensagem: erro.mensagem } : undefined
      },
      usuario
    );
  },

  /**
   * Recupera log do dia
   */
  async recuperarDoDia(data?: string): Promise<AuditLogEntry[]> {
    const dia = data || new Date().toISOString().split('T')[0];
    const inicio = `${dia}T00:00:00`;
    const fim = `${dia}T23:59:59`;

    try {
      const { data: entradas, error } = await dbClient
        .from('audit_logs')
        .select('*')
        .gte('timestamp', inicio)
        .lte('timestamp', fim)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      return (entradas as any) || [];
    } catch (err) {
      console.error('Erro ao recuperar log:', err);
      return [];
    }
  },

  /**
   * Gera relatório JSON do dia
   */
  async gerarRelatorioJSON(data?: string): Promise<AuditLog> {
    const entradas = await this.recuperarDoDia(data);
    const dia = data || new Date().toISOString().split('T')[0];

    const resumo = {
      totalEntradas: entradas.length,
      sucessos: entradas.filter(e => e.resultado === 'sucesso').length,
      erros: entradas.filter(e => e.resultado === 'erro').length,
      avisos: entradas.filter(e => e.resultado === 'aviso').length,
      operacoesPorModulo: {} as Record<string, number>,
      operacoesPorTipo: {} as Record<string, number>
    };

    // Contar por módulo e tipo
    entradas.forEach(entrada => {
      resumo.operacoesPorModulo[entrada.modulo] =
        (resumo.operacoesPorModulo[entrada.modulo] || 0) + 1;
      resumo.operacoesPorTipo[entrada.tipo] =
        (resumo.operacoesPorTipo[entrada.tipo] || 0) + 1;
    });

    return {
      data: dia,
      versao: '1.0',
      empresa: localStorage.getItem('empresa_nome') || 'SEM EMPRESA',
      resumo,
      entradas
    };
  },

  /**
   * Exporta relatório como JSON
   */
  async exportarJSON(data?: string): Promise<Blob> {
    const relatorio = await this.gerarRelatorioJSON(data);
    const json = JSON.stringify(relatorio, null, 2);
    return new Blob([json], { type: 'application/json' });
  },

  /**
   * Salva em localStorage (fallback)
   */
  async salvarLocalStorage(entrada: AuditLogEntry) {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const chave = `audit_log_${hoje}`;
      const logsExistentes = JSON.parse(localStorage.getItem(chave) || '[]');
      logsExistentes.push(entrada);
      localStorage.setItem(chave, JSON.stringify(logsExistentes));
    } catch (err) {
      console.error('Erro ao salvar em localStorage:', err);
    }
  },

  /**
   * Busca logs por filtro
   */
  async buscarPorFiltro(filtros: {
    dataInicio?: string;
    dataFim?: string;
    modulo?: string;
    resultado?: string;
    usuario?: string;
  }): Promise<AuditLogEntry[]> {
    try {
      let query = dbClient
        .from('audit_logs')
        .select('*');

      if (filtros.dataInicio) {
        query = query.gte('timestamp', `${filtros.dataInicio}T00:00:00`);
      }
      if (filtros.dataFim) {
        query = query.lte('timestamp', `${filtros.dataFim}T23:59:59`);
      }
      if (filtros.modulo) {
        query = query.eq('modulo', filtros.modulo);
      }
      if (filtros.resultado) {
        query = query.eq('resultado', filtros.resultado);
      }
      if (filtros.usuario) {
        query = query.eq('usuario', filtros.usuario);
      }

      const { data, error } = await query.order('timestamp', { ascending: false });

      if (error) throw error;
      return (data as any) || [];
    } catch (err) {
      console.error('Erro ao buscar por filtro:', err);
      return [];
    }
  },

  /**
   * Limpa logs antigos (mais de 30 dias)
   */
  async limparAntigos(dias: number = 30): Promise<number> {
    try {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - dias);
      const dataStr = dataLimite.toISOString();

      const { error, count } = await dbClient
        .from('audit_logs')
        .delete()
        .lt('timestamp', dataStr);

      if (error) throw error;

      console.log(`🗑️ Limpeza de auditoria: ${count} registros antigos removidos`);
      return count || 0;
    } catch (err) {
      console.error('Erro ao limpar logs antigos:', err);
      return 0;
    }
  }
};

export default auditLogService;
