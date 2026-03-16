import fs from 'fs';
import path from 'path';
import { parseExcelFile, extractShippingDates } from '../lib/parser';
import { defaultGeneralSettings, OrderItem } from '../types';

const filePath = path.join(process.cwd(), 'excel', 'Order.toship.20260213_20260315.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(2);
}

const buffer = fs.readFileSync(filePath);
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

console.log('Usando canal SHOPEE forçado e settings padrão.');
const dates = extractShippingDates(arrayBuffer as any, defaultGeneralSettings as any, 'SHOPEE');
console.log('Datas detectadas:', dates);

let selectedDates: string[] | undefined = undefined;
if (dates && dates.length > 0) {
  selectedDates = [dates[0].date];
  console.log('Processando somente a data:', selectedDates[0]);
} else {
  console.log('Nenhuma data detectada; processando sem filtro.');
}

try {
  const columnOverrides: any = {};
  if (dates && dates.length > 0 && dates[0].key) columnOverrides.dateShipping = dates[0].key;
  const processed = parseExcelFile(arrayBuffer as any, 'Order.toship.xlsx', [] as OrderItem[], defaultGeneralSettings as any, { importCpf: false, importName: true, descontarVolatil: false, allowedShippingDates: selectedDates, columnOverrides }, 'SHOPEE');
  console.log('Canal detectado pelo parser:', processed.canal);
  console.log('Total pedidos (novos):', processed.lists.completa.length);
  console.log('Total SKUs não vinculados:', processed.skusNaoVinculados.length);
  console.log('Resumo:', processed.summary);
  console.log('Amostra 10 primeiros pedidos:', processed.lists.completa.slice(0,10));
} catch (err: any) {
  console.error('Erro ao processar arquivo via parseExcelFile:', err?.message || err);
  console.error(err?.stack);
  process.exit(1);
}
