
import React, { useState } from 'react';
import { X, FileUp, Loader2, CheckCircle2, Settings, AlertTriangle, Layers, Database, Globe, Calendar, Save, Plus, Power, Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { GeneralSettings, OrderItem, ProcessedData, Canal, CustomStore } from '../types';
import { parseExcelFile, extractHeadersAndData, getParserInternals } from '../lib/parser';
import { parseSalesNFeXML, extractXmlsFromZip } from '../lib/xmlParser';

interface FinanceImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    allOrders: OrderItem[];
    generalSettings: GeneralSettings;
    onLaunchOrders: (orders: OrderItem[]) => Promise<void>;
    onSaveSettings?: (settings: GeneralSettings) => void;
}

type ImportType = 'finance_only' | 'full_import';

const OFF_VALUE = '__OFF__';

const FinanceImportModal: React.FC<FinanceImportModalProps> = ({ isOpen, onClose, allOrders, generalSettings, onLaunchOrders, onSaveSettings }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [importType, setImportType] = useState<ImportType>('finance_only');
    const [resultSummary, setResultSummary] = useState<{ updated: number, created: number, errors: { orderId: string, sku: string, reason: string }[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<Canal | 'AUTO' | string>('AUTO');
    const [importStatus, setImportStatus] = useState<string>('');
    const [newCustomChannelName, setNewCustomChannelName] = useState('');
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [configSaved, setConfigSaved] = useState(false);

    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [ignoreShipping, setIgnoreShipping] = useState(false);

    const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [columnMapping, setColumnMapping] = useState({
        priceGross: '',
        platformFees: [] as string[],
        shippingFee: '',
        shippingPaidByCustomer: '',
        priceNet: '',
        statusColumn: '',
        acceptedStatusValues: '',
        importStartRow: undefined as number | undefined,
        sumMultipleLines: false
    });
    
    const [importToFiscal, setImportToFiscal] = useState(false);
    const [includeErrorOrders, setIncludeErrorOrders] = useState(true);

    // Diagnostic state
    const [diagnosticData, setDiagnosticData] = useState<{
        canalDetectado: string;
        headerRowIndex: number;
        totalRows: number;
        sheetKeys: string[];
        headerKeyMap: Record<string, string | undefined>;
        sampleRow: any;
        unmappedFields: string[];
        mappingToUse: any;
    } | null>(null);
    const [showDiagnostic, setShowDiagnostic] = useState(false);
    const [importDiagnostic, setImportDiagnostic] = useState<{
        totalRowsSheet: number;
        totalParsed: number;
        filteredByDate: number;
        filteredByStatus: number;
        skippedNoIdSku: number;
        skippedQty: number;
        duplicates: number;
        created: number;
        updated: number;
        zeroValues: number;
        canalDetectado: string;
        headerRow: number;
        columnsMatched: string[];
        columnsMissing: string[];
    } | null>(null);

    const resetState = () => {
        setFiles([]);
        setIsProcessing(false);
        setResultSummary(null);
        setError(null);
        setImportType('finance_only');
        setSelectedChannel('AUTO');
        setFilterStartDate('');
        setFilterEndDate('');
        setImportStatus('');
        setIgnoreShipping(false);
        setAvailableHeaders([]);
        setSheetData([]);
        setConfigSaved(false);
        setNewCustomChannelName('');
        setShowAddChannel(false);
        setImportToFiscal(false);
        setIncludeErrorOrders(true);
        setDiagnosticData(null);
        setShowDiagnostic(false);
        setImportDiagnostic(null);
        setColumnMapping({ priceGross: '', platformFees: [], shippingFee: '', shippingPaidByCustomer: '', priceNet: '', statusColumn: '', acceptedStatusValues: '', importStartRow: undefined, sumMultipleLines: false });
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    React.useEffect(() => {
        if (selectedChannel === 'AUTO') {
            setColumnMapping({ priceGross: '', platformFees: [], shippingFee: '', priceNet: '', statusColumn: '', acceptedStatusValues: '' });
            return;
        }
        const canalKey = selectedChannel.toLowerCase();
        const knownKeys = ['ml', 'shopee', 'site'];
        const config = knownKeys.includes(canalKey)
            ? (generalSettings.importer as any)[canalKey] || {}
            : (generalSettings as any)[`importer_${canalKey}`] || {};

        setColumnMapping({
            priceGross: config.priceGross || '',
            platformFees: config.fees || [],
            shippingFee: config.shippingFee || '',
            shippingPaidByCustomer: config.shippingPaidByCustomer || '',
            priceNet: config.priceNet || '',
            statusColumn: config.statusColumn || '',
            acceptedStatusValues: config.acceptedStatusValues ? config.acceptedStatusValues.join(', ') : '',
            importStartRow: config.importStartRow,
            sumMultipleLines: config.sumMultipleLines ?? false
        });
        setConfigSaved(false);
    }, [selectedChannel, generalSettings.importer]);

    const handleAddCustomChannel = () => {
        if (!newCustomChannelName.trim() || !onSaveSettings) return;
        const id = newCustomChannelName.trim().toUpperCase().replace(/\s+/g, '_');
        const existing = generalSettings.customStores || [];
        if (existing.some(s => s.id === id)) return;
        const newStore: CustomStore = { id, name: newCustomChannelName.trim() };
        onSaveSettings({ ...generalSettings, customStores: [...existing, newStore] });
        setSelectedChannel(id);
        setNewCustomChannelName('');
        setShowAddChannel(false);
    };

    const handleSaveChannelConfig = () => {
        if (!onSaveSettings || selectedChannel === 'AUTO') return;
        const canalKey = selectedChannel.toLowerCase();
        const knownKeys = ['ml', 'shopee', 'site'];
        const configData = {
            priceGross: columnMapping.priceGross === OFF_VALUE ? '' : columnMapping.priceGross,
            fees: columnMapping.platformFees.filter(f => f !== OFF_VALUE),
            shippingFee: columnMapping.shippingFee === OFF_VALUE ? '' : columnMapping.shippingFee,
            shippingPaidByCustomer: columnMapping.shippingPaidByCustomer === OFF_VALUE ? '' : columnMapping.shippingPaidByCustomer,
            priceNet: columnMapping.priceNet === OFF_VALUE ? '' : columnMapping.priceNet,
            statusColumn: columnMapping.statusColumn === OFF_VALUE ? '' : columnMapping.statusColumn,
            acceptedStatusValues: columnMapping.acceptedStatusValues ? columnMapping.acceptedStatusValues.split(',').map(s => s.trim()) : [],
            importStartRow: columnMapping.importStartRow,
            sumMultipleLines: columnMapping.sumMultipleLines
        };

        if (knownKeys.includes(canalKey)) {
            const currentConfig = (generalSettings.importer as any)[canalKey] || {};
            onSaveSettings({
                ...generalSettings,
                importer: {
                    ...generalSettings.importer,
                    [canalKey]: { ...currentConfig, ...configData }
                }
            });
        } else {
            onSaveSettings({
                ...generalSettings,
                [`importer_${canalKey}`]: configData
            } as any);
        }
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files) as File[];
            setFiles(selectedFiles);
            setError(null);

            const firstFile = selectedFiles[0];
            const isExcel = !firstFile.name.toLowerCase().endsWith('.xml') && !firstFile.name.toLowerCase().endsWith('.zip');
            if (isExcel) {
                try {
                    const buffer = await firstFile.arrayBuffer();
                    const { headers, sheetData: data } = extractHeadersAndData(buffer, columnMapping.importStartRow);
                    setAvailableHeaders(headers);
                    setSheetData(data);

                    // Run diagnostics
                    try {
                        const forcedCanal = (selectedChannel !== 'AUTO' && ['ML', 'SHOPEE', 'SITE'].includes(selectedChannel))
                            ? selectedChannel as Canal : undefined;
                        const diag = getParserInternals(buffer, generalSettings, forcedCanal || 'AUTO', {
                            columnOverrides: {}
                        });
                        const unmapped = Object.entries(diag.headerKeyMap || {})
                            .filter(([, v]) => !v)
                            .map(([k]) => k);
                        setDiagnosticData({
                            canalDetectado: diag.canalDetectado || 'N/A',
                            headerRowIndex: diag.headerRowIndex ?? -1,
                            totalRows: diag.jsonDataLength || 0,
                            sheetKeys: diag.sheetKeys || [],
                            headerKeyMap: diag.headerKeyMap || {},
                            sampleRow: diag.sampleRow || null,
                            unmappedFields: unmapped,
                            mappingToUse: diag.mappingToUse || null
                        });
                    } catch (diagErr) {
                        console.warn('Diagnostic failed:', diagErr);
                        setDiagnosticData(null);
                    }
                } catch (err) {
                    console.error("Erro extraindo headers:", err);
                }
            } else {
                setAvailableHeaders([]);
                setSheetData([]);
            }
        }
    };

    const processFile = async () => {
        if (files.length === 0) return;
        setIsProcessing(true);
        setError(null);

        try {
            let ordersToProcess: OrderItem[] = [];
            const firstFile = files[0];
            const isXml = firstFile.name.toLowerCase().endsWith('.xml');
            const isZip = firstFile.name.toLowerCase().endsWith('.zip');

            if (isZip) {
                for (const file of files) {
                    const extractedXmls = await extractXmlsFromZip(file);
                    for (const { content, fileName } of extractedXmls) {
                        const ordersFromXml = await parseSalesNFeXML(content, fileName);
                        ordersToProcess.push(...ordersFromXml);
                    }
                }
            } else if (isXml) {
                for (const file of files) {
                    const text = await file.text();
                    const ordersFromXml = await parseSalesNFeXML(text, file.name);
                    ordersToProcess.push(...ordersFromXml);
                }
            } else {
                const buffer = await firstFile.arrayBuffer();
                let canalToUse: Canal | undefined = (selectedChannel !== 'AUTO' && ['ML', 'SHOPEE', 'SITE'].includes(selectedChannel)) ? selectedChannel as Canal : undefined;
                // Para canais customizados, usa SITE como canal base mas grava o canal correto depois
                const isCustomChannel = selectedChannel !== 'AUTO' && !['ML', 'SHOPEE', 'SITE'].includes(selectedChannel);
                if (isCustomChannel) canalToUse = 'SITE';

                const effectiveGross = columnMapping.priceGross === OFF_VALUE ? '__IGNORE__' : columnMapping.priceGross;
                const effectiveFees = columnMapping.platformFees.filter(f => f !== OFF_VALUE);
                const effectiveShipping = (ignoreShipping || columnMapping.shippingFee === OFF_VALUE) ? '__IGNORE__' : columnMapping.shippingFee;
                const effectiveNet = columnMapping.priceNet === OFF_VALUE ? '__IGNORE__' : columnMapping.priceNet;
                const effectiveStatus = columnMapping.statusColumn === OFF_VALUE ? '' : columnMapping.statusColumn;

                const data: ProcessedData = parseExcelFile(
                    buffer,
                    firstFile.name,
                    allOrders,
                    generalSettings,
                    {
                        importCpf: importToFiscal,
                        importName: true,
                        columnOverrides: {
                            ...(effectiveGross ? { priceGross: effectiveGross } : {}),
                            ...(effectiveFees.length > 0 ? { fees: effectiveFees } : {}),
                            ...(effectiveShipping ? { shippingFee: effectiveShipping } : {}),
                            ...(columnMapping.shippingPaidByCustomer ? { shippingPaidByCustomer: columnMapping.shippingPaidByCustomer } : {}),
                            ...(effectiveNet ? { priceNet: effectiveNet } : {}),
                            ...(effectiveStatus ? { statusColumn: effectiveStatus } : {}),
                            ...(columnMapping.acceptedStatusValues ? { acceptedStatusValues: columnMapping.acceptedStatusValues.split(',').map(s => s.trim()) } : {})
                        }
                    },
                    canalToUse,
                    importStatus || undefined
                );
                ordersToProcess = data.lists.completa;

                // Para canais customizados, sobrescreve o canal com o ID do canal custom
                if (isCustomChannel) {
                    ordersToProcess = ordersToProcess.map(o => ({ ...o, canal: selectedChannel as Canal }));
                }

                // Quando frete desativado, zera shipping_fee de todos os pedidos importados
                if (ignoreShipping || columnMapping.shippingFee === OFF_VALUE) {
                    ordersToProcess = ordersToProcess.map(o => ({ ...o, shipping_fee: 0 }));
                }
            }

            if (filterStartDate || filterEndDate) {
                const start = filterStartDate ? new Date(filterStartDate + "T00:00:00") : null;
                const end = filterEndDate ? new Date(filterEndDate + "T23:59:59") : null;

                const beforeDateFilter = ordersToProcess.length;
                const noDateCount = ordersToProcess.filter(o => !o.data).length;
                ordersToProcess = ordersToProcess.filter(order => {
                    if (!order.data) return false;
                    const orderDate = new Date(order.data + "T12:00:00");
                    if (start && orderDate < start) return false;
                    if (end && orderDate > end) return false;
                    return true;
                });
                const filteredByDate = beforeDateFilter - ordersToProcess.length;
                if (filteredByDate > 0) {
                    console.warn(`IMPORT-DIAG: ${filteredByDate} pedidos filtrados por data (${noDateCount} sem data, ${filteredByDate - noDateCount} fora do intervalo ${filterStartDate || '*'} ~ ${filterEndDate || '*'})`);
                }
            }

            if (ordersToProcess.length === 0) {
                // Build detailed diagnostic message
                const diagParts: string[] = ['Nenhum pedido encontrado.'];
                if (diagnosticData) {
                    diagParts.push(`Canal detectado: ${diagnosticData.canalDetectado}`);
                    diagParts.push(`Linha cabeçalho: ${diagnosticData.headerRowIndex}`);
                    diagParts.push(`Total linhas na planilha: ${diagnosticData.totalRows}`);
                    if (diagnosticData.unmappedFields.length > 0) {
                        diagParts.push(`Colunas NÃO mapeadas: ${diagnosticData.unmappedFields.join(', ')}`);
                    }
                }
                if (filterStartDate || filterEndDate) {
                    diagParts.push(`Filtro data: ${filterStartDate || '*'} até ${filterEndDate || '*'}`);
                }
                throw new Error(diagParts.join('\n'));
            }

            // Tratar pedidos com erro de SOB_ENCOMENDA
            const sobEncomendaCount = ordersToProcess.filter(o => o.status === 'ERRO' && o.error_reason === 'SOB_ENCOMENDA').length;
            if (sobEncomendaCount > 0) {
                if (includeErrorOrders) {
                    // Importar mesmo assim — converte para NORMAL
                    ordersToProcess = ordersToProcess.map(o => 
                        o.status === 'ERRO' && o.error_reason === 'SOB_ENCOMENDA'
                            ? { ...o, status: 'NORMAL' as any, error_reason: undefined }
                            : o
                    );
                } else {
                    // Ignorar pedidos sob encomenda
                    ordersToProcess = ordersToProcess.filter(o => !(o.status === 'ERRO' && o.error_reason === 'SOB_ENCOMENDA'));
                }
            }

            const existingOrdersMap = new Map<string, OrderItem>();
            allOrders.forEach(o => existingOrdersMap.set(`${o.orderId}|${o.sku}`, o));

            const finalOrdersPayload: OrderItem[] = [];
            let updatedCount = 0;
            let createdCount = 0;
            const importErrors: { orderId: string, sku: string, reason: string }[] = [];

            ordersToProcess.forEach(newOrder => {
                const key = `${newOrder.orderId}|${newOrder.sku}`;
                const existing = existingOrdersMap.get(key);

                // Rastrear problemas financeiros
                const hasNoGross = !newOrder.price_gross || newOrder.price_gross === 0;
                const hasNoTotal = !newOrder.price_total || newOrder.price_total === 0;
                
                if (hasNoGross && hasNoTotal) {
                    importErrors.push({ orderId: newOrder.orderId, sku: newOrder.sku, reason: 'Valor bruto e total zerados — verifique mapeamento de colunas' });
                } else if (hasNoGross) {
                    importErrors.push({ orderId: newOrder.orderId, sku: newOrder.sku, reason: 'Valor bruto (price_gross) zerado' });
                }

                if (newOrder.platform_fees === 0 && !isXml && !isZip) {
                    const canalUp = (newOrder.canal || '').toUpperCase();
                    if (canalUp === 'ML') {
                        // ML com taxa zero = devolução/reembolso aprovado — apenas informativo
                        importErrors.push({ orderId: newOrder.orderId, sku: newOrder.sku, reason: `Taxa zerada (ML) — possível devolução/reembolso aprovado` });
                    } else if (canalUp === 'SHOPEE') {
                        importErrors.push({ orderId: newOrder.orderId, sku: newOrder.sku, reason: `Taxas da plataforma zeradas (SHOPEE) — colunas de taxas podem não estar mapeadas` });
                    }
                }

                if (existing) {
                    // Se platform_fees veio como 0 e canal é ML, é válido (devolução/reembolso)
                    const canalUp = (newOrder.canal || '').toUpperCase();
                    const allowZeroFees = canalUp === 'ML';
                    finalOrdersPayload.push({
                        ...existing,
                        price_gross: newOrder.price_gross > 0 ? newOrder.price_gross : existing.price_gross,
                        platform_fees: (newOrder.platform_fees > 0 || (allowZeroFees && newOrder.platform_fees === 0)) ? newOrder.platform_fees : existing.platform_fees,
                        shipping_fee: newOrder.shipping_fee > 0 ? newOrder.shipping_fee : existing.shipping_fee,
                        shipping_paid_by_customer: newOrder.shipping_paid_by_customer > 0 ? newOrder.shipping_paid_by_customer : existing.shipping_paid_by_customer,
                        price_net: newOrder.price_net > 0 ? newOrder.price_net : existing.price_net,
                        price_total: newOrder.price_total > 0 ? newOrder.price_total : existing.price_total,
                        data: newOrder.data || existing.data,
                        customer_name: newOrder.customer_name || existing.customer_name,
                        customer_cpf_cnpj: newOrder.customer_cpf_cnpj || existing.customer_cpf_cnpj,
                        canal: selectedChannel !== 'AUTO' ? newOrder.canal : existing.canal
                    });
                    updatedCount++;
                } else {
                    let finalStatus = newOrder.status;
                    if (finalStatus === 'NORMAL') {
                        if (importType === 'finance_only' || isXml || isZip) {
                            finalStatus = 'BIPADO';
                        }
                    }
                    finalOrdersPayload.push({
                        ...newOrder,
                        status: finalStatus
                    });
                    createdCount++;
                }
            });

            if (finalOrdersPayload.length > 0) {
                await onLaunchOrders(finalOrdersPayload);

                // Build import diagnostic
                const columnsMatched = diagnosticData
                    ? Object.entries(diagnosticData.headerKeyMap).filter(([, v]) => !!v).map(([k, v]) => `${k}→${v}`)
                    : [];
                const columnsMissing = diagnosticData
                    ? diagnosticData.unmappedFields
                    : [];
                const zeroValueCount = importErrors.filter(e => e.reason.includes('zerado')).length;

                setImportDiagnostic({
                    totalRowsSheet: diagnosticData?.totalRows || 0,
                    totalParsed: ordersToProcess.length + (ordersToProcess.length === 0 ? 0 : 0),
                    filteredByDate: 0, // already filtered above
                    filteredByStatus: 0,
                    skippedNoIdSku: 0,
                    skippedQty: 0,
                    duplicates: updatedCount,
                    created: createdCount,
                    updated: updatedCount,
                    zeroValues: zeroValueCount,
                    canalDetectado: diagnosticData?.canalDetectado || selectedChannel,
                    headerRow: diagnosticData?.headerRowIndex ?? -1,
                    columnsMatched,
                    columnsMissing
                });

                // Always show result summary — never auto-close
                setResultSummary({ updated: updatedCount, created: createdCount, errors: importErrors });
            } else {
                setError("Nenhum dado válido encontrado para processar.");
            }
        } catch (err: any) {
            setError(err.message || "Erro ao processar arquivos.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    const isExcel = files.length > 0 && !files[0].name.toLowerCase().endsWith('.xml') && !files[0].name.toLowerCase().endsWith('.zip');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <FileUp className="text-blue-600" /> Importar Dados Financeiros
                    </h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                {!resultSummary ? (
                    <div className="space-y-6">
                        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${files.length > 0 ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                            {files.length > 0 ? (
                                <div className="text-center p-4">
                                    <FileUp size={32} className="text-emerald-500 mx-auto mb-2" />
                                    <p className="font-bold text-emerald-700 text-xs break-all">
                                        {files.length === 1 ? files[0].name : `${files.length} arquivos selecionados`}
                                    </p>
                                    <p className="text-[10px] text-emerald-600 mt-1">Clique para alterar</p>
                                </div>
                            ) : (
                                <div className="text-center p-4">
                                    <FileUp size={32} className="text-slate-400 mx-auto mb-2" />
                                    <p className="font-bold text-slate-600 text-xs">Clique para selecionar</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Excel (Vendas), XML (NFe) ou ZIP</p>
                                </div>
                            )}
                            <input type="file" accept=".xlsx, .xls, .csv, .xml, .zip" onChange={handleFileChange} className="hidden" multiple />
                        </label>

                        {isExcel && (
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Canal da Planilha</label>
                                <select
                                    value={selectedChannel}
                                    onChange={(e) => setSelectedChannel(e.target.value as any)}
                                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="AUTO">Automático (Detectar pelo nome)</option>
                                    <option value="ML">Mercado Livre</option>
                                    <option value="SHOPEE">Shopee</option>
                                    <option value="SITE">Site / Outros</option>
                                    {(generalSettings.customStores || []).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                                <div className="mt-2 flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        Linha Inicial (Cabeçalho)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={columnMapping.importStartRow ?? ''}
                                        onChange={e => {
                                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                            setColumnMapping(p => ({ ...p, importStartRow: val }));
                                            // Trigger re-extraction of headers if a file is already selected
                                            if (files.length > 0) {
                                                const firstFile = files[0];
                                                firstFile.arrayBuffer().then(buffer => {
                                                    const { headers, sheetData: data } = extractHeadersAndData(buffer, val);
                                                    setAvailableHeaders(headers);
                                                    setSheetData(data);
                                                });
                                            }
                                        }}
                                        placeholder="Auto (ML=5, Outros=0)"
                                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                {!showAddChannel ? (
                                    <button onClick={() => setShowAddChannel(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                        <Plus size={12} /> Adicionar Canal Personalizado
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newCustomChannelName}
                                            onChange={e => setNewCustomChannelName(e.target.value)}
                                            placeholder="Nome do canal"
                                            className="flex-1 p-2 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-400"
                                        />
                                        <button onClick={handleAddCustomChannel} disabled={!newCustomChannelName.trim()} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-50">Criar</button>
                                        <button onClick={() => { setShowAddChannel(false); setNewCustomChannelName(''); }} className="px-2 py-1 bg-slate-200 rounded-lg text-[10px] font-bold">×</button>
                                    </div>
                                )}
                                <div className="mt-3 flex items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={columnMapping.sumMultipleLines}
                                            onChange={e => setColumnMapping(p => ({ ...p, sumMultipleLines: e.target.checked }))}
                                            className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                        />
                                        <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight group-hover:text-blue-600">Somar multilinha (Multi-SKU)</span>
                                    </label>
                                    <div className="text-[9px] text-blue-400 font-medium italic leading-tight">
                                        Ative se as linhas do mesmo pedido devem ser somadas no financeiro.
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                            <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                <Calendar size={12} /> Filtrar por Data (Opcional)
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <span className="text-[10px] text-blue-400 font-bold block mb-1">De:</span>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        className="w-full p-2 border border-blue-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="flex-1">
                                    <span className="text-[10px] text-blue-400 font-bold block mb-1">Até:</span>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        className="w-full p-2 border border-blue-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                            </div>
                        </div>

                        {isExcel && availableHeaders.length > 0 && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 space-y-3">
                                <h3 className="text-xs font-black text-slate-700 uppercase mb-2">Mapeamento Financeiro</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Valor Bruto</label>
                                        <select value={columnMapping.priceGross} onChange={(e) => setColumnMapping(p => ({ ...p, priceGross: e.target.value }))} className={`w-full p-2 border rounded text-xs bg-white ${columnMapping.priceGross === OFF_VALUE ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-300'}`}>
                                            <option value="">-- Auto --</option>
                                            <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                                            {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Taxas (Seleção Múltipla)</label>
                                        <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 rounded bg-white max-h-32 overflow-y-auto">
                                            {availableHeaders.map(h => {
                                                const isSelected = columnMapping.platformFees.includes(h);
                                                return (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        onClick={() => {
                                                            setColumnMapping(p => ({
                                                                ...p,
                                                                platformFees: isSelected ? p.platformFees.filter(f => f !== h) : [...p.platformFees, h]
                                                            }));
                                                        }}
                                                        className={`px-2 py-1 rounded text-[10px] font-bold border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                                                    >
                                                        {h}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Envio (Pago por nós)</label>
                                        <select value={ignoreShipping ? OFF_VALUE : columnMapping.shippingFee} onChange={(e) => {
                                            if (e.target.value === OFF_VALUE) { setIgnoreShipping(true); setColumnMapping(p => ({ ...p, shippingFee: '' })); }
                                            else { setIgnoreShipping(false); setColumnMapping(p => ({ ...p, shippingFee: e.target.value })); }
                                        }} className={`w-full p-2 border rounded text-xs bg-white ${ignoreShipping ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-300'}`}>
                                            <option value="">-- Auto --</option>
                                            <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                                            {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Frete (Pago pelo Cliente)</label>
                                        <select value={columnMapping.shippingPaidByCustomer} onChange={(e) => setColumnMapping(p => ({ ...p, shippingPaidByCustomer: e.target.value }))} className={`w-full p-2 border rounded text-xs bg-white ${columnMapping.shippingPaidByCustomer === OFF_VALUE ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-300'}`}>
                                            <option value="">-- Auto --</option>
                                            <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                                            {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Valor Líquido (Recebido após taxas)</label>
                                        <select value={columnMapping.priceNet} onChange={(e) => setColumnMapping(p => ({ ...p, priceNet: e.target.value }))} className={`w-full p-2 border rounded text-xs bg-white ${columnMapping.priceNet === OFF_VALUE ? 'border-red-300 bg-red-50 text-red-400' : 'border-slate-300'}`}>
                                            <option value="">-- Auto --</option>
                                            <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                                            {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Status (Filtro)</label>
                                        <select value={columnMapping.statusColumn} onChange={(e) => setColumnMapping(p => ({ ...p, statusColumn: e.target.value }))} className={`w-full p-2 border rounded text-xs bg-white ${columnMapping.statusColumn === OFF_VALUE ? 'border-red-300 bg-red-50 text-red-400' : 'border-blue-300'}`}>
                                            <option value="">-- Ignorar --</option>
                                            <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                                            {availableHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[10px] font-bold text-slate-600 mb-1 block">Status Válidos</label>
                                        {columnMapping.statusColumn && columnMapping.statusColumn !== OFF_VALUE && sheetData.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 rounded bg-white max-h-32 overflow-y-auto w-full">
                                                {Array.from(new Set(sheetData.map(r => String(r[columnMapping.statusColumn] || '').trim().toLowerCase()).filter(Boolean))).sort().map(h => {
                                                    const currentList = columnMapping.acceptedStatusValues ? columnMapping.acceptedStatusValues.split(',').map(s => s.trim()) : [];
                                                    const isSelected = currentList.includes(h);
                                                    return (
                                                        <button key={h} type="button" onClick={() => {
                                                            const newList = isSelected ? currentList.filter(f => f !== h) : [...currentList, h];
                                                            setColumnMapping(p => ({ ...p, acceptedStatusValues: newList.join(', ') }));
                                                        }} className={`px-2 py-1 rounded text-[10px] font-bold border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                            {h}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <input type="text" value={columnMapping.acceptedStatusValues} onChange={(e) => setColumnMapping(p => ({ ...p, acceptedStatusValues: e.target.value }))} placeholder="ex: concluído, pago" className="w-full p-2 border border-slate-300 rounded text-xs bg-white border-blue-300 outline-none focus:ring-1 focus:ring-blue-500" />
                                        )}
                                    </div>
                                </div>
                                {selectedChannel !== 'AUTO' && onSaveSettings && (
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={handleSaveChannelConfig}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 ${configSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'}`}
                                        >
                                            {configSaved ? <><CheckCircle2 size={12} /> Salvo!</> : <><Save size={12} /> Salvar Configuração para {selectedChannel}</>}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Status Entrada</label>
                                <select value={importStatus} onChange={(e) => setImportStatus(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-xs">
                                    <option value="">Padrão</option>
                                    <option value="NORMAL">NORMAL</option>
                                    <option value="BIPADO">BIPADO</option>
                                    <option value="SOLUCIONADO">FINALIZADO</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => setImportType('finance_only')} className={`flex items-start p-3 rounded-xl border-2 transition-all ${importType === 'finance_only' ? 'border-blue-500 bg-blue-50' : 'border-slate-100'}`}>
                                <div className={`p-2 rounded-lg mr-3 ${importType === 'finance_only' ? 'bg-blue-200 text-blue-700' : 'bg-slate-200 text-slate-500'}`}><Database size={18} /></div>
                                <div><p className="font-bold text-xs uppercase">Atualizar Histórico</p></div>
                            </button>
                            <button onClick={() => setImportType('full_import')} className={`flex items-start p-3 rounded-xl border-2 transition-all ${importType === 'full_import' ? 'border-orange-500 bg-orange-50' : 'border-slate-100'}`}>
                                <div className={`p-2 rounded-lg mr-3 ${importType === 'full_import' ? 'bg-orange-200 text-orange-700' : 'bg-slate-200 text-slate-500'}`}><Layers size={18} /></div>
                                <div><p className="font-bold text-xs uppercase">Nova Produção</p></div>
                            </button>
                        </div>

                        {isExcel && selectedChannel === 'ML' && (
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <input 
                                    type="checkbox" 
                                    id="importToFiscalCheckbox" 
                                    checked={importToFiscal} 
                                    onChange={(e) => setImportToFiscal(e.target.checked)}
                                    className="w-4 h-4 text-red-600 rounded bg-white border-red-300 focus:ring-red-500 cursor-pointer" 
                                />
                                <label htmlFor="importToFiscalCheckbox" className="text-xs font-bold text-red-800 cursor-pointer">
                                    Importar também para o Fiscal (Incluir CPF / CNPJ do Cliente)
                                </label>
                            </div>
                        )}

                        {isExcel && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <input 
                                    type="checkbox" 
                                    id="includeErrorOrdersCheckbox" 
                                    checked={includeErrorOrders} 
                                    onChange={(e) => setIncludeErrorOrders(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 rounded bg-white border-amber-300 focus:ring-amber-500 cursor-pointer" 
                                />
                                <label htmlFor="includeErrorOrdersCheckbox" className="text-xs font-bold text-amber-800 cursor-pointer">
                                    Incluir pedidos com erro (sob encomenda) — importar como NORMAL
                                </label>
                            </div>
                        )}

                        {/* Diagnostic Panel */}
                        {isExcel && diagnosticData && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowDiagnostic(!showDiagnostic)}
                                    className="w-full flex items-center justify-between p-3 text-xs font-black text-slate-600 uppercase tracking-wide hover:bg-slate-100 transition-all"
                                >
                                    <span className="flex items-center gap-1.5"><Bug size={14} className="text-purple-500" /> Diagnóstico do Parser</span>
                                    {showDiagnostic ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {showDiagnostic && (
                                    <div className="px-3 pb-3 space-y-2 text-[11px] text-slate-600 border-t border-slate-200 pt-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <span className="font-black text-slate-400 text-[9px] uppercase block">Canal</span>
                                                <span className={`font-black ${diagnosticData.canalDetectado === 'N/A' ? 'text-red-500' : 'text-emerald-600'}`}>{diagnosticData.canalDetectado}</span>
                                            </div>
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <span className="font-black text-slate-400 text-[9px] uppercase block">Linha Cabeçalho</span>
                                                <span className={`font-black ${diagnosticData.headerRowIndex < 0 ? 'text-red-500' : 'text-blue-600'}`}>{diagnosticData.headerRowIndex < 0 ? 'NÃO ENCONTRADO' : diagnosticData.headerRowIndex}</span>
                                            </div>
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <span className="font-black text-slate-400 text-[9px] uppercase block">Total Linhas</span>
                                                <span className="font-black text-slate-700">{diagnosticData.totalRows}</span>
                                            </div>
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <span className="font-black text-slate-400 text-[9px] uppercase block">Colunas Planilha</span>
                                                <span className="font-black text-slate-700">{diagnosticData.sheetKeys.length}</span>
                                            </div>
                                        </div>

                                        <div className="p-2 bg-white rounded-lg border border-slate-100">
                                            <span className="font-black text-slate-400 text-[9px] uppercase block mb-1">Mapeamento de Colunas</span>
                                            <div className="space-y-0.5">
                                                {Object.entries(diagnosticData.headerKeyMap).map(([field, col]) => (
                                                    <div key={field} className="flex items-center gap-1">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                        <span className="font-bold text-slate-500">{field}:</span>
                                                        <span className={`font-bold ${col ? 'text-emerald-700' : 'text-red-500'}`}>{col || 'NÃO ENCONTRADO'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {diagnosticData.unmappedFields.length > 0 && (
                                            <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                                                <span className="font-black text-red-500 text-[9px] uppercase block mb-1">Campos sem correspondência</span>
                                                <span className="font-bold text-red-600">{diagnosticData.unmappedFields.join(', ')}</span>
                                            </div>
                                        )}

                                        {diagnosticData.sampleRow && (
                                            <div className="p-2 bg-white rounded-lg border border-slate-100">
                                                <span className="font-black text-slate-400 text-[9px] uppercase block mb-1">Amostra (1ª linha)</span>
                                                <div className="max-h-24 overflow-y-auto text-[10px] font-mono text-slate-500 break-all">
                                                    {Object.entries(diagnosticData.sampleRow).slice(0, 12).map(([k, v]) => (
                                                        <div key={k}><span className="text-slate-400">{k}:</span> <span className="text-slate-700">{String(v ?? '')}</span></div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-2 bg-white rounded-lg border border-slate-100">
                                            <span className="font-black text-slate-400 text-[9px] uppercase block mb-1">Cabeçalhos da Planilha</span>
                                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                                {diagnosticData.sheetKeys.map((k, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500">{k}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-bold border border-red-100 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> <span className="whitespace-pre-line">{error}</span></div>}

                        <button onClick={processFile} disabled={files.length === 0 || isProcessing} className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-xl">
                            {isProcessing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                            {isProcessing ? 'Processando...' : 'Confirmar Importação'}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} className="text-green-600" /></div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">Concluído!</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="p-4 bg-blue-50 rounded-xl"><p className="text-3xl font-black text-blue-600">{resultSummary.updated}</p><p className="text-[10px] font-bold uppercase text-blue-400">Atualizados</p></div>
                            <div className="p-4 bg-green-50 rounded-xl"><p className="text-3xl font-black text-green-600">{resultSummary.created}</p><p className="text-[10px] font-bold uppercase text-green-400">Novos</p></div>
                        </div>

                        {/* Import Diagnostic Summary */}
                        {importDiagnostic && (
                            <div className="mb-4 text-left">
                                <button
                                    type="button"
                                    onClick={() => setShowDiagnostic(!showDiagnostic)}
                                    className="w-full flex items-center justify-between p-2 text-[10px] font-black text-purple-600 uppercase tracking-wide bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all mb-2"
                                >
                                    <span className="flex items-center gap-1"><Bug size={12} /> Detalhes do Parser</span>
                                    {showDiagnostic ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                {showDiagnostic && (
                                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2 text-[10px]">
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="p-1.5 bg-white rounded-lg text-center">
                                                <span className="font-black text-slate-400 text-[8px] uppercase block">Canal</span>
                                                <span className="font-black text-purple-600">{importDiagnostic.canalDetectado}</span>
                                            </div>
                                            <div className="p-1.5 bg-white rounded-lg text-center">
                                                <span className="font-black text-slate-400 text-[8px] uppercase block">Cabeçalho</span>
                                                <span className="font-black text-slate-700">Linha {importDiagnostic.headerRow}</span>
                                            </div>
                                            <div className="p-1.5 bg-white rounded-lg text-center">
                                                <span className="font-black text-slate-400 text-[8px] uppercase block">Linhas</span>
                                                <span className="font-black text-slate-700">{importDiagnostic.totalRowsSheet}</span>
                                            </div>
                                        </div>
                                        {importDiagnostic.columnsMatched.length > 0 && (
                                            <div className="p-2 bg-white rounded-lg">
                                                <span className="font-black text-emerald-500 text-[8px] uppercase block mb-1">Colunas Mapeadas</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {importDiagnostic.columnsMatched.map((c, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-emerald-50 rounded text-[9px] font-bold text-emerald-700 border border-emerald-200">{c}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {importDiagnostic.columnsMissing.length > 0 && (
                                            <div className="p-2 bg-red-50 rounded-lg border border-red-200">
                                                <span className="font-black text-red-500 text-[8px] uppercase block mb-1">Colunas NÃO encontradas</span>
                                                <span className="font-bold text-red-600">{importDiagnostic.columnsMissing.join(', ')}</span>
                                            </div>
                                        )}
                                        {importDiagnostic.zeroValues > 0 && (
                                            <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                                                <span className="font-black text-amber-600 text-[8px] uppercase block">{importDiagnostic.zeroValues} pedido(s) com valores financeiros zerados</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {resultSummary.errors && resultSummary.errors.length > 0 && (
                            <div className="mb-4 text-left">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertTriangle size={16} className="text-amber-600" />
                                    <p className="text-xs font-black text-amber-700 uppercase">{resultSummary.errors.length} Aviso(s) na Importação</p>
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-amber-200 rounded-xl bg-amber-50 divide-y divide-amber-100">
                                    {resultSummary.errors.slice(0, 50).map((err, idx) => (
                                        <div key={idx} className="px-3 py-2 text-[10px]">
                                            <span className="font-black text-slate-700">{err.orderId}</span>
                                            <span className="text-slate-400 mx-1">|</span>
                                            <span className="font-bold text-slate-500">{err.sku}</span>
                                            <span className="text-slate-400 mx-1">→</span>
                                            <span className="font-bold text-amber-700">{err.reason}</span>
                                        </div>
                                    ))}
                                    {resultSummary.errors.length > 50 && (
                                        <div className="px-3 py-2 text-[10px] font-bold text-amber-600 text-center">
                                            ... e mais {resultSummary.errors.length - 50} avisos
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <button onClick={handleClose} className="px-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Fechar</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FinanceImportModal;
