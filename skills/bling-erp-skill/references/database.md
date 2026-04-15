# Database Schema Completo — ERP Bling Integration

## Visão Geral das Tabelas

```
bling_oauth_tokens         — Tokens OAuth por empresa
bling_id_map               — Mapeamento IDs Bling ↔ IDs internos
webhook_log                — Auditoria de webhooks recebidos
webhook_failed             — Webhooks com falha para reprocessamento

contatos                   — Clientes, fornecedores, transportadores
produtos                   — Catálogo de produtos/serviços
depositos                  — Depósitos de estoque
saldos_estoque             — Saldo por produto × depósito
formas_pagamento           — Formas de pagamento cadastradas
categorias_produto         — Árvore de categorias de produto

pedidos_venda              — Pedidos de venda (núcleo)
pedidos_venda_itens        — Itens de cada pedido
pedidos_venda_parcelas     — Parcelas/pagamentos do pedido
notas_fiscais              — NF-e e NFC-e emitidas
notas_fiscais_itens        — Itens das notas fiscais
contas_receber             — Contas a receber (financeiro)
contas_pagar               — Contas a pagar
borderos                   — Baixas de pagamento

sync_status                — Controle de sincronização por recurso
```

---

## DDL Completo (PostgreSQL)

```sql
-- ============================================================
-- INFRAESTRUTURA DE INTEGRAÇÃO
-- ============================================================

CREATE TABLE bling_oauth_tokens (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER     NOT NULL UNIQUE,
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bling_id_map (
  id              SERIAL PRIMARY KEY,
  recurso         VARCHAR(50)  NOT NULL,
  bling_id        BIGINT       NOT NULL,
  interno_id      INTEGER      NOT NULL,
  empresa_id      INTEGER      NOT NULL DEFAULT 1,
  sincronizado_em TIMESTAMPTZ,
  UNIQUE (recurso, bling_id, empresa_id)
);
CREATE INDEX idx_idmap_recurso_bling ON bling_id_map (recurso, bling_id);
CREATE INDEX idx_idmap_recurso_interno ON bling_id_map (recurso, interno_id);

CREATE TABLE webhook_log (
  id           BIGSERIAL PRIMARY KEY,
  event        VARCHAR(100) NOT NULL,
  bling_id     BIGINT,
  empresa_id   INTEGER,
  payload      JSONB,
  processed    BOOLEAN      DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  received_at  TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_wlog_event ON webhook_log (event, received_at DESC);
CREATE INDEX idx_wlog_bling_id ON webhook_log (bling_id);

CREATE TABLE webhook_failed (
  id         BIGSERIAL PRIMARY KEY,
  event      VARCHAR(100) NOT NULL,
  bling_id   BIGINT,
  empresa_id INTEGER,
  data       JSONB,
  error      TEXT,
  retries    SMALLINT     DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  retry_at   TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_wfail_retry ON webhook_failed (retry_at) WHERE retries < 5;

CREATE TABLE sync_status (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER     NOT NULL,
  recurso       VARCHAR(50) NOT NULL,
  last_sync_at  TIMESTAMPTZ,
  total_synced  INTEGER     DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'idle',  -- idle, running, error
  UNIQUE (empresa_id, recurso)
);

-- ============================================================
-- CADASTROS BASE
-- ============================================================

CREATE TABLE contatos (
  id                  SERIAL PRIMARY KEY,
  bling_id            BIGINT       UNIQUE,
  nome                VARCHAR(150) NOT NULL,
  fantasia            VARCHAR(150),
  codigo              VARCHAR(50),
  tipo_pessoa         CHAR(1),              -- F=Física J=Jurídica E=Estrangeira
  numero_documento    VARCHAR(20),
  situacao            CHAR(1)      DEFAULT 'A',  -- A I S E
  email               VARCHAR(200),
  telefone            VARCHAR(30),
  celular             VARCHAR(30),
  ie                  VARCHAR(30),
  endereco            JSONB,
  payload_raw         JSONB,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_contatos_bling_id ON contatos (bling_id);
CREATE INDEX idx_contatos_documento ON contatos (numero_documento);

CREATE TABLE produtos (
  id                  SERIAL PRIMARY KEY,
  bling_id            BIGINT       UNIQUE,
  nome                VARCHAR(200) NOT NULL,
  codigo              VARCHAR(100),
  tipo                CHAR(1),              -- P S N
  situacao            CHAR(1)      DEFAULT 'A',
  formato             CHAR(1),              -- S V E
  preco               NUMERIC(15,4),
  preco_custo         NUMERIC(15,4),
  unidade             VARCHAR(10),
  peso_liquido        NUMERIC(10,4),
  peso_bruto          NUMERIC(10,4),
  gtin                VARCHAR(14),
  ncm                 VARCHAR(10),
  id_produto_pai      INTEGER REFERENCES produtos(id),
  payload_raw         JSONB,
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_produtos_bling_id ON produtos (bling_id);
CREATE INDEX idx_produtos_codigo ON produtos (codigo);

CREATE TABLE depositos (
  id          SERIAL PRIMARY KEY,
  bling_id    BIGINT       UNIQUE,
  descricao   VARCHAR(100) NOT NULL,
  situacao    SMALLINT     DEFAULT 1,
  padrao      BOOLEAN      DEFAULT FALSE
);

CREATE TABLE saldos_estoque (
  id                SERIAL PRIMARY KEY,
  produto_bling_id  BIGINT       NOT NULL,
  deposito_bling_id BIGINT       NOT NULL,
  saldo_fisico      NUMERIC(15,4) DEFAULT 0,
  saldo_virtual     NUMERIC(15,4) DEFAULT 0,
  updated_at        TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE (produto_bling_id, deposito_bling_id)
);
CREATE INDEX idx_saldo_produto ON saldos_estoque (produto_bling_id);

CREATE TABLE formas_pagamento (
  id             SERIAL PRIMARY KEY,
  bling_id       BIGINT       UNIQUE,
  descricao      VARCHAR(100) NOT NULL,
  tipo_pagamento SMALLINT,
  situacao       SMALLINT     DEFAULT 1,
  finalidade     SMALLINT
);

CREATE TABLE categorias_produto (
  id          SERIAL PRIMARY KEY,
  bling_id    BIGINT       UNIQUE,
  descricao   VARCHAR(100) NOT NULL,
  pai_id      INTEGER REFERENCES categorias_produto(id)
);

-- ============================================================
-- PEDIDOS DE VENDA
-- ============================================================

CREATE TABLE pedidos_venda (
  id               SERIAL PRIMARY KEY,
  bling_id         BIGINT       UNIQUE,
  numero           INTEGER,
  numero_loja      VARCHAR(100),
  situacao_id      BIGINT,
  situacao_valor   SMALLINT,
  situacao_nome    VARCHAR(100),
  data_pedido      DATE,
  data_saida       DATE,
  data_prevista    DATE,
  total_produtos   NUMERIC(15,2),
  total            NUMERIC(15,2),
  desconto_valor   NUMERIC(15,2),
  desconto_tipo    VARCHAR(20),
  frete            NUMERIC(15,2),
  outras_despesas  NUMERIC(15,2),
  observacoes      TEXT,
  numero_oc        VARCHAR(50),             -- número pedido de compra do cliente
  contato_id       INTEGER REFERENCES contatos(id),
  contato_bling_id BIGINT,
  loja_bling_id    BIGINT,
  nota_fiscal_id   INTEGER,                 -- FK para notas_fiscais
  vendedor_bling_id BIGINT,
  payload_raw      JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pv_bling_id ON pedidos_venda (bling_id);
CREATE INDEX idx_pv_numero ON pedidos_venda (numero);
CREATE INDEX idx_pv_numero_loja ON pedidos_venda (numero_loja);
CREATE INDEX idx_pv_situacao ON pedidos_venda (situacao_valor);
CREATE INDEX idx_pv_data ON pedidos_venda (data_pedido DESC);
CREATE INDEX idx_pv_contato ON pedidos_venda (contato_bling_id);

CREATE TABLE pedidos_venda_itens (
  id              SERIAL PRIMARY KEY,
  pedido_id       INTEGER      NOT NULL REFERENCES pedidos_venda(id) ON DELETE CASCADE,
  bling_item_id   BIGINT,
  produto_bling_id BIGINT,
  produto_id      INTEGER REFERENCES produtos(id),
  codigo          VARCHAR(100),
  descricao       VARCHAR(300),
  unidade         VARCHAR(10),
  quantidade      NUMERIC(15,4),
  valor_unitario  NUMERIC(15,4),
  desconto_pct    NUMERIC(6,2),
  aliquota_ipi    NUMERIC(6,2),
  valor_total     NUMERIC(15,2)
);
CREATE INDEX idx_pvi_pedido ON pedidos_venda_itens (pedido_id);
CREATE INDEX idx_pvi_produto ON pedidos_venda_itens (produto_bling_id);

CREATE TABLE pedidos_venda_parcelas (
  id                   SERIAL PRIMARY KEY,
  pedido_id            INTEGER      NOT NULL REFERENCES pedidos_venda(id) ON DELETE CASCADE,
  bling_parcela_id     BIGINT,
  data_vencimento      DATE,
  valor                NUMERIC(15,2),
  observacoes          TEXT,
  forma_pagamento_id   BIGINT
);

-- ============================================================
-- NOTAS FISCAIS
-- ============================================================

CREATE TABLE notas_fiscais (
  id              SERIAL PRIMARY KEY,
  bling_id        BIGINT       UNIQUE,
  numero          VARCHAR(20),
  serie           VARCHAR(5),
  chave_acesso    VARCHAR(44),
  tipo            SMALLINT,                -- 0=Entrada 1=Saída
  situacao        SMALLINT,                -- 1=Pendente 5=Autorizada 2=Cancelada
  modelo          VARCHAR(5),              -- nfe nfce nfse
  valor_total     NUMERIC(15,2),
  valor_frete     NUMERIC(15,2),
  data_emissao    TIMESTAMPTZ,
  data_operacao   TIMESTAMPTZ,
  contato_nome    VARCHAR(200),
  contato_doc     VARCHAR(20),
  natureza_op_id  BIGINT,
  loja_id         BIGINT,
  xml_content     TEXT,                    -- XML da NF (opcional, grande)
  danfe_url       TEXT,
  link_pdf        TEXT,
  pedido_id       INTEGER REFERENCES pedidos_venda(id),
  payload_raw     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_nf_bling_id ON notas_fiscais (bling_id);
CREATE INDEX idx_nf_chave ON notas_fiscais (chave_acesso);
CREATE INDEX idx_nf_numero ON notas_fiscais (numero, serie);
CREATE INDEX idx_nf_pedido ON notas_fiscais (pedido_id);
CREATE INDEX idx_nf_situacao ON notas_fiscais (situacao);

-- FK reversa (pedido aponta para nota)
ALTER TABLE pedidos_venda ADD CONSTRAINT fk_pv_nf 
  FOREIGN KEY (nota_fiscal_id) REFERENCES notas_fiscais(id);

CREATE TABLE notas_fiscais_itens (
  id              SERIAL PRIMARY KEY,
  nota_fiscal_id  INTEGER NOT NULL REFERENCES notas_fiscais(id) ON DELETE CASCADE,
  codigo          VARCHAR(100),
  descricao       VARCHAR(300),
  cfop            VARCHAR(10),
  ncm             VARCHAR(10),
  unidade         VARCHAR(10),
  quantidade      NUMERIC(15,4),
  valor_unitario  NUMERIC(15,4),
  valor_total     NUMERIC(15,2),
  aliquota_icms   NUMERIC(6,2),
  valor_icms      NUMERIC(15,2)
);
CREATE INDEX idx_nfi_nota ON notas_fiscais_itens (nota_fiscal_id);

-- ============================================================
-- FINANCEIRO
-- ============================================================

CREATE TABLE contas_receber (
  id                  SERIAL PRIMARY KEY,
  bling_id            BIGINT       UNIQUE,
  situacao            SMALLINT,            -- 1=Aberto 2=Pago 3=Parcial 5=Cancelado
  vencimento          DATE,
  vencimento_original DATE,
  valor               NUMERIC(15,2),
  saldo               NUMERIC(15,2),
  numero_documento    VARCHAR(50),
  historico           TEXT,
  data_emissao        DATE,
  competencia         DATE,
  id_transacao        VARCHAR(100),        -- ID boleto/PIX
  link_boleto         TEXT,
  contato_bling_id    BIGINT,
  portador_bling_id   BIGINT,
  categoria_bling_id  BIGINT,
  forma_pag_bling_id  BIGINT,
  pedido_id           INTEGER REFERENCES pedidos_venda(id),
  nota_fiscal_id      INTEGER REFERENCES notas_fiscais(id),
  payload_raw         JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cr_bling_id ON contas_receber (bling_id);
CREATE INDEX idx_cr_situacao ON contas_receber (situacao);
CREATE INDEX idx_cr_vencimento ON contas_receber (vencimento);
CREATE INDEX idx_cr_pedido ON contas_receber (pedido_id);

CREATE TABLE contas_pagar (
  id                  SERIAL PRIMARY KEY,
  bling_id            BIGINT       UNIQUE,
  situacao            SMALLINT,
  vencimento          DATE,
  valor               NUMERIC(15,2),
  saldo               NUMERIC(15,2),
  numero_documento    VARCHAR(50),
  historico           TEXT,
  data_emissao        DATE,
  contato_bling_id    BIGINT,
  portador_bling_id   BIGINT,
  categoria_bling_id  BIGINT,
  payload_raw         JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cp_bling_id ON contas_pagar (bling_id);

CREATE TABLE borderos (
  id               SERIAL PRIMARY KEY,
  bling_id         BIGINT       UNIQUE,
  data_bordero     DATE,
  historico        TEXT,
  portador_id      BIGINT,
  categoria_id     BIGINT,
  total_pago       NUMERIC(15,2),
  payload_raw      JSONB,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

## Views Úteis

```sql
-- Pedidos com status completo de NF e pagamento
CREATE VIEW v_pedidos_completos AS
SELECT 
  p.id,
  p.bling_id,
  p.numero,
  p.numero_loja,
  p.situacao_nome       AS situacao_pedido,
  p.data_pedido,
  p.total,
  c.nome                AS cliente,
  c.numero_documento    AS cpf_cnpj,
  nf.numero             AS numero_nf,
  nf.serie              AS serie_nf,
  nf.situacao           AS situacao_nf,
  nf.chave_acesso,
  cr.valor              AS valor_conta,
  cr.saldo              AS saldo_conta,
  cr.situacao           AS situacao_financeiro,
  cr.vencimento,
  cr.id_transacao       AS id_boleto_pix
FROM pedidos_venda p
LEFT JOIN contatos c ON p.contato_id = c.id
LEFT JOIN notas_fiscais nf ON p.nota_fiscal_id = nf.id
LEFT JOIN contas_receber cr ON cr.pedido_id = p.id;

-- Saldos de estoque consolidados
CREATE VIEW v_saldo_produtos AS
SELECT
  pr.bling_id,
  pr.codigo,
  pr.nome,
  d.descricao AS deposito,
  se.saldo_fisico,
  se.saldo_virtual,
  se.updated_at AS ultima_atualizacao
FROM saldos_estoque se
JOIN produtos pr ON pr.bling_id = se.produto_bling_id
JOIN depositos d ON d.bling_id = se.deposito_bling_id;

-- Contas a receber em aberto por vencimento
CREATE VIEW v_inadimplencia AS
SELECT
  cr.bling_id,
  cr.vencimento,
  cr.valor,
  cr.saldo,
  cr.vencimento - CURRENT_DATE AS dias_vencido,
  c.nome AS cliente,
  c.telefone,
  c.email,
  p.numero AS numero_pedido
FROM contas_receber cr
LEFT JOIN contatos c ON c.bling_id = cr.contato_bling_id
LEFT JOIN pedidos_venda p ON p.id = cr.pedido_id
WHERE cr.situacao = 1 AND cr.vencimento < CURRENT_DATE
ORDER BY cr.vencimento;
```

## Índices para Performance

```sql
-- Para consultas por período
CREATE INDEX idx_pv_updated ON pedidos_venda (updated_at DESC);
CREATE INDEX idx_cr_updated ON contas_receber (updated_at DESC);

-- Para GIN em JSONB (busca dentro do payload)
CREATE INDEX idx_pv_payload ON pedidos_venda USING GIN (payload_raw);
CREATE INDEX idx_nf_payload ON notas_fiscais USING GIN (payload_raw);
```
