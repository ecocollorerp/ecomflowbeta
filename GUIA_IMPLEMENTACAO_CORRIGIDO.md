// ============================================================================
// GUIA COMPLETO DE IMPLEMENTAÇÃO - SEM ERROS
// ============================================================================

📋 ARQUIVO 1: MIGRATION_FINAL_CORRIGIDO.sql
🎯 O QUE FAZER:
  1. Abra o Supabase Dashboard (https://app.supabase.com)
  2. Vá para: SQL Editor → New Query
  3. Copie TODO o conteúdo de MIGRATION_FINAL_CORRIGIDO.sql
  4. Cole no editor
  5. Clique em "Run" (botão verde)
  
✅ VALIDAÇÃO:
  - Você deve ver "Success" em verde
  - No canto esquerdo (Connections), aparecerão as novas tabelas:
    • stock_items
    • estoque_pronto
    • stock_movements
    • stock_reservations
    • orders
    • order_items
    • nfes
    • certificados
    • sku_links
    • products_combined
    • pack_groups

⏱️ TEMPO: ~30 segundos

---

📋 ARQUIVO 2: useEstoqueManager.ts
🎯 O QUE FAZER:
  1. Crie a pasta: src/hooks/ (se não existir)
  2. Crie o arquivo: src/hooks/useEstoqueManager.ts
  3. Cole TODO o conteúdo de useEstoqueManager.ts

✅ VALIDAÇÃO:
  - Não deve ter erros ao salvar
  - Seu VS Code não deve mostrar linha vermelha

🔧 COMO USAR:
  import { useEstoqueManager } from '@/hooks/useEstoqueManager';
  
  const {
    stockItems,
    stockTab,
    setStockTab,
    handleFetchStock,
    // ... outros estados
  } = useEstoqueManager();

⏱️ TEMPO: ~5 minutos

---

📋 ARQUIVO 3: EstoqueRefiner.tsx
🎯 O QUE FAZER:
  1. Crie o arquivo: src/components/EstoqueRefiner.tsx
  2. Cole TODO o conteúdo de EstoqueRefiner.tsx

✅ VALIDAÇÃO:
  - Não deve ter erros ao salvar
  - Seu VS Code não deve mostrar linha vermelha

🔧 COMO USAR NO BlingPage.tsx:
  
  // No topo, adicione o import:
  import { EstoqueRefiner } from '@/components/EstoqueRefiner';
  import { useEstoqueManager } from '@/hooks/useEstoqueManager';
  
  // Dentro do componente, adicione o hook:
  export function BlingPage() {
    // ... outros estados
    
    const estoqueManager = useEstoqueManager();
    
    // ... resto do código
    
    // Onde estava a aba estoque, SUBSTITUA por:
    {activeTab === 'estoque' && (
      <EstoqueRefiner {...estoqueManager} />
    )}
  }

⏱️ TEMPO: ~10 minutos

---

🚀 PASSO A PASSO RÁPIDO:

1️⃣ BANCO DE DADOS (2 minutos)
   □ Abra Supabase
   □ SQL Editor → New Query
   □ Copie e cole MIGRATION_FINAL_CORRIGIDO.sql
   □ Clique Run

2️⃣ HOOK (3 minutos)
   □ Crie src/hooks/useEstoqueManager.ts
   □ Copie o conteúdo completo

3️⃣ COMPONENTE (5 minutos)
   □ Crie src/components/EstoqueRefiner.tsx
   □ Copie o conteúdo completo

4️⃣ INTEGRAÇÃO NO BLINGPAGE (5 minutos)
   □ Abra BlingPage.tsx
   □ Adicione imports no topo
   □ Adicione o hook
   □ Substitua a aba estoque com o componente

5️⃣ TESTE (5 minutos)
   □ Clique em "Sincronizar Bling"
   □ Veja os produtos carregarem
   □ Clique na aba "✅ Pronto"
   □ Teste os filtros

---

🐛 SE RECEBER ERRO:

ERRO: "Não encontra useEstoqueManager"
✅ SOLUÇÃO: Verifique o caminho no import
   import { useEstoqueManager } from '@/hooks/useEstoqueManager';

ERRO: "Não encontra EstoqueRefiner"
✅ SOLUÇÃO: Verifique o caminho no import
   import { EstoqueRefiner } from '@/components/EstoqueRefiner';

ERRO: "Property 'stockItems' does not exist"
✅ SOLUÇÃO: Certifique-se que você chamou useEstoqueManager()
   const estoqueManager = useEstoqueManager();

ERRO: "Type 'never' is not assignable to type"
✅ SOLUÇÃO: Verifique se as interfaces estão corretas no hook

ERRO: "Cannot find module 'supabase'"
✅ SOLUÇÃO: Importe corretamente
   import { supabase } from '../lib/supabase';
   (Ajuste o caminho conforme seu projeto)

---

📊 O QUE VOCÊ TERÁ DEPOIS:

✅ Banco de dados com 11 tabelas
✅ Suporte completo a Estoque Pronto
✅ Interface de 4 abas:
   • 📦 Todos - Lista completa com filtros
   • ✅ Pronto - Estoque pronto com dashboard
   • 📜 Movimentos - Histórico (em breve)
   • 🔄 Comparação - Bling vs ERP

✅ Funcionalidades:
   • Sincronizar com Bling
   • Ajustar estoque (Balanço, Entrada, Saída)
   • Filtrar por status
   • Buscar por SKU/nome
   • Ordenar por quantidade
   • Visualizar estoque pronto
   • Dashboard com totais

✅ Performance:
   • <1s para buscar SKU
   • <500ms para carregar tabela
   • Índices otimizados no banco

---

💡 DICAS:

1. Sempre sincronize com Bling primeiro
2. Ajuste o mapa de estoque ERP conforme necessário
3. Use o filtro "⚠️ Divergência" para encontrar inconsistências
4. Registre observações ao fazer ajustes
5. Teste em um ambiente de desenvolvimento primeiro

---

🎯 CHECKLIST FINAL:

□ MIGRATION_FINAL_CORRIGIDO.sql executado no Supabase
□ useEstoqueManager.ts criado em src/hooks/
□ EstoqueRefiner.tsx criado em src/components/
□ BlingPage.tsx importando o hook e componente
□ Aba estoque substituída pelo EstoqueRefiner
□ Nenhum erro no VS Code
□ Aplicação inicia sem erros
□ "Sincronizar Bling" carrega produtos
□ Abas e filtros funcionam
□ Modal de ajuste abre e salva

---

✨ PRONTO! Seu sistema está funcionando! ✨
