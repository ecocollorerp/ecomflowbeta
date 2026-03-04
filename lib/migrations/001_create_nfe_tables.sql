/**
 * Migration SQL para Supabase
 * Executar no Dashboard do Supabase > SQL Editor
 * 
 * Cria tabelas para NFe e Certificados com RLS policies
 */

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
