import * as fs from 'fs';
import { parseExcelFile } from './lib/parser';
import { defaultGeneralSettings } from './types';

const tikBuf = fs.readFileSync('./excel/Para enviar pedido-2026-03-17-13_33.xlsx');
const tikArr = tikBuf.buffer.slice(tikBuf.byteOffset, tikBuf.byteOffset + tikBuf.byteLength);

const r1 = parseExcelFile(tikArr, 'tiktok_pedidos.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: true, descontarVolatil: false, tiktokOrderType: 'all' }, 'AUTO');
console.log('TIKTOK_ALL CANAL=' + r1.canal + ' TOTAL=' + r1.lists.completa.length);
r1.lists.completa.forEach(o => console.log('  ORDER=' + o.orderId + ' SKU=' + o.sku + ' QTY=' + o.qty_final + ' TRACK=' + o.tracking));

const r2 = parseExcelFile(tikArr, 'tiktok_pedidos.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: true, descontarVolatil: false, tiktokOrderType: 'normal' }, 'AUTO');
console.log('TIKTOK_NORMAL CANAL=' + r2.canal + ' TOTAL=' + r2.lists.completa.length);

try {
  const r3 = parseExcelFile(tikArr, 'tiktok_pedidos.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: true, descontarVolatil: false, tiktokOrderType: 'pre-order' }, 'AUTO');
  console.log('TIKTOK_PREORDER CANAL=' + r3.canal + ' TOTAL=' + r3.lists.completa.length);
} catch(e: any) { console.log('TIKTOK_PREORDER ERROR=' + e.message); }
