# 🏗️ ARQUITETURA TÉCNICA - DANFE + ETIQUETA REAL

## 🔄 Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USUÁRIO ACESSA A PÁGINA                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                    AbaDanfeEtiquetaProntoUso.tsx                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Apresenta:                                                         │   │
│  │  • Botões: [Shopee] [Mercado Livre]                               │   │
│  │  • Instruções                                                       │   │
│  │  • FAQ                                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
                      CLICA EM [Shopee]
                                  ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                 ModalDanfeEtiquetaReal.tsx                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ESTADO 1: Seleção                                                  │   │
│  │  • Seletor: [ - ]  [10]  [ + ]                                     │   │
│  │  • Botão: [🔄 Buscar com Etiqueta REAL]                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
              CLICA [🔄 Buscar com Etiqueta REAL]
                                  ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│        danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel()   │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 1: Busca inicial no Bling API                                │  │
│  │  GET /api/v3/pedidos/vendas?marketplace=SHOPEE&limite=10           │  │
│  │  └→ Retorna: [...pedidos básicos...]                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  PARA CADA PEDIDO:                                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 2: Busca DETALHES do pedido no Bling API                     │  │
│  │  GET /api/v3/pedidos/vendas/{numero}                               │  │
│  │  └→ Retorna: {                                                       │  │
│  │              numero,                                                 │  │
│  │              rastreamento,  ← ETIQUETA REAL!                       │  │
│  │              cliente,                                                │  │
│  │              itens,                                                  │  │
│  │              ...                                                     │  │
│  │            }                                                         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 3: Validação                                                  │  │
│  │  SE tem rastreamento?                                                │  │
│  │    SIM  → continua                                                   │  │
│  │    NÃO  → PULA (não processa este pedido)                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  PARA CADA ITEM DO PEDIDO:                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 4: Busca SKU vinculado no Supabase                           │  │
│  │  SELECT * FROM skus_vinculados                                      │  │
│  │    WHERE skuEtiqueta = {skuEtiqueta}                                │  │
│  │       OR codigo = {codigo}                                          │  │
│  │  └→ Retorna: { id, codigo, nome } ou null                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 5: Mapeia itemPedidoComSKU                                    │  │
│  │  {                                                                   │  │
│  │    descricao: "Camiseta Azul",                                      │  │
│  │    skuEtiqueta: "5481923",        ← Da Shopee                      │  │
│  │    skuPrincipal: "CAMI-001",      ← Do ERP (se encontrado)         │  │
│  │    quantidade: 1,                                                    │  │
│  │    codigo: "5481923"                                                │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  RESULTADO RETORNADO:                                                │  │
│  │  {                                                                   │  │
│  │    pedidos: [...]  ← array com pedidos mapeados                    │  │
│  │    comEtiqueta: 9,                                                  │  │
│  │    semEtiqueta: 1  ← pedidos que pularam (sem rastreamento)       │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
              MODAL MOSTRA RESULTADOS:
              ✅ 9 Pedido(s) COM Etiqueta REAL
                                  ↓
              USUÁRIO CLICA [Processar]
                                  ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│        danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta()   │
│                                                                              │
│  PARA CADA PEDIDO COM ETIQUETA:                                            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 1: Gera DANFE Simplificado                                    │  │
│  │  const danfe = gerarDanfeSimplificado(pedido)                        │  │
│  │                                                                       │  │
│  │  Resultado:                                                           │  │
│  │  ╔════════════════════════════════════════════════════╗             │  │
│  │  ║          DANFE SIMPLIFICADO                       ║             │  │
│  │  ║                                                   ║             │  │
│  │  ║ Pedido #12345                                    ║             │  │
│  │  ║ Cliente: João da Silva                          ║             │  │
│  │  ║                                                   ║             │  │
│  │  ║ Itens:                                           ║             │  │
│  │  ║ 1. Camiseta [SKU: CAMI-001] [COD: 5481923]      ║             │  │
│  │  ║    Qtd: 1 x R$ 49.90                            ║             │  │
│  │  ╚════════════════════════════════════════════════════╝             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 2: Extrai etiqueta REAL do Bling                              │  │
│  │  etiqueta = pedido.rastreamento (REAL, não simulado)                 │  │
│  │  codigoBarras = ||Sr123456789BR||                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 3: Monta conteúdo consolidado                                 │  │
│  │  const conteudo = montarConteudoConsolidado(danfe, pedido)          │  │
│  │                                                                       │  │
│  │  Resultado:                                                           │  │
│  │  ╔════════════════════════════════════════════════════╗             │  │
│  │  ║          DANFE SIMPLIFICADO                       ║             │  │
│  │  ║  [dados do DANFE acima]                          ║             │  │
│  │  ╚════════════════════════════════════════════════════╝             │  │
│  │                                                                       │  │
│  │  ╔════════════════════════════════════════════════════╗             │  │
│  │  ║     ETIQUETA REAL DO BLING (Origem: SHOPEE)     ║             │  │
│  │  ║                                                   ║             │  │
│  │  ║  Rastreio: SR123456789BR                        ║             │  │
│  │  ║  Código de Barras: ||SR123456789BR||            ║             │  │
│  │  ╚════════════════════════════════════════════════════╝             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 4: Salva arquivo                                              │  │
│  │  arquivo = danfe-etiqueta-12345.txt                                 │  │
│  │  conteudo = [conteúdo consolidado acima]                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  PASSO 5: Audit Log                                                  │  │
│  │  INSERT INTO audit_logs {                                            │  │
│  │    acao: 'DANFE_ETIQUETA_PROCESSADO',                               │  │
│  │    dados: {                                                           │  │
│  │      idBling: "12345",                                              │  │
│  │      marketplace: "SHOPEE",                                          │  │
│  │      itensComSKU: [                                                  │  │
│  │        { descricao: "Camiseta", skuEtiqueta: "5481923", skuPrincipal: "CAMI-001" }  │  │
│  │      ],                                                               │  │
│  │      etiquetaDisponivel: true,                                      │  │
│  │      rastreio: "SR123456789BR"                                      │  │
│  │    }                                                                  │  │
│  │  }                                                                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                 ↓                                            │
│  RESULTADO: { arquivo, sucesso: true }                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
                  TODOS OS ARQUIVOS COLETADOS
                                  ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                      Cria arquivo ZIP                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  danfe-etiqueta-12345.txt                                           │  │
│  │  danfe-etiqueta-12346.txt                                           │  │
│  │  danfe-etiqueta-12347.txt                                           │  │
│  │  danfe-etiqueta-12348.txt                                           │  │
│  │  danfe-etiqueta-12349.txt                                           │  │
│  │  danfe-etiqueta-12350.txt                                           │  │
│  │  danfe-etiqueta-12351.txt                                           │  │
│  │  danfe-etiqueta-12352.txt                                           │  │
│  │  danfe-etiqueta-12353.txt                                           │  │
│  │  relatorio-processamento.txt           ← Com totais e erros        │  │
│  │  └→ danfe-etiqueta-123456789.zip       ← Compactado                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  ↓
            MODAL MOSTRA RESULTADO FINAL
            ┌──────────────────────────┐
            │  ✅ PROCESSAMENTO OK     │
            │  Total:    9 pedidos     │
            │  ✅ Sucesso: 9           │
            │  ❌ Erros:   0           │
            │                          │
            │  [📥 Baixar ZIP]         │
            │  [📋 Baixar Relatório]   │
            └──────────────────────────┘
                                  ↓
            USUÁRIO BAIXA O ZIP E IMPRIME!
```

---

## 📊 Estrutura de Banco de Dados

### Tabela: `audit_logs` (Supabase)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id TEXT,
  acao TEXT NOT NULL,  -- "DANFE_ETIQUETA_PROCESSADO"
  descricao TEXT,
  dados JSONB,          -- { idBling, marketplace, itensComSKU, ... }
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Exemplo de inserção:
INSERT INTO audit_logs (usuario_id, acao, dados) VALUES (
  'usuario_123',
  'DANFE_ETIQUETA_PROCESSADO',
  '{
    "idBling": "12345",
    "marketplace": "SHOPEE",
    "itensComSKU": [
      {"descricao": "Camiseta", "skuEtiqueta": "5481923", "skuPrincipal": "CAMI-001"}
    ],
    "etiquetaDisponivel": true,
    "rastreio": "SR123456789BR",
    "dataProcessamento": "2026-03-09T14:25:30Z"
  }'::jsonb
);
```

### Tabela: `skus_vinculados` (Supabase - Opcional)

```sql
CREATE TABLE skus_vinculados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  skuEtiqueta TEXT NOT NULL,      -- Da Shopee (5481923)
  codigo TEXT NOT NULL,            -- Código do produto no ERP
  nome TEXT,                       -- Nome do produto no ERP
  marketplace TEXT,                -- SHOPEE / MERCADO_LIVRE
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Exemplos:
INSERT INTO skus_vinculados (skuEtiqueta, codigo, nome, marketplace) VALUES
  ('5481923', 'CAMI-001', 'Camiseta Azul', 'SHOPEE'),
  ('5481924', 'CALC-002', 'Calça Preta', 'SHOPEE'),
  ('5481925', 'TENIS-003', 'Tênis Branco', 'MERCADO_LIVRE');
```

---

## 🔌 Componentes Inter-relacionados

```
┌────────────────────────────────────────────────────────────────────┐
│                    Frontend (React)                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────┐      ┌──────────────────────────────┐   │
│  │ AbaDanfeEtiqueta     │      │ ModalDanfeEtiquetaReal       │   │
│  │ ProntoUso.tsx        │─────→│                              │   │
│  │                      │      │ • Seleção de quantidade      │   │
│  │ • Botões Shopee      │      │ • Busca de pedidos           │   │
│  │ • Instruções         │      │ • Processamento              │   │
│  │ • FAQ                │      │ • Download                   │   │
│  │ • Mount Modal        │      │ • Relatório                  │   │
│  └──────────────────────┘      └──────────────────────────────┘   │
│           ↓                              ↓                         │
│           └──────────────────┬───────────┘                         │
│                              ↓                                     │
│        ┌─────────────────────────────────────────┐                │
│        │ danfeSimplificadoComEtiquetaService.ts │                │
│        │                                         │                │
│        │ • buscarPedidosComEtiquetaDisponivel() │                │
│        │ • buscarSkuVinculado()                  │                │
│        │ • gerarDanfeSimplificado()              │                │
│        │ • montarConteudoConsolidado()           │                │
│        │ • processarPedidosParaDanfeEtiqueta()  │                │
│        │ • criarZipArquivos()                    │                │
│        └─────────────────────────────────────────┘                │
│                    ↓                ↓                              │
│           ┌────────┴────────┐       │                              │
│           ↓                 ↓       ↓                              │
│    ┌─────────────┐   ┌──────────────────┐                        │
│    │ Fetch API   │   │ supabaseClient   │                        │
│    └─────────────┘   └──────────────────┘                        │
└────────────────────────────────────────────────────────────────────┘
           ↓                        ↓
┌──────────────────────────────────────────────────────────────────┐
│                      Backend & External APIs                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────┐                │
│  │ Bling API v3                               │                │
│  │ https://api.bling.com.br/api/v3            │                │
│  │                                             │                │
│  │ GET /pedidos/vendas                        │                │
│  │     └→ Busca lista de pedidos              │                │
│  │                                             │                │
│  │ GET /pedidos/vendas/{numero}               │                │
│  │     └→ Busca detalhes (com rastreamento)   │                │
│  └────────────────────────────────────────────┘                │
│                      ↑                                           │
│                      │ fetch(url, { headers: { 'Authorization': 'Bearer {token}' } })     │
│                      │                                           │
│  ┌────────────────────────────────────────────┐                │
│  │ Supabase PostgreSQL                        │                │
│  │                                             │                │
│  │ Tables:                                     │                │
│  │ • audit_logs (Audit de processamentos)     │                │
│  │ • skus_vinculados (Mapeamento SKU)         │                │
│  │                                             │                │
│  │ Queries:                                    │                │
│  │ • SELECT * FROM skus_vinculados WHERE...  │                │
│  │ • INSERT INTO audit_logs ...               │                │
│  └────────────────────────────────────────────┘                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Variáveis Importantes

### Do Bling API:

```typescript
interface PedidoBlingSemDetalhes {
  numero: string;           // #12345
  descricao: string;        // ??? (ignorado)
  dataEmissao: string;      // 2026-03-09
  datalancamento: string;   // 2026-03-09
}

interface Pedidobling {
  numero: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
    endereco: {
      rua: string;
      numero: string;
      bairro: string;
      cep: string;
      cidade: string;
      estado: string;
    };
  };
  itens: Array<{
    descricao: string;
    codigo: string;
    quantidade: number;
    valor: number;
  }>;
  
  // ← IMPORTANTES:
  rastreamento: string;     // ETIQUETA REAL! Ex: "SR123456789BR"
  marketplace: string;      // "SHOPEE" ou "MERCADO_LIVRE"
  dataEmissao: string;
  valor: number;
}
```

### Do Supabase:

```typescript
interface SkuVinculado {
  id: string;              // UUID
  skuEtiqueta: string;    // "5481923" (da Shopee)
  codigo: string;         // "CAMI-001" (do ERP)
  nome: string;           // "Camiseta Azul"
  marketplace: string;    // "SHOPEE"
  criado_em: string;      // ISO timestamp
}
```

### Mapeado Localmente:

```typescript
interface ItemPedidoComSKU {
  descricao: string;        // "Camiseta Azul"
  skuEtiqueta: string;      // "5481923" (via Bling)
  skuPrincipal?: string;    // "CAMI-001" (via Supabase)
  quantidade: number;       // 1
  valorUnitario: number;    // 49.90
  codigo?: string;          // "5481923"
}

interface PedidoComEtiqueta {
  numero: string;           // "#12345"
  idBling: string;          // "12345"
  cliente: { ... };
  itens: ItemPedidoComSKU[];
  marketplace: "SHOPEE" | "MERCADO_LIVRE" | "SITE";
  rastreio: string;         // "SR123456789BR" (REAL!)
  
  etiqueta: {
    conteudoRealBling: string;     // Conteúdo que veio do Bling
    codigoBarrasRastreio: string;   // "||SR123456789BR||"
    disponivel: boolean;           // true (porque tem rastrramento)
    dataGeracaoBling: string;       // timestamp
  };
  
  dataCompra: string;
  valor: number;
}
```

---

## 🔄 Fluxo de Validação

```
ENTRADA: { token, quantidade, marketplace }
    ↓
┌─────────────────────────────────┐
│ Validar Token Bling?            │
│ ✓ Válido → Continua            │
│ ✗ Inválido → Erro              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Buscar Pedidos no Bling?        │
│ ✓ Retornou dados → Continua    │
│ ✗ Erro na API → Erro           │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Para cada pedido:               │
│                                 │
│ Tem rastreamento?              │
│ ✓ Sim → Processa               │
│ ✗ Não → PULA                   │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Para cada item:                 │
│                                 │
│ Buscar SKU vinculado?           │
│ ✓ Encontrado → Usa              │
│ ✗ Não encontrado → Continua    │
│    (mostra "N/A")               │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Gerar DANFE?                    │
│ ✓ Sucesso → Arquivo criado     │
│ ✗ Erro → Registra erro         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Consolidar com Etiqueta?        │
│ ✓ Sucesso → Arquivo consolidado│
│ ✗ Erro → Registra erro         │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│ Criar ZIP?                      │
│ ✓ Sucesso → ZIP criado         │
│ ✗ Erro → Retorna erro          │
└─────────────────────────────────┘
    ↓
SAÍDA: { arquivo, relatório, stats }
```

---

## ⚙️ Performance Esperada

```
Para 10 pedidos:
├─ Busca inicial (GET /pedidos): 1-2 segundos
├─ Busca detalhes (10x GET /pedidos/{id}): 3-5 segundos
├─ Queries SKU (10 itens, média): 1 segundo
├─ Gerar DANFE (10 arquivos): 1-2 segundos
├─ Consolidar + ZIP: 1 segundo
└─ TOTAL: ~8-11 segundos

Para 100 pedidos:
├─ Busca inicial (GET /pedidos): 1-2 segundos
├─ Busca detalhes (100x GET /pedidos/{id}): 20-40 segundos
├─ Queries SKU (100+ itens): 3-5 segundos
├─ Gerar DANFE (100 arquivos): 5-10 segundos
├─ Consolidar + ZIP: 2-3 segundos
└─ TOTAL: ~35-60 segundos

⚠️ Dica: Para 100+, considere usando paginação ou processamento assíncrono
```

---

## 🎯 Pontos Críticos

1. **Token Bling:** Deve ser válido e com permissões de leitura
2. **Rastreamento:** Deve existir no Bling (vem da Shopee)
3. **SKU Vinculado:** Opcional (se não encontrar, continua mesmo assim)
4. **Arquivo ZIP:** Requer espaço em memória (cuidado com muitos pedidos)

---

**Versão:** 1.0  
**Data:** 9 de março de 2026
