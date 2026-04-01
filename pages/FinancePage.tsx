
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { OrderItem, Canal, StockItem, ProdutoCombinado, SkuLink, GeneralSettings, MaterialItem, TaxEntry, FinanceCardConfig, StockMovement, DespesaCategoria, DespesaFornecedor, DespesaLancamento, User } from '../types';
import {
    DollarSign, TrendingUp,
    FileUp, FileDown, Calendar, ArrowRight, Loader2, ShoppingBag, Box, Trash2, Settings, CheckCircle, RefreshCw, ChevronDown, ChevronRight, ChevronLeft, FileSpreadsheet, AlertCircle, Percent, PieChart, Landmark, Plus, Minus, FileCode, AlertTriangle, Edit2, X, Save, BarChart3, Lock, Unlock, CalendarClock, Calculator, Receipt, Info
} from 'lucide-react';
import { calculateMaterialList } from '../lib/estoque';
import { exportFinanceReport, exportFinancePptx } from '../lib/export';
import ConfirmActionModal from '../components/ConfirmActionModal';
import FinanceImportModal from '../components/FinanceImportModal';
import { MappingPanel } from '../components/MappingSettings';
import LancarPagamentoModal from '../components/LancarPagamentoModal';
import DespesasLancamentosCard from '../components/DespesasLancamentosCard';

interface FinancePageProps {
    allOrders: OrderItem[];
    stockItems: StockItem[];
    skuLinks: SkuLink[];
    produtosCombinados: ProdutoCombinado[];
    generalSettings: GeneralSettings;
    stockMovements?: StockMovement[];
    onDeleteOrders: (ids: string[]) => Promise<void>;
    onLaunchOrders: (orders: OrderItem[]) => Promise<void>;
    onSaveSettings?: (settings: GeneralSettings) => void;
    onNavigateToSettings: () => void;
    setCurrentPage: (page: string) => void;
    onSelectSku?: (sku: string) => void;
    costCalculations?: any[];
    users?: User[];
    importHistory?: { id: string; filename: string; canal: string; created_at: string }[];
}

interface FinanceStatCardProps {
    label: string;
    value: string;
    color: 'blue' | 'red' | 'orange' | 'emerald' | 'slate' | 'purple';
    sub?: string;
    highlight?: boolean;
    trend?: { value: number; label: string };
}

const SimplePieChart = ({ data, size = 150, title }: { data: { label: string, value: number, color: string }[], size?: number, title: string }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return null;
    
    let cum = 0;
    const gradient = data.map(d => {
        const start = (cum / total) * 100;
        cum += d.value;
        const end = (cum / total) * 100;
        return `${d.color} ${start}% ${end}%`;
    }).join(', ');

    return (
        <div className="flex flex-col items-center w-full">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 w-full border-b pb-2">{title}</h4>
            <div 
                style={{ 
                    width: size, height: size, 
                    borderRadius: '50%', 
                    background: `conic-gradient(${gradient})`,
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)'
                }} 
            />
            <div className="mt-5 w-full space-y-2">
                {data.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: d.color }}></div>
                            <span className="font-bold text-slate-600 line-clamp-1 max-w-[120px]" title={d.label}>{d.label}</span>
                        </div>
                        <div className="text-right flex flex-col">
                            <span className="font-black text-slate-800">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.value)}</span>
                            <span className="text-[9px] font-bold text-slate-400">{((d.value/total)*100).toFixed(1)}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const FinanceStatCard: React.FC<FinanceStatCardProps> = ({ label, value, color, sub, highlight, breakdown, trend }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        red: 'bg-red-50 text-red-700 border-red-100',
        orange: 'bg-orange-50 text-orange-700 border-orange-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
        slate: 'bg-slate-50 text-slate-700 border-slate-100'
    };

    const baseClass = `p-5 rounded-2xl border ${colors[color]} flex flex-col justify-between h-full relative overflow-hidden transition-all hover:shadow-md`;
    const highlightClass = highlight ? 'ring-2 ring-emerald-500 shadow-lg' : 'shadow-sm';

    return (
        <div className={`${baseClass} ${highlightClass}`}>
            <div className="z-10 relative w-full">
                <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
                    {trend && (
                        <div className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-md ${trend.value > 0 ? 'bg-emerald-100 text-emerald-700' : trend.value < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                            <TrendingUp size={10} className={trend.value < 0 ? 'transform rotate-180' : ''} />
                            <span>{trend.value > 0 ? '+' : ''}{trend.value.toFixed(1)}% {trend.label}</span>
                        </div>
                    )}
                </div>
                <p className="text-2xl font-black tracking-tight">{value}</p>

                {breakdown ? (
                    <div className="mt-3 space-y-1 border-t border-black/5 pt-2">
                        {breakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                                <span className="font-bold opacity-70 uppercase tracking-tight text-[9px]">{item.label}</span>
                                <span className={`font-black ${item.colorClass || ''}`}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    sub && <p className="text-[10px] font-bold mt-1 opacity-60 uppercase border-t border-black/10 pt-1 inline-block">{sub}</p>
                )}
            </div>
        </div>
    );
};

const FinancePage: React.FC<FinancePageProps> = ({
    allOrders,
    stockItems,
    skuLinks,
    produtosCombinados,
    generalSettings,
    stockMovements,
    onDeleteOrders,
    onLaunchOrders,
    onSaveSettings,
    onNavigateToSettings,
    setCurrentPage,
    onSelectSku,
    costCalculations = [],
    users = [],
    importHistory = []
}) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'materials'>('overview');

    // Lista de despesas/deduções — inicializa de generalSettings.deductions (persiste)
    const [taxes, setTaxes] = useState<TaxEntry[]>(() => {
        const saved = generalSettings.deductions;
        if (saved && saved.length > 0) return saved;
        return [{ id: '1', name: 'Simples Nacional', type: 'percent', value: 6, enabled: true, category: 'imposto', appliesTo: 'gross' }];
    });

    // Sincroniza quando generalSettings mudar externamente
    useEffect(() => {
        if (generalSettings.deductions && generalSettings.deductions.length > 0) {
            setTaxes(generalSettings.deductions);
            setTaxesDirty(false);
        }
    }, [generalSettings.deductions]);
    const [taxesDirty, setTaxesDirty] = useState(false);

    // Cards personalizáveis
    const defaultCards: FinanceCardConfig[] = [
        { id: 'card_1', label: 'Faturado', metric: 'gross', color: 'blue', enabled: true },
        { id: 'card_2', label: 'Líquido Final', metric: 'net', color: 'emerald', enabled: true },
        { id: 'card_3', label: 'Lucro (Calculadora)', metric: 'estProfit', color: 'emerald', enabled: true },
        { id: 'card_4', label: 'Margem Real', metric: 'estMargin', color: 'emerald', enabled: true },
        { id: 'card_5', label: 'Pago pelos Clientes', metric: 'buyerTotal', color: 'purple', enabled: true },
    ];
    const [financeCards, setFinanceCards] = useState<FinanceCardConfig[]>(() => {
        const saved = generalSettings.financeCards;
        return saved && saved.length > 0 ? saved : defaultCards;
    });
    useEffect(() => {
        if (generalSettings.financeCards && generalSettings.financeCards.length > 0) {
            setFinanceCards(generalSettings.financeCards);
        }
    }, [generalSettings.financeCards]);
    const saveCards = (cards: FinanceCardConfig[]) => {
        setFinanceCards(cards);
        setCardsDirty(true);
    };
    const [cardsDirty, setCardsDirty] = useState(false);
    const [isCardsLocked, setIsCardsLocked] = useState(() => localStorage.getItem('erp_finance_cards_locked') !== 'false');
    const toggleCardsLock = () => {
        const newVal = !isCardsLocked;
        setIsCardsLocked(newVal);
        localStorage.setItem('erp_finance_cards_locked', String(newVal));
    };
    const handleSaveCards = () => {
        if (onSaveSettings) onSaveSettings({ ...generalSettings, financeCards: financeCards });
        setCardsDirty(false);
    };
    const handleAddCard = () => {
        const nc: FinanceCardConfig = { id: Date.now().toString(), label: 'Novo Card', metric: 'gross', color: 'blue', enabled: true };
        saveCards([...financeCards, nc]);
    };
    const handleRemoveCard = (id: string) => saveCards(financeCards.filter(c => c.id !== id));
    const handleUpdateCard = (id: string, field: keyof FinanceCardConfig, value: any) => saveCards(financeCards.map(c => c.id === id ? { ...c, [field]: value } : c));

    const [editingCardId, setEditingCardId] = useState<string | null>(null);

    const canaisDisponiveis = useMemo(() => {
        const normalizedMap = new Map<string, string>();
        allOrders.forEach(o => {
            if (!o.canal) return;
            const key = String(o.canal).trim().toUpperCase();
            if (!key) return;
            if (!normalizedMap.has(key)) normalizedMap.set(key, String(o.canal).trim());
        });
        (generalSettings.customStores || []).forEach(s => {
            const raw = String(s.id || s.name || '').trim();
            if (!raw) return;
            const key = raw.toUpperCase();
            normalizedMap.set(key, raw);
        });
        return Array.from(normalizedMap.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [allOrders, generalSettings.customStores]);

    // Resolve nome legível de canal a partir do preset / customStores
    const resolveChannelName = (key: string): string => {
        const upper = key.toUpperCase();
        // Verificar storeName configurado no importer
        const importerMapping = (generalSettings.importer as any)[key.toLowerCase()] || (generalSettings as any)[`importer_${key.toLowerCase()}`];
        if (importerMapping?.storeName) return importerMapping.storeName;
        // Verificar customStores
        const custom = (generalSettings.customStores || []).find(s => s.id.toUpperCase() === upper || s.name.toUpperCase() === upper);
        if (custom) return custom.name;
        // Fallback padrão
        if (upper === 'ML') return 'Mercado Livre';
        if (upper === 'SHOPEE') return 'Shopee';
        if (upper === 'SITE') return generalSettings?.importer?.site?.storeName || 'Site / Outros';
        if (upper === 'TIKTOK') return 'TikTok';
        return key;
    };

    const [rankingMetric, setRankingMetric] = useState<'revenue' | 'quantity'>('revenue');
    const [period, setPeriod] = useState<'today' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom' | 'last_upload'>('thisMonth');
    const [canalFilter, setCanalFilter] = useState<Canal | 'ALL'>('ALL');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [compareMode, setCompareMode] = useState<'prev_period' | 'same_month_last_year' | 'same_day_last_month' | 'custom'>('prev_period');
    const [compareCustomDates, setCompareCustomDates] = useState({ start: '', end: '' });
    const [considerarInvalidos, setConsiderarInvalidos] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [isExporting, setIsExporting] = useState(false);
    const [isExportingPptx, setIsExportingPptx] = useState(false);
    const [chartPage, setChartPage] = useState(0);
    const CHART_WINDOW = 10;

    // Reset paginação do gráfico quando filtros mudam
    useEffect(() => { setChartPage(0); }, [period, canalFilter, customDates.start, customDates.end]);

    // Toggles de deduções da planilha
    const [deductPlatformFees, setDeductPlatformFees] = useState(true);
    const [deductShipping, setDeductShipping] = useState(true);
    const [useNetShipping, setUseNetShipping] = useState(true); // Frete líquido = shipping - customerPaid

    // Modal states
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false); // Novo modal para apagar tudo
    const [isDeleting, setIsDeleting] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingCanal, setMappingCanal] = useState<string>('shopee');
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [dateSourceMode, setDateSourceMode] = useState<'sale_date' | 'import_date' | 'shipping_date'>(generalSettings.dateSource === 'import_date' ? 'import_date' : 'sale_date');
    
    // Forçar sale_date se não houver configuração explícita para evitar erros de importação recente
    useEffect(() => {
        if (!generalSettings.dateSource) {
            setDateSourceMode('sale_date');
        }
    }, [generalSettings.dateSource]);

    // ── Lançamento de Pagamentos ──
    const [isLancarPagamentoOpen, setIsLancarPagamentoOpen] = useState(false);
    const [despesaCategorias, setDespesaCategorias] = useState<DespesaCategoria[]>(() => generalSettings.despesaCategorias || []);
    const [despesaFornecedores, setDespesaFornecedores] = useState<DespesaFornecedor[]>(() => generalSettings.despesaFornecedores || []);
    const [despesaLancamentos, setDespesaLancamentos] = useState<DespesaLancamento[]>(() => generalSettings.despesaLancamentos || []);

    useEffect(() => {
        if (generalSettings.despesaCategorias) setDespesaCategorias(generalSettings.despesaCategorias);
        if (generalSettings.despesaFornecedores) setDespesaFornecedores(generalSettings.despesaFornecedores);
        if (generalSettings.despesaLancamentos) setDespesaLancamentos(generalSettings.despesaLancamentos);
    }, [generalSettings.despesaCategorias, generalSettings.despesaFornecedores, generalSettings.despesaLancamentos]);

    const handleSaveDespesaCategorias = (cats: DespesaCategoria[]) => {
        setDespesaCategorias(cats);
        if (onSaveSettings) onSaveSettings({ ...generalSettings, despesaCategorias: cats });
    };
    const handleSaveDespesaFornecedores = (forns: DespesaFornecedor[]) => {
        setDespesaFornecedores(forns);
        if (onSaveSettings) onSaveSettings({ ...generalSettings, despesaFornecedores: forns });
    };
    const handleLancarDespesa = (lancamento: DespesaLancamento) => {
        const updated = [...despesaLancamentos, lancamento];
        setDespesaLancamentos(updated);
        if (onSaveSettings) onSaveSettings({ ...generalSettings, despesaLancamentos: updated });
    };
    const handleDeleteDespesa = (id: string) => {
        const updated = despesaLancamentos.filter(l => l.id !== id);
        setDespesaLancamentos(updated);
        if (onSaveSettings) onSaveSettings({ ...generalSettings, despesaLancamentos: updated });
    };

    // Competência atual para o card de despesas
    const now_date = new Date();
    const despesaCompetencia = useMemo(() => {
        // Usa o mesmo período do filtro principal
        if (period === 'lastMonth') {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        if (period === 'custom' && customDates.start) {
            const d = new Date(customDates.start + 'T12:00:00');
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
        return `${now_date.getFullYear()}-${String(now_date.getMonth() + 1).padStart(2, '0')}`;
    }, [period, customDates.start]);

    // Total de despesas lançadas para a competência atual (para uso nos cards)
    const totalDespesasLancadas = useMemo(() => {
        return despesaLancamentos.reduce((sum, l) => {
            if (l.tipo === 'mensal') {
                // Suporta múltiplas competências
                const matchComp = l.competencias && l.competencias.length > 0
                    ? l.competencias.includes(despesaCompetencia)
                    : l.competencia === despesaCompetencia;
                if (matchComp) return sum + l.valor;
            }
            if (l.tipo === 'faturado' && l.parcelasGeradas) {
                const parcelaDoMes = l.parcelasGeradas.filter(p => p.competencia === despesaCompetencia);
                return sum + parcelaDoMes.reduce((s, p) => s + p.valor, 0);
            }
            return sum;
        }, 0);
    }, [despesaLancamentos, despesaCompetencia]);

    // ── Delete por canal ou por arquivo ──
    const [isDeleteByFilterOpen, setIsDeleteByFilterOpen] = useState(false);
    const [deleteByMode, setDeleteByMode] = useState<'canal' | 'arquivo'>('canal');
    const [deleteByCanal, setDeleteByCanal] = useState('');
    const [deleteByArquivo, setDeleteByArquivo] = useState('');
    const [showCalcImportacao, setShowCalcImportacao] = useState(false);

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

    const parseOrderDate = (order: OrderItem): Date | null => {
        if (dateSourceMode === 'import_date' && order.created_at) return new Date(order.created_at);
        
        const dateStr = dateSourceMode === 'shipping_date' 
            ? (order.data_prevista_envio || order.data || '') 
            : (order.data || '');
            
        if (!dateStr) return null;
        const dateOnly = String(dateStr).split(' ')[0];
        if (dateOnly.includes('-')) {
            const [y, m, d] = dateOnly.split('-');
            return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
        }
        if (dateOnly.includes('/')) {
            const [d, m, y] = dateOnly.split('/');
            return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
        }
        return null;
    };

    const { 
        stats, canalComparison, taxTotal, finalNetProfit, filteredOrders, taxBreakdown, dailyChart, totalPedidos, 
        ticketMedio, margemPct, storeProfitability, materialList, totalMaterialCost,
        prevStats, prevTaxTotal, prevFinalNetProfit, prevTicketMedio, prevMargemPct, prevTotalMaterialCost,
        estimatedProfitCalculated, estimatedMarginCalculated 
    } = useMemo(() => {
        const now = new Date();
        let startLimit: Date | null = null;
        let endLimit: Date | null = null;

        if (period === 'today') {
            startLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
            endLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (period === 'last7days') {
            startLimit = new Date(); startLimit.setDate(now.getDate() - 7); startLimit.setHours(0, 0, 0, 0);
        } else if (period === 'thisMonth') {
            startLimit = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        } else if (period === 'lastMonth') {
            startLimit = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
            endLimit = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (period === 'custom' && customDates.start && customDates.end) {
            startLimit = new Date(customDates.start + "T00:00:00");
            endLimit = new Date(customDates.end + "T23:59:59");
        }

        let prevStartLimit: Date | null = null;
        let prevEndLimit: Date | null = null;

        if (compareMode === 'custom' && compareCustomDates.start && compareCustomDates.end) {
            prevStartLimit = new Date(compareCustomDates.start + "T00:00:00");
            prevEndLimit = new Date(compareCustomDates.end + "T23:59:59");
        } else if (compareMode === 'same_month_last_year' && startLimit) {
            prevStartLimit = new Date(startLimit.getFullYear() - 1, startLimit.getMonth(), 1, 0, 0, 0);
            prevEndLimit = new Date(startLimit.getFullYear() - 1, startLimit.getMonth() + 1, 0, 23, 59, 59);
        } else if (compareMode === 'same_day_last_month' && startLimit && endLimit) {
            const daysOffset = Math.round((endLimit.getTime() - startLimit.getTime()) / 86400000);
            prevStartLimit = new Date(startLimit.getFullYear(), startLimit.getMonth() - 1, startLimit.getDate(), 0, 0, 0);
            prevEndLimit = new Date(prevStartLimit.getFullYear(), prevStartLimit.getMonth(), prevStartLimit.getDate() + daysOffset, 23, 59, 59);
        } else {
            // prev_period
            if (startLimit && endLimit && period !== 'thisMonth' && period !== 'lastMonth' && period !== 'today') {
                const diff = endLimit.getTime() - startLimit.getTime();
                prevStartLimit = new Date(startLimit.getTime() - diff - 1000);
                prevEndLimit = new Date(endLimit.getTime() - diff - 1000);
            } else if (startLimit && period === 'thisMonth') {
                prevStartLimit = new Date(startLimit.getFullYear(), startLimit.getMonth() - 1, 1, 0, 0, 0);
                prevEndLimit = new Date(startLimit.getFullYear(), startLimit.getMonth(), 0, 23, 59, 59);
            } else if (startLimit && period === 'last7days') {
                prevStartLimit = new Date(startLimit.getTime() - 7 * 86400000);
                prevEndLimit = new Date(startLimit.getTime() - 1);
            } else if (period === 'today') {
                prevStartLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
                prevEndLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
            } else if (period === 'lastMonth') {
                prevStartLimit = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0);
                prevEndLimit = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
            }
        }

        const computePeriodStats = (sLimit: Date | null, eLimit: Date | null) => {
            const filtered = allOrders.filter(order => {
                if (canalFilter !== 'ALL' && order.canal !== canalFilter) return false;
                if (!considerarInvalidos && (order.status === 'ERRO' || order.status === 'DEVOLVIDO' || order.status === 'CANCELADO')) return false;
                if (statusFilter !== 'ALL' && order.status !== statusFilter) return false;
                const d = parseOrderDate(order);
                if (!d) return false;
                if (sLimit && d < sLimit) return false;
                if (eLimit && d > eLimit) return false;
                return true;
            });

            const base = { gross: 0, fees: 0, shipping: 0, customerPaid: 0, buyerTotal: 0, net: 0, units: 0, ranking: [] as any[], orders: 0 };
            const comparison = { ml: 0, shopee: 0, site: 0 };
            const storeProfit: Record<string, { gross: number, fees: number, shipping: number }> = {};
            const skuMap = new Map<string, { revenue: number, qty: number, name: string, commissions: number, buyerPaid: number }>();

            const groups = new Map<string, OrderItem[]>();
            filtered.forEach(o => {
                const key = o.orderId || o.tracking;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(o);
            });

            groups.forEach((group) => {
                const first = group[0];
                const canalKey = (first.canal || 'SITE').toLowerCase();
                // Tenta pegar o mapeamento do canal específico (padrão ou customizado)
                const mapping = (generalSettings.importer as any)[canalKey] || (generalSettings as any)[`importer_${canalKey}`] || {};
                
                // Se sumMultipleLines estiver definido no canal, ele tem prioridade (invertido pois isRep significa 'repetido', não 'somado')
                const isRep = mapping.sumMultipleLines !== undefined 
                    ? !mapping.sumMultipleLines 
                    : generalSettings.isRepeatedValue;
                    
                const toCents = (v: any) => Math.round((Number(v) || 0) * 100);

                const gGross = isRep ? toCents(first.price_gross) : group.reduce((s, i) => s + toCents(i.price_gross), 0);
                const gTotal = isRep ? toCents(first.price_total) : group.reduce((s, i) => s + toCents(i.price_total), 0);
                const gFees = isRep ? toCents(first.platform_fees) : group.reduce((s, i) => s + toCents(i.platform_fees), 0);
                const gShip = isRep ? toCents(first.shipping_fee) : group.reduce((s, i) => s + toCents(i.shipping_fee), 0);
                const gCustomerShip = isRep ? toCents(first.shipping_paid_by_customer) : group.reduce((s, i) => s + toCents(i.shipping_paid_by_customer), 0);
                const gNet = isRep ? toCents(first.price_net) : group.reduce((s, i) => s + toCents(i.price_net), 0);

                base.gross += gGross / 100;
                base.fees += gFees / 100;
                base.shipping += gShip / 100;
                base.customerPaid += gCustomerShip / 100;
                base.buyerTotal += gTotal / 100; // price_total já deve incluir o pago pelo cliente + frete
                base.net += gNet / 100;

                if (first.canal === 'ML') comparison.ml += gGross / 100;
                else if (first.canal === 'SHOPEE') comparison.shopee += gGross / 100;
                else comparison.site += gGross / 100;

                const storeKey = first.canal || 'SITE';
                if (!storeProfit[storeKey]) storeProfit[storeKey] = { gross: 0, fees: 0, shipping: 0 };
                storeProfit[storeKey].gross += gGross / 100;
                storeProfit[storeKey].fees += gFees / 100;
                storeProfit[storeKey].shipping += gShip / 100;

                group.forEach(o => {
                    base.units += o.qty_final;
                    const linkedSku = skuLinks.find(l => l.importedSku.toUpperCase() === o.sku.toUpperCase());
                    const masterCode = linkedSku ? linkedSku.masterProductSku : o.sku;
                    const product = stockItems.find(i => i.code.toUpperCase() === masterCode.toUpperCase());
                    const productName = product?.name || o.sku;

                    const entry = skuMap.get(masterCode) || { revenue: 0, qty: 0, name: productName, commissions: 0, buyerPaid: 0 };
                    entry.revenue += toCents(o.price_gross) / 100;
                    entry.qty += o.qty_final;
                    const orderGrossSum = group.reduce((s, i) => s + toCents(i.price_gross), 0) / 100;
                    entry.commissions += orderGrossSum > 0 ? ((toCents(o.price_gross) / 100) / orderGrossSum) * (gFees / 100) : 0;
                    entry.buyerPaid += toCents(o.price_total) / 100;
                    skuMap.set(masterCode, entry);
                });
            });

            base.ranking = Array.from(skuMap.entries()).map(([code, d]) => ({ code, ...d }))
                .sort((a, b) => rankingMetric === 'revenue' ? b.revenue - a.revenue : b.qty - a.qty);

            base.orders = groups.size;

            let taxCalculated = 0;
            const breakdown = taxes.map(t => {
                // Se a taxa tem canais específicos, calcular base apenas desses canais
                const hasChannelFilter = t.appliesToChannels && t.appliesToChannels.length > 0;
                let channelGross = base.gross;
                let channelFees = base.fees;
                let channelShipping = base.shipping;
                
                if (hasChannelFilter) {
                    channelGross = 0;
                    channelFees = 0;
                    channelShipping = 0;
                    t.appliesToChannels!.forEach(ch => {
                        const sp = storeProfit[ch];
                        if (sp) {
                            channelGross += sp.gross;
                            channelFees += sp.fees;
                            channelShipping += sp.shipping;
                        }
                    });
                }

                let taxBase = Math.round(channelGross * 100);
                if (t.appliesTo === 'after_fees') taxBase = Math.max(0, Math.round(channelGross * 100) - Math.round(channelFees * 100));
                else if (t.appliesTo === 'after_ship') taxBase = Math.max(0, Math.round(channelGross * 100) - Math.round(channelShipping * 100));
                else if (t.appliesTo === 'after_both') taxBase = Math.max(0, Math.round(channelGross * 100) - Math.round(channelFees * 100) - Math.round(channelShipping * 100));
                
                const amt = t.type === 'percent' ? Math.round(taxBase * t.value / 100) : Math.round(t.value * 100);
                const amtInReal = amt / 100;
                // Se é comissão de marketplace e deductPlatformFees está ativo, pula (já descontado via platform_fees importado)
                const skippedAsCommission = t.isMarketplaceCommission && deductPlatformFees;
                if (t.enabled !== false && !skippedAsCommission) taxCalculated += amtInReal;
                return { ...t, calculatedAmount: skippedAsCommission ? 0 : amtInReal, taxBase: taxBase / 100, _skippedAsCommission: skippedAsCommission };
            });

            // Frete líquido: shipping_fee - shipping_paid_by_customer (custo real do vendedor)
            // Quando useNetShipping=true, usa buyerTotal (valor pago pelo cliente) como base e subtrai o frete líquido
            // Fórmula ML: recebido = valor_pago_cliente - tarifas - (frete_total - frete_pago_pelo_cliente)
            const effectiveShipping = useNetShipping ? Math.max(0, base.shipping - base.customerPaid) : base.shipping;
            const baseValue = useNetShipping ? base.buyerTotal : base.gross;

            let totalDeductions = 0;
            if (deductPlatformFees) totalDeductions += base.fees;
            if (deductShipping) totalDeductions += effectiveShipping;
            totalDeductions += taxCalculated;

            const finalNet = baseValue - totalDeductions;
            const ticketMedio = base.orders > 0 ? base.gross / base.orders : 0;
            const margemPct = base.gross > 0 ? (finalNet / base.gross) * 100 : 0;

            const dailyMap = new Map<string, number>();
            groups.forEach((group) => {
                const first = group[0];
                const isRep = generalSettings.isRepeatedValue;
                const gGross = isRep ? Number(first.price_total || 0) : group.reduce((s, i) => s + (i.price_total || 0), 0);
                const d = parseOrderDate(first);
                if (!d) return;
                const key = d.toISOString().split('T')[0];
                dailyMap.set(key, (dailyMap.get(key) || 0) + gGross);
            });
            const dChart = Array.from(dailyMap.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, value]) => ({ date, value }));

            return { base, comparison, storeProfit, breakdown, taxCalculated, finalNet, ticketMedio, margemPct, dChart, filtered };
        };

        const current = computePeriodStats(startLimit, endLimit);
        const prev = computePeriodStats(prevStartLimit, prevEndLimit);

        const currentMaterialList = calculateMaterialList(current.filtered, skuLinks, stockItems, produtosCombinados, generalSettings.expeditionRules, generalSettings);
        const totalMaterialCost = currentMaterialList.reduce((s, m) => s + (m.cost || 0), 0);
        
        const prevMaterialList = calculateMaterialList(prev.filtered, skuLinks, stockItems, produtosCombinados, generalSettings.expeditionRules, generalSettings);
        const prevTotalMaterialCost = prevMaterialList.reduce((s, m) => s + (m.cost || 0), 0);
        
        // --- LUCRO ESTIMADO PELA CALCULADORA ---
        // Pegar o custo mais recente de cada SKU na calculadora (Map<SKU, {cost, date}>)
        const recentCostsMap = new Map<string, { cost: number; date: number }>();
        costCalculations.forEach(calc => {
            const sku = calc.product_sku.toUpperCase();
            const date = new Date(calc.created_at).getTime();
            const existing = recentCostsMap.get(sku);
            if (!existing || date > existing.date) {
                // Aqui o calc.profit é o lucro unitário (Venda - Custo Direto)
                // Mas precisamos do Custo Direto Unitário para subtrair do Preço do Pedido
                // No saveCalculation, salvamos: selling_price, total_material_cost, profit, calculation.shipping_cost, etc.
                const feesValue = (calc.selling_price * calc.platform_fee_percent) / 100;
                const taxValue = (calc.selling_price * calc.tax_percent) / 100;
                const directCostUnit = (calc.total_material_cost || 0) + (calc.other_costs || 0) + feesValue + (calc.shipping_cost || 0) + taxValue;
                recentCostsMap.set(sku, { cost: directCostUnit, date });
            }
        });

        let estimatedProfitCalculated = 0;
        current.filtered.forEach(o => {
            const linkedSku = skuLinks.find(l => l.importedSku.toUpperCase() === o.sku.toUpperCase());
            const masterCode = linkedSku ? linkedSku.masterProductSku.toUpperCase() : o.sku.toUpperCase();
            
            const calcData = recentCostsMap.get(masterCode);
            if (calcData) {
                // Lucro = Preço de Venda do Pedido - Custo Direto Unitário da Calculadora
                estimatedProfitCalculated += (o.price_gross - calcData.cost);
            } else {
                // Fallback: usar a lógica padrão (Lucro Bruto - Proporção do Material)
                const product = stockItems.find(i => i.code.toUpperCase() === masterCode);
                const itemCost = product?.cost_price || 0;
                estimatedProfitCalculated += (o.price_gross - (itemCost * o.qty_final));
            }
        });

        return { 
            stats: current.base, canalComparison: current.comparison, taxTotal: current.taxCalculated, finalNetProfit: current.finalNet - totalMaterialCost, 
            filteredOrders: current.filtered, taxBreakdown: current.breakdown, dailyChart: current.dChart, totalPedidos: current.base.orders, 
            ticketMedio: current.ticketMedio, margemPct: current.base.gross > 0 ? ((current.finalNet - totalMaterialCost) / current.base.gross) * 100 : 0, 
            storeProfitability: current.storeProfit, materialList: currentMaterialList, totalMaterialCost,
            prevStats: prev.base, prevTaxTotal: prev.taxCalculated, prevFinalNetProfit: prev.finalNet - prevTotalMaterialCost, prevTicketMedio: prev.ticketMedio,
            prevMargemPct: prev.base.gross > 0 ? ((prev.finalNet - prevTotalMaterialCost) / prev.base.gross) * 100 : 0, prevTotalMaterialCost,
            estimatedProfitCalculated, estimatedMarginCalculated: current.base.gross > 0 ? (estimatedProfitCalculated / current.base.gross) * 100 : 0
        };
    }, [allOrders, period, canalFilter, customDates, compareMode, compareCustomDates, considerarInvalidos, statusFilter, dateSourceMode, rankingMetric, generalSettings.isRepeatedValue, taxes, deductPlatformFees, deductShipping, useNetShipping, skuLinks, stockItems, produtosCombinados, costCalculations]);

    const handleAddTax = () => {
        const updated = [...taxes, { id: Date.now().toString(), name: 'Nova Despesa', type: 'percent' as const, value: 0, enabled: true, category: 'outro' as const, appliesTo: 'gross' as const }];
        setTaxes(updated);
        setTaxesDirty(true);
    };

    const handleRemoveTax = (id: string) => {
        const updated = taxes.filter(t => t.id !== id);
        setTaxes(updated);
        setTaxesDirty(true);
    };

    const handleUpdateTax = (id: string, field: keyof TaxEntry, value: any) => {
        const updated = taxes.map(t => t.id === id ? { ...t, [field]: value } : t);
        setTaxes(updated);
        setTaxesDirty(true);
    };

    const handleSaveTaxes = () => {
        if (onSaveSettings) onSaveSettings({ ...generalSettings, deductions: taxes });
        setTaxesDirty(false);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const materialList = calculateMaterialList(filteredOrders, skuLinks, stockItems, produtosCombinados, generalSettings.expeditionRules, generalSettings);
            const periodLabel = period === 'custom' ? `${customDates.start} a ${customDates.end}` : period;

            await exportFinanceReport({
                period: periodLabel,
                canal: canalFilter,
                stats,
                materialList,
                orders: filteredOrders,
                taxes: taxBreakdown,
                dailyChart,
                canalComparison,
                storeProfitData: storeProfitability as Record<string, { gross: number, fees: number, shipping: number }>,
                channelNames: Object.fromEntries(Object.keys(storeProfitability).map(k => [k, resolveChannelName(k)])),
                deductPlatformFees,
                deductShipping,
                showCustomerPaid: false,
                reportTitle: generalSettings.reportTitle,
                reportLogoBase64: generalSettings.reportLogoBase64,
                stockMovements: stockMovements,
                prevStats, prevNetProfit: prevFinalNetProfit, prevTicketMedio, prevMargemPct, prevTaxTotal,
                estimatedProfitCalculated,
                despesasLancadas: totalDespesasLancadas,
                despesaCompetencia
            });
        } catch (e) {
            console.error("Erro ao exportar:", e);
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPptx = async () => {
        setIsExportingPptx(true);
        try {
            const materialList = calculateMaterialList(filteredOrders, skuLinks, stockItems, produtosCombinados, generalSettings.expeditionRules, generalSettings);
            const periodLabel = period === 'custom' ? `${customDates.start} a ${customDates.end}` : period;
            await exportFinancePptx({
                period: periodLabel,
                canal: canalFilter,
                stats,
                materialList,
                orders: filteredOrders,
                taxes: taxBreakdown,
                dailyChart,
                canalComparison,
                storeProfitData: storeProfitability as Record<string, { gross: number, fees: number, shipping: number }>,
                channelNames: Object.fromEntries(Object.keys(storeProfitability).map(k => [k, resolveChannelName(k)])),
                deductPlatformFees,
                deductShipping,
                showCustomerPaid: false,
                reportTitle: generalSettings.reportTitle,
                reportLogoBase64: generalSettings.reportLogoBase64,
                stockMovements: stockMovements,
                prevStats, prevNetProfit: prevFinalNetProfit, prevTicketMedio, prevMargemPct, prevTaxTotal,
                estimatedProfitCalculated,
                despesasLancadas: totalDespesasLancadas,
                despesaCompetencia
            });
        } catch (e) {
            console.error('Erro ao exportar PPTX:', e);
        } finally {
            setIsExportingPptx(false);
        }
    };

    // Limpar APENAS o que está filtrado
    const handleClearFilteredData = async () => {
        setIsDeleting(true);
        const idsToDelete = filteredOrders.map(o => o.id);
        if (idsToDelete.length > 0) {
            await onDeleteOrders(idsToDelete);
        }
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
    };

    // Limpar TODO o banco de pedidos (Financeiro Completo)
    const handleClearAllData = async () => {
        setIsDeleting(true);
        // Pega todos os IDs de pedidos carregados no app
        const allIds = allOrders.map(o => o.id);
        if (allIds.length > 0) {
            await onDeleteOrders(allIds);
        }
        setIsDeleting(false);
        setIsDeleteAllModalOpen(false);
    };

    const hasRevenueIssue = filteredOrders.length > 0 && stats.gross === 0;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                        <DollarSign size={28} className="text-emerald-600 bg-emerald-100 p-1.5 sm:p-2 rounded-2xl shadow-sm sm:w-10 sm:h-10" />
                        Financeiro Estratégico
                    </h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <button onClick={() => setIsLancarPagamentoOpen(true)} className="bg-purple-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-purple-100 hover:bg-purple-700 transition-all flex items-center gap-1.5 sm:gap-2">
                        <Receipt size={14} /> <span className="hidden sm:inline">Lançar</span> Pagamento
                    </button>
                    <button onClick={() => setCurrentPage('calculadora')} className="bg-emerald-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-1.5 sm:gap-2">
                        <Calculator size={14} /> Calculadora
                    </button>
                    <button onClick={() => setIsImportModalOpen(true)} className="bg-indigo-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-1.5 sm:gap-2">
                        <FileCode size={14} /> XML
                    </button>
                    <button onClick={() => setIsImportModalOpen(true)} className="bg-blue-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-1.5 sm:gap-2">
                        <FileUp size={14} /> Planilha
                    </button>
                    <button 
                        onClick={() => {
                            setMappingCanal('shopee');
                            setIsMappingModalOpen(true);
                        }} 
                        className="bg-slate-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-slate-100 hover:bg-slate-700 transition-all flex items-center gap-1.5 sm:gap-2"
                    >
                        <Settings size={14} /> <span className="hidden sm:inline">Mapeamento</span> Fiscal
                    </button>
                    <button onClick={handleExport} disabled={isExporting} className="bg-red-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-50">
                        {isExporting ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />} PDF
                    </button>
                    <button onClick={handleExportPptx} disabled={isExportingPptx} className="bg-orange-600 text-white px-3 py-2 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-xs tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all flex items-center gap-1.5 sm:gap-2 disabled:opacity-50">
                        {isExportingPptx ? <Loader2 className="animate-spin" size={14} /> : <FileDown size={14} />} PPTX
                    </button>
                </div>
            </div>

            {hasRevenueIssue && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm animate-pulse">
                    <div className="flex items-center">
                        <AlertTriangle className="text-amber-600 mr-3" size={24} />
                        <div>
                            <h3 className="text-lg font-bold text-amber-800">Atenção: Faturamento Zerado</h3>
                            <p className="text-sm text-amber-700">
                                Existem {filteredOrders.length} pedidos neste período, mas o valor total é R$ 0,00.
                                <br />Isso indica que as colunas financeiras (Valor Total, Preço) não foram mapeadas corretamente na importação.
                            </p>
                            <button
                                onClick={() => setIsMappingModalOpen(true)}
                                className="mt-2 text-sm font-black text-amber-800 underline hover:text-amber-900"
                            >
                                Abrir Mapeamento para corrigir colunas
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Painel de Filtros e Impostos */}
                <div className="lg:col-span-1 space-y-4 sm:space-y-6">
                    {/* Toggle mobile para filtros */}
                    <button
                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="lg:hidden w-full flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm"
                    >
                        <span className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                            <Settings size={14} className="text-blue-500" /> Filtros e Despesas
                        </span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`space-y-4 sm:space-y-6 ${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
                    <div className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                            <Settings size={14} className="text-blue-500" /> Despesas e Deduções
                        </h3>
                        <p className="text-[10px] text-gray-400">Selecione quais deduções serão aplicadas ao cálculo do Líquido Final. As despesas são salvas automaticamente.</p>

                        {/* Deduções da planilha */}
                        <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Taxas da Planilha</p>
                            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                <input type="checkbox" checked={deductPlatformFees} onChange={e => setDeductPlatformFees(e.target.checked)} className="rounded text-blue-600" />
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-700">Comissões Plataforma</span>
                                    <span className="text-[9px] text-slate-400 block">Valor real da planilha importada (não adicione comissão nas despesas abaixo)</span>
                                </div>
                                <span className="text-xs font-black text-orange-600">{fmt(stats.fees)}</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                <input type="checkbox" checked={deductShipping} onChange={e => setDeductShipping(e.target.checked)} className="rounded text-blue-600" />
                                <div className="flex-1">
                                    <span className="text-xs font-bold text-slate-700">Taxa de Envio / Frete</span>
                                    <span className="text-[9px] text-slate-400 block">Frete pago pela empresa</span>
                                </div>
                                <span className="text-xs font-black text-orange-600">{fmt(useNetShipping ? Math.max(0, stats.shipping - stats.customerPaid) : stats.shipping)}</span>
                            </label>
                            {deductShipping && (
                                <label className="flex items-center gap-2 p-2 ml-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                                    <input type="checkbox" checked={useNetShipping} onChange={e => setUseNetShipping(e.target.checked)} className="rounded text-blue-600" />
                                    <div className="flex-1">
                                        <span className="text-[10px] font-bold text-blue-700">Frete Líquido (Frete Total − Pago pelo Cliente)</span>
                                        <span className="text-[9px] text-blue-400 block">
                                            {fmt(stats.shipping)} total − {fmt(stats.customerPaid)} cliente = {fmt(Math.max(0, stats.shipping - stats.customerPaid))} líquido
                                        </span>
                                    </div>
                                </label>
                            )}
                        </div>

                        {/* Despesas e deduções customizadas */}
                        <div className="space-y-2">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Despesas e Deduções</p>
                            {taxes.map(tax => (
                                <div key={tax.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 relative group">
                                    <button onClick={() => handleRemoveTax(tax.id)} className="absolute -top-2 -right-2 bg-white border shadow-sm p-1 rounded-full text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Minus size={12} />
                                    </button>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={tax.enabled !== false} onChange={e => handleUpdateTax(tax.id, 'enabled', e.target.checked)} className="rounded text-purple-600" />
                                        <input
                                            type="text"
                                            value={tax.name}
                                            onChange={e => handleUpdateTax(tax.id, 'name', e.target.value)}
                                            className="flex-1 bg-transparent border-b border-slate-200 font-bold text-xs outline-none focus:border-blue-500"
                                            placeholder="Nome da despesa"
                                        />
                                    </label>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Categoria</label>
                                        <select
                                            value={tax.category || 'outro'}
                                            onChange={e => handleUpdateTax(tax.id, 'category', e.target.value)}
                                            className="w-full bg-white border rounded-lg text-[10px] font-black p-1"
                                        >
                                            <option value="imposto">Imposto Fiscal</option>
                                            <option value="publicidade">Publicidade</option>
                                            <option value="funcionarios">Funcionários</option>
                                            <option value="insumos">Insumos</option>
                                            <option value="outro">Outro</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            value={tax.type}
                                            onChange={e => handleUpdateTax(tax.id, 'type', e.target.value)}
                                            className="bg-white border rounded-lg text-[10px] font-black p-1"
                                        >
                                            <option value="percent">%</option>
                                            <option value="fixed">R$</option>
                                        </select>
                                        <input
                                            type="number"
                                            value={tax.value}
                                            onChange={e => handleUpdateTax(tax.id, 'value', Number(e.target.value))}
                                            className="flex-1 bg-white border rounded-lg p-1 text-xs font-black text-right outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Base de Cálculo</label>
                                        <select
                                            value={tax.appliesTo || 'gross'}
                                            onChange={e => handleUpdateTax(tax.id, 'appliesTo', e.target.value)}
                                            className="w-full bg-white border rounded-lg text-[10px] font-black p-1"
                                        >
                                            <option value="gross">Bruto (total de vendas)</option>
                                            <option value="after_fees">Bruto − Comissões</option>
                                            <option value="after_ship">Bruto − Frete</option>
                                            <option value="after_both">Bruto − Comissões − Frete</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Aplicar em Canais</label>
                                        <div className="flex flex-wrap gap-1">
                                            {canaisDisponiveis.map(ch => {
                                                const selected = (tax.appliesToChannels || []).includes(ch);
                                                return (
                                                    <button
                                                        key={ch}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = tax.appliesToChannels || [];
                                                            const updated = selected ? current.filter(c => c !== ch) : [...current, ch];
                                                            handleUpdateTax(tax.id, 'appliesToChannels', updated);
                                                        }}
                                                        className={`px-2 py-0.5 rounded text-[9px] font-black border transition-all ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                                    >
                                                        {resolveChannelName(ch)}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[8px] text-slate-400 mt-0.5">{(!tax.appliesToChannels || tax.appliesToChannels.length === 0) ? 'Nenhum selecionado = aplica em todos' : `Aplicado em: ${(tax.appliesToChannels || []).map(resolveChannelName).join(', ')}`}</p>
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 cursor-pointer mt-1">
                                            <input
                                                type="checkbox"
                                                checked={!!tax.isMarketplaceCommission}
                                                onChange={e => handleUpdateTax(tax.id, 'isMarketplaceCommission', e.target.checked)}
                                                className="rounded text-amber-600"
                                            />
                                            <span className="text-[9px] font-black text-amber-700">É comissão do marketplace</span>
                                        </label>
                                        {tax.isMarketplaceCommission && deductPlatformFees && (
                                            <p className="text-[8px] text-amber-600 mt-0.5 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                                Ignorada — comissão já vem da planilha importada (Comissões Plataforma ativo).
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleAddTax} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 hover:border-blue-200 transition-all flex items-center justify-center gap-2">
                                <Plus size={14} /> Adicionar Despesa
                            </button>
                            {taxesDirty && (
                                <button onClick={handleSaveTaxes} className="w-full py-2.5 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100">
                                    <Save size={14} /> Salvar Despesas
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                            <PieChart size={14} className="text-blue-500" /> Filtros de Visão
                        </h3>
                        <div className="space-y-3">
                            <select value={period} onChange={e => setPeriod(e.target.value as any)} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="thisMonth">Mês Atual</option>
                                <option value="lastMonth">Mês Passado</option>
                                <option value="last7days">Últimos 7 Dias</option>
                                <option value="today">Hoje</option>
                                <option value="custom">Período Customizado</option>
                            </select>
                            {period === 'custom' && (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">De</label>
                                        <input type="date" value={customDates.start} onChange={e => setCustomDates(p => ({ ...p, start: e.target.value }))} className="w-full p-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Até</label>
                                        <input type="date" value={customDates.end} onChange={e => setCustomDates(p => ({ ...p, end: e.target.value }))} className="w-full p-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 mt-1" />
                                    </div>
                                </div>
                            )}
                            <select value={canalFilter} onChange={e => setCanalFilter(e.target.value as any)} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="ALL">Todos os Canais</option>
                                {canaisDisponiveis.map(c => {
                                    return <option key={c} value={c}>{resolveChannelName(c)}</option>;
                                })}
                            </select>
                            {/* Filtro de Status */}
                            <div>
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Filtrar por Status</label>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="ALL">Todos os Status</option>
                                    {Array.from(new Set(allOrders.map(o => o.status).filter(Boolean))).sort().map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                                <input type="checkbox" checked={considerarInvalidos} onChange={e => setConsiderarInvalidos(e.target.checked)} className="rounded text-blue-600" />
                                <span className="text-[10px] font-bold text-slate-600">Incluir ERRO / DEVOLVIDO / CANCELADO</span>
                            </label>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4 mt-6">
                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                            <CalendarClock size={14} className="text-orange-500" /> Comparar Período
                        </h3>
                        <div className="space-y-3">
                            <select value={compareMode} onChange={e => setCompareMode(e.target.value as any)} className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-black outline-none focus:ring-2 focus:ring-orange-500">
                                <option value="prev_period">Período Anterior Imediato</option>
                                <option value="same_month_last_year">Mesmo Mês do Ano Anterior</option>
                                <option value="same_day_last_month">Mesmo Dia, Mês Anterior</option>
                                <option value="custom">Comparação Customizada</option>
                            </select>
                            {compareMode === 'custom' && (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Comparar a Partir de</label>
                                        <input type="date" value={compareCustomDates.start} onChange={e => setCompareCustomDates(p => ({ ...p, start: e.target.value }))} className="w-full p-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Comparar Até</label>
                                        <input type="date" value={compareCustomDates.end} onChange={e => setCompareCustomDates(p => ({ ...p, end: e.target.value }))} className="w-full p-2 bg-slate-50 border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 mt-1" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gráficos de Pizza (Apenas se houver receita) */}
                    {stats.gross > 0 && (
                        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                            <SimplePieChart 
                                title="Despesas vs Lucro Líquido" 
                                data={[
                                    { label: 'Lucro Líquido', value: Math.max(0, finalNetProfit - totalDespesasLancadas), color: '#10b981' },
                                    ...(deductPlatformFees ? [{ label: 'Comissões', value: stats.fees, color: '#f59e0b' }] : []),
                                    ...(deductShipping ? [{ label: 'Frete Empresa', value: stats.shipping, color: '#3b82f6' }] : []),
                                    ...taxBreakdown.filter(t => t.enabled !== false && t.calculatedAmount > 0).map((t, i) => ({ label: t.name, value: t.calculatedAmount, color: ['#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f97316'][i % 5] })),
                                    ...(totalDespesasLancadas > 0 ? [{ label: 'Despesas Lançadas', value: totalDespesasLancadas, color: '#be123c' }] : [])
                                ]} 
                            />
                            {Object.keys(storeProfitability).length > 0 && (
                                <SimplePieChart 
                                    title="Distribuição por Canal" 
                                    data={Object.entries(storeProfitability).map(([key, val]: [string, any], i) => {
                                        return { 
                                            label: resolveChannelName(key), value: val.gross, 
                                            color: key === 'ML' ? '#eab308' : key === 'SHOPEE' ? '#ee4d2d' : ['#3b82f6', '#8b5cf6', '#10b981', '#ec4899'][i % 4] 
                                        };
                                    })} 
                                />
                            )}
                        </div>
                    )}

                    {/* Botões de Limpeza */}
                    <div className="space-y-3">
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                        >
                            <Trash2 size={14} /> Limpar Filtro Atual
                        </button>
                        <button
                            onClick={() => setIsDeleteByFilterOpen(!isDeleteByFilterOpen)}
                            className="w-full py-3 bg-orange-100 text-orange-700 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-orange-200 transition-all flex items-center justify-center gap-2 border border-orange-200"
                        >
                            <Trash2 size={14} /> Apagar por Canal / Arquivo
                        </button>
                        {isDeleteByFilterOpen && (
                            <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 space-y-3">
                                <div className="flex gap-1 p-1 bg-orange-100 rounded-xl">
                                    <button onClick={() => setDeleteByMode('canal')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${deleteByMode === 'canal' ? 'bg-white text-orange-800 shadow-sm' : 'text-orange-400'}`}>
                                        Por Canal
                                    </button>
                                    <button onClick={() => setDeleteByMode('arquivo')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${deleteByMode === 'arquivo' ? 'bg-white text-orange-800 shadow-sm' : 'text-orange-400'}`}>
                                        Por Arquivo
                                    </button>
                                </div>
                                {deleteByMode === 'canal' && (
                                    <>
                                        <select value={deleteByCanal} onChange={e => setDeleteByCanal(e.target.value)} className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500">
                                            <option value="">Selecionar canal...</option>
                                            {canaisDisponiveis.map(c => <option key={c} value={c}>{resolveChannelName(c)}</option>)}
                                        </select>
                                        {deleteByCanal && (
                                            <button onClick={async () => {
                                                const ids = filteredOrders.filter(o => o.canal === deleteByCanal).map(o => o.id);
                                                if (ids.length > 0 && confirm(`Apagar ${ids.length} pedidos do canal ${deleteByCanal}?`)) {
                                                    await onDeleteOrders(ids);
                                                    setDeleteByCanal('');
                                                }
                                            }} className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all">
                                                Apagar {filteredOrders.filter(o => o.canal === deleteByCanal).length} pedidos de {deleteByCanal}
                                            </button>
                                        )}
                                    </>
                                )}
                                {deleteByMode === 'arquivo' && (
                                    <>
                                        <select value={deleteByArquivo} onChange={e => setDeleteByArquivo(e.target.value)} className="w-full p-2.5 bg-white border border-orange-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500">
                                            <option value="">Selecionar arquivo...</option>
                                            {importHistory.map(h => <option key={h.id} value={h.id}>{h.filename} ({h.canal}) - {new Date(h.created_at).toLocaleDateString('pt-BR')}</option>)}
                                        </select>
                                        {deleteByArquivo && (
                                            <button onClick={async () => {
                                                const histItem = importHistory.find(h => h.id === deleteByArquivo);
                                                const ids = allOrders.filter(o => (o as any).import_batch_id === deleteByArquivo).map(o => o.id);
                                                if (ids.length > 0 && confirm(`Apagar ${ids.length} pedidos do arquivo "${histItem?.filename}"?`)) {
                                                    await onDeleteOrders(ids);
                                                    setDeleteByArquivo('');
                                                }
                                            }} className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all">
                                                Apagar pedidos deste arquivo
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => setIsDeleteAllModalOpen(true)}
                            className="w-full py-3 bg-red-100 text-red-700 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-red-200 transition-all flex items-center justify-center gap-2 border border-red-200"
                        >
                            <AlertTriangle size={14} /> Zerar Tudo (Reset)
                        </button>
                    </div>

                    {/* Como é calculado a importação */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <button onClick={() => setShowCalcImportacao(!showCalcImportacao)} className="w-full flex justify-between items-center">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                                <Info size={14} className="text-blue-500" /> Como é Calculado o Financeiro
                            </h3>
                            {showCalcImportacao ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                        </button>
                        {showCalcImportacao && (
                            <div className="mt-4 space-y-3 text-[10px] text-slate-600 leading-relaxed">
                                {/* 1. Importação / Parser */}
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <p className="font-black text-indigo-700 uppercase tracking-widest mb-1">1. Importação da Planilha (Parser)</p>
                                    <p className="mb-1">Ao importar, o parser identifica o canal pelo nome do arquivo e aplica aliases de colunas automaticamente (ex: ML: "N.º de venda" → orderId, "SKU" → sku).</p>
                                    <div className="bg-white p-2 rounded-lg border border-indigo-100 font-mono text-[9px] space-y-0.5 mt-1">
                                        <p><strong>calculatedTotal</strong> = totalValue || (price_product + shipping_paid_by_customer)</p>
                                        <p><strong>calculatedProduct</strong> = totalValue − shipping_paid_by_customer</p>
                                        <p><strong>calculatedNet</strong> = price_product − Σ(fees) − shipping_fee</p>
                                    </div>
                                    <p className="mt-1 italic">Todos os canais usam a mesma lógica de processamento (detecção de coluna, cálculo de preço, filtro de status).</p>
                                </div>

                                {/* 2. Faturamento Bruto */}
                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                                    <p className="font-black text-blue-700 uppercase tracking-widest mb-1">2. Faturamento Bruto (Gross)</p>
                                    <div className="bg-white p-2 rounded-lg border border-blue-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>gross</strong> = Σ price_gross (por grupo de pedido)</p>
                                        <p>Se <em>sumMultipleLines = false</em>: pega apenas a 1ª linha de cada pedido</p>
                                        <p>Se <em>sumMultipleLines = true</em>: soma todas as linhas do mesmo pedido</p>
                                    </div>
                                </div>

                                {/* 3. Comissões / Taxas */}
                                <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                                    <p className="font-black text-orange-700 uppercase tracking-widest mb-1">3. Comissões / Taxas (Platform Fees)</p>
                                    <div className="bg-white p-2 rounded-lg border border-orange-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>fees</strong> = Σ platform_fees (colunas mapeadas)</p>
                                        <p>ML: "Tarifa de venda e impostos"</p>
                                        <p>Shopee: "Taxa de comissão" + "Taxa de serviço"</p>
                                    </div>
                                </div>

                                {/* 4. Frete */}
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <p className="font-black text-emerald-700 uppercase tracking-widest mb-1">4. Frete (Shipping)</p>
                                    <div className="bg-white p-2 rounded-lg border border-emerald-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>shipping</strong> = Σ shipping_fee (custo total de frete)</p>
                                        <p><strong>customerPaid</strong> = Σ shipping_paid_by_customer</p>
                                        <p><strong>effectiveShipping</strong> = useNetShipping ? max(0, shipping − customerPaid) : shipping</p>
                                    </div>
                                    <p className="mt-1 italic">Com "Frete Líquido" ativo, o frete pago pelo cliente é abatido do custo total.</p>
                                </div>

                                {/* 5. Impostos / Deduções Configuradas */}
                                <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                                    <p className="font-black text-red-700 uppercase tracking-widest mb-1">5. Impostos / Deduções (Tax Entries)</p>
                                    <div className="bg-white p-2 rounded-lg border border-red-100 font-mono text-[9px] space-y-0.5">
                                        <p>Para cada TaxEntry configurada:</p>
                                        <p>• <strong>appliesTo = "gross"</strong>: taxBase = gross</p>
                                        <p>• <strong>appliesTo = "after_fees"</strong>: taxBase = gross − fees</p>
                                        <p>• <strong>appliesTo = "after_ship"</strong>: taxBase = gross − shipping</p>
                                        <p>• <strong>appliesTo = "after_both"</strong>: taxBase = gross − fees − shipping</p>
                                        <p className="mt-1">• <strong>type = "percent"</strong>: amount = taxBase × (value / 100)</p>
                                        <p>• <strong>type = "fixed"</strong>: amount = value (fixo)</p>
                                        <p className="mt-1">Se <em>appliesToChannels[]</em> definido, usa gross/fees/shipping apenas dos canais selecionados.</p>
                                        <p><strong>taxCalculated</strong> = Σ amount (de todas as entradas ativas)</p>
                                    </div>
                                </div>

                                {/* 6. Total Deduções */}
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                    <p className="font-black text-amber-700 uppercase tracking-widest mb-1">6. Total de Deduções</p>
                                    <div className="bg-white p-2 rounded-lg border border-amber-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>totalDeductions</strong> =</p>
                                        <p className="pl-3">(deductPlatformFees ? fees : 0)</p>
                                        <p className="pl-3">+ (deductShipping ? effectiveShipping : 0)</p>
                                        <p className="pl-3">+ taxCalculated</p>
                                    </div>
                                </div>

                                {/* 7. Líquido Final */}
                                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                                    <p className="font-black text-purple-700 uppercase tracking-widest mb-1">7. Líquido Final (Net Profit)</p>
                                    <div className="bg-white p-2 rounded-lg border border-purple-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>baseValue</strong> = useNetShipping ? buyerTotal : gross</p>
                                        <p><strong>finalNet</strong> = baseValue − totalDeductions</p>
                                        <p><strong>finalNetProfit</strong> = finalNet − totalMaterialCost (CMV)</p>
                                    </div>
                                </div>

                                {/* 8. CMV / Custo de Materiais */}
                                <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
                                    <p className="font-black text-cyan-700 uppercase tracking-widest mb-1">8. CMV — Custo de Materiais Vendidos</p>
                                    <div className="bg-white p-2 rounded-lg border border-cyan-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>totalMaterialCost</strong> = Σ custo dos materiais da BOM de cada item vendido</p>
                                        <p>Para cada pedido, o sistema resolve o SKU mestre via vínculo (skuLinks) e calcula o custo dos insumos pela receita (BOM).</p>
                                    </div>
                                </div>

                                {/* 9. Despesas Lançadas */}
                                <div className="p-3 bg-pink-50 rounded-xl border border-pink-100">
                                    <p className="font-black text-pink-700 uppercase tracking-widest mb-1">9. Despesas Lançadas</p>
                                    <div className="bg-white p-2 rounded-lg border border-pink-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>despesasLancadas</strong> = Σ (parcelas com competência no período selecionado)</p>
                                        <p>Despesas Débito Mensal: competência = mês configurado</p>
                                        <p>Despesas Faturado: cada parcela tem competência própria (baseada no vencimento)</p>
                                    </div>
                                </div>

                                {/* 10. Métricas */}
                                <div className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                                    <p className="font-black text-teal-700 uppercase tracking-widest mb-1">10. Métricas Derivadas</p>
                                    <div className="bg-white p-2 rounded-lg border border-teal-100 font-mono text-[9px] space-y-0.5">
                                        <p><strong>ticketMédio</strong> = gross / totalPedidos</p>
                                        <p><strong>margemPct</strong> = (finalNetProfit / gross) × 100</p>
                                        <p><strong>lucroEstimado</strong> = Σ (preço_venda − custo_direto_calculadora) por item</p>
                                        <p><strong>margemEstimada</strong> = (lucroEstimado / gross) × 100</p>
                                    </div>
                                </div>

                                {/* 11. Status */}
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <p className="font-black text-slate-700 uppercase tracking-widest mb-1">11. Filtro de Status</p>
                                    <p>Pedidos com status ERRO, DEVOLVIDO ou CANCELADO são excluídos por padrão. A coluna de status e os valores aceitos são configurados no mapeamento de cada canal (statusColumn + acceptedStatusValues). Mesma lógica para todos os canais (ML, Shopee, TikTok, Site).</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                </div>

                {/* Dashboard Financeiro Principal */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Cards Personalizáveis */}
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cards</span>
                            <button onClick={toggleCardsLock} className={`p-1 rounded transition-colors ${isCardsLocked ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-200'}`} title={isCardsLocked ? "Desbloquear cards para edição" : "Travar edição de cards"}>
                                {isCardsLocked ? <Lock size={12} /> : <Unlock size={12} />}
                            </button>
                            {!isCardsLocked && cardsDirty && (
                                <button onClick={handleSaveCards} className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm">
                                    <Save size={10} /> Salvar
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-stretch gap-4">
                        {financeCards.filter(c => c.enabled).map(card => {
                            // Variáveis disponíveis para fórmulas
                            const formulaVars: Record<string, number> = {
                                gross: stats.gross, net: finalNetProfit, buyerTotal: stats.buyerTotal,
                                fees: stats.fees, shipping: stats.shipping, customerPaid: stats.customerPaid,
                                taxTotal, cmv: totalMaterialCost, deductions: (deductPlatformFees ? stats.fees : 0) + (deductShipping ? stats.shipping : 0) + taxTotal + totalMaterialCost,
                                units: stats.units, totalPedidos, ticketMedio, margemPct,
                                estProfit: estimatedProfitCalculated, estMargin: estimatedMarginCalculated,
                                despesasLancadas: totalDespesasLancadas
                            };
                            const evalFormula = (formula: string): number => {
                                try {
                                    const tokens = formula.trim().split(/\s+/);
                                    let result = 0;
                                    let op = '+';
                                    for (const token of tokens) {
                                        if (token === '+' || token === '-' || token === '*' || token === '/') { op = token; continue; }
                                        const val = formulaVars[token] !== undefined ? formulaVars[token] : parseFloat(token);
                                        if (isNaN(val)) continue;
                                        if (op === '+') result += val;
                                        else if (op === '-') result -= val;
                                        else if (op === '*') result *= val;
                                        else if (op === '/') result = val !== 0 ? result / val : result;
                                    }
                                    return result;
                                } catch { return 0; }
                            };

                            const getTrend = (curr: number, prev: number) => {
                                if (!prev) return undefined;
                                const val = ((curr - prev) / prev) * 100;
                                return { value: val, label: 'vs ant.' };
                            };

                            const prevDeductions = (deductPlatformFees ? prevStats.fees : 0) + (deductShipping ? prevStats.shipping : 0) + prevTaxTotal + prevTotalMaterialCost;

                            const metricMap: Record<string, { value: string; sub?: string; highlight?: boolean; breakdown?: { label: string; value: string; colorClass?: string }[]; trend?: { value: number; label: string } }> = {
                                gross: { value: fmt(stats.gross), sub: `Faturado sem taxas (${stats.units} un · ${totalPedidos} pedidos)`, trend: getTrend(stats.gross, prevStats.gross) },
                                net: {
                                    value: fmt(finalNetProfit - totalDespesasLancadas), highlight: true, trend: getTrend(finalNetProfit - totalDespesasLancadas, prevFinalNetProfit),
                                    breakdown: [
                                        { label: 'Margem sobre bruto', value: fmtPct(stats.gross > 0 ? ((finalNetProfit - totalDespesasLancadas) / stats.gross) * 100 : 0), colorClass: (finalNetProfit - totalDespesasLancadas) >= 0 ? 'text-emerald-600' : 'text-red-600' },
                                        ...(deductPlatformFees ? [{ label: 'Comissões', value: fmt(stats.fees) }] : []),
                                        ...(deductShipping ? [{ label: 'Frete/Expedição', value: fmt(stats.shipping) }] : []),
                                        { label: 'Materiais (CMV)', value: fmt(totalMaterialCost) },
                                        ...taxBreakdown.filter(t => t.enabled !== false && !(t as any)._skippedAsCommission).map(t => ({ label: t.name, value: fmt(t.calculatedAmount || 0) })),
                                        ...(totalDespesasLancadas > 0 ? [{ label: 'Despesas Lançadas', value: fmt(totalDespesasLancadas), colorClass: 'text-rose-600' }] : []),
                                    ]
                                },
                                buyerTotal: { value: fmt(stats.buyerTotal), sub: 'Pago pelos Clientes + Frete deles', trend: getTrend(stats.buyerTotal, prevStats.buyerTotal) },
                                fees: { value: fmt(stats.fees), sub: 'Comissões da plataforma', trend: getTrend(stats.fees, prevStats.fees) },
                                shipping: { value: fmt(stats.shipping), sub: 'Frete pago pela empresa', trend: getTrend(stats.shipping, prevStats.shipping) },
                                customerPaid: { value: fmt(stats.customerPaid), sub: 'Frete pago pelo comprador', trend: getTrend(stats.customerPaid, prevStats.customerPaid) },
                                cmv: { value: fmt(totalMaterialCost), sub: 'Custo de materiais (BOM)', trend: getTrend(totalMaterialCost, prevTotalMaterialCost) },
                                taxTotal: {
                                    value: fmt(taxTotal), trend: getTrend(taxTotal, prevTaxTotal),
                                    breakdown: taxBreakdown.filter(t => t.enabled !== false && !(t as any)._skippedAsCommission).map(t => ({ label: t.name, value: fmt(t.calculatedAmount || 0) }))
                                },
                                deductions: {
                                    value: fmt((deductPlatformFees ? stats.fees : 0) + (deductShipping ? stats.shipping : 0) + taxTotal + totalMaterialCost + totalDespesasLancadas),
                                    trend: getTrend((deductPlatformFees ? stats.fees : 0) + (deductShipping ? stats.shipping : 0) + taxTotal + totalMaterialCost + totalDespesasLancadas, prevDeductions),
                                    breakdown: [
                                        ...(deductPlatformFees ? [{ label: 'Comissões', value: fmt(stats.fees) }] : []),
                                        ...(deductShipping ? [{ label: 'Frete/Expedição', value: fmt(stats.shipping) }] : []),
                                        { label: 'Materiais (CMV)', value: fmt(totalMaterialCost) },
                                        ...taxBreakdown.filter(t => t.enabled !== false && !(t as any)._skippedAsCommission).map(t => ({ label: t.name, value: fmt(t.calculatedAmount || 0) })),
                                        ...(totalDespesasLancadas > 0 ? [{ label: 'Despesas Lançadas', value: fmt(totalDespesasLancadas), colorClass: 'text-rose-600' }] : []),
                                    ]
                                },
                                units: { value: `${stats.units}`, sub: `${totalPedidos} pedidos`, trend: getTrend(stats.units, prevStats.units) },
                                totalPedidos: { value: `${totalPedidos}`, sub: `${stats.units} unidades`, trend: getTrend(totalPedidos, prevStats.orders) },
                                ticketMedio: { value: fmt(ticketMedio), sub: 'Média por pedido', trend: getTrend(ticketMedio, prevTicketMedio) },
                                margemPct: { value: fmtPct(margemPct), sub: 'Margem líquida sobre bruto', trend: getTrend(margemPct, prevMargemPct) },
                                estProfit: { value: fmt(estimatedProfitCalculated), sub: 'Baseado no histórico da calculadora', highlight: true },
                                estMargin: { value: `${(estimatedMarginCalculated || 0).toFixed(1)}%`, sub: 'Margem Calculadora / Bruto' },
                                despesasLancadas: { value: fmt(totalDespesasLancadas), sub: `Despesas lançadas (${despesaCompetencia.split('-').reverse().join('/')})`, highlight: totalDespesasLancadas > 0 }
                            };

                            // Se metric=custom e há fórmula, calcula
                            if (card.metric === 'custom' && card.customFormula) {
                                const customVal = evalFormula(card.customFormula);
                                metricMap['custom'] = { value: fmt(customVal), sub: card.customFormula };
                            } else if (card.metric === 'custom') {
                                metricMap['custom'] = { value: '-', sub: 'Configure a fórmula' };
                            }

                            const m = metricMap[card.metric] || { value: '-' };
                            return (
                                <div key={card.id} className="relative group flex-1 min-w-[160px] sm:min-w-[240px] flex">
                                    <div className="w-full">
                                        <FinanceStatCard label={card.label} value={m.value} color={card.color} sub={m.sub} highlight={m.highlight} breakdown={m.breakdown} trend={m.trend} />
                                    </div>
                                    {!isCardsLocked && (
                                        <>
                                            <button onClick={() => setEditingCardId(editingCardId === card.id ? null : card.id)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1 rounded-lg shadow-sm z-10" title="Configurar card">
                                                <Edit2 size={12} className="text-slate-500" />
                                            </button>
                                            <button onClick={() => handleRemoveCard(card.id)} className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 p-1 rounded-lg shadow-sm z-10" title="Remover card">
                                                <X size={12} className="text-red-500" />
                                            </button>
                                        </>
                                    )}
                                    {editingCardId === card.id && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-20 space-y-2">
                                            <input type="text" value={card.label} onChange={e => handleUpdateCard(card.id, 'label', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs font-bold outline-none" placeholder="Nome do card" />
                                            <select value={card.metric} onChange={e => handleUpdateCard(card.id, 'metric', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs font-bold">
                                                <option value="gross">Faturado (Bruto)</option>
                                                <option value="net">Líquido Final</option>
                                                <option value="buyerTotal">Pago pelos Clientes</option>
                                                <option value="fees">Comissões Plataforma</option>
                                                <option value="shipping">Frete Empresa</option>
                                                <option value="customerPaid">Frete Comprador</option>
                                                <option value="taxTotal">Impostos/Despesas</option>
                                                <option value="deductions">Total Deduções</option>
                                                <option value="units">Unidades</option>
                                                <option value="totalPedidos">Total Pedidos</option>
                                                <option value="ticketMedio">Ticket Médio</option>
                                                <option value="margemPct">Margem %</option>
                                                <option value="estProfit">Lucro (Calculadora)</option>
                                                <option value="estMargin">Margem Real (%)</option>
                                                <option value="despesasLancadas">Despesas Lançadas</option>
                                                <option value="custom">⚙️ Fórmula Personalizada</option>
                                            </select>
                                            {card.metric === 'custom' && (
                                                <div>
                                                    <input type="text" value={card.customFormula || ''} onChange={e => handleUpdateCard(card.id, 'customFormula', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs font-mono outline-none" placeholder="gross - fees - shipping" />
                                                    <p className="text-[8px] text-slate-400 mt-1">Variáveis: gross, net, fees, shipping, customerPaid, buyerTotal, taxTotal, deductions, units, totalPedidos, ticketMedio, margemPct, estProfit, estMargin</p>
                                                </div>
                                            )}
                                            <select value={card.color} onChange={e => handleUpdateCard(card.id, 'color', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs font-bold">
                                                <option value="blue">Azul</option>
                                                <option value="emerald">Verde</option>
                                                <option value="purple">Roxo</option>
                                                <option value="orange">Laranja</option>
                                                <option value="red">Vermelho</option>
                                                <option value="slate">Cinza</option>
                                            </select>
                                            <button onClick={() => setEditingCardId(null)} className="w-full py-1 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-lg">Fechar</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {!isCardsLocked && (
                            <button onClick={handleAddCard} className="flex-1 min-w-[240px] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-400 text-xs font-black uppercase hover:bg-slate-50 hover:border-blue-200 transition-all min-h-[120px]">
                                <Plus size={16} /> Adicionar Card
                            </button>
                        )}
                    </div>

                    {/* Stats secundárias */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-xl"><TrendingUp size={18} className="text-blue-600" /></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Pedidos</p><p className="text-xl font-black text-slate-800">{totalPedidos}</p></div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-xl"><DollarSign size={18} className="text-purple-600" /></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ticket Médio</p><p className="text-xl font-black text-slate-800">{fmt(ticketMedio)}</p></div>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                            <div className="p-2 bg-slate-50 rounded-xl"><Calendar size={18} className="text-slate-500" /></div>
                            <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dias com Vendas</p><p className="text-xl font-black text-slate-800">{dailyChart.length}</p></div>
                        </div>
                    </div>

                    {/* Mini-gráfico de receita diária com navegação */}
                    {dailyChart.length > 0 && (() => {
                        const totalPages = Math.ceil(dailyChart.length / CHART_WINDOW);
                        const safePage = Math.min(chartPage, totalPages - 1);
                        const startIdx = Math.max(0, dailyChart.length - CHART_WINDOW * (safePage + 1));
                        const endIdx = dailyChart.length - CHART_WINDOW * safePage;
                        const visibleChart = dailyChart.slice(startIdx, endIdx);
                        const maxVal = Math.max(...visibleChart.map(d => d.value), 1);
                        const periodLabel = visibleChart.length > 0
                            ? `${new Date(visibleChart[0].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} – ${new Date(visibleChart[visibleChart.length - 1].date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                            : '';
                        return (
                            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                                        <TrendingUp size={14} className="text-blue-500" /> Receita Bruta por Dia
                                        <span className="text-[9px] font-normal text-slate-400 ml-1">{periodLabel}</span>
                                    </h3>
                                    <div className="space-y-4">
                                        <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                                            <Calendar size={14} className="text-blue-500" /> Filtros Temporais
                                        </h3>
                                        
                                        <div className="flex flex-col gap-3">
                                            <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1">
                                                {[
                                                    { id: 'sale_date', label: 'Venda' },
                                                    { id: 'shipping_date', label: 'Envio' },
                                                    { id: 'import_date', label: 'Import' }
                                                ].map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setDateSourceMode(m.id as any)}
                                                        className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${dateSourceMode === m.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        {m.label}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Período</label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {[
                                                        { id: 'today', label: 'Hoje' },
                                                        { id: 'last7days', label: '7 Dias' },
                                                        { id: 'thisMonth', label: 'Este Mês' },
                                                        { id: 'lastMonth', label: 'Mês Passado' },
                                                        { id: 'custom', label: 'Personalizado' },
                                                        { id: 'last_upload', label: 'Último Upload' }
                                                    ].map((p) => (
                                                        <button 
                                                            key={p.id}
                                                            onClick={() => setPeriod(p.id as any)}
                                                            className={`px-3 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                                                                period === p.id 
                                                                    ? 'bg-blue-600 text-white border-blue-700 shadow-md' 
                                                                    : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'
                                                            }`}
                                                        >
                                                            {p.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setChartPage(p => Math.min(p + 1, totalPages - 1))}
                                            disabled={safePage >= totalPages - 1}
                                            className="p-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100 disabled:opacity-30 transition-all"
                                            title="Dias anteriores"
                                        >
                                            <ChevronLeft size={14} className="text-slate-600" />
                                        </button>
                                        <span className="text-[9px] font-black text-slate-400 px-1">{safePage + 1}/{totalPages}</span>
                                        <button
                                            onClick={() => setChartPage(p => Math.max(p - 1, 0))}
                                            disabled={safePage <= 0}
                                            className="p-1.5 rounded-lg border bg-slate-50 hover:bg-slate-100 disabled:opacity-30 transition-all"
                                            title="Dias mais recentes"
                                        >
                                            <ChevronRight size={14} className="text-slate-600" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-end gap-1 h-28">
                                    {visibleChart.map((d) => (
                                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')}: ${fmt(d.value)}`}>
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                {fmt(d.value)}
                                            </div>
                                            <div
                                                className="w-full rounded-t-lg bg-blue-500 hover:bg-blue-400 transition-all cursor-default"
                                                style={{ height: `${Math.max(4, (d.value / maxVal) * 100)}px` }}
                                            />
                                            <span className="text-[8px] text-slate-400 font-bold">
                                                {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 flex justify-between text-[9px] text-slate-400 font-bold border-t pt-2">
                                    <span>Total no período: {fmt(visibleChart.reduce((s, d) => s + d.value, 0))}</span>
                                    <span>Média/dia: {fmt(visibleChart.length ? visibleChart.reduce((s, d) => s + d.value, 0) / visibleChart.length : 0)}</span>
                                </div>
                            </div>
                        );
                    })()}

                    {canalFilter === 'ALL' && Object.keys(storeProfitability).length > 0 && (
                        <div className={`grid grid-cols-1 ${Object.keys(storeProfitability).length === 2 ? 'md:grid-cols-2' : Object.keys(storeProfitability).length >= 3 ? 'md:grid-cols-3' : ''} gap-4`}>
                            {Object.entries(storeProfitability as Record<string, { gross: number, fees: number, shipping: number }>).map(([storeKey, data]) => {
                                const name = resolveChannelName(storeKey);
                                const colorMap: Record<string, { bg: string, border: string, text: string, icon: string }> = {
                                    ML: { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-800', icon: 'text-yellow-200' },
                                    SHOPEE: { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', icon: 'text-orange-200' },
                                    SITE: { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-800', icon: 'text-blue-200' },
                                    TIKTOK: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800', icon: 'text-slate-200' },
                                };
                                const colors = colorMap[storeKey] || { bg: 'bg-purple-50', border: 'border-purple-100', text: 'text-purple-800', icon: 'text-purple-200' };
                                const labelColor = storeKey === 'ML' ? 'text-yellow-600' : storeKey === 'SHOPEE' ? 'text-orange-600' : storeKey === 'SITE' ? 'text-blue-600' : storeKey === 'TIKTOK' ? 'text-slate-600' : 'text-purple-600';
                                return (
                                    <div key={storeKey} className={`p-5 ${colors.bg} border ${colors.border} rounded-3xl flex justify-between items-center`}>
                                        <div>
                                            <p className={`text-[9px] font-black ${labelColor} uppercase mb-1`}>{name}</p>
                                            <p className={`text-xl font-black ${colors.text}`}>{fmt(data.gross)}</p>
                                        </div>
                                        <Landmark size={24} className={colors.icon} />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Gráfico de Lucratividade por Loja */}
                    {Object.keys(storeProfitability).length > 0 && (
                        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2 mb-4">
                                <BarChart3 size={14} className="text-emerald-500" /> Lucratividade por Loja
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(storeProfitability as Record<string, { gross: number, fees: number, shipping: number }>).map(([store, data]) => {
                                    const storeNet = data.gross - data.fees - data.shipping;
                                    const storeMargin = data.gross > 0 ? (storeNet / data.gross) * 100 : 0;
                                    const maxGross = Math.max(...Object.values(storeProfitability as Record<string, { gross: number, fees: number, shipping: number }>).map(d => d.gross), 1);
                                    const barWidth = (data.gross / maxGross) * 100;
                                    const storeColors: Record<string, string> = { ML: 'bg-yellow-500', SHOPEE: 'bg-orange-500', SITE: 'bg-blue-500' };
                                    const storeColor = storeColors[store] || 'bg-purple-500';
                                    const storeNames: Record<string, string> = {
                                        ML: 'Mercado Livre',
                                        SHOPEE: 'Shopee',
                                        SITE: generalSettings?.importer?.site?.storeName || 'Site / Outros'
                                    };
                                    // Também verificar lojas customizadas configuradas
                                    const customStoreMappings = (generalSettings as any).customStoreMappings || [];
                                    const customMapping = customStoreMappings.find((m: any) => m.canal === store || m.id === store);
                                    const storeName = storeNames[store] || customMapping?.storeName || store;
                                    return (
                                        <div key={store} className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-700 uppercase">{storeName}</span>
                                                <div className="flex items-center gap-3 text-[10px]">
                                                    <span className="font-bold text-slate-500">Bruto: {fmt(data.gross)}</span>
                                                    <span className="font-bold text-orange-600">Taxas: {fmt(data.fees)}</span>
                                                    <span className="font-bold text-blue-600">Frete: {fmt(data.shipping)}</span>
                                                    <span className={`font-black ${storeNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Líq: {fmt(storeNet)}</span>
                                                    <span className={`font-black px-1.5 py-0.5 rounded ${storeMargin >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{fmtPct(storeMargin)}</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                                <div className="h-full flex rounded-full overflow-hidden" style={{ width: `${barWidth}%` }}>
                                                    <div className={`${storeColor} opacity-80`} style={{ width: `${data.gross > 0 ? ((data.gross - data.fees - data.shipping) / data.gross) * 100 : 0}%` }} />
                                                    <div className="bg-orange-300" style={{ width: `${data.gross > 0 ? (data.fees / data.gross) * 100 : 0}%` }} />
                                                    <div className="bg-blue-300" style={{ width: `${data.gross > 0 ? (data.shipping / data.gross) * 100 : 0}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex gap-4 mt-3 pt-2 border-t border-slate-100">
                                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Líquido</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><span className="w-2 h-2 rounded-full bg-orange-300 inline-block" /> Comissões</span>
                                <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400"><span className="w-2 h-2 rounded-full bg-blue-300 inline-block" /> Frete</span>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-3 sm:p-6 border-b flex justify-between items-center bg-slate-50/50 flex-wrap gap-2">
                            <h3 className="font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2 text-sm sm:text-base">
                                <TrendingUp size={18} className="text-blue-600" /> Top 15 Produtos
                            </h3>
                            <div className="flex bg-slate-200 p-1 rounded-xl">
                                <button onClick={() => setRankingMetric('revenue')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${rankingMetric === 'revenue' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Por Receita</button>
                                <button onClick={() => setRankingMetric('quantity')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${rankingMetric === 'quantity' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Por Qtd</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                                    <tr>
                                        <th className="px-4 py-4 text-left">Pos</th>
                                        <th className="px-4 py-4 text-left">Produto Mestre</th>
                                        <th className="px-4 py-4 text-center">Unid.</th>
                                        <th className="px-4 py-4 text-right">Faturado s/ Taxas</th>
                                        <th className="px-4 py-4 text-right">Comissão Aprox.</th>
                                        <th className="px-4 py-4 text-right">Pago p/ Clientes + Frete</th>
                                        <th className="px-4 py-4 text-right">% Peso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                                    {stats.ranking.slice(0, 30).map((item: any, idx: number) => {
                                        const link = skuLinks.find(l => l.importedSku === item.code);
                                        const masterSku = link ? link.masterProductSku : item.code;
                                        const product = stockItems.find(s => s.code === masterSku);
                                        const displayName = product ? product.name : (link ? masterSku : item.name);
                                        return (
                                            <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-xs text-slate-400">#{idx + 1}</td>
                                                <td className="px-4 py-3">
                                                    <button 
                                                        onClick={() => onSelectSku && onSelectSku(item.code)}
                                                        className="text-left group/sku"
                                                        title="Ver na Calculadora"
                                                    >
                                                        <p className="text-slate-800 uppercase leading-tight text-xs group-hover/sku:text-blue-600 transition-colors">{displayName}</p>
                                                        <p className="text-[9px] font-mono text-slate-400 group-hover/sku:underline">{item.code}{link ? ` → ${masterSku}` : ''}</p>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-center text-xs">{item.qty}</td>
                                                <td className="px-4 py-3 text-right font-black text-slate-800 text-xs">{fmt(item.revenue)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-orange-600 font-bold">{fmt(item.commissions || 0)}</td>
                                                <td className="px-4 py-3 text-right text-xs text-purple-600 font-bold">{fmt(item.buyerPaid || 0)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                                        {((item.revenue / (stats.gross || 1)) * 100).toFixed(1)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Card de Despesas Lançadas ── */}
                    <DespesasLancamentosCard
                        lancamentos={despesaLancamentos}
                        competenciaFiltro={despesaCompetencia}
                        onDelete={handleDeleteDespesa}
                    />
                </div>
            </div>

            <FinanceImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                allOrders={allOrders}
                generalSettings={generalSettings}
                onLaunchOrders={onLaunchOrders}
                onSaveSettings={onSaveSettings}
            />

            <ConfirmActionModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleClearFilteredData}
                title="Limpar Histórico Filtrado"
                message={<p>Deseja excluir permanentemente os pedidos filtrados deste período? Esta ação é irreversível.</p>}
                confirmButtonText="Confirmar Exclusão"
                isConfirming={isDeleting}
            />

            <ConfirmActionModal
                isOpen={isDeleteAllModalOpen}
                onClose={() => setIsDeleteAllModalOpen(false)}
                onConfirm={handleClearAllData}
                title="Zerar Todo o Financeiro"
                message={<><p><strong>ATENÇÃO:</strong> Você está prestes a apagar <strong>TODOS OS PEDIDOS ({allOrders.length})</strong> do banco de dados.</p><p className="mt-2 text-sm">Isso limpará completamente o histórico financeiro, relatórios de vendas e vínculos de bipagem de todos os pedidos.</p><p className="mt-2 text-red-600 font-bold uppercase">Esta ação é irreversível.</p></>}
                confirmButtonText="Sim, Zerar Tudo"
                isConfirming={isDeleting}
            />

            {/* Modal de Mapeamento Fiscal */}
            {isMappingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                                    <Landmark className="text-emerald-600" />
                                    Mapeamento Completo
                                </h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Pedidos, financeiro, status e produção — tudo configurado num só lugar</p>
                            </div>
                            <button onClick={() => setIsMappingModalOpen(false)} className="p-3 bg-white text-gray-400 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="flex flex-wrap gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
                                {[
                                    { id: 'ml', name: 'Mercado Livre' },
                                    { id: 'shopee', name: 'Shopee' },
                                    { id: 'tiktok', name: 'TikTok Shop' },
                                    { id: 'site', name: 'Padrão / Site' },
                                    ...(generalSettings.customStores || []).map(s => ({ id: s.id.toLowerCase(), name: s.name }))
                                ].map(canal => (
                                    <button
                                        key={canal.id}
                                        onClick={() => setMappingCanal(canal.id)}
                                        className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                            mappingCanal === canal.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {canal.name}
                                    </button>
                                ))}
                            </div>

                             <MappingPanel
                                canalId={mappingCanal}
                                canalName={
                                    mappingCanal === 'ml' ? 'Mercado Livre' : 
                                    mappingCanal === 'shopee' ? 'Shopee' : 
                                    mappingCanal === 'tiktok' ? 'TikTok Shop' : 
                                    mappingCanal === 'site' ? 'Padrão' : 
                                    (generalSettings.customStores || []).find(s => s.id.toLowerCase() === mappingCanal)?.name || mappingCanal
                                }
                                settings={generalSettings}
                                onUpdateMapping={(cid, f, v) => {
                                    const key = cid.toLowerCase();
                                    const newSettings = { ...generalSettings };
                                    if (['ml', 'shopee', 'site', 'tiktok'].includes(key)) {
                                        newSettings.importer = {
                                            ...newSettings.importer,
                                            [key]: { ...(newSettings.importer as any)[key], [f]: v }
                                        };
                                    } else {
                                        (newSettings as any)[`importer_${key}`] = { ...((newSettings as any)[`importer_${key}`] || {}), [f]: v };
                                    }
                                    if (onSaveSettings) onSaveSettings(newSettings);
                                }}
                                mode="all"
                            />
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-gray-100 flex justify-end items-center">
                            <button 
                                onClick={() => setIsMappingModalOpen(false)}
                                className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all"
                            >
                                Concluir Mapeamento
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Lançar Pagamento */}
            <LancarPagamentoModal
                isOpen={isLancarPagamentoOpen}
                onClose={() => setIsLancarPagamentoOpen(false)}
                categorias={despesaCategorias}
                fornecedores={despesaFornecedores}
                onSaveCategorias={handleSaveDespesaCategorias}
                onSaveFornecedores={handleSaveDespesaFornecedores}
                onLancar={handleLancarDespesa}
                stockItems={stockItems}
                users={users}
            />
        </div>
    );
};

export default FinancePage;
