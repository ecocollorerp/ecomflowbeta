
/**
 * Utilitários para manipulação e mesclagem de comandos ZPL.
 */

/**
 * Limpa um bloco ZPL removendo espaços extras e garantindo que termine corretamente.
 */
export const cleanZpl = (zpl: string): string => {
    return zpl.trim();
};

/**
 * Extrai apenas o corpo de um comando ZPL (entre ^XA e ^XZ), 
 * ignorando comandos de configuração global se houver.
 */
export const extractZplBody = (zpl: string): string => {
    const start = zpl.indexOf('^XA');
    const end = zpl.lastIndexOf('^XZ');
    if (start === -1 || end === -1) return zpl;
    // Retorna sem o ^XA e ^XZ para poder concatenar livremente ou manipular
    return zpl.substring(start + 3, end).trim();
};

/**
 * Lógica de "50%": Mescla dois blocos ZPL removendo o rodapé de um 
 * e o cabeçalho de outro se necessário, ou apenas concatenando
 * garantindo que fiquem na mesma etiqueta física se o driver suportar.
 */
export const calculate50PercentFill = (block1: string, block2: string): string => {
    const body1 = extractZplBody(block1);
    const body2 = extractZplBody(block2);

    // Mesclamos os dois corpos dentro de um único par ^XA ... ^XZ
    // Para que fiquem na mesma etiqueta física.
    return `^XA
${body1}
${body2}
^XZ`;
};

/**
 * Mescla múltiplos blocos ZPL em um único conteúdo.
 */
export const mergeZplBlocks = (blocks: string[]): string => {
    return blocks
        .map(block => cleanZpl(block))
        .filter(block => block.length > 0)
        .join('\n');
};

/**
 * Verifica se um conteúdo parece ser ZPL válido (básico).
 */
export const isValidZpl = (content: string): boolean => {
    const trimmed = content.trim();
    return trimmed.startsWith('^XA') && (trimmed.endsWith('^XZ') || trimmed.includes('^XZ'));
};
