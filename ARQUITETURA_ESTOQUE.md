# 📊 ARQUITETURA COMPLETA DO SISTEMA DE ESTOQUE

## 1️⃣ ESTRUTURA DE TABELAS

### **PRODUCT_BOMS** (PRODUTOS FINAIS - Tabela Principal)
```
product_boms {
  id: "prod_..."        ← ID único
  code: "SKU001"        ← Código único do produto (apareça no app)
  name: "Produto Final" ← Nome do produto
  kind: "PRODUTO"       ← Tipo (PRODUTO, PROCESSADO)
  current_qty: 100      ← Quantidade em estoque
  reserved_qty: 10      ← Quantidade reservada
  ready_qty: 50         ← Quantidade pronta
  bom_composition: {    ← Composição (quais insumos)
    items: [
      { code: "MAT001", qty: 2 },
      { code: "MAT002", qty: 5 }
    ]
  }
  bling_id: "123"       ← ID no Bling
  bling_sku: "SKU-BLING"
  category: "PAPEL"
  created_at: timestamp
}
```

### **STOCK_ITEMS** (INSUMOS/MATÉRIAS-PRIMAS)
```
stock_items {
  id: "mat_..."         ← ID único
  code: "MAT001"        ← Código único
  name: "Papel Branco"  ← Nome do insumo
  kind: "INSUMO"        ← Apenas INSUMO ou PROCESSADO
  current_qty: 1000     ← Quantidade
  reserved_qty: 100
  unit: "kg"            ← Unidade de medida
  category: "MATERIA_PRIMA"
  created_at: timestamp
}
```

### **SKU_LINKS** (Vinculação entre Importado e Principal)
```
sku_links {
  id: "sku_..."              ← ID único
  imported_sku: "ML123456"   ← SKU vindo do import/Bling
  master_product_sku: "SKU001" ← SKU principal em product_boms
  created_at: timestamp
}
```

---

## 2️⃣ FLUXOS DE OPERAÇÃO

### **FLUXO A: Criar Novo Produto (product_boms)**
```
1. Usuário cria produto na aba Estoque
   Input: { code: "SKU001", name: "Produto", category: "..." }
   
2. INSERT em product_boms
   dbClient.from('product_boms').insert({
     id: generateId(),
     code, name, kind: 'PRODUTO',
     current_qty: 0, reserved_qty: 0, ready_qty: 0,
     created_at, updated_at
   })

3. ✅ Produto aparece na listagem (setStockItems)
   - App mapeia product_boms → StockItem (que é o tipo interno)
```

### **FLUXO B: Adicionar Insumo (stock_items)**
```
1. Usuário cria matéria-prima (em outra seção ou import)
   Input: { code: "MAT001", name: "Papel", kind: "INSUMO" }
   
2. INSERT em stock_items
   dbClient.from('stock_items').insert({
     id: generateId(),
     code, name, kind: 'INSUMO',
     current_qty: 100, unit: 'kg',
     created_at, updated_at
   })

3. ✅ Matéria-prima fica em stock_items
   - Não aparece em product_boms
   - Usada em BOMs de produtos
```

### **FLUXO C: Vincular SKU ao Produto (sku_links)**
```
1. Import traz SKU do Bling: "ML-12345-ABCDE"
   
2. Usuário escolhe qual produto usar (ou auto-matches)
   master_product_sku = "SKU001"
   
3. INSERT em sku_links
   { imported_sku: "ML-12345-ABCDE", master_product_sku: "SKU001" }
   
4. ✅ Quando order chegar com "ML-12345-ABCDE"
   - Busca em sku_links
   - Encontra "SKU001"
   - Deduz estoque de product_boms (SKU001)
```

### **FLUXO D: Definir Composição do Produto (BOM)**
```
1. Produto criado: "SKU001"
   
2. Usuário define: "SKU001 é feito de:"
   - 2kg de MAT001 (Papel Branco)
   - 5 unidades de MAT002 (Tinta)
   
3. UPDATE em product_boms.bom_composition
   bom_composition = {
     items: [
       { code: "MAT001", qty: 2 },
       { code: "MAT002", qty: 5 }
     ]
   }
   
4. ✅ Quando deuzir "SKU001", também deduz seus insumos:
   - MAT001 -= 2
   - MAT002 -= 5
```

---

## 3️⃣ RELACIONAMENTOS

```
┌──────────────────┐
│  IMPORT / BLING  │
│  (ML-12345)      │
└────────┬─────────┘
         │
         │ sku_links
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│  PRODUCT_BOMS    │◄────────┤  STOCK_ITEMS     │
│  (SKU001)        │  BOM    │  (MAT001, ..)    │
│  - current_qty   │ Compost │  - raw materials │
│  - bom_comp      │         │  - insumos       │
└──────────────────┘         └──────────────────┘
         │
         │ deduction
         │
         ▼
  Order fulfillment
  & movimento automático
```

---

## 4️⃣ OPERAÇÕES NA ABA ESTOQUE

### **Criar Produto** ➕
- Tab: "EstoquePage" → "Adicionar Produto"
- Save em: `product_boms`
- Aparece em: `setStockItems` (mapeado)

### **Editar Produto** ✏️
- Update em: `product_boms`
- Campos: `name`, `description`, `category`, `current_qty`, `reserved_qty`, `ready_qty`

### **Deletar Produto** 🗑️
- Delete em: `product_boms`
- Cascata: Apaga `sku_links` relacionados

### **Compor Produto (BOM)** 🧪
- Update em: `product_boms.bom_composition`
- Seleciona insumos de: `stock_items`
- Define quantidades

### **Transferir Estoque** ↔️
- De `product_boms` para `stock_items` (quando usa insumo)
- De `stock_items` para `product_boms` (quando produz)
- INSERT em: `stock_movements` + trigger automático

---

## 5️⃣ QUERIES PRINCIPAIS

### **Listar Produtos Finais**
```sql
SELECT * FROM product_boms ORDER BY name
-- Resultado → setStockItems (app)
```

### **Listar Insumos**
```sql
SELECT * FROM stock_items WHERE kind = 'INSUMO' ORDER BY name
-- Usado para BOMs e relatórios
```

### **Encontrar Produto por SKU Importado**
```sql
SELECT pbom.* 
FROM product_boms pbom
JOIN sku_links sl ON pbom.code = sl.master_product_sku
WHERE sl.imported_sku = 'ML-12345'
```

### **Listar Movimentos de um Produto**
```sql
SELECT * FROM stock_movements 
WHERE product_bom_id = 'prod_...' 
ORDER BY created_at DESC
```

---

## 6️⃣ INTERAÇÕES AUTOMÁTICAS

| Ação | Origem | Destino | Automático? |
|------|--------|---------|------------|
| Criar produto | UI | product_boms | ✅ |
| Criar insumo | UI/Import | stock_items | ✅ |
| Vincular SKU | UI | sku_links | ✅ |
| Deuzir: order chega | order_items | product_boms.current_qty | ✅ Trigger |
| Deuzir: insumos do BOM | product_boms | stock_items | ✅ Se BOM definido |
| Ajuste manual | UI | product_boms | ✅ |
| Pesagem | PesagemPage | stock_items | ✅ RPC |
| Moagem | MoagemPage | stock_items | ✅ RPC |

---

## 7️⃣ ESTADO DO APP (types.ts)

```typescript
// O que app carrega:
const [stockItems, setStockItems] = useState<StockItem[]>([])
  // Vem de product_boms (MAPEADO)
  // É o que aparece na EstoquePage

const [skuLinks, setSkuLinks] = useState<SkuLink[]>([])
  // Vem de sku_links direto
  
const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  // Vem de stock_movements direto
  // Mostra histórico

// Não carrega diretamente, mas pode buscar:
const rawMaterials = stockItems.filter(s => s.kind === 'INSUMO')
  // Para exibir em BOMs
```

---

## 8️⃣ PRÓXIMAS AÇÕES

✅ SQL: Já preparado
⏳ TypeScript: App.tsx precisa de ajustes
⏳ UI: EstoquePage pode precisar de nova seção para insumos
⏳ Lógica: BOM composition e deduções automáticas
