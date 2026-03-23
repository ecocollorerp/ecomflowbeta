import { parseExcelFile, extractShippingDates } from './lib/parser';
import { defaultGeneralSettings } from './types';
import * as fs from 'fs';

const buf = fs.readFileSync('excel/Order.all.20260201_20260228_part_2_of_3.xlsx');
const buffer = new Uint8Array(buf).buffer;

console.log('=== extractShippingDates ===');
try {
    const dates = extractShippingDates(buffer, defaultGeneralSettings, 'SHOPEE' as any, 'Order.toship.xlsx');
    console.log('Found dates:', JSON.stringify(dates.slice(0, 10)));
} catch (e: any) { console.error('ERROR extractShippingDates:', e.message); }

console.log('\n=== parseExcelFile (sem filtro) ===');
try {
    const result = parseExcelFile(buffer, 'Order.toship.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: false }, 'SHOPEE' as any);
    console.log('Canal:', result.canal, '| Orders:', result.lists.completa.length, '| Pedidos:', result.summary.totalPedidos);
    const o = result.lists.completa[0];
    console.log('First:', o?.orderId, o?.sku, o?.data, o?.data_prevista_envio);
} catch (e: any) { console.error('ERROR parseExcelFile:', e.message); }

console.log('\n=== parseExcelFile (filtro 2026-03-16) ===');
try {
    const result2 = parseExcelFile(buffer, 'Order.toship.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: false, allowedShippingDates: ['2026-02-11'] }, 'SHOPEE' as any);
    console.log('Orders com filtro:', result2.lists.completa.length);
} catch (e: any) { console.error('ERROR com filtro:', e.message); }

console.log('\n=== parseExcelFile (filtro + columnOverrides) ===');
try {
    const result3 = parseExcelFile(buffer, 'Order.toship.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: false, allowedShippingDates: ['2026-02-11'], columnOverrides: { dateShipping: 'Data prevista de envio' } }, 'SHOPEE' as any);
    console.log('Orders com override:', result3.lists.completa.length);
} catch (e: any) { console.error('ERROR com override:', e.message); }
