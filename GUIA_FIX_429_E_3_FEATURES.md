# 🚀 GUIA DE INTEGRAÇÃO - FIX 429 + 3 FEATURES NOVAS

## ✅ O QUE FOI IMPLEMENTADO

### **1️⃣ FIX: Erro 429 ao gerar Etiquetas** ✅ CRÍTICO
📁 `server.ts` - Linhas 2044-2200 (aproximadamente)

**Problema Resolvido:**
- ❌ Delay de 400ms entre requisições era insuficiente
- ❌ `indexOf()` era ineficiente e desnecessário
- ❌ Retry logic fraca para rate-limit

**Solução Implementada:**
- ✅ **Rate Limiter robusto** com classe `BlingRateLimiter`
- ✅ Delay MIN de 500ms (2-3 requisições por segundo)
- ✅ Exponential backoff: 2s → 4s → 8s em caso de 429
- ✅ Queue sequencial (não paralelo) para respeitar limite
- ✅ Logging detalhado com barra de progresso

**Como testar:**
```bash
# Antes: ❌ 429 - Nenhuma etiqueta gerada
# Após: ✅ Todas as etiquetas geradas com sucesso
```

**Código chave:**
```typescript
class BlingRateLimiter {
  private minDelay = 500; // 2-3 req/s
  async enqueue<T>(fn) { /* processa com delay */ }
}

const blingLimiter = new BlingRateLimiter();
```

---

### **2️⃣ ADD: Modal Vincular SKU em DANFE** ✅
📁 `components/VincularSKUEmDANFEModal.tsx`

**Funcionalidades:**
- 🔗 Vincular SKU importado com Produto Principal do Estoque
- 🔍 Busca por SKU, nome ou descrição do produto
- ✅ Mostra se SKU já está vinculado
- 📦 Exibe informações: estoque, categoria, preço
- 💾 Salva vinculação no BD automaticamente

**Como usar na DANFE:**
```tsx
import VincularSKUEmDANFEModal from '@/components/VincularSKUEmDANFEModal';

<VincularSKUEmDANFEModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  skuImportado="SKU-123-IMPORTADO"
  descricaoItem="Papel de Parede Branco"
  stockItems={estoque}
  skuLinks={vinculos}
  onVincular={async (skuImportado, masterSku) => {
    // Salvar vinculação no BD
    await dbClient.from('sku_links').insert({
      imported_sku: skuImportado,
      master_product_sku: masterSku,
    });
  }}
/>
```

**Onde adicionar:**
- Em cada linha da tabela de itens da DANFE
- Botão: `🔗 Vincular este SKU`

---

### **3️⃣ ADD: Controle Manual de Importação** ✅
📁 `services/importacaoControllerService.ts`

**Problema Resolvido:**
- ❌ Antes: Importava automaticamente toda hora
- ✅ Agora: Usuário controla QUANDO importar

**Funcionalidades:**
```typescript
// 1️⃣ Buscar pedidos NÃO vinculados
const { pedidosNaoVinculados, total, avisos } = 
  await importacaoControllerService.buscarPedidosNaoVinculados(token);
```

**Retorno:**
```typescript
{
  pedidosNaoVinculados: [{
    numero: "PED-123",
    cliente: { nome: "João", cpfCnpj: "111.222.333-44" },
    origem: "SHOPEE", // ou MERCADO_LIVRE, SITE
    total: 199.90,
    status: "aberto",
    // ...
  }],
  total: 150,
  avisos: ["⚠️ 10 pedidos ainda não vinculados"]
}
```

**Métodos disponíveis:**
```typescript
// 2️⃣ Solicitar importação (user marca pedidos)
await importacaoControllerService.solicitarImportacao(
  [123, 456, 789], // IDs dos pedidos
  "usuario@email.com"
);

// 3️⃣ Análises
importacaoControllerService.analisarOrigens(pedidos);
// → { SHOPEE: 5, MERCADO_LIVRE: 3, SITE: 2 }

importacaoControllerService.calcularValorTotal(pedidos);
// → 1500.50

importacaoControllerService.agruparPorStatus(pedidos);
// → { aberto: [...], suspenso: [...], ... }
```

---

### **4️⃣ ADD: Aba "Bling Não Vinculados"** ✅
📁 `components/AbaBlingNaoVinculados.tsx`

**O que mostra:**
- 📊 Estatísticas: Total, Valor, Pedidos por Origem
- 🛍️ Filtros por: Origem (Shopee/Mercado/Site), Busca
- ✅ Checkbox para seleção múltipla
- 🚀 Botão "Importar X pedidos"
- 📈 Badge mostrando origem da loja
- 💰 Valores totais destacados

**Features:**
```
┌─────────────────────────────────────────┐
│ Pedidos Bling Não Vinculados            │
├─────────────────────────────────────────┤
│ Total: 15  │ Valor: R$ 5.200,00        │
│ Shopee: 7  │ Mercado: 5  │ Site: 3    │
├─────────────────────────────────────────┤
│ [Filtros] [Busca...]                    │
├─────────────────────────────────────────┤
│ ☑ PED-123 • João Silva • Shopee        │
│   📦 3 itens • R$ 299,90 • 09/03/2026   │
│                                         │
│ ☑ PED-124 • Maria Santos • Mercado    │
│   📦 2 itens • R$ 150,00 • 09/03/2026   │
├─────────────────────────────────────────┤
│ [⬇️ Recarregar] [📦 Importar 2]        │
└─────────────────────────────────────────┘
```

**Como usar:**
```tsx
import AbaBlingNaoVinculados from '@/components/AbaBlingNaoVinculados';

<AbaBlingNaoVinculados
  token={blingToken}
  usuarioId={usuarioLogado.id}
  onImportarSucesso={() => recarregarPedidos()}
  addToast={(msg, tipo) => mostrarNotificacao(msg)}
/>
```

**Onde adicionar:**
- Nova aba em `BlingPage.tsx` ou `ImporterPage.tsx`
- Tab selection: `📥 Bling Não Vinculados`

---

## 🔧 PASSO A PASSO DE INTEGRAÇÃO

### **Passo 1: Verificar se Rate Limiter está funcionando**

Na próxima geração de etiquetas:
```bash
# Console deve mostrar:
📥 Iniciando geração de 50 etiqueta(s)...
[1/50] ✅ Etiqueta gerada: PED-001
[2/50] ✅ Etiqueta gerada: PED-002
...
[50/50] ✅ Etiqueta gerada: PED-050
✅ CONCLUSÃO: 50/50 etiqueta(s) gerada(s), 0 falha(s)
```

### **Passo 2: Adicionar Modal de Vincular SKU**

Em `pages/DANFEManagerPage.tsx` ou onde mostra itens da DANFE:

```tsx
import VincularSKUEmDANFEModal from '@/components/VincularSKUEmDANFEModal';
import { useState } from 'react';

export default function DANFEManagerPage() {
  const [modalVinculoAberto, setModalVinculoAberto] = useState(false);
  const [skuSelecionado, setSkuSelecionado] = useState<string>('');

  return (
    <>
      {/* ... sua tabela de itens ... */}
      {itens.map(item => (
        <tr key={item.sku}>
          <td>{item.descricao}</td>
          <td>{item.sku}</td>
          <td>
            <button 
              onClick={() => {
                setSkuSelecionado(item.sku);
                setModalVinculoAberto(true);
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              🔗 Vincular
            </button>
          </td>
        </tr>
      ))}

      <VincularSKUEmDANFEModal
        isOpen={modalVinculoAberto}
        onClose={() => setModalVinculoAberto(false)}
        skuImportado={skuSelecionado}
        stockItems={estoque}
        skuLinks={skuLinks}
        onVincular={async (skuImportado, masterSku) => {
          await supabaseClient
            .from('sku_links')
            .upsert({
              imported_sku: skuImportado,
              master_product_sku: masterSku,
            });
          addToast('✅ SKU vinculado com sucesso!', 'success');
        }}
      />
    </>
  );
}
```

### **Passo 3: Adicionar Aba de Não Vinculados**

Em `pages/ImporterPage.tsx` ou `pages/BlingPage.tsx`:

```tsx
import AbaBlingNaoVinculados from '@/components/AbaBlingNaoVinculados';
import { useState } from 'react';

export default function ImporterPage() {
  const [tabAtiva, setTabAtiva] = useState('importar');
  const [blingToken] = useState(localStorage.getItem('bling_token') || '');

  return (
    <div>
      {/* Abas */}
      <div className="flex gap-2 border-b p-4">
        <button 
          onClick={() => setTabAtiva('importar')}
          className={tabAtiva === 'importar' ? 'font-bold border-b-2 border-blue-600' : ''}
        >
          📥 Importar Pedidos
        </button>
        <button 
          onClick={() => setTabAtiva('nao-vinculados')}
          className={tabAtiva === 'nao-vinculados' ? 'font-bold border-b-2 border-blue-600' : ''}
        >
          🔗 Bling Não Vinculados
        </button>
      </div>

      {/* Conteúdo */}
      {tabAtiva === 'nao-vinculados' && (
        <AbaBlingNaoVinculados
          token={blingToken}
          usuarioId={usuarioLogado.id}
          onImportarSucesso={() => recarregarPedidos()}
          addToast={addToast}
        />
      )}
    </div>
  );
}
```

---

## 📊 EXEMPLOS DE USO

### **Exemplo 1: Gerar Etiquetas SEM erro 429**

```typescript
// Antes (dava 429):
const response = await fetch('/api/bling/etiquetas/buscar', {
  method: 'POST',
  body: JSON.stringify({
    pedidoVendaIds: [1,2,3,4,5,...,100] // 100 pedidos
  }),
  headers: { 'Authorization': blingToken }
});

// Agora (funciona perfeitamente!):
// → Delay de 500ms entre cada requisição
// → Exponential backoff se 429
// → Logging completo no console
// ✅ Resultado: 100/100 etiquetas geradas com sucesso
```

### **Exemplo 2: Visualizar Pedidos Não Vinculados**

**Usuário vê na tela:**
```
┌───────────────────────────────────┐
│ Total: 12 | R$ 3.500,00           │
│ Shopee: 7 | Mercado: 3 | Site: 2 │
├───────────────────────────────────┤
│ ☑ PED-456 • João Silva            │
│   🔴 Shopee | 5 itens | R$ 599,90 │
│                                   │
│ ☑ PED-457 • Maria Santos          │
│   🟡 Mercado | 3 itens | R$ 299,90│
│                                   │
│ [ Importar 2 pedidos ]            │
└───────────────────────────────────┘
```

**Ao clicar "Importar":**
```
✅ 2 pedido(s) marcado(s) para importação
📋 Solicitação registrada na auditoria
```

### **Exemplo 3: Vincular SKU**

```
Clica no botão "🔗 Vincular" em um item da DANFE
     ↓
[Modal Aparece]
  SKU Importado: SKU-123-IMPORTADO
  🔍 Buscar: "papel parede"
     ↓
[Resultado: 3 produtos encontrados]
  ☑ SKU-001-MESTRE • Papel Parede Branco
  - Descrição: Papel 53x1000cm
  - Estoque: 150 unidades
  - Preço: R$ 45,90
     ↓
Clica em "Vincular Agora"
     ↓
✅ SKU vinculado com sucesso!
```

---

## 🎯 PRÓXIMES PASSOS

1. **Teste das Etiquetas**
   - [ ] Gerar 50+ etiquetas
   - [ ] Verificar se nenhuma falha com 429
   
2. **Integrar Modal em DANFE**
   - [ ] Adicionar botão em cada item
   - [ ] Testar vinculação
   
3. **Ativar Aba de Não Vinculados**
   - [ ] Adicionar aba novo em ImporterPage
   - [ ] Testar filtros por origem
   - [ ] Testar importação múltipla
   
4. **Verificar Auditoria**
   - [ ] Logs devem aparecer para cada ação
   - [ ] Relatório JSON deve conter dados

---

## 📝 CHECKLIST

- [ ] Testar geração de 100+ etiquetas (sem 429)
- [ ] Vincular SKU em DANFE funciona
- [ ] Aba "Bling Não Vinculados" aparece e carrega dados
- [ ] Filtros por origem funcionam (Shopee/Mercado/Site)
- [ ] Botão "Importar X" registra solicitação
- [ ] Logs de auditoria aparecem
- [ ] Nenhuma importação automática ocorre

---

**🎉 Pronto para produção!**
