
import { ExtractedZplData, ZplSettings, OrderItem, GeneralSettings, SkuLink, StockItem } from '../types';
import { getMultiplicadorFromSku } from '../lib/sku';
import { splitZpl, filterAndPairZplPages, simpleHash } from '../utils/zplUtils';
import { renderZpl } from './pdfGenerator';

/**
 * Consolida SKUs vinculadas para seus produtos principais
 * Exemplo: Se SKU-001 é vinculada ao SKU-MAIN, converte {sku: 'SKU-001', qty: 5} para {sku: 'SKU-MAIN', qty: 5}
 * @param skus Array de SKUs com quantidades
 * @param skuLinks Mapa de vinculações (SKU importada -> SKU produto principal)
 * @param stockItems Mapa de itens de estoque para obter informações do produto
 * @returns Array consolidado com apenas produtos principais
 */
export const consolidateSkusByMasterProduct = (
    skus: Array<{ sku: string; qty: number }>,
    skuLinks?: SkuLink[],
    stockItems?: StockItem[]
): Array<{ sku: string; qty: number; product?: StockItem }> => {
    if (!skuLinks || skuLinks.length === 0) {
        // Se não há vinculações, retorna os SKUs originais
        const itemMap = new Map(stockItems?.map(item => [item.code.toUpperCase(), item]) ?? []);
        return skus.map(s => ({
            sku: s.sku,
            qty: s.qty,
            product: itemMap.get(s.sku.toUpperCase())
        }));
    }
    
    // Criar mapa de vinculações para lookup rápido
    const skuLinkMap = new Map(
        skuLinks.map(link => [link.importedSku.toUpperCase(), link.masterProductSku.toUpperCase()])
    );
    
    // Criar mapa de itens de estoque
    const itemMap = new Map(
        stockItems?.map(item => [item.code.toUpperCase(), item]) ?? []
    );
    
    // Consolidar SKUs por produto principal
    const consolidated = new Map<string, { sku: string; qty: number; product?: StockItem }>();
    
    for (const { sku, qty } of skus) {
        const normalizedSku = sku.toUpperCase();
        
        // Verificar se é uma SKU vinculada
        const masterSku = skuLinkMap.get(normalizedSku);
        const finalSku = masterSku || normalizedSku;
        
        // Buscar informações do produto
        const product = itemMap.get(finalSku);
        
        // Consolidar quantidade
        if (consolidated.has(finalSku)) {
            const existing = consolidated.get(finalSku)!;
            existing.qty += qty;
        } else {
            consolidated.set(finalSku, {
                sku: finalSku,
                qty,
                product
            });
        }
    }
    
    return Array.from(consolidated.values());
};

export const extractFields = async (zplPage: string, patterns: ZplSettings['regex']): Promise<ExtractedZplData> => {
    const skus: { sku: string; qty: number }[] = [];
    let orderId: string | undefined;

    const lines = zplPage.split(/\^FS|\^XZ/);
    const itemLineRegex = /\^FD.*UN/i;

    for (const line of lines) {
        if (itemLineRegex.test(line)) {
            const fdIndex = line.toUpperCase().indexOf('^FD');
            if (fdIndex === -1) continue;
            const data = line.substring(fdIndex + 3);
            const parts = data.split(' - ');
            if (parts.length >= 2) {
                const rawSku = parts[0].trim().replace(/\\5f/gi, '_');
                const lastPart = parts[parts.length - 1];
                const qtyMatch = lastPart.match(/([\d,]+)\s*UN/i);
                if (rawSku && qtyMatch && qtyMatch[1]) {
                    const qtyString = qtyMatch[1].replace(',', '.');
                    const qty = parseFloat(qtyString);
                    if (!isNaN(qty)) skus.push({ sku: rawSku, qty });
                }
            }
        }
    }

    if (skus.length === 0) {
        try {
            const skuMatches = [...zplPage.matchAll(new RegExp(patterns.sku, 'gi'))];
            const qtyMatches = [...zplPage.matchAll(new RegExp(patterns.quantity, 'gi'))];
            const count = Math.min(skuMatches.length, qtyMatches.length);
            for (let i = 0; i < count; i++) {
                const sku = skuMatches[i][1];
                const qty = parseInt(qtyMatches[i][1], 10);
                if (sku && !isNaN(qty)) skus.push({ sku, qty });
            }
        } catch (e) {}
    }

    try {
        const orderIdMatch = zplPage.match(new RegExp(patterns.orderId, 'i'));
        if (orderIdMatch && orderIdMatch[1]) orderId = orderIdMatch[1].trim();
    } catch (e) {}

    return { orderId, skus };
};

export async function* processZplStream(
    zplInput: string,
    settings: ZplSettings,
    generalSettings: GeneralSettings,
    allOrders: OrderItem[],
    processingMode: 'completo' | 'rapido',
    printedPageHashes: Set<string>
) {
    try {
        if (!zplInput.trim()) {
            yield { type: 'error', message: 'Nenhum código ZPL para processar.' };
            return;
        }

        yield { type: 'progress', message: 'Analisando ZPL...' };
        const rawPages = splitZpl(zplInput);
        const { pairedZpl, extractedData } = await filterAndPairZplPages(rawPages, settings.regex, allOrders);
        
        const warnings: string[] = [];
        const hasMlWithoutProperDanfe = Array.from(extractedData.values()).some(
            data => data.isMercadoLivre && !data.hasDanfe && !data.containsDanfeInLabel
        );
        if (hasMlWithoutProperDanfe) {
            warnings.push('Aviso: Etiquetas ML sem DANFE detectadas.');
        }

        const printedStatus = pairedZpl.map(pageZpl => printedPageHashes.has(simpleHash(pageZpl)));

        yield { type: 'start', zplPages: pairedZpl, extractedData, warnings, hasMlWithoutDanfe: hasMlWithoutProperDanfe, printedStatus };
        
        const chunkSize = generalSettings.etiquetas.renderChunkSize || 3; // Padrão mais seguro se não definido
        const delayMs = generalSettings.etiquetas.apiRequestDelay_ms || 1200; // Padrão mais seguro se não definido

        for (let i = 0; i < pairedZpl.length; i += chunkSize) {
            // Notifica progresso
            yield { type: 'progress', message: `Processando etiquetas... (${i}/${pairedZpl.length})` };

            const chunk = pairedZpl.slice(i, i + chunkSize);
            const chunkPromises = chunk.map((zpl, chunkIndex) => {
                const originalIndex = i + chunkIndex;
                const isDanfePage = originalIndex % 2 === 0;
                if (processingMode === 'rapido' && isDanfePage) {
                    return Promise.resolve({ index: originalIndex, preview: 'SKIPPED' });
                }
                return renderZpl(zpl, settings, generalSettings)
                    .then(preview => ({ index: originalIndex, preview }))
                    .catch(() => ({ index: originalIndex, preview: 'ERROR' }));
            });

            const chunkResults = await Promise.all(chunkPromises);
            for (const result of chunkResults) {
                yield { type: 'preview', index: result.index, preview: result.preview };
            }

            // Pausa entre chunks para respeitar rate limit do Labelary
            if (i + chunkSize < pairedZpl.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        yield { type: 'done' };
    } catch (error: any) {
        yield { type: 'error', message: error.message };
    }
}
// ============================================================================
// Novas funções para geração de etiquetas DANFE e ZPL para impressoras térmicas
// ============================================================================

/**
 * Gera etiqueta ZPL para DANFE (Documento Auxiliar NF-e)
 */
export const gerarEtiquetaDANFE = (opcoes: {
  nfeNumero: string;
  nfeChave: string;
  cliente: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  peso?: number;
  valor?: number;
}): string => {
  const { nfeNumero, nfeChave, cliente, endereco, cidade, uf, cep, peso, valor } = opcoes;

  const nfeClean = nfeNumero.replace(/\D/g, '');
  const cepClean = cep.replace(/\D/g, '');

  return `^XA
^MMT
^PW812
^LL406
^LS0
^FO0,0^GB812,406,2^FS

^FO20,20^A0N,25,25^FD★ NF-e #${nfeClean}^FS
^FO20,50^A0N,16,16^FDChave: ${nfeChave.substring(0, 20)}...^FS

^FO20,80^A0N,20,20^FDDestinatário:^FS
^FO20,100^A0N,18,18^FB760,2,0^FD${cliente}^FS

^FO20,140^A0N,16,16^FD${endereco} - ${cidade}, ${uf}^FS
^FO20,160^A0N,16,16^FDCEP: ${cepClean}^FS

${peso ? `^FO20,185^A0N,16,16^FDPeso: ${peso.toFixed(2)}kg^FS` : ''}
${valor ? `^FO500,185^A0N,16,16^FDValor: R$ ${(valor / 100).toFixed(2)}^FS` : ''}

^FO20,320^A0N,14,14^FDData: ${new Date().toLocaleDateString('pt-BR')}^FS

^XZ`;
};

/**
 * Gera etiqueta com código de barras para rastreamento
 */
export const gerarEtiquetaRastreamento = (opcoes: {
  codigo: string;
  destinatario: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
}): string => {
  const { codigo, destinatario, endereco, cidade, uf, cep } = opcoes;

  return `^XA
^MMT
^PW812
^LL406
^LS0
^FO0,0^GB812,406,3^FS

^FO20,60^BY3,3,80^BCN^FD${codigo}^FS
^FO280,60^A0N,24,24^FD${codigo}^FS

^FO20,160^A0N,20,20^FDPARA:^FS
^FO20,180^A0N,20,20^FB760,2,0^FD${destinatario}^FS

^FO40,220^A0N,18,18^FD${endereco}^FS
^FO40,238^A0N,18,18^FD${cidade}, ${uf} - ${cep}^FS

^XZ`;
};