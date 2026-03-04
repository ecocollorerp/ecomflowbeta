# 🗄️ Configuração Supabase - NFe & Certificados

## 1️⃣ Executar Migration SQL

A seguir estão as instruções para criar as tabelas no seu banco Supabase:

### Passo 1: Acessar Supabase Dashboard
1. Acesse https://app.supabase.com
2. Selecione seu projeto: **uafsmsiwaxopxznupuqw**
3. Vá para **SQL Editor** no menu lateral

### Passo 2: Copiar & Executar SQL

**Copie o código abaixo** e execute no Supabase SQL Editor:

```sql
-- Tipos ENUM para status
CREATE TYPE nfe_status AS ENUM (
  'RASCUNHO',
  'ASSINADA',
  'ENVIADA',
  'AUTORIZADA',
  'CANCELADA',
  'REJEITADA',
  'ERRO'
);

-- Tabela de NFes
CREATE TABLE nfes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  serie TEXT NOT NULL,
  emissao BIGINT NOT NULL,
  cliente JSONB NOT NULL DEFAULT '{}',
  valor DECIMAL(18,2) NOT NULL,
  pedidoId TEXT,
  status nfe_status DEFAULT 'RASCUNHO',
  chaveAcesso TEXT UNIQUE,
  xmlOriginal TEXT,
  xmlAssinado TEXT,
  sefazEnvio JSONB DEFAULT '{}',
  certificadoUsado JSONB,
  criadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  atualizadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  UNIQUE(numero, serie)
);

-- Índices para performance
CREATE INDEX idx_nfes_status ON nfes(status);
CREATE INDEX idx_nfes_pedidoId ON nfes(pedidoId);
CREATE INDEX idx_nfes_chaveAcesso ON nfes(chaveAcesso);
CREATE INDEX idx_nfes_criadoEm ON nfes(criadoEm DESC);

-- Tabela de Certificados
CREATE TABLE certificados (
  id TEXT PRIMARY KEY,
  nome TEXT,
  cnpj TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'A1',
  issuer TEXT,
  subject TEXT,
  valido BOOLEAN DEFAULT true,
  dataInicio BIGINT,
  dataValidade BIGINT NOT NULL,
  thumbprint TEXT UNIQUE NOT NULL,
  algoritmoAssinatura TEXT,
  certificadoPem TEXT NOT NULL,
  chavePem TEXT NOT NULL,
  erros JSONB DEFAULT '[]'::jsonb,
  criadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000,
  atualizadoEm BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
);

-- Índices para performance
CREATE INDEX idx_certificados_cnpj ON certificados(cnpj);
CREATE INDEX idx_certificados_thumbprint ON certificados(thumbprint);
CREATE INDEX idx_certificados_valido ON certificados(valido);
CREATE INDEX idx_certificados_dataValidade ON certificados(dataValidade DESC);

-- Row Level Security (RLS)
ALTER TABLE nfes ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir leitura/escrita de API)
CREATE POLICY "Permitir leitura nfes" ON nfes
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserir nfes" ON nfes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualizar nfes" ON nfes
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir deletar nfes" ON nfes
  FOR DELETE USING (true);

CREATE POLICY "Permitir leitura certificados" ON certificados
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserir certificados" ON certificados
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir atualizar certificados" ON certificados
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Permitir deletar certificados" ON certificados
  FOR DELETE USING (true);

-- Função para atualizar atualizadoEm automaticamente
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizadoEm = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para NFes
CREATE TRIGGER atualizar_nfes_timestamp
BEFORE UPDATE ON nfes
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();

-- Trigger para Certificados
CREATE TRIGGER atualizar_certificados_timestamp
BEFORE UPDATE ON certificados
FOR EACH ROW
EXECUTE FUNCTION atualizar_timestamp();
```

### Passo 3: Confirmar Sucesso

Você verá mensagens de sucesso como:
- ✅ CREATE TYPE
- ✅ CREATE TABLE nfes
- ✅ CREATE INDEX (múltiplas vezes)
- ✅ CREATE POLICY (múltiplas vezes)
- ✅ CREATE OR REPLACE FUNCTION
- ✅ CREATE TRIGGER (2 vezes)

---

## 2️⃣ Verificar Tabelas Criadas

No dashboard Supabase:
1. Vá para **Table Editor**
2. Você deverá ver:
   - ✅ **certificados** (tabela)
   - ✅ **nfes** (tabela)
   - ✅ **nfe_status** (tipo ENUM)

---

## 3️⃣ Endpoints Atualizados

Todos os endpoints estão agora conectados ao Supabase:

### NFes
- `POST /api/nfe/gerar` - Cria NFe no Supabase
- `GET /api/nfe/listar` - Lista NFes com filtros
- `POST /api/nfe/assinar` - Assina e atualiza NFe
- `POST /api/nfe/enviar` - Envia para SEFAZ
- `GET /api/nfe/consultar-status` - Consulta status no SEFAZ
- `POST /api/nfe/cancelar` - Cancela NFe

### Certificados
- `POST /api/nfe/certificado/carregar` - Faz upload e parse do .pfx
- `GET /api/nfe/certificados` - Lista certificados válidos

---

## 4️⃣ Testes Rápidos

### Teste 1: Listar NFes (deve estar vazio)
```bash
curl -X GET "https://localhost:3000/api/nfe/listar"
```

Resposta esperada:
```json
{
  "success": true,
  "nfes": [],
  "count": 0
}
```

### Teste 2: Gerar NFe
```bash
curl -X POST "https://localhost:3000/api/nfe/gerar" \
  -H "Content-Type: application/json" \
  -d '{
    "pedidoId": "PEDIDO-001",
    "cliente": { "nome": "Teste", "cnpj": "12.345.678/0001-90" },
    "valor": 1000.00
  }'
```

Resposta esperada:
```json
{
  "success": true,
  "nfe": {
    "id": "...",
    "numero": "000001",
    "serie": "1",
    "status": "RASCUNHO",
    "pedidoId": "PEDIDO-001",
    ...
  },
  "message": "✅ NFe #000001 gerada com sucesso"
}
```

---

## 5️⃣ Suporte

Se tiver erros:

### Erro: "Table 'nfes' already exists"
→ As tabelas já foram criadas. Você pode limpar e recriar:
```sql
DROP TABLE IF EXISTS nfes CASCADE;
DROP TABLE IF EXISTS certificados CASCADE;
DROP TYPE IF EXISTS nfe_status CASCADE;
```

Depois rejoga a migration.

### Erro: "relation 'nfes' does not exist"
→ A tabela não foi criada. Verifique se executou toda a migration SQL.

### Erro de autenticação
→ Verifique se o `SUPABASE_URL` e `SUPABASE_KEY` em `lib/supabaseClient.ts` estão corretos.

---

## 📊 Estrutura de Dados

### Tabela nfes
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único |
| numero | TEXT | Número da NFe (ex: "000001") |
| serie | TEXT | Série (ex: "1") |
| emissao | BIGINT | Timestamp de emissão |
| cliente | JSONB | Dados do cliente |
| valor | DECIMAL | Valor total |
| pedidoId | TEXT | ID do pedido vinculado |
| status | ENUM | RASCUNHO, ASSINADA, ENVIADA, etc |
| chaveAcesso | TEXT | Chave de acesso (único) |
| xmlOriginal | TEXT | XML antes da assinatura |
| xmlAssinado | TEXT | XML com assinatura PKCS#7 |
| sefazEnvio | JSONB | Resposta do SEFAZ |
| certificadoUsado | JSONB | Certificado que assinou |
| criadoEm | BIGINT | Timestamp criação |
| atualizadoEm | BIGINT | Timestamp atualização |

### Tabela certificados
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | TEXT | ID único (gerado ao upload) |
| nome | TEXT | Nome do certificado |
| cnpj | TEXT | CNPJ da empresa |
| tipo | TEXT | A1 ou A3 |
| issuer | TEXT | Emissor do certificado |
| subject | TEXT | Subject do certificado |
| valido | BOOLEAN | Está válido? |
| dataInicio | BIGINT | Início de validade |
| dataValidade | BIGINT | Fim de validade |
| thumbprint | TEXT | SHA-1 fingerprint (único) |
| algoritmoAssinatura | TEXT | Algoritmo (SHA256withRSA) |
| certificadoPem | TEXT | Certificado em formato PEM |
| chavePem | TEXT | Chave privada em formato PEM |
| erros | JSONB | Array de erros de validação |
| criadoEm | BIGINT | Timestamp criação |
| atualizadoEm | BIGINT | Timestamp atualização |

---

✅ **Supabase está pronto!**
