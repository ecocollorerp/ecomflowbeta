
import React, { useState, useMemo } from 'react';
import { ProcessedData, OrderItem, StockItem, SkuLink, ProdutoCombinado, GeneralSettings, MaterialItem, ResumidaItem, User } from '../types';
import { FileDown, Database, AlertCircle, ChevronDown, ChevronRight, Package, Box, Info, ArrowDownAZ, ArrowDown, Link as LinkIcon, CheckCircle2, User as UserIcon, Printer, Search } from 'lucide-react';
import { exportPdf, exportExcel, Tab } from '../lib/export';
import { calculateMaterialList } from '../lib/estoque';
import ProductionSummary from './ProductionSummary';

interface ImportResultsProps {
    data: ProcessedData;
    onLaunchSuccess: (launchedOrders: OrderItem[]) => void;
    skuLinks: SkuLink[];
    products: StockItem[];
    onLinkSku: (importedSku: string, masterProductSku: string) => Promise<boolean>;
    onOpenLinkModal: (skus: string[], colorSugerida: string) => void;
    onOpenCreateProductModal: (skuData: { sku: string; colorSugerida: string; baseSugerida?: 'branca' | 'preta' | 'especial'; isMiudoSugerido?: boolean }) => void;
    produtosCombinados: ProdutoCombinado[];
    stockItems: StockItem[];
    generalSettings: GeneralSettings;
    isHistoryView?: boolean;
    users: User[];
    blingLinkedIds?: Set<string>;
    onCancel?: () => void;
}

const ImportResults: React.FC<ImportResultsProps> = (props) => {
    const {
        data,
        onLaunchSuccess,
        skuLinks = [],
        onOpenLinkModal,
        onOpenCreateProductModal,
        produtosCombinados = [],
        stockItems = [],
        generalSettings,
        isHistoryView = false,
        users,
        blingLinkedIds,
        packGroups = []
    } = props;

    const [activeTab, setActiveTab] = useState<Tab>('completa');
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
    const [resumidaSortMode, setResumidaSortMode] = useState<'qty' | 'alpha'>('qty');

    // Selection State for Resumida List
    const [selectedResumidaKeys, setSelectedResumidaKeys] = useState<Set<string>>(new Set());
    const [selectedOperator, setSelectedOperator] = useState<string>('');
    const [linkSearchTerm, setLinkSearchTerm] = useState('');
    const [selectedPendingSkus, setSelectedPendingSkus] = useState<Set<string>>(new Set());

    const skuLinkMap = useMemo<Map<string, string>>(() => {
        const m = new Map<string, string>();
        skuLinks.forEach(l => m.set(l.importedSku.toUpperCase(), l.masterProductSku.toUpperCase()));
        return m;
    }, [skuLinks]);

    const stockMap = useMemo<Map<string, StockItem>>(() => {
        const m = new Map<string, StockItem>();
        stockItems.forEach(i => m.set(i.code.toUpperCase(), i));
        return m;
    }, [stockItems]);

    // Enhanced State Calculation
    const enrichedState = useMemo<{ resumida: ResumidaItem[]; materialList: MaterialItem[]; summary: any; }>(() => {
        const orders = data.lists.completa;
        let white = 0, black = 0, special = 0, miudos = 0, wallpaper = 0;

        // Key logic: Group by MasterSKU + Color to allow selecting specific color variants
        const distributionMap = new Map<string, ResumidaItem>();

        orders.forEach(o => {
            const skuUpper = o.sku.toUpperCase();
            const masterCode = skuLinkMap.get(skuUpper) || skuUpper;
            const product = stockMap.get(masterCode);

            // Unique key for the row
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

            if (product?.product_type === 'miudos') {
                miudos += qty;
            } else {
                wallpaper += qty;
                const base = masterCode ? generalSettings.baseColorConfig[masterCode]?.type : 'branca';
                if (base === 'preta') black += qty;
                else if (base === 'especial') special += qty;
                else white += qty;
            }
        });

        const materialList: MaterialItem[] = calculateMaterialList(orders, skuLinks, stockItems, produtosCombinados, generalSettings.expeditionRules, generalSettings);

        let resumidaSorted: ResumidaItem[] = Array.from(distributionMap.values());
        if (resumidaSortMode === 'qty') {
            resumidaSorted.sort((a, b) => b.total_units - a.total_units || a.sku.localeCompare(b.sku));
        } else {
            resumidaSorted.sort((a, b) => a.sku.localeCompare(b.sku));
        }

        return {
            resumida: resumidaSorted,
            materialList,
            summary: { ...data.summary, totalUnidadesBranca: white, totalUnidadesPreta: black, totalUnidadesEspecial: special, totalUnidades: wallpaper, totalMiudos: miudos }
        };
    }, [data, skuLinkMap, stockMap, generalSettings, skuLinks, stockItems, produtosCombinados, resumidaSortMode]);

    // Calculate columns dynamically (no limit of 8)
    const allPackSizes = useMemo(() => {
        const sizes = new Set<number>();
        enrichedState.resumida.forEach(item => {
            if (item.distribution) {
                Object.keys(item.distribution).forEach(s => sizes.add(Number(s)));
            }
        });
        return Array.from(sizes).sort((a, b) => a - b);
    }, [enrichedState.resumida]);

    const toggleOrder = (id: string) => {
        setExpandedOrders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Selection Handlers
    const toggleResumidaSelection = (key: string) => {
        setSelectedResumidaKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const handleSelectAllResumida = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allKeys = enrichedState.resumida.map(item => `${item.sku}|${item.color}`);
            setSelectedResumidaKeys(new Set(allKeys));
        } else {
            setSelectedResumidaKeys(new Set());
        }
    };

    const handleExportSelected = () => {
        exportPdf('resumida', data, skuLinks, stockItems, resumidaSortMode, selectedResumidaKeys, selectedOperator);
    };

    const pendingLinks = useMemo(() => {
        const currentLinked = new Set(skuLinks.map(l => l.importedSku.toUpperCase()));
        return data.skusNaoVinculados.filter(s => !currentLinked.has(s.sku.toUpperCase()));
    }, [data.skusNaoVinculados, skuLinks]);

    const normalizeSkuAsName = (sku: string) => sku.replace(/[-_]+/g, ' ').trim();

    const filteredPendingLinks = useMemo(() => {
        const term = linkSearchTerm.trim().toLowerCase();
        if (!term) return pendingLinks;
        return pendingLinks.filter(s => {
            const sku = s.sku.toLowerCase();
            const suggestedName = normalizeSkuAsName(s.sku).toLowerCase();
            return sku.includes(term) || suggestedName.includes(term);
        });
    }, [pendingLinks, linkSearchTerm]);

    const togglePendingSkuSelection = (sku: string) => {
        setSelectedPendingSkus(prev => {
            const next = new Set(prev);
            if (next.has(sku)) next.delete(sku); else next.add(sku);
            return next;
        });
    };

    const handleSelectAllPendingVisible = (checked: boolean) => {
        if (checked) {
            setSelectedPendingSkus(new Set(filteredPendingLinks.map(item => item.sku)));
        } else {
            setSelectedPendingSkus(new Set());
        }
    };

    const handleOpenBulkLinkModal = () => {
        const selectedItems = filteredPendingLinks.filter(item => selectedPendingSkus.has(item.sku));
        if (selectedItems.length === 0) return;
        onOpenLinkModal(selectedItems.map(item => item.sku), selectedItems[0].colorSugerida || '');
    };

    const uniqueOrderIds = useMemo(() => Array.from(new Set(data.lists.completa.map(o => o.orderId))), [data.lists.completa]);

    return (
        <div className="space-y-6">
            <ProductionSummary data={enrichedState.summary} productTypeName={generalSettings.productTypeNames.papel_de_parede} miudosTypeName={generalSettings.productTypeNames.miudos} />

            {!isHistoryView && (
                <div className="flex justify-end gap-3 animate-in fade-in slide-in-from-top-2">
                    {props.onCancel && (
                        <button onClick={props.onCancel} className="bg-gray-200 text-gray-700 px-8 py-3 rounded-xl font-black text-lg shadow hover:bg-gray-300 active:scale-95 transition-all flex items-center gap-3">
                            CANCELAR
                        </button>
                    )}
                    <button onClick={() => onLaunchSuccess(data.lists.completa)} className="bg-green-600 text-white px-8 py-3 rounded-xl font-black text-lg shadow-lg hover:bg-green-700 active:scale-95 transition-all flex items-center gap-3">
                        <Database size={20} /> LANÇAR NO BANCO DE DADOS
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-2 flex-wrap">
                        {(['completa', 'resumida', 'vinculo', 'materiais'] as const).map((tid) => (
                            <button key={tid} onClick={() => setActiveTab(tid)} className={`px-4 py-2 text-sm font-black rounded-xl transition-all ${activeTab === tid ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-200'}`}>
                                {tid === 'completa' ? 'Lista de Pedidos' : tid === 'resumida' ? 'Lista por Produto/Cor' : tid === 'vinculo' ? `Vínculos (${pendingLinks.length})` : 'Materiais'}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'completa' && (
                            <button onClick={() => setExpandedOrders(new Set(uniqueOrderIds))} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center gap-2 font-black text-xs">
                                <ChevronDown size={16} /> Expandir Todos
                            </button>
                        )}
                        <button onClick={() => exportPdf(activeTab, data, skuLinks, stockItems, resumidaSortMode)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 font-black text-xs transition-all">
                            <FileDown size={20} /> PDF Completo
                        </button>
                        <button onClick={() => exportExcel(data, skuLinks, stockItems)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2 font-black text-xs transition-all">
                            <FileDown size={20} /> Excel
                        </button>
                    </div>
                </div>

                <div className="p-0 overflow-x-auto">
                    {activeTab === 'resumida' && (
                        <div>
                            {/* Toolbar de Ações da Lista Resumida */}
                            <div className="bg-slate-100 p-3 border-b flex flex-wrap gap-4 items-center justify-between sticky left-0">
                                <div className="flex gap-2">
                                    <button onClick={() => setResumidaSortMode('qty')} className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border ${resumidaSortMode === 'qty' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                                        <ArrowDown size={14} /> MAIOR QUANTIDADE
                                    </button>
                                    <button onClick={() => setResumidaSortMode('alpha')} className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border ${resumidaSortMode === 'alpha' ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                                        <ArrowDownAZ size={14} /> ORDEM ALFABÉTICA
                                    </button>
                                </div>

                                <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <UserIcon size={16} className="text-slate-400" />
                                        <select
                                            value={selectedOperator}
                                            onChange={e => setSelectedOperator(e.target.value)}
                                            className="text-xs font-bold text-slate-700 outline-none bg-transparent"
                                        >
                                            <option value="">-- Vincular Operador (Opcional) --</option>
                                            {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="h-6 w-px bg-slate-200"></div>
                                    <button
                                        onClick={handleExportSelected}
                                        disabled={selectedResumidaKeys.size === 0}
                                        className="flex items-center gap-2 text-xs font-black bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <Printer size={14} />
                                        Gerar Lista ({selectedResumidaKeys.size > 0 ? selectedResumidaKeys.size : 'Todas'})
                                    </button>
                                </div>
                            </div>

                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-900 text-white text-[10px] uppercase font-black">
                                    <tr>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded cursor-pointer"
                                                onChange={handleSelectAllResumida}
                                                checked={enrichedState.resumida.length > 0 && selectedResumidaKeys.size === enrichedState.resumida.length}
                                            />
                                        </th>
                                        <th className="p-4 text-left">Produto Mestre</th>
                                        <th className="p-4 text-left">Cor</th>
                                        {allPackSizes.map((size: number) => <th key={String(size)} className="p-4 text-center">{size} UN</th>)}
                                        <th className="p-4 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {enrichedState.resumida.map((item: ResumidaItem) => {
                                        const skuKey = (item.sku as string).toUpperCase();
                                        const product = stockMap.get(skuKey);
                                        const rowKey = `${item.sku}|${item.color}`;
                                        const isSelected = selectedResumidaKeys.has(rowKey);
                                        
                                        const packGroup = packGroups.find(g => 
                                            g.item_codes.some(c => c.toUpperCase() === (item.sku as string).toUpperCase()) &&
                                            (g.pack_size === 1 || g.name.toLowerCase().includes('1 un')) // Preferência por 1 un para saldo base
                                        );

                                        return (
                                            <tr key={rowKey} onClick={() => toggleResumidaSelection(rowKey)} className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} ${!product ? 'bg-red-50' : ''}`}>
                                                <td className="p-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleResumidaSelection(rowKey)}
                                                        className="w-4 h-4 rounded cursor-pointer text-blue-600 focus:ring-blue-500"
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-black text-slate-800 uppercase">{product?.name || 'NÃO VINCULADO'}</p>
                                                            <p className="text-[10px] font-mono text-gray-400">{item.sku}</p>
                                                        </div>
                                                        {product && (
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-blue-600 uppercase">Saldo Real</p>
                                                                <p className="text-xs font-black text-slate-700">Estoque: {product.current_qty} un</p>
                                                                <p className="text-[9px] font-bold text-emerald-600">Prontos: {product.ready_qty} un</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs font-bold text-gray-600">
                                                    <span className="px-2 py-1 bg-white border rounded-md shadow-sm">{item.color}</span>
                                                </td>
                                                {allPackSizes.map((size: number) => (
                                                    <td key={String(size)} className="p-4 text-center font-bold">
                                                        {item.distribution[size] ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md text-xs">{item.distribution[size]} PD</span>
                                                                {(() => {
                                                                    const specificPack = packGroups.find(g => 
                                                                        g.item_codes.some(c => c.toUpperCase() === (item.sku as string).toUpperCase()) &&
                                                                        (g.pack_size === size || g.name.toLowerCase().includes(`${size} un`))
                                                                    );
                                                                    if (!specificPack) return null;
                                                                    const qty = specificPack.tipo === 'volatil' 
                                                                        ? (specificPack.quantidade_volatil || 0)
                                                                        : stockItems.filter(i => specificPack.item_codes.includes(i.code)).reduce((s, i) => s + i.current_qty, 0);
                                                                    
                                                                    return (
                                                                        <span className={`text-[9px] mt-1 font-black ${qty >= item.distribution[size] ? 'text-emerald-500' : 'text-orange-500'}`}>
                                                                            Saldo: {qty}
                                                                        </span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : <span className="text-slate-300">-</span>}
                                                    </td>
                                                ))}
                                                <td className="p-4 text-right font-black text-slate-900 text-lg">{item.total_units}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {/* ... other tabs ... */}
                    {activeTab === 'completa' && (
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-900 text-white text-[10px] uppercase font-black">
                                <tr><th className="p-4 w-10"></th><th className="p-4 text-left">Pedido</th><th className="p-4 text-center">Unidades</th><th className="p-4 text-right">Status</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {(uniqueOrderIds as string[]).map(key => {
                                    const group = data.lists.completa.filter(o => o.orderId === key);
                                    const total = group.reduce((s, o) => s + o.qty_final, 0);
                                    const isExpanded = expandedOrders.has(key);
                                    return (
                                        <React.Fragment key={key}>
                                            <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleOrder(key)}>
                                                <td className="p-4 text-center">
                                                    {expandedOrders.has(key) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                </td>
                                                <td className="p-4 font-black text-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        {key}
                                                        {blingLinkedIds?.has(key) ? (
                                                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-blue-200" title="Vinculado ao Bling">
                                                                <LinkIcon size={9} /> BLING
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded-full" title="Não vinculado ao Bling">
                                                                <LinkIcon size={9} /> SEM BLING
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-bold text-blue-600">{total}</td>
                                                <td className="p-4 text-right text-[10px] font-black">{group[0].status}</td>
                                            </tr>
                                            {isExpanded && group.map(subItem => {
                                                const masterCode = skuLinkMap.get(subItem.sku.toUpperCase());
                                                const masterProduct = masterCode ? stockMap.get(masterCode) : null;
                                                return (
                                                    <tr key={subItem.id} className="bg-blue-50/50">
                                                        <td></td>
                                                        <td className="p-3 pl-8">
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-500 uppercase w-16">Importado:</span>
                                                                    <span className="font-mono text-xs text-slate-700">{subItem.sku}</span>
                                                                </div>
                                                                {masterProduct ? (
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[10px] font-bold text-green-600 uppercase w-16 flex items-center gap-1"><LinkIcon size={10} /> Vinculado:</span>
                                                                        <span className="font-bold text-xs text-green-700 uppercase">{masterProduct.name}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-[10px] font-bold text-red-400 uppercase w-16">Status:</span>
                                                                        <span className="text-xs font-bold text-red-500 italic">Não Vinculado</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-slate-600">{subItem.qty_final}</td>
                                                        <td className="p-3 text-right text-xs font-bold text-slate-500">{subItem.color}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {activeTab === 'vinculo' && (
                        <div>
                            <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-3 items-center justify-between">
                                <div className="relative w-full max-w-md">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={linkSearchTerm}
                                        onChange={(e) => setLinkSearchTerm(e.target.value)}
                                        placeholder="Buscar SKU por código ou nome sugerido..."
                                        className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-white"
                                    />
                                </div>
                                <div className="text-xs font-black text-gray-600">
                                    {filteredPendingLinks.length} de {pendingLinks.length} SKU(s)
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={filteredPendingLinks.length > 0 && selectedPendingSkus.size === filteredPendingLinks.length}
                                            onChange={(e) => handleSelectAllPendingVisible(e.target.checked)}
                                        />
                                        Selecionar visíveis
                                    </label>
                                    <button
                                        onClick={handleOpenBulkLinkModal}
                                        disabled={selectedPendingSkus.size === 0}
                                        className="text-[10px] font-black bg-blue-600 text-white px-3 py-2 rounded border border-blue-700 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        VINCULAR SELECIONADOS ({selectedPendingSkus.size})
                                    </button>
                                </div>
                            </div>
                            <table className="min-w-full text-sm">
                                <tbody className="divide-y">
                                    {filteredPendingLinks.map(s => (
                                        <tr key={s.sku} className={`hover:bg-red-50 ${selectedPendingSkus.has(s.sku) ? 'bg-blue-50' : ''}`}>
                                            <td className="p-4 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPendingSkus.has(s.sku)}
                                                    onChange={() => togglePendingSkuSelection(s.sku)}
                                                />
                                            </td>
                                            <td className="p-4">
                                                <p className="font-mono font-bold text-red-600">{s.sku}</p>
                                                <p className="text-[11px] text-gray-500">Nome sugerido: {normalizeSkuAsName(s.sku)}</p>
                                            </td>
                                            <td className="p-4 text-right flex gap-2 justify-end">
                                                <button onClick={() => onOpenLinkModal([s.sku], s.colorSugerida)} className="text-[10px] font-black bg-blue-50 text-blue-600 px-3 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors">VINCULAR</button>
                                                <button onClick={() => onOpenCreateProductModal(s)} className="text-[10px] font-black bg-green-50 text-green-600 px-3 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors">CRIAR</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'materiais' && (
                        <table className="min-w-full text-sm">
                            <tbody className="divide-y">
                                {enrichedState.materialList.map((m: MaterialItem) => (
                                    <tr key={m.name} className="hover:bg-gray-50">
                                        <td className="p-4 font-black">{m.name}</td>
                                        <td className="p-4 text-right font-black text-blue-600">{m.quantity.toFixed(m.unit === 'kg' ? 3 : 0)} {m.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {!isHistoryView && (
                    <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
                        {props.onCancel && (
                            <button onClick={props.onCancel} className="bg-gray-200 text-gray-700 px-10 py-4 rounded-2xl font-black text-xl shadow hover:bg-gray-300 active:scale-95 transition-all flex items-center gap-3">
                                CANCELAR
                            </button>
                        )}
                        <button onClick={() => onLaunchSuccess(data.lists.completa)} className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black text-xl shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                            <Database size={24} /> LANÇAR NO BANCO DE DADOS
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportResults;
