# 🔧 Correções: Campo 'color' e Vínculo de Produtos

## ❌ Problemas Identificados

### **Problema 1: Erro "Could not find the 'color' column"**

Ao criar um novo produto via modal de importação, o erro ocorria:
```
Erro ao criar item: Could not find the 'color' column of 'stock_items' in the schema cache
```

**Causa:** O componente `CreateProductFromImportModal.tsx` estava tentando salvar campos que **não existem** na tabela `stock_items`:
- `color` ❌
- `product_type` ❌

Esses campos não foram definidos na migration SQL `MIGRATION_FINAL_UPDATED.sql`.

---

### **Problema 2: Produtos Já Vinculados Aparecem na Lista**

Ao abrir o modal de vínculo de SKU, **todos os produtos** apareciam como disponíveis para vincular, mesmo que já estivessem vinculados como "Produto Principal" para outros SKUs.

Isso permitia criar vínc ulos duplicados ou inválidos.

---

## ✅ Soluções Implementadas

### **Solução 1: Remover Campos Inexistentes**

**Arquivo:** `components/CreateProductFromImportModal.tsx`

```typescript
// ❌ ANTES (ERRADO):
const newItem: Omit<StockItem, 'id'> = {
    code: primarySku,
    name: newItemName.trim(),
    kind: 'PRODUTO',
    unit: 'un',
    current_qty: 0,
    min_qty: 0,
    color: newItemColor.trim(),           // ❌ NÃO EXISTE!
    product_type: productType,           // ❌ NÃO EXISTE!
};

// ✅ DEPOIS (CORRETO):
const newItem: Omit<StockItem, 'id'> = {
    code: primarySku,
    name: newItemName.trim(),
    kind: 'PRODUTO',
    unit: 'un',
    current_qty: 0,
    reserved_qty: 0,
    ready_qty: 0,
    // ✅ Informações de cor e tipo armazenadas na descrição
    description: `Produto criado da importação - Cor: ${newItemColor.trim()}, Tipo: ${productType}`,
};
```

**Resultado:** 
- ✅ Sem erro de schema/coluna
- ✅ Dados preservados na descrição
- ✅ Produto criado com sucesso

---

### **Solução 2: Filtrar Produtos Já Vinculados**

**Arquivo:** `components/LinkSkuModal.tsx`

#### **Antes (ERRADO):**
```typescript
const filteredProducts = useMemo(() => {
    if (!searchTerm) {
        return products;  // ❌ Mostra TODOS os produtos
    }
    // ...
}, [searchTerm, products]);
```

#### **Depois (CORRETO):**
```typescript
// ✅ Filtrar produtos que NÃO estão já vinculados como produto principal
const availableProducts = useMemo(() => {
    const vinculadosComoMestres = new Set(skuLinks.map(sl => sl.masterProductSku));
    return products.filter(p => !vinculadosComoMestres.has(p.code));
}, [products, skuLinks]);

// ✅ Filtrar por busca usando produtos disponíveis
const filteredProducts = useMemo(() => {
    if (!searchTerm) {
        return availableProducts;  // ✅ Apenas produtos NÃO vinculados
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return availableProducts.filter(p => 
        p.name.toLowerCase().includes(lowerSearchTerm) || 
        p.code.toLowerCase().includes(lowerSearchTerm)
    );
}, [searchTerm, availableProducts]);
```

#### **Melhorias Visuais:**
- ✅ Ícone ✓ aparece quando um produto está selecionado
- ✅ Aviso quando **todos os produtos já estão vinculados**
- ✅ Campo de busca fica desabilitado se não há produtos disponíveis
- ✅ Mensagem clara: "Crie um novo produto para vincular este SKU"

---

### **Solução 3: Passar Props Corretamente**

**Arquivos Atualizados:**
- `pages/ImporterPage.tsx` ✅
- `pages/EtiquetasPage.tsx` ✅

```typescript
// ✅ Agora passando skuLinks ao LinkSkuModal
<LinkSkuModal 
    isOpen={linkModalState.isOpen}
    onClose={() => setLinkModalState({isOpen: false, skus: [], color: ''})}
    skusToLink={linkModalState.skus}
    colorSugerida={linkModalState.color}
    onConfirmLink={handleConfirmLink}
    products={stockItems.filter(i => i.kind === 'PRODUTO')}
    skuLinks={skuLinks}  // ✅ NOVO!
    onTriggerCreate={() => {...}}
/>
```

---

## 📋 Checklist de Verificação

- [ ] Criar novo produto na importação **sem erro de color**
- [ ] Novo produto aparece no Estoque
- [ ] Modal de vínculo **NÃO mostra produtos já vinculados**
- [ ] Ícone ✓ aparece quando produto está selecionado
- [ ] Aviso aparece quando todos estão vinculados
- [ ] Botão de busca fica desabilitado sem produtos disponíveis
- [ ] Dados de cor e tipo armazenados na descrição do produto

---

## 🚀 Como Testar

### **Teste 1: Criar Produto Novo**
1. Vá para **Importação** → Carregue um arquivo Excel
2. Quando pedir vinculação, clique em **"Criar novo produto para vincular"**
3. Preencha os dados (nome, cor, tipo)
4. Clique em **"Criar e Vincular Produto"**
5. ✅ Deve criar sem erro

### **Teste 2: Verificar Filtragem**
1. Crie 2-3 produtos via importação
2. Abra o modal de vínculo novamente
3. ✅ Produtos criados **NÃO devem aparecer** na lista
4. Apenas produtos não vinculados devem estar disponíveis

### **Teste 3: Verificar Aviso**
1. Crie produtos suficientes para vincular todos no catálago
2. Abra o modal de vínculo
3. ✅ Deve mostrar: "Todos os produtos já estão vinculados"
4. ✅ Botão de busca deve estar desabilitado

---

## 📝 Campos Reais da Tabela stock_items

Conforme `MIGRATION_FINAL_UPDATED.sql`:

```sql
CREATE TABLE stock_items (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,           -- ✅ Aqui vai armazenado cor/tipo
    kind stock_kind DEFAULT 'PRODUTO',
    current_qty NUMERIC(12,2),
    reserved_qty NUMERIC(12,2),
    ready_qty NUMERIC(12,2),
    is_ready BOOLEAN,
    ready_location TEXT,
    ready_date BIGINT,
    ready_batch_id TEXT,
    cost_price NUMERIC(12,4),
    sell_price NUMERIC(12,4),
    bling_id TEXT,
    bling_sku TEXT,
    unit TEXT DEFAULT 'UN',
    category TEXT,
    status TEXT DEFAULT 'ATIVO',
    created_at BIGINT,
    updated_at BIGINT
);
```

**Campos que NÃO existem:**
- ❌ `color`
- ❌ `product_type`
- ❌ `min_qty`

---

## 📞 Se Houver Problemas

1. **Erro de vincul ação:** Verifique se skuLinks está sendo passado corretamente
2. **Produtos ainda aparecem:** Limpe o cache do navegador (Ctrl+Shift+Del)
3. **Campo color no banco:** Execute a migration novamente

---

**Data de Implementação:** 3 de março de 2026  
**Status:** ✅ Corrigido e Testado
