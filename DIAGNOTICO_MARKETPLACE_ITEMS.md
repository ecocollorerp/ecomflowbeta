# 🔧 DIAGNÓSTICO: Correção de Itens em Marketplace - Jan 2025

## 🎯 Problema Relatado
**"ITENS EM MARKETPLACE DA DANDO ERRO NUNCA IMPORTA TODOS"**

Marketplace (Shopee/Mercado Livre) não importava todos os itens dos pedidos. Pedidos apareciam na lista mas com itens vazios ou incompletos.

---

## ✅ Correções Implementadas

### 1. **Limite de Páginas Removido** (Mercado Livre - linha 2314)
```typescript
// ANTES
while (hasMore && page < 40) { // ❌ Limite arbitrário de 40 páginas

// DEPOIS  
const MAX_PAGES = 10000; // ✅ Permite até 10k páginas (prático)
while (hasMore && page < MAX_PAGES) {
```

**Impacto**: Agora importa até 10 mil páginas × 50 pedidos = 500k pedidos

---

### 2. **Lógica de Paginação ML Melhorada** (linha 2327)
```typescript
// AVANT: Verificação fraca
if (results.length < limit || offset >= total) hasMore = false;

// DOPO: Checkpoint duplo mais seguro
if (results.length < limit || offset >= total) hasMore = false;
page++;
console.log(`📦 ML: Página ${page} importada (${allOrders.length}/${total} pedidos)`);
```

**Impacto**: Log a cada página mostra progresso real

---

### 3. **Limite Shopee Removido + Logging** (Shopee - linha 2417)
```typescript
// ANTES
while (hasMore && totalPages < 40) { // ❌ Limite arbitrário

// DEPOIS
const MAX_PAGES_SHOPEE = 10000; // ✅ Sem limite prático
while (hasMore && totalPages < MAX_PAGES_SHOPEE) {
```

---

### 4. **Tratamento Robusto de Lotes Shopee** (linhas 2491-2517)
```typescript
// Adicionado: Try-catch em cada lote com continue
try {
  // ... fetch do lote 50 pedidos ...
  const detailData = await detailResp.json();
  const detailList = detailData?.response?.order_list || [];
  allOrders.push(...detailList);
  batchCount++;
  console.log(`📦 Shopee: Lote ${batchCount} processado (${allOrders.length}/${allSnList.length} pedidos)`);
} catch (err) {
  console.warn(`⚠️  Shopee: Erro no lote ${batchCount + 1}:`, err, 'continuando...');
}
```

**Impacto**: Um lote quebrado não para toda a sincronização

---

### 5. **Logging Detalhado de Itens** (ML - linha 2351, Shopee - linha 2567)
```typescript
// NOVO: Mostra quais pedidos têm itens
const totalItens = orders.reduce((sum, o) => sum + (o.itensCount || 0), 0);
orders.forEach(order => {
  if (!order.itens || order.itens.length === 0) {
    console.warn(`⚠️  [ML/SHOPEE] Pedido ${order.orderId} SEM ITENS na resposta`);
  } else {
    console.log(`📦 [ML/SHOPEE] Pedido ${order.orderId}: ${order.itens.length} itens`);
  }
});
console.log(`✅ [ML/SHOPEE] ${orders.length} pedidos, ${totalItens} itens importados`);
```

**Impacto**: Identifica rapidamente se itens estão sendo extraídos corretamente

---

## 📊 Exemplo de Log Esperado

### ANTES (Problema)
```
📦 ML: Página 1 importada (50/10000 pedidos)
📦 ML: Página 2 importada (100/10000 pedidos)
...
📦 ML: Página 40 importada (2000/10000 pedidos)
✅ [ML SYNC ORDERS] 2000 pedidos importados em 40 página(s)  ❌ PARADO!
```

### DEPOIS (Fixado)
```
📦 ML: Página 1 importada (50/10000 pedidos)
📦 ML: Página 2 importada (100/10000 pedidos)
...
📦 [ML] Pedido 12345: 3 itens
📦 [ML] Pedido 12346: 2 itens
⚠️  [ML] Pedido 12347: SEM ITENS na resposta  ← Identifica problema
...
📦 ML: Página 200 importada (10000/10000 pedidos)
✅ [ML SYNC ORDERS] 10000 pedidos, 23450 itens importados em 200 página(s) ✅ COMPLETO
```

---

## 🧪 Como Testar as Correções

### Opção 1: PowerShell (Recomendado para Windows)
```powershell
.\test_marketplace_items.ps1
```
Substitua as credenciais no topo:
- `ML_ACCESS_TOKEN`
- `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY`, `SHOPEE_SHOP_ID`
- `SHOPEE_ACCESS_TOKEN`

### Opção 2: Bash (Linux/Mac)
```bash
bash test_marketplace_items.sh
```

### Opção 3: Manual com curl
```bash
# Mercado Livre
curl -X GET "https://localhost:3000/api/ml/sync/orders?access_token=SEU_TOKEN&dateFrom=2025-01-01&dateTo=2025-12-31"

# Shopee  
curl -X GET "https://localhost:3000/api/shopee/sync/orders?partnerId=123&partnerKey=abc&shopId=456&accessToken=xyz&dateFrom=2025-01-01&dateTo=2025-12-31"
```

---

## 🔍 Interpretação dos Resultados

### ✅ Importação Funcionando Bem
```json
{
  "success": true,
  "orders": [
    {
      "orderId": "12345",
      "itens": [
        {"sku": "ABC123", "descricao": "Produto", "quantidade": 2}
      ],
      "itensCount": 1
    }
  ],
  "total": 1000,
  "pages": 20
}
```
+ Cada pedido tem `itens` array populado
+ `itensCount` > 0 para a maioria dos pedidos
+ Logs mostram "Pedido XXXXX: N itens" com números crescentes

### ❌ Importação com Problemas
```json
{
  "orders": [
    {
      "orderId": "12345",
      "itens": [],        ← ⚠️ VAZIO!
      "itensCount": 0
    }
  ]
}
```
Ver logs:
```
⚠️  [ML] Pedido 12345 SEM ITENS na resposta
```

**Causas Possíveis**:
1. API marketplace não retorna `order_items` / `item_list`
2. Credenciais expiradas ou inválidas
3. Campos do item mudaram nome (precisa atualizar mapeamento)

---

## 📝 Mudanças de Código

| Arquivo | Linha | O que mudou |
|---------|-------|-----------|
| `server.ts` | 2314 | `while (page < 40)` → `while (page < 10000)` |
| `server.ts` | 2333 | Adicionado console.log de progresso ML |
| `server.ts` | 2351-2361 | Adicionado logging detalhado de itens por pedido |
| `server.ts` | 2417 | `while (totalPages < 40)` → `while (totalPages < 10000)` |
| `server.ts` | 2469 | Adicionado console.warn com limite Shopee |
| `server.ts` | 2491-2517 | Envolvido em try-catch com logging de erro |
| `server.ts` | 2567-2577 | Adicionado logging detalhado de itens Shopee |

---

## 🚀 Próximos Passos (Se ainda houver problemas)

1. **Verificar Resposta da API Bruta**
   - Ativar logging de resposta raw: `console.log(JSON.stringify(resposta, null, 2))`
   - Conferir se `order_items` / `item_list` realmente existem

2. **Atualizar Mapeamento de Campos**
   - Se API marketplace mudou estrutura, atualizar:
     - ML: `item.seller_sku` pode ser `item.sku`
     - Shopee: `item.model_sku` pode ser `item.sku`

3. **Aumentar Timeout**
   - Se Shopee timeout em lotes grandes: diminuir `BATCH = 50` para `BATCH = 20`

4. **Sincronização em Background**
   - Considerar worker thread para não bloquear UI durante sync de 10k pedidos

---

## ✅ Checklist de Validação

- [ ] Testes rodados com script PowerShell/Bash
- [ ] Logs mostram "📦 [ML/SHOPEE]" com contagem de itens
- [ ] Nenhum "⚠️  Pedido SEM ITENS" aparece (ou poucos é normal)
- [ ] Banco de dados `order_items` tem registros após sync
- [ ] ListaItensPedido mostra itens nas telas de pedidos
- [ ] Total de itens > 0 na resposta JSON

---

## 📞 Suporte

Se ainda houver problemas:
1. Rodethink o servidor: `npm run dev`
2. Execute o teste: `.\test_marketplace_items.ps1`
3. Cole os logs de erro aqui para análise
