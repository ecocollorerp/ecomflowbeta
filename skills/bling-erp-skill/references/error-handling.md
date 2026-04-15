# Tratamento de Erros — Bling API v3

## Códigos HTTP e o que fazer

| Status | Tipo | Ação |
|--------|------|------|
| 200 / 201 / 204 | Sucesso | Processar normalmente |
| 400 | Validação | Logar erro, não retentar sem corrigir |
| 401 | Não autenticado | Refresh do token, retentar uma vez |
| 403 | Sem permissão | Verificar escopos OAuth |
| 404 | Não encontrado | Registrar ausência, não retentar |
| 429 | Rate limit | Aguardar, retentar com exponential backoff |
| 500+ | Erro servidor | Retentar com backoff |

## Estrutura de Erro do Bling

```json
{
  "error": {
    "type": "VALIDATION_ERROR",
    "message": "Não foi possível salvar a venda",
    "description": "A venda não pode ser salva...",
    "fields": [
      {
        "code": 49,
        "msg": "Id da forma de pagamento inválido",
        "element": "formaPagamento",
        "namespace": "VENDAS"
      }
    ]
  }
}
```

## Cliente com Tratamento Completo

```python
import httpx
import asyncio
import logging
from datetime import datetime

logger = logging.getLogger("bling")

class BlingAPIError(Exception):
    def __init__(self, status_code: int, error_body: dict):
        self.status_code = status_code
        self.error_type = error_body.get("error", {}).get("type", "UNKNOWN")
        self.message = error_body.get("error", {}).get("message", "Erro desconhecido")
        self.fields = error_body.get("error", {}).get("fields", [])
        super().__init__(f"[{status_code}] {self.error_type}: {self.message}")

class BlingClient:
    MAX_RETRIES = 5
    RETRYABLE_STATUS = {429, 500, 502, 503, 504}
    
    def __init__(self, token_manager):
        self.token_manager = token_manager
    
    async def request(self, method: str, path: str, **kwargs) -> dict:
        url = f"https://api.bling.com.br/Api/v3{path}"
        
        for attempt in range(self.MAX_RETRIES):
            try:
                headers = await self.token_manager.get_headers()
                if "headers" in kwargs:
                    headers.update(kwargs.pop("headers"))
                
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.request(
                        method, url, headers=headers, **kwargs
                    )
                
                # Token expirado — refresh e retry
                if resp.status_code == 401:
                    await self.token_manager.force_refresh()
                    continue
                
                # Rate limit — aguardar conforme header Retry-After
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 2 ** attempt))
                    logger.warning(f"Rate limit atingido. Aguardando {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue
                
                # Erros do servidor — backoff exponencial
                if resp.status_code in {500, 502, 503, 504}:
                    wait = 2 ** attempt
                    logger.warning(f"Erro {resp.status_code}. Retry em {wait}s")
                    await asyncio.sleep(wait)
                    continue
                
                # Erro de negócio — não retentar
                if not resp.is_success:
                    try:
                        error_body = resp.json()
                    except Exception:
                        error_body = {}
                    
                    # Logar detalhes do erro
                    logger.error(
                        "Erro Bling API",
                        extra={
                            "method": method,
                            "path": path,
                            "status": resp.status_code,
                            "error": error_body
                        }
                    )
                    raise BlingAPIError(resp.status_code, error_body)
                
                # Sucesso (204 No Content retorna None)
                if resp.status_code == 204:
                    return {}
                
                return resp.json()
            
            except httpx.TimeoutException:
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
                raise
        
        raise Exception(f"Máximo de retries atingido para {method} {path}")
    
    async def get(self, path: str, params: dict = None) -> dict:
        return await self.request("GET", path, params=params)
    
    async def post(self, path: str, json: dict = None) -> dict:
        return await self.request("POST", path, json=json)
    
    async def put(self, path: str, json: dict = None) -> dict:
        return await self.request("PUT", path, json=json)
    
    async def delete(self, path: str) -> dict:
        return await self.request("DELETE", path)
```

## Alertas e Monitoramento

```python
async def check_sync_health():
    """Verifica se alguma empresa está com sync atrasado"""
    stale = await db.fetch("""
        SELECT empresa_id, recurso, last_sync_at
        FROM sync_status
        WHERE last_sync_at < NOW() - INTERVAL '30 minutes'
          AND status = 'idle'
    """)
    
    for row in stale:
        logger.error(
            f"Sync atrasado: empresa={row['empresa_id']} "
            f"recurso={row['recurso']} "
            f"ultima_sync={row['last_sync_at']}"
        )
        # Enviar alerta (Slack, email, etc.)
        await send_alert(f"⚠️ Sync Bling parado para empresa {row['empresa_id']}")

async def check_webhook_failures():
    """Verifica webhooks com muitas falhas"""
    critical = await db.fetch("""
        SELECT event, COUNT(*) as total, MAX(created_at) as ultimo
        FROM webhook_failed
        WHERE retries >= 5
        GROUP BY event
        HAVING COUNT(*) > 10
    """)
    
    for row in critical:
        await send_alert(
            f"🚨 {row['total']} webhooks com falha permanente: {row['event']}"
        )
```

## Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `INVALID_APIKEY_ERROR` | Token inválido/expirado | Refresh automático do token |
| `RESOURCE_NOT_FOUND` | ID não existe no Bling | Marcar como deletado localmente |
| `VALIDATION_ERROR` no pedido | Produto sem NCM, contato sem CPF/CNPJ | Validar dados antes de enviar |
| `TOO_MANY_REQUESTS` | Rate limit excedido | Implementar fila com rate limiter |
| Timeout na emissão de NF | SEFAZ instável | Retry com backoff, checar situação depois |

## Estratégia para Operações Longas (NF-e)

A emissão de NF-e pode demorar até 30s. Use polling:

```python
async def emitir_nfe_com_polling(bling_id_nfe: int, empresa_id: int) -> dict:
    """Emite NF e aguarda autorização"""
    # 1. Enviar para SEFAZ
    await bling_client.post(f"/nfe/{bling_id_nfe}/enviar")
    
    # 2. Polling até autorizar ou falhar (máx 2min)
    for _ in range(12):
        await asyncio.sleep(10)
        resp = await bling_client.get(f"/nfe/{bling_id_nfe}")
        nota = resp["data"]
        situacao = nota["situacao"]
        
        if situacao == 5:    # Autorizada
            return nota
        if situacao in {2, 4, 9}:  # Cancelada, Rejeitada, Denegada
            raise Exception(f"NF não autorizada. Situação: {situacao}")
    
    raise TimeoutError("Timeout aguardando autorização da NF-e")
```
