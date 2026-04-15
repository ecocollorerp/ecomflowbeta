# API Endpoints Críticos — Bling v3

Base URL: `https://api.bling.com.br/Api/v3`

## Cliente HTTP Padrão

```python
import httpx
from typing import Optional

BLING_BASE = "https://api.bling.com.br/Api/v3"

async def bling_get(
    path: str,
    empresa_id: int,
    params: Optional[dict] = None
) -> dict:
    token = await get_token_manager(empresa_id).get_valid_token()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{BLING_BASE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params
        )
        resp.raise_for_status()
        return resp.json()

async def bling_post(path: str, empresa_id: int, body: dict) -> dict:
    token = await get_token_manager(empresa_id).get_valid_token()
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{BLING_BASE}{path}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=body
        )
        resp.raise_for_status()
        return resp.json()
```

---

## Pedidos de Venda

### Listar pedidos (paginado)
```
GET /pedidos/vendas
Params: pagina, limite, idContato, idsSituacoes[], dataInicial, dataFinal,
        dataAlteracaoInicial, dataAlteracaoFinal, numero, idLoja, numerosLojas[]
```

```python
resp = await bling_get("/pedidos/vendas", empresa_id, params={
    "pagina": 1,
    "limite": 100,
    "dataAlteracaoInicial": "2024-01-01 00:00:00",
})
pedidos = resp["data"]
# Cada pedido tem: id, numero, numeroLoja, situacao{id,valor}, total, contato{id,nome}, loja{id}
```

### Buscar pedido por ID (completo)
```
GET /pedidos/vendas/{idPedidoVenda}
```
```python
resp = await bling_get(f"/pedidos/vendas/{bling_id}", empresa_id)
pedido = resp["data"]
# pedido["notaFiscal"]["id"] — ID da NF vinculada (se houver)
# pedido["itens"]           — lista de itens
# pedido["parcelas"]        — parcelas de pagamento
```

### Gerar NF-e a partir do pedido
```
POST /pedidos/vendas/{idPedidoVenda}/gerar-nfe
Response: {"idNotaFiscal": 12345678}
```

### Lançar contas do pedido
```
POST /pedidos/vendas/{idPedidoVenda}/lancar-contas
```

### Lançar estoque do pedido
```
POST /pedidos/vendas/{idPedidoVenda}/lancar-estoque
POST /pedidos/vendas/{idPedidoVenda}/lancar-estoque/{idDeposito}
```

### Alterar situação do pedido
```
PATCH /pedidos/vendas/{idPedidoVenda}/situacoes/{idSituacao}
```

---

## Notas Fiscais (NF-e)

### Listar NF-es
```
GET /nfe
Params: pagina, limite, situacao, tipo, dataEmissaoInicial, dataEmissaoFinal, numero, serie
```

### Buscar NF por ID
```
GET /nfe/{idNotaFiscal}
Response: data.chaveAcesso, data.xml, data.linkDanfe, data.linkPDF
```

### Obter documento (PDF ou XML) por chave de acesso
```
GET /nfe/documento/{chaveAcesso}?formato=pdf
GET /nfe/documento/{chaveAcesso}?formato=xml
Response: data[].nome, data[].conteudo (base64 gzip)
```

```python
import base64, gzip

async def download_danfe(chave_acesso: str, empresa_id: int) -> bytes:
    resp = await bling_get(
        f"/nfe/documento/{chave_acesso}",
        empresa_id,
        params={"formato": "pdf"}
    )
    conteudo_b64 = resp["data"][0]["conteudo"]
    compressed = base64.b64decode(conteudo_b64)
    return gzip.decompress(compressed)
```

### Enviar NF-e para SEFAZ
```
POST /nfe/{idNotaFiscal}/enviar?enviarEmail=false
Response: {"xml": "..."}
```

---

## Contas a Receber

### Listar contas
```
GET /contas/receber
Params: pagina, limite, situacoes[], tipoFiltroData, dataInicial, dataFinal,
        idContato, idPortador, idFormaPagamento, boletoGerado
```

### Buscar contas por origem (pedido ou NF)
```
GET /contas/receber/boletos?idOrigem={idVendaOuNF}
```
```python
# Busca todas as contas vinculadas a um pedido de venda
resp = await bling_get("/contas/receber/boletos", empresa_id, params={
    "idOrigem": bling_id_pedido,
    "situacoes[]": [1, 3]  # Em aberto + Parcialmente recebido
})
contas = resp.get("data", {}).get("contas", [])
```

### Baixar conta (registrar pagamento)
```
POST /contas/receber/{idContaReceber}/baixar
Body: {data, usarDataVencimento, portador{id}, categoria{id}, historico, valorRecebido}
```

---

## Contatos

### Buscar por CPF/CNPJ
```
GET /contatos?numeroDocumento=12345678901&criterio=1
```

### Buscar por nome/email
```
GET /contatos?pesquisa=joao@email.com&criterio=1
```

### Criar contato
```
POST /contatos
Body: {nome, tipo (J/F/E), numeroDocumento, email, telefone, situacao, endereco{...}}
```

---

## Produtos e Estoque

### Buscar produto por código SKU
```
GET /produtos?codigos[]=SKU001&codigos[]=SKU002
```

### Buscar saldo de estoque (múltiplos produtos)
```
GET /estoques/saldos?idsProdutos[]=123&idsProdutos[]=456
Response: data[].produto{id, codigo}, data[].saldoFisicoTotal, data[].saldoVirtualTotal
```

### Buscar saldo por depósito
```
GET /estoques/saldos/{idDeposito}?idsProdutos[]=123
```

### Registrar entrada/saída de estoque
```
POST /estoques
Body: {
  produto: {id},
  deposito: {id},
  operacao: "E" | "S" | "B",
  quantidade: 10,
  preco: 29.90,
  observacoes: "..."
}
```

---

## Empresa

### Dados básicos (CNPJ, razão social, email)
```
GET /empresas/me/dados-basicos
```

---

## Tratamento de Paginação

```python
async def fetch_all_pages(path: str, empresa_id: int, params: dict = {}) -> list:
    """Percorre todas as páginas de um endpoint paginado"""
    all_items = []
    pagina = 1
    
    while True:
        resp = await bling_get(path, empresa_id, params={
            **params,
            "pagina": pagina,
            "limite": 100
        })
        items = resp.get("data", [])
        
        if not items:
            break
        
        all_items.extend(items)
        
        # Se retornou menos que o limite, é a última página
        if len(items) < 100:
            break
        
        pagina += 1
        await asyncio.sleep(0.2)  # throttle gentil
    
    return all_items
```

---

## Códigos de Situação Importantes

### Pedido de Venda (situacao.valor)
```
0 = Em aberto
1 = Atendido
2 = Cancelado
3 = Em andamento
5 = Faturado parcialmente
6 = Atendido parcialmente
7 = Aguardando pagamento
8 = Pagamento confirmado
10 = Em digitação
```

### Nota Fiscal (situacao)
```
1 = Pendente
2 = Cancelada
3 = Aguardando recibo
4 = Rejeitada
5 = Autorizada (emitida com sucesso)
6 = Emitida DANFE
7 = Registrada (importada)
```

### Conta a Receber (situacao)
```
1 = Em aberto
2 = Recebido (pago)
3 = Parcialmente recebido
4 = Devolvido
5 = Cancelado
```
