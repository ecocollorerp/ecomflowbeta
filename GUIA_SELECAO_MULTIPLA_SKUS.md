## 🔗 SELEÇÃO MÚLTIPLA DE SKUs NA IMPORTAÇÃO

**Funcionalidade Nova:** Selecione múltiplos produtos importados e vincule todos a um produto final de uma vez!

---

## 🎯 Como Funciona

### Cenário 1: Vincular a um Produto Existente

```
1. Importe arquivo XML/JSON com múltiplos SKUs
2. Sistema abre modal "Vincular SKUs em Massa"
3. Selecione os SKUs que deseja vincular
4. Escolha um produto final da lista
5. Clique "Vincular X SKU(s)"
6. ✅ Todos os SKUs agora apontam para o mesmo produto!
```

### Cenário 2: Criar Novo Produto e Vincular

```
1. Importe arquivo XML/JSON com múltiplos SKUs
2. Sistema abre modal "Vincular SKUs em Massa"
3. Selecione os SKUs que deseja vincular
4. Clique "Ou criar novo produto"
5. Preencha:
   - Nome do produto: "Cartaz A3 Importado"
   - Código do produto: "PROD-IMPORT-001"
6. Clique "Vincular X SKU(s)"
7. ✅ Novo produto criado + SKUs vinculados!
```

---

## 📑 Fluxo Detalhado

```
┌─────────────────────────────────┐
│ 1. ImporterPage                 │
│    Usuário seleciona arquivo    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ 2. Import Modal processados     │
│    XML/JSON analisado           │
│    Resultado: 15 SKUs           │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ 3. BulkLinkSKUsModal                        │
│    ├─ Mostra 15 SKUs importados             │
│    ├─ Usuário seleciona: 10 SKUs            │
│    ├─ Escolhe produto: "Cartaz A3"          │
│    └─ Clica "Vincular 10 SKU(s)"            │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ 4. handleBulkLinkSKUsToExisting ou          │
│    handleBulkLinkSKUsCreateNew              │
│                                             │
│    INSERT INTO sku_links:                   │
│    - ML-111... → prod_id_cartaz             │
│    - ML-222... → prod_id_cartaz             │
│    - ...                                    │
│    - ML-999... → prod_id_cartaz             │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│ 5. ✅ Toast: "10 SKU(s) vinculado(s)"       │
│    6. Modal fecha                           │
│    7. App recarrega dados                   │
│    8. Produto agora tem 10 SKUs!            │
└─────────────────────────────────────────────┘
```

---

## 🎮 Interface do Modal

### Seção Superior: Seleção
```
┌──────────────────────────────────────┐
│ Produtos Importados (10/15)          │
│ [Selecionar Tudo] [Desselecionar]    │
├──────────────────────────────────────┤
│ ☑ ML-12345678901                     │
│   Cartaz A3 Importado                │
│   R$ 25.50                           │ ✓
│                                      │
│ ☑ ML-87654321098                     │
│   Folder A4 Dobrado                  │
│   R$ 15.75                           │ ✓
│                                      │
│ ☐ ML-11111111111                     │
│   Banner Lona 2x3m                   │
│   R$ 85.00                           │
│                                      │
│ ... mais 7 SKUs                      │
└──────────────────────────────────────┘
```

### Seção Meio: Vincular Produto
```
┌──────────────────────────────────────┐
│ Vincular a Produto                   │
├──────────────────────────────────────┤
│ [Selecione um produto existente ▼]   │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ • Cartaz A3 (PROD-001)           │ │
│ │ • Folder A4 (PROD-002)           │ │
│ │ • Banner 2x3m (PROD-003)         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ┌────────────────────────────────────┐│
│ │ + Ou criar novo produto            ││
│ └────────────────────────────────────┘│
└──────────────────────────────────────┘
```

### Botões Finais
```
┌──────────────────────────────────────┐
│ [Cancelar]  [Vincular 10 SKU(s)] ✓   │
└──────────────────────────────────────┘
```

---

## 📊 Estado do Modal

### Durante Seleção
- Usuário marca/desmarca SKUs
- Contador atualiza: "Produtos Importados (X/15)"
- Botão "Vincular" habilitado quando:
  - ✓ Mínimo 1 SKU selecionado
  - ✓ Produto alvo escolhido (ou criar novo)

### Durante Vinculação
- Botões desabilitados
- Toast progresso: "Vinculando..."
- After completion: "10 SKU(s) vinculado(s) com sucesso!"

### Após Sucesso
- Modal fecha automaticamente
- App recarrega dados
- Lista atualiza com novos SKUs

---

## 🔧 Estados Internos

```typescript
// App.tsx states
isBulkLinkSKUsModalOpen: boolean       // Controla visibilidade do modal
importedSkusForBulkLink: Array<{       // SKUs importados para seleção
  sku: string;
  name: string;
  price?: number;
}>

// BulkLinkSKUsModal.tsx states
selectedSkus: Set<string>              // SKUs selecionados pelo user
targetProductId: string                // ID do produto alvo
isCreatingNew: boolean                 // Flag para novo produto
newProductName: string                 // Nome do novo produto
newProductCode: string                 // Código do novo produto
isLoading: boolean                     // Indica operação em andamento
```

---

## 🔗 Funções Relacionadas

### handleBulkLinkSKUsToExisting()
```typescript
Parâmetros:
  - selectedSkus: string[]      (SKUs a vincular)
  - targetProductId: string     (ID do produto alvo)

O que faz:
  1. Cria array de sku_links com master_product_sku = targetProductId
  2. INSERT em sku_links
  3. Recarrega dados App
  4. Toast de sucesso

Resultado:
  Múltiplos SKUs agora vinculados a 1 produto
```

### handleBulkLinkSKUsCreateNew()
```typescript
Parâmetros:
  - selectedSkus: string[]      (SKUs a vincular)
  - newProductData: {
      name: string;
      code: string;
    }

O que faz:
  1. CREATE novo product em product_boms
  2. INSERT sku_links apontando ao novo product
  3. Recarrega dados
  4. Toast de sucesso

Resultado:
  Novo produto criado + SKUs vinculados
```

---

## ❌ Validações

```
Modal bloqueia "Vincular" se:
  ❌ Nenhum SKU selecionado
  ❌ Produto alvo não escolhido e não está criando novo
  ❌ Se criando novo: nome ou código vazio
  ❌ Durante vinculação (isLoading = true)

Modal mostra aviso:
  💡 "10 SKU(s) serão vinculados ao produto 'Cartaz A3'"
```

---

## 🐛 Troubleshooting

### Problema: Modal não abre
**Solução:** Verificar se importação retornou SKUs
```
Console deve mostrar:
✅ [BulkLink] Vinculando X SKUs ao produto Y
```

### Problema: "Erro ao vincular SKUs"
**Solução:** Verificar console para erro específico
- `column not found` → Checar struktur de sku_links
- `foreign key violation` → Produto alvo não existe
- `duplicate key` → SKU já vinculado (sku_links UNIQUE)

### Problema: Modal fica loading infinito
**Solução:** Recarregar página (F5)

---

## 📈 Fluxo de Dados Esperado

```
Usuário Import XML
      ↓
ImporterPage processa
      ↓
setProcessedData() com SKUs
      ↓
ImportModal mostra preview
      ↓
Usuário clica "Confirmar"
      ↓
setIsBulkLinkSKUsModalOpen(true)
setImportedSkusForBulkLink(Array)
      ↓
BulkLinkSKUsModal renderiza
      ↓
Usuário seleciona SKUs + produto
      ↓
handleBulkLinkSKUsToExisting() OR handleBulkLinkSKUsCreateNew()
      ↓
INSERT sku_links ✅
loadData() recarrega
      ↓
Modal fecha
Toast mostra sucesso
App renderer com novos SKUs
```

---

## 🎓 Exemplo de Uso Real

```
Cenário: Você importa 20 SKUs de um fornecedor
         Desses, 15 são variações do "Cartaz A3"
         e 5 são do "Folder A4"

Workflow:
1. Importe arquivo XML
2. Modal abre com 20 SKUs
3. Selecione 15 SKUs do Cartaz
4. Escolha "Cartaz A3" da lista
5. Clique "Vincular 15 SKU(s)"
   → Toast: "15 SKU(s) vinculado(s) com sucesso!"
6. Modal abre novamente com 5 SKUs restantes
7. Selecione os 5 SKUs do Folder
8. Escolha "Folder A4" da lista
9. Clique "Vincular 5 SKU(s)"
   → Toast: "5 SKU(s) vinculado(s) com sucesso!"

Resultado:
  - Cartaz A3 agora tem 15 SKUs vinculados
  - Folder A4 agora tem 5 SKUs vinculados
  - Tudo feito em 2 minutos!
```

---

## ✅ Checklist de Validação

- [ ] Modal abre quando import completa
- [ ] Selecionar/desselecionar SKUs funciona
- [ ] "Selecionar Tudo" marca/desmarca todos
- [ ] Dropdown de produtos mostra lista correta
- [ ] "Criar novo produto" mostra campos de input
- [ ] Validação impede vincular sem seleção
- [ ] Aviso mostra produto alvo correto
- [ ] Vinculação para produto existente funciona
- [ ] Vinculação criando novo produto funciona
- [ ] Toast mostra sucesso
- [ ] App recarrega com novos SKUs
- [ ] Console mostra logs corretos

---

**Funcionalidade pronta para uso! 🔗✨**
