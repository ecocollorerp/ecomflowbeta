/**
 * lib/shopeeApi.ts
 * Cliente para a Shopee Open Platform API (BR)
 * Autenticação via HMAC-SHA256 + OAuth2
 */

import { ShopeeSettings, OrderItem } from '../types';
import { getMultiplicadorFromSku } from './sku';

// ─── OAuth ────────────────────────────────────────────────────────────────────

/**
 * Obtém a URL de autorização Shopee via nosso servidor (que gera o HMAC).
 */
export async function getShopeeAuthUrl(
    partnerId: string,
    partnerKey: string,
    redirectUri: string
): Promise<string> {
    const params = new URLSearchParams({ partnerId, partnerKey, redirect: redirectUri });
    const resp = await fetch(`/api/shopee/auth-url?${params}`);
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Shopee auth URL failed: ${text}`);
    }
    const data = await resp.json();
    return data.authUrl as string;
}

/**
 * Troca o código OAuth Shopee por access_token e refresh_token.
 */
export async function executeShopeeTokenExchange(
    partnerId: string,
    partnerKey: string,
    code: string,
    shopId?: string
): Promise<{ access_token: string; refresh_token: string; expire_in: number; shop_id?: number }> {
    const resp = await fetch('/api/shopee/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, partnerKey, code, shopId }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Shopee token exchange failed: ${text}`);
    }
    return resp.json();
}

// ─── Sync ──────────────────────────────────────────────────────────────────────

/**
 * Sincroniza pedidos da Shopee (paginação transparente via servidor).
 */
export async function syncShopeeOrders(
    settings: ShopeeSettings,
    filters: { startDate: string; endDate: string }
): Promise<{ success: boolean; orders: any[]; total: number; pages: number }> {
    if (!settings.accessToken || !settings.shopId) {
        throw new Error('Token e Shop ID são obrigatórios para sincronizar pedidos Shopee');
    }

    const params = new URLSearchParams({
        partnerId: settings.partnerId,
        partnerKey: settings.partnerKey,
        shopId: settings.shopId,
        accessToken: settings.accessToken,
        dataInicio: filters.startDate,
        dataFim: filters.endDate,
    });

    const resp = await fetch(`/api/shopee/sync/orders?${params}`);
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Shopee sync orders failed: ${text}`);
    }
    return resp.json();
}

/**
 * Converte pedido normalizado da Shopee para o formato OrderItem interno.
 */
export function transformShopeeOrder(o: any): OrderItem {
    const sku = o.sku || o.itens?.[0]?.sku || '';
    return {
        id: o.id || `shopee-${o.orderId}-${Date.now()}`,
        orderId: String(o.orderId || ''),
        blingId: '',
        tracking: '',
        sku,
        qty_original: Number(o.quantity || 1),
        multiplicador: getMultiplicadorFromSku(sku),
        qty_final: Math.round(Number(o.quantity || 1) * getMultiplicadorFromSku(sku)),
        color: '',
        canal: 'SHOPEE',
        data: o.data || new Date().toISOString().split('T')[0],
        status: 'NORMAL',
        customer_name: o.customer_name || 'Comprador Shopee',
        customer_cpf_cnpj: '',
        price_gross: Number(o.unit_price || 0),
        price_total: Number(o.total || 0),
        platform_fees: 0,
        shipping_fee: Number(o.frete || 0),
        shipping_paid_by_customer: Number(o.frete || 0),
        price_net: Number(o.unit_price || 0),
    };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Verifica se o token de acesso está expirado (com 60s de buffer).
 */
export function isShopeeTokenExpired(settings: ShopeeSettings): boolean {
    if (!settings.expiresAt) return false;
    return Date.now() > settings.expiresAt - 60_000;
}
