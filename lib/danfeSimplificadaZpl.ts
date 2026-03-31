/**
 * Gerador de DANFE Simplificada em formato ZPL para impressoras térmicas.
 * Gera a partir de dados JSON da NF-e (não precisa de XML).
 * Layout idêntico ao padrão real de DANFE Simplificada - Etiqueta:
 *   logo esquerda, dados empresa direita, código de barras Code128 (^BC),
 *   chave formatada, protocolo, itens, totais, consumidor, info adicional.
 * Usa ^GFA para linhas gráficas, ^AAN/^A0N para fontes, ^FH\ para acentos.
 */

// ═══════════════════════════════════════════════════════════════════════
// LOGO ECOCOLLOR em formato GRF (^GFA) — posicionado no label
// ═══════════════════════════════════════════════════════════════════════
const ECOCOLLOR_LOGO_GFA = `^GFA,3008,3008,32,,:::::::::::::::::::::::::hU01,hU03,hU07,hU0F,hT01F,hT03F8,:gR0703CX07FC,gR0783CX0FFC,gR0783CW01FFE,gR0783CW01IF,gR0783CW03IF,gR0783CW03FBF8,gR0783CW07F3F8,J03P01M06N0783CW07F1FC,I03FFI07FC003FFK07FC001FF00783C00FFC01C78M0FF1FC,I07FFC01IF007FFCI01IF007FFC0783C01IF03FF8M0FF1FC,I0F87E03F9F81IFEI03F9F80IFE0783C03IF83FF8M0FF1FC,001F01F07C07C1F03FI07E07C1F81F0783C07C0FC3FCK0200FF0FE,003E00F0F803C3E01FI07C03E3E00F8783C0F807C3F8K0C00FF8FE,003C00F8F00107C00F800F8I03E00F8783C0F003E3FO0FF8FE,003C0078FJ07800F800F8I03C0078783C1F001E1EO0FF8FE,007E00F8FJ078007800FJ03C007C783C1E001E1EM040FF8FC,007JF9EJ078007800FJ078003C783C1E001F1EK01I0FF8FC,007JF9EJ078007800FJ078003C783C1E001F3CL0400FF8FC,007C0081EJ078007800FJ078007C783C1E001F3CK022007FCF8008,0078I01EJ078007800FJ078007C783C1E001E1CK047807FCF0048,007CJ0FJ078007800FJ03C007C783C1E001E1CK019803F8E019,003CJ0FJ07C00F800F8I03C0078783C1F003E3CO03F8C008,003E00F0F803E3C00F8007803E3E00F8783C0F803E3CO01F88024,003F01F07C07C3E01FI07C03C1F01F0783E0F807C3CP0F8,001FC7E07E0FC1FC7EI03F0FC1FC7F07E3F87F3FC3CP07K028,I0IFC03IF80IFCI01IF80IFE07F3F83IF83CP03I01018,I07FF801IF007FF8J0IF007FFC03F1F81FFE01CT0A0C,I01FEI07FC001FEK03FC001FF001F0F807FC01CT0802,hT08001,hS01,hS02,,:::::::::::::::::::::::::::::`;

// Linha gráfica (separador) — mesmo padrão do DANFE real
const LINE_GFA = "^GFA,7,184,90,nYFEJ0:";

export interface DanfeZplData {
  // NF-e
  numero: string;
  serie: string;
  chaveAcesso: string; // somente dígitos
  protocolo: string;
  dataEmissao: string;
  // Emitente
  emitRazao: string;
  emitCnpj: string;
  emitIe: string;
  emitEndereco: string; // endereço completo em 1 string
  // Destinatário / Consumidor
  destNome: string;
  destDoc: string;
  destEndereco: string;
  // Itens (descrição completa com qtd/un/valor unitário + valor total)
  itens: Array<{
    descricaoCompleta: string; // "CODIGO - Descrição - QTD UN X vUnit"
    vTotal: number;
  }>;
  // Totais
  qtdItens: number;
  descAcresc: number; // acréscimos - desconto (pode ser negativo)
  vDesc: number;      // desconto puro da NF-e (para exibir label correto)
  acrescimos: number; // IPI + ST + frete + seguro + outras
  vNF: number;
  // Tributos
  tributos: string;
}

/**
 * Formata número para Real brasileiro (2 casas decimais, separador vírgula)
 */
function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseMoneyLike(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  let normalized = raw.replace(/[^\d,.-]/g, "");
  if (!normalized) return 0;

  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Formata CNPJ/CPF com pontuação
 */
function fmtDoc(v: string): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5"
    );
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
}

/**
 * Formata chave de acesso em blocos de 4 dígitos
 */
function fmtChave(chave: string): string {
  return chave.replace(/(\d{4})/g, "$1 ").trim();
}

/**
 * Formata data ISO para dd/mm/aaaa HH:mm:ss
 */
function fmtData(d: string): string {
  if (!d) return "";
  const iso = d.replace(" ", "T");
  const parts = iso.split("T");
  const dateParts = parts[0].split("-");
  const dateStr = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : parts[0];
  const timeStr = parts[1] ? parts[1].substring(0, 8) : "";
  return timeStr ? `${dateStr} ${timeStr}` : dateStr;
}

/**
 * Formata data ISO para apenas dd/mm/aaaa
 */
function fmtDataCurta(d: string): string {
  if (!d) return "";
  const parts = d.replace(" ", "T").split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

/**
 * Escapa caracteres acentuados para ^FH\ no ZPL (hex encoding).
 * Ex: "í" → \\a1, "ã" → \\c6o, "ç" → \\87 etc.
 */
function zplEscape(s: string): string {
  // Mapa de caracteres comuns em português para hex ZPL (ISO 8859-1)
  const map: Record<string, string> = {
    "á": "\\a0", "à": "\\85", "â": "\\83", "ã": "\\c6", "ä": "\\84",
    "é": "\\82", "è": "\\8a", "ê": "\\88", "ë": "\\89",
    "í": "\\a1", "ì": "\\8d", "î": "\\8c", "ï": "\\8b",
    "ó": "\\a2", "ò": "\\97", "ô": "\\93", "õ": "\\b5", "ö": "\\94",
    "ú": "\\a3", "ù": "\\eb", "û": "\\96", "ü": "\\81",
    "ç": "\\87", "Ç": "\\80",
    "Á": "\\c1", "À": "\\b7", "Â": "\\b6", "Ã": "\\c7",
    "É": "\\90", "Ê": "\\d2",
    "Í": "\\d6", "Ó": "\\e0", "Ô": "\\e2", "Õ": "\\e5",
    "Ú": "\\e9",
    "ñ": "\\a4", "Ñ": "\\a5",
    "°": "\\f8",
    "ª": "\\a6", "º": "\\a7",
  };
  let result = "";
  for (const c of s) {
    result += map[c] || c;
  }
  return result;
}

/**
 * Converte dados da NF-e (JSON do Bling) para DanfeZplData.
 * Aceita tanto o detalhe da NF-e quanto dados já enriquecidos (nfeSaida).
 */
export function nfeJsonToDanfeZplData(nfeDetail: any, nfeSaida?: any): DanfeZplData {
  const d = nfeDetail?.data || nfeDetail || {};
  const contato = d.contato || nfeSaida?.contato || {};
  const enderDest = contato?.endereco || {};
  const emitente = d.emitente || {};
  const enderEmit = emitente?.endereco || {};

  // Extrair itens da NF-e
  const itensRaw = d.itens || d.produtos || [];
  const itens = itensRaw.map((item: any) => {
    const prod = item.produto || item;
    const codigo = prod.codigo || prod.cProd || "";
    const desc = prod.descricao || prod.xProd || "";
    const qtd = parseMoneyLike(prod.quantidade || prod.qCom || "1");
    const un = prod.unidade || prod.uCom || "UN";
    const vUnit = parseMoneyLike(prod.valorUnitario || prod.vUnCom || "0");
    const vTotal = parseMoneyLike(prod.valor || prod.vProd || "0");
    const vDescItem = parseMoneyLike(
      prod.vDesc ||
      prod.valorDesconto ||
      item.vDesc ||
      item.valorDesconto ||
      item.desconto ||
      item.discount ||
      0
    );
    // Formato: "CODIGO - Desc - QTD UN X vUnit"
    const descCompleta = `${codigo} - ${desc} - ${fmtBRL(qtd)} ${un} X ${fmtBRL(vUnit)}${vDescItem > 0 ? ` - DESC ${fmtBRL(vDescItem)}` : ""}`;
    return { descricaoCompleta: descCompleta, vTotal, vDescItem };
  });

  // Totais
  const totais = d.totais || d.total?.ICMSTot || {};
  const vFrete = parseMoneyLike(totais.vFrete || d.valorFrete || "0");
  const vDescTotais = parseMoneyLike(totais.vDesc || d.valorDesconto || "0");
  const vIPI = parseMoneyLike(totais.vIPI || "0");
  const vST = parseMoneyLike(totais.vST || "0");
  const vSeg = parseMoneyLike(totais.vSeg || "0");
  const vOutro = parseMoneyLike(totais.vOutro || "0");
  const vNF = parseMoneyLike(totais.vNF || d.valorNota || nfeSaida?.valorTotal || "0");
  const vDescItens = itens.reduce((sum, it: any) => sum + parseMoneyLike(it.vDescItem), 0);
  const vDesc = vDescTotais > 0 ? vDescTotais : vDescItens;

  // Acréscimos (IPI + ST + Frete + Seguro + Outras) - Desconto
  const acrescimos = vIPI + vST + vFrete + vSeg + vOutro;
  const descAcresc = acrescimos - vDesc;

  // Protocolo de autorização
  const protocolo =
    d.protocoloAutorizacao ||
    d.sefazEnvio?.protocoloAutorizacao ||
    d.protocolo ||
    "";

  // Endereço emitente em string única
  const emitEndereco = enderEmit.logradouro
    ? `${enderEmit.logradouro}, ${enderEmit.numero || "S/N"}, ${enderEmit.complemento || ""}, ${enderEmit.bairro || ""} ${enderEmit.municipio || ""} - ${enderEmit.uf || ""}`.replace(/, ,/g, ",").replace(/,\s*$/, "")
    : "";

  // Destinatário / Consumidor
  const destDoc = fmtDoc(contato.cnpj || contato.cpf || contato.numeroDocumento || "");
  const destNome = contato.nome || contato.nomeRazaoSocial || nfeSaida?.contato?.nome || "";
  const destEndParts: string[] = [];
  if (enderDest.logradouro) destEndParts.push(`${enderDest.logradouro}, ${enderDest.numero || "S/N"}`);
  if (enderDest.complemento) destEndParts.push(enderDest.complemento);
  if (enderDest.bairro) destEndParts.push(enderDest.bairro);
  const destCidUf = [enderDest.municipio, enderDest.uf].filter(Boolean).join(" - ");
  if (destCidUf) destEndParts.push(destCidUf);
  const destEndereco = destEndParts.join(", ");

  // Tributos (informação adicional)
  const vTotTrib = parseMoneyLike(totais.vTotTrib || "0");
  const tributosStr = vTotTrib > 0
    ? `Total aproximado de tributos: R$ ${fmtBRL(vTotTrib)}. Fonte IBPT.`
    : "";

  return {
    numero: d.numero || nfeSaida?.numero || "",
    serie: d.serie || nfeSaida?.serie || "1",
    chaveAcesso: (d.chaveAcesso || nfeSaida?.chaveAcesso || "").replace(/\D/g, ""),
    protocolo,
    dataEmissao: d.dataEmissao || nfeSaida?.dataEmissao || "",
    emitRazao: emitente.nomeRazaoSocial || emitente.nome || "ECOCOLLOR REVESTIMENTOS E DECORACAO LTDA",
    emitCnpj: fmtDoc(emitente.cnpj || emitente.cpf || "35635824000112"),
    emitIe: emitente.ie || "392462791110",
    emitEndereco,
    destNome,
    destDoc,
    destEndereco,
    itens,
    qtdItens: itens.length,
    descAcresc,
    vDesc,
    acrescimos,
    vNF,
    tributos: tributosStr,
  };
}

/**
 * Gera DANFE Simplificada em formato ZPL para impressora térmica.
 *
 * Reproduz fielmente o layout padrão de DANFE Simplificada - Etiqueta
 * usado em impressoras térmicas Zebra (ZPL II), com:
 *   - Setup ^XA~TA000~JSN...
 *   - Título centrado
 *   - Logo GFA à esquerda + dados empresa à direita
 *   - Código de barras Code128 (^BC) com chave de acesso
 *   - Chave formatada em blocos de 4
 *   - Protocolo + data, TIPO, número NF-e, série, data emissão
 *   - Tabela de itens (ITEM | VL. ITEM)
 *   - Totais: QTD TOTAL, ACRÉSCIMOS/DESCONTO, VALOR NOTA
 *   - Seção CONSUMIDOR
 *   - INFORMAÇÕES ADICIONAIS (tributos IBPT)
 *
 * Largura: 799 dots (~4" a 203dpi)
 */
export interface DanfeZplOptions {
  offsetTop?: number;   // deslocamento vertical em dots (padrão 0)
  offsetLeft?: number;  // deslocamento horizontal em dots (padrão 0)
  showLogo?: boolean;   // exibir logo ECOCOLLOR (padrão true)
}

export function gerarDanfeSimplificadaZPL(data: DanfeZplData, opts?: DanfeZplOptions): string {
  const oT = opts?.offsetTop ?? 0;
  const oL = opts?.offsetLeft ?? 0;
  const showLogo = opts?.showLogo !== false;
  const l: string[] = [];

  // ── Setup do label (idêntico ao padrão real) — ^LH aplica offset global ──
  l.push(`^XA~TA000~JSN^LT0^MNW^PON^PMN^LH${oL},${oT}^JMA^PR2,2~SD15^JUS^LRN^PA0,1,1,0^MMT^PW799^LL1199^LS0^MTT`);

  // ── Linha gráfica + título centrado ──
  l.push(`^FO40,30${LINE_GFA}`);
  l.push(`^FPH,1^FO0,45^A0N,17,18^FB799,1,4,C^FH\\^FDDANFE Simplificado - Etiqueta^FS`);
  l.push(`^FO40,67${LINE_GFA}`);

  // ── Logo ECOCOLLOR à esquerda (opcional) ──
  if (showLogo) {
    l.push(`^FO60,99${ECOCOLLOR_LOGO_GFA}`);
  }

  // ── Dados empresa à direita ──
  l.push(`^FO350,111^AAN,18,10^FB410,5,5,^FH\\^FD${zplEscape(data.emitRazao)}^FS`);
  l.push(`^FO350,155^AAN,18,10^FH\\^FDCNPJ:^FS^FO408,155^AAN,18,10^FH\\^FD${data.emitCnpj}^FS`);
  l.push(`^FO350,177^AAN,18,10^FH\\^FDIE:^FS^FO382,177^AAN,18,10^FH\\^FD${data.emitIe}^FS`);
  l.push(`^FO350,199^AAN,18,10^FB410,5,5,^FH\\^FD${zplEscape(data.emitEndereco)}^FS`);

  // ── Linha separadora ──
  l.push(`^FO40,265${LINE_GFA}`);

  // ── Código de barras Code 128 da chave de acesso ──
  l.push(`^BY2,3,80^FO120,287^BCN,,N,N^FH\\^FD>;${data.chaveAcesso}^FS`);

  // ── Chave formatada abaixo do barcode ──
  l.push(`^FO0,377^AAN,18,10^FB800,1,0,C^FH\\^FD${fmtChave(data.chaveAcesso)}^FS`);

  // ── Protocolo de autorização ──
  l.push(`^FO0,399^A0N,14,15^FB800,1,4,C^FH\\^FDProtocolo de autoriza${zplEscape("çã")}o de uso^FS`);
  l.push(`^FO0,421^AAN,18,10^FB800,1,0,C^FH\\^FD${data.protocolo} ${fmtData(data.dataEmissao)}^FS`);

  // ── TIPO, Número NF-e, Série ──
  l.push(`^FO0,443^AAN,18,10^FB800,1,0,C^FH\\^FDTIPO:1 - Sa${zplEscape("í")}da|N${zplEscape("º")} NFe:${data.numero}|SERIE:${data.serie}^FS`);

  // ── Data de emissão ──
  l.push(`^FO0,465^AAN,18,10^FB800,1,0,C^FH\\^FDData de emiss${zplEscape("ã")}o: ${fmtDataCurta(data.dataEmissao)}^FS`);

  // ── Linha separadora antes dos itens ──
  let y = 497;
  l.push(`^FO40,${y}${LINE_GFA}`);
  y += 22;

  // ── Header itens ──
  l.push(`^FPH,1^FO40,${y}^A0N,17,18^FH\\^FDITEM^FS`);
  l.push(`^FPH,1^FO0,${y}^A0N,17,18^FB757,1,4,R^FH\\^FDVL. ITEM^FS`);
  y += 22;

  // ── Itens dinâmicos ──
  const maxItens = Math.min(data.itens.length, 15);
  for (let i = 0; i < maxItens; i++) {
    const it = data.itens[i];
    // Descrição multilinha à esquerda (FB 550 wide, até 5 linhas)
    l.push(`^FO40,${y}^AAN,18,10^FB550,5,5^FH\\^FD${zplEscape(it.descricaoCompleta)}^FS`);
    // Valor à direita
    l.push(`^FO0,${y}^AAN,18,10^FB759,1,0,R^FH\\^FD${fmtBRL(it.vTotal)}^FS`);
    // Avança Y dependendo do comprimento da descrição
    const descLen = it.descricaoCompleta.length;
    y += descLen > 80 ? 76 : descLen > 50 ? 54 : 32;
  }
  if (data.itens.length > maxItens) {
    l.push(`^FO40,${y}^AAN,18,10^FH\\^FD... +${data.itens.length - maxItens} iten(s)^FS`);
    y += 22;
  }

  // ── Linha separadora antes dos totais ──
  l.push(`^FO40,${y}${LINE_GFA}`);
  y += 22;

  // ── QTD. TOTAL DE ITENS ──
  l.push(`^FO40,${y}^AAN,18,10^FH\\^FDQTD. TOTAL DE ITENS^FS`);
  l.push(`^FO0,${y}^AAN,18,10^FB759,1,0,R^FH\\^FD${data.qtdItens}^FS`);
  y += 22;

  // ── ACRÉSCIMOS / DESCONTO ──
  // Se o líquido é negativo (desconto > acréscimos), mostra label "DESCONTO"
  if (data.descAcresc !== 0 || data.vDesc > 0 || data.acrescimos > 0) {
    const isNetDesconto = data.descAcresc < 0 || (data.vDesc > 0 && data.acrescimos === 0);
    const labelAcrDesc = isNetDesconto
      ? `DESCONTO R$`
      : `ACR${zplEscape("É")}SCIMOS (IPI, ST, FRETE, SEGURO E OUTRAS DESPESAS) R$`;
    l.push(`^FO40,${y}^AAN,18,10^FB550,2,5^FH\\^FD${zplEscape(labelAcrDesc)}^FS`);
    l.push(`^FO0,${y}^AAN,18,10^FB759,1,0,R^FH\\^FD${fmtBRL(Math.abs(data.descAcresc))}^FS`);
    y += 44;
  }

  // ── VALOR NOTA ──
  l.push(`^FPH,1^FO40,${y}^A0N,17,18^FH\\^FDVALOR NOTA R$^FS`);
  l.push(`^FPH,1^FO0,${y}^A0N,17,18^FB759,1,4,R^FH\\^FD${fmtBRL(data.vNF)}^FS`);
  y += 32;

  // ── Linha separadora antes de CONSUMIDOR ──
  l.push(`^FO40,${y}${LINE_GFA}`);
  y += 22;

  // ── CONSUMIDOR ──
  l.push(`^FPH,1^FO0,${y}^A0N,20,20^FB799,1,5,C^FH\\^FDCONSUMIDOR^FS`);
  y += 22;

  // Dados do consumidor (multilinha centralizado)
  const consumidor = `CNPJ/CPF/ID Estrangeiro: ${data.destDoc}\\& ${zplEscape(data.destNome)} ${zplEscape(data.destEndereco)}`;
  l.push(`^FO40,${y}^AAN,18,10^FB720,5,5,C^FH\\^FD${consumidor}^FS`);
  y += 76;

  // ── Linha separadora antes de INFO ADICIONAL ──
  l.push(`^FO40,${y}${LINE_GFA}`);
  y += 22;

  // ── INFORMAÇÕES ADICIONAIS ──
  l.push(`^FPH,1^FO0,${y}^A0N,20,20^FB800,1,5,C^FH\\^FDINFORMA${zplEscape("ÇÕ")}ES ADICIONAIS DE INTERESSE DO CONTRIBUINTE^FS`);
  y += 22;

  if (data.tributos) {
    l.push(`^FO40,${y}^AAN,18,10^FB720,2,5,C^FH\\^FD${zplEscape(data.tributos)}^FS`);
    y += 44;
  }

  // Linha final
  l.push(`^FO40,${y}^AAN,18,10^FB720,1,5,C^FH\\^FD^FS`);

  // ── Ajusta ^LL (label length) para conteúdo real ──
  const totalHeight = y + 30;
  l[0] = l[0].replace("^LL1199", `^LL${totalHeight}`);

  l.push("^XZ");
  return l.join("");
}

/**
 * Mescla dois blocos ZPL em um único arquivo.
 * Cada bloco ZPL é um ^XA...^XZ completo.
 * Resultado: os dois labels impressos em sequência.
 */
export function mergeZplBlocks(...blocks: string[]): string {
  return blocks
    .filter((b) => b && b.trim().length > 0)
    .join("\n\n");
}
