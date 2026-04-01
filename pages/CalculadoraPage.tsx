import React, { useState, useMemo, useEffect } from 'react';
import { 
    Calculator, 
    Plus, 
    Trash2, 
    DollarSign, 
    Target, 
    TrendingUp, 
    AlertCircle, 
    FileText, 
    Camera, 
    Package, 
    Search,
    ArrowRight,
    Percent,
    ShoppingCart,
    Info,
    ChevronRight,
    X,
    Save,
    Loader2,
    ChevronDown
} from 'lucide-react';
import { StockItem, ProdutoCombinado } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { dbClient } from '../lib/supabaseClient';

interface MaterialItem {
    id: string;
    name: string;
    quantityUsed: number;
    unit: string;
    buyUnit: string; // "Metro (m)", "Valor Fix", "Unidade (un)", etc.
    basePrice: number;
    totalCost: number;
    productSku?: string; // Vincula ao produto pai do conjunto
}

interface CalculadoraPageProps {
    stockItems: StockItem[];
    produtosCombinados: ProdutoCombinado[];
    addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    initialSku?: string;
    onUpdatePrices?: (productSkus: string[], newCost?: number, newSell?: number) => Promise<boolean>;
}

export default function CalculadoraPage({ stockItems, produtosCombinados, addToast, initialSku, onUpdatePrices }: CalculadoraPageProps) {
    const [items, setItems] = useState<MaterialItem[]>([]);
    const [sellingPrice, setSellingPrice] = useState(0);
    const [platformFeePercent, setPlatformFeePercent] = useState(15);
    const [shippingCost, setShippingCost] = useState(0);
    const [taxPercent, setTaxPercent] = useState(0);
    const [otherCosts, setOtherCosts] = useState(0);
    
    // Identificação do Produto (Suporte a Multi-Produto/Conjunto)
    const [selectedProducts, setSelectedProducts] = useState<Array<{sku: string, name: string, isVisible: boolean}>>([]);
    const [productSku, setProductSku] = useState(''); // Legado/Principal
    const [productName, setProductName] = useState(''); // Legado/Principal
    
    // Novo: Histórico
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Simulação Comparativa
    const [targetQuantity, setTargetQuantity] = useState(10); 
    const [targetRevenue, setTargetRevenue] = useState(0); 
    const [comparativePrices, setComparativePrices] = useState<number[]>([150, 90]);
    const [relatedSkus, setRelatedSkus] = useState<string[]>([]); // SKUs adicionais que usam o mesmo custo
    const [editingId, setEditingId] = useState<string | null>(null); // ID do cálculo sendo editado
    const [calculationType, setCalculationType] = useState<'individual' | 'conjunto'>('individual');
    const [calculationCategory, setCalculationCategory] = useState('');
    const [reportName, setReportName] = useState('');
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'main' | 'composition'>('main');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchingItemId, setSearchingItemId] = useState<string | null>(null);

    // Todos os itens de estoque disponíveis para busca
    const fmtMoney = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const allAvailableProducts = useMemo(() => {
        return stockItems.sort((a, b) => a.name.localeCompare(b.name));
    }, [stockItems]);

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return [];
        return allAvailableProducts
            .filter(p => p.kind === 'PRODUTO') // Apenas produtos finais no topo
            .filter(p => 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.code.toLowerCase().includes(searchTerm.toLowerCase())
            ).slice(0, 50);
    }, [allAvailableProducts, searchTerm]);

    const loadFromHistory = (calc: any) => {
        setProductSku(calc.product_sku);
        setProductName(calc.product_name);
        setItems(calc.items);
        setSellingPrice(calc.selling_price);
        setPlatformFeePercent(calc.platform_fee_percent);
        setShippingCost(calc.shipping_cost || 0);
        setTaxPercent(calc.tax_percent || 0);
        setOtherCosts(calc.other_costs || 0);
        setTargetRevenue(calc.target_revenue || 0);
        setComparativePrices(calc.comparative_prices || [0, 0]);
        setRelatedSkus(calc.related_skus || []);
        setTargetQuantity(calc.target_quantity || 10);
        setCalculationType(calc.calculation_type || 'individual');
        setCalculationCategory(calc.calculation_category || '');
        setReportName(calc.report_name || '');
        setSelectedProducts(calc.selected_products || (calc.product_sku ? [{sku: calc.product_sku, name: calc.product_name, isVisible: true}] : []));
        setEditingId(calc.id);
        setIsHistoryModalOpen(false);
    };

    const loadFromHistoryBySku = async (sku: string) => {
        try {
            const { data } = await dbClient
                .from('cost_calculations')
                .select('*')
                .eq('product_sku', sku)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (data && data.length > 0) {
                loadFromHistory(data[0]);
            }
        } catch (e) {
            console.error("Erro ao carregar do histórico por SKU:", e);
        }
    };

    const handleSelectProduct = (product: StockItem) => {
        // Se estiver no modo conjunto, adicionamos à lista ao invés de substituir (se não for duplicado)
        if (calculationType === 'conjunto') {
            if (selectedProducts.some(p => p.sku === product.code)) {
                if (addToast) addToast("Este produto já está no conjunto.", "warning");
                setIsProductModalOpen(false);
                return;
            }
            setSelectedProducts(prev => [...prev, { sku: product.code, name: product.name, isVisible: true }]);
        } else {
            // Modo individual: substitui o principal
            setSelectedProducts([{ sku: product.code, name: product.name, isVisible: true }]);
            setProductSku(product.code);
            setProductName(product.name);
            loadFromHistoryBySku(product.code);
        }
        
        const bom = produtosCombinados.find(b => b.productSku === product.code);
        
        let newItemsToAdd: MaterialItem[] = [];
        
        if (bom) {
            newItemsToAdd = bom.items.map(bomItem => {
                const stockItem = stockItems.find(si => si.code === bomItem.stockItemCode);
                const price = stockItem?.cost_price || 0;
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: stockItem?.name || bomItem.stockItemCode,
                    quantityUsed: bomItem.qty_per_pack,
                    unit: stockItem?.unit || 'un',
                    buyUnit: 'Unidade',
                    basePrice: price,
                    totalCost: bomItem.qty_per_pack * price,
                    productSku: product.code // Vincula o material ao produto do conjunto
                };
            });
        }
        
        if (calculationType === 'conjunto') {
            setItems(prev => [...prev, ...newItemsToAdd]);
        } else {
            setItems(newItemsToAdd);
        }

        if (product.sell_price && calculationType === 'individual') setSellingPrice(product.sell_price);
        setIsProductModalOpen(false);
        setSearchTerm('');
    };

    useEffect(() => {
        if (initialSku) {
            const product = stockItems.find(s => s.code === initialSku);
            if (product) {
                handleSelectProduct(product);
            }
        }
    }, [initialSku, stockItems]);

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { data, error } = await dbClient
                .from('cost_calculations')
                .select('*')
                .order('created_at', { ascending: false });
            if (data) setHistory(data);
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };
    const saveToHistory = async () => {
        if (items.length === 0) {
            if (addToast) addToast("Adicione itens para salvar.", "warning");
            return;
        }

        setIsSaving(true);
        try {
            const compositeName = reportName || (selectedProducts.length > 0 ? selectedProducts.map(p => p.sku).join(' + ') : productName);
            
            const payload = {
                product_sku: selectedProducts.length > 0 ? selectedProducts[0].sku : productSku,
                product_name: compositeName,
                items: items,
                selling_price: sellingPrice,
                platform_fee: platformFeePercent,
                shipping_cost: shippingCost,
                tax_percent: taxPercent,
                other_costs: otherCosts,
                calculation_type: calculationType,
                calculation_category: calculationCategory,
                report_name: reportName,
                selected_products: selectedProducts,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                const { error } = await dbClient.from('cost_calculations').update(payload).eq('id', editingId);
                if (error) throw error;
                if (addToast) addToast("Cálculo atualizado com sucesso!", "success");
            } else {
                const { error } = await dbClient.from('cost_calculations').insert({ ...payload, created_at: new Date().toISOString() });
                if (error) throw error;
                if (addToast) addToast("Cálculo salvo no histórico!", "success");
            }
            loadHistory();
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            if (addToast) {
                if (error.code === 'PGRST204' || error.message?.includes('column')) {
                    addToast("Erro de esquema: Você precisa executar o script SQL de migração no Supabase para habilitar os novos campos.", "error");
                } else {
                    addToast("Erro ao salvar o cálculo. Verifique sua conexão ou o banco de dados.", "error");
                }
            }
        } finally {
            setIsSaving(false);
        }
    };


    const [isSavingPlanning, setIsSavingPlanning] = useState(false);

    const saveToPlanning = async () => {
        if (items.length === 0) {
            if (addToast) addToast("Adicione itens para criar um planejamento.", "warning");
            return;
        }

        setIsSavingPlanning(true);
        try {
            const compositeName = reportName || (selectedProducts.length > 0 ? selectedProducts.map(p => p.sku).join(' + ') : productName);
            
            const payload = {
                project_name: compositeName || "Planejamento sem nome",
                category: calculationCategory || "Geral",
                product_sku: selectedProducts.length > 0 ? selectedProducts[0].sku : productSku,
                related_skus: relatedSkus,
                items: items,
                total_cost: totalDirectCost,
                created_by: "Usuário", // Idealmente pegar do contexto de auth se disponível
                updated_at: new Date().toISOString()
            };

            const { error } = await dbClient.from('purchase_planning').insert({ ...payload, created_at: new Date().toISOString() });
            
            if (error) throw error;
            
            if (addToast) addToast("✅ Planejamento de Compras salvo com sucesso!", "success");
        } catch (error: any) {
            console.error('Erro ao salvar planejamento:', error);
            if (addToast) {
                addToast("Erro ao salvar o planejamento. Verifique o banco de dados.", "error");
            }
        } finally {
            setIsSavingPlanning(false);
        }
    };

    const deleteCalculation = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este cálculo?')) return;
        try {
            const { error } = await dbClient.from('cost_calculations').delete().eq('id', id);
            if (error) throw error;
            if (addToast) addToast("Cálculo excluído com sucesso!", "success");
            loadHistory();
        } catch (error: any) {
            console.error('Erro ao excluir:', error);
            if (addToast) addToast("Erro ao excluir o cálculo.", "error");
        }
    };

    const handleAddManualItem = () => {
        const newItem: MaterialItem = {
            id: Math.random().toString(36).substr(2, 9),
            name: '',
            quantityUsed: 1,
            unit: 'un',
            buyUnit: 'Unidade',
            basePrice: 0,
            totalCost: 0
        };
        setItems([...items, newItem]);
    };

    const handleAddItemToComposition = (product: StockItem) => {
        const newItem: MaterialItem = {
            id: Math.random().toString(36).substr(2, 9),
            name: product.name,
            quantityUsed: 1,
            unit: product.unit || 'un',
            buyUnit: 'Unidade',
            basePrice: product.cost_price || 0,
            totalCost: product.cost_price || 0
        };
        setItems([...items, newItem]);
        setIsProductModalOpen(false);
        setSearchTerm('');
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const toggleProductVisibility = (sku: string) => {
        setSelectedProducts(prev => prev.map(p => p.sku === sku ? { ...p, isVisible: !p.isVisible } : p));
    };

    const duplicateProduct = (sku: string) => {
        const product = selectedProducts.find(p => p.sku === sku);
        if (!product) return;
        
        // No conjunto, podemos querer duplicar o MESMO SKU mas com composição diferente? 
        // O usuário disse "duplicar tbm e vincular a outro esku". 
        // Se duplicar o mesmo SKU, precisamos que o ID no selectedProducts seja único se permitirmos repetição.
        // Mas por ora, vamos assumir que duplicar cria um "espaço" para outro SKU ou apenas repete.
        // Se o usuário quer adicionar outro, ele usa o (+).
        
        const relatedItems = items.filter(it => it.productSku === sku);
        const newItems = relatedItems.map(it => ({
            ...it,
            id: Math.random().toString(36).substr(2, 9)
        }));
        
        setItems(prev => [...prev, ...newItems]);
        if (addToast) addToast("Composição do produto duplicada!", "info");
    };

    const removeProductFromSet = (sku: string) => {
        setSelectedProducts(prev => prev.filter(p => p.sku !== sku));
        setItems(prev => prev.filter(it => it.productSku !== sku));
    };

    const updateItem = (id: string, field: keyof MaterialItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                let updatedItem = { ...item, [field]: value };
                
                // Resetar unidade de uso ao trocar unidade de compra
                if (field === 'buyUnit') {
                    if (value === 'Metro') updatedItem.unit = 'm';
                    else if (value === 'Quilo') updatedItem.unit = 'kg';
                    else updatedItem.unit = 'un';
                }
                
                // Ensure numeric values are parsed
                if (field === 'quantityUsed' || field === 'basePrice') {
                    updatedItem[field] = parseFloat(value) || 0;
                }

                // Cálculo especial baseado na unidade
                let finalCost = updatedItem.basePrice * updatedItem.quantityUsed;
                
                if (updatedItem.buyUnit === 'Metro') {
                    if (updatedItem.unit === 'cm') finalCost = (updatedItem.basePrice / 100) * updatedItem.quantityUsed;
                    else if (updatedItem.unit === 'mm') finalCost = (updatedItem.basePrice / 1000) * updatedItem.quantityUsed;
                } else if (updatedItem.buyUnit === 'Quilo') {
                    if (updatedItem.unit === 'g') finalCost = (updatedItem.basePrice / 1000) * updatedItem.quantityUsed;
                } else if (updatedItem.buyUnit === 'Unidade' || updatedItem.buyUnit === 'Valor Fixo') {
                    if (updatedItem.unit === 'par') finalCost = (updatedItem.basePrice * 2) * updatedItem.quantityUsed;
                    else if (updatedItem.unit === 'duzia') finalCost = (updatedItem.basePrice * 12) * updatedItem.quantityUsed;
                }
                
                updatedItem.totalCost = finalCost;
                return updatedItem;
            }
            return item;
        }));
    };
    
    // Total de custo de materiais/insumos sem taxas
    const totalMaterialOnlyCost = useMemo(() => {
        return items.reduce((sum, item) => {
            if (item.productSku) {
                const parent = selectedProducts.find(p => p.sku === item.productSku);
                if (parent && !parent.isVisible) return sum;
            }
            return sum + (item.totalCost || 0);
        }, 0);
    }, [items, selectedProducts]);

    const handleApplyPricing = async () => {
        if (!onUpdatePrices || selectedProducts.length === 0) return;
        
        const skus = selectedProducts.map(p => p.sku);
        const confirmMsg = `Deseja aplicar o Custo Direto (${fmtMoney(totalDirectCost)}) e/ou o Preço de Venda (${fmtMoney(sellingPrice)}) aos ${skus.length} produtos selecionados?`;
        
        if (!confirm(confirmMsg)) return;

        setIsSaving(true);
        try {
            // Aplicamos o custo proporcional se for conjunto? 
            // O usuário disse: "ao adicionar mais de um produto ao clicar na calculadora vai editar os preços"
            // Vamos aplicar o custo total e o preço de venda para cada um, ou o usuário decide.
            // Para simplificar, vamos aplicar o custo direto total e o preço de venda para todos os SKUs do conjunto.
            const success = await onUpdatePrices(skus, totalMaterialOnlyCost, sellingPrice);
            if (success && addToast) addToast("Preços atualizados no sistema!", "success");
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const totalMaterialCost = useMemo(() => {
        return items.reduce((sum, item) => {
            // Se o item estiver vinculado a um produto, verifica se o produto está visível
            if (item.productSku) {
                const parent = selectedProducts.find(p => p.sku === item.productSku);
                if (parent && !parent.isVisible) return sum;
            }
            return sum + (item.totalCost || 0);
        }, 0);
    }, [items, selectedProducts]);
    const platformFeeValue = useMemo(() => (sellingPrice * platformFeePercent) / 100, [sellingPrice, platformFeePercent]);
    const taxValue = useMemo(() => (sellingPrice * taxPercent) / 100, [sellingPrice, taxPercent]);
    
    const totalDirectCost = useMemo(() => 
        totalMaterialCost + platformFeeValue + shippingCost + taxValue + otherCosts,
    [totalMaterialCost, platformFeeValue, shippingCost, taxValue, otherCosts]);

    const profit = useMemo(() => sellingPrice - totalDirectCost, [sellingPrice, totalDirectCost]);
    const profitMargin = useMemo(() => (sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0), [profit, sellingPrice]);
    const markup = useMemo(() => (totalDirectCost > 0 ? (sellingPrice / totalDirectCost) : 0), [sellingPrice, totalDirectCost]);

    const getProfitForPrice = (price: number) => {
        const fees = (price * platformFeePercent) / 100;
        const tax = (price * taxPercent) / 100;
        const tCost = totalMaterialCost + fees + shippingCost + tax + otherCosts;
        return price - tCost;
    };

    const originalTotalProfit = useMemo(() => profit * targetQuantity, [profit, targetQuantity]);
    
    const scenarios = useMemo(() => {
        return comparativePrices.map(price => {
            const profitPerUnit = getProfitForPrice(price);
            const requiredQty = profitPerUnit > 0 ? Math.ceil(originalTotalProfit / profitPerUnit) : 0;
            return {
                price,
                profitPerUnit,
                requiredQty
            };
        });
    }, [comparativePrices, originalTotalProfit, totalMaterialCost, platformFeePercent, shippingCost, taxPercent, otherCosts]);

    const calculatorRef = React.useRef<HTMLDivElement>(null);

    const generateImage = async () => {
        if (!calculatorRef.current) return;
        try {
            const canvas = await html2canvas(calculatorRef.current, {
                scale: 2, // High resolution
                useCORS: true,
                backgroundColor: '#F8FAFC'
            });
            const link = document.createElement('a');
            link.download = `Precificacao_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error generating image:', error);
        }
    };

    const generatePDF = () => {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();

        // Estilo moderno
        pdf.setFillColor(79, 70, 229); // Indigo 600
        pdf.rect(0, 0, pageWidth, 40, 'F');

        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(22);
        pdf.setFont("helvetica", "bold");
        pdf.text("RELATÓRIO DE PRECIFICAÇÃO", 15, 20);
        
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Documento gerado em: ${new Date().toLocaleString()}`, 15, 28);
        pdf.text(`${calculationType === 'individual' ? 'Produto' : 'Conjunto'}: ${reportName || productName} (${productSku})`, 15, 34);
        if (calculationCategory) {
            pdf.text(`Categoria do Projeto: ${calculationCategory}`, 15, 38);
        }
        if (relatedSkus.length > 0) {
            pdf.setFontSize(8);
            pdf.text(`SKUs Adicionais: ${relatedSkus.join(', ')}`, 15, (calculationCategory ? 42 : 38));
        }

        const getVerdict = (margin: number) => {
            if (margin >= 30) return "EXCELENTE: Alta Lucratividade";
            if (margin >= 18) return "SAUDÁVEL: Margem dentro do ideal";
            if (margin >= 8) return "ATENÇÃO: Margem Apertada";
            if (margin >= 0) return "RISCO: Próximo ao ponto de equilíbrio";
            return "ALERTA: Margem Negativa (Prejuízo)";
        };

        let currentY = 50;

        // --- TABELA 1: COMPOSIÇÃO DO CUSTO DIRETO ---
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("1. Detalhamento do Custo Direto", 15, currentY);
        currentY += 8;

        const isConjunto = calculationType === 'conjunto';
        const costHead = isConjunto
            ? [['SKU Mestre', 'Item / Insumo', 'Qtd. Utilizada', 'Preço Unit.', 'Subtotal']]
            : [['Item / Insumo', 'Qtd. Utilizada', 'Preço Unit.', 'Subtotal']];

        const costRows = items.map(item => {
            const row = [
                item.name,
                `${item.quantityUsed} ${item.unit}`,
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.basePrice),
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.totalCost)
            ];
            if (isConjunto) row.unshift(item.productSku || '-');
            return row;
        });

        if (otherCosts > 0) {
            const otherRow = ["Outros Custos Operacionais", "-", "-", new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(otherCosts)];
            if (isConjunto) otherRow.unshift('-');
            costRows.push(otherRow);
        }

        autoTable(pdf, {
            startY: currentY,
            head: costHead,
            body: costRows,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9 },
            columnStyles: isConjunto
                ? { 0: { fontStyle: 'bold', cellWidth: 28 }, 4: { halign: 'right', fontStyle: 'bold' } }
                : { 3: { halign: 'right', fontStyle: 'bold' } },
            foot: [[
                { content: 'CUSTO TOTAL DE MATERIAIS E OPERAÇÃO', colSpan: isConjunto ? 4 : 3, styles: { halign: 'right', fontStyle: 'bold' } },
                { content: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalMaterialCost + otherCosts), styles: { halign: 'right', fontStyle: 'bold' } }
            ]]
        });

        currentY = (pdf as any).lastAutoTable.finalY + 15;

        // --- TABELA 2: ANÁLISE DE CENÁRIOS E MARGEM ---
        pdf.text("2. Análise Comparativa de Cenários", 15, currentY);
        currentY += 8;

        const activeScenarios = comparativePrices.filter(p => !isNaN(p) && p > 0);
        const allPrices = [sellingPrice, ...activeScenarios];

        const scenarioHead = [['Indicador', ...allPrices.map((p, i) => i === 0 ? `Preço Atual` : `Cenário ${i}`)]];
        
        const scenarioBody = [
            ['Preço de Venda', ...allPrices.map(p => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p))],
            ['Custo Direto', ...allPrices.map(p => {
                const fees = (p * platformFeePercent) / 100;
                const taxes = (p * taxPercent) / 100;
                const dCost = totalMaterialCost + otherCosts + fees + taxes + shippingCost;
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dCost);
            })],
            ['Imposto Fiscal', ...allPrices.map(p => `${taxPercent}% (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p * taxPercent / 100)})`)],
            ['Taxa Marketplace', ...allPrices.map(p => `${platformFeePercent}% (${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p * platformFeePercent / 100)})`)],
            ['Margem de Lucro (%)', ...allPrices.map(p => {
                const fees = (p * platformFeePercent) / 100;
                const taxes = (p * taxPercent) / 100;
                const dCost = totalMaterialCost + otherCosts + fees + taxes + shippingCost;
                const prof = p - dCost;
                const marg = p > 0 ? (prof / p) * 100 : 0;
                return `${marg.toFixed(1)}%`;
            })],
            ['Lucro por Unidade', ...allPrices.map(p => {
                const fees = (p * platformFeePercent) / 100;
                const taxes = (p * taxPercent) / 100;
                const dCost = totalMaterialCost + otherCosts + fees + taxes + shippingCost;
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p - dCost);
            })],
            ['Diferença para o Cliente', ...allPrices.map((p, i) => {
                if (i === 0) return "-";
                const diff = p - sellingPrice;
                return diff > 0 
                    ? `+ ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(diff)}`
                    : `- ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(diff))}`;
            })],
            ...(targetRevenue > 0 ? [
                ['Qtd. p/ Faturamento Alvo', ...allPrices.map(p => {
                    const qty = Math.ceil(targetRevenue / p);
                    return `${qty} unidades`;
                })],
                ['Lucro Total no Volume', ...allPrices.map(p => {
                    const fees = (p * platformFeePercent) / 100;
                    const taxes = (p * taxPercent) / 100;
                    const dCost = totalMaterialCost + otherCosts + fees + taxes + shippingCost;
                    const prof = p - dCost;
                    const qty = Math.ceil(targetRevenue / p);
                    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prof * qty);
                })]
            ] : []),
            ['Meta para Manter Lucro', ...allPrices.map((p, i) => {
                if (i === 0) return `${targetQuantity} unidades (Base)`;
                const profN = getProfitForPrice(p);
                if (profN <= 0) return "Inviável";
                const reqQty = Math.ceil(originalTotalProfit / profN);
                return `${reqQty} unidades`;
            })],
            ['Impacto em Materiais e Insumos', ...allPrices.map((p, i) => {
                if (i === 0) return "-";
                const profN = getProfitForPrice(p);
                if (profN <= 0) return "N/A";
                const reqQty = Math.ceil(originalTotalProfit / profN);
                const impact = (reqQty - targetQuantity) * totalMaterialCost;
                return impact > 0 
                    ? `Gasto Extra: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(impact)}`
                    : `Economia: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(impact))}`;
            })]
        ];

        autoTable(pdf, {
            startY: currentY,
            head: scenarioHead,
            body: scenarioBody,
            theme: 'grid',
            headStyles: { fillColor: [45, 55, 72], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold', fillColor: [247, 250, 252] } }
        });

        currentY = (pdf as any).lastAutoTable.finalY + 15;

        // --- PRODUTOS DO CONJUNTO (SKU Mestre) ---
        if (calculationType === 'conjunto' && selectedProducts.length > 0) {
            pdf.setFontSize(14);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(30, 41, 59);
            pdf.text("3. Produtos do Conjunto", 15, currentY);
            currentY += 8;

            const conjuntoRows = selectedProducts.map(p => {
                const productItems = items.filter(it => it.productSku === p.sku);
                const subtotal = productItems.reduce((s, it) => s + it.totalCost, 0);
                return [
                    p.sku,
                    p.name,
                    `${productItems.length} insumo(s)`,
                    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(subtotal)
                ];
            });

            autoTable(pdf, {
                startY: currentY,
                head: [['SKU Mestre', 'Produto', 'Composição', 'Custo']],
                body: conjuntoRows,
                theme: 'striped',
                headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9 },
                columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
            });

            currentY = (pdf as any).lastAutoTable.finalY + 15;
        }

        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text("* Meta baseada em um volume de comparação de " + targetQuantity + " unidades.", 15, currentY);
        pdf.text("* Custo Direto inclui Materiais, Taxas, Impostos e Frete.", 15, currentY + 4);

        pdf.save(`${reportName || productName || 'Relatorio_Precificacao'}.pdf`);
    };


    return (
        <div ref={calculatorRef} className="space-y-4 pb-10 bg-[#F8FAFC] min-h-screen -m-6 p-6">
            {/* Header com Design Redesenhado */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100">
                        <Calculator size={28} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight">
                            Calculadora de Custos & Precificação
                        </h1>
                        <p className="text-gray-400 font-bold text-[10px] mt-0.5">
                            Controle seus gastos, analise margens e defina metas.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => {
                            loadHistory();
                            setIsHistoryModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] hover:bg-slate-200 transition-all"
                    >
                        <FileText size={16} />
                        Histórico
                    </button>
                    <button 
                        onClick={saveToHistory}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-5 py-2.5 ${editingId ? 'bg-emerald-600' : 'bg-blue-600'} text-white rounded-xl font-bold text-[11px] hover:opacity-90 transition-all shadow-lg disabled:opacity-50`}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {editingId ? 'Atualizar' : 'Salvar Cálculo'}
                    </button>
                    {editingId && (
                        <button 
                            onClick={() => {
                                setEditingId(null);
                                if (addToast) addToast("Modo de edição limpo. Novo salvamento criará um novo registro.", "info");
                            }}
                            className="flex items-center gap-2 px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] hover:bg-slate-200 transition-all border border-slate-200"
                            title="Desvincular do registro atual para salvar como novo"
                        >
                            Novo
                        </button>
                    )}
                    <button 
                        onClick={saveToPlanning}
                        disabled={isSavingPlanning}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 color-indigo-600 border border-indigo-100 rounded-xl font-bold text-[11px] hover:bg-indigo-100 transition-all shadow-sm disabled:opacity-50"
                        title="Exportar insumos para planejamento de compras"
                    >
                        {isSavingPlanning ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                        Salvar p/ Compras
                    </button>
                    <button 
                        onClick={generateImage}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#10B981] text-white rounded-xl font-bold text-[11px] hover:bg-[#059669] transition-all shadow-lg shadow-emerald-100"
                    >
                        <Camera size={16} />
                        Snapshot
                    </button>
                    <button 
                        onClick={generatePDF}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#1E293B] text-white rounded-xl font-bold text-[11px] hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                    >
                        <FileText size={16} />
                        PDF
                    </button>
                    {onUpdatePrices && selectedProducts.length > 0 && (
                        <button 
                            onClick={handleApplyPricing}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-[11px] hover:bg-orange-600 transition-all shadow-lg shadow-orange-100 animate-pulse"
                            title="Atualiza o custo e preço de venda nos produtos do estoque"
                        >
                            <DollarSign size={16} />
                            Aplicar no Estoque
                        </button>
                    )}
                </div>
            </div>

            {/* Identificação do Produto Final */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm space-y-6">
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl w-fit">
                    <button 
                        onClick={() => setCalculationType('individual')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${calculationType === 'individual' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                    >
                        🏠 Produto Individual
                    </button>
                    <button 
                        onClick={() => setCalculationType('conjunto')}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${calculationType === 'conjunto' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
                    >
                        📦 Conjunto / Kit
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                    <div className="sm:col-span-2 md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Produtos do Conjunto / Referência</label>
                        <div className="flex flex-wrap gap-2">
                             {selectedProducts.map((p, idx) => (
                                <div key={p.sku + idx} className={`flex items-center gap-2 p-2 px-3 rounded-xl border-2 transition-all group/item ${p.isVisible ? 'bg-blue-50/50 border-blue-100' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-blue-800 leading-none">{p.sku}</span>
                                            {!p.isVisible && <Info size={10} className="text-gray-400" title="Item Oculto do Cálculo" />}
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500 truncate max-w-[120px]">{p.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 ml-2 border-l border-blue-100 pl-2">
                                        <button 
                                            onClick={() => toggleProductVisibility(p.sku)} 
                                            className={`p-1 transition-colors ${p.isVisible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                                            title={p.isVisible ? "Ocultar do Cálculo" : "Mostrar no Cálculo"}
                                        >
                                            {p.isVisible ? <Calculator size={14} /> : <AlertCircle size={14} />}
                                        </button>
                                        <button 
                                            onClick={() => duplicateProduct(p.sku)} 
                                            className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                                            title="Duplicar Composição"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        <button 
                                            onClick={() => removeProductFromSet(p.sku)} 
                                            className="p-1 text-red-300 hover:text-red-500 transition-colors"
                                            title="Remover do Conjunto"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                             ))}
                             <button 
                                onClick={() => { setModalMode('main'); setIsProductModalOpen(true); }}
                                className="p-3 bg-blue-50 text-blue-600 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                                title="Adicionar Produto"
                            >
                                <Plus size={16} />
                                <span className="text-[10px] font-black uppercase">Adicionar</span>
                            </button>
                        </div>
                    </div>
                    <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Nome do Projeto/Relatório</label>
                        <input 
                            type="text" 
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            placeholder="Ex: Lançamento Verão..."
                            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Categoria / Segmento</label>
                        <input 
                            type="text" 
                            value={calculationCategory}
                            onChange={(e) => setCalculationCategory(e.target.value)}
                            placeholder="Ex: Premium, Promocional..."
                            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-wider flex items-center gap-1">
                            SKUs Adicionais
                            <Info size={10} className="text-blue-300" title="Estes SKUs compartilharão o mesmo custo final e histórico no PDF." />
                        </label>
                        <input 
                            type="text" 
                            value={relatedSkus.join(', ')}
                            onChange={(e) => setRelatedSkus(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            placeholder="SKU2, SKU3..."
                            className="w-full bg-blue-50/30 border border-blue-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-8">
                    {/* Card de Composição de Custos */}
                    <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                <ShoppingCart className="text-blue-500" size={20} /> Composição de Custos (Materiais)
                            </h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setModalMode('composition');
                                        setIsProductModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all border border-blue-100"
                                >
                                    + Matéria Prima
                                </button>
                                <button 
                                    onClick={handleAddManualItem}
                                    className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:bg-slate-100 transition-all border border-slate-100"
                                >
                                    + Manual
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left bg-slate-50/80 rounded-t-xl">
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-tl-xl border-b border-gray-100">Item / Insumo</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Compro por</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Preço Base (Estoque)</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100">Qtd. Usada</th>
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-gray-100 text-right">Valor Usado</th>
                                        <th className="py-3 px-4 rounded-tr-xl border-b border-gray-100"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(() => {
                                        const groups = new Map<string, MaterialItem[]>();
                                        items.forEach(it => {
                                            const key = it.productSku || 'global';
                                            if (!groups.has(key)) groups.set(key, []);
                                            groups.get(key)!.push(it);
                                        });

                                        return Array.from(groups.entries()).map(([sku, groupItems]) => {
                                            const product = selectedProducts.find(p => p.sku === sku);
                                            const isVisible = product ? product.isVisible : true;
                                            
                                            return (
                                                <React.Fragment key={sku}>
                                                    {calculationType === 'conjunto' && (
                                                        <tr className="bg-slate-50/50">
                                                            <td colSpan={6} className="py-2 px-4 border-l-4 border-blue-500">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">
                                                                        {sku === 'global' ? '📦 Itens Adicionais / Manuais' : `🛠️ Composição: ${sku}`}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                                        Subtotal: R$ {groupItems.reduce((s, i) => s + i.totalCost, 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {groupItems.map((item) => (
                                                        <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors ${!isVisible ? 'opacity-30' : ''}`}>
                                                            <td className="py-2 pr-3 relative">
                                                                <input 
                                                                    type="text" 
                                                                    value={item.name}
                                                                    onChange={(e) => {
                                                                        updateItem(item.id, 'name', e.target.value);
                                                                        setSearchingItemId(item.id);
                                                                    }}
                                                                    onFocus={() => setSearchingItemId(item.id)}
                                                                    onBlur={() => {
                                                                        setTimeout(() => setSearchingItemId(null), 200);
                                                                    }}
                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                                                    placeholder="Ex: Tecido"
                                                                />
                                                                {searchingItemId === item.id && item.name.length > 1 && (
                                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                                                                        {allAvailableProducts
                                                                            .filter(p => p.kind !== 'PRODUTO')
                                                                            .filter(p => 
                                                                                p.name.toLowerCase().includes(item.name.toLowerCase()) || 
                                                                                p.code.toLowerCase().includes(item.name.toLowerCase())
                                                                            )
                                                                            .slice(0, 8)
                                                                            .map(p => (
                                                                                <button 
                                                                                    key={p.id}
                                                                                    onMouseDown={(e) => {
                                                                                        e.preventDefault();
                                                                                        updateItem(item.id, 'name', p.name);
                                                                                        updateItem(item.id, 'basePrice', p.cost_price || 0);
                                                                                        updateItem(item.id, 'unit', p.unit || 'un');
                                                                                        setSearchingItemId(null);
                                                                                    }}
                                                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-all flex justify-between items-center"
                                                                                >
                                                                                    <div className="flex-1">
                                                                                        <p className="text-[10px] font-black text-slate-800 uppercase leading-none mb-1">{p.name}</p>
                                                                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{p.code}</p>
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-[10px] font-black text-blue-600">R$ {p.cost_price?.toFixed(2)}</p>
                                                                                        <p className="text-[8px] font-bold text-gray-300 uppercase">{p.unit}</p>
                                                                                    </div>
                                                                                </button>
                                                                            ))
                                                                        }
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="py-2 pr-3">
                                                                <div className="relative group/sel">
                                                                    <select 
                                                                        value={item.buyUnit}
                                                                        onChange={(e) => updateItem(item.id, 'buyUnit', e.target.value)}
                                                                        className="w-full bg-slate-50 border border-transparent group-hover/sel:border-blue-100 rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-700 uppercase focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all appearance-none cursor-pointer"
                                                                    >
                                                                        <option>Quilo</option>
                                                                        <option>Metro</option>
                                                                        <option>Unidade</option>
                                                                        <option>Valor Fixo</option>
                                                                    </select>
                                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-blue-500 transition-colors">
                                                                        <ChevronDown size={12} strokeWidth={3} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 pr-3">
                                                                <input 
                                                                    type="number" 
                                                                    value={item.basePrice}
                                                                    onChange={(e) => updateItem(item.id, 'basePrice', parseFloat(e.target.value) || 0)}
                                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                                                />
                                                            </td>
                                                            <td className="py-2 pr-3">
                                                                <div className="flex items-center bg-slate-50 border border-transparent hover:border-blue-100 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
                                                                    <input 
                                                                        type="number" 
                                                                        value={item.quantityUsed}
                                                                        onChange={(e) => updateItem(item.id, 'quantityUsed', Number(e.target.value))}
                                                                        className="w-16 bg-transparent border-none px-2 py-1.5 text-xs font-black text-slate-700 focus:ring-0"
                                                                    />
                                                                    <div className="w-px h-4 bg-gray-200" />
                                                                    <select 
                                                                        value={item.unit}
                                                                        onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                                        className="bg-transparent border-none text-[10px] font-black text-blue-600 uppercase pl-1.5 pr-2 py-1.5 focus:ring-0 cursor-pointer hover:bg-blue-50/50 transition-colors appearance-none"
                                                                    >
                                                                        {item.buyUnit === 'Metro' ? (
                                                                            <>
                                                                                <option value="m">m</option>
                                                                                <option value="cm">cm</option>
                                                                                <option value="mm">mm</option>
                                                                            </>
                                                                        ) : item.buyUnit === 'Quilo' ? (
                                                                            <>
                                                                                <option value="kg">kg</option>
                                                                                <option value="g">g</option>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <option value="un">un</option>
                                                                                <option value="par">par</option>
                                                                                <option value="duzia">dúz</option>
                                                                                <option value="kit">kit</option>
                                                                            </>
                                                                        )}
                                                                    </select>
                                                                </div>
                                                            </td>
                                                            <td className="py-2 text-right">
                                                                <div className="bg-slate-50 border border-gray-100 rounded-lg px-3 py-1.5 text-xs font-black text-gray-500">
                                                                    R$ {item.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 pl-2">
                                                                <button 
                                                                    onClick={() => removeItem(item.id)}
                                                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                            {items.length === 0 && (
                                <div className="py-10 text-center">
                                    <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">Nenhum item na composição</p>
                                </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end items-center gap-3">
                                <span className="text-xs font-black text-slate-800">Custo Total dos Materiais:</span>
                                <span className="text-xl font-black text-slate-800">R$ {totalMaterialCost.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card Unificado: Venda e Comparação */}
                    <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-6">
                                    <span className="text-emerald-500 font-black">$</span> Venda e Plataforma
                                </h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Valor Venda</label>
                                            <input 
                                                type="number" 
                                                value={sellingPrice}
                                                onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Quantidade</label>
                                            <input 
                                                type="number" 
                                                value={targetQuantity}
                                                onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 0)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-blue-500 uppercase tracking-wider">Exemplo de Faturamento Desejado (Simulação)</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">R$</span>
                                            <input 
                                                type="number" 
                                                value={targetRevenue || ''}
                                                onChange={(e) => setTargetRevenue(parseFloat(e.target.value) || 0)}
                                                placeholder="Ex: 10000.00"
                                                className="w-full bg-blue-50/30 border border-blue-100 rounded-xl pl-12 pr-4 py-3 text-lg font-black text-blue-700 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                            />
                                        </div>
                                        <p className="text-[9px] font-medium text-gray-400 italic mt-1">
                                            Preencha para saber quantas unidades vender para atingir este faturamento.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Imposto (%)</label>
                                            <input 
                                                type="number" 
                                                value={taxPercent}
                                                onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                                                placeholder="Ex: 6"
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Frete/Envio (Fixo)</label>
                                            <input 
                                                type="number" 
                                                value={shippingCost}
                                                onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                                placeholder="Ex: 15.00"
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Taxa Plataforma (%)</label>
                                            <input 
                                                type="number" 
                                                value={platformFeePercent}
                                                onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Outros Custos (Fixo)</label>
                                            <input 
                                                type="number" 
                                                value={otherCosts}
                                                onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                                                placeholder="Ex: Embalagem"
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-l border-gray-50 pl-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Target className="text-purple-500" size={20} /> Comparar Preços
                                    </h3>
                                    <button 
                                        onClick={() => setComparativePrices([...comparativePrices, 0])}
                                        className="px-3 py-1 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase hover:bg-purple-100 transition-colors"
                                    >
                                        + Adicionar
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {comparativePrices.map((price, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <span className="text-[10px] font-black text-gray-300 w-3">{idx + 1}.</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">R$</span>
                                                <input 
                                                    type="number" 
                                                    value={price === 0 ? '' : price}
                                                    onChange={(e) => {
                                                        const newPrices = [...comparativePrices];
                                                        newPrices[idx] = parseFloat(e.target.value) || 0;
                                                        setComparativePrices(newPrices);
                                                    }}
                                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border-none rounded-lg text-xs font-black focus:ring-2 focus:ring-purple-500"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => setComparativePrices(comparativePrices.filter((_, i) => i !== idx))}
                                                className="p-1.5 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Sticky */}
                <div className="lg:col-span-4 space-y-4 sticky top-6 self-start">
                    <div className="bg-[#1E293B] rounded-[32px] p-7 text-white shadow-2xl overflow-hidden">
                        <div className="flex items-center gap-2.5 mb-6">
                            <TrendingUp className="text-emerald-400" size={22} />
                            <h3 className="text-lg font-black tracking-tight">Resumo da Venda</h3>
                        </div>

                        <div className="space-y-5">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-400">Valor Unitário:</span>
                                <span className="text-base">R$ {sellingPrice.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold text-orange-400">
                                <span className="text-slate-400">Custos de Produção:</span>
                                <span>- R$ {totalMaterialCost.toFixed(2)}</span>
                            </div>
                            
                            {calculationType === 'conjunto' && selectedProducts.some(p => p.isVisible) && (
                                <div className="pl-3 py-2 border-l border-white/10 space-y-2 mb-2">
                                    {selectedProducts.filter(p => p.isVisible).map(p => {
                                        const skuCost = items.filter(it => it.productSku === p.sku).reduce((s, i) => s + i.totalCost, 0);
                                        return (
                                            <div key={p.sku} className="flex justify-between items-center text-[9px] font-bold text-slate-500">
                                                <span>{p.sku}:</span>
                                                <span>R$ {skuCost.toFixed(2)}</span>
                                            </div>
                                        );
                                    })}
                                    {items.filter(it => it.productSku === 'global' || !it.productSku).length > 0 && (
                                        <div className="flex justify-between items-center text-[9px] font-bold text-slate-500 italic">
                                            <span>Adicionais:</span>
                                            <span>R$ {items.filter(it => it.productSku === 'global' || !it.productSku).reduce((s, i) => s + i.totalCost, 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-between items-center text-xs font-bold text-orange-400 pb-5 border-b border-white/5">
                                <span className="text-slate-400">Taxa Plataforma ({platformFeePercent}%):</span>
                                <span>- R$ {platformFeeValue.toFixed(2)}</span>
                            </div>

                            <div className="bg-slate-900/50 rounded-[24px] p-6 border border-white/5 space-y-4">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-slate-500 mt-0 mb-1.5 tracking-wider">Lucro por Unidade</p>
                                        <p className="text-2xl font-black text-emerald-400">R$ {profit.toFixed(2)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Margem</p>
                                        <p className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black">{profitMargin.toFixed(2)}%</p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-white/5">
                                    <p className="text-[9px] font-black uppercase text-slate-500 mb-1.5 tracking-wider">Lucro Total ({targetQuantity} unid.)</p>
                                    <p className="text-xl sm:text-3xl font-black text-emerald-400">R$ {originalTotalProfit.toFixed(2)}</p>
                                </div>
                            </div>

                            <div className="space-y-3 mt-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <Target className="text-purple-400" size={18} />
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cenários para atingir a Meta</h4>
                                </div>

                                {scenarios.slice(0, 3).map((scenario, idx) => (
                                    <div key={idx} className="bg-purple-950/30 border border-purple-500/20 rounded-[24px] p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <p className="text-xs font-black text-white">Cenário {idx + 1}: R$ {scenario.price.toFixed(2)}</p>
                                            <p className={`text-[10px] font-black ${scenario.profitPerUnit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                R$ {scenario.profitPerUnit.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="pt-3 border-t border-white/5">
                                            <p className="text-[9px] font-bold text-slate-400 italic mb-0.5">Volume necessário:</p>
                                            <p className="text-xl font-black text-white">{scenario.requiredQty} unidades</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`p-4 rounded-[24px] flex items-center gap-3 border-2 mt-6 ${
                            profitMargin > 15 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-orange-50 border-orange-100 text-orange-800'
                        }`}>
                            {profitMargin > 15 ? <TrendingUp size={20} /> : <AlertCircle size={20} />}
                            <p className="text-[10px] font-black uppercase tracking-tight">
                                {profitMargin > 15 ? 'Operação saudável!' : 'Atenção às margens!'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Busca */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-10 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">
                                    {modalMode === 'main' ? 'Selecionar Produto' : 'Selecionar Material'}
                                </h2>
                                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Busque um item para carregar custos</p>
                            </div>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-4 text-gray-400 hover:text-red-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-10 pb-4">
                            <div className="relative">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar..."
                                    className="w-full pl-16 pr-4 py-5 bg-slate-100 border-none rounded-[20px] font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 pt-0 space-y-3">
                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-20">
                                    <Package size={64} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-400 font-bold uppercase text-xs">Nenhum item encontrado</p>
                                </div>
                            ) : (
                                filteredProducts.map((product) => (
                                    <button 
                                        key={product.id}
                                        onClick={() => modalMode === 'main' ? handleSelectProduct(product) : handleAddItemToComposition(product)}
                                        className="w-full flex items-center justify-between p-6 bg-white hover:bg-blue-50 rounded-[28px] border border-gray-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                                <Package size={28} />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-slate-800 uppercase text-sm">{product.name}</p>
                                                <p className="text-[10px] font-mono font-bold text-gray-400 uppercase mt-1 tracking-wider">{product.code}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Custo</p>
                                                <p className="text-sm font-black text-blue-600">R$ {product.cost_price?.toFixed(2) || '0.00'}</p>
                                            </div>
                                            <ChevronRight size={24} className="text-gray-300 group-hover:text-blue-600 transition-all" />
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Histórico */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[110] p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                                    <FileText className="text-blue-500" /> Histórico de Cálculos
                                </h2>
                                <p className="text-xs font-bold text-gray-400 uppercase mt-1">Recupere simulações salvas anteriormente</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="p-4 text-gray-400 hover:text-red-500 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-4">
                            {isLoadingHistory ? (
                                <div className="text-center py-20">
                                    <Loader2 size={48} className="mx-auto text-blue-500 animate-spin mb-4" />
                                    <p className="text-gray-400 font-bold uppercase text-xs">Carregando histórico...</p>
                                </div>
                            ) : history.length === 0 ? (
                                <div className="text-center py-20">
                                    <FileText size={64} className="mx-auto text-gray-100 mb-4" />
                                    <p className="text-gray-400 font-bold uppercase text-xs">Nenhum cálculo salvo ainda</p>
                                </div>
                            ) : (
                                history.map((calc) => (
                                    <div 
                                        key={calc.id}
                                        className="w-full flex items-center justify-between p-6 bg-white hover:bg-slate-50 rounded-[28px] border border-gray-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="h-16 w-16 bg-blue-50 rounded-2xl flex flex-col items-center justify-center text-blue-600">
                                                <span className="text-[10px] font-black uppercase text-blue-400 leading-none mb-1">Margem</span>
                                                <span className="text-sm font-black">{calc.margin.toFixed(1)}%</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-slate-800 uppercase text-sm">{calc.product_name}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">{calc.product_sku}</span>
                                                    {stockItems.find(s => s.code === calc.product_sku)?.category && (
                                                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                            {stockItems.find(s => s.code === calc.product_sku)?.category}
                                                        </span>
                                                    )}
                                                    {calc.related_skus && calc.related_skus.length > 0 && (
                                                        <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                            + {calc.related_skus.length} SKUs vinculados
                                                        </span>
                                                    )}
                                                    <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                                                    <span className="text-[10px] font-bold text-gray-400">{new Date(calc.created_at).toLocaleDateString()}</span>
                                                </div>
                                                {(calc.related_skus?.length > 0) && (
                                                    <p className="text-[9px] text-gray-400 mt-1 max-w-xs truncate">
                                                        Vínculos: {calc.related_skus.join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Venda</p>
                                                <p className="text-sm font-black text-slate-800">R$ {calc.selling_price.toFixed(2)}</p>
                                            </div>
                                            <div className="text-right border-l pl-8">
                                                <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Lucro</p>
                                                <p className="text-sm font-black text-emerald-600">R$ {calc.profit.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => loadFromHistory(calc)}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                                                >
                                                    Carregar
                                                </button>
                                                <button 
                                                    onClick={() => deleteCalculation(calc.id)}
                                                    className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
