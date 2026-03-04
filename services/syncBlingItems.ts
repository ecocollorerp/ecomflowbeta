// ============================================================================
// services/syncBlingItems.ts - Sincronizar Itens de Pedidos do Bling
// Automatiza busca de itens e salva no banco de dados
// ============================================================================

import { dbClient } from '../lib/supabaseClient';

interface ItemPedido {
  id: string;
  order_id: string;
  bling_id: string;
  bling_item_id?: string;
  sku: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  status: 'novo' | 'sincronizado' | 'erro' | 'devolvido';
}

/**
 * Sincroniza itens de pedidos do Bling para o banco de dados
 */
export const syncBlingItems = {
  /**
   * Busca itens de um pedido específico do Bling
   */
  async buscarItensDoBlIng(
    blingOrderId: string | number,
    token: string
  ): Promise<any[]> {
    try {
      const response = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${Number(blingOrderId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedido: ${response.statusText}`);
      }

      const data = await response.json();
      const pedido = data?.data;

      if (!pedido) {
        console.warn(`Pedido ${blingOrderId} não encontrado no Bling`);
        return [];
      }

      // Retornar itens do pedido
      return Array.isArray(pedido.itens) ? pedido.itens : [];
    } catch (error) {
      console.error(`Erro ao buscar itens do Bling para pedido ${blingOrderId}:`, error);
      throw error;
    }
  },

  /**
   * Salva itens do pedido no banco de dados
   */
  async salvarItensNoBanco(
    orderId: string,
    blingOrderId: string,
    itens: any[]
  ): Promise<ItemPedido[]> {
    try {
      if (!itens || itens.length === 0) {
        console.log(`Nenhum item para salvar do pedido ${orderId}`);
        return [];
      }

      // Preparar dados para inserção
      const itensParaSalvar = itens.map((item: any) => ({
        order_id: orderId,
        bling_id: blingOrderId,
        bling_item_id: item.id || null,
        sku: item.codigo || item.sku || '',
        descricao: item.descricao || item.nome || '',
        unidade: item.unidade || 'UN',
        quantidade: Number(item.quantidade || 0),
        valor_unitario: Number(item.valor || item.valorUnitario || 0),
        subtotal: Number((item.quantidade || 0) * (item.valor || item.valorUnitario || 0)),
        status: 'sincronizado',
        sincronizado_em: new Date(),
      }));

      // Inserir ou atualizar no Supabase
      const { data, error } = await dbClient
        .from('order_items')
        .upsert(itensParaSalvar, { onConflict: 'bling_item_id,order_id' })
        .select();

      if (error) {
        throw new Error(`Erro ao salvar itens: ${error.message}`);
      }

      console.log(`✅ ${data?.length || 0} itens salvos do pedido ${orderId}`);
      return data || [];
    } catch (error) {
      console.error(`Erro ao salvar itens no banco:`, error);
      throw error;
    }
  },

  /**
   * Sincroniza itens de um pedido (busca + salva)
   */
  async sincronizarPedido(
    orderId: string,
    blingOrderId: string | number,
    token: string
  ): Promise<{ sucesso: boolean; itens: ItemPedido[]; erro?: string }> {
    try {
      // Buscar itens do Bling
      const itensBlIng = await this.buscarItensDoBlIng(blingOrderId, token);

      // Salvar no banco
      const itensSalvos = await this.salvarItensNoBanco(
        orderId,
        String(blingOrderId),
        itensBlIng
      );

      // Registrar sucesso no log
      await this.registrarSync('order_items', String(blingOrderId), true, 'OK');

      return {
        sucesso: true,
        itens: itensSalvos,
      };
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro desconhecido';

      // Registrar erro no log
      await this.registrarSync('order_items', String(blingOrderId), false, mensagem);

      return {
        sucesso: false,
        itens: [],
        erro: mensagem,
      };
    }
  },

  /**
   * Sincroniza itens de TODOS os pedidos
   */
  async sincronizarTodosPedidos(token: string, limite = 50) {
    try {
      // Buscar pedidos recentes do Bling
      const response = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas?limit=${limite}&orderBy=data:desc`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos: ${response.statusText}`);
      }

      const data = await response.json();
      const pedidos = data?.data || [];

      console.log(`📦 Sincronizando itens de ${pedidos.length} pedidos...`);

      let totalSincronizado = 0;
      let totalErros = 0;

      for (const pedido of pedidos) {
        const resultado = await this.sincronizarPedido(
          pedido.numero || pedido.numeroLoja || String(pedido.id),
          pedido.id,
          token
        );

        if (resultado.sucesso) {
          totalSincronizado += resultado.itens.length;
        } else {
          totalErros++;
        }
      }

      console.log(`✅ Sincronização concluída: ${totalSincronizado} itens, ${totalErros} erros`);

      // Atualizar timestamp
      await this.atualizarUltimoSync('order_items');

      return {
        sucesso: true,
        totalPedidos: pedidos.length,
        totalItens: totalSincronizado,
        totalErros,
      };
    } catch (error) {
      console.error('Erro ao sincronizar todos os pedidos:', error);
      throw error;
    }
  },

  /**
   * Busca itens de um pedido do banco de dados
   */
  async buscarItensDoFantco(orderId: string): Promise<ItemPedido[]> {
    try {
      const { data, error } = await dbClient
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .is('deletado_em', null)
        .order('criado_em', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar itens: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar itens do banco:', error);
      return [];
    }
  },

  /**
   * Registra sincronização no log
   */
  async registrarSync(
    tipo: string,
    blingId: string,
    sucesso: boolean,
    mensagem: string
  ) {
    try {
      await dbClient.from('sync_log').insert({
        tipo,
        bling_id: blingId,
        sucesso,
        mensagem,
      });
    } catch (error) {
      console.warn('Erro ao registrar sync no log:', error);
    }
  },

  /**
   * Atualiza timestamp da última sincronização
   */
  async atualizarUltimoSync(tipo: string) {
    try {
      const chave = `ultimo_sync_${tipo}`;
      await dbClient
        .from('sync_config')
        .upsert(
          { chave, valor: new Date().toISOString() },
          { onConflict: 'chave' }
        );
    } catch (error) {
      console.warn('Erro ao atualizar último sync:', error);
    }
  },

  /**
   * Obtém configuração de sincronização
   */
  async obterConfig(chave: string): Promise<string | null> {
    try {
      const { data, error } = await dbClient
        .from('sync_config')
        .select('valor')
        .eq('chave', chave)
        .single();

      if (error) return null;
      return data?.valor || null;
    } catch (error) {
      console.warn('Erro ao obter config:', error);
      return null;
    }
  },

  /**
   * Define configuração de sincronização
   */
  async definirConfig(chave: string, valor: string) {
    try {
      await dbClient
        .from('sync_config')
        .upsert({ chave, valor }, { onConflict: 'chave' });
    } catch (error) {
      console.warn('Erro ao definir config:', error);
    }
  },

  /**
   * Dispara sincronização automática se habilitada
   */
  async sincronizarSeNecessario(token: string, forcar = false) {
    try {
      const sincronizarAuto = await this.obterConfig('sincronizar_automatico');
      if (!forcar && sincronizarAuto !== 'true') {
        console.log('Sincronização automática desabilitada');
        return;
      }

      const ultimoSync = await this.obterConfig('ultimo_sync_itens');
      const intervaloMinutos = Number(
        await this.obterConfig('intervalo_sync_minutos')
      ) || 5;

      if (!ultimoSync) {
        // Primeira sincronização
        return await this.sincronizarTodosPedidos(token);
      }

      const ultimaData = new Date(ultimoSync);
      const agora = new Date();
      const minutosDecorridos = (agora.getTime() - ultimaData.getTime()) / (1000 * 60);

      if (minutosDecorridos >= intervaloMinutos || forcar) {
        return await this.sincronizarTodosPedidos(token);
      }

      console.log(`⏳ Próxima sincronização em ${Math.round(intervaloMinutos - minutosDecorridos)} minutos`);
      return null;
    } catch (error) {
      console.error('Erro em sincronização automática:', error);
      return null;
    }
  },
};

// Hook React para usar sincronização
import { useState, useCallback } from 'react';

export const useSyncBlingItems = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sincronizar = useCallback(async (token: string, forcar = false) => {
    try {
      setIsSyncing(true);
      setError(null);

      const resultado = await syncBlingItems.sincronizarSeNecessario(token, forcar);

      if (resultado) {
        setLastSync(new Date());
        return resultado;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao sincronizar';
      setError(msg);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const buscarItens = useCallback(async (orderId: string) => {
    try {
      return await syncBlingItems.buscarItensDoFantco(orderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar itens';
      setError(msg);
      return [];
    }
  }, []);

  return {
    isSyncing,
    lastSync,
    error,
    sincronizar,
    buscarItens,
  };
};
