
// lib/export.ts
import { User, StockItem, StockMovement, OrderItem, SkuLink, ProcessedData, ResumidaItem, MaterialItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';

export type Tab = 'vinculo' | 'completa' | 'resumida' | 'totais' | 'materiais';

const headerStyles = {
    fillColor: '#1f2937', // slate-800
    textColor: '#ffffff', // white
};

const footerStyles = {
    fillColor: '#e5e7eb', // gray-200
    textColor: '#111827', // slate-900
    fontStyle: 'bold' as const, // Forçar tipo literal
    fontSize: 10
};

export const exportPdf = (
    activeTab: Tab, 
    data: ProcessedData, 
    skuLinks: SkuLink[] = [], 
    stockItems: StockItem[] = [], 
    sortMode: 'qty' | 'alpha' = 'qty',
    selectedResumidaKeys?: Set<string>, // New: Optional filter
    operatorName?: string // New: Optional operator name
) => {
    const doc = new jsPDF();
    let title = `Relatório de Importação - ${data.canal} - ${new Date().toLocaleDateString('pt-BR')}`;
    if (operatorName) {
        title += ` - Operador: ${operatorName}`;
    }
    doc.text(title, 14, 15);

    let head: string[][] = [];
    let body: (string | number)[][] = [];
    let foot: (string | number)[][] = [];
    let subTitle = '';
    let tableOptions: any = { startY: 25 };
    const stockMap = new Map<string, StockItem>(stockItems.map(i => [i.code.toUpperCase(), i]));

    switch (activeTab) {
        case 'completa': {
            subTitle = 'Lista Completa de Pedidos';
            head = [['Status', 'Pedido', 'Rastreio', 'SKU', 'Qtd Final', 'Cor']];
            const linkedSkusMap = new Map<string, string>(skuLinks.map(link => [link.importedSku, link.masterProductSku] as [string, string]));

            const groups = new Map<string, OrderItem[]>();
            let totalGeralUnidades = 0;

            data.lists.completa.forEach(order => {
                const identifier = order.orderId || order.tracking;
                if (!identifier) return;
                const key = `${order.data}|${identifier}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(order);
                totalGeralUnidades += order.qty_final;
            });

            const sortedGroups = Array.from(groups.values()).sort((a, b) => {
                const colorA = a.length > 1 ? 'Diversas' : a[0].color;
                const colorB = b.length > 1 ? 'Diversas' : b[0].color;
                return colorA.localeCompare(colorB);
            });

            sortedGroups.forEach((items) => {
                if (items.length > 1) {
                    const first = items[0];
                    const isLinked = items.every((order: OrderItem) => linkedSkusMap.has(order.sku));
                    const groupQty = items.reduce((sum, i) => sum + i.qty_final, 0);
                    
                    body.push([
                        isLinked ? 'Pronto' : 'Pendente',
                        first.orderId,
                        first.tracking,
                        `Múltiplos (${items.length})`,
                        groupQty,
                        'Diversas'
                    ]);
                    items.forEach(order => {
                        body.push(['', '', '', `  - ${order.sku}`, order.qty_final, order.color]);
                    });
                } else {
                    const order = items[0];
                    const isLinked = linkedSkusMap.has(order.sku);
                    const masterSku = linkedSkusMap.get(order.sku);
                    const product = masterSku ? stockMap.get(masterSku.toUpperCase()) : undefined;
                    
                    body.push([isLinked ? 'Pronto' : 'Pendente', order.orderId, order.tracking, order.sku, order.qty_final, order.color]);
                    
                    if (product && product.expedition_items && product.expedition_items.length > 0) {
                        product.expedition_items.forEach(miudo => {
                            body.push(['', '', '', `  * CX: ${miudo.stockItemCode}`, miudo.qty_per_pack * order.qty_final, '']);
                        });
                    }
                }
            });

            foot = [['TOTAL GERAL', '', '', '', totalGeralUnidades, '']];
            
            // Adiciona resumo de frequências para expedição rápida
            const freq: Record<number, number> = {};
            groups.forEach(group => {
                const totalQty = group.reduce((s, o) => s + o.qty_final, 0);
                freq[totalQty] = (freq[totalQty] || 0) + 1;
            });

            const freqRows = Object.entries(freq).sort((a,b) => Number(a[0]) - Number(b[0])).map(([q, count]) => [
                `${q} ${Number(q) === 1 ? 'Unidade' : 'Unidades'}`,
                `${count} ${count === 1 ? 'Pedido' : 'Pedidos'}`
            ]);

            autoTable(doc, {
                head: [['Configuração da Carga', 'Quantidade de Pedidos']],
                body: freqRows,
                startY: 25,
                theme: 'grid',
                headStyles: { fillColor: '#10b981' }, // Verde esmeralda para destacar
            });
            tableOptions.startY = (doc as any).lastAutoTable.finalY + 12;
            doc.setFontSize(14);
            doc.text('Lista Detalhada de Separação', 14, tableOptions.startY - 3);
            break;
        }
        case 'resumida': {
            subTitle = 'Lista de Produção (Agrupada)';
            const stockMap = new Map<string, StockItem>(stockItems.map(i => [i.code.toUpperCase(), i] as [string, StockItem]));
            const skuLinkMap = new Map<string, string>(skuLinks.map(l => [l.importedSku.toUpperCase(), l.masterProductSku.toUpperCase()] as [string, string]));
            
            const distributionMap = new Map<string, ResumidaItem>();
            let totalGeralUnidades = 0;

            // Use same grouping logic as UI to match keys
            data.lists.completa.forEach(o => {
                const masterCode = skuLinkMap.get(o.sku.toUpperCase()) || o.sku.toUpperCase();
                
                // Group by SKU + Color
                const compositeKey = `${masterCode}|${o.color}`; 
                
                const entry: ResumidaItem = distributionMap.get(compositeKey) || { 
                    sku: masterCode, 
                    color: o.color, 
                    distribution: {}, 
                    total_units: 0 
                };
                
                const qty = Number(o.qty_final || 0);
                entry.distribution[qty] = (entry.distribution[qty] || 0) + 1;
                entry.total_units += qty;
                distributionMap.set(compositeKey, entry);
            });
            
            // Re-agrupar miúdos se necessário (Opcional, mas vamos mostrar os miúdos na lista completa por enquanto)

            // Filtering based on selection
            let sortedList = Array.from(distributionMap.entries())
                .filter(([key, _]) => {
                    if (!selectedResumidaKeys || selectedResumidaKeys.size === 0) return true; // No filter = all
                    return selectedResumidaKeys.has(key);
                })
                .map(([_, item]) => item);

            // Sorting
            if (sortMode === 'qty') {
                sortedList.sort((a, b) => b.total_units - a.total_units || a.sku.localeCompare(b.sku));
            } else {
                sortedList.sort((a, b) => a.sku.localeCompare(b.sku));
            }

            // Calculate total units only for filtered items
            totalGeralUnidades = sortedList.reduce((sum, item) => sum + item.total_units, 0);

            // Dynamic columns for pack sizes based on filtered items
            const resumidaSizes = Array.from(new Set(sortedList.flatMap(i => Object.keys(i.distribution).map(Number)))).sort((a, b) => a - b);
            
            head = [['Produto Mestre', 'Cor', ...resumidaSizes.map(s => `${s} un.`), 'Total Unidades']];
            
            body = sortedList.map(item => {
                const product = stockMap.get(item.sku.toUpperCase());
                return [
                    product?.name || `(N/V) ${item.sku}`,
                    item.color,
                    ...resumidaSizes.map(size => item.distribution[size] || '-'),
                    item.total_units
                ];
            });

            const footerRow = [
                'TOTAL GERAL', 
                '', 
                ...resumidaSizes.map(() => ''), 
                totalGeralUnidades
            ];
            foot = [footerRow];
            break;
        }
        case 'vinculo':
            subTitle = 'SKUs Não Vinculados';
            head = [['SKU Importado', 'Cor Sugerida']];
            const currentLinked = new Set(skuLinks.map(l => l.importedSku.toUpperCase()));
            body = data.skusNaoVinculados
                .filter(s => !currentLinked.has(s.sku.toUpperCase()))
                .map(s => [s.sku, s.colorSugerida]);
            break;
        case 'materiais':
            subTitle = 'Lista de Materiais Necessários';
            head = [['Material', 'Quantidade', 'Unidade']];
            const materialList = data.lists.listaDeMateriais || [];
            body = materialList.map(m => [m.name, m.unit === 'kg' ? m.quantity.toFixed(3) : m.quantity, m.unit]);
            break;
        default:
            break;
    }
    
    doc.setFontSize(12);
    doc.text(subTitle, 14, 22);
    autoTable(doc, { 
        head, 
        body, 
        foot: foot.length > 0 ? foot : undefined,
        headStyles: headerStyles, 
        footStyles: footerStyles,
        theme: 'grid',
        styles: { fontSize: 8 },
        ...tableOptions 
    });
    doc.save(`importacao_${data.canal}_${activeTab}${operatorName ? `_${operatorName}` : ''}.pdf`);
};

export const exportFinanceReport = async (payload: { 
    period: string; canal: string; stats: any; materialList: MaterialItem[]; 
    orders: OrderItem[]; taxes?: any[]; dailyChart?: { date: string, value: number }[]; 
    canalComparison?: { ml: number, shopee: number, site: number }; 
    storeProfitData?: Record<string, { gross: number, fees: number, shipping: number }>;
    channelNames?: Record<string, string>;
    deductPlatformFees?: boolean; deductShipping?: boolean; showCustomerPaid?: boolean;
    reportTitle?: string; reportLogoBase64?: string; customReportImageBase64?: string; 
    pptxTemplateBase64?: string; stockMovements?: StockMovement[];
    prevStats?: any; prevNetProfit?: number; prevTicketMedio?: number; prevMargemPct?: number; prevTaxTotal?: number;
    estimatedProfitCalculated?: number;
    despesasLancadas?: number; despesaCompetencia?: string;
}) => {
    const doc = new jsPDF();
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const pageW = doc.internal.pageSize.getWidth();
    let marginL = 14; // Alterado de const para let
    const marginR = 14;
    const usableW = pageW - marginL - marginR;

    const getY = () => (doc as any).lastAutoTable?.finalY || 30;
    const ensureSpace = (needed: number) => {
        if (getY() + needed > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            return 20;
        }
        return getY() + 12;
    };

    let startY = 20;

    if (payload.reportLogoBase64 && payload.reportLogoBase64.startsWith('data:image')) {
        try {
            doc.addImage(payload.reportLogoBase64, 'JPEG', marginL, 12, 30, 15);
            marginL += 35; // Desloca o texto se a logo existir
        } catch (e) {
            console.error("Erro ao adicionar logo no PDF:", e);
        }
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(payload.reportTitle || 'Relatório Financeiro Estratégico', marginL, startY);
    
    const translatePeriod = (p: string) => {
        if (p === 'thisMonth') return 'Este Mês';
        if (p === 'lastMonth') return 'Mês Passado';
        if (p === 'today') return 'Hoje';
        if (p === 'last7days') return 'Últimos 7 Dias';
        if (p === 'ALL') return 'Todos os Canais';
        return p;
    };

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const periodText = `Período: ${translatePeriod(payload.period)} | Canal: ${translatePeriod(payload.canal)} | Gerado em: ${new Date().toLocaleString()}`;
    doc.text(periodText, marginL, startY + 7);

    // Reset margin para o resto do documento
    marginL = 14;

    // 1. Sumário Executivo
    let secY = 34;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Sumário Executivo', marginL, secY);
    
    const enabledTaxes = payload.taxes?.filter((t: any) => t.enabled !== false) || [];
    const taxTotal = enabledTaxes.reduce((s: any, t: any) => s + t.calculatedAmount, 0) || 0;
    const feesDeducted = payload.deductPlatformFees !== false ? payload.stats.fees : 0;
    const shippingDeducted = payload.deductShipping !== false ? payload.stats.shipping : 0;
    const totalDeductions = feesDeducted + shippingDeducted + taxTotal;
    const netFinal = payload.stats.gross - totalDeductions;

    const getTrendStr = (curr: number, prev: number | undefined) => {
        if (prev === undefined || prev === null || prev === 0) return '';
        const pct = ((curr - prev) / prev) * 100;
        return ` (${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs ant.)`;
    };

    const totalMaterialCost = payload.materialList?.reduce((s, m) => s + (m.cost || 0), 0) || 0;
    const materialCostTrend = getTrendStr(totalMaterialCost, payload.prevStats?.materialCost); // Supondo que venha no prevStats

    const summaryBody: any[][] = [
        ['Faturamento Bruto (sem taxas)', fmt(payload.stats.gross) + getTrendStr(payload.stats.gross, payload.prevStats?.gross)],
    ];
    if (payload.deductPlatformFees !== false) {
        summaryBody.push(['(-) Comissões Plataforma', fmt(payload.stats.fees) + getTrendStr(payload.stats.fees, payload.prevStats?.fees)]);
    }
    if (payload.deductShipping !== false) {
        summaryBody.push(['(-) Frete / Taxa de Envio (Expedição)', fmt(payload.stats.shipping) + getTrendStr(payload.stats.shipping, payload.prevStats?.shipping)]);
    }
    if (totalMaterialCost > 0) {
        summaryBody.push(['(-) Gasto de Materiais (CMV)', fmt(totalMaterialCost) + materialCostTrend]);
    }
    enabledTaxes.forEach((t: any) => {
        summaryBody.push([`(-) ${t.name}`, fmt(t.calculatedAmount)]);
    });
    
    summaryBody.push(['(=) Líquido Final (BOM)', fmt(netFinal - totalMaterialCost) + getTrendStr(netFinal - totalMaterialCost, payload.prevNetProfit)]);
    
    if (payload.despesasLancadas && payload.despesasLancadas > 0) {
        const compLabel = payload.despesaCompetencia ? ` (${payload.despesaCompetencia.split('-').reverse().join('/')})` : '';
        summaryBody.push(['(-) Despesas Lançadas' + compLabel, fmt(payload.despesasLancadas)]);
        summaryBody.push(['(=) Líquido Após Despesas', fmt(netFinal - totalMaterialCost - payload.despesasLancadas)]);
    }

    if (payload.estimatedProfitCalculated !== undefined) {
        summaryBody.push(['(=) Lucro Estimado (Calculadora)', fmt(payload.estimatedProfitCalculated)]);
    }

    summaryBody.push(['Total de Unidades Vendidas', String(payload.stats.units) + getTrendStr(payload.stats.units, payload.prevStats?.units)]);
    summaryBody.push(['Total de Pedidos Processados', String(payload.orders.length) + getTrendStr(payload.orders.length, payload.prevStats?.orders)]);
    summaryBody.push(['Pago pelos Clientes (inc. Frete)', fmt(payload.stats.buyerTotal)]);

    autoTable(doc, {
        startY: secY + 4,
        head: [['Indicador', 'Valor']],
        body: summaryBody,
        theme: 'striped',
        headStyles: { fillColor: '#059669', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: marginL, right: marginR },
    });

    // 2. Detalhamento de Impostos
    if (enabledTaxes.length > 0) {
        secY = ensureSpace(40);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('2. Detalhamento de Impostos', marginL, secY);

        autoTable(doc, {
            startY: secY + 4,
            head: [['Imposto', 'Tipo', 'Valor Base', 'Total Deduzido']],
            body: enabledTaxes.map((t: any) => [
                t.name,
                t.type === 'percent' ? 'Porcentagem' : 'Fixo',
                t.type === 'percent' ? `${t.value}%` : fmt(t.value),
                fmt(t.calculatedAmount)
            ]),
            theme: 'grid',
            headStyles: { fillColor: '#8b5cf6', fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { left: marginL, right: marginR },
        });
    }

    // 3. Ranking de Produtos
    secY = ensureSpace(50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('3. Top 30 Produtos (Performance)', marginL, secY);
    
    autoTable(doc, {
        startY: secY + 4,
        head: [['Pos', 'Produto', 'Qtd.', 'Faturado', 'Pago p/ Cliente', '% Part.']],
        body: payload.stats.ranking.slice(0, 30).map((item: any, idx: number) => [
            idx + 1,
            (item.name || '').substring(0, 45),
            item.qty,
            fmt(item.revenue),
            fmt(item.buyerPaid),
            `${((item.revenue / (payload.stats.gross || 1)) * 100).toFixed(1)}%`
        ]),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fontSize: 7 },
        margin: { left: marginL, right: marginR },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 15, halign: 'center' },
            3: { cellWidth: 30, halign: 'right' },
            4: { cellWidth: 18, halign: 'center' },
        }
    });

    // Glitter e Miúdos
    const glitterItems = payload.stats.ranking.filter((i: any) => {
        const n = String(i.name || '').toLowerCase();
        return n.includes('glitter') || n.includes('miudo') || n.includes('miúdo');
    });

    if (glitterItems.length > 0) {
        secY = ensureSpace(50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Performance de Menores (Glitter / Miúdos)', marginL, secY);

        autoTable(doc, {
            startY: secY + 4,
            head: [['SKU', 'Produto', 'Qtd.', 'Receita']],
            body: glitterItems.map((item: any) => [
                item.code,
                (item.name || '').substring(0, 45),
                item.qty,
                fmt(item.revenue)
            ]),
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fontSize: 7, fillColor: '#ec4899' },
            margin: { left: marginL, right: marginR },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 15, halign: 'center' },
                3: { cellWidth: 30, halign: 'right' },
            }
        });
    }

    // Distribuição de Quantidades
    secY = ensureSpace(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Distribuição de Quantidades por Pedido', marginL, secY);

    const qtyDist = new Map<number, number>();
    payload.orders.forEach(o => {
        const q = o.qty_final;
        qtyDist.set(q, (qtyDist.get(q) || 0) + 1);
    });
    const distArray = Array.from(qtyDist.entries()).sort((a, b) => a[0] - b[0]);

    autoTable(doc, {
        startY: secY + 4,
        head: [['Quantidade no Pedido', 'Frequência (Vezes no período)']],
        body: distArray.map(([q, f]) => [`Foram vendidos de ${q} em ${q}`, f]),
        theme: 'striped',
        headStyles: { fillColor: '#3b82f6', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { left: marginL, right: marginR },
    });

    // 4. Insumos Consumidos
    if (payload.materialList && payload.materialList.length > 0) {
        secY = ensureSpace(40);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('4. Insumos Necessários para esta Produção', marginL, secY);
        
        autoTable(doc, {
            startY: secY + 4,
            head: [['Material', 'Quantidade Estimada', 'Unidade']],
            body: payload.materialList.map((m: any) => [m.name, m.quantity.toFixed(3), m.unit]),
            theme: 'striped',
            headStyles: { fillColor: '#3b82f6', fontSize: 8 },
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { left: marginL, right: marginR },
        });
    }

    // 4.1. Insumos Consumidos (do Estoque - BOM)
    if (payload.stockMovements && payload.stockMovements.length > 0) {
        // Filtra apenas movimentos de saída (negativos) para saber o que gastou
        const consumption = payload.stockMovements.filter(m => m.qty_delta < 0);
        if (consumption.length > 0) {
            secY = ensureSpace(40);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('4.1 Insumos e Materiais Efetivamente Consumidos (Baixas no Estoque)', marginL, secY);

            // Agrupa por código do item para soma total consumida
            const consumedMap = new Map<string, {name: string; qty: number; unit: string}>();
            consumption.forEach(m => {
                const entry = consumedMap.get(m.stockItemCode) || {name: m.itemSnapshot?.name || m.stockItemCode, qty: 0, unit: m.itemSnapshot?.unit || 'un'};
                entry.qty += Math.abs(m.qty_delta);
                consumedMap.set(m.stockItemCode, entry);
            });

            autoTable(doc, {
                startY: secY + 4,
                head: [['Material', 'Soma de Saídas (Consumo)', 'Unidade']],
                body: Array.from(consumedMap.values()).map(m => [m.name, m.qty.toFixed(3), m.unit]),
                theme: 'grid',
                headStyles: { fillColor: '#ea580c', fontSize: 8 }, // orange-600
                styles: { fontSize: 8, cellPadding: 3 },
                margin: { left: marginL, right: marginR },
            });
        }
    }

    // 5. Gráfico de Faturamento Diário
    if (payload.dailyChart && payload.dailyChart.length > 0) {
        doc.addPage();
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('5. Gráfico de Faturamento Diário', marginL, 20);

        const chartData = payload.dailyChart;
        const maxVal = Math.max(...chartData.map(d => d.value), 1);
        const chartX = marginL + 6;
        const chartY = 30;
        const chartW = usableW - 6;
        const chartH = 70;
        const barCount = chartData.length;
        const barGap = Math.max(1, Math.min(2, (chartW / barCount) * 0.1));
        const barW = Math.min(Math.max((chartW - barGap * barCount) / barCount, 2), 18);
        const totalBarsW = barCount * (barW + barGap);
        const offsetX = chartX + (chartW - totalBarsW) / 2;

        // Eixos
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);
        doc.line(chartX, chartY, chartX, chartY + chartH);

        // Grid horizontal
        for (let i = 0; i <= 4; i++) {
            const yLine = chartY + chartH - (chartH * (i / 4));
            doc.setDrawColor(235, 235, 235);
            doc.line(chartX, yLine, chartX + chartW, yLine);
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(140, 140, 140);
            doc.text(fmt(maxVal * (i / 4)), chartX - 1, yLine + 1, { align: 'right' });
        }
        doc.setTextColor(0, 0, 0);

        // Barras
        chartData.forEach((d, i) => {
            const barH = (d.value / maxVal) * chartH;
            const x = offsetX + i * (barW + barGap);
            const y = chartY + chartH - barH;
            doc.setFillColor(59, 130, 246);
            doc.rect(x, y, barW, barH, 'F');

            if (barCount <= 31) {
                doc.setFontSize(4.5);
                doc.setFont('helvetica', 'normal');
                const label = d.date.slice(5);
                doc.text(label, x + barW / 2, chartY + chartH + 3.5, { align: 'center' });
            }
        });

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const totalDC = chartData.reduce((s, d) => s + d.value, 0);
        doc.text(`Total: ${fmt(totalDC)} | Média/dia: ${fmt(totalDC / chartData.length)}`, chartX, chartY + chartH + 10);

        // 6. Comparativo por Canal
        {
            const defaultColors: [number, number, number][] = [
                [255, 230, 0], [238, 77, 45], [59, 130, 246], [0, 0, 0],
                [139, 92, 246], [16, 185, 129], [244, 63, 94], [251, 146, 60]
            ];

            // Usar storeProfitData dinâmico se disponível, senão fallback para canalComparison legado
            let channels: { name: string, value: number, color: [number, number, number] }[] = [];

            if (payload.storeProfitData && Object.keys(payload.storeProfitData).length > 0) {
                channels = Object.entries(payload.storeProfitData).map(([key, data], i) => ({
                    name: payload.channelNames?.[key] || key,
                    value: data.gross,
                    color: defaultColors[i % defaultColors.length]
                })).filter(c => c.value > 0);
            } else if (payload.canalComparison) {
                const comp = payload.canalComparison;
                channels = [
                    { name: payload.channelNames?.['ML'] || 'Mercado Livre', value: comp.ml, color: [255, 230, 0] as [number, number, number] },
                    { name: payload.channelNames?.['SHOPEE'] || 'Shopee', value: comp.shopee, color: [238, 77, 45] as [number, number, number] },
                    { name: payload.channelNames?.['SITE'] || 'TikTok/Site', value: comp.site, color: [0, 0, 0] as [number, number, number] },
                ].filter(c => c.value > 0);
            }

            if (channels.length > 0) {
                const cY = chartY + chartH + 20;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text('6. Comparativo por Canal de Venda', marginL, cY);

                const cMaxVal = Math.max(...channels.map(c => c.value), 1);
                const cBarH = 14;
                const cBarGap = 6;

                channels.forEach((ch, i) => {
                    const y = cY + 8 + i * (cBarH + cBarGap);
                    const w = (ch.value / cMaxVal) * (usableW - 80);

                    doc.setFillColor(ch.color[0], ch.color[1], ch.color[2]);
                    doc.rect(55, y, Math.max(w, 2), cBarH, 'F');

                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    doc.text(ch.name, 53, y + cBarH / 2 + 2, { align: 'right' });

                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    const totalAll = channels.reduce((s, c) => s + c.value, 0);
                    const pct = totalAll > 0 ? ((ch.value / totalAll) * 100).toFixed(1) : '0.0';
                    doc.text(`${fmt(ch.value)} (${pct}%)`, 57 + Math.max(w, 2), y + cBarH / 2 + 2);
                });
            }
        }

        // 7. Top 10 SKUs (horizontal bars)
        if (payload.stats.ranking && payload.stats.ranking.length > 0) {
            doc.addPage();
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('7. Top 10 Produtos por Faturamento', marginL, 20);

            const top10 = payload.stats.ranking.slice(0, 10);
            const skuMaxVal = Math.max(...top10.map((r: any) => r.revenue), 1);
            const sBarH = 10;
            const sBarGap = 4;
            const sY = 28;
            const labelW = 55;
            const barsAreaW = usableW - labelW - 50;

            top10.forEach((item: any, i: number) => {
                const y = sY + i * (sBarH + sBarGap);
                const w = (item.revenue / skuMaxVal) * barsAreaW;

                doc.setFillColor(229, 231, 235);
                doc.rect(marginL + labelW, y, barsAreaW, sBarH, 'F');
                doc.setFillColor(16, 185, 129);
                doc.rect(marginL + labelW, y, Math.max(w, 1), sBarH, 'F');

                doc.setFontSize(6);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                const label = (item.name || item.code).substring(0, 30);
                doc.text(label, marginL + labelW - 2, y + sBarH / 2 + 1.5, { align: 'right' });

                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.text(`${fmt(item.revenue)} (${item.qty} un.)`, marginL + labelW + barsAreaW + 2, y + sBarH / 2 + 1.5);
            });
        }
    }

    // 8. Resumo Completo de Despesas (DRE Simplificado)
    doc.addPage();
    secY = 20;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('8. Resumo Completo de Despesas Fixas e Variáveis', marginL, secY);

    const expenseRows: any[][] = [];
    let totalExpenses = 0;

    // Frete e Comissões
    if (payload.deductPlatformFees !== false && payload.stats.fees > 0) {
        expenseRows.push(['Comissões e Taxas de Plataforma', 'Variável', fmt(payload.stats.fees)]);
        totalExpenses += payload.stats.fees;
    }
    if (payload.deductShipping !== false && payload.stats.shipping > 0) {
        expenseRows.push(['Frete Repassado / Envios', 'Variável', fmt(payload.stats.shipping)]);
        totalExpenses += payload.stats.shipping;
    }

    // Impostos e Despesas Adicionais (Categoria)
    if (enabledTaxes.length > 0) {
        enabledTaxes.forEach((t: any) => {
            const catName = t.category === 'funcionarios' ? 'Despesas com Pessoal'
                        : t.category === 'imposto' ? 'Tributação / Impostos'
                        : t.category === 'publicidade' ? 'Ads e Marketing'
                        : t.category === 'insumos' ? 'Aquisições Externas (Insumos)'
                        : 'Outras Despesas';
            expenseRows.push([`${catName}: ${t.name}`, t.type === 'percent' ? 'Variável' : 'Fixo', fmt(t.calculatedAmount)]);
            totalExpenses += t.calculatedAmount;
        });
    }

    // Custo de Insumos (Opcional - pode ser usado futuramente para somar ao custo)
    const consumption = payload.stockMovements?.filter((m: any) => m.qty_delta < 0) || [];
    if (consumption.length > 0) {
        expenseRows.push(['Consumo Físico de Estoque (BOM)', 'Custos Insumo', 'Informativo na Seção 4.1']);
    }

    autoTable(doc, {
        startY: secY + 8,
        head: [['Categoria da Despesa', 'Tipo', 'Valor Deduzido']],
        body: expenseRows,
        foot: [['TOTAL DE DESPESAS OPERACIONAIS', '', fmt(totalExpenses)]],
        theme: 'striped',
        headStyles: { fillColor: '#be123c', fontSize: 9 }, // rose-700
        footStyles: { fillColor: '#ffe4e6', textColor: '#be123c', fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 4 },
        margin: { left: marginL, right: marginR },
    });

    doc.save(`financeiro_detalhado_${payload.canal}_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportFinancePptx = async (payload: {
    period: string; canal: string; stats: any; materialList: MaterialItem[];
    orders: OrderItem[]; taxes?: any[]; dailyChart?: { date: string, value: number }[];
    canalComparison?: { ml: number, shopee: number, site: number };
    storeProfitData?: Record<string, { gross: number, fees: number, shipping: number }>;
    channelNames?: Record<string, string>;
    deductPlatformFees?: boolean; deductShipping?: boolean; showCustomerPaid?: boolean;
    reportTitle?: string; reportLogoBase64?: string; customReportImageBase64?: string;
    pptxTemplateBase64?: string; stockMovements?: StockMovement[];
    prevStats?: any; prevNetProfit?: number; prevTicketMedio?: number; prevMargemPct?: number; prevTaxTotal?: number;
    estimatedProfitCalculated?: number;
    despesasLancadas?: number; despesaCompetencia?: string;
}) => {
    const pptx = new PptxGenJS();
    pptx.author = 'EcomFlow';
    pptx.title = `Relatório Financeiro - ${payload.canal}`;
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const GREEN = '059669';
    const BLUE = '3b82f6';
    const PURPLE = '8b5cf6';

    const enabledTaxes = payload.taxes?.filter((t: any) => t.enabled !== false) || [];
    const taxTotal = enabledTaxes.reduce((s: any, t: any) => s + (t.calculatedAmount || 0), 0);
    const feesDeducted = payload.deductPlatformFees !== false ? payload.stats.fees : 0;
    const shippingDeducted = payload.deductShipping !== false ? payload.stats.shipping : 0;
    const totalMaterialCost = payload.materialList?.reduce((s, m) => s + (m.cost || 0), 0) || 0;
    const totalDeductions = feesDeducted + shippingDeducted + taxTotal + totalMaterialCost;
    const netFinal = payload.stats.gross - totalDeductions;

    // Slide 1 — Capa
    const s1 = pptx.addSlide();
    s1.addText('Relatório Financeiro', { x: 0.5, y: 1.2, w: 9, h: 1, fontSize: 32, bold: true, color: '1f2937', fontFace: 'Arial' });
    s1.addText(`${payload.canal} — ${payload.period}`, { x: 0.5, y: 2.2, w: 9, h: 0.6, fontSize: 18, color: '6b7280', fontFace: 'Arial' });
    s1.addText(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 10, color: '9ca3af', fontFace: 'Arial' });

    // Slide 2 — Sumário KPIs
    const s2 = pptx.addSlide();
    s2.addText('Sumário Executivo', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });

    const kpis: { label: string; value: string; color: string }[] = [
        { label: 'Faturamento Bruto', value: fmt(payload.stats.gross), color: BLUE },
        { label: 'Taxas Deduzidas', value: fmt(totalDeductions), color: 'ef4444' },
        { label: 'Líquido Final', value: fmt(netFinal), color: GREEN },
    ];
    kpis.forEach((k, i) => {
        const x = 0.5 + i * 3.1;
        s2.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 2.8, h: 1.4, fill: { color: 'f9fafb' }, line: { color: k.color, width: 1.5 }, rectRadius: 0.1 });
        s2.addText(k.label, { x, y: 1.3, w: 2.8, h: 0.4, fontSize: 10, color: '6b7280', align: 'center' });
        s2.addText(k.value, { x, y: 1.7, w: 2.8, h: 0.7, fontSize: 18, bold: true, color: k.color, align: 'center' });
    });

    const getTrendStr = (curr: number, prev: number | undefined) => {
        if (prev === undefined || prev === null || prev === 0) return '';
        const pct = ((curr - prev) / prev) * 100;
        return ` (${pct > 0 ? '+' : ''}${pct.toFixed(1)}% vs ant.)`;
    };

    // Tabela de deduções
    const rows: PptxGenJS.TableRow[] = [
        [{ text: 'Indicador', options: { bold: true, color: 'ffffff', fill: { color: GREEN } } }, { text: 'Valor', options: { bold: true, color: 'ffffff', fill: { color: GREEN } } }],
        [{ text: 'Faturamento Bruto' }, { text: fmt(payload.stats.gross) + getTrendStr(payload.stats.gross, payload.prevStats?.gross) }],
    ];
    if (payload.deductPlatformFees !== false) rows.push([{ text: '(-) Comissões' }, { text: fmt(payload.stats.fees) + getTrendStr(payload.stats.fees, payload.prevStats?.fees) }]);
    if (payload.deductShipping !== false) rows.push([{ text: '(-) Frete' }, { text: fmt(payload.stats.shipping) + getTrendStr(payload.stats.shipping, payload.prevStats?.shipping) }]);
    enabledTaxes.forEach((t: any) => rows.push([{ text: `(-) ${t.name}` }, { text: fmt(t.calculatedAmount) }]));
    rows.push([{ text: '(=) Líquido Final', options: { bold: true } }, { text: fmt(netFinal) + getTrendStr(netFinal, payload.prevNetProfit), options: { bold: true } }]);
    if (payload.despesasLancadas && payload.despesasLancadas > 0) {
        const compLabel = payload.despesaCompetencia ? ` (${payload.despesaCompetencia.split('-').reverse().join('/')})` : '';
        rows.push([{ text: '(-) Despesas Lançadas' + compLabel }, { text: fmt(payload.despesasLancadas) }]);
        rows.push([{ text: '(=) Líquido Após Despesas', options: { bold: true } }, { text: fmt(netFinal - payload.despesasLancadas), options: { bold: true } }]);
    }
    rows.push([{ text: 'Unidades Vendidas' }, { text: String(payload.stats.units) }]);
    rows.push([{ text: 'Pedidos Processados' }, { text: String(payload.orders.length) }]);
    if (payload.showCustomerPaid && payload.stats.customerPaid) {
        rows.push([{ text: 'Total Pago Clientes (info)' }, { text: fmt(payload.stats.customerPaid) }]);
    }

    s2.addTable(rows, { x: 0.5, y: 3, w: 9, fontSize: 10, border: { type: 'solid', pt: 0.5, color: 'e5e7eb' }, colW: [5, 4], autoPage: true });

    // Slide 3 — Ranking de Produtos
    const s3 = pptx.addSlide();
    s3.addText('Performance por SKU (Top 15)', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });

    const rankRows: PptxGenJS.TableRow[] = [
        [
            { text: 'SKU', options: { bold: true, color: 'ffffff', fill: { color: '1f2937' } } },
            { text: 'Produto', options: { bold: true, color: 'ffffff', fill: { color: '1f2937' } } },
            { text: 'Qtd.', options: { bold: true, color: 'ffffff', fill: { color: '1f2937' } } },
            { text: 'Receita', options: { bold: true, color: 'ffffff', fill: { color: '1f2937' } } },
        ]
    ];
    payload.stats.ranking.slice(0, 15).forEach((item: any) => {
        rankRows.push([
            { text: item.code.substring(0, 20) },
            { text: (item.name || '').substring(0, 45) },
            { text: String(item.qty) },
            { text: fmt(item.revenue) },
            { text: `${((item.revenue / (payload.stats.gross || 1)) * 100).toFixed(1)}%` },
        ]);
    });

    s3.addTable(rankRows, { x: 0.5, y: 1, w: 9, fontSize: 8, border: { type: 'solid', pt: 0.5, color: 'e5e7eb' }, colW: [1.5, 3.5, 0.8, 1.8, 0.8], autoPage: true, autoPageRepeatHeader: true });

    // Slide 4 — Gráfico Faturamento Diário
    if (payload.dailyChart && payload.dailyChart.length > 0) {
        const s4 = pptx.addSlide();
        s4.addText('Faturamento Diário', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });

        const chartDataObj = [{
            name: 'Faturamento',
            labels: payload.dailyChart.map(d => d.date.slice(5)),
            values: payload.dailyChart.map(d => d.value),
        }];

        s4.addChart(pptx.ChartType.bar, chartDataObj, {
            x: 0.5, y: 1, w: 9, h: 4,
            showValue: false,
            catAxisLabelFontSize: 7,
            valAxisLabelFontSize: 8,
            chartColors: [BLUE],
            barDir: 'bar',
            catAxisOrientation: 'minMax',
            valAxisOrientation: 'minMax',
        });

        const totalDC = payload.dailyChart.reduce((s, d) => s + d.value, 0);
        s4.addText(`Total: ${fmt(totalDC)} | Média/dia: ${fmt(totalDC / payload.dailyChart.length)}`, { x: 0.5, y: 5.1, w: 9, h: 0.3, fontSize: 9, color: '6b7280' });
    }

    // Slide 5 — Comparativo por Canal (dinâmico)
    {
        const defaultPptxColors = ['FFE600', 'EE4D2D', '3b82f6', '111111', '8b5cf6', '10b981', 'f43f5e', 'fb923c'];

        let channels: { name: string, value: number }[] = [];

        if (payload.storeProfitData && Object.keys(payload.storeProfitData).length > 0) {
            channels = Object.entries(payload.storeProfitData).map(([key, data]) => ({
                name: payload.channelNames?.[key] || key,
                value: data.gross,
            })).filter(c => c.value > 0);
        } else if (payload.canalComparison) {
            const comp = payload.canalComparison;
            channels = [
                { name: payload.channelNames?.['ML'] || 'Mercado Livre', value: comp.ml },
                { name: payload.channelNames?.['SHOPEE'] || 'Shopee', value: comp.shopee },
                { name: payload.channelNames?.['SITE'] || 'TikTok/Site', value: comp.site },
            ].filter(c => c.value > 0);
        }

        if (channels.length > 0) {
            const s5 = pptx.addSlide();
            s5.addText('Comparativo por Canal', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });

            const pieData = [{
                name: 'Canal',
                labels: channels.map(c => c.name),
                values: channels.map(c => c.value),
            }];

            s5.addChart(pptx.ChartType.pie, pieData, {
                x: 1, y: 1.2, w: 4, h: 3.5,
                showPercent: true,
                showLegend: true,
                legendPos: 'b',
                chartColors: channels.map((_, i) => defaultPptxColors[i % defaultPptxColors.length]),
            });

            const cRows: PptxGenJS.TableRow[] = [
                [{ text: 'Canal', options: { bold: true, color: 'ffffff', fill: { color: GREEN } } }, { text: 'Valor', options: { bold: true, color: 'ffffff', fill: { color: GREEN } } }, { text: '%', options: { bold: true, color: 'ffffff', fill: { color: GREEN } } }],
            ];
            const totalVal = channels.reduce((s, c) => s + c.value, 0);
            channels.forEach(c => cRows.push([{ text: c.name }, { text: fmt(c.value) }, { text: `${((c.value / totalVal) * 100).toFixed(1)}%` }]));
            s5.addTable(cRows, { x: 5.5, y: 1.5, w: 4, fontSize: 10, border: { type: 'solid', pt: 0.5, color: 'e5e7eb' }, colW: [1.8, 1.4, 0.8] });
        }
    }

    // Slide 6 — Impostos
    if (enabledTaxes.length > 0) {
        const s6 = pptx.addSlide();
        s6.addText('Detalhamento de Impostos', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });
        const tRows: PptxGenJS.TableRow[] = [
            [
                { text: 'Imposto', options: { bold: true, color: 'ffffff', fill: { color: PURPLE } } },
                { text: 'Tipo', options: { bold: true, color: 'ffffff', fill: { color: PURPLE } } },
                { text: 'Valor', options: { bold: true, color: 'ffffff', fill: { color: PURPLE } } },
                { text: 'Total Deduzido', options: { bold: true, color: 'ffffff', fill: { color: PURPLE } } },
            ]
        ];
        enabledTaxes.forEach((t: any) => tRows.push([
            { text: t.name },
            { text: t.type === 'percent' ? 'Porcentagem' : 'Fixo' },
            { text: t.type === 'percent' ? `${t.value}%` : fmt(t.value) },
            { text: fmt(t.calculatedAmount) },
        ]));
        s6.addTable(tRows, { x: 0.5, y: 1.2, w: 9, fontSize: 10, border: { type: 'solid', pt: 0.5, color: 'e5e7eb' }, colW: [3, 2, 2, 2] });
    }

    // Slide 7 - Resumo Operacional (DRE)
    const s7 = pptx.addSlide();
    s7.addText('Resumo Completo de Despesas Operacionais', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });

    const dreRows: PptxGenJS.TableRow[] = [
        [
            { text: 'Categoria da Despesa', options: { bold: true, color: 'ffffff', fill: { color: 'be123c' } } },
            { text: 'Valor Custeado', options: { bold: true, color: 'ffffff', fill: { color: 'be123c' } } },
        ]
    ];
    let totalOp = 0;
    if (feesDeducted > 0) {
        dreRows.push([{ text: 'Comissões de Plataforma' }, { text: fmt(feesDeducted) }]);
        totalOp += feesDeducted;
    }
    if (shippingDeducted > 0) {
        dreRows.push([{ text: 'Fretes e Envios (Expedição)' }, { text: fmt(shippingDeducted) }]);
        totalOp += shippingDeducted;
    }
    if (totalMaterialCost > 0) {
        dreRows.push([{ text: 'Custo de Materiais (CMV)' }, { text: fmt(totalMaterialCost) }]);
        totalOp += totalMaterialCost;
    }
    if (enabledTaxes.length > 0) {
        enabledTaxes.forEach((t: any) => {
            const cName = t.category === 'funcionarios' ? 'Gastos c/ Pessoal' : t.category === 'imposto' ? 'Impostos Fiscais' : 'Despesas Manuais';
            dreRows.push([{ text: `${cName}: ${t.name}` }, { text: fmt(t.calculatedAmount) }]);
            totalOp += t.calculatedAmount;
        });
    }
    dreRows.push([{ text: 'TOTAL DEDUZIDO', options: { bold: true } }, { text: fmt(totalOp), options: { bold: true } }]);
    if (payload.despesasLancadas && payload.despesasLancadas > 0) {
        const compLabel = payload.despesaCompetencia ? ` (${payload.despesaCompetencia.split('-').reverse().join('/')})` : '';
        dreRows.push([{ text: 'Despesas Lançadas' + compLabel, options: { bold: true, color: 'be123c' } }, { text: fmt(payload.despesasLancadas), options: { bold: true, color: 'be123c' } }]);
        dreRows.push([{ text: 'TOTAL GERAL (c/ Despesas)', options: { bold: true } }, { text: fmt(totalOp + payload.despesasLancadas), options: { bold: true } }]);
    }

    s7.addTable(dreRows, { x: 0.5, y: 1.2, w: 9, fontSize: 12, border: { type: 'solid', pt: 0.5, color: 'e5e7eb' }, colW: [6, 3] });

    // Slide 8 — Análise Visual (Foto)
    if (payload.customReportImageBase64) {
        const s8 = pptx.addSlide();
        s8.addText('Análise Visual de Performance', { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 22, bold: true, color: '1f2937' });
        
        try {
            s8.addImage({ data: payload.customReportImageBase64, x: 1, y: 1.2, w: 8, h: 4.5 });
            s8.addText(payload.period, { x: 0.5, y: 5.3, w: 9, fontSize: 10, color: '64748b', italic: true });
        } catch(err) {
            console.error(err);
        }
    }

    await pptx.writeFile({ fileName: `financeiro_${payload.canal}_${new Date().toISOString().split('T')[0]}.pptx` });
};

export const exportProductionPlanToPdf = (planItems: any[], params: any) => {
    const doc = new jsPDF();
    const title = `Plano de Produção - ${new Date().toLocaleDateString('pt-BR')}`;
    doc.text(title, 14, 15);
    const head = [['Produto', 'Estoque Atual', 'Venda Média/dia', 'Demanda Projetada', 'Produção Necessária', 'Motivo']];
    const body = planItems.filter((item: any) => item.requiredProduction > 0).map((item: any) => [
        item.product.name,
        item.product.current_qty,
        item.avgDailySales.toFixed(2),
        Math.ceil(item.forecastedDemand),
        item.requiredProduction,
        item.reason
    ]);
    autoTable(doc, { head, body, startY: 20, headStyles: headerStyles });
    doc.save(`plano_de_producao_${new Date().toISOString().split('T')[0]}.pdf`);
};

export const exportExcel = (data: ProcessedData, skuLinks: SkuLink[], stockItems: StockItem[] = []) => {
    const wb = XLSX.utils.book_new();
    const linkedSkusMap = new Map(skuLinks.map(link => [link.importedSku, link.masterProductSku]));
    const stockMap = new Map(stockItems.map(i => [i.code.toUpperCase(), i]));

    const completaData: any[] = [];
    
    data.lists.completa.forEach(o => {
        const masterSku = linkedSkusMap.get(o.sku);
        const product = masterSku ? stockMap.get(masterSku.toUpperCase()) : undefined;
        
        completaData.push({
            'Status Vínculo': linkedSkusMap.has(o.sku) ? 'Vinculado' : 'PENDENTE',
            'Pedido': o.orderId,
            'Rastreio': o.tracking,
            'SKU Importado': o.sku,
            'SKU Mestre': masterSku || '',
            'Qtd Original': o.qty_original,
            'Multiplicador': o.multiplicador,
            'Qtd Final': o.qty_final,
            'Cor': o.color,
            'Canal': o.canal,
            'Miúdos/Expedição': product?.expedition_items?.map(m => `${m.stockItemCode} (x${m.qty_per_pack})`).join(', ') || ''
        });
    });

    const wsCompleta = XLSX.utils.json_to_sheet(completaData);
    XLSX.utils.book_append_sheet(wb, wsCompleta, 'Lista Completa');
    XLSX.writeFile(wb, `importacao_${data.canal}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportOnlyUnlinked = (data: ProcessedData, skuLinks: SkuLink[]) => {
    const wb = XLSX.utils.book_new();
    const linkedSkusMap = new Map(skuLinks.map(link => [link.importedSku.toUpperCase(), link.masterProductSku]));
    const naoVinculadosData = data.skusNaoVinculados
        .filter(s => !linkedSkusMap.has(s.sku.toUpperCase()))
        .map(s => ({ 'SKU_Pendente': s.sku, 'Cor_Sugerida': s.colorSugerida }));
    if (naoVinculadosData.length > 0) {
        const ws = XLSX.utils.json_to_sheet(naoVinculadosData);
        XLSX.utils.book_append_sheet(wb, ws, 'SKUs Pendentes');
        XLSX.writeFile(wb, `skus_pendentes_${data.canal}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
        alert('Não há SKUs pendentes para exportar.');
    }
};

export const exportStateToSql = (state: any, setupSql: string) => {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_erp_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
};
