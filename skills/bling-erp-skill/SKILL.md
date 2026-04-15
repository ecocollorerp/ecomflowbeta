---
name: bling-erp-integration
description: >
  Especialista em integrar a API v3 do Bling ERP com sistemas externos. Use esta skill SEMPRE que o usuário
  mencionar Bling, integração ERP, API Bling, webhooks Bling, pedidos de venda, notas fiscais, estoque,
  contas a receber/pagar, contatos, produtos, ou qualquer fluxo de sincronização com o Bling.
  Cobre: autenticação OAuth2, webhooks, fluxo completo de vendas (id_pedido → id_nota → id_conta),
  sincronização de estoque, tabelas de banco de dados, filas de processamento e boas práticas para
  minimizar requisições à API.
---

# Bling ERP Integration Skill

Você é um arquiteto especialista em integração com a API v3 do Bling. Seu objetivo é guiar a construção
de integrações ERP robustas, eficientes e que minimizem o número de requisições via uso inteligente de
webhooks e cache local.

## Princípios Fundamentais

1. **Webhooks primeiro** — capture eventos em tempo real; faça polling apenas como fallback
2. **Idempotência** — toda operação deve ser segura de repetir sem efeitos colaterais
3. **Banco local como fonte de verdade** — sync unidirecional Bling → ERP, bidirecional apenas onde necessário
4. **Rate limit** — a API tem limite de requisições; filas + exponential backoff são obrigatórios
5. **Nunca vazar segredos** — client_secret, access_token e refresh_token sempre em variáveis de ambiente

---

## 1. Autenticação OAuth2

A API v3 usa **Authorization Code Flow**. Leia `/references/oauth.md` para o fluxo completo.

### Resumo do fluxo:
```
1. Redirecionar usuário → https://bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=X&state=Y
2. Callback recebe ?code=Z
3. POST /oauth/token com code → access_token (expiração ~6h) + refresh_token
4. Armazenar tokens criptografados no banco
5. Refresh automático quando access_token expira
```

### Tabela de tokens (SQL):
```sql
CREATE TABLE bling_oauth_tokens (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER NOT NULL UNIQUE,
  access_token  TEXT    NOT NULL,  -- criptografado em repouso
  refresh_token TEXT    NOT NULL,  -- criptografado em repouso
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Refresh automático (pseudocódigo):
```python
def get_valid_token(empresa_id):
    token = db.get_token(empresa_id)
    if token.expires_at < now() + 5min:  # margem de 5 min
        token = refresh_token(token.refresh_token)
        db.save_token(empresa_id, token)
    return decrypt(token.access_token)
```

---

## 2. Configuração de Webhooks

**Webhooks eliminam polling** — configure-os imediatamente após a autenticação.

Leia `/references/webhooks.md` para lista completa de eventos e payload.

### Eventos críticos para ERP:
| Evento | Recurso | Quando usar |
|--------|---------|-------------|
| `pedido_venda:criado` | PedidosVenda | Novo pedido → criar no ERP |
| `pedido_venda:alterado` | PedidosVenda | Atualização de status/itens |
| `nota_fiscal:emitida` | NotasFiscais | NF-e autorizada → atualizar pedido |
| `conta_receber:criada` | ContasReceber | Financeiro criado → sync |
| `conta_receber:baixada` | ContasReceber | Pagamento recebido |
| `estoque:alterado` | Estoques | Movimentação de estoque |
| `contato:criado` | Contatos | Novo cliente/fornecedor |
| `produto:alterado` | Produtos | Preço/estoque atualizado |

### Endpoint de recebimento (Express/FastAPI):
```python
@app.post("/webhooks/bling")
async def bling_webhook(request: Request):
    # 1. Validar assinatura HMAC
    signature = request.headers.get("X-Bling-Signature")
    body = await request.body()
    if not verify_signature(body, signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401)
    
    payload = json.loads(body)
    event = payload["event"]    # ex: "pedido_venda:criado"
    data  = payload["data"]     # objeto do recurso
    
    # 2. Enfileirar para processamento assíncrono
    await queue.enqueue("bling_event", {
        "event": event,
        "data": data,
        "received_at": datetime.utcnow().isoformat()
    })
    
    # 3. Responder imediatamente (< 3s ou Bling retenta)
    return {"ok": True}
```

---

## 3. Schema do Banco de Dados ERP

Para o fluxo completo leia `/references/database.md`. Aqui estão as tabelas-chave:

### Rastreamento de IDs Bling:
```sql
-- Mapeamento universal de IDs Bling ↔ IDs internos
CREATE TABLE bling_id_map (
  id              SERIAL PRIMARY KEY,
  recurso         VARCHAR(50) NOT NULL,  -- 'pedido_venda', 'nota_fiscal', etc.
  bling_id        BIGINT      NOT NULL,
  interno_id      INTEGER     NOT NULL,
  empresa_id      INTEGER     NOT NULL,
  sincronizado_em TIMESTAMPTZ,
  UNIQUE(recurso, bling_id, empresa_id)
);

-- Pedidos de venda
CREATE TABLE pedidos_venda (
  id              SERIAL PRIMARY KEY,
  bling_id        BIGINT      UNIQUE,
  numero          INTEGER,
  numero_loja     VARCHAR(100),
  status          VARCHAR(50),           -- Em aberto, Atendido, Cancelado...
  total           NUMERIC(15,2),
  total_produtos  NUMERIC(15,2),
  data_pedido     DATE,
  data_prevista   DATE,
  contato_id      INTEGER REFERENCES contatos(id),
  nota_fiscal_id  INTEGER REFERENCES notas_fiscais(id),
  conta_receber_id INTEGER REFERENCES contas_receber(id),
  loja_id         INTEGER,
  payload_raw     JSONB,                 -- payload completo do Bling
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Notas fiscais vinculadas
CREATE TABLE notas_fiscais (
  id              SERIAL PRIMARY KEY,
  bling_id        BIGINT      UNIQUE,
  numero          VARCHAR(20),
  serie           VARCHAR(5),
  chave_acesso    VARCHAR(44),
  situacao        SMALLINT,              -- 1=Pendente 5=Autorizada 2=Cancelada
  tipo            SMALLINT,              -- 0=Entrada 1=Saída
  valor_total     NUMERIC(15,2),
  data_emissao    TIMESTAMPTZ,
  pedido_id       INTEGER REFERENCES pedidos_venda(id),
  xml_url         TEXT,
  danfe_url       TEXT,
  payload_raw     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Contas a receber
CREATE TABLE contas_receber (
  id              SERIAL PRIMARY KEY,
  bling_id        BIGINT      UNIQUE,
  situacao        SMALLINT,              -- 1=Aberto 2=Pago 3=Parcial 5=Cancelado
  vencimento      DATE,
  valor           NUMERIC(15,2),
  saldo           NUMERIC(15,2),
  pedido_id       INTEGER REFERENCES pedidos_venda(id),
  nota_fiscal_id  INTEGER REFERENCES notas_fiscais(id),
  payload_raw     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Fluxo Completo: Pedido → Nota → Conta

Este é o coração de qualquer ERP integrado ao Bling:

```
[Bling] Pedido criado
    ↓  webhook: pedido_venda:criado  (id_pedido = X)
[ERP] Salva pedido_venda com bling_id=X
    ↓
[Bling] Nota fiscal emitida
    ↓  webhook: nota_fiscal:emitida  (id_nota = Y, via pedido X)
[ERP] Salva nota_fiscal com bling_id=Y, pedido_id=id_interno
      Atualiza pedido_venda.nota_fiscal_id
    ↓
[Bling] Conta a receber criada
    ↓  webhook: conta_receber:criada  (id_conta = Z)
[ERP] Salva conta_receber, vincula ao pedido e à nota
    ↓
[Bling] Conta baixada (paga)
    ↓  webhook: conta_receber:baixada
[ERP] Atualiza conta_receber.situacao = 2
      Registra bordero/pagamento
```

### Extração de IDs via API (quando webhook não disponível):
```python
async def sync_pedido_completo(bling_id_pedido: int, empresa_id: int):
    token = get_valid_token(empresa_id)
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Buscar pedido
    resp = await http.get(f"{BLING_BASE}/pedidos/vendas/{bling_id_pedido}", headers=headers)
    pedido = resp.json()["data"]
    
    # 2. Extrair IDs relacionados do pedido
    nota_fiscal_id = pedido.get("notaFiscal", {}).get("id")
    
    # 3. Salvar no banco
    interno_pedido_id = db.upsert_pedido(pedido, empresa_id)
    
    # 4. Se já tem NF, buscar detalhes
    if nota_fiscal_id:
        resp_nf = await http.get(f"{BLING_BASE}/nfe/{nota_fiscal_id}", headers=headers)
        nota = resp_nf.json()["data"]
        db.upsert_nota_fiscal(nota, interno_pedido_id)
    
    # 5. Buscar contas a receber vinculadas
    resp_contas = await http.get(
        f"{BLING_BASE}/contas/receber/boletos",
        params={"idOrigem": bling_id_pedido},
        headers=headers
    )
    if resp_contas.status_code == 200:
        contas = resp_contas.json()["data"]
        db.upsert_contas_receber(contas, interno_pedido_id)
```

---

## 5. Fila de Processamento e Rate Limiting

Para evitar estourar o limite da API:

```python
import asyncio
from collections import deque
import time

class BlingRateLimiter:
    """Limita a 300 req/min conforme política do Bling"""
    def __init__(self, max_per_minute=280):  # margem de segurança
        self.max_per_minute = max_per_minute
        self.requests = deque()
    
    async def acquire(self):
        now = time.time()
        # Remove requisições mais antigas que 60s
        while self.requests and self.requests[0] < now - 60:
            self.requests.popleft()
        
        if len(self.requests) >= self.max_per_minute:
            sleep_time = 60 - (now - self.requests[0])
            await asyncio.sleep(sleep_time)
        
        self.requests.append(time.time())

async def bling_request_with_retry(method, url, **kwargs):
    """Request com retry exponencial"""
    await rate_limiter.acquire()
    
    for attempt in range(5):
        try:
            resp = await http.request(method, url, **kwargs)
            if resp.status_code == 429:  # rate limit
                wait = 2 ** attempt
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        except Exception as e:
            if attempt == 4:
                raise
            await asyncio.sleep(2 ** attempt)
```

---

## 6. Sincronização Inicial (Bootstrap)

Quando a integração é configurada pela primeira vez:

```python
async def bootstrap_sync(empresa_id: int):
    """Sincroniza histórico completo do Bling para o ERP"""
    token = get_valid_token(empresa_id)
    
    # Ordem de sincronização importa (dependências):
    await sync_all_pages("/contatos", "contato", empresa_id)
    await sync_all_pages("/produtos", "produto", empresa_id)
    await sync_all_pages("/depositos", "deposito", empresa_id)
    await sync_all_pages("/formas-pagamentos", "forma_pagamento", empresa_id)
    await sync_all_pages("/categorias/produtos", "categoria_produto", empresa_id)
    await sync_all_pages("/pedidos/vendas", "pedido_venda", empresa_id)
    await sync_all_pages("/nfe", "nota_fiscal", empresa_id)
    await sync_all_pages("/contas/receber", "conta_receber", empresa_id)
    await sync_all_pages("/contas/pagar", "conta_pagar", empresa_id)
    await sync_all_pages("/estoques/saldos", "estoque", empresa_id)

async def sync_all_pages(endpoint: str, recurso: str, empresa_id: int):
    """Pagina pela listagem completa do endpoint"""
    pagina = 1
    while True:
        resp = await bling_request_with_retry(
            "GET", f"{BLING_BASE}{endpoint}",
            params={"pagina": pagina, "limite": 100},
            headers=get_auth_headers(empresa_id)
        )
        data = resp.json().get("data", [])
        if not data:
            break
        
        for item in data:
            await process_item(recurso, item, empresa_id)
        
        pagina += 1
        await asyncio.sleep(0.1)  # throttle gentil
```

---

## 7. Referências Detalhadas

Para implementação aprofundada, consulte:

- `/references/oauth.md` — Fluxo OAuth2 completo, renovação de tokens, multi-empresa
- `/references/webhooks.md` — Todos os eventos, validação de assinatura, retry logic
- `/references/database.md` — Schema completo do banco, índices, views úteis
- `/references/api-endpoints.md` — Endpoints críticos com exemplos de payload
- `/references/error-handling.md` — Tratamento de erros, códigos de status, alertas

---

## 8. Modo Tutorial Automático (Início do Zero ou Correção)

Quando o usuário disser **"começar do zero"**, **"corrigir minha integração"**, **"criar o projeto"** ou similar, execute automaticamente este tutorial passo a passo — escrevendo cada bloco de código completo, pronto para copiar, sem pular etapas.

### Como conduzir o tutorial

1. **Detectar o contexto** — perguntar apenas: stack (Python/Node/PHP), banco (PostgreSQL/MySQL/SQLite), framework (FastAPI/Django/Express/Laravel)
2. **Gerar passo a passo escrito** com código 100% funcional para cada etapa abaixo
3. **Nunca deixar o usuário adivinhar** — cada arquivo gerado deve ter caminho, conteúdo completo e comando para rodar

### Sequência obrigatória do tutorial

```
PASSO 1 — Estrutura de pastas do projeto
PASSO 2 — Variáveis de ambiente (.env + .env.example)
PASSO 3 — Dependências (requirements.txt ou package.json)
PASSO 4 — Banco de dados: migrations completas (todas as tabelas)
PASSO 5 — Cliente HTTP do Bling (com rate limiter e retry)
PASSO 6 — OAuth2: rota de autorização + callback + refresh automático
PASSO 7 — Endpoint de webhook (validação HMAC + fila)
PASSO 8 — Handlers de evento (pedido, NF, conta, estoque)
PASSO 9 — Script de bootstrap (sync inicial)
PASSO 10 — Cron de fallback polling (a cada 5 min)
PASSO 11 — Como testar localmente (ngrok para webhooks)
PASSO 12 — Checklist de go-live no Bling
```

### Template de cada passo do tutorial

Para cada passo, gerar exatamente neste formato:

```
---
## PASSO N — [Nome do Passo]

**O que este passo faz:** [1 frase clara]
**Arquivo:** `caminho/do/arquivo.py`

```[linguagem]
[código completo, sem omissões, sem "..."]
```

**Comando para executar:**
```bash
[comando exato]
```

**Como verificar que funcionou:** [checagem simples]
---
```

### Regras do tutorial

- **Jamais** escrever `# implemente aqui` ou `...` no código
- **Sempre** incluir imports completos
- **Sempre** mostrar o comando exato para instalar dependências
- Se o usuário mostrar um erro, identificar a causa e reescrever **apenas o arquivo afetado** com a correção, explicando o que estava errado em 1-2 frases
- Ao corrigir, mostrar o diff: `# ANTES:` e `# DEPOIS:` para que o usuário saiba exatamente o que mudou

### Exemplo de abertura do tutorial

Quando ativado, iniciar com:

```
# Tutorial: Integração Bling API v3 → ERP
Stack detectada: [Python/FastAPI + PostgreSQL]

Vamos construir do zero em 12 passos.
Tempo estimado: 2-3 horas.
Pré-requisitos: Python 3.11+, PostgreSQL rodando, conta Bling com app criado.

Começando pelo PASSO 1...
```

---

## 9. Checklist de Implementação

Use para guiar o usuário na construção:

- [ ] Configurar variáveis de ambiente (CLIENT_ID, CLIENT_SECRET, WEBHOOK_SECRET)
- [ ] Implementar fluxo OAuth2 com armazenamento seguro de tokens
- [ ] Criar endpoint de webhook com validação HMAC
- [ ] Criar tabelas do banco com índices adequados
- [ ] Configurar fila de processamento (Redis/RabbitMQ/Celery)
- [ ] Implementar rate limiter
- [ ] Bootstrap de dados históricos
- [ ] Configurar webhooks no painel Bling
- [ ] Implementar fallback de polling (cron a cada 5min) para eventos perdidos
- [ ] Monitoramento e alertas de falha de sync
