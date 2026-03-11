
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GeneralSettings, OrderItem, BlingInvoice, BlingProduct, BlingSettings, BlingScopeSettings, StockItem, SkuLink } from '../types';
import { fetchBlingOrders, fetchBlingInvoices, fetchEtiquetaZplForPedido, fetchEtiquetasLote, fetchBlingProducts, executeBlingTokenExchange, executeTokenRefresh, syncBlingOrders, syncBlingInvoices, fetchNfeSaida, fetchNfeDetalhe, fetchPedidoVendaDetalhe, atualizarPedidoVenda, enviarNfe, fetchNfeEtiquetaZpl } from '../lib/blingApi';
import type { NfeSaida } from '../lib/blingApi';
import { addPendingZplItem } from '../utils/pendingZpl';
import { BlingSync } from '../components/BlingSync';
// NFeManager integrado diretamente no BlingPage
import { Cloud, Zap, Link as LinkIcon, Settings, Loader2, CheckCircle, Info, FileText, ShoppingCart, Download, Printer, Lock, Package, Search, Save, Eye, EyeOff, X, AlertTriangle, RefreshCw, ToggleLeft, ToggleRight, FileOutput, ExternalLink, Filter, HelpCircle, ChevronDown, ChevronRight, Copy, TrendingDown, ShoppingBag, CheckSquare, Square, Tag, Send, History, Clock, User, MapPin, CreditCard } from 'lucide-react';

// Transforma pedido do endpoint de sync para o formato OrderItem do ERP
const transformSyncedOrder = (o: any): OrderItem => ({
    id: o.id || `sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    orderId: o.orderId || '',           // = numeroLoja (pedido da loja virtual/marketplace)
    blingId: o.blingId || '',           // = ID interno do Bling
    blingNumero: o.blingNumero || '',   // = número do pedido no Bling
    tracking: o.rastreamento || o.tracking || '', // código de rastreio do transporte
    sku: o.sku || '',
    qty_original: Number(o.quantity || 1),
    multiplicador: 1,
    qty_final: Number(o.quantity || 1),
    color: '',
    canal: (o.canal || 'SITE') as any,
    data: o.data || new Date().toISOString().split('T')[0],
    status: 'NORMAL',
    customer_name: o.customer_name || 'Não informado',
    customer_cpf_cnpj: o.customer_cpf_cnpj || '',
    price_gross: Number(o.unit_price || 0),
    price_total: Number(o.total || 0),
    platform_fees: 0,
    shipping_fee: 0,
    shipping_paid_by_customer: 0,
    price_net: Number(o.unit_price || 0),
});

interface BlingPageProps {
    generalSettings: GeneralSettings;
    onSaveSettings: (settings: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => void;
    onLaunchSuccess: (orders: OrderItem[]) => Promise<void>; // Updated to Promise for await support
    addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
    setCurrentPage: (page: string) => void;
    onLoadZpl: (zpl: string, includeDanfe?: boolean) => void;
    stockItems?: StockItem[];
    skuLinks?: SkuLink[];
    allOrders?: OrderItem[];
    onLinkSku?: (importedSku: string, masterProductSku: string) => Promise<boolean>;
    onUpdateOrdersBatch?: (orderIds: string[], loteId: string) => Promise<void>;
}

type EnrichedBlingOrder = OrderItem & { invoice?: BlingInvoice };

/** Representa um lote de etiquetas ZPL gerado em uma sessão */
interface ZplLoteItem {
    id: string;
    timestamp: string;
    total: number;
    success: number;
    failed: { orderId: string; blingId: string; error: string }[];
    zplContent: string;
}

const getToday = () => new Date().toISOString().split('T')[0];
const getSevenDaysAgo = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default window for auto-sync and manual fetch
    return d.toISOString().split('T')[0];
};

type Tab = 'importacao' | 'nfe' | 'catalogo' | 'etiquetas';

const DEFAULT_BLING_SCOPE: BlingScopeSettings = {
    importarProdutos: true,
    importarPedidos: true,
    importarNotasFiscais: true,
    gerarEtiquetas: true,
    pedidosVenda: true,
    produtos: true,
    contatos: true,
    estoque: true,
    nfe: true,
    logistica: true,
    financeiro: true,
    webhooks: true,
};

const BlingConfigModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentSettings: BlingSettings | undefined;
    onSave: (newBlingSettings: BlingSettings) => void;
}> = ({ isOpen, onClose, currentSettings, onSave }) => {
    const processedPopupCodesRef = useRef<Set<string>>(new Set());
    const [authTab, setAuthTab] = useState<'token_manual' | 'oauth'>('oauth');
    const [configTab, setConfigTab] = useState<'conexao' | 'etiquetas' | 'exportacao'>('conexao');

    // Auth Data
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [refreshToken, setRefreshToken] = useState('');

    // OAuth Flow
    const [authCode, setAuthCode] = useState('');
    const [isExchangingToken, setIsExchangingToken] = useState(false);
    const [showDebug, setShowDebug] = useState(false);
    const [debugLog, setDebugLog] = useState<string[]>([]);

    const [showSecrets, setShowSecrets] = useState(false);
    const [autoSync, setAutoSync] = useState(false);
    const [autoSyncFromDate, setAutoSyncFromDate] = useState('');
    const [scope, setScope] = useState<BlingScopeSettings>(DEFAULT_BLING_SCOPE);

    // Etiquetas config
    const [etqModoPadrao, setEtqModoPadrao] = useState<'danfe_etiqueta' | 'apenas_etiqueta'>('danfe_etiqueta');
    const [etqFonteZpl, setEtqFonteZpl] = useState<'bling_api' | 'local'>('bling_api');
    const [etqDelay, setEtqDelay] = useState(300);

    // Exportação config
    const [expDias, setExpDias] = useState(7);
    const [expCanal, setExpCanal] = useState<'ML' | 'SHOPEE' | 'SITE' | 'TODOS'>('TODOS');
    const [expAutoRastreio, setExpAutoRastreio] = useState(false);
    const [expLimite, setExpLimite] = useState(100);
    const [expStatus, setExpStatus] = useState<number[]>([6, 9, 15]);

    // Pega a URL base atual do navegador (ex: https://erpecomflow.netlify.app ou http://localhost:5173)
    const currentOrigin = window.location.origin.replace(/\/$/, "");

    useEffect(() => {
        if (isOpen) {
            setApiKey(currentSettings?.apiKey || '');
            setClientId(currentSettings?.clientId || '');
            setClientSecret(currentSettings?.clientSecret || '');
            setRefreshToken(currentSettings?.refreshToken || '');
            setAutoSync(currentSettings?.autoSync || false);
            setAutoSyncFromDate(currentSettings?.autoSyncFromDate || '');
            setScope({
                ...DEFAULT_BLING_SCOPE,
                ...(currentSettings?.scope || {})
            });
            // Etiquetas config
            const ec = currentSettings?.etiquetasConfig;
            setEtqModoPadrao(ec?.modoPadrao || 'danfe_etiqueta');
            setEtqFonteZpl(ec?.fonteZpl || 'bling_api');
            setEtqDelay(ec?.delayEntrePrintMs ?? 300);
            // Exportação config
            const exp = currentSettings?.exportacao;
            setExpDias(exp?.diasPadrao ?? 7);
            setExpCanal(exp?.canalPadrao || 'TODOS');
            setExpAutoRastreio(exp?.autoImportarRastreio ?? false);
            setExpLimite(exp?.limitePedidos ?? 100);
            setExpStatus(exp?.statusPadrao ?? [6, 9, 15]);
        }
    }, [isOpen, currentSettings]);

    const allScopesEnabled = Object.values(scope).every(Boolean);
    const toggleAllScopes = (enabled: boolean) => {
        const next: BlingScopeSettings = { ...scope };
        (Object.keys(next) as Array<keyof BlingScopeSettings>).forEach((key) => {
            next[key] = enabled;
        });
        setScope(next);
    };

    const handleGenerateToken = async () => {
        if (!clientId || !clientSecret || !authCode) {
            alert('Preencha Client ID, Client Secret e o Código de Autorização.');
            return;
        }

        const normalizedCode = authCode.trim();
        if (processedPopupCodesRef.current.has(normalizedCode)) {
            alert('Este código de autorização já foi utilizado. Gere um novo código no Bling.');
            return;
        }
        processedPopupCodesRef.current.add(normalizedCode);

        const logs: string[] = [];
        logs.push(`[${new Date().toLocaleTimeString()}] Iniciando troca de código por token...`);
        logs.push(`Code: ${normalizedCode.substring(0, 30)}...`);
        logs.push(`Client ID: ${clientId.substring(0, 20)}...`);
        logs.push(`Redirect URI: ${currentOrigin}`);

        setDebugLog(logs);
        setShowDebug(true);

        setIsExchangingToken(true);
        try {
            // A redirect_uri deve ser EXATAMENTE igual à cadastrada
            const redirectUri = currentOrigin;

            logs.push(`Enviando requisição para /api/bling/token...`);
            setDebugLog([...logs]);

            const data = await executeBlingTokenExchange(normalizedCode, clientId, clientSecret, redirectUri);

            logs.push(`✅ Resposta recebida!`);
            setDebugLog([...logs]);

            if (data.access_token) {
                setApiKey(data.access_token);
                setRefreshToken(data.refresh_token);
                setAuthCode('');

                logs.push(`✅ Token gerado com sucesso!`);
                setDebugLog([...logs]);

                // Salva tudo imediatamente
                onSave({
                    apiKey: data.access_token,
                    refreshToken: data.refresh_token,
                    clientId,
                    clientSecret,
                    autoSync,
                    autoSyncFromDate: autoSyncFromDate || currentSettings?.autoSyncFromDate,
                    scope,
                    expiresIn: data.expires_in,
                    createdAt: Date.now()
                });

                setAuthTab('token_manual');
                alert('Token gerado e salvo com sucesso!');
            } else {
                logs.push(`❌ Erro: ${JSON.stringify(data)}`);
                setDebugLog([...logs]);
                alert('Falha na resposta do Bling: ' + JSON.stringify(data));
            }
        } catch (e: any) {
            const errorMsg = e.message || String(e);
            logs.push(`❌ Erro: ${errorMsg}`);
            setDebugLog([...logs]);
            processedPopupCodesRef.current.delete(normalizedCode);

            if (errorMsg.includes('has already been used') || errorMsg.includes('authorization code') || errorMsg.includes('revoked')) {
                alert('❌ ERRO: Código expirado ou revogado pela Bling.\n\n' +
                    '📋 POSSÍVEIS CAUSAS:\n\n' +
                    '1️⃣ Redirect URI no Bling ≠ URL do seu app\n' +
                    '2️⃣ Código de autorização expirou (válido 10min)\n' +
                    '3️⃣ Primeira tentativa falhou e código foi revogado\n\n' +
                    '✅ SOLUÇÃO:\n\n' +
                    '1️⃣ Copie a URL VERMELHA no topo (Redirect URI)\n' +
                    '2️⃣ Acesse: https://www.bling.com.br\n' +
                    '3️⃣ Vá em: Configurações > Integrações/Apps\n' +
                    '4️⃣ Crie um NOVO OAuth App\n' +
                    '5️⃣ Cole a URL EXATAMENTE no "Redirect URI"\n' +
                    '6️⃣ Copie o Client ID e Secret novo\n' +
                    '7️⃣ Cole aqui e clique em Autorizar\n\n' +
                    '💡 Dica: Use um novo app a cada teste para evitar revogações');
                setAuthCode('');
            } else {
                alert('Erro ao gerar token: ' + e.message);
            }
        } finally {
            setIsExchangingToken(false);
        }
    };

    const handleRestartFlow = () => {
        setAuthCode('');
        handleOpenAuthorizeUrl();
    };

    const handleOpenAuthorizeUrl = () => {
        if (!clientId) {
            alert('Insira o Client ID primeiro.');
            return;
        }
        if (!clientSecret) {
            alert('Insira o Client Secret para que possamos salvar suas credenciais para a troca do token.');
            return;
        }

        localStorage.setItem('bling_oauth_config', JSON.stringify({ clientId, clientSecret }));

        const state = Math.random().toString(36).substring(7);
        // Ensure no trailing slash for the redirect URI construction
        const redirectUri = currentOrigin;

        const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        // Open in Popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;

        window.open(
            url,
            'BlingAuth',
            `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
        );

        // Add toast instruction
        // We can't easily access addToast here as it's passed to BlingPage, not BlingConfigModal directly.
        // But we can use alert or just let the user see the popup.
    };

    // Listen for popup message
    useEffect(() => {
        const exchangeCodeForToken = async (code: string) => {
            const normalizedCode = String(code || '').trim();
            if (!normalizedCode || processedPopupCodesRef.current.has(normalizedCode)) {
                return;
            }

            processedPopupCodesRef.current.add(normalizedCode);
            if (!clientId || !clientSecret) return;

            setIsExchangingToken(true);
            try {
                const redirectUri = currentOrigin;
                const data = await executeBlingTokenExchange(normalizedCode, clientId, clientSecret, redirectUri);

                if (data.access_token) {
                    setApiKey(data.access_token);
                    setRefreshToken(data.refresh_token);
                    setAuthCode('');

                    onSave({
                        apiKey: data.access_token,
                        refreshToken: data.refresh_token,
                        clientId,
                        clientSecret,
                        autoSync,
                        autoSyncFromDate: autoSyncFromDate || currentSettings?.autoSyncFromDate,
                        scope,
                        expiresIn: data.expires_in,
                        createdAt: Date.now()
                    });

                    setAuthTab('token_manual');
                    alert('Token gerado e salvo com sucesso!');
                    onClose(); // Close modal on success
                } else {
                    alert('Falha na resposta do Bling: ' + JSON.stringify(data));
                    processedPopupCodesRef.current.delete(normalizedCode);
                }
            } catch (e: any) {
                alert('Erro ao gerar token: ' + e.message);
                processedPopupCodesRef.current.delete(normalizedCode);
            } finally {
                setIsExchangingToken(false);
            }
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'BLING_AUTH_CODE' && event.data.code) {
                console.log("Received auth code from popup:", event.data.code);
                setAuthCode(event.data.code);
                exchangeCodeForToken(event.data.code);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [clientId, clientSecret, currentOrigin, autoSync, scope, onSave, onClose]); // Added missing dependencies

    if (!isOpen) return null;

    const handleSaveManual = () => {
        // Ao salvar manualmente, preservamos outros campos se não editados
        onSave({
            apiKey,
            clientId,
            clientSecret,
            refreshToken,
            autoSync,
            autoSyncFromDate: autoSyncFromDate || undefined,
            scope,
            // Preserva timestamp se já existia, ou cria novo
            createdAt: currentSettings?.createdAt || Date.now(),
            expiresIn: currentSettings?.expiresIn,
            etiquetasConfig: {
                modoPadrao: etqModoPadrao,
                fonteZpl: etqFonteZpl,
                delayEntrePrintMs: etqDelay,
            },
            exportacao: {
                statusPadrao: expStatus,
                diasPadrao: expDias,
                canalPadrao: expCanal,
                autoImportarRastreio: expAutoRastreio,
                limitePedidos: expLimite,
            },
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                        <Settings className="text-blue-600" /> Configuração Bling v3
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-100 p-2 rounded-full"><X size={20} /></button>
                </div>

                <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-xl">
                    <button
                        onClick={() => setConfigTab('conexao')}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${configTab === 'conexao' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Conexão
                    </button>
                    <button
                        onClick={() => setConfigTab('etiquetas')}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${configTab === 'etiquetas' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Etiquetas
                    </button>
                    <button
                        onClick={() => setConfigTab('exportacao')}
                        className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${configTab === 'exportacao' ? 'bg-white shadow-sm text-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Exportação
                    </button>
                </div>

                <div className="space-y-6">
                    {/* ─── ABA CONEXÃO ─── */}
                    {configTab === 'conexao' && (<>
                        <div className="flex gap-2 mb-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                            <button
                                onClick={() => setAuthTab('oauth')}
                                className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${authTab === 'oauth' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Gerar Novo Token (OAuth)
                            </button>
                            <button
                                onClick={() => setAuthTab('token_manual')}
                                className={`flex-1 py-2 text-xs font-black uppercase rounded-lg transition-all ${authTab === 'token_manual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                Visualizar Credenciais
                            </button>
                        </div>
                        {authTab === 'oauth' && (
                            <div className="space-y-4 border border-red-300 bg-red-50 p-5 rounded-xl">
                                <h3 className="font-black text-red-900 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <AlertTriangle size={16} /> ⚠️ VERIFIQUE ISTO PRIMEIRO
                                </h3>

                                <div className="bg-white border border-red-200 rounded-lg p-3 space-y-2">
                                    <p className="text-[11px] font-bold text-red-700 uppercase">🔗 Seu Redirect URI:</p>
                                    <code className="block bg-red-50 p-2 rounded border border-red-200 text-red-700 break-all text-[10px] font-bold select-all">
                                        {currentOrigin}
                                    </code>
                                    <p className="text-[10px] text-red-600 font-semibold">
                                        ⚠️ Esta EXATA URL deve estar registrada no Bling OAuth App
                                    </p>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(currentOrigin);
                                            alert('✅ Redirect URI copiada!');
                                        }}
                                        className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded hover:bg-red-700 flex items-center gap-1 w-fit"
                                    >
                                        <Copy size={12} /> Copiar URL
                                    </button>
                                </div>
                            </div>
                        )}

                        {authTab === 'oauth' && (
                            <div className="space-y-4 border border-blue-100 bg-blue-50/50 p-5 rounded-xl">
                                <h3 className="font-black text-blue-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                    <RefreshCw size={16} /> Passo a Passo para Autenticação
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Client ID</label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={e => setClientId(e.target.value)}
                                            className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono"
                                            placeholder="Ex: a1b2c3d4..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Client Secret</label>
                                        <div className="relative">
                                            <input
                                                type={showSecrets ? "text" : "password"}
                                                value={clientSecret}
                                                onChange={e => setClientSecret(e.target.value)}
                                                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono"
                                                placeholder="Ex: secret_123..."
                                            />
                                            <button type="button" onClick={() => setShowSecrets(!showSecrets)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                                                {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-4">
                                    <h4 className="text-[11px] font-black text-red-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <AlertTriangle size={14} /> Se viu "already been used" ou "revoked"
                                    </h4>
                                    <ol className="text-[10px] text-red-700 space-y-1.5 mb-3 list-decimal ml-4">
                                        <li><strong>Acesse:</strong> https://www.bling.com.br</li>
                                        <li><strong>Menu:</strong> Configurações → Integrações / Apps Autorizados</li>
                                        <li><strong>Procure:</strong> pela aplicação desta ferramenta</li>
                                        <li><strong>Clique em:</strong> "Revogar" ou "Desconectar"</li>
                                        <li><strong>Confirme</strong> a revogação</li>
                                        <li><strong>Volte aqui</strong> e clique no botão LARANJA abaixo</li>
                                    </ol>
                                    <button
                                        onClick={handleRestartFlow}
                                        className="w-full text-xs font-bold text-white bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={14} /> Recomeçar Autenticação
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-start gap-2">
                                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</span>
                                        <div className="flex flex-col gap-2 w-full">
                                            <p className="text-xs text-slate-600 leading-tight">
                                                No painel do Bling, crie um novo <strong>OAuth Application</strong> e configure:
                                            </p>

                                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                                <p className="text-[10px] font-bold text-red-600 mb-1">❌ ERRO COMUM:</p>
                                                <p className="text-[10px] text-red-700">
                                                    Se a <strong>Redirect URI</strong> no Bling não bate com a URL abaixo, o código será revogado automaticamente!
                                                </p>
                                            </div>

                                            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">✅ Redirect URI (COPIE E COLE NO BLING):</p>
                                                <code className="block bg-white p-2 rounded border border-blue-200 text-blue-700 break-all select-all text-[10px] font-mono">{currentOrigin}</code>
                                            </div>

                                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">📋 Também cadastre no Bling:</p>
                                                <ul className="text-[10px] text-slate-600 list-disc ml-4 space-y-1">
                                                    <li><strong>Client ID:</strong> Copie e cole no campo acima</li>
                                                    <li><strong>Client Secret:</strong> Copie e cole no campo acima</li>
                                                    <li><strong>Redirect URI:</strong> Deve ser EXATAMENTE igual ao azul acima</li>
                                                    <li><strong>Escopos:</strong> Marque as permissões necessárias</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</span>
                                        <div className="flex flex-col items-start gap-2 w-full">
                                            <button onClick={handleOpenAuthorizeUrl} className="text-xs font-bold text-white bg-blue-500 px-3 py-1.5 rounded hover:bg-blue-600 transition-colors shadow-sm">
                                                Clique aqui para Autorizar o App
                                            </button>
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                Uma janela popup abrirá para você fazer login no Bling.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2 mt-1">
                                        <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</span>
                                        <p className="text-xs text-slate-600 leading-tight">Após autorizar na janela popup, ela fechará automaticamente e o token será gerado aqui.</p>
                                    </div>
                                </div>

                                {/* Manual Code Input Backup */}
                                <div className="pt-2 border-t border-blue-100">
                                    <details>
                                        <summary className="text-[10px] font-bold text-slate-400 cursor-pointer hover:text-blue-600">Inserir código manualmente (se o redirect automático falhar)</summary>
                                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                                            <p className="text-[10px] text-red-800 font-semibold mb-2">
                                                ⚠️ <strong>Se viu "has already been used":</strong>
                                            </p>
                                            <ol className="text-[10px] text-red-700 list-decimal ml-4 space-y-1">
                                                <li>O código <strong>expirou</strong> (válido por 10 minutos)</li>
                                                <li>Ou foi <strong>revogado</strong> após primeiro erro</li>
                                                <li><strong>Solução:</strong> Revogar acesso no Bling e autorizar novamente</li>
                                            </ol>
                                        </div>
                                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                                            <p className="text-[10px] text-yellow-800 font-semibold">
                                                ⚠️ <strong>Redirect URI deve ser EXATO:</strong> Verifique se a URL abaixo está registrada no Bling OAuth App
                                            </p>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                type="text"
                                                value={authCode}
                                                onChange={e => setAuthCode(e.target.value)}
                                                className="flex-grow p-2 border border-slate-200 rounded-lg text-sm font-mono"
                                                placeholder="Cole o código (code=abc123...) aqui"
                                            />
                                            <button
                                                onClick={handleGenerateToken}
                                                disabled={isExchangingToken || !authCode}
                                                className="px-3 py-2 bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-lg hover:bg-slate-300 disabled:opacity-50 whitespace-nowrap"
                                            >
                                                {isExchangingToken ? 'Gerando...' : 'Gerar'}
                                            </button>
                                        </div>
                                    </details>
                                </div>

                                {showDebug && (
                                    <div className="bg-slate-900 text-slate-100 rounded-lg p-3 font-mono text-[10px] max-h-48 overflow-y-auto border border-slate-700">
                                        <p className="font-bold text-blue-400 mb-2">📋 Debug Log:</p>
                                        {debugLog.map((log, i) => (
                                            <div key={i} className="text-slate-300 break-all">{log}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {authTab === 'token_manual' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Access Token</label>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={e => setApiKey(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Refresh Token</label>
                                    <input
                                        type="password"
                                        value={refreshToken}
                                        onChange={e => setRefreshToken(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div className="text-[10px] text-slate-400 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <p><strong>Nota:</strong> O sistema usará o Access Token fixo acima. Se ele expirar, você precisará gerar um novo na aba "Gerar Novo Token".</p>
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1">Sincronização Automática (Polling)</h3>
                                <p className="text-[10px] text-purple-600">Simula Webhook: Baixa novos pedidos a cada 60s.</p>
                            </div>
                            <button onClick={() => setAutoSync(!autoSync)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${autoSync ? 'bg-purple-600' : 'bg-gray-300'}`}>
                                <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${autoSync ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Data mínima para auto-sync */}
                        <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
                            <h3 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1">Sincronizar Pedidos A Partir De</h3>
                            <p className="text-[10px] text-purple-600 mb-2">Pedidos anteriores a esta data não serão puxados no auto-sync, evitando reimportar notas já emitidas.</p>
                            <input
                                type="date"
                                value={autoSyncFromDate}
                                onChange={e => setAutoSyncFromDate(e.target.value)}
                                className="w-full p-2 border-2 border-purple-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-purple-500"
                            />
                            {!autoSyncFromDate && (
                                <p className="text-[10px] text-purple-400 mt-1">⚠️ Sem data definida: usa últimos 7 dias</p>
                            )}
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Escopo da Integração</h3>
                            <div className="mb-3 flex items-center justify-between bg-white border border-blue-100 rounded-lg p-3">
                                <span className="text-xs font-black text-slate-700 uppercase tracking-widest">Todos os escopos</span>
                                <button
                                    type="button"
                                    onClick={() => toggleAllScopes(!allScopesEnabled)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${allScopesEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {allScopesEnabled ? 'Ativos' : 'Ativar todos'}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={scope.importarPedidos} onChange={e => setScope({ ...scope, importarPedidos: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Importar Pedidos de Venda</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={scope.importarNotasFiscais} onChange={e => setScope({ ...scope, importarNotasFiscais: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Consultar Notas Fiscais (NFe)</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={scope.gerarEtiquetas} onChange={e => setScope({ ...scope, gerarEtiquetas: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Gerar Etiquetas ZPL (Logística)</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={scope.importarProdutos} onChange={e => setScope({ ...scope, importarProdutos: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Visualizar Catálogo de Produtos</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.pedidosVenda} onChange={e => setScope({ ...scope, pedidosVenda: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Pedidos de Venda</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.produtos} onChange={e => setScope({ ...scope, produtos: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Produtos</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.contatos} onChange={e => setScope({ ...scope, contatos: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Contatos/Clientes</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.estoque} onChange={e => setScope({ ...scope, estoque: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Estoque</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.nfe} onChange={e => setScope({ ...scope, nfe: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: NFe/SEFAZ</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.logistica} onChange={e => setScope({ ...scope, logistica: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Logística/Etiquetas</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.financeiro} onChange={e => setScope({ ...scope, financeiro: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Financeiro</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-blue-100/50 rounded-lg transition-colors">
                                    <input type="checkbox" checked={!!scope.webhooks} onChange={e => setScope({ ...scope, webhooks: e.target.checked })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                                    <span className="text-sm font-bold text-slate-700">Escopo Bling: Webhooks/Notificações</span>
                                </label>
                            </div>
                        </div>
                    </>)}
                </div>

                {/* ─── ABA ETIQUETAS ─── */}
                {configTab === 'etiquetas' && (
                    <div className="space-y-5">
                        <p className="text-xs text-slate-500 bg-orange-50 border border-orange-100 rounded-xl p-3">
                            Configure o comportamento padrão ao gerar etiquetas e DANFE na aba Bling.
                        </p>

                        {/* Modo padrão de impressão */}
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <h3 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Printer size={14} /> Modo Padrão de Impressão
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setEtqModoPadrao('danfe_etiqueta')}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${etqModoPadrao === 'danfe_etiqueta' ? 'border-orange-500 bg-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-800 uppercase">DANFE + Etiqueta</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Imprime a nota fiscal junto com a etiqueta de envio</p>
                                </button>
                                <button
                                    onClick={() => setEtqModoPadrao('apenas_etiqueta')}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${etqModoPadrao === 'apenas_etiqueta' ? 'border-orange-500 bg-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-800 uppercase">Apenas Etiqueta (ZPL)</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Somente a etiqueta de envio da transportadora</p>
                                </button>
                            </div>
                        </div>

                        {/* Fonte do ZPL */}
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                            <h3 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Cloud size={14} /> Fonte do ZPL
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setEtqFonteZpl('bling_api')}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${etqFonteZpl === 'bling_api' ? 'border-orange-500 bg-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-800 uppercase">Bling API (Real)</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Usa o ZPL oficial gerado pelo Bling (recomendado)</p>
                                </button>
                                <button
                                    onClick={() => setEtqFonteZpl('local')}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${etqFonteZpl === 'local' ? 'border-orange-500 bg-orange-100' : 'border-slate-200 bg-white hover:border-orange-300'}`}
                                >
                                    <p className="text-xs font-black text-slate-800 uppercase">Gerado Localmente</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Gera etiqueta a partir dos dados do pedido (fallback)</p>
                                </button>
                            </div>
                        </div>

                        {/* Delay entre impressões */}
                        <div className="p-4 bg-orange-50/60 rounded-xl border border-orange-100">
                            <h3 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Clock size={14} /> Delay entre Impressões
                            </h3>
                            <p className="text-[10px] text-orange-600 mb-2">Intervalo em milissegundos entre envios de ZPL para a impressora em lote.</p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min={0}
                                    max={5000}
                                    step={50}
                                    value={etqDelay}
                                    onChange={e => setEtqDelay(Number(e.target.value))}
                                    className="w-28 p-2 border-2 border-orange-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-orange-500"
                                />
                                <span className="text-xs text-slate-500 font-bold">ms</span>
                                <span className="text-[10px] text-slate-400">(0 = sem delay)</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── ABA EXPORTAÇÃO ─── */}
                {configTab === 'exportacao' && (
                    <div className="space-y-5">
                        <p className="text-xs text-slate-500 bg-green-50 border border-green-100 rounded-xl p-3">
                            Configure os padrões para sincronização e exportação de pedidos do Bling para o ERP.
                        </p>

                        {/* Situações (status) dos pedidos */}
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Filter size={14} /> Situações a Importar (Status Bling)
                            </h3>
                            <p className="text-[10px] text-green-600 mb-3">Selecione quais situações de pedido serão incluídas ao sincronizar do Bling.</p>
                            <div className="space-y-2">
                                {[
                                    { id: 6, label: '6 — Em Aberto', desc: 'Pedido aguardando processamento' },
                                    { id: 9, label: '9 — Atendido', desc: 'Pedido já atendido/separado' },
                                    { id: 15, label: '15 — Em Andamento', desc: 'Pedido em andamento' },
                                    { id: 12, label: '12 — Cancelado', desc: 'Pedido cancelado' },
                                ].map(s => (
                                    <label key={s.id} className="flex items-center gap-3 cursor-pointer p-2.5 bg-white rounded-xl border border-green-100 hover:border-green-300 transition-all">
                                        <input
                                            type="checkbox"
                                            checked={expStatus.includes(s.id)}
                                            onChange={e => setExpStatus(prev => e.target.checked ? [...prev, s.id] : prev.filter(x => x !== s.id))}
                                            className="w-4 h-4 text-green-600 rounded"
                                        />
                                        <div>
                                            <p className="text-xs font-black text-slate-800">{s.label}</p>
                                            <p className="text-[10px] text-slate-400">{s.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Período e Canal */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-green-50/60 rounded-xl border border-green-100">
                                <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <History size={14} /> Período Padrão
                                </h3>
                                <p className="text-[10px] text-green-600 mb-2">Quantos dias atrás buscar pedidos por padrão.</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={1}
                                        max={365}
                                        value={expDias}
                                        onChange={e => setExpDias(Number(e.target.value))}
                                        className="w-20 p-2 border-2 border-green-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-green-500"
                                    />
                                    <span className="text-xs text-slate-500 font-bold">dias</span>
                                </div>
                            </div>
                            <div className="p-4 bg-green-50/60 rounded-xl border border-green-100">
                                <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Tag size={14} /> Canal Padrão
                                </h3>
                                <p className="text-[10px] text-green-600 mb-2">Canal de origem padrão para os pedidos.</p>
                                <select
                                    value={expCanal}
                                    onChange={e => setExpCanal(e.target.value as any)}
                                    className="w-full p-2 border-2 border-green-200 rounded-lg bg-white font-bold text-xs outline-none focus:border-green-500"
                                >
                                    <option value="TODOS">Todos os canais</option>
                                    <option value="ML">Mercado Livre</option>
                                    <option value="SHOPEE">Shopee</option>
                                    <option value="SITE">Site / Loja</option>
                                </select>
                            </div>
                        </div>

                        {/* Limite e Auto-Rastreio */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-green-50/60 rounded-xl border border-green-100">
                                <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-2">Limite por Sincronização</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min={10}
                                        max={1000}
                                        step={10}
                                        value={expLimite}
                                        onChange={e => setExpLimite(Number(e.target.value))}
                                        className="w-20 p-2 border-2 border-green-200 rounded-lg bg-white font-bold text-sm outline-none focus:border-green-500"
                                    />
                                    <span className="text-xs text-slate-500 font-bold">pedidos</span>
                                </div>
                            </div>
                            <div className="p-4 bg-green-50/60 rounded-xl border border-green-100 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xs font-black text-green-800 uppercase tracking-widest mb-1">Auto-Importar Rastreio</h3>
                                    <p className="text-[10px] text-green-600">Importar código de rastreamento junto com o pedido.</p>
                                </div>
                                <button onClick={() => setExpAutoRastreio(!expAutoRastreio)} className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors shrink-0 ${expAutoRastreio ? 'bg-green-600' : 'bg-gray-300'}`}>
                                    <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${expAutoRastreio ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                    <button onClick={handleSaveManual} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2">
                        <Save size={18} /> Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
};

const BlingPage: React.FC<BlingPageProps> = ({ generalSettings, onSaveSettings, onLaunchSuccess, onUpdateOrdersBatch, addToast, setCurrentPage, onLoadZpl, stockItems: erpStockItems = [], skuLinks: erpSkuLinks = [], allOrders: erpAllOrders = [], onLinkSku }) => {
    const integrations = generalSettings.integrations;
    const settings = integrations?.bling;

    // Derived state for better readability
    const isConnected = !!settings?.apiKey && settings.apiKey.length > 0;
    const scopeSettings = { ...DEFAULT_BLING_SCOPE, ...(settings?.scope || {}) };
    const canImportPedidos = scopeSettings.importarPedidos || !!scopeSettings.pedidosVenda;
    const canImportNotas = scopeSettings.importarNotasFiscais || !!scopeSettings.nfe;
    const canGerarEtiquetas = scopeSettings.gerarEtiquetas || !!scopeSettings.logistica;
    const canViewProducts = scopeSettings.importarProdutos || !!scopeSettings.produtos;

    const getDefaultTab = (): Tab => {
        return 'importacao';
    };

    const [activeTab, setActiveTab] = useState<Tab>(getDefaultTab());
    const [isSyncing, setIsSyncing] = useState(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [generatingZplId, setGeneratingZplId] = useState<string | null>(null);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isHandlingCallback, setIsHandlingCallback] = useState(false);
    const [gerandoNFeId, setGerandoNFeId] = useState<string | null>(null);

    // Ref para garantir que o auto-fetch do marketplace só ocorra uma vez por sessão
    const hasAutoFetchedVendas = useRef(false);

    // Pedidos completos vindos do endpoint de sync (com itens aninhados)
    const [syncedOrders, setSyncedOrders] = useState<any[]>([]);
    const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
    const [pedidoSearch, setPedidoSearch] = useState('');

    // ── Estado da aba Pedidos de Vendas ──────────────────────────────────────
    const [vendasDirectOrders, setVendasDirectOrders] = useState<any[]>([]);
    const [isLoadingVendas, setIsLoadingVendas] = useState(false);
    const [vendasStartDate, setVendasStartDate] = useState(getSevenDaysAgo());
    const [vendasEndDate, setVendasEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [vendasSituacao, setVendasSituacao] = useState<string>('6');
    const [vendasCanalFilter, setVendasCanalFilter] = useState<'TODOS' | 'ML' | 'SHOPEE' | 'SITE'>('TODOS');
    const [vendasSearch, setVendasSearch] = useState('');
    const [selectedVendasIds, setSelectedVendasIds] = useState<Set<string>>(new Set());
    const [isGeneratingBatchZpl, setIsGeneratingBatchZpl] = useState(false);
    const [expandedVendasIds, setExpandedVendasIds] = useState<Set<string>>(new Set());

    // ── Estado da aba Notas Fiscais (multi-select ZPL) ───────────────────────
    const [nfeCanalFilter, setNfeCanalFilter] = useState<string>('TODOS');
    const [selectedNotasIds, setSelectedNotasIds] = useState<Set<string>>(new Set());
    const [isBatchZplNotas, setIsBatchZplNotas] = useState(false);
    const [batchZplNotasProgress, setBatchZplNotasProgress] = useState<{ current: number; total: number } | null>(null);
    // Lotes ZPL (histórico da sessão)
    const [zplLotes, setZplLotes] = useState<ZplLoteItem[]>([]);
    const [showLoteSidebar, setShowLoteSidebar] = useState(false);
    const [zplLotesFilter, setZplLotesFilter] = useState<'todos' | 'falhas'>('todos');
    const [lastCompletedLote, setLastCompletedLote] = useState<ZplLoteItem | null>(null);
    const [zplGeneratedIds, setZplGeneratedIds] = useState<Set<string>>(new Set());
    // Puxar etiquetas manualmente do Bling
    const [etiquetaPullSource, setEtiquetaPullSource] = useState<'importacao' | 'nfe'>('importacao');
    const [isPullingEtiquetas, setIsPullingEtiquetas] = useState(false);
    // Canais de venda do Bling — carregados uma vez para detecção dinâmica de canal
    const [blingCanais, setBlingCanais] = useState<{ id: number; descricao: string; tipo: string }[]>([]);
    // Modal NF-e — escolha entre Bling ou ERP próprio
    const [showGerarNFeModal, setShowGerarNFeModal] = useState(false);
    const [nfeModalOrder, setNfeModalOrder] = useState<any | null>(null);
    // NF-e de saída do Bling — persiste no localStorage por dia
    const nfeSaidaStorageKey = `nfeSaida_${new Date().toISOString().slice(0, 10)}`;
    const [nfeSaida, setNfeSaida] = useState<NfeSaida[]>(() => {
        try {
            const cached = localStorage.getItem(nfeSaidaStorageKey);
            if (cached) return JSON.parse(cached) as NfeSaida[];
        } catch { /* ignore */ }
        return [];
    });
    const [isLoadingNfeSaida, setIsLoadingNfeSaida] = useState(false);
    const [nfeSaidaFiltro, setNfeSaidaFiltro] = useState<'todas' | 'pendentes' | 'autorizadas_sem_danfe' | 'emitida_danfe'>('todas');
    const [nfeSaidaSearch, setNfeSaidaSearch] = useState('');
    const [selectedNfeSaidaIds, setSelectedNfeSaidaIds] = useState<Set<number>>(new Set());
    const [emitindoNfeId, setEmitindoNfeId] = useState<number | null>(null);
    const [isBatchEmitindo, setIsBatchEmitindo] = useState(false);
    // Filtro de loja/canal e tipo de perfil na aba NF-e
    const [nfeLojaFilter, setNfeLojaFilter] = useState<string>('TODOS');
    const [nfeTipoFilter, setNfeTipoFilter] = useState<string>('TODOS');
    // Download XML do mês
    const [isDownloadingXml, setIsDownloadingXml] = useState(false);
    const [xmlDownloadProgress, setXmlDownloadProgress] = useState<{ current: number; total: number } | null>(null);
    // Download DANFE em lote
    const [isDownloadingDanfe, setIsDownloadingDanfe] = useState(false);
    const [danfeDownloadProgress, setDanfeDownloadProgress] = useState<{ current: number; total: number } | null>(null);
    // Vincular itens NF-e → ERP
    const [expandedNfeItemsId, setExpandedNfeItemsId] = useState<number | null>(null);
    const [nfeItemsCache, setNfeItemsCache] = useState<Record<number, any[]>>({});
    const [isLoadingNfeItems, setIsLoadingNfeItems] = useState(false);
    // Confirmação antes de salvar NF-e buscadas
    const [pendingNfeSaida, setPendingNfeSaida] = useState<NfeSaida[] | null>(null);
    const [showNfeSaveConfirm, setShowNfeSaveConfirm] = useState(false);
    // Filtro de canal na aba NF-e de saída
    const [nfeSaidaCanalFilter, setNfeSaidaCanalFilter] = useState<'TODOS' | 'ML' | 'SHOPEE' | 'SITE'>('TODOS');
    // Modal de vínculo catálogo Bling → ERP
    const [catalogLinkModal, setCatalogLinkModal] = useState<{ blingCode: string; blingName: string } | null>(null);
    const [catalogLinkTarget, setCatalogLinkTarget] = useState<string>('');
    const [isLinkingCatalog, setIsLinkingCatalog] = useState(false);
    // Editar pedido de venda (dados fiscais, nome)
    const [editPedidoModal, setEditPedidoModal] = useState<{ id: string; data: any } | null>(null);
    const [isSavingPedido, setIsSavingPedido] = useState(false);
    // Modal modo ZPL — escolha entre DANFE+Etiqueta ou apenas Etiqueta
    const [zplModeModal, setZplModeModal] = useState<{ zpl: string; loteId: string; descricao?: string } | null>(null);
    // Estoque
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [isLoadingStock, setIsLoadingStock] = useState(false);
    const [stockSearch, setStockSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente'>('todos');
    const [stockSort, setStockSort] = useState<'sku' | 'nome' | 'fisico_asc' | 'fisico_desc'>('sku');
    const [adjustStockModal, setAdjustStockModal] = useState<{ item: any } | null>(null);
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustOp, setAdjustOp] = useState<'B' | 'E' | 'S'>('B');
    const [adjustObs, setAdjustObs] = useState('');
    const [isSavingAdjust, setIsSavingAdjust] = useState(false);
    // Modal de confirmação de importação para o ERP
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [importQuantityLimit, setImportQuantityLimit] = useState(50);
    const [isImportingToERP, setIsImportingToERP] = useState(false);

    // Filters State
    const [filters, setFilters] = useState({
        startDate: getSevenDaysAgo(),
        endDate: getToday(),
        status: 'EM ABERTO' as 'EM ABERTO' | 'EM ANDAMENTO' | 'ATENDIDO' | 'TODOS',
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [filterNfeStatus, setFilterNfeStatus] = useState<'TODOS' | 'EMITIDA' | 'PENDENTE' | 'SEM_NOTA' | 'AUTORIZADA_SEM_DANFE'>('TODOS');
    const [enrichedOrders, setEnrichedOrders] = useState<EnrichedBlingOrder[]>([]);
    const [products, setProducts] = useState<BlingProduct[]>([]);
    const [productSearch, setProductSearch] = useState('');

    /**
     * Função Central de Verificação de Token
     * Retorna token válido; tenta refresh automático se expirado.
     */
    const getValidToken = async (): Promise<string | null> => {
        if (!settings?.apiKey) return null;

        // Verificar expiração: createdAt + expiresIn (seg) com 60s de buffer
        if (settings.createdAt && settings.expiresIn && settings.refreshToken && settings.clientId && settings.clientSecret) {
            const expiresAt = settings.createdAt + (settings.expiresIn * 1000) - 60_000;
            if (Date.now() > expiresAt) {
                try {
                    const data = await executeTokenRefresh(settings.refreshToken, settings.clientId, settings.clientSecret);
                    if (data.access_token) {
                        const updated = {
                            ...settings,
                            apiKey: data.access_token,
                            refreshToken: data.refresh_token || settings.refreshToken,
                            expiresIn: data.expires_in || settings.expiresIn,
                            createdAt: Date.now(),
                        };
                        onSaveSettings(prev => ({
                            ...prev,
                            integrations: { ...prev.integrations, bling: updated }
                        }));
                        return data.access_token;
                    }
                } catch (e) {
                    console.warn('[BlingPage] Token refresh falhou:', e);
                }
            }
        }

        return settings.apiKey;
    };

    // --- OAUTH CALLBACK HANDLER ---
    useEffect(() => {
        const checkCallback = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                const normalizedCode = code.trim();
                const alreadyConsumedCode = sessionStorage.getItem('bling_oauth_consumed_code');
                if (alreadyConsumedCode && alreadyConsumedCode === normalizedCode) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                const storedConfig = localStorage.getItem('bling_oauth_config');
                if (!storedConfig) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }

                const { clientId, clientSecret } = JSON.parse(storedConfig);
                setIsHandlingCallback(true);
                addToast('Processando autenticação do Bling...', 'info');
                sessionStorage.setItem('bling_oauth_consumed_code', normalizedCode);

                try {
                    // Importante: Passar a redirect_uri correta
                    const currentOrigin = window.location.origin.replace(/\/$/, "");
                    const redirectUri = currentOrigin;

                    const data = await executeBlingTokenExchange(normalizedCode, clientId, clientSecret, redirectUri);

                    if (data.access_token) {
                        const newSettings: BlingSettings = {
                            apiKey: data.access_token,
                            refreshToken: data.refresh_token,
                            expiresIn: data.expires_in,
                            createdAt: Date.now(),
                            clientId: clientId,
                            clientSecret: clientSecret,
                            autoSync: false,
                            scope: {
                                importarProdutos: true,
                                importarPedidos: true,
                                importarNotasFiscais: true,
                                gerarEtiquetas: true
                            }
                        };

                        onSaveSettings(prev => ({
                            ...prev,
                            integrations: {
                                ...prev.integrations,
                                bling: newSettings
                            }
                        }));

                        addToast('Integração Bling conectada com sucesso!', 'success');
                        localStorage.removeItem('bling_oauth_config');
                    } else {
                        addToast(`Falha na troca de token: ${data.error || 'Erro desconhecido'}`, 'error');
                    }
                } catch (e: any) {
                    addToast(`Erro de conexão: ${e.message}`, 'error');
                } finally {
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setIsHandlingCallback(false);
                }
            }
        };

        checkCallback();
    }, []);

    // --- AUTO SYNC LOGIC (POLLING) ---
    useEffect(() => {
        let interval: any;

        if (settings?.autoSync && settings?.apiKey) {
            const runAutoSync = async () => {
                if (isAutoSyncing) return;
                setIsAutoSyncing(true);
                try {
                    const token = await getValidToken();
                    if (!token) return; // Token invalido, aborta

                    // Sync Orders usando endpoint com paginação completa
                    const syncFrom = settings?.autoSyncFromDate || getSevenDaysAgo();
                    const autoFilters = { startDate: syncFrom, endDate: getToday(), status: 'TODOS' as const };
                    const ordersResult = await syncBlingOrders(token, autoFilters.startDate, autoFilters.endDate, 'TODOS');
                    const rawOrders = ordersResult.orders || ordersResult.items || [];

                    if (rawOrders.length > 0) {
                        setSyncedOrders(rawOrders);
                        const orderItems = rawOrders.map(transformSyncedOrder);
                        await onLaunchSuccess(orderItems);
                    }

                    // Refresh Invoice Data (Metadata only) if tab is open
                    if (activeTab === 'nfe') {
                        const invoices = await fetchBlingInvoices(token, { ...autoFilters, status: 'EMITIDAS' });
                        const invoiceMap = new Map<string, BlingInvoice>(invoices.map(inv => [inv.idPedidoVenda!, inv]));

                        setEnrichedOrders(prev => {
                            // Mescla com dados existentes se possível
                            return rawOrders.map((order: any) => ({
                                ...transformSyncedOrder(order),
                                invoice: invoiceMap.get(order.blingId || order.orderId),
                            }));
                        });
                    }

                } catch (e) {
                    console.error("Auto Sync Error:", e);
                } finally {
                    setIsAutoSyncing(false);
                }
            };

            // Aplica um atraso na inicialização para n\u00e3o estourar o limite assim que entra na p\u00e1gina
            const initialTimeout = setTimeout(() => {
                runAutoSync();
                interval = setInterval(runAutoSync, 60 * 1000); // 60 seconds
            }, 15000);

            return () => {
                clearTimeout(initialTimeout);
                if (interval) clearInterval(interval);
            };
        }

        return () => { if (interval) clearInterval(interval); };
    }, [settings?.autoSync, activeTab]);

    // ── Fetch canais de venda do Bling (para detecção dinâmica de canal) ──
    useEffect(() => {
        if (!isConnected) return;
        const fetchCanais = async () => {
            try {
                const token = await getValidToken();
                if (!token) return;
                const resp = await fetch('/api/bling/canais-venda', {
                    headers: { Authorization: token },
                });
                if (!resp.ok) return;
                const data = await resp.json();
                // Suporta ambos formatos: { canais: [...] } (endpoint dedicado) ou { data: [...] } (proxy Bling)
                const list = Array.isArray(data?.canais) ? data.canais : (Array.isArray(data?.data) ? data.data : []);
                // Normaliza campos usando 'descricao' ou 'nome' e 'tipo' ou 'sigla'
                const normalized = list.map((c: any) => ({
                    id: Number(c.id || 0),
                    descricao: String(c.descricao || c.nome || ''),
                    tipo: String(c.tipo || c.sigla || '').toLowerCase(),
                }));
                setBlingCanais(normalized);
                console.log('[Bling] canais-venda carregados:', normalized.length, normalized.map((c: any) => `${c.id}:${c.descricao}(${c.tipo})`).join(', '));
            } catch (e) {
                console.warn('[Bling] Não foi possível carregar canais-venda:', e);
            }
        };
        fetchCanais();
    }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSaveConfig = (newBlingSettings: BlingSettings) => {
        onSaveSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                bling: newBlingSettings
            }
        }));
        addToast('Configurações do Bling atualizadas com sucesso!', 'success');
    };

    const toggleAutoSync = () => {
        if (!settings) return;
        handleSaveConfig({
            ...settings,
            autoSync: !settings.autoSync
        });
    };

    const handleSyncForProduction = async () => {
        setIsSyncing(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error("Token inválido.");

            const orders = await fetchBlingOrders(token, filters);
            if (orders.length > 0) {
                await onLaunchSuccess(orders);
                addToast(`${orders.length} pedido(s) foram importados/atualizados para a produção!`, 'success');
            } else {
                addToast('Nenhum pedido de venda encontrado no Bling para os filtros selecionados.', 'info');
            }
        } catch (error: any) {
            if (error.message === "TOKEN_EXPIRED") {
                addToast("Sessão expirada. Tente recarregar a página ou gerar novo token.", "error");
            } else {
                addToast(`Erro na sincronização: ${error.message}`, 'error');
            }
        }
        finally { setIsSyncing(false); }
    };

    const handleFetchOrdersAndInvoices = async () => {
        setIsSyncing(true);
        setEnrichedOrders([]);
        try {
            const token = await getValidToken();
            if (!token) throw new Error("Token inválido.");

            // Usa endpoints paginados no servidor (sem limite de 100)
            const [ordersResult, invoicesResult] = await Promise.all([
                syncBlingOrders(token, filters.startDate, filters.endDate, filters.status === 'TODOS' ? 'TODOS' : filters.status),
                syncBlingInvoices(token, filters.startDate, filters.endDate, 'TODOS')
            ]);

            const rawOrders = ordersResult.orders || ordersResult.items || [];
            const rawInvoices = invoicesResult.invoices || [];
            const invoiceMap = new Map<string, BlingInvoice>(
                rawInvoices.map((inv: BlingInvoice) => [inv.idPedidoVenda!, inv])
            );

            const enriched: EnrichedBlingOrder[] = rawOrders.map((order: any) => ({
                ...transformSyncedOrder(order),
                invoice: invoiceMap.get(order.blingId || order.orderId),
            }));

            setSyncedOrders(rawOrders);
            setEnrichedOrders(enriched);
            if (enriched.length === 0) addToast('Nenhum pedido encontrado para os filtros.', 'info');
            else addToast(`${rawOrders.length} pedido(s) e ${rawInvoices.length} nota(s) carregados`, 'info');

        } catch (error: any) { addToast(`Erro ao buscar dados: ${error.message}`, 'error'); }
        finally { setIsSyncing(false); }
    };

    const handleFetchStock = async () => {
        setIsLoadingStock(true);
        setStockItems([]);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            const resp = await fetch('/api/bling/sync/stock', {
                headers: { 'Authorization': token }
            });
            if (!resp.ok) throw new Error(`Erro ${resp.status}`);
            const data = await resp.json();
            const items = data.stockItems || data.items || [];
            setStockItems(items);
            if (items.length === 0) addToast('Nenhum item de estoque encontrado.', 'info');
            else addToast(`📊 ${items.length} item(ns) de estoque carregados`, 'success');
        } catch (err: any) {
            addToast(`Erro ao buscar estoque: ${err.message}`, 'error');
        } finally {
            setIsLoadingStock(false);
        }
    };

    const handleAdjustStock = async () => {
        if (!adjustStockModal?.item) return;
        const qty = Number(adjustQty);
        if (isNaN(qty) || qty < 0) return addToast('Quantidade inválida.', 'error');
        setIsSavingAdjust(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            const resp = await fetch('/api/bling/estoque/atualizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: token },
                body: JSON.stringify({
                    produtoId: adjustStockModal.item.id,
                    operacao: adjustOp,
                    quantidade: qty,
                    observacoes: adjustObs || undefined,
                }),
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || `Erro ${resp.status}`);
            addToast(`✅ Estoque ajustado com sucesso!`, 'success');
            setAdjustStockModal(null);
            setAdjustQty('');
            setAdjustObs('');
            setAdjustOp('B');
            // Atualiza o item localmente para refletir imediatamente
            setStockItems(prev => prev.map(it =>
                it.id === adjustStockModal.item.id
                    ? {
                        ...it, saldoFisico: adjustOp === 'B' ? qty : adjustOp === 'E' ? it.saldoFisico + qty : Math.max(0, it.saldoFisico - qty),
                        estoqueReal: adjustOp === 'B' ? qty : adjustOp === 'E' ? it.saldoFisico + qty : Math.max(0, it.saldoFisico - qty)
                    }
                    : it
            ));
        } catch (err: any) {
            addToast(`Erro ao ajustar estoque: ${err.message}`, 'error');
        } finally {
            setIsSavingAdjust(false);
        }
    };

    const handleFetchProducts = async () => {
        setIsSyncing(true);
        setProducts([]);
        try {
            const token = await getValidToken();
            if (!token) throw new Error("Token inválido.");

            const productsResult = await fetchBlingProducts(token);
            setProducts(productsResult);
            if (productsResult.length === 0) addToast('Nenhum produto encontrado.', 'info');
        } catch (error: any) { addToast(`Erro ao buscar produtos: ${error.message}`, 'error'); }
        finally { setIsSyncing(false); }
    };

    /**
     * Gera (e opcionalmente emite) uma NF-e para o pedido informado.
     *
     * Quando `orderData.blingId` está disponível, usa a API real do Bling —
     * o próprio Bling assina e transmite ao SEFAZ sem exigir certificado local.
     * Caso contrário (pedidos sem vínculo ao Bling), cria um rascunho local.
     *
     * @param orderId   ID externo / local do pedido (marketplace ou Supabase)
     * @param orderData Dados do pedido; obrigatório ter `blingId` para usar o Bling
     * @param emitir    Se true, além de criar também envia ao SEFAZ via Bling
     * @param mode      'bling' = força via Bling; 'erp' = força via ERP próprio; 'auto' = decide por blingId
     */
    const handleGerarNFeDoPedido = async (orderId: string, orderData?: any, emitir = false, mode: 'auto' | 'bling' | 'erp' = 'auto') => {
        setGerandoNFeId(orderId);
        try {
            const blingId = orderData?.blingId || orderData?.blingNumero;
            const usarBling = mode === 'bling' || (mode === 'auto' && !!blingId);

            if (usarBling && blingId) {
                // ── Via API do Bling (certificado do Bling, sem cert local) ──
                const token = await getValidToken();
                if (!token) throw new Error('Token do Bling expirado. Reconecte a integração.');

                const response = await fetch('/api/bling/nfe/criar-emitir', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: token },
                    body: JSON.stringify({ blingOrderId: blingId, emitir }),
                });
                const result = await response.json();

                if (result.success) {
                    if (emitir && result.emitida) {
                        addToast(`✅ NF-e emitida no SEFAZ para o pedido ${orderId}!`, 'success');
                    } else if (result.emitida === false && emitir) {
                        const emitErr = typeof result.error === 'string' ? result.error : (result.error?.description || result.error?.message || JSON.stringify(result.error) || 'erro desconhecido');
                        addToast(`⚠️ NF-e criada no Bling, mas emissão ao SEFAZ falhou: ${emitErr}`, 'warning');
                    } else {
                        addToast(`✅ NF-e criada no Bling para o pedido ${orderId}!`, 'success');
                    }
                    await handleFetchOrdersAndInvoices();
                    await handleFetchVendasEmAberto(true);
                } else {
                    const errMsg = typeof result.error === 'string'
                        ? result.error
                        : (result.error?.description || result.error?.type || result.error?.message || JSON.stringify(result.error) || 'Falha desconhecida');
                    addToast(`Erro ao gerar NF-e via Bling: ${errMsg}`, 'error');
                }
            } else {
                // ── Via ERP Próprio (SEFAZ direto, sem Bling) ──
                const response = await fetch('/api/nfe/gerar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pedidoId: orderId,
                        cliente: orderData ? { nome: orderData.customer_name, cnpj: orderData.customer_cpf_cnpj || '' } : undefined,
                        valor: orderData?.price_total,
                    }),
                });
                const result = await response.json();
                if (result.success) {
                    addToast(`✅ NF-e (rascunho) gerada para o pedido ${orderId}!`, 'success');
                    await handleFetchOrdersAndInvoices();
                } else {
                    addToast(`Erro: ${result.error || 'Falha ao gerar NF-e'}`, 'error');
                }
            }
        } catch (err: any) {
            addToast(`Erro ao gerar NF-e: ${err.message}`, 'error');
        } finally {
            setGerandoNFeId(null);
        }
    };

    const handleGenerateZpl = async (invoice: BlingInvoice) => {
        if (!invoice.idPedidoVenda) return addToast('Nota fiscal sem pedido de venda associado.', 'error');
        setGeneratingZplId(invoice.id);
        try {
            const token = await getValidToken();
            if (!token) throw new Error("Token inválido.");

            const zpl = await fetchEtiquetaZplForPedido(token, invoice.idPedidoVenda);
            if (zpl) setZplModeModal({ zpl, loteId: `ZPL-NF-${invoice.id}`, descricao: invoice.idPedidoVenda });
        } catch (error: any) { addToast(`Erro ao gerar ZPL: ${error.message}`, 'error'); }
        finally { setGeneratingZplId(null); }
    };

    // ── NOTAS FISCAIS DE SAÍDA — buscar no Bling (todas situações, filtragem local) ──
    const persistNfeSaida = (notas: NfeSaida[]) => {
        try { localStorage.setItem(nfeSaidaStorageKey, JSON.stringify(notas)); } catch { /* quota */ }
        try {
            const today = new Date().toISOString().slice(0, 10);
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith('nfeSaida_') && k !== `nfeSaida_${today}`) localStorage.removeItem(k);
            }
        } catch { /* ignore */ }
    };

    const handleFetchNfeSaida = async () => {
        setIsLoadingNfeSaida(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            // Busca TODAS as notas (sem filtro de situação na API), filtragem é local
            const notas = await fetchNfeSaida(token, {
                dataInicial: filters.startDate,
                dataFinal: filters.endDate,
            });
            // Não salva automaticamente — exibe modal de confirmação
            setPendingNfeSaida(notas);
            setShowNfeSaveConfirm(true);
            setSelectedNfeSaidaIds(new Set());
            addToast(`${notas.length} nota(s) encontrada(s). Confirme se deseja salvar.`, notas.length > 0 ? 'info' : 'info');
        } catch (err: any) {
            addToast(`Erro ao buscar NF-e de saída: ${err.message}`, 'error');
        } finally {
            setIsLoadingNfeSaida(false);
        }
    };

    const handleConfirmSaveNfeSaida = () => {
        if (pendingNfeSaida) {
            setNfeSaida(pendingNfeSaida);
            persistNfeSaida(pendingNfeSaida);
            addToast(`${pendingNfeSaida.length} nota(s) salva(s) com sucesso!`, 'success');
        }
        setShowNfeSaveConfirm(false);
        setPendingNfeSaida(null);
    };

    const handleDiscardSaveNfeSaida = () => {
        // Exibe mas não persiste no localStorage
        if (pendingNfeSaida) setNfeSaida(pendingNfeSaida);
        setShowNfeSaveConfirm(false);
        setPendingNfeSaida(null);
        addToast('Notas carregadas sem salvar.', 'info');
    };

    // ── Copiar chave de acesso / abrir DANFE ─────────────────────────────────
    const handleCopiarChave = async (nfe: NfeSaida) => {
        if (nfe.chaveAcesso) {
            await navigator.clipboard.writeText(nfe.chaveAcesso);
            addToast('Chave de acesso copiada!', 'success');
            return;
        }
        // Busca detalhe para obter chave
        try {
            const token = await getValidToken();
            if (!token) return;
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const chave = detalhe?.data?.chaveAcesso || detalhe?.chaveAcesso;
            if (chave) {
                await navigator.clipboard.writeText(chave);
                addToast('Chave de acesso copiada!', 'success');
            } else {
                addToast('Chave de acesso não disponível.', 'info');
            }
        } catch (err: any) {
            addToast(`Erro: ${err.message}`, 'error');
        }
    };

    const handleAbrirDanfe = async (nfe: NfeSaida) => {
        if (nfe.linkDanfe) {
            window.open(nfe.linkDanfe, '_blank');
            return;
        }
        // Busca detalhe para obter link DANFE
        try {
            const token = await getValidToken();
            if (!token) return;
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const link = detalhe?.data?.linkDanfe || detalhe?.data?.link || detalhe?.linkDanfe;
            if (link) {
                window.open(link, '_blank');
            } else {
                addToast('Link do DANFE não disponível.', 'info');
            }
        } catch (err: any) {
            addToast(`Erro: ${err.message}`, 'error');
        }
    };

    const handleDownloadXml = async (nfe: NfeSaida) => {
        try {
            const token = await getValidToken();
            if (!token) return;
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const xmlData = detalhe?.data?.xml || detalhe?.xml || nfe.linkXml;
            if (xmlData && xmlData.startsWith('http')) {
                window.open(xmlData, '_blank');
            } else if (xmlData) {
                const blob = new Blob([xmlData], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `NFe_${nfe.numero || nfe.id}.xml`;
                a.click();
                URL.revokeObjectURL(url);
                addToast('XML baixado!', 'success');
            } else {
                addToast('XML não disponível.', 'info');
            }
        } catch (err: any) {
            addToast(`Erro: ${err.message}`, 'error');
        }
    };

    // ── Emitir NF-e pendente (enviar para SEFAZ) ────────────────────────────
    const handleEmitirNfe = async (nfe: NfeSaida) => {
        setEmitindoNfeId(nfe.id);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            await enviarNfe(token, nfe.id);
            addToast(`NF-e ${nfe.numero || nfe.id} enviada para SEFAZ com sucesso!`, 'success');
            // Atualiza status local da NF-e
            setNfeSaida(prev => {
                const updated = prev.map(n => n.id === nfe.id ? { ...n, situacao: 3, situacaoDescr: 'Aguardando Recibo' } : n);
                persistNfeSaida(updated);
                return updated;
            });
        } catch (err: any) {
            addToast(`Erro ao emitir NF-e ${nfe.numero || nfe.id}: ${err.message}`, 'error');
        } finally {
            setEmitindoNfeId(null);
        }
    };

    // ── Emitir NF-e em lote (envia todas selecionadas para SEFAZ) ───────────
    const handleBatchEmitirNfe = async () => {
        const pendentes = nfeSaida.filter(n => selectedNfeSaidaIds.has(n.id) && n.situacao === 1);
        if (pendentes.length === 0) {
            addToast('Nenhuma NF-e pendente selecionada para emissão.', 'warning');
            return;
        }
        setIsBatchEmitindo(true);
        let ok = 0, fail = 0;
        const loteId = `EMISSAO-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
        const successfulNfes: { nfeNumero: string, pedidoVendaId: string }[] = [];
        const orderIdsToUpdate: string[] = [];

        for (const nfe of pendentes) {
            try {
                const token = await getValidToken();
                if (!token) throw new Error('Token inválido.');
                await enviarNfe(token, nfe.id);
                ok++;
                successfulNfes.push({ nfeNumero: nfe.numero || String(nfe.id), pedidoVendaId: nfe.numeroVenda || '' });
                if (nfe.numeroVenda) orderIdsToUpdate.push(nfe.numeroVenda);

                setNfeSaida(prev => prev.map(n => n.id === nfe.id ? { ...n, situacao: 3, situacaoDescr: 'Aguardando Recibo' } : n));
            } catch {
                fail++;
            }
            // delay entre emissões para rate limit
            await new Promise(r => setTimeout(r, 600));
        }

        if (ok > 0) {
            // Persistir lote localmente para o DANFEManagerPage
            try {
                const cachedLotes = JSON.parse(localStorage.getItem('nfe_lotes_diarios') || '[]');
                const newLote = {
                    id: loteId,
                    data: new Date().toISOString(),
                    total: ok + fail,
                    ok,
                    fail,
                    nfes: successfulNfes
                };
                localStorage.setItem('nfe_lotes_diarios', JSON.stringify([newLote, ...cachedLotes].slice(0, 50)));
            } catch (e) {
                console.error('Erro ao salvar lote local:', e);
            }

            // Atualizar banco de dados
            if (onUpdateOrdersBatch && orderIdsToUpdate.length > 0) {
                await onUpdateOrdersBatch(orderIdsToUpdate, loteId);
            }
        }

        persistNfeSaida(nfeSaida);
        setSelectedNfeSaidaIds(new Set());
        setIsBatchEmitindo(false);
        addToast(`${ok} NF-e enviada(s) para SEFAZ.${fail > 0 ? ` ${fail} falha(s).` : ''}`, fail > 0 ? 'warning' : 'success');
    };

    // ── Gerar etiqueta ZPL a partir de NF-e (DANFE simplificado real do Bling) ──
    const handleGerarEtiquetaNfe = async (nfe: NfeSaida) => {
        setEmitindoNfeId(nfe.id);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');

            // 1. Tenta buscar ZPL REAL diretamente do endpoint NF-e no Bling
            const zplReal = await fetchNfeEtiquetaZpl(token, nfe.id);
            if (zplReal) {
                setZplModeModal({ zpl: zplReal, loteId: `ZPL-NFe-${nfe.numero || nfe.id}`, descricao: `NF-e ${nfe.numero}` });
                addToast('DANFE + Etiqueta ZPL gerada!', 'success');
                return;
            }

            // 2. Fallback: busca detalhe da NF-e para obter pedido vinculado
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const vendas = detalhe?.data?.vendas || detalhe?.vendas || [];
            let pedidoVendaId: string | number | undefined = vendas[0]?.id || detalhe?.data?.pedidoVenda?.id;
            // 3. Fallback via nfe.numeroVenda (número do pedido na loja virtual)
            if (!pedidoVendaId && nfe.numeroVenda) {
                pedidoVendaId = nfe.numeroVenda;
            }
            if (!pedidoVendaId) {
                addToast('Não foi possível gerar etiqueta: NF-e sem pedido vinculado.', 'warning');
                return;
            }
            const zpl = await fetchEtiquetaZplForPedido(token, String(pedidoVendaId));
            if (zpl) {
                setZplModeModal({ zpl, loteId: `ZPL-NFe-${nfe.numero || nfe.id}`, descricao: `NF-e ${nfe.numero} — Pedido ${pedidoVendaId}` });
                addToast('Etiqueta gerada (modo fallback).', 'success');
            } else {
                addToast('Etiqueta vazia retornada pelo Bling.', 'warning');
            }
        } catch (err: any) {
            addToast(`Erro: ${err.message}`, 'error');
        } finally {
            setEmitindoNfeId(null);
        }
    };

    // ── NF-e — filtro local ─────────────────────────────────────────────────
    const filteredNfeSaida = useMemo(() => {
        // Detecta canal de uma NF-e com base no campo loja
        const getNfeCanal = (nfe: NfeSaida): 'ML' | 'SHOPEE' | 'SITE' => {
            const l = (nfe.loja || '').toUpperCase();
            const nv = (nfe.numeroVenda || '').toUpperCase();

            if (l.includes('MERCADO') || l.includes('LIVRE') || l.includes('MLB') || l.startsWith('ML') || nv.startsWith('MLB')) return 'ML';
            if (l.includes('SHOPEE') || nv.includes('SHP') || nv.startsWith('21') || nv.startsWith('22')) return 'SHOPEE';
            if (l.includes('MAGALU') || l.includes('MAGAZINE') || l.includes('MGL')) return 'SITE';
            if (l.includes('SHEIN')) return 'SITE';
            return 'SITE';
        };

        let result = nfeSaida;
        // Filtro por situação
        if (nfeSaidaFiltro === 'pendentes') {
            result = result.filter(n => n.situacao === 1);
        } else if (nfeSaidaFiltro === 'autorizadas_sem_danfe') {
            result = result.filter(n => n.situacao === 5 && !n.linkDanfe);
        } else if (nfeSaidaFiltro === 'emitida_danfe') {
            result = result.filter(n => n.situacao === 6 || (n.situacao === 5 && !!n.linkDanfe));
        }
        // Filtro por canal (ML / Shopee / Site)
        if (nfeSaidaCanalFilter !== 'TODOS') {
            result = result.filter(n => getNfeCanal(n) === nfeSaidaCanalFilter);
        }
        // Filtro por loja/canal
        if (nfeLojaFilter !== 'TODOS') {
            result = result.filter(n => {
                const loja = (n.loja || '').toLowerCase();
                const filter = nfeLojaFilter.toLowerCase();
                return loja.includes(filter);
            });
        }
        // Filtro por tipo/perfil
        if (nfeTipoFilter !== 'TODOS') {
            result = result.filter(n => {
                const cnpj = n.contato?.numeroDocumento || '';
                return cnpj === nfeTipoFilter;
            });
        }
        // Filtro por busca
        if (nfeSaidaSearch.trim()) {
            const term = nfeSaidaSearch.trim().toLowerCase();
            result = result.filter(n =>
                (n.numero && n.numero.toLowerCase().includes(term)) ||
                (n.contato?.nome && n.contato.nome.toLowerCase().includes(term)) ||
                (n.chaveAcesso && n.chaveAcesso.includes(term)) ||
                (n.numeroVenda && n.numeroVenda.includes(term))
            );
        }
        return result;
    }, [nfeSaida, nfeSaidaFiltro, nfeSaidaSearch, nfeLojaFilter, nfeTipoFilter, nfeSaidaCanalFilter]);

    // Contadores por situação
    const nfeCounts = useMemo(() => ({
        todas: nfeSaida.length,
        pendentes: nfeSaida.filter(n => n.situacao === 1).length,
        autorizadas_sem_danfe: nfeSaida.filter(n => n.situacao === 5 && !n.linkDanfe).length,
        emitida_danfe: nfeSaida.filter(n => n.situacao === 6 || (n.situacao === 5 && !!n.linkDanfe)).length,
    }), [nfeSaida]);

    // Lojas únicas extraídas das NF-e
    const nfeLojas = useMemo(() => {
        const set = new Set<string>();
        nfeSaida.forEach(n => { if (n.loja) set.add(n.loja); });
        return [...set].sort();
    }, [nfeSaida]);

    // CNPJs únicos (perfis/empresas) extraídos das NF-e
    const nfeCnpjs = useMemo(() => {
        const map = new Map<string, string>();
        nfeSaida.forEach(n => {
            const doc = n.contato?.numeroDocumento;
            const nome = n.contato?.nome;
            if (doc && doc.length >= 11) map.set(doc, nome || doc);
        });
        return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    }, [nfeSaida]);

    // ── Download XML em lote (todas notas autorizadas/emitidas do período) ──
    const handleBaixarXmlLote = async () => {
        const notasComXml = filteredNfeSaida.filter(n =>
            n.situacao === 5 || n.situacao === 6 || n.situacao === 8
        );
        if (notasComXml.length === 0) {
            addToast('Nenhuma nota autorizada/emitida para baixar XML.', 'warning');
            return;
        }
        setIsDownloadingXml(true);
        setXmlDownloadProgress({ current: 0, total: notasComXml.length });
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            const xmlFiles: { name: string; content: string }[] = [];
            for (let i = 0; i < notasComXml.length; i++) {
                const nfe = notasComXml[i];
                setXmlDownloadProgress({ current: i + 1, total: notasComXml.length });
                try {
                    const detalhe = await fetchNfeDetalhe(token, nfe.id);
                    const xmlData = detalhe?.data?.xml || detalhe?.xml || nfe.linkXml;
                    if (xmlData) {
                        if (xmlData.startsWith('http')) {
                            // Baixa o XML via URL
                            try {
                                const resp = await fetch(xmlData);
                                if (resp.ok) {
                                    const xmlContent = await resp.text();
                                    xmlFiles.push({ name: `NFe_${nfe.numero || nfe.id}.xml`, content: xmlContent });
                                }
                            } catch { /* skip */ }
                        } else {
                            xmlFiles.push({ name: `NFe_${nfe.numero || nfe.id}.xml`, content: xmlData });
                        }
                    }
                } catch { /* skip individual */ }
                // Rate limit delay
                if (i < notasComXml.length - 1) await new Promise(r => setTimeout(r, 400));
            }
            if (xmlFiles.length === 0) {
                addToast('Nenhum XML encontrado para download.', 'warning');
            } else if (xmlFiles.length === 1) {
                // Download direto
                const blob = new Blob([xmlFiles[0].content], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = xmlFiles[0].name; a.click();
                URL.revokeObjectURL(url);
                addToast(`XML baixado: ${xmlFiles[0].name}`, 'success');
            } else {
                // Concatenar todos em um único arquivo de texto (sem JSZip)
                const separator = '\n<!-- ═══════ PRÓXIMO XML ═══════ -->\n';
                const combined = xmlFiles.map(f => `<!-- ${f.name} -->\n${f.content}`).join(separator);
                const blob = new Blob([combined], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const periodo = filters.startDate && filters.endDate ? `${filters.startDate}_${filters.endDate}` : new Date().toISOString().slice(0, 10);
                a.href = url; a.download = `XMLs_NFe_${periodo}_${xmlFiles.length}notas.xml`; a.click();
                URL.revokeObjectURL(url);
                addToast(`${xmlFiles.length} XMLs baixados em arquivo único!`, 'success');
            }
        } catch (err: any) {
            addToast(`Erro ao baixar XMLs: ${err.message}`, 'error');
        } finally {
            setIsDownloadingXml(false);
            setXmlDownloadProgress(null);
        }
    };

    // ── Download XML apenas para NF-es selecionadas ──────────────────────────
    const handleBaixarXmlSelecionados = async () => {
        const notasComXml = nfeSaida.filter(n =>
            selectedNfeSaidaIds.has(n.id) && (n.situacao === 5 || n.situacao === 6 || n.situacao === 8)
        );
        if (notasComXml.length === 0) {
            addToast('Nenhuma nota selecionada com XML disponível.', 'warning');
            return;
        }
        setIsDownloadingXml(true);
        setXmlDownloadProgress({ current: 0, total: notasComXml.length });
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            const xmlFiles: { name: string; content: string }[] = [];
            for (let i = 0; i < notasComXml.length; i++) {
                const nfe = notasComXml[i];
                setXmlDownloadProgress({ current: i + 1, total: notasComXml.length });
                try {
                    const detalhe = await fetchNfeDetalhe(token, nfe.id);
                    const xmlData = detalhe?.data?.xml || detalhe?.xml || nfe.linkXml;
                    if (xmlData) {
                        if (xmlData.startsWith('http')) {
                            try {
                                const resp = await fetch(xmlData);
                                if (resp.ok) {
                                    const xmlContent = await resp.text();
                                    xmlFiles.push({ name: `NFe_${nfe.numero || nfe.id}.xml`, content: xmlContent });
                                }
                            } catch { /* skip */ }
                        } else {
                            xmlFiles.push({ name: `NFe_${nfe.numero || nfe.id}.xml`, content: xmlData });
                        }
                    }
                } catch { /* skip individual */ }
                if (i < notasComXml.length - 1) await new Promise(r => setTimeout(r, 400));
            }
            if (xmlFiles.length === 0) {
                addToast('Nenhum XML encontrado para download.', 'warning');
            } else if (xmlFiles.length === 1) {
                const blob = new Blob([xmlFiles[0].content], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = xmlFiles[0].name; a.click();
                URL.revokeObjectURL(url);
                addToast(`XML baixado: ${xmlFiles[0].name}`, 'success');
            } else {
                const separator = '\n<!-- ═══════ PRÓXIMO XML ═══════ -->\n';
                const combined = xmlFiles.map(f => `<!-- ${f.name} -->\n${f.content}`).join(separator);
                const blob = new Blob([combined], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `XMLs_Selecionados_${xmlFiles.length}notas.xml`; a.click();
                URL.revokeObjectURL(url);
                addToast(`${xmlFiles.length} XMLs baixados!`, 'success');
            }
        } catch (err: any) {
            addToast(`Erro ao baixar XMLs: ${err.message}`, 'error');
        } finally {
            setIsDownloadingXml(false);
            setXmlDownloadProgress(null);
        }
    };

    // ── Helper interno: baixa DANFEs de uma lista de NF-es ───────────────────
    const baixarDanfesLista = async (notasList: NfeSaida[], nomeArquivo: (i: number) => string) => {
        setIsDownloadingDanfe(true);
        setDanfeDownloadProgress({ current: 0, total: notasList.length });
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            let baixados = 0;
            for (let i = 0; i < notasList.length; i++) {
                const nfe = notasList[i];
                setDanfeDownloadProgress({ current: i + 1, total: notasList.length });
                let danfeUrl = nfe.linkDanfe;
                if (!danfeUrl) {
                    try {
                        const detalhe = await fetchNfeDetalhe(token, nfe.id);
                        danfeUrl = detalhe?.data?.linkDanfe || detalhe?.data?.link || detalhe?.linkDanfe;
                    } catch { /* skip */ }
                }
                if (danfeUrl) {
                    try {
                        const resp = await fetch(danfeUrl);
                        if (resp.ok) {
                            const blob = await resp.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = nomeArquivo(i);
                            a.click();
                            URL.revokeObjectURL(url);
                            baixados++;
                        } else {
                            window.open(danfeUrl, '_blank');
                            baixados++;
                        }
                    } catch {
                        window.open(danfeUrl, '_blank');
                        baixados++;
                    }
                }
                if (i < notasList.length - 1) await new Promise(r => setTimeout(r, 600));
            }
            if (baixados === 0) {
                addToast('Nenhum DANFE disponível para download.', 'warning');
            } else {
                addToast(`${baixados} DANFE(s) baixado(s)!`, 'success');
            }
        } catch (err: any) {
            addToast(`Erro ao baixar DANFEs: ${err.message}`, 'error');
        } finally {
            setIsDownloadingDanfe(false);
            setDanfeDownloadProgress(null);
        }
    };

    // ── Download DANFE do período (todas as autorizadas/emitidas filtradas) ──
    const handleBaixarDanfeLote = async () => {
        const notas = filteredNfeSaida.filter(n => n.situacao === 5 || n.situacao === 6 || n.situacao === 8);
        if (notas.length === 0) { addToast('Nenhuma nota autorizada/emitida no período.', 'warning'); return; }
        await baixarDanfesLista(notas, (i) => `DANFE_${notas[i].numero || notas[i].id}.pdf`);
    };

    // ── Download DANFE apenas para NF-es selecionadas ────────────────────────
    const handleBaixarDanfeSelecionados = async () => {
        const notas = nfeSaida.filter(n =>
            selectedNfeSaidaIds.has(n.id) && (n.situacao === 5 || n.situacao === 6 || n.situacao === 8)
        );
        if (notas.length === 0) { addToast('Nenhuma nota selecionada com DANFE disponível.', 'warning'); return; }
        await baixarDanfesLista(notas, (i) => `DANFE_${notas[i].numero || notas[i].id}.pdf`);
    };

    // ── Buscar itens/produtos de uma NF-e (para vincular ao estoque) ────────
    const handleExpandNfeItems = async (nfe: NfeSaida) => {
        if (expandedNfeItemsId === nfe.id) {
            setExpandedNfeItemsId(null);
            return;
        }
        // Se já carregou, apenas expand
        if (nfeItemsCache[nfe.id]) {
            setExpandedNfeItemsId(nfe.id);
            return;
        }
        setIsLoadingNfeItems(true);
        setExpandedNfeItemsId(nfe.id);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            const detalhe = await fetchNfeDetalhe(token, nfe.id);
            const itens = detalhe?.data?.itens || detalhe?.itens || [];
            setNfeItemsCache(prev => ({ ...prev, [nfe.id]: itens }));
        } catch (err: any) {
            addToast(`Erro ao carregar itens: ${err.message}`, 'error');
            setExpandedNfeItemsId(null);
        } finally {
            setIsLoadingNfeItems(false);
        }
    };

    // ── Gerar etiqueta + DANFE simplificada em lote ─────────────────────────
    const handleBatchEtiquetaDanfe = async () => {
        const notasSel = nfeSaida.filter(n =>
            selectedNfeSaidaIds.has(n.id) && (n.situacao === 5 || n.situacao === 6)
        );
        if (notasSel.length === 0) {
            addToast('Selecione notas autorizadas/emitidas para gerar etiqueta+DANFE.', 'warning');
            return;
        }
        setIsBatchEmitindo(true);
        const zplParts: string[] = [];
        let ok = 0, fail = 0;
        for (const nfe of notasSel) {
            try {
                const token = await getValidToken();
                if (!token) throw new Error('Token inválido.');

                // 1. Tenta ZPL REAL direto do endpoint NF-e no Bling
                const zplReal = await fetchNfeEtiquetaZpl(token, nfe.id);
                if (zplReal) {
                    zplParts.push(zplReal);
                    ok++;
                } else {
                    // 2. Fallback via pedido vinculado
                    const detalhe = await fetchNfeDetalhe(token, nfe.id);
                    const vendas = detalhe?.data?.vendas || detalhe?.vendas || [];
                    const pedidoVendaId = vendas[0]?.id || detalhe?.data?.pedidoVenda?.id;
                    if (pedidoVendaId) {
                        const zpl = await fetchEtiquetaZplForPedido(token, String(pedidoVendaId));
                        if (zpl) { zplParts.push(zpl); ok++; }
                        else fail++;
                    } else fail++;
                }
            } catch { fail++; }
            await new Promise(r => setTimeout(r, 500));
        }
        if (zplParts.length > 0) {
            const loteId = `ETIQ-DANFE-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
            const combined = zplParts.join('\n');
            setZplModeModal({ zpl: combined, loteId, descricao: `${ok} etiqueta(s) + DANFE` });
            addToast(`${ok} etiqueta(s) gerada(s)!${fail > 0 ? ` ${fail} falha(s).` : ''}`, ok > 0 ? 'success' : 'warning');
        } else {
            addToast(`Nenhuma etiqueta gerada. ${fail} falha(s).`, 'error');
        }
        setIsBatchEmitindo(false);
        setSelectedNfeSaidaIds(new Set());
    };

    // ── Editar pedido de venda (corrigir dados fiscais) ──────────────────────
    const handleSalvarPedido = async () => {
        if (!editPedidoModal) return;
        setIsSavingPedido(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token inválido.');
            await atualizarPedidoVenda(token, editPedidoModal.id, editPedidoModal.data);
            addToast(`Pedido ${editPedidoModal.id} atualizado com sucesso!`, 'success');
            setEditPedidoModal(null);
            await handleFetchOrdersAndInvoices();
        } catch (err: any) {
            addToast(`Erro ao atualizar pedido: ${err.message}`, 'error');
        } finally {
            setIsSavingPedido(false);
        }
    };

    /**
     * Copia o ZPL para a área de transferência e registra na fila de pendentes.
     */
    const copyZplBatch = (zplContent: string, loteId: string, source: 'bling-notas' | 'marketplace' | 'individual' = 'individual', descricao?: string) => {
        const labelCount = (zplContent.match(/\^XA/gi) || []).length;
        addPendingZplItem({
            id: loteId,
            loteId,
            zplContent,
            labelCount,
            timestamp: new Date().toISOString(),
            source,
            descricao,
        });
        navigator.clipboard.writeText(zplContent)
            .then(() => addToast(`✅ ZPL copiado! ${labelCount} etiqueta(s). Veja pendentes em Etiquetas.`, 'success'))
            .catch(() => addToast('Não foi possível copiar. Verifique a permissão de clipboard do navegador.', 'error'));
    };

    /**
     * Gera ZPL em lote para todas as notas selecionadas na aba ZPL.
     * - Processamento sequencial com 400ms entre chamadas (anti rate-limit)
     * - Registra lote no histórico da sessão (sidebar de lotes)
     * - Abre painel lateral com resultado após conclusão
     */
    const handleBatchZplNotas = async () => {
        const targets = filteredEnrichedOrders.filter(o =>
            selectedNotasIds.has(o.id) && o.invoice?.idPedidoVenda
        );
        if (targets.length === 0) {
            addToast('Nenhuma nota selecionada com etiqueta disponível.', 'error');
            return;
        }

        setIsBatchZplNotas(true);
        setBatchZplNotasProgress({ current: 0, total: targets.length });

        const token = await getValidToken();
        if (!token) {
            addToast('Token do Bling expirado. Reconecte a integração.', 'error');
            setIsBatchZplNotas(false);
            setBatchZplNotasProgress(null);
            return;
        }

        const zplParts: string[] = [];
        let successCount = 0;
        const failedItems: ZplLoteItem['failed'] = [];

        for (let i = 0; i < targets.length; i++) {
            const order = targets[i];
            setBatchZplNotasProgress({ current: i + 1, total: targets.length });
            try {
                let zpl = await fetchEtiquetaZplForPedido(token, order.invoice!.idPedidoVenda!);
                if (zpl) {
                    // Adicionar SKU ao final da etiqueta ZPL se solicitado
                    // O ZPL termina com ^XZ. Vamos injetar campos de texto antes do fim.
                    const skuText = order.sku || 'N/A';
                    const canalText = order.canal || 'S/ Canal';
                    const pedidoLoja = order.id_pedido_loja || order.bling_numero || 'N/A';

                    const extraInfoZpl = `^CF0,20^FO40,1120^FDSKU: ${skuText}^FS^FO40,1145^FDCANAL: ${canalText}^FS^FO40,1170^FDPED: ${pedidoLoja}^FS^XZ`;
                    zpl = zpl.replace(/\^XZ/gi, extraInfoZpl);

                    zplParts.push(zpl);
                    successCount++;
                    // Marca como gerado nesta sessão
                    setZplGeneratedIds(prev => new Set([...prev, order.id]));
                } else {
                    failedItems.push({ orderId: order.orderId, blingId: order.blingId || '', error: 'ZPL vazio retornado' });
                }
            } catch (err: any) {
                console.error(`[ZPL Batch] Erro no pedido ${order.orderId}:`, err.message);
                failedItems.push({ orderId: order.orderId, blingId: order.blingId || '', error: err.message || 'Erro desconhecido' });
            }
            if (i < targets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 400));
            }
        }

        const loteId = `LOTE-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
        const combinedZpl = zplParts.join('\n');

        if (zplParts.length > 0) {
            copyZplBatch(combinedZpl, loteId, 'bling-notas', `${targets.length} notas selecionadas`);
            const newLote: ZplLoteItem = {
                id: loteId,
                timestamp: new Date().toISOString(),
                total: targets.length,
                success: successCount,
                failed: failedItems,
                zplContent: combinedZpl,
            };
            setZplLotes(prev => [newLote, ...prev].slice(0, 50)); // máx 50 lotes
            setLastCompletedLote(newLote);
            setShowLoteSidebar(true);
            addToast(`✅ ${successCount} ZPL geradas!${failedItems.length > 0 ? ` (${failedItems.length} falha(s) — veja o painel de lotes)` : ''}`, 'success');
        } else {
            addToast(`Nenhuma etiqueta ZPL foi gerada. ${failedItems.length} erro(s).`, 'error');
        }

        setSelectedNotasIds(new Set());
        setIsBatchZplNotas(false);
        setBatchZplNotasProgress(null);
    };

    const handleBatchGerarNFe = async (emitir = false) => {
        if (selectedVendasIds.size === 0) return;
        setIsBatchEmitindo(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token do Bling expirado.');

            const ids = Array.from(selectedVendasIds);
            const loteId = `GERACAO-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

            const response = await fetch('/api/bling/nfe/batch-criar-emitir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: token },
                body: JSON.stringify({ blingOrderIds: ids, emitir }),
            });
            const result = await response.json();

            if (result.success) {
                const results = result.results || [];
                const okItems = results.filter((r: any) => r.success);
                const ok = okItems.length;
                const fail = results.filter((r: any) => !r.success).length;

                if (ok > 0) {
                    addToast(`✅ ${ok} NF-e(s) processada(s) com sucesso!`, 'success');

                    // Persistir lote localmente
                    try {
                        const cachedLotes = JSON.parse(localStorage.getItem('nfe_lotes_diarios') || '[]');
                        const successfulNfes = okItems.map((r: any) => ({
                            nfeNumero: String(r.nfeId || r.blingOrderId),
                            pedidoVendaId: String(r.blingOrderId)
                        }));
                        const newLote = {
                            id: loteId,
                            data: new Date().toISOString(),
                            total: ok + fail,
                            ok,
                            fail,
                            nfes: successfulNfes
                        };
                        localStorage.setItem('nfe_lotes_diarios', JSON.stringify([newLote, ...cachedLotes].slice(0, 50)));
                    } catch (e) {
                        console.error('Erro ao salvar lote local:', e);
                    }

                    // Atualizar banco de dados
                    if (onUpdateOrdersBatch) {
                        const successfulOrderIds = okItems.map((r: any) => String(r.blingOrderId));
                        await onUpdateOrdersBatch(successfulOrderIds, loteId);
                    }

                    // Refresh para atualizar status e remover do "Em Aberto" se necessário
                    await handleFetchVendasEmAberto(true);
                    await handleFetchOrdersAndInvoices();
                    setSelectedVendasIds(new Set());
                }
                if (fail > 0) {
                    addToast(`⚠️ ${fail} pedido(s) falharam no lote.`, 'warning');
                }
            } else {
                addToast(`Erro ao processar lote: ${result.error}`, 'error');
            }
        } catch (err: any) {
            addToast(`Erro: ${err.message}`, 'error');
        } finally {
            setIsBatchEmitindo(false);
        }
    };

    /**
     * Busca pedidos de vendas diretamente do Bling com “Situação: Em Aberto”.
     * Usa o endpoint dedicado que envia idsSituacoes[0]=6 ao Bling.
     */
    const handleFetchVendasEmAberto = async (replace = false) => {
        const token = await getValidToken();
        if (!token) return addToast('Token do Bling expirado. Reconecte a integração.', 'error');
        setIsLoadingVendas(true);
        try {
            const situacoesParam = vendasSituacao === 'TODOS' ? '' : vendasSituacao;
            const qs = new URLSearchParams({
                dataInicio: vendasStartDate,
                dataFim: vendasEndDate,
                ...(situacoesParam ? { situacoes: situacoesParam } : {}),
            }).toString();
            const resp = await fetch(`/api/bling/vendas/buscar?${qs}`, {
                headers: { Authorization: token },
            });
            const data = await resp.json();
            if (!resp.ok || !data.success) throw new Error(data.error || `Erro ${resp.status}`);
            setVendasDirectOrders(prev => {
                if (replace) return data.orders || [];
                const existingIds = new Set(prev.map((o: any) => o.blingId || o.orderId));
                const newOrders = (data.orders || []).filter((o: any) => !existingIds.has(o.blingId || o.orderId));
                return [...prev, ...newOrders];
            });
            setSelectedVendasIds(new Set());
            // Debug: log dos canais detectados
            const canais = [...new Set((data.orders || []).map((o: any) => `${o.canal}(${o.canalRaw || '?'})`))].join(', ');
            console.log('[Marketplace] canais detectados:', canais);
            addToast(`✅ ${data.total} pedido(s) carregado(s) do Bling!`, 'success');
        } catch (err: any) {
            addToast(`Erro ao buscar pedidos: ${err.message}`, 'error');
        } finally {
            setIsLoadingVendas(false);
        }
    };

    // ── Mapeamento lojaId → canal baseado nos canais-venda do Bling ──────────────
    const lojaIdToCanal = useMemo((): Map<number, 'ML' | 'SHOPEE' | 'SITE'> => {
        const map = new Map<number, 'ML' | 'SHOPEE' | 'SITE'>();
        blingCanais.forEach(c => {
            const tipo = c.tipo.toLowerCase();
            const descr = c.descricao.toUpperCase();
            let canal: 'ML' | 'SHOPEE' | 'SITE' = 'SITE';
            if (tipo.includes('mercadolivre') || tipo.includes('ml') || descr.includes('MERCADO LIVRE') || descr.includes('MERCADOLIVRE') || descr.includes('MLB') || descr.includes('ML')) {
                canal = 'ML';
            } else if (tipo.includes('shopee') || descr.includes('SHOPEE')) {
                canal = 'SHOPEE';
            }
            map.set(c.id, canal);
        });
        return map;
    }, [blingCanais]);

    const filteredVendasOrders = useMemo(() => {
        return vendasDirectOrders.map(o => {
            // Prioridade 1: canal já detectado pelo servidor com base em loja.nome
            if (o.canal && o.canal !== 'SITE') return o;

            // Prioridade 2: mapa lojaId → canal (via canais-venda do Bling)
            if (lojaIdToCanal.size > 0 && o.lojaId && lojaIdToCanal.has(o.lojaId)) {
                return { ...o, canal: lojaIdToCanal.get(o.lojaId) };
            }

            // Prioridade 3: detectar pelo canalRaw retornado pelo servidor
            if (o.canalRaw) {
                const raw = (o.canalRaw as string).toLowerCase();
                if (raw.includes('shopee')) return { ...o, canal: 'SHOPEE' };
                if (raw.includes('mercado') || raw.includes('mlb') || raw.includes('ml ') || raw.includes('mercadolivre')) return { ...o, canal: 'ML' };
            }

            // Prioridade 4: detectar pelo campo loja (string display)
            if (o.loja) {
                const loja = (o.loja as string).toLowerCase();
                if (loja.includes('shopee')) return { ...o, canal: 'SHOPEE' };
                if (loja.includes('mercado') || loja.includes('ml') || loja.includes('mlb')) return { ...o, canal: 'ML' };
            }

            return o;
        }).filter(o => {
            const matchCanal = vendasCanalFilter === 'TODOS' || o.canal === vendasCanalFilter;
            const s = vendasSearch.toLowerCase();
            const matchSearch = !vendasSearch ||
                (o.orderId || '').toLowerCase().includes(s) ||
                (o.blingNumero || '').toLowerCase().includes(s) ||
                (o.customer_name || '').toLowerCase().includes(s) ||
                (o.loja || '').toLowerCase().includes(s) ||
                (o.itens || []).some((it: any) => (it.sku || '').toLowerCase().includes(s));
            return matchCanal && matchSearch;
        });
    }, [vendasDirectOrders, vendasCanalFilter, vendasSearch, lojaIdToCanal]);

    // Set de blingIds já importados para o ERP (syncedOrders)
    const erpImportedBlingIds = useMemo(() => {
        const s = new Set<string>();
        syncedOrders.forEach(o => {
            if (o.blingId) s.add(String(o.blingId));
            if (o.orderId) s.add(String(o.orderId));
            if (o.blingNumero) s.add(String(o.blingNumero));
        });
        return s;
    }, [syncedOrders]);

    // Mapa blingId/orderId → invoice para a aba marketplace
    const vendasInvoiceMap = useMemo(() => {
        const map = new Map<string, BlingInvoice>();
        enrichedOrders.forEach(o => {
            if (o.invoice) {
                if (o.blingId) map.set(o.blingId, o.invoice);
                if (o.orderId) map.set(o.orderId, o.invoice);
            }
        });
        return map;
    }, [enrichedOrders]);

    const handleBatchZpl = async () => {
        if (selectedVendasIds.size === 0) return;
        setIsGeneratingBatchZpl(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error("Token inválido.");
            const zplParts: string[] = [];
            let erros = 0;
            for (const ordKey of Array.from(selectedVendasIds)) {
                const ord = filteredVendasOrders.find(o => (o.blingId || o.orderId) === ordKey);
                if (!ord) continue;
                try {
                    const zpl = await fetchEtiquetaZplForPedido(token, ord.blingId || ord.orderId);
                    if (zpl) zplParts.push(zpl);
                } catch {
                    erros++;
                }
            }
            if (zplParts.length > 0) {
                const batchLoteId = `LOTE-MP-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
                copyZplBatch(zplParts.join('\n'), batchLoteId, 'marketplace', `${zplParts.length} pedido(s) marketplace`);
                addToast(`${zplParts.length} etiqueta(s) ZPL gerada(s).${erros > 0 ? ` (${erros} falha(s))` : ''}`, erros > 0 ? 'info' : 'success');
            } else {
                addToast('Nenhuma etiqueta disponível para os pedidos selecionados.', 'error');
            }
        } catch (err: any) {
            addToast(`Erro ao gerar ZPL em lote: ${err.message}`, 'error');
        } finally {
            setIsGeneratingBatchZpl(false);
        }
    };

    // ── Puxar etiquetas manualmente do Bling ─────────────────────────────────
    const handlePullEtiquetas = async () => {
        setIsPullingEtiquetas(true);
        try {
            const token = await getValidToken();
            if (!token) throw new Error('Token do Bling expirado. Reconecte.');

            let ids: string[] = [];
            if (etiquetaPullSource === 'importacao') {
                // Pega os pedidos selecionados da aba Importação, ou todos se nenhum selecionado
                if (selectedVendasIds.size > 0) {
                    ids = Array.from(selectedVendasIds);
                } else {
                    ids = filteredVendasOrders.slice(0, 50).map(o => o.blingId || o.orderId).filter(Boolean);
                }
            } else {
                // Pega dos pedidos com NF-e (aba NF-e)
                ids = filteredEnrichedOrders.slice(0, 50).map(o => o.blingId || o.orderId).filter(Boolean);
            }

            if (ids.length === 0) {
                addToast('Nenhum pedido encontrado. Busque pedidos na aba Importação ou NF-e primeiro.', 'warning');
                return;
            }

            const result = await fetchEtiquetasLote(token, ids);

            const successZpls = result.results.filter(r => r.success && r.zpl);
            const failedItems = result.results.filter(r => !r.success);

            if (successZpls.length > 0) {
                const batchZpl = successZpls.map(r => r.zpl!).join('\n');
                const loteId = `LOTE-BLING-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
                const newLote: ZplLoteItem = {
                    id: loteId,
                    timestamp: new Date().toISOString(),
                    total: ids.length,
                    success: successZpls.length,
                    failed: failedItems.map(f => ({ orderId: String(f.pedidoVendaId), blingId: String(f.pedidoVendaId), error: f.error || 'Erro desconhecido' })),
                    zplContent: batchZpl,
                };
                setZplLotes(prev => [newLote, ...prev]);
                setLastCompletedLote(newLote);
                addToast(`${successZpls.length} etiqueta(s) puxada(s) do Bling.${failedItems.length > 0 ? ` ${failedItems.length} falha(s).` : ''}`, failedItems.length > 0 ? 'info' : 'success');
            } else {
                addToast(`Nenhuma etiqueta puxada. ${failedItems.length} falha(s).`, 'error');
            }
        } catch (err: any) {
            addToast(`Erro ao puxar etiquetas: ${err.message}`, 'error');
        } finally {
            setIsPullingEtiquetas(false);
        }
    };

    const toggleSelectVenda = (key: string) => {
        setSelectedVendasIds(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const toggleSelectAllVendas = () => {
        if (selectedVendasIds.size === filteredVendasOrders.length && filteredVendasOrders.length > 0) {
            setSelectedVendasIds(new Set());
        } else {
            setSelectedVendasIds(new Set(filteredVendasOrders.map(o => o.blingId || o.orderId)));
        }
    };

    const handleCatalogLink = async () => {
        if (!catalogLinkModal || !catalogLinkTarget) return;
        if (!onLinkSku) { addToast('Função de vínculo não disponível.', 'error'); return; }
        setIsLinkingCatalog(true);
        try {
            const ok = await onLinkSku(catalogLinkModal.blingCode, catalogLinkTarget);
            if (ok) {
                addToast(`Vínculo criado: ${catalogLinkModal.blingCode} → ${catalogLinkTarget}`, 'success');
                setCatalogLinkModal(null);
                setCatalogLinkTarget('');
            } else {
                addToast('Não foi possível criar o vínculo.', 'error');
            }
        } catch (err: any) {
            addToast(`Erro ao vincular: ${err.message}`, 'error');
        } finally {
            setIsLinkingCatalog(false);
        }
    };

    const filteredProducts = useMemo(() => {
        if (!productSearch) return products;
        const search = productSearch.toLowerCase();
        return products.filter(p => p.descricao.toLowerCase().includes(search) || p.codigo.toLowerCase().includes(search));
    }, [products, productSearch]);

    // ── Auto-fetch marketplace ao entrar na aba ───────────────────────────────
    useEffect(() => {
        if (
            activeTab === 'importacao' &&
            isConnected &&
            vendasDirectOrders.length === 0 &&
            !isLoadingVendas &&
            !hasAutoFetchedVendas.current
        ) {
            hasAutoFetchedVendas.current = true;
            handleFetchVendasEmAberto();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isConnected]);

    // ── Set de SKU codes ligados a produtos ERP (para indicador no catálogo) ──
    const erpSkuLinkedCodes = useMemo(() => {
        const s = new Set<string>();
        // Produtos ERP com kind=PRODUTO ou PROCESSADO cujo code bate com SKU Bling
        erpStockItems.forEach(item => s.add(item.code.toUpperCase()));
        // skuLinks: masterProductSku também é referência válida
        erpSkuLinks.forEach(link => s.add(link.masterProductSku.toUpperCase()));
        return s;
    }, [erpStockItems, erpSkuLinks]);

    // ── Map de estoque ERP por SKU Bling (uppercase) → current_qty ──────────
    const erpStockMap = useMemo(() => {
        const m = new Map<string, number>();
        erpStockItems.forEach(item => m.set(item.code.toUpperCase(), item.current_qty));
        erpSkuLinks.forEach(link => {
            const master = erpStockItems.find(i => i.code === link.masterProductSku);
            if (master && !m.has(link.importedSku.toUpperCase())) {
                m.set(link.importedSku.toUpperCase(), master.current_qty);
            }
        });
        return m;
    }, [erpStockItems, erpSkuLinks]);

    // ── Map de SKU (Bling/importado) → nome do produto ERP vinculado ─────────
    const erpSkuNameMap = useMemo(() => {
        const m = new Map<string, string>();
        // Products diretos
        erpStockItems.forEach(item => m.set(item.code.toUpperCase(), item.name));
        // Via sku_links: importedSku → masterProductSku → name
        erpSkuLinks.forEach(link => {
            const master = erpStockItems.find(i => i.code.toUpperCase() === link.masterProductSku.toUpperCase());
            if (master) {
                m.set(link.importedSku.toUpperCase(), master.name);
                m.set(link.masterProductSku.toUpperCase(), master.name);
            }
        });
        return m;
    }, [erpStockItems, erpSkuLinks]);

    const filteredEnrichedOrders = useMemo(() => {
        return enrichedOrders.filter(order => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm || (
                (order.orderId && order.orderId.toLowerCase().includes(searchLower)) ||
                (order.blingId && order.blingId.toLowerCase().includes(searchLower)) ||
                (order.customer_name && order.customer_name.toLowerCase().includes(searchLower)) ||
                ((order as any).loja && (order as any).loja.toLowerCase().includes(searchLower))
            );

            let matchesNfe = true;
            if (filterNfeStatus !== 'TODOS') {
                const status = order.invoice?.situacao?.toLowerCase() || '';
                if (filterNfeStatus === 'EMITIDA') matchesNfe = status === 'emitida' || status === 'autorizada';
                else if (filterNfeStatus === 'PENDENTE') matchesNfe = !!order.invoice && status !== 'emitida' && status !== 'autorizada';
                else if (filterNfeStatus === 'AUTORIZADA_SEM_DANFE') matchesNfe = !!order.invoice && (status === 'autorizada' || status === 'emitida') && !order.invoice.linkDanfe;
                else if (filterNfeStatus === 'SEM_NOTA') matchesNfe = !order.invoice;
            }

            // Filtro de loja/canal
            let matchesCanal = true;
            if (nfeCanalFilter !== 'TODOS') {
                const orderCanal = (order as any).canal || '';
                const orderLoja = (order as any).loja || '';
                if (['ML', 'SHOPEE', 'SITE'].includes(nfeCanalFilter)) {
                    matchesCanal = orderCanal === nfeCanalFilter;
                } else {
                    // Filtro por nome exato da loja (canais customizados do Bling)
                    matchesCanal = orderLoja.toUpperCase().includes(nfeCanalFilter.toUpperCase());
                }
            }

            return matchesSearch && matchesNfe && matchesCanal;
        });
    }, [enrichedOrders, searchTerm, filterNfeStatus, nfeCanalFilter]);

    // Helper reutilizável fora do useMemo (para uso no JSX)
    const getNfeCanal = (nfe: NfeSaida): 'ML' | 'SHOPEE' | 'SITE' => {
        const l = (nfe.loja || '').toUpperCase();
        if (l.includes('MERCADO') || l.includes('LIVRE') || l.includes('MLB') || l.startsWith('ML')) return 'ML';
        if (l.includes('SHOPEE')) return 'SHOPEE';
        return 'SITE';
    };

    if (isHandlingCallback) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 size={48} className="animate-spin text-blue-600" />
                <h2 className="text-xl font-black text-slate-700">Autenticando com o Bling...</h2>
                <p className="text-slate-500">Por favor, aguarde enquanto configuramos o acesso.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-200 pb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                        <Cloud size={40} className="text-blue-600 bg-blue-100 p-2 rounded-2xl shadow-sm" />
                        Painel Bling
                    </h1>
                    <div className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full border uppercase tracking-widest ${isConnected ? 'text-green-700 bg-green-100 border-green-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                        {isConnected ? <><CheckCircle size={12} /> Conectado</> : <><Settings size={12} /> Não Configurado</>}
                    </div>
                    {isAutoSyncing && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-purple-700 bg-purple-100 px-3 py-1.5 rounded-full border border-purple-200 uppercase tracking-widest animate-pulse">
                            <RefreshCw size={12} className="animate-spin" /> Sincronizando...
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={toggleAutoSync}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${settings?.autoSync ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                        title={settings?.autoSync ? "Desativar Sincronização Automática" : "Ativar Sincronização Automática"}
                    >
                        {settings?.autoSync ? <ToggleRight size={24} className="text-purple-600" /> : <ToggleLeft size={24} />}
                        {settings?.autoSync ? 'Auto Sync ON' : 'Auto Sync OFF'}
                    </button>
                    <button
                        onClick={() => setIsConfigModalOpen(true)}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-2 group"
                        title="Configurações do Bling"
                    >
                        <Settings size={20} className="group-hover:rotate-45 transition-transform" />
                        <span className="text-xs font-black uppercase hidden sm:inline">Configurar</span>
                    </button>
                </div>
            </div>

            {/* Banner Desconectado */}
            {!isConnected && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm text-blue-600"><Info size={24} /></div>
                        <div>
                            <p className="font-bold text-blue-900 text-sm uppercase tracking-tight">Integração não configurada</p>
                            <p className="text-xs text-blue-700 font-medium">Para sincronizar pedidos, notas e produtos, você precisa configurar o acesso OAuth.</p>
                        </div>
                    </div>
                    <button onClick={() => setIsConfigModalOpen(true)} className="px-6 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95">Configurar Agora</button>
                </div>
            )}

            {/* Tabs — Importação, NF-e, Etiquetas, Catálogo */}
            <div className="flex border-b overflow-x-auto">
                <button onClick={() => setActiveTab('importacao')} className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'importacao' ? 'border-yellow-500 text-yellow-700 bg-yellow-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><ShoppingBag size={16} /> Importação</button>
                <button onClick={() => setActiveTab('nfe')} className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'nfe' ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><FileText size={16} /> NF-e</button>
                <button onClick={() => setActiveTab('etiquetas')} className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'etiquetas' ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><Printer size={16} /> Etiquetas {zplLotes.length > 0 && <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{zplLotes.length}</span>}</button>
                {canViewProducts && <button onClick={() => setActiveTab('catalogo')} className={`flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'catalogo' ? 'border-purple-600 text-purple-700 bg-purple-50/50' : 'border-transparent text-gray-400 hover:text-gray-600'}`}><Package size={16} /> Catálogo</button>}
            </div>

            {/* Content: Importação (Pedidos de Vendas do Bling) */}
            {activeTab === 'importacao' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    {/* Mini-banner lotes ZPL */}
                    {(lastCompletedLote || zplLotes.length > 0) && (
                        <div>
                            {lastCompletedLote ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs font-black text-emerald-700">✅ Lote {lastCompletedLote.id} — {lastCompletedLote.success} etiqueta(s){lastCompletedLote.failed.length > 0 ? `, ${lastCompletedLote.failed.length} falha(s)` : ''}</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setZplModeModal({ zpl: lastCompletedLote.zplContent, loteId: lastCompletedLote.id })} className="flex items-center gap-1 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"><Printer size={11} /> Imprimir</button>
                                        <button onClick={() => setActiveTab('etiquetas')} className="text-[10px] font-black text-blue-600 hover:underline px-2 py-1.5">Ver Lotes →</button>
                                        <button onClick={() => setLastCompletedLote(null)} className="text-emerald-400 hover:text-emerald-600"><X size={14} /></button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                                    <span className="text-[11px] font-black text-blue-700"><Printer size={12} className="inline mr-1" />{zplLotes.length} lote(s) ZPL gerado(s)</span>
                                    <button onClick={() => setActiveTab('etiquetas')} className="text-[10px] font-black text-blue-600 hover:underline">Abrir Etiquetas →</button>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Header + bulk actions */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
                        {/* Título + ações bulk */}
                        <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                    <ShoppingBag className="text-yellow-500" /> Importação — Pedidos de Vendas
                                    {filteredVendasOrders.length > 0 && <span className="text-sm text-slate-400 font-bold normal-case tracking-normal ml-1">({filteredVendasOrders.length})</span>}
                                </h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Filtro API: <strong className="text-yellow-600">
                                        {vendasSituacao === '6' ? 'Em Aberto' : vendasSituacao === '9' ? 'Atendido' : vendasSituacao === '15' ? 'Em Andamento' : vendasSituacao === '6,9' ? 'Em Aberto + Atendido' : 'Todas'}
                                    </strong> — direto do Bling v3. Gere NF-e ou ZPL sem sair daqui.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {selectedVendasIds.size > 0 && (
                                    <>
                                        <button
                                            onClick={() => handleBatchGerarNFe(false)}
                                            disabled={isBatchEmitindo}
                                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            {isBatchEmitindo ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} NF-e ({selectedVendasIds.size})
                                        </button>
                                        <button onClick={handleBatchZpl} disabled={isGeneratingBatchZpl} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95">
                                            {isGeneratingBatchZpl ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />} ZPL ({selectedVendasIds.size})
                                        </button>
                                        <button
                                            onClick={() => setShowImportConfirm(true)}
                                            disabled={isImportingToERP}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-green-100 hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95"
                                        >
                                            {isImportingToERP ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                            Importar ERP ({selectedVendasIds.size})
                                        </button>
                                        <button onClick={() => setSelectedVendasIds(new Set())} className="px-3 py-2 text-xs font-black uppercase bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all">Limpar</button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Painel de busca do Bling */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
                            <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap size={12} /> Buscar do Bling — Venda &gt; Pedidos de Vendas</p>
                            <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                    <label className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1 block">Data Inicial</label>
                                    <input type="date" value={vendasStartDate} onChange={e => setVendasStartDate(e.target.value)} className="p-2.5 border-2 border-yellow-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-yellow-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1 block">Data Final</label>
                                    <input type="date" value={vendasEndDate} onChange={e => setVendasEndDate(e.target.value)} className="p-2.5 border-2 border-yellow-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-yellow-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1 block">Situação</label>
                                    <select value={vendasSituacao} onChange={e => setVendasSituacao(e.target.value)} className="p-2.5 border-2 border-yellow-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-yellow-500">
                                        <option value="6">Em Aberto</option>
                                        <option value="9">Atendido</option>
                                        <option value="15">Em Andamento</option>
                                        <option value="6,9">Em Aberto + Atendido</option>
                                        <option value="TODOS">Todas as Situações</option>
                                    </select>
                                </div>
                                <button
                                    onClick={handleFetchVendasEmAberto}
                                    disabled={isLoadingVendas}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-yellow-600 disabled:opacity-50 transition-all shadow shadow-yellow-200 active:scale-95"
                                >
                                    {isLoadingVendas ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                                    {isLoadingVendas ? 'Buscando...' : 'Buscar Pedidos'}
                                </button>
                                {vendasDirectOrders.length > 0 && (
                                    <>
                                        <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-3 py-1.5 rounded-full">
                                            {vendasDirectOrders.length} pedido(s) carregado(s)
                                        </span>
                                        <button
                                            onClick={() => { setVendasDirectOrders([]); setSelectedVendasIds(new Set()); }}
                                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-full hover:bg-red-100 transition-all"
                                        >
                                            Limpar Lista
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Filtros locais */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
                            <div className="relative md:col-span-2">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" value={vendasSearch} onChange={e => setVendasSearch(e.target.value)} placeholder="Nº pedido, cliente, loja, SKU..." className="w-full pl-9 p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-yellow-400" />
                            </div>
                            <select value={vendasCanalFilter} onChange={e => setVendasCanalFilter(e.target.value as any)} className="p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-yellow-400">
                                <option value="TODOS">Todos os canais</option>
                                <option value="ML">🟡 Mercado Livre</option>
                                <option value="SHOPEE">🟠 Shopee</option>
                                <option value="SITE">🔵 Site / Outros</option>
                            </select>
                        </div>
                    </div>

                    {filteredVendasOrders.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-16 text-center text-slate-400">
                            {isLoadingVendas ? (
                                <>
                                    <Loader2 size={48} className="mx-auto mb-4 opacity-40 animate-spin text-yellow-500" />
                                    <p className="font-bold text-sm text-yellow-700">Carregando pedidos em aberto...</p>
                                    <p className="text-xs mt-1">Buscando automaticamente do Bling</p>
                                </>
                            ) : (
                                <>
                                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-bold text-sm">
                                        {vendasDirectOrders.length === 0
                                            ? 'Nenhum pedido carregado ainda.'
                                            : 'Nenhum pedido corresponde ao filtro.'}
                                    </p>
                                    <p className="text-xs mt-1">
                                        {vendasDirectOrders.length === 0
                                            ? <>Escolha o período e clique em <strong className="text-yellow-600">Buscar Pedidos Em Aberto</strong> acima.</>
                                            : 'Tente limpar os filtros de canal ou pesquisa.'}
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-900 text-white">
                                        <tr>
                                            <th className="p-3 text-left text-[9px] font-black uppercase tracking-widest w-10">
                                                <button onClick={toggleSelectAllVendas} className="text-white hover:text-yellow-300 transition-colors">
                                                    {selectedVendasIds.size === filteredVendasOrders.length && filteredVendasOrders.length > 0
                                                        ? <CheckSquare size={16} />
                                                        : <Square size={16} />}
                                                </button>
                                            </th>
                                            <th className="p-3 w-6"></th>
                                            {['Canal', 'Nº Pedido', 'Nº Bling', 'Cliente', 'Data', 'Itens', 'Rastreio', 'Total', 'Status', 'ERP', 'NF-e', 'ZPL'].map(h =>
                                                <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredVendasOrders.map(order => {
                                            const key = order.blingId || order.orderId;
                                            const isSelected = selectedVendasIds.has(key);
                                            const isExpanded = expandedVendasIds.has(key);
                                            const toggleExpand = () => setExpandedVendasIds(prev => {
                                                const next = new Set(prev);
                                                isExpanded ? next.delete(key) : next.add(key);
                                                return next;
                                            });
                                            const canalColors: Record<string, string> = {
                                                ML: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                                SHOPEE: 'bg-orange-100 text-orange-700 border-orange-200',
                                                SITE: 'bg-blue-100 text-blue-700 border-blue-200',
                                            };
                                            const canalLabels: Record<string, string> = { ML: 'Mercado Livre', SHOPEE: 'Shopee', SITE: 'Site' };
                                            const canalStyle = canalColors[order.canal] || 'bg-slate-100 text-slate-600 border-slate-200';
                                            const vendasInv = vendasInvoiceMap.get(key);
                                            const nfeEmitida = !!(vendasInv && (vendasInv.situacao?.toLowerCase().includes('emitida') || vendasInv.situacao?.toLowerCase().includes('autoriz')));
                                            return (
                                                <React.Fragment key={key}>
                                                    <tr className={`transition-colors ${isSelected ? 'bg-yellow-50' : isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => toggleSelectVenda(key)} className="text-slate-400 hover:text-yellow-600 transition-colors">
                                                                {isSelected ? <CheckSquare size={16} className="text-yellow-500" /> : <Square size={16} />}
                                                            </button>
                                                        </td>
                                                        <td className="p-3 text-center cursor-pointer" onClick={toggleExpand}>
                                                            {(order.itens?.length || 0) > 0
                                                                ? (isExpanded ? <ChevronDown size={14} className="text-blue-500" /> : <ChevronRight size={14} className="text-slate-400" />)
                                                                : <span className="w-3 inline-block" />}
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`text-[9px] font-black px-2 py-1 rounded-full border uppercase tracking-widest ${canalStyle}`}>
                                                                {canalLabels[order.canal] || order.canal}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 font-black text-slate-800 whitespace-nowrap">{order.orderId || '-'}</td>
                                                        <td className="p-3 font-mono text-xs text-slate-400">{order.blingId || '-'}</td>
                                                        <td className="p-3 font-bold text-slate-600 max-w-[160px] truncate">{order.customer_name || 'Não informado'}</td>
                                                        <td className="p-3 text-slate-500 whitespace-nowrap text-xs">{order.data || '-'}</td>
                                                        <td className="p-3 text-center">
                                                            <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-1 rounded-full">{order.itens?.length || order.itensCount || 0}</span>
                                                        </td>
                                                        <td className="p-3 text-xs">
                                                            {order.rastreamento
                                                                ? <span className="font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded text-[9px]">{order.rastreamento}</span>
                                                                : <span className="text-slate-300 text-[9px]">—</span>}
                                                        </td>
                                                        <td className="p-3 font-black text-emerald-600 whitespace-nowrap">{Number(order.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                        <td className="p-3"><span className="text-[9px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase">{order.status || '-'}</span></td>
                                                        {/* ERP column */}
                                                        <td className="p-3">
                                                            {erpImportedBlingIds.has(String(order.blingId || '')) || erpImportedBlingIds.has(String(order.orderId || '')) ? (
                                                                <span className="text-[9px] font-black px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">✅ Importado</span>
                                                            ) : (
                                                                <span className="text-[9px] font-black px-2 py-1 rounded-full bg-slate-100 text-slate-400 whitespace-nowrap">Não importado</span>
                                                            )}
                                                        </td>
                                                        {/* NFe column */}
                                                        <td className="p-3">
                                                            {vendasInv ? (
                                                                <span className={`text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap ${nfeEmitida ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                                    }`}>
                                                                    {nfeEmitida ? '✅ Emitida' : vendasInv.situacao || 'Gerada'}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={e => { e.stopPropagation(); setNfeModalOrder(order); setShowGerarNFeModal(true); }}
                                                                    disabled={!!gerandoNFeId}
                                                                    title="Gerar NF-e — escolha entre Bling ou ERP"
                                                                    className="flex items-center gap-1 text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg hover:bg-emerald-100 border border-emerald-100 disabled:opacity-50 whitespace-nowrap transition-all"
                                                                >
                                                                    {gerandoNFeId === (order.orderId || order.blingId) ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />} NF-e
                                                                </button>
                                                            )}
                                                        </td>
                                                        {/* ZPL column */}
                                                        <td className="p-3">
                                                            {canGerarEtiquetas && nfeEmitida && (
                                                                <button
                                                                    onClick={async () => {
                                                                        setGeneratingZplId(key);
                                                                        try {
                                                                            const token = await getValidToken();
                                                                            if (!token) throw new Error('Token inválido');
                                                                            const zpl = await fetchEtiquetaZplForPedido(token, order.blingId || order.orderId);
                                                                            if (zpl) setZplModeModal({ zpl, loteId: `ZPL-${order.blingId || order.orderId}`, descricao: order.customer_name });
                                                                        } catch (e: any) {
                                                                            addToast(`Erro ZPL: ${e.message}`, 'error');
                                                                        } finally {
                                                                            setGeneratingZplId(null);
                                                                        }
                                                                    }}
                                                                    disabled={generatingZplId === key}
                                                                    className="flex items-center gap-1 text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-100 border border-blue-100 disabled:opacity-50 whitespace-nowrap transition-all"
                                                                >
                                                                    {generatingZplId === key ? <Loader2 size={10} className="animate-spin" /> : <Printer size={10} />} ZPL
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-yellow-50/30">
                                                            <td colSpan={14} className="px-6 py-4">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                                                    {/* Dados do cliente */}
                                                                    <div className="bg-white border border-yellow-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1"><User size={10} /> Cliente</p>
                                                                        <p className="text-xs font-bold text-slate-700">{order.customer_name}</p>
                                                                        {order.customer_cpf_cnpj && <p className="text-[9px] text-slate-500 mt-0.5">Doc: {order.customer_cpf_cnpj}</p>}
                                                                        {order.customer_email && <p className="text-[9px] text-slate-500">{order.customer_email}</p>}
                                                                        {order.customer_tel && <p className="text-[9px] text-slate-500">{order.customer_tel}</p>}
                                                                        {order.loja && <p className="text-[9px] font-black text-yellow-700 mt-1">🏪 {order.loja}</p>}
                                                                    </div>
                                                                    {/* Endereço de entrega */}
                                                                    <div className="bg-white border border-yellow-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1"><MapPin size={10} /> Entrega</p>
                                                                        {order.enderecoEntrega ? (
                                                                            <>
                                                                                <p className="text-xs font-bold text-slate-700">{order.enderecoEntrega.nome}</p>
                                                                                <p className="text-[9px] text-slate-600">{order.enderecoEntrega.logradouro}{order.enderecoEntrega.numero ? `, ${order.enderecoEntrega.numero}` : ''}{order.enderecoEntrega.complemento ? ` - ${order.enderecoEntrega.complemento}` : ''}</p>
                                                                                <p className="text-[9px] text-slate-600">{order.enderecoEntrega.bairro} — {order.enderecoEntrega.cidade}/{order.enderecoEntrega.uf}</p>
                                                                                <p className="text-[9px] font-mono text-slate-500">CEP: {order.enderecoEntrega.cep}</p>
                                                                            </>
                                                                        ) : <p className="text-[9px] text-slate-300">Não informado</p>}
                                                                        {order.rastreamento && <p className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded mt-1 inline-block">📦 {order.rastreamento}</p>}
                                                                        {order.transportador && <p className="text-[9px] text-slate-500 mt-0.5">{order.transportador}</p>}
                                                                    </div>
                                                                    {/* Pagamento + valores */}
                                                                    <div className="bg-white border border-yellow-100 rounded-xl p-3">
                                                                        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1"><CreditCard size={10} /> Pagamento</p>
                                                                        {order.pagamentos && order.pagamentos.length > 0 ? order.pagamentos.map((p: any, pi: number) => (
                                                                            <div key={pi} className="flex justify-between text-[9px] text-slate-600">
                                                                                <span>{p.forma}{p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}</span>
                                                                                <span className="font-black text-emerald-700">{Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                                            </div>
                                                                        )) : <p className="text-[9px] text-slate-300">Não informado</p>}
                                                                        {order.frete > 0 && <div className="flex justify-between text-[9px] text-slate-500 mt-1 border-t border-slate-100 pt-1"><span>Frete</span><span>{Number(order.frete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>}
                                                                        {order.desconto > 0 && <div className="flex justify-between text-[9px] text-red-500 mt-0.5"><span>Desconto</span><span>-{Number(order.desconto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>}
                                                                        {order.observacoes && <p className="text-[9px] text-slate-500 mt-1 border-t border-slate-100 pt-1 italic">{order.observacoes}</p>}
                                                                    </div>
                                                                </div>
                                                                {/* Itens */}
                                                                {order.itens && order.itens.length > 0 ? (
                                                                    <>
                                                                        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1"><Tag size={10} /> Itens do Pedido ({order.itens.length})</p>
                                                                        <table className="w-full text-xs">
                                                                            <thead>
                                                                                <tr className="text-[9px] font-black text-slate-400 uppercase">
                                                                                    {['SKU', 'Descrição', 'Produto ERP Vinculado', 'Un', 'Qtd', 'Vlr Unit.', 'Subtotal'].map(h =>
                                                                                        <th key={h} className="text-left pb-1 pr-4">{h}</th>
                                                                                    )}
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-yellow-100">
                                                                                {order.itens.map((item: any, idx: number) => {
                                                                                    const skuKey = (item.sku || '').toUpperCase();
                                                                                    const linkedName = skuKey ? erpSkuNameMap.get(skuKey) : undefined;
                                                                                    return (
                                                                                        <tr key={idx} className="hover:bg-yellow-100/40">
                                                                                            <td className="py-1.5 pr-4 font-mono font-bold text-yellow-800">{item.sku || '-'}</td>
                                                                                            <td className="py-1.5 pr-4 text-slate-700 max-w-[200px]">{item.descricao || '-'}</td>
                                                                                            <td className="py-1.5 pr-4 max-w-[200px]">
                                                                                                {linkedName
                                                                                                    ? <span className="flex items-center gap-1 text-green-700 font-bold text-[10px]"><LinkIcon size={9} />{linkedName}</span>
                                                                                                    : <span className="text-[9px] text-slate-300 italic">—</span>
                                                                                                }
                                                                                            </td>
                                                                                            <td className="py-1.5 pr-4 text-slate-400 text-[9px]">{item.unidade || 'UN'}</td>
                                                                                            <td className="py-1.5 pr-4 font-black text-center">{item.quantidade ?? '-'}</td>
                                                                                            <td className="py-1.5 pr-4 font-bold text-emerald-700">{Number(item.valorUnitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                                                            <td className="py-1.5 pr-4 font-black text-emerald-800">{Number(item.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </>
                                                                ) : (
                                                                    <p className="text-[9px] text-slate-400 text-center py-2">Nenhum item encontrado. Verifique se o token tem permissão.</p>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content: NF-e — Notas Fiscais de Saída (Vendas > Notas Fiscais) */}
            {activeTab === 'nfe' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-xl">

                        {/* Cabeçalho */}
                        <div className="flex justify-between items-start mb-6 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                    <FileText className="text-emerald-600" /> Notas Fiscais de Saída
                                    {nfeSaida.length > 0 && <span className="text-sm text-slate-400 font-bold normal-case tracking-normal ml-1">({filteredNfeSaida.length}/{nfeSaida.length})</span>}
                                </h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">Vendas {'>'} Notas Fiscais — Emita, selecione, gere etiquetas + DANFE, baixe XMLs.</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {nfeSaida.length > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                        Dados salvos do dia {new Date().toLocaleDateString('pt-BR')}
                                    </span>
                                )}
                                {/* Botões baixar XMLs e DANFEs do período */}
                                {filteredNfeSaida.length > 0 && (
                                    <>
                                        <button onClick={handleBaixarXmlLote} disabled={isDownloadingXml || isDownloadingDanfe} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 disabled:opacity-50 transition-all">
                                            {isDownloadingXml ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                                            {isDownloadingXml ? `XML... ${xmlDownloadProgress?.current || 0}/${xmlDownloadProgress?.total || 0}` : 'Baixar Todos XML'}
                                        </button>
                                        <button onClick={handleBaixarDanfeLote} disabled={isDownloadingXml || isDownloadingDanfe} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-100 hover:bg-green-100 disabled:opacity-50 transition-all">
                                            {isDownloadingDanfe ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                                            {isDownloadingDanfe ? `DANFE... ${danfeDownloadProgress?.current || 0}/${danfeDownloadProgress?.total || 0}` : 'Baixar Todos DANFE'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Contadores rápidos */}
                        {nfeSaida.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-center">
                                    <p className="text-2xl font-black text-slate-800">{nfeCounts.todas}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                                </div>
                                <div className="bg-yellow-50 rounded-2xl p-3 border border-yellow-100 text-center">
                                    <p className="text-2xl font-black text-yellow-700">{nfeCounts.pendentes}</p>
                                    <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest">Pendentes</p>
                                </div>
                                <div className="bg-blue-50 rounded-2xl p-3 border border-blue-100 text-center">
                                    <p className="text-2xl font-black text-blue-700">{nfeCounts.autorizadas_sem_danfe}</p>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Autoriz. s/ DANFE</p>
                                </div>
                                <div className="bg-green-50 rounded-2xl p-3 border border-green-100 text-center">
                                    <p className="text-2xl font-black text-green-700">{nfeCounts.emitida_danfe}</p>
                                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Emitida DANFE</p>
                                </div>
                            </div>
                        )}

                        {/* Filtros de data + buscar + loja + perfil */}
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Data Início</label>
                                    <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Data Fim</label>
                                    <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-emerald-500" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Loja / Canal</label>
                                    <select value={nfeLojaFilter} onChange={e => setNfeLojaFilter(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-emerald-500">
                                        <option value="TODOS">Todas as Lojas</option>
                                        {blingCanais.map(c => <option key={c.id} value={c.descricao}>{c.descricao}</option>)}
                                        {nfeLojas.filter(l => !blingCanais.some(c => c.descricao === l)).map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Perfil (CNPJ)</label>
                                    <select value={nfeTipoFilter} onChange={e => setNfeTipoFilter(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-emerald-500">
                                        <option value="TODOS">Todos os Perfis</option>
                                        {nfeCnpjs.map(([doc, nome]) => <option key={doc} value={doc}>{nome} ({doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')})</option>)}
                                    </select>
                                </div>
                                <div className="relative">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Buscar</label>
                                    <div className="relative">
                                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input type="text" value={nfeSaidaSearch} onChange={e => setNfeSaidaSearch(e.target.value)} placeholder="Nº, cliente, chave..." className="w-full pl-10 p-2.5 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-emerald-500" />
                                    </div>
                                </div>
                                <button onClick={handleFetchNfeSaida} disabled={isLoadingNfeSaida} className="flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100 active:scale-95">
                                    {isLoadingNfeSaida ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />} {isLoadingNfeSaida ? 'Buscando...' : 'Buscar NF-e'}
                                </button>
                            </div>
                        </div>

                        {/* Filtro por situação (abas) */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {([
                                { key: 'todas', label: 'Todas', count: nfeCounts.todas, color: 'slate' },
                                { key: 'pendentes', label: 'Pendentes', count: nfeCounts.pendentes, color: 'yellow' },
                                { key: 'autorizadas_sem_danfe', label: 'Autorizada sem DANFE', count: nfeCounts.autorizadas_sem_danfe, color: 'blue' },
                                { key: 'emitida_danfe', label: 'Emitida DANFE', count: nfeCounts.emitida_danfe, color: 'green' },
                            ] as const).map(tab => {
                                const isActive = nfeSaidaFiltro === tab.key;
                                const colors: Record<string, string> = {
                                    slate: isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                    yellow: isActive ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
                                    blue: isActive ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100',
                                    green: isActive ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100',
                                };
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => { setNfeSaidaFiltro(tab.key); setSelectedNfeSaidaIds(new Set()); }}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${colors[tab.color]}`}
                                    >
                                        {tab.label}
                                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-white/20' : 'bg-black/5'}`}>{tab.count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Filtro por canal (ML / Shopee / Site) */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            {([
                                { key: 'TODOS', label: 'Todos os Canais' },
                                { key: 'ML', label: '🟡 Mercado Livre' },
                                { key: 'SHOPEE', label: '🟠 Shopee' },
                                { key: 'SITE', label: '🔵 Site / Outros' },
                            ] as const).map(c => (
                                <button
                                    key={c.key}
                                    onClick={() => setNfeSaidaCanalFilter(c.key)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${nfeSaidaCanalFilter === c.key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        {/* Barra de ações em lote */}
                        {selectedNfeSaidaIds.size > 0 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 mb-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                                        {selectedNfeSaidaIds.size} selecionada(s)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button onClick={() => setSelectedNfeSaidaIds(new Set())} className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-all">
                                        Limpar
                                    </button>
                                    {/* Emitir pendentes selecionadas */}
                                    {nfeSaida.some(n => selectedNfeSaidaIds.has(n.id) && n.situacao === 1) && (
                                        <button onClick={handleBatchEmitirNfe} disabled={isBatchEmitindo} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-yellow-500 text-white hover:bg-yellow-600 disabled:opacity-50 transition-all shadow shadow-yellow-200">
                                            {isBatchEmitindo ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                            {isBatchEmitindo ? 'Emitindo...' : 'Emitir Selecionadas'}
                                        </button>
                                    )}
                                    {/* Gerar Etiquetas + DANFE Simplificada em lote */}
                                    {nfeSaida.some(n => selectedNfeSaidaIds.has(n.id) && (n.situacao === 5 || n.situacao === 6)) && canGerarEtiquetas && (
                                        <button onClick={handleBatchEtiquetaDanfe} disabled={isBatchEmitindo} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-all shadow shadow-indigo-200">
                                            {isBatchEmitindo ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                                            Etiqueta + DANFE Lote
                                        </button>
                                    )}
                                    {/* Download XMLs e DANFEs selecionados */}
                                    <button onClick={handleBaixarXmlSelecionados} disabled={isDownloadingXml || isDownloadingDanfe} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow shadow-blue-200">
                                        {isDownloadingXml ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        {isDownloadingXml ? `XML... ${xmlDownloadProgress?.current || 0}/${xmlDownloadProgress?.total || 0}` : 'Baixar XMLs'}
                                    </button>
                                    <button onClick={handleBaixarDanfeSelecionados} disabled={isDownloadingXml || isDownloadingDanfe} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-all shadow shadow-green-200">
                                        {isDownloadingDanfe ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                                        {isDownloadingDanfe ? `DANFE... ${danfeDownloadProgress?.current || 0}/${danfeDownloadProgress?.total || 0}` : 'Baixar DANFEs'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Progresso batch emissão / download */}
                        {isBatchEmitindo && (
                            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
                                <span className="text-xs font-black text-yellow-700 flex items-center gap-2">
                                    <Loader2 size={12} className="animate-spin" /> Enviando NF-e para SEFAZ... Aguarde.
                                </span>
                            </div>
                        )}
                        {isDownloadingXml && xmlDownloadProgress && (
                            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-blue-700 flex items-center gap-2">
                                        <Loader2 size={12} className="animate-spin" /> Baixando XMLs...
                                    </span>
                                    <span className="text-xs font-bold text-blue-600">{xmlDownloadProgress.current}/{xmlDownloadProgress.total}</span>
                                </div>
                                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.round((xmlDownloadProgress.current / xmlDownloadProgress.total) * 100)}%` }} />
                                </div>
                            </div>
                        )}
                        {isDownloadingDanfe && danfeDownloadProgress && (
                            <div className="mb-4 bg-green-50 border border-green-200 rounded-2xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-black text-green-700 flex items-center gap-2">
                                        <Loader2 size={12} className="animate-spin" /> Baixando DANFEs...
                                    </span>
                                    <span className="text-xs font-bold text-green-600">{danfeDownloadProgress.current}/{danfeDownloadProgress.total}</span>
                                </div>
                                <div className="w-full bg-green-200 rounded-full h-2 overflow-hidden">
                                    <div className="bg-green-600 h-2 rounded-full transition-all duration-300" style={{ width: `${Math.round((danfeDownloadProgress.current / danfeDownloadProgress.total) * 100)}%` }} />
                                </div>
                            </div>
                        )}

                        {/* Tabela de NF-e */}
                        {filteredNfeSaida.length > 0 ? (
                            <div className="overflow-hidden border border-slate-100 rounded-2xl">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-900 text-white sticky top-0">
                                            <tr>
                                                <th className="p-3 w-10">
                                                    <button
                                                        onClick={() => {
                                                            const allIds = new Set(filteredNfeSaida.map(n => n.id));
                                                            const allSel = filteredNfeSaida.every(n => selectedNfeSaidaIds.has(n.id));
                                                            setSelectedNfeSaidaIds(allSel ? new Set() : allIds);
                                                        }}
                                                        className="flex items-center justify-center w-5 h-5 rounded border-2 border-white/40 hover:border-white transition-colors"
                                                    >
                                                        {filteredNfeSaida.length > 0 && filteredNfeSaida.every(n => selectedNfeSaidaIds.has(n.id))
                                                            ? <CheckSquare size={14} className="text-emerald-300" />
                                                            : <Square size={14} className="text-white/50" />}
                                                    </button>
                                                </th>
                                                {['Número', 'Nome', 'CNPJ/CPF', 'Data Emissão', 'Pedido (Loja)', 'Pedido Bling', 'Loja', 'Situação', 'Valor (R$)', 'Ações'].map(h =>
                                                    <th key={h} className="p-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredNfeSaida.map(nfe => {
                                                const isSelected = selectedNfeSaidaIds.has(nfe.id);
                                                const isPendente = nfe.situacao === 1;
                                                const isAutorizada = nfe.situacao === 5;
                                                const isEmitida = nfe.situacao === 6;
                                                const isAutorizadaSemDanfe = isAutorizada && !nfe.linkDanfe;
                                                const isEmitidaDanfe = isEmitida || (isAutorizada && !!nfe.linkDanfe);
                                                const isLoading = emitindoNfeId === nfe.id;
                                                const isItemsExpanded = expandedNfeItemsId === nfe.id;
                                                const nfeItems = nfeItemsCache[nfe.id] || [];

                                                const formatDate = (d?: string) => {
                                                    if (!d) return '-';
                                                    const parts = d.split('T')[0].split('-');
                                                    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                                                };

                                                const formatDoc = (doc?: string) => {
                                                    if (!doc) return '-';
                                                    if (doc.length === 14) return doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                                                    if (doc.length === 11) return doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
                                                    return doc;
                                                };

                                                return (
                                                    <React.Fragment key={nfe.id}>
                                                        <tr className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-emerald-50/60' : ''} ${isPendente ? 'bg-yellow-50/30' : ''}`}>
                                                            <td className="p-3 w-10">
                                                                <button
                                                                    onClick={() => setSelectedNfeSaidaIds(prev => {
                                                                        const next = new Set(prev);
                                                                        next.has(nfe.id) ? next.delete(nfe.id) : next.add(nfe.id);
                                                                        return next;
                                                                    })}
                                                                    className="flex items-center justify-center w-5 h-5 rounded border-2 transition-colors border-slate-300 hover:border-emerald-500"
                                                                >
                                                                    {isSelected ? <CheckSquare size={14} className="text-emerald-600" /> : <Square size={14} className="text-slate-300" />}
                                                                </button>
                                                            </td>
                                                            <td className="p-3 font-black text-slate-700">{nfe.numero || nfe.id}</td>
                                                            <td className="p-3 font-bold text-slate-600 max-w-[160px] truncate" title={nfe.contato?.nome}>{nfe.contato?.nome || '-'}</td>
                                                            <td className="p-3 font-mono text-[10px] text-slate-400">{formatDoc(nfe.contato?.numeroDocumento)}</td>
                                                            <td className="p-3 font-mono text-xs text-slate-400">{formatDate(nfe.dataEmissao)}</td>
                                                            <td className="p-3 font-mono text-xs text-slate-600 font-bold">
                                                                {nfe.numeroLoja || '-'}
                                                            </td>
                                                            <td className="p-3 font-mono text-xs text-blue-600 font-black">
                                                                {nfe.numeroVenda || '-'}
                                                            </td>
                                                            <td className="p-3">
                                                                {(() => {
                                                                    const c = getNfeCanal(nfe);
                                                                    const badge = c === 'ML' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : c === 'SHOPEE' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200';
                                                                    const label = c === 'ML' ? '🟡 Mercado Livre' : c === 'SHOPEE' ? '🟠 Shopee' : '🔵 Site';
                                                                    return (
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border whitespace-nowrap ${badge}`}>{label}</span>
                                                                            {nfe.loja && <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={nfe.loja}>{nfe.loja}</span>}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                            <td className="p-3">
                                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${isPendente ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                                    isEmitidaDanfe ? 'bg-green-100 text-green-700 border border-green-200' :
                                                                        isAutorizadaSemDanfe ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                                            nfe.situacao === 2 ? 'bg-red-100 text-red-700 border border-red-200' :
                                                                                nfe.situacao === 3 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                                                                    nfe.situacao === 4 ? 'bg-red-100 text-red-700 border border-red-200' :
                                                                                        'bg-gray-100 text-gray-500 border border-gray-200'
                                                                    }`}>
                                                                    {isPendente ? 'Pendente' :
                                                                        isEmitidaDanfe ? 'Emitida DANFE' :
                                                                            isAutorizadaSemDanfe ? 'Autoriz. s/ DANFE' :
                                                                                nfe.situacaoDescr}
                                                                </span>
                                                            </td>
                                                            <td className="p-3 font-black text-emerald-600 whitespace-nowrap">
                                                                {nfe.valorTotal != null ? nfe.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                                                            </td>
                                                            <td className="p-3">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {/* Pendente — botão Emitir */}
                                                                    {isPendente && (
                                                                        <button onClick={() => handleEmitirNfe(nfe)} disabled={isLoading || isBatchEmitindo} title="Enviar NF-e para SEFAZ"
                                                                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-yellow-100 text-yellow-800 px-2.5 py-1.5 rounded-lg hover:bg-yellow-200 border border-yellow-200 disabled:opacity-50 transition-all">
                                                                            {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Emitir
                                                                        </button>
                                                                    )}
                                                                    {/* DANFE */}
                                                                    {(isEmitidaDanfe || isAutorizadaSemDanfe) && (
                                                                        <button onClick={() => handleAbrirDanfe(nfe)} title="Abrir DANFE"
                                                                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-orange-50 text-orange-600 px-2.5 py-1.5 rounded-lg hover:bg-orange-100 border border-orange-100 transition-all">
                                                                            <Eye size={11} /> DANFE
                                                                        </button>
                                                                    )}
                                                                    {/* Etiqueta + DANFE Simplificada */}
                                                                    {(isEmitidaDanfe || isAutorizadaSemDanfe) && canGerarEtiquetas && (
                                                                        <button onClick={() => handleGerarEtiquetaNfe(nfe)} disabled={isLoading} title="Gerar Etiqueta de Envio + DANFE Simplificada"
                                                                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100 border border-indigo-100 disabled:opacity-50 transition-all">
                                                                            {isLoading ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />} Etiq+DANFE
                                                                        </button>
                                                                    )}
                                                                    {/* XML */}
                                                                    {(isEmitidaDanfe || isAutorizadaSemDanfe) && (
                                                                        <button onClick={() => handleDownloadXml(nfe)} title="Baixar XML"
                                                                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 border border-blue-100 transition-all">
                                                                            <Download size={11} /> XML
                                                                        </button>
                                                                    )}
                                                                    {/* Chave */}
                                                                    {(isEmitidaDanfe || isAutorizadaSemDanfe) && (
                                                                        <button onClick={() => handleCopiarChave(nfe)} title="Copiar chave de acesso"
                                                                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-slate-50 text-slate-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-100 transition-all">
                                                                            <Copy size={11} /> Chave
                                                                        </button>
                                                                    )}
                                                                    {/* Vincular Itens */}
                                                                    <button onClick={() => handleExpandNfeItems(nfe)} disabled={isLoadingNfeItems && expandedNfeItemsId === nfe.id} title="Ver / vincular itens da NF-e"
                                                                        className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border transition-all ${isItemsExpanded ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-purple-50 text-purple-600 border-purple-100 hover:bg-purple-100'}`}>
                                                                        {isLoadingNfeItems && expandedNfeItemsId === nfe.id ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
                                                                        {isItemsExpanded ? 'Fechar' : 'Itens'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {/* Linha expandida — itens da NF-e */}
                                                        {isItemsExpanded && (
                                                            <tr className="bg-purple-50/40">
                                                                <td colSpan={10} className="p-4">
                                                                    <div className="rounded-xl border border-purple-100 bg-white p-4">
                                                                        <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                            <Package size={12} /> Itens da NF-e {nfe.numero || nfe.id}
                                                                        </p>
                                                                        {isLoadingNfeItems ? (
                                                                            <div className="text-center py-4">
                                                                                <Loader2 size={20} className="mx-auto mb-2 animate-spin text-purple-400" />
                                                                                <p className="text-xs text-purple-400">Carregando itens...</p>
                                                                            </div>
                                                                        ) : nfeItems.length > 0 ? (
                                                                            <table className="min-w-full text-xs">
                                                                                <thead className="bg-purple-100/50">
                                                                                    <tr>
                                                                                        {['Código', 'Descrição', 'Produto ERP Vinculado', 'Unidade', 'Qtd', 'Valor Unit.', 'Subtotal'].map(h =>
                                                                                            <th key={h} className="p-2 text-left text-[9px] font-black uppercase tracking-widest text-purple-600">{h}</th>
                                                                                        )}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-purple-50">
                                                                                    {nfeItems.map((item: any, idx: number) => {
                                                                                        const sku = (item.codigo || item.produto?.codigo || '').toUpperCase();
                                                                                        const linkedName = sku ? erpSkuNameMap.get(sku) : undefined;
                                                                                        return (
                                                                                            <tr key={idx} className="hover:bg-purple-50/40 transition-colors">
                                                                                                <td className="p-2 font-mono text-slate-500">{item.codigo || item.produto?.codigo || '-'}</td>
                                                                                                <td className="p-2 font-bold text-slate-700">{item.descricao || item.produto?.descricao || '-'}</td>
                                                                                                <td className="p-2">
                                                                                                    {linkedName
                                                                                                        ? <span className="flex items-center gap-1 text-green-700 font-bold"><LinkIcon size={10} />{linkedName}</span>
                                                                                                        : <span className="text-xs text-slate-300 italic">Não vinculado</span>
                                                                                                    }
                                                                                                </td>
                                                                                                <td className="p-2 text-slate-400">{item.unidade || item.produto?.unidade || 'UN'}</td>
                                                                                                <td className="p-2 font-black text-slate-700">{item.quantidade ?? '-'}</td>
                                                                                                <td className="p-2 text-slate-500">{item.valor != null ? Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                                                                <td className="p-2 font-black text-emerald-600">{item.quantidade && item.valor ? (item.quantidade * item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}</td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        ) : (
                                                                            <p className="text-xs text-purple-400 text-center py-3">Nenhum item encontrado nesta NF-e.</p>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 text-slate-300">
                                {isLoadingNfeSaida ? (
                                    <>
                                        <Loader2 size={48} className="mx-auto mb-4 opacity-40 animate-spin text-emerald-500" />
                                        <p className="font-bold text-sm text-emerald-700">Buscando notas fiscais do Bling...</p>
                                        <p className="text-xs mt-1">Consultando todas as páginas do período selecionado.</p>
                                    </>
                                ) : nfeSaida.length > 0 ? (
                                    <>
                                        <Filter size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-bold text-sm">Nenhuma nota corresponde ao filtro atual.</p>
                                        <p className="text-xs mt-1">Tente alterar o filtro de situação, loja ou busca.</p>
                                    </>
                                ) : (
                                    <>
                                        <FileText size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="font-bold text-sm">Nenhuma nota fiscal carregada.</p>
                                        <p className="text-xs mt-1">Selecione o período e clique em <strong className="text-emerald-600">Buscar NF-e</strong> para carregar as notas fiscais de saída do Bling.</p>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Resumo rodapé */}
                        {filteredNfeSaida.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {filteredNfeSaida.length} nota(s) — Total: {filteredNfeSaida.reduce((sum, n) => sum + (n.valorTotal || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    Período: {filters.startDate ? new Date(filters.startDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} até {filters.endDate ? new Date(filters.endDate + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Content: Catálogo */}
            {activeTab === 'catalogo' && (
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter flex items-center gap-2"><Package className="text-purple-500" /> Catálogo de Produtos</h2>
                    <div className="flex gap-4 items-center mb-6">
                        <div className="relative flex-grow"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Filtrar por nome ou SKU..." className="w-full pl-12 p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 font-bold text-sm outline-none focus:border-blue-500" /></div>
                        <button onClick={handleFetchProducts} disabled={isSyncing} className="flex-shrink-0 flex items-center justify-center gap-3 px-8 py-4 bg-purple-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-xl shadow-purple-100 active:scale-95">{isSyncing ? <Loader2 className="animate-spin" /> : <Zap />} {isSyncing ? 'Buscando...' : 'Atualizar Lista'}</button>
                    </div>
                    {products.length > 0 && (
                        <div className="overflow-hidden border border-slate-100 rounded-2xl">
                            <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-slate-900 text-white sticky top-0"><tr>{['SKU', 'Descrição', 'Estoque', 'Preço', 'Vínculo ERP'].map(h => <th key={h} className="p-4 text-left text-[10px] font-black uppercase tracking-widest">{h}</th>)}</tr></thead>
                                    <tbody className="divide-y divide-slate-100">{filteredProducts.map(p => {
                                        const isLinked = erpSkuLinkedCodes.has((p.codigo || '').toUpperCase());
                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-black text-slate-700 font-mono">{p.codigo}</td>
                                                <td className="p-4 font-bold text-slate-600">{p.descricao}</td>
                                                <td className="p-4 font-black text-center text-blue-600">{p.estoqueAtual}</td>
                                                <td className="p-4 font-black text-emerald-600">{p.preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                                <td className="p-4">
                                                    {isLinked ? (
                                                        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-200">
                                                            <LinkIcon size={10} /> Vinculado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => { setCatalogLinkModal({ blingCode: p.codigo, blingName: p.descricao }); setCatalogLinkTarget(''); }}
                                                            className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-200 hover:bg-indigo-100 transition-all"
                                                        >
                                                            <LinkIcon size={10} /> Vincular ERP
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content: Etiquetas ZPL */}
            {activeTab === 'etiquetas' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    {/* Header */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
                        <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-2">
                                    <Printer className="text-blue-600" /> Etiquetas ZPL
                                    {zplLotes.length > 0 && <span className="text-sm text-slate-400 font-bold normal-case tracking-normal ml-1">({zplLotes.length} lote(s))</span>}
                                </h2>
                                <p className="text-[11px] text-slate-400 mt-0.5">Lotes de etiquetas ZPL gerados nesta sessão. Imprima DANFE simplificado + etiqueta de transporte.</p>
                            </div>
                            <div className="flex gap-1.5">
                                {(['todos', 'falhas'] as const).map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setZplLotesFilter(f)}
                                        className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${zplLotesFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        {f === 'todos' ? 'Todos' : 'Com Falhas'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Painel: Puxar etiquetas do Bling */}
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Download size={12} /> Puxar Etiquetas do Bling
                        </p>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div>
                                <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1 block">Origem dos Pedidos</label>
                                <select
                                    value={etiquetaPullSource}
                                    onChange={e => setEtiquetaPullSource(e.target.value as any)}
                                    className="p-2.5 border-2 border-blue-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-blue-500"
                                >
                                    <option value="importacao">Importação (Pedidos de Venda)</option>
                                    <option value="nfe">NF-e (Notas Fiscais)</option>
                                </select>
                            </div>
                            <button
                                onClick={handlePullEtiquetas}
                                disabled={isPullingEtiquetas}
                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
                            >
                                {isPullingEtiquetas ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                Puxar Etiquetas
                            </button>
                            <p className="text-[10px] text-blue-500 self-center">
                                {etiquetaPullSource === 'importacao'
                                    ? `${selectedVendasIds.size > 0 ? selectedVendasIds.size + ' selecionado(s)' : filteredVendasOrders.length + ' pedido(s) disponíveis (máx 50)'}`
                                    : `${filteredEnrichedOrders.length} pedido(s) NF-e disponíveis (máx 50)`
                                }
                            </p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {isBatchZplNotas && batchZplNotasProgress && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-black text-blue-700 flex items-center gap-2">
                                    <Loader2 size={12} className="animate-spin" /> Gerando etiquetas ZPL em lote...
                                </span>
                                <span className="text-xs font-bold text-blue-600">{batchZplNotasProgress.current} / {batchZplNotasProgress.total}</span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                                <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${Math.round((batchZplNotasProgress.current / batchZplNotasProgress.total) * 100)}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Último lote banner */}
                    {lastCompletedLote && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-black text-emerald-700">
                                    Lote {lastCompletedLote.id} — {lastCompletedLote.success} gerada(s){lastCompletedLote.failed.length > 0 ? `, ${lastCompletedLote.failed.length} falha(s)` : ''}
                                </p>
                                <p className="text-[10px] text-emerald-600 mt-0.5">{new Date(lastCompletedLote.timestamp).toLocaleString('pt-BR')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { onLoadZpl(lastCompletedLote.zplContent, true); }}
                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
                                >
                                    <FileText size={12} /> DANFE + Etiqueta
                                </button>
                                <button
                                    onClick={() => { onLoadZpl(lastCompletedLote.zplContent, false); }}
                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                                >
                                    <Printer size={12} /> Apenas Etiqueta
                                </button>
                                <button
                                    onClick={() => { onLoadZpl(lastCompletedLote.zplContent); setCurrentPage('etiquetas'); }}
                                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
                                >
                                    <Printer size={12} /> Ir p/ Etiquetas
                                </button>
                                <button onClick={() => setLastCompletedLote(null)} className="text-emerald-400 hover:text-emerald-600 p-1">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Lista de Lotes */}
                    {zplLotes.length === 0 ? (
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl p-16 text-center text-slate-400">
                            <Printer size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="font-bold text-sm">Nenhuma etiqueta gerada ainda nesta sessão.</p>
                            <p className="text-xs mt-1">Vá para a aba <strong className="text-emerald-600">NF-e</strong> e gere ZPL a partir de notas emitidas, ou use a aba <strong className="text-yellow-600">Importação</strong> para gerar ZPL dos pedidos.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(zplLotesFilter === 'falhas' ? zplLotes.filter(l => l.failed.length > 0) : zplLotes).map(lote => (
                                <div key={lote.id} className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${lote.failed.length > 0 ? 'border-red-200' : 'border-emerald-200'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-black text-slate-700 truncate max-w-[200px]">{lote.id}</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">{new Date(lote.timestamp).toLocaleString('pt-BR', { timeStyle: 'short', dateStyle: 'short' })}</p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs font-black text-slate-700">{lote.total} pedido(s)</p>
                                            <p className="text-[9px] font-bold">
                                                <span className="text-emerald-600">{lote.success} ok</span>
                                                {lote.failed.length > 0 && <span className="text-red-500 ml-1">{lote.failed.length} falha(s)</span>}
                                            </p>
                                        </div>
                                    </div>
                                    {lote.failed.length > 0 && (
                                        <div className="bg-red-50 rounded-xl p-2 space-y-1 max-h-20 overflow-y-auto border border-red-100">
                                            {lote.failed.map(f => (
                                                <p key={f.orderId} className="text-[9px] text-red-700">
                                                    <span className="font-black">{f.orderId}:</span> {f.error.slice(0, 80)}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setZplModeModal({ zpl: lote.zplContent, loteId: lote.id })}
                                            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
                                        >
                                            <Printer size={10} /> Imprimir
                                        </button>
                                        <button
                                            onClick={() => { onLoadZpl(lote.zplContent); setCurrentPage('etiquetas'); }}
                                            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
                                        >
                                            <FileOutput size={10} /> Processar
                                        </button>
                                        <button
                                            onClick={() => copyZplBatch(lote.zplContent, lote.id)}
                                            className="flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                                        >
                                            <Copy size={10} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <BlingConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                currentSettings={integrations?.bling}
                onSave={handleSaveConfig}
            />

            {/* ── Modal: Confirmar salvar NF-e buscadas ───────────────────────── */}
            {showNfeSaveConfirm && pendingNfeSaida && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <Cloud className="text-emerald-600" size={20} /> Salvar NF-e?
                            </h3>
                            <button onClick={() => { setShowNfeSaveConfirm(false); setPendingNfeSaida(null); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">
                            Foram encontradas <span className="font-black text-emerald-700">{pendingNfeSaida.length} nota(s) fiscal(is)</span> no período selecionado.
                        </p>
                        <p className="text-xs text-slate-400 mb-6">
                            Deseja salvar e vincular esses dados para uso offline? Se escolher "Não", as notas serão exibidas apenas nesta sessão.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleConfirmSaveNfeSaida}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-95"
                            >
                                <CheckSquare size={14} /> Sim, Salvar
                            </button>
                            <button
                                onClick={handleDiscardSaveNfeSaida}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                            >
                                <Eye size={14} /> Não, só exibir
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: Vincular produto Bling ao ERP ────────────────────────── */}
            {catalogLinkModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <LinkIcon className="text-indigo-600" size={20} /> Vincular ao ERP
                            </h3>
                            <button onClick={() => { setCatalogLinkModal(null); setCatalogLinkTarget(''); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">SKU Bling: <span className="font-black text-slate-700 font-mono">{catalogLinkModal.blingCode}</span></p>
                        <p className="text-xs text-slate-500 mb-4">Produto: <span className="font-bold text-slate-700">{catalogLinkModal.blingName}</span></p>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Produto ERP de destino</label>
                        <select
                            value={catalogLinkTarget}
                            onChange={e => setCatalogLinkTarget(e.target.value)}
                            className="w-full p-3 border-2 border-slate-200 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-indigo-500 mb-5"
                        >
                            <option value="">— Selecione um produto —</option>
                            {erpStockItems.map(item => (
                                <option key={item.code} value={item.code}>{item.code} — {item.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-3">
                            <button
                                onClick={handleCatalogLink}
                                disabled={!catalogLinkTarget || isLinkingCatalog}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100 active:scale-95"
                            >
                                {isLinkingCatalog ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />} Vincular
                            </button>
                            <button
                                onClick={() => { setCatalogLinkModal(null); setCatalogLinkTarget(''); }}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal ZPL — escolha de modo ─────────────────────────────────── */}
            {zplModeModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setZplModeModal(null)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                🏷️ Processar Etiqueta ZPL
                            </h3>
                            <button onClick={() => setZplModeModal(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                                <X size={16} />
                            </button>
                        </div>
                        {zplModeModal.descricao && (
                            <p className="text-xs text-slate-500 mb-4">Pedido: <span className="font-bold text-slate-700">{zplModeModal.descricao}</span></p>
                        )}
                        <div className="space-y-2 mt-4">
                            <button
                                onClick={() => {
                                    onLoadZpl(zplModeModal.zpl, true);
                                    addPendingZplItem({ id: zplModeModal.loteId, loteId: zplModeModal.loteId, zplContent: zplModeModal.zpl, labelCount: (zplModeModal.zpl.match(/\^XA/gi) || []).length, timestamp: new Date().toISOString(), source: 'individual', descricao: zplModeModal.descricao });
                                    setZplModeModal(null);
                                }}
                                className="w-full flex items-center gap-2 text-sm font-black uppercase bg-blue-50 text-blue-700 px-4 py-3 rounded-xl hover:bg-blue-100 border border-blue-200 transition-all"
                            >
                                <FileText size={14} /> DANFE + Etiqueta
                            </button>
                            <button
                                onClick={() => {
                                    onLoadZpl(zplModeModal.zpl, false);
                                    addPendingZplItem({ id: zplModeModal.loteId, loteId: zplModeModal.loteId, zplContent: zplModeModal.zpl, labelCount: (zplModeModal.zpl.match(/\^XA/gi) || []).length, timestamp: new Date().toISOString(), source: 'individual', descricao: zplModeModal.descricao });
                                    setZplModeModal(null);
                                }}
                                className="w-full flex items-center gap-2 text-sm font-black uppercase bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl hover:bg-emerald-100 border border-emerald-200 transition-all"
                            >
                                <Printer size={14} /> Apenas Etiqueta
                            </button>
                            <button
                                onClick={() => {
                                    copyZplBatch(zplModeModal.zpl, zplModeModal.loteId, 'individual', zplModeModal.descricao);
                                    setZplModeModal(null);
                                }}
                                className="w-full flex items-center gap-2 text-sm font-black uppercase bg-slate-50 text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
                            >
                                📋 Só Copiar ZPL
                            </button>
                        </div>
                        <button onClick={() => setZplModeModal(null)} className="mt-4 w-full text-xs text-slate-400 hover:text-slate-600 font-semibold py-1.5">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal de Geração de NF-e ────────────────────────────────────── */}
            {showGerarNFeModal && nfeModalOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <FileText className="text-blue-600" size={20} /> Gerar NF-e
                            </h3>
                            <button onClick={() => { setShowGerarNFeModal(false); setNfeModalOrder(null); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-2">Pedido: <span className="font-black text-slate-700">{nfeModalOrder.orderId || nfeModalOrder.blingId}</span></p>
                        <p className="text-sm text-slate-500 mb-6">Cliente: <span className="font-bold text-slate-700">{nfeModalOrder.customer_name}</span></p>

                        <div className="space-y-3">
                            {/* Via Bling */}
                            <div className="border-2 border-blue-100 rounded-2xl p-4 hover:border-blue-300 transition-all">
                                <p className="text-xs font-black text-blue-700 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />Via Bling (Recomendado)</p>
                                <p className="text-xs text-slate-500 mb-3">Gera NF-e diretamente do pedido de venda via rota nativa do Bling. Itens, contato, parcelas e frete são preenchidos automaticamente.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setShowGerarNFeModal(false); handleGerarNFeDoPedido(nfeModalOrder.orderId || nfeModalOrder.blingId, nfeModalOrder, false, 'bling'); setNfeModalOrder(null); }}
                                        disabled={!!gerandoNFeId}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase bg-blue-50 text-blue-700 px-3 py-2 rounded-xl hover:bg-blue-100 border border-blue-200 disabled:opacity-50 transition-all"
                                    >
                                        <FileText size={12} /> Criar NF-e
                                    </button>
                                    <button
                                        onClick={() => { setShowGerarNFeModal(false); handleGerarNFeDoPedido(nfeModalOrder.orderId || nfeModalOrder.blingId, nfeModalOrder, true, 'bling'); setNfeModalOrder(null); }}
                                        disabled={!!gerandoNFeId}
                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-black uppercase bg-indigo-50 text-indigo-700 px-3 py-2 rounded-xl hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 transition-all"
                                    >
                                        <Send size={12} /> Criar + Emitir
                                    </button>
                                </div>
                            </div>

                            {/* Via ERP Próprio */}
                            <div className="border-2 border-emerald-100 rounded-2xl p-4 hover:border-emerald-300 transition-all">
                                <p className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" />Via ERP Próprio</p>
                                <p className="text-xs text-slate-500 mb-3">Usa o certificado digital local do ERP para gerar rascunho e transmitir diretamente ao SEFAZ.</p>
                                <button
                                    onClick={() => { setShowGerarNFeModal(false); handleGerarNFeDoPedido(nfeModalOrder.orderId || nfeModalOrder.blingId, nfeModalOrder, false, 'erp'); setNfeModalOrder(null); }}
                                    disabled={!!gerandoNFeId}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs font-black uppercase bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50 transition-all"
                                >
                                    <FileText size={12} /> Gerar via ERP
                                </button>
                            </div>
                        </div>

                        <button onClick={() => { setShowGerarNFeModal(false); setNfeModalOrder(null); }} className="mt-5 w-full text-xs text-slate-400 hover:text-slate-600 font-semibold py-2">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modal Editar Pedido de Venda ────────────────────────────────── */}
            {editPedidoModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg p-8 animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <Settings className="text-amber-600" size={20} /> Editar Pedido #{editPedidoModal.id}
                            </h3>
                            <button onClick={() => setEditPedidoModal(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Nome do Contato</label>
                                <input
                                    type="text" value={editPedidoModal.data?.contato?.nome || ''}
                                    onChange={e => setEditPedidoModal(prev => prev ? { ...prev, data: { ...prev.data, contato: { ...prev.data.contato, nome: e.target.value } } } : null)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">CPF/CNPJ</label>
                                <input
                                    type="text" value={editPedidoModal.data?.contato?.numeroDocumento || ''}
                                    onChange={e => setEditPedidoModal(prev => prev ? { ...prev, data: { ...prev.data, contato: { ...prev.data.contato, numeroDocumento: e.target.value } } } : null)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-amber-400"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Observações</label>
                                <textarea
                                    value={editPedidoModal.data?.observacoes || ''} rows={2}
                                    onChange={e => setEditPedidoModal(prev => prev ? { ...prev, data: { ...prev.data, observacoes: e.target.value } } : null)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-amber-400 resize-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Observações Internas</label>
                                <textarea
                                    value={editPedidoModal.data?.observacoesInternas || ''} rows={2}
                                    onChange={e => setEditPedidoModal(prev => prev ? { ...prev, data: { ...prev.data, observacoesInternas: e.target.value } } : null)}
                                    className="w-full p-3 border-2 border-slate-200 rounded-xl bg-white font-bold text-sm outline-none focus:border-amber-400 resize-none"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditPedidoModal(null)} className="flex-1 text-xs font-black uppercase tracking-widest py-3 rounded-xl border-2 border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                                Cancelar
                            </button>
                            <button onClick={handleSalvarPedido} disabled={isSavingPedido} className="flex-1 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-all shadow-lg shadow-amber-100">
                                {isSavingPedido ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de confirmação de importação para o ERP ──────────────── */}
            {showImportConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-5">
                            <h2 className="text-lg font-black text-white flex items-center gap-2"><Download size={18} /> Confirmar Importação para ERP</h2>
                            <p className="text-sm text-green-100 mt-0.5">{selectedVendasIds.size} pedido(s) selecionado(s)</p>
                        </div>
                        {/* Body */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {/* Seletor de limite */}
                            <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-2 block">Quantidade máxima a importar</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setImportQuantityLimit(q => Math.max(1, q - 10))} className="px-3 py-1.5 bg-blue-200 text-blue-700 rounded-lg font-black hover:bg-blue-300 transition">−</button>
                                    <input
                                        type="number" min={1} max={selectedVendasIds.size}
                                        value={importQuantityLimit}
                                        onChange={e => setImportQuantityLimit(Math.max(1, Number(e.target.value)))}
                                        className="w-24 text-center border-2 border-blue-300 rounded-lg py-1.5 font-black text-base outline-none focus:border-blue-500"
                                    />
                                    <button onClick={() => setImportQuantityLimit(q => q + 10)} className="px-3 py-1.5 bg-blue-200 text-blue-700 rounded-lg font-black hover:bg-blue-300 transition">+</button>
                                    <span className="text-xs text-blue-600">de {selectedVendasIds.size} pedidos selecionados</span>
                                </div>
                            </div>
                            {/* Preview dos pedidos */}
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Pedidos que serão importados</p>
                            <div className="space-y-3">
                                {filteredVendasOrders
                                    .filter(o => selectedVendasIds.has(o.blingId || o.orderId))
                                    .slice(0, importQuantityLimit)
                                    .map((order, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-gray-800 text-sm">#{order.orderId || order.blingId || order.blingNumero}</span>
                                                    <span className="text-sm text-gray-600">{order.customer_name}</span>
                                                </div>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${order.canal === 'SHOPEE' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                    order.canal === 'ML' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                                        'bg-blue-100 text-blue-700 border-blue-200'
                                                    }`}>
                                                    {order.canal || 'SITE'}
                                                </span>
                                            </div>
                                            {order.itens?.length > 0 ? (
                                                <table className="w-full text-xs mt-2 border-collapse">
                                                    <thead>
                                                        <tr className="text-[9px] text-gray-400 uppercase border-b border-gray-200">
                                                            <th className="text-left pb-1">SKU</th>
                                                            <th className="text-left pb-1">Descrição</th>
                                                            <th className="text-center pb-1">Qtd</th>
                                                            <th className="text-right pb-1">Valor Unit.</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {order.itens.map((item: any, i: number) => (
                                                            <tr key={i} className="border-t border-gray-100">
                                                                <td className="py-1 font-mono text-blue-600 text-[10px]">{item.sku || '—'}</td>
                                                                <td className="py-1 text-gray-700 max-w-[180px] truncate">{item.descricao || '—'}</td>
                                                                <td className="py-1 text-center font-black text-gray-800">{item.quantidade}</td>
                                                                <td className="py-1 text-right text-emerald-700">
                                                                    {Number(item.valorUnitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p className="text-[10px] text-gray-400 mt-1 italic">Nenhum item detalhado disponível para este pedido</p>
                                            )}
                                        </div>
                                    ))}
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="p-5 border-t flex gap-3 justify-end bg-gray-50">
                            <button
                                onClick={() => setShowImportConfirm(false)}
                                className="px-6 py-2.5 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    setIsImportingToERP(true);
                                    try {
                                        const ids = Array.from(selectedVendasIds);
                                        const toImport = filteredVendasOrders
                                            .filter(o => ids.includes(o.blingId || o.orderId))
                                            .slice(0, importQuantityLimit);
                                        const orderItems = toImport.map(transformSyncedOrder);
                                        await onLaunchSuccess(orderItems);
                                        addToast(`✅ ${orderItems.length} pedido(s) importados para o ERP!`, 'success');
                                        setShowImportConfirm(false);
                                        setSelectedVendasIds(new Set());
                                    } catch (err: any) {
                                        addToast(`Erro ao importar: ${err.message}`, 'error');
                                    } finally {
                                        setIsImportingToERP(false);
                                    }
                                }}
                                disabled={isImportingToERP}
                                className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 disabled:opacity-50 transition-all shadow-lg shadow-green-100"
                            >
                                {isImportingToERP ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Confirmar Importação {importQuantityLimit < selectedVendasIds.size ? `(${importQuantityLimit})` : `(${selectedVendasIds.size})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BlingPage;
