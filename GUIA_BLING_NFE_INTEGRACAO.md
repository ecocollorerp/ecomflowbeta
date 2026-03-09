# 🎯 GUIA DE INTEGRAÇÃO BLING + NFe + AUDITORIA

## ✅ O QUE FOI IMPLEMENTADO (5 Componentes/Serviços)

### **1️⃣ DANFE Simplificada + Etiquetas de Envio** ✅
📁 `services/danfeService.ts`

**Funcionalidades:**
- Gera DANFE Simplificada em PDF (padrão NFe-e)
- Gera Etiqueta de Envio em PDF (4x6 polegadas - padrão Correios)
- Exportação separada ou combinada
- Inclui dados completos: cliente, itens, totais, rastreio

**Como usar:**
```typescript
import { gerarDANFESimplificada, gerarEtiquetaEnvio } from '@/services/danfeService';

const danfePdf = gerarDANFESimplificada(danfeData);
const etiquetaPdf = gerarEtiquetaEnvio(danfeData);

// Baixar
danfePdf.save('danfe.pdf');
etiquetaPdf.save('etiqueta.pdf');
```

---

### **2️⃣ Filtro por SKU em "Autorizado sem DANFE"** ✅
📁 `components/FiltroAutorisadoSemDANFE.tsx`

**Funcionalidades:**
- Filtra pedidos por SKU importado ou principal
- Valida SKU contra estoque local
- Ordena por data ou número
- Busca e seleção múltipla
- Permite gerar DANFE diretamente

**Como usar:**
```tsx
import FiltroAutorisadoSemDANFE from '@/components/FiltroAutorisadoSemDANFE';

<FiltroAutorisadoSemDANFE
  itens={pedidosAutorizados}
  stockItems={estoque}
  skuLinks={vinculos}
  onGerarDANFE={handleGerarDANFE}
  onProcessarPedidos={handleProcessar}
/>
```

**Validations:**
- ✅ SKU importado → valida contra sku_links
- ✅ SKU mestre → busca em stock_items
- ❌ SKU inválido → marca como erro
- 📊 Estatísticas em tempo real

---

### **3️⃣ Carregador de TODOS os Pedidos do Bling** ✅
📁 `services/blingBulkLoaderService.ts`

**Funcionalidades:**
- Paginação automática (sem limite hardcoded)
- Sincronização sem interferência
- Filtro por status (aberto, suspenso, etc)
- Busca por data/intervalo
- Agrupa por status
- Gera estatísticas

**Como usar:**
```typescript
import blingBulkLoaderService from '@/services/blingBulkLoaderService';

// Carregar TUDO
const { pedidos, total, carregou } = await blingBulkLoaderService.carregarTodosPedidos(token);

// Carregar apenas abertos
const abertos = await blingBulkLoaderService.carregarTodosPedidos(token, {
  status: 'aberto',
  limite: 200 // Seu limite preferido
});

// Por data
const porData = await blingBulkLoaderService.carregarPorData(token, '2026-03-01', '2026-03-09');

// Salvar no BD
const { salvos, erros } = await blingBulkLoaderService.salvarNoBancoDados(pedidos);

// Estatísticas
const stats = blingBulkLoaderService.gerarEstatisticas(pedidos);
// → { totalPedidos, totalValor, totalItens, clientesUnicos, statusDistribuicao }
```

**Filtros suportados:**
- Status (aberto, suspenso, cancelado, completado, processando)
- Data (dataInicio, dataFim)
- Sem DANFE: `carregarSemDANFE(token)`
- Com DANFE pendente: `carregarComDANFEPendente(token)`

---

### **4️⃣ Sistema de Auditoria JSON Diária** ✅
📁 `services/auditLogService.ts`

**Funcionalidades:**
- Registra TODAS operações (NFe, importação, Bling, etc)
- Persiste em database + localStorage
- Gera relatório JSON por dia
- Busca com filtros avançados
- Limpeza automática (30 dias)

**Como usar:**
```typescript
import { auditLogService } from '@/services/auditLogService';

// Registrar operação NFe
await auditLogService.registrarNFe(
  'Geração de DANFE',
  'geracao',
  'sucesso',
  { notaFiscalNumero: '123', pedidoNumero: 'ABC' },
  'usuario@email.com'
);

// Registrar importação
await auditLogService.registrarImportacao(
  'Importação Bling',
  'sincronizacao',
  'sucesso',
  {
    canal: 'BLING',
    totalPedidos: 150,
    totalItens: 450,
    valor: 15000.50
  }
);

// Gerar relatório do dia
const relatorio = await auditLogService.gerarRelatorioJSON('2026-03-09');
// → { data, versao, empresa, resumo, entradas[] }

// Exportar como JSON
const blob = await auditLogService.exportarJSON();

// Busca com filtro
const logs = await auditLogService.buscarPorFiltro({
  dataInicio: '2026-03-01',
  dataFim: '2026-03-09',
  modulo: 'nfe',
  resultado: 'sucesso'
});
```

**Relatório inclui:**
```json
{
  "data": "2026-03-09",
  "versao": "1.0",
  "empresa": "Your Company",
  "resumo": {
    "totalEntradas": 245,
    "sucessos": 240,
    "erros": 4,
    "avisos": 1,
    "operacoesPorModulo": {
      "nfe": 100,
      "importacao": 80,
      "danfe": 65
    }
  },
  "entradas": [...]
}
```

---

### **5️⃣ Busca Avançada de Cliente** ✅
📁 `components/BuscaAvancadaCliente.tsx`

**Funcionalidades:**
- Busca por: **CPF/CNPJ**, **Número Pedido Virtual**, **Número Pedido Bling**, **Número NFe**
- Normaliza documentos (remove caracteres especiais)
- Filtro por status (aberto, autorizado, cancelado)
- Seleção múltipla
- Exporta selecionados

**Como usar:**
```tsx
import BuscaAvancadaCliente from '@/components/BuscaAvancadaCliente';

<BuscaAvancadaCliente
  pedidos={todosPedidos}
  onSelecionarPedido={(pedido) => console.log(pedido)}
  onExportarSelecionados={(pedidos) => exportarJSON(pedidos)}
/>
```

**Tipos de busca:**
- `todos`: Todos os campos
- `cpf_cnpj`: Busca CPF/CNPJ (normaliza)
- `numero_pedido`: Número virtual OU Bling
- `nfe`: Número NFe
- `nome_cliente`: Nome exato

**Normalização:**
- CPF: `123.456.789-00` → `12345678900`
- Busca: insensível a maiúscula/minúscula e caracteres especiais

---

## 📦 MIGRAÇÕES SQL NECESSÁRIAS

### Migration 1: Campo Volátil Infinito
```sql
-- Arquivo: MIGRATION_ADD_VOLATILE_FIELD.sql
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS is_volatile_infinite BOOLEAN DEFAULT FALSE;
```

### Migration 2: Tabela de Auditoria
```sql
-- Arquivo: MIGRATION_CREATE_AUDIT_LOGS.sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ,
  usuario TEXT,
  acao TEXT,
  modulo TEXT,
  tipo TEXT,
  resultado TEXT,
  dados JSONB,
  erro JSONB
);
```

---

## 🚀 INTEGRAÇÃO RÁPIDA

### **1. Instalar dependências**
```bash
npm install jspdf recharts  # Se não tiver
```

### **2. Executar migrações**
- Supabase → SQL Editor
- Cole `MIGRATION_ADD_VOLATILE_FIELD.sql` → Run
- Cole `MIGRATION_CREATE_AUDIT_LOGS.sql` → Run

### **3. Usar em páginas existentes**

**Em `BlingPage.tsx`:**
```tsx
import { blingBulkLoaderService } from '@/services/blingBulkLoaderService';
import { auditLogService } from '@/services/auditLogService';

const carregarTodos = async () => {
  const { pedidos, total, carregou } = await blingBulkLoaderService.carregarTodosPedidos(token);
  
  // Registrar na auditoria
  await auditLogService.registrarBling(
    `Carregamento de ${carregou} pedidos`,
    'sincronizacao',
    'sucesso',
    { pedidosCarregados: carregou }
  );
  
  // Salvar no BD
  await blingBulkLoaderService.salvarNoBancoDados(pedidos);
};
```

**Em `DANFEManagerPage.tsx`:**
```tsx
import FiltroAutorisadoSemDANFE from '@/components/FiltroAutorisadoSemDANFE';
import { gerarDANFESimplificada } from '@/services/danfeService';

const handleGerarDANFE = (item: AutorizadoSemDANFEItem) => {
  const danfePdf = gerarDANFESimplificada(danfeData);
  danfePdf.save(`DANFE-${item.pedidoNumero}.pdf`);
  
  // Registrar
  await auditLogService.registrarDANFE(/* ... */);
};
```

**Em `ImporterPage.tsx`:**
```tsx
import BuscaAvancadaCliente from '@/components/BuscaAvancadaCliente';

<BuscaAvancadaCliente
  pedidos={pedidosCarregados}
  onSelecionarPedido={handleAbrirPedido}
/>
```

---

## 📊 EXEMPLOS DE DADOS

### Estrutura BlingPedido
```typescript
{
  id: 123456,
  numero: "PED-20260309-001",
  data: "2026-03-09T14:30:00",
  status: "aberto",
  cliente: {
    id: 789,
    nome: "João Silva",
    numeroDocumento: "123.456.789-00",
    email: "joao@email.com"
  },
  itens: [
    {
      id: 1,
      descricao: "Papel Parede Branco",
      codigo: "PPL-BRC-001",
      quantidade: 5,
      valor: 150.00
    }
  ],
  total: 750.00,
  notaFiscal: {
    numero: "123",
    chave: "35260312345678000123550010000001234567890123",
    status: "autorizada"
  }
}
```

### Estrutura AuditLog Diária
```json
{
  "data": "2026-03-09",
  "versao": "1.0",
  "empresa": "Sua Empresa",
  "resumo": {
    "totalEntradas": 325,
    "sucessos": 315,
    "erros": 8,
    "avisos": 2,
    "operacoesPorModulo": {
      "nfe": 150,
      "importacao": 100,
      "danfe": 75
    },
    "operacoesPorTipo": {
      "geracao": 150,
      "sincronizacao": 100,
      "atualizacao": 75
    }
  },
  "entradas": [
    {
      "id": "audit_...",
      "timestamp": "2026-03-09T09:15:30.123Z",
      "usuario": "admin@empresa.com",
      "acao": "Geração de DANFE - Pedido 123",
      "modulo": "danfe",
      "tipo": "geracao",
      "resultado": "sucesso",
      "dados": {
        "notaFiscalNumero": "123",
        "pedidoNumero": "PED-001",
        "quantidadeDocumentos": 2
      },
      "duracao_ms": 1250
    }
  ]
}
```

---

## ⚡ PRÓXIMAS INTEGRAÇÕES (Opcionais)

1. **Webhook do Bling**: Escutar eventos em tempo real
2. **API de Pesagem**: Conectar com balança digital
3. **Etiquetadora**: Impressão automática de etiquetas ZPL
4. **Dashboard em Tempo Real**: WebSocket para operações ao vivo
5. **Relatório Diário Automático**: Enviar por email

---

## 🆘 SUPORTE

Todos os serviços têm **console.log** para debug:
```tsx
// Ativar logs
localStorage.setItem('debug_mode', 'true');

// Ver requisições Bling
console.log('📥 Buscando página...');

// Ver auditoria
const logs = await auditLogService.buscarPorFiltro({ modulo: 'nfe' });
console.log(logs);
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Executar MIGRATION_ADD_VOLATILE_FIELD.sql
- [ ] Executar MIGRATION_CREATE_AUDIT_LOGS.sql
- [ ] Importar serviços em páginas necessárias
- [ ] Testar carregamento Bling
- [ ] Testar geração DANFE
- [ ] Testar auditoria diária
- [ ] Testar busca por CPF/CNPJ
- [ ] Configurar token Bling em app_settings
- [ ] Dados estão em JSON estruturado salvo no BD

---

**🎉 Tudo pronto para usar!**
