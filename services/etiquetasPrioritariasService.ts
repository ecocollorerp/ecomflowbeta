// ============================================================================
// services/etiquetasPrioritariasService.ts
// Serviço especializado para gerenciar o fluxo completo de Etiquetas Prioritárias
// Integração com Bling API única, armazenagem em ZPL ou PC
// ============================================================================

import { dbClient as supabaseClient } from '../lib/supabaseClient';
import { auditLogService } from './auditLogService';

export interface EtiquetaPrioritariaDTO {
  pedidoId: string;
  numeroBling: string;
  nfeLote: string;
  dataGeracao: string;
  statusProcessamento: 'pendente' | 'processando' | 'concluido' | 'salvo_no_pc' | 'erro';
  armazenagem: 'zpl' | 'pc';
  conteudoZpl?: string;
  conteudoTxt?: string;
  caminhoArquivo?: string;
  rastreabilidade: {
    numeroBling: string;
    lojaVirtual: string;
    canalVendas: string;
  };
  metadados?: {
    codeRastreamento?: string;
    destinatario?: string;
    remetente?: string;
  };
}

/**
 * Serviço de Etiquetas Prioritárias
 * Gerencia o fluxo completo: Pedidos → NF-e → Etiquetas Reais Bling → Armazenagem ZPL/PC
 */
export class EtiquetasPrioritariasService {
  /**
   * 🔍 Buscar etiqueta REAL do Bling para um número de pedido
   */
  static async buscarEtiquetaBlingReal(
    numeroPedido: string,
    tokenBling: string
  ): Promise<{
    sucesso: boolean;
    etiqueta?: any;
    rastreamento?: string;
    erro?: string;
  }> {
    try {
      console.log(`🔍 [ETIQUETA PRIORITÁRIA] Buscando etiqueta real do Bling para ${numeroPedido}...`);

      // 1. Buscar pedido no Bling
      const respPedido = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${numeroPedido}`,
        {
          headers: {
            Authorization: `Bearer ${tokenBling}`,
            Accept: 'application/json',
          },
        }
      );

      if (!respPedido.ok) {
        throw new Error(`Pedido ${numeroPedido} não encontrado (HTTP ${respPedido.status})`);
      }

      const dataPedido = await respPedido.json();
      const pedido = dataPedido?.data;

      if (!pedido) {
        throw new Error('Dados do pedido vazios');
      }

      // 2. Verificar se há etiqueta/rastreamento
      const rastreamento = pedido?.transporte?.codigoRastreamento;
      const etiquetaUrl = pedido?.transporte?.etiqueta;
      const transportadora = pedido?.transporte?.transportadora?.nome;

      console.log(`✅ [ETIQUETA PRIORITÁRIA] Etiqueta encontrada:`, {
        rastreamento,
        transportadora,
        temUrl: !!etiquetaUrl,
      });

      return {
        sucesso: true,
        etiqueta: {
          numero: pedido.numero,
          cliente: pedido.cliente,
          endereco: pedido.enderecoEntrega,
          rastreamento,
          transportadora,
          etiquetaUrl,
          totalPedido: pedido.totalPedido,
        },
        rastreamento,
      };
    } catch (error: any) {
      console.error(`❌ [ETIQUETA PRIORITÁRIA] Erro ao buscar etiqueta:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 🎫 Converter etiqueta Bling para formato ZPL (impressora térmica)
   */
  static converterParaZPL(
    etiquetaWling: any,
    pedidoInfo: {
      numero: string;
      nfeNumero?: string;
      nfeLote?: string;
      lojaVirtual: string;
      canalVendas: string;
    }
  ): string {
    try {
      const endereco = etiquetaWling.endereco || {};
      const rastreamento = etiquetaWling.rastreamento || 'SEM_RASTREAMENTO';
      const transportadora = etiquetaWling.transportadora || 'TRANSPORTADORA';

      // Formatar endereço
      const rua = `${endereco.rua || ''}, ${endereco.numero || ''}`.trim();
      const bairro_cidade = `${endereco.bairro || ''} - ${endereco.cidade || ''} ${
        endereco.estado || ''
      }`.trim();
      const cep = endereco.cep || '';

      // Gerar ZPL (formato para etiquetadora térmica Zebra)
      const zpl = `^XA
^MMT
^PW800
^LL1200
^LS0
^BY2,3,100
^FT50,100^BEN^FD${rastreamento}^FS
^FT600,100^A0N,20^FD${transportadora}^FS
^CF0,40
^FT50,250^FD${etiquetaWling.cliente?.nome || 'CLIENTE'}^FS
^CF0,25
^FT50,350^FD${rua}^FS
^FT50,400^FD${bairro_cidade}^FS
^FT50,450^FD${cep}^FS
^CF0,20
^FT50,550^FDPEDIDO: ${pedidoInfo.numero}^FS
^FT50,590^FDNF-e: ${pedidoInfo.nfeNumero || 'N/A'} | LOTE: ${pedidoInfo.nfeLote || 'N/A'}^FS
^FT50,630^FDLOJA: ${pedidoInfo.lojaVirtual} | CANAL: ${pedidoInfo.canalVendas}^FS
^CF0,15
^FT50,700^FD${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}^FS
^FT50,750^FDRASTREABILIDADE COMPLETA^FS
^XZ`;

      console.log(`✅ [ZPL] Formato ZPL gerado com sucesso`);
      return zpl;
    } catch (error: any) {
      console.error(`❌ [ZPL] Erro ao converter para ZPL:`, error);
      throw error;
    }
  }

  /**
   * 💾 Salvar etiqueta em formato ZPL no banco
   */
  static async salvarEtiquetaZPL(
    dto: EtiquetaPrioritariaDTO
  ): Promise<{
    sucesso: boolean;
    id?: string;
    erro?: string;
  }> {
    try {
      console.log(`💾 [ZPL] Salvando etiqueta em ZPL...`);

      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .insert([
          {
            pedido_id: dto.pedidoId,
            numero_bling: dto.numeroBling,
            nfe_lote: dto.nfeLote,
            data_geracao: dto.dataGeracao,
            status_processamento: 'concluido',
            armazenagem: 'zpl',
            conteudo_zpl: dto.conteudoZpl,
            rastreabilidade: dto.rastreabilidade,
            metadados: dto.metadados,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [ZPL] Etiqueta salva com sucesso:`, data?.id);

      // Log de auditoria
      await auditLogService.registrar({
        acao: 'ETIQUETA_PRIORITARIA_ZPL_SALVA',
        descricao: `Etiqueta ZPL salva para pedido ${dto.numeroBling}, lote ${dto.nfeLote}`,
        metadados: {
          etiquetaId: data?.id,
          numeroBling: dto.numeroBling,
        },
      });

      return {
        sucesso: true,
        id: data?.id,
      };
    } catch (error: any) {
      console.error(`❌ [ZPL] Erro ao salvar etiqueta:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 📥 Salvar etiqueta como arquivo (PC ou blob)
   */
  static async salvarEtiquetaArquivo(
    dto: EtiquetaPrioritariaDTO,
    opcao: 'download' | 'blob'
  ): Promise<{
    sucesso: boolean;
    arquivo?: Blob | string;
    erro?: string;
  }> {
    try {
      console.log(`📥 [ARQUIVO] Salvando etiqueta como arquivo (${opcao})...`);

      const conteudo = dto.conteudoTxt || dto.conteudoZpl || '';

      if (opcao === 'download') {
        // Gerar download do arquivo
        const blob = new Blob([conteudo], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiqueta-${dto.numeroBling}-${dto.nfeLote}-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Registrar arquivo baixado no banco
        const caminhoArquivo = a.download;
        await supabaseClient
          .from('etiquetas_prioritarias')
          .insert([
            {
              pedido_id: dto.pedidoId,
              numero_bling: dto.numeroBling,
              nfe_lote: dto.nfeLote,
              data_geracao: dto.dataGeracao,
              status_processamento: 'salvo_no_pc',
              armazenagem: 'pc',
              caminho_arquivo: caminhoArquivo,
              rastreabilidade: dto.rastreabilidade,
            },
          ]);

        console.log(`✅ [ARQUIVO] Etiqueta baixada: ${a.download}`);
        return {
          sucesso: true,
          arquivo: caminhoArquivo,
        };
      } else {
        // Retornar como blob
        const blob = new Blob([conteudo], { type: 'text/plain' });
        console.log(`✅ [ARQUIVO] Blob criado com sucesso`);
        return {
          sucesso: true,
          arquivo: blob,
        };
      }
    } catch (error: any) {
      console.error(`❌ [ARQUIVO] Erro ao salvar arquivo:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 🔄 Reabrir etiqueta para regenerar/visualizar
   */
  static async reabrirEtiqueta(
    etiquetaId: string
  ): Promise<{
    sucesso: boolean;
    etiqueta?: any;
    erro?: string;
  }> {
    try {
      console.log(`🔄 [REABRIR] Reabrindo etiqueta ${etiquetaId}...`);

      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .select('*')
        .eq('id', etiquetaId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Etiqueta não encontrada');

      console.log(`✅ [REABRIR] Etiqueta reaberla:`, data.nfe_lote);
      return {
        sucesso: true,
        etiqueta: data,
      };
    } catch (error: any) {
      console.error(`❌ [REABRIR] Erro ao reabrir:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 📊 Listar etiquetas por lote
   */
  static async listarPorLote(
    nfeLote: string
  ): Promise<{
    sucesso: boolean;
    etiquetas?: any[];
    erro?: string;
  }> {
    try {
      console.log(`📊 [LOTE] Listando etiquetas do lote ${nfeLote}...`);

      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .select('*')
        .eq('nfe_lote', nfeLote)
        .order('data_geracao', { ascending: false });

      if (error) throw error;

      console.log(`✅ [LOTE] ${data?.length || 0} etiqueta(s) encontrada(s)`);
      return {
        sucesso: true,
        etiquetas: data,
      };
    } catch (error: any) {
      console.error(`❌ [LOTE] Erro ao listar:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 🗑️ Deletar etiqueta
   */
  static async deletarEtiqueta(
    etiquetaId: string
  ): Promise<{
    sucesso: boolean;
    erro?: string;
  }> {
    try {
      console.log(`🗑️ [DELETE] Deletando etiqueta ${etiquetaId}...`);

      const { error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .delete()
        .eq('id', etiquetaId);

      if (error) throw error;

      console.log(`✅ [DELETE] Etiqueta deletada`);
      return { sucesso: true };
    } catch (error: any) {
      console.error(`❌ [DELETE] Erro ao deletar:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }

  /**
   * 📈 Gerar relatório de etiquetas por período
   */
  static async gerarRelatorio(
    dataInicio: string,
    dataFim: string
  ): Promise<{
    sucesso: boolean;
    relatorio?: {
      totalEtiquetas: number;
      processadas: number;
      salvasPC: number;
      porLote: Record<string, number>;
      porCanal: Record<string, number>;
      porLoja: Record<string, number>;
    };
    erro?: string;
  }> {
    try {
      console.log(`📈 [RELATÓRIO] Gerando relatório de ${dataInicio} até ${dataFim}...`);

      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .select('*')
        .gte('data_geracao', dataInicio)
        .lte('data_geracao', dataFim);

      if (error) throw error;

      // Processar dados
      const totalEtiquetas = data?.length || 0;
      const processadas = data?.filter((e: any) => e.status_processamento === 'concluido').length;
      const salvasPC = data?.filter((e: any) => e.armazenagem === 'pc').length;

      const porLote: Record<string, number> = {};
      const porCanal: Record<string, number> = {};
      const porLoja: Record<string, number> = {};

      data?.forEach((etiqueta: any) => {
        // Por lote
        porLote[etiqueta.nfe_lote] = (porLote[etiqueta.nfe_lote] || 0) + 1;

        // Por canal
        const canal = etiqueta.rastreabilidade?.canalVendas || 'DESCONHECIDO';
        porCanal[canal] = (porCanal[canal] || 0) + 1;

        // Por loja
        const loja = etiqueta.rastreabilidade?.lojaVirtual || 'DESCONHECIDA';
        porLoja[loja] = (porLoja[loja] || 0) + 1;
      });

      const relatorio = {
        totalEtiquetas,
        processadas,
        salvasPC,
        porLote,
        porCanal,
        porLoja,
      };

      console.log(`✅ [RELATÓRIO] Relatório gerado:`, relatorio);
      return { sucesso: true, relatorio };
    } catch (error: any) {
      console.error(`❌ [RELATÓRIO] Erro ao gerar:`, error);
      return {
        sucesso: false,
        erro: error.message,
      };
    }
  }
}

export const etiquetasPrioritariasService = EtiquetasPrioritariasService;
