# 📦 Sincronização de Itens de Pedidos - Documentação de Implementação

## 🎯 Resumo da Implementação

Foi implementado um sistema completo de sincronização de itens de pedidos do Bling para a plataforma local. Os itens agora são:
1. **Sincronizados automaticamente** do Bling a cada 5 minutos
2. **Armazenados em banco de dados** (Supabase) para persistência
3. **Exibidos em tabelas** na página de gerenciamento de DANFE
4. **Formatados** exatamente como aparecem no Bling

---

## 📂 Arquivos Criados/Modificados

### ✅ Nuevos Arquivos

#### 1. **`services/syncBlingItems.ts`** (380+ linhas)
**Propósito**: Serviço de sincronização de itens do Bling para Supabase

**Funções principais:**
```typescript
// Buscar itens de um pedido específico no Bling
buscarItensDoBlIng(blingOrderId: string, token: string)

// Salvar itens no banco de dados
salvarItensNoBanco(orderId: string, blingOrderId: string, itens: any[])

// Sincronizar um pedido completo (fetch + save)
sincronizarPedido(orderId: string, blingOrderId: string, token: string)

// Sincronizar múltiplos pedidos
sincronizarTodosPedidos(token: string, limite: number = 50)

// Buscar itens do banco de dados local
buscarItensDoFantco(orderId: string)

// React Hook para usar em componentes
useSyncBlingItems()
```

#### 2. **`components/ListaItensPedido.tsx`** (240+ linhas)
**Propósito**: Componente visual para exibir itens em tabela

**Características:**
- Tabela com colunas: SKU | Descrição | Unidade | Qtd | Vlr Unit. | Subtotal
- Formatação de moeda (Real) e quantidade com decimais
- Botão de sincronização integrado
- Estados de carregamento/vazio
- Resumo com totais
- Design responsivo

**Props:**
```typescript
interface ListaItensPedidoProps {
  orderId: string;
  blingOrderId?: string;
  itens?: ItemPedido[];
  isLoading?: boolean;
  onSync?: (orderId: string) => Promise<void>;
}
```

#### 3. **`SQL_CRIAR_TABELAS_ITENS.sql`**
**Propósito**: Script SQL para criar tabelas no Supabase

**Tabelas criadas:**
- `order_items` - Armazena items dos pedidos
- `sync_log` - Log de sincronizações
- `sync_config` - Configurações globais

---

### 🔄 Arquivos Modificados

#### 1. **`pages/DANFEManagerPage.tsx`**
**Mudanças:**
- ✅ Adicionadas imports: `ListaItensPedido`, `syncBlingItems`, `useSyncBlingItems`
- ✅ Adicionado state: `itensPorPedido` (mapa de orderId → itens)
- ✅ Adicionado useEffect para sincronização automática a cada 5 minutos
- ✅ Adicionadas funções:
  - `sincronizarItensAutomatico()` - sincroniza itens automaticamente
  - `handleSincronizarItens()` - handler para sincronizar itens de um pedido
- ✅ Passadas props ao `DANFEGerenciador`:
  - `itensPorPedido`
  - `onSincronizarItens`

#### 2. **`components/DANFEGerenciador.tsx`**
**Mudanças:**
- ✅ Adicionadas props: `itensPorPedido` e `onSincronizarItens`
- ✅ Importado componente `ListaItensPedido`
- ✅ Adicionada seção de exibição de itens dentro da view expandida de cada DANFE
- ✅ Botão de sincronização integrado com callback

---

## 🚀 Como Usar

### 1️⃣ Executar SQL no Supabase

1. Acesse seu projeto **Supabase Dashboard**
2. Vá para **SQL Editor**
3. Copie o conteúdo de `SQL_CRIAR_TABELAS_ITENS.sql`
4. Cole na janela de SQL
5. Clique em **"Run"**

✅ As tabelas serão criadas automaticamente.

### 2️⃣ Iniciar a Aplicação

```bash
npm install
npm run dev
```

### 3️⃣ Acessar DANFE Manager

1. Abra http://localhost:5173 (ou a porta configurada)
2. Navegue até **DANFE Manager** (deve estar no menu lateral)
3. Clique em **"Atualizar"** para carregar os pedidos

### 4️⃣ Sincronizar Itens

**Opção A: Manual**
1. Clique no pedido para expandir
2. Clique em **"Sincronizar"** na seção de itens
3. Aguarde o carregamento

**Opção B: Automática**
- Itera sincroniza automaticamente a cada 5 minutos
- Você verá a lista de itens atualizada

---

## 📊 Fluxo de Dados

```
┌─────────────────────────┐
│   Bling ERP API v3      │
│ (GET /pedidos/vendas/)  │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ syncBlingItems.ts               │
│ - buscarItensDoBlIng()          │
│ - salvarItensNoBanco()          │
│ - sincronizarPedido()           │
└────────────┬────────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  Supabase Database           │
│  - order_items table         │
│  - sync_log table            │
└────────────┬─────────────────┘
             │
             ▼
┌──────────────────────────────┐
│  ListaItensPedido.tsx        │
│  Exibe tabela formatada      │
└──────────────────────────────┘
```

---

## 🔧 Configuração

### Intervalo de Sincronização

Para changeador intervalo de sincronização automática, edite [DANFEManagerPage.tsx](DANFEManagerPage.tsx#L53):

```typescript
// Padrão: 5 minutos (300000 ms)
const interval = setInterval(() => {
  sincronizarItensAutomatico();
}, 5 * 60 * 1000); // Altere aqui
```

### Limite de Pedidos

Para alterar quantos pedidos sincronizam por vez, edite [syncBlingItems.ts](services/syncBlingItems.ts#L185):

```typescript
const sincronizarTodosPedidos = async (token: string, limite = 50) => {
  // Aumentar 'limite' para sincronizar mais pedidos de uma vez
};
```

---

## 🎨 Formato Visual

A tabela de itens segue exatamente o formato do Bling:

```
┌─────────────────────────────────────────────────────────────┐
│ SKU │ Descrição │ Un. │ Qtd │ Vlr Unit. │ Subtotal          │
├─────────────────────────────────────────────────────────────┤
│ ABC │ Produto X │ UN  │ 2   │ 100,00    │ 200,00            │
│ DEF │ Produto Y │ KG  │ 5.5 │ 50,00     │ 275,00            │
├─────────────────────────────────────────────────────────────┤
│ TOTAL: 2 itens | Subtotal: R$ 475,00                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### ❌ Itens não aparecem

1. Verifique se as tabelas foram criadas no Supabase
   ```sql
   SELECT tablename FROM pg_tables 
   WHERE tablename IN ('order_items', 'sync_log', 'sync_config');
   ```

2. Verifique se o Token Bling está configurado no localStorage
   ```javascript
   console.log(localStorage.getItem('bling_token'));
   ```

3. Verifique logs no console do navegador (F12 → Console)

### ❌ Erro "Token Bling não configurado"

1. Vá às configurações de integração Bling
2. Gere um novo token
3. Salve o token nas configurações da aplicação

### ❌ Sincronização toma muito tempo

- Reduza o `limite` em `sincronizarTodosPedidos()`
- Aumente o `intervalo_sync_minutos` em `sync_config`

---

## 📈 Monitoramento

### Ver logs de sincronização

No Supabase, execute:

```sql
SELECT * FROM sync_log 
ORDER BY timestamp DESC 
LIMIT 50;
```

### Ver itens sincronizados

```sql
SELECT 
  o.numero as pedido,
  oi.sku,
  oi.descricao,
  oi.quantidade,
  oi.valor_unitario,
  oi.sincronizado_em
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
ORDER BY oi.sincronizado_em DESC;
```

### Configurações atuais

```sql
SELECT * FROM sync_config;
```

---

## 🎯 Próximos Passos (Opcional)

- [ ] Exportar itens para planilha (Excel)
- [ ] Imprimir relatório de itens
- [ ] Editar itens localmente e sincronizar volta para Bling
- [ ] Adicionar filtros de status em tempo real
- [ ] Integrar com sistema de inventário

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique o console do navegador (F12)
2. Verifique os logs do servidor (terminal)
3. Verifique a tabela `sync_log` no Supabase
4. Confirme a conexão com a API Bling

---

**Última atualização**: 2024
**Status**: ✅ Produção
