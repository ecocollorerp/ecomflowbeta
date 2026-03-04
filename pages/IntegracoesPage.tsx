/**
 * pages/IntegracoesPage.tsx
 * Hub central de integrações: Mercado Livre e Shopee
 * Bling continua sendo gerenciado na BlingPage (link direto disponível)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, RefreshCw, CheckCircle2, XCircle, Loader2, ShoppingBag, Store, Zap, LogOut, BarChart2, Calendar, AlertCircle } from 'lucide-react';
import { GeneralSettings, MLSettings, ShopeeSettings, OrderItem } from '../types';
import {
    createMLAuthUrl,
    executeMLTokenExchange,
    syncMLOrders,
    transformMLOrder,
    isMLTokenExpired,
    getValidMLToken,
    getMLSellerInfo,
} from '../lib/mlApi';
import {
    getShopeeAuthUrl,
    executeShopeeTokenExchange,
    syncShopeeOrders,
    transformShopeeOrder,
    isShopeeTokenExpired,
} from '../lib/shopeeApi';

// ─── Props ────────────────────────────────────────────────────────────────────

interface IntegracoesPageProps {
    generalSettings: GeneralSettings;
    onSaveSettings: (updater: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => Promise<void>;
    onLaunchSuccess: (orders: OrderItem[]) => Promise<void>;
    addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
    setCurrentPage?: (page: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = (): string => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
};

const fmt = (ts?: number) =>
    ts ? new Date(ts).toLocaleString('pt-BR') : '—';

// ─── Status Card ─────────────────────────────────────────────────────────────

const StatusCard: React.FC<{
    icon: React.ReactNode;
    name: string;
    connected: boolean;
    info?: string;
    color: string;
}> = ({ icon, name, connected, info, color }) => (
    <div className={`p-4 rounded-xl border bg-white dark:bg-gray-800 flex items-center gap-4 ${connected ? 'border-green-400/40' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
        </div>
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-50">{name}</p>
            {info && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{info}</p>}
        </div>
        {connected
            ? <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
            : <XCircle size={22} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />}
    </div>
);

// ─── Orders Mini-Table ────────────────────────────────────────────────────────

const OrderRow: React.FC<{ order: OrderItem }> = ({ order }) => (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:bg-gray-700 text-sm">
        <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{order.orderId || order.id}</td>
        <td className="px-4 py-2">{order.data}</td>
        <td className="px-4 py-2 max-w-xs truncate">{order.customer_name}</td>
        <td className="px-4 py-2 font-mono">{order.sku}</td>
        <td className="px-4 py-2 text-center">{order.qty_original}</td>
        <td className="px-4 py-2 text-right">
            {order.price_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </td>
    </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const IntegracoesPage: React.FC<IntegracoesPageProps> = ({
    generalSettings,
    onSaveSettings,
    onLaunchSuccess,
    addToast,
    setCurrentPage,
}) => {
    const [activeTab, setActiveTab] = useState<'mercadolivre' | 'shopee'>('mercadolivre');

    // ── ML state ──────────────────────────────────────────────────────────────
    const mlSettings = generalSettings.integrations?.mercadoLivre;
    const [mlClientId, setMlClientId] = useState(mlSettings?.clientId || '');
    const [mlClientSecret, setMlClientSecret] = useState(mlSettings?.clientSecret || '');
    const [mlAutoSync, setMlAutoSync] = useState(mlSettings?.autoSync ?? false);
    const [mlSyncing, setMlSyncing] = useState(false);
    const [mlConnecting, setMlConnecting] = useState(false);
    const [mlOrders, setMlOrders] = useState<OrderItem[]>([]);
    const [mlStartDate, setMlStartDate] = useState(thirtyDaysAgo());
    const [mlEndDate, setMlEndDate] = useState(today());

    // ── Shopee state ──────────────────────────────────────────────────────────
    const shopeeSettings = generalSettings.integrations?.shopee;
    const [shopeeAuthMode, setShopeeAuthMode] = useState<'oauth' | 'direct'>(shopeeSettings?.authMode || 'oauth');
    const [shopeePartnerId, setShopeePartnerId] = useState(shopeeSettings?.partnerId || '');
    const [shopeePartnerKey, setShopeePartnerKey] = useState(shopeeSettings?.partnerKey || '');
    const [shopeeDirectShopId, setShopeeDirectShopId] = useState(shopeeSettings?.shopId || '');
    const [shopeeDirectToken, setShopeeDirectToken] = useState(shopeeSettings?.accessToken || '');
    const [shopeeDirectRefreshToken, setShopeeDirectRefreshToken] = useState(shopeeSettings?.refreshToken || '');
    const [shopeeAutoSync, setShopeeAutoSync] = useState(shopeeSettings?.autoSync ?? false);
    const [shopeeSyncing, setShopeeSyncing] = useState(false);
    const [shopeeConnecting, setShopeeConnecting] = useState(false);
    const [shopeeOrders, setShopeeOrders] = useState<OrderItem[]>([]);
    const [shopeeStartDate, setShopeeStartDate] = useState(thirtyDaysAgo());
    const [shopeeEndDate, setShopeeEndDate] = useState(today());

    // Track which OAuth popup is open
    const pendingOAuthRef = useRef<'ml' | 'shopee' | null>(null);
    const processedCodes = useRef<Set<string>>(new Set());
    const autoSyncRanOnce = useRef(false);

    // ── Auto-sync on mount ────────────────────────────────────────────────────
    useEffect(() => {
        if (autoSyncRanOnce.current) return;
        autoSyncRanOnce.current = true;

        const runAutoSync = async () => {
            const promises: Promise<void>[] = [];
            if (generalSettings.integrations?.mercadoLivre?.autoSync &&
                generalSettings.integrations.mercadoLivre.accessToken) {
                promises.push(handleMLSync());
            }
            if (generalSettings.integrations?.shopee?.autoSync &&
                generalSettings.integrations.shopee.accessToken) {
                promises.push(handleShopeeSync());
            }
            if (promises.length > 0) await Promise.allSettled(promises);
        };

        // Delay leve para não bloquear a renderização inicial
        const timer = setTimeout(runAutoSync, 800);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── OAuth popup listener ──────────────────────────────────────────────────
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            // Same message type as Bling (App.tsx sends BLING_AUTH_CODE for any code callback)
            if (!(event.data && event.data.type === 'BLING_AUTH_CODE' && event.data.code)) return;
            const code = String(event.data.code).trim();
            if (!code || processedCodes.current.has(code)) return;
            processedCodes.current.add(code);

            const platform = pendingOAuthRef.current;
            pendingOAuthRef.current = null;

            if (platform === 'ml') {
                await handleMLCodeExchange(code);
            } else if (platform === 'shopee') {
                await handleShopeeCodeExchange(code);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mlClientId, mlClientSecret, shopeePartnerId, shopeePartnerKey]);

    // ── ML helpers ────────────────────────────────────────────────────────────

    const saveMlSettings = useCallback(async (patch: Partial<MLSettings>) => {
        await onSaveSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                mercadoLivre: {
                    clientId: mlClientId,
                    clientSecret: mlClientSecret,
                    autoSync: mlAutoSync,
                    ...prev.integrations?.mercadoLivre,
                    ...patch,
                } as MLSettings,
            },
        }));
    }, [onSaveSettings, mlClientId, mlClientSecret, mlAutoSync]);

    const handleMLConnect = () => {
        if (!mlClientId.trim()) {
            addToast('Informe o Client ID do Mercado Livre', 'error');
            return;
        }
        const redirectUri = window.location.origin;
        const url = createMLAuthUrl(mlClientId.trim(), redirectUri);
        pendingOAuthRef.current = 'ml';

        const w = 600, h = 700;
        const left = window.screen.width / 2 - w / 2;
        const top = window.screen.height / 2 - h / 2;
        window.open(url, 'MLAuth', `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes`);
        addToast('Popup de autenticação aberto. Autorize o acesso no Mercado Livre.', 'info');
    };

    const handleMLCodeExchange = async (code: string) => {
        if (!mlClientId || !mlClientSecret) {
            addToast('Client ID e Secret são necessários', 'error');
            return;
        }
        setMlConnecting(true);
        try {
            const redirectUri = window.location.origin;
            const data = await executeMLTokenExchange(code, mlClientId, mlClientSecret, redirectUri);
            if (data.access_token) {
                // Auto-buscar info do vendedor para obter sellerId e nickname
                let sellerId = data.user_id ? String(data.user_id) : undefined;
                let sellerNickname: string | undefined;
                try {
                    const info = await getMLSellerInfo(data.access_token);
                    sellerId = String(info.id);
                    sellerNickname = info.nickname;
                } catch (_) { /* silencioso — sellerId do token ainda pode ser usado */ }

                await saveMlSettings({
                    clientId: mlClientId,
                    clientSecret: mlClientSecret,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresAt: Date.now() + (data.expires_in || 21600) * 1000,
                    sellerId,
                    sellerNickname,
                    autoSync: mlAutoSync,
                });
                addToast(`Mercado Livre conectado${sellerNickname ? ` como ${sellerNickname}` : ''}!`, 'success');
            } else {
                addToast('Falha na autenticação: ' + JSON.stringify(data), 'error');
            }
        } catch (e: any) {
            addToast('Erro ao conectar ML: ' + e.message, 'error');
        } finally {
            setMlConnecting(false);
        }
    };

    const handleMLDisconnect = async () => {
        await onSaveSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                mercadoLivre: {
                    clientId: mlClientId,
                    clientSecret: mlClientSecret,
                    autoSync: false,
                } as MLSettings,
            },
        }));
        setMlOrders([]);
        addToast('Mercado Livre desconectado.', 'info');
    };

    const handleMLSync = async () => {
        const currentML = generalSettings.integrations?.mercadoLivre;
        if (!currentML?.accessToken) {
            addToast('Conecte ao Mercado Livre primeiro', 'error');
            return;
        }
        setMlSyncing(true);
        try {
            const token = await getValidMLToken(currentML);
            if (!token) throw new Error('Token inválido ou expirado. Reconecte ao ML.');

            const result = await syncMLOrders(token, currentML.sellerId || '', {
                startDate: mlStartDate,
                endDate: mlEndDate,
            });

            const orders = (result.orders || []).map(transformMLOrder);
            setMlOrders(orders);

            if (orders.length > 0) {
                await onLaunchSuccess(orders);
                addToast(`${orders.length} pedidos do Mercado Livre importados!`, 'success');
            } else {
                addToast('Nenhum pedido encontrado no período.', 'info');
            }
        } catch (e: any) {
            addToast('Erro ao sincronizar ML: ' + e.message, 'error');
        } finally {
            setMlSyncing(false);
        }
    };

    // ── Shopee helpers ────────────────────────────────────────────────────────

    const saveShopeeSettings = useCallback(async (patch: Partial<ShopeeSettings>) => {
        await onSaveSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                shopee: {
                    authMode: shopeeAuthMode,
                    partnerId: shopeePartnerId,
                    partnerKey: shopeePartnerKey,
                    autoSync: shopeeAutoSync,
                    ...prev.integrations?.shopee,
                    ...patch,
                } as ShopeeSettings,
            },
        }));
    }, [onSaveSettings, shopeeAuthMode, shopeePartnerId, shopeePartnerKey, shopeeAutoSync]);

    const handleShopeeConnect = async () => {
        if (shopeeAuthMode === 'direct') {
            // Modo Token Direto: salva sem precisar de Partner Key
            if (!shopeeDirectShopId.trim() || !shopeeDirectToken.trim()) {
                addToast('Informe o Shop ID e o Access Token', 'error');
                return;
            }
            await saveShopeeSettings({
                authMode: 'direct',
                partnerId: '',
                partnerKey: '',
                shopId: shopeeDirectShopId.trim(),
                accessToken: shopeeDirectToken.trim(),
                refreshToken: shopeeDirectRefreshToken.trim() || undefined,
                expiresAt: undefined,
                autoSync: shopeeAutoSync,
            });
            addToast('Shopee conectada com token direto!', 'success');
            return;
        }
        // Modo OAuth (Partner App)
        if (!shopeePartnerId.trim() || !shopeePartnerKey.trim()) {
            addToast('Informe o Partner ID e Partner Key da Shopee', 'error');
            return;
        }
        try {
            const redirectUri = window.location.origin;
            const url = await getShopeeAuthUrl(shopeePartnerId.trim(), shopeePartnerKey.trim(), redirectUri);
            pendingOAuthRef.current = 'shopee';

            const w = 600, h = 700;
            const left = window.screen.width / 2 - w / 2;
            const top = window.screen.height / 2 - h / 2;
            window.open(url, 'ShopeeAuth', `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=yes`);
            addToast('Popup de autenticação aberto. Autorize o acesso na Shopee.', 'info');
        } catch (e: any) {
            addToast('Erro ao gerar URL Shopee: ' + e.message, 'error');
        }
    };

    const handleShopeeCodeExchange = async (code: string) => {
        if (!shopeePartnerId || !shopeePartnerKey) {
            addToast('Partner ID e Key são necessários', 'error');
            return;
        }
        setShopeeConnecting(true);
        try {
            const data = await executeShopeeTokenExchange(shopeePartnerId, shopeePartnerKey, code);
            if (data.access_token) {
                await saveShopeeSettings({
                    partnerId: shopeePartnerId,
                    partnerKey: shopeePartnerKey,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresAt: Date.now() + (data.expire_in || 14400) * 1000,
                    shopId: data.shop_id ? String(data.shop_id) : undefined,
                    autoSync: shopeeAutoSync,
                });
                addToast('Shopee conectada com sucesso!', 'success');
            } else {
                addToast('Falha na autenticação Shopee: ' + JSON.stringify(data), 'error');
            }
        } catch (e: any) {
            addToast('Erro ao conectar Shopee: ' + e.message, 'error');
        } finally {
            setShopeeConnecting(false);
        }
    };

    const handleShopeeDisconnect = async () => {
        await onSaveSettings(prev => ({
            ...prev,
            integrations: {
                ...prev.integrations,
                shopee: {
                    partnerId: shopeePartnerId,
                    partnerKey: shopeePartnerKey,
                    autoSync: false,
                } as ShopeeSettings,
            },
        }));
        setShopeeOrders([]);
        addToast('Shopee desconectada.', 'info');
    };

    const handleShopeeSync = async () => {
        const currentShopee = generalSettings.integrations?.shopee;
        if (!currentShopee?.accessToken) {
            addToast('Conecte à Shopee primeiro', 'error');
            return;
        }
        if (!currentShopee.shopId) {
            addToast('Shop ID não encontrado. Reconecte para obter o Shop ID.', 'error');
            return;
        }
        if (isShopeeTokenExpired(currentShopee)) {
            addToast('Token da Shopee expirado. Reconecte.', 'error');
            return;
        }
        setShopeeSyncing(true);
        try {
            const result = await syncShopeeOrders(currentShopee, {
                startDate: shopeeStartDate,
                endDate: shopeeEndDate,
            });
            const orders = (result.orders || []).map(transformShopeeOrder);
            setShopeeOrders(orders);

            if (orders.length > 0) {
                await onLaunchSuccess(orders);
                addToast(`${orders.length} pedidos da Shopee importados!`, 'success');
            } else {
                addToast('Nenhum pedido encontrado no período.', 'info');
            }
        } catch (e: any) {
            addToast('Erro ao sincronizar Shopee: ' + e.message, 'error');
        } finally {
            setShopeeSyncing(false);
        }
    };

    // ── Sync all ──────────────────────────────────────────────────────────────

    const handleSyncAll = async () => {
        const promises: Promise<void>[] = [];
        if (generalSettings.integrations?.mercadoLivre?.accessToken) promises.push(handleMLSync());
        if (generalSettings.integrations?.shopee?.accessToken) promises.push(handleShopeeSync());
        if (promises.length === 0) {
            addToast('Nenhuma integração conectada para sincronizar.', 'info');
            return;
        }
        await Promise.allSettled(promises);
    };

    // ── Derived state ─────────────────────────────────────────────────────────

    const mlConnected = !!mlSettings?.accessToken;
    const shopeeConnected = !!shopeeSettings?.accessToken;
    const blingConnected = !!generalSettings.integrations?.bling?.apiKey;

    // ── Render ────────────────────────────────────────────────────────────────

    const inputClass =
        'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
    const labelClass = 'block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide';
    const btnPrimary =
        'flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-semibold text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50';
    const btnDanger =
        'flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold text-sm hover:bg-red-700 active:scale-95 transition-all';
    const btnSecondary =
        'flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg font-semibold text-sm hover:bg-gray-50 dark:bg-gray-700 active:scale-95 transition-all';

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <Globe size={22} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Integrações</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Conecte e sincronize seus marketplaces</p>
                    </div>
                </div>
                <button
                    onClick={handleSyncAll}
                    disabled={mlSyncing || shopeeSyncing}
                    className={btnPrimary}
                >
                    {(mlSyncing || shopeeSyncing) ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    Sincronizar Tudo
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatusCard
                    icon={<ShoppingBag size={22} className="text-yellow-600" />}
                    name="Bling"
                    connected={blingConnected}
                    info={blingConnected ? 'Gerenciado na página Bling' : 'Não conectado'}
                    color="bg-yellow-100 dark:bg-yellow-900/30"
                />
                <StatusCard
                    icon={<Store size={22} className="text-yellow-500" />}
                    name="Mercado Livre"
                    connected={mlConnected}
                    info={mlConnected ? (mlSettings?.sellerNickname || `Exp: ${fmt(mlSettings?.expiresAt)}`) : 'Não conectado'}
                    color="bg-yellow-100 dark:bg-yellow-900/30"
                />
                <StatusCard
                    icon={<ShoppingBag size={22} className="text-orange-500" />}
                    name="Shopee"
                    connected={shopeeConnected}
                    info={shopeeConnected ? (shopeeSettings?.shopName || `Shop: ${shopeeSettings?.shopId || '—'}`) : 'Não conectado'}
                    color="bg-orange-100 dark:bg-orange-900/30"
                />
            </div>

            {/* Info: Bling */}
            {!blingConnected && (
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 flex items-center gap-3 text-sm text-yellow-800 dark:text-yellow-300">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    <span>
                        O Bling é configurado na{' '}
                        <button
                            className="font-semibold underline hover:no-underline"
                            onClick={() => setCurrentPage?.('bling')}
                        >
                            página Bling
                        </button>.
                    </span>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex gap-1">
                    {([
                        { id: 'mercadolivre', label: 'Mercado Livre', connected: mlConnected },
                        { id: 'shopee', label: 'Shopee', connected: shopeeConnected },
                    ] as const).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-50'
                            }`}
                        >
                            {tab.label}
                            {tab.connected && <span className="w-2 h-2 rounded-full bg-green-500" />}
                        </button>
                    ))}
                </nav>
            </div>

            {/* ── Mercado Livre Tab ── */}
            {activeTab === 'mercadolivre' && (
                <div className="space-y-6">
                    {/* Config Card */}
                    <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-gray-900 dark:text-gray-50">Configuração OAuth</h2>
                            {mlConnected && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                    <CheckCircle2 size={14} /> Conectado
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Client ID</label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    value={mlClientId}
                                    onChange={e => setMlClientId(e.target.value)}
                                    placeholder="Ex: 12345678"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Client Secret</label>
                                <input
                                    type="password"
                                    className={inputClass}
                                    value={mlClientSecret}
                                    onChange={e => setMlClientSecret(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                id="ml-autosync"
                                type="checkbox"
                                checked={mlAutoSync}
                                onChange={e => setMlAutoSync(e.target.checked)}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <label htmlFor="ml-autosync" className="text-sm text-gray-500 dark:text-gray-400">
                                Sincronizar automaticamente ao abrir
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleMLConnect}
                                disabled={mlConnecting}
                                className={btnPrimary}
                            >
                                {mlConnecting ? <Loader2 size={16} className="animate-spin" /> : <Store size={16} />}
                                {mlConnected ? 'Reconectar' : 'Conectar com ML'}
                            </button>
                            {mlConnected && (
                                <button onClick={handleMLDisconnect} className={btnDanger}>
                                    <LogOut size={16} /> Desconectar
                                </button>
                            )}
                            <button
                                onClick={() => saveMlSettings({ clientId: mlClientId, clientSecret: mlClientSecret, autoSync: mlAutoSync })}
                                className={btnSecondary}
                            >
                                Salvar credenciais
                            </button>
                        </div>

                        {mlConnected && mlSettings?.expiresAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Token expira em: <span className="font-mono">{fmt(mlSettings.expiresAt)}</span>
                                {isMLTokenExpired(mlSettings) && (
                                    <span className="ml-2 text-orange-500 font-semibold">(Expirado — reconecte)</span>
                                )}
                            </p>
                        )}
                    </div>

                    {/* Sync Card */}
                    {mlConnected && (
                        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
                            <h2 className="font-bold text-gray-900 dark:text-gray-50">Sincronizar Pedidos</h2>
                            <div className="flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />Data início</label>
                                    <input type="date" className={inputClass} value={mlStartDate} onChange={e => setMlStartDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />Data fim</label>
                                    <input type="date" className={inputClass} value={mlEndDate} onChange={e => setMlEndDate(e.target.value)} />
                                </div>
                                <button
                                    onClick={handleMLSync}
                                    disabled={mlSyncing}
                                    className={btnPrimary}
                                >
                                    {mlSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    {mlSyncing ? 'Sincronizando...' : 'Sincronizar'}
                                </button>
                            </div>

                            {mlOrders.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart2 size={16} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{mlOrders.length} pedidos sincronizados</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2">ID Pedido</th>
                                                    <th className="px-4 py-2">Data</th>
                                                    <th className="px-4 py-2">Cliente</th>
                                                    <th className="px-4 py-2">SKU</th>
                                                    <th className="px-4 py-2 text-center">Qtd</th>
                                                    <th className="px-4 py-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {mlOrders.slice(0, 100).map(o => <OrderRow key={o.id} order={o} />)}
                                            </tbody>
                                        </table>
                                        {mlOrders.length > 100 && (
                                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-2">
                                                Exibindo 100 de {mlOrders.length} pedidos
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Shopee Tab ── */}
            {activeTab === 'shopee' && (
                <div className="space-y-6">
                    {/* Config Card */}
                    <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="font-bold text-gray-900 dark:text-gray-50">Configuração Shopee</h2>
                            {shopeeConnected && (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                    <CheckCircle2 size={14} /> Conectado
                                </span>
                            )}
                        </div>

                        {/* Seletor de modo de autenticação */}
                        <div>
                            <label className={labelClass}>Modo de conexão</label>
                            <div className="flex gap-2 mt-1">
                                <button
                                    onClick={() => setShopeeAuthMode('oauth')}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                                        shopeeAuthMode === 'oauth'
                                            ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-700'
                                    }`}
                                >
                                    OAuth (Partner App)
                                </button>
                                <button
                                    onClick={() => setShopeeAuthMode('direct')}
                                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                                        shopeeAuthMode === 'direct'
                                            ? 'bg-orange-500 text-white border-orange-500'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:bg-gray-700'
                                    }`}
                                >
                                    Token Direto (sem Partner Key)
                                </button>
                            </div>
                            {shopeeAuthMode === 'direct' && (
                                <p className="mt-1.5 text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                                    Cole o Access Token gerado pelo seu painel Shopee Seller Center. Não é necessário Partner ID nem Partner Key.
                                </p>
                            )}
                        </div>

                        {/* Campos OAuth */}
                        {shopeeAuthMode === 'oauth' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Partner ID</label>
                                    <input
                                        type="text"
                                        className={inputClass}
                                        value={shopeePartnerId}
                                        onChange={e => setShopeePartnerId(e.target.value)}
                                        placeholder="Ex: 1234567"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Partner Key</label>
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={shopeePartnerKey}
                                        onChange={e => setShopeePartnerKey(e.target.value)}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Campos Token Direto */}
                        {shopeeAuthMode === 'direct' && (
                            <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Shop ID</label>
                                        <input
                                            type="text"
                                            className={inputClass}
                                            value={shopeeDirectShopId}
                                            onChange={e => setShopeeDirectShopId(e.target.value)}
                                            placeholder="Ex: 987654321"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Access Token</label>
                                        <input
                                            type="password"
                                            className={inputClass}
                                            value={shopeeDirectToken}
                                            onChange={e => setShopeeDirectToken(e.target.value)}
                                            placeholder="Cole o token aqui"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>Refresh Token <span className="font-normal normal-case text-gray-500 dark:text-gray-400">(opcional)</span></label>
                                    <input
                                        type="password"
                                        className={inputClass}
                                        value={shopeeDirectRefreshToken}
                                        onChange={e => setShopeeDirectRefreshToken(e.target.value)}
                                        placeholder="Cole o refresh token se tiver"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Shop ID readonly (modo OAuth após conectar) */}
                        {shopeeAuthMode === 'oauth' && shopeeConnected && shopeeSettings?.shopId && (
                            <div>
                                <label className={labelClass}>Shop ID (obtido via OAuth)</label>
                                <input type="text" className={inputClass} value={shopeeSettings.shopId} readOnly />
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            <input
                                id="shopee-autosync"
                                type="checkbox"
                                checked={shopeeAutoSync}
                                onChange={e => setShopeeAutoSync(e.target.checked)}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <label htmlFor="shopee-autosync" className="text-sm text-gray-500 dark:text-gray-400">
                                Sincronizar automaticamente ao abrir
                            </label>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleShopeeConnect}
                                disabled={shopeeConnecting}
                                className={btnPrimary}
                            >
                                {shopeeConnecting ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}
                                {shopeeAuthMode === 'direct'
                                    ? (shopeeConnected ? 'Atualizar Token' : 'Salvar Token')
                                    : (shopeeConnected ? 'Reconectar' : 'Conectar com Shopee')}
                            </button>
                            {shopeeConnected && (
                                <button onClick={handleShopeeDisconnect} className={btnDanger}>
                                    <LogOut size={16} /> Desconectar
                                </button>
                            )}
                            {shopeeAuthMode === 'oauth' && (
                                <button
                                    onClick={() => saveShopeeSettings({ authMode: 'oauth', partnerId: shopeePartnerId, partnerKey: shopeePartnerKey, autoSync: shopeeAutoSync })}
                                    className={btnSecondary}
                                >
                                    Salvar credenciais
                                </button>
                            )}
                        </div>

                        {shopeeConnected && shopeeSettings?.expiresAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Token expira em: <span className="font-mono">{fmt(shopeeSettings.expiresAt)}</span>
                                {isShopeeTokenExpired(shopeeSettings) && (
                                    <span className="ml-2 text-orange-500 font-semibold">(Expirado — reconecte)</span>
                                )}
                            </p>
                        )}
                        {shopeeConnected && shopeeAuthMode === 'direct' && !shopeeSettings?.expiresAt && (
                            <p className="text-xs text-green-600">Token direto salvo — atualizar manualmente quando expirar.</p>
                        )}
                    </div>

                    {/* Sync Card */}
                    {shopeeConnected && (
                        <div className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-4">
                            <h2 className="font-bold text-gray-900 dark:text-gray-50">Sincronizar Pedidos</h2>
                            <div className="flex flex-wrap gap-4 items-end">
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />Data início</label>
                                    <input type="date" className={inputClass} value={shopeeStartDate} onChange={e => setShopeeStartDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}><Calendar size={12} className="inline mr-1" />Data fim</label>
                                    <input type="date" className={inputClass} value={shopeeEndDate} onChange={e => setShopeeEndDate(e.target.value)} />
                                </div>
                                <button
                                    onClick={handleShopeeSync}
                                    disabled={shopeeSyncing}
                                    className={btnPrimary}
                                >
                                    {shopeeSyncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    {shopeeSyncing ? 'Sincronizando...' : 'Sincronizar'}
                                </button>
                            </div>

                            {shopeeOrders.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart2 size={16} className="text-blue-600 dark:text-blue-400" />
                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-50">{shopeeOrders.length} pedidos sincronizados</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase">
                                                <tr>
                                                    <th className="px-4 py-2">ID Pedido</th>
                                                    <th className="px-4 py-2">Data</th>
                                                    <th className="px-4 py-2">Cliente</th>
                                                    <th className="px-4 py-2">SKU</th>
                                                    <th className="px-4 py-2 text-center">Qtd</th>
                                                    <th className="px-4 py-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {shopeeOrders.slice(0, 100).map(o => <OrderRow key={o.id} order={o} />)}
                                            </tbody>
                                        </table>
                                        {shopeeOrders.length > 100 && (
                                            <p className="text-xs text-center text-gray-500 dark:text-gray-400 py-2">
                                                Exibindo 100 de {shopeeOrders.length} pedidos
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IntegracoesPage;
