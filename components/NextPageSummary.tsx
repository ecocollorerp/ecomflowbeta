import React, { useMemo } from 'react';
import { ExtractedZplData, SkuLink } from '../types';
import { FileText, BoxOpen, BarChart3 } from 'lucide-react';

interface NextPageSummaryProps {
  // Mapa de dados extraídos de cada página (key = número da página)
  extractedDataMap: Map<string, ExtractedZplData>;
  // Links de SKU para resolver mestres
  skuLinks: SkuLink[];
  // Página atual que será montada (para saber qual é a próxima)
  currentPageNumber: number;
  // Largura do ZPL em mm (padrão 100)
  pageWidthMm?: number;
  // Altura do ZPL em mm (padrão 150)
  pageHeightMm?: number;
}

const NextPageSummary: React.FC<NextPageSummaryProps> = ({
  extractedDataMap,
  skuLinks,
  currentPageNumber,
  pageWidthMm = 100,
  pageHeightMm = 150
}) => {
  const nextPageNumber = currentPageNumber + 1;

  const summaryData = useMemo(() => {
    const currentPageKey = String(currentPageNumber);
    const nextPageKey = String(nextPageNumber);

    // Extrair dados da página atual para comparação
    const currentData = extractedDataMap.get(currentPageKey);
    const nextData = extractedDataMap.get(nextPageKey);

    if (!nextData) {
      return null;
    }

    // Agrupar itens por SKU e contar quantidades
    const itemsBySkuMap = new Map<string, { sku: string; masterSku: string; totalQty: number; count: number; names: Set<string> }>();

    for (const item of nextData.skus) {
      const master = skuLinks.find(link => link.imported_sku === item.sku)?.master_product_sku || item.sku;
      const key = `${master}|${item.sku}`;

      const existing = itemsBySkuMap.get(key);
      if (existing) {
        existing.totalQty += item.qty || 1;
        existing.count += 1;
        if (item.name) existing.names.add(item.name);
      } else {
        itemsBySkuMap.set(key, {
          sku: item.sku,
          masterSku: master,
          totalQty: item.qty || 1,
          count: 1,
          names: item.name ? new Set([item.name]) : new Set()
        });
      }
    }

    // Converter para array e ordenar por quantidade descendente
    const itemsSummary = Array.from(itemsBySkuMap.values())
      .sort((a, b) => b.totalQty - a.totalQty);

    const totalItems = itemsSummary.length;
    const totalQuantity = itemsSummary.reduce((sum, item) => sum + item.totalQty, 0);
    const totalOccurrences = itemsSummary.reduce((sum, item) => sum + item.count, 0);

    return {
      pageNumber: nextPageNumber,
      totalItems,
      totalQuantity,
      totalOccurrences,
      items: itemsSummary
    };
  }, [extractedDataMap, currentPageNumber, nextPageNumber, skuLinks]);

  if (!summaryData) {
    return (
      <div className="bg-white border-2 border-gray-300 rounded-lg p-4 text-center">
        <p className="text-gray-500 text-sm">Sem dados para próxima página</p>
      </div>
    );
  }

  // Estimar altura do ZPL para a próxima página
  const estimatedZplHeight = pageHeightMm;

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="border-b-2 border-blue-200 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="text-blue-600" size={20} />
          <h3 className="text-lg font-bold text-blue-900">Próxima Página: #{summaryData.pageNumber}</h3>
        </div>
        <p className="text-xs text-blue-700">Resumo de itens que serão impressos</p>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
          <p className="text-xs text-gray-600 font-medium">Itens Únicos</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summaryData.totalItems}</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
          <p className="text-xs text-gray-600 font-medium">Quantidade Total</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{summaryData.totalQuantity}</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
          <p className="text-xs text-gray-600 font-medium">Occorrências</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{summaryData.totalOccurrences}</p>
        </div>
      </div>

      {/* Tabela de Itens */}
      <div className="bg-white rounded-lg border border-blue-200">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <BarChart3 size={16} className="text-gray-600" />
          <h4 className="font-semibold text-gray-800 text-sm">Distribuição de Itens</h4>
        </div>
        <div className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {summaryData.items.map((item, idx) => {
            const percentTotal = (item.totalQty / summaryData.totalQuantity) * 100;
            return (
              <div key={idx} className="px-4 py-3 hover:bg-blue-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-mono text-sm font-semibold text-gray-800">{item.sku}</p>
                    {item.masterSku !== item.sku && (
                      <p className="text-xs text-gray-500">Mestre: {item.masterSku}</p>
                    )}
                    {item.names.size > 0 && (
                      <p className="text-xs text-gray-600 italic mt-1">{Array.from(item.names).join(', ')}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{item.totalQty}x</p>
                    <p className="text-xs text-gray-500">{item.count} linhas</p>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all"
                    style={{ width: `${percentTotal}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{percentTotal.toFixed(1)}% do total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer com dicas */}
      <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-xs text-blue-900">
        <p className="font-semibold mb-1">💡 Dica de Impressão</p>
        <p>Prepare {summaryData.totalQuantity} unidades para a próxima folha. Total de {summaryData.totalItems} tipos de itens.</p>
      </div>
    </div>
  );
};

export default NextPageSummary;
