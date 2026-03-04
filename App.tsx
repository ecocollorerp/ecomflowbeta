
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import GlobalHeader from './components/GlobalHeader'; 
import { ImporterPage } from './pages/ImporterPage';
import DashboardPage from './pages/DashboardPage';
import BipagemPage from './pages/BipagemPage';
import EstoquePage from './pages/EstoquePage';
import RelatoriosPage from './pages/RelatoriosPage';
import EtiquetasPage from './pages/EtiquetasPage';
import FinancePage from './pages/FinancePage'; 
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import { ConfiguracoesGeraisPage } from './pages/ConfiguracoesGeraisPage';
import { PesagemPage } from './pages/PesagemPage';
import MoagemPage from './pages/MoagemPage';
import FuncionariosPage from './pages/FuncionariosPage';
import PedidosPage from './pages/PedidosPage';
import LoginPage from './pages/LoginPage';
import BlingPage from './pages/BlingPage';
import IntegracoesPage from './pages/IntegracoesPage';
import { Loader2 } from 'lucide-react';
import DatabaseSetupPage from './pages/DatabaseSetupPage';
import ToastContainer from './components/ToastContainer';
import PlanejamentoPage from './pages/PlanejamentoPage';
import ComprasPage from './pages/ComprasPage';
import PassoAPassoPage from './pages/PassoAPassoPage';
import AjudaPage from './pages/AjudaPage';
import BiDashboardPage from './pages/BiDashboardPage';
import PowerBiTemplatesPage from './pages/PowerBiTemplatesPage';
import ConfirmActionModal from './components/ConfirmActionModal';
import { BulkLinkSKUsModal } from './components/BulkLinkSKUsModal';

import { 
    ProcessedData, StockItem, StockMovement, ProdutoCombinado, 
    WeighingBatch, GrindingBatch, OrderItem, ScanLogItem, User, WeighingType,
    ZplSettings, ExtractedZplData, 
    ActivityType, GeneralSettings, defaultGeneralSettings,
    UserRole,
    UserSetor,
    ReturnItem,
    SkuLink,
    defaultZplSettings,
    ScanResult,
    Canal,
    UiSettings,
    ToastMessage,
    AdminNotice,
    ShoppingListItem,
    ProductionPlan,
    PlanningParameters,
    ImportHistoryItem,
    OrderStatusValue,
    OrderResolutionDetails,
    EtiquetaHistoryItem,
    BiDataItem,
    DashboardWidgetConfig,
    StockPackGroup,
    StockDeductionMode,
    EtiquetasState,
} from './types';
import { dbClient, loginUser, syncDatabase, resetDatabase, verifyDatabaseSetup, fetchAll, supabaseUrl } from './lib/supabaseClient';
import { exportStateToSql } from './lib/export';
import { SETUP_SQL_STRING } from './lib/sql';
import { resolveScan } from './lib/scanner';
import { playSound } from './lib/sound';
import { initPostHog } from './lib/posthog';
import { processZplStream } from './services/zplService';
import { simpleHash } from './utils/zplUtils';
import { canAccessPage, getFirstAccessiblePage } from './lib/accessControl';

type AppStatus = 'initializing' | 'needs_setup' | 'ready' | 'error';

/**
 * Gera um ID único para registros no banco
 * Formato: timestamp + random string
 */
const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const safeNewDate = (dateInput: any): Date => {
    if (!dateInput) return new Date(NaN);
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
}

const App: React.FC = () => {
  useEffect(() => {
    initPostHog();

    // OAuth Popup Handler
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && window.opener) {
        console.log("OAuth callback detected in popup. Sending message to opener...");
        window.opener.postMessage({ type: 'BLING_AUTH_CODE', code }, '*');
        window.close();
        return; // Stop execution in popup
    }
  }, []);
  const [appStatus, setAppStatus] = useState<AppStatus>('initializing');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [setupDetails, setSetupDetails] = useState<any | null>(null);
  
  const [currentPage, _setCurrentPage] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [adminNotices, setAdminNotices] = useState<AdminNotice[]>([]);
  const [isAutoBipagemActive, setIsAutoBipagemActive] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [allOrders, setAllOrders] = useState<OrderItem[]>([]);
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [skuLinks, setSkuLinks] = useState<SkuLink[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [historyItemToDelete, setHistoryItemToDelete] = useState<ImportHistoryItem | null>(null);
  const [isDeleteHistoryModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  const [scanHistory, setScanHistory] = useState<ScanLogItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [produtosCombinados, setProdutosCombinados] = useState<ProdutoCombinado[]>([]);
  const [weighingBatches, setWeighingBatches] = useState<WeighingBatch[]>([]);
  const [grindingBatches, setGrindingBatches] = useState<GrindingBatch[]>([]);
  const [packGroups, setPackGroups] = useState<StockPackGroup[]>([]);

  // 🔗 States para Seleção Múltipla de SKUs na Importação
  const [isBulkLinkSKUsModalOpen, setIsBulkLinkSKUsModalOpen] = useState(false);
  const [importedSkusForBulkLink, setImportedSkusForBulkLink] = useState<Array<{ sku: string; name: string; price?: number }>>([]);

  const [productionPlans, setProductionPlans] = useState<ProductionPlan[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListItem[]>([]);
  
  const [biData, setBiData] = useState<BiDataItem[]>([]);

  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(defaultGeneralSettings);
  const [etiquetasSettings, setEtiquetasSettings] = useState<ZplSettings>(defaultZplSettings);
  const [uiSettings, setUiSettings] = useState<UiSettings>({
    baseTheme: 'light',
    accentColor: 'indigo',
    customAccentColor: '#4f46e5',
    fontSize: 16,
    soundOnSuccess: true,
    soundOnDuplicate: true,
    soundOnError: true,
  });

  const [etiquetasState, setEtiquetasState] = useState<EtiquetasState>({
    zplInput: '',
    includeDanfe: true,
    zplPages: [],
    previews: [],
    extractedData: new Map(),
    printedIndices: new Set(),
    warnings: []
  });
  const [isProcessingLabels, setIsProcessingLabels] = useState(false);
  const [labelProgressMessage, setLabelProgressMessage] = useState('');
  const [labelProcessingProgress, setLabelProcessingProgress] = useState(0);

  const [etiquetasHistory, setEtiquetasHistory] = useState<EtiquetaHistoryItem[]>([]);
  const [zplToSaveOnScan, setZplToSaveOnScan] = useState<Map<string, string>>(new Map());

  const initialized = useRef(false);

  useEffect(() => {
    // 1. Verificar se há um callback de OAuth na URL (Bling)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    // Check if we are returning from Bling auth
    if (code) {
        console.log("Detectado retorno de autenticação Bling. Redirecionando para página de configuração...");
        _setCurrentPage('bling');
        // Do not process other logic if we have a code, let BlingPage handle it
    } else {
        // 2. Restaurar a última página acessada
        const savedPage = localStorage.getItem('erp_current_page');
        if (savedPage) {
            _setCurrentPage(savedPage);
        }
    }

    try {
        const savedUser = localStorage.getItem('erp_current_user');
        if (savedUser) {
            const user: User = JSON.parse(savedUser);
            setCurrentUser(user);
        }
    } catch (e) {
        localStorage.removeItem('erp_current_user');
    }
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type']) => {
    setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const setCurrentPage = (page: string) => {
        if (currentUser && !canAccessPage(currentUser, page)) {
            const fallbackPage = getFirstAccessiblePage(currentUser, 'dashboard');
            localStorage.setItem('erp_current_page', fallbackPage);
            _setCurrentPage(fallbackPage);
            addToast('Você não tem permissão para acessar essa funcionalidade no seu setor.', 'error');
            return;
        }

    localStorage.setItem('erp_current_page', page);
    _setCurrentPage(page);
  };

    useEffect(() => {
        if (!currentUser) return;
        if (canAccessPage(currentUser, currentPage)) return;

        const fallbackPage = getFirstAccessiblePage(currentUser, 'dashboard');
        localStorage.setItem('erp_current_page', fallbackPage);
        _setCurrentPage(fallbackPage);
    }, [currentUser, currentPage]);

    // 🛡️ PROTEÇÃO: Fazer backup automático de estoque
    useEffect(() => {
        if (stockItems.length > 0) {
            localStorage.setItem('erp_stockItems_backup', JSON.stringify(stockItems));
            localStorage.setItem('erp_stockItems_backup_timestamp', new Date().toISOString());
        }
    }, [stockItems]);
  
  const lowStockItems = useMemo(() => stockItems.filter(i => {
      const current = Number(i.current_qty);
      const min = Number(i.min_qty);
      return i.kind !== 'PRODUTO' && !isNaN(current) && !isNaN(min) && current <= min;
  }), [stockItems]);

  const lowStockCount = lowStockItems.length;
  const bannerNotice = useMemo(() => adminNotices.find(n => n.type === 'banner'), [adminNotices]);

  // IDs de pedidos importados que têm vínculo com o Bling (blingId definido)
  const blingLinkedIds = useMemo(() => {
    return new Set<string>(
      allOrders
        .filter(o => o.blingId)
        .map(o => o.orderId)
        .filter((id): id is string => Boolean(id))
    );
  }, [allOrders]);

    const scannedCodeBuffer = useRef('');
    const lastKeyPressTime = useRef(0);
    const debounceTime = generalSettings.bipagem.debounceTime_ms;

    const handleNewScan = useCallback(async (code: string, user?: User, deductionMode: StockDeductionMode = 'STOCK'): Promise<ScanResult> => {
        const actingUser = user || currentUser;
        if (!actingUser) {
            return { status: 'ERROR', message: 'Nenhum usuário logado.', input_code: code, display_key: code, synced_with_list: false };
        }

        const result = await resolveScan(dbClient, code, actingUser, 'WebApp', users, generalSettings.bipagem, zplToSaveOnScan);

        if(result.scan?.id) {
            // Log UI Update
            const { data: newScanLog } = await dbClient.from('scan_logs').select('*').eq('id', result.scan.id).single();
            if (newScanLog) {
                const newHistoryItem: ScanLogItem = {
                    id: newScanLog.id,
                    time: new Date(newScanLog.scanned_at),
                    userId: newScanLog.user_id,
                    user: newScanLog.user_name,
                    device: newScanLog.device,
                    displayKey: newScanLog.display_key,
                    status: newScanLog.status,
                    synced: newScanLog.synced,
                    canal: newScanLog.canal,
                };
                setScanHistory(prev => [newHistoryItem, ...prev]);
            }

            // Stock Logic based on mode
            if (result.status === 'OK' && result.order_key && result.sku_key) {
                await dbClient.from('orders').update({ status: 'BIPADO', canal: result.channel || undefined }).match({ order_id: result.order_key, sku: result.sku_key });
                setAllOrders(prev => prev.map(o => o.orderId === result.order_key && o.sku === result.sku_key ? {...o, status: 'BIPADO', canal: result.channel || o.canal} : o));

                // Verifica se o grupo completo foi bipado
                const updatedOrders = allOrders.map(o =>
                    o.orderId === result.order_key && o.sku === result.sku_key
                        ? { ...o, status: 'BIPADO' as const }
                        : o
                );
                const groupItems = updatedOrders.filter(o => o.orderId === result.order_key);
                const isGroupComplete = groupItems.length > 0 && groupItems.every(o => o.status === 'BIPADO');
                if (isGroupComplete) {
                    result.groupComplete = true;
                    result.groupSize = groupItems.length;
                    if (groupItems.length > 1) {
                        addToast(`Pedido ${result.order_key} completo! Todos os ${groupItems.length} itens bipados.`, 'success');
                    }
                }

                // Find Master SKU
                const linkedSku = skuLinks.find(l => l.importedSku.toUpperCase() === result.sku_key?.toUpperCase());
                const masterSku = linkedSku ? linkedSku.masterProductSku : result.sku_key;

                if (masterSku) {
                    const product = stockItems.find(i => i.code === masterSku);
                    if (product) {
                        // Apply deduction logic
                        if (deductionMode === 'STOCK') {
                            // Simple deduction from shelf stock
                            await dbClient.rpc('adjust_stock_quantity', {
                                item_code: masterSku,
                                quantity_delta: -1,
                                origin_text: 'BIP',
                                ref_text: `Pedido ${result.order_key} (Estoque)`,
                                user_name: actingUser.name
                            });
                        } else if (deductionMode === 'PRODUCTION') {
                            // "Daily Production": Record production (consumes BOM, adds +1) then deduct (-1)
                            // This ensures raw materials are consumed but finished stock count remains net 0 change (made & shipped)
                            // Step 1: Record Production (Consumes Insumos, Adds 1 Product)
                            await dbClient.rpc('record_production_run', {
                                item_code: masterSku,
                                quantity_to_produce: 1,
                                ref_text: `Produção Pedido ${result.order_key}`,
                                user_name: actingUser.name
                            });
                            // Step 2: Deduct Product (Ships 1 Product)
                            await dbClient.rpc('adjust_stock_quantity', {
                                item_code: masterSku,
                                quantity_delta: -1,
                                origin_text: 'BIP',
                                ref_text: `Envio Pedido ${result.order_key}`,
                                user_name: actingUser.name
                            });
                        }
                    }
                }
            }
        }
        return result;
    }, [currentUser, users, generalSettings.bipagem, zplToSaveOnScan, skuLinks, stockItems, allOrders, addToast]);

    const handleStageZplForSaving = (zplMap: Map<string, string>) => {
        setZplToSaveOnScan(prev => new Map([...prev, ...zplMap]));
        addToast(`${zplMap.size} etiquetas preparadas para associação na bipagem.`, 'success');
    };

    const processGlobalScan = useCallback(async (code: string) => {
        if (!currentUser) {
            addToast('Faça login para usar a bipagem.', 'error');
            return;
        }

        const result = await handleNewScan(code);

        if (result.status === 'OK') {
            addToast(`Bipado: ${result.display_key}`, 'success');
            if (uiSettings.soundOnSuccess) playSound('success');
        } else if (result.status === 'DUPLICATE') {
            addToast(`Duplicado: ${result.display_key}`, 'error');
            if (uiSettings.soundOnDuplicate) playSound('duplicate');
        } else {
            addToast(`Erro: ${result.message}`, 'error');
            if (uiSettings.soundOnError) playSound('error');
        }

    }, [currentUser, handleNewScan, uiSettings, addToast]);

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            if (!isAutoBipagemActive) return;

            const target = event.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
                return;
            }

            const currentTime = Date.now();
            if (currentTime - lastKeyPressTime.current > debounceTime) {
                scannedCodeBuffer.current = '';
            }
            lastKeyPressTime.current = currentTime;

            if (event.key === 'Enter') {
                if (scannedCodeBuffer.current.length > 2) {
                    processGlobalScan(scannedCodeBuffer.current);
                }
                scannedCodeBuffer.current = '';
            } else if (event.key.length === 1) {
                scannedCodeBuffer.current += event.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isAutoBipagemActive, debounceTime, processGlobalScan]);


    const handleSaveUiSettings = async (newSettings: UiSettings) => {
        if (!currentUser) return;
        
        setUiSettings(newSettings);

        const { data, error } = await dbClient
            .from('users')
            .update({ ui_settings: newSettings as any })
            .eq('id', currentUser.id)
            .select()
            .single();

        if (error) {
            addToast('Erro ao salvar configurações de aparência.', 'error');
            setUiSettings(uiSettings); 
        } else {
            addToast('Configurações salvas com sucesso!', 'success');
            setCurrentUser(prev => prev ? { ...prev, ui_settings: newSettings } : null);
        }
    };

    const handleSaveGeneralSettings = async (settingsUpdater: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => {
        const newSettings = typeof settingsUpdater === 'function'
            ? settingsUpdater(generalSettings)
            : settingsUpdater;
        
        if (!newSettings) {
            addToast('Erro ao salvar: configurações inválidas.', 'error');
            return;
        }

        setGeneralSettings(newSettings);
        
        const { error } = await dbClient
            .from('app_settings')
            .upsert({ key: 'general', value: newSettings as any });

        if (error) {
            addToast('Erro ao salvar configurações gerais.', 'error');
        } else {
            addToast('Configurações gerais salvas com sucesso!', 'success');
        }
    };

    const handleSaveDashboardConfig = (newDashboardConfig: DashboardWidgetConfig) => {
        handleSaveGeneralSettings(prev => ({ ...prev, dashboard: newDashboardConfig }));
    };

    const handleSaveEtiquetasSettings = async (newSettings: ZplSettings) => {
        setEtiquetasSettings(newSettings);
        const { error } = await dbClient
            .from('app_settings')
            .upsert({ key: 'etiquetas', value: newSettings as any });

        if (error) {
            addToast('Erro ao salvar configurações de etiquetas.', 'error');
            setEtiquetasSettings(etiquetasSettings);
        } else {
            addToast('Configurações de etiquetas salvas com sucesso!', 'success');
        }
    };

    const handleSaveNotice = async (notice: AdminNotice) => {
        const { error } = await dbClient.from('admin_notices').insert({
            id: notice.id,
            text: notice.text,
            level: notice.level,
            type: notice.type,
            created_by: notice.createdBy,
            created_at: notice.createdAt,
        });

        if (error) {
            addToast('Erro ao salvar aviso.', 'error');
        } else {
            setAdminNotices(prev => [...prev, notice]);
        }
    };

    const handleDeleteNotice = async (noticeId: string) => {
        const { error } = await dbClient.from('admin_notices').delete().eq('id', noticeId);

        if (error) {
            addToast('Erro ao remover aviso.', 'error');
        } else {
            setAdminNotices(prev => prev.filter(n => n.id !== noticeId));
        }
    };

    // New Function to handle saving pack groups
    const loadPackGroups = useCallback(async () => {
        const { data } = await dbClient.from('stock_pack_groups').select('*');
        if (data) setPackGroups(data);
    }, []);

    const handleSavePackGroup = async (group: Omit<StockPackGroup, 'id'>, id?: string) => {
        if (id) {
            await dbClient.from('stock_pack_groups').update(group).eq('id', id);
        } else {
            await dbClient.from('stock_pack_groups').insert(group);
        }
        await loadPackGroups();
        addToast('Grupo de Pacotes salvo!', 'success');
    };

    const loadData = useCallback(async () => {
        if (!currentUser) {
            console.warn('⚠️ Sem currentUser em loadData, abortando');
            return;
        }
        try {
            console.log(`📥 [loadData] ============ INICIANDO CARREGAMENTO ============`);
            console.log(`👤 [loadData] Usuário: ${currentUser.name}`);
            console.log(`🔗 [loadData] URL Supabase: ${supabaseUrl}`);
            
            // Using fetchAll to bypass 1000 row limit for critical tables
            const ordersData = await fetchAll('orders', { orderBy: 'created_at', ascending: false });
            const scanLogsData = await fetchAll('scan_logs', { orderBy: 'created_at', ascending: false });
            
            console.log(`✅ [fetchAll] Orders carregados: ${ordersData?.length || 0} registros`);
            console.log(`✅ [fetchAll] Scan logs carregados: ${scanLogsData?.length || 0} registros`);

            const queries = [
                // dbClient.from('orders').select('*').order('created_at', { ascending: false }).limit(100000), // Replaced by fetchAll
                dbClient.from('returns').select('*').order('created_at', { ascending: false }).limit(5000),
                dbClient.from('sku_links').select('*'),
                // dbClient.from('scan_logs').select('*').order('created_at', { ascending: false }).limit(50000), // Replaced by fetchAll
                dbClient.from('users').select('*'),
                dbClient.from('product_boms').select('*').order('name', { ascending: true }),
                dbClient.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(20000),
                dbClient.from('stock_items').select('*'),
                dbClient.from('weighing_batches').select('*').order('created_at', { ascending: false }).limit(5000),
                dbClient.from('grinding_batches').select('*').order('created_at', { ascending: false }).limit(5000),
                dbClient.from('production_plans').select('*').order('created_at', { ascending: false }),
                dbClient.from('shopping_list_items').select('*'),
                dbClient.from('app_settings').select('*'),
                dbClient.from('admin_notices').select('*'),
                dbClient.from('import_history').select('id, file_name, processed_at, user_name, item_count, unlinked_count, canal').order('processed_at', { ascending: false }).limit(5000),
                dbClient.from('production_plan_items').select('*'),
                dbClient.from('etiquetas_historico').select('id, created_at, created_by_name, page_count').order('created_at', { ascending: false }).limit(200),
                dbClient.from('vw_dados_analiticos').select('*'),
                dbClient.from('stock_pack_groups').select('*'),
            ];
            
            const tableNames = ['returns', 'skuLinks', 'users', 'stockItems', 'stockMovements', 'rawMaterials', 'weighingBatches', 'grindingBatches', 'productionPlans', 'shoppingList', 'settings', 'notwenes', 'importHistory', 'productionPlanItems', 'etiquetasHistory', 'biData', 'packGroups'];

            const results = await Promise.allSettled(queries);

            const dataMap: { [key: string]: any[] } = {};

            results.forEach((result, index) => {
                const tableName = tableNames[index];
                if (result.status === 'fulfilled') {
                    const { data, error } = result.value;
                    if (error) {
                        console.error(`❌ [loadData] ERRO em ${tableName}:`, error.message || error);
                    } else if (!data) {
                        console.warn(`⚠️ [loadData] ${tableName}: dados null/undefined`);
                    } else if (Array.isArray(data) && data.length === 0) {
                        console.warn(`⚠️ [loadData] ${tableName}: VAZIO (0 registros)`);
                    } else {
                        dataMap[tableName] = data;
                        console.log(`✅ [loadData] ${tableName}: ${data?.length || 0} registros`);
                    }
                } else {
                    console.error(`❌ [loadData] ${tableName} rejeitado:`, result.reason);
                }
            });
            
            // Set data from fetchAll
            setAllOrders(ordersData.map((o: any) => ({ id: o.id, orderId: o.order_id, tracking: o.tracking, sku: o.sku, qty_original: Number(o.qty_original || 0), multiplicador: Number(o.multiplicador || 0), qty_final: Number(o.qty_final || 0), color: o.color, canal: o.canal, data: o.data, created_at: o.created_at, status: o.status, error_reason: o.error_reason, customer_name: o.customer_name, customer_cpf_cnpj: o.customer_cpf_cnpj, resolution_details: o.resolution_details, price_gross: o.price_gross, platform_fees: o.platform_fees, shipping_fee: o.shipping_fee, price_net: o.price_net, data_prevista_envio: o.data_prevista_envio })));
            setScanHistory(scanLogsData.map((s: any) => ({ id: s.id, time: safeNewDate(s.scanned_at), userId: s.user_id, user: s.user_name, device: s.device, displayKey: s.display_key, status: s.status, synced: s.synced, canal: s.canal })));

            if (dataMap.returns) setReturns(dataMap.returns.map((r: any) => ({ id: r.id, tracking: r.tracking, customer_name: r.customer_name, loggedById: r.logged_by_id, loggedBy: r.logged_by_name, loggedAt: safeNewDate(r.logged_at), order_id: r.order_id })));
            if (dataMap.skuLinks) setSkuLinks(dataMap.skuLinks.map((l: any) => ({ importedSku: l.imported_sku, masterProductSku: l.master_product_sku })));
            if (dataMap.users) setUsers(dataMap.users as User[]);
            
            // 🛡️ PROTEÇÃO: Carregar product_boms + stock_items mesmo quando uma das tabelas vier vazia
            if (
                (dataMap.stockItems && Array.isArray(dataMap.stockItems)) ||
                (dataMap.rawMaterials && Array.isArray(dataMap.rawMaterials))
            ) {
                const mappedStockItems = (dataMap.stockItems || []).map((i: any) => {
                    try {
                        return {
                            id: i.id,
                            code: i.code,
                            name: i.name,
                            kind: i.kind || 'PRODUTO',
                            unit: i.unit || 'un',
                            current_qty: Number(i.current_qty) || 0,
                            reserved_qty: Number(i.reserved_qty) || 0,
                            ready_qty: Number(i.ready_qty) || 0,
                            category: i.category || '',
                            min_qty: Number(i.min_qty) || 0,
                            expedition_items: [],
                        };
                    } catch (err) {
                        console.error('❌ Erro ao mapear product_bom:', i, err);
                        return null;
                    }
                }).filter((item: any) => item !== null);

                // 🔧 Combinar com stock_items (insumos) se houver
                let allStockItems = mappedStockItems;
                if (dataMap.rawMaterials && Array.isArray(dataMap.rawMaterials)) {
                    const mappedRawMaterials = dataMap.rawMaterials.map((i: any) => {
                        try {
                            return {
                                id: i.id,
                                code: i.code,
                                name: i.name,
                                kind: i.kind || 'INSUMO',
                                unit: i.unit || 'un',
                                current_qty: Number(i.current_qty) || 0,
                                reserved_qty: Number(i.reserved_qty) || 0,
                                ready_qty: Number(i.ready_qty) || 0,
                                category: i.category || '',
                                min_qty: Number(i.min_qty) || 0,
                                expedition_items: i.expedition_items || [],
                            };
                        } catch (err) {
                            console.error('❌ Erro ao mapear insumo:', i, err);
                            return null;
                        }
                    }).filter((item: any) => item !== null);

                    allStockItems = [...mappedStockItems, ...mappedRawMaterials].sort((a,b) => a.name.localeCompare(b.name));
                    console.log(`💾 [loadData] Combinados: ${mappedStockItems.length} product_boms + ${mappedRawMaterials.length} insumos = ${allStockItems.length} total`);
                }
                
                if (allStockItems.length > 0) {
                    console.log(`💾 [loadData] Salvando ${allStockItems.length} itens no estoque (produtos + insumos)`);
                    setStockItems(allStockItems);
                } else {
                    console.warn('⚠️ [loadData] Nenhum item válido após mapeamento. Mantendo dados anteriores.');
                }
            } else {
                console.warn(`⚠️ [loadData] product_boms e stock_items sem dados válidos da query.`);
            }
            
            if (dataMap.packGroups) setPackGroups(dataMap.packGroups);
            
            if (dataMap.stockMovements) setStockMovements(dataMap.stockMovements.map((m: any) => ({ id: m.id, stockItemCode: m.stock_item_code, stockItemName: m.stock_item_name, origin: m.origin, qty_delta: parseFloat(m.qty_delta) || 0, ref: m.ref, createdAt: safeNewDate(m.created_at), createdBy: m.created_by_name, fromWeighing: m.from_weighing, productSku: m.product_sku })));
            if (dataMap.weighingBatches) setWeighingBatches(dataMap.weighingBatches.map((wb: any) => ({ id: wb.id, stock_item_code: wb.stock_item_code, stock_item_name: wb.stock_item_name, initialQty: parseFloat(wb.initial_qty) || 0, used_qty: parseFloat(wb.used_qty) || 0, createdAt: safeNewDate(wb.created_at), userId: wb.created_by_id, createdBy: wb.created_by_name, weighingType: wb.weighing_type })));
            
            if (dataMap.grindingBatches) setGrindingBatches(dataMap.grindingBatches.map((gb: any) => ({ 
                id: gb.id, 
                sourceInsumoCode: gb.source_insumo_code, 
                sourceInsumoName: gb.source_insumo_name, 
                sourceQtyUsed: parseFloat(gb.source_qty_used) || 0, 
                outputInsumoCode: gb.output_insumo_code, 
                outputInsumoName: gb.output_insumo_name, 
                outputQtyProduced: parseFloat(gb.output_qty_produced) || 0, 
                createdAt: safeNewDate(gb.created_at), 
                userId: gb.user_id, 
                userName: gb.user_name, 
                mode: gb.mode 
            })));
            
            const planItemsData = dataMap.productionPlanItems;
            const plansData = dataMap.productionPlans;
            if (plansData && planItemsData) {
                const planItemsMap = new Map<string, any[]>();
                planItemsData.forEach((item: any) => {
                    if (!planItemsMap.has(item.plan_id)) planItemsMap.set(item.plan_id, []);
                    planItemsMap.get(item.plan_id)!.push(item);
                });
                setProductionPlans(plansData.map((p: any) => ({ id: p.id, name: p.name, createdAt: p.created_at, createdBy: p.created_by, status: p.status, parameters: p.parameters, items: planItemsMap.get(p.id) || [], planDate: p.plan_date })));
            }

            if (dataMap.shoppingList) setShoppingList(dataMap.shoppingList.map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit, is_purchased: i.is_purchased })));
            if (dataMap.notices) setAdminNotices(dataMap.notices.map((n: any) => ({ id: n.id, text: n.text, level: n.level, type: n.type, created_by: n.created_at, created_at: n.created_at })));
            if (dataMap.importHistory) setImportHistory(dataMap.importHistory.map((h: any) => ({ id: h.id, fileName: h.file_name, processedAt: h.processed_at, user: h.user_name, itemCount: h.item_count, unlinkedCount: h.unlinked_count, processed_data: h.processed_data, canal: h.canal })));
            if (dataMap.etiquetasHistory) setEtiquetasHistory(dataMap.etiquetasHistory as EtiquetaHistoryItem[]);
            if (dataMap.biData) setBiData(dataMap.biData as BiDataItem[]);

            if (dataMap.settings) {
                const settingsMap = new Map(dataMap.settings.map((s: any) => [s.key, s.value]));
                const general = settingsMap.get('general') as Partial<GeneralSettings> | undefined;
                if (general) {
                    setGeneralSettings(prev => ({
                        ...prev,
                        ...general,
                        bipagem: { ...prev.bipagem, ...(general.bipagem || {}) },
                        etiquetas: { ...prev.etiquetas, ...(general.etiquetas || {}) },
                        estoque: { ...prev.estoque, ...(general.estoque || {}) },
                        dashboard: { ...prev.dashboard, ...(general.dashboard || {}) },
                        expeditionRules: {
                            packagingRules: Array.isArray(general.expeditionRules?.packagingRules) ? general.expeditionRules.packagingRules : [],
                            miudosPackagingRules: Array.isArray(general.expeditionRules?.miudosPackagingRules) ? general.expeditionRules.miudosPackagingRules : []
                        },
                        importer: { ...prev.importer, ...(general.importer || {}) },
                        pedidos: { ...prev.pedidos, ...(general.pedidos || {}) },
                        productCategoryList: Array.isArray(general.productCategoryList) ? general.productCategoryList : prev.productCategoryList,
                        insumoCategoryList: Array.isArray(general.insumoCategoryList) ? general.insumoCategoryList : prev.insumoCategoryList,
                    }));
                }
                const etiquetas = settingsMap.get('etiquetas') as Partial<ZplSettings> | undefined;
                if (etiquetas) {
                    setEtiquetasSettings(prev => ({ ...prev, ...etiquetas }));
                }
            }

            if (currentUser.ui_settings) {
                setUiSettings(s => ({...s, ...(currentUser.ui_settings as object)}));
            }
            
            console.log(`📊 [loadData] RESUMO FINAL:`);
            console.log(`   • product_boms (produtos): ${dataMap.stockItems?.length || '❌ 0 ou undefined'} registros`);
            console.log(`   • skuLinks: ${dataMap.skuLinks?.length || 0} registros`);
            console.log(`   • users: ${dataMap.users?.length || 0} registros`);
            console.log(`   • orders: ${ordersData?.length || 0} registros`);
            if (dataMap.stockItems && dataMap.stockItems.length > 0) {
                console.log(`   ✅ ESTOQUE CARREGADO COM SUCESSO`);
            } else {
                console.error(`   ❌ ATENÇÃO: NENHUM PRODUTO CARREGADO!`);
                console.error(`   Possíveis causas:`);
                console.error(`   1️⃣ Tabela product_boms vazia no banco`);
                console.error(`   2️⃣ Erro de RLS (Row Level Security)`);
                console.error(`   3️⃣ Tipo de usuário sem permissão de leitura`);
            }
            console.log(`📥 [loadData] ============ FIM DO CARREGAMENTO ============`);
            setAppStatus('ready');
        } catch (e: any) {
            console.error('❌ [loadData] EXCEÇÃO GERAL:', e?.message || e);
            console.error('Stack:', e?.stack);
            setAppStatus('error');
        }
    }, [currentUser]);
    
    const handleSaveEtiquetaHistory = useCallback(async (historyItem: Omit<EtiquetaHistoryItem, 'id' | 'created_at'>) => {
        const { data, error } = await dbClient.from('etiquetas_historico').insert(historyItem as any).select().single();
        if (!error) {
            setEtiquetasHistory(prev => [data as EtiquetaHistoryItem, ...prev]);
        }
    }, []);

    const handleGetEtiquetaHistoryDetails = useCallback(async (id: string): Promise<EtiquetaHistoryItem | null> => {
        const { data, error } = await dbClient.from('etiquetas_historico').select('*').eq('id', id).single();
        return error ? null : data as EtiquetaHistoryItem;
    }, []);

    // NEW: Moved ZPL Processing logic to App to support background execution
    const handleProcessZpl = useCallback(async (mode: 'completo' | 'rapido') => {
        setIsProcessingLabels(true);
        setLabelProgressMessage('Iniciando processamento...');
        setLabelProcessingProgress(0);

        const zplToProcess = etiquetasState.zplInput;
        const historyItem = etiquetasHistory.find(h => h.zpl_content === zplToProcess);
        const printedHashes = new Set<string>(historyItem?.page_hashes || []);
        
        // Count errors for summary
        let errorCount = 0;

        if (mode === 'rapido') {
            setEtiquetasState(prev => ({ ...prev, includeDanfe: false }));
        } else {
            setEtiquetasState(prev => ({ ...prev, includeDanfe: true }));
        }

        const processor = processZplStream(zplToProcess, etiquetasSettings, generalSettings, allOrders, mode, printedHashes);

        try {
            for await (const result of processor) {
                switch (result.type) {
                    case 'progress':
                        setLabelProgressMessage(result.message);
                        break;
                    case 'start':
                        if (result.warnings.length > 0) {
                            setEtiquetasState(prev => ({ ...prev, warnings: result.warnings }));
                        }
                        if (result.hasMlWithoutDanfe) {
                            setEtiquetasState(prev => ({ ...prev, includeDanfe: false }));
                        }
                        setEtiquetasState(prev => ({
                            ...prev,
                            zplPages: result.zplPages,
                            extractedData: result.extractedData,
                            previews: new Array(result.zplPages.length).fill('')
                        }));
                        
                        const newPrintedIndices = new Set<number>();
                        if (result.printedStatus) {
                            result.printedStatus.forEach((isPrinted: boolean, index: number) => {
                                if (isPrinted) {
                                    newPrintedIndices.add(index);
                                }
                            });
                        }
                        setEtiquetasState(prev => ({ ...prev, printedIndices: newPrintedIndices }));
                        break;
                    case 'preview':
                        if (result.preview === 'ERROR') {
                            errorCount++;
                        }
                        setEtiquetasState(prev => {
                            const newPreviews = [...prev.previews];
                            newPreviews[result.index] = result.preview;
                            const progress = Math.round(((result.index + 1) / prev.zplPages.length) * 100);
                            setLabelProcessingProgress(progress);
                            return { ...prev, previews: newPreviews };
                        });
                        break;
                    case 'done':
                        setLabelProgressMessage('Concluído');
                        setLabelProcessingProgress(100);
                        break;
                    case 'error':
                        alert(`Ocorreu um erro: ${result.message}`);
                        break;
                }
            }
            
            // Notify completion
            if (errorCount > 0) {
                addToast(`Processamento concluído com ${errorCount} erros de renderização. Verifique as etiquetas.`, 'error');
                if (uiSettings.soundOnError) playSound('error');
            } else {
                addToast('Processamento de etiquetas concluído com sucesso!', 'success');
                if (uiSettings.soundOnSuccess) playSound('success');
            }

        } catch (error) {
            console.error("Erro no processamento ZPL:", error);
            addToast('Erro crítico no processamento de etiquetas.', 'error');
        } finally {
            setIsProcessingLabels(false);
            setLabelProgressMessage('');
            setLabelProcessingProgress(0);
        }
    }, [etiquetasState.zplInput, etiquetasSettings, generalSettings, allOrders, etiquetasHistory, uiSettings, addToast]);

    const handleGetImportHistoryDetails = useCallback(async (id: string): Promise<ProcessedData | null> => {
        const { data, error } = await dbClient.from('import_history').select('processed_data').eq('id', id).single();
        return error ? null : data.processed_data;
    }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { setupNeeded, error, details } = await verifyDatabaseSetup();
        if (error) { setAppStatus('error'); return; }
        if (setupNeeded) { setSetupDetails(details); setAppStatus('needs_setup'); } else { setAppStatus('ready'); }
      } catch (e) { setAppStatus('error'); }
    };
    initializeApp();
  }, []);
  
    useEffect(() => {
        const root = document.documentElement;
        const effectiveTheme = uiSettings.baseTheme === 'system'
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
            : uiSettings.baseTheme;
        root.classList.remove('theme-light', 'theme-dark');
        root.classList.add(`theme-${effectiveTheme}`);
        root.classList.remove('accent-indigo', 'accent-emerald', 'accent-fuchsia', 'accent-orange', 'accent-slate', 'accent-custom');
        root.classList.add(`accent-${uiSettings.accentColor}`);
    }, [uiSettings.baseTheme, uiSettings.accentColor, uiSettings.customAccentColor]);

  useEffect(() => {
    if (currentUser && !initialized.current) {
        initialized.current = true;
        loadData();
    }
  }, [currentUser, loadData]);

    const handleSaveExpeditionItems = async (productCode: string, items: { stockItemCode: string; qty_per_pack: number }[]) => {
        // Nota: expedition_items é um conceito de stock_items (matérias-primas), não de product_boms
        // Se precisar, implementar em stock_items futuramente
        console.warn('⚠️ [handleSaveExpeditionItems] Funcionalidade não disponível para product_boms');
        addToast('Funcionalidade em desenvolvimento', 'warning');
    };
    
  const handleSaveProdutoCombinado = useCallback(async (productSku: string, newBomItems: ProdutoCombinado['items']) => {
      const payload = {
        bom_composition: { items: newBomItems } as any,
        updated_at: Date.now(),
      };
      const { error } = await dbClient.from('product_boms').update(payload).eq('code', productSku);
        if (!error) {
            setProdutosCombinados(prev => {
                const existing = prev.find(b => b.productSku === productSku);
                return existing ? prev.map(b => b.productSku === productSku ? { ...b, items: newBomItems } : b) : [...prev, { productSku, items: newBomItems }];
            });
            addToast('Receita (BOM) salva!', 'success');
        }
    }, [addToast]);
    
  const handleAddNewItem = useCallback(async (item: Omit<StockItem, 'id'>): Promise<StockItem | null> => {
        try {
            // Validações básicas
            if (!item.name || !item.name.trim()) {
                console.error('❌ Erro: Nome do produto é obrigatório');
                addToast('Nome do produto é obrigatório.', 'error');
                return null;
            }
            if (!item.code || !item.code.trim()) {
                console.error('❌ Erro: Código/SKU é obrigatório');
                addToast('Código/SKU é obrigatório.', 'error');
                return null;
            }
            
            // Verificar se código já existe
            const existingItem = stockItems.find(i => i.code.toUpperCase() === item.code.trim().toUpperCase());
            if (existingItem) {
                console.error('❌ Erro: Código já existe:', item.code);
                addToast(`Código "${item.code}" já existe no estoque.`, 'error');
                return null;
            }
            
            // Gerar ID único
            const now = Date.now();
            let itemWithId: any = {
                id: generateId(),
                name: item.name.trim(),
                code: item.code.trim(),
                kind: item.kind,
                unit: item.unit || 'un',
                category: item.category || '',
                current_qty: item.current_qty || 0,
                reserved_qty: item.reserved_qty || 0,
                created_at: now,
                updated_at: now,
            };

            // Filtrar campos específicos por tipo
            if (item.kind === 'INSUMO') {
                itemWithId.min_qty = item.min_qty || 0;
                if (item.barcode) itemWithId.barcode = item.barcode;
                console.log(`📥 [handleAddNewItem] Preparando INSUMO:`, itemWithId);
            } else {
                itemWithId.ready_qty = item.ready_qty || 0;
                itemWithId.min_qty = item.min_qty || 0;
                console.log(`📥 [handleAddNewItem] Preparando ${item.kind}:`, itemWithId);
            }
            
            // Determinar tabela de destino based on kind
            const targetTable = item.kind === 'INSUMO' ? 'stock_items' : 'product_boms';
            console.log(`📥 [handleAddNewItem] Salvando novo item (${item.kind}) em ${targetTable}`);
            
            const { data, error } = await dbClient
                .from(targetTable)
                .insert(itemWithId as any)
                .select()
                .single();
            
            if (error) {
                console.error(`❌ [handleAddNewItem] Erro ao salvar em ${targetTable}:`, error.message);
                addToast(`Erro ao criar item: ${error.message}`, 'error');
                return null;
            }
            
            if (!data) {
                console.error('❌ [handleAddNewItem] Nenhum dado retornado');
                addToast('Erro ao criar item: resposta vazia.', 'error');
                return null;
            }
            
            const newItem = { ...data, expedition_items: data.expedition_items || [] } as StockItem;
            setStockItems(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            
            console.log(`✅ [handleAddNewItem] Item criado em ${targetTable} e adicionado ao estado local`);
            addToast('Item criado com sucesso!', 'success');
            
            return newItem;
        } catch (err: any) {
            console.error('❌ [handleAddNewItem] Exceção:', err.message);
            addToast(`Erro: ${err.message || 'Verifique o banco de dados'}`, 'error');
            return null;
        }
    }, [addToast, stockItems]);

    const handleAddNewWeighing = useCallback(async (insumoCode: string, quantity: number, type: WeighingType, userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user) return;
        const { error } = await dbClient.rpc('record_weighing_and_deduct_stock', { item_code: insumoCode, quantity_to_weigh: quantity, weighing_type_text: type, user_id: user.id, user_name: user.name });
        if (!error) { loadData(); addToast('Pesagem registrada!', 'success'); }
    }, [users, addToast, loadData]);

    const handleAddNewGrinding = useCallback(async (data: { sourceCode: string, sourceQty: number, outputCode: string, outputName: string, outputQty: number, mode: 'manual' | 'automatico', userId?: string, userName: string }) => {
        const { error } = await dbClient.rpc('record_grinding_run', { source_code: data.sourceCode, source_qty: data.sourceQty, output_code: data.outputCode, output_name: data.outputName, output_qty: data.outputQty, op_mode: data.mode, op_user_id: data.userId, op_user_name: data.userName });
        if (!error) { loadData(); addToast('Moagem registrada!', 'success'); }
    }, [addToast, loadData]);

    const handleDeleteGrindingBatch = useCallback(async (batchId: string): Promise<boolean> => {
        const { error } = await dbClient.from('grinding_batches').delete().eq('id', batchId);
        if(!error) { loadData(); addToast('Lote excluído.', 'success'); return true; }
        return false;
    }, [addToast, loadData]);

    const handleDeleteWeighingBatch = useCallback(async (batchId: string): Promise<boolean> => {
        const { error } = await dbClient.from('weighing_batches').delete().eq('id', batchId);
        if (!error) {
            loadData();
            addToast('Lote de pesagem excluído.', 'success');
            return true;
        }
        return false;
    }, [addToast, loadData]);
    
  const handleUpdateUser = useCallback(async (user: User): Promise<boolean> => {
        const { id, ...updateData } = user;
        const { error } = await dbClient.from('users').update(updateData as any).eq('id', id);
        if (!error) {
            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updateData } : u));
            if (currentUser?.id === id) setCurrentUser(prev => prev ? {...prev, ...updateData} : null);
            addToast('Usuário atualizado!', 'success');
            return true;
        }
        return false;
    }, [addToast, currentUser]);

  const handleCancelBipagem = useCallback(async (scanId: string) => {
        if (!currentUser) return;
        const { error } = await dbClient.rpc('cancel_scan_id_and_revert_stock', { scan_id_to_cancel: scanId, user_name: currentUser.name });
        if (!error) { addToast('Bipagem cancelada!', 'success'); loadData(); }
    }, [currentUser, addToast, loadData]);

  const handleBulkCancelBipagem = useCallback(async (scanIds: string[]) => {
        if (!currentUser) return;
        for (const id of scanIds) await dbClient.rpc('cancel_scan_id_and_revert_stock', { scan_id_to_cancel: id, user_name: currentUser.name });
        addToast(`${scanIds.length} bipagens canceladas!`, 'success');
        loadData();
    }, [currentUser, addToast, loadData]);

    const handleHardDeleteScanLog = useCallback(async (scanId: string) => {
        const { error } = await dbClient.from('scan_logs').delete().eq('id', scanId);
        if (!error) { addToast('Registro excluído!', 'success'); loadData(); }
    }, [addToast, loadData]);

    const handleBulkHardDeleteScanLog = useCallback(async (scanIds: string[]) => {
        const { error } = await dbClient.from('scan_logs').delete().in('id', scanIds);
        if (!error) { addToast('Registros excluídos!', 'success'); loadData(); }
    }, [addToast, loadData]);

  const handleAddNewUser = useCallback(async (name: string, setor: UserSetor[], role: UserRole, email?: string, password?: string): Promise<{ success: boolean; message?: string; }> => {
        const payload: any = { name, setor, role, email: email || null };
        if (password) payload.password = password;
        const { error } = await dbClient.from('users').insert(payload);
        if (error) return { success: false, message: 'Falha ao adicionar.' };
        loadData(); addToast('Usuário adicionado.', 'success');
        return { success: true };
    }, [addToast, loadData]);

  const handleSyncPending = useCallback(async () => {
    addToast('Sincronizando...', 'info');
    const { data: pendingScans } = await dbClient.from('scan_logs').select('*').eq('status', 'NOT_FOUND');
    if (!pendingScans || pendingScans.length === 0) return;
    for (const scan of pendingScans) {
        const { data: orderData } = await dbClient.from('orders').select('*').or(`order_id.eq.${scan.display_key},tracking.eq.${scan.display_key}`).limit(1).single();
        if (orderData && orderData.status === 'NORMAL') {
            await dbClient.from('scan_logs').update({ status: 'OK', synced: true, canal: orderData.canal }).eq('id', scan.id);
            await dbClient.from('orders').update({ status: 'BIPADO' }).eq('id', orderData.id);
        }
    }
    loadData(); addToast('Sincronização concluída!', 'success');
  }, [addToast, loadData]);

  const handleLogError = useCallback(async (orderIdentifier: string, reason: string): Promise<boolean> => {
        const { error } = await dbClient.from('orders').update({ status: 'ERRO', error_reason: reason }).or(`order_id.eq.${orderIdentifier},tracking.eq.${orderIdentifier}`);
        if(!error) { loadData(); addToast('Falha registrada.', 'success'); return true; }
        return false;
    }, [addToast, loadData]);

  const handleLogReturn = useCallback(async (tracking: string, customerName: string): Promise<boolean> => {
        if(!currentUser) return false;
        const orderToReturn = allOrders.find(o => o.tracking === tracking);
        if (!orderToReturn) return false;
        const { error } = await dbClient.from('returns').insert({ tracking, customer_name: customerName, logged_by_id: currentUser.id, logged_by_name: currentUser.name, logged_at: new Date().toISOString(), order_id: orderToReturn.id });
        if(!error) { await dbClient.from('orders').update({ status: 'DEVOLVIDO' }).eq('id', orderToReturn.id); loadData(); addToast('Devolução registrada.', 'success'); return true; }
        return false;
    }, [currentUser, allOrders, addToast, loadData]);

  const handleDeleteOrders = useCallback(async (orderIds: string[]) => {
        if (orderIds.length === 0) return;
        const { error } = await dbClient.rpc('delete_orders', { order_ids: orderIds });
        if(!error) { 
            await loadData(); // Force reload to update UI
            addToast(`${orderIds.length} pedidos excluídos.`, 'success'); 
        } else {
            addToast(`Erro ao excluir pedidos: ${error.message}`, 'error');
            // Try to recover if RPC is missing (rare case but good fallback)
            if (error.code === '42883') { // Undefined function
                 addToast('Função de exclusão não encontrada. Sincronize o banco nas configurações.', 'error');
            }
        }
    }, [addToast, loadData]);

  const handleUpdateStatus = useCallback(async (orderIds: string[], newStatus: OrderStatusValue): Promise<boolean> => {
        const { error } = await dbClient.from('orders').update({ status: newStatus }).in('id', orderIds);
        if(!error) { loadData(); addToast('Status atualizado.', 'success'); return true; }
        return false;
    }, [addToast, loadData]);

  const handleRemoveReturn = useCallback(async (returnId: string): Promise<boolean> => {
        const returnItem = returns.find(r => r.id === returnId);
        if (!returnItem) return false;
        const { error } = await dbClient.from('returns').delete().eq('id', returnId);
        if(!error) { await dbClient.from('orders').update({ status: 'NORMAL' }).eq('tracking', returnItem.tracking); loadData(); addToast('Devolução removida.', 'success'); return true; }
        return false;
    }, [returns, addToast, loadData]);

  const handleSolveOrders = useCallback(async (orderIds: string[], resolution: Omit<OrderResolutionDetails, 'resolved_by' | 'resolved_at'>): Promise<boolean> => {
        if(!currentUser) return false;
        const resolution_details = { ...resolution, resolved_by: currentUser.name, resolved_at: new Date().toISOString() };
        const { error } = await dbClient.from('orders').update({ status: 'SOLUCIONADO', resolution_details: resolution_details as any }).in('id', orderIds);
        if(!error) { loadData(); addToast('Solucionado.', 'success'); return true; }
        return false;
    }, [currentUser, addToast, loadData]);

  const handleBackupData = useCallback(async () => {
        const stateToExport = { users, stockItems, stockMovements, boms: produtosCombinados, weighingBatches, allOrders, returns, scanHistory, skuLinks };
        exportStateToSql(stateToExport as any, SETUP_SQL_STRING);
    }, [users, stockItems, stockMovements, produtosCombinados, weighingBatches, allOrders, returns, scanHistory, skuLinks]);

  const handleResetDatabase = useCallback(async (adminPassword: string): Promise<{ success: boolean; message?: string; }> => {
        const loggedInUser = await loginUser(currentUser!.email!, adminPassword);
        if (!loggedInUser || loggedInUser.id !== currentUser!.id) return { success: false, message: 'Senha incorreta.' };
        const { success, message } = await resetDatabase();
        if(success) await loadData();
        return { success, message };
    }, [currentUser, loadData]);

  const handleClearScanHistory = useCallback(async (adminPassword: string): Promise<{ success: boolean; message?: string; }> => {
        if (currentUser?.role !== 'SUPER_ADMIN') return { success: false };
        const loggedInUser = await loginUser(currentUser.email!, adminPassword);
         if (!loggedInUser || loggedInUser.id !== currentUser.id) return { success: false, message: 'Senha incorreta.' };
        const { error } = await dbClient.rpc('clear_scan_history');
        if (!error) { addToast('Histórico limpo.', 'success'); loadData(); return { success: true }; }
        return { success: false };
    }, [currentUser, addToast, loadData]);

  const handleSaveProductionPlan = useCallback(async (plan: Omit<ProductionPlan, 'id' | 'createdAt' | 'createdBy'>): Promise<ProductionPlan | null> => {
        if (!currentUser) return null;
        const { data, error } = await dbClient.from('production_plans').insert({ ...plan, created_by: currentUser.name }).select().single();
        if(!error) {
            const planItemsToInsert = plan.items.map(item => ({...item, plan_id: data.id}));
            await dbClient.from('production_plan_items').insert(planItemsToInsert);
            loadData(); addToast('Plano salvo.', 'success');
            return { ...data, items: planItemsToInsert } as ProductionPlan;
        }
        return null;
    }, [currentUser, addToast, loadData]);

  const handleDeleteProductionPlan = useCallback(async (planId: string): Promise<boolean> => {
        const { error } = await dbClient.from('production_plans').delete().eq('id', planId);
        if(!error) { loadData(); addToast('Plano excluído.', 'success'); return true; }
        return false;
    }, [addToast, loadData]);

  const handleGenerateShoppingList = useCallback(async (list: ShoppingListItem[]) => {
        const itemsToUpsert = list.map(i => ({ stock_item_code: i.id, name: i.name, quantity: i.quantity, unit: i.unit, is_purchased: false }));
        const { error } = await dbClient.from('shopping_list_items').upsert(itemsToUpsert, { onConflict: 'stock_item_code' });
        if(!error) { loadData(); addToast('Lista gerada.', 'success'); }
    }, [addToast, loadData]);

  const handleClearShoppingList = useCallback(async () => {
        await dbClient.from('shopping_list_items').delete().neq('stock_item_code', 'dummy');
        loadData();
    }, [loadData]);

  const handleUpdateShoppingItem = useCallback(async (itemCode: string, isPurchased: boolean) => {
        await dbClient.from('shopping_list_items').update({ is_purchased: isPurchased }).eq('stock_item_code', itemCode);
        setShoppingList(prev => prev.map(i => i.id === itemCode ? {...i, is_purchased: isPurchased} : i));
    }, []);

  const handleSetAttendance = useCallback(async (userId: string, record: any) => {
        const user = users.find(u => u.id === userId);
        if(!user) return;
        const otherRecords = user.attendance.filter(a => a.date !== record.date);
        const newAttendance = [...otherRecords, record].sort((a,b) => b.date.localeCompare(a.date));
        await handleUpdateUser({ ...user, attendance: newAttendance });
    }, [users, handleUpdateUser]);

  const handleUpdateAttendanceDetails = useCallback(async (userId: string, date: string, detail: any, time: any) => {
        const user = users.find(u => u.id === userId);
        if(!user) return;
        const newAttendance = user.attendance.map(a => a.date === date ? { ...a, [detail]: time || undefined } : a);
        await handleUpdateUser({ ...user, attendance: newAttendance });
    }, [users, handleUpdateUser]);

  const handleStockAdjustment = useCallback(async (stockItemCode: string, quantityDelta: number, ref: string): Promise<boolean> => {
        if (!currentUser) return false;
        const { error } = await dbClient.rpc('adjust_stock_quantity', { item_code: stockItemCode, quantity_delta: quantityDelta, origin_text: 'AJUSTE_MANUAL', ref_text: ref, user_name: currentUser.name });
        if(!error) { loadData(); addToast('Ajustado!', 'success'); return true; }
        return false;
    }, [currentUser, addToast, loadData]);

  const handleProductionRun = useCallback(async (itemCode: string, quantity: number, ref: string) => {
        if (!currentUser) return;
        const { error } = await dbClient.rpc('record_production_run', { item_code: itemCode, quantity_to_produce: quantity, ref_text: ref, user_name: currentUser.name });
        if(!error) { loadData(); addToast('Produção registrada.', 'success'); }
    }, [currentUser, addToast, loadData]);

    const handleEditItem = useCallback(async (itemId: string, updates: any): Promise<boolean> => {
        try {
            console.log('📝 [handleEditItem] Atualizando item com dados:', updates);
            
            // Encontrar o item para determinar a tabela correta
            const itemToEdit = stockItems.find(i => i.id === itemId);
            if (!itemToEdit) {
                console.error('❌ [handleEditItem] Item não encontrado:', itemId);
                addToast('Item não encontrado.', 'error');
                return false;
            }

            // Determinar a tabela baseada no kind do item
            const targetTable = itemToEdit.kind === 'INSUMO' ? 'stock_items' : 'product_boms';
            console.log(`📝 [handleEditItem] Atualizando em ${targetTable}`);
            
            // Filtrar apenas os campos que existem na tabela alvo
            const validFields = targetTable === 'stock_items'
                ? ['code', 'name', 'description', 'kind', 'current_qty', 'reserved_qty', 'cost_price', 'sell_price', 'unit', 'category', 'status', 'min_qty', 'barcode', 'substitute_product_code', 'product_type']
                : ['code', 'name', 'description', 'kind', 'current_qty', 'reserved_qty', 'ready_qty', 'is_ready', 'ready_location', 'ready_date', 'ready_batch_id', 'cost_price', 'sell_price', 'bling_id', 'bling_sku', 'unit', 'category', 'status', 'bom_composition', 'min_qty'];
            
            const filteredUpdates: any = {};
            validFields.forEach(field => {
                if (field in updates) {
                    filteredUpdates[field] = updates[field];
                }
            });
            
            // Campos inválidos serão ignorados
            const invalidFields = Object.keys(updates).filter(k => !validFields.includes(k));
            if (invalidFields.length > 0) {
                console.warn(`⚠️ [handleEditItem] Campos inválidos ignorados: ${invalidFields.join(', ')}`);
            }
            
            const { error } = await dbClient.from(targetTable).update(filteredUpdates).eq('id', itemId);
            if (error) {
                console.error(`❌ [handleEditItem] Erro ao atualizar em ${targetTable}:`, error);
                addToast(`Erro ao atualizar: ${error.message}`, 'error');
                return false;
            }
            
            console.log(`✅ [handleEditItem] Item atualizado com sucesso em ${targetTable}`);
            await loadData();
            addToast('Atualizado.', 'success');
            return true;
        } catch (err: any) {
            console.error('❌ [handleEditItem] Exceção:', err);
            addToast(`Erro inesperado: ${err.message}`, 'error');
            return false;
        }
    }, [addToast, loadData, stockItems]);

  const handleDeleteItem = useCallback(async (itemId: string): Promise<boolean> => {
        try {
            const itemToDelete = stockItems.find(item => item.id === itemId);
            if (!itemToDelete) {
                console.error('❌ [handleDeleteItem] Item não encontrado:', itemId);
                addToast('Item não encontrado.', 'error');
                return false;
            }
            
            console.warn(`⚠️ [handleDeleteItem] DELETANDO item: ${itemToDelete.name} (${itemToDelete.code})`);
            
            // Determinar a tabela baseada no kind do item
            const targetTable = itemToDelete.kind === 'INSUMO' ? 'stock_items' : 'product_boms';
            
            // Deletar sku_links se for produto
            if (itemToDelete.kind === 'PRODUTO') {
                console.log(`🔗 [handleDeleteItem] Deletando sku_links relacionados ao produto ${itemToDelete.code}`);
                const { error: skuError } = await dbClient.from('sku_links').delete().eq('master_product_sku', itemToDelete.code);
                if (skuError) {
                    console.error('❌ [handleDeleteItem] Erro ao deletar sku_links:', skuError);
                }
            }
            
            // Deletar o item da tabela correta
            const { error } = await dbClient.from(targetTable).delete().eq('id', itemId);
            if (error) {
                console.error(`❌ [handleDeleteItem] Erro ao deletar item de ${targetTable}:`, error);
                addToast(`Erro ao excluir: ${error.message}`, 'error');
                return false;
            }
            
            console.log(`✅ [handleDeleteItem] Item deletado com sucesso de ${targetTable}`);
            setStockItems(prev => prev.filter(i => i.id !== itemId));
            addToast('Excluído.', 'success');
            return true;
        } catch (err: any) {
            console.error('❌ [handleDeleteItem] Exceção:', err);
            addToast(`Erro inesperado: ${err.message}`, 'error');
            return false;
        }
    }, [addToast, stockItems]);

  const handleBulkDeleteItems = useCallback(async (itemIds: string[]): Promise<boolean> => {
        try {
            // Separar ids por tipo de tabela
            const productBomIds: string[] = [];
            const stockItemIds: string[] = [];
            
            itemIds.forEach(itemId => {
                const item = stockItems.find(i => i.id === itemId);
                if (item) {
                    if (item.kind === 'INSUMO') {
                        stockItemIds.push(itemId);
                    } else {
                        productBomIds.push(itemId);
                    }
                }
            });
            
            console.log(`🗑️ [handleBulkDeleteItems] Deletando ${productBomIds.length} products + ${stockItemIds.length} insumos`);
            
            // Deletar de product_boms
            if (productBomIds.length > 0) {
                const { error: pbError } = await dbClient.from('product_boms').delete().in('id', productBomIds);
                if (pbError) {
                    console.error('❌ Erro ao deletar products:', pbError);
                    addToast(`Erro ao excluir produtos: ${pbError.message}`, 'error');
                    return false;
                }
                console.log(`✅ ${productBomIds.length} produtos deletados`);
            }
            
            // Deletar de stock_items
            if (stockItemIds.length > 0) {
                const { error: siError } = await dbClient.from('stock_items').delete().in('id', stockItemIds);
                if (siError) {
                    console.error('❌ Erro ao deletar insumos:', siError);
                    addToast(`Erro ao excluir insumos: ${siError.message}`, 'error');
                    return false;
                }
                console.log(`✅ ${stockItemIds.length} insumos deletados`);
            }
            
            loadData();
            addToast('Itens excluídos.', 'success');
            return true;
        } catch (err: any) {
            console.error('❌ [handleBulkDeleteItems] Exceção:', err);
            addToast(`Erro: ${err.message}`, 'error');
            return false;
        }
    }, [stockItems, addToast, loadData]);

  const handleConfirmImportFromXml = useCallback(async (payload: any) => {
        if (!currentUser) return;
        const now = Date.now();
        const newItemsToInsert = payload.itemsToCreate.map((item:any) => ({
            id: item.id || generateId(),
            code: item.code,
            name: item.name,
            kind: item.kind || 'PRODUTO',
            unit: item.unit || 'un',
            category: item.category || '',
            current_qty: Number(item.initial_qty || item.current_qty || 0),
            reserved_qty: Number(item.reserved_qty || 0),
            ready_qty: Number(item.ready_qty || 0),
            min_qty: Number(item.min_qty || 0),
            status: item.status || 'ATIVO',
            created_at: now,
            updated_at: now,
            bom_composition: item.bom_composition || null,
        }));
        if (newItemsToInsert.length > 0) await dbClient.from('product_boms').insert(newItemsToInsert as any);
        for (const item of payload.itemsToUpdate) await dbClient.rpc('adjust_stock_quantity', { item_code: item.stockItemCode, quantity_delta: item.quantityDelta, origin_text: 'IMPORT_XML', ref_text: 'NFe Import', user_name: currentUser.name });
        addToast('XML Importado!', 'success'); loadData();
    }, [currentUser, addToast, loadData]);

  // 🔗 Bulk Link SKUs - Vincular múltiplos SKUs a um produto existente
  const handleBulkLinkSKUsToExisting = useCallback(async (selectedSkus: string[], targetProductId: string) => {
    try {
      console.log(`🔗 [BulkLink] Vinculando ${selectedSkus.length} SKUs ao produto ${targetProductId}`);
      
            const now = Date.now();
            const skuLinksToInsert = selectedSkus.map(sku => ({
        imported_sku: sku,
        master_product_sku: targetProductId,
                created_at: now,
                updated_at: now,
      }));

      const { error } = await dbClient.from('sku_links').insert(skuLinksToInsert);
      
      if (error) {
        console.error('❌ Erro ao vincular SKUs:', error);
        addToast(`Erro ao vincular SKUs: ${error.message}`, 'error');
        return;
      }

      console.log(`✅ [BulkLink] ${selectedSkus.length} SKUs vinculados com sucesso`);
      addToast(`✅ ${selectedSkus.length} SKU(s) vinculado(s) com sucesso!`, 'success');
      await loadData();
    } catch (err) {
      console.error('❌ Erro na bulk link:', err);
      addToast('Erro ao vincular SKUs', 'error');
    }
  }, [addToast, loadData]);

  // 🔗 Bulk Link SKUs - Criar novo produto e vincular múltiplos SKUs
  const handleBulkLinkSKUsCreateNew = useCallback(async (selectedSkus: string[], newProductData: { name: string; code: string }) => {
    if (!currentUser) return;
    
    try {
      console.log(`🔗 [BulkLink-New] Criando novo produto "${newProductData.name}" e vinculando ${selectedSkus.length} SKUs`);
      
      // 1. Criar novo produto
            const now = Date.now();
            const newProduct = {
                id: generateId(),
        code: newProductData.code,
        name: newProductData.name,
        kind: 'PRODUTO' as const,
        unit: 'unidades',
        current_qty: 0,
        reserved_qty: 0,
        ready_qty: 0,
                min_qty: 0,
                sell_price: 0,
                cost_price: 0,
        category: 'Importado',
                status: 'ATIVO',
                created_at: now,
                updated_at: now,
      };

      const { data: insertedProduct, error: insertError } = await dbClient
        .from('product_boms')
        .insert([newProduct])
        .select('id')
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar produto:', insertError);
        addToast(`Erro ao criar produto: ${insertError.message}`, 'error');
        return;
      }

    const productCode = newProductData.code;
    console.log(`✅ Produto criado: ${productCode}`);

      // 2. Vincular SKUs ao novo produto
            const skuLinksToInsert = selectedSkus.map(sku => ({
        imported_sku: sku,
                master_product_sku: productCode,
                created_at: now,
                updated_at: now,
      }));

      const { error: linkError } = await dbClient.from('sku_links').insert(skuLinksToInsert);

      if (linkError) {
        console.error('❌ Erro ao vincular SKUs:', linkError);
        addToast(`Erro ao vincular SKUs: ${linkError.message}`, 'error');
        return;
      }

      console.log(`✅ [BulkLink-New] ${selectedSkus.length} SKUs vinculados ao novo produto`);
      addToast(`✅ Produto "${newProductData.name}" criado com ${selectedSkus.length} SKU(s) vinculado(s)!`, 'success');
      await loadData();
    } catch (err) {
      console.error('❌ Erro na bulk link create:', err);
      addToast('Erro ao criar produto e vincular SKUs', 'error');
    }
  }, [currentUser, addToast, loadData]);

  const handleLaunchSuccess = useCallback(async (launchedOrders: OrderItem[]) => {
        const uniqueOrdersMap = new Map();
        launchedOrders.forEach(o => {
            const orderId = String(o.orderId || '').trim().toUpperCase();
            const sku = String(o.sku || '').trim().toUpperCase();
            const deterministicId = `${orderId}|${sku}`;
            uniqueOrdersMap.set(`${orderId}|${sku}`, {
            id: deterministicId,
            order_id: o.orderId, 
            tracking: o.tracking, 
            sku: o.sku, 
            qty_original: o.qty_original, 
            multiplicador: o.multiplicador, 
            qty_final: o.qty_final, 
            color: o.color, 
            canal: o.canal, 
            data: o.data, 
            status: o.status, 
            customer_name: o.customer_name, 
            customer_cpf_cnpj: o.customer_cpf_cnpj, 
            price_gross: o.price_gross, 
            platform_fees: o.platform_fees, 
            shipping_fee: o.shipping_fee, 
            price_net: o.price_net,
            data_prevista_envio: o.data_prevista_envio
        });
        });
        
        // Batching for robustness
        const BATCH_SIZE = 500;
        const uniqueOrders = Array.from(uniqueOrdersMap.values());
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < uniqueOrders.length; i += BATCH_SIZE) {
            const batch = uniqueOrders.slice(i, i + BATCH_SIZE);
            let { error } = await dbClient.from('orders').upsert(batch, { onConflict: 'order_id,sku' });
            // Fallback: se a constraint ainda não existe (migration pendente), usa insert ignorando duplicatas
            if (error && (error.code === '42P10' || error.message?.includes('no unique or exclusion constraint'))) {
                const fallback = await dbClient.from('orders').upsert(batch, { ignoreDuplicates: true });
                error = fallback.error;
            }
            // Fallback 2: bancos legados sem algumas colunas opcionais (ex: data_prevista_envio)
            if (error && (error.code === '42703' || error.message?.includes('column'))) {
                const reducedBatch = batch.map((o: any) => ({
                    id: o.id,
                    order_id: o.order_id,
                    tracking: o.tracking,
                    sku: o.sku,
                    qty_original: o.qty_original,
                    multiplicador: o.multiplicador,
                    qty_final: o.qty_final,
                    color: o.color,
                    canal: o.canal,
                    data: o.data,
                    status: o.status,
                    customer_name: o.customer_name,
                    customer_cpf_cnpj: o.customer_cpf_cnpj,
                    price_gross: o.price_gross,
                    platform_fees: o.platform_fees,
                    shipping_fee: o.shipping_fee,
                    price_net: o.price_net,
                }));
                const fallbackReduced = await dbClient.from('orders').upsert(reducedBatch, { onConflict: 'order_id,sku' });
                error = fallbackReduced.error;
            }
            if (error) {
                const detail = [error.message, error.details, error.hint].filter(Boolean).join(' | ');
                console.error('Batch upload error:', detail || error);
                errorCount += batch.length;
            } else {
                successCount += batch.length;
            }
        }
        
        if (successCount > 0) { 
            await loadData(); 
            addToast(`Sucesso! ${successCount} pedidos salvos.${errorCount > 0 ? ` (${errorCount} falhas)` : ''}`, errorCount > 0 ? 'info' : 'success'); 
            if (uiSettings.soundOnSuccess) playSound('success');
        } else if (errorCount > 0) {
            addToast(`Erro ao salvar ${errorCount} pedido(s) no banco. Verifique o console ou rode a migration.sql.`, 'error');
            if (uiSettings.soundOnError) playSound('error');
        }
    }, [addToast, loadData, uiSettings]);
    
  const handleLinkSku = useCallback(async (importedSku: string, masterProductSku: string): Promise<boolean> => {
        try {
            // Validações básicas
            if (!importedSku || !importedSku.trim()) {
                console.error('❌ [handleLinkSku] SKU importado é obrigatório');
                addToast('SKU importado é obrigatório.', 'error');
                return false;
            }
            if (!masterProductSku || !masterProductSku.trim()) {
                console.error('❌ [handleLinkSku] SKU mestre é obrigatório');
                addToast('SKU mestre é obrigatório.', 'error');
                return false;
            }
            
            const importedSkuUpper = importedSku.trim().toUpperCase();
            const masterSkuUpper = masterProductSku.trim().toUpperCase();
            
            // Verificar se skuLink já existe
            const existingLink = skuLinks.find(l => l.importedSku.toUpperCase() === importedSkuUpper);
            if (existingLink && existingLink.masterProductSku.toUpperCase() === masterSkuUpper) {
                console.warn(`⚠️ [handleLinkSku] Vínculo já existe: ${importedSku} -> ${masterProductSku}`);
                addToast('Este vínculo já existe.', 'info');
                return true;
            }
            
            // Preparar dados com ID gerado
            const skuLinkData = {
                id: generateId(),
                imported_sku: importedSkuUpper,
                master_product_sku: masterSkuUpper,
                created_at: Date.now(),
                updated_at: Date.now(),
            };
            
            console.log(`📥 [handleLinkSku] Vinculando ${importedSkuUpper} -> ${masterSkuUpper}`);
            
            const { data, error } = await dbClient
                .from('sku_links')
                .upsert(skuLinkData, { onConflict: 'imported_sku' })
                .select()
                .single();
            
            if (error) {
                console.error('❌ [handleLinkSku] Erro ao vincular:', error.message);
                addToast(`Erro ao vincular: ${error.message}`, 'error');
                return false;
            }
            
            if (!data) {
                console.error('❌ [handleLinkSku] Nenhum dado retornado');
                addToast('Erro ao vincular: resposta vazia.', 'error');
                return false;
            }
            
            // Atualizar estado localmente
            setSkuLinks(prev => [
                ...prev.filter(l => l.importedSku.toUpperCase() !== importedSkuUpper),
                { 
                    importedSku: data.imported_sku,
                    masterProductSku: data.master_product_sku
                }
            ]);
            
            console.log(`✅ [handleLinkSku] Vínculo criado com sucesso`);
            addToast('SKU vinculado com sucesso!', 'success');
            
            return true;
        } catch (err: any) {
            console.error('❌ [handleLinkSku] Exceção:', err.message);
            addToast(`Erro: ${err.message || 'Verifique o banco de dados'}`, 'error');
            return false;
        }
    }, [addToast, skuLinks]);

  const handleUnlinkSku = useCallback(async (importedSku: string): Promise<boolean> => {
        try {
            if (!importedSku || !importedSku.trim()) {
                console.error('❌ Erro: SKU importado é obrigatório para desvinculação');
                addToast('SKU importado é obrigatório.', 'error');
                return false;
            }
            
            console.log('🔗 Desvinculando SKU:', importedSku);
            
            const { error } = await dbClient
                .from('sku_links')
                .delete()
                .eq('imported_sku', importedSku.trim());
            
            if (error) {
                console.error('❌ Erro ao desvincula r SKU:', error);
                addToast(`Erro ao desvincula r: ${error.message}`, 'error');
                return false;
            }
            
            setSkuLinks(prev => prev.filter(l => l.importedSku !== importedSku));
            
            console.log('✅ SKU desvinculado com sucesso');
            addToast('SKU desvinculado com sucesso.', 'info');
            
            // Recarregar dados após desvinculação
            await loadData();
            
            return true;
        } catch (err: any) {
            console.error('❌ Exceção ao desvincula r SKU:', err);
            addToast(`Erro inesperado: ${err.message || 'Verifique o banco de dados'}`, 'error');
            return false;
        }
    }, [addToast, loadData]);

  const handleAddImportToHistory = useCallback(async (item: any, processedData: any) => {
        try {
            const historyItem = {
                id: generateId(),
                file_name: item.fileName,
                processed_at: item.processedAt,
                user_name: item.user,
                item_count: item.item_count,
                unlinked_count: item.unlinked_count,
                canal: item.canal,
                processed_data: processedData as any,
                created_at: Date.now(),
            };
            
            console.log('📥 Salvando importação no histórico:', historyItem);
            
            const { data, error } = await dbClient
                .from('import_history')
                .insert(historyItem as any)
                .select()
                .single();
            
            if (!error && data) {
                setImportHistory(prev => [{
                    id: data.id,
                    fileName: data.file_name,
                    processedAt: data.processed_at,
                    user: data.user_name,
                    itemCount: data.item_count,
                    unlinkedCount: data.unlinked_count,
                    processedData: data.processed_data,
                    canal: data.canal
                }, ...prev]);
                console.log('✅ Importação salva no histórico');
            } else {
                console.error('❌ Erro ao salva r importação no histórico:', error);
            }
        } catch (err: any) {
            console.error('❌ Exceção ao salva r importação no histórico:', err);
        }
    }, []);

  const handleClearImportHistory = useCallback(async () => {
        await dbClient.from('import_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        setImportHistory([]);
    }, []);

    const handleConfirmDeleteHistoryItem = async () => {
        if (!historyItemToDelete) return;
        setIsDeletingHistory(true);
        
        let pData = historyItemToDelete.processedData;
        if (!pData) {
            const { data } = await dbClient.from('import_history').select('processed_data').eq('id', historyItemToDelete.id).single();
            if (data) pData = data.processed_data;
        }

        if (pData) {
            const orderIdentifiers = new Set(pData.lists.completa.map((o: any) => `${o.orderId}|${o.sku}`));
            const dbIdsToDelete = allOrders.filter(o => orderIdentifiers.has(`${o.orderId}|${o.sku}`)).map(o => o.id);
            if (dbIdsToDelete.length > 0) {
                // Using new delete_orders RPC
                await dbClient.rpc('delete_orders', { order_ids: dbIdsToDelete });
            }
        }

        await dbClient.from('import_history').delete().eq('id', historyItemToDelete.id);
        
        setIsDeletingHistory(false);
        setIsDeleteModalOpen(false);
        setHistoryItemToDelete(null);
        loadData();
    };

    const handleBulkDeleteHistoryItems = useCallback(async (ids: string[]) => {
        const { data: historyItems, error: fetchError } = await dbClient
            .from('import_history')
            .select('processed_data')
            .in('id', ids);

        if (fetchError || !historyItems) {
            addToast('Erro ao buscar dados do histórico.', 'error');
            return;
        }

        let allOrderIdentifiers = new Set<string>();
        historyItems.forEach((item: any) => {
            if (item.processed_data && item.processed_data.lists && item.processed_data.lists.completa) {
                item.processed_data.lists.completa.forEach((o: any) => {
                    allOrderIdentifiers.add(`${o.orderId}|${o.sku}`);
                });
            }
        });

        if (allOrderIdentifiers.size > 0) {
            const dbIdsToDelete = allOrders.filter(o => allOrderIdentifiers.has(`${o.orderId}|${o.sku}`)).map(o => o.id);
            if (dbIdsToDelete.length > 0) {
                // Using new delete_orders RPC
                await dbClient.rpc('delete_orders', { order_ids: dbIdsToDelete });
            }
        }

        const { error: deleteError } = await dbClient.from('import_history').delete().in('id', ids);
        
        if (deleteError) {
            addToast('Erro ao excluir histórico.', 'error');
        } else {
            addToast(`Histórico e pedidos vinculados excluídos com sucesso.`, 'success');
            loadData();
        }
    }, [allOrders, loadData, addToast]);

  const handleDeleteUser = useCallback(async (userId: string, adminPassword?: string): Promise<boolean> => {
        if (!currentUser) return false;
        const userToDelete = users.find(u => u.id === userId);
        if (!userToDelete || userToDelete.role === 'SUPER_ADMIN') return false;
        if (currentUser.role === 'SUPER_ADMIN' && userToDelete.role === 'ADMIN' && adminPassword) {
            const loggedIn = await loginUser(currentUser.email!, adminPassword);
            if (!loggedIn) return false;
        }
        const { error } = await dbClient.from('users').delete().eq('id', userId);
        if(!error) { loadData(); addToast('Excluído.', 'success'); return true; }
        return false;
    }, [users, currentUser, addToast, loadData]);

  const handleBulkSetInitialStock = useCallback(async (updates: any): Promise<string> => {
    if (!currentUser) return "";
    const { data, error } = await dbClient.rpc('bulk_set_initial_stock', { updates: updates.map((u:any) => ({ item_code: u.code, new_initial_quantity: u.quantity })), user_name: currentUser.name });
    if (!error) { addToast('Inventário ajustado!', 'success'); loadData(); return data as string; }
    return "";
  }, [currentUser, addToast, loadData]);

  const handleLoadZplFromBling = (zpl: string, includeDanfe = true) => {
    setEtiquetasState(prev => ({ ...prev, zplInput: zpl, zplPages: [], previews: [], extractedData: new Map(), includeDanfe }));
    setCurrentPage('etiquetas');
  };

  const renderPage = () => {
    switch (currentPage) {
        case 'dashboard': return <DashboardPage setCurrentPage={setCurrentPage} generalSettings={generalSettings} allOrders={allOrders} scanHistory={scanHistory} stockItems={stockItems} produtosCombinados={produtosCombinados} users={users} lowStockCount={lowStockCount} uiSettings={uiSettings} onSaveUiSettings={handleSaveUiSettings} adminNotices={adminNotices} onSaveNotice={handleSaveNotice} onDeleteNotice={handleDeleteNotice} currentUser={currentUser!} skuLinks={skuLinks} onSaveDashboardConfig={handleSaveDashboardConfig} packGroups={packGroups} onSavePackGroup={async (g, id) => { await dbClient.from('stock_pack_groups').upsert(id ? { ...g, id } : g); loadData(); }} />
        case 'importer': return <ImporterPage 
            allOrders={allOrders} 
            selectedFile={selectedFile} 
            setSelectedFile={setSelectedFile} 
            processedData={processedData} 
            setProcessedData={setProcessedData} 
            error={importError} 
            setError={setImportError} 
            isProcessing={isProcessing} 
            setIsProcessing={setIsProcessing} 
            onLaunchSuccess={handleLaunchSuccess} 
            skuLinks={skuLinks} 
            onLinkSku={handleLinkSku} 
            onUnlinkSku={handleUnlinkSku} 
            products={stockItems.filter(i => i.kind === 'PRODUTO')} 
            onAddNewItem={handleAddNewItem} 
            produtosCombinados={produtosCombinados} 
            stockItems={stockItems} 
            generalSettings={generalSettings} 
            setGeneralSettings={handleSaveGeneralSettings} 
            currentUser={currentUser!} 
            importHistory={importHistory} 
            addImportToHistory={handleAddImportToHistory} 
            clearImportHistory={handleClearImportHistory} 
            onDeleteHistoryItem={(item)=> {setHistoryItemToDelete(item); setIsDeleteModalOpen(true);}} 
            onGetImportHistoryDetails={handleGetImportHistoryDetails} 
            onBulkDeleteHistory={handleBulkDeleteHistoryItems} 
            users={users}
            blingLinkedIds={blingLinkedIds}
        />
        case 'bipagem': return <BipagemPage isAutoBipagemActive={isAutoBipagemActive} allOrders={allOrders} onNewScan={handleNewScan} onBomDeduction={() => {}} scanHistory={scanHistory} onCancelBipagem={handleCancelBipagem} onBulkCancelBipagem={handleBulkCancelBipagem} products={stockItems} users={users} onAddNewUser={handleAddNewUser} onSaveUser={handleUpdateUser} uiSettings={uiSettings} currentUser={currentUser!} onSyncPending={handleSyncPending} skuLinks={skuLinks} addToast={addToast} currentPage={currentPage} onHardDeleteScanLog={handleHardDeleteScanLog} onBulkHardDeleteScanLog={handleBulkHardDeleteScanLog} />
        case 'pedidos': return <PedidosPage allOrders={allOrders} scanHistory={scanHistory} returns={returns} onLogError={handleLogError} onLogReturn={handleLogReturn} currentUser={currentUser!} onDeleteOrders={handleDeleteOrders} onBulkCancelBipagem={handleBulkCancelBipagem} onUpdateStatus={handleUpdateStatus} onRemoveReturn={handleRemoveReturn} onSolveOrders={handleSolveOrders} generalSettings={generalSettings} users={users} skuLinks={skuLinks} stockItems={stockItems} />
        case 'planejamento': return <PlanejamentoPage stockItems={stockItems} allOrders={allOrders} skuLinks={skuLinks} produtosCombinados={produtosCombinados} productionPlans={productionPlans} onSaveProductionPlan={handleSaveProductionPlan} onDeleteProductionPlan={handleDeleteProductionPlan} onGenerateShoppingList={handleGenerateShoppingList} currentUser={currentUser!} planningSettings={generalSettings.estoque} onSavePlanningSettings={(s) => handleSaveGeneralSettings(p => ({...p, estoque: s}))} addToast={addToast} />
        case 'compras': return <ComprasPage shoppingList={shoppingList} onClearList={handleClearShoppingList} onUpdateItem={handleUpdateShoppingItem} stockItems={stockItems} />
        case 'pesagem': return <PesagemPage stockItems={stockItems} weighingBatches={weighingBatches} onAddNewWeighing={handleAddNewWeighing} currentUser={currentUser!} onDeleteBatch={handleDeleteWeighingBatch} users={users} />
        case 'moagem': return <MoagemPage stockItems={stockItems} grindingBatches={grindingBatches} onAddNewGrinding={handleAddNewGrinding} currentUser={currentUser!} onDeleteBatch={handleDeleteGrindingBatch} users={users} generalSettings={generalSettings} />
        case 'estoque': return <EstoquePage stockItems={stockItems} stockMovements={stockMovements} onStockAdjustment={handleStockAdjustment} produtosCombinados={produtosCombinados} onSaveProdutoCombinado={handleSaveProdutoCombinado} onAddNewItem={handleAddNewItem} weighingBatches={weighingBatches} onAddNewWeighing={handleAddNewWeighing} onProductionRun={handleProductionRun} currentUser={currentUser!} onEditItem={handleEditItem} onDeleteItem={handleDeleteItem} onBulkDeleteItems={handleBulkDeleteItems} onDeleteMovement={async()=>false} onDeleteWeighingBatch={handleDeleteWeighingBatch} generalSettings={generalSettings} setGeneralSettings={setGeneralSettings as any} onConfirmImportFromXml={handleConfirmImportFromXml} onSaveExpeditionItems={handleSaveExpeditionItems} users={users} onUpdateInsumoCategory={async()=>{}} onBulkInventoryUpdate={handleBulkSetInitialStock} skuLinks={skuLinks} onLinkSku={handleLinkSku} onUnlinkSku={handleUnlinkSku} />
        case 'funcionarios': return <FuncionariosPage users={users} onSetAttendance={handleSetAttendance} onAddNewUser={handleAddNewUser} onUpdateAttendanceDetails={handleUpdateAttendanceDetails} onUpdateUser={handleUpdateUser} generalSettings={generalSettings} currentUser={currentUser!} onDeleteUser={handleDeleteUser} />
        case 'relatorios': return <RelatoriosPage stockItems={stockItems} stockMovements={stockMovements} orders={allOrders} weighingBatches={weighingBatches} scanHistory={scanHistory} produtosCombinados={produtosCombinados} users={users} returns={returns} generalSettings={generalSettings} grindingBatches={grindingBatches} />
        case 'financeiro': return <FinancePage allOrders={allOrders} stockItems={stockItems} skuLinks={skuLinks} produtosCombinados={produtosCombinados} generalSettings={generalSettings} onDeleteOrders={handleDeleteOrders} onLaunchOrders={handleLaunchSuccess} onNavigateToSettings={() => { _setCurrentPage('configuracoes-gerais'); localStorage.setItem('erp_current_page', 'configuracoes-gerais'); }} />
        case 'etiquetas': return <EtiquetasPage settings={etiquetasSettings} onSettingsSave={handleSaveEtiquetasSettings} generalSettings={generalSettings} uiSettings={uiSettings} onSetUiSettings={setUiSettings as any} stockItems={stockItems} skuLinks={skuLinks} onLinkSku={handleLinkSku} onUnlinkSku={handleUnlinkSku} onAddNewItem={handleAddNewItem} etiquetasState={etiquetasState} setEtiquetasState={setEtiquetasState} currentUser={currentUser!} allOrders={allOrders} etiquetasHistory={etiquetasHistory} onSaveHistory={handleSaveEtiquetaHistory} onGetHistoryDetails={handleGetEtiquetaHistoryDetails} onProcessZpl={handleProcessZpl} isProcessing={isProcessingLabels} progressMessage={labelProgressMessage} />
        case 'bling': return <BlingPage generalSettings={generalSettings} onLaunchSuccess={handleLaunchSuccess} addToast={addToast} setCurrentPage={setCurrentPage} onLoadZpl={handleLoadZplFromBling} onSaveSettings={handleSaveGeneralSettings} stockItems={stockItems} skuLinks={skuLinks} />;
        case 'integracoes': return <IntegracoesPage generalSettings={generalSettings} onSaveSettings={handleSaveGeneralSettings} onLaunchSuccess={handleLaunchSuccess} addToast={addToast} setCurrentPage={setCurrentPage} />;
        case 'passo-a-passo': return <PassoAPassoPage />
        case 'ajuda': return <AjudaPage />
        case 'powerbi': return <BiDashboardPage biData={biData} users={users}/>
        case 'powerbi-templates': return <PowerBiTemplatesPage setCurrentPage={setCurrentPage} />
        case 'configuracoes': return <ConfiguracoesPage users={users} setCurrentPage={setCurrentPage} onDeleteUser={handleDeleteUser} onAddNewUser={handleAddNewUser} currentUser={currentUser!} onUpdateUser={handleUpdateUser} generalSettings={generalSettings} stockItems={stockItems} onBackupData={handleBackupData} onResetDatabase={handleResetDatabase} onClearScanHistory={handleClearScanHistory} onSaveGeneralSettings={handleSaveGeneralSettings} addToast={addToast} />
        case 'configuracoes-gerais': return <ConfiguracoesGeraisPage setCurrentPage={setCurrentPage} generalSettings={generalSettings} onSaveGeneralSettings={handleSaveGeneralSettings} currentUser={currentUser} onBackupData={handleBackupData} onResetDatabase={handleResetDatabase} addToast={addToast} stockItems={stockItems} onClearScanHistory={handleClearScanHistory} users={users} />
        default: return <DashboardPage setCurrentPage={setCurrentPage} generalSettings={generalSettings} allOrders={allOrders} scanHistory={scanHistory} stockItems={stockItems} produtosCombinados={produtosCombinados} users={users} lowStockCount={lowStockCount} uiSettings={uiSettings} onSaveUiSettings={handleSaveUiSettings} adminNotices={adminNotices} onSaveNotice={handleSaveNotice} onDeleteNotice={handleDeleteNotice} currentUser={currentUser!} skuLinks={skuLinks} onSaveDashboardConfig={handleSaveDashboardConfig} packGroups={packGroups} onSavePackGroup={async (g, id) => { await dbClient.from('stock_pack_groups').upsert(id ? { ...g, id } : g); loadData(); }} />
    }
  };

  if (appStatus === 'initializing') return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (appStatus === 'needs_setup') return <DatabaseSetupPage onRetry={() => window.location.reload()} details={setupDetails} />;
  if (appStatus === 'error') return <div className="p-4 bg-red-100 text-red-800">Erro crítico ao carregar aplicativo.</div>;

  if (!currentUser) return <LoginPage onLogin={async (l, p) => { const user = await loginUser(l, p); if (user) { localStorage.setItem('erp_current_user', JSON.stringify(user)); setCurrentUser(user); return true; } return false; }} />;

  return (
    <div>
        <style>{`:root { --font-size-dynamic: ${uiSettings.fontSize}px; }`}</style>
        <div className="flex h-screen font-sans bg-[var(--color-bg)]">
            <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} lowStockCount={lowStockCount} isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} isMobileOpen={isMobileSidebarOpen} setIsMobileSidebarOpen={setIsMobileSidebarOpen} currentUser={currentUser} onLogout={() => { localStorage.removeItem('erp_current_user'); initialized.current = false; setCurrentUser(null) }} generalSettings={generalSettings} />
            <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
                <GlobalHeader 
                    currentPage={currentPage} 
                    onMenuClick={() => setIsMobileSidebarOpen(true)} 
                    lowStockItems={lowStockItems} 
                    setCurrentPage={setCurrentPage} 
                    bannerNotice={bannerNotice} 
                    isAutoBipagemActive={isAutoBipagemActive} 
                    onToggleAutoBipagem={setIsAutoBipagemActive} 
                    currentUser={currentUser} 
                    onDismissNotice={handleDeleteNotice} 
                    isProcessingLabels={isProcessingLabels}
                    labelProgressMessage={labelProgressMessage}
                    labelProcessingProgress={labelProcessingProgress}
                />
                <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-[var(--color-bg)]">
                    {renderPage()}
                </div>
            </main>
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {isDeleteHistoryModalOpen && <ConfirmActionModal isOpen={isDeleteHistoryModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleConfirmDeleteHistoryItem} title="Confirmar Exclusão de Importação" message={<p>Tem certeza que deseja excluir esta importação? <strong>Isso também apagará todos os pedidos vinculados a ela que ainda estão no banco de dados.</strong></p>} confirmButtonText="Sim, Excluir Tudo" isConfirming={isDeletingHistory} />}
        <BulkLinkSKUsModal
          isOpen={isBulkLinkSKUsModalOpen}
          onClose={() => setIsBulkLinkSKUsModalOpen(false)}
          importedProducts={importedSkusForBulkLink}
          existingProducts={stockItems.map(p => ({ id: p.id || p.code, code: p.code, name: p.name }))}
          onLinkBulk={handleBulkLinkSKUsToExisting}
          onCreateAndLink={handleBulkLinkSKUsCreateNew}
        />
    </div>
  );
};
export default App;
