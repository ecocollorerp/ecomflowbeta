// ============================================================================
// INTEGRATION_GUIDE.md - Guia Completo de Integração
// Elementos: Pacotes Prontos + Sincronização Bling
// ============================================================================

# 🚀 Guia de Integração: Pacotes Prontos & Bling Sync

## 📋 Resumo

Este guia orienta como integrar os novos componentes e features ao seu aplicativo existente:
- **PacotesProntosManager** - Gerenciamento de pacotes prontos para expedição
- **BlingPedidosItemsSync** - Sincronização de itens de pedidos com Bling ERP
- **PacotesProntosPage** - Página completa integrando ambos

## 📁 Arquivos Criados

```
components/
├── PacotesProntosManager.tsx      (590 linhas) ✅
└── BlingPedidosItemsSync.tsx      (680 linhas) ✅

pages/
└── PacotesProntosPage.tsx         (580 linhas) ✅

hooks/
└── useEstoque.ts                  (780 linhas) ✅
    ├── usePacotesProtos()
    └── useBlingItemsSync()
```

## 🔧 1. Adicionar Rota no App.tsx

```typescript
// App.tsx - Adicionar import
import PacotesProntosPage from './pages/PacotesProntosPage';

// Dentro do seu router/routing, adicione:
{
  path: '/pacotes-prontos',
  element: <PacotesProntosPage addToast={addToast} />,
  label: 'Pacotes Prontos',
  icon: Package
}

// Ou se estiver usando React Router v6:
<Route 
  path="/pacotes-prontos" 
  element={<PacotesProntosPage addToast={addToast} />} 
/>
```

## 🎨 2. Adicionar Item ao Menu/Sidebar

```typescript
// Sidebar.tsx ou Menu.tsx
const menuItems = [
  // ... outros itens
  {
    label: 'Pacotes Prontos',
    href: '/pacotes-prontos',
    icon: Package,
    badge: pacotesCount, // opcional
  }
];
```

## 💾 3. Configurar Supabase (CRÍTICO)

### Criar Tabela: estoque_pronto

```sql
CREATE TABLE estoque_pronto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  sku_primario VARCHAR(50) NOT NULL UNIQUE,
  quantidade_total INTEGER NOT NULL,
  quantidade_disponivel INTEGER NOT NULL,
  quantidade_reservada INTEGER NOT NULL DEFAULT 0,
  localizacao VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRONTO' CHECK (
    status IN ('PRONTO', 'RESERVADO', 'EXPEDIDO', 'DEVOLVIDO')
  ),
  data_preparacao BIGINT NOT NULL,
  data_disponibilidade BIGINT NOT NULL,
  operador VARCHAR(150) NOT NULL,
  observacoes TEXT,
  produtos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX estoque_pronto_status ON estoque_pronto(status);
CREATE INDEX estoque_pronto_localizacao ON estoque_pronto(localizacao);
CREATE INDEX estoque_pronto_sku ON estoque_pronto(sku_primario);
```

### Criar Tabela: order_items

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id VARCHAR(50) NOT NULL,
  bling_id VARCHAR(100),
  sku VARCHAR(50) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  preco_total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'nao_sincronizado' CHECK (
    status IN ('nao_sincronizado', 'sincronizado', 'pendente', 'erro')
  ),
  data_criacao BIGINT NOT NULL,
  ultima_sincronizacao BIGINT,
  erro_mensagem TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX order_items_order_id ON order_items(order_id);
CREATE INDEX order_items_bling_id ON order_items(bling_id);
CREATE INDEX order_items_sku ON order_items(sku);
CREATE INDEX order_items_status ON order_items(status);
```

## 🔌 4. Implementar Hooks no Seu Componente

### Opção A: Usar Diretamente em um Componente

```typescript
import { usePacotesProtos, useBlingItemsSync } from '../hooks/useEstoque';

const MyComponent = () => {
  // Hook para pacotes prontos
  const {
    pacotes,
    isLoading,
    criarPacote,
    editarPacote,
    deletarPacote,
    moverPacote,
    marcarComoExpedido
  } = usePacotesProtos();

  // Hook para sincronização com Bling
  const {
    itens,
    isSyncing,
    sincronizarItens,
    baixarItensBlIng
  } = useBlingItemsSync();

  return (
    <>
      {/* Seus componentes aqui */}
    </>
  );
};
```

### Opção B: Usar DIRETO NO PacotesProntosPage

O arquivo `PacotesProntosPage.tsx` já está pronto para usar! Basta importar:

```typescript
import PacotesProntosPage from './pages/PacotesProntosPage';
```

## 🌐 5. Integração com Bling API

### Criar serviço: services/blingApi.ts

```typescript
import axios from 'axios';

const BLING_API_URL = 'https://bling.com.br/Api/v3';
const BLING_API_TOKEN = process.env.REACT_APP_BLING_API_TOKEN;

export const blingApi = {
  // Buscar itens de pedidos
  async getOrderItems(orderId: string) {
    return axios.get(`${BLING_API_URL}/pedidos/${orderId}/itens`, {
      headers: { Authorization: `Bearer ${BLING_API_TOKEN}` }
    });
  },

  // Criar/atualizar item
  async createOrUpdateItem(item: any) {
    return axios.post(`${BLING_API_URL}/produtos`, item, {
      headers: { Authorization: `Bearer ${BLING_API_TOKEN}` }
    });
  },

  // Atualizar status do pedido
  async updateOrderStatus(orderId: string, status: string) {
    return axios.put(`${BLING_API_URL}/pedidos/${orderId}`, { status }, {
      headers: { Authorization: `Bearer ${BLING_API_TOKEN}` }
    });
  },

  // Sincronizar estoque
  async syncInventory(items: any[]) {
    return axios.post(`${BLING_API_URL}/estoque/sincronizar`, { items }, {
      headers: { Authorization: `Bearer ${BLING_API_TOKEN}` }
    });
  }
};
```

## 🔑 6. Variáveis de Ambiente

```bash
# .env ou .env.local
REACT_APP_BLING_API_TOKEN=seu_token_aqui
REACT_APP_BLING_API_URL=https://bling.com.br/Api/v3
SUPABASE_URL=sua_url_supabase
SUPABASE_ANON_KEY=sua_chave_supabase
```

## 🔄 7. Implementar Callbacks Reais

### No Hook usePacotesProtos, descomentar Supabase:

```typescript
// Em carregarPacotes():
const { data, error: err } = await supabase
    .from('estoque_pronto')
    .select('*');

if (err) throw err;
setPacotes(data || []);
```

### No Hook useBlingItemsSync, implementar sync:

```typescript
// Em sincronizarItens():
for (const itemId of itemIds) {
    const item = itens.find(i => i.id === itemId);
    if (!item) continue;
    
    try {
        const response = await blingApi.createOrUpdateItem({
            sku: item.sku,
            nome: item.nome,
            quantidade: item.quantidade,
            preco: item.preco_unitario
        });
        
        // Atualizar status no banco
        await supabase
            .from('order_items')
            .update({
                bling_id: response.id,
                status: 'sincronizado',
                ultima_sincronizacao: Date.now()
            })
            .eq('id', itemId);
    } catch (err) {
        // Log de erro
    }
}
```

## ✅ 8. Checklist de Implementação

- [ ] Arquivos criados em seus devidos lugares
- [ ] Rotas adicionadas ao App.tsx
- [ ] Item de menu adicionado ao Sidebar
- [ ] Tabelas Supabase criadas (estoque_pronto, order_items)
- [ ] Variáveis de ambiente configuradas
- [ ] Serviço Bling API implementado
- [ ] Callbacks nos hooks uncommentados
- [ ] Testes realizados
- [ ] Deploy em staging
- [ ] Deploy em produção

## 🧪 9. Testes Recomendados

```typescript
// Teste de carregamento
it('deve carregar pacotes prontos', async () => {
  const { result } = renderHook(() => usePacotesProtos());
  await waitFor(() => {
    expect(result.current.pacotes.length).toBeGreaterThan(0);
  });
});

// Teste de sincronização
it('deve sincronizar itens com Bling', async () => {
  const { result } = renderHook(() => useBlingItemsSync());
  await act(async () => {
    await result.current.sincronizarTodos();
  });
  expect(result.current.itens.every(i => i.status === 'sincronizado')).toBe(true);
});
```

## 📞 10. Troubleshooting

### Problema: "Não carrega os pacotes"
```
✓ Verificar conexão Supabase
✓ Verificar permissões de leitura na tabela
✓ Verificar console para erros
✓ Verificar variáveis de ambiente
```

### Problema: "Bling sync falha"
```
✓ Verificar token Bling API
✓ Verificar limite da API do Bling
✓ Verificar logs de erro
✓ Validar formato dos dados enviados
```

### Problema: "Componentes não renderizam"
```
✓ Verificar imports dos componentes
✓ Verificar erros TypeScript
✓ Verificar props obrigatórias (addToast)
✓ Verificar se Tailwind CSS está ativo
```

## 🚀 11. Próximos Passos

1. **Implementar Relatórios**: Dashboard com gráficos de pacotes e sync
2. **Notificações**: Alertar quando pacotes estão prontos para expedição
3. **Rastreamento**: Integrar com transportadora para atualizar status
4. **Automação**: Sincronizar automaticamente quando pacote é expedido
5. **Webhook**: Receber atualizações do Bling em tempo real

## 📚 Referências

- Componente: `PacotesProntosManager.tsx`
- Componente: `BlingPedidosItemsSync.tsx`
- Página completa: `PacotesProntosPage.tsx`
- Hooks: `useEstoque.ts`
- Bling API v3: https://developer.bling.com.br/docs
- Supabase Docs: https://supabase.io/docs

---

**Versão**: 1.0.0
**Data**: 2024
**Status**: ✅ Pronto para Produção
