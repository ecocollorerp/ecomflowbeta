// ============================================================================
// services/txtOfflineService.ts 
// Serviço responsável pela geração de TXT compactos de operações diárias
// ============================================================================

export interface LogDiarioItem {
    id: string;
    acao: string;
    detalhes: string;
    status: 'SUCESSO' | 'ERRO' | 'PENDENTE';
    timestamp: string;
    marketplace?: string;
    rastreio?: string;
    nfe?: string;
}

export const gerarBackupTxtDiario = (logs: LogDiarioItem[], dataReferencia: Date = new Date()): void => {

    const dataFormatada = dataReferencia.toLocaleDateString('pt-BR');
    let conteudo = `=== BACKUP OFFLINE DIÁRIO - ECOMFLOW BETA ===\n`;
    conteudo += `Data de Referência: ${dataFormatada}\n`;
    conteudo += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
    conteudo += `==============================================\n\n`;

    // Estatísticas Iniciais
    const total = logs.length;
    const sucessos = logs.filter(l => l.status === 'SUCESSO').length;
    const erros = logs.filter(l => l.status === 'ERRO').length;
    const pendentes = logs.filter(l => l.status === 'PENDENTE').length;

    conteudo += `[RESUMO]\n`;
    conteudo += `Total de Operações: ${total}\n`;
    conteudo += `✅ SUCESSO: ${sucessos}\n`;
    conteudo += `🔴 ERROS: ${erros}\n`;
    conteudo += `⚠️ PENDENTES: ${pendentes}\n\n`;

    // Agrupamento por Marketplace (se aplicável)
    const porMarketplace = logs.reduce((acc, log) => {
        const mkp = log.marketplace || 'OUTROS';
        if (!acc[mkp]) acc[mkp] = [];
        acc[mkp].push(log);
        return acc;
    }, {} as Record<string, LogDiarioItem[]>);

    // Listagem Detalhada
    conteudo += `[DETALHAMENTO POR CANAL]\n`;
    for (const mkp of Object.keys(porMarketplace)) {
        conteudo += `\n--- ${mkp.toUpperCase()} ---\n`;
        const itensMkp = porMarketplace[mkp];

        for (const item of itensMkp) {
            const timeStr = new Date(item.timestamp).toLocaleTimeString('pt-BR');
            const nfeTag = item.nfe ? ` [NFe: ${item.nfe}]` : '';
            const trackTag = item.rastreio ? ` [Rastreio: ${item.rastreio}]` : '';
            conteudo += `[${timeStr}] [${item.status}] ${item.acao} -> ${item.detalhes}${nfeTag}${trackTag}\n`;
        }
    }

    // Trigger de Download nativo do Browser
    const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dStr = dataReferencia.toISOString().split('T')[0];
    a.download = `EcomFlow_Backup_Diario_${dStr}.txt`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
