// ============================================================================
// services/danfeSimplificadoComEtiquetaService.ts
// Serviço para gerar DANFE Simplificado + Etiqueta REAL em arquivo único
// Etiqueta vem da Shopee → Bling → Vinculada ao SKU do ERP
// ============================================================================

import { supabaseClient } from '../lib/supabase';

export interface ItemPedidoComSKU {
  descricao: string;
  skuEtiqueta: string; // SKU na etiqueta/Shopee
  skuPrincipal?: string; // SKU vinculado no ERP
  quantidade: number;
  valorUnitario: number;
  codigo?: string; // Código do produto no ERP
}

export interface PedidoComEtiqueta {
  numero: string;
  idBling: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    endereco: {
      rua: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    };
  };
  itens: ItemPedidoComSKU[];
  marketplace: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE';
  rastreio: string; // Rastreamento REAL da Shopee
  etiqueta: {
    conteudoRealBling: string; // Etiqueta REAL que veio do Bling
    codigoBarrasRastreio: string; // Código de barras do rastreamento
    disponivel: boolean;
    dataGeracaoBling: string;
  };
  dataCompra: string;
  valor: number;
}

export interface ProcessoDanfeEtiqueta {
  pedidoId: string;
  sucesso: boolean;
  temEtiqueta: boolean;
  motivo?: string;
  danfeSimplificado?: DanfeSimplificado;
  etiquetaConteudo?: string;
}

export interface DanfeSimplificado {
  numero: string;
  cliente: string;
  cpfCnpj: string;
  endereco: string;
  marketplace: string;
  rastreio?: string;
  totalItens: number;
  valorTotal: number;
  dataCompra: string;
  itens: string[]; // Descrição dos itens
}

export interface ArquivoProcessado {
  pedidoId: string;
  conteudoConsolidado: string; // DANFE + Etiqueta em texto
  formatoOrigem: 'bling'; // Marca que veio do processo Bling
}

class DanfeSimplificadoComEtiquetaService {
  /**
   * Buscar pedidos com etiqueta real disponível (apenas Shopee/Mercado Livre)
   * Etiqueta vem REAL da Shopee → Bling → Vinculada ao SKU do ERP
   */
  async buscarPedidosComEtiquetaDisponivel(
    token: string,
    quantidade: number = 10,
    marketplace?: 'SHOPEE' | 'MERCADO_LIVRE'
  ): Promise<{
    pedidos: PedidoComEtiqueta[];
    total: number;
    comEtiqueta: number;
    semEtiqueta: number;
  }> {
    try {
      // Fetch do Bling API - Pedidos de vendas
      let url = `https://bling.com.br/Api/v3/pedidos/vendas?limit=${quantidade}&offset=0`;

      if (marketplace) {
        url += `&canal=${marketplace}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar pedidos no Bling: ${response.status}`);
      }

      const data = await response.json();
      const pedidosBling = data.data || [];

      const pedidosComEtiqueta: PedidoComEtiqueta[] = [];
      let comEtiqueta = 0;
      let semEtiqueta = 0;

      for (const pedidoBling of pedidosBling) {
        try {
          // Verificar se tem RASTREIO (etiqueta real)
          const temRastreio = !!pedidoBling.rastreamento;

          if (!temRastreio) {
            semEtiqueta++;
            continue;
          }

          // Buscar dados completos do pedido (com detalhes da etiqueta)
          const detalhePedidoResponse = await fetch(
            `https://bling.com.br/Api/v3/pedidos/vendas/${pedidoBling.numero}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const detalhePedido = await detalhePedidoResponse.json();
          const pedido = detalhePedido.data;

          // Processar itens e vincular com SKU
          const itensComSKU: ItemPedidoComSKU[] = [];

          for (const item of pedido.itens || []) {
            // Buscar SKU principal vinculado no ERP
            const skuPrincipal = await this.buscarSkuVinculado(
              item.codigo || item.codigoEtiqueta
            );

            itensComSKU.push({
              descricao: item.descricao,
              skuEtiqueta: item.codigo || item.codigoEtiqueta || 'N/A',
              skuPrincipal: skuPrincipal?.codigo,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              codigo: skuPrincipal?.id,
            });
          }

          // Extrair dados da etiqueta real
          const etiquetaReal = pedido.etiqueta || {
            conteudo: '',
            codigoBarras: pedidoBling.rastreamento,
          };

          const pedidoFormatado: PedidoComEtiqueta = {
            numero: pedido.numero,
            idBling: pedidoBling.id || pedido.id,
            cliente: {
              nome: pedido.nomeCliente || 'Cliente',
              cpfCnpj: pedido.cpfCnpj || 'N/A',
              endereco: {
                rua: pedido.endereco?.rua || '',
                numero: pedido.endereco?.numero || '0',
                complemento: pedido.endereco?.complemento || '',
                bairro: pedido.endereco?.bairro || '',
                cidade: pedido.endereco?.cidade || '',
                estado: pedido.endereco?.estado || '',
                cep: pedido.endereco?.cep || '',
              },
            },
            itens: itensComSKU,
            marketplace: this.detectarMarketplace(pedido),
            rastreio: pedidoBling.rastreamento, // RASTREAMENTO REAL da Shopee
            etiqueta: {
              conteudoRealBling: etiquetaReal.conteudo || pedidoBling.rastreamento,
              codigoBarrasRastreio: pedidoBling.rastreamento,
              disponivel: true,
              dataGeracaoBling: pedido.dataEmissao || new Date().toISOString(),
            },
            dataCompra: pedido.data || pedido.dataEmissao,
            valor: pedido.total,
          };

          pedidosComEtiqueta.push(pedidoFormatado);
          comEtiqueta++;
        } catch (itemError) {
          console.warn(`⚠️  Erro ao processar item ${pedidoBling.numero}:`, itemError);
          semEtiqueta++;
        }
      }

      return {
        pedidos: pedidosComEtiqueta,
        total: pedidosBling.length,
        comEtiqueta,
        semEtiqueta,
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar pedidos com etiqueta:', error);
      throw error;
    }
  }

  /**
   * Gerar DANFE Simplificado (formato texto)
   * AGORA COM: Código/SKU do Produto Vinculado
   */
  private gerarDanfeSimplificado(pedido: PedidoComEtiqueta): DanfeSimplificado {
    return {
      numero: pedido.numero,
      cliente: pedido.cliente.nome,
      cpfCnpj: pedido.cliente.cpfCnpj,
      endereco: `${pedido.cliente.endereco.rua}, ${pedido.cliente.endereco.numero} - ${pedido.cliente.endereco.bairro} - ${pedido.cliente.endereco.cidade}/${pedido.cliente.endereco.estado} ${pedido.cliente.endereco.cep}`,
      marketplace: pedido.marketplace,
      rastreio: pedido.rastreio,
      totalItens: pedido.itens.length,
      valorTotal: pedido.valor,
      dataCompra: pedido.dataCompra,
      itens: pedido.itens.map((item, idx) => {
        // Incluir SKU vinculado principal se existe
        const skuInfo = item.skuPrincipal ? ` [SKU: ${item.skuPrincipal}]` : '';
        const codigoInfo = item.codigo ? ` [COD: ${item.codigo}]` : '';
        return `${idx + 1}. ${item.descricao}${skuInfo}${codigoInfo} - Qtd: ${item.quantidade} x R$ ${item.valorUnitario.toFixed(2)}`;
      }),
    };
  }

  /**
   * Buscar SKU vinculado no ERP (supabase)
   * Relaciona SKU da Shopee com SKU/Producto principal do ERP
   */
  private async buscarSkuVinculado(skuEtiqueta: string): Promise<{
    id: string;
    codigo: string;
    nome: string;
  } | null> {
    try {
      const { data, error } = await supabaseClient
        .from('skus_vinculados') // Tabela de vinculação
        .select('id, codigo, nome')
        .or(`skuEtiqueta.eq.${skuEtiqueta},codigo.eq.${skuEtiqueta}`)
        .limit(1);

      if (error || !data || data.length === 0) {
        console.warn(`⚠️  SKU não encontrado no ERP: ${skuEtiqueta}`);
        return null;
      }

      return data[0] as any;
    } catch (error) {
      console.warn(`⚠️  Erro ao buscar SKU vinculado:`, error);
      return null;
    }
  }

  /**
   * Montar conteúdo consolidado (DANFE + Etiqueta REAL)
   * Etiqueta vem REAL do Bling/Shopee com rastreio
   */
  private montarConteudoConsolidado(
    danfe: DanfeSimplificado,
    pedido: PedidoComEtiqueta
  ): string {
    const dataHora = new Date().toLocaleString('pt-BR');

    // Usar etiqueta real do Bling
    const etiquetaConteudo = pedido.etiqueta.conteudoRealBling || 
      `[ETIQUETA SHOPEE]\nRastreio: ${pedido.etiqueta.codigoBarrasRastreio}\nCódigo Barras: ||${pedido.etiqueta.codigoBarrasRastreio}||`;

    const danfeTexto = `
╔════════════════════════════════════════════════════════════════════════════╗
║                     DANFE SIMPLIFICADO + ETIQUETA REAL                      ║
║                     (Shopee → Bling → ERP - Vinculado)                      ║
╚════════════════════════════════════════════════════════════════════════════╝

[PEDIDO #${danfe.numero}]
Data: ${danfe.dataCompra}
Marketplace: ${danfe.marketplace}
Rastreio (REAL): ${danfe.rastreio}

[CLIENTE]
Nome: ${danfe.cliente}
CPF/CNPJ: ${danfe.cpfCnpj}
Endereço: ${danfe.endereco}

[ITENS (${danfe.totalItens}) - COM SKU VINCULADO]
${danfe.itens.map(item => `  ${item}`).join('\n')}

[RESUMO FINANCEIRO]
Valor Total: R$ ${danfe.valorTotal.toFixed(2)}
Frete: A CALCULAR
Total Final: R$ ${danfe.valorTotal.toFixed(2)}

╔════════════════════════════════════════════════════════════════════════════╗
║                        ETIQUETA REAL DO BLING                              ║
║                      (Origem: ${danfe.marketplace})                          ║
╚════════════════════════════════════════════════════════════════════════════╝

${etiquetaConteudo}

[CÓDIGO DE RASTREAMENTO]
${danfe.rastreio}

[CÓDIGO DE BARRAS]
||${danfe.rastreio}||

╔════════════════════════════════════════════════════════════════════════════╗
Processado: ${dataHora}
Origem: Shopee → Bling → Vinculação ERP
Status: ✅ PRONTO PARA IMPRESSÃO
Obs: SKUs vinculados aos produtos principais do ERP
╚════════════════════════════════════════════════════════════════════════════╝
`;

    return danfeTexto;
  }

  /**
   * Processar lista de pedidos e gerar arquivo consolidado com ETIQUETA REAL
   */
  async processarPedidosParaDanfeEtiqueta(
    pedidos: PedidoComEtiqueta[],
    usuarioId?: string
  ): Promise<{
    processados: ProcessoDanfeEtiqueta[];
    arquivos: ArquivoProcessado[];
    totalSucesso: number;
    totalErros: number;
    relatorio: string;
  }> {
    const processados: ProcessoDanfeEtiqueta[] = [];
    const arquivos: ArquivoProcessado[] = [];
    let totalSucesso = 0;
    let totalErros = 0;

    console.log(`\n🔄 Processando ${pedidos.length} pedidos com etiqueta REAL...\n`);

    for (let i = 0; i < pedidos.length; i++) {
      const pedido = pedidos[i];

      try {
        // Verificar se tem etiqueta REAL
        if (!pedido.etiqueta?.disponivel || !pedido.rastreio) {
          console.log(
            `⏭️  [${i + 1}/${pedidos.length}] Pedido #${pedido.numero} - SEM ETIQUETA (pulado)`
          );

          processados.push({
            pedidoId: pedido.numero,
            sucesso: false,
            temEtiqueta: false,
            motivo: 'Etiqueta não disponível',
          });

          totalErros++;
          continue;
        }

        // Gerar DANFE Simplificado (com SKU vinculado)
        const danfe = this.gerarDanfeSimplificado(pedido);

        // Montar conteúdo consolidado (DANFE + Etiqueta REAL)
        const conteudoConsolidado = this.montarConteudoConsolidado(danfe, pedido);

        // Salvar em auditoria
        if (usuarioId) {
          try {
            await supabaseClient.from('audit_logs').insert({
              usuario_id: usuarioId,
              acao: 'DANFE_ETIQUETA_REAL_PROCESSADO',
              descricao: `Processado pedido #${pedido.numero} com etiqueta real da Shopee`,
              dados: {
                pedidoNumero: pedido.numero,
                idBling: pedido.idBling,
                marketplace: pedido.marketplace,
                rastreio: pedido.rastreio,
                itensComSKU: pedido.itens.map(i => ({
                  descricao: i.descricao,
                  skuEtiqueta: i.skuEtiqueta,
                  skuPrincipal: i.skuPrincipal,
                })),
              },
              criado_em: new Date().toISOString(),
            });
          } catch (auditError) {
            console.warn('⚠️  Erro ao registrar em auditoria:', auditError);
          }
        }

        // Adicionar ao resultado
        processados.push({
          pedidoId: pedido.numero,
          sucesso: true,
          temEtiqueta: true,
          danfeSimplificado: danfe,
          etiquetaConteudo: pedido.etiqueta.conteudoRealBling,
        });

        arquivos.push({
          pedidoId: pedido.numero,
          conteudoConsolidado,
          formatoOrigem: 'bling',
        });

        totalSucesso++;
        console.log(
          `✅ [${i + 1}/${pedidos.length}] Pedido #${pedido.numero} - PROCESSADO COM ETIQUETA REAL`
        );
      } catch (error: any) {
        console.error(`❌ [${i + 1}/${pedidos.length}] Erro ao processar #${pedido.numero}:`, error);

        processados.push({
          pedidoId: pedido.numero,
          sucesso: false,
          temEtiqueta: pedido.etiqueta?.disponivel || false,
          motivo: error.message,
        });

        totalErros++;
      }
    }

    // Gerar relatório
    const relatorio = this.gerarRelatorio(processados, totalSucesso, totalErros);

    return {
      processados,
      arquivos,
      totalSucesso,
      totalErros,
      relatorio,
    };
  }

  /**
   * Gerar relatório dos processados
   */
  private gerarRelatorio(
    processados: ProcessoDanfeEtiqueta[],
    totalSucesso: number,
    totalErros: number
  ): string {
    const dataHora = new Date().toLocaleString('pt-BR');

    return `
════════════════════════════════════════════════════════════════════════════
                    RELATÓRIO DE PROCESSAMENTO
                    DANFE Simplificado + Etiqueta
════════════════════════════════════════════════════════════════════════════

Data/Hora: ${dataHora}
Total Processado: ${processados.length}
✅ Sucesso: ${totalSucesso}
❌ Erros/Pulados: ${totalErros}
Taxa de Sucesso: ${processados.length > 0 ? ((totalSucesso / processados.length) * 100).toFixed(1) : 0}%

────────────────────────────────────────────────────────────────────────────
DETALHES:
────────────────────────────────────────────────────────────────────────────

${processados
  .map((p) => {
    if (p.sucesso) {
      return `✅ #${p.pedidoId} - Processado com sucesso`;
    } else {
      return `❌ #${p.pedidoId} - ${p.motivo || 'Erro desconhecido'}`;
    }
  })
  .join('\n')}

════════════════════════════════════════════════════════════════════════════
Todos os arquivos consolidados (DANFE + Etiqueta) estão prontos para download.
`;
  }

  /**
   * Gerar arquivo ZIP com todos os DANFE + Etiquetas
   */
  async gerarZipDosArquivos(
    arquivos: ArquivoProcessado[]
  ): Promise<Blob> {
    // @ts-ignore - JSZip pode não estar typado
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const arquivo of arquivos) {
      zip.file(
        `danfe-etiqueta-${arquivo.pedidoId}.txt`,
        arquivo.conteudoConsolidado
      );
    }

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Helper: Detectar marketplace do pedido
   */
  private detectarMarketplace(
    pedido: any
  ): 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' {
    const canal = (pedido.canal || '').toUpperCase();
    const origem = (pedido.origem || '').toUpperCase();
    const nomeLojaVirtual = (pedido.nomeLojaVirtual || '').toUpperCase();

    // 🔍 Procurar por "Número loja virtual" nas informações adicionais para detectar plataforma
    let numeroLojaVirtualExtraido = pedido.numeroLoja || pedido.numeroLojaVirtual || pedido.numeroPedidoCompra;
    let plataformaDetectada: 'SHOPEE' | 'MERCADO_LIVRE' | 'SITE' = 'SITE';
    
    const camposTexto = [
      pedido?.observacoes,
      pedido?.observacoesInternas, 
      pedido?.informacoesAdicionais,
      pedido?.dadosAdicionais,
      JSON.stringify(pedido?.informacoesAdicionais || {}),
      JSON.stringify(pedido?.dadosAdicionais || {})
    ].filter(Boolean);
    
    for (const campo of camposTexto) {
      if (typeof campo === 'string') {
        const match = campo.match(/(?:Número\s+(?:loja\s+virtual|da\s+loja)|Order\s+ID|Pedido\s+original)\s*[:\-]?\s*([A-Za-z0-9\-_]+)/i);
        if (match && match[1]) {
          numeroLojaVirtualExtraido = match[1].trim();
          break;
        }
      }
    }

    if (canal.includes('SHOPEE') || origem.includes('SHOPEE') || numeroLojaVirtualExtraido?.toUpperCase().includes('SP')) {
      plataformaDetectada = 'SHOPEE';
    } else if (canal.includes('MERCADO LIVRE') || origem.includes('MERCADO LIVRE') || nomeLojaVirtual.includes('MERCADO LIVRE') || numeroLojaVirtualExtraido?.match(/ML[A-Z0-9]+/i)) {
      plataformaDetectada = 'MERCADO_LIVRE';
    } else if (numeroLojaVirtualExtraido && numeroLojaVirtualExtraido !== pedido.numeroLoja) {
      // Se encontramos um número diferente nas informações adicionais, tentar identificar a plataforma
      if (numeroLojaVirtualExtraido.match(/ML[A-Z0-9]+/i)) {
        plataformaDetectada = 'MERCADO_LIVRE';
      } else if (numeroLojaVirtualExtraido.toUpperCase().includes('SP') || numeroLojaVirtualExtraido.match(/\d{10,}/)) {
        plataformaDetectada = 'SHOPEE';
      } else {
        plataformaDetectada = 'SITE';
      }
    } else {
      plataformaDetectada = 'SITE';
    }

    return plataformaDetectada;
}

export const danfeSimplificadoComEtiquetaService =
  new DanfeSimplificadoComEtiquetaService();
