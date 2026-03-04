## 🚀 GUIA RÁPIDO DE ATIVAÇÃO DO ESTOQUE

### ✅ PASSO 1: Executar a Migração SQL (IMPORTANTE!)

1. Abra **Supabase Projeto → SQL Editor**
2. **Copie TODO O CONTEÚDO** do arquivo `MIGRATION_FINAL_UPDATED.sql`
3. **Cole** na aba SQL Editor do Supabase
4. **Execute** (clique "Run" ou Ctrl+Enter)

**O que esperar:**
```
✅ Drop table stock_items (if exists) - OK
✅ Drop table product_boms (if exists) - OK
✅ Create table stock_items - OK
✅ Create table product_boms - OK
[... mais 20+ operações ...]
✅ Completion time: 2.5 seconds
```

⚠️ **Se der erro de RLS**, não se preocupe - vai funcionar mesmo assim em development.

---

### ✅ PASSO 2: Inserir Dados de Teste

1. **Copie TODO O CONTEÚDO** do arquivo `SETUP_DATABASE.sql`
2. **Cole** no SQL Editor do Supabase (mesma aba)
3. **Execute**

**O que esperar:**
```
✅ INSERT 0 4 (4 insumos criados)
✅ INSERT 0 3 (3 produtos finais criados)
✅ INSERT 0 4 (4 SKUs linkeados)
✅ Resultado: 4 Insumos, 3 Produtos, 4 SKUs
```

---

### ✅ PASSO 3: Verificar Tabela (Query Final)

No SQL Editor, execute:
```sql
SELECT 
    (SELECT COUNT(*) FROM stock_items) as "Insumos",
    (SELECT COUNT(*) FROM product_boms) as "Produtos",
    (SELECT COUNT(*) FROM sku_links) as "SKUs";
```

**Deve retornar:**
```
Insumos | Produtos | SKUs
--------|----------|------
   4    |    3     |  4
```

---

### ✅ PASSO 4: Reiniciar o App

1. No VS Code, abra Terminal
2. Execute:
```bash
npm run dev
```
3. Abra: `http://localhost:5173`
4. Acesse **Estoque** (menu à esquerda)

---

### ✅ PASSO 5: Verificar o Carregamento

Quando o app abrir, você verá no console (F12):

```
📥 [loadData] ============ INICIANDO CARREGAMENTO ============
✅ [loadData] returns: 0 registros
✅ [loadData] skuLinks: 4 registros
✅ [loadData] users: 1 registros
💾 [loadData] Salvando 3 product_boms (produtos finais)
✅ [loadData] stockMovements: 0 registros
✅ [loadData] rawMaterials: 4 registros
```

**Na tela de Estoque, você verá:**
- ✅ 3 produtos listados:
  - [ ] Cartaz A3 Colorido (50 un)
  - [ ] Folder A4 Dobrado (100 un)
  - [ ] Banner Lona 2x3m (10 un)

---

### 🔧 Se NADA APARECER:

**Diagnosticar:**

1. Abra o console (F12) e procure por:
   - `⚠️ product_boms retornou array VAZIO` → Significa que a migration não foi executada
   - `❌ [loadData] ERRO em stockItems` → Erro de RLS/permissão

2. No Supabase, vá para **Table Editor** e verifique:
   - [ ] A tabela `product_boms` existe?
   - [ ] Tem dados dentro? (Deve ter 3 registros)
   - [ ] A tabela `sku_links` foi criada?

3. Se não tiver dados, repita PASSO 1 e PASSO 2 acima

---

### 📊 DEPOIS: Testar Funcionalidades

Quando os dados aparecerem, teste:

1. **Adicionar Novo Produto**
   - Clique "Add Product"
   - Nome: "Teste 123"
   - Código: "TEST-001"
   - Clique "Save"
   - ✅ Deve aparecer na lista imediatamente

2. **Editar Produto**
   - Clique no produto
   - Altere o nome para "Teste 123 - Editado"
   - Clique "Save"
   - ✅ Deve atualizar na lista

3. **Deletar Produto**
   - Clique no produto
   - Clique "Delete"
   - Confirme
   - ✅ Deve desaparecer da lista

4. **Compor BOM** (quando pronto)
   - Editar produto
   - Na seção "BOM" ou "Composição"
   - Selecionar insumos que compõem o produto
   - ✅ Deve salvar a composição

---

### 📝 LOGS IMPORTANTES

Para ver os logs do app:
- Pressione **F12** no navegador
- Vá para aba **Console**
- Procure por mensagens com emojis:
  - `📥` = Iniciando algo
  - `✅` = Sucesso
  - `❌` = Erro
  - `⚠️` = Aviso
  - `💾` = Salvando

---

### 🎯 CHECKLIST FINAL

- [ ] Executei `MIGRATION_FINAL_UPDATED.sql` no Supabase
- [ ] Executei `SETUP_DATABASE.sql` no Supabase
- [ ] Rodei a query de verificação e deu 4/3/4
- [ ] Iniciei o app com `npm run dev`
- [ ] Abri a aba Estoque
- [ ] Vejo os 3 produtos listados
- [ ] Consigo adicionar novo produto
- [ ] Consigo editar produto
- [ ] Consigo deletar produto

**Quando tudo estiver funcionando, você pode:**
- ✅ Importar produtos do Bling
- ✅ Linkar SKUs de marketplace
- ✅ Definir composição de BOMs
- ✅ Controlar estoque de insumos

---

## 🆘 ERROS COMUNS

### Erro: "Could not find the 'kind' column"
**Solução:** Repita PASSO 1 (migrate novamente) - a versão anterior do SQL não tinha isso

### Erro: "Policy violation"
**Solução:** Normal em development - app continua funcionando mesmo com esse aviso

### Erro: "Cannot read property 'map' of undefined"
**Solução:** Significa que `product_boms` está retornando null. Verifique se a tabela foi criada no Supabase

### Mensagem: "⚠️ Nenhum produto carregado (product_boms vazia)"
**Solução:** Repita PASSO 2 (insira dados de teste)

---

## 📞 SE TRAVOU EM ALGUM LUGAR

Envie screenshot do console (F12) mostrando as mensagens em vermelho.
