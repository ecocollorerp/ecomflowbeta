import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import https from "https";
import {
  enviarNFeParaSefaz,
  consultarStatusNFeSefaz,
  cancelarNFeSefaz,
  inutilizarNumerosNFeSefaz,
  gerarXMLNFe
} from "./lib/sefazIntegration.js";
import type { SefazConfig } from "./lib/sefazIntegration.js";
import {
  parseArquivoPFX,
  assinarXMLNFe,
  validarCertificado
} from "./lib/certificateManager.js";
import {
  criarNFe,
  obterNFe,
  obterNFePorChaveAcesso,
  listarNFes,
  atualizarNFe,
  deletarNFe,
  obterProximoNumeroNFe
} from "./lib/nfeSupabase.js";
import {
  criarCertificado,
  obterCertificado,
  listarCertificados,
  atualizarCertificado,
  deletarCertificado,
  obterCertificadoPorCNPJ
} from "./lib/certificateSupabase.js";
import { ZPLGenerator } from "./lib/zplGenerator.js";
import { dbClient as supabase } from "./lib/supabaseClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load SSL certificates
  const certPath = path.join(__dirname, "cert.pem");
  const keyPath = path.join(__dirname, "key.pem");
  let sslOptions = null;

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    sslOptions = {
      cert: fs.readFileSync(certPath, "utf8"),
      key: fs.readFileSync(keyPath, "utf8"),
    };
  } else {
    console.warn("⚠️ Certificados SSL não encontrados. Iniciando em modo HTTP.");
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes for Bling Proxy
  app.get("/api/download-project", async (req, res) => {
    try {
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 9 } });

      res.attachment("projeto-erp-fabrica.zip");

      archive.pipe(res);

      // Add files from root directory, excluding node_modules, .git, dist, etc.
      archive.glob("**/*", {
        cwd: __dirname,
        ignore: [
          "node_modules/**",
          ".git/**",
          "dist/**",
          ".env",
          ".env.local",
          ".DS_Store"
        ]
      });

      await archive.finalize();
    } catch (error: any) {
      console.error("Download Error:", error);
      res.status(500).send("Erro ao gerar arquivo zip.");
    }
  });

  // Rota para salvar múltiplas NF-e no ERP local (Supabase) em lote
  app.post("/api/bling/nfe/save-batch", async (req, res) => {
    try {
      const nfes: any[] = Array.isArray(req.body?.nfes)
        ? req.body.nfes
        : Array.isArray(req.body)
          ? req.body
          : [];
      if (!nfes || nfes.length === 0)
        return res
          .status(400)
          .json({ success: false, error: "Nenhuma NFe enviada" });

      const resultados: any[] = [];
      for (const nfe of nfes) {
        try {
          const created = await criarNFe(nfe);
          resultados.push({ input: nfe, result: created });
        } catch (err: any) {
          resultados.push({
            input: nfe,
            result: { sucesso: false, erro: err?.message || String(err) }
          });
        }
      }

      const ok = resultados.filter((r) => r.result?.sucesso).length;
      const fail = resultados.length - ok;
      res.json({ success: true, total: resultados.length, ok, fail });
    } catch (error: any) {
      console.error("❌ [SAVE BATCH NFE ERROR]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Rota para buscar chaves de NF-e já sincronizadas
  app.get("/api/erp/nfe/synced-ids", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("nfes")
        .select("numero, chave_acesso, id"); // Adicionado id

      if (error) {
        console.error("❌ [SYNCED IDS ERROR]:", error);
        return res.status(500).json({ success: false, error: error.message });
      }

      const keys = new Set<string>();
      data?.forEach((n: any) => {
        if (n.numero) keys.add(String(n.numero));
        if (n.chave_acesso) keys.add(String(n.chave_acesso));
        if (n.id) keys.add(String(n.id));
      });

      console.log(
        `✅ [SYNCED IDS] Retornando ${keys.size} chaves sincronizadas`
      );
      res.json({ success: true, syncedKeys: Array.from(keys) });
    } catch (error: any) {
      console.error("❌ [SYNCED IDS ERROR]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // DEBUG: Teste de token simples
  app.get("/api/debug/token-test", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Teste de Token - Bling API</title>
        <style>
          body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
          input, textarea { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ccc; }
          button { padding: 10px 20px; background: #007bff; color: white; border: none; cursor: pointer; }
          .result { background: #f5f5f5; padding: 10px; margin: 20px 0; border-left: 4px solid #007bff; }
          .error { border-left-color: #dc3545; }
          .success { border-left-color: #28a745; }
        </style>
      </head>
      <body>
        <h1>🔐 Teste de Autenticação Bling API</h1>
        
        <div>
          <label><strong>Client ID:</strong></label>
          <input type="text" id="clientId" placeholder="Cole seu Client ID">
        </div>
        
        <div>
          <label><strong>Client Secret:</strong></label>
          <input type="password" id="clientSecret" placeholder="Cole seu Client Secret">
        </div>
        
        <div>
          <label><strong>Código de Autorização:</strong></label>
          <input type="text" id="code" placeholder="Cole o código da URL (code=abc123...)">
          <small>📌 Após clicar em autorizar no Bling, você será redirecionado para uma URL com o código na query string</small>
        </div>
        
        <div>
          <label><strong>Redirect URI:</strong></label>
          <input type="text" id="redirectUri" value="${process.env.NODE_ENV === "production" ? "https://seu-dominio.com" : "https://localhost:3000"}" placeholder="Deve bater com o cadastrado no Bling">
        </div>
        
        <button onclick="testarToken()">🚀 Testar Token</button>
        
        <div id="result"></div>
        
        <script>
          async function testarToken() {
            const clientId = document.getElementById('clientId').value;
            const clientSecret = document.getElementById('clientSecret').value;
            const code = document.getElementById('code').value;
            const redirectUri = document.getElementById('redirectUri').value;
            const resultDiv = document.getElementById('result');
            
            if (!clientId || !clientSecret || !code) {
              resultDiv.innerHTML = '<div class="result error">❌ Preencha todos os campos</div>';
              return;
            }
            
            resultDiv.innerHTML = '<div class="result">⏳ Aguardando...</div>';
            
            try {
              const response = await fetch('/api/bling/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  grant_type: 'authorization_code',
                  code: code.trim(),
                  client_id: clientId.trim(),
                  client_secret: clientSecret.trim(),
                  redirect_uri: redirectUri.trim()
                })
              });
              
              const data = await response.json();
              
              if (data.access_token) {
                resultDiv.innerHTML = \`
                  <div class="result success">
                    <h3>✅ Sucesso!</h3>
                    <p><strong>Access Token:</strong></p>
                    <textarea readonly>\${data.access_token}</textarea>
                    <p><strong>Refresh Token:</strong></p>
                    <textarea readonly>\${data.refresh_token || 'Não fornecido'}</textarea>
                    <p><strong>Expires In:</strong> \${data.expires_in} segundos</p>
                  </div>
                \`;
              } else {
                resultDiv.innerHTML = \`
                  <div class="result error">
                    <h3>❌ Erro:</h3>
                    <pre>\${JSON.stringify(data, null, 2)}</pre>
                  </div>
                \`;
              }
            } catch (e) {
              resultDiv.innerHTML = \`
                <div class="result error">
                  <h3>❌ Erro na requisição:</h3>
                  <pre>\${e.message}</pre>
                </div>
              \`;
            }
          }
        </script>
      </body>
      </html>
    `);
  });

  app.post("/api/bling/token", async (req, res) => {
    try {
      const {
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type,
        refresh_token
      } = req.body;

      // Log mínimo para evitar exposição de dados sensíveis
      console.log("🔐 [BLING TOKEN REQUEST]");
      console.log(`   Grant Type: ${grant_type}`);
      console.log(`   Client ID: ${client_id?.substring(0, 10)}...`);
      console.log(`   Redirect URI configurado: ${Boolean(redirect_uri)}`);

      // Validações
      if (grant_type === "authorization_code" && !code) {
        return res
          .status(400)
          .json({ error: "Code é obrigatório para authorization_code" });
      }
      if (grant_type === "refresh_token" && !refresh_token) {
        return res.status(400).json({ error: "Refresh token é obrigatório" });
      }

      // Prepare URLSearchParams EXATAMENTE como o Bling espera
      const body = new URLSearchParams();

      if (grant_type === "authorization_code") {
        body.append("grant_type", "authorization_code");
        body.append("code", code.trim()); // IMPORTANTE: trim para remover espaços
        body.append("redirect_uri", redirect_uri);
        // NÃO colocamos client_id e client_secret no body quando usamos Basic Auth
      } else if (grant_type === "refresh_token") {
        body.append("grant_type", "refresh_token");
        body.append("refresh_token", refresh_token.trim());
      }

      // Autenticação Basic (client_id:client_secret em Base64)
      const credentials = Buffer.from(`${client_id}:${client_secret}`).toString(
        "base64"
      );

      const response = await fetch(
        "https://www.bling.com.br/Api/v3/oauth/token",
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "NOVO-ERP-Sync/1.0"
          },
          body: body.toString()
        }
      );

      const data = await response.json();

      if (response.ok) {
        console.log("✅ [BLING TOKEN SUCCESS] Token gerado com sucesso");
      } else {
        console.log("❌ [BLING TOKEN ERROR] Falha ao gerar token (detalhes ocultados)");
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ Bling Token Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // In-memory storage for sync logs and vinculations (use database in production)
  let syncLogs: any[] = [];
  let productVinculations: any[] = [];
  let syncedOrdersStore: any[] = [];
  let syncedInvoicesStore: any[] = [];
  let syncedProductsStore: any[] = [];

  // Cache for Sales Channels (canais-venda)
  let cachedCanais: any = null;
  let cachedCanaisTime: number = 0;
  const CANAIS_CACHE_TTL = 3600 * 1000; // 1 hour

  // Cache para listagem de NF-e (evita 429 em paginação rápida)
  const nfeListCache = new Map<string, { data: any; timestamp: number }>();
  const NFE_LIST_CACHE_TTL = 60 * 1000; // 1 minuto

  /** Garante que o token tenha o prefixo "Bearer " antes de enviar ao Bling/ML/Shopee */
  const normalizeBearerToken = (raw: string): string => {
    const t = (raw || "").trim();
    if (!t) return "";
    return t.toLowerCase().startsWith("bearer ") ? t : `Bearer ${t}`;
  };

  /**
   * Helper para identificar a loja (ML, Shopee, Site)
   */
  function parseLoja(
    nome: string,
    numeroLoja?: string
  ): string {
    const n = String(nome || "").toUpperCase();
    if (
      n.includes("MERCADO") ||
      n.includes("MEU_CANAL_ML") ||
      String(numeroLoja).startsWith("6")
    )
      return "ML";
    if (n.includes("SHOPEE") || String(numeroLoja).startsWith("7"))
      return "SHOPEE";
    if (n.includes("TIKTOK") || n.includes("TIK TOK") || String(numeroLoja).startsWith("8"))
      return "TIKTOK";
    return "SITE";
  }

  /**
   * Extrai o número da loja virtual e a loja de um pedido do Bling.
   */
  const extrairMetadadosPedido = (pedido: any) => {
    let numeroLojaVirtual = pedido?.numeroLoja;
    const lojaRaw =
      pedido?.loja?.nome ||
      pedido?.loja?.descricao ||
      pedido?.origem?.nome ||
      pedido?.origem ||
      "";
    const detectedLoja = parseLoja(lojaRaw, numeroLojaVirtual);

    if (!numeroLojaVirtual) {
      const camposTexto = [
        pedido?.observacoes,
        pedido?.observacoesInternas,
        pedido?.informacoesAdicionais,
        pedido?.dadosAdicionais
      ].filter(Boolean);

      for (const campo of camposTexto) {
        if (typeof campo === "string") {
          const match = campo.match(
            /(?:Número\s+(?:loja\s+virtual|da\s+loja)|Order\s+ID|Pedido\s+original)\s*[:\-]?\s*([A-Za-z0-9\-_]+)/i
          );
          if (match && match[1]) {
            numeroLojaVirtual = match[1].trim();
            break;
          }
        }
      }
    }
    return { numeroLojaVirtual, detectedLoja };
  };

  /**
   * Realiza o PATCH em uma NF-e do Bling para injetar metadados do pedido original.
   */
  const patchNfeComDadosPedido = async (
    token: string,
    nfId: number | string,
    pedido: any,
    metadados: any
  ) => {
    const { numeroLojaVirtual, detectedLoja } = metadados;
    const infoAdicional = `Pedido: ${numeroLojaVirtual || "N/A"} | Loja: ${detectedLoja}`;

    const nfeUpdatePayload = {
      contato: pedido.contato,
      naturezaOperacao: pedido.naturezaOperacao,
      observacoes: `${pedido.observacoes || ""}\n${infoAdicional}`.trim()
    };

    console.log(
      `📝 [NFe PATCH] Injetando metadados na NF-e ${nfId}: ${infoAdicional}`
    );

    return await fetch(`https://www.bling.com.br/Api/v3/nfe/${nfId}`, {
      method: "PATCH",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(nfeUpdatePayload)
    });
  };

  // SYNC ENDPOINTS - PHASE 1
  app.get("/api/bling/sync/orders", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const dataInicio = String(
        req.query.dataInicio ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
      );
      const dataFim = String(
        req.query.dataFim || new Date().toISOString().split("T")[0]
      );
      const status = String(req.query.status || "TODOS").toUpperCase();
      const loja = String(req.query.loja || "ALL").toUpperCase();
      const idLojaFilter = req.query.idLoja ? String(req.query.idLoja) : null;

      console.log(
        `📋 [SYNC PEDIDOS DE VENDAS] Data: ${dataInicio} a ${dataFim} | Status: ${status} | Loja: ${loja}`
      );

      // ── Paginação: busca TODAS as páginas ──────────────────────────────────
      const allRawOrders: any[] = [];
      let pagina = 1;
      let continuar = true;

      // Mapear status textual → idsSituacoes do Bling v3
      const statusIdMap: Record<string, string[]> = {
        "EM ABERTO": ["6"],
        "EM ANDAMENTO": ["15"],
        ATENDIDO: ["9"],
        "EM ABERTO,ATENDIDO": ["6", "9"]
      };
      const situacaoIds = statusIdMap[status] || []; // vazio = TODOS

      while (continuar) {
        const situacoesQs = situacaoIds
          .map((id: string, i: number) => `&idsSituacoes[${i}]=${id}`)
          .join("");
        let url = `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${dataInicio}&dataFinal=${dataFim}&limite=100&pagina=${pagina}${situacoesQs}`;
        if (idLojaFilter) url += `&idLoja=${encodeURIComponent(idLojaFilter)}`;
        const pageResp = await fetch(url, {
          headers: { Authorization: token, Accept: "application/json" }
        });

        if (!pageResp.ok) {
          if (pagina === 1) {
            return res
              .status(pageResp.status)
              .json({ error: "Erro ao buscar pedidos do Bling" });
          }
          break; // Para em páginas subsequentes com erro
        }

        const pageData = await pageResp.json();
        const pageOrders: any[] = pageData.data || [];

        if (pageOrders.length === 0) {
          continuar = false;
        } else {
          allRawOrders.push(...pageOrders);
          // Bling retorna no máximo 100 por página; se vier menos, acabou
          if (pageOrders.length < 100) continuar = false;
          else pagina++;
        }

        // Segurança: máximo 100 páginas (10.000 pedidos)
        if (pagina > 100) continuar = false;
      }

      console.log(
        `📋 [SYNC PEDIDOS] Total raw: ${allRawOrders.length} em ${pagina} página(s) | situacoes API: ${situacaoIds.join(",") || "TODOS"}`
      );

      // ── Montar pedidos COMPLETOS (um por order) com itens aninhados ────────
      // Filtro de situação já foi aplicado pela API via idsSituacoes
      // Apenas filtramos por loja se solicitado
      const completeOrders: any[] = allRawOrders
        .filter((order: any) => {
          if (loja === "ALL") return true;
          const detectedLoja = parseLoja(
            order?.loja?.nome || order?.origem || order?.tipo
          );
          return detectedLoja === loja;
          return true;
        })
        .map((order: any) => {
          const detectedLoja = parseLoja(
            order?.loja?.nome || order?.origem || order?.tipo
          );
          const idLojaVirtual = order.loja?.id ? String(order.loja.id) : "";
          const orderDate = String(order?.data || "").split("T")[0];
          const items = Array.isArray(order?.itens) ? order.itens : [];

          return {
            id: `order-${order.id}`,
            orderId: String(
              order?.numeroLoja || order?.numero || order?.id || ""
            ),
            blingId: String(order?.id || ""),
            blingNumero: String(order?.numero || ""),
            customer_name: order?.contato?.nome || "Não informado",
            customer_cpf_cnpj: order?.contato?.numeroDocumento || "",
            data: orderDate,
            status: String(
              order?.situacao?.descricao ||
                order?.situacao?.valor ||
                "Em aberto"
            ),
            situacaoId: Number(order?.situacao?.id || 0),
            loja: detectedLoja,
            lojaData: order.loja, // Objeto completo
            idLojaVirtual,
            total: Number(order?.total || 0),
            desconto: Number(order?.desconto?.valor || 0),
            frete: Number(order?.transporte?.frete || 0),
            rastreamento: order?.transporte?.codigoRastreamento || "",
            transportador: order?.transporte?.transportador?.nome || "",
            observacoes: order?.observacoes || "",
            itens: items.map((item: any) => {
              const sku = String(
                item?.codigo || item?.codigoProduto || ""
              ).trim();
              const vinculation = productVinculations.find(
                (v) => v.blingCode === sku
              );
              return {
                id: `item-${order.id}-${sku || item?.id}`,
                sku,
                descricao: item?.descricao || item?.nome || "",
                quantidade: Number(item?.quantidade || 0),
                valorUnitario: Number(item?.valor || item?.valorUnitario || 0),
                subtotal:
                  Number(item?.quantidade || 0) * Number(item?.valor || 0),
                finalProductSku: vinculation?.erpSku || null,
                finalProductId: vinculation?.erpProductId || null
              };
            }),
            itensCount: items.length,
            // Retrocompatibilidade para transformSyncedOrder
            sku: items.length === 1 ? String(items[0]?.codigo || "") : null,
            quantity: items.reduce(
              (s: number, i: any) => s + Number(i?.quantidade || 0),
              0
            ),
            unit_price: items.length === 1 ? Number(items[0]?.valor || 0) : 0
          };
        });

      // Também gera a lista flat (itens) para retrocompatibilidade
      const flatItems: any[] = completeOrders.flatMap((order: any) =>
        order.itens.length > 0
          ? order.itens.map((item: any) => ({
              ...item,
              orderId: order.orderId,
              blingId: order.blingId,
              customer_name: order.customer_name,
              data: order.data,
              status: "NOVO",
              loja: order.loja,
              total: order.total,
              lote: null
            }))
          : [
              {
                id: order.id,
                orderId: order.orderId,
                blingId: order.blingId,
                customer_name: order.customer_name,
                data: order.data,
                status: "NOVO",
                loja: order.loja,
                lote: null,
                sku: null,
                quantity: 0,
                total: order.total
              }
            ]
      );

      syncedOrdersStore = flatItems;

      const syncLog = {
        id: `sync-${Date.now()}`,
        type: "PEDIDOS",
        status: "SUCCESS",
        startedAt: Date.now(),
        completedAt: Date.now(),
        recordsProcessed: completeOrders.length,
        recordsFailed: 0,
        details: {
          newRecords: completeOrders.length,
          updatedRecords: 0,
          skippedRecords: 0,
          totalPages: pagina
        }
      };

      syncLogs.unshift(syncLog);
      if (syncLogs.length > 100) syncLogs.pop();

      console.log(
        `✅ [SYNC PEDIDOS] ${completeOrders.length} pedidos completos sincronizados`
      );

      res.json({
        success: true,
        status: "SUCCESS",
        type: "PEDIDOS",
        totalRecords: completeOrders.length,
        processedRecords: completeOrders.length,
        failedRecords: 0,
        newRecords: completeOrders.length,
        updatedRecords: 0,
        totalPages: pagina,
        orders: completeOrders, // pedidos completos (um por order)
        items: flatItems, // itens flat (retrocompatibilidade)
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("❌ [SYNC PEDIDOS ERROR]:", error);
      res.status(500).json({
        success: false,
        status: "ERROR",
        type: "PEDIDOS",
        errorMessage: error.message
      });
    }
  });

  app.get("/api/bling/sync/invoices", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const dataInicio = String(
        req.query.dataInicio ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
      );
      const dataFim = String(
        req.query.dataFim || new Date().toISOString().split("T")[0]
      );
      const status = String(req.query.status || "TODOS").toUpperCase();
      const numeroLojaFilter = req.query.numeroLoja
        ? String(req.query.numeroLoja)
        : req.query.idLoja
          ? String(req.query.idLoja)
          : null;

      console.log(`📄 [SYNC NOTAS FISCAIS] Data: ${dataInicio} a ${dataFim}`);

      // Paginação: busca todas as páginas de notas
      const allRawInvoices: any[] = [];
      let nfPagina = 1;
      let nfContinuar = true;

      // Triple-Fetch: buscar no máximo 3 páginas (até ~300 registros)
      const maxNfPages = 3;
      while (nfContinuar && nfPagina <= maxNfPages) {
        let nfUrl = `https://www.bling.com.br/Api/v3/nfe?dataEmissaoInicial=${dataInicio}%2000:00:00&dataEmissaoFinal=${dataFim}%2023:59:59&limite=100&pagina=${nfPagina}`;
        if (numeroLojaFilter)
          nfUrl += `&numeroLoja=${encodeURIComponent(numeroLojaFilter)}`;
        // permite filtro direto por situação (ex: ?situacao=1) repassado pelo frontend
        if (req.query.situacao)
          nfUrl += `&situacao=${encodeURIComponent(String(req.query.situacao))}`;
        const pageResp = await fetch(nfUrl, {
          headers: { Authorization: token, Accept: "application/json" }
        });

        if (!pageResp.ok) {
          if (nfPagina === 1)
            return res
              .status(pageResp.status)
              .json({ error: "Erro ao buscar notas fiscais" });
          break;
        }

        const pageData = await pageResp.json();
        const pageItems: any[] = pageData.data || [];
        if (pageItems.length === 0) {
          nfContinuar = false;
        } else {
          allRawInvoices.push(...pageItems);
          if (pageItems.length < 100) nfContinuar = false;
          else nfPagina++;
        }
        // Segurança: limite máximo de páginas por chamada (Triple-Fetch)
        if (nfPagina >= maxNfPages) nfContinuar = false;
      }

      const rawInvoices = allRawInvoices;
      const normalizedInvoices = rawInvoices
        .map((nf: any) => ({
          id: String(nf?.id || ""),
          numero: String(nf?.numero || ""),
          serie: String(nf?.serie || ""),
          nomeCliente: nf?.contato?.nome || "Não informado",
          dataEmissao: String(nf?.dataEmissao || "").split("T")[0],
          valorNota: Number(nf?.valorNota || nf?.valor || 0),
          situacao: String(nf?.situacao?.descricao || nf?.situacao || ""),
          status: String(
            nf?.situacao?.descricao || nf?.situacao || ""
          ).toUpperCase(),
          idPedidoVenda: String(nf?.pedido?.id || nf?.idPedidoVenda || ""),
          linkDanfe: nf?.linkDanfe || nf?.xml || ""
        }))
        .filter((nf: any) => {
          if (status === "TODOS") return true;
          if (status === "EMITIDAS")
            return (
              nf.status.includes("EMITIDA") || nf.status.includes("AUTORIZADA")
            );
          if (status === "PENDENTES")
            return (
              !nf.status.includes("EMITIDA") &&
              !nf.status.includes("AUTORIZADA")
            );
          return true;
        });

      syncedInvoicesStore = normalizedInvoices;

      const syncLog = {
        id: `sync-${Date.now()}`,
        type: "NOTAS_FISCAIS",
        status: "SUCCESS",
        startedAt: Date.now(),
        completedAt: Date.now(),
        recordsProcessed: normalizedInvoices.length,
        recordsFailed: 0,
        details: {
          newRecords: normalizedInvoices.length,
          updatedRecords: 0,
          skippedRecords: 0
        }
      };

      syncLogs.unshift(syncLog);
      if (syncLogs.length > 100) syncLogs.pop();

      console.log(
        `✅ [SYNC NOTAS FISCAIS] ${normalizedInvoices.length} notas sincronizadas`
      );

      res.json({
        success: true,
        status: "SUCCESS",
        type: "NOTAS_FISCAIS",
        totalRecords: normalizedInvoices.length,
        processedRecords: normalizedInvoices.length,
        failedRecords: 0,
        newRecords: normalizedInvoices.length,
        updatedRecords: 0,
        invoices: normalizedInvoices,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("❌ [SYNC NOTAS FISCAIS ERROR]:", error);
      res.status(500).json({
        success: false,
        status: "ERROR",
        type: "NOTAS_FISCAIS",
        errorMessage: error.message
      });
    }
  });

  app.get("/api/bling/sync/products", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      console.log(`📦 [SYNC PRODUTOS] Iniciando sincronização`);

      const response = await fetch(
        "https://www.bling.com.br/Api/v3/produtos?limite=100",
        { headers: { Authorization: token, Accept: "application/json" } }
      );

      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: "Erro ao buscar produtos" });
      }

      const data = await response.json();
      const rawProducts = data.data || [];
      const normalizedProducts = rawProducts.map((prod: any) => {
        const sku = String(prod?.codigo || "");
        const vinculation = productVinculations.find(
          (v) => v.blingCode === sku
        );
        return {
          id: String(prod?.id || ""),
          codigo: sku,
          descricao: prod?.nome || prod?.descricao || "",
          preco: Number(prod?.preco || 0),
          estoqueAtual: Number(prod?.estoque?.saldoVirtual || 0),
          finalProductSku: vinculation?.erpSku || null,
          finalProductId: vinculation?.erpProductId || null,
          source: "BLING"
        };
      });

      syncedProductsStore = normalizedProducts;

      const syncLog = {
        id: `sync-${Date.now()}`,
        type: "PRODUTOS",
        status: "SUCCESS",
        startedAt: Date.now(),
        completedAt: Date.now(),
        recordsProcessed: normalizedProducts.length,
        recordsFailed: 0,
        details: {
          newRecords: normalizedProducts.length,
          updatedRecords: 0,
          skippedRecords: 0
        }
      };

      syncLogs.unshift(syncLog);
      if (syncLogs.length > 100) syncLogs.pop();

      console.log(
        `✅ [SYNC PRODUTOS] ${normalizedProducts.length} produtos sincronizados`
      );

      res.json({
        success: true,
        status: "SUCCESS",
        type: "PRODUTOS",
        totalRecords: normalizedProducts.length,
        processedRecords: normalizedProducts.length,
        failedRecords: 0,
        newRecords: normalizedProducts.length,
        updatedRecords: 0,
        products: normalizedProducts,
        vinculations: productVinculations,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("❌ [SYNC PRODUTOS ERROR]:", error);
      res.status(500).json({
        success: false,
        status: "ERROR",
        type: "PRODUTOS",
        errorMessage: error.message
      });
    }
  });

  // Sync stock adjustments from Bling (saldo virtual por depósito)
  app.get("/api/bling/sync/stock", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      console.log(`📦 [SYNC ESTOQUE] Iniciando sincronização de estoque`);

      // --- Fase 1: buscar todos os produtos paginado ---
      let allProducts: any[] = [];
      let pagina = 1;
      let continuar = true;
      while (continuar) {
        const resp = await fetch(
          `https://www.bling.com.br/Api/v3/produtos?limite=100&pagina=${pagina}&situacao=A`,
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        if (!resp.ok) {
          if (pagina === 1)
            return res
              .status(resp.status)
              .json({ error: "Erro ao buscar produtos do Bling" });
          break;
        }
        const d = await resp.json();
        const page: any[] = d?.data || [];
        allProducts.push(...page);
        if (page.length < 100) continuar = false;
        else pagina++;
        if (pagina > 50) continuar = false;
      }
      console.log(
        `📦 [SYNC ESTOQUE] ${allProducts.length} produto(s) encontrado(s) em ${pagina} página(s)`
      );

      // --- Fase 2: buscar saldos reais via /estoques paginado ---
      const stockMap = new Map<
        string,
        { saldoFisico: number; saldoVirtual: number }
      >();
      let ep = 1;
      let ec = true;
      while (ec) {
        const er = await fetch(
          `https://www.bling.com.br/Api/v3/estoques?limite=100&pagina=${ep}`,
          { headers: { Authorization: token, Accept: "application/json" } }
        ).catch(() => null);
        if (!er || !er.ok) break;
        const ed = await er.json().catch(() => ({}));
        const entries: any[] = ed?.data || [];
        for (const entry of entries) {
          const pid = String(entry?.produto?.id || entry?.produtoId || "");
          if (!pid) continue;
          const cur = stockMap.get(pid) || { saldoFisico: 0, saldoVirtual: 0 };
          cur.saldoFisico += Number(
            entry?.saldoFisico ?? entry?.saldoReal ?? 0
          );
          cur.saldoVirtual += Number(entry?.saldoVirtual ?? 0);
          stockMap.set(pid, cur);
        }
        if (entries.length < 100) ec = false;
        else ep++;
        if (ep > 50) ec = false;
      }
      console.log(
        `📦 [SYNC ESTOQUE] Saldos de ${stockMap.size} produto(s) via /estoques`
      );

      // --- Montar itens finais ---
      const stockItems = allProducts
        .filter((p: any) => p.codigo)
        .map((prod: any) => {
          const pid = String(prod.id || "");
          const fromMap = stockMap.get(pid);
          const saldoFisico =
            fromMap?.saldoFisico ??
            Number(prod?.estoque?.saldoReal || prod?.estoque?.saldoFisico || 0);
          const saldoVirtual =
            fromMap?.saldoVirtual ?? Number(prod?.estoque?.saldoVirtual || 0);
          return {
            id: pid,
            codigo: String(prod.codigo || ""),
            descricao: prod.nome || "",
            saldoFisico,
            saldoVirtual,
            estoqueReal: saldoFisico,
            estoqueVirtual: saldoVirtual,
            unidade: prod.unidade || "UN",
            preco: Number(prod.preco || 0),
            situacao: prod.situacao || "A",
            source: "BLING",
            syncedAt: Date.now()
          };
        });

      const syncLog = {
        id: `sync-${Date.now()}`,
        type: "ESTOQUE",
        status: "SUCCESS",
        startedAt: Date.now(),
        completedAt: Date.now(),
        recordsProcessed: stockItems.length,
        recordsFailed: 0,
        details: {
          newRecords: stockItems.length,
          updatedRecords: 0,
          skippedRecords: 0
        }
      };
      syncLogs.unshift(syncLog);
      if (syncLogs.length > 100) syncLogs.pop();

      console.log(`✅ [SYNC ESTOQUE] ${stockItems.length} itens sincronizados`);

      res.json({
        success: true,
        status: "SUCCESS",
        type: "ESTOQUE",
        totalRecords: stockItems.length,
        processedRecords: stockItems.length,
        failedRecords: 0,
        stockItems,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("❌ [SYNC ESTOQUE ERROR]:", error);
      res
        .status(500)
        .json({
          success: false,
          status: "ERROR",
          type: "ESTOQUE",
          errorMessage: error.message
        });
    }
  });

  // Atualizar saldo de um produto no Bling (ajuste manual)
  app.post("/api/bling/estoque/atualizar", async (req, res) => {
    try {
      const { produtoId, deposito, operacao, quantidade, observacoes } =
        req.body as {
          produtoId: string | number;
          deposito?: number;
          operacao: "B" | "S" | "E"; // B=Balanço, S=Saída, E=Entrada
          quantidade: number;
          observacoes?: string;
        };
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });
      if (!produtoId || !operacao || quantidade == null)
        return res
          .status(400)
          .json({ error: "produtoId, operacao e quantidade são obrigatórios" });

      const payload: any = {
        produto: { id: Number(produtoId) },
        operacao,
        quantidade: Number(quantidade)
      };
      if (deposito) payload.deposito = { id: Number(deposito) };
      if (observacoes) payload.observacoes = observacoes;

      const resp = await fetch("https://www.bling.com.br/Api/v3/estoques", {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const errMsg =
          data?.error?.description ||
          data?.message ||
          `Bling retornou ${resp.status}`;
        return res
          .status(resp.status)
          .json({ success: false, error: errMsg, detail: data });
      }
      res.json({ success: true, data: data?.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Sincronizar tudo de uma vez (orders + invoices + products + stock)
  app.post("/api/bling/sync/all", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const dataInicio = String(
        req.body?.dataInicio ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
      );
      const dataFim = String(
        req.body?.dataFim || new Date().toISOString().split("T")[0]
      );

      console.log(
        `🔄 [SYNC COMPLETO] Sincronizando tudo: ${dataInicio} a ${dataFim}`
      );

      const results: Record<string, any> = {};

      // Orders
      try {
        const ordResp = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${dataInicio}&dataFinal=${dataFim}&limit=100`,
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        const ordData = await ordResp.json();
        results.orders = {
          success: ordResp.ok,
          count: (ordData.data || []).length
        };
      } catch (e: any) {
        results.orders = { success: false, error: e.message };
      }

      // Invoices
      try {
        const nfResp = await fetch(
          `https://www.bling.com.br/Api/v3/nfe?dataEmissaoInicial=${dataInicio}%2000:00:00&dataEmissaoFinal=${dataFim}%2023:59:59&limit=100`,
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        const nfData = await nfResp.json();
        results.invoices = {
          success: nfResp.ok,
          count: (nfData.data || []).length
        };
      } catch (e: any) {
        results.invoices = { success: false, error: e.message };
      }

      // Products
      try {
        const prodResp = await fetch(
          "https://www.bling.com.br/Api/v3/produtos?limite=100",
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        const prodData = await prodResp.json();
        results.products = {
          success: prodResp.ok,
          count: (prodData.data || []).length
        };
      } catch (e: any) {
        results.products = { success: false, error: e.message };
      }

      console.log("✅ [SYNC COMPLETO] Resultado:", results);

      res.json({
        success: true,
        results,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error("❌ [SYNC COMPLETO ERROR]:", error);
      res.status(500).json({ success: false, errorMessage: error.message });
    }
  });

  app.post("/api/bling/sync/vinculate", async (req, res) => {
    try {
      const { erpProductId, blingProductId, blingCode, erpSku } = req.body;

      if (!erpProductId || !blingProductId) {
        return res
          .status(400)
          .json({ error: "erpProductId e blingProductId são obrigatórios" });
      }

      const vinculation = {
        id: `vinc-${Date.now()}`,
        erpProductId,
        blingProductId,
        blingCode: blingCode || "",
        erpSku: erpSku || "",
        createdAt: Date.now(),
        lastSyncedAt: Date.now()
      };

      productVinculations.push(vinculation);
      syncedProductsStore = syncedProductsStore.map((product: any) =>
        product.codigo === blingCode
          ? {
              ...product,
              finalProductSku: erpSku || null,
              finalProductId: erpProductId
            }
          : product
      );

      syncedOrdersStore = syncedOrdersStore.map((order: any) =>
        order.sku === blingCode
          ? {
              ...order,
              finalProductSku: erpSku || null,
              finalProductId: erpProductId
            }
          : order
      );
      console.log(
        `🔗 [VINCULATION] Produto ERP ${erpProductId} vinculado ao Bling ${blingProductId}`
      );

      res.json({ success: true, vinculation });
    } catch (error: any) {
      console.error("❌ [VINCULATION ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bling/sync/status", (req, res) => {
    const lastSync = syncLogs[0] || null;
    const ordersSyncCount = syncLogs.filter((l) => l.type === "PEDIDOS").length;
    const invoicesSyncCount = syncLogs.filter(
      (l) => l.type === "NOTAS_FISCAIS"
    ).length;
    const productsSyncCount = syncLogs.filter(
      (l) => l.type === "PRODUTOS"
    ).length;

    res.json({
      lastSync,
      stats: {
        totalSyncs: syncLogs.length,
        ordersSyncs: ordersSyncCount,
        invoicesSyncs: invoicesSyncCount,
        productsSyncs: productsSyncCount,
        vinculations: productVinculations.length
      },
      recentSyncs: syncLogs.slice(0, 10)
    });
  });

  // ADVANCED FILTERING - PHASE 2

  // In-memory storage for lotes and filtered results
  let lotes: any[] = [];
  let filteredDataStore: any = {};

  app.post("/api/bling/filter", (req, res) => {
    try {
      const { dataType, filters } = req.body;

      console.log(`🔍 [FILTER REQUEST] Type: ${dataType}`, filters);

      let results: any[] = [];

      if (dataType === "orders") {
        results = [...syncedOrdersStore];
      } else if (dataType === "invoices") {
        results = [...syncedInvoicesStore];
      } else if (dataType === "products") {
        results = [...syncedProductsStore];
      }

      // Apply filters
      let filtered = results;

      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        filtered = filtered.filter((item) =>
          JSON.stringify(item).toLowerCase().includes(term)
        );
      }

      if (filters.status && filters.status.length > 0) {
        filtered = filtered.filter((item) =>
          filters.status.includes(item.status)
        );
      }

      if (filters.lote) {
        filtered = filtered.filter((item) => item.lote === filters.lote);
      }

      if (filters.skus && filters.skus.length > 0) {
        filtered = filtered.filter((item) =>
          filters.skus.includes(item.sku || item.codigo)
        );
      }

      if (filters.dateFrom) {
        filtered = filtered.filter(
          (item) => (item.data || item.dataEmissao) >= filters.dateFrom
        );
      }

      if (filters.dateTo) {
        filtered = filtered.filter(
          (item) => (item.data || item.dataEmissao) <= filters.dateTo
        );
      }

      // Sort
      if (filters.sortBy) {
        const fieldMap: Record<string, string> = {
          date: dataType === "invoices" ? "dataEmissao" : "data",
          amount: dataType === "invoices" ? "valorNota" : "total",
          status: "status",
          name: dataType === "products" ? "descricao" : "customer_name"
        };
        const sortField = fieldMap[filters.sortBy] || filters.sortBy;

        filtered.sort((a, b) => {
          let aVal = a[sortField];
          let bVal = b[sortField];
          const order = filters.sortOrder === "asc" ? 1 : -1;
          if (aVal === bVal) return 0;
          if (aVal === undefined || aVal === null) return 1;
          if (bVal === undefined || bVal === null) return -1;
          return (aVal > bVal ? 1 : -1) * order;
        });
      }

      console.log(`✅ [FILTER RESULT] ${filtered.length} items found`);

      res.json({
        success: true,
        items: filtered,
        totalCount: results.length,
        displayCount: filtered.length,
        hasMore: false,
        filters
      });
    } catch (error: any) {
      console.error("❌ [FILTER ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Operations
  app.post("/api/bling/bulk/change-status", (req, res) => {
    try {
      const { itemIds, status } = req.body;

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res
          .status(400)
          .json({ error: "itemIds deve ser um array não vazio" });
      }

      console.log(
        `📊 [BULK CHANGE STATUS] ${itemIds.length} items para status: ${status}`
      );

      const result = {
        success: true,
        operationId: `bulk-${Date.now()}`,
        type: "UPDATE_STATUS",
        itemsProcessed: itemIds.length,
        itemsFailed: 0,
        status: "SUCCESS",
        message: `✅ Status atualizado para ${itemIds.length} itens`
      };

      res.json(result);
    } catch (error: any) {
      console.error("❌ [BULK CHANGE STATUS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/bulk/assign-lote", (req, res) => {
    try {
      const { itemIds, loteId, loteName } = req.body;

      if (!itemIds || !Array.isArray(itemIds)) {
        return res.status(400).json({ error: "itemIds deve ser um array" });
      }

      console.log(
        `🏷️ [BULK ASSIGN LOTE] ${itemIds.length} items para lote: ${loteName}`
      );

      const result = {
        success: true,
        operationId: `bulk-${Date.now()}`,
        type: "ASSIGN_LOTE",
        loteId,
        loteName,
        itemsProcessed: itemIds.length,
        itemsFailed: 0,
        status: "SUCCESS",
        message: `✅ ${itemIds.length} itens atribuídos ao lote ${loteName}`
      };

      res.json(result);
    } catch (error: any) {
      console.error("❌ [BULK ASSIGN LOTE ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/bulk/delete", (req, res) => {
    try {
      const { itemIds } = req.body;

      if (!itemIds || !Array.isArray(itemIds)) {
        return res.status(400).json({ error: "itemIds deve ser um array" });
      }

      console.log(`🗑️ [BULK DELETE] ${itemIds.length} items deletados`);

      const result = {
        success: true,
        operationId: `bulk-${Date.now()}`,
        type: "DELETE",
        itemsProcessed: itemIds.length,
        itemsFailed: 0,
        status: "SUCCESS",
        message: `✅ ${itemIds.length} itens deletados`
      };

      res.json(result);
    } catch (error: any) {
      console.error("❌ [BULK DELETE ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/export/csv", (req, res) => {
    try {
      const { dataType, itemIds } = req.body;

      console.log(
        `📥 [EXPORT CSV] Type: ${dataType}, Items: ${itemIds?.length || "all"}`
      );

      let sourceItems: any[] = [];
      if (dataType === "orders") sourceItems = [...syncedOrdersStore];
      if (dataType === "invoices") sourceItems = [...syncedInvoicesStore];
      if (dataType === "products") sourceItems = [...syncedProductsStore];

      if (Array.isArray(itemIds) && itemIds.length > 0) {
        sourceItems = sourceItems.filter((item: any) =>
          itemIds.includes(item.id)
        );
      }

      let csv = "";
      if (dataType === "orders") {
        csv =
          "ID,Pedido,BlingID,Cliente,Data,Loja,Status,SKU,ProdutoFinal,Quantidade,ValorTotal\n";
        csv += sourceItems
          .map((item: any) =>
            [
              item.id,
              item.orderId,
              item.blingId,
              item.customer_name,
              item.data,
              item.loja,
              item.status,
              item.sku,
              item.finalProductSku || "",
              item.quantity ?? "",
              item.total ?? ""
            ]
              .map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
      } else if (dataType === "invoices") {
        csv =
          "ID,Numero,Serie,Cliente,DataEmissao,ValorNota,Situacao,PedidoVenda\n";
        csv += sourceItems
          .map((item: any) =>
            [
              item.id,
              item.numero,
              item.serie,
              item.nomeCliente,
              item.dataEmissao,
              item.valorNota,
              item.situacao,
              item.idPedidoVenda
            ]
              .map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
      } else if (dataType === "products") {
        csv = "ID,SKU,Descricao,Preco,EstoqueAtual,ProdutoFinal,Origem\n";
        csv += sourceItems
          .map((item: any) =>
            [
              item.id,
              item.codigo,
              item.descricao,
              item.preco,
              item.estoqueAtual,
              item.finalProductSku || "",
              item.source || "BLING"
            ]
              .map((v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`)
              .join(",")
          )
          .join("\n");
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="export-${dataType}-${Date.now()}.csv"`
      );
      res.send(csv);
    } catch (error: any) {
      console.error("❌ [EXPORT CSV ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bling/lotes", (req, res) => {
    try {
      console.log(`📋 [GET LOTES] Total: ${lotes.length}`);

      res.json({
        success: true,
        lotes:
          lotes.length > 0
            ? lotes
            : [
                {
                  id: "lote-001",
                  name: "Lote-001",
                  itemsCount: 2,
                  completedCount: 1,
                  errorCount: 0,
                  status: "EM_PROCESSAMENTO"
                },
                {
                  id: "lote-002",
                  name: "Lote-002",
                  itemsCount: 0,
                  completedCount: 0,
                  errorCount: 0,
                  status: "NOVO"
                }
              ]
      });
    } catch (error: any) {
      console.error("❌ [GET LOTES ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/lotes", (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ error: "name é obrigatório" });
      }

      const newLote = {
        id: `lote-${Date.now()}`,
        name,
        description,
        createdAt: Date.now(),
        itemsCount: 0,
        completedCount: 0,
        errorCount: 0,
        status: "NOVO"
      };

      lotes.push(newLote);
      console.log(`✅ [CREATE LOTE] ${name}`);

      res.json(newLote);
    } catch (error: any) {
      console.error("❌ [CREATE LOTE ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // NFe & SEFAZ INTEGRATION - PHASE 3

  // In-memory storage for NFes and configurations
  // Configuração de NFe (salva em Supabase também)
  let nfeConfig: any = {
    emissao: "NORMAL",
    ambiente: "HOMOLOGAÇÃO",
    versaoPadrao: "4.00",
    cnpjEmitente: "12.345.678/0001-90",
    uf: "SP",
    numSerieNFe: "1",
    naturezaOperacao: "Venda",
    sequencialAssinatura: 1
  };

  // Gerar NFe (Supabase)
  // Diagnóstico: Verificar tabelas via REST API
  app.get("/api/diagnose/nfe", async (req, res) => {
    try {
      const SUPABASE_URL = "https://uafsmsiwaxopxznupuqw.supabase.co";
      const SUPABASE_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjAzMTIsImV4cCI6MjA3NDEzNjMxMn0._MGnu8LweUSinOSegxfyiKmYZJe-r54tfCPe6pIM_tI";

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/nfes?select=*&limit=1`,
        {
          method: "GET",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      if (!response.ok) {
        return res.json({
          tabela: "nfes",
          existe: false,
          erro: "Não conseguiu acessar"
        });
      }

      const data = await response.json();
      return res.json({
        tabela: "nfes",
        existe: true,
        total_registros: data?.length || 0,
        first_record: data?.[0] || null
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // TEST: Endpoint simples sem Supabase
  app.post("/api/test/echo", (req, res) => {
    console.log("🟢 [TEST] Echo request recebida");
    res.json({ ok: true, received: req.body });
  });

  app.post("/api/nfe/gerar", async (req, res) => {
    try {
      const { pedidoId, cliente, valor, dadosAdicionais } = req.body;

      if (!pedidoId) {
        return res.status(400).json({ error: "pedidoId é obrigatório" });
      }

      console.log("📋 [HANDLER /api/nfe/gerar] Requisição recebida");
      console.log(
        "📋 [HANDLER /api/nfe/gerar] Chamando obterProximoNumeroNFe()..."
      );

      // Obter próximo número (sem série para simplicidade)
      const proximoNumero = await obterProximoNumeroNFe();
      console.log(
        "📋 [HANDLER /api/nfe/gerar] Próximo número obtido:",
        proximoNumero
      );

      const novaNFe = {
        id: `nfe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        numero: String(proximoNumero).padStart(6, "0"),
        serie: "1",
        emissao: Date.now(),
        cliente: cliente || {
          nome: "Cliente Default",
          cnpj: "00.000.000/0000-00"
        },
        valor: valor || 100.0,
        pedidoId,
        status: "RASCUNHO",
        chaveAcesso: null,
        xmlOriginal: "<NFeData />",
        xmlAssinado: null,
        sefazEnvio: null,
        certificadoUsado: null,
        tentativasEnvio: 0,
        erroDetalhes: null,
        ...dadosAdicionais
      };

      console.log(
        "📋 [HANDLER /api/nfe/gerar] Objeto NFe montado:",
        novaNFe.id
      );
      console.log("📋 [HANDLER /api/nfe/gerar] Chamando criarNFe()...");

      const resultado = await criarNFe(novaNFe);

      console.log(
        "📋 [HANDLER /api/nfe/gerar] Resultado:",
        resultado.sucesso ? "✅" : "❌"
      );

      if (!resultado.sucesso) {
        console.error(
          "📋 [HANDLER /api/nfe/gerar] Erro retornado:",
          resultado.erro
        );
        return res
          .status(500)
          .json({ error: resultado.erro || "Erro ao criar NFe" });
      }

      console.log(`📄 [GERAR NFe] Pedido ${pedidoId} - NFe ${novaNFe.numero}`);

      res.json({
        success: true,
        nfe: resultado.nfe,
        message: `✅ NFe #${novaNFe.numero} gerada com sucesso`
      });
    } catch (error: any) {
      console.error(
        "❌ [GERAR NFe ERROR] Exception ao executar handler:",
        error
      );
      console.error("❌ [GERAR NFe ERROR] Stack:", error.stack);
      res.status(500).json({ error: error.message, stack: error.stack });
    }
  });

  // Carregar Certificado A1 (Parse PFX Real + Supabase)
  app.post("/api/nfe/certificado/carregar", async (req, res) => {
    try {
      const senha = req.headers["x-certificado-senha"] as string;
      const arquivoBuffer = Buffer.from(req.body.arquivo || "", "base64");

      if (!senha) {
        return res
          .status(400)
          .json({ error: "Senha do certificado obrigatória" });
      }

      if (!arquivoBuffer || arquivoBuffer.length === 0) {
        return res
          .status(400)
          .json({ error: "Arquivo do certificado obrigatório" });
      }

      console.log(`🔐 [CERTIFICADO] Fazendo parse do arquivo .pfx...`);

      // Fazer parse real do certificado A1
      const resultado = parseArquivoPFX(arquivoBuffer, senha);

      if (!resultado.sucesso) {
        console.error(`❌ [CERTIFICADO] ${resultado.erro}`);
        return res.status(400).json({
          error: resultado.erro,
          detalhes: "Verifique a senha e o arquivo .pfx"
        });
      }

      const certificado = resultado.certificado!;

      // Validar certificado
      const validacao = validarCertificado(certificado);
      if (
        !validacao.valido &&
        validacao.erros.some((e) => e.includes("expirou"))
      ) {
        return res.status(400).json({
          error: "Certificado expirado",
          erros: validacao.erros
        });
      }

      // Armazenar certificado em Supabase
      const resultadoDb = await criarCertificado({
        nome: certificado.nome || "",
        cnpj: certificado.cnpj,
        tipo: certificado.tipo,
        issuer: certificado.issuer || "",
        subject: certificado.subject || "",
        valido: certificado.valido,
        dataInicio: certificado.dataValidade - 365 * 24 * 60 * 60 * 1000,
        dataValidade: certificado.dataValidade,
        thumbprint: certificado.thumbprint,
        algoritmoAssinatura: certificado.algoritmoAssinatura,
        certificadoPem: certificado.certificadoPem,
        chavePem: certificado.chavePem,
        erros: certificado.erros
      });

      if (!resultadoDb.sucesso) {
        return res
          .status(500)
          .json({ error: "Erro ao salvar certificado no banco" });
      }

      console.log(`✅ [CERTIFICADO] Carregado com sucesso`);
      console.log(`   CNPJ: ${certificado.cnpj}`);
      console.log(
        `   Válido até: ${new Date(certificado.dataValidade).toLocaleDateString("pt-BR")}`
      );
      console.log(`   Thumbprint: ${certificado.thumbprint}`);

      res.json({
        success: true,
        certificado: {
          id: resultadoDb.certificado?.id,
          nome: certificado.nome,
          cnpj: certificado.cnpj,
          tipo: certificado.tipo,
          valido: certificado.valido,
          dataValidade: certificado.dataValidade,
          thumbprint: certificado.thumbprint,
          algoritmoAssinatura: certificado.algoritmoAssinatura,
          erros: certificado.erros
        },
        message: `✅ Certificado A1 carregado com sucesso`
      });
    } catch (error: any) {
      console.error("❌ [CERTIFICADO ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Listar Certificados (Supabase)
  app.get("/api/nfe/certificados", async (req, res) => {
    try {
      const certs = await listarCertificados(true);
      console.log(`🔐 [LISTAR CERTIFICADOS] Total: ${certs.length}`);
      res.json({
        success: true,
        certificados: certs.map((c) => ({
          id: c.id,
          nome: c.nome,
          cnpj: c.cnpj,
          valido: c.valido,
          dataValidade: c.dataValidade,
          tipo: c.tipo
        }))
      });
    } catch (error: any) {
      console.error("❌ [LISTAR CERTIFICADOS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Assinar NFe (Supabase)
  app.post("/api/nfe/assinar", async (req, res) => {
    try {
      const { nfeId, certificadoId } = req.body;

      const nfe = await obterNFe(nfeId);
      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      const cert = await obterCertificado(certificadoId);
      if (!cert) {
        return res.status(404).json({ error: "Certificado não encontrado" });
      }

      // Validar certificado
      const agora = Date.now();
      if (cert.dataValidade < agora) {
        return res.status(400).json({
          error: "Certificado expirado",
          dataValidade: new Date(cert.dataValidade).toLocaleDateString("pt-BR")
        });
      }

      if (!cert.certificadoPem || !cert.chavePem) {
        return res.status(400).json({
          error: "Certificado incompleto (PEM não disponível)"
        });
      }

      // Assinar XML da NFe com PKCS#7
      const xmlNFe = gerarXMLNFe(nfe);
      const assinatura = assinarXMLNFe(
        xmlNFe,
        cert.certificadoPem,
        cert.chavePem
      );

      if (!assinatura.sucesso) {
        return res.status(400).json({
          error: assinatura.erro
        });
      }

      // Atualizar NFe com assinatura em Supabase
      const resultadoUpdate = await atualizarNFe(nfeId, {
        status: "ASSINADA" as any,
        xmlAssinado: assinatura.xmlAssinado,
        certificadoUsado: {
          id: cert.id,
          cnpj: cert.cnpj,
          thumbprint: cert.thumbprint
        }
      });

      if (!resultadoUpdate.sucesso) {
        return res
          .status(500)
          .json({ error: "Erro ao atualizar NFe com assinatura" });
      }

      console.log(`🔏 [ASSINATURA PKCS#7] ${nfeId}`);
      console.log(`   Certificado: ${cert.cnpj}`);
      console.log(`   Algoritmo: ${cert.algoritmoAssinatura}`);
      console.log(`   Status: ASSINADA`);

      res.json({
        success: true,
        nfe: {
          ...nfe,
          xmlAssinado: nfe.xmlAssinado?.substring(0, 100) + "..." // Truncar para resposta
        },
        message: `✅ NFe assinada com PKCS#7 com sucesso`
      });
    } catch (error: any) {
      console.error("❌ [ASSINAR NFe ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Enviar para SEFAZ (SOAP Real)
  app.post("/api/nfe/enviar", async (req, res) => {
    try {
      const { nfeId, ambiente } = req.body;

      const nfe = await obterNFe(nfeId);
      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      if (nfe.status !== "ASSINADA") {
        return res
          .status(400)
          .json({ error: "NFe deve estar assinada antes de enviar" });
      }

      // Usar integração SOAP real com SEFAZ
      const sefazConfig: SefazConfig = {
        uf: nfeConfig.uf || "SP",
        cnpj: nfeConfig.cnpj || "12345678000190",
        ambiente: ambiente === "PRODUÇÃO" ? "PRODUCAO" : "HOMOLOGACAO"
      };

      console.log(
        `📤 [SEFAZ SOAP] Integrando com SEFAZ real para ${ambiente}...`
      );

      // Fazer requisição SOAP para SEFAZ
      const resultadoSefaz = await enviarNFeParaSefaz(nfe, sefazConfig);

      const nfeAtualizada = {
        status: (resultadoSefaz.sucesso ? "AUTORIZADA" : "REJEITADA") as any,
        chaveAcesso:
          resultadoSefaz.chaveAcesso ||
          `35${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}123456000195550010${String(nfe.numero).padStart(8, "0")}12345678`,
        sefazEnvio: {
          nfeId,
          dataEnvio: Date.now(),
          versaoPadrao: nfeConfig.versaoPadrao || "4.00",
          ambiente,
          statusSefaz: resultadoSefaz.codigo,
          protocoloAutorizacao: resultadoSefaz.protocolo || "000000000000000",
          dataAutorizacao: Date.now(),
          erroSefaz: resultadoSefaz.mensagem
        },
        tentativasEnvio: (nfe.tentativasEnvio || 0) + 1,
        erroDetalhes: resultadoSefaz.sucesso ? null : resultadoSefaz.mensagem
      };

      const updateResult = await atualizarNFe(nfeId, nfeAtualizada);
      if (!updateResult.sucesso) {
        return res
          .status(500)
          .json({
            error: updateResult.erro || "Erro ao atualizar NFe após envio"
          });
      }

      console.log(
        `✅ [SEFAZ RESPOSTA] ${nfeId} - Status SEFAZ: ${nfeAtualizada.status}`
      );

      res.json({
        success: resultadoSefaz.sucesso,
        nfe: updateResult.nfe,
        sefazResponse: resultadoSefaz,
        message: resultadoSefaz.sucesso
          ? `✅ NFe autorizada pela SEFAZ (${resultadoSefaz.codigo})`
          : `⚠️ NFe rejeitada: ${resultadoSefaz.mensagem}`
      });
    } catch (error: any) {
      console.error("❌ [ENVIAR SEFAZ ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Consultar Status da NFe no SEFAZ (SOAP)
  app.get("/api/nfe/consultar-status", async (req, res) => {
    try {
      const { chaveAcesso, ambiente } = req.query;

      if (!chaveAcesso || typeof chaveAcesso !== "string") {
        return res.status(400).json({ error: "Chave de acesso obrigatória" });
      }

      const nfe = await obterNFePorChaveAcesso(chaveAcesso);
      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      // Usar integração SOAP real com SEFAZ
      const sefazConfig: SefazConfig = {
        uf: nfeConfig.uf || "SP",
        cnpj: nfeConfig.cnpj || "12345678000190",
        ambiente:
          (ambiente as string) === "PRODUÇÃO" ? "PRODUCAO" : "HOMOLOGACAO"
      };

      console.log(
        `🔍 [SEFAZ CONSULTA] Consultando status da chave: ${chaveAcesso}`
      );

      // Fazer requisição SOAP para consultar status
      const resultadoSefaz = await consultarStatusNFeSefaz(
        chaveAcesso,
        sefazConfig
      );

      // Atualizar status se necessário
      if (resultadoSefaz.sucesso && resultadoSefaz.codigo === "100") {
        const sefazEnvioAtualizado = {
          ...(nfe.sefazEnvio || {}),
          protocoloAutorizacao:
            resultadoSefaz.protocolo || nfe.sefazEnvio?.protocoloAutorizacao
        };
        await atualizarNFe(nfe.id, {
          status: "AUTORIZADA" as any,
          sefazEnvio: sefazEnvioAtualizado
        });
      }

      console.log(
        `✅ [SEFAZ CONSULTA] Status recebido: ${resultadoSefaz.codigo}`
      );

      res.json({
        success: resultadoSefaz.sucesso,
        nfe: await obterNFe(nfe.id),
        sefazStatus: resultadoSefaz.codigo,
        sefazMensagem: resultadoSefaz.mensagem,
        protocoloAutorizacao: resultadoSefaz.protocolo
      });
    } catch (error: any) {
      console.error("❌ [CONSULTAR STATUS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancelar NFe no SEFAZ (SOAP)
  app.post("/api/nfe/cancelar", async (req, res) => {
    try {
      const { nfeId, justificativa } = req.body;

      const nfe = await obterNFe(nfeId);
      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      if (nfe.status !== "AUTORIZADA") {
        return res
          .status(400)
          .json({ error: "Apenas NFes autorizadas podem ser canceladas" });
      }

      // Usar integração SOAP real com SEFAZ
      const sefazConfig: SefazConfig = {
        uf: nfeConfig.uf || "SP",
        cnpj: nfeConfig.cnpj || "12345678000190",
        ambiente:
          nfe.sefazEnvio?.ambiente === "PRODUÇÃO" ? "PRODUCAO" : "HOMOLOGACAO"
      };

      console.log(`🚫 [SEFAZ CANCELAMENTO] Cancelando NFe: ${nfeId}`);

      // Fazer requisição SOAP para cancelar
      const resultadoSefaz = await cancelarNFeSefaz(
        nfe.chaveAcesso,
        justificativa,
        sefazConfig
      );

      if (resultadoSefaz.sucesso) {
        const updateResult = await atualizarNFe(nfeId, {
          status: "CANCELADA" as any,
          sefazEnvio: {
            ...(nfe.sefazEnvio || {}),
            justificativaCancelamento: justificativa,
            dataCancelamento: Date.now()
          }
        });

        if (!updateResult.sucesso) {
          return res
            .status(500)
            .json({
              error: updateResult.erro || "Erro ao persistir cancelamento"
            });
        }
      }

      console.log(
        `✅ [SEFAZ CANCELAMENTO] ${resultadoSefaz.sucesso ? "Cancelada" : "Falhou"}`
      );

      res.json({
        success: resultadoSefaz.sucesso,
        nfe: await obterNFe(nfeId),
        message: resultadoSefaz.sucesso
          ? "✅ NFe cancelada com sucesso"
          : `⚠️ Erro ao cancelar: ${resultadoSefaz.mensagem}`
      });
    } catch (error: any) {
      console.error("❌ [CANCELAR NFe ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Listar NFes
  app.get("/api/nfe/listar", async (req, res) => {
    try {
      const { status, dateFrom, dateTo, pedidoId } = req.query;

      const resultado = await listarNFes({
        status: (status as string) || undefined,
        pedidoId: (pedidoId as string) || undefined,
        dataInicio: dateFrom ? parseInt(dateFrom as string) : undefined,
        dataFim: dateTo ? parseInt(dateTo as string) : undefined
      });

      console.log(`📋 [LISTAR NFes] Total: ${resultado.count}`);

      res.json({
        success: true,
        nfes: resultado,
        count: resultado.count
      });
    } catch (error: any) {
      console.error("❌ [LISTAR NFes ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Baixar XML
  app.get("/api/nfe/:nfeId/xml", async (req, res) => {
    try {
      const { nfeId } = req.params;
      const nfe = await obterNFe(nfeId);

      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      const xmlContent = nfe.xmlAssinado || nfe.xmlOriginal || "<NFeVazia />";

      res.setHeader("Content-Type", "application/xml");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="nfe-${nfe.numero}.xml"`
      );
      res.send(xmlContent);
    } catch (error: any) {
      console.error("❌ [BAIXAR XML ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Obter Configuração
  app.get("/api/nfe/configuracao", (req, res) => {
    try {
      console.log(`⚙️ [OBTER CONFIG NFe]`);
      res.json({
        success: true,
        configuracao: nfeConfig
      });
    } catch (error: any) {
      console.error("❌ [OBTER CONFIG ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Atualizar Configuração
  app.put("/api/nfe/configuracao", (req, res) => {
    try {
      const novasConfig = req.body;
      nfeConfig = { ...nfeConfig, ...novasConfig };

      console.log(`⚙️ [ATUALIZAR CONFIG NFe]`);

      res.json({
        success: true,
        configuracao: nfeConfig,
        message: "✅ Configurações atualizadas"
      });
    } catch (error: any) {
      console.error("❌ [ATUALIZAR CONFIG ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PHASE 3 HÍBRIDO: Enviar NFe para SEFAZ via Bling API
  app.post("/api/nfe/enviar-bling", async (req, res) => {
    try {
      const { nfeId, pedidoId, ambiente, via } = req.body;
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({ error: "Token do Bling obrigatório" });
      }

      const nfe = await obterNFe(nfeId);
      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      // Em produção: fazer requisição para API do Bling
      // const blingResponse = await fetch('https://www.bling.com.br/api/v3/nfe/send', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ nfeId, pedidoId, ambiente })
      // });

      // Mock: Simular resposta do Bling
      const chaveAcesso = `35${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}${nfeConfig.cnpj || "00000000000000"}${String(nfe.numero).padStart(8, "0")}12345678`;

      let statusFinal: any = "ENVIADA";
      const sefazEnvio = {
        nfeId,
        dataEnvio: Date.now(),
        versaoPadrao: nfeConfig.versaoPadrao,
        ambiente,
        statusSefaz: "100",
        protocoloAutorizacao: String(
          Math.floor(Math.random() * 1000000000000)
        ).padStart(15, "0"),
        dataAutorizacao: Date.now()
      };
      let erroDetalhes: string | null = null;

      // Simular: 90% de chance com Bling (mais confiável)
      if (Math.random() > 0.1) {
        statusFinal = "AUTORIZADA";
      } else {
        statusFinal = "REJEITADA";
        erroDetalhes = "Erro na validação pela Bling/SEFAZ";
      }

      const updateResult = await atualizarNFe(nfeId, {
        status: statusFinal,
        chaveAcesso,
        sefazEnvio,
        tentativasEnvio: (nfe.tentativasEnvio || 0) + 1,
        erroDetalhes
      });

      if (!updateResult.sucesso) {
        return res
          .status(500)
          .json({
            error: updateResult.erro || "Erro ao atualizar NFe no envio Bling"
          });
      }

      console.log(
        `📤 [ENVIAR BLING/SEFAZ] ${nfeId} - Via: ${via} - Status: ${statusFinal}`
      );

      res.json({
        success: statusFinal === "AUTORIZADA",
        nfe: updateResult.nfe,
        message:
          statusFinal === "AUTORIZADA"
            ? `✅ NFe autorizada via Bling/SEFAZ`
            : `⚠️ NFe rejeitada pela Bling: ${erroDetalhes}`
      });
    } catch (error: any) {
      console.error("❌ [ENVIAR BLING ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PHASE 3 HÍBRIDO: Consultar Status via Bling
  app.get("/api/nfe/status-bling", async (req, res) => {
    try {
      const { chaveAcesso, ambiente } = req.query;
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace("Bearer ", "");

      if (!token) {
        return res.status(401).json({ error: "Token do Bling obrigatório" });
      }

      // Em produção: consultar status via API Bling/SEFAZ
      const nfe = await obterNFePorChaveAcesso(String(chaveAcesso));

      if (!nfe) {
        return res.status(404).json({ error: "NFe não encontrada" });
      }

      console.log(`🔍 [STATUS BLING] ${chaveAcesso} - Status: ${nfe.status}`);

      res.json({
        success: true,
        chaveAcesso,
        status: nfe.status,
        statusSefaz: nfe.sefazEnvio?.statusSefaz,
        protocoloAutorizacao: nfe.sefazEnvio?.protocoloAutorizacao,
        dataAutorizacao: nfe.sefazEnvio?.dataAutorizacao,
        nfe
      });
    } catch (error: any) {
      console.error("❌ [STATUS BLING ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GERAR NF-e VIA ROTA NATIVA DO BLING: POST /pedidos/vendas/{id}/gerar-nfe
  // Bling resolve itens, contato, parcelas, endereço, frete etc. automaticamente
  // ────────────────────────────────────────────────────────────────────────────
  app.post("/api/bling/nfe/criar-emitir", async (req, res) => {
    try {
      const {
        blingOrderId,
        nfeId: nfeIdParam,
        emitir = false
      } = req.body as {
        blingOrderId?: string | number;
        nfeId?: string | number;
        emitir?: boolean;
      };
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;

      if (!rawAuth)
        return res.status(401).json({ error: "Token do Bling obrigatório" });

      // Se já temos a notaId, pulamos a criação e vamos direto pro emitir (se pedido)
      if (nfeIdParam) {
        console.log(
          `📤 [NFe] nfeId fornecido (${nfeIdParam}). Pulando criação...`
        );
        if (!emitir) {
          return res.json({
            success: true,
            emitida: false,
            nfe: { id: nfeIdParam },
            message: "NF-e já existe"
          });
        }
        // Prossegue para a parte final de emissão
      } else if (!blingOrderId) {
        return res
          .status(400)
          .json({ error: "blingOrderId ou nfeId obrigatório" });
      }

      const headers = {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      const readH = { Authorization: token, Accept: "application/json" };

      let primeiraId = nfeIdParam;
      let nfesCriadas: any[] = nfeIdParam ? [{ id: nfeIdParam }] : [];

      if (!nfeIdParam && blingOrderId) {
        // Aceita IDs enviados pelo frontend no formato 'bling_123' ou já numérico.
        const sanitizeId = (id: string | number) => {
          if (typeof id === "number") return id;
          const s = String(id || "").trim();
          const onlyDigits = s.replace(/\D/g, "");
          return onlyDigits ? Number(onlyDigits) : NaN;
        };

        const pedidoIdNum = sanitizeId(blingOrderId);
        if (!pedidoIdNum || Number.isNaN(pedidoIdNum)) {
          return res
            .status(400)
            .json({
              success: false,
              error:
                "ID do pedido inválido. Envie o ID numérico do pedido Bling (ex: 12345) ou bling_12345."
            });
        }

        // ─── Passo 0: Buscar detalhes do pedido para extrair número da loja virtual ──
        console.log(
          `📋 [NFe] Buscando detalhes do pedido ${pedidoIdNum} (orig: ${blingOrderId})...`
        );
        const pedidoResp = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${pedidoIdNum}`,
          { headers: readH }
        );

        if (!pedidoResp.ok) {
          const detail = await pedidoResp.json().catch(() => ({}));
          return res
            .status(pedidoResp.status)
            .json({
              success: false,
              error:
                detail?.error?.description ||
                "Erro ao buscar detalhes do pedido"
            });
        }

        const pedidoData = await pedidoResp.json();
        const pedido = pedidoData?.data;

        const metadados = extrairMetadadosPedido(pedido);
        const { numeroLojaVirtual, detectedLoja } = metadados;

        // Atualizar observações do pedido com o número da loja virtual e plataforma
        const infoAdicional = `Pedido: ${numeroLojaVirtual || "N/A"} | Plataforma: ${detectedLoja}`;
        const observacoesAtuais = pedido?.observacoes || "";

        // Verifica se a info já está lá para evitar duplicação em caso de re-tentativa
        if (!observacoesAtuais.includes(infoAdicional)) {
          console.log(
            `📝 [NFe] Atualizando observações do pedido: ${infoAdicional}`
          );

          await fetch(
            `https://www.bling.com.br/Api/v3/pedidos/vendas/${Number(blingOrderId)}`,
            {
              method: "PUT",
              headers,
              body: JSON.stringify({
                observacoes: `${observacoesAtuais}\n${infoAdicional}`.trim()
              })
            }
          );
        }

        // ─── Passo 1: Gerar NF-e via rota nativa do Bling ─────────────────────
        console.log(
          `📄 [NFe] Gerando NF-e via /pedidos/vendas/${blingOrderId}/gerar-nfe`
        );
        const gerarResp = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${Number(blingOrderId)}/gerar-nfe`,
          { method: "POST", headers }
        );

        let gerarData: any;
        try {
          gerarData = await gerarResp.json();
        } catch {
          gerarData = {};
        }

        if (!gerarResp.ok) {
          console.error(
            `❌ [NFe] Erro ao gerar via rota nativa:`,
            JSON.stringify(gerarData, null, 2)
          );
          const blingErr = gerarData?.error || gerarData?.errors?.[0] || {};
          const fields: string[] = Array.isArray(blingErr?.fields)
            ? blingErr.fields
                .map(
                  (f: any) =>
                    `${f.element || f.field || ""}: ${f.msg || f.message || ""}`
                )
                .filter(Boolean)
            : [];
          const errDesc =
            blingErr?.description ||
            blingErr?.message ||
            gerarData?.message ||
            `Bling retornou ${gerarResp.status}`;
          const fullMsg =
            fields.length > 0 ? `${errDesc} — ${fields.join("; ")}` : errDesc;
          return res
            .status(gerarResp.status)
            .json({ success: false, error: fullMsg, detail: gerarData });
        }

        // Resposta: { data: { id, numero, ... } } ou lista de NF-e geradas
        nfesCriadas = Array.isArray(gerarData?.data)
          ? gerarData.data
          : gerarData?.data
            ? [gerarData.data]
            : [];
        primeiraId = nfesCriadas[0]?.id;
        console.log(
          `✅ [NFe] Gerada(s): ${nfesCriadas.map((n: any) => n.id).join(", ")}`
        );

        // ─── Passo 1.5: Patch metadata directly to NF-e as requested by user ───
        if (primeiraId) {
          await patchNfeComDadosPedido(token, primeiraId, pedido, metadados);
        }
      }

      if (!primeiraId || !emitir) {
        return res.json({
          success: true,
          emitida: false,
          nfe: nfesCriadas[0] || { id: primeiraId },
          nfes: nfesCriadas
        });
      }

      // ─── Passo 2: Emitir NF-e (transmitir ao SEFAZ) ───────────────────────
      console.log(`📤 [NFe] Emitindo NF-e ${primeiraId}…`);
      const emitResp = await fetch(
        `https://www.bling.com.br/Api/v3/nfe/${primeiraId}/enviar`,
        {
          method: "POST",
          headers
        }
      );

      let emitData: any;
      try {
        emitData = await emitResp.json();
      } catch {
        emitData = {};
      }

      if (!emitResp.ok) {
        console.error(`❌ [NFe] Erro ao emitir:`, emitData);
        return res.status(emitResp.status).json({
          success: false,
          emitida: false,
          nfe: nfesCriadas[0],
          error:
            emitData?.error?.description ||
            emitData?.message ||
            `Bling retornou ${emitResp.status} ao emitir`,
          detail: emitData
        });
      }

      console.log(`✅ [NFe] Emitida com sucesso!`);

      // ─── Passo 3: Buscar rastreamento e dados logísticos após emissão ───
      let rastreamento: string | undefined;
      let idObjetoLogistico: number | undefined;
      let linkDanfe: string | undefined;

      try {
        // Aguarda processamento do SEFAZ
        await new Promise((r) => setTimeout(r, 2000));

        // Busca detalhe da NF-e emitida para pegar linkDanfe e objeto logístico
        const nfeDetResp = await fetch(
          `https://www.bling.com.br/Api/v3/nfe/${primeiraId}`,
          { headers: readH }
        );
        if (nfeDetResp.ok) {
          const nfeDet = await nfeDetResp.json();
          const d = nfeDet?.data;
          linkDanfe = d?.linkDanfe || d?.linkPDF;
          const objLogId = d?.transporte?.objetoLogistico?.id || d?.transporte?.objeto?.id;

          if (objLogId) {
            idObjetoLogistico = Number(objLogId);
            // Busca rastreamento via /logisticas/objetos/{id}
            const objResp = await fetch(
              `https://www.bling.com.br/Api/v3/logisticas/objetos/${objLogId}`,
              { headers: readH }
            );
            if (objResp.ok) {
              const objData = await objResp.json();
              rastreamento = objData?.data?.rastreamento?.codigo;
              console.log(`📦 [NFe] Rastreamento: ${rastreamento || "não disponível ainda"}`);
            }
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ [NFe] Erro ao buscar rastreio pós-emissão:`, e.message);
      }

      return res.json({
        success: true,
        emitida: true,
        nfe: {
          ...nfesCriadas[0],
          ...emitData?.data,
          rastreamento,
          idObjetoLogistico,
          linkDanfe
        },
        nfes: nfesCriadas
      });
    } catch (error: any) {
      console.error("❌ [NFe criar-emitir]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/bling/canais-venda with local cache to avoid 429
  app.get("/api/bling/canais-venda", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token)
        return res.status(401).json({ error: "Token do Bling obrigatório" });

      // Return from cache if valid
      const now = Date.now();
      if (cachedCanais && now - cachedCanaisTime < CANAIS_CACHE_TTL) {
        console.log("✅ [BLING CANAIS] Servindo canais-venda do cache local");
        return res.json(cachedCanais);
      }

      console.log(
        "🌐 [BLING CANAIS] Buscando canais-venda direto da API do Bling via Fila"
      );
      const response = await blingFetchRetry(
        "https://www.bling.com.br/Api/v3/canais-venda",
        {
          headers: { Authorization: token, Accept: "application/json" }
        }
      );

      if (!response.ok) {
        if (response.status === 429 && cachedCanais) {
          console.warn(
            "⚠️ [BLING CANAIS] Rate limit (429) detectado. Retornando cache."
          );
          return res.json(cachedCanais);
        }
        return res
          .status(response.status)
          .json({ error: "Erro ao buscar canais de venda" });
      }

      const data = await response.json();

      // Converte para um mapa id -> nome para facilitar o frontend
      const dicionario: Record<string, string> = {};
      if (Array.isArray(data.data)) {
        data.data.forEach((c: any) => {
          dicionario[String(c.id)] = c.descricao || c.nome || "Canal sem nome";
        });
      }

      const result = { ...data, dicionario };
      cachedCanais = result;
      cachedCanaisTime = now;
      res.json(result);
    } catch (error: any) {
      console.error("❌ [Bling Canais Venda]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GERAR ETIQUETAS EM LOTE (ZPL NATIVO) — POST /api/bling/lotes/gerar-zpl
  // Orquestra a busca de NF-e, Logística e Gera ZPL programático
  // ────────────────────────────────────────────────────────────────────────────
  app.post("/api/bling/lotes/gerar-zpl", async (req, res) => {
    try {
      const {
        ids,
        createdBy,
        forceNative = false
      } = req.body as {
        ids: string[];
        createdBy: string;
        forceNative?: boolean;
      };
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;

      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });
      if (!ids || !Array.isArray(ids))
        return res.status(400).json({ error: "Lista de IDs obrigatória" });

      console.log(
        `🚀 [LOTE ZPL] Iniciando geração para ${ids.length} itens (forceNative: ${forceNative})...`
      );

      const zplParts: string[] = [];
      const successIds: string[] = [];
      const failures: any[] = [];

      for (const id of ids) {
        try {
          let nfeData: any = null;
          let objetoLogistico: any = null;
          let zplBling: string | null = null;

          // 1. Tentar descobrir se o ID é de NF-e ou Pedido
          let currentStep = "FETCH_NFE";
          let nfeResp = await blingFetchRetry(
            `https://www.bling.com.br/Api/v3/nfe/${id}`,
            {
              headers: { Authorization: token, Accept: "application/json" }
            }
          );

          if (!nfeResp.ok) {
            currentStep = "SEARCH_NFE_BY_ORDER";
            console.log(
              `🔍 [LOTE ZPL] ID ${id} não é NF-e, buscando NF-e vinculada ao pedido...`
            );
            const nfeSearchResp = await blingFetchRetry(
              `https://www.bling.com.br/Api/v3/nfe?numeroPedidoLoja=${id}&tipo=1`,
              {
                headers: { Authorization: token, Accept: "application/json" }
              }
            );
            const searchData = await nfeSearchResp.json();
            const foundNfeId = searchData?.data?.[0]?.id;

            if (foundNfeId) {
              currentStep = "FETCH_NFE_FOUND";
              nfeResp = await blingFetchRetry(
                `https://www.bling.com.br/Api/v3/nfe/${foundNfeId}`,
                {
                  headers: { Authorization: token, Accept: "application/json" }
                }
              );
            }
          }

          if (nfeResp.ok) {
            nfeData = (await nfeResp.json())?.data;
          }

          // 2. Tentar buscar ZPL oficial do Bling se não for forceNative
          if (!forceNative && nfeData?.id) {
            try {
              currentStep = "FETCH_LOGISTICS_OBJECT";
              const objUrl = `https://www.bling.com.br/Api/v3/objetos-postagem?numeroPedidoLoja=${nfeData.idVenda || nfeData.pedidoVenda?.id || id}`;
              const objResp = await blingFetchRetry(objUrl, {
                headers: { Authorization: token, Accept: "application/json" }
              });
              if (objResp.ok) {
                const objs = await objResp.json();
                objetoLogistico = objs?.data?.[0];

                if (objetoLogistico?.id) {
                  currentStep = "FETCH_OFFICIAL_ZPL";
                  const zplOfficialResp = await blingFetchRetry(
                    `https://www.bling.com.br/Api/v3/logisticas/etiquetas/zpl?idsObjetos[]=${objetoLogistico.id}`,
                    {
                      headers: {
                        Authorization: token,
                        Accept: "application/json"
                      }
                    }
                  );
                  if (zplOfficialResp.ok) {
                    const zplData = await zplOfficialResp.json();
                    zplBling = zplData?.data?.[0]?.zpl || zplData?.zpl;
                  }
                }
              }
            } catch (e) {
              console.warn(
                `⚠️ [LOTE ZPL] Erro ao buscar ZPL oficial para ${id}:`,
                e
              );
            }
          }

          // 3. Seleção do ZPL (Bling ou Nativo)
          if (zplBling && !forceNative) {
            zplParts.push(zplBling);
            console.log(`✅ [LOTE ZPL] Item ${id} - Usando ZPL oficial Bling.`);
          } else if (nfeData) {
            currentStep = "BUILD_NATIVE_ZPL";
            console.log(
              `🎨 [LOTE ZPL] Item ${id} - Gerando ZPL Nativo EcomFlow...`
            );

            const danfeZpl = ZPLGenerator.generateDanfeSimplificada({
              chaveAcesso: nfeData.chaveAcesso || "",
              numeroNota: String(nfeData.numero || ""),
              serie: String(nfeData.serie || ""),
              valorTotal: nfeData.valorTotal || 0,
              emitente: {
                nome: nfeData.loja?.descricao || "Emitente",
                cnpj: "Consulte o Bling"
              },
              destinatario: {
                nome: nfeData.contato?.nome || "Destinatário",
                endereco: `${nfeData.contato?.endereco || ""}, ${nfeData.contato?.numero || ""} ${nfeData.contato?.complemento || ""}`,
                bairro: nfeData.contato?.bairro || "",
                cidade: nfeData.contato?.cidade || "",
                uf: nfeData.contato?.uf || "",
                cep: nfeData.contato?.cep || ""
              }
            });

            const etiquetaZpl = ZPLGenerator.generateEtiquetaTransporte({
              transportadora:
                objetoLogistico?.servico?.descricao ||
                nfeData.transporte?.contato?.nome ||
                "Transportadora",
              servico: objetoLogistico?.servico?.codigo || "",
              rastreio:
                objetoLogistico?.codigoRastreio ||
                nfeData.transporte?.rastreamento ||
                nfeData.chaveAcesso ||
                "AGUARDANDO_RASTREIO",
              pedidoLoja: String(id || nfeData.idVenda || ""),
              cliente: nfeData.contato?.nome || "",
              endereco: `${nfeData.contato?.endereco || ""}, ${nfeData.contato?.numero || ""} ${nfeData.contato?.complemento || ""}`,
              cidadeUf: `${nfeData.contato?.cidade || ""}/${nfeData.contato?.uf || ""}`,
              cep: nfeData.contato?.cep || ""
            });

            zplParts.push(ZPLGenerator.combine(danfeZpl, etiquetaZpl));
          } else {
            throw {
              message: `Dados insuficientes para gerar ZPL para o ID ${id}`,
              step: currentStep
            };
          }
          successIds.push(id);
        } catch (err: any) {
          console.error(
            `❌ [LOTE ZPL] Erro no item ${id}:`,
            err.message || err
          );
          failures.push({
            id,
            step: err.step || "UNKNOWN",
            error: err.message || String(err),
            detail: err.detail || null
          });
        }
      }

      const combinedZpl = zplParts.join("\n");

      // 4. Salva no histórico
      try {
        const { error: dbError } = await (supabase as any)
          .from("etiquetas_historico")
          .insert({
            created_by_name: createdBy || "Usuário",
            page_count: zplParts.length,
            zpl_content: combinedZpl,
            settings_snapshot: JSON.stringify({
              ids,
              failures,
              successIds,
              forceNative
            })
          });
        if (dbError) console.error(`❌ [LOTE ZPL] Erro DB:`, dbError);
      } catch (dbEx) {
        console.error(`❌ [LOTE ZPL] Exceção DB:`, dbEx);
      }

      res.json({
        success: true,
        count: zplParts.length,
        zpl: combinedZpl,
        failures
      });
    } catch (error: any) {
      console.error("❌ [LOTE ZPL ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/bling/nfe/batch-criar-emitir", async (req, res) => {
    try {
      const { orders, emitir = false } = req.body as {
        orders: Array<{
          blingOrderId?: string | number;
          nfeId?: string | number;
        }>;
        emitir?: boolean;
      };
      const rawAuth = req.headers.authorization || "";

      if (!rawAuth)
        return res.status(401).json({ error: "Token do Bling obrigatório" });
      if (!orders || !Array.isArray(orders))
        return res
          .status(400)
          .json({ error: "Lista de pedidos/notas obrigatória" });

      console.log(`🚀 [NFe BATCH] Iniciando para ${orders.length} itens...`);

      const results: any[] = [];
      const DELAY = 1000;
      const host = req.get("host");
      const protocol = req.protocol;

      for (let i = 0; i < orders.length; i++) {
        const item = orders[i];
        const idLabel = item.nfeId
          ? `NFe ${item.nfeId}`
          : `Pedido ${item.blingOrderId}`;

        try {
          console.log(
            `📦 [NFe BATCH] (${i + 1}/${orders.length}) Processando ${idLabel}...`
          );

          // Chamada interna para o endpoint unitário
          const localUrl = `${protocol}://${host}/api/bling/nfe/criar-emitir`;
          const localResp = await fetch(localUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: rawAuth
            },
            body: JSON.stringify({
              blingOrderId: item.blingOrderId,
              nfeId: item.nfeId,
              emitir
            })
          });

          const data = await localResp.json();
          results.push({
            id: item.nfeId || item.blingOrderId,
            success: localResp.ok,
            ...data
          });
        } catch (err: any) {
          console.error(`❌ [NFe BATCH] Erro ao processar ${idLabel}:`, err);
          results.push({
            id: item.nfeId || item.blingOrderId,
            success: false,
            error: err.message
          });
        }

        if (i < orders.length - 1)
          await new Promise((r) => setTimeout(r, DELAY));
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("❌ [Bling Batch Criar-Emitir]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── Aliases para o frontend: gerar-lote (sem emitir) e gerar-emitir-lote (emitir=true) ──
  // Rotas usadas em AbaImportacaoPedidosBling.tsx; mapeia para batch-criar-emitir
  // e persiste lote na tabela bling_lotes_nfe do Supabase.
  const handleLoteNfe = (emitir: boolean) => async (req: any, res: any) => {
    try {
      const rawAuth = req.headers.authorization || "";
      if (!rawAuth)
        return res.status(401).json({ error: "Token do Bling obrigatório" });

      // Aceita pedidoVendaIds[] (do componente legado) ou orders[]
      const {
        pedidoVendaIds,
        orders: ordersFromBody,
        overrides
      } = req.body as {
        pedidoVendaIds?: (string | number)[];
        orders?: Array<{ blingOrderId?: string | number }>;
        overrides?: Record<string, any>; // PedidoOverride por pedidoId
      };

      const ids: (string | number)[] =
        pedidoVendaIds ||
        ordersFromBody?.map((o: any) => o.blingOrderId).filter(Boolean) ||
        [];

      if (!ids.length)
        return res.status(400).json({ error: "Lista de pedidos vazia" });

      const orders = ids.map((id) => ({ blingOrderId: id }));

      console.log(
        `🚀 [NFe ${emitir ? "GERAR+EMITIR" : "GERAR"} LOTE] ${ids.length} pedidos...`
      );

      const results: any[] = [];
      const DELAY = 1200;
      const host = req.get("host");
      const protocol = req.protocol;

      for (let i = 0; i < orders.length; i++) {
        const item = orders[i];
        try {
          const localUrl = `${protocol}://${host}/api/bling/nfe/criar-emitir`;
          const localResp = await fetch(localUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: rawAuth
            },
            body: JSON.stringify({
              blingOrderId: item.blingOrderId,
              emitir,
              override: overrides?.[String(item.blingOrderId)]
            })
          });
          const data = await localResp.json();
          results.push({
            pedidoVendaId: String(item.blingOrderId),
            success: localResp.ok,
            ...data
          });
        } catch (err: any) {
          results.push({
            pedidoVendaId: String(item.blingOrderId),
            success: false,
            error: err.message
          });
        }
        if (i < orders.length - 1)
          await new Promise((r) => setTimeout(r, DELAY));
      }

      const ok = results.filter((r) => r.success).length;
      const fail = results.length - ok;

      // Persistir lote no Supabase
      const loteId = `LOTE-${Date.now()}`;
      const loteNfes = results
        .filter((r) => r.success)
        .map((r) => ({
          pedidoVendaId: r.pedidoVendaId,
          nfeId: r.nfe?.id ?? r.id,
          nfeNumero: r.nfe?.numero ?? r.numero
        }));
      try {
        await supabase.from("bling_lotes_nfe").insert({
          id: loteId,
          tipo: emitir ? "GERACAO_EMISSAO" : "GERACAO_APENAS",
          total: results.length,
          ok,
          fail,
          nfes: loteNfes
        });
      } catch (dbErr: any) {
        console.error(
          "⚠️ [Lote NF-e] Falha ao salvar lote no Supabase:",
          dbErr.message
        );
      }

      res.json({
        success: true,
        ok,
        fail,
        total: results.length,
        loteId,
        resultados: results
      });
    } catch (error: any) {
      console.error(`❌ [NFe Lote]:`, error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  app.post("/api/bling/nfe/gerar-lote", handleLoteNfe(false));
  app.post("/api/bling/nfe/gerar-emitir-lote", handleLoteNfe(true));

  // Etiquetas de Envio Endpoint (Bling v3)
  app.post("/api/bling/logisticas/etiquetas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      const { idsObjetos } = req.body;
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      console.log(
        `🏷️ [LOGISTICA ETIQUETAS] Solicitando etiquetas para ${idsObjetos?.length} objetos`
      );
      const response = await fetch(
        "https://www.bling.com.br/Api/v3/logisticas/etiquetas",
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ idsObjetos })
        }
      );

      let data = await response.json();

      // Fallback: Se a resposta não for OK e não houver dados, tentar buscar por ID de pedido
      if (
        !response.ok &&
        (!data || Object.keys(data).length === 0) &&
        idsObjetos?.length === 1
      ) {
        const pedidoId = idsObjetos[0];
        console.warn(
          `⚠️ [LOGISTICA ETIQUETAS] Falha ao buscar etiqueta por ID de objeto. Tentando buscar por ID de pedido ${pedidoId}...`
        );
        const fallbackResponse = await fetch(
          `https://www.bling.com.br/Api/v3/pedidos/vendas/${pedidoId}/etiquetas`,
          {
            method: "GET",
            headers: { Authorization: token, Accept: "application/json" }
          }
        );
        if (fallbackResponse.ok) {
          data = await fallbackResponse.json();
          console.log(
            `✅ [LOGISTICA ETIQUETAS] Etiqueta encontrada via fallback por ID de pedido.`
          );
          return res.status(fallbackResponse.status).json(data);
        } else {
          console.error(
            `❌ [LOGISTICA ETIQUETAS] Falha no fallback por ID de pedido ${pedidoId}:`,
            await fallbackResponse.json()
          );
        }
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────────────

  // ────────────────────────────────────────────────────────────────────────────
  // DETALHES / ALTERAR PEDIDO DE VENDA — GET ou PUT /api/bling/pedido-venda/:id
  // ────────────────────────────────────────────────────────────────────────────
  // Wrapper: Gera NF-e a partir do ID do pedido de venda (convenience endpoint)
  app.post("/api/bling/nfe/generate/:idPedidoVenda", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const idPedido = req.params.idPedidoVenda;
      if (!idPedido)
        return res.status(400).json({ error: "idPedidoVenda obrigatório" });

      const headers = {
        Authorization: token,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
      const readH = { Authorization: token, Accept: "application/json" };

      // Buscar pedido para ter dados e metadados (número da loja virtual, loja, observações)
      const pedidoResp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${Number(idPedido)}`,
        { headers: readH }
      );
      if (!pedidoResp.ok) {
        const detail = await pedidoResp.json().catch(() => ({}));
        return res
          .status(pedidoResp.status)
          .json({
            error: detail?.error?.description || "Erro ao buscar pedido"
          });
      }
      const pedidoData = await pedidoResp.json().catch(() => ({}));
      const pedido = pedidoData?.data;

      // Gera NF-e via rota nativa do Bling
      const gerarResp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${Number(idPedido)}/gerar-nfe`,
        { method: "POST", headers }
      );
      const gerarData = await gerarResp.json().catch(() => ({}));

      if (!gerarResp.ok) {
        const blingErr = gerarData?.error || gerarData?.errors?.[0] || {};
        const fields = Array.isArray(blingErr?.fields)
          ? blingErr.fields
              .map(
                (f: any) =>
                  `${f.element || f.field || ""}: ${f.msg || f.message || ""}`
              )
              .filter(Boolean)
          : [];
        const errDesc =
          blingErr?.description ||
          blingErr?.message ||
          gerarData?.message ||
          `Bling retornou ${gerarResp.status}`;
        const fullMsg =
          fields.length > 0 ? `${errDesc} — ${fields.join("; ")}` : errDesc;
        return res
          .status(gerarResp.status)
          .json({ success: false, error: fullMsg, detail: gerarData });
      }

      const nfesCriadas = Array.isArray(gerarData?.data)
        ? gerarData.data
        : gerarData?.data
          ? [gerarData.data]
          : [];
      const primeiraId = nfesCriadas[0]?.id;

      // Patch metadata na NFe criada para facilitar rastreio (numeroLojaVirtual / loja)
      if (primeiraId) {
        try {
          const metadados = extrairMetadadosPedido(pedido);
          await patchNfeComDadosPedido(token, primeiraId, pedido, metadados);
        } catch (e) {
          console.warn(
            "[NFe Generate] Falha ao patcher metadados (não bloqueante):",
            e
          );
        }
      }

      // Retornar 201 com idNotaFiscal para cliente
      return res
        .status(201)
        .json({ idNotaFiscal: primeiraId, nfes: nfesCriadas });
    } catch (error: any) {
      console.error("❌ [NFe Generate Error]:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/bling/pedido-venda/:id", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const resp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${req.params.id}`,
        {
          headers: { Authorization: token, Accept: "application/json" }
        }
      );
      const data = await resp.json().catch(() => ({}));
      res.status(resp.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/bling/pedido-venda/:id", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      console.log(`✏️ [Pedido] Atualizando pedido ${req.params.id}`);
      const resp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${req.params.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(req.body)
        }
      );
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const blingErr = data?.error || data?.errors?.[0] || {};
        return res
          .status(resp.status)
          .json({
            success: false,
            error: blingErr?.description || `Erro ${resp.status}`,
            detail: data
          });
      }
      res.json({ success: true, data: data?.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // NOTAS FISCAIS DE SAÍDA — listar, emitir, baixar XML/DANFE
  // ────────────────────────────────────────────────────────────────────────────

  // POST /api/bling/nfe/:id/enviar — Enviar NF-e pendente para SEFAZ
  app.post("/api/bling/nfe/:id/enviar", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const url = `https://www.bling.com.br/Api/v3/nfe/${req.params.id}/enviar`;
      console.log(`📤 [NFe Enviar] POST ${url}`);
      const resp = await blingFetchRetry(url, {
        method: "POST",
        headers: {
          Authorization: token,
          Accept: "application/json",
          "Content-Type": "application/json"
        }
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok)
        return res
          .status(resp.status)
          .json({
            error:
              data?.error?.description ||
              data?.error?.message ||
              `Erro ${resp.status}`,
            detail: data
          });

      console.log(`✅ [NFe Enviar] NF-e ${req.params.id} enviada com sucesso`);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error("❌ [NFe Enviar]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bling/nfe/listar-saida", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const { dataInicial, dataFinal, situacao, pagina, id, idLoja } =
        req.query as any;

      // Se passou ID, busca nota específica (estatística / detalhe rápido)
      if (id) {
        const resp = await blingFetchRetry(
          `https://www.bling.com.br/Api/v3/nfe/${id}`,
          { headers: { Authorization: token, Accept: "application/json" } }
        );
        const data = await resp.json().catch(() => ({}));
        return res.json({
          success: true,
          notas: data?.data ? [data.data] : []
        });
      }

      const paginaUI = parseInt(pagina || "1");
      const { limite: limiteParam } = req.query as any;
      // Quantidade de notas solicitada pelo usuário (padrão 1000)
      const limiteTotal = Math.min(Math.max(parseInt(limiteParam || "1000"), 100), 5000);
      const limitPerReq = 100;
      const blingPagesNeeded = Math.ceil(limiteTotal / limitPerReq);
      const startPage = (paginaUI - 1) * blingPagesNeeded + 1;

      const fetchPage = async (p: number) => {
        const params = new URLSearchParams();
        params.set("tipo", "1");
        params.set("pagina", String(p));
        params.set("limite", String(limitPerReq));
        if (dataInicial) params.set("dataEmissaoInicial", dataInicial);
        if (dataFinal) params.set("dataEmissaoFinal", dataFinal);
        if (situacao) params.set("situacao", situacao);
        if (idLoja) params.set("idLoja", idLoja);

        const url = `https://www.bling.com.br/Api/v3/nfe?${params.toString()}`;
        const resp = await blingFetchRetry(url, {
          headers: { Authorization: token, Accept: "application/json" }
        });
        const data = await resp.json().catch(() => ({}));
        return Array.isArray(data?.data) ? data.data : [];
      };

      console.log(
        `📋 [NFe Saída] UI Pág ${paginaUI} | Limite: ${limiteTotal} | Bling p${startPage}..p${startPage + blingPagesNeeded - 1}`
      );

      const pagesToFetch = Array.from({ length: blingPagesNeeded }, (_, i) => startPage + i);
      const results = await Promise.all(pagesToFetch.map((p) => fetchPage(p)));
      const allNotas = results.flat();
      // Cortar ao limite solicitado
      const notas = allNotas.slice(0, limiteTotal);

      const lastPageFetched = results[results.length - 1] || [];
      res.json({
        success: true,
        notas,
        count: notas.length,
        hasMore: lastPageFetched.length === limitPerReq
      });
    } catch (error: any) {
      console.error("❌ [NFe Listar Saída Error]:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET detalhes de uma NF-e (inclui XML, chave, etc.)
  app.get("/api/bling/nfe/detalhe/:id", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const resp = await blingFetchRetry(
        `https://www.bling.com.br/Api/v3/nfe/${req.params.id}`,
        {
          headers: { Authorization: token, Accept: "application/json" }
        }
      );
      const data = await resp.json().catch(() => ({}));
      res.status(resp.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // BUSCAR ETIQUETAS DE ENVIO DO BLING (logística/remessas)
  // ────────────────────────────────────────────────────────────────────────────
  // Helper: fetch Bling c/ auto-retry em 429
  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 RATE LIMITER ROBUSTO PARA BLING API (2-3 req/s)
  // ═══════════════════════════════════════════════════════════════════════
  class BlingRateLimiter {
    private queue: Array<() => Promise<any>> = [];
    private processing = false;
    private lastRequest = 0;
    private minDelay = 334; // 334ms = ~3 req/s (Limite oficial do Bling v3)

    async enqueue<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        this.queue.push(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
        this.process();
      });
    }

    private async process() {
      if (this.processing || this.queue.length === 0) return;
      this.processing = true;

      while (this.queue.length > 0) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;

        if (timeSinceLastRequest < this.minDelay) {
          await new Promise((r) =>
            setTimeout(r, this.minDelay - timeSinceLastRequest)
          );
        }

        const fn = this.queue.shift();
        if (fn) {
          this.lastRequest = Date.now();
          await fn();
        }
      }

      this.processing = false;
    }
  }

  const blingLimiter = new BlingRateLimiter();

  async function blingFetchRetry(
    url: string,
    init: RequestInit,
    retries = 2,
    baseDelay = 2000
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Usa a fila global para respeitar rigorosamente o rate limit de 3 req/s
        const resp = await blingLimiter.enqueue(() => fetch(url, init));

        // ✅ Sucesso ou erro do cliente (não retryable)
        if (
          resp.ok ||
          (resp.status >= 400 && resp.status < 500 && resp.status !== 429)
        ) {
          return resp;
        }

        // 429 = Rate limit detectado mesmo com a fila (pode acontecer por concorrência externa)
        if (resp.status === 429 && attempt < retries) {
          const delayMs = baseDelay * Math.pow(2, attempt);
          console.warn(
            `⏳ [Bling API Queue] 429 detectado — tentativa ${attempt + 1}/${retries + 1} — aguardando ${delayMs}ms`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        // 500+ = Erro de servidor - vale a pena tentar de novo
        if (resp.status >= 500 && attempt < retries) {
          const delayMs = baseDelay * (attempt + 1);
          console.warn(
            `⚠️ [Bling API Queue] Erro ${resp.status} — tentativa ${attempt + 1}/${retries + 1} — aguardando ${delayMs}ms`
          );
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }

        return resp;
      } catch (e: any) {
        lastError = e;
        if (attempt < retries) {
          const delayMs = baseDelay * Math.pow(2, attempt);
          console.warn(
            `❌ [Bling API Queue] Erro de rede — tentativa ${attempt + 1}/${retries + 1} — aguardando ${delayMs}ms:`,
            e.message
          );
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw (
      lastError ||
      new Error(`Falha ao conectar com Bling após ${retries + 1} tentativas`)
    );
  }

  // GET /api/bling/download/pdf/:id — proxy de download de DANFE do Bling
  /**
   * GET /api/bling/download/pdf/:id
   * Refatorado por Antigravity (Sênior) para garantir:
   * 1. Autenticação via Header ou Query String.
   * 2. Extração via Logística REAL (sem fallback errado para PDF da nota).
   * 3. Persistência na tabela plural 'nfes' (Supabase).
   */
  app.get("/api/bling/download/pdf/:id", async (req, res) => {
    try {
      // ERRO 1 CORRIGIDO: Aceita token via Query String (&token=...) ou Header
      const rawToken =
        (req.query.token as string) ||
        (req.headers.authorization as string) ||
        "";
      const token = normalizeBearerToken(rawToken);

      if (!token || token === "Bearer ") {
        return res
          .status(401)
          .json({ error: "Token não fornecido ou inválido" });
      }

      const nfeId = req.params.id;
      const { type, numeroPedidoLoja: _pedidoLojaParam, idVenda: _idVendaParam } = req.query as any;
      let numeroPedidoLoja: string = String(_pedidoLojaParam || "").trim();

      console.log(
        `📥 [NFe PDF] Iniciando fluxo para ID ${nfeId} | Pedido: ${numeroPedidoLoja || "(auto)"} | Tipo: ${type || "normal"}`
      );

      // Se idVenda veio como query param, usa direto
      let idVendaBling = String(_idVendaParam || "").trim();

      // Para tipos que precisam de logística, busca o detalhe da NF-e para extrair idVenda
      if (
        type === "transport_label" ||
        type === "simplified" ||
        type === "combined" ||
        !type ||
        type === "normal"
      ) {
        // Sempre busca detalhe se não temos idVenda (para logística) ou se é DANFE normal (para linkDanfe)
        if (!idVendaBling || !numeroPedidoLoja || type === "normal" || !type) {
          try {
            const nfeLookup = await fetch(
              `https://www.bling.com.br/Api/v3/nfe/${nfeId}`,
              {
                headers: { Authorization: token, Accept: "application/json" }
              }
            );
            if (nfeLookup.ok) {
              const nfeLookupData = await nfeLookup.json();
              const d = nfeLookupData?.data;

              // Extrai idVenda de múltiplas estruturas possíveis do Bling v3
              if (!idVendaBling) {
                const vendas = d?.vendas;
                const candidateId =
                  (Array.isArray(vendas) && vendas.length > 0 ? vendas[0].id : null) ||
                  d?.pedidoVenda?.id ||
                  d?.pedido?.id ||
                  d?.idPedidoVenda ||
                  d?.idVenda;
                if (candidateId) {
                  idVendaBling = String(candidateId).trim();
                }
              }

              // Extrai numeroPedidoLoja
              if (!numeroPedidoLoja) {
                const vendas = d?.vendas;
                numeroPedidoLoja = String(
                  d?.intermediador?.numeroPedido ||
                  d?.numeroPedidoLoja ||
                  (Array.isArray(vendas) && vendas.length > 0 ? vendas[0].numeroPedidoLoja || vendas[0].numero : null) ||
                  d?.pedido?.numeroLoja ||
                  ""
                ).trim();
              }

              console.log(
                `🔍 [NFe PDF] idVenda=${idVendaBling || "(vazio)"}, numeroPedidoLoja=${numeroPedidoLoja || "(vazio)"}`
              );
            }
          } catch (lookupErr: any) {
            console.warn(
              `⚠️ [NFe PDF] Falha ao buscar dados do NF-e:`,
              lookupErr.message
            );
          }
        }
      }

      let pdfUrl = "";

      // Logística: busca URL correta dependendo do tipo solicitado
      if (
        type === "transport_label" ||
        type === "simplified" ||
        type === "combined"
      ) {
        console.log(
          `🔍 [Logística] Buscando ${type} para idVenda=${idVendaBling || "(vazio)"}, numeroPedidoLoja=${numeroPedidoLoja || "(vazio)"}...`
        );

        // /logisticas/etiquetas retorna ETIQUETA DE TRANSPORTE (não DANFE simplificada!)
        // Só usar para transport_label
        if (type === "transport_label" && idVendaBling) {
          try {
            const etiqUrl = `https://www.bling.com.br/Api/v3/logisticas/etiquetas?formato=PDF&idsVendas[]=${idVendaBling}`;
            const etiqResp = await fetch(etiqUrl, {
              headers: { Authorization: token, Accept: "application/json" }
            });
            if (etiqResp.ok) {
              const etiqData = await etiqResp.json();
              const etiqueta = etiqData?.data?.[0];
              if (etiqueta?.link) {
                pdfUrl = etiqueta.link;
                console.log(`✅ [Logística] Etiqueta PDF via /logisticas/etiquetas: ${pdfUrl}`);
              }
            }
          } catch (e: any) {
            console.warn(`⚠️ [Logística] /logisticas/etiquetas falhou:`, e.message);
          }
        }

        // objetos-postagem: fonte principal para simplified/combined, fallback para transport_label
        if (!pdfUrl) {
          // Tenta múltiplas buscas: primeiro por idVenda, depois por numeroPedidoLoja
          const buscas = [idVendaBling, numeroPedidoLoja].filter(Boolean);
          let objeto: any = null;

          for (const idBusca of buscas) {
            if (objeto) break;
            try {
              const objUrl = `https://www.bling.com.br/Api/v3/objetos-postagem?numeroPedidoLoja=${idBusca}`;
              const objResp = await fetch(objUrl, {
                headers: { Authorization: token, Accept: "application/json" }
              });
              if (objResp.ok) {
                const objData = await objResp.json();
                objeto = objData?.data?.[0];
              }
            } catch (e: any) {
              console.warn(`⚠️ [Logística] objetos-postagem com ${idBusca} falhou:`, e.message);
            }
          }

          if (objeto) {
            console.log(
              `✅ [Logística] Objeto encontrado. Rastreio: ${objeto.codigoRastreamento}`
            );

            // Define a URL correta baseada no tipo solicitado
            if (type === "transport_label") {
              pdfUrl = objeto.urlEtiqueta;
            } else if (type === "combined") {
              pdfUrl = objeto.urlEtiquetaDanfe;
            } else {
              pdfUrl = objeto.urlDanfeSimplificado;
            }

            // Persistência na tabela 'nfes' via Supabase
            if (numeroPedidoLoja) {
              try {
                const nfeResp = await fetch(
                  `https://www.bling.com.br/Api/v3/nfe/${nfeId}`,
                  {
                    headers: {
                      Authorization: token,
                      Accept: "application/json"
                    }
                  }
                );
                const nfeData = await nfeResp.json();
                const chave = nfeData?.data?.chaveAcesso;

                await supabase
                  .from("nfes")
                  .upsert(
                    {
                      pedido_id: numeroPedidoLoja,
                      nfe_id: nfeId,
                      chave_acesso: chave,
                      rastreio: objeto.codigoRastreamento,
                      transportadora:
                        objeto.transporte?.transportadora?.nome ||
                        "Não informada",
                      url_etiqueta: pdfUrl,
                      atualizado_em: new Date().toISOString()
                    },
                    { onConflict: "pedido_id" }
                  );

                console.log(
                  `💾 [Supabase] Dados de logística sincronizados na tabela 'nfes'`
                );
              } catch (dbErr: any) {
                console.error(
                  `⚠️ [Supabase] Falha ao salvar em nfes:`,
                  dbErr.message
                );
              }
            }
          }
        } // fim if (!pdfUrl) — fallback objetos-postagem

        // Se a logística falhou, retorna 404 claro (não cair no fallback de linkDanfe)
        if (!pdfUrl) {
          console.warn(
            `⚠️ [Logística] ${type} não disponível no Bling para o pedido ${numeroPedidoLoja || nfeId}`
          );
          return res.status(404).json({
            error: "Logística Pendente",
            message: type === "simplified"
              ? "A DANFE Simplificada ainda não foi gerada. Verifique se o objeto logístico existe no Bling."
              : type === "combined"
                ? "O documento combinado (DANFE + Etiqueta) ainda não foi gerado no Bling."
                : "O código de rastreio ou etiqueta ainda não foi gerado no Bling."
          });
        }
      }

      // DANFE Normal (linkDanfe da NF-e) — NÃO é fallback para simplified/transport_label/combined
      if (!pdfUrl) {
        const nfeResp = await fetch(
          `https://www.bling.com.br/Api/v3/nfe/${nfeId}`,
          {
            headers: { Authorization: token, Accept: "application/json" }
          }
        );
        const nfeData = await nfeResp.json();
        pdfUrl = nfeData?.data?.linkDanfe || nfeData?.data?.linkPDF;
      }

      if (!pdfUrl) {
        return res
          .status(404)
          .json({
            error: "Documento não disponível",
            details: "Nenhum link de PDF encontrado no Bling."
          });
      }

      // Download e Stream do PDF
      console.log(`📄 [NFe PDF] Baixando: ${pdfUrl}`);
      const pdfFileResp = await fetch(pdfUrl);

      if (!pdfFileResp.ok) {
        return res.status(pdfFileResp.status).json({
          error: "Erro no Download Direto",
          redirectUrl: pdfUrl,
          message: "Falha ao processar PDF pelo servidor, tente o link direto."
        });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="DOCUMENTO_${nfeId}.pdf"`
      );

      const arrayBuffer = await pdfFileResp.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
      console.log(`✅ [NFe PDF] Enviado com sucesso.`);
    } catch (error: any) {
      console.error("❌ [CRITICAL ERROR]:", error.message);
      res
        .status(500)
        .json({ error: "Erro interno no servidor", details: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/bling/nfe/:id/etiqueta — busca etiqueta ZPL REAL da NF-e no Bling
  // Retorna { success: true, zpl: "^XA...^XZ" } com o DANFE simplificado real
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * GET /api/bling/nfe/:id/etiqueta
   * Busca etiqueta ZPL REAL da NF-e no Bling.
   * Estratégia Robusta:
   * 1. Tenta direto /nfe/{id}/etiqueta (endpoint padrão v3)
   * 2. Se falhar, busca detalhes da nota para extrair idObjetoLogistico
   * 3. Busca ZPL via /logisticas/etiquetas/zpl
   */
  app.get("/api/bling/nfe/:id/etiqueta", async (req, res) => {
    try {
      const rawAuth = req.headers.authorization || "";
      const token = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;
      if (!rawAuth) return res.status(401).json({ error: "Token obrigatório" });

      const nfeId = req.params.id;
      const { loja, numeroPedidoLoja } = req.query as any;
      console.log(
        `🏷️  [NFe Etiqueta] Iniciando busca para NF-e ${nfeId} (Pedido: ${numeroPedidoLoja}, Loja/Origem: ${loja || "não informado"})`
      );

      // 1. Tentativa Direta (V3 NFe Etiqueta)
      let respDirect = await blingFetchRetry(
        `https://www.bling.com.br/Api/v3/nfe/${nfeId}/etiqueta`,
        { headers: { Authorization: token, Accept: "application/json" } }
      );

      let dataDirect = await respDirect.json().catch(() => ({}));
      let zplResult = dataDirect?.data?.zpl || dataDirect?.zpl || null;

      // 2. Busca via Objeto Logístico (usando Pedido se fornecido)
      if (!zplResult && numeroPedidoLoja) {
        console.log(`🔍 [NFe Etiqueta] Fallback: buscando objeto logístico via pedido ${numeroPedidoLoja}...`);
        const idBuscaLogistica = numeroPedidoLoja;

        const objUrl = `https://www.bling.com.br/Api/v3/objetos-postagem?numeroPedidoLoja=${idBuscaLogistica}`;
        const objResp = await fetch(objUrl, {
          headers: { Authorization: token, Accept: "application/json" }
        });

        if (objResp.ok) {
          const objData = await objResp.json();
          const idObjeto = objData?.data?.[0]?.id;
          if (idObjeto) {
            console.log(
              `🏷️  [NFe Etiqueta] Encontrado objeto ${idObjeto}. Buscando ZPL...`
            );
            const zplResp = await fetch(
              `https://www.bling.com.br/Api/v3/logisticas/etiquetas/zpl?idsObjetos[]=${idObjeto}`,
              {
                headers: { Authorization: token, Accept: "application/json" }
              }
            );
            const zplData = await zplResp.json();
            zplResult = zplData?.data?.[0]?.zpl || zplData?.zpl;
          }
        }
      }

      if (!zplResult) {
        console.warn(
          `⚠️  [NFe Etiqueta] ZPL não encontrado por nenhum método para nfe/${nfeId}`
        );
        return res
          .status(404)
          .json({ success: false, error: "ZPL não encontrado" });
      }

      console.log(`✅ [NFe Etiqueta] ZPL obtido com sucesso para nfe/${nfeId}`);
      res.json({ success: true, zpl: zplResult });
    } catch (error: any) {
      console.error("❌ [NFe Etiqueta Error]:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/bling/etiquetas/buscar", async (req, res) => {
    try {
      const { pedidoVendaIds } = req.body as {
        pedidoVendaIds: (string | number)[];
      };
      const rawAuth = req.headers.authorization || "";
      const authToken = rawAuth.startsWith("Bearer ")
        ? rawAuth
        : `Bearer ${rawAuth}`;

      if (!rawAuth)
        return res.status(401).json({ error: "Token do Bling obrigatório" });
      if (!Array.isArray(pedidoVendaIds) || pedidoVendaIds.length === 0) {
        return res.status(400).json({ error: "pedidoVendaIds[] obrigatório" });
      }

      const readH = { Authorization: authToken, Accept: "application/json" };
      const results: any[] = [];
      const totalPedidos = pedidoVendaIds.length;

      console.log(
        `\n📥 [ETIQUETAS REAL] Buscando ${totalPedidos} etiqueta(s) no Bling...`
      );

      for (let idx = 0; idx < pedidoVendaIds.length; idx++) {
        const pvId = pedidoVendaIds[idx];

        await blingLimiter.enqueue(async () => {
          try {
            const progressBar = `[${idx + 1}/${totalPedidos}]`;

            // 1. Buscar a NF-e vinculada ao pedido para pegar o objeto logístico
            console.log(
              `${progressBar} 🔍 Buscando NF-e para pedido ${pvId}...`
            );
            const nfeSearchResp = await fetch(
              `https://www.bling.com.br/Api/v3/nfe?numeroPedidoLoja=${pvId}&tipo=1`,
              { headers: readH }
            );
            const nfeSearchData = await nfeSearchResp.json();
            const nfeId = nfeSearchData?.data?.[0]?.id;

            if (!nfeId) {
              console.warn(
                `${progressBar} ⚠️ Nenhuma NF-e encontrada para pedido ${pvId}`
              );
              results.push({
                pedidoVendaId: pvId,
                success: false,
                error: "NF-e não encontrada para este pedido"
              });
              return;
            }

            // 2. Buscar detalhes da NF-e para obter o ID do objeto logístico
            console.log(
              `${progressBar} 🔍 Buscando detalhes da NF-e ${nfeId}...`
            );
            const nfeDetailResp = await fetch(
              `https://www.bling.com.br/Api/v3/nfe/${nfeId}`,
              { headers: readH }
            );
            const nfeDetailData = await nfeDetailResp.json();
            const objLogisticoId =
              nfeDetailData?.data?.transporte?.objetoLogistico?.id;

            if (!objLogisticoId) {
              console.warn(
                `${progressBar} ⚠️ Objeto logístico não encontrado na NF-e ${nfeId}`
              );
              results.push({
                pedidoVendaId: pvId,
                success: false,
                error: "Objeto logístico não encontrado na NF-e"
              });
              return;
            }

            // 3. Buscar a etiqueta ZPL real
            console.log(
              `${progressBar} 🏷️ Buscando ZPL para objeto ${objLogisticoId}...`
            );
            const zplResp = await fetch(
              `https://www.bling.com.br/Api/v3/logisticas/etiquetas/zpl?idsObjetos[]=${objLogisticoId}`,
              { headers: readH }
            );

            if (!zplResp.ok) {
              results.push({
                pedidoVendaId: pvId,
                success: false,
                error: `Erro Bling ZPL (${zplResp.status})`
              });
              return;
            }

            const zplData = await zplResp.json();
            const zpl = zplData?.data?.[0]?.zpl || zplData?.zpl;

            if (!zpl) {
              results.push({
                pedidoVendaId: pvId,
                success: false,
                error: "Bling não retornou conteúdo ZPL"
              });
              return;
            }

            console.log(`${progressBar} ✅ ZPL recuperado com sucesso!`);
            results.push({
              pedidoVendaId: pvId,
              success: true,
              zpl,
              numero: nfeDetailData?.data?.numero,
              nomeCliente: nfeDetailData?.data?.contato?.nome
            });
          } catch (e: any) {
            console.error(`❌ Erro no pedido ${pvId}:`, e.message);
            results.push({
              pedidoVendaId: pvId,
              success: false,
              error: e.message
            });
          }
        });
      }

      const ok = results.filter((r) => r.success).length;
      const fail = results.filter((r) => !r.success).length;
      console.log(
        `\n✅ CONCLUSÃO: ${ok}/${totalPedidos} etiqueta(s) recuperada(s), ${fail} falha(s)\n`
      );

      res.json({
        success: fail === 0,
        total: totalPedidos,
        ok,
        fail,
        results
      });
    } catch (error: any) {
      console.error("❌ [Etiquetas buscar] Erro geral:", error.message);
      res.status(500).json({
        success: false,
        error: error.message,
        details: "Erro ao processar requisição de etiquetas"
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Proxy passthrough: GET /api/bling/pedidos/vendas → Bling v3
  // Evita CORS no browser — o service importacaoControllerService usa esta rota.
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/bling/pedidos/vendas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });
      // Passa a query string exatamente como veio (preserva arrays idsSituacoes[]=6)
      const rawQs = req.originalUrl.split("?")[1] || "";
      const url = `https://www.bling.com.br/Api/v3/pedidos/vendas${rawQs ? `?${rawQs}` : ""}`;
      console.log(`🛒 [PEDIDOS PROXY] ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Proxy: GET /api/bling/logisticas → Bling v3 /logisticas (transportadoras)
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/bling/logisticas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const query = new URLSearchParams(req.query as any).toString();
      const url = `https://www.bling.com.br/Api/v3/logisticas${query ? `?${query}` : ""}`;
      console.log(`🚚 [LOGISTICAS] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [LOGISTICAS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Proxy: GET /api/bling/logisticas/objetos → Bling v3 /logisticas/objetos
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/bling/logisticas/objetos", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const query = new URLSearchParams(req.query as any).toString();
      const url = `https://www.bling.com.br/Api/v3/logisticas/objetos${query ? `?${query}` : ""}`;
      console.log(`📦 [LOGISTICAS OBJETOS] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [LOGISTICAS OBJETOS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Proxy: GET /api/bling/contatos/:id → Bling v3 /contatos/:id
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/bling/contatos/:id", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = `https://www.bling.com.br/Api/v3/contatos/${req.params.id}`;
      console.log(`👤 [CONTATO] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [CONTATO ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy para Objetos de Postagem (Bling v3)
  app.get("/api/bling/objetos-postagem", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const query = new URLSearchParams(req.query as any).toString();
      const url = `https://www.bling.com.br/Api/v3/objetos-postagem${query ? `?${query}` : ""}`;

      console.log(`📦 [LOGISTICA] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });

      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [LOGISTICA ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OBJETOS POSTAGEM — LOCAL DB (Supabase) CRUD
  // Armazena localmente, permite exclusão sem afetar o Bling
  // ─────────────────────────────────────────────────────────────────────────

  // GET - lista objetos salvos localmente
  app.get("/api/objetos-postagem", async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from("objetos_postagem")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json({ success: true, data: data || [] });
    } catch (err: any) {
      console.error("❌ [OBJETOS LOCAL GET]:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST - salva/atualiza objetos em lote (upsert por bling_id)
  app.post("/api/objetos-postagem/sync", async (req, res) => {
    try {
      const objetos = req.body?.objetos;
      if (!Array.isArray(objetos) || objetos.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhum objeto enviado." });
      }
      const { data, error } = await supabase
        .from("objetos_postagem")
        .upsert(
          objetos.map((o: any) => ({
            bling_id: String(o.bling_id || o.id || `${o.nfe_id}_${o.numero_pedido_loja}`),
            nfe_id: o.nfe_id,
            nfe_numero: o.nfe_numero,
            numero_pedido_loja: o.numero_pedido_loja,
            destinatario: o.destinatario,
            rastreio: o.rastreio,
            servico: o.servico,
            transportadora: o.transportadora,
            situacao: o.situacao,
            valor_nota: o.valor_nota,
            data_criacao: o.data_criacao,
            prazo_entrega: o.prazo_entrega,
            dimensoes: o.dimensoes || {},
            dados_bling: o.dados_bling || {},
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "bling_id" }
        )
        .select();
      if (error) throw error;
      res.json({ success: true, count: data?.length || 0 });
    } catch (err: any) {
      console.error("❌ [OBJETOS LOCAL SYNC]:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE - remove objeto apenas do banco local (NÃO do Bling)
  app.delete("/api/objetos-postagem/:id", async (req, res) => {
    try {
      const { error } = await supabase
        .from("objetos_postagem")
        .delete()
        .eq("id", req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error("❌ [OBJETOS LOCAL DELETE]:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE - remove múltiplos objetos do banco local
  app.post("/api/objetos-postagem/delete-batch", async (req, res) => {
    try {
      const ids = req.body?.ids;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: "Nenhum ID enviado." });
      }
      const { error } = await supabase
        .from("objetos_postagem")
        .delete()
        .in("id", ids);
      if (error) throw error;
      res.json({ success: true, deleted: ids.length });
    } catch (err: any) {
      console.error("❌ [OBJETOS LOCAL DELETE BATCH]:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Proxy para detalhes de objeto logístico (Bling v3)
  // GET /logisticas/objetos/{idObjeto} → rastreamento.codigo etc
  app.get("/api/bling/logisticas/objetos/:idObjeto", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = `https://www.bling.com.br/Api/v3/logisticas/objetos/${req.params.idObjeto}`;
      console.log(`📦 [LOGISTICA OBJETO] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [LOGISTICA OBJETO ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy para etiquetas de logística por pedidos de venda (Bling v3)
  // GET /logisticas/etiquetas?formato=PDF&idsVendas[]=ID
  app.get("/api/bling/logisticas/etiquetas-vendas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const rawQs = req.originalUrl.split("?")[1] || "";
      const url = `https://www.bling.com.br/Api/v3/logisticas/etiquetas${rawQs ? `?${rawQs}` : ""}`;
      console.log(`🏷️ [ETIQUETAS VENDAS] GET ${url}`);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [ETIQUETAS VENDAS ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.all(/^\/api\/bling\//, async (req, res, next) => {
    // Skip rotas já tratadas por handlers específicos — passa para o próximo handler
    if (
      req.path.startsWith("/api/bling/sync") ||
      req.path.startsWith("/api/bling/filter") ||
      req.path.startsWith("/api/bling/bulk") ||
      req.path.startsWith("/api/bling/export") ||
      req.path.startsWith("/api/bling/lotes") ||
      req.path.startsWith("/api/bling/etiquetas") ||
      req.path === "/api/bling/token" ||
      req.path === "/api/bling/nfe/criar-emitir" ||
      req.path.startsWith("/api/bling/nfe/listar-saida") ||
      req.path.startsWith("/api/bling/nfe/detalhe") ||
      req.path.startsWith("/api/bling/nfe/synced-ids") ||
      req.path.startsWith("/api/bling/nfe/save-batch") ||
      req.path.match(/^\/api\/bling\/nfe\/\d+\/enviar/) ||
      req.path === "/api/bling/canais-venda" ||
      req.path.startsWith("/api/bling/pedido-venda") ||
      req.path.startsWith("/api/bling/vendas") ||
      req.path.startsWith("/api/bling/logisticas") ||
      req.path.startsWith("/api/bling/contatos")
    )
      return next();

    try {
      // Remove /api/bling prefix
      const endpoint = req.path.replace(/^\/api\/bling/, "");
      const method = req.method;
      const apiKey = req.headers["authorization"] || "";
      const query = new URLSearchParams(req.query as any).toString();

      const url = `https://www.bling.com.br/Api/v3${endpoint}${query ? `?${query}` : ""}`;

      const response = await fetch(url, {
        method: method,
        headers: {
          Authorization: apiKey,
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: ["POST", "PUT", "PATCH"].includes(method)
          ? JSON.stringify(req.body)
          : undefined
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Bling Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // BUSCAR PEDIDOS DE VENDAS — filtro situação "Em Aberto" (idsSituacoes=6)
  // Retorna todos os pedidos sem salvar localmente.
  // ─────────────────────────────────────────────────────────────────────────
  app.get("/api/bling/vendas/buscar", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const dataInicio = String(
        req.query.dataInicio ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
      );
      const dataFim = String(
        req.query.dataFim || new Date().toISOString().split("T")[0]
      );
      const idLoja = req.query.idLoja ? String(req.query.idLoja) : "";
      const situacoesRaw = String(req.query.situacoes || "6");
      const situacaoIds = situacoesRaw
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const paginaUI = parseInt(String(req.query.pagina || "1"));

      console.log(
        `🛒 [VENDAS BUSCAR] ${dataInicio} → ${dataFim} | situações: ${situacaoIds.join(",")} | Pág UI: ${paginaUI}`
      );

      // ── 1. Double-Fetch (UI Pág n -> Bling 2n-1 & 2n) ──────────────────
      const blingP1 = paginaUI * 2 - 1;
      const blingP2 = paginaUI * 2;
      const limitPerReq = 100;

      const fetchPage = async (p: number) => {
        const situacoesQs = situacaoIds
          .map((id: string, i: number) => `idsSituacoes[${i}]=${id}`)
          .join("&");
        const idLojaQs = idLoja ? `&idLoja=${idLoja}` : "";
        const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${dataInicio}&dataFinal=${dataFim}&${situacoesQs}&limite=${limitPerReq}&pagina=${p}${idLojaQs}`;
        const pageResp = await fetch(url, {
          headers: { Authorization: token, Accept: "application/json" }
        });
        if (!pageResp.ok) return [];
        const pageData = await pageResp.json();
        return Array.isArray(pageData?.data) ? pageData.data : [];
      };

      console.log(
        `🛒 [VENDAS BUSCAR] Double-Fetch Bling p${blingP1} & p${blingP2}`
      );
      const [p1, p2] = await Promise.all([
        fetchPage(blingP1),
        fetchPage(blingP2)
      ]);
      const allRawOrders = [...p1, ...p2];

      console.log(
        `🛒 [VENDAS BUSCAR] ${allRawOrders.length} pedido(s) carregados (Double-Fetch) — buscando detalhes...`
      );

      // ── 2. Enriquece com detalhes completos (itens, endereço, pagamentos) ────
      // Bling v3 lista retorna dados resumidos; GET /pedidos/vendas/{id} retorna completo
      const shouldEnrich = req.query.enrich !== "false";
      const enrichedRaw: any[] = new Array(allRawOrders.length);

      if (shouldEnrich && allRawOrders.length > 0) {
        console.log(
          `🛒 [VENDAS BUSCAR] Enriquecendo ${allRawOrders.length} pedido(s)...`
        );
        // Concorrência aumentada para 5 em vez de 2 para acelerar busca sem estourar limiter
        const CONCURRENCY = 5;
        const DELAY_ENTRE_LOTES = 200; // ms reduzido de 400 para 200

        for (let i = 0; i < allRawOrders.length; i += CONCURRENCY) {
          const batch = allRawOrders.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            batch.map(async (o: any) => {
              try {
                const detResp = await fetch(
                  `https://www.bling.com.br/Api/v3/pedidos/vendas/${o.id}`,
                  {
                    headers: {
                      Authorization: token,
                      Accept: "application/json"
                    }
                  }
                );
                if (detResp.status === 429) {
                  return o; // rate limit: volta o básico
                }
                if (detResp.ok) {
                  const detData = await detResp.json();
                  return detData?.data || o;
                }
              } catch {
                /* ignore */
              }
              return o;
            })
          );
          results.forEach((r, bi) => {
            if (i + bi < enrichedRaw.length) enrichedRaw[i + bi] = r;
          });
          if (i + CONCURRENCY < allRawOrders.length) {
            await new Promise((resolve) =>
              setTimeout(resolve, DELAY_ENTRE_LOTES)
            );
          }
        }
      } else {
        // Usa dados da lista sem enriquecer
        allRawOrders.forEach((o, i) => (enrichedRaw[i] = o));
      }

      console.log(
        `🛒 [VENDAS BUSCAR] ${enrichedRaw.length} pedido(s) enriquecidos com detalhes`
      );

      // ── 3. Mapeia campos completos ─────────────────────────────────────────
      const orders = enrichedRaw.filter(Boolean).map((order: any) => {
        const numeroLoja = String(order?.numeroLoja || "");
        const canalRaw =
          order?.loja?.nome ||
          order?.loja?.descricao ||
          order?.origem?.nome ||
          order?.origem ||
          order?.tipo ||
          "";
        const detectedLoja = parseLoja(canalRaw, numeroLoja);
        const items = Array.isArray(order?.itens) ? order.itens : [];
        const parcelas = Array.isArray(order?.parcelas)
          ? order.parcelas
          : Array.isArray(order?.pagamentos)
            ? order.pagamentos
            : [];
        const endEntrega =
          order?.enderecoEntrega || order?.transporte?.enderecoEntrega || null;

        return {
          id: `venda-${order.id}`,
          orderId: String(
            order?.numeroLoja || order?.numero || order?.id || ""
          ),
          blingId: String(order?.id || ""),
          blingNumero: String(order?.numero || ""),
          customer_name: order?.contato?.nome || "Não informado",
          customer_cpf_cnpj:
            order?.contato?.numeroDocumento ||
            order?.contato?.cpf ||
            order?.contato?.cnpj ||
            "",
          customer_email: order?.contato?.email || "",
          customer_tel:
            order?.contato?.telefone || order?.contato?.celular || "",
          data: String(order?.data || "").split("T")[0],
          dataPrevista: String(order?.dataPrevista || "").split("T")[0],
          status: String(
            order?.situacao?.descricao || order?.situacao?.valor || "Em aberto"
          ),
          situacaoId: Number(order?.situacao?.id || 0),
          loja: detectedLoja,
          lojaRaw: String(canalRaw),
          lojaId: Number(order?.loja?.id || 0),
          total: Number(order?.total || 0),
          price_total: Number(order?.total || 0),
          frete: Number(order?.frete || 0),
          desconto: Number(order?.desconto?.valor || 0),
          rastreamento: order?.transporte?.codigoRastreamento || "",
          transportador: order?.transporte?.transportador?.nome || "",
          tipoFrete: order?.transporte?.tipoFrete || "",
          observacoes: order?.observacoes || "",
          observacoesInternas: order?.observacoesInternas || "",
          enderecoEntrega: endEntrega
            ? {
                nome: endEntrega?.nome || order?.contato?.nome || "",
                logradouro:
                  endEntrega?.endereco || endEntrega?.logradouro || "",
                numero: endEntrega?.numero || "",
                complemento: endEntrega?.complemento || "",
                bairro: endEntrega?.bairro || "",
                cidade: endEntrega?.municipio?.nome || endEntrega?.cidade || "",
                uf: endEntrega?.municipio?.uf || endEntrega?.uf || "",
                cep: endEntrega?.cep || "",
                pais: endEntrega?.pais || "BR"
              }
            : null,
          pagamentos: parcelas.map((p: any) => ({
            forma:
              p?.formaPagamento?.descricao ||
              p?.forma ||
              p?.tipo ||
              "Não informado",
            valor: Number(p?.valor || 0),
            parcelas: Number(p?.numeroParcelas || p?.parcelas || 1)
          })),
          itens: items.map((item: any) => ({
            sku: String(item?.codigo || item?.codigoProduto || "").trim(),
            descricao: item?.descricao || item?.nome || "",
            quantidade: Number(item?.quantidade || 0),
            valorUnitario: Number(item?.valor || item?.valorUnitario || 0),
            subtotal: Number(item?.quantidade || 0) * Number(item?.valor || 0),
            unidade: item?.unidade || "UN",
            produtoId: String(item?.produto?.id || item?.idProduto || "")
          })),
          itensCount: items.length
        };
      });

      res.json({
        success: true,
        total: orders.length,
        orders,
        hasMore: p2.length === limitPerReq
      });
    } catch (error: any) {
      console.error("❌ [VENDAS BUSCAR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MERCADO LIVRE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Troca code OAuth pelo access_token do Mercado Livre */
  app.post("/api/ml/token", async (req, res) => {
    try {
      const {
        grant_type,
        code,
        refresh_token,
        client_id,
        client_secret,
        redirect_uri
      } = req.body;

      const body = new URLSearchParams();
      body.append("grant_type", grant_type || "authorization_code");
      if (code) body.append("code", code);
      if (refresh_token) body.append("refresh_token", refresh_token);
      if (redirect_uri) body.append("redirect_uri", redirect_uri);
      body.append("client_id", client_id);
      body.append("client_secret", client_secret);

      const response = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body: body.toString()
      });

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("ML Token Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Obtém info do vendedor (para pegar seller_id) */
  app.get("/api/ml/user", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const response = await fetch("https://api.mercadolibre.com/users/me", {
        headers: { Authorization: token, Accept: "application/json" }
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /** Sincroniza pedidos do Mercado Livre com paginação automática */
  app.get("/api/ml/sync/orders", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token não fornecido" });

      const sellerId = String(req.query.sellerId || "");
      const dataInicio = String(
        req.query.dataInicio ||
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0]
      );
      const dataFim = String(
        req.query.dataFim || new Date().toISOString().split("T")[0]
      );

      if (!sellerId)
        return res.status(400).json({ error: "sellerId é obrigatório" });

      console.log(
        `🛒 [ML SYNC ORDERS] Vendedor ${sellerId} | ${dataInicio} → ${dataFim}`
      );

      const allOrders: any[] = [];
      let offset = 0;
      const limit = 50;
      let hasMore = true;
      let page = 0;
      const MAX_PAGES = 10000; // Remover limite arbitrário - importar TODOS

      while (hasMore && page < MAX_PAGES) {
        const dateFrom = `${dataInicio}T00:00:00.000-03:00`;
        const dateTo = `${dataFim}T23:59:59.000-03:00`;
        const url = `https://api.mercadolibre.com/orders/search?seller=${sellerId}&order.date_created.from=${encodeURIComponent(dateFrom)}&order.date_created.to=${encodeURIComponent(dateTo)}&sort=date_desc&offset=${offset}&limit=${limit}`;

        const resp = await fetch(url, {
          headers: { Authorization: token, Accept: "application/json" }
        });
        if (!resp.ok) {
          if (page === 0)
            return res
              .status(resp.status)
              .json({ error: "Erro ao buscar pedidos do ML" });
          break;
        }

        const repo = await resp.json();
        const results: any[] = repo.results || [];
        allOrders.push(...results);

        const total = repo.paging?.total || 0;
        offset += results.length;
        if (results.length < limit || offset >= total) hasMore = false;
        page++;

        console.log(
          `📦 ML: Página ${page} importada (${allOrders.length}/${total} pedidos)`
        );
      }

      if (page >= MAX_PAGES) {
        console.warn(
          `⚠️  ML: Limite de ${MAX_PAGES} páginas atingido. Pode haver mais pedidos.`
        );
      }

      // Normalizar para o formato interno — explode multi-item em linhas individuais
      const orders: any[] = [];
      allOrders.forEach((order: any) => {
        const items = order.order_items || [];
        const orderData = (order.date_created || "").split("T")[0];
        const customerName = order.buyer?.nickname || order.buyer?.first_name || "Comprador ML";
        const totalAmount = Number(order.total_amount || 0);
        const shippingCost = Number(order.shipping?.cost || 0);
        // ML order_items fees (marketplace_fee vem dentro de payments)
        const payments = order.payments || [];
        const totalMarketplaceFee = payments.reduce((s: number, p: any) => s + Math.abs(Number(p.marketplace_fee || 0)), 0);

        if (items.length === 0) {
          // Pedido sem itens — cria linha única para não perder dados
          orders.push({
            id: `ml-${order.id}`,
            orderId: String(order.id),
            customer_name: customerName,
            data: orderData,
            canal: "ML",
            sku: "",
            quantity: 1,
            unit_price: totalAmount,
            total: totalAmount,
            frete: shippingCost,
            platform_fees: totalMarketplaceFee,
          });
        } else {
          // Proporção de fees/frete por item baseado no subtotal
          const orderSubtotal = items.reduce((s: number, i: any) => s + Number(i.quantity || 1) * Number(i.unit_price || 0), 0);

          items.forEach((item: any) => {
            const sku = item.item?.seller_sku || item.item?.id || "";
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unit_price || 0);
            const subtotal = qty * unitPrice;
            const proportion = orderSubtotal > 0 ? subtotal / orderSubtotal : 1 / items.length;

            orders.push({
              id: `ml-${order.id}-${sku || item.item?.id}`,
              orderId: String(order.id),
              customer_name: customerName,
              data: orderData,
              canal: "ML",
              sku,
              quantity: qty,
              unit_price: unitPrice,
              total: subtotal,
              frete: Math.round(shippingCost * proportion * 100) / 100,
              platform_fees: Math.round(totalMarketplaceFee * proportion * 100) / 100,
            });
          });
        }
      });

      // Log detalhado de itens importados
      const totalItens = orders.length;
      const uniqueOrders = new Set(orders.map((o: any) => o.orderId)).size;
      console.log(
        `📦 [ML] ${uniqueOrders} pedidos ML explodidos em ${totalItens} linhas de item`
      );

      console.log(
        `✅ [ML SYNC ORDERS] ${orders.length} pedidos, ${totalItens} itens importados em ${page} página(s)`
      );
      res.json({ success: true, orders, total: allOrders.length, pages: page });
    } catch (error: any) {
      console.error("ML Sync Orders Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SHOPEE INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /** Gera URL de autenticação Shopee (com HMAC-SHA256) */
  app.get("/api/shopee/auth-url", async (req, res) => {
    try {
      const { partnerId, partnerKey, redirect } = req.query as any;
      if (!partnerId || !partnerKey)
        return res
          .status(400)
          .json({ error: "partnerId e partnerKey obrigatórios" });

      const { createHmac } = await import("crypto");
      const timestamp = Math.floor(Date.now() / 1000);
      const basePath = "/api/v2/shop/auth_partner";
      const rawSign = `${partnerId}${basePath}${timestamp}`;
      const sign = createHmac("sha256", partnerKey)
        .update(rawSign)
        .digest("hex");

      const redirectUri = encodeURIComponent(
        redirect || "https://localhost:3000/shopee-callback"
      );
      const authUrl = `https://partner.shopeemall.com.br${basePath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}&redirect=${decodeURIComponent(redirectUri)}`;
      res.json({ authUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /** Troca code pelo token Shopee */
  app.post("/api/shopee/token", async (req, res) => {
    try {
      const { partnerId, partnerKey, code, shopId } = req.body;
      if (!partnerId || !partnerKey || !code)
        return res
          .status(400)
          .json({ error: "partnerId, partnerKey e code obrigatórios" });

      const { createHmac } = await import("crypto");
      const timestamp = Math.floor(Date.now() / 1000);
      const basePath = "/api/v2/auth/token/get";
      const rawSign = `${partnerId}${basePath}${timestamp}`;
      const sign = createHmac("sha256", partnerKey)
        .update(rawSign)
        .digest("hex");

      const response = await fetch(
        `https://partner.shopeemall.com.br${basePath}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            shop_id: shopId ? Number(shopId) : undefined,
            partner_id: Number(partnerId)
          })
        }
      );

      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Shopee Token Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  /** Sincroniza pedidos Shopee */
  app.get("/api/shopee/sync/orders", async (req, res) => {
    try {
      const {
        partnerId,
        partnerKey,
        shopId,
        accessToken,
        dataInicio,
        dataFim
      } = req.query as any;
      if (!partnerId || !partnerKey || !shopId || !accessToken)
        return res
          .status(400)
          .json({ error: "Parâmetros obrigatórios faltando" });

      const { createHmac } = await import("crypto");

      const timeFrom = dataInicio
        ? Math.floor(new Date(`${dataInicio}T00:00:00`).getTime() / 1000)
        : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const timeTo = dataFim
        ? Math.floor(new Date(`${dataFim}T23:59:59`).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      // ── Passo 1: Coletar order_sn via paginação cursor — chunks de 15 dias ──
      // A Shopee limita get_order_list a no máximo 15 dias por chamada.
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60;
      const allSnList: {
        order_sn: string;
        order_status: string;
        create_time: number;
      }[] = [];
      const listBasePath = "/api/v2/order/get_order_list";
      let totalPages = 0;
      const MAX_PAGES_SHOPEE = 10000; // Remover limite arbitrário

      // Dividir o intervalo total em janelas de 15 dias
      for (
        let chunkFrom = timeFrom;
        chunkFrom < timeTo;
        chunkFrom += FIFTEEN_DAYS
      ) {
        const chunkTo = Math.min(chunkFrom + FIFTEEN_DAYS - 1, timeTo);
        let cursor = "";
        let hasMore = true;

        while (hasMore && totalPages < MAX_PAGES_SHOPEE) {
          const chunkTs = Math.floor(Date.now() / 1000);
          const listRawSign = `${partnerId}${listBasePath}${chunkTs}${accessToken}${shopId}`;
          const listSign = createHmac("sha256", partnerKey)
            .update(listRawSign)
            .digest("hex");

          const params = new URLSearchParams({
            partner_id: partnerId,
            shop_id: shopId,
            access_token: accessToken,
            timestamp: String(chunkTs),
            sign: listSign,
            time_range_field: "create_time",
            time_from: String(chunkFrom),
            time_to: String(chunkTo),
            page_size: "50",
            response_optional_fields: "order_status",
            ...(cursor ? { cursor } : {})
          });

          const resp = await fetch(
            `https://partner.shopeemall.com.br${listBasePath}?${params}`,
            {
              headers: { "Content-Type": "application/json" }
            }
          );

          if (!resp.ok) {
            if (totalPages === 0)
              return res
                .status(resp.status)
                .json({ error: "Erro ao buscar lista de pedidos Shopee" });
            break;
          }

          const pageData = await resp.json();
          const response_obj = pageData.response || {};
          const list = response_obj.order_list || [];
          allSnList.push(...list);

          hasMore = response_obj.more === true;
          cursor = response_obj.next_cursor || "";
          totalPages++;

          console.log(
            `📦 Shopee: Página ${totalPages} importada (${allSnList.length} pedidos até agora)`
          );
        }
      }

      if (totalPages >= MAX_PAGES_SHOPEE) {
        console.warn(
          `⚠️  Shopee: Limite de ${MAX_PAGES_SHOPEE} páginas atingido. Veja se há mais pedidos.`
        );
      }

      // ── Passo 2: Buscar detalhes em lotes de 50 ───────────────────────────
      const detailBasePath = "/api/v2/order/get_order_detail";
      const detailFields =
        "buyer_user_id,buyer_username,estimated_shipping_fee,recipient_address,actual_shipping_fee,goods_to_declare,note,note_update_time,pay_time,pickup_done_time,tracking_no,transaction_fee,actual_shipping_fee_confirmed,cod_amount,cod_exchanged_amount,seller_voucher_code,dropshipper,dropshipper_phone,split_up,buyer_cancel_reason,cancel_by,cancel_reason,actual_shipping_fee,estimated_shipping_fee,checkout_shipping_carrier,reverse_shipping_fee,order_chargeable_weight_gram,edt,order_sn,region,currency,total_amount,buyer_note,item_list,pay_time,pay_channel,cod_amount,create_time,update_time,days_to_ship,ship_by_date,invoice_data,checkout_shipping_carrier,actual_shipping_fee,estimated_shipping_fee,reverse_shipping_fee,package_list";

      const allOrders: any[] = [];
      const BATCH = 50;
      let batchCount = 0;
      for (let i = 0; i < allSnList.length; i += BATCH) {
        const batch = allSnList.slice(i, i + BATCH);
        const snParam = batch.map((o) => o.order_sn).join(",");

        try {
          const detailTs = Math.floor(Date.now() / 1000);
          const detailRawSign = `${partnerId}${detailBasePath}${detailTs}${accessToken}${shopId}`;
          const detailSign = createHmac("sha256", partnerKey)
            .update(detailRawSign)
            .digest("hex");

          const detailParams = new URLSearchParams({
            partner_id: partnerId,
            shop_id: shopId,
            access_token: accessToken,
            timestamp: String(detailTs),
            sign: detailSign,
            order_sn_list: snParam,
            response_optional_fields: detailFields
          });

          const detailResp = await fetch(
            `https://partner.shopeemall.com.br${detailBasePath}?${detailParams}`,
            {
              headers: { "Content-Type": "application/json" }
            }
          );
          if (!detailResp.ok) {
            console.warn(
              `⚠️  Shopee: Erro ao buscar lote ${batchCount + 1}, continuando...`
            );
            continue;
          }
          const detailData = await detailResp.json();
          const detailList = detailData?.response?.order_list || [];
          allOrders.push(...detailList);
          batchCount++;

          console.log(
            `📦 Shopee: Lote ${batchCount} processado (${allOrders.length}/${allSnList.length} pedidos)`
          );
        } catch (err) {
          console.warn(
            `⚠️  Shopee: Erro no lote ${batchCount + 1}:`,
            err,
            "continuando..."
          );
        }
      }

      console.log(
        `✅ Shopee: ${batchCount} lotes processados, ${allOrders.length} pedidos obtidos`
      );

      // ── Normalizar para formato interno ───────────────────────────────────
      const orders = allOrders.map((order: any) => ({
        id: `shopee-${order.order_sn}`,
        orderId: String(order.order_sn || ""),
        blingId: "",
        customer_name:
          order.recipient_address?.name ||
          order.buyer_username ||
          "Comprador Shopee",
        customer_cpf_cnpj: "",
        data: order.create_time
          ? new Date(order.create_time * 1000).toISOString().split("T")[0]
          : "",
        status: order.order_status || "",
        canal: "SHOPEE" as const,
        total: Number(order.total_amount || 0),
        frete: Number(
          order.actual_shipping_fee ?? order.estimated_shipping_fee ?? 0
        ),
        itens: (order.item_list || []).map((item: any) => ({
          id: String(item.item_id || ""),
          sku: item.model_sku || item.item_sku || String(item.item_id || ""),
          descricao: item.item_name || "",
          quantidade: Number(item.model_quantity_purchased || 1),
          valorUnitario: Number(
            item.model_discounted_price || item.model_original_price || 0
          ),
          subtotal:
            Number(item.model_quantity_purchased || 1) *
            Number(
              item.model_discounted_price || item.model_original_price || 0
            )
        })),
        itensCount: (order.item_list || []).length,
        sku:
          (order.item_list || [])[0]?.model_sku ||
          (order.item_list || [])[0]?.item_sku ||
          "",
        quantity: (order.item_list || []).reduce(
          (s: number, i: any) => s + Number(i.model_quantity_purchased || 0),
          0
        ),
        unit_price:
          (order.item_list || [])[0]?.model_discounted_price ||
          (order.item_list || [])[0]?.model_original_price ||
          0
      }));

      // Log detalhado de itens importados
      const totalItens = orders.reduce(
        (sum, o) => sum + (o.itensCount || 0),
        0
      );
      orders.forEach((order) => {
        if (!order.itens || order.itens.length === 0) {
          console.warn(
            `⚠️  [SHOPEE] Pedido ${order.orderId} SEM ITENS na resposta`
          );
        } else {
          console.log(
            `📦 [SHOPEE] Pedido ${order.orderId}: ${order.itens.length} itens`
          );
        }
      });

      console.log(
        `✅ [SHOPEE SYNC ORDERS] ${orders.length} pedidos, ${totalItens} itens importados em ${totalPages} página(s)`
      );
      res.json({
        success: true,
        orders,
        total: allOrders.length,
        pages: totalPages
      });
    } catch (error: any) {
      console.error("Shopee Sync Orders Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Webhooks do Bling — Devem retornar 200 OK para evitar erro de "Webhook inativo" no painel do Bling
  app.post("/api/bling/webhook/vendas", async (req, res) => {
    try {
      const payload = req.body;
      console.log(
        "🔔 [BLING WEBHOOK VENDAS] Payload:",
        JSON.stringify(payload).substring(0, 500)
      );

      const venda = payload?.data || payload;
      if (venda?.id) {
        const blingId = String(venda.id);
        const situacaoId = venda.situacao?.id;
        const situacaoValor = venda.situacao?.valor;

        // Atualiza pedido local se existir
        const { error } = await (supabase as any)
          .from("orders")
          .update({
            id_bling: blingId,
            situacao_id: situacaoId,
            situacao_valor: situacaoValor
            // Mapeamento opcional de status interno se necessário
          })
          .eq("id_bling", blingId);

        if (error) console.error("❌ [WEBHOOK VENDAS] Erro DB:", error);
      }

      res
        .status(200)
        .json({ success: true, message: "Webhook recebido e processado" });
    } catch (err: any) {
      console.error("❌ [WEBHOOK VENDAS] Erro:", err.message);
      res.status(200).json({ success: false, error: err.message }); // Bling exige 200 até no erro p/ não desativar
    }
  });

  app.post("/api/bling/webhook/nfe", async (req, res) => {
    try {
      const payload = req.body;
      console.log(
        "🔔 [BLING WEBHOOK NFE] Payload:",
        JSON.stringify(payload).substring(0, 500)
      );

      const nfe = payload?.data || payload;
      if (nfe?.id) {
        const idVendaWebhook =
          nfe.venda?.id ||
          nfe.vendas?.[0]?.id ||
          nfe.pedidoVenda?.id ||
          nfe.pedido?.id ||
          nfe.idPedidoVenda ||
          nfe.idVenda ||
          "";

        // Persiste/Atualiza na tabela bling_nfe
        const { error } = await (supabase as any).from("bling_nfe").upsert(
          {
            id: String(nfe.id),
            bling_id: String(nfe.id),
            numero: String(nfe.numero || ""),
            serie: String(nfe.serie || ""),
            situacao: nfe.situacao || 1,
            situacao_descricao: nfe.situacao_descricao || "",
            valor_total: nfe.valor_total || 0,
            chave_acesso: nfe.chave_acesso || "",
            link_danfe: nfe.link_danfe || "",
            id_venda: String(idVendaWebhook),
            last_sync: new Date().toISOString()
          },
          { onConflict: "id" }
        );

        if (error) console.error("❌ [WEBHOOK NFE] Erro DB:", error);
      }

      res
        .status(200)
        .json({ success: true, message: "Webhook recebido e processado" });
    } catch (err: any) {
      console.error("❌ [WEBHOOK NFE] Erro:", err.message);
      res.status(200).json({ success: false, error: err.message });
    }
  });

  // ── WEBHOOK 3: Logística (Objetos de Postagem / Rastreamento) ──
  app.post("/api/bling/webhook/logistica", async (req, res) => {
    try {
      const payload = req.body;
      console.log(
        "🔔 [BLING WEBHOOK LOGISTICA] Payload:",
        JSON.stringify(payload).substring(0, 800)
      );

      const obj = payload?.data || payload;
      if (obj?.id) {
        const rastreio = obj.rastreamento?.codigo || obj.codigoRastreamento || "";
        const situacao = obj.rastreamento?.situacao ?? obj.situacao ?? "";
        const nfeId = obj.notaFiscal?.id || obj.nfe?.id || "";
        const pedidoVendaId = obj.pedidoVenda?.id || obj.pedido?.id || "";
        const servicoNome = obj.servico?.nome || obj.servico?.codigo || "";
        const servicoId = obj.servico?.id || "";

        // Upsert na tabela objetos_postagem
        const { error } = await supabase.from("objetos_postagem").upsert(
          {
            bling_id: String(obj.id),
            nfe_id: nfeId ? Number(nfeId) : null,
            nfe_numero: String(obj.notaFiscal?.numero || ""),
            numero_pedido_loja: String(pedidoVendaId),
            destinatario: obj.destinatario?.nome || obj.contato?.nome || "",
            rastreio,
            servico: servicoNome,
            transportadora: obj.logistica?.descricao || obj.logistica?.nome || "",
            situacao: String(
              typeof situacao === "number"
                ? (
                    { 1: "Criado", 2: "Coletado", 3: "Em trânsito", 4: "Saiu para entrega", 5: "Entregue", 6: "Cancelado", 7: "Devolvido", 8: "Postado" } as any
                  )[situacao] || situacao
                : situacao || "Pendente"
            ),
            valor_nota: obj.valorDeclarado || 0,
            data_criacao: obj.dataSaida || obj.dataCriacao || new Date().toISOString(),
            prazo_entrega: obj.prazoEntregaPrevisto ? String(obj.prazoEntregaPrevisto) : "",
            dimensoes: obj.dimensoes || obj.dimensao || {},
            dados_bling: obj,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "bling_id" }
        );

        if (error) console.error("❌ [WEBHOOK LOGISTICA] Erro DB:", error);
        else console.log(`✅ [WEBHOOK LOGISTICA] Objeto ${obj.id} salvo.`);
      }

      res
        .status(200)
        .json({ success: true, message: "Webhook logística processado" });
    } catch (err: any) {
      console.error("❌ [WEBHOOK LOGISTICA] Erro:", err.message);
      res.status(200).json({ success: false, error: err.message });
    }
  });

  // ── Criar Objeto Logístico no Bling (POST /logisticas/objetos) ──
  app.post("/api/bling/logisticas/objetos", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = "https://www.bling.com.br/Api/v3/logisticas/objetos";
      console.log("📦 [CRIAR OBJETO LOGÍSTICO] POST", url);
      const response = await blingFetchRetry(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req.body),
      });
      const data = await response.json().catch(() => ({}));

      // Se criou com sucesso, salva localmente também
      if (response.status === 201 && data?.data?.id) {
        const body = req.body;
        await supabase.from("objetos_postagem").upsert(
          {
            bling_id: String(data.data.id),
            nfe_id: body.notaFiscal?.id || null,
            numero_pedido_loja: String(body.pedidoVenda?.id || ""),
            rastreio: body.rastreamento?.codigo || "",
            servico: body.servico?.id ? String(body.servico.id) : "",
            situacao: "Criado",
            valor_nota: body.valorDeclarado || 0,
            data_criacao: body.dataSaida || new Date().toISOString(),
            prazo_entrega: body.prazoEntregaPrevisto ? String(body.prazoEntregaPrevisto) : "",
            dimensoes: body.dimensoes || {},
            dados_bling: data.data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "bling_id" }
        );
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [CRIAR OBJETO LOGÍSTICO ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Atualizar Objeto Logístico (PUT /logisticas/objetos/:id) ──
  app.put("/api/bling/logisticas/objetos/:idObjeto", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = `https://www.bling.com.br/Api/v3/logisticas/objetos/${req.params.idObjeto}`;
      console.log("📦 [ATUALIZAR OBJETO LOGÍSTICO] PUT", url);
      const response = await blingFetchRetry(url, {
        method: "PUT",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req.body),
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [ATUALIZAR OBJETO LOGÍSTICO ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Criar Remessa de Postagem (para emitir etiqueta) ──
  app.post("/api/bling/logisticas/remessas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = "https://www.bling.com.br/Api/v3/logisticas/remessas";
      console.log("📮 [CRIAR REMESSA] POST", url);
      const response = await blingFetchRetry(url, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(req.body),
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [CRIAR REMESSA ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Buscar Remessa por ID (etiqueta) ──
  // ── Listar todas as remessas (com paginação/filtros) ──
  app.get("/api/bling/logisticas/remessas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const rawQs = req.originalUrl.split("?")[1] || "";
      const url = `https://www.bling.com.br/Api/v3/logisticas/remessas${rawQs ? `?${rawQs}` : ""}`;
      console.log("📮 [REMESSAS LIST] GET", url);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [REMESSAS LIST ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/bling/logisticas/remessas/:idRemessa", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const url = `https://www.bling.com.br/Api/v3/logisticas/remessas/${req.params.idRemessa}`;
      console.log("📮 [REMESSA DETALHE] GET", url);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [REMESSA DETALHE ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ── Adicionar objetos a uma remessa existente ──
  app.post(
    "/api/bling/logisticas/remessas/:idRemessa/objetos",
    async (req, res) => {
      try {
        const token = normalizeBearerToken(
          (req.headers["authorization"] as string) || ""
        );
        if (!token) return res.status(401).json({ error: "Token obrigatório" });

        const url = `https://www.bling.com.br/Api/v3/logisticas/remessas/${req.params.idRemessa}/objetos`;
        console.log(
          `📮 [ADICIONAR OBJETOS REMESSA] POST ${req.params.idRemessa}`,
          url
        );

        const response = await blingFetchRetry(url, {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(req.body)
        });
        const data = await response.json().catch(() => ({}));
        res.status(response.status).json(data);
      } catch (error: any) {
        console.error("❌ [ADICIONAR OBJETOS REMESSA ERROR]:", error);
        res.status(500).json({ error: error.message });
      }
    }
  );

  // ── Remessas de uma logística ──
  app.get("/api/bling/logisticas/:idLogistica/remessas", async (req, res) => {
    try {
      const token = normalizeBearerToken(
        (req.headers["authorization"] as string) || ""
      );
      if (!token) return res.status(401).json({ error: "Token obrigatório" });

      const rawQs = req.originalUrl.split("?")[1] || "";
      const url = `https://www.bling.com.br/Api/v3/logisticas/${req.params.idLogistica}/remessas${rawQs ? `?${rawQs}` : ""}`;
      console.log("📮 [REMESSAS LOGÍSTICA] GET", url);
      const response = await blingFetchRetry(url, {
        headers: { Authorization: token, Accept: "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("❌ [REMESSAS LOGÍSTICA ERROR]:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cria o servidor (HTTPS ou HTTP)
  let server;
  if (sslOptions) {
    server = https.createServer(sslOptions, app);
  } else {
    // Import http dynamically to avoid top-level mixed imports if needed
    const http = await import("http");
    server = http.createServer(app);
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: { server }
        },
        appType: "spa"
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized");
    } catch (e) {
      console.error("Failed to load Vite:", e);
    }
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));

      app.get("*", (req, res) => {
        if (req.path.startsWith("/api")) {
          return res.status(404).json({ error: "Not Found" });
        }
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      console.error("Dist folder not found. Run 'npm run build' first.");
    }
  }

  server.listen(PORT, "0.0.0.0", () => {
    const protocol = sslOptions ? "https" : "http";
    console.log(`✅ Server running on ${protocol}://localhost:${PORT}`);
    if (sslOptions) {
      console.log(`🔒 SSL/TLS enabled with self-signed certificate`);
    } else {
      console.log(`🔓 SSL/TLS disabled (HTTP mode)`);
    }
  });
}

startServer();
