// ============================================================================
// services/importacaoControllerService.ts
// Controle manual de importações do Bling (SEM AUTO-IMPORTAÇÃO)
// ============================================================================

import { supabaseClient as dbClient } from './supabaseClient';
import { auditLogService } from './auditLogService';

export interface PedidoblingNaoVinculado {
  id: string;
  numero: string;
  numeroLoja?: string;
  dataCompra: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
  };
  origem: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' | 'OUTRO';
  itens: Array<{
    descricao: string;
    sku: string;
    quantidade: number;
    valor: number;
  }>;
  total: number;
  status: string;
  jaImportado?: boolean;
  dataImportacao?: string;
}

export interface ImportacaoManual {
  id: string;
  pedidoVendaIds: (string | number)[];
  usuarioSolicitante: string;
  dataSolicitacao: string;
  status: 'pendente' | 'processando' | 'concluida' | 'erro';
  resultados?: {
    importados: number;
    falhados: number;
    mensagem: string;
  };
  erro?: string;
}

/**
 * Serviço de Importação Manual
 * Permite usuário controlar QUANDO importar pedidos do Bling
 */
export class ImportacaoControllerService {
  /**
   * 🎯 Buscar pedidos do Bling que NÃO estão vinculados em ImportaçõesERP
   */
  static async buscarPedidosNaoVinculados(
    token: string,
    opcoes: {
      limit?: number;
      offset?: number;
      dataInicio?: string;
      dataFim?: string;
      origem?: string;
    } = {}
  ): Promise<{
    pedidosNaoVinculados: PedidoblingNaoVinculado[];
    total: number;
    avisos: string[];
  }> {
    try {
      console.log('🔍 Buscando pedidos Bling não vinculados...');

      const { limit = 100, offset = 0, dataInicio, dataFim, origem } = opcoes;

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PASSO 1: Buscar TODOS os pedidos do Bling (com filtros opcionais)
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      let urlBling = `https://www.bling.com.br/Api/v3/pedidos/vendas?limit=${limit}&offset=${offset}`;
      
      if (dataInicio) urlBling += `&dataInicio=${dataInicio}`;
      if (dataFim) urlBling += `&dataFim=${dataFim}`;

      const respBling = await fetch(urlBling, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!respBling.ok) {
        throw new Error(`Erro ao buscar Bling: ${respBling.status}`);
      }

      const dataBling = await respBling.json();
      const pedidosBling = dataBling?.data || [];

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PASSO 2: Buscar pedidos JÁ importados na tabela `orders` do ERP
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const { data: pedidosERP } = await dbClient
        .from('orders')
        .select('external_id, numero_pedido')
        .not('external_id', 'is', null);

      const idsJaImportados = new Set(
        (pedidosERP || []).map(p => String(p.external_id || p.numero_pedido))
      );

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // PASSO 3: Filtrar apenas pedidos NÃO vinculados
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const avisos: string[] = [];
      const pedidosNaoVinculados: PedidoblingNaoVinculado[] = pedidosBling
        .filter((pedido: any) => {
          const jaImportado = idsJaImportados.has(String(pedido.id));
          return !jaImportado; // Retorna APENAS não importados
        })
        .map((pedido: any) => {
          // ✅ Detectar origem CORRETA: Marketplace (não Bling)
          let origem: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' | 'OUTRO' = 'OUTRO';
          
          // Procurar em diferentes campos para identificar o marketplace
          const canalStr = (pedido?.canal || pedido?.canaldados || pedido?.origem || '').toUpperCase();
          const nomeLojaStr = (pedido?.nomeLojaVirtual || '').toUpperCase();
          const idLojaVirtual = pedido?.idLojaVirtual || pedido?.lojaVirtualId;
          
          if (canalStr.includes('SHOPEE') || nomeLojaStr.includes('SHOPEE')) {
            origem = 'SHOPEE';
          } else if (canalStr.includes('MERCADO') || nomeLojaStr.includes('MERCADO')) {
            origem = 'MERCADO_LIVRE';
          } else if (canalStr.includes('SITE') || canalStr.includes('TRAY') || canalStr.includes('WOOCOMMERCE') || nomeLojaStr.includes('SITE')) {
            origem = 'SITE';
          }

          return {
            id: `bling_${pedido.id}`,
            numero: pedido.numero,
            numeroLoja: pedido.numeroLoja,
            dataCompra: pedido.data || new Date().toISOString(),
            cliente: {
              nome: pedido?.contato?.nome || 'Sem nome',
              cpfCnpj: pedido?.contato?.numeroDocumento || '-',
              email: pedido?.contato?.email,
            },
            origem,
            itens: (pedido?.itens || []).map((item: any) => ({
              descricao: item.descricao,
              sku: item.codigo,
              quantidade: item.quantidade,
              valor: item.valor,
            })),
            total: pedido.total || 0,
            status: pedido.status || 'aberto',
            jaImportado: false,
            dataImportacao: undefined,
          };
        });

      if (pedidosNaoVinculados.length === 0) {
        avisos.push('✅ Todos os pedidos do Bling já estão vinculados no ERP!');
      } else {
        avisos.push(`⚠️ ${pedidosNaoVinculados.length} pedido(s) ainda não vinculado(s)`);
      }

      return {
        pedidosNaoVinculados,
        total: pedidosBling.length,
        avisos,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar pedidos não vinculados:', error.message);
      throw error;
    }
  }

  /**
   * 📋 Buscar apenas pedidos Mercado Livre que têm etiqueta pronta
   */
  static async buscarMercadoLivreComEtiquetaPronta(
    token: string,
    opcoes: {
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    pedidos: PedidoblingNaoVinculado[];
    total: number;
    comEtiqueta: number;
    semEtiqueta: number;
  }> {
    try {
      console.log('🎫 Buscando pedidos Mercado Livre com etiqueta pronta...');

      const { limit = 100, offset = 0 } = opcoes;

      // Buscar pedidos do Mercado Livre do Bling
      const urlBling = `https://www.bling.com.br/Api/v3/pedidos/vendas?limit=${limit}&offset=${offset}&channel=marketplace`;

      const respBling = await fetch(urlBling, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!respBling.ok) {
        throw new Error(`Erro ao buscar Bling: ${respBling.status}`);
      }

      const dataBling = await respBling.json();
      const pedidosBling = (dataBling?.data || []).filter((p: any) => {
        // Filtrar apenas Mercado Livre
        const canal = (p?.canal || p?.canaldados || '').toUpperCase();
        const nomeLojaVirtual = (p?.nomeLojaVirtual || '').toUpperCase();
        return (
          canal.includes('MERCADO') ||
          nomeLojaVirtual.includes('MERCADO') ||
          canal.includes('ML')
        );
      });

      // Filtrar apenas os que têm etiqueta (transportadora + rastreio)
      const comEtiqueta = pedidosBling.filter(
        (p: any) => p?.transporte?.codigoRastreamento
      );

      console.log(
        `📊 Total Mercado Livre: ${pedidosBling.length} | Com etiqueta: ${comEtiqueta.length}`
      );

      return {
        pedidos: comEtiqueta.map((pedido: any) => ({
          id: `bling_${pedido.id}`,
          numero: pedido.numero,
          numeroLoja: pedido.numeroLoja,
          dataCompra: pedido.data || new Date().toISOString(),
          cliente: {
            nome: pedido?.contato?.nome || 'Sem nome',
            cpfCnpj: pedido?.contato?.numeroDocumento || '-',
            email: pedido?.contato?.email,
          },
          origem: 'MERCADO_LIVRE' as const,
          itens: (pedido?.itens || []).map((item: any) => ({
            descricao: item.descricao,
            sku: item.codigo,
            quantidade: item.quantidade,
            valor: item.valor,
          })),
          total: pedido.total || 0,
          status: pedido.status || 'aberto',
          jaImportado: false,
        })),
        total: pedidosBling.length,
        comEtiqueta: comEtiqueta.length,
        semEtiqueta: pedidosBling.length - comEtiqueta.length,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar Mercado Livre:', error.message);
      throw error;
    }
  }

  /**
   * 📋 Buscar pedidos NFe SEM limite de quantidade (usuário escolhe quantos quer)
   */
  static async buscarPedidosNfeComSelecaoCustomizada(
    token: string,
    opcoes: {
      quantidadeDesejada?: number; // Usuário escolhe quantos quer
      dataInicio?: string;
      dataFim?: string;
      status?: string;
    } = {}
  ): Promise<{
    pedidosDisponiveis: PedidoblingNaoVinculado[];
    total: number;
    quantidadeDesejada: number;
  }> {
    try {
      console.log('📋 Buscando pedidos NFe (sem limite)...');

      const { quantidadeDesejada = 50, dataInicio, dataFim, status } = opcoes;

      // Carregar TODOS os pedidos (paginação infinita)
      let todosOsPedidos: any[] = [];
      let offset = 0;
      const limit = 100;
      let continuarCarregando = true;

      while (continuarCarregando) {
        let url = `https://www.bling.com.br/Api/v3/pedidos/vendas?limit=${limit}&offset=${offset}`;

        if (dataInicio) url += `&dataInicio=${dataInicio}`;
        if (dataFim) url += `&dataFim=${dataFim}`;

        const resp = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!resp.ok) {
          throw new Error(`Erro ao buscar: ${resp.status}`);
        }

        const data = await resp.json();
        const pedidos = data?.data || [];

        if (pedidos.length === 0) {
          continuarCarregando = false;
        } else {
          todosOsPedidos = [...todosOsPedidos, ...pedidos];
          offset += limit;

          console.log(
            `   📥 Carregado: ${todosOsPedidos.length} pedidos (página ${Math.ceil(offset / limit)})`
          );

          if (todosOsPedidos.length >= quantidadeDesejada * 2) {
            // Carregar um pouco mais que o desejado
            continuarCarregando = false;
          }
        }
      }

      // Retornar a quantidade desejada
      const pedidosSelecionados = todosOsPedidos.slice(0, quantidadeDesejada);

      return {
        pedidosDisponiveis: pedidosSelecionados.map((pedido: any) => ({
          id: `bling_${pedido.id}`,
          numero: pedido.numero,
          numeroLoja: pedido.numeroLoja,
          dataCompra: pedido.data || new Date().toISOString(),
          cliente: {
            nome: pedido?.contato?.nome || 'Sem nome',
            cpfCnpj: pedido?.contato?.numeroDocumento || '-',
            email: pedido?.contato?.email,
          },
          origem: 'SITE' as const,
          itens: (pedido?.itens || []).map((item: any) => ({
            descricao: item.descricao,
            sku: item.codigo,
            quantidade: item.quantidade,
            valor: item.valor,
          })),
          total: pedido.total || 0,
          status: pedido.status || 'aberto',
          jaImportado: false,
        })),
        total: todosOsPedidos.length,
        quantidadeDesejada,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar pedidos NFe:', error.message);
      throw error;
    }
  }

  /**
   * 📋 Solicitar importação manual de pedidos específicos
   */
  static async solicitarImportacao(
    pedidoVendaIds: (string | number)[],
    usuarioSolicitante: string
  ): Promise<ImportacaoManual> {
    try {
      const importacao: ImportacaoManual = {
        id: `import_${Date.now()}`,
        pedidoVendaIds,
        usuarioSolicitante,
        dataSolicitacao: new Date().toISOString(),
        status: 'pendente',
      };

      // Salvar solicitação no BD (opcional, para rastreamento)
      await dbClient.from('import_requests').insert({
        id: importacao.id,
        pedido_ids: pedidoVendaIds,
        usuario: usuarioSolicitante,
        data_solicitacao: importacao.dataSolicitacao,
        status: 'pendente',
      }).catch(() => {
        console.warn('⚠️ Não foi possível registrar solicitação no BD');
      });

      // Registrar na auditoria
      await auditLogService.registrarImportacao(
        `Solicitação de importação manual: ${pedidoVendaIds.length} pedido(s)`,
        'sincronizacao',
        'sucesso',
        {
          canal: 'BLING',
          totalPedidos: pedidoVendaIds.length,
          usuario: usuarioSolicitante,
        },
        usuarioSolicitante
      );

      return importacao;
    } catch (error: any) {
      console.error('❌ Erro ao solicitar importação:', error.message);
      throw error;
    }
  }

  /**
   * 🔄 Processar importação (APENAS quando usuário clica "Importar")
   */
  static async processarImportacao(
    importacao: ImportacaoManual,
    blingBulkLoaderService: any
  ): Promise<ImportacaoManual> {
    try {
      console.log(`\n📥 Iniciando importação manual: ${importacao.id}`);
      console.log(`   Pedidos: ${importacao.pedidoVendaIds.join(', ')}`);

      // Atualizar status para "processando"
      importacao.status = 'processando';

      // Processar cada pedido
      const resultados = {
        importados: 0,
        falhados: 0,
        mensagem: '',
      };

      for (const pvId of importacao.pedidoVendaIds) {
        try {
          // Buscar pedido específico
          const { pedidos } = await blingBulkLoaderService.carregarTodosPedidos(
            null, // token será pego de outro lugar
            { limit: 1, filtroId: pvId }
          );

          if (pedidos.length > 0) {
            // Salvar no BD
            const { salvos, erros } = await blingBulkLoaderService.salvarNoBancoDados(
              pedidos,
              'orders'
            );

            resultados.importados += salvos;
            resultados.falhados += erros;
          }
        } catch (e: any) {
          console.warn(`   ❌ Erro ao importar ${pvId}: ${e.message}`);
          resultados.falhados += 1;
        }
      }

      // Finalizar
      importacao.status = 'concluida';
      importacao.resultados = {
        ...resultados,
        mensagem: `✅ ${resultados.importados} importado(s), ${resultados.falhados} erro(s)`,
      };

      // Registrar conclusão
      await auditLogService.registrarImportacao(
        `Importação manual concluída: ${importacao.id}`,
        'sincronizacao',
        resultados.falhados === 0 ? 'sucesso' : 'aviso',
        {
          canal: 'BLING',
          totalPedidos: resultados.importados + resultados.falhados,
          totalItens: resultados.importados,
          detalhes: resultados.mensagem,
        },
        importacao.usuarioSolicitante
      );

      return importacao;
    } catch (error: any) {
      console.error('❌ Erro ao processar importação:', error.message);
      importacao.status = 'erro';
      importacao.erro = error.message;

      await auditLogService.registrarImportacao(
        `Erro na importação manual: ${importacao.id}`,
        'sincronizacao',
        'erro',
        {
          canal: 'BLING',
          totalPedidos: importacao.pedidoVendaIds.length,
          detalhes: error.message,
        },
        importacao.usuarioSolicitante
      );

      return importacao;
    }
  }

  /**
   * 📊 Contar pedidos por origem
   */
  static analisarOrigens(pedidos: PedidoblingNaoVinculado[]): Record<string, number> {
    return pedidos.reduce((acc, pedido) => {
      acc[pedido.origem] = (acc[pedido.origem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * 💰 Calcular valor total de pedidos não importados
   */
  static calcularValorTotal(pedidos: PedidoblingNaoVinculado[]): number {
    return pedidos.reduce((sum, pedido) => sum + (pedido.total || 0), 0);
  }

  /**
   * 🗂️ Agrupar por status
   */
  static agruparPorStatus(
    pedidos: PedidoblingNaoVinculado[]
  ): Record<string, PedidoblingNaoVinculado[]> {
    return pedidos.reduce((acc, pedido) => {
      const status = pedido.status || 'desconhecido';
      if (!acc[status]) acc[status] = [];
      acc[status].push(pedido);
      return acc;
    }, {} as Record<string, PedidoblingNaoVinculado[]>);
  }
}

export const importacaoControllerService = new ImportacaoControllerService();
