
// lib/parser.ts
import { OrderItem, ProcessedData, Canal, ResumidaItem, GeneralSettings, ColumnMapping } from '../types';
import { getMultiplicadorFromSku, classificarCor, classificarTipoBase, isItemMenor } from './sku';
import * as XLSX from 'xlsx';

const safeUpper = (val: any) => String(val || '').trim().toUpperCase();
const normalizeHeaderToken = (val: any) => String(val || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');

const detectCanalHintFromFileName = (fileName?: string): Canal | null => {
    const upper = safeUpper(fileName || '');
    if (!upper) return null;
    if (upper.includes('TIKTOK') || upper.includes('TIK TOK') || upper.includes('TTSHOP')) return 'SITE';
    if (upper.includes('MERCADO LIVRE') || upper.includes('MERCADOLIVRE') || upper.includes('MELI') || upper.includes('ML_')) return 'ML';
    if (upper.includes('SHOPEE') || upper.includes('TO_SHIP') || upper.includes('TOSHIP')) return 'SHOPEE';
    return null;
};

const orderCandidateChannels = (forcedCanal?: Canal | 'AUTO', fileNameHint?: string): Canal[] => {
    if (forcedCanal && forcedCanal !== 'AUTO') return [forcedCanal];

    const defaults: Canal[] = ['ML', 'SHOPEE', 'SITE'];
    const hinted = detectCanalHintFromFileName(fileNameHint);
    if (!hinted) return defaults;

    return [hinted, ...defaults.filter(c => c !== hinted)];
};

const getCriticalColumnsForDetection = (canal: Canal, config?: Partial<ColumnMapping>): string[] => {
    const configured = [config?.orderId, config?.sku, config?.qty, config?.tracking]
        .filter(Boolean)
        .map((h) => normalizeHeaderToken(h));

    if (configured.length > 0) return configured;

    if (canal === 'ML') {
        return ['N.º de venda', 'N° de venda', 'No de venda', 'ID da venda', 'SKU', 'Unidades', 'Quantidade']
            .map(normalizeHeaderToken);
    }
    if (canal === 'SHOPEE') {
        return ['ID do pedido', 'N.º do pedido', 'Número de referência SKU', 'Quantidade', 'Data prevista de envio']
            .map(normalizeHeaderToken);
    }

    // SITE (TikTok / e-commerce próprio)
    return ['Order ID', 'Seller SKU', 'SKU ID', 'Quantity', 'Created Time', 'Order Status', 'Normal or Pre-order', 'Tracking ID']
        .map(normalizeHeaderToken);
};

// Helper para normalizar datas
const normalizeDate = (rawDate: any): string => {
    if (!rawDate) return '';

    if (rawDate instanceof Date) {
        // Usa UTC para evitar desvio de ±1 dia por fuso horário (xlsx cellDates cria datas em UTC)
        const year = rawDate.getUTCFullYear();
        const month = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(rawDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    let dateStr = String(rawDate).trim();
    // Remove hora se houver
    if (dateStr.includes(' ')) {
        dateStr = dateStr.split(' ')[0];
    }
    // Remove AM/PM se sobrou
    dateStr = dateStr.replace(/[AP]M$/i, '').trim();

    // Formatos DD/MM/YYYY ou DD-MM-YYYY
    const dmyMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
    
    }

    // Formatos com ano de 2 dígitos (ex: M/D/YY de xlsx raw:false)
    const shortYearMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
    if (shortYearMatch) {
        const yy = parseInt(shortYearMatch[3], 10);
        const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
        return `${yyyy}-${shortYearMatch[2].padStart(2, '0')}-${shortYearMatch[1].padStart(2, '0')}`;
    }

    // Formatos YYYY-MM-DD
    const ymdMatch = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
    }

    // Tenta parse nativo
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

    return '';
};

export const extractHeadersAndData = (fileBuffer: ArrayBuffer): { headers: string[], sheetData: any[] } => {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    let headerRowIndex = 0;
    let maxCols = 0;
    for (let i = 0; i < Math.min(rawData.length, 50); i++) {
        const row = rawData[i];
        if (Array.isArray(row)) {
            const filledCols = row.filter(c => String(c || '').trim() !== '').length;
            if (filledCols > maxCols) {
                maxCols = filledCols;
                headerRowIndex = i;
            }
            if (filledCols >= 8) break; // Assume that a real header has at least 8 columns
        }
    }

    const sheetData = XLSX.utils.sheet_to_json<any>(worksheet, { range: headerRowIndex });

    let headers: string[] = [];
    if (sheetData.length > 0) {
        headers = Object.keys(sheetData[0]);
    } else if (rawData[headerRowIndex]) {
        headers = Array.from(new Set((rawData[headerRowIndex] as any[]).map(c => String(c || '').trim()).filter(Boolean)));
    }

    return { headers, sheetData };
};

// Nova função para extrair apenas as datas de envio disponíveis antes do processamento total
export const extractShippingDates = (
    fileBuffer: ArrayBuffer,
    settings: GeneralSettings,
    forcedCanal?: Canal | 'AUTO',
    sourceFileName?: string
): { date: string; count: number; key?: string }[] => {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    // Reutiliza a lógica de detecção de cabeçalho
    let headerRowIndex = -1;
    let mappingToUse: ColumnMapping | null = null;
    let detectedChannel: Canal | null = null;

    const candidateChannels = orderCandidateChannels(forcedCanal, sourceFileName);

    let bestMatch = { rowIndex: -1, channel: null as Canal | null, score: 0 };

    for (let i = 0; i < Math.min(rawData.length, 50); i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const rowValues = row.map(cell => normalizeHeaderToken(cell));

        for (const canal of candidateChannels) {
            const config = settings.importer[canal.toLowerCase() as 'ml' | 'shopee' | 'site'];
            // Procura por colunas críticas
            const criticalColumns = getCriticalColumnsForDetection(canal, config);
            if (criticalColumns.length === 0) continue;

            let matchCount = 0;
            for (const header of criticalColumns) {
                if (rowValues.includes(header)) matchCount++;
            }
            if (matchCount > bestMatch.score) {
                bestMatch = { rowIndex: i, channel: canal, score: matchCount };
            }
        }
    }

    if (bestMatch.rowIndex !== -1) {
        headerRowIndex = bestMatch.rowIndex;
        detectedChannel = bestMatch.channel;
    } else if (forcedCanal && forcedCanal !== 'AUTO') {
        // Fallback: se forçado e não achou, assume linha 0
        headerRowIndex = 0;
        detectedChannel = forcedCanal;
    }

    if (headerRowIndex === -1 || !detectedChannel) {
        if (forcedCanal && forcedCanal !== 'AUTO') {
            headerRowIndex = 0;
            detectedChannel = forcedCanal;
        } else {
            let maxCols = 0;
            for (let i = 0; i < Math.min(rawData.length, 50); i++) {
                const row = rawData[i];
                if (Array.isArray(row)) {
                    const filledCols = row.filter(c => String(c || '').trim() !== '').length;
                    if (filledCols > maxCols) {
                        maxCols = filledCols;
                        headerRowIndex = i;
                    }
                    if (filledCols >= 8) break;
                }
            }
            if (headerRowIndex === -1) return [];

            // Tenta identificar o canal a partir dos tokens do cabeçalho
            const firstRowValues = (rawData[headerRowIndex] || []).map(c => normalizeHeaderToken(c));
            const possibleChannels: Canal[] = ['ML', 'SHOPEE', 'SITE'];
            for (const canal of possibleChannels) {
                const cfg = settings.importer[canal.toLowerCase() as 'ml' | 'shopee' | 'site'];
                if (!cfg) continue;
                const crit = [cfg.orderId, cfg.sku].filter(Boolean).map(h => normalizeHeaderToken(h));
                let cnt = 0;
                for (const h of crit) if (firstRowValues.includes(h)) cnt++;
                if (cnt > 0) { detectedChannel = canal; break; }
            }
            if (!detectedChannel) detectedChannel = 'SHOPEE'; // fallback conservador
        }
    }

    // OBTEM A CONFIGURAÇÃO ESPECÍFICA DO CANAL
    mappingToUse = settings.importer[detectedChannel.toLowerCase() as 'ml' | 'shopee' | 'site'];
    

    // Se não tiver coluna de data de envio configurada, tenta usar data de venda ou retorna vazio
    // Prioriza dateShipping (ex: Coluna H da Shopee)
    const desiredDateCol = mappingToUse.dateShipping || mappingToUse.date;
    if (!desiredDateCol) return [];

    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { range: headerRowIndex, raw: false });

    // Gera mapa tolerante entre nomes configurados e chaves reais da planilha
    const sheetKeys = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    const normalizeHeader = (s: any) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
    const targetNorm = normalizeHeader(desiredDateCol);
    const targetTokens = targetNorm.split(' ').filter(Boolean);
    const extractStopwords = new Set(['DE', 'DO', 'DA', 'E', 'PARA', 'POR', 'O', 'A', 'EM', 'NO', 'NA', 'DOS', 'DAS', 'AO', 'PELO', 'PELA']);
    const tokenMatchThreshold = (aTokens: string[], bTokens: string[]) => {
        const aImp = aTokens.filter(t => !extractStopwords.has(t));
        const bImp = bTokens.filter(t => !extractStopwords.has(t));
        if (aImp.length === 0 || bImp.length === 0) return false;
        const [shorter, longer] = aImp.length <= bImp.length ? [aImp, bImp] : [bImp, aImp];
        return shorter.every(t => longer.includes(t));
    };

    let matchedKey: string | undefined = sheetKeys.find(k => normalizeHeader(k) === targetNorm);
    if (!matchedKey) matchedKey = sheetKeys.find(k => normalizeHeader(k).includes(targetNorm));
    if (!matchedKey) matchedKey = sheetKeys.find(k => targetNorm.includes(normalizeHeader(k)));

    // Tentativa mais estrita: todos os tokens importantes devem estar presentes (ignora stopwords)
    if (!matchedKey) {
        const importantTokens = targetTokens.filter(t => !extractStopwords.has(t));
        if (importantTokens.length > 0) {
            matchedKey = sheetKeys.find(k => {
                const hk = normalizeHeader(k).split(' ').filter(Boolean);
                return importantTokens.every(tok => hk.includes(tok));
            });
        }
    }

    if (!matchedKey) matchedKey = sheetKeys.find(k => tokenMatchThreshold(normalizeHeader(k).split(' ').filter(Boolean), targetTokens));

    // Fallback adicional: varre colunas e escolhe a coluna que contém mais valores parseáveis como data
    if (!matchedKey) {
        // DEBUG: logs para diagnosticar problemas de mapeamento (remover após investigação)
        
        const rowLimit = Math.min(500, jsonData.length);
        const colScores: { key: string; count: number; percent: number }[] = [];
        for (const key of sheetKeys) {
            let count = 0;
            for (let i = 0; i < rowLimit; i++) {
                const cell = jsonData[i] && jsonData[i][key];
                const d = normalizeDate(cell);
                if (d) count++;
            }
            colScores.push({ key, count, percent: rowLimit > 0 ? count / rowLimit : 0 });
        }
        colScores.sort((a, b) => b.count - a.count);
        
        const best = colScores[0];
        if (best && best.count >= 3 && best.percent >= 0.03) {
            matchedKey = best.key;
        }
    }

    if (!matchedKey) return [];

    const dateMap = new Map<string, number>();

    jsonData.forEach(row => {
        const dateVal = normalizeDate(row[matchedKey]); // Usa a chave 'matchedKey' para acessar a propriedade
        if (dateVal) {
            dateMap.set(dateVal, (dateMap.get(dateVal) || 0) + 1);
        }
    });

    // Se não encontrou datas na coluna preferida (dateShipping):
    // - Priorizar apenas colunas relacionadas a envio (HEADER contendo 'ENVIO', 'PREVISTA', 'ENTREGA')
    // - NÃO fazer fallback automático para a coluna de venda quando o usuário configurou dateShipping
    if (dateMap.size === 0 && mappingToUse && mappingToUse.dateShipping) {
        const envioTokens = ['ENVIO', 'PREVISTA', 'PREVIST', 'ENTREGA', 'SHIP'];
        const candidateKeys = sheetKeys.filter(k => {
            const nh = normalizeHeader(k);
            return envioTokens.some(t => nh.includes(t));
        });

        // Se não achou por tokens, escolher a melhor coluna por contagem de datas (mas apenas entre colunas com alguma relação semântica leve)
        let bestKey: string | null = null;
        let bestCount = 0;
        const rowLimit = Math.min(500, jsonData.length);

        const keysToScan = candidateKeys.length > 0 ? candidateKeys : sheetKeys;
        for (const key of keysToScan) {
            let count = 0;
            for (let i = 0; i < rowLimit; i++) {
                const cell = jsonData[i] && jsonData[i][key];
                const d = normalizeDate(cell);
                if (d) count++;
            }
            if (count > bestCount) { bestCount = count; bestKey = key; }
        }

        // Aceita somente se encontrar pelo menos 3 datas parseáveis (evita falso-positivo)
        if (bestKey && bestCount >= 3) {
            matchedKey = bestKey; // FIX: atualiza matchedKey para a coluna que tem datas de verdade
            jsonData.forEach(row => {
                const d = normalizeDate(row[matchedKey!]);
                if (d) dateMap.set(d, (dateMap.get(d) || 0) + 1);
            });
        }
    }

    return Array.from(dateMap.entries())
        .map(([date, count]) => ({ date, count, key: matchedKey }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

// Retorna detalhes internos usados pelo parser para diagnóstico (headerRowIndex, canal detectado,
// mappingToUse, sheetKeys, headerKeyMap e primeira linha de jsonData). Não altera fluxo de import.
export const getParserInternals = (
    fileBuffer: ArrayBuffer,
    settings: GeneralSettings,
    forcedCanal?: Canal | 'AUTO',
    options?: { columnOverrides?: Partial<any> }
): any => {
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    let canalDetectado: Canal | null = null;
    let headerRowIndex = -1;
    let mappingToUse: any = null;

    let candidateChannels: Canal[] = [];
    if (forcedCanal && forcedCanal !== 'AUTO') candidateChannels = [forcedCanal as Canal];
    else candidateChannels = ['ML', 'SHOPEE', 'SITE'];

    let bestMatch = { rowIndex: -1, channel: null as Canal | null, score: 0 };
    for (let i = 0; i < Math.min(rawData.length, 50); i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const rowValues = row.map(cell => normalizeHeaderToken(cell));
        for (const canal of candidateChannels) {
            const config = settings.importer[canal.toLowerCase() as 'ml' | 'shopee' | 'site'];
            const criticalColumns = getCriticalColumnsForDetection(canal, config);
            if (criticalColumns.length === 0) continue;
            let matchCount = 0;
            for (const header of criticalColumns) if (rowValues.includes(header)) matchCount++;
            if (matchCount > bestMatch.score) bestMatch = { rowIndex: i, channel: canal, score: matchCount };
        }
    }

    if (bestMatch.rowIndex !== -1) {
        headerRowIndex = bestMatch.rowIndex;
        canalDetectado = bestMatch.channel;
        if (canalDetectado) mappingToUse = settings.importer[canalDetectado.toLowerCase() as 'ml' | 'shopee' | 'site'];
    } else if (forcedCanal && forcedCanal !== 'AUTO') {
        headerRowIndex = 0;
        canalDetectado = forcedCanal as Canal;
        mappingToUse = settings.importer[canalDetectado.toLowerCase() as 'ml' | 'shopee' | 'site'];
    } else {
        let maxCols = 0;
        for (let i = 0; i < Math.min(rawData.length, 50); i++) {
            const row = rawData[i];
            if (Array.isArray(row)) {
                const filledCols = row.filter(c => String(c || '').trim() !== '').length;
                if (filledCols > maxCols) {
                    maxCols = filledCols;
                    headerRowIndex = i;
                }
                if (filledCols >= 8) break;
            }
        }
        if (headerRowIndex !== -1) {
            const firstRowValues = (rawData[headerRowIndex] || []).map(c => normalizeHeaderToken(c));
            const possibleChannels: Canal[] = ['ML', 'SHOPEE', 'SITE'];
            for (const canal of possibleChannels) {
                const cfg = settings.importer[canal.toLowerCase() as 'ml' | 'shopee' | 'site'];
                if (!cfg) continue;
                const crit = [cfg.orderId, cfg.sku].filter(Boolean).map((h: any) => normalizeHeaderToken(h));
                let cnt = 0; for (const h of crit) if (firstRowValues.includes(h)) cnt++;
                if (cnt > 0) { canalDetectado = canal; mappingToUse = cfg; break; }
            }
            if (!canalDetectado) canalDetectado = 'SHOPEE';
        }
    }

    if (options && options.columnOverrides && mappingToUse) {
        mappingToUse = { ...mappingToUse, ...(options.columnOverrides || {}) };
    }

    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { range: headerRowIndex, raw: false });
    const sheetKeys = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];

    const normalizeHeader = (s: any) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
    const internalsStopwords = new Set(['DE', 'DO', 'DA', 'E', 'PARA', 'POR', 'O', 'A', 'EM', 'NO', 'NA', 'DOS', 'DAS', 'AO', 'PELO', 'PELA']);
    const tryMatch = (desired: any) => {
        if (!desired) return undefined;
        const target = normalizeHeader(desired);
        const targetTokensLocal = target.split(' ').filter(Boolean);
        const tokenMatchLocal = (aTokens: string[], bTokens: string[]) => {
            const aImp = aTokens.filter(t => !internalsStopwords.has(t));
            const bImp = bTokens.filter(t => !internalsStopwords.has(t));
            if (aImp.length === 0 || bImp.length === 0) return false;
            const [shorter, longer] = aImp.length <= bImp.length ? [aImp, bImp] : [bImp, aImp];
            return shorter.every(t => longer.includes(t));
        };
        let mk = sheetKeys.find(k => normalizeHeader(k) === target);
        if (!mk) mk = sheetKeys.find(k => normalizeHeader(k).includes(target));
        if (!mk) mk = sheetKeys.find(k => target.includes(normalizeHeader(k)));
        if (!mk) mk = sheetKeys.find(k => tokenMatchLocal(normalizeHeader(k).split(' ').filter(Boolean), targetTokensLocal));
        return mk;
    };

    const headerKeyMap: { [key: string]: string | undefined } = {};
    if (mappingToUse) {
        headerKeyMap['orderId'] = tryMatch(mappingToUse.orderId);
        headerKeyMap['sku'] = tryMatch(mappingToUse.sku);
        headerKeyMap['qty'] = tryMatch(mappingToUse.qty);
        headerKeyMap['tracking'] = tryMatch(mappingToUse.tracking);
        headerKeyMap['date'] = tryMatch(mappingToUse.date);
        headerKeyMap['dateShipping'] = tryMatch(mappingToUse.dateShipping);
        headerKeyMap['statusColumn'] = tryMatch(mappingToUse.statusColumn);
    }

    return { headerRowIndex, canalDetectado, mappingToUse, sheetKeys, headerKeyMap, sampleRow: jsonData[0] || null, jsonDataLength: jsonData.length };
};

export const parseExcelFile = (
    fileBuffer: ArrayBuffer,
    fileName: string,
    allExistingOrders: OrderItem[],
    settings: GeneralSettings,
    options: {
        importCpf: boolean;
        importName: boolean;
        allowedShippingDates?: string[]; // Array of YYYY-MM-DD strings
        descontarVolatil?: boolean;
        columnOverrides?: Partial<ColumnMapping>;
        tiktokOrderType?: 'all' | 'normal' | 'pre-order'; // Filtro Normal/Pre-order para TikTok
    },
    forcedCanal?: Canal | 'AUTO',
    forcedStatus?: string // NOVO: Permite forçar um status (NORMAL, BIPADO, etc)
): ProcessedData => {
    // 1. Ler o arquivo bruto
    const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 2. Converter para Array de Arrays para "escanear" o cabeçalho
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    let canalDetectado: Canal | null = null;
    let headerRowIndex = -1;
    let mappingToUse: ColumnMapping | null = null;

    // Definição dos canais a testar
    const candidateChannels = orderCandidateChannels(forcedCanal, fileName);

    // 3. Lógica de Pontuação para Detecção do Cabeçalho
    let bestMatch = { rowIndex: -1, channel: null as Canal | null, score: 0 };

    for (let i = 0; i < Math.min(rawData.length, 50); i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        const rowValues = row.map(cell => normalizeHeaderToken(cell));

        for (const canal of candidateChannels) {
            const configKey = canal.toLowerCase() as 'ml' | 'shopee' | 'site';
            const config = settings.importer[configKey];
            const criticalColumns = getCriticalColumnsForDetection(canal, config);
            if (criticalColumns.length === 0) continue;

            let matchCount = 0;
            for (const header of criticalColumns) {
                if (rowValues.includes(header)) matchCount++;
            }

            if (matchCount > bestMatch.score) {
                bestMatch = { rowIndex: i, channel: canal, score: matchCount };
            }
        }
    }

    // 4. Validação e Seleção
    if (bestMatch.rowIndex !== -1 && bestMatch.score >= 1) {
        headerRowIndex = bestMatch.rowIndex;
        canalDetectado = bestMatch.channel;
        if (canalDetectado) {
            mappingToUse = settings.importer[canalDetectado.toLowerCase() as 'ml' | 'shopee' | 'site'];
        }
    }

    // Fallback
    if (!mappingToUse || headerRowIndex === -1) {
        if (forcedCanal && forcedCanal !== 'AUTO') {
            canalDetectado = forcedCanal;
            mappingToUse = settings.importer[forcedCanal.toLowerCase() as 'ml' | 'shopee' | 'site'];
            const isML = forcedCanal === 'ML';
            let maxCols = 0;
            for (let i = 0; i < Math.min(rawData.length, 50); i++) {
                const row = rawData[i];
                if (Array.isArray(row)) {
                    const filledCols = row.filter(c => String(c || '').trim() !== '').length;
                    if (filledCols > maxCols) {
                        maxCols = filledCols;
                        headerRowIndex = i;
                    }
                    if (filledCols >= 8) break;
                }
            }
            if (headerRowIndex === -1) {
                throw new Error(`Não foi possível detectar o formato da planilha automaticamente.`);
            }
        }
    }

    if (options.columnOverrides) {
        mappingToUse = { ...mappingToUse!, ...options.columnOverrides };
    }

    // 5. Re-ler a planilha
    const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { range: headerRowIndex, raw: false });

    if (jsonData.length === 0) throw new Error('A planilha parece estar vazia após o cabeçalho detectado.');

    // Gera mapa tolerante entre nomes configurados e chaves reais da planilha
    const sheetKeys = Object.keys(jsonData[0] || {});
    const normalizeHeader = (s: any) => String(s || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
    const headerKeyMap: { [key: string]: string | undefined } = {};
    const stopwords = new Set(['DE', 'DO', 'DA', 'E', 'PARA', 'POR', 'O', 'A', 'EM', 'NO', 'NA', 'DOS', 'DAS', 'AO', 'PELO', 'PELA']);
    const tryMatch = (desired: any) => {
        if (!desired) return undefined;
        const target = normalizeHeader(desired);
        const targetTokensLocal = target.split(' ').filter(Boolean);
        const targetImportant = targetTokensLocal.filter(t => !stopwords.has(t));
        const tokenMatchLocal = (aTokens: string[], bTokens: string[]) => {
            const aImp = aTokens.filter(t => !stopwords.has(t));
            const bImp = bTokens.filter(t => !stopwords.has(t));
            if (aImp.length === 0 || bImp.length === 0) return false;
            const [shorter, longer] = aImp.length <= bImp.length ? [aImp, bImp] : [bImp, aImp];
            return shorter.every(t => longer.includes(t));
        };

        let mk = sheetKeys.find(k => normalizeHeader(k) === target);
        if (!mk) mk = sheetKeys.find(k => normalizeHeader(k).includes(target));
        if (!mk) mk = sheetKeys.find(k => target.includes(normalizeHeader(k)));
        if (!mk) mk = sheetKeys.find(k => tokenMatchLocal(normalizeHeader(k).split(' ').filter(Boolean), targetTokensLocal));
        return mk;
    };

    // Mapeia cada propriedade relevante
    headerKeyMap['orderId'] = tryMatch(mappingToUse!.orderId);
    headerKeyMap['sku'] = tryMatch(mappingToUse!.sku);
    headerKeyMap['qty'] = tryMatch(mappingToUse!.qty);
    headerKeyMap['tracking'] = tryMatch(mappingToUse!.tracking);
    headerKeyMap['date'] = tryMatch(mappingToUse!.date);
    headerKeyMap['dateShipping'] = tryMatch(mappingToUse!.dateShipping);
    headerKeyMap['priceGross'] = tryMatch(mappingToUse!.priceGross);
    headerKeyMap['totalValue'] = tryMatch(mappingToUse!.totalValue);
    headerKeyMap['shippingFee'] = tryMatch(mappingToUse!.shippingFee);
    headerKeyMap['shippingPaidByCustomer'] = tryMatch(mappingToUse!.shippingPaidByCustomer);
    headerKeyMap['priceNet'] = tryMatch(mappingToUse!.priceNet);
    headerKeyMap['customerName'] = tryMatch(mappingToUse!.customerName);
    headerKeyMap['customerCpf'] = tryMatch(mappingToUse!.customerCpf);
    headerKeyMap['statusColumn'] = tryMatch(mappingToUse!.statusColumn);

    const fillMissingHeaderKey = (field: string, aliases: string[]) => {
        if (headerKeyMap[field]) return;
        for (const alias of aliases) {
            const mk = tryMatch(alias);
            if (mk) {
                headerKeyMap[field] = mk;
                return;
            }
        }
    };

    // Fallbacks de aliases por plataforma quando configuração vier incompleta ou com rótulo diferente.
    if (canalDetectado === 'ML') {
        fillMissingHeaderKey('orderId', ['N.º de venda', 'N° de venda', 'No de venda', 'ID da venda', 'ID do pedido']);
        fillMissingHeaderKey('sku', ['SKU', 'SKU do anúncio', 'SKU do produto', 'Seller SKU', 'Número de referência SKU']);
        fillMissingHeaderKey('qty', ['Quantidade', 'Unidades', 'Quantity']);
        fillMissingHeaderKey('tracking', ['Código de rastreamento', 'Número de rastreamento', 'Tracking']);
        fillMissingHeaderKey('date', ['Data da venda', 'Data de criação do pedido', 'Created Time']);
        fillMissingHeaderKey('shippingPaidByCustomer', ['Custo de envio (pago pelo comprador)', 'Frete pago pelo cliente']);
        fillMissingHeaderKey('statusColumn', ['Estado', 'Status do pedido', 'Order Status']);
    } else if (canalDetectado === 'SHOPEE') {
        fillMissingHeaderKey('orderId', ['ID do pedido', 'N.º do pedido', 'Order ID']);
        fillMissingHeaderKey('sku', ['Número de referência SKU', 'Nº de referência do SKU principal', 'Seller SKU', 'SKU']);
        fillMissingHeaderKey('qty', ['Quantidade', 'Quantity']);
        fillMissingHeaderKey('tracking', ['Número de rastreamento', 'Código de rastreio', 'Tracking Number']);
        fillMissingHeaderKey('date', ['Data de criação do pedido', 'Created Time']);
        fillMissingHeaderKey('dateShipping', ['Data prevista de envio', 'Data de envio prevista', 'Ship By Date']);
        fillMissingHeaderKey('shippingPaidByCustomer', ['Taxa de envio paga pelo comprador', 'Frete pago pelo comprador']);
        fillMissingHeaderKey('statusColumn', ['Status do pedido', 'Order Status']);
    } else {
        // SITE (TikTok / e-commerce próprio)
        fillMissingHeaderKey('orderId', ['Order ID', 'ID do pedido', 'N.º do pedido']);
        fillMissingHeaderKey('sku', ['Seller SKU', 'SKU', 'SKU ID', 'Número de referência SKU']);
        fillMissingHeaderKey('qty', ['Quantity', 'Quantidade', 'Unidades']);
        fillMissingHeaderKey('tracking', ['Tracking ID', 'Package ID', 'Número de rastreamento', 'Tracking Number']);
        fillMissingHeaderKey('date', ['Created Time', 'Data de criação do pedido', 'Paid Time', 'Data da venda']);
        fillMissingHeaderKey('statusColumn', ['Order Status', 'Status do pedido', 'Estado']);
    }

    // Hard fallback para Shopee (Data de envio) se não encontrar via config
    if (!headerKeyMap['dateShipping'] && canalDetectado === 'SHOPEE') {
        headerKeyMap['dateShipping'] = tryMatch('Data de envio') || tryMatch('Data de envio prevista');
    }

    // Diagnóstico: exibe mapeamento resolvido para cada campo
    console.debug('PARSER-DIAG: canal', canalDetectado, 'headerRow', headerRowIndex, 'totalRows', jsonData.length);
    console.debug('PARSER-DIAG: headerKeyMap', JSON.stringify(headerKeyMap));
    console.debug('PARSER-DIAG: mappingUsed.dateShipping', mappingToUse?.dateShipping, 'mappingUsed.statusColumn', mappingToUse?.statusColumn, 'acceptedStatusValues', mappingToUse?.acceptedStatusValues);
    console.debug('PARSER-DIAG: sheetKeys (first 15)', sheetKeys.slice(0, 15));
    if (jsonData[0]) console.debug('PARSER-DIAG: sampleRow[dateShipping]', headerKeyMap['dateShipping'] ? jsonData[0][headerKeyMap['dateShipping']!] : 'N/A', 'sampleRow[orderId]', headerKeyMap['orderId'] ? jsonData[0][headerKeyMap['orderId']!] : 'N/A', 'sampleRow[sku]', headerKeyMap['sku'] ? jsonData[0][headerKeyMap['sku']!] : 'N/A');

    // fees é array - encontrar múltiplas colunas
    const feeColumns: string[] = [];
    (mappingToUse!.fees || []).forEach((f: string) => {
        const fk = tryMatch(f);
        if (fk) feeColumns.push(fk);
    });

    const cleanMoney = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).trim().replace(/[R$\s\u00A0]/g, '');
        const hasComma = str.includes(',');
        const hasDot = str.includes('.');
        if (hasComma && hasDot) {
            if (str.indexOf('.') < str.indexOf(',')) { str = str.replace(/\./g, '').replace(',', '.'); }
            else { str = str.replace(/,/g, ''); }
        } else if (hasComma) { str = str.replace(',', '.'); }
        str = str.replace(/[^0-9.-]/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    };

    // --- Processamento das Linhas ---
    const existingKeys = new Set(allExistingOrders.map(o => `${safeUpper(o.orderId)}|${safeUpper(o.sku)}`));
    let orders: OrderItem[] = [];

    const statusColumnName = mappingToUse!.statusColumn;
    const acceptedStatusValues = (mappingToUse!.acceptedStatusValues || []).map(v => v.trim().toLowerCase());

    // Set for O(1) lookup
    const allowedDatesSet = options.allowedShippingDates ? new Set(options.allowedShippingDates) : null;
    const shouldApplyDateFilter = canalDetectado === 'SHOPEE';

    if (allowedDatesSet) console.debug('PARSER-DIAG: allowedDatesSet', Array.from(allowedDatesSet), 'shouldApplyDateFilter', shouldApplyDateFilter);

    // Detecta coluna de sob encomenda por cabeçalho configurável/tolerante.
    const madeToOrderHeaderTokens = ['SOB ENCOMENDA', 'MADE TO ORDER', 'MTO', 'ENCOMENDA'];
    const madeToOrderHeaderExclusions = ['NAO', 'NÃO'];
    const madeToOrderColumnKey = sheetKeys.find((k) => {
        const nk = normalizeHeaderToken(k);
        const hasToken = madeToOrderHeaderTokens.some(t => nk.includes(normalizeHeaderToken(t)));
        const hasExclusion = madeToOrderHeaderExclusions.some(t => nk.includes(normalizeHeaderToken(t)));
        return hasToken && !hasExclusion;
    });
    const madeToOrderTrueValues = new Set(['1', 'SIM', 'YES', 'TRUE', 'SOB ENCOMENDA', 'ENCOMENDA', 'MTO']);

    // TikTok: detecta coluna "Normal or Pre-order" para filtro
    const preOrderColumnKey = sheetKeys.find(k => normalizeHeaderToken(k).includes('NORMAL OR PRE'));
    const tiktokOrderType = options.tiktokOrderType || 'all';

    // TikTok: detecta linhas de descrição (segunda linha da planilha que contém textos explicativos)
    const isTikTokDescriptionRow = (row: any): boolean => {
        if (canalDetectado !== 'SITE') return false;
        const orderIdVal = String(row[headerKeyMap['orderId']] || '');
        const qtyVal = String(row[headerKeyMap['qty']] || '');
        // Linhas de descrição TikTok contêm texto longo explicativo no OrderID
        // e o campo de quantidade NÃO é numérico
        return (orderIdVal.length > 20 && /^[a-zA-Z\s'.]+$/.test(orderIdVal)) || (qtyVal.length > 3 && isNaN(Number(qtyVal)));
    };

    let _skipDate = 0, _skipStatus = 0, _skipNoId = 0, _skipQty = 0, _skipTiktok = 0;

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Pula linhas de descrição (TikTok tem uma linha de descrição logo após o cabeçalho)
        if (isTikTokDescriptionRow(row)) { _skipTiktok++; continue; }

        // --- FILTRO TIKTOK NORMAL/PRE-ORDER ---
        if (preOrderColumnKey && tiktokOrderType !== 'all') {
            const preOrderVal = safeUpper(row[preOrderColumnKey]);
            if (tiktokOrderType === 'normal' && preOrderVal !== 'NORMAL') continue;
            if (tiktokOrderType === 'pre-order' && !preOrderVal.includes('PRE')) continue;
        }

        // --- FILTRO DE DATA ---
        const dataEnvioStr = normalizeDate(row[headerKeyMap['dateShipping']]);
        const dataVendaStr = normalizeDate(row[headerKeyMap['date']]);

        // Filtro por data de envio selecionada (Shopee).
        // Prioridade: data de envio. Se indisponível para esta linha, usa data de venda como fallback.
        // Se nenhuma data parseável, inclui o pedido (não rejeitar por falta de dados).
        if (shouldApplyDateFilter && allowedDatesSet && allowedDatesSet.size > 0) {
            const dateToCheck = dataEnvioStr || dataVendaStr;
            if (dateToCheck && !allowedDatesSet.has(dateToCheck)) {
                _skipDate++;
                continue;
            }
        }

        // --- Filtro de Status ---
        let statusParaImportacao: any = forcedStatus || 'NORMAL';
        let errorReason = undefined;

        if (!forcedStatus && madeToOrderColumnKey) {
            const rawMadeToOrder = safeUpper(row[madeToOrderColumnKey]);
            const normalizedMadeToOrder = normalizeHeaderToken(rawMadeToOrder);
            const isMadeToOrder = !rawMadeToOrder || madeToOrderTrueValues.has(rawMadeToOrder) || madeToOrderTrueValues.has(normalizedMadeToOrder);

            if (isMadeToOrder) {
                statusParaImportacao = 'ERRO';
                errorReason = 'SOB_ENCOMENDA';
            }
        }

        const resolvedStatusCol = headerKeyMap['statusColumn'];
        if (statusColumnName && acceptedStatusValues.length > 0 && resolvedStatusCol) {
            const rawStatus = String(row[resolvedStatusCol] || '').trim().toLowerCase();
            const isAccepted = acceptedStatusValues.includes(rawStatus);
            if (!isAccepted) {
                if (_skipStatus < 3) console.debug('PARSER-DIAG: status rejected row', i, 'rawStatus:', JSON.stringify(rawStatus), 'accepted:', JSON.stringify(acceptedStatusValues), 'resolvedCol:', resolvedStatusCol);
                _skipStatus++;
                continue;
            }
        }

        const orderId = safeUpper(row[headerKeyMap['orderId']]);
        const sku = safeUpper(row[headerKeyMap['sku']]);

        if (!orderId || !sku) { _skipNoId++; continue; }

        const qty_raw = Number(row[headerKeyMap['qty']] || 0);
        if (isNaN(qty_raw) || qty_raw <= 0) { _skipQty++; continue; }

        // --- Valores Financeiros ---
        let rawTotalValue = mappingToUse!.totalValue ? cleanMoney(row[headerKeyMap['totalValue']]) : 0;
        let rawPriceColumn = mappingToUse!.priceGross ? cleanMoney(row[headerKeyMap['priceGross']]) : 0;

        if (rawTotalValue === 0 && rawPriceColumn > 0) rawTotalValue = rawPriceColumn;
        else if (rawTotalValue > 0 && rawPriceColumn === 0) rawPriceColumn = rawTotalValue;

        const customerShipping = mappingToUse!.shippingPaidByCustomer ? Math.abs(cleanMoney(row[headerKeyMap['shippingPaidByCustomer']])) : 0;
        const sellerShipping = mappingToUse!.shippingFee ? Math.abs(cleanMoney(row[headerKeyMap['shippingFee']])) : 0;

        const fees = feeColumns.reduce((sum, col) => {
            const val = Math.abs(cleanMoney(row[col]));
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        let calculatedTotal = 0;
        let calculatedProduct = 0;

        if (rawTotalValue > 0) {
            calculatedTotal = rawTotalValue;
            calculatedProduct = Math.max(0, calculatedTotal - customerShipping);
        } else {
            calculatedProduct = rawPriceColumn;
            calculatedTotal = calculatedProduct + customerShipping;
        }

        const calculatedNet = cleanMoney(row[mappingToUse!.priceNet]) || (calculatedProduct - fees - sellerShipping);
        const mult = getMultiplicadorFromSku(sku);

        orders.push({
            id: `${canalDetectado}_${Date.now()}_${i}`,
            orderId,
            tracking: safeUpper(row[headerKeyMap['tracking']]),
            sku,
            qty_original: qty_raw,
            multiplicador: mult,
            qty_final: Math.round(qty_raw * mult),
            color: classificarCor(sku),
            canal: canalDetectado!,
            data: dataVendaStr,
            data_prevista_envio: dataEnvioStr || undefined,
            status: statusParaImportacao,
            error_reason: errorReason,
            customer_name: options.importName ? String(row[headerKeyMap['customerName']] || '') : undefined,
            customer_cpf_cnpj: options.importCpf ? String(row[headerKeyMap['customerCpf']] || '') : undefined,
            venda_origem: canalDetectado!,
            id_pedido_loja: orderId,

            price_total: calculatedTotal,
            price_gross: calculatedProduct,
            price_net: calculatedNet,

            platform_fees: fees,
            shipping_fee: sellerShipping,
            shipping_paid_by_customer: customerShipping,
            descontar_volatil: options.descontarVolatil,
        });
    }

    if (orders.length === 0) {
        console.error('PARSER-DIAG: 0 orders! skipDate', _skipDate, 'skipStatus', _skipStatus, 'skipNoId', _skipNoId, 'skipQty', _skipQty, 'skipTiktok', _skipTiktok, 'allowedDates', options.allowedShippingDates, 'columnOverrides', options.columnOverrides);

        // Auto-recovery: se TODOS os pedidos foram rejeitados pelo filtro de status,
        // re-processa ignorando o filtro para não bloquear o usuário.
        if (_skipStatus > 0 && _skipStatus >= (jsonData.length - _skipTiktok - _skipDate)) {
            // Coleta valores de status únicos encontrados na planilha para log/diagnóstico
            const resolvedStatusCol = headerKeyMap['statusColumn'];
            const foundStatuses = new Set<string>();
            if (resolvedStatusCol) {
                for (let j = 0; j < Math.min(jsonData.length, 200); j++) {
                    const v = String(jsonData[j]?.[resolvedStatusCol] || '').trim();
                    if (v) foundStatuses.add(v);
                }
            }
            console.warn(`PARSER-RECOVERY: Filtro de status rejeitou ${_skipStatus} linhas. Status na planilha: [${Array.from(foundStatuses).join(', ')}]. Aceitos: [${acceptedStatusValues.join(', ')}]. Re-processando SEM filtro de status.`);

            // Re-processa sem filtro de status
            orders = [];
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (isTikTokDescriptionRow(row)) continue;
                if (preOrderColumnKey && tiktokOrderType !== 'all') {
                    const preOrderVal = safeUpper(row[preOrderColumnKey]);
                    if (tiktokOrderType === 'normal' && preOrderVal !== 'NORMAL') continue;
                    if (tiktokOrderType === 'pre-order' && !preOrderVal.includes('PRE')) continue;
                }
                const dataEnvioStr = normalizeDate(row[headerKeyMap['dateShipping']]);
                const dataVendaStr = normalizeDate(row[headerKeyMap['date']]);
                if (shouldApplyDateFilter && allowedDatesSet && allowedDatesSet.size > 0) {
                    const dateToCheck = dataEnvioStr || dataVendaStr;
                    if (dateToCheck && !allowedDatesSet.has(dateToCheck)) continue;
                }
                let statusParaImportacao: any = forcedStatus || 'NORMAL';
                let errorReason = undefined;
                if (!forcedStatus && madeToOrderColumnKey) {
                    const rawMadeToOrder = safeUpper(row[madeToOrderColumnKey]);
                    const normalizedMadeToOrder = normalizeHeaderToken(rawMadeToOrder);
                    const isMadeToOrder = !rawMadeToOrder || madeToOrderTrueValues.has(rawMadeToOrder) || madeToOrderTrueValues.has(normalizedMadeToOrder);
                    if (isMadeToOrder) { statusParaImportacao = 'ERRO'; errorReason = 'SOB_ENCOMENDA'; }
                }
                // SKIP status filter in recovery
                const orderId = safeUpper(row[headerKeyMap['orderId']]);
                const sku = safeUpper(row[headerKeyMap['sku']]);
                if (!orderId || !sku) continue;
                const qty_raw = Number(row[headerKeyMap['qty']] || 0);
                if (isNaN(qty_raw) || qty_raw <= 0) continue;
                let rawTotalValue = mappingToUse!.totalValue ? cleanMoney(row[headerKeyMap['totalValue']]) : 0;
                let rawPriceColumn = mappingToUse!.priceGross ? cleanMoney(row[headerKeyMap['priceGross']]) : 0;
                if (rawTotalValue === 0 && rawPriceColumn > 0) rawTotalValue = rawPriceColumn;
                else if (rawTotalValue > 0 && rawPriceColumn === 0) rawPriceColumn = rawTotalValue;
                const customerShipping = mappingToUse!.shippingPaidByCustomer ? Math.abs(cleanMoney(row[headerKeyMap['shippingPaidByCustomer']])) : 0;
                const sellerShipping = mappingToUse!.shippingFee ? Math.abs(cleanMoney(row[headerKeyMap['shippingFee']])) : 0;
                const fees = feeColumns.reduce((sum, col) => sum + (Math.abs(cleanMoney(row[col])) || 0), 0);
                let calculatedTotal = 0, calculatedProduct = 0;
                if (rawTotalValue > 0) { calculatedTotal = rawTotalValue; calculatedProduct = Math.max(0, calculatedTotal - customerShipping); }
                else { calculatedProduct = rawPriceColumn; calculatedTotal = calculatedProduct + customerShipping; }
                const calculatedNet = cleanMoney(row[mappingToUse!.priceNet]) || (calculatedProduct - fees - sellerShipping);
                const mult = getMultiplicadorFromSku(sku);
                orders.push({
                    id: `${canalDetectado}_${Date.now()}_${i}`,
                    orderId, tracking: safeUpper(row[headerKeyMap['tracking']]), sku,
                    qty_original: qty_raw, multiplicador: mult, qty_final: Math.round(qty_raw * mult),
                    color: classificarCor(sku), canal: canalDetectado!,
                    data: dataVendaStr, data_prevista_envio: dataEnvioStr || undefined,
                    status: statusParaImportacao, error_reason: errorReason,
                    customer_name: options.importName ? String(row[headerKeyMap['customerName']] || '') : undefined,
                    customer_cpf_cnpj: options.importCpf ? String(row[headerKeyMap['customerCpf']] || '') : undefined,
                    venda_origem: canalDetectado!, id_pedido_loja: orderId,
                    price_total: calculatedTotal, price_gross: calculatedProduct, price_net: calculatedNet,
                    platform_fees: fees, shipping_fee: sellerShipping,
                    shipping_paid_by_customer: customerShipping, descontar_volatil: options.descontarVolatil,
                });
            }
        }

        if (orders.length === 0) {
            throw new Error('Nenhum pedido importado. Verifique se as datas selecionadas contêm pedidos ou se o mapeamento está correto.');
        }
    }

    const jaSalvos = orders.filter(o => existingKeys.has(`${safeUpper(o.orderId)}|${safeUpper(o.sku)}`)).length;

    // Agregação por SKU (ignora cor): deduplicação por SKU principal apenas
    const skuAggregation = new Map<string, OrderItem[]>();
    orders.forEach(order => {
        const skuKey = safeUpper(order.sku);
        if (!skuAggregation.has(skuKey)) {
            skuAggregation.set(skuKey, []);
        }
        skuAggregation.get(skuKey)!.push(order);
    });

    // Gerar lista resumida (consolidado por SKU com distribuição de qtds)
    const resumida: ResumidaItem[] = Array.from(skuAggregation.entries()).map(([sku, ordersList]) => {
        const totalQty = ordersList.reduce((sum, o) => sum + o.qty_final, 0);
        const color = ordersList[0]?.color || '';

        // Calcular distribuição: quantas vezes cada quantidade aparece
        const distribution: { [qty: number]: number } = {};
        ordersList.forEach(o => {
            distribution[o.qty_final] = (distribution[o.qty_final] || 0) + 1;
        });

        return {
            sku,
            color,
            distribution,
            total_units: totalQty,
        };
    });

    // Totais por cor (baseado nos pedidos originais, não no resumo)
    const totaisPorCor: any[] = [];
    const corMap = new Map<string, { color: string; qty_final: number; qty_original: number; price_total: number; price_gross: number; price_net: number }>();
    orders.forEach(order => {
        const cor = order.color || 'SEM_COR';
        if (!corMap.has(cor)) {
            corMap.set(cor, { color: cor, qty_final: order.qty_final, qty_original: order.qty_original, price_total: order.price_total, price_gross: order.price_gross, price_net: order.price_net });
        } else {
            const existing = corMap.get(cor)!;
            existing.qty_final += order.qty_final;
            existing.qty_original += order.qty_original;
            existing.price_total += order.price_total;
            existing.price_gross += order.price_gross;
            existing.price_net += order.price_net;
        }
    });
    Array.from(corMap.values()).forEach(item => totaisPorCor.push(item));

    return {
        importId: `imp_${Date.now()}`,
        canal: canalDetectado!,
        lists: { completa: orders, resumida, totaisPorCor },
        skusNaoVinculados: Array.from(new Set(orders.map(o => o.sku))).map(sku => {
            const baseType = classificarTipoBase(sku);
            const isMiudo = isItemMenor(sku);
            return {
                sku,
                colorSugerida: classificarCor(sku),
                baseSugerida: baseType,
                isMiudoSugerido: isMiudo
            };
        }),
        idempotencia: { lancaveis: orders.length, jaSalvos },
        summary: {
            totalPedidos: new Set(orders.map(o => o.orderId)).size,
            totalPacotes: orders.length,
            totalUnidades: orders.reduce((s, o) => s + o.qty_final, 0),
            totalUnidadesBranca: 0, totalUnidadesPreta: 0, totalUnidadesEspecial: 0, totalMiudos: 0
        }
    };
};
