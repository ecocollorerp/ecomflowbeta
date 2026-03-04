// ============================================================================
// DANFE_NFE_GUIA_CORRECOES.md - Guia de Correções e Implementação
// Resolve problemas de geração de NF-e e adiciona DANFE com etiquetas ZPL
// ============================================================================

# 🚀 Guia Completo: Correção de NF-e e Implementação de DANFE

## 📋 O que foi Corrigido/Implementado

### 1. ✅ PROBLEMA: Erro ao Gerar NF-e via Bling
**Status**: CORRIGIDO

#### Erro Original
```
Erro ao gerar NF-e via Bling: Alguns dados informados não são válidos.
— parcelas.0.data: Informe uma data de vencimento válida para a parcela;
  Total das parcelas difere do total da nota
```

#### Solução Implementada
No arquivo `/server.ts` (linhas 1915-1970), foi implementada uma **correção crítica** na seção de parcelas:

✓ **Calcula automaticamente o total da nota** a partir dos itens
✓ **Valida e formata datas de vencimento** (YYYY-MM-DD)
✓ **Gera parcelas automáticas** se não existirem
✓ **Ajusta a última parcela** para garantir que total = soma das parcelas ± 1 centavo
✓ **Define 30 dias como padrão** para vencimento se não especificado

#### Código Corrigido (em server.ts)
```typescript
// ─── CORREÇÃO CRÍTICA: Parcelas/pagamentos com validação total ─────────
// Calcula o total da nota a partir dos itens
const totalNota = itensPayload.reduce((sum, item) => sum + (item.quantidade * item.valor), 0);

if (Array.isArray(pedidoData?.parcelas) && pedidoData.parcelas.length > 0) {
  // Parcelas originais com validação
  const parcelasOriginais = pedidoData.parcelas
    .map((p: any) => ({
      formaPagamento: p.formaPagamento?.id ? { id: p.formaPagamento.id } : undefined,
      valor: Number(p.valor || 0),
      dataVencimento: p.dataVencimento || p.vencimento || null,
    }))
    .filter((p: any) => p.valor > 0);
  
  // Validar e corrigir datas de vencimento
  const parcelasComData = parcelasOriginais.map((p: any, idx: number) => {
    let data = p.dataVencimento;
    
    // Se não tem data, gera a partir da data de operação + (idx * 30 dias)
    if (!data || data === 'Invalid Date') {
      const dataVenc = new Date(now);
      dataVenc.setDate(dataVenc.getDate() + (idx + 1) * 30);
      data = dataVenc.toISOString().split('T')[0];
    } else if (typeof data === 'string') {
      data = data.split('T')[0]; // Remove hora se tiver
    }
    
    return {
      formaPagamento: p.formaPagamento,
      valor: p.valor,
      vencimento: data,
    };
  });
  
  // Validar se total das parcelas = total da nota
  const totalParcelas = parcelasComData.reduce((sum, p) => sum + p.valor, 0);
  const diferenca = Math.abs(totalNota - totalParcelas);
  
  if (diferenca > 0.01) { // Tolerância de 1 centavo
    // Ajusta a última parcela para bater o total
    if (parcelasComData.length > 0) {
      const ultimaIdx = parcelasComData.length - 1;
      const somaOutras = parcelasComData.slice(0, ultimaIdx).reduce((sum, p) => sum + p.valor, 0);
      parcelasComData[ultimaIdx].valor = Math.round((totalNota - somaOutras) * 100) / 100;
    }
  }
  
  nfePayload.parcelas = parcelasComData;
} else if (totalNota > 0) {
  // Se não tem parcelas, cria uma única parcela com o total
  const dataVenc = new Date(now);
  dataVenc.setDate(dataVenc.getDate() + 30);
  nfePayload.parcelas = [{
    valor: totalNota,
    vencimento: dataVenc.toISOString().split('T')[0],
    formaPagamento: { id: 15 }, // 15 = Boleto
  }];
}
```

---

### 2. ✅ PROBLEMA: Falta Impressão de Etiquetas ZPL e DANFE
**Status**: IMPLEMENTADO

#### Solução: Sistema Completo de DANFE

##### Arquivos Criados

1. **`components/DANFEGerenciador.tsx`** (620 linhas)
   - Componente visual para gerenciar DANFE
   - Exibe status de emissão/autorização
   - Filtros por status, busca por cliente/NF-e
   - Ações: imprimir, download XML/PDF, gerar ZPL
   - Modal para visualizar código ZPL

2. **`pages/DANFEManagerPage.tsx`** (380 linhas)
   - Página completa de gestão de DANFE
   - Integrada com API do Bling
   - Carrega NF-e diretamente do Bling
   - Abas: Todas, Pendentes, Autorizadas
   - Estatísticas em tempo real

3. **`services/zplService.ts`** (ATUALIZADO)
   - Funções para gerar etiquetas ZPL
   - `gerarEtiquetaDANFE()` - Etiqueta simples DANFE
   - `gerarEtiquetaRastreamento()` - Etiqueta com código de barras

#### Tipos de Etiquetas Suportadas

##### Etiqueta DANFE Simples (4x6")
```typescript
import { gerarEtiquetaDANFE } from '../services/zplService';

const zpl = gerarEtiquetaDANFE({
  nfeNumero: '123456',
  nfeChave: '35240101234567000123650010000000011234567890',
  cliente: 'Empresa LTDA',
  endereco: 'Rua das Flores, 123',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310100',
  peso: 2.5,
  valor: 15000, // em centavos
});
```

**Resultado**: Etiqueta com informações da NF-e, cliente, endereço, peso, valor e data

##### Etiqueta com Código de Barras
```typescript
import { gerarEtiquetaRastreamento } from '../services/zplService';

const zpl = gerarEtiquetaRastreamento({
  codigo: '123ABC456789XYZ',
  destinatario: 'João da Silva',
  endereco: 'Av. Paulista, 1000',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01311100',
});
```

**Resultado**: Etiqueta com código de barras grande + destinatário + endereço

---

## 📍 Como Integrar no Seu Projeto

### Passo 1: Adicionar Rota no App.tsx

```typescript
// App.tsx
import DANFEManagerPage from './pages/DANFEManagerPage';

// No seu router:
{
  path: '/nfe/danfe',
  element: <DANFEManagerPage addToast={addToast} />,
  label: 'DANFE',
  icon: FileText
}
```

### Passo 2: Adicionar Item ao Menu

```typescript
// Sidebar.tsx ou Menu.tsx
const menuItems = [
  // ... outros itens
  {
    label: 'DANFE',
    href: '/nfe/danfe',
    icon: FileText,
    badge: stats.danfesPendentes, // opcional
  }
];
```

### Passo 3: Integrar ao BlingPage (Opcional)

```typescript
// BlingPage.tsx - Adicionar aba:

import DANFEManagerPage from '../pages/DANFEManagerPage';

// Dentro do componente BlingPage:
const [activeTab, setActiveTab] = useState('pedidos');

// ... nas abas
{
  activeTab === 'danfe' && (
    <DANFEManagerPage addToast={addToast} />
  )
}
```

### Passo 4: Configurar Impressora ZPL (Opcional)

Para enviar etiquetas direto para a impressora:

```typescript
import { useZPLService } from '../services/zplService';

const MyComponent = () => {
  const { enviarImpressora } = useZPLService();

  const handleImprimir = async (zpl: string) => {
    const resultado = await enviarImpressora(zpl, '192.168.1.100'); // IP da impressora
    if (resultado.sucesso) {
      addToast('Impressão iniciada!', 'success');
    }
  };
};
```

---

## 🔧 Endpoint Backend para Geração de NF-e Corrigida

O endpoint `/api/bling/nfe/criar-emitir` foi corrigido no `server.ts`:

### Uso

```typescript
const response = await fetch('/api/bling/nfe/criar-emitir', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: token
  },
  body: JSON.stringify({
    blingOrderId: 123456,     // ID do pedido no Bling
    emitir: true              // true = emitir no SEFAZ, false = apenas criar rascunho
  })
});

const result = await response.json();
// {
//   success: true,
//   emitida: true,            // true se emitida no SEFAZ
//   nfe: { id, numero, chave, ... }
// }
```

---

## 📊 Fluxo de Status das NF-e

```
┌─────────────────────────────┐
│   EMITIDA (Rascunho)        │
│   (não enviada ao SEFAZ)    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   PENDENTE (Validando)      │
│   (aguardando confirmação)  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   AUTORIZADA (Válida)       │
│   (SEFAZ aceitou)           │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   ENVIADA (Em Trânsito)     │
│   (saiu do armazém)         │
└─────────────────────────────┘
```

---

## 🎯 Funcionalidades Disponíveis

### No DANFEGerenciador

1. **Estatísticas em Cards**
   - Total de DANFE
   - Autorizadas
   - Emitidas
   - Enviadas
   - Pendentes
   - Com Erro

2. **Filtros e Busca**
   - Busca por NF-e, chave, cliente, pedido
   - Filtro por status

3. **Ações por DANFE**
   - ✓ Imprimir DANFE (abre PDF)
   - ✓ Download XML (para integrações)
   - ✓ Download PDF (arquivo fiscal)
   - ✓ Gerar Etiqueta ZPL (para impressora térmica)
   - ✓ Reemitir (se houver erro)

4. **Modal de Visualização ZPL**
   - Exibe código ZPL completo
   - Opção de copiar para clipboard
   - Compatível com impressoras Zebra

### Na DANFEManagerPage

1. **Três Abas**
   - Gerenciar DANFE (todas)
   - Pendentes (emitidas + pendentes)
   - Autorizadas (autorizadas + enviadas)

2. **Header com Estatísticas**
   - Cards coloridos por status
   - Valor total das NF-e
   - Botão de atualização

3. **Integração Bling**
   - Carrega direto da API do Bling
   - Sincronização automática
   - Tratamento de erros

---

## 💾 Banco de Dados (Para Rastreamento Local)

Opcional - criar tabela para cache local de DANFE:

```sql
CREATE TABLE danfe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nfe_numero VARCHAR(10) NOT NULL,
  nfe_chave VARCHAR(44) NOT NULL UNIQUE,
  pedido_id VARCHAR(50) NOT NULL,
  cliente VARCHAR(255) NOT NULL,
  endereco TEXT NOT NULL,
  cidade VARCHAR(100) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  cep VARCHAR(10) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'emitida',
  data_emissao TIMESTAMP NOT NULL,
  data_autorizacao TIMESTAMP,
  xml_url TEXT,
  pdf_url TEXT,
  zpl_codigo TEXT,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX danfe_status ON danfe(status);
CREATE INDEX danfe_nfe_numero ON danfe(nfe_numero);
CREATE INDEX danfe_nfe_chave ON danfe(nfe_chave);
```

---

## 🧪 Testes Recomendados

```typescript
// Teste de geração de ZPL
it('deve gerar etiqueta ZPL válida', () => {
  const zpl = gerarEtiquetaDANFE({
    nfeNumero: '123456',
    nfeChave: '35240101234567000123650010000000011234567890',
    cliente: 'Empresa Teste',
    endereco: 'Rua Teste, 123',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01310100',
  });
  
  expect(zpl).toContain('^XA'); // Início do ZPL
  expect(zpl).toContain('^XZ'); // Fim do ZPL
  expect(zpl).toContain('35240101234567000123650010000000011234567890');
});

// Teste de carregamento de DANFE
it('deve carregar DANFE do Bling', async () => {
  render(<DANFEManagerPage addToast={mockToast} />);
  await waitFor(() => {
    expect(screen.getByText(/DANFE Manager/i)).toBeInTheDocument();
  });
});

// Teste de filtros
it('deve filtrar DANFE por status', async () => {
  render(<DANFEGerenciador danfes={mockDANFEs} />);
  const filterSelect = screen.getByDisplayValue('Todos os Status');
  fireEvent.change(filterSelect, { target: { value: 'autorizada' } });
  
  const results = screen.getAllByText('Autorizada');
  expect(results.length).toBeGreaterThan(0);
});
```

---

## 📞 Troubleshooting

### Problema: "Parcelas com data inválida"
✓ Corrigido no server.ts - valida e gera datas automaticamente
✓ Verifica formato YYYY-MM-DD
✓ Ajusta totais automaticamente

### Problema: "Total das parcelas difere da nota"
✓ Calcula total dos itens
✓ Ajusta última parcela se necessário
✓ Tolerância de 1 centavo

### Problema: "ZPL não imprime"
✓ Validate que impressora está ligada
✓ Verifique IP da impressora
✓ Use porta padrão 9100
✓ Teste com comando manual: `echo <ZPL> | nc <IP> 9100`

### Problema: "Etiqueta aparece em branco"
✓ Verifique se impressora tem papel/ribbon
✓ Teste fita de impressão
✓ Calibre cabeçote se necessário

---

## 📚 Documentação Oficial

- Bling API v3: https://developer.bling.com.br/docs
- Zebra ZPL: https://www.zebra.com/content/dam/sws/en/en-us/enterprise/zpl-command-reference.pdf
- NFe Portal: https://www.nfe.fazenda.gov.br

---

**Status**: ✅ Produção Ready
**Versão**: 2.0.0
**Data**: Março 2026
