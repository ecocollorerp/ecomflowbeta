import { parseExcelFile, extractShippingDates, extractHeadersAndData } from './lib/parser';
import { defaultGeneralSettings } from './types';
import * as fs from 'fs';

const buf = fs.readFileSync('excel/Order.toship.20260213_20260315.xlsx');
const buffer = new Uint8Array(buf).buffer;

// Simular cenário do UI completo
console.log('=== 1. CENÁRIO: Default antigo salvo (Data de envio prevista) ===');
const savedSettings = JSON.parse(JSON.stringify(defaultGeneralSettings));
savedSettings.importer.shopee.dateShipping = "Data de envio prevista"; // valor antigo salvo no Supabase

// Passo 1: extractHeadersAndData (como handleStartProcessing faz)
const { headers, sheetData } = extractHeadersAndData(buffer);
const normalizeHeaderLocal = (s: any) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
const targetMatch = (desired: string | undefined) => {
    if (!desired) return undefined;
    const t = normalizeHeaderLocal(desired);
    let mk = headers.find(h => normalizeHeaderLocal(h) === t);
    if (mk) return mk;
    mk = headers.find(h => normalizeHeaderLocal(h).includes(t));
    if (mk) return mk;
    mk = headers.find(h => t.includes(normalizeHeaderLocal(h)));
    if (mk) return mk;
    const sw = new Set(['DE', 'DO', 'DA', 'E', 'PARA', 'POR', 'O', 'A', 'EM', 'NO', 'NA', 'DOS', 'DAS', 'AO', 'PELO', 'PELA']);
    const tImp = t.split(' ').filter(Boolean).filter(w => !sw.has(w));
    if (tImp.length > 0) {
        mk = headers.find(h => {
            const hImp = normalizeHeaderLocal(h).split(' ').filter(Boolean).filter(w => !sw.has(w));
            if (hImp.length === 0) return false;
            const [shorter, longer] = tImp.length <= hImp.length ? [tImp, hImp] : [hImp, tImp];
            return shorter.every(w => longer.includes(w));
        });
    }
    return mk;
};

const cfg = savedSettings.importer.shopee;
const desired = cfg.dateShipping || cfg.date;
const matched = targetMatch(desired);
console.log('Config dateShipping:', desired);
console.log('Matched header:', matched);

// Passo 2: Scan datas da coluna matched
if (matched) {
    const normalizeDateLocal = (raw: any) => {
        if (!raw) return '';
        let s = String(raw).trim();
        if (s.includes(' ')) s = s.split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        return '';
    };
    const dateMap = new Map<string, number>();
    for (const row of sheetData as any[]) {
        const val = (row as any)[matched];
        const nd = normalizeDateLocal(val);
        if (nd) dateMap.set(nd, (dateMap.get(nd) || 0) + 1);
    }
    console.log('Dates found:', Array.from(dateMap.entries()).slice(0, 5));

    // Passo 3: parseExcelFile COM override (como executeFullProcessing faz)
    const selectedDates = [Array.from(dateMap.keys())[0]]; // primeira data
    console.log('Selected dates:', selectedDates);
    console.log('shippingDateKey (override):', matched);

    try {
        const result = parseExcelFile(buffer, 'Order.toship.xlsx', [], savedSettings,
            { importCpf: false, importName: false, allowedShippingDates: selectedDates, columnOverrides: { dateShipping: matched } },
            'SHOPEE' as any
        );
        console.log('COM override -> Orders:', result.lists.completa.length, '✓');
    } catch (e: any) { console.error('COM override -> ERROR:', e.message); }

    // Passo 4: parseExcelFile SEM override (caso shippingDateKey = null)
    try {
        const result2 = parseExcelFile(buffer, 'Order.toship.xlsx', [], savedSettings,
            { importCpf: false, importName: false, allowedShippingDates: selectedDates },
            'SHOPEE' as any
        );
        console.log('SEM override -> Orders:', result2.lists.completa.length, '✓');
    } catch (e: any) { console.error('SEM override -> ERROR:', e.message); }
} else {
    console.error('ERRO: targetMatch não encontrou coluna para:', desired);
}

console.log('\n=== 2. CENÁRIO: Default novo (Data prevista de envio) ===');
try {
    const dates = extractShippingDates(buffer, defaultGeneralSettings, 'SHOPEE' as any, 'Order.toship.xlsx');
    console.log('Dates:', dates.length, 'first:', dates[0]);
    const result = parseExcelFile(buffer, 'Order.toship.xlsx', [], defaultGeneralSettings,
        { importCpf: false, importName: false, allowedShippingDates: [dates[0].date] },
        'SHOPEE' as any
    );
    console.log('Orders com novo default:', result.lists.completa.length, '✓');
} catch (e: any) { console.error('ERROR:', e.message); }

console.log('\n=== 3. CENÁRIO: targetMatch no ImporterPage para "Data de envio prevista" ===');
// O targetMatch do ImporterPage NÃO tem stopwords — precisa ser corrigido?
const testVal = "Data de envio prevista";
const testMatch = targetMatch(testVal);
console.log(`targetMatch("${testVal}") =>`, testMatch);
// Verificar se encontra coluna correta
console.log('Headers com "envio" ou "prevista":', headers.filter(h => h.toLowerCase().includes('envio') || h.toLowerCase().includes('prevista')));
