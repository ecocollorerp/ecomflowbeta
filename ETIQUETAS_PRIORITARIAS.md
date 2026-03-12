# 🎫 Etiquetas Prioritárias - Guia de Implementação

## Visão Geral

O sistema de **Etiquetas Prioritárias** fornece um fluxo completo e rastreável para gerar etiquetas de envio direto do Bling, a partir de pedidos com NF-e emitida.

## 🔄 Fluxo Completo

```
1. Pedidos de Vendas Importados
   ↓ (com dados: Número Bling, Loja Virtual, Canal)
2. Criar e Emitir NF-e
   ↓
3. Selecionar Pedidos na Aba "Etiquetas Prioritárias"
   ↓
4. Gerar Etiquetas REAIS do Bling (não fake)
   ↓
5. Escolher Opção:
   ├─→ Processar → Vai para ZPL/Etiquetas
   ├─→ Baixar no PC → Download como TXT
   └─→ Salvar em ZPL → Armazenar no banco por lote
   ↓
6. Armazenagem em ZPL:
   ├─→ Organizado por LOTE da NF-e
   ├─→ Rastreabilidade completa
   └─→ Possibilidade de reabrir e regenerar
```

## 📦 Arquivos Criados

### 1. **Componentes**
- `components/EtiquetasPrioritarias.tsx` - Componente principal com 4 abas:
  - 📦 **Seleção de Pedidos**: Lista todos os pedidos com NF-e emitida
  - 🎫 **Geração de Etiquetas**: 3 opções de processamento
  - 📁 **Armazenagem ZPL**: Visualizar etiquetas armazenadas por lote
  - 📜 **Histórico**: Relatório completo com estatísticas

### 2. **Serviços**
- `services/etiquetasPrioritariasService.ts` - Serviço principal com métodos:
  - `buscarEtiquetaBlingReal()`: Buscar etiqueta real do Bling
  - `converterParaZPL()`: Converter para formato de impressora térmica
  - `salvarEtiquetaZPL()`: Armazenar no banco (ZPL)
  - `salvarEtiquetaArquivo()`: Salvar como arquivo (PC)
  - `reabrirEtiqueta()`: Reabrir para regenerar
  - `listarPorLote()`: Listar etiquetas por lote
  - `gerarRelatorio()`: Gerar relatório por período

### 3. **Hooks**
- `hooks/useEtiquetasPrioritarias.ts` - Hook customizado com:
  - Estado de etiquetas
  - Todas as ações do serviço
  - Agregações (por lote, por canal)
  - Carregamento automático

### 4. **Banco de Dados**
- `migrations/etiquetas_prioritarias.sql` - Migration completa com:
  - Tabela `etiquetas_prioritarias`
  - Índices de performance
  - RLS (Row Level Security)
  - Views úteis (por lote, por canal, por loja)
  - Triggers de auditoria

## 🚀 Como Integrar

### Passo 1: Executar a Migration

No Supabase SQL Editor, copie e execute o conteúdo de `migrations/etiquetas_prioritarias.sql`.

```sql
-- Copiar todo o conteúdo do arquivo .sql
-- Executar no Supabase SQL Editor
```

### Passo 2: Adicionar ao App.tsx

```tsx
import { EtiquetasPrioritarias } from './components/EtiquetasPrioritarias';

// Dentro de suas abas/rotas principais:
{abaAtiva === 'etiquetas-prioritarias' && (
  <EtiquetasPrioritarias 
    token={tokenBling} 
    addToast={addToast} 
  />
)}
```

### Passo 3: Adicionar ao Menu/Navegação

```tsx
{
  id: 'etiquetas-prioritarias',
  label: '🎫 Etiquetas Prioritárias',
  icon: Truck,
  description: 'Gerar e gerenciar etiquetas do Bling por lote',
}
```

## 💾 Estrutura de Dados

### Tabela: `etiquetas_prioritarias`

```sql
{
  id: UUID,                    -- Identificador único
  pedido_id: TEXT,             -- ID do pedido
  numero_bling: TEXT,          -- Número do pedido no Bling
  nfe_lote: TEXT,              -- Lote da NF-e (agrupador)
  data_geracao: TIMESTAMPTZ,   -- Data de criação
  
  -- Status
  status_processamento: TEXT,  -- pending|processing|complete|saved_pc|error
  armazenagem: TEXT,           -- zpl|pc
  
  -- Conteúdo
  conteudo_zpl: TEXT,          -- Formato ZPL para impressora
  conteudo_txt: TEXT,          -- Formato TXT
  caminho_arquivo: TEXT,       -- Caminho se salvo no PC
  
  -- Rastreabilidade (JSONB)
  rastreabilidade: {
    numeroBling: STRING,
    lojaVirtual: STRING,
    canalVendas: STRING        -- MERCADO_LIVRE|SHOPEE|SITE|etc
  },
  
  -- Metadados (JSONB)
  metadados: {
    codeRastreamento: STRING,
    destinatario: STRING,
    transportadora: STRING
  },
  
  -- Auditoria
  criado_por: TEXT,
  atualizado_em: TIMESTAMPTZ,
  atualizado_por: TEXT
}
```

## 🔍 Rastreabilidade Completa

Cada etiqueta mantém:

- ✅ **Número do Bling**: Identificação do pedido
- ✅ **Loja Virtual**: De onde veio o pedido
- ✅ **Canal de Vendas**: MERCADO_LIVRE, SHOPEE, SITE, etc
- ✅ **Lote da NF-e**: Agrupamento para controle
- ✅ **Data de Geração**: Timestamp completo
- ✅ **Status de Processamento**: Acompanhamento
- ✅ **Tipo de Armazenagem**: ZPL ou PC
- ✅ **Código de Rastreamento**: Do transportador

## 📊 Views Úteis

### `etiquetas_por_lote`
```sql
SELECT * FROM etiquetas_por_lote;
-- Resumo de etiquetas agrupadas por lote
```

### `etiquetas_por_canal`
```sql
SELECT * FROM etiquetas_por_canal;
-- Distribuição de etiquetas por canal de venda
```

### `etiquetas_por_loja`
```sql
SELECT * FROM etiquetas_por_loja;
-- Distribuição de etiquetas por loja virtual
```

### `resumo_rastreabilidade`
```sql
SELECT * FROM resumo_rastreabilidade;
-- Visão completa de rastreabilidade
```

## 🔧 Usando o Hook

```tsx
import { useEtiquetasPrioritarias } from '../hooks/useEtiquetasPrioritarias';

function MyComponent() {
  const {
    etiquetas,
    isCarregando,
    carregarEtiquetas,
    buscarEtiquetaBling,
    salvarEtiqueta,
    gerarRelatorio,
    totalEtiquetas,
    etiquetasPorLote,
  } = useEtiquetasPrioritarias();

  // Usar os dados e ações
}
```

## 🎯 Casos de Uso

### 1. Gerar Etiqueta de Um Pedido
```tsx
const etiquetaBling = await buscarEtiquetaBling('12345', tokenBling);
const zpl = gerarEtiquetaZPL(etiquetaBling, pedidoInfo);
await salvarEtiqueta({
  pedidoId: 'xyz',
  numeroBling: '12345',
  nfeLote: 'LOTE-001',
  dataGeracao: new Date().toISOString(),
  statusProcessamento: 'concluido',
  armazenagem: 'zpl',
  conteudoZpl: zpl,
  rastreabilidade: {
    numeroBling: '12345',
    lojaVirtual: 'loja1',
    canalVendas: 'MERCADO_LIVRE'
  }
});
```

### 2. Listar Etiquetas de Um Lote
```tsx
const etiquetasLote = await carregarPorLote('LOTE-001');
console.log(`${etiquetasLote.length} etiquetas no lote`);
```

### 3. Gerar Relatório
```tsx
const relatorio = await gerarRelatorio('2024-01-01', '2024-01-31');
console.log(`Total: ${relatorio.totalEtiquetas}`);
console.log(`Processadas: ${relatorio.processadas}`);
console.log(`Por lote:`, relatorio.porLote);
console.log(`Por canal:`, relatorio.porCanal);
```

## ⚙️ Configuração

### Variáveis de Ambiente Necessárias
```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_anon_key
VITE_BLING_TOKEN=seu_token_bling (opcional, usualmente vem do usuário)
```

### Token do Bling
Certifique-se de que o token está configurado corretamente nas configurações da aplicação.

## 🧪 Testes

### Testar Busca de Etiqueta do Bling
```tsx
const resultado = await etiquetasPrioritariasService.buscarEtiquetaBlingReal(
  '123456',  // número do pedido
  'seu_token_bling'
);

if (resultado.sucesso) {
  console.log('Etiqueta encontrada:', resultado.etiqueta);
} else {
  console.error('Erro:', resultado.erro);
}
```

### Testar Geração de ZPL
```tsx
const zpl = EtiquetasPrioritariasService.converterParaZPL(
  {
    cliente: { nome: 'João Silva' },
    endereco: { rua: 'Av. Principal', numero: '123', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', cep: '01310-100' },
    rastreamento: 'BR123456789',
    transportadora: 'Sedex'
  },
  {
    numero: '12345',
    nfeNumero: 'NF-001',
    nfeLote: 'LOTE-001',
    lojaVirtual: 'loja1',
    canalVendas: 'MERCADO_LIVRE'
  }
);

console.log(zpl); // Formato ZPL completo
```

## 📱 Interface do Usuário

### Aba 1: Seleção de Pedidos
- Lista de pedidos com NF-e emitida
- Filtro por número, cliente, loja ou canal
- Checkbox para seleção múltipla
- Informações de rastreabilidade visíveis

### Aba 2: Geração de Etiquetas
- 3 opcões de processamento em cards
- Status de processamento em tempo real
- Informações que serão geradas

### Aba 3: Armazenagem ZPL
- Tabela com etiquetas organizadas por lote
- Filtro por lote, número ou loja
- Possibilidade de abrir detalhes
- Regeneração de etiquetas

### Aba 4: Histórico
- Dashboard com estatísticas (total, processadas, em PC, em ZPL)
- Tabela histórico completo
- Informações de rastreabilidade visíveis
- Datas de geração

## 🔐 Segurança

- **RLS Habilitado**: Apenas usuários autenticados podem acessar
- **Dados Sensíveis**: Rastreamento armazenado como JSONB
- **Auditoria**: Campos `criado_por` e `atualizado_por` para rastreamento
- **Validação**: Constraints de status e armazenagem

## 🚨 Troubleshooting

### Etiqueta não é encontrada no Bling
- Verificar se o número do pedido está correto
- Verificar se o token Bling está válido
- Verificar se o pedido tem transporte configurado

### ZPL não gera corretamente
- Verificar se o endereço está completo
- Verificar se o rastreamento está preenchido
- Verificar formato dos dados

### Erro ao salvar no banco
- Verificar se a migration foi executada
- Verificar políticas de RLS
- Verificar conexão com Supabase

## 📚 Referências

- [Zebra ZPL Documentation](https://www.zebra.com/us/en/products/printer-supplies/labels-media/thermal-label-media.html)
- [Bling API V3](https://developer.bling.com.br/api)
- [Supabase Docs](https://supabase.com/docs)

## 📝 Changelog

### v1.0.0 (2024-03-12)
- ✅ Componente EtiquetasPrioritarias criado
- ✅ Serviço especializado implementado
- ✅ Hook customizado criado
- ✅ Migration do banco criada
- ✅ Views de agregação criadas
- ✅ Documentação completa

## 🤝 Suporte

Para dúvidas ou problemas, consulte:
1. Este documento
2. Código comentado nos arquivos
3. Logs do console (ativados com 🔍 [ETIQUETA PRIORITÁRIA])
