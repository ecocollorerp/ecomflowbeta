// ============================================================================
// services/syncMarketplaceItems.ts
// Sincronizar items de Mercado Livre e Shopee para o banco de dados
// ============================================================================

import { dbClient } from '../lib/supabaseClient';

interface MarketplaceItem {
  id: string;
  sku: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

/**
 * Serviço para sincronizar itens de marketplace (ML, Shopee) para banco de dados
 */
export const syncMarketplaceItems = {
  /**
   * Salva itens de mercado livre no banco
   */
  async salvarItensML(
    orderId: string,
    canal: 'ML',
    itens: MarketplaceItem[]
  ): Promise<any[]> {
    try {
      console.log(`📥 Salvando ${itens.length} itens do ML para ordem ${orderId}`);

      if (!itens || itens.length === 0) {
        console.warn(`⚠️  Nenhum item do ML para salvar da ordem ${orderId}`);
        return [];
      }

      // Preparar dados para inserção
      const itensPrepados = itens.map((item) => ({
        order_id: orderId,
        canal: canal,
        item_id: item.id,
        sku: item.sku || '',
        descricao: item.descricao || '',
        quantidade: Number(item.quantidade || 1),
        valor_unitario: Number(item.valorUnitario || 0),
        subtotal: Number(item.subtotal || 0),
        status: 'sincronizado',
        sincronizado_em: new Date().toISOString(),
      }));

      // Inserir ou atualizar
      const { data, error } = await dbClient
        .from('order_items')
        .upsert(itensPrepados, { onConflict: 'item_id,order_id' })
        .select();

      if (error) {
        throw new Error(`Erro ao salvar itens ML: ${error.message}`);
      }

      console.log(`✅ ${data?.length || 0} itens do ML salvos para ordem ${orderId}`);
      return data || [];
    } catch (error) {
      console.error(`❌ Erro ao salvar itens ML no banco:`, error);
      throw error;
    }
  },

  /**
   * Salva itens de Shopee no banco
   */
  async salvarItensShopee(
    orderId: string,
    canal: 'SHOPEE',
    itens: MarketplaceItem[]
  ): Promise<any[]> {
    try {
      console.log(`📥 Salvando ${itens.length} itens da Shopee para ordem ${orderId}`);

      if (!itens || itens.length === 0) {
        console.warn(`⚠️  Nenhum item da Shopee para salvar da ordem ${orderId}`);
        return [];
      }

      // Preparar dados para inserção
      const itensPrepados = itens.map((item) => ({
        order_id: orderId,
        canal: canal,
        item_id: item.id,
        sku: item.sku || '',
        descricao: item.descricao || '',
        quantidade: Number(item.quantidade || 1),
        valor_unitario: Number(item.valorUnitario || 0),
        subtotal: Number(item.subtotal || 0),
        status: 'sincronizado',
        sincronizado_em: new Date().toISOString(),
      }));

      // Inserir ou atualizar
      const { data, error } = await dbClient
        .from('order_items')
        .upsert(itensPrepados, { onConflict: 'item_id,order_id' })
        .select();

      if (error) {
        throw new Error(`Erro ao salvar itens Shopee: ${error.message}`);
      }

      console.log(`✅ ${data?.length || 0} itens da Shopee salvos para ordem ${orderId}`);
      return data || [];
    } catch (error) {
      console.error(`❌ Erro ao salvar itens Shopee no banco:`, error);
      throw error;
    }
  },

  /**
   * Salva itens para qualquer canal
   */
  async salvarItens(
    orderId: string,
    canal: 'ML' | 'SHOPEE',
    itens: MarketplaceItem[]
  ): Promise<any[]> {
    return canal === 'ML'
      ? this.salvarItensML(orderId, canal, itens)
      : this.salvarItensShopee(orderId, canal, itens);
  },

  /**
   * Busca itens de um pedido do banco
   */
  async buscarItens(orderId: string): Promise<any[]> {
    try {
      const { data, error } = await dbClient
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('sincronizado_em', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar itens: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error(`❌ Erro ao buscar itens:`, error);
      return [];
    }
  },
};
