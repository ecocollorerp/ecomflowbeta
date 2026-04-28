
import React, { useState, useEffect, useMemo } from 'react';
import FileUploader from '../components/FileUploader';
import ImportResults from '../components/ImportResults';
import LinkSkuModal from '../components/LinkSkuModal';
import CreateProductFromImportModal from '../components/CreateProductFromImportModal';
import DateSelectionModal from '../components/DateSelectionModal';
import { ProcessedData, OrderItem, SkuLink, StockItem, ProdutoCombinado, GeneralSettings, User, ImportHistoryItem, Canal } from '../types';
import { parseExcelFile, extractShippingDates, extractHeadersAndData, getParserInternals } from '../lib/parser';
import { verifyDatabaseSetup } from '../lib/supabaseClient';
import { Loader2, Zap, History, Settings, X, ChevronLeft, Eye, AlertCircle, Copy, Check, Info, AlertTriangle, Trash2, List, Archive, Calendar, CheckSquare, Square, FileSpreadsheet } from 'lucide-react';
import { SETUP_SQL_STRING } from '../lib/sql';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { MappingPanel } from '../components/MappingSettings';
import * as XLSX from 'xlsx';

interface ImporterPageProps {
    allOrders: OrderItem[];
    selectedFile: File | null;
    setSelectedFile: (file: File | null) => void;
    processedData: ProcessedData | null;
    setProcessedData: (data: ProcessedData | null) => void;
    error: string | null;
    setError: (error: string | null) => void;
    isProcessing: boolean;
    setIsProcessing: (isProcessing: boolean) => void;
    onLaunchSuccess: (launchedOrders: OrderItem[]) => void;
    skuLinks: SkuLink[];
    onLinkSku: (importedSku: string, masterProductSku: string) => Promise<boolean>;
    onUnlinkSku: (importedSku: string) => Promise<boolean>;
    products: StockItem[];
    onAddNewItem: (newItem: Omit<StockItem, 'id'>) => Promise<StockItem | null>;
    produtosCombinados: ProdutoCombinado[];
    stockItems: StockItem[];
    generalSettings: GeneralSettings;
    setGeneralSettings: (settings: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => void;
    currentUser: User;
    importHistory: ImportHistoryItem[];
    addImportToHistory: (item: any, processedData: any) => void;
    clearImportHistory: () => void;
    onDeleteHistoryItem: (item: ImportHistoryItem) => void;
    onGetImportHistoryDetails: (id: string) => Promise<ProcessedData | null>;
    onBulkDeleteHistory?: (ids: string[]) => Promise<void>;
    users: User[]; // New Prop
    blingLinkedIds?: Set<string>;
}

export const ImporterPage: React.FC<ImporterPageProps> = (props) => {
    const {
        allOrders, selectedFile, setSelectedFile, processedData, setProcessedData,
        error, setError, isProcessing, setIsProcessing, onLaunchSuccess,
        skuLinks, onLinkSku, onUnlinkSku, products, onAddNewItem,
        produtosCombinados, stockItems, generalSettings, setGeneralSettings, // Add setGeneralSettings
        currentUser, importHistory, addImportToHistory, clearImportHistory,
        onDeleteHistoryItem, onGetImportHistoryDetails, onBulkDeleteHistory,
        users, // Destructure new prop
        blingLinkedIds
    } = props;

    const [importOptions, setImportOptions] = useState({
        importCpf: false,
        importName: true,
        trackingFilter: 'all' as any,
        descontarVolatil: false,
    });
    const [importAsHistory, setImportAsHistory] = useState(false);
    const [importAsNormalWithDate, setImportAsNormalWithDate] = useState(true);
    const [selectedChannel, setSelectedChannel] = useState<Canal | 'AUTO'>('AUTO');
    const [tiktokOrderType, setTiktokOrderType] = useState<'all' | 'normal' | 'pre-order'>('all');
    // Estados para o fluxo de datas
    const [availableShippingDates, setAvailableShippingDates] = useState<{ date: string, count: number, saved?: number }[]>([]);
    const [shippingDateKey, setShippingDateKey] = useState<string | null>(null);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [isScanningDates, setIsScanningDates] = useState(false);


    const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
    const [linkModalState, setLinkModalState] = useState({ isOpen: false, skus: [] as string[], color: '' });
    const [createModalState, setCreateModalState] = useState<{ isOpen: boolean, data: { sku: string; colorSugerida: string } | null }>({ isOpen: false, data: null });
    const [isViewingHistory, setIsViewingHistory] = useState(false);
    const [dbInconsistency, setDbInconsistency] = useState<any>(null);
    const [copiedSql, setCopiedSql] = useState(false);

    const channelOptions = useMemo(() => {
        const opts = [{ value: 'AUTO', label: 'Automático (Detectar cabeçalho)' }];
        Object.keys(generalSettings.importer).forEach(key => {
            const val = key.toUpperCase();
            let label = val;
            if (val === 'ML') label = 'Mercado Livre';
            else if (val === 'SHOPEE') label = 'Shopee';
            else if (val === 'SITE') label = 'Site / Outros';
            else if (val === 'TIKTOK') label = 'TikTok Shop';
            opts.push({ value: val, label: `${label} (Forçar layout)` });
        });
        (generalSettings.customStores || []).forEach(store => {
            opts.push({ value: store.id.toUpperCase(), label: `${store.name} (Loja Customizada)` });
        });
        return opts;
    }, [generalSettings]);

    // History Management
    const [isHistoryManagerOpen, setIsHistoryManagerOpen] = useState(false);
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
    const [isDeletingBulk, setIsDeletingBulk] = useState(false);
    const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);
    
    // Estados para Mapeamento
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
    const [mappingCanal, setMappingCanal] = useState<string>('shopee');

    useEffect(() => {
        verifyDatabaseSetup().then(res => {
            if (res.setupNeeded) setDbInconsistency(res.details);
        });
    }, []);

    const handleFileSelect = (file: File | null) => {
        setSelectedFile(file);
        setError(null);
        // Reseta estados de datas ao trocar arquivo
        setAvailableShippingDates([]);
    };

    const handleCopySql = () => {
        navigator.clipboard.writeText(SETUP_SQL_STRING);
        setCopiedSql(true);
        setTimeout(() => setCopiedSql(false), 2000);
    };

    const handleUpdateMapping = (canalId: string, field: string, value: any) => {
        const key = canalId.toLowerCase();
        if (['ml', 'shopee', 'site', 'tiktok'].includes(key)) {
            setGeneralSettings(prev => ({
                ...prev, 
                importer: {
                    ...prev.importer, 
                    [key]: { ...prev.importer[key as 'ml' | 'shopee' | 'site' | 'tiktok'], [field]: value }
                }
            }));
        } else {
            setGeneralSettings(prev => ({
                ...prev, 
                [`importer_${key}`]: { ...((prev as any)[`importer_${key}`] || {}), [field]: value }
            }));
        }
    };

    const handleExtractHeaders = async () => {
        if (!selectedFile) return;
        try {
            const buffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const isML = selectedFile.name.toLowerCase().includes('vendas') || selectedFile.name.toLowerCase().includes('mercado');
            const detectedCanalKey = isML ? 'ml' : (selectedFile.name.toLowerCase().includes('shopee') ? 'shopee' : (selectedFile.name.toLowerCase().includes('tiktok') ? 'tiktok' : 'site'));
            const config = (generalSettings.importer as any)[detectedCanalKey];
            const startRow = config?.importStartRow !== undefined ? config.importStartRow : (isML ? 5 : 0);
            
            const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: startRow })[0] || [];
            setDetectedHeaders(headers);
            
            // Auto-seleciona o canal baseado no arquivo
            setMappingCanal(detectedCanalKey);
        } catch (e) {
            console.error("Erro ao extrair cabeçalhos:", e);
        }
    };

    // Quando o painel pede para re-extrair cabeçalhos (por ex. após mudar importStartRow)
    const handleRequestDetectHeaders = async (canalId: string, importStartRow?: number) => {
        if (!selectedFile) return;
        try {
            const buffer = await selectedFile.arrayBuffer();
            const startRow = importStartRow !== undefined
                ? importStartRow
                : (((generalSettings.importer as any)[canalId]?.importStartRow) ?? undefined);
            const { headers } = extractHeadersAndData(buffer, startRow);
            setDetectedHeaders(headers || []);
            setMappingCanal(canalId.toLowerCase());
        } catch (err) {
            console.error('Erro ao detectar cabeçalhos (request):', err);
        }
    };

    useEffect(() => {
        if (isMappingModalOpen && selectedFile && detectedHeaders.length === 0) {
            handleExtractHeaders();
        }
    }, [isMappingModalOpen]);

    const handleConfirmLink = async (masterSku: string) => {
        console.log(`🔗 Iniciando vínc ulo de ${linkModalState.skus.length} SKU(s) com produto mestre: ${masterSku}`);
        let sucessos = 0;
        let erros = 0;

        for (const sku of linkModalState.skus) {
            try {
                const resultado = await onLinkSku(sku.toUpperCase(), masterSku.toUpperCase());
                if (resultado) {
                    sucessos++;
                    console.log(`✅ SKU ${sku} vinculado com sucesso`);
                } else {
                    erros++;
                    console.warn(`❌ SKU ${sku} falhou ao vincular`);
                }
            } catch (err) {
                erros++;
                console.error(`❌ Erro ao vincular ${sku}:`, err);
            }
        }

        console.log(`📊 Resultado: ${sucessos} vinc ulo(s) bem-sucedido(s), ${erros} erro(s)`);

        setLinkModalState({ isOpen: false, skus: [], color: '' });
        setSelectedSkus(new Set());
    };

    const handleConfirmCreateAndLink = async (newItem: Omit<StockItem, 'id'>) => {
        console.log('🆕 Criando novo produto e vinculando SKU...');
        const product = await onAddNewItem(newItem);

        if (!product) {
            console.error('❌ Falha ao criar novo produto');
            return;
        }

        console.log(`✅ Produto criado: ${product.code} - ${product.name}`);

        if (createModalState.data) {
            const resultadoVinculo = await onLinkSku(
                createModalState.data.sku.toUpperCase(),
                product.code.toUpperCase()
            );

            if (resultadoVinculo) {
                console.log(`✅ SKU ${createModalState.data.sku} vinculado ao produto ${product.code}`);
            } else {
                console.error(`❌ Falha ao vincular SKU ${createModalState.data.sku}`);
            }
        }

        setCreateModalState({ isOpen: false, data: null });
        setSelectedSkus(new Set());
    };

    // 1. Botão "Iniciar Processamento" chama esta função
    const handleStartProcessing = async () => {
        if (!selectedFile) return;

        setIsScanningDates(true);
        setError(null);

        try {
            const buffer = await selectedFile.arrayBuffer();

            // Primeiro tentamos usar explicitamente o mapeamento vindo das configurações de Planilhas
            // para garantir que a coluna configurada (`dateShipping`) seja usada quando disponível.
            const { headers, sheetData } = extractHeadersAndData(buffer);
            console.debug('DEBUG: extracted headers =>', headers.slice(0, 50));
            const normalizeHeaderLocal = (s: any) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
            const targetMatch = (desired: string | undefined) => {
                if (!desired) return undefined;
                const t = normalizeHeaderLocal(desired);
                let mk = headers.find(h => normalizeHeaderLocal(h) === t);
                if (mk) return mk;
                mk = headers.find(h => normalizeHeaderLocal(h).includes(t));
                if (mk) return mk;
                mk = headers.find(h => t.includes(normalizeHeaderLocal(h)));
                if (mk) return mk;
                // Token matching com stopwords (ex: "Data de envio prevista" ↔ "Data prevista de envio")
                const sw = new Set(['DE', 'DO', 'DA', 'E', 'PARA', 'POR', 'O', 'A', 'EM', 'NO', 'NA', 'DOS', 'DAS', 'AO', 'PELO', 'PELA']);
                const tImp = t.split(' ').filter(Boolean).filter(w => !sw.has(w));
                if (tImp.length > 0) {
                    mk = headers.find(h => {
                        const hImp = normalizeHeaderLocal(h).split(' ').filter(Boolean).filter(w => !sw.has(w));
                        if (hImp.length === 0) return false;
                        const [shorter, longer] = tImp.length <= hImp.length ? [tImp, hImp] : [hImp, tImp];
                        return shorter.every(w => longer.includes(w));
                    });
                }
                return mk;
            };

            // Determina canal efetivo por cabeçalho + nome de arquivo quando estiver em AUTO.
            const detectChannelByConfig = (): Canal | 'AUTO' => {
                const byName = selectedFile.name.toUpperCase();
                if (byName.includes('TIKTOK')) return 'TIKTOK';
                if (byName.includes('MERCADO') || byName.includes('MELI') || byName.includes('ML_')) return 'ML';
                if (byName.includes('SHOPEE') || byName.includes('TO_SHIP') || byName.includes('TOSHIP') || byName.includes('ORDER')) return 'SHOPEE';

                let best: { canal: Canal | 'AUTO'; score: number } = { canal: 'AUTO', score: 0 };
                const candidates: Canal[] = ['ML', 'SHOPEE', 'TIKTOK', 'SITE'];
                for (const canal of candidates) {
                    const cfgKey = canal.toLowerCase() as 'ml' | 'shopee' | 'tiktok' | 'site';
                    // @ts-ignore
                    const cfg = (generalSettings.importer || {})[cfgKey] || {};
                    const keys = [cfg.orderId, cfg.sku, cfg.qty, cfg.tracking, cfg.date, cfg.dateShipping].filter(Boolean);
                    const score = keys.reduce((acc: number, key: string) => acc + (targetMatch(key) ? 1 : 0), 0);
                    if (score > best.score) best = { canal, score };
                }
                return best.score > 0 ? best.canal : 'AUTO';
            };

            const effectiveChannel: Canal | 'AUTO' = selectedChannel !== 'AUTO' ? selectedChannel : detectChannelByConfig();
            if (selectedChannel === 'AUTO' && effectiveChannel !== 'AUTO') {
                setSelectedChannel(effectiveChannel);
            }

            // Regra de negócio: seleção por datas só existe para Shopee.
            if (effectiveChannel !== 'SHOPEE') {
                setShippingDateKey(null);
                setAvailableShippingDates([]);
                setIsScanningDates(false);
                executeFullProcessing(buffer, undefined, effectiveChannel);
                return;
            }

            const channelCandidates: (Canal | 'AUTO')[] = [effectiveChannel];
            let foundDates: { date: string; count: number; key?: string }[] = [];
            let detectedKeyFromConfig: string | null = null;

            for (const ch of channelCandidates) {
                const cfgKey = ch.toLowerCase() as 'ml' | 'shopee' | 'tiktok' | 'site';
                // @ts-ignore
                const cfg = (generalSettings.importer || {})[cfgKey];
                if (!cfg) continue;
                const desired = cfg.dateShipping || cfg.date;
                if (!desired) continue;

                const matched = targetMatch(desired);
                console.debug('DEBUG: trying config', ch, 'desired:', desired, 'matched:', matched);
                if (!matched) continue;

                // Computa contagem de datas usando a coluna mapeada da config
                const dateMap = new Map<string, number>();
                const normalizeDateLocal = (raw: any) => {
                    if (!raw) return '';
                    if (raw instanceof Date) {
                        const y = raw.getUTCFullYear(), m = String(raw.getUTCMonth()+1).padStart(2,'0'), d = String(raw.getUTCDate()).padStart(2,'0');
                        return `${y}-${m}-${d}`;
                    }
                    let s = String(raw).trim();
                    if (s.includes(' ')) s = s.split(' ')[0];
                    s = s.replace(/[AP]M$/i, '').trim();
                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
                    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
                    const shortY = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
                    if (shortY) { const yy = parseInt(shortY[3],10); return `${yy>=70?1900+yy:2000+yy}-${shortY[2].padStart(2,'0')}-${shortY[1].padStart(2,'0')}`; }
                    const parsed = new Date(s);
                    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
                    return '';
                };

                for (const row of sheetData as any[]) {
                    const val = row[matched];
                    const nd = normalizeDateLocal(val);
                    if (nd) dateMap.set(nd, (dateMap.get(nd) || 0) + 1);
                }

                if (dateMap.size > 0) {
                    foundDates = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count, key: matched }));
                    detectedKeyFromConfig = matched;
                    console.debug('DEBUG: foundDates from config column', matched, '=>', foundDates.slice(0,20));
                    // log sample rows for diagnosis
                    console.debug('DEBUG: sample sheet rows (first 5) for column', matched, sheetData.slice(0,5).map(r => r[matched]));
                    break;
                }
            }

            if (foundDates.length === 0) {
                // Fallback para heurística existente
                const dates = extractShippingDates(buffer, generalSettings, effectiveChannel, selectedFile.name);
                console.debug('DEBUG: extractShippingDates ->', dates);
                foundDates = dates;
            }

            if (foundDates.length > 0) {
                const normalizeYMD = (v?: string) => {
                    if (!v) return '';
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
                    const d = new Date(v);
                    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
                    return '';
                };

                const enriched = (foundDates as any[]).map(d => {
                    const date = d.date as string;
                    const saved = allOrders.filter(o => normalizeYMD(o.data_prevista_envio) === date).length;
                    return { date, count: d.count, saved };
                });

                setAvailableShippingDates(enriched);
                // guarda a coluna detectada (para forçar o parse a usar a mesma coluna)
                const detectedKey = detectedKeyFromConfig || (foundDates[0] as any).key || null;
                setShippingDateKey(detectedKey);
                console.debug('DEBUG: shippingDateKey set to', detectedKey, 'enriched:', enriched);
                setIsScanningDates(false);
                setIsDateModalOpen(true);
                return;
            }

            // Sem datas válidas para Shopee: segue sem filtro para não bloquear importação.
            setShippingDateKey(null);
            executeFullProcessing(buffer, undefined, effectiveChannel);
            setIsScanningDates(false);
        } catch (e: any) {
            console.error("Erro ao analisar datas:", e);
            // Em caso de erro na pré-análise, tenta processar direto (fallback)
            const buffer = await selectedFile.arrayBuffer();
            executeFullProcessing(buffer, undefined);
            setIsScanningDates(false);
        }
    };

    // 2. Callback do Modal de Datas (Confirmar)
    const handleDateConfirm = async (selectedDates: string[]) => {
        if (!selectedFile) return;

        setIsProcessing(true); // Mostra loading principal
        try {
            // Primeiro rodar diagnóstico com as datas selecionadas para garantir que haverá resultados
            const diag = await runDiagnostics(selectedDates);
            // Só bloqueia se o diagnóstico rodou com sucesso E retornou 0 resultados
            // Se parseWithOverride for undefined (erro), deixa o processamento real tentar
            const parseResult = diag?.parseWithOverride;
            if (parseResult !== undefined && parseResult !== null && (parseResult.total === 0 || parseResult.total === null)) {
                setError('Nenhum pedido encontrado para as datas selecionadas. Execute o diagnóstico para mais detalhes.');
                setIsProcessing(false);
                return;
            }

            // Se passou no diagnóstico, fecha o modal e processa
            setIsDateModalOpen(false);
            const buffer = await selectedFile.arrayBuffer();
            console.debug('DEBUG: handleDateConfirm -> selectedDates', selectedDates, 'shippingDateKey', shippingDateKey);
            executeFullProcessing(buffer, selectedDates);
        } catch (e) {
            setIsProcessing(false);
        }
    };

    // Handler para diagnóstico acionado pelo modal — retorna um objeto serializável
    const runDiagnostics = async (selectedDates?: string[]) => {
        if (!selectedFile) return { error: 'Nenhum arquivo selecionado' };
        try {
            const buffer = await selectedFile.arrayBuffer();
            const { headers, sheetData } = extractHeadersAndData(buffer as any);
            const sampleRows = (sheetData as any[]).slice(0, 5).map((r: any) => {
                const obj: any = {};
                headers.slice(0, 20).forEach((h: any) => obj[h] = r[h]);
                return obj;
            });

            let extractDates: any = null;
            try { extractDates = extractShippingDates(buffer as any, generalSettings, selectedChannel, selectedFile.name); } catch (e) { extractDates = { error: String(e) }; }

            const diagnostics: any = { headers: headers.slice(0, 200), sampleRows, extractShippingDates: extractDates, shippingDateKey };

            // Incluir mapeamentos atuais das configurações de importer e checar presença nos headers
            try {
                const importerCfg = generalSettings.importer || {};
                diagnostics.importerConfig = importerCfg;
                const cfgChecks: any = {};
                for (const canalKey of ['ml', 'shopee', 'tiktok', 'site']) {
                    const cfg = importerCfg[canalKey as 'ml'|'shopee'|'site'] || {} as any;
                    cfgChecks[canalKey] = {};
                    for (const k of Object.keys(cfg)) {
                        const v = cfg[k];
                        if (typeof v === 'string' && v) {
                            cfgChecks[canalKey][k] = { expected: v, presentInHeaders: headers.includes(v), normalizedHeaderMatch: headers.find(h => String(h).trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === String(v).trim().toUpperCase()) };
                        }
                    }
                }
                diagnostics.importerConfigChecks = cfgChecks;
            } catch (e) { diagnostics.importerConfigChecksError = String(e); }

            // Tenta parse sem filtros
            try {
                const rawNoFilter = parseExcelFile(buffer, selectedFile.name, allOrders, generalSettings, { ...importOptions, tiktokOrderType, allowedShippingDates: undefined, columnOverrides: undefined }, selectedChannel);
                diagnostics.parseWithoutFilters = { total: rawNoFilter.lists?.completa?.length ?? null, sample: (rawNoFilter.lists?.completa || []).slice(0, 10) };
            } catch (e: any) {
                diagnostics.parseWithoutFiltersError = String(e?.message || e);
            }

            // Tenta parse com columnOverrides e as datas selecionadas (se fornecidas) ou todas as datas detectadas
            try {
                // Coleta internals do parser para diagnóstico (headerKeyMap, sheetKeys, sampleRow)
                try {
                    const internals = getParserInternals(buffer as any, generalSettings, selectedChannel, { columnOverrides: shippingDateKey ? { dateShipping: shippingDateKey } : undefined });
                    diagnostics.parserInternals = internals;
                } catch (inner) {
                    diagnostics.parserInternalsError = String(inner);
                }
                const datesAll = (selectedDates && selectedDates.length > 0) ? selectedDates : availableShippingDates.map(d => d.date);
                const rawWithOverride = parseExcelFile(buffer, selectedFile.name, allOrders, generalSettings, { ...importOptions, tiktokOrderType, allowedShippingDates: datesAll.length ? datesAll : undefined, columnOverrides: shippingDateKey ? { dateShipping: shippingDateKey } : undefined }, selectedChannel);
                diagnostics.parseWithOverride = { total: rawWithOverride.lists?.completa?.length ?? null, sample: (rawWithOverride.lists?.completa || []).slice(0, 10) };
            } catch (e: any) {
                diagnostics.parseWithOverrideError = String(e?.message || e);
            }

            return diagnostics;
        } catch (err: any) {
            return { error: String(err?.message || err) };
        }
    };

    // 3. Execução real do processamento (com ou sem datas filtradas)
    const executeFullProcessing = (buffer: ArrayBuffer, allowedDates?: string[], channelOverride?: Canal | 'AUTO') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        try {
            console.debug('DEBUG: executeFullProcessing -> allowedDates', allowedDates, 'channelOverride', channelOverride, 'columnOverrides', shippingDateKey ? { dateShipping: shippingDateKey } : undefined, 'fileName', selectedFile?.name);
            const data = parseExcelFile(
                buffer,
                selectedFile.name,
                allOrders,
                generalSettings,
                {
                    ...importOptions,
                    allowedShippingDates: allowedDates,
                    columnOverrides: shippingDateKey ? { dateShipping: shippingDateKey } : undefined,
                    tiktokOrderType
                },
                channelOverride || selectedChannel
            );
            setProcessedData(data);
            setIsViewingHistory(false);
            addImportToHistory({
                fileName: selectedFile.name,
                processedAt: new Date().toISOString(),
                user: currentUser.name,
                item_count: data.lists.completa.length,
                unlinked_count: data.skusNaoVinculados.length,
                canal: data.canal
            }, data);
        } catch (err: any) {
            const msg = err?.message || 'Erro crítico ao ler planilha.';
            console.error('DEBUG: parse error ->', err);
            // Se for o erro conhecido de nenhum pedido importado, coletar diagnósticos adicionais
            if (msg.includes('Nenhum pedido importado')) {
                try {
                    const hdrs = extractHeadersAndData(buffer as any).headers;
                    const datesDiag = extractShippingDates(buffer as any, generalSettings, selectedChannel);
                    console.debug('DEBUG-DIAG: headers', hdrs.slice(0, 100));
                    console.debug('DEBUG-DIAG: extractShippingDates', datesDiag);
                    // Tenta rodar parse sem filtro para ver se existem pedidos sem filtro
                    try {
                        const raw = parseExcelFile(buffer, selectedFile.name, allOrders, generalSettings, { ...importOptions, tiktokOrderType, allowedShippingDates: undefined, columnOverrides: undefined }, selectedChannel);
                        console.debug('DEBUG-DIAG: parse without filters -> total', raw.lists.completa.length, 'sample', raw.lists.completa.slice(0,10));
                    } catch (innerErr: any) {
                        console.debug('DEBUG-DIAG: parse without filters erro ->', innerErr?.message || innerErr);
                    }
                } catch (diagErr) {
                    console.debug('DEBUG-DIAG: failed to collect diagnostics', diagErr);
                }
            }
            setError(msg);
        } finally { setIsProcessing(false); }
    };

    const handleLaunch = () => {
        if (!processedData) return;
        const loteId = `IMPORT-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
        const ordersToLaunch = processedData.lists.completa.map(order => ({
            ...order,
            lote_id: loteId,
            status: importAsHistory 
                ? 'BIPADO' 
                : (importAsNormalWithDate && order.data_prevista_envio ? 'NORMAL' : (order.status || 'NORMAL'))
        }));

        onLaunchSuccess(ordersToLaunch as any);
        setProcessedData(null);
        setImportAsHistory(false); // Reset checkbox
        setSelectedFile(null); // Reset file
    };

    const handleViewHistory = async (item: ImportHistoryItem) => {
        setIsProcessing(true);
        const data = await onGetImportHistoryDetails(item.id);
        if (data) {
            setProcessedData(data);
            setIsViewingHistory(true);
            setSelectedFile(null);
            setIsHistoryManagerOpen(false); // Close manager if open
        } else { alert("Não foi possível recuperar os dados desta importação histórica."); }
        setIsProcessing(false);
    };

    const handleToggleSelectHistory = (id: string) => {
        setSelectedHistoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSelectAllHistory = () => {
        if (selectedHistoryIds.size === importHistory.length) {
            setSelectedHistoryIds(new Set());
        } else {
            setSelectedHistoryIds(new Set(importHistory.map(i => i.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (!onBulkDeleteHistory) return;
        setIsDeletingBulk(true);
        await onBulkDeleteHistory(Array.from(selectedHistoryIds));
        setIsDeletingBulk(false);
        setIsConfirmBulkDeleteOpen(false);
        setSelectedHistoryIds(new Set());
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-6">
                {dbInconsistency && (
                    <div className="p-5 bg-red-100 border-2 border-red-500 rounded-2xl text-red-900 flex flex-col gap-3 animate-in slide-in-from-top-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="text-red-600" size={32} />
                            <div>
                                <p className="font-black text-lg">Banco de Dados Incompleto!</p>
                                <p className="text-sm opacity-80 font-medium">Faltam funções RPC para processamento de pedidos. Cole o código SQL no seu Supabase para consertar.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleCopySql} className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-all">
                                {copiedSql ? <Check size={18} /> : <Copy size={18} />}
                                {copiedSql ? 'Copiado!' : 'Copiar Código de Reparo SQL'}
                            </button>
                            <button onClick={() => window.location.reload()} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl font-bold">Já atualizei, Recarregar</button>
                        </div>
                    </div>
                )}

                {isViewingHistory && (
                    <div className="flex items-center justify-between bg-blue-600 text-white p-4 rounded-2xl shadow-lg border-2 border-blue-400">
                        <div className="flex items-center gap-3"><History size={24} /><div><p className="font-black">Visualização de Histórico</p><p className="text-xs opacity-80">Dados da importação realizada em {new Date(processedData?.importId.split('_')[1] ? Number(processedData.importId.split('_')[1]) : 0).toLocaleString()}</p></div></div>
                        <button onClick={() => { setProcessedData(null); setIsViewingHistory(false); }} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-bold text-sm transition-all">Sair do Histórico</button>
                    </div>
                )}

                {!processedData && !isViewingHistory && (
                    <>
                        <div className="relative">
                            <FileUploader
                                onFileSelect={handleFileSelect}
                                selectedFile={selectedFile}
                            />
                            {isScanningDates && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10 animate-in fade-in">
                                    <div className="flex items-center gap-3 font-bold text-blue-600 bg-white p-6 rounded-2xl shadow-2xl border-2 border-blue-100">
                                        <Loader2 className="animate-spin" size={24} />
                                        <div>
                                            <p>Analisando datas de envio...</p>
                                            <p className="text-xs text-gray-400 font-medium mt-1">Isso geralmente é rápido.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedFile && (
                            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in zoom-in-95">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <div className="flex items-center gap-2">
                                        <Settings size={20} className="text-blue-600" />
                                        <h3 className="font-black text-gray-800 uppercase tracking-tighter">Configuração de Importação</h3>
                                    </div>
                                    <button 
                                        onClick={() => setIsMappingModalOpen(true)}
                                        className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1.5 transition-all"
                                    >
                                        <FileSpreadsheet size={14} /> Mapear Colunas
                                    </button>
                                </div>

                                {/* Seleção de Canal Manual */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Canal / Layout da Planilha</label>
                                    <select
                                        value={selectedChannel}
                                        onChange={e => setSelectedChannel(e.target.value as any)}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {channelOptions.map((opt, idx) => (
                                            <option key={`${opt.value}-${idx}`} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-2 font-medium">Use "Automático" por padrão. Se houver erro de colunas não encontradas, selecione o canal específico aqui.</p>
                                </div>

                                {(selectedChannel === 'TIKTOK' || (selectedChannel === 'AUTO' && selectedFile && selectedFile.name.toUpperCase().includes('TIKTOK'))) && (
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                        <label className="block text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2">TikTok — Tipo de Pedido</label>
                                        <select
                                            value={tiktokOrderType}
                                            onChange={e => setTiktokOrderType(e.target.value as any)}
                                            className="w-full p-3 bg-white border border-purple-200 rounded-xl text-sm font-bold text-purple-700 focus:ring-2 focus:ring-purple-500 outline-none"
                                        >
                                            <option value="all">Todos (Normal + Pre-order)</option>
                                            <option value="normal">Somente Normal (pedidos do dia)</option>
                                            <option value="pre-order">Somente Pre-order (pedidos futuros)</option>
                                        </select>
                                        <p className="text-[10px] text-purple-400 mt-2 font-medium">"Normal" são pedidos para envio imediato. "Pre-order" são pedidos com entrega para dias futuros.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all">
                                        <input type="checkbox" checked={importOptions.importCpf} onChange={e => setImportOptions(p => ({ ...p, importCpf: e.target.checked }))} className="w-6 h-6 text-blue-600 rounded mt-0.5 shadow-sm" />
                                        <div className="text-sm">
                                            <p className="font-black text-gray-800">Extrair CPF/CNPJ</p>
                                            <p className="text-xs text-gray-500 font-medium">Habilita conferência de documentos na expedição.</p>
                                        </div>
                                    </label>
                                    <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer border-2 border-transparent hover:border-blue-500 transition-all">
                                        <input type="checkbox" checked={importOptions.importName} onChange={e => setImportOptions(p => ({ ...p, importName: e.target.checked }))} className="w-6 h-6 text-blue-600 rounded mt-0.5 shadow-sm" />
                                        <div className="text-sm">
                                            <p className="font-black text-gray-800">Extrair Nome do Cliente</p>
                                            <p className="text-xs text-gray-500 font-medium">Exibe o nome do comprador no painel de pedidos.</p>
                                        </div>
                                    </label>
                                    <label className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer border-2 border-transparent hover:border-orange-500 transition-all sm:col-span-2">
                                        <input type="checkbox" checked={importOptions.descontarVolatil} onChange={e => setImportOptions(p => ({ ...p, descontarVolatil: e.target.checked }))} className="w-6 h-6 text-orange-600 rounded mt-0.5 shadow-sm" />
                                        <div className="text-sm">
                                            <p className="font-black text-orange-800">Descontar do Estoque Volátil</p>
                                            <p className="text-xs text-orange-600 font-medium">Se marcado, a bipagem destes itens irá priorizar o abatimento do estoque volátil dos pacotes prontos.</p>
                                        </div>
                                    </label>
                                </div>
                                <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex gap-3 items-center">
                                    <Info size={24} className="text-gray-400 flex-shrink-0" />
                                    <p className="text-xs font-bold text-gray-600">Dica: Se a planilha contiver datas de envio (ex: Shopee), um seletor aparecerá após clicar no botão abaixo.</p>
                                </div>
                                <button onClick={handleStartProcessing} disabled={isProcessing || isScanningDates} className="w-full flex items-center justify-center gap-2 py-5 bg-blue-600 text-white font-black text-lg rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-100 transform active:scale-95">
                                    {isProcessing ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
                                    {isProcessing ? 'Lendo e Analisando...' : 'Iniciar Processamento'}
                                </button>
                            </div>
                        )}
                    </>
                )}

                {error && <div className="p-5 bg-red-100 text-red-900 rounded-2xl border-2 border-red-200 flex flex-col gap-2 font-medium shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 font-black text-lg"><X size={24} className="bg-red-500 text-white p-1 rounded-full" /> Erro na Importação</div>
                    <p>{error}</p>
                </div>}

                {processedData && (
                    <>
                        {/* New Toggle for Import Type */}
                        {!isViewingHistory && (
                            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-xl mb-4 flex items-center gap-4">
                                <input
                                    type="checkbox"
                                    id="import-history-check"
                                    checked={importAsHistory}
                                    onChange={(e) => setImportAsHistory(e.target.checked)}
                                    className="w-6 h-6 text-amber-600 rounded focus:ring-amber-500"
                                />
                                <div>
                                    <label htmlFor="import-history-check" className="font-black text-amber-900 text-sm uppercase cursor-pointer">Importar como Histórico / Financeiro (Já Enviados)</label>
                                    <p className="text-xs text-amber-700 font-medium">Se marcado, os pedidos serão salvos como "BIPADO" e não aparecerão na lista de pendências da produção. Use isso para alimentar dados financeiros antigos.</p>
                                </div>
                            </div>
                        )}

                        {!isViewingHistory && !importAsHistory && (
                            <div className="bg-emerald-50 border-2 border-emerald-200 p-4 rounded-xl mb-4 flex items-center gap-4">
                                <input
                                    type="checkbox"
                                    id="import-normal-with-date-check"
                                    checked={importAsNormalWithDate}
                                    onChange={(e) => setImportAsNormalWithDate(e.target.checked)}
                                    className="w-6 h-6 text-emerald-600 rounded focus:ring-emerald-500"
                                />
                                <div>
                                    <label htmlFor="import-normal-with-date-check" className="font-black text-emerald-900 text-sm uppercase cursor-pointer">Forçar como Pedidos do Dia (Ativos)</label>
                                    <p className="text-xs text-emerald-700 font-medium">Se marcado, qualquer pedido que contenha uma **Data de Postagem** será importado como "NORMAL" (ativo), ignorando status de cancelamento/conclusão da planilha. Útil para reimportar biipagens.</p>
                                </div>
                            </div>
                        )}

                        <ImportResults
                            data={processedData}
                            blingLinkedIds={blingLinkedIds}
                            onLaunchSuccess={handleLaunch}
                            onCancel={() => { setProcessedData(null); setSelectedFile(null); setImportAsHistory(false); }}
                            skuLinks={skuLinks}
                            products={products}
                            onLinkSku={async (sku, master) => await onLinkSku(sku.toUpperCase(), master.toUpperCase())}
                            onOpenLinkModal={(skus, color) => setLinkModalState({ isOpen: true, skus, color })}
                            onOpenCreateProductModal={(data) => { setCreateModalState({ isOpen: true, data: { skus: [data.sku], colorSugerida: data.colorSugerida, baseSugerida: data.baseSugerida, isMiudoSugerido: data.isMiudoSugerido } }); }}
                            produtosCombinados={produtosCombinados}
                            stockItems={stockItems}
                            generalSettings={generalSettings}
                            isHistoryView={isViewingHistory}
                            users={users} // Pass users down
                        />
                    </>
                )}
            </div>

            <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm h-fit sticky top-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-gray-800 flex items-center gap-2 uppercase text-xs tracking-widest"><History size={18} className="text-blue-500" /> Histórico</h3>
                    <button
                        onClick={() => setIsHistoryManagerOpen(true)}
                        className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                    >
                        <List size={14} /> Gerenciar
                    </button>
                </div>
                <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {importHistory.length > 0 ? importHistory.slice(0, 10).map(item => (
                        <div key={item.id} className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-blue-400 hover:shadow-xl hover:bg-white transition-all group relative">
                            <div onClick={() => handleViewHistory(item)} className="cursor-pointer">
                                <div className="flex justify-between items-start">
                                    <p className="font-black text-gray-800 text-xs truncate w-32">{item.fileName}</p>
                                    <span className={`font-black uppercase px-2 py-0.5 rounded-lg text-[9px] ${item.canal === 'ML' ? 'bg-yellow-400 text-yellow-900' : 'bg-orange-50 text-white'}`}>{item.canal}</span>
                                </div>
                                <p className="text-gray-400 text-[10px] font-bold mt-1 uppercase">{new Date(item.processedAt).toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <div className="flex gap-1.5" onClick={() => handleViewHistory(item)}>
                                    <span className="bg-white border-2 border-gray-100 text-[10px] px-2 py-0.5 rounded-lg font-black text-gray-600">{item.itemCount} Itens</span>
                                    {item.unlinkedCount > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black">{item.unlinkedCount} N/V</span>}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleViewHistory(item)} className="text-gray-300 hover:text-blue-500 transition-colors"><Eye size={18} /></button>
                                    <button onClick={() => onDeleteHistoryItem(item)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-center text-gray-400 py-10 italic text-sm font-bold">Nenhuma importação.</p>}
                    {importHistory.length > 10 && <p className="text-center text-xs text-gray-400 font-bold mt-4 cursor-pointer hover:text-blue-600" onClick={() => setIsHistoryManagerOpen(true)}>+ {importHistory.length - 10} importações antigas...</p>}
                </div>
            </div>

            {/* History Manager Modal */}
            {isHistoryManagerOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Gerenciar Histórico Completo</h2>
                                <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">{importHistory.length} importações registradas</p>
                            </div>
                            <button onClick={() => setIsHistoryManagerOpen(false)} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500"><X size={24} /></button>
                        </div>

                        <div className="flex-1 overflow-auto p-0">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4 w-12 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedHistoryIds.size === importHistory.length && importHistory.length > 0}
                                                onChange={handleSelectAllHistory}
                                                className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                            />
                                        </th>
                                        <th className="p-4 text-left">Data/Hora</th>
                                        <th className="p-4 text-left">Arquivo</th>
                                        <th className="p-4 text-left">Usuário</th>
                                        <th className="p-4 text-center">Itens</th>
                                        <th className="p-4 text-center">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 font-bold text-slate-600">
                                    {importHistory.map(item => (
                                        <tr key={item.id} className={`${selectedHistoryIds.has(item.id) ? 'bg-blue-50' : 'hover:bg-slate-50'} transition-colors`}>
                                            <td className="p-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHistoryIds.has(item.id)}
                                                    onChange={() => handleToggleSelectHistory(item.id)}
                                                    className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4">{new Date(item.processedAt).toLocaleString('pt-BR')}</td>
                                            <td className="p-4 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${item.canal === 'ML' ? 'bg-yellow-400' : 'bg-orange-500'}`}></span>
                                                {item.fileName}
                                            </td>
                                            <td className="p-4">{item.user}</td>
                                            <td className="p-4 text-center">
                                                {item.itemCount}
                                                {item.unlinkedCount > 0 && <span className="ml-2 text-red-500 text-[10px] bg-red-50 px-2 py-0.5 rounded-md">+{item.unlinkedCount} N/V</span>}
                                            </td>
                                            <td className="p-4 text-center flex justify-center gap-2">
                                                <button onClick={() => handleViewHistory(item)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Eye size={18} /></button>
                                                <button onClick={() => onDeleteHistoryItem(item)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-3xl flex justify-between items-center">
                            <span className="text-xs font-black text-slate-400 uppercase">{selectedHistoryIds.size} selecionados</span>
                            <div className="flex gap-3">
                                <button onClick={() => setIsHistoryManagerOpen(false)} className="px-6 py-3 rounded-xl bg-white border font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-gray-50">Fechar</button>
                                {selectedHistoryIds.size > 0 && (
                                    <button
                                        onClick={() => setIsConfirmBulkDeleteOpen(true)}
                                        className="px-6 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-red-200 hover:bg-red-700 flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Excluir Selecionados ({selectedHistoryIds.size})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <LinkSkuModal isOpen={linkModalState.isOpen} onClose={() => setLinkModalState({ isOpen: false, skus: [], color: '' })} skusToLink={linkModalState.skus} colorSugerida={linkModalState.color} onConfirmLink={handleConfirmLink} products={stockItems.filter(i => i.kind === 'PRODUTO' || i.kind === 'PROCESSADO')} skuLinks={skuLinks} onTriggerCreate={() => { setLinkModalState(p => ({ ...p, isOpen: false })); setCreateModalState({ isOpen: true, data: { sku: linkModalState.skus[0], colorSugerida: linkModalState.color } }); }} />
            {createModalState.data && <CreateProductFromImportModal isOpen={createModalState.isOpen} onClose={() => setCreateModalState({ isOpen: false, data: null })} unlinkedSkuData={createModalState.data ? { skus: [createModalState.data.sku], colorSugerida: createModalState.data.colorSugerida } : null} onConfirm={handleConfirmCreateAndLink} generalSettings={generalSettings} />}

            <ConfirmActionModal
                isOpen={isConfirmBulkDeleteOpen}
                onClose={() => setIsConfirmBulkDeleteOpen(false)}
                onConfirm={handleBulkDelete}
                title={`Excluir ${selectedHistoryIds.size} Importações`}
                message={<><p>Você tem certeza que deseja excluir <strong>{selectedHistoryIds.size}</strong> importações do histórico?</p><p className="mt-2 text-red-600 font-bold">Isso apagará TODOS os pedidos vinculados a essas importações do banco de dados.</p><p className="text-xs mt-1">Essa ação é irreversível.</p></>}
                confirmButtonText="Sim, Excluir Tudo"
                isConfirming={isDeletingBulk}
            />

            <DateSelectionModal
                isOpen={isDateModalOpen}
                onClose={() => { setIsDateModalOpen(false); }}
                availableDates={availableShippingDates}
                onConfirm={handleDateConfirm}
                fileName={selectedFile?.name || ''}
                onRunDiagnostics={runDiagnostics}
            />
            {/* Modal de Mapeamento de Colunas */}
            {isMappingModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden overflow-x-hidden">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                                    <FileSpreadsheet className="text-blue-600" />
                                    Mapeamento de Colunas
                                </h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Configure quais colunas da planilha correspondem aos dados do ERP</p>
                            </div>
                            <button onClick={() => setIsMappingModalOpen(false)} className="p-3 bg-white text-gray-400 hover:text-red-500 rounded-2xl transition-all shadow-sm">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8">
                            <div className="mb-6 max-w-sm">
                                <label className="text-[10px] font-black text-gray-400 uppercase mb-1 block">Perfil / Layout</label>
                                <select
                                    value={mappingCanal}
                                    onChange={(e) => setMappingCanal(e.target.value)}
                                    className="w-full p-2.5 border rounded-xl bg-white text-sm font-bold"
                                >
                                    {channelOptions
                                        .filter(opt => String(opt.value).toUpperCase() !== 'AUTO')
                                        .map(opt => (
                                            <option key={opt.value} value={String(opt.value).toLowerCase()}>
                                                {opt.label}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <MappingPanel
                                canalId={mappingCanal}
                                canalName={(() => {
                                    const found = channelOptions.find(o => String(o.value).toLowerCase() === mappingCanal);
                                    return found ? found.label : mappingCanal === 'ml' ? 'Mercado Livre' : mappingCanal === 'shopee' ? 'Shopee' : 'Padrão';
                                })()}
                                settings={generalSettings}
                                onUpdateMapping={handleUpdateMapping}
                                onRequestDetectHeaders={handleRequestDetectHeaders}
                                detectedHeaders={detectedHeaders}
                                mode="import"
                            />
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-gray-100 flex justify-between items-center">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Info size={16} className="text-blue-500" />
                                {detectedHeaders.length > 0 
                                    ? `${detectedHeaders.length} colunas detectadas no arquivo atual.` 
                                    : 'Nenhum arquivo carregado para detecção automática.'}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        // Re-salva as configurações gerais (chama handleSaveGeneralSettings no App)
                                        try { setGeneralSettings((prev: any) => ({ ...prev })); } catch (e) { console.error('Erro ao salvar mapeamento:', e); }
                                        setIsMappingModalOpen(false);
                                    }}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all"
                                >
                                    Salvar Mapeamento
                                </button>

                                <button 
                                    onClick={() => setIsMappingModalOpen(false)}
                                    className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                                >
                                    Concluir Mapeamento
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
