# 🔄 SEFAZ Híbrido - Guia de Integração

## Visão Geral

A **solução SEFAZ Híbrida** permite que seu ERP suporte **duas estratégias de emissão de NFe**:

### 1. **Via Bling API** ✅ (Recomendado)
- O Bling gerencia certificado digital
- Menos complexidade operacional
- Integração nativa com SEFAZ
- Ideal para empresas que já usam Bling

### 2. **SEFAZ Direto** ✅
- Você gerencia o certificado A1
- Máximo controle técnico
- Ideal para integrações customizadas
- Requer conhecimento de certificados digitais

---

## 📋 Arquitetura da Solução

### Frontend (React)
```
components/NFeManager.tsx
├── Aba: Notas Fiscais
├── Aba: Certificados
└── Aba: Configuração
    └── Seletor de Estratégia SEFAZ (bling | direto)
```

### Backend (Node.js/Express)
```
server.ts
├── POST /api/nfe/enviar-bling
│   └── Envia via Bling API (90% sucesso simulado)
│
├── GET /api/nfe/status-bling
│   └── Consulta status via Bling
│
└── POST /api/nfe/enviar (SEFAZ Direto)
    └── Envia direto para SEFAZ (80% sucesso simulado)
```

### API Client
```
lib/blingApi.ts
├── enviarNFeparaSefazViaBling()
├── consultarStatusNFeSefazViaBling()
└── enviarNFeSefazHibrido() ← Escolhe automaticamente
```

---

## 🚀 Como Usar

### Configuração no NFeManager

1. **Acesse a aba "Configuração"**
2. **Selecione a estratégia SEFAZ:**
   - `Via Bling` (padrão): Mais simples
   - `SEFAZ Direto`: Mais controle

3. **Clique em "Salvar Configurações"**

### Fluxo de Emissão

#### Via Bling API:
```
Gerar NFe
    ↓
Assinar (Bling cuida)
    ↓
Enviar para SEFAZ (via Bling)
    ↓
Autorizada ✅
```

#### SEFAZ Direto:
```
Gerar NFe
    ↓
Carregar Certificado A1
    ↓
Assinar com Certificado
    ↓
Enviar para SEFAZ (direto)
    ↓
Autorizada ✅
```

---

## 📱 API Endpoints

### Envio via Bling
```typescript
POST /api/nfe/enviar-bling
{
  "nfeId": "nfe-123",
  "pedidoId": "001",
  "ambiente": "HOMOLOGAÇÃO",
  "via": "bling"
}

Response:
{
  "success": true,
  "nfe": { /* dados */ },
  "message": "✅ NFe autorizada via Bling/SEFAZ"
}
```

### Status via Bling
```typescript
GET /api/nfe/status-bling?chaveAcesso=35240224...&ambiente=HOMOLOGAÇÃO

Response:
{
  "success": true,
  "chaveAcesso": "35240224...",
  "status": "AUTORIZADA",
  "statusSefaz": "100",
  "protocoloAutorizacao": "123456789012345",
  "dataAutorizacao": 1708876800000
}
```

### Envio Direto (SEFAZ)
```typescript
POST /api/nfe/enviar
{
  "nfeId": "nfe-123",
  "ambiente": "HOMOLOGAÇÃO"
}

Response:
{
  "success": true,
  "nfe": { /* dados */ },
  "message": "✅ NFe autorizada pela SEFAZ"
}
```

---

## 🔐 Tipos TypeScript

### ConfiguracaoNFe Estendida
```typescript
export interface ConfiguracaoNFe {
  emissao: 'NORMAL' | 'CONTINGÊNCIA';
  ambiente: 'PRODUÇÃO' | 'HOMOLOGAÇÃO';
  estrategiaSefaz?: 'bling' | 'direto'; // ← NOVO
  cnpj?: string;                         // ← NOVO
  cnpjEmitente: string;
  uf: string;
  numSerieNFe: string;
  proxNumNFe: number;
  naturezaOperacao: string;
  sequencialAssinatura: number;
}
```

---

## 🎯 Funções de API

### Cliente (lib/blingApi.ts)

#### 1. Enviar via Bling
```typescript
export async function enviarNFeparaSefazViaBling(
  nfeId: string,
  pedidoId: string,
  ambiente: 'PRODUÇÃO' | 'HOMOLOGAÇÃO',
  token: string
): Promise<any>
```

#### 2. Consultar Status via Bling
```typescript
export async function consultarStatusNFeSefazViaBling(
  chaveAcesso: string,
  ambiente: 'PRODUÇÃO' | 'HOMOLOGAÇÃO',
  token: string
): Promise<any>
```

#### 3. Envio Híbrido (Auto-seleciona)
```typescript
export async function enviarNFeSefazHibrido(
  nfeId: string,
  pedidoId: string,
  ambiente: 'PRODUÇÃO' | 'HOMOLOGAÇÃO',
  estrategia: 'bling' | 'direto',
  token?: string
): Promise<any>
```

---

## 📊 Comparação: Bling vs Direto

| Aspecto | Via Bling | SEFAZ Direto |
|---------|-----------|-------------|
| **Complexidade** | 🟢 Baixa | 🔴 Alta |
| **Segurança Certificado** | 🟢 Gerenciado Bling | 🟡 Você gerencia |
| **Controle** | 🟡 Médio | 🟢 Total |
| **Taxa de Sucesso** | 🟢 90% | 🟡 80% |
| **Suporte** | 🟢 Bling suporte | 🔴 Você responsável |

---

## 🔄 Migração Entre Estratégias

Para mudar de estratégia:

1. Acesse **Configuração**
2. Altere **"Estratégia SEFAZ"**
3. **Salve** as configurações

> **Nota:** NFes em progresso não serão afetadas. A mudança só afeta novas emissões.

---

## ⚠️ Casos de Uso

### Use Via Bling quando:
- ✅ Não quer gerenciar certificados
- ✅ Quer máxima simplicidade
- ✅ Usa outros serviços Bling
- ✅ Não tem especialista em certificados

### Use SEFAZ Direto quando:
- ✅ Precisa máximo controle
- ✅ Tem especialista em SEFAZ
- ✅ Quer integração customizada
- ✅ Tem certificado A1 já disponível

---

## 🧪 Teste da Solução

### Homologação
1. Use ambiente **HOMOLOGAÇÃO**
2. Teste ambas estratégias
3. Verifique respostas SEFAZ

### Produção
1. Troque para **PRODUÇÃO**
2. Use estratégia validada
3. Implemente retry logic

---

## 📝 Próximas Fases

- [ ] Implementar real SOAP com SEFAZ
- [ ] Integrar parsing de certificado A1 real
- [ ] Adicionar retry com backoff exponencial
- [ ] Persistência em banco de dados
- [ ] Dashboard de monitoramento SEFAZ

---

## 🔗 Integração no NFeManager

O componente agora tem:

```tsx
const [estrategiaSefaz, setEstrategiaSefaz] = useState<'bling' | 'direto'>('bling');

// Na aba de Configuração:
<select 
  value={estrategiaSefaz} 
  onChange={(e) => setEstrategiaSefaz(e.target.value as 'bling' | 'direto')}
>
  <option value="bling">Via Bling (Recomendado)</option>
  <option value="direto">SEFAZ Direto</option>
</select>
```

---

## 📖 Estrutura de Código

**Arquivos Modificados:**

1. **types.ts** (+2 campos em ConfiguracaoNFe)
2. **lib/blingApi.ts** (+3 funções para SEFAZ híbrido)
3. **server.ts** (+2 endpoints para Bling)
4. **components/NFeManager.tsx** (+1 selector + info panel)

**Total de mudanças:** ~250 linhas de código

---

## ✅ Status

- ✅ Tipos TypeScript adicionados
- ✅ API endpoints implementados
- ✅ UI com seletor de estratégia
- ✅ Simulação de ambas estratégias
- ⏳ Implementação SOAP real (próximo passo)
- ⏳ Parsing de certificado A1 real (próximo passo)
