import { ZplSettings, ZplPlatformSettings } from '../types';

/** Returns dots-per-mm for the given settings DPI. */
function dpmm(settings: ZplSettings): number {
    const dpi = settings.dpi === 'Auto' ? 203 : parseInt(settings.dpi, 10);
    return dpi / 25.4;
}

/** Converts millimetres to dots at the given dpmm. */
function d(mm: number, rate: number): number {
    return Math.round(mm * rate);
}

/**
 * Strips characters that would break a ZPL ^FD field.
 * Replaces ^ and ~ with dashes; non-printable ASCII becomes '?'.
 */
function safeZplText(text: string): string {
    return text
        .replace(/\^/g, '-')
        .replace(/~/g, '-')
        .replace(/[^\x20-\x7E]/g, '?');
}

/**
 * Generates a TikTok Shop branded ZPL shipping label.
 *
 * Layout (top → bottom):
 *   ■ Black header bar — "TIKTOK SHOP"
 *   ─ separator
 *   PEDIDO: <orderId>   (only when orderId is provided)
 *   Code-128 barcode    (only when orderId is provided)
 *   ─ separator
 *   PRODUTOS / SKUS:
 *   <one line per SKU using tikTokSettings.footer.template>
 *   ─ footer line — "EcomFlow"
 */
export function generateTikTokZplLabel(
    skus: Array<{ sku: string; qty: number }>,
    orderId: string | undefined,
    settings: ZplSettings,
    tikTokSettings: ZplPlatformSettings,
): string {
    const rate = dpmm(settings);
    const W = d(settings.pageWidth, rate);
    const H = d(settings.pageHeight, rate);

    const parts: string[] = ['^XA', `^PW${W}`, `^LL${H}`];

    let y = 0;

    // ── Black header bar ─────────────────────────────────────────────────────
    const headerH = d(16, rate);
    parts.push(`^FO0,0^GB${W},${headerH},${headerH}^FS`);

    // "TIKTOK SHOP" (white reversed text)
    const hFontH = d(10, rate);
    const hFontW = d(7, rate);
    const hTextY = Math.round((headerH - hFontH) / 2);
    parts.push(`^FO${d(4, rate)},${hTextY}^A0N,${hFontH},${hFontW}^FR^FDTIKTOK SHOP^FS`);

    y = headerH + d(2, rate);

    // separator
    parts.push(`^FO0,${y}^GB${W},2,2^FS`);
    y += d(3, rate);

    // ── Order ID / Pedido section ─────────────────────────────────────────────
    if (orderId) {
        const lH = d(3.5, rate);
        const lW = d(2.5, rate);
        parts.push(`^FO${d(3, rate)},${y}^A0N,${lH},${lW}^FDPEDIDO:^FS`);
        y += lH + d(1.5, rate);

        const oFH = d(5.5, rate);
        const oFW = d(4, rate);
        const safeId = safeZplText(orderId).substring(0, 30);
        parts.push(`^FO${d(3, rate)},${y}^A0N,${oFH},${oFW}^FD${safeId}^FS`);
        y += oFH + d(2, rate);

        // Code-128 barcode (only printable ASCII, max 24 chars)
        const barcodeH = d(12, rate);
        const barcodeData = orderId.replace(/[^A-Z0-9a-z\- .$/+%]/g, '').substring(0, 24);
        if (barcodeData.length > 0) {
            parts.push(`^FO${d(6, rate)},${y}^BY2,3,${barcodeH}^BCN,${barcodeH},Y,N^FD${barcodeData}^FS`);
            // barcodeH + human-readable text (~7mm) + padding
            y += barcodeH + d(7, rate);
        }
    }

    // separator
    parts.push(`^FO0,${y}^GB${W},2,2^FS`);
    y += d(4, rate);

    // ── Products / SKUs section ───────────────────────────────────────────────
    const secH = d(3.5, rate);
    const secW = d(2.5, rate);
    parts.push(`^FO${d(3, rate)},${y}^A0N,${secH},${secW}^FDPRODUTOS / SKUS:^FS`);
    y += secH + d(2, rate);

    // SKU font: fontSize_pt → mm (1 pt ≈ 0.353 mm) → dots
    const ptToMm = 0.352778;
    const skuFontH = Math.max(d(4, rate), Math.round(tikTokSettings.footer.fontSize_pt * ptToMm * rate));
    const skuFontW = Math.round(skuFontH * 0.72);
    const maxCharsPerLine = Math.max(10, Math.floor(W / Math.max(1, skuFontW + 1)));

    for (const { sku, qty } of skus) {
        if (y >= H - d(14, rate)) break; // leave room for footer

        const lineText = tikTokSettings.footer.template
            .replace('{sku}', sku)
            .replace('{qty}', String(qty))
            .replace('{name}', sku);

        const safeLine = safeZplText(lineText).substring(0, maxCharsPerLine);
        parts.push(`^FO${d(3, rate)},${y}^A0N,${skuFontH},${skuFontW}^FD${safeLine}^FS`);
        y += skuFontH + d(2, rate);
    }

    // ── Bottom footer ─────────────────────────────────────────────────────────
    const footerY = H - d(8, rate);
    if (y < footerY - d(4, rate)) {
        parts.push(`^FO0,${footerY}^GB${W},2,2^FS`);
        const ftH = d(3, rate);
        const ftW = d(2.2, rate);
        parts.push(`^FO${d(3, rate)},${footerY + d(2, rate)}^A0N,${ftH},${ftW}^FDEcomFlow^FS`);
    }

    parts.push('^XZ');
    return parts.join('\n');
}
