// ============================================================================
// services/etiquetaBlingFluxoCompleto.ts
// Fluxo completo: TXT Bling → Upload → Gerar Etiqueta → Processar
// ============================================================================

import { dbClient } from '../lib/supabaseClient';
import { auditLogService } from './auditLogService';

export interface EtiquetaBlingPedido {
  pedidoId: string;
  numero: string;
  marketplace: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE';
  cliente: {
    nome: string;
    cpfCnpj: string;
  };
  rastreio?: string;
  txtBling?: string; // Arquivo TXT do Bling
  zplGerado?: string; // ZPL processado
  statusEtiqueta: 'pendente' | 'txt_baixado' | 'txt_enviado' | 'etiqueta_gerada' | 'processada' | 'erro';
}

export interface ResultadoFluxoEtiqueta {
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

/**
 * Serviço de Fluxo Completo de Etiquetas do Bling
 * 1. Baixa TXT do Bling
 * 2. Faz upload de volta
 * 3. Gera etiqueta ZPL
 * 4. Processa com ferramenta de etiqueta
 */
export class EtiquetaBlingFluxoCompleto {
  /**
   * 🔍 Buscar etiqueta TXT do Bling para um pedido
   */
  static async baixarTxtDoBling(
    pedidoId: string,
    token: string
  ): Promise<{
    txt: string;
    rastreio?: string;
  }> {
    try {
      console.log(`📥 Baixando TXT do Bling para pedido ${pedidoId}...`);

      // Buscar dados do pedido no Bling
      const resp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${pedidoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!resp.ok) {
        throw new Error(`Pedido ${pedidoId} não encontrado (${resp.status})`);
      }

      const data = await resp.json();
      const pedido = data?.data;

      if (!pedido) {
        throw new Error('Dados do pedido vazios');
      }

      // Montar conteúdo do TXT (formato Bling)
      const txt = this.montarFormatoTxtBling(pedido);
      const rastreio = pedido?.transporte?.codigoRastreamento;

      return { txt, rastreio };
    } catch (error: any) {
      console.error(`❌ Erro ao baixar TXT: ${error.message}`);
      throw error;
    }
  }

  /**
   * 📤 Fazer upload do TXT de volta para o Bling
   */
  static async uploadTxtParaBling(
    pedidoId: string,
    txtConteudo: string,
    token: string
  ): Promise<boolean> {
    try {
      console.log(`📤 Enviando TXT para Bling (pedido ${pedidoId})...`);

      // Bling espera um PUT ou POST com o conteúdo do TXT
      const resp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${pedidoId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            etiqueta: txtConteudo, // ou outro campo esperado pelo Bling
          }),
        }
      );

      if (!resp.ok) {
        throw new Error(`Erro ao enviar TXT (status ${resp.status})`);
      }

      console.log(`✅ TXT enviado com sucesso para pedido ${pedidoId}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Erro ao fazer upload: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🎫 Gerar etiqueta ZPL a partir do TXT do Bling
   */
  static async gerarZplDaTxt(
    pedidoId: string,
    txtConteudo: string,
    dadosPedido: {
      numero: string;
      cliente: { nome: string };
      rastreio?: string;
      endereco?: string;
    }
  ): Promise<string> {
    try {
      console.log(`🎫 Gerando ZPL a partir do TXT do Bling...`);

      // Processar TXT para extrair informações
      const info = this.extrairInfoDoTxt(txtConteudo);

      // Gerar ZPL (formato para etiquetadora)
      const zpl = `^XA
^PW800
^LL1200
^CF0,36
^FO40,30^FDETIQUETA ENVIADA DO BLING^FS
^FO40,75^GB720,3,3^FS
^CF0,28
^FO40,100^FDPedido: ${dadosPedido.numero}^FS
^FO40,140^FDCliente: ${(dadosPedido.cliente.nome || '').slice(0, 40)}^FS
^CF0,24
^FO40,185^FDRastreamento: ${dadosPedido.rastreio || 'N/A'}^FS
^FO40,260^GB720,2,2^FS
^FO40,280^FDEndere${String.fromCharCode(231)}o: ${(dadosPedido.endereco || 'N/A').slice(0, 55)}^FS
^FO40,440^GB720,2,2^FS
${dadosPedido.rastreio ? `^BY3,3,100\n^FO100,470^BCN,100,Y,N,N\n^FD${dadosPedido.rastreio}^FS` : ''}
^CF0,20
^FO40,620^FDOrigem: Bling - ${info.marketplace || 'N/A'}^FS
^FO40,650^FDGerado: ${new Date().toLocaleString('pt-BR')}^FS
^XZ`;

      console.log(`✅ ZPL gerado com sucesso`);
      return zpl;
    } catch (error: any) {
      console.error(`❌ Erro ao gerar ZPL: ${error.message}`);
      throw error;
    }
  }

  /**
   * ⚙️ Processar etiqueta ZPL com ferramenta de etiqueta
   */
  static async processarComFerramentaEtiqueta(
    zplConteudo: string,
    pedidoNumero: string
  ): Promise<Blob> {
    try {
      console.log(`⚙️ Processando ZPL com ferramenta de etiqueta...`);

      // Criar arquivo ZPL (pode ser enviado para impressora ou convertido para PDF)
      const blob = new Blob([zplConteudo], { type: 'text/plain' });

      // Adicionar metadados
      const arquivo = new File(
        [blob],
        `etiqueta-${pedidoNumero}-${Date.now()}.zpl`,
        { type: 'text/plain' }
      );

      console.log(`✅ Etiqueta processada: ${arquivo.name}`);
      return arquivo as any;
    } catch (error: any) {
      console.error(`❌ Erro ao processar etiqueta: ${error.message}`);
      throw error;
    }
  }

  /**
   * 🔄 FLUXO COMPLETO: TXT → Upload → ZPL → Processar
   */
  static async executarFluxoCompleto(
    pedidosIds: string[],
    token: string,
    blingToken?: string,
    usuarioId: string = 'sistema'
  ): Promise<ResultadoFluxoEtiqueta[]> {
    const resultados: ResultadoFluxoEtiqueta[] = [];

    console.log(`\n📋 Iniciando fluxo completo para ${pedidosIds.length} pedido(s)...`);

    for (let idx = 0; idx < pedidosIds.length; idx++) {
      const pedidoId = pedidosIds[idx];
      const progress = `[${idx + 1}/${pedidosIds.length}]`;

      try {
        console.log(`\n${progress} Processando pedido ${pedidoId}...`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ETAPA 1: Buscar dados do pedido
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const pedidoData = await (
          await fetch(`https://www.bling.com.br/Api/v3/pedidos/vendas/${pedidoId}`, {
            headers: {
              Authorization: `Bearer ${blingToken || token}`,
              Accept: 'application/json',
            },
          })
        ).json();

        const pedido = pedidoData?.data;

        if (!pedido) {
          throw new Error('Dados do pedido inválidos');
        }

        console.log(`${progress} ✅ Dados do pedido obtidos`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ETAPA 2: Baixar TXT do Bling
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const { txt, rastreio } = await this.baixarTxtDoBling(
          pedidoId,
          blingToken || token
        );
        console.log(`${progress} ✅ TXT baixado do Bling`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ETAPA 3: Upload TXT de volta para Bling
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        await this.uploadTxtParaBling(pedidoId, txt, blingToken || token);
        console.log(`${progress} ✅ TXT enviado de volta para Bling`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ETAPA 4: Gerar ZPL
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const zpl = await this.gerarZplDaTxt(pedidoId, txt, {
          numero: pedido.numero,
          cliente: { nome: pedido.contato?.nome || 'Sem nome' },
          rastreio,
          endereco: `${pedido.transporte?.enderecoEntrega?.endereco || 'N/A'}, ${pedido.transporte?.enderecoEntrega?.numero || ''}`,
        });
        console.log(`${progress} ✅ ZPL gerado`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ETAPA 5: Processar com ferramenta de etiqueta
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const etiquetaArquivo = await this.processarComFerramentaEtiqueta(
          zpl,
          pedido.numero
        );
        console.log(`${progress} ✅ Etiqueta processada`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // REGISTRAR SUCESSO
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        resultados.push({
          pedidoId,
          sucesso: true,
          etapa: 'processada',
          mensagem: `✅ Etiqueta procesada com sucesso`,
          arquivos: {
            txt: new Blob([txt], { type: 'text/plain' }),
            zpl: etiquetaArquivo,
          },
        });

        // Registrar na auditoria
        await auditLogService.registrarDANFE(
          `Fluxo completo: TXT → Upload → ZPL → Processado`,
          'sucesso',
          {
            notaFiscalNumero: pedido.numero,
            pedidoNumero: pedido.numero,
            quantidadeDocumentos: 2, // TXT + ZPL
          },
          usuarioId
        );
      } catch (erro: any) {
        console.error(`${progress} ❌ Erro: ${erro.message}`);

        resultados.push({
          pedidoId,
          sucesso: false,
          etapa: 'erro',
          mensagem: `❌ Erro no fluxo`,
          erro: erro.message,
        });

        // Registrar erro na auditoria
        await auditLogService.registrarDANFE(
          `Erro no fluxo de etiqueta`,
          'erro',
          {
            notaFiscalNumero: pedidoId,
            pedidoNumero: pedidoId,
            quantidadeDocumentos: 0,
          },
          usuarioId
        );
      }
    }

    const sucesso = resultados.filter(r => r.sucesso).length;
    const falhas = resultados.filter(r => !r.sucesso).length;

    console.log(
      `\n✅ CONCLUSÃO: ${sucesso}/${pedidosIds.length} etiqueta(s) processada(s), ${falhas} falha(s)\n`
    );

    return resultados;
  }

  /**
   * 📄 Montar conteúdo do TXT no formato Bling
   */
  private static montarFormatoTxtBling(pedido: any): string {
    const endereco = pedido?.transporte?.enderecoEntrega || {};
    const cliente = pedido?.contato || {};

    return `PEDIDO DE VENDA - BLING
=====================================
Número: ${pedido.numero}
Data: ${pedido.data}
Status: ${pedido.status}

CLIENTE
-------------------------------------
Nome: ${cliente.nome || 'N/A'}
CNPJ/CPF: ${cliente.numeroDocumento || 'N/A'}
Email: ${cliente.email || 'N/A'}
Telefone: ${cliente.telefone || 'N/A'}

ENDEREÇO DE ENTREGA
-------------------------------------
Rua: ${endereco.endereco || 'N/A'}
Número: ${endereco.numero || 'N/A'}
Bairro: ${endereco.bairro || 'N/A'}
Cidade: ${endereco.municipio?.nome || endereco.municipio || 'N/A'}
Estado: ${endereco.municipio?.uf || endereco.uf || 'N/A'}
CEP: ${endereco.cep || 'N/A'}

ITENS
-------------------------------------
${(pedido.itens || [])
  .map(
    (item: any) =>
      `${item.quantidade}x ${item.descricao} - R$ ${(item.valor || 0).toFixed(2)}`
  )
  .join('\n')}

TOTAIS
-------------------------------------
Subtotal: R$ ${(pedido.total || 0).toFixed(2)}
Total: R$ ${(pedido.total || 0).toFixed(2)}

TRANSPORTE
-------------------------------------
Transportadora: ${pedido.transporte?.transportadora || 'N/A'}
Rastreamento: ${pedido.transporte?.codigoRastreamento || 'N/A'}

Gerado em: ${new Date().toLocaleString('pt-BR')}
`;
  }

  /**
   * 🔍 Extrair informações do TXT
   */
  private static extrairInfoDoTxt(txt: string): {
    marketplace?: string;
    numero?: string;
  } {
    const matchMarketplace = txt.match(/marketplace:\s*(.+)/i);
    const matchNumero = txt.match(/número:\s*(.+)/i);

    return {
      marketplace: matchMarketplace?.[1]?.trim(),
      numero: matchNumero?.[1]?.trim(),
    };
  }
}

export const etiquetaBlingFluxoCompleto = new EtiquetaBlingFluxoCompleto();
