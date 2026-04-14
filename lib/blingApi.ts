// lib/blingApi.ts
import { OrderItem, BlingInvoice, BlingProduct } from "../types";
import { getMultiplicadorFromSku, classificarCor } from "./sku";

// Status do Pedido no Bling v3 (IDs):
// 6 = Em aberto, 9 = Atendido, 15 = Em andamento, 12 = Cancelado
const BLING_V3_STATUS_MAP: { [key: string]: number } = {
  "EM ABERTO": 6,
  "EM ANDAMENTO": 15,
  ATENDIDO: 9,
  TODOS: 0
};

// Situação da Nota Fiscal no Bling v3 (IDs):
// 1 = Pendente, 6 = Emitida
const BLING_V3_INVOICE_STATUS_MAP: { [key: string]: number } = {
  PENDENTES: 1,
  EMITIDAS: 6
};

// Use local proxy via Vite
const PROXY_URL = "/api/bling";

function cleanMoney(value: string | number): number {
  if (typeof value === "number") return value;
  const num = parseFloat(String(value));
  return isNaN(num) ? 0 : num;
}

function formatDateFromBling(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  return dateStr.split(" ")[0];
}

function handleBlingError(data: any, defaultMessage: string): void {
  if (data.error && typeof data.error === "string") {
    throw new Error(
      `Bling API: ${data.error} ${data.error_description ? `(${data.error_description})` : ""}`
    );
  }
  if (data.error) {
    const msg =
      data.error.description ||
      data.error.message ||
      JSON.stringify(data.error);
    throw new Error(`Bling API Error: ${msg}`);
  }
  if (data.type === "error") {
    throw new Error(`Bling API Error: ${data.message} (${data.description})`);
  }
}

/**
 * Detecta o canal de venda (ML, SHOPEE, SITE) a partir de um texto ou ID de loja
 */
export function parseCanal(
  raw: any,
  alternative?: string
): "ML" | "SHOPEE" | "SITE" {
  const text = String(raw || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const alt = String(alternative || "").toUpperCase();

  const isML = (t: string) =>
    t.includes("MERCADO LIVRE") ||
    t.includes("MERCADOLIVRE") ||
    t.includes("MERCADO-LIVRE") ||
    t.includes("MLB") ||
    t.includes("ML ") ||
    t === "ML" ||
    t.includes("MERCADO") ||
    t.includes("LIVRE");
  const isShopee = (t: string) =>
    t.includes("SHOPEE") ||
    t.includes("SHP") ||
    t.includes("SPP") ||
    t.startsWith("21") ||
    t.startsWith("22");

  if (isML(text) || isML(alt)) return "ML";
  if (isShopee(text) || isShopee(alt)) return "SHOPEE";

  if (
    text.includes("AMAZON") ||
    text.includes("NUVEM") ||
    text.includes("SITE") ||
    text.includes("LOJA VIRTUAL") ||
    text.includes("MAGALU") ||
    text.includes("SHEIN")
  )
    return "SITE";
  return "SITE";
}

/**
 * Helper genérico de retry para qualquer fetch (endpoints locais do server).
 * Tenta novamente em caso de HTTP 429 (rate limit) com backoff progressivo.
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  _retryCount = 0
): Promise<Response> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1200;
  const resp = await fetch(input, init);
  if (resp.status === 429 && _retryCount < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * (_retryCount + 1);
    console.warn(
      `⏳ [fetchWithRetry] 429 — retry ${_retryCount + 1}/${MAX_RETRIES} em ${delay}ms`
    );
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(input, init, _retryCount + 1);
  }
  return resp;
}

// Helper for V3 fetch with Auth header + auto-retry on rate limit (429)
async function fetchV3(
  endpoint: string,
  apiKey: string,
  params: Record<string, string> = {},
  _retryCount = 0
): Promise<any> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1200; // Bling permite ~3 req/s; espera 1.2s entre retries

  let cleanKey = apiKey ? apiKey.trim() : "";
  if (!cleanKey.toLowerCase().startsWith("bearer ")) {
    cleanKey = `Bearer ${cleanKey}`;
  }

  const url = new URL(`${window.location.origin}${PROXY_URL}${endpoint}`);
  Object.keys(params).forEach((key) => {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      url.searchParams.append(key, params[key]);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: cleanKey,
      Accept: "application/json"
    }
  });

  // ── Rate limit (429) — retry automático com backoff ─────────────────
  if (response.status === 429 && _retryCount < MAX_RETRIES) {
    const delay = BASE_DELAY_MS * (_retryCount + 1);
    console.warn(
      `⏳ [Bling] Rate limit em ${endpoint} — retry ${_retryCount + 1}/${MAX_RETRIES} em ${delay}ms`
    );
    await new Promise((r) => setTimeout(r, delay));
    return fetchV3(endpoint, apiKey, params, _retryCount + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(
        `Erro na requisição Bling v3 (${response.status}): ${text}`
      );
    }

    // Rate limit esgotou retries
    if (response.status === 429) {
      throw new Error(
        "Limite de requisições do Bling atingido. Aguarde alguns segundos e tente novamente."
      );
    }

    // Verifica erro de token expirado
    if (
      json.error === "The access token provided is invalid" ||
      json.error === "invalid_token" ||
      response.status === 401
    ) {
      throw new Error("TOKEN_EXPIRED"); // Erro especial para o frontend capturar
    }

    handleBlingError(json, `Erro ${response.status}`);
    return json;
  }

  return response.json();
}

/**
 * Troca o código de autorização pelo Access Token e Refresh Token.
 * OBRIGATÓRIO: redirect_uri deve ser idêntico ao usado na autorização.
 */
export async function executeBlingTokenExchange(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<any> {
  // Call our custom server endpoint which handles the form-urlencoded conversion and auth headers
  const response = await fetch("/api/bling/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: code.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    })
  });

  if (!response.ok) {
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Erro ao trocar token: ${text}`);
    }
    handleBlingError(json, "Falha na autenticação OAuth");
    return json;
  }

  return response.json();
}

/**
 * Renova o Access Token usando o Refresh Token.
 */
export async function executeTokenRefresh(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<any> {
  const response = await fetch("/api/bling/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao renovar token: ${text}`);
  }

  return response.json();
}

export async function fetchBlingOrders(
  apiKey: string,
  filters: {
    startDate: string;
    endDate: string;
    status: "EM ABERTO" | "EM ANDAMENTO" | "ATENDIDO" | "TODOS";
  }
): Promise<OrderItem[]> {
  const detectCanal = (blingOrder: any): "ML" | "SHOPEE" | "SITE" => {
    const sourceText = String(
      blingOrder?.loja?.nome || blingOrder?.origem || blingOrder?.tipo || ""
    ).toUpperCase();

    if (
      sourceText.includes("MERCADO LIVRE") ||
      sourceText.includes("MERCADOLIVRE") ||
      sourceText.includes("ML")
    )
      return "ML";
    if (sourceText.includes("SHOPEE")) return "SHOPEE";
    return "SITE";
  };

  const idSituacao = BLING_V3_STATUS_MAP[filters.status];
  const allOrders: OrderItem[] = [];
  let pagina = 1;
  const MAX_PAGES = 20; // Segurança para não entrar em loop infinito

  for (let p = 0; p < MAX_PAGES; p++) {
    const params: any = {
      dataInicial: filters.startDate,
      dataFinal: filters.endDate,
      limit: "100",
      pagina: String(pagina)
    };

    if (idSituacao > 0) {
      params.idsSituacoes = [idSituacao];
    }

    const data = await fetchV3("/pedidos/vendas", apiKey, params);

    if (!data.data || data.data.length === 0) break;

    for (const blingOrder of data.data) {
      const externalId = blingOrder.numeroLoja
        ? String(blingOrder.numeroLoja).trim()
        : "";
      const internalId = String(blingOrder.numero);
      const orderId = externalId || internalId;

      if (!blingOrder.itens || blingOrder.itens.length === 0) continue;

      const venda_origem = blingOrder?.loja?.nome || blingOrder?.origem || "";

      for (const item of blingOrder.itens) {
        const sku = String(item.codigo || "");
        const canal = detectCanal(blingOrder);
        allOrders.push({
          id: `${blingOrder.id}_${sku}`,
          orderId: orderId,
          blingId: String(blingOrder.id),
          blingNumero: String(blingOrder.numero),
          tracking: blingOrder.transporte?.codigoRastreamento || "",
          sku,
          qty_original: cleanMoney(item.quantidade),
          multiplicador: getMultiplicadorFromSku(sku),
          qty_final: Math.round(
            cleanMoney(item.quantidade) * getMultiplicadorFromSku(sku)
          ),
          color: classificarCor(item.descricao || ""),
          canal,
          data: formatDateFromBling(blingOrder.data),
          status: "NORMAL",
          customer_name: blingOrder.contato?.nome || "Não informado",
          customer_cpf_cnpj: blingOrder.contato?.numeroDocumento || "",
          price_gross: cleanMoney(item.valor),
          price_total: cleanMoney(blingOrder.total),
          platform_fees: 0,
          shipping_fee: cleanMoney(blingOrder.transporte?.frete || 0),
          shipping_paid_by_customer: cleanMoney(
            blingOrder.transporte?.frete || 0
          ),
          price_net: cleanMoney(item.valor),
          venda_origem,
          id_pedido_loja: blingOrder.numeroLoja || "",
          idLojaVirtual: blingOrder.loja?.id ? String(blingOrder.loja.id) : "",
          loja: blingOrder.loja
        });
      }
    }

    if (data.data.length < 100) break; // Última página
    pagina++;
    await new Promise((r) => setTimeout(r, 400)); // Pequeno delay para evitar rate limit
  }
  return allOrders;
}

export async function fetchBlingInvoices(
  apiKey: string,
  filters: {
    startDate: string;
    endDate: string;
    status: "PENDENTES" | "EMITIDAS";
  }
): Promise<BlingInvoice[]> {
  const idSituacao = BLING_V3_INVOICE_STATUS_MAP[filters.status];

  const params: any = {
    dataEmissaoInicial: `${filters.startDate} 00:00:00`,
    dataEmissaoFinal: `${filters.endDate} 23:59:59`,
    tipo: 1,
    limit: "100"
  };

  if (idSituacao) {
    params.situacao = idSituacao;
  }

  const data = await fetchV3("/nfe", apiKey, params);

  if (!data.data) return [];

  return data.data.map((nf: any): BlingInvoice => {
    return {
      id: String(nf.id),
      numero: String(nf.numero),
      serie: String(nf.serie),
      dataEmissao: formatDateFromBling(nf.dataEmissao),
      nomeCliente: nf.contato?.nome || "Consumidor",
      valorNota: cleanMoney(nf.valorNota),
      situacao: String(nf.situacao),
      idPedidoVenda: "",
      linkDanfe: nf.linkDanfe || nf.xml
    };
  });
}

/**
 * Busca a etiqueta ZPL REAL de uma NF-e no Bling.
 * Chama GET /Api/v3/nfe/{id}/etiqueta via proxy do servidor.
 * Retorna o ZPL completo (DANFE simplificado + etiqueta de envio) ou null se falhar.
 */
export async function fetchNfeEtiquetaZpl(
  token: string,
  nfeId: number | string,
  canal?: string,
  numeroPedidoLoja?: string
): Promise<string | null> {
  const authToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  const safeId = String(nfeId || "").replace(/[^0-9]/g, "");
  if (!safeId) return null;

  try {
    const params = new URLSearchParams();
    if (canal) params.set("loja", canal);
    if (numeroPedidoLoja) params.set("numeroPedidoLoja", numeroPedidoLoja);

    const url = `/api/bling/nfe/${safeId}/etiqueta?${params.toString()}`;
    const resp = await fetchWithRetry(url, {
      headers: { Authorization: authToken }
    });
    if (!resp.ok) {
      console.warn(
        `[fetchNfeEtiquetaZpl] Status ${resp.status} para nfe/${safeId}`
      );
      return null;
    }
    const data = await resp.json();
    return data?.zpl || data?.data?.zpl || data?.data?.etiqueta || null;
  } catch (e) {
    console.warn("[fetchNfeEtiquetaZpl] Erro:", e);
    return null;
  }
}

export async function fetchEtiquetaZplForPedido(
  apiKey: string,
  idPedidoVenda: string
): Promise<string> {
  const safePedido = String(idPedidoVenda || "").replace(/[^a-zA-Z0-9-]/g, "");
  if (!safePedido) {
    throw new Error("Pedido inválido para geração de etiqueta.");
  }

  // Chama endpoint server-side que busca dados reais do pedido no Bling
  try {
    const resp = await fetchWithRetry("/api/bling/etiquetas/buscar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey.startsWith("Bearer ")
          ? apiKey
          : `Bearer ${apiKey}`
      },
      body: JSON.stringify({ pedidoVendaIds: [safePedido] })
    });
    const data = await resp.json();
    if (data?.results?.[0]?.success && data.results[0].zpl) {
      return data.results[0].zpl;
    }
    // Se falhou, usa fallback
    console.warn(
      `[fetchEtiquetaZpl] Falha ao buscar do Bling: ${data?.results?.[0]?.error || "desconhecido"}`
    );
  } catch (e) {
    console.warn(`[fetchEtiquetaZpl] Erro de rede:`, e);
  }

  // Fallback: gera ZPL básica com dados mínimos
  const now = new Date();
  const timestamp = now.toLocaleString("pt-BR");
  return `^XA
^PW800
^LL1200
^CF0,40
^FO40,30^FDETIQUETA - PEDIDO ${safePedido}^FS
^CF0,26
^FO40,90^FDGerada automaticamente (fallback)^FS
^FO40,130^FDOrigem: Bling / ERP^FS
^FO40,170^FDData: ${timestamp}^FS
^FO40,230^GB720,2,2^FS
^BY3,3,110
^FO80,280^BCN,120,Y,N,N
^FD${safePedido}^FS
^CF0,24
^FO40,450^FDPedido: ${safePedido}^FS
^FO40,490^FDFluxo: Pedidos -> Notas -> Etiquetas^FS
^FO40,530^FDStatus: Disponivel para processamento^FS
^FO40,570^FDSalve no historico apos processar^FS
^FO40,630^GB720,2,2^FS
^FO40,680^FDUso interno^FS
^XZ`;
}

/**
 * Busca etiquetas ZPL em lote para múltiplos pedidos de venda
 */
export async function fetchEtiquetasLote(
  apiKey: string,
  pedidoVendaIds: string[]
): Promise<{
  total: number;
  ok: number;
  fail: number;
  results: Array<{
    pedidoVendaId: string;
    success: boolean;
    zpl?: string;
    numero?: string;
    nomeCliente?: string;
    error?: string;
  }>;
}> {
  const resp = await fetchWithRetry("/api/bling/etiquetas/buscar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`
    },
    body: JSON.stringify({ pedidoVendaIds })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

// ──────────────────────────────────────────────────────────────────────────────
// NOTAS FISCAIS DE SAÍDA — listar, emitir, detalhar, baixar XML/DANFE
// ──────────────────────────────────────────────────────────────────────────────

export interface NfeSaida {
  id: number;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  situacao?: number; // 1=Pendente, 5=Autorizada, 6=Emitida, 2=Cancelada...
  situacaoDescr?: string;
  dataEmissao?: string;
  dataSaida?: string;
  valorTotal?: number;
  contato?: { id?: number; nome?: string; numeroDocumento?: string };
  linkDanfe?: string;
  linkXml?: string;
  xml?: string;
  numeroVenda?: string; // número do pedido de venda vinculado
  numeroLoja?: string; // número do pedido na loja virtual (extraído do intermediador ou numeroLoja)
  loja?: string; // descrição da loja (Bling v3)
  lojaId?: number; // ID da loja (Bling v3 - importante para detectar canal)
  canal?: "ML" | "SHOPEE" | "SITE";
  idVenda?: number; // ID interno da venda no Bling (importante para etiquetas)
  tipo?: string; // tipo da NF-e (ex: "saida", "entrada")
  naturezaOperacao?: string; // natureza da operação (ex: "Venda")
  idTransportador?: number; // ID do transportador
  rastreamento?: string; // Código de rastreamento
  itens?: any[]; // Itens da NF-e
  itensCount?: number; // Quantidade total de itens
  taxas?: number; // Taxas do marketplace/plataforma
  frete?: number; // Valor do frete
  valorLiquido?: number; // Valor líquido (Total - Taxas - Frete)
  numeroPedidoLoja?: string;
}

// Mapeamento de situação ID → descrição legível (exportado para uso externo)
export const NFE_SIT_MAP: Record<number, string> = {
  1: "Pendente",
  2: "Cancelada",
  3: "Aguardando Recibo",
  4: "Rejeitada",
  5: "Autorizada s/ DANFE",
  6: "Emitida",
  7: "Denegada",
  8: "Encerrada"
};

/** Retorna descrição de situação, distinguindo "Autorizada s/ DANFE" vs "Emitida DANFE" */
export function getNfeSituacaoLabel(nfe: NfeSaida): string {
  if (nfe.situacao === 5) return "Autorizada s/ DANFE";
  if (nfe.situacao === 6) return "Emitida DANFE";
  return NFE_SIT_MAP[nfe.situacao || 0] || `Situação ${nfe.situacao}`;
}

/**
 * Busca notas fiscais de saída do Bling (tipo=1) com filtros de data e situação.
 * Suporta paginação automática para buscar TODAS as notas do período.
 */
export async function fetchNfeSaida(
  apiKey: string,
  opts: {
    dataInicial?: string;
    dataFinal?: string;
    situacao?: number;
    pagina?: number;
  } = {}
): Promise<NfeSaida[]> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const allNotas: NfeSaida[] = [];
  let pagina = opts.pagina || 1;
  const MAX_PAGES = 50; // segurança: aumentado para 50 páginas (5000 notas)

  for (let p = 0; p < MAX_PAGES; p++) {
    const params: Record<string, string> = {
      tipo: "1", // 1=Saída
      limite: "100",
      pagina: String(pagina)
    };
    if (opts.dataInicial)
      params.dataEmissaoInicial = `${opts.dataInicial} 00:00:00`;
    if (opts.dataFinal) params.dataEmissaoFinal = `${opts.dataFinal} 23:59:59`;
    if (opts.situacao) params.situacao = String(opts.situacao);

    const resp = await fetchWithRetry(
      `/api/bling/nfe?${new URLSearchParams(params).toString()}`,
      {
        headers: { Authorization: authH, Accept: "application/json" }
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error || `Erro ${resp.status}`);
    }
    const data = await resp.json();
    const notas: any[] = data?.notas || data?.data || [];
    if (notas.length === 0) break;

    allNotas.push(
      ...notas.map((n: any) => {
        const canal = parseCanal(
          n.loja?.descricao || n.vendedor?.descricao || n.canal
        );

        // Filtra valores que parecem rastreio (Correios: 2 letras + 9 dígitos + 2 letras)
        const isRastreio = (v: string | undefined) =>
          v ? /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(v.trim()) : false;

        const rawNumeroLoja =
          n.intermediador?.numeroPedido ||
          (isRastreio(n.numeroLoja) ? undefined : n.numeroLoja) ||
          n.numeroPedidoLoja ||
          undefined;

        return {
          id: n.id,
          numero: n.numero ? String(n.numero) : undefined,
          serie: n.serie ? String(n.serie) : undefined,
          chaveAcesso: n.chaveAcesso || n.chave_acesso || undefined,
          situacao: n.situacao,
          situacaoDescr: NFE_SIT_MAP[n.situacao] || `Situação ${n.situacao}`,
          dataEmissao: n.dataEmissao || n.dataOperacao || n.data,
          dataSaida: n.dataOperacao || n.dataEmissao || n.data,
          valorTotal: n.valorNota || n.total || n.valor || undefined,
          contato: n.contato
            ? {
                id: n.contato.id,
                nome: n.contato.nome,
                numeroDocumento: n.contato.numeroDocumento
              }
            : undefined,
          linkDanfe: n.linkDanfe || n.link || n.linkDANFE || undefined,
          linkXml: n.linkXml || n.xml || undefined,
          numeroVenda: n.numeroPedidoCompra || rawNumeroLoja || undefined,
          numeroLoja: rawNumeroLoja,
          idVenda:
            n.vendas?.[0]?.id ||
            n.pedidoVenda?.id ||
            n.pedido?.id ||
            n.idPedidoVenda ||
            n.idVenda
              ? Number(
                  n.vendas?.[0]?.id ||
                    n.pedidoVenda?.id ||
                    n.pedido?.id ||
                    n.idPedidoVenda ||
                    n.idVenda
                )
              : undefined,
          loja:
            n.loja?.descricao || n.vendedor?.descricao || n.canal || undefined,
          lojaId: n.loja?.id ? Number(n.loja.id) : undefined,
          canal,
          tipo: n.tipo ? String(n.tipo) : undefined,
          naturezaOperacao: n.naturezaOperacao || n.natureza || undefined,
          idTransportador: n.transporte?.contato?.id
            ? Number(n.transporte.contato.id)
            : undefined,
          rastreamento: n.transporte?.objeto?.codigoRastreamento || undefined
        };
      })
    );

    if (notas.length < 100) break; // última página
    pagina++;
    // Delay entre páginas para respeitar rate limits (opcional aqui, o retry já ajuda)
    await new Promise((r) => setTimeout(r, 600));
  }

  return allNotas;
}

/**
 * Enriquecimento: Busca detalhes de uma NF-e para preencher campos ausentes na listagem básica (v3)
 * como numeroLoja, rastreamento, loja, etc.
 */
export async function enrichNfeSaida(
  apiKey: string,
  nfe: NfeSaida
): Promise<NfeSaida> {
  try {
    const token = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
    const detalhe = await fetchNfeDetalhe(token, nfe.id);
    const d = detalhe?.data || detalhe;
    if (!d) return nfe;

    // --- BUSCA AGRESSIVA PELO ID DA VENDA (Pedido Interno do Bling) ---
    let idVenda =
      d.vendas?.[0]?.id ||
      d.pedidoVenda?.id ||
      d.pedido?.id ||
      (Array.isArray(d.vendas) && d.vendas.length > 0
        ? d.vendas[0].id
        : null) ||
      d.idPedidoVenda ||
      d.idVenda;

    // Se não achou na estrutura, tenta buscar em notas/observações via Regex
    if (!idVenda) {
      const obsText = `${d.observações || d.observacoes || ""} ${d.observaçõesInternas || d.observacoesInternas || ""} ${d.pedido?.observacoes || ""}`;
      const matchVenda = obsText.match(
        /(?:ID\s+Venda|Pedido\s+Bling|Venda\s+ID|vendas\.php#edit\/)\s*[:\-]?\s*(\d+)/i
      );
      if (matchVenda?.[1]) idVenda = Number(matchVenda[1]);
    }

    // --- BUSCA AGRESSIVA PELO NÚMERO DA LOJA VIRTUAL (Marketplace) ---
    // Filtra valores que parecem rastreio (Correios: 2 letras + 9 dígitos + 2 letras)
    const isTrackingCode = (v: string | undefined) =>
      v ? /^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(v.trim()) : false;

    const candidates = [
      d.intermediador?.numeroPedido,
      d.numeroPedidoLoja,
      d.pedido?.numeroLoja,
      d.vendas?.[0]?.numeroLoja,
      d.numeroLoja,
      d.pedido?.idPedidoLoja
    ];
    let numeroLoja = candidates.find((v) => v && !isTrackingCode(String(v)));

    if (!numeroLoja) {
      const obsText = `${d.observações || d.observacoes || ""} ${d.observaçõesInternas || d.observacoesInternas || ""}`;
      const matchLoja = obsText.match(
        /(?:Número\s+Pedido\s+Loja|Pedido\s+Original|Pedido\s+da\s+Loja|Order\s+ID)\s*[:\-]?\s*([A-Z0-9\-_]+)/i
      );
      if (matchLoja?.[1]) numeroLoja = matchLoja[1];
    }

    // --- BUSCA RASTREAMENTO ---
    const transporte = d.transporte || {};
    let rastreamento =
      transporte.objeto?.codigoRastreamento ||
      transporte.volumes?.[0]?.codigoRastreamento ||
      d.pedido?.transporte?.codigoRastreamento;

    // Se tem objetoLogistico.id, busca rastreamento real via /logisticas/objetos/{id}
    const idObjetoLogistico = transporte.objetoLogistico?.id || transporte.objeto?.id;
    if (!rastreamento && idObjetoLogistico) {
      try {
        const objResp = await fetchWithRetry(
          `/api/bling/logisticas/objetos/${idObjetoLogistico}`,
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        if (objResp.ok) {
          const objData = await objResp.json();
          const objInfo = objData?.data || objData;
          rastreamento = objInfo?.rastreamento?.codigo || undefined;
        }
      } catch (e) {
        console.warn(`[enrichNfeSaida] Falha ao buscar objeto logístico ${idObjetoLogistico}:`, e);
      }
    }

    const itens = d.itens || d.produtos || [];
    const itensCount = itens.length;

    // --- BUSCA PROFUNDA NO PEDIDO DE VENDA (Se idVenda existir) ---
    let vData: any = null;
    if (idVenda) {
      try {
        const pedDet = await fetchPedidoVendaDetalhe(token, idVenda);
        vData = pedDet?.data || pedDet;
      } catch (e) {
        console.warn(`[enrichNfeSaida] Falha ao buscar pedido ${idVenda}:`, e);
      }
    }

    const lojaNome =
      vData?.loja?.nome ||
      vData?.loja?.descricao ||
      d.loja?.descricao ||
      d.vendedor?.descricao ||
      d.loja?.nome ||
      nfe.loja;
    const canal = parseCanal(
      lojaNome,
      vData?.canal || nfe.numeroLoja || numeroLoja
    );

    const enriched: NfeSaida = {
      ...nfe,
      idVenda: idVenda ? Number(idVenda) : nfe.idVenda,
      numeroVenda:
        vData?.numero ||
        d.numero ||
        d.pedido?.numero ||
        d.numeroPedidoLoja ||
        d.intermediador?.numeroPedido ||
        idVenda ||
        nfe.numeroVenda,
      numeroLoja:
        (vData?.numeroLoja && !isTrackingCode(String(vData.numeroLoja)) ? vData.numeroLoja : undefined) ||
        (vData?.numeroPedidoLoja && !isTrackingCode(String(vData.numeroPedidoLoja)) ? vData.numeroPedidoLoja : undefined) ||
        numeroLoja ||
        nfe.numeroLoja,
      loja: lojaNome,
      lojaId:
        vData?.loja?.id || d.loja?.id
          ? Number(vData?.loja?.id || d.loja.id)
          : nfe.lojaId,
      canal,
      rastreamento:
        rastreamento ||
        vData?.transporte?.codigoRastreamento ||
        vData?.rastreamento,
      idTransportador:
        transporte.contador?.id ||
        transporte.contato?.id ||
        vData?.transporte?.contato?.id
          ? Number(
              transporte.contador?.id ||
                transporte.contato?.id ||
                vData?.transporte?.contato?.id
            )
          : nfe.idTransportador,
      itens: itens.length > 0 ? itens : vData?.itens || [],
      itensCount: itensCount || vData?.itens?.length || 0,
      valorTotal: cleanMoney(
        d.valorNota || d.total || d.valor || vData?.total || nfe.valorTotal
      ),
      taxas: vData?.taxas ? cleanMoney(vData.taxas) : undefined,
      frete:
        cleanMoney(
          transporte.frete || d.valorFrete || vData?.transporte?.frete || 0
        ) || undefined,
      valorLiquido: vData?.valorLiquido
        ? cleanMoney(vData.valorLiquido)
        : undefined,
      chaveAcesso: d.chaveAcesso || nfe.chaveAcesso,
      linkDanfe: d.linkDanfe || d.linkPDF || nfe.linkDanfe,
      linkXml: d.linkXml || d.xml || nfe.linkXml
    };

    // Fallback final: tenta via objetos-postagem usando idVenda interno do Bling
    const rastreamentoFinal =
      rastreamento ||
      vData?.transporte?.codigoRastreamento ||
      vData?.rastreamento;
    if (!rastreamentoFinal && enriched.idVenda) {
      try {
        const objetos = await fetchObjetosPostagem(token, enriched.idVenda);
        const obj = objetos[0];
        if (obj?.codigoRastreamento) {
          return { ...enriched, rastreamento: obj.codigoRastreamento };
        }
      } catch (_) { /* skip */ }
    }

    return enriched;
  } catch (err) {
    console.error(`Erro ao enriquecer NF-e ${nfe.id}:`, err);
    return nfe;
  }
}

/**
 * Enriquecimento em MASSA: Busca pedidos/vendas por data para extrair rastreios,
 * loja, etc. de vários pedidos de uma só vez (evita N chamadas individuais).
 *
 * Fluxo:
 * 1. Extrai datas min/max das NF-es para definir o range
 * 2. GET /pedidos/vendas?dataInicial=X&dataFinal=Y (paginado)
 * 3. Mapeia pedido.id → { rastreamento, loja, numeroLoja }
 * 4. Para cada NF-e que tem idVenda, aplica os dados do pedido
 */
export async function enrichNfeSaidaBatch(
  apiKey: string,
  nfes: NfeSaida[],
  onProgress?: (done: number, total: number) => void
): Promise<NfeSaida[]> {
  const token = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const authH = { Authorization: token, Accept: "application/json" };

  // 1. Calcular range de datas a partir das NF-es
  const datas = nfes
    .map((n) => n.dataEmissao || n.dataSaida)
    .filter(Boolean)
    .map((d) => new Date(d!).getTime())
    .filter((t) => !isNaN(t));

  const minDate = datas.length > 0 ? new Date(Math.min(...datas)) : new Date();
  const maxDate = datas.length > 0 ? new Date(Math.max(...datas)) : new Date();

  // Expandir range em 3 dias para pegar pedidos que não batem exato
  minDate.setDate(minDate.getDate() - 3);
  maxDate.setDate(maxDate.getDate() + 1);

  const fmtDate = (d: Date) => d.toISOString().split("T")[0];
  const dataInicial = fmtDate(minDate);
  const dataFinal = fmtDate(maxDate);

  console.log(`🔄 [enrichBatch] Buscando pedidos/vendas de ${dataInicial} a ${dataFinal}...`);

  // 2. Buscar pedidos de venda em massa (paginado)
  const pedidosMap = new Map<
    string,
    { rastreamento?: string; loja?: string; lojaId?: number; numeroLoja?: string; numero?: string }
  >();

  let pagina = 1;
  let continuar = true;

  while (continuar) {
    try {
      const url = `/api/bling/pedidos/vendas?limite=100&pagina=${pagina}&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
      const resp = await fetchWithRetry(url, { headers: authH });
      if (!resp.ok) break;

      const data = await resp.json();
      const pedidos: any[] = data?.data || [];
      if (pedidos.length === 0) break;

      for (const p of pedidos) {
        const id = String(p.id);
        const rastreamento =
          p.transporte?.codigoRastreamento ||
          p.transporte?.volumes?.[0]?.codigoRastreamento ||
          undefined;
        const lojaDesc = p.loja?.descricao || p.loja?.nome || undefined;
        const lojaId = p.loja?.id ? Number(p.loja.id) : undefined;
        const numeroLoja = p.numeroLoja || p.numeroPedidoLoja || undefined;
        const numero = p.numero ? String(p.numero) : undefined;

        pedidosMap.set(id, { rastreamento, loja: lojaDesc, lojaId, numeroLoja, numero });
      }

      if (pedidos.length < 100) break;
      pagina++;
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.warn(`[enrichBatch] Erro na página ${pagina}:`, e);
      break;
    }
  }

  console.log(`🔄 [enrichBatch] ${pedidosMap.size} pedidos carregados. Aplicando a ${nfes.length} NF-es...`);

  // 3. Aplicar dados em cada NF-e
  const enriched = [...nfes];
  let enrichCount = 0;

  for (let i = 0; i < enriched.length; i++) {
    const nfe = enriched[i];

    // Verifica se precisa de enriquecimento
    const needsEnrich =
      !nfe.idVenda ||
      !nfe.rastreamento ||
      !nfe.loja ||
      !nfe.linkDanfe ||
      !nfe.chaveAcesso;
    if (!needsEnrich) continue;

    // Tenta via pedidosMap (rápido, sem chamada extra)
    const idVenda = nfe.idVenda ? String(nfe.idVenda) : undefined;
    const pedidoData = idVenda ? pedidosMap.get(idVenda) : undefined;

    if (pedidoData) {
      enriched[i] = {
        ...nfe,
        rastreamento: pedidoData.rastreamento || nfe.rastreamento,
        loja: pedidoData.loja || nfe.loja,
        lojaId: pedidoData.lojaId || nfe.lojaId,
        numeroLoja: pedidoData.numeroLoja || nfe.numeroLoja,
        numeroVenda: pedidoData.numero || nfe.numeroVenda
      };
      enrichCount++;
    }

    // Se ainda falta idVenda/linkDanfe/chaveAcesso/rastreamento, faz chamada individual ao detalhe da NF-e
    if (!enriched[i].idVenda || !enriched[i].linkDanfe || !enriched[i].chaveAcesso || !enriched[i].rastreamento) {
      try {
        const det = await fetchNfeDetalhe(token, nfe.id);
        const d = det?.data || det;
        if (d) {
          // Extrair rastreamento do detalhe da NF-e (transporte.objeto)
          const transporte = d.transporte || {};
          const rastreamentoDet =
            transporte.objeto?.codigoRastreamento ||
            transporte.volumes?.[0]?.codigoRastreamento ||
            d.pedido?.transporte?.codigoRastreamento;

          enriched[i] = {
            ...enriched[i],
            linkDanfe: d.linkDanfe || d.linkPDF || enriched[i].linkDanfe,
            linkXml: d.linkXml || d.xml || enriched[i].linkXml,
            chaveAcesso: d.chaveAcesso || enriched[i].chaveAcesso,
            situacao: d.situacao ?? enriched[i].situacao,
            situacaoDescr: NFE_SIT_MAP[d.situacao] || enriched[i].situacaoDescr,
            rastreamento: rastreamentoDet || enriched[i].rastreamento,
            idTransportador:
              transporte.contato?.id ? Number(transporte.contato.id) : enriched[i].idTransportador,
            numeroPedidoLoja:
              d.intermediador?.numeroPedido || d.numeroPedidoLoja || enriched[i].numeroPedidoLoja,
            numeroLoja:
              d.intermediador?.numeroPedido || d.numeroPedidoLoja || enriched[i].numeroLoja
          };
          // Se idVenda não existia, extrair agora
          if (!enriched[i].idVenda) {
            const vid =
              d.vendas?.[0]?.id || d.pedidoVenda?.id || d.pedido?.id;
            if (vid) {
              enriched[i].idVenda = Number(vid);
              // Tenta mapear do pedidosMap agora que temos o idVenda
              const pd = pedidosMap.get(String(vid));
              if (pd) {
                enriched[i].rastreamento =
                  pd.rastreamento || enriched[i].rastreamento;
                enriched[i].loja = pd.loja || enriched[i].loja;
                enriched[i].lojaId = pd.lojaId || enriched[i].lojaId;
                enriched[i].numeroLoja = pd.numeroLoja || enriched[i].numeroLoja;
                enriched[i].numeroVenda = pd.numero || enriched[i].numeroVenda;
              }
            }
          }

          // Se rastreamento ainda não encontrado, tenta via objetos-postagem com idVenda do Bling
          if (!enriched[i].rastreamento && enriched[i].idVenda) {
            try {
              const objetos = await fetchObjetosPostagem(token, enriched[i].idVenda!);
              const obj = objetos[0];
              if (obj?.codigoRastreamento) {
                enriched[i].rastreamento = obj.codigoRastreamento;
              }
            } catch (_) { /* skip */ }
          }
          enrichCount++;
        }
        await new Promise((r) => setTimeout(r, 300));
      } catch (e) {
        console.warn(`[enrichBatch] Detalhe NF-e ${nfe.id} falhou:`, e);
      }
    }

    onProgress?.(i + 1, enriched.length);
  }

  console.log(`✅ [enrichBatch] ${enrichCount} NF-es enriquecidas.`);
  return enriched;
}

/**
 * Envia (emite) uma NF-e pendente para a SEFAZ via Bling.
 */
export async function enviarNfe(apiKey: string, nfeId: number): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/nfe/${nfeId}/enviar`, {
    method: "POST",
    headers: {
      Authorization: authH,
      Accept: "application/json",
      "Content-Type": "application/json"
    }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

/**
 * Atualiza uma NF-e no Bling (PUT).
 * Útil para corrigir dados antes da emissão.
 */
export async function atualizarNfe(
  apiKey: string,
  nfeId: number | string,
  dados: any
): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/nfe/${nfeId}`, {
    method: "PUT",
    headers: {
      Authorization: authH,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(dados)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

/**
 * Obtém detalhes completos de uma NF-e (XML, chave de acesso, links).
 */
export async function fetchNfeDetalhe(
  apiKey: string,
  nfeId: number | string
): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/nfe/${nfeId}`, {
    headers: { Authorization: authH, Accept: "application/json" }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

/**
 * Obtém o link do DANFE em PDF via API v3.
 */
export async function fetchNfePdf(
  apiKey: string,
  nfeId: number | string
): Promise<{ url: string }> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/nfe/${nfeId}/pdf`, {
    headers: { Authorization: authH, Accept: "application/json" }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status} ao buscar PDF`);
  }
  const json = await resp.json();
  return json.data; // Retorna { url: '...' }
}

/**
 * Gera etiquetas de logística para um ou mais objetos.
 * @param idsObjetos Lista de IDs de objetos logísticos.
 */
export async function fetchLogisticaEtiquetas(
  apiKey: string,
  idsObjetos: number[]
): Promise<{ url: string }> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry("/api/bling/logisticas/etiquetas", {
    method: "POST",
    headers: {
      Authorization: authH,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ idsObjetos })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status} ao gerar etiquetas`);
  }
  const json = await resp.json();
  return json.data; // Retorna { url: '...' }
}

/**
 * Obtém detalhes de um pedido de venda do Bling.
 */
export async function fetchPedidoVendaDetalhe(
  apiKey: string,
  pedidoId: string | number
): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/pedido-venda/${pedidoId}`, {
    headers: { Authorization: authH, Accept: "application/json" }
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

/**
 * Atualiza um pedido de venda no Bling (PUT).
 * Útil para corrigir dados fiscais, nome do cliente, etc.
 */
export async function atualizarPedidoVenda(
  apiKey: string,
  pedidoId: string | number,
  dados: any
): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resp = await fetchWithRetry(`/api/bling/pedido-venda/${pedidoId}`, {
    method: "PUT",
    headers: {
      Authorization: authH,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(dados)
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || `Erro ${resp.status}`);
  }
  return resp.json();
}

export async function fetchBlingProducts(
  apiKey: string
): Promise<BlingProduct[]> {
  const params = {
    limit: "100",
    criterio: "1",
    tipo: "P"
  };

  const data = await fetchV3("/produtos", apiKey, params);

  if (!data.data) return [];

  return data.data.map((prod: any): BlingProduct => {
    return {
      id: String(prod.id),
      codigo: prod.codigo,
      descricao: prod.nome,
      preco: cleanMoney(prod.preco),
      estoqueAtual: cleanMoney(prod.estoque?.saldoVirtual || 0)
    };
  });
}
// SYNC ENDPOINTS - PHASE 1
/**
 * Sincroniza Pedidos de Vendas do Bling
 */
export async function syncBlingOrders(
  token: string,
  dataInicio: string,
  dataFim: string,
  status: "EM ABERTO" | "EM ANDAMENTO" | "ATENDIDO" | "TODOS" = "TODOS",
  canal: "ML" | "SHOPEE" | "SITE" | "ALL" = "ALL"
): Promise<any> {
  const params = new URLSearchParams();
  if (dataInicio) params.append("dataInicio", dataInicio);
  if (dataFim) params.append("dataFim", dataFim);
  if (status) params.append("status", status);
  if (canal) params.append("canal", canal);

  const response = await fetch(`/api/bling/sync/orders?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: token,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao sincronizar pedidos: ${text}`);
  }

  return response.json();
}

/**
 * Sincroniza Notas Fiscais do Bling
 */
export async function syncBlingInvoices(
  token: string,
  dataInicio: string,
  dataFim: string,
  status: "PENDENTES" | "EMITIDAS" | "TODOS" = "TODOS"
): Promise<any> {
  const params = new URLSearchParams();
  if (dataInicio) params.append("dataInicio", dataInicio);
  if (dataFim) params.append("dataFim", dataFim);
  if (status) params.append("status", status);

  const response = await fetch(
    `/api/bling/sync/invoices?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao sincronizar notas fiscais: ${text}`);
  }

  return response.json();
}

/**
 * Sincroniza Produtos do Bling
 */
export async function syncBlingProducts(token: string): Promise<any> {
  const response = await fetch("/api/bling/sync/products", {
    method: "GET",
    headers: {
      Authorization: token,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao sincronizar produtos: ${text}`);
  }

  return response.json();
}

/**
 * Sincroniza Estoque do Bling (saldo real e virtual por SKU)
 */
export async function syncBlingStock(token: string): Promise<any> {
  const response = await fetch("/api/bling/sync/stock", {
    method: "GET",
    headers: {
      Authorization: token,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao sincronizar estoque: ${text}`);
  }

  return response.json();
}

/**
 * Sincroniza tudo de uma vez: pedidos, notas, produtos e estoque
 */
export async function syncAllBling(
  token: string,
  params?: { dataInicio?: string; dataFim?: string }
): Promise<any> {
  const response = await fetch("/api/bling/sync/all", {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      dataInicio: params?.dataInicio,
      dataFim: params?.dataFim
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao sincronizar tudo: ${text}`);
  }

  return response.json();
}

/**
 * Vincula um produto ERP com um produto do Bling
 */
export async function vinculateBlingProduct(
  erpProductId: string,
  blingProductId: string,
  blingCode: string,
  erpSku: string
): Promise<any> {
  const response = await fetch("/api/bling/sync/vinculate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      erpProductId,
      blingProductId,
      blingCode,
      erpSku
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao vincular produto: ${text}`);
  }

  return response.json();
}

/**
 * Obtém status da sincronização recente
 */
export async function getSyncStatus(): Promise<any> {
  const response = await fetch("/api/bling/sync/status", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Erro ao obter status de sincronização");
  }

  return response.json();
}

// ADVANCED FILTERING - PHASE 2
/**
 * Busca e filtra dados sincronizados com filtros avançados
 */
export async function searchAndFilter(
  dataType: "orders" | "invoices" | "products",
  filters: {
    searchTerm?: string;
    status?: string[];
    dateFrom?: string;
    dateTo?: string;
    lote?: string;
    skus?: string[];
    sortBy?: "date" | "amount" | "status" | "name";
    sortOrder?: "asc" | "desc";
  }
): Promise<any> {
  const response = await fetch("/api/bling/filter", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      dataType,
      filters
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao filtrar dados: ${text}`);
  }

  return response.json();
}

/**
 * Realiza operação em lote: mudar status
 */
export async function bulkChangeStatus(
  itemIds: string[],
  newStatus: string
): Promise<any> {
  const response = await fetch("/api/bling/bulk/change-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      itemIds,
      status: newStatus
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao mudar status em lote");
  }

  return response.json();
}

/**
 * Realiza operação em lote: atribuir lote
 */
export async function bulkAssignLote(
  itemIds: string[],
  loteId: string,
  loteName: string
): Promise<any> {
  const response = await fetch("/api/bling/bulk/assign-lote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      itemIds,
      loteId,
      loteName
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao atribuir lote");
  }

  return response.json();
}

/**
 * Realiza operação em lote: deletar itens
 */
export async function bulkDelete(itemIds: string[]): Promise<any> {
  const response = await fetch("/api/bling/bulk/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ itemIds })
  });

  if (!response.ok) {
    throw new Error("Erro ao deletar itens");
  }

  return response.json();
}

/**
 * Exporta itens para CSV
 */
export async function exportToCsv(
  dataType: "orders" | "invoices" | "products",
  itemIds?: string[]
): Promise<Blob> {
  const response = await fetch("/api/bling/export/csv", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dataType,
      itemIds
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao exportar dados");
  }

  return response.blob();
}

/**
 * Obter lista de lotes
 */
export async function getLotes(): Promise<any[]> {
  const response = await fetch("/api/bling/lotes", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Erro ao obter lotes");
  }

  const data = await response.json();
  return data.lotes || [];
}

/**
 * Criar novo lote
 */
export async function createLote(
  name: string,
  description?: string
): Promise<any> {
  const response = await fetch("/api/bling/lotes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      name,
      description
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao criar lote");
  }

  return response.json();
}

// NFe & SEFAZ INTEGRATION - PHASE 3

/**
 * Gera uma NFe a partir de um pedido
 */
export async function gerarNFe(
  pedidoId: string,
  dadosAdicionais?: Partial<any>
): Promise<any> {
  const response = await fetch("/api/nfe/gerar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      pedidoId,
      ...dadosAdicionais
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao gerar NFe: ${text}`);
  }

  return response.json();
}

/**
 * Carrega e armazena um certificado digital A1 (arquivo .pfx)
 */
export async function carregarCertificado(
  arquivoBuffer: ArrayBuffer,
  senha: string,
  cnpj: string
): Promise<any> {
  const response = await fetch("/api/nfe/certificado/carregar", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Certificado-Senha": senha,
      "X-Certificado-CNPJ": cnpj
    },
    body: arquivoBuffer
  });

  if (!response.ok) {
    throw new Error("Erro ao carregar certificado");
  }

  return response.json();
}

/**
 * Lista certificados carregados
 */
export async function listarCertificados(): Promise<any[]> {
  const response = await fetch("/api/nfe/certificados", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Erro ao listar certificados");
  }

  const data = await response.json();
  return data.certificados || [];
}

/**
 * Assina uma NFe com o certificado digital
 */
export async function assinarNFe(
  nfeId: string,
  certificadoId: string
): Promise<any> {
  const response = await fetch("/api/nfe/assinar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      certificadoId
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao assinar NFe");
  }

  return response.json();
}

/**
 * Envia NFe assinada para SEFAZ
 */
export async function enviarNFeSefaz(
  nfeId: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO"
): Promise<any> {
  const response = await fetch("/api/nfe/enviar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      ambiente
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao enviar NFe para SEFAZ: ${text}`);
  }

  return response.json();
}

/**
 * Consulta status da NFe na SEFAZ
 */
export async function consultarStatusNFe(
  chaveAcesso: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO"
): Promise<any> {
  const response = await fetch("/api/nfe/consultar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      chaveAcesso,
      ambiente
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao consultar status na SEFAZ");
  }

  return response.json();
}

/**
 * Obtém a lista de NFes geradas
 */
export async function listarNFes(filtros?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  pedidoId?: string;
}): Promise<any> {
  const params = new URLSearchParams();
  if (filtros?.status) params.append("status", filtros.status);
  if (filtros?.dateFrom) params.append("dateFrom", filtros.dateFrom);
  if (filtros?.dateTo) params.append("dateTo", filtros.dateTo);
  if (filtros?.pedidoId) params.append("pedidoId", filtros.pedidoId);

  const response = await fetch(`/api/nfe/listar?${params.toString()}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Erro ao listar NFes");
  }

  return response.json();
}

/**
 * Baixa XML de uma NFe
 */
export async function baixarXmlNFe(nfeId: string): Promise<Blob> {
  const response = await fetch(`/api/nfe/${nfeId}/xml`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Erro ao baixar XML");
  }

  return response.blob();
}

/**
 * Baixa PDF (DANFE) de uma NFe
 */
export async function baixarDanfePdf(nfeId: string): Promise<Blob> {
  const response = await fetch(`/api/nfe/${nfeId}/danfe-pdf`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Erro ao baixar DANFE PDF");
  }

  return response.blob();
}

/**
 * Cancela uma NFe autorizada
 */
export async function cancelarNFe(
  nfeId: string,
  justificativa: string
): Promise<any> {
  const response = await fetch("/api/nfe/cancelar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      justificativa
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao cancelar NFe");
  }

  return response.json();
}

/**
 * Reenviar NFe não autorizada
 */
export async function reenviarNFe(
  nfeId: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO"
): Promise<any> {
  const response = await fetch("/api/nfe/reenviar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      ambiente
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao reenviar NFe");
  }

  return response.json();
}

/**
 * Obtém configuração atual de NFe
 */
export async function obterConfiguracaoNFe(): Promise<any> {
  const response = await fetch("/api/nfe/configuracao", {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("Erro ao obter configuração de NFe");
  }

  return response.json();
}

/**
 * Atualiza configuração de NFe
 */
export async function atualizarConfiguracaoNFe(
  config: Partial<any>
): Promise<any> {
  const response = await fetch("/api/nfe/configuracao", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(config)
  });

  if (!response.ok) {
    throw new Error("Erro ao atualizar configuração");
  }

  return response.json();
}

/**
 * PHASE 3 X.509: Carregar certificado A1 com parse real
 */
export async function carregarCertificadoA1(
  arquivo: File,
  senha: string
): Promise<any> {
  try {
    // Converter arquivo para base64
    const arrayBuffer = await arquivo.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const response = await fetch("/api/nfe/certificado/carregar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Certificado-Senha": senha
      },
      body: JSON.stringify({
        arquivo: base64,
        nomeArquivo: arquivo.name
      })
    });

    if (!response.ok) {
      const erro = await response.json();
      throw new Error(erro.error || "Erro ao carregar certificado");
    }

    return response.json();
  } catch (error: any) {
    throw new Error(`Erro ao carregar certificado A1: ${error.message}`);
  }
}

/**
 * PHASE 3 X.509: Assinar NFe com certificado real
 */
export async function assinarNFeComCertificado(
  nfeId: string,
  certificadoId: string
): Promise<any> {
  const response = await fetch("/api/nfe/assinar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      certificadoId
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao assinar NFe: ${text}`);
  }

  return response.json();
}

/**
 * PHASE 3 HÍBRIDO: Enviar NFe para SEFAZ via Bling API
 */
export async function enviarNFeparaSefazViaBling(
  nfeId: string,
  pedidoId: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO",
  token: string
): Promise<any> {
  const response = await fetch("/api/nfe/enviar-bling", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      nfeId,
      pedidoId,
      ambiente,
      via: "bling"
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao enviar NFe via Bling: ${text}`);
  }

  return response.json();
}

/**
 * PHASE 3 HÍBRIDO: Consultar status NFe via Bling
 */
export async function consultarStatusNFeSefazViaBling(
  chaveAcesso: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO",
  token: string
): Promise<any> {
  const response = await fetch(
    `/api/nfe/status-bling?chaveAcesso=${chaveAcesso}&ambiente=${ambiente}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error("Erro ao consultar status via Bling");
  }

  return response.json();
}

/**
 * PHASE 3 HÍBRIDO: Escolher estratégia de envio (Bling ou Direto)
 */
export async function enviarNFeSefazHibrido(
  nfeId: string,
  pedidoId: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO",
  estrategia: "bling" | "direto",
  token?: string
): Promise<any> {
  if (estrategia === "bling" && !token) {
    throw new Error("Token do Bling é obrigatório para envio via Bling");
  }

  if (estrategia === "bling") {
    return enviarNFeparaSefazViaBling(nfeId, pedidoId, ambiente, token!);
  } else {
    return enviarNFeParaSefazReal(nfeId, ambiente);
  }
}

/**
 * PHASE 3 SOAP REAL: Enviar para SEFAZ com integração SOAP real
 */
export async function enviarNFeParaSefazReal(
  nfeId: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO"
): Promise<any> {
  const response = await fetch("/api/nfe/enviar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      ambiente
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao enviar NFe para SEFAZ: ${text}`);
  }

  return response.json();
}

/**
 * PHASE 3 SOAP REAL: Consultar Status com SOAP real
 */
export async function consultarStatusNFeSoapReal(
  chaveAcesso: string,
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO"
): Promise<any> {
  const response = await fetch(
    `/api/nfe/consultar-status?chaveAcesso=${chaveAcesso}&ambiente=${ambiente}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error("Erro ao consultar status SEFAZ");
  }

  return response.json();
}

/**
 * PHASE 3 SOAP REAL: Cancelar NFe com integração SOAP real
 */
export async function cancelarNFeSoapReal(
  nfeId: string,
  justificativa: string
): Promise<any> {
  const response = await fetch("/api/nfe/cancelar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      nfeId,
      justificativa
    })
  });

  if (!response.ok) {
    throw new Error("Erro ao cancelar NFe");
  }

  return response.json();
}

/**
 * Busca a nota fiscal associada a um pedido de venda.
 */
export async function searchNfeByOrder(
  apiKey: string,
  numeroPedido: string
): Promise<NfeSaida | null> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const params = {
      numeroPedidoLoja: numeroPedido,
      tipo: "1", // Saída
      limite: "1"
    };
    const resp = await fetchWithRetry(
      `/api/bling/nfe/listar-saida?${new URLSearchParams(params).toString()}`,
      {
        headers: { Authorization: authH, Accept: "application/json" }
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const nfe = data?.notas?.[0] || data?.data?.[0];
    if (!nfe) return null;

    return {
      id: nfe.id,
      numero: String(nfe.numero),
      serie: String(nfe.serie),
      chaveAcesso: nfe.chaveAcesso,
      situacao: nfe.situacao,
      situacaoDescr: NFE_SIT_MAP[nfe.situacao] || `Situacao ${nfe.situacao}`,
      dataEmissao: nfe.dataEmissao,
      valorTotal: cleanMoney(nfe.valorNota),
      contato: nfe.contato,
      linkDanfe: nfe.linkDanfe,
      numeroLoja: nfe.numeroPedidoLoja,
      numeroPedidoLoja: nfe.numeroPedidoLoja
    };
  } catch (e) {
    console.warn("[searchNfeByOrder] Erro:", e);
    return null;
  }
}

/**
 * Busca objetos de postagem de uma venda usando o ID interno do Bling (idVendas[]).
 * O parâmetro correto da API v3 do Bling é `idVendas[]`, não `numeroPedidoLoja`.
 */
export async function fetchObjetosPostagem(
  apiKey: string,
  idVenda: string | number
): Promise<any[]> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  if (!idVenda) return [];
  try {
    const resp = await fetchWithRetry(
      `/api/bling/objetos-postagem?idVendas[]=${encodeURIComponent(String(idVenda))}`,
      { headers: { Authorization: authH, Accept: "application/json" } }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn(`[fetchObjetosPostagem] Status ${resp.status} para idVenda=${idVenda}:`, err);
      return [];
    }
    const data = await resp.json();
    return data?.data || [];
  } catch (e) {
    console.warn(`[fetchObjetosPostagem] Erro para idVenda=${idVenda}:`, e);
    return [];
  }
}

/**
 * Busca objetos de postagem para múltiplas vendas em uma única requisição.
 * Usa `idVendas[]=id1&idVendas[]=id2` conforme API v3 do Bling.
 * Retorna um mapa: idVenda → objeto de postagem.
 */
export async function fetchObjetosPostagemBatch(
  apiKey: string,
  idVendas: (string | number)[]
): Promise<Map<string, any>> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resultado = new Map<string, any>();
  if (!idVendas.length) return resultado;

  // Bling aceita até ~50 IDs por requisição
  const CHUNK = 50;
  for (let i = 0; i < idVendas.length; i += CHUNK) {
    const chunk = idVendas.slice(i, i + CHUNK);
    const qs = chunk.map(id => `idVendas[]=${encodeURIComponent(String(id))}`).join("&");
    try {
      const resp = await fetchWithRetry(
        `/api/bling/objetos-postagem?${qs}`,
        { headers: { Authorization: authH, Accept: "application/json" } }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const objetos: any[] = data?.data || [];
      for (const obj of objetos) {
        const vid = String(obj.venda?.id || obj.idVenda || "");
        if (vid) resultado.set(vid, obj);
      }
    } catch (e) {
      console.warn(`[fetchObjetosPostagemBatch] Erro no chunk ${i}:`, e);
    }
    if (i + CHUNK < idVendas.length) await new Promise(r => setTimeout(r, 300));
  }
  return resultado;
}

/**
 * Busca etiquetas ZPL para múltiplas NF-es de uma vez.
 * Fluxo: idVendas[] → objetos-postagem → idsObjetos[] → ZPL em lote.
 * Retorna mapa: idVenda → zpl string.
 */
export async function fetchEtiquetasZplBatch(
  apiKey: string,
  idVendas: (string | number)[]
): Promise<Map<string, string>> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const resultado = new Map<string, string>();
  if (!idVendas.length) return resultado;

  // 1. Busca todos os objetos de postagem
  const objetosMap = await fetchObjetosPostagemBatch(apiKey, idVendas);
  if (!objetosMap.size) return resultado;

  // 2. Monta lista de idsObjetos e guarda relação objeto → venda
  const objetoParaVenda = new Map<number, string>();
  for (const [vid, obj] of objetosMap) {
    if (obj.id) objetoParaVenda.set(Number(obj.id), vid);
  }
  const idsObjetos = Array.from(objetoParaVenda.keys());
  if (!idsObjetos.length) return resultado;

  // 3. Busca ZPL em lote (até 50 por vez)
  const CHUNK = 50;
  for (let i = 0; i < idsObjetos.length; i += CHUNK) {
    const chunk = idsObjetos.slice(i, i + CHUNK);
    const qs = chunk.map(id => `idsObjetos[]=${id}`).join("&");
    try {
      const resp = await fetchWithRetry(
        `/api/bling/logisticas/etiquetas/zpl?${qs}`,
        { headers: { Authorization: authH, Accept: "application/json" } }
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const zpls: any[] = data?.data || [];
      for (const item of zpls) {
        const vid = objetoParaVenda.get(Number(item.id));
        if (vid && item.zpl) resultado.set(vid, item.zpl);
      }
    } catch (e) {
      console.warn(`[fetchEtiquetasZplBatch] Erro no chunk ${i}:`, e);
    }
    if (i + CHUNK < idsObjetos.length) await new Promise(r => setTimeout(r, 300));
  }
  return resultado;
}

/**
 * Busca transportadoras/logísticas ativas do Bling.
 * GET /logisticas?situacao=H (Habilitado)
 */
export async function fetchLogisticas(
  apiKey: string,
  situacao: string = "H"
): Promise<any[]> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const resp = await fetchWithRetry(
      `/api/bling/logisticas?situacao=${encodeURIComponent(situacao)}`,
      { headers: { Authorization: authH, Accept: "application/json" } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data?.data || [];
  } catch (e) {
    console.warn("[fetchLogisticas] Erro:", e);
    return [];
  }
}

/**
 * Busca objetos de logística (objetos de postagem) com paginação.
 * GET /logisticas/objetos?idTransportador=X&pagina=Y&limite=Z&dataInicial=A&dataFinal=B
 */
export async function fetchLogisticasObjetos(
  apiKey: string,
  opts: {
    idTransportador?: string | number;
    pagina?: number;
    limite?: number;
    dataInicial?: string;
    dataFinal?: string;
  } = {}
): Promise<{ data: any[]; hasMore: boolean }> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  const params = new URLSearchParams();
  if (opts.idTransportador) params.set("idTransportador", String(opts.idTransportador));
  if (opts.pagina) params.set("pagina", String(opts.pagina));
  if (opts.limite) params.set("limite", String(opts.limite || 100));
  if (opts.dataInicial) params.set("dataInicial", opts.dataInicial);
  if (opts.dataFinal) params.set("dataFinal", opts.dataFinal);
  try {
    const resp = await fetchWithRetry(
      `/api/bling/logisticas/objetos?${params.toString()}`,
      { headers: { Authorization: authH, Accept: "application/json" } }
    );
    if (!resp.ok) return { data: [], hasMore: false };
    const json = await resp.json();
    const data = json?.data || [];
    return { data, hasMore: data.length >= (opts.limite || 100) };
  } catch (e) {
    console.warn("[fetchLogisticasObjetos] Erro:", e);
    return { data: [], hasMore: false };
  }
}

/**
 * Busca detalhes de um contato pelo ID.
 * GET /contatos/:id
 */
export async function fetchContato(
  apiKey: string,
  contatoId: number | string
): Promise<any> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const resp = await fetchWithRetry(
      `/api/bling/contatos/${contatoId}`,
      { headers: { Authorization: authH, Accept: "application/json" } }
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.data || null;
  } catch (e) {
    console.warn("[fetchContato] Erro:", e);
    return null;
  }
}

/**
 * Cria um objeto logístico no Bling.
 * POST /logisticas/objetos
 */
export async function createObjetoLogistico(
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ id?: number; [key: string]: unknown } | null> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const resp = await fetch("/api/bling/logisticas/objetos", {
      method: "POST",
      headers: {
        Authorization: authH,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.warn("[createObjetoLogistico] HTTP", resp.status);
      return null;
    }
    const json = await resp.json();
    return json?.data || json || null;
  } catch (e) {
    console.warn("[createObjetoLogistico] Erro:", e);
    return null;
  }
}

/**
 * Cria uma remessa logística no Bling (até 50 objetos por remessa, por transportadora).
 * POST /logisticas/remessas
 */
export async function criarRemessa(
  apiKey: string,
  idLogistica: number | null,
  objetoIds: number[]
): Promise<{ id?: number; [key: string]: unknown } | null> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const body: Record<string, unknown> = { objetos: objetoIds.map(id => ({ id })) };
    if (idLogistica) body.logistica = { id: idLogistica };
    const resp = await fetch("/api/bling/logisticas/remessas", {
      method: "POST",
      headers: {
        Authorization: authH,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.warn("[criarRemessa] HTTP", resp.status);
      return null;
    }
    const json = await resp.json();
    return json?.data || json || null;
  } catch (e) {
    console.warn("[criarRemessa] Erro:", e);
    return null;
  }
}

/**
 * Busca etiquetas ZPL de um ou mais objetos logísticos.
 * GET /logisticas/etiquetas/zpl?idsObjetos[]=...
 */
export async function fetchEtiquetaZplByObjetos(
  apiKey: string,
  ids: number[]
): Promise<{ id: number; zpl: string }[]> {
  const authH = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  try {
    const qs = ids.map(id => `idsObjetos[]=${id}`).join("&");
    const resp = await fetch(`/api/bling/logisticas/etiquetas/zpl?${qs}`, {
      headers: { Authorization: authH, Accept: "application/json" },
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.data || [];
  } catch (e) {
    console.warn("[fetchEtiquetaZplByObjetos] Erro:", e);
    return [];
  }
}
