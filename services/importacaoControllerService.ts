// ============================================================================
// services/importacaoControllerService.ts
// Controle manual de importações do Bling (SEM AUTO-IMPORTAÇÃO)
// ============================================================================

import { dbClient } from '../lib/supabaseClient';
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
  venda_origem?: string;
  id_pedido_loja?: string;
  jaImportado?: boolean;
  dataImportacao?: string;
  codigoRastreamento?: string;
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

export class ImportacaoControllerService {
  /**
   * 🎯 Buscar TODOS os pedidos do Bling que NÃO estão vinculados (Paginação Ilimitada Limitada pelo Usuário)
   * CORRIGIDO: Usa 'limite', 'pagina', 'dataInicial', 'dataFinal' da API v3
   */
  static async buscarPedidosNaoVinculados(
    token: string,
    opcoes: {
      quantidadeDesejada?: number;
      dataInicial?: string;
      dataFinal?: string;
      origem?: string;
    } = {}
  ): Promise<{
    pedidosNaoVinculados: PedidoblingNaoVinculado[];
    total: number;
    avisos: string[];
  }> {
    try {
      console.log('🔍 Buscando pedidos Bling não vinculados...');

      const { quantidadeDesejada = 100, dataInicial, dataFinal } = opcoes;
      const limite = 100;
      let pagina = 1;
      let continuarBuscando = true;
      let todosPedidosBling: any[] = [];

      while (continuarBuscando) {
        let urlBling = `https://www.bling.com.br/Api/v3/pedidos/vendas?limite=${limite}&pagina=${pagina}`;
        if (dataInicial) urlBling += `&dataInicial=${dataInicial}`;
        if (dataFinal) urlBling += `&dataFinal=${dataFinal}`;

        const respBling = await fetch(urlBling, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!respBling.ok) {
          if (respBling.status === 429) {
            console.warn('Rate limit Bling atingido. Aguardando...');
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          throw new Error(`Erro ao buscar Bling: ${respBling.status}`);
        }

        const dataBling = await respBling.json();
        const pedidosBase = dataBling?.data || [];

        todosPedidosBling = [...todosPedidosBling, ...pedidosBase];

        if (pedidosBase.length < limite || todosPedidosBling.length >= quantidadeDesejada * 2 || pagina >= 20) {
          continuarBuscando = false;
        } else {
          pagina++;
          await new Promise(r => setTimeout(r, 400)); // Rate limit prevention
        }
      }

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BUSCAR IMPORTADOS NO ERP
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      const { data: pedidosERP } = await dbClient
        .from('orders')
        .select('external_id, numero_pedido')
        .not('external_id', 'is', null);

      const idsJaImportados = new Set(
        (pedidosERP || []).map(p => String(p.external_id || p.numero_pedido))
      );

      const avisos: string[] = [];
      const naoVinculadosProcessados: PedidoblingNaoVinculado[] = todosPedidosBling
        .filter((pedido: any) => !idsJaImportados.has(String(pedido.id)))
        .map((pedido: any) => {
          let origem: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' | 'OUTRO' = 'OUTRO';

          const canalStr = (pedido?.canal?.descricao || pedido?.canal || '').toUpperCase();
          const nomeLojaStr = (pedido?.loja?.nome || '').toUpperCase();
          let numeroLojaOriginal = pedido.numeroLoja || '';

          if (!numeroLojaOriginal) {
            const info = pedido?.observacoes || JSON.stringify(pedido?.informacoesAdicionais || {});
            const match = info.match(/(?:Número\s+(?:loja|virtual)|Pedido)\s*[:\-]?\s*([A-Za-z0-9\-_]+)/i);
            if (match) numeroLojaOriginal = match[1].trim();
          }

          if (canalStr.includes('SHOPEE') || nomeLojaStr.includes('SHOPEE') || numeroLojaOriginal.toUpperCase().includes('SP')) {
            origem = 'SHOPEE';
          } else if (canalStr.includes('MERCADO') || nomeLojaStr.includes('MERCADO') || numeroLojaOriginal.match(/ML[A-Z0-9]+/i)) {
            origem = 'MERCADO_LIVRE';
          } else if (canalStr.includes('SITE') || nomeLojaStr.includes('SITE')) {
            origem = 'SITE';
          }

          return {
            id: `bling_${pedido.id}`,
            numero: pedido.numero,
            numeroLoja: numeroLojaOriginal,
            dataCompra: pedido.data || new Date().toISOString(),
            cliente: {
              nome: pedido?.contato?.nome || 'Sem nome',
              cpfCnpj: pedido?.contato?.numeroDocumento || '-',
            },
            origem,
            itens: (pedido?.itens || []).map((item: any) => ({
              descricao: item.descricao,
              sku: item.codigo,
              quantidade: item.quantidade,
              valor: item.valor,
            })),
            total: pedido.total || 0,
            status: pedido.situacao?.descricao || 'aberto',
            venda_origem: nomeLojaStr || canalStr,
            id_pedido_loja: numeroLojaOriginal,
            jaImportado: false,
            codigoRastreamento: pedido?.transporte?.codigoRastreamento || ''
          };
        });

      if (naoVinculadosProcessados.length === 0) {
        avisos.push('✅ Todos os pedidos retornados do Bling já estão no ERP.');
      } else {
        avisos.push(`⚠️ Exibindo ${naoVinculadosProcessados.slice(0, quantidadeDesejada).length} de ${naoVinculadosProcessados.length} não vinculados.`);
      }

      return {
        pedidosNaoVinculados: naoVinculadosProcessados.slice(0, quantidadeDesejada),
        total: todosPedidosBling.length,
        avisos,
      };
    } catch (error: any) {
      console.error('❌ Erro:', error);
      throw error;
    }
  }

  /**
   * 📋 Buscar pedidos em aberto de plataformas específicas (com paginação)
   * CORRIGIDO: API V3
   */
  static async buscarPedidosEmAbertoPorPlataforma(
    token: string,
    plataforma: 'MERCADO_LIVRE' | 'SHOPEE' | 'TODOS',
    opcoes: {
      quantidadeDesejada?: number;
      dataInicial?: string;
      dataFinal?: string;
      apenasComEtiqueta?: boolean;
      // new filters added based on user requirements
      idsSituacoes?: number[];      // conjunto de situações (6 = aberto, 15 = em andamento, etc.)
      idLoja?: string | number;    // filtrar por ID da loja
      ordenar?: 'asc' | 'desc';    // ordenação por dataCompra
      pagina?: number;             // página específica para buscar
      limite?: number;             // tamanho da página (default 100)
    } = {}
  ): Promise<{
    pedidosDisponiveis: PedidoblingNaoVinculado[];
    total: number;
    quantidadeDesejada: number;
    plataforma: string;
  }> {
    try {
      console.log(`📋 Buscando ${plataforma}...`);

      // destructure new filters
      const {
        quantidadeDesejada = 200,
        dataInicial,
        dataFinal,
        apenasComEtiqueta = false,
        idsSituacoes,
        idLoja,
        ordenar,
        pagina: paginaOpcional,
        limite: limiteOpcional,
      } = opcoes;
      let todosOsPedidos: any[] = [];
      let pagina = paginaOpcional || 1;
      const limite = limiteOpcional || 100;
      let continuarCarregando = true;

      while (continuarCarregando) {
        // montar query string com os filtros dinâmicos
        const situacoesParam = (idsSituacoes && idsSituacoes.length > 0)
          ? idsSituacoes.map(id => `&idsSituacoes[]=${id}`).join('')
          : '&idsSituacoes[]=6&idsSituacoes[]=15'; // default aberto + andamento

        let url = `https://www.bling.com.br/Api/v3/pedidos/vendas?limite=${limite}&pagina=${pagina}${situacoesParam}`;
        if (dataInicial) url += `&dataInicial=${dataInicial}`;
        if (dataFinal) url += `&dataFinal=${dataFinal}`;
        if (idLoja) url += `&idLoja=${idLoja}`;

        // NOTE: Bling doesn't have explicit order param; we'll handle client-side after fetch.

        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) {
          if (resp.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
          throw new Error(`Erro: ${resp.status}`);
        }

        const data = await resp.json();
        const pedidos = data?.data || [];

        if (pedidos.length === 0) {
          continuarCarregando = false;
        } else {
          for (const p of pedidos) {
            const canal = (p?.canal?.descricao || '').toUpperCase();
            const nomeLoja = (p?.loja?.nome || '').toUpperCase();
            const obs = (p.observacoes || '').toUpperCase();

            let isPlataformaMlc = canal.includes('MERCADO') || nomeLoja.includes('MERCADO');
            let isPlataformaShopee = canal.includes('SHOPEE') || nomeLoja.includes('SHOPEE') || obs.includes('SHOPEE');

            let ok = false;
            if (plataforma === 'TODOS') ok = true;
            else if (plataforma === 'MERCADO_LIVRE' && isPlataformaMlc) ok = true;
            else if (plataforma === 'SHOPEE' && isPlataformaShopee) ok = true;

            if (ok) {
              // Checa etiqueta
              if (apenasComEtiqueta) {
                const temRastreio = p?.transporte?.codigoRastreamento?.length > 0;
                if (temRastreio) todosOsPedidos.push(p);
              } else {
                todosOsPedidos.push(p);
              }
            }
          }

          if (todosOsPedidos.length >= quantidadeDesejada || pedidos.length < limite || pagina > 10) {
            continuarCarregando = false;
          } else {
            pagina++;
            await new Promise(r => setTimeout(r, 300));
          }
        }
      }

      let ordenados = todosOsPedidos;
      if (ordenar) {
        ordenados = ordenados.sort((a: any, b: any) => {
          const da = new Date(a.data).getTime();
          const db = new Date(b.data).getTime();
          return ordenar === 'asc' ? da - db : db - da;
        });
      }

      const formatados = ordenados.slice(0, quantidadeDesejada).map((pedido: any) => {
        let numeroLojaOriginal = pedido.numeroLoja || '';
        if (!numeroLojaOriginal) {
          const info = pedido?.observacoes || '';
          const match = info.match(/(?:Número|Pedido)\s*[:\-]?\s*([A-Za-z0-9\-_]+)/i);
          if (match) numeroLojaOriginal = match[1].trim();
        }

        let origem: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' | 'OUTRO' = 'OUTRO';
        const canalStr = (pedido?.loja?.nome || '').toUpperCase();
        if (canalStr.includes('MERCADO')) origem = 'MERCADO_LIVRE';
        else if (canalStr.includes('SHOPEE')) origem = 'SHOPEE';
        else if (canalStr.includes('SITE')) origem = 'SITE';

        return {
          id: `bling_${pedido.id}`,
          numero: pedido.numero,
          numeroLoja: numeroLojaOriginal,
          dataCompra: pedido.data || new Date().toISOString(),
          cliente: {
            nome: pedido?.contato?.nome || 'Sem nome',
            cpfCnpj: pedido?.contato?.numeroDocumento || '-',
          },
          origem,
          itens: (pedido?.itens || []).map((item: any) => ({
            descricao: item.descricao,
            sku: item.codigo,
            quantidade: item.quantidade,
            valor: item.valor,
          })),
          total: pedido.total || 0,
          status: pedido.situacao?.descricao || 'Em aberto',
          venda_origem: pedido?.loja?.nome || 'N/A',
          id_pedido_loja: numeroLojaOriginal,
          codigoRastreamento: pedido?.transporte?.codigoRastreamento || '',
          jaImportado: false,
        };
      });

      // se o chamador não especificou ordenação, mantemos ordem crescente
      if (!ordenar) {
        formatados.sort((a, b) => new Date(a.dataCompra).getTime() - new Date(b.dataCompra).getTime());
      }

      return {
        pedidosDisponiveis: formatados,
        total: todosOsPedidos.length,
        quantidadeDesejada,
        plataforma,
      };
    } catch (error: any) {
      console.error(`❌ Erro buscar ${plataforma}:`, error.message);
      throw error;
    }
  }

  // A função processarImportacao agora usa o repositório ou DB Client p salvar os Vínculos exatos.
  static async solicitarImportacao(
    pedidoVendaIds: (string | number)[],
    usuarioSolicitante: string
  ): Promise<ImportacaoManual> {
    const importacao: ImportacaoManual = {
      id: `import_${Date.now()}`,
      pedidoVendaIds,
      usuarioSolicitante,
      dataSolicitacao: new Date().toISOString(),
      status: 'pendente',
    };
    return importacao;
  }
}

export const importacaoControllerService = new ImportacaoControllerService();
