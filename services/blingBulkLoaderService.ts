// ============================================================================
// services/blingBulkLoaderService.ts - Carrega TODOS os pedidos do Bling
// Pagina automática, sem limites, com opções de filtro
// ============================================================================

import { dbClient } from '../lib/supabaseClient';
import { OrderItem } from '../types';

export interface BlingPedido {
  id: number | string;
  numero: string;
  sequencia?: number;
  data: string;
  dataPrevisaoEntrega?: string;
  status: 'aberto' | 'suspenso' | 'cancelado' | 'completado' | 'processando';
  cliente: {
    id: number;
    nome: string;
    numeroDocumento: string;
    email?: string;
    telefone?: string;
  };
  itens: Array<{
    id: number;
    descricao: string;
    codigo: string;
    quantidade: number;
    valor: number;
    impostos?: number;
  }>;
  total: number;
  notaFiscal?: {
    numero: string;
    chave: string;
    status: string;
  };
}

interface LoadOptions {
  status?: 'aberto' | 'suspenso' | 'cancelado' | 'completado' | 'processando';
  limite?: number;
  offset?: number;
  forcarAtualizacao?: boolean;
}

/**
 * Serviço de carregamento em massa de pedidos do Bling
 * Suporta paginação automática e sincronização
 */
export const blingBulkLoaderService = {
  /**
   * Carrega TODOS os pedidos de vendas do Bling
   * Com paginação automática (padrão: 50 por página)
   */
  async carregarTodosPedidos(
    token: string,
    opcoes: LoadOptions = { limite: 50, offset: 0 }
  ): Promise<{ pedidos: BlingPedido[]; total: number; carregou: number }> {
    const pedidos: BlingPedido[] = [];
    let offset = opcoes.offset || 0;
    const limite = opcoes.limite || 50;
    let totalEncontrados = 0;
    let paginaAtual = 1;

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: limite.toString(),
          offset: offset.toString()
        });

        // Adicionar filtro de status se especificado
        if (opcoes.status) {
          params.append('status', opcoes.status);
        }

        const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?${params.toString()}`;

        console.log(`📥 Buscando página ${paginaAtual}...`);

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limit - aguardar e tentar novamente
            console.warn('⏱️ Rate limit atingido, aguardando...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`Erro na pagina ${paginaAtual}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.data || data.data.length === 0) {
          totalEncontrados = data.meta?.total || pedidos.length;
          console.log(`✅ Carregamento concluído. Total: ${totalEncontrados} pedidos`);
          break;
        }

        // Adicionar pedidos à lista
        pedidos.push(...data.data);
        totalEncontrados = data.meta?.total || 0;

        console.log(
          `📊 Página ${paginaAtual}: ${data.data.length} pedidos (Total: ${pedidos.length}/${totalEncontrados})`
        );

        // Se não há mais páginas, sair do loop
        if (data.data.length < limite) {
          console.log('✅ Nenhuma página adicional encontrada');
          break;
        }

        offset += limite;
        paginaAtual += 1;

        // Pequeno delay entre requisições para não sobrecarregar API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return {
        pedidos: pedidos,
        total: totalEncontrados,
        carregou: pedidos.length
      };
    } catch (error) {
      console.error('❌ Erro ao carregar pedidos:', error);
      throw error;
    }
  },

  /**
   * Carrega pedidos por intervalo de datas
   */
  async carregarPorData(
    token: string,
    dataInicio: string,
    dataFim: string,
    opcoes: LoadOptions = {}
  ): Promise<{ pedidos: BlingPedido[]; total: number }> {
    const pedidos: BlingPedido[] = [];
    let offset = opcoes.offset || 0;
    const limite = opcoes.limite || 50;

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: limite.toString(),
          offset: offset.toString(),
          dataInicio,
          dataFim
        });

        const response = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );

        if (!response.ok) throw new Error(`Erro: ${response.statusText}`);

        const data = await response.json();
        if (!data.data || data.data.length === 0) break;

        pedidos.push(...data.data);

        if (data.data.length < limite) break;

        offset += limite;
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      return {
        pedidos,
        total: pedidos.length
      };
    } catch (error) {
      console.error('Erro ao carregar por data:', error);
      throw error;
    }
  },

  /**
   * Converte BlingPedido para formato OrderItem do ERP
   */
  converterParaOrderItem(blingPedido: BlingPedido): OrderItem {
    return {
      id: `bling_${blingPedido.id}`,
      orderId: blingPedido.numero,
      blingId: blingPedido.id.toString(),
      tracking: '',
      sku: blingPedido.itens[0]?.codigo || 'SEM_SKU',
      qty_original: blingPedido.itens[0]?.quantidade || 1,
      multiplicador: 1,
      qty_final: blingPedido.itens[0]?.quantidade || 1,
      color: '',
      canal: 'SITE' as any,
      data: blingPedido.data.split('T')[0], // Pega apenas YYYY-MM-DD
      status: blingPedido.status === 'aberto' ? 'NORMAL' : 'ERRO',
      customer_name: blingPedido.cliente.nome,
      customer_cpf_cnpj: blingPedido.cliente.numeroDocumento,
      price_gross: blingPedido.itens[0]?.valor || 0,
      price_total: blingPedido.total,
      platform_fees: 0,
      shipping_fee: 0,
      shipping_paid_by_customer: 0,
      price_net: blingPedido.total
    };
  },

  /**
   * Salva pedidos carregados no banco de dados
   */
  async salvarNoBancoDados(
    pedidos: BlingPedido[],
    tabela: 'orders' | 'order_items' = 'orders'
  ): Promise<{ salvos: number; erros: number }> {
    try {
      const itensSalvar = pedidos.map(p => this.converterParaOrderItem(p));
      const { error, data } = await dbClient
        .from(tabela)
        .insert(itensSalvar as any)
        .select();

      if (error) {
        console.error('Erro ao salvar:', error);
        return { salvos: 0, erros: pedidos.length };
      }

      console.log(`✅ Salvos ${itensSalvar.length} pedidos`);
      return { salvos: itensSalvar.length, erros: 0 };
    } catch (error) {
      console.error('Erro ao salvar no banco:', error);
      return { salvos: 0, erros: pedidos.length };
    }
  },

  /**
   * Busca pedidos sem DANFE emitida
   */
  async carregarSemDANFE(
    token: string,
    opcoes: LoadOptions = {}
  ): Promise<BlingPedido[]> {
    const { pedidos } = await this.carregarTodosPedidos(token, opcoes);

    return pedidos.filter(p => {
      return !p.notaFiscal || !p.notaFiscal.numero;
    });
  },

  /**
   * Busca pedidos com DANFE emitida mas não autorizada
   */
  async carregarComDANFEPendente(
    token: string,
    opcoes: LoadOptions = {}
  ): Promise<BlingPedido[]> {
    const { pedidos } = await this.carregarTodosPedidos(token, opcoes);

    return pedidos.filter(p => {
      return (
        p.notaFiscal &&
        p.notaFiscal.numero &&
        p.notaFiscal.status !== 'autorizada'
      );
    });
  },

  /**
   * Agrupa pedidos por status
   */
  agruparPorStatus(pedidos: BlingPedido[]): {
    abertos: BlingPedido[];
    suspensos: BlingPedido[];
    cancelados: BlingPedido[];
    completados: BlingPedido[];
    processando: BlingPedido[];
  } {
    return {
      abertos: pedidos.filter(p => p.status === 'aberto'),
      suspensos: pedidos.filter(p => p.status === 'suspenso'),
      cancelados: pedidos.filter(p => p.status === 'cancelado'),
      completados: pedidos.filter(p => p.status === 'completado'),
      processando: pedidos.filter(p => p.status === 'processando')
    };
  },

  /**
   * Estatísticas dos pedidos carregados
   */
  gerarEstatisticas(pedidos: BlingPedido[]): {
    totalPedidos: number;
    totalValor: number;
    totalItens: number;
    clientesUnicos: number;
    statusDistribuicao: Record<string, number>;
  } {
    const statusDistribuicao = pedidos.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const clientesUnicos = new Set(pedidos.map(p => p.cliente.id)).size;
    const totalValor = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalItens = pedidos.reduce((sum, p) => sum + p.itens.length, 0);

    return {
      totalPedidos: pedidos.length,
      totalValor,
      totalItens,
      clientesUnicos,
      statusDistribuicao
    };
  }
};

export default blingBulkLoaderService;
