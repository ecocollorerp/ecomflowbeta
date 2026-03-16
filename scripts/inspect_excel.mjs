import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'excel', 'Order.toship.20260213_20260315.xlsx');
if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    process.exit(2);
}

const wb = XLSX.readFile(filePath, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

let headerRowIndex = 0;
for (let i = 0; i < Math.min(raw.length, 50); i++) {
    const row = raw[i];
    if (Array.isArray(row) && row.filter(c => String(c || '').trim()).length > 2) {
        headerRowIndex = i;
        break;
    }
}

const json = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex, raw: false });
const keys = Object.keys(json[0] || {});
console.log('HEADERS:', keys);

const normalize = (s) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
console.log('NORMALIZED HEADERS:', keys.map(k => normalize(k)));

const desiredDateCandidates = ['Data de envio prevista', 'Data de criação do pedido', 'Data de criação do pedido', 'Data de envio'];
const target = normalize('Data de envio prevista');
        console.log('TARGET normalized:', target);
        let matched = keys.find(k => normalize(k) === target) || keys.find(k => normalize(k).includes(target)) || keys.find(k => target.includes(normalize(k)));
        if (!matched) {
            // token intersection debug
            const targetTokens = target.split(' ').filter(Boolean);
            console.log('TARGET TOKENS:', targetTokens);
            for (const k of keys) {
                const hk = normalize(k);
                const hTokens = hk.split(' ').filter(Boolean);
                const inter = hTokens.filter(t => targetTokens.includes(t)).length;
                console.log('HEADER:', k, '=>', hk, 'TOKENS:', hTokens, 'INTERSECTION:', inter);
            }
        }
        console.log('matched date column:', matched || '(nenhuma)');

function normalizeDate(rawDate) {
    if (!rawDate) return '';
    if (rawDate instanceof Date) {
        const d = new Date(rawDate.getTime() - rawDate.getTimezoneOffset() * 60000);
        return d.toISOString().split('T')[0];
    }
    let s = String(rawDate || '').trim().split(' ')[0];
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
    const p = new Date(s);
    if (!isNaN(p.getTime())) return p.toISOString().split('T')[0];
    return '';
}

const dateMap = new Map();
json.forEach(r => {
    const dv = normalizeDate(r[matched]);
    if (dv) dateMap.set(dv, (dateMap.get(dv) || 0) + 1);
});

console.log('DATES found (first 20):', Array.from(dateMap.entries()).slice(0, 20));
const firstDate = dateMap.keys().next().value;
console.log('FIRST DATE:', firstDate || '(nenhuma)');
if (firstDate) {
    const samples = json.filter(r => normalizeDate(r[matched]) === firstDate).slice(0, 5);
    console.log('SAMPLES for', firstDate, samples);
} else {
    console.log('No dates found (cannot sample)');
}
