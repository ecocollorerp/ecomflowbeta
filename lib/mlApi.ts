/**
 * lib/mlApi.ts
 * Cliente para a API do Mercado Livre (mlb - Brasil)
 * Usa OAuth2 Authorization Code + Refresh Token
 */

import { MLSettings, OrderItem } from '../types';
import { getMultiplicadorFromSku } from './sku';

const ML_AUTH_URL = 'https://auth.mercadolibre.com.br/authorization';

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Monta a URL de autorização para o popup OAuth do ML.
 */
export function createMLAuthUrl(clientId: string, redirectUri: string): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
    });
    return `${ML_AUTH_URL}?${params.toString()}`;
}

/**
 * Troca o código OAuth por access_token + refresh_token via nosso servidor proxy.
 */
export async function executeMLTokenExchange(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number; user_id: number }> {
    const resp = await fetch('/api/ml/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
        }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ML token exchange failed: ${text}`);
    }
    return resp.json();
}

/**
 * Renova o access_token usando refresh_token.
 */
export async function refreshMLToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
    const resp = await fetch('/api/ml/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ML token refresh failed: ${text}`);
    }
    return resp.json();
}

// ─── User Info ─────────────────────────────────────────────────────────────────

/**
 * Obtém informações do vendedor (seller_id, nickname).
 */
export async function getMLSellerInfo(
    accessToken: string
): Promise<{ id: number; nickname: string; email?: string }> {
    const resp = await fetch('/api/ml/user', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ML user info failed: ${text}`);
    }
    return resp.json();
}

// ─── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Sincroniza pedidos do Mercado Livre.
 * Usa o endpoint /api/ml/sync/orders do nosso servidor (paginação automática).
 */
export async function syncMLOrders(
    accessToken: string,
    sellerId: string,
    filters: { startDate: string; endDate: string }
): Promise<{ success: boolean; orders: any[]; total: number; pages: number }> {
    const params = new URLSearchParams({
        sellerId,
        dataInicio: filters.startDate,
        dataFim: filters.endDate,
    });

    const resp = await fetch(`/api/ml/sync/orders?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`ML sync orders failed: ${text}`);
    }

    return resp.json();
}

/**
 * Converte um pedido normalizado do ML para o formato OrderItem interno.
 */
export function transformMLOrder(o: any): OrderItem {
    const sku = o.sku || o.itens?.[0]?.sku || '';
    const unitPrice = Number(o.unit_price || 0);
    const qty = Number(o.quantity || 1);
    const subtotal = Number(o.total || 0) || (unitPrice * qty);
    const fees = Number(o.platform_fees || 0);
    const frete = Number(o.frete || 0);
    return {
        id: o.id || `ml-${o.orderId}-${Date.now()}`,
        orderId: String(o.orderId || ''),
        blingId: '',
        tracking: '',
        sku,
        qty_original: qty,
        multiplicador: getMultiplicadorFromSku(sku),
        qty_final: Math.round(qty * getMultiplicadorFromSku(sku)),
        color: '',
        canal: 'ML',
        data: o.data || new Date().toISOString().split('T')[0],
        status: 'NORMAL',
        customer_name: o.customer_name || 'Comprador ML',
        customer_cpf_cnpj: '',
        price_gross: subtotal,
        price_total: subtotal + frete,
        platform_fees: fees,
        shipping_fee: frete,
        shipping_paid_by_customer: frete,
        price_net: subtotal - fees,
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verifica se o token está expirado (com 60s de buffer).
 */
export function isMLTokenExpired(settings: MLSettings): boolean {
    if (!settings.expiresAt) return false;
    return Date.now() > settings.expiresAt - 60_000;
}

/**
 * Tenta obter token válido; faz refresh se expirado.
 * Retorna null se não for possível.
 */
export async function getValidMLToken(settings: MLSettings): Promise<string | null> {
    if (!settings.accessToken) return null;
    if (!isMLTokenExpired(settings)) return settings.accessToken;

    if (!settings.refreshToken || !settings.clientId || !settings.clientSecret) {
        return settings.accessToken; // sem refresh, retorna mesmo expirado
    }

    try {
        const data = await refreshMLToken(settings.refreshToken, settings.clientId, settings.clientSecret);
        return data.access_token; // caller salva o token novo
    } catch {
        return settings.accessToken;
    }
}
