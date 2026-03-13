import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

/**
 * Utilitários para geração de códigos de barras e QR codes em formato Base64 (Data URI).
 */

/**
 * Gera um código de barras (CODE128) em formato Base64.
 * @param text O conteúdo do código de barras.
 * @returns Uma Promise que resolve para a string Data URI da imagem.
 */
export const generateBarcodeBase64 = (text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            JsBarcode(canvas, text, {
                format: "CODE128",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 20,
                margin: 10
            });
            resolve(canvas.toDataURL("image/png"));
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Gera um QR code em formato Base64.
 * @param text O conteúdo do QR code.
 * @returns Uma Promise que resolve para a string Data URI da imagem.
 */
export const generateQRCodeBase64 = async (text: string): Promise<string> => {
    try {
        const dataUri = await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 300
        });
        return dataUri;
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
        throw error;
    }
};

/**
 * Determina se uma string parece ser um código de lote ou de produto.
 * Útil para lógica de bipagem futura.
 */
export const isBatchCode = (code: string): boolean => {
    // Exemplo: Lotes podem começar com 'LOTE-' ou 'B-'
    return code.startsWith('LOTE-') || code.startsWith('B-');
};
