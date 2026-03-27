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
}

interface CalculadoraPageProps {
    stockItems: StockItem[];
    produtosCombinados: ProdutoCombinado[];
}

export default function CalculadoraPage({ stockItems, produtosCombinados }: CalculadoraPageProps) {
    const [items, setItems] = useState<MaterialItem[]>([]);
    const [sellingPrice, setSellingPrice] = useState(120.00);
    const [platformFeePercent, setPlatformFeePercent] = useState(15);
    const [shippingCost, setShippingCost] = useState(15.00);
    const [taxPercent, setTaxPercent] = useState(6);
    const [otherCosts, setOtherCosts] = useState(0);
    
    // Novo: Identificação do Produto
    const [productSku, setProductSku] = useState('');
    const [productName, setProductName] = useState('');
    
    // Novo: Histórico
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // Simulação Comparativa
    const [targetQuantity, setTargetQuantity] = useState(10); 
    const [comparativePrices, setComparativePrices] = useState<number[]>([150, 90]);
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'main' | 'composition'>('main');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchingItemId, setSearchingItemId] = useState<string | null>(null);

    // Todos os itens de estoque disponíveis para busca
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

    const handleSelectProduct = (product: StockItem) => {
        const bom = produtosCombinados.find(b => b.productSku === product.code);
        
        let newItems: MaterialItem[] = [];
        
        if (bom) {
            newItems = bom.items.map(bomItem => {
                const stockItem = stockItems.find(si => si.code === bomItem.stockItemCode);
                const price = stockItem?.cost_price || 0;
                return {
                    id: Math.random().toString(36).substr(2, 9),
                    name: stockItem?.name || bomItem.stockItemCode,
                    quantityUsed: bomItem.qty_per_pack,
                    unit: stockItem?.unit || 'un',
                    buyUnit: 'Unidade',
                    basePrice: price,
                    totalCost: bomItem.qty_per_pack * price
                };
            });
        } else {
            // Se não tiver BOM, deixa a lista vazia ao invés de adicionar o próprio produto
            newItems = [];
        }

        setItems(newItems);
        if (product.sell_price) setSellingPrice(product.sell_price);
        setProductSku(product.code);
        setProductName(product.name);
        setIsProductModalOpen(false);
        setSearchTerm('');
    };

    const fetchHistory = async () => {
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

    const saveCalculation = async () => {
        if (!productSku || items.length === 0) {
            alert('Preencha o SKU e adicione ao menos um item.');
            return;
        }
        setIsSaving(true);
        try {
            const calculation = {
                product_sku: productSku,
                product_name: productName,
                items: items,
                selling_price: sellingPrice,
                platform_fee_percent: platformFeePercent,
                shipping_cost: shippingCost,
                tax_percent: taxPercent,
                other_costs: otherCosts,
                total_material_cost: totalMaterialCost,
                profit: profit,
                margin: profitMargin,
                created_at: new Date().toISOString()
            };
            const { error } = await dbClient.from('cost_calculations').insert(calculation);
            if (error) throw error;
            alert('Cálculo salvo com sucesso!');
            fetchHistory();
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const loadFromHistory = (calc: any) => {
        setProductSku(calc.product_sku);
        setProductName(calc.product_name);
        setItems(calc.items);
        setSellingPrice(calc.selling_price);
        setPlatformFeePercent(calc.platform_fee_percent);
        setShippingCost(calc.shipping_cost || 0);
        setTaxPercent(calc.tax_percent || 0);
        setOtherCosts(calc.other_costs || 0);
        setIsHistoryModalOpen(false);
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

    const totalMaterialCost = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
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
        const doc = new jsPDF();
        let currentY = 20;

        // Header Moderno
        doc.setFontSize(22);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text('Relatório de Precificação', 14, currentY);

        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`${productSku || 'S/ SKU'} - ${productName || 'Produto sem Nome'}`, 14, currentY + 8);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, currentY + 14);

        currentY += 25;

        // Tabela de Materiais Compacta
        autoTable(doc, {
            startY: currentY,
            head: [['Item / Insumo', 'Qtd', 'Un.', 'Preço Base', 'Custo Total']],
            body: items.map(i => [
                i.name, 
                i.quantityUsed, 
                i.unit, 
                `R$ ${i.basePrice.toFixed(2)}`, 
                `R$ ${i.totalCost.toFixed(2)}`
            ]),
            foot: [['Total de Materiais', '', '', '', `R$ ${totalMaterialCost.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246], fontSize: 9, fontStyle: 'bold' },
            footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' },
            styles: { fontSize: 8 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Título de Cenários Comparativos
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text('Cenários de Faturamento e Lucro', 14, currentY);
        currentY += 10;

        // Preparar todos os cenários (Atual + Comparativos)
        const allScenarios = [
            { price: sellingPrice, label: 'Cenário Atual (Venda)' },
            ...comparativePrices.filter(p => !isNaN(p.value) && p.value > 0).map((p, idx) => ({ 
                price: p.value, 
                label: `Cenário Comparativo ${idx + 1}` 
            }))
        ];

        let blockWidth = 60;
        let blockHeight = 42;
        let margin = 8;
        let startX = 14;

        allScenarios.forEach((scenario, index) => {
            const row = Math.floor(index / 3);
            const col = index % 3;
            const x = startX + (col * (blockWidth + margin));
            const y = currentY + (row * (blockHeight + margin));

            // Verificar quebra de página se necessário
            if (y + blockHeight > 280) {
                // Simplificação: apenas para até 9 cenários por página
            }

            // Cálculos para o cenário específico
            const sPrice = scenario.price;
            const sPlatformFee = (sPrice * platformFeePercent) / 100;
            const sTaxValue = (sPrice * taxPercent) / 100;
            const sProfit = sPrice - totalMaterialCost - sPlatformFee - sTaxValue - shippingCost - otherCosts;
            const sMargin = sPrice > 0 ? (sProfit / sPrice) * 100 : 0;

            // Desenhar Card
            doc.setDrawColor(241, 245, 249);
            doc.setFillColor(252, 252, 252);
            doc.roundedRect(x, y, blockWidth, blockHeight, 3, 3, 'FD');

            // Conteúdo do Card
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(scenario.label.toUpperCase(), x + 5, y + 7);

            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.setFont(undefined, 'bold');
            doc.text(`R$ ${sPrice.toFixed(2)}`, x + 5, y + 17);
            doc.setFont(undefined, 'normal');

            doc.setFontSize(8);
            doc.setTextColor(100);
            doc.text(`Custo Dir.: R$ ${totalDirectCost.toFixed(2)}`, x + 5, y + 25);
            
            // Destaque de Lucro
            const isPositive = sProfit >= 0;
            doc.setTextColor(isPositive ? 16 : 239, isPositive ? 185 : 68, isPositive ? 129 : 68);
            doc.setFont(undefined, 'bold');
            doc.text(`LUCRO: R$ ${sProfit.toFixed(2)}`, x + 5, y + 33);
            doc.text(`MARGEM: ${sMargin.toFixed(1)}%`, x + 5, y + 39);
            doc.setFont(undefined, 'normal');
        });

        doc.save(`Precificacao_${productSku || 'Geral'}.pdf`);
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
                            fetchHistory();
                            setIsHistoryModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-[11px] hover:bg-slate-200 transition-all"
                    >
                        <FileText size={16} />
                        Histórico
                    </button>
                    <button 
                        onClick={saveCalculation}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-[11px] hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Salvar Cálculo
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
                </div>
            </div>

            {/* Identificação do Produto Final */}
            <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">SKU Produto Final</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={productSku}
                                onChange={(e) => setProductSku(e.target.value)}
                                placeholder="Digite ou busque..."
                                className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500"
                            />
                            <button 
                                onClick={() => {
                                    setModalMode('main');
                                    setIsProductModalOpen(true);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white rounded-lg border border-gray-100 text-blue-500 hover:bg-blue-50 transition-all shadow-sm"
                            >
                                <Search size={16} />
                            </button>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Nome Comercial do Produto</label>
                        <input 
                            type="text" 
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="Nome que aparecerá no relatório..."
                            className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-black focus:ring-2 focus:ring-blue-500"
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
                                    {items.map((item) => (
                                        <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
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
                                                        // Pequeno delay para permitir o clique no botão antes de fechar
                                                        setTimeout(() => setSearchingItemId(null), 200);
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Ex: Tecido"
                                                />
                                                {searchingItemId === item.id && item.name.length > 1 && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto">
                                                        {allAvailableProducts
                                                            .filter(p => p.kind !== 'PRODUTO') // Apenas insumos/matéria prima na tabela
                                                            .filter(p => 
                                                                p.name.toLowerCase().includes(item.name.toLowerCase()) || 
                                                                p.code.toLowerCase().includes(item.name.toLowerCase())
                                                            )
                                                            .slice(0, 8)
                                                            .map(p => (
                                                                <button 
                                                                    key={p.id}
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault(); // Evita o onBlur de fechar antes do clique
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
                                                        {allAvailableProducts.filter(p => 
                                                            p.name.toLowerCase().includes(item.name.toLowerCase()) || 
                                                            p.code.toLowerCase().includes(item.name.toLowerCase())
                                                        ).length === 0 && (
                                                            <div className="p-4 text-center">
                                                                <p className="text-[10px] font-bold text-gray-300 uppercase italic">Nenhum item encontrado</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <div className="relative group">
                                                    <select 
                                                        value={item.buyUnit}
                                                        onChange={(e) => updateItem(item.id, 'buyUnit', e.target.value)}
                                                        className="w-full bg-slate-50 border border-transparent group-hover:border-blue-100 rounded-lg px-3 py-1.5 text-[11px] font-black text-slate-700 uppercase focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all appearance-none cursor-pointer"
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
                                    <div className="grid grid-cols-2 gap-3">
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
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Qtd.</label>
                                            <input 
                                                type="number" 
                                                value={targetQuantity}
                                                onChange={(e) => setTargetQuantity(parseInt(e.target.value) || 0)}
                                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Taxa da Plataforma (%)</label>
                                        <input 
                                            type="number" 
                                            value={platformFeePercent}
                                            onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-base font-black focus:ring-2 focus:ring-blue-500"
                                        />
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
                                    <p className="text-3xl font-black text-emerald-400">R$ {originalTotalProfit.toFixed(2)}</p>
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
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">{calc.product_sku}</span>
                                                    <span className="h-1 w-1 rounded-full bg-gray-300"></span>
                                                    <span className="text-[10px] font-bold text-gray-400">{new Date(calc.created_at).toLocaleDateString()}</span>
                                                </div>
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
                                            <button 
                                                onClick={() => loadFromHistory(calc)}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                                            >
                                                Carregar
                                            </button>
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
