
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
    Save
} from 'lucide-react';
import { StockItem, ProdutoCombinado } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MaterialItem {
    id: string;
    name: string;
    quantityUsed: number;
    unit: string;
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
    
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Produtos que têm receita configurada
    const productsWithBom = useMemo(() => {
        const bomSkus = new Set(produtosCombinados.map(b => b.productSku));
        return stockItems.filter(i => i.kind === 'PRODUTO' && bomSkus.has(i.code));
    }, [stockItems, produtosCombinados]);

    const filteredProducts = useMemo(() => {
        return productsWithBom.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [productsWithBom, searchTerm]);

    const handleSelectProduct = (product: StockItem) => {
        const bom = produtosCombinados.find(b => b.productSku === product.code);
        if (!bom) return;

        const newItems: MaterialItem[] = bom.items.map(bomItem => {
            const stockItem = stockItems.find(si => si.code === bomItem.stockItemCode);
            const price = stockItem?.cost_price || 0;
            return {
                id: Math.random().toString(36).substr(2, 9),
                name: stockItem?.name || bomItem.stockItemCode,
                quantityUsed: bomItem.qty_per_pack,
                unit: stockItem?.unit || 'un',
                basePrice: price,
                totalCost: bomItem.qty_per_pack * price
            };
        });

        setItems(newItems);
        if (product.sell_price) setSellingPrice(product.sell_price);
        setIsProductModalOpen(false);
    };

    const addMaterial = () => {
        const newItem: MaterialItem = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Novo Item',
            quantityUsed: 1,
            unit: 'un',
            basePrice: 0,
            totalCost: 0
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: keyof MaterialItem, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updatedItem = { ...item, [field]: value };
                if (field === 'quantityUsed' || field === 'basePrice') {
                    updatedItem.totalCost = updatedItem.quantityUsed * updatedItem.basePrice;
                }
                return updatedItem;
            }
            return item;
        }));
    };

    // Cálculos Financeiros
    const totalMaterialCost = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
    const platformFeeValue = useMemo(() => (sellingPrice * platformFeePercent) / 100, [sellingPrice, platformFeePercent]);
    const taxValue = useMemo(() => (sellingPrice * taxPercent) / 100, [sellingPrice, taxPercent]);
    
    const totalDirectCost = useMemo(() => 
        totalMaterialCost + platformFeeValue + shippingCost + taxValue + otherCosts,
    [totalMaterialCost, platformFeeValue, shippingCost, taxValue, otherCosts]);

    const profit = useMemo(() => sellingPrice - totalDirectCost, [sellingPrice, totalDirectCost]);
    const profitMargin = useMemo(() => (sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0), [profit, sellingPrice]);
    const markup = useMemo(() => (totalDirectCost > 0 ? (sellingPrice / totalDirectCost) : 0), [sellingPrice, totalDirectCost]);

    const generatePDF = () => {
        const doc = new jsPDF();
        const startY = 20;

        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185);
        doc.text('Relatório de Precificação', 14, startY);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, startY + 8);

        autoTable(doc, {
            startY: startY + 20,
            head: [['Item de Material', 'Qtd', 'Unidade', 'Custo Unit.', 'Total']],
            body: items.map(i => [i.name, i.quantityUsed, i.unit, `R$ ${i.basePrice.toFixed(2)}`, `R$ ${i.totalCost.toFixed(2)}`]),
            foot: [['Total Materiais', '', '', '', `R$ ${totalMaterialCost.toFixed(2)}`]],
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        autoTable(doc, {
            startY: finalY,
            head: [['Resumo Financeiro', 'Valor']],
            body: [
                ['Preço de Venda', `R$ ${sellingPrice.toFixed(2)}`],
                ['Custo de Materiais', `R$ ${totalMaterialCost.toFixed(2)}`],
                ['Taxa Plataforma', `R$ ${platformFeeValue.toFixed(2)} (${platformFeePercent}%)`],
                ['Frete/Envio', `R$ ${shippingCost.toFixed(2)}`],
                ['Impostos', `R$ ${taxValue.toFixed(2)} (${taxPercent}%)`],
                ['Outros Custos', `R$ ${otherCosts.toFixed(2)}`],
                ['Custo Direto Total', `R$ ${totalDirectCost.toFixed(2)}`],
                ['Lucro Líquido', `R$ ${profit.toFixed(2)}`],
                ['Margem de Lucro', `${profitMargin.toFixed(2)}%`],
                ['Markup', `${markup.toFixed(2)}x`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] }
        });

        doc.save('Precificacao_EcomFlow.pdf');
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header com Design Premium */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                        <Calculator className="text-blue-600" size={32} />
                        Calculadora de Custos & Margens
                    </h1>
                    <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                        Simulação e Precificação Integrada ao Estoque
                    </p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsProductModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        <Package size={18} />
                        Puxar do Estoque (BOM)
                    </button>
                    <button 
                        onClick={generatePDF}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-slate-200"
                    >
                        <FileText size={18} />
                        Exportar PDF
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coluna de Materiais */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl min-h-[500px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                <Plus className="text-blue-500" size={20} /> Composição do Produto
                            </h3>
                            <button 
                                onClick={addMaterial}
                                className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                                title="Adicionar material manual"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                <Package size={64} className="opacity-20 mb-4" />
                                <p className="font-black uppercase text-sm">Nenhum material adicionado</p>
                                <p className="text-xs">Use o botão "Puxar do Estoque" ou adicione manualmente.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    <div className="col-span-1">Remover</div>
                                    <div className="col-span-4">Nome do Material</div>
                                    <div className="col-span-2">Quantidade</div>
                                    <div className="col-span-2">Unidade</div>
                                    <div className="col-span-3 text-right">Custo Unitário (R$)</div>
                                </div>
                                {items.map((item) => (
                                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100 group transition-all hover:border-blue-200">
                                        <div className="col-span-1 flex justify-center">
                                            <button 
                                                onClick={() => removeItem(item.id)}
                                                className="p-2 text-gray-300 hover:text-red-600 transition-all"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                        <div className="col-span-4">
                                            <input 
                                                type="text" 
                                                value={item.name}
                                                onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                                className="w-full bg-white border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input 
                                                type="number" 
                                                value={item.quantityUsed}
                                                onChange={(e) => updateItem(item.id, 'quantityUsed', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <input 
                                                type="text" 
                                                value={item.unit}
                                                onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                                className="w-full bg-white border-gray-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase text-center focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <div className="relative">
                                                <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={item.basePrice}
                                                    onChange={(e) => updateItem(item.id, 'basePrice', parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 pr-4 py-2 bg-white border-gray-200 rounded-xl text-sm font-black text-right focus:ring-blue-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna de Precificação e Resultados */}
                <div className="space-y-6">
                    {/* Configurações Financeiras */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-6 flex items-center gap-2">
                            <Target className="text-blue-500" size={20} /> Parâmetros de Venda
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço de Venda (R$)</label>
                                <div className="relative mt-1">
                                    <DollarSign size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" />
                                    <input 
                                        type="number" 
                                        value={sellingPrice}
                                        onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Taxa Plafatorma (%)</label>
                                    <div className="relative mt-1">
                                        <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="number" 
                                            value={platformFeePercent}
                                            onChange={(e) => setPlatformFeePercent(parseFloat(e.target.value) || 0)}
                                            className="w-full p-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Impostos (%)</label>
                                    <div className="relative mt-1">
                                        <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="number" 
                                            value={taxPercent}
                                            onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                                            className="w-full p-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Custo Frete (R$)</label>
                                    <input 
                                        type="number" 
                                        value={shippingCost}
                                        onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                        className="w-full mt-1 p-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Outros Fixo (R$)</label>
                                    <input 
                                        type="number" 
                                        value={otherCosts}
                                        onChange={(e) => setOtherCosts(parseFloat(e.target.value) || 0)}
                                        className="w-full mt-1 p-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resultados Finais */}
                    <div className="bg-slate-900 p-8 rounded-[40px] shadow-2xl text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <TrendingUp size={120} />
                        </div>
                        
                        <div className="relative z-10">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[4px] mb-8">Resultado Líquido</p>
                            
                            <div className="mb-8">
                                <p className="text-sm font-bold text-gray-400 mb-1">Lucro por Venda</p>
                                <p className={`text-6xl font-black ${profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    R$ {profit.toFixed(2)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/10">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Margem Líquida</p>
                                    <p className="text-2xl font-black">{profitMargin.toFixed(1)}%</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CMV Total</p>
                                    <p className="text-2xl font-black text-blue-400">R$ {totalMaterialCost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Markup</p>
                                    <p className="text-2xl font-black">{markup.toFixed(2)}x</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Break Even</p>
                                    <p className="text-2xl font-medium text-orange-400">R$ {totalDirectCost.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Alerta de Viabilidade */}
                    <div className={`p-4 rounded-2xl flex items-center gap-4 border ${
                        profitMargin > 30 ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 
                        profitMargin > 15 ? 'bg-blue-50 border-blue-100 text-blue-800' : 
                        profitMargin > 0 ? 'bg-orange-50 border-orange-100 text-orange-800' : 
                        'bg-red-50 border-red-100 text-red-800'
                    }`}>
                        <div className={`p-2 rounded-xl h-10 w-10 flex items-center justify-center shrink-0 ${
                            profitMargin > 15 ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                            {profitMargin > 15 ? <TrendingUp size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest">Viabilidade</p>
                            <p className="text-sm font-bold leading-tight">
                                {profitMargin > 30 ? 'Produto Altamente Rentável. Ótima oportunidade de escala.' :
                                 profitMargin > 15 ? 'Saudável. Dentro da média de mercado para e-commerce.' :
                                 profitMargin > 0 ? 'Margem Baixa. Considere otimizar custos ou aumentar o preço.' :
                                 'Produto em Prejuízo. Revise a operação imediatamente!'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Seleção de Produto Acabado */}
            {isProductModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Escolher do Estoque</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Selecione um produto para importar sua receita BOM</p>
                            </div>
                            <button onClick={() => setIsProductModalOpen(false)} className="p-3 bg-white text-gray-400 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 pb-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                <input 
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar por nome ou SKU mestre..."
                                    className="w-full pl-12 pr-4 py-4 bg-slate-100 border-none rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-2">
                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-10">
                                    <p className="text-gray-400 font-bold uppercase text-[10px]">Nenhum produto com receita encontrado</p>
                                </div>
                            ) : filteredProducts.map((product) => (
                                <button 
                                    key={product.id}
                                    onClick={() => handleSelectProduct(product)}
                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-blue-50 rounded-2xl border border-gray-100 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-all">
                                            <Package size={24} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 uppercase text-sm leading-tight">{product.name}</p>
                                            <p className="text-[10px] font-mono font-bold text-gray-400 uppercase mt-1">{product.code}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Preço Atual</p>
                                            <p className="text-sm font-black text-blue-600">R$ {product.sell_price?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-600 transition-all" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
