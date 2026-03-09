// ============================================================================
// services/danfeService.ts - Gerador DANFE Simplificada + Etiquetas de Envio
// ============================================================================

import jsPDF from 'jspdf';
import { BlingInvoice } from '../types';

export interface DANFEData {
  numero: string;
  chave: string;
  dataEmissao: string;
  dataAutorizacao?: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    endereco: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
  itens: Array<{
    descricao: string;
    sku: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  totais: {
    subtotal: number;
    impostos: number;
    frete: number;
    total: number;
    peso?: number;
  };
  pedidoId?: string;
  pedidoNumero?: string;
  transportadora?: string;
  rastreio?: string;
}

/**
 * Gera DANFE Simplificada em PDF
 * Segue padrão NFF-e simplificada conforme autorização
 */
export const gerarDANFESimplificada = (danfeData: DANFEData): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HEADER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Título
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('AVISO DE RECEBIMENTO', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Documento Auxiliar da Nota Fiscal Eletrônica', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 7;

  // Informações da NF-e
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`NF-e: ${danfeData.numero}`, margin, yPosition);
  doc.text(`Chave: ${danfeData.chave}`, pageWidth / 2, yPosition);
  yPosition += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Emissão: ${danfeData.dataEmissao}`, margin, yPosition);
  if (danfeData.dataAutorizacao) {
    doc.text(`Autorização: ${danfeData.dataAutorizacao}`, pageWidth / 2, yPosition);
  }
  yPosition += 8;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLIENTE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PAGADOR/CLIENTE:', margin, yPosition);
  yPosition += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${danfeData.cliente.nome}`, margin, yPosition);
  yPosition += 4;
  doc.text(`CPF/CNPJ: ${danfeData.cliente.cpfCnpj}`, margin, yPosition);
  yPosition += 4;
  doc.text(
    `${danfeData.cliente.endereco}, ${danfeData.cliente.numero}${danfeData.cliente.complemento ? ' ' + danfeData.cliente.complemento : ''}`,
    margin,
    yPosition
  );
  yPosition += 4;
  doc.text(
    `${danfeData.cliente.bairro} - ${danfeData.cliente.cidade}/${danfeData.cliente.uf} - CEP: ${danfeData.cliente.cep}`,
    margin,
    yPosition
  );
  yPosition += 10;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TABELA DE ITENS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  const colX = [margin, margin + 80, margin + 110, margin + 135, margin + 160];
  const colWidths = [75, 25, 20, 20, 25];

  // Headers
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, yPosition - 3, contentWidth, 5, 'F');
  
  doc.text('DESCRIÇÃO/SKU', colX[0], yPosition);
  doc.text('QTD', colX[1], yPosition);
  doc.text('V.UN.', colX[2], yPosition);
  doc.text('V.TOTAL', colX[3], yPosition);
  yPosition += 5;

  // Itens
  doc.setFont('helvetica', 'normal');
  danfeData.itens.forEach(item => {
    const descricaoLabel = `${item.descricao} (${item.sku})`;
    const lines = doc.splitTextToSize(descricaoLabel, colWidths[0]);
    
    doc.text(lines, colX[0], yPosition);
    doc.text(item.quantidade.toString(), colX[1], yPosition);
    doc.text(`R$ ${item.valorUnitario.toFixed(2)}`, colX[2], yPosition);
    doc.text(`R$ ${item.valorTotal.toFixed(2)}`, colX[3], yPosition);
    
    yPosition += lines.length * 4 + 2;
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TOTAIS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  yPosition += 5;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin + 100, yPosition - 3, contentWidth - 100, 20, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  
  let totalY = yPosition;
  doc.text('Subtotal:', margin + 105, totalY);
  doc.text(`R$ ${danfeData.totais.subtotal.toFixed(2)}`, pageWidth - margin - 15, totalY, { align: 'right' });
  totalY += 4;

  if (danfeData.totais.impostos > 0) {
    doc.text('Impostos:', margin + 105, totalY);
    doc.text(`R$ ${danfeData.totais.impostos.toFixed(2)}`, pageWidth - margin - 15, totalY, { align: 'right' });
    totalY += 4;
  }

  if (danfeData.totais.frete > 0) {
    doc.text('Frete:', margin + 105, totalY);
    doc.text(`R$ ${danfeData.totais.frete.toFixed(2)}`, pageWidth - margin - 15, totalY, { align: 'right' });
    totalY += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', margin + 105, totalY + 2);
  doc.text(`R$ ${danfeData.totais.total.toFixed(2)}`, pageWidth - margin - 15, totalY + 2, { align: 'right' });

  yPosition += 25;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INFORMAÇÕES DE ENTREGA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (danfeData.transportadora || danfeData.rastreio) {
    yPosition += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('INFORMAÇÕES DE ENTREGA:', margin, yPosition);
    yPosition += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (danfeData.transportadora) {
      doc.text(`Transportadora: ${danfeData.transportadora}`, margin + 5, yPosition);
      yPosition += 4;
    }
    if (danfeData.rastreio) {
      doc.text(`Rastreio: ${danfeData.rastreio}`, margin + 5, yPosition);
      yPosition += 4;
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FOOTER - RESPONSÁVEL E DATA
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  yPosition = pageHeight - 30;
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Recebida por: _________________________', margin, yPosition);
  doc.text('Data: ___/___/_____', pageWidth / 2, yPosition);
  yPosition += 6;

  doc.setFontSize(7);
  doc.text('Assinatura', margin + 5, yPosition);
  doc.text('RG:', pageWidth / 2 + 5, yPosition);
  yPosition += 8;

  // Aviso obrigatório
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const aviso = 'Este documento não substitui a NFe emitida. Apenas para comprovação de recebimento de mercadoria.';
  const avisoLines = doc.splitTextToSize(aviso, contentWidth);
  doc.text(avisoLines, pageWidth / 2, yPosition, { align: 'center' });

  return doc;
};

/**
 * Gera Etiqueta de Envio em PDF (4x6 polegadas - padrão shipping)
 */
export const gerarEtiquetaEnvio = (danfeData: DANFEData): jsPDF => {
  // Etiqueta em formato 4x6 (padrão Correios/Sedex)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [152.4, 101.6] // 6x4 polegadas em mm
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 5;
  let yPosition = margin;

  // Borda
  doc.setDrawColor(0);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // HEADER - PEDIDO E NF
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`NF: ${danfeData.numero}`, margin + 3, yPosition);
  yPosition += 6;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLIENTE (esquerda)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PARA:', margin + 3, yPosition);
  yPosition += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const nomeLines = doc.splitTextToSize(danfeData.cliente.nome, 50);
  doc.text(nomeLines, margin + 3, yPosition);
  yPosition += nomeLines.length * 3;

  doc.setFontSize(8);
  const enderecoCompleto = `${danfeData.cliente.endereco}, ${danfeData.cliente.numero} ${danfeData.cliente.complemento || ''}`;
  const endLines = doc.splitTextToSize(enderecoCompleto.trim(), 50);
  doc.text(endLines, margin + 3, yPosition);
  yPosition += endLines.length * 3;

  const cidadeUF = `${danfeData.cliente.cidade} - ${danfeData.cliente.uf}`;
  doc.text(cidadeUF, margin + 3, yPosition);
  yPosition += 4;

  doc.text(`CEP: ${danfeData.cliente.cep}`, margin + 3, yPosition);
  yPosition += 6;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PESO E DIMENSÕES (direita)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (danfeData.totais.peso) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PESO:', pageWidth - margin - 30, margin + 6);
    doc.text(`${danfeData.totais.peso.toFixed(2)} kg`, pageWidth - margin - 30, margin + 10);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RASTREIO (código de barras fake/simulado)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  doc.setFontSize(18);
  doc.setFont('courier', 'bold');
  const rastreioNumero = danfeData.rastreio || `NF${danfeData.numero}`.padEnd(13, '0');
  doc.text(rastreioNumero, pageWidth / 2, pageHeight - margin - 8, { align: 'center' });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ITENS (resumido)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (danfeData.itens.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('ITENS:', margin + 3, yPosition);
    yPosition += 3;

    doc.setFont('helvetica', 'normal');
    danfeData.itens.slice(0, 3).forEach(item => {
      doc.setFontSize(7);
      doc.text(`${item.quantidade}x ${item.descricao}`, margin + 5, yPosition);
      yPosition += 3;
    });

    if (danfeData.itens.length > 3) {
      doc.text(`... e mais ${danfeData.itens.length - 3} items`, margin + 5, yPosition);
    }
  }

  return doc;
};

/**
 * Exporta DANFE Simplificada + Etiqueta de Envio como ZIP ou cria múltiplos PDFs
 */
export const exportarDANFEeEtiqueta = async (
  danfeData: DANFEData,
  formato: 'pdf-separado' | 'pdf-combinado' = 'pdf-separado'
): Promise<{ danfe: Blob; etiqueta: Blob }> => {
  const danfeDoc = gerarDANFESimplificada(danfeData);
  const etiquetaDoc = gerarEtiquetaEnvio(danfeData);

  const danfePdf = danfeDoc.output('blob');
  const etiquetaPdf = etiquetaDoc.output('blob');

  if (formato === 'pdf-combinado') {
    // Combinar PDFs: colocar etiqueta primeiro, depois DANFE
    const combined = new jsPDF();
    
    // Adicionar etiqueta
    const etiquetaPages = etiquetaDoc.internal.pages.length;
    for (let i = 1; i < etiquetaPages; i++) {
      combined.addPage();
    }

    return {
      danfe: danfePdf,
      etiqueta: etiquetaPdf
    };
  }

  return { danfe: danfePdf, etiqueta: etiquetaPdf };
};

/**
 * Salva PDFs localmente com estrutura de pasta
 */
export const salvarDANFEeEtiquetaLocalmente = async (
  danfeData: DANFEData,
  basePath: string = '/exports'
): Promise<{ danfePath: string; etiquetaPath: string }> => {
  const today = new Date().toISOString().split('T')[0];
  const danfePath = `${basePath}/${today}/DANFE/`;
  const etiquetaPath = `${basePath}/${today}/ETIQUETAS/`;

  const danfeDoc = gerarDANFESimplificada(danfeData);
  const etiquetaDoc = gerarEtiquetaEnvio(danfeData);

  const filename = `pedido-${danfeData.pedidoNumero}-nf-${danfeData.numero}`;

  // Simulação (não salva realmente, apenas retorna paths)
  // Em produção, usar Electron File System ou Node.js fs
  return {
    danfePath: `${danfePath}${filename}.pdf`,
    etiquetaPath: `${etiquetaPath}${filename}.pdf`
  };
};
