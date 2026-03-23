import * as fs from 'fs';
import { parseExcelFile } from './lib/parser';
import { defaultGeneralSettings } from './types';

// ML
const mlBuf = fs.readFileSync('./excel/20260311_Vendas_BR_Mercado_Libre_y_Mercado_Shops_2026-03-11_08-18hs_767713367.xlsx');
const mlArr = mlBuf.buffer.slice(mlBuf.byteOffset, mlBuf.byteOffset + mlBuf.byteLength);
const rML = parseExcelFile(mlArr, 'ml_vendas.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: true, descontarVolatil: false }, 'AUTO');
console.log('ML CANAL=' + rML.canal + ' TOTAL=' + rML.lists.completa.length);
console.log('  FIRST=' + rML.lists.completa[0]?.orderId + ' SKU=' + rML.lists.completa[0]?.sku + ' TRACK=' + rML.lists.completa[0]?.tracking);

// Shopee toship
const shBuf = fs.readFileSync('./excel/Order.toship.20260213_20260315.xlsx');
const shArr = shBuf.buffer.slice(shBuf.byteOffset, shBuf.byteOffset + shBuf.byteLength);
const rSH = parseExcelFile(shArr, 'shopee_pedidos.xlsx', [], defaultGeneralSettings, { importCpf: false, importName: true, descontarVolatil: false }, 'AUTO');
console.log('SHOPEE CANAL=' + rSH.canal + ' TOTAL=' + rSH.lists.completa.length);
console.log('  FIRST=' + rSH.lists.completa[0]?.orderId + ' SKU=' + rSH.lists.completa[0]?.sku + ' TRACK=' + rSH.lists.completa[0]?.tracking);
