// ============================================================================
// 📍 GUIA DE INTEGRAÇÃO - CODE SAMPLES PRONTOS PARA USAR
// Copie e cole exatamente onde indicado
// ============================================================================

## 1️⃣ FIX 429 - AUTOMÁTICO (JÁ FEITO EM server.ts)
✅ NÃO PRECISA FAZER NADA - O Rate Limiter está rodando automaticamente!

---

## 2️⃣ INTEGRAR MODAL VINCULAR SKU EM DANFE

### Opção A: Se tiver uma tabela de itens na DANFE

```tsx
// ============================================================================
// Em: pages/DANFEManagerPage.tsx (ou onde mostra itens)
// ============================================================================

import VincularSKUEmDANFEModal from '@/components/VincularSKUEmDANFEModal';
import { useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

export default function DANFEManagerPage() {
  const [itemParaVincular, setItemParaVincular] = useState<{
    sku: string;
    descricao: string;
  } | null>(null);

  const handleVincularSKU = async (skuImportado: string, masterSku: string) => {
    // ✅ Exemplo: Salvar em sua tabela sku_links
    const { error } = await supabaseClient
      .from('sku_links')
      .upsert({
        imported_sku: skuImportado,
        master_product_sku: masterSku,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'imported_sku'
      });

    if (error) throw error;
  };

  // Sua tabela de itens da DANFE
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Descrição</th>
            <th>Quantidade</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.sku}>
              <td className="font-mono">{item.sku}</td>
              <td>{item.descricao}</td>
              <td>{item.quantidade}</td>
              <td>
                {/* ✅ ADICIONE ESTE BOTÃO */}
                <button
                  onClick={() =>
                    setItemParaVincular({
                      sku: item.sku,
                      descricao: item.descricao,
                    })
                  }
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  🔗 Vincular
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ✅ ADICIONE ESTE MODAL */}
      <VincularSKUEmDANFEModal
        isOpen={!!itemParaVincular}
        onClose={() => setItemParaVincular(null)}
        skuImportado={itemParaVincular?.sku || ''}
        descricaoItem={itemParaVincular?.descricao}
        stockItems={seuVetorDeEstoque} // Seus produtos do estoque
        skuLinks={seuVetorDeVinculos}  // Seus vinculos SKU
        onVincular={handleVincularSKU}
        addToast={seuFuncaoDeToast}
      />
    </div>
  );
}
```

---

## 3️⃣ INTEGRAR ABA "BLING NÃO VINCULADOS"

### Opção A: Em BlingPage.tsx (Sistema de Abas)

```tsx
// ============================================================================
// Em: pages/BlingPage.tsx
// ============================================================================

import { useState } from 'react';
import AbaBlingNaoVinculados from '@/components/AbaBlingNaoVinculados';

export default function BlingPage() {
  const [tabAtiva, setTabAtiva] = useState('importar'); // 'importar' | 'nao-vinculados'
  const [usuarioLogado] = useState({ id: 'usuario123' }); // Seu usuário
  const blingToken = localStorage.getItem('bling_token') || '';

  return (
    <div className="h-full flex flex-col">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* ABAS - ADICIONE ISTO */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex gap-0 border-b bg-white">
        {/* Aba 1: Importar Pedidos (sua aba existente) */}
        <button
          onClick={() => setTabAtiva('importar')}
          className={`px-4 py-3 font-semibold transition ${
            tabAtiva === 'importar'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          📥 Importar Pedidos
        </button>

        {/* ✅ Aba 2: NOVA - Bling Não Vinculados */}
        <button
          onClick={() => setTabAtiva('nao-vinculados')}
          className={`px-4 py-3 font-semibold transition ${
            tabAtiva === 'nao-vinculados'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          🔗 Bling Não Vinculados
        </button>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* CONTEÚDO DAS ABAS */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}

      {tabAtiva === 'importar' && (
        <div className="flex-1">
          {/* Seu conteúdo existente de importação */}
          {/* ... componentes que você já tem ... */}
        </div>
      )}

      {/* ✅ ADICIONE ESTA ABA */}
      {tabAtiva === 'nao-vinculados' && (
        <div className="flex-1 overflow-hidden">
          <AbaBlingNaoVinculados
            token={blingToken}
            usuarioId={usuarioLogado.id}
            onImportarSucesso={() => {
              // Recarregar pedidos se necessário
              console.log('✅ Pedidos importados com sucesso!');
            }}
            addToast={(msg, tipo) => {
              // Use seu sistema de toast/notificação
              console.log(`[${tipo}] ${msg}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
```

### Opção B: Em ImporterPage.tsx (Sistema de Abas Existente)

```tsx
// ============================================================================
// Em: pages/ImporterPage.tsx
// ============================================================================

import AbaBlingNaoVinculados from '@/components/AbaBlingNaoVinculados';

export default function ImporterPage() {
  const [tabAtiva, setTabAtiva] = useState('manual'); // ou sua aba padrão
  const blingToken = localStorage.getItem('bling_token') || '';
  const usuarioId = localStorage.getItem('usuario_id') || 'sistema';

  return (
    <div className="space-y-4">
      {/* Suas abas existentes */}
      <div className="flex gap-2 border-b">
        <TabButton
          ativo={tabAtiva === 'manual'}
          onClick={() => setTabAtiva('manual')}
        >
          📋 Importação Manual
        </TabButton>
        
        {/* ✅ ADICIONE ESTA ABA */}
        <TabButton
          ativo={tabAtiva === 'nao-vinculados'}
          onClick={() => setTabAtiva('nao-vinculados')}
        >
          🔗 Bling Não Vinculados
        </TabButton>
      </div>

      {/* Conteúdo */}
      {tabAtiva === 'manual' && <SeuComponenteDeImportacao />}
      
      {/* ✅ ADICIONE ESTE CONTEÚDO */}
      {tabAtiva === 'nao-vinculados' && (
        <AbaBlingNaoVinculados
          token={blingToken}
          usuarioId={usuarioId}
          onImportarSucesso={() => recarregarPedidos()}
          addToast={addToast}
        />
      )}
    </div>
  );
}
```

---

## 4️⃣ DESATIVAR AUTO-IMPORTAÇÃO (se houver)

### Procure por (no seu código):
```typescript
// ❌ REMOVA ou COMENTE ISTO:
useEffect(() => {
  // Auto-importar pode aparecer assim:
  const timer = setInterval(async () => {
    const pedidos = await carregarTodosPedidos(token);
    await salvarNoBancoDados(pedidos);
  }, 3600000); // a cada hora por exemplo

  return () => clearInterval(timer);
}, []);
```

### E substitua por (MANUAL):
```typescript
// ✅ USE ISTO PARA MANUAL:
const handleImportarAgora = async () => {
  const pedidos = await importacaoControllerService.buscarPedidosNaoVinculados(token);
  
  if (selecionados.length > 0) {
    await importacaoControllerService.solicitarImportacao(
      selecionados,
      usuarioId
    );
  }
};
```

---

## 5️⃣ VERIFICAÇÃO: TUDO PRONTO?

### Checklist de Integração:

```typescript
// ✅ 1. Verificar imports
import VincularSKUEmDANFEModal from '@/components/VincularSKUEmDANFEModal';
import AbaBlingNaoVinculados from '@/components/AbaBlingNaoVinculados';
import { importacaoControllerService } from '@/services/importacaoControllerService';

// ✅ 2. Verificar se Rate Limiter está rodando
// Em server.ts procure por: class BlingRateLimiter
// Deve estar entre linhas 2044-2180

// ✅ 3. Verificar se tem Bling Token
const token = localStorage.getItem('bling_token');
if (!token) {
  console.error('❌ Token Bling não configurado');
  // Adicione token em app_settings ou localStorage
}

// ✅ 4. Testar Modal
<VincularSKUEmDANFEModal
  isOpen={true}
  onClose={() => {}}
  skuImportado="TEST-SKU"
  // ... outros props
/>

// ✅ 5. Testar Aba
<AbaBlingNaoVinculados
  token={token}
  usuarioId="test"
/>
```

---

## 6️⃣ EXEMPLOS DE DADOS PARA TESTAR

### Teste o Modal com:
```typescript
const testStockItems = [
  {
    id: '1',
    sku: 'MESTRE-001',
    nome: 'Papel Parede Branco',
    descricao: 'Papel 53x1000cm',
    categoria: 'Acabamento',
    preco: 45.90,
    quantidade: 150,
  },
  {
    id: '2',
    sku: 'MESTRE-002',
    nome: 'Tinta Acrilica',
    descricao: 'Tinta premium 18L',
    categoria: 'Pintura',
    preco: 180.00,
    quantidade: 45,
  },
];

const testSkuLinks = [
  {
    imported_sku: 'SKU-123',
    master_product_sku: 'MESTRE-001',
  },
];
```

### Teste a Aba com:
```bash
# Certifique-se que tem pedidos do Bling salvos
SELECT * FROM orders WHERE external_id LIKE 'bling%' LIMIT 5;

# Pedidos não importados aparecerão na aba
```

---

## 7️⃣ DICAS & TROUBLESHOOTING

### Se Modal não abre:
```tsx
// ✅ Verifique estado:
console.log('Modal aberto?', itemParaVincular);

// ✅ Verifique import:
import VincularSKUEmDANFEModal from '@/components/VincularSKUEmDANFEModal';
//                                 ↑↑↑ Caminho exato
```

### Se Aba não carrega pedidos:
```tsx
// ✅ Verifique token:
console.log('Token Bling:', blingToken);

// ✅ Verifique tabela:
SELECT * FROM orders LIMIT 5; // Deve ter dados

// ✅ Verifique erro:
const { pedidosNaoVinculados, avisos } = await importacaoControllerService.buscarPedidosNaoVinculados(token);
console.log('Avisos:', avisos); // Pode ter mensagem de erro
```

### Se Rate Limiter não funciona:
```bash
# ✅ Verifique console do servidor:
# Deve mostrar:
# 📥 Iniciando geração de X etiqueta(s)...
# [1/X] ✅ Etiqueta gerada...

# Se não aparecer, verifique:
# 1. server.ts está rodando?
# 2. Rate Limiter está instanciado?
# 3. Endpoints estão corretos?
```

---

## 8️⃣ NEXT STEPS

Após integrar:

1. ✅ Teste geração de 100+ etiquetas
   ```bash
   # Verifique se completa sem 429
   ```

2. ✅ Teste modal de vincular
   ```tsx
   // Clique no botão "🔗 Vincular"
   // Deve abrir modal intuitivo
   ```

3. ✅ Teste aba de não vinculados
   ```tsx
   // Vá para aba "🔗 Bling Não Vinculados"
   // Deve carregar lista automaticamente
   ```

4. ✅ Teste importação manual
   ```tsx
   // Selecione 2-3 pedidos
   // Clique "📦 Importar"
   // Deve registrar e não importar automaticamente
   ```

---

**✅ Pronto para integrar! Copie o código acima em suas páginas! 🚀**
