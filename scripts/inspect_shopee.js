import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const filePath = path.join(process.cwd(), 'excel', 'Order.toship.20260213_20260315.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(2);
}

const workbook = XLSX.readFile(filePath, { cellDates: true });
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Detect header row (primeira linha com >2 colunas preenchidas)
let headerRowIndex = 0;
for (let i = 0; i < Math.min(rawData.length, 50); i++) {
  const row = rawData[i];
  if (Array.isArray(row) && row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length > 2) {
    headerRowIndex = i;
    break;
  }
}

console.log('Sheet:', sheetName, 'HeaderRowIndex:', headerRowIndex);

const sheetData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex, raw: false });
if (!sheetData || sheetData.length === 0) {
  console.error('Nenhuma linha após o cabeçalho detectado.');
  process.exit(3);
}

const sheetKeys = Object.keys(sheetData[0]);
console.log('\nCabeçalhos detectados (normalized):');
const normalize = s => String(s||'').trim().toUpperCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^A-Z0-9\s]/g,'').replace(/\s+/g,' ');
sheetKeys.forEach(k => console.log('-', k, '=>', normalize(k)));

// Esperados para Shopee (do settings do app)
const expected = {
  orderId: 'N.º do pedido',
  sku: 'Referência SKU',
  qty: 'Quantidade',
  tracking: 'Código de rastreio',
  date: 'Data de criação do pedido',
  dateShipping: 'Data de envio prevista',
  priceGross: 'Preço acordado',
  shippingFee: 'Desconto de Frete Aproximado',
  shippingPaidByCustomer: 'Taxa de envio paga pelo comprador',
  fees: ['Taxa de comissão','Taxa de serviço'],
  customerName: 'Nome do Comprador',
};

const tryMatch = desired => {
  if (!desired) return undefined;
  const target = normalize(desired);
  let mk = sheetKeys.find(k => normalize(k) === target);
  if (!mk) mk = sheetKeys.find(k => normalize(k).includes(target));
  if (!mk) mk = sheetKeys.find(k => target.includes(normalize(k)));
  return mk;
};

const mapping = {};
for (const k of Object.keys(expected)) {
  if (Array.isArray(expected[k])) {
    mapping[k] = expected[k].map(e => tryMatch(e)).filter(Boolean);
  } else {
    mapping[k] = tryMatch(expected[k]);
  }
}

console.log('\nMapeamento encontrado:');
console.log(mapping);

// Extrair datas disponíveis (prefer dateShipping -> date)
const dateKey = mapping.dateShipping || mapping.date || null;
if (!dateKey) {
  console.warn('Nenhuma coluna de data encontrada para filtro (dateShipping/date). Vou listar primeiras 10 linhas.');
  console.log(sheetData.slice(0,10));
  process.exit(0);
}

const normalizeDate = raw => {
  if (!raw) return '';
  const s = String(raw).trim();
  // DD/MM/AAAA
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2,'0')}-${ymd[3].padStart(2,'0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '';
};

const dateCounts = {};
for (const row of sheetData) {
  const dv = normalizeDate(row[dateKey]);
  if (dv) dateCounts[dv] = (dateCounts[dv]||0)+1;
}

const uniqueDates = Object.keys(dateCounts).sort();
console.log('\nDatas encontradas e contagens:');
uniqueDates.forEach(d => console.log(d, '=>', dateCounts[d]));

if (uniqueDates.length === 0) {
  console.warn('Nenhuma data válida encontrada nas colunas mapeadas. Saindo.');
  process.exit(0);
}

// Processar apenas o primeiro dia encontrado
const chosen = uniqueDates[0];
console.log('\nProcessando somente a data:', chosen);
const rowsForDate = sheetData.filter(r => normalizeDate(r[dateKey]) === chosen);
console.log('Linhas nesta data:', rowsForDate.length);
console.log('\nExemplo de 10 primeiras linhas (campos principais):');
rowsForDate.slice(0,10).forEach((r, idx) => {
  console.log(`#${idx+1}`);
  const out = {
    orderId: r[mapping.orderId],
    sku: r[mapping.sku],
    qty: r[mapping.qty],
    tracking: r[mapping.tracking],
    date: r[mapping.date],
    dateShipping: r[mapping.dateShipping],
    customer: r[mapping.customerName]
  };
  console.log(out);
});

console.log('\nPronto.');
