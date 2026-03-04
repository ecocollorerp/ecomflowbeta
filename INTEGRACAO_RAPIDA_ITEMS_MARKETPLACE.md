# 🔌 INTEGRAÇÃO RÁPIDA: Sincronizar Itens Marketplace

Este documento orienta como integrar a salvação de itens marketplace no fluxo existente.

---

## 📍 Ponto 1: Em IntegracoesPage.tsx (Após receber pedidos ML/Shopee)

### Arquivo: `pages/IntegracoesPage.tsx`

**Localização**: Após `handleMLSync()` ou `handleShopeeSync()`

```typescript
// LINE ~380: handleMLSync function
const handleMLSync = async () => {
    // ... código existente ...
    try {
        const result = await syncMLOrders(currentML, {
            startDate: mlStartDate,
            endDate: mlEndDate,
        });
        
        const orders = (result.orders || []).map(transformMLOrder);
        setMlOrders(orders);

        // ✨ NOVO: Salvar itens no banco após receber pedidos
        if (orders.length > 0) {
            await saveMarketplaceItemsToDb('ML', orders);
        }

        if (orders.length > 0) {
            await onLaunchSuccess(orders);
            addToast(`${orders.length} pedidos do Mercado Livre importados!`, 'success');
        }
    } catch (e: any) {
        addToast('Erro ao sincronizar ML: ' + e.message, 'error');
    } finally {
        setMlSyncing(false);
    }
};

// LINE ~420: handleShopeeSync function
const handleShopeeSync = async () => {
    // ... código existente ...
    try {
        const result = await syncShopeeOrders(currentShopee, {
            startDate: shopeeStartDate,
            endDate: shopeeEndDate,
        });
        
        const orders = (result.orders || []).map(transformShopeeOrder);
        setShopeeOrders(orders);

        // ✨ NOVO: Salvar itens no banco após receber pedidos
        if (orders.length > 0) {
            await saveMarketplaceItemsToDb('SHOPEE', orders);
        }

        if (orders.length > 0) {
            await onLaunchSuccess(orders);
            addToast(`${orders.length} pedidos da Shopee importados!`, 'success');
        }
    } catch (e: any) {
        addToast('Erro ao sincronizar Shopee: ' + e.message, 'error');
    } finally {
        setShopeeSyncing(false);
    }
};
```

### Adicionar função helper:
```typescript
// No topo de IntegracoesPage.tsx, após imports
import { syncMarketplaceItems } from '../services/syncMarketplaceItems';

// Nova função helper (pode ser dentro do componente ou separada)
const saveMarketplaceItemsToDb = async (
    canal: 'ML' | 'SHOPEE',
    orders: any[]
) => {
    try {
        console.log(`💾 Salvando itens de ${canal} no banco...`);
        
        let totalSalvos = 0;
        for (const order of orders) {
            if (!order.itens || order.itens.length === 0) {
                console.warn(`⚠️  Pedido ${order.orderId} sem itens, pulando...`);
                continue;
            }

            const itemsSalvos = await syncMarketplaceItems.salvarItens(
                order.orderId,
                canal,
                order.itens
            );

            totalSalvos += itemsSalvos?.length || 0;
        }

        console.log(`✅ ${totalSalvos} itens de ${canal} salvos no banco`);
    } catch (error) {
        console.error(`❌ Erro ao salvar itens de ${canal}:`, error);
        // Não lançar erro para não interromper sync
    }
};
```

---

## 📍 Ponto 2: No DANFEManagerPage.tsx (Ao exibir itens)

### Arquivo: `pages/DANFEManagerPage.tsx`

A seção que carrega itens de um pedido já existe. Adicione:

```typescript
// Próximo à função que carrega itens (procure por "handleSincronizarItens")

const handleCarregarItensMarketplace = async (orderId: string) => {
    try {
        const itens = await syncMarketplaceItems.buscarItens(orderId);
        
        if (itens.length > 0) {
            setItensPorPedido(prev => ({
                ...prev,
                [orderId]: itens
            }));
            console.log(`✅ ${itens.length} itens carregados do marketplace`);
        } else {
            console.log(`ℹ️  Nenhum item encontrado para pedido ${orderId}`);
        }
    } catch (error) {
        console.error('Erro ao carregar itens:', error);
    }
};
```

---

## 📍 Ponto 3: Verificar Tabela order_items

Garantir que sua tabela tem os campos corretos:

```sql
-- Verificar estrutura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'order_items'
ORDER BY ordinal_position;

-- Campos esperados:
-- order_id (TEXT/UUID)
-- item_id (TEXT)
-- sku (TEXT)
-- descricao (TEXT)
-- quantidade (NUMERIC)
-- valor_unitario (NUMERIC)
-- subtotal (NUMERIC)
-- status (TEXT)
-- canal (TEXT) - ← NOVO
-- sincronizado_em (TIMESTAMP)

-- Se faltarem campos, adicione:
ALTER TABLE order_items ADD COLUMN canal VARCHAR(50) DEFAULT 'BLING';
```

---

## 📍 Ponto 4: Testar Integração

### Terminal 1: Rodar servidor
```bash
npm run dev
```

### Terminal 2: Sincronizar ML/Shopee
```powershell
# Abra IntegracoesPage e clique em "Sincronizar" Mercado Livre ou Shopee
# Ou execute o teste:
.\test_marketplace_items.ps1
```

### Verificar Logs
Procure por:
```
💾 Salvando itens de ML no banco...
📥 Salvando 3 itens do ML para ordem order-123
✅ 3 itens do ML salvos para ordem order-123
```

### Verificar Banco
```sql
SELECT COUNT(*) FROM order_items WHERE canal = 'ML';
SELECT * FROM order_items WHERE order_id = 'order-123' LIMIT 5;
```

---

## 🎯 Fluxo Completo

```
┌─────────────────────┐
│ IntegracoesPage.tsx │
│   Sync ML/Shopee    │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────┐
│ /api/ml/sync/orders          │ ← Já melhorado
│ /api/shopee/sync/orders      │   (logging, sem limite)
└──────────┬───────────────────┘
           │ (retorna pedidos com itens)
           ▼
┌──────────────────────────────┐
│ saveMarketplaceItemsToDb()   │ ← NOVO
│ (salva itens localmente)     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ syncMarketplaceItems.salvos  │ ← NOVO serviço
│ (BD: order_items)            │
└──────────────────────────────┘
```

---

## ✅ Checklist de Implementação

- [ ] Verificar que `server.ts` tem melhorias (linhas 2314-2577)
- [ ] Arquivo `services/syncMarketplaceItems.ts` existe
- [ ] Imports adicionados em `IntegracoesPage.tsx`
- [ ] Função `saveMarketplaceItemsToDb()` adicionada
- [ ] Campo `canal` existe em tabela `order_items`
- [ ] Teste com `test_marketplace_items.ps1` passa
- [ ] Bdados via SQL mostra itens salvos
- [ ] Logs mostram "💾 Salvando itens de ML/SHOPEE"

---

## 🚨 Troubleshooting

### Problema: "syncMarketplaceItems is not defined"
**Solução**: Verificar import em cima do arquivo
```typescript
import { syncMarketplaceItems } from '../services/syncMarketplaceItems';
```

### Problema: BD error "column canal does not exist"
**Solução**: Rodar SQL
```sql
ALTER TABLE order_items ADD COLUMN canal VARCHAR(50);
```

### Problema: Itens não aparecem
**Solução**: 
1. Verificar logs "💾 Salvando itens" aparece
2. Rodar SQL: `SELECT * FROM order_items WHERE canal = 'ML'`
3. Se vazio, itens não foram salvos do marketplace

---

## 📝 Próximas Melhorias (Opcional)

1. **Auto-sync na carga**: Sincronizar automaticamente itens ao carregar DashboardPage
2. **UI Indicator**: Mostrar "itens carregados" badge na interface
3. **Retry Logic**: Tentar salvar novamente se BD falhar na primeira vez
4. **Notificação**: Avisas quando itens marketplace sincronizados

---

**Fim da integração rápida! 🚀**
