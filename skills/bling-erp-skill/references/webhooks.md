# Webhooks — Bling API v3

## Configuração no Painel Bling

1. Acesse **Configurações → Aplicativos → Seu App → Webhooks**
2. Adicione URL: `https://seuapp.com/webhooks/bling`
3. Selecione os eventos desejados
4. Copie o **Webhook Secret** para sua variável de ambiente

## Validação de Assinatura HMAC

O Bling envia o header `X-Bling-Signature` com HMAC-SHA256 do body:

```python
import hmac
import hashlib

def verify_bling_signature(body: bytes, signature: str, secret: str) -> bool:
    """
    Valida que o webhook veio do Bling.
    SEMPRE validar antes de processar.
    """
    expected = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## Estrutura do Payload

```json
{
  "event": "pedido_venda:criado",
  "retries": 0,
  "data": {
    "id": 12345678,
    "numero": 42,
    ...
  }
}
```

## Todos os Eventos Disponíveis

### Pedidos de Venda
| Evento | Descrição |
|--------|-----------|
| `pedido_venda:criado` | Novo pedido criado |
| `pedido_venda:alterado` | Pedido modificado (status, itens) |
| `pedido_venda:excluido` | Pedido deletado |

### Notas Fiscais (NF-e / NFC-e)
| Evento | Descrição |
|--------|-----------|
| `nota_fiscal:emitida` | NF-e autorizada pela SEFAZ |
| `nota_fiscal:cancelada` | NF-e cancelada |
| `nota_fiscal:criada` | NF-e criada (pendente) |

### Financeiro
| Evento | Descrição |
|--------|-----------|
| `conta_receber:criada` | Nova conta a receber |
| `conta_receber:alterada` | Conta modificada |
| `conta_receber:excluida` | Conta excluída |
| `conta_receber:baixada` | Pagamento recebido (bordero criado) |
| `conta_pagar:criada` | Nova conta a pagar |
| `conta_pagar:alterada` | Conta modificada |
| `conta_pagar:baixada` | Pagamento efetuado |

### Produtos e Estoque
| Evento | Descrição |
|--------|-----------|
| `produto:criado` | Novo produto |
| `produto:alterado` | Produto modificado |
| `produto:excluido` | Produto deletado |
| `estoque:alterado` | Movimentação de estoque |

### Contatos
| Evento | Descrição |
|--------|-----------|
| `contato:criado` | Novo contato |
| `contato:alterado` | Contato modificado |
| `contato:excluido` | Contato deletado |

## Implementação do Handler

```python
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
import json

HANDLERS = {}

def webhook_handler(event: str):
    """Decorator para registrar handlers de evento"""
    def decorator(func):
        HANDLERS[event] = func
        return func
    return decorator

@app.post("/webhooks/bling")
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks
):
    body = await request.body()
    signature = request.headers.get("X-Bling-Signature", "")
    
    # Validação obrigatória
    if not verify_bling_signature(body, signature, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Assinatura inválida")
    
    payload = json.loads(body)
    event = payload.get("event")
    data  = payload.get("data", {})
    
    # Log para auditoria
    await db.execute(
        "INSERT INTO webhook_log (event, bling_id, payload, received_at) VALUES ($1, $2, $3, NOW())",
        event, data.get("id"), json.dumps(payload)
    )
    
    # Processar em background (não bloquear resposta)
    background_tasks.add_task(dispatch_event, event, data)
    
    return {"ok": True}  # Responder em < 3s

async def dispatch_event(event: str, data: dict):
    handler = HANDLERS.get(event)
    if handler:
        try:
            await handler(data)
        except Exception as e:
            logger.error(f"Erro no handler {event}: {e}")
            # Salvar para reprocessamento
            await db.execute(
                "INSERT INTO webhook_failed (event, data, error, created_at) VALUES ($1, $2, $3, NOW())",
                event, json.dumps(data), str(e)
            )
```

## Handlers por Evento

```python
@webhook_handler("pedido_venda:criado")
async def on_pedido_criado(data: dict):
    await upsert_pedido_venda(data)

@webhook_handler("pedido_venda:alterado")
async def on_pedido_alterado(data: dict):
    await upsert_pedido_venda(data)

@webhook_handler("nota_fiscal:emitida")
async def on_nota_emitida(data: dict):
    nota_id = await upsert_nota_fiscal(data)
    # Vincula ao pedido se existir relacionamento
    if pedido_bling_id := data.get("numeroPedidoLoja") or get_pedido_from_nota(data):
        await db.execute(
            "UPDATE pedidos_venda SET nota_fiscal_id = $1 WHERE bling_id = $2",
            nota_id, pedido_bling_id
        )

@webhook_handler("conta_receber:baixada")
async def on_conta_baixada(data: dict):
    await db.execute("""
        UPDATE contas_receber 
        SET situacao = 2, updated_at = NOW(), payload_raw = $2
        WHERE bling_id = $1
    """, data["id"], json.dumps(data))

@webhook_handler("estoque:alterado")
async def on_estoque_alterado(data: dict):
    produto_id = data.get("produto", {}).get("id")
    deposito_id = data.get("deposito", {}).get("id")
    saldo = data.get("saldoFisico") or data.get("quantidade")
    
    await db.execute("""
        INSERT INTO saldos_estoque (produto_bling_id, deposito_bling_id, saldo_fisico, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (produto_bling_id, deposito_bling_id) DO UPDATE SET
            saldo_fisico = EXCLUDED.saldo_fisico,
            updated_at   = NOW()
    """, produto_id, deposito_id, saldo)
```

## Tabela de Log de Webhooks

```sql
CREATE TABLE webhook_log (
  id          SERIAL PRIMARY KEY,
  event       VARCHAR(100) NOT NULL,
  bling_id    BIGINT,
  payload     JSONB,
  processed   BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_failed (
  id         SERIAL PRIMARY KEY,
  event      VARCHAR(100) NOT NULL,
  data       JSONB,
  error      TEXT,
  retries    SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  retry_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para reprocessamento
CREATE INDEX idx_webhook_failed_retry ON webhook_failed (retry_at) 
WHERE retries < 5;
```

## Reprocessamento de Falhas

```python
# Rodar a cada minuto via cron
async def retry_failed_webhooks():
    failed = await db.fetch("""
        SELECT * FROM webhook_failed
        WHERE retries < 5 AND retry_at <= NOW()
        ORDER BY retry_at
        LIMIT 50
    """)
    
    for row in failed:
        try:
            await dispatch_event(row["event"], row["data"])
            await db.execute(
                "DELETE FROM webhook_failed WHERE id = $1", row["id"]
            )
        except Exception as e:
            backoff = 2 ** row["retries"]  # 2, 4, 8, 16, 32 min
            await db.execute("""
                UPDATE webhook_failed 
                SET retries = retries + 1,
                    retry_at = NOW() + ($1 || ' minutes')::interval,
                    error = $2
                WHERE id = $3
            """, str(backoff), str(e), row["id"])
```

## Fallback: Polling para Eventos Perdidos

Mesmo com webhooks, implemente polling como safety net:

```python
# Cron a cada 5 minutos
async def fallback_polling(empresa_id: int):
    last_sync = await get_last_sync_time(empresa_id)
    
    # Buscar pedidos alterados desde última sync
    resp = await bling_get(
        f"/pedidos/vendas",
        params={
            "dataAlteracaoInicial": last_sync.strftime("%Y-%m-%d %H:%M:%S"),
            "dataAlteracaoFinal": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "limite": 100,
        },
        empresa_id=empresa_id
    )
    
    for pedido in resp.json().get("data", []):
        await upsert_pedido_venda(pedido)
    
    await update_last_sync_time(empresa_id)
```
