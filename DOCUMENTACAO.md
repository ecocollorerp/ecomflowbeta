# 📋 DOCUMENTAÇÃO COMPLETA — ERP ECOMFLOWBETA

> Sistema de gestão integrado para fábrica/manufatura com gestão de estoque, pedidos, produção, financeiro, integração Bling, etiquetas ZPL e muito mais.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura e Tecnologias](#2-arquitetura-e-tecnologias)
3. [Banco de Dados (Schema)](#3-banco-de-dados)
4. [Navegação e Roteamento](#4-navegação-e-roteamento)
5. [Autenticação e Permissões](#5-autenticação-e-permissões)
6. [Páginas do Sistema](#6-páginas-do-sistema)
7. [Gerenciamento de Estoque](#7-gerenciamento-de-estoque)
8. [Pacotes Prontos](#8-pacotes-prontos)
9. [Integração Bling](#9-integração-bling)
10. [Fluxo Financeiro](#10-fluxo-financeiro)
11. [Importação e Exportação de Dados](#11-importação-e-exportação)
12. [Etiquetas e ZPL](#12-etiquetas-e-zpl)
13. [Produção (Pesagem e Moagem)](#13-produção-pesagem-e-moagem)
14. [Serviços e Hooks](#14-serviços-e-hooks)
15. [Componentes Principais](#15-componentes-principais)
16. [Fluxos de Dados Entre Setores](#16-fluxos-de-dados-entre-setores)
17. [API Endpoints (server.ts)](#17-api-endpoints)
18. [Deploy e Configuração](#18-deploy-e-configuração)

---

## 1. Visão Geral

O **ecomflowbeta** é um ERP completo para operações de fábrica e e-commerce. Ele cobre:

- **Gestão de Estoque**: Insumos, produtos finais, composição BOM, pacotes prontos
- **Processamento de Pedidos**: Importação de Mercado Livre, Shopee, TikTok Shop e lojas customizadas
- **Bipagem (Fulfillment)**: Escaneamento de pedidos com dedução automática de estoque
- **Produção**: Pesagem, moagem, ensacamento
- **Financeiro**: Custos, descontos, análise de lucratividade por SKU
- **Integração Bling**: Sincronização de pedidos, NF-e e produtos
- **Etiquetas/ZPL**: Geração de códigos ZPL para impressoras de etiqueta
- **Relatórios**: PDF, PPTX, Excel

---

## 2. Arquitetura e Tecnologias

### Stack Principal

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + TypeScript 5.8 + Tailwind CSS |
| Backend | Express 5.2 (Node.js) |
| Banco de Dados | Supabase (PostgreSQL) |
| Autenticação | JWT + localStorage (sessão de 8h) |
| APIs Externas | Bling v3, Mercado Livre, Shopee, Sefaz |
| PDF/Docs | jsPDF, pptxgenjs, jszip, archiver |
| Códigos | jsbarcode, qrcode |

### Estrutura de Pastas

```
/
├── App.tsx              # Componente raiz (roteamento, estado global)
├── server.ts            # Servidor Express (API proxy, Bling, NFe)
├── types.ts             # Definições TypeScript centrais
├── index.tsx            # Entry point React
├── pages/               # Páginas do sistema (1 arquivo por seção)
├── components/          # Componentes reutilizáveis e modals
├── hooks/               # React hooks customizados
├── services/            # Lógica de negócios (Bling, DANFE, ZPL, auditoria)
├── lib/                 # Utilitários (parser, export, supabase, xml)
├── utils/               # Helpers (SKU matching, formatação)
├── excel/               # Templates e processadores de Excel
├── migrations/          # Scripts de migração do banco
├── scripts/             # Scripts auxiliares
└── public/              # Arquivos estáticos
```

---

## 3. Banco de Dados

### Extensões PostgreSQL Requeridas
- `uuid-ossp` (geração de UUIDs)
- `pgcrypto` (criptografia)
- `pg_trgm` (busca por similaridade)

### Tabelas Principais

#### 3.1 `users` — Usuários do Sistema
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador único |
| name | TEXT | Nome do usuário |
| email | TEXT | Email (login) |
| password | TEXT | Senha |
| role | TEXT | SUPER_ADMIN, ADMIN ou OPERATOR |
| setor | TEXT[] | Setores atribuídos |
| prefix | TEXT | Prefixo para bipagem |
| permissions | JSONB | Permissões específicas por página |
| device_id | TEXT | Dispositivo vinculado |
| avatar_base64 | TEXT | Avatar em base64 |

#### 3.2 `stock_items` — Inventário Principal
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| code | TEXT (UNIQUE) | Código/SKU do item |
| name | TEXT | Nome do item |
| kind | TEXT | INSUMO, PRODUTO ou PROCESSADO |
| current_qty | NUMERIC | Quantidade atual |
| reserved_qty | NUMERIC | Quantidade reservada |
| ready_qty | NUMERIC | Quantidade pronta |
| min_qty | NUMERIC | Quantidade mínima (alerta) |
| unit | TEXT | Unidade (KG, UN, ML) |
| sell_price | NUMERIC | Preço de venda |
| cost_price | NUMERIC | Preço de custo |
| bom_composition | JSONB | Receita/composição BOM |
| barcode | TEXT | Código de barras |
| localizacao | TEXT | Localização no galpão |
| status | TEXT | ATIVO ou INATIVO |

#### 3.3 `stock_movements` — Histórico de Movimentações
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| stock_item_code | TEXT | SKU do item |
| qty_delta | NUMERIC | Variação (+entrada, -saída) |
| origin | TEXT | AJUSTE_MANUAL, BIP, PRODUCAO, MOAGEM, etc. |
| ref | TEXT | Referência da operação |
| created_by_name | TEXT | Quem fez |
| new_total | NUMERIC | Saldo após operação |

#### 3.4 `orders` — Pedidos Importados
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| order_id | TEXT | ID do pedido na plataforma |
| sku | TEXT | SKU vendido |
| qty_original | INT | Quantidade original |
| qty_final | INT | Quantidade final (pós-ajuste) |
| canal | TEXT | ML, SHOPEE, TIKTOK, SITE |
| status | TEXT | NORMAL, BIPADO, ERRO, DEVOLVIDO |
| customer_name | TEXT | Nome do cliente |
| price_gross | NUMERIC | Valor bruto |
| shipping_fee | NUMERIC | Frete |
| data_prevista_envio | DATE | Data prevista de envio |

#### 3.5 `order_items` — Itens Detalhados de Pedidos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| order_id | TEXT | ID do pedido |
| bling_id | TEXT | ID no Bling |
| sku | TEXT | SKU do item |
| nome | TEXT | Nome do produto |
| quantidade | INT | Quantidade |
| preco_unitario | NUMERIC | Preço unitário |
| canal | TEXT | Plataforma de origem |

#### 3.6 `scan_logs` — Histórico de Bipagem
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| scanned_at | TIMESTAMP | Data/hora do scan |
| user_name | TEXT | Operador |
| display_key | TEXT | Código exibido |
| status | TEXT | Status do scan |
| order_id | TEXT | Pedido related |
| sku | TEXT | SKU bipado |

#### 3.7 `stock_pack_groups` — Pacotes Prontos
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| name | TEXT | Nome do pacote |
| barcode | TEXT | Código de barras |
| item_codes | TEXT[] | SKUs inclusos |
| min_pack_qty | INT | Meta mínima |
| tipo | TEXT | tradicional ou volatil |
| quantidade_volatil | NUMERIC | Qtd manual (volátil) |
| pack_size | INT | Unidades por pacote |
| localizacao | TEXT | Local no galpão |

#### 3.8 `sku_links` — Vinculação SKU Marketplace → Master
| Campo | Tipo | Descrição |
|-------|------|-----------|
| imported_sku | TEXT (PK) | SKU da plataforma |
| master_product_sku | TEXT | SKU master do ERP |

#### 3.9 `weighing_batches` — Lotes de Pesagem
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Identificador |
| stock_item_code | TEXT | Insumo pesado |
| initial_qty | NUMERIC | Quantidade inicial |
| used_qty | NUMERIC | Quantidade utilizada |
| weighing_type | TEXT | daily ou hourly |
| operador_maquina | TEXT | Operador da máquina |
| products | JSONB | Produtos produzidos |

#### 3.10 `grinding_batches` — Lotes de Moagem
| Campo | Tipo | Descrição |
|-------|------|-----------|
| source_insumo_code | TEXT | Insumo de entrada |
| source_qty_used | NUMERIC | Quantidade usada |
| output_insumo_code | TEXT | Insumo resultante |
| output_qty_produced | NUMERIC | Quantidade produzida |

#### 3.11 Outras Tabelas Importantes

| Tabela | Descrição |
|--------|-----------|
| `product_boms` | Receitas/Composições (BOM) de cada produto |
| `production_plans` | Planos de produção com previsão de demanda |
| `production_plan_items` | Itens detalhados de cada plano |
| `shopping_list_items` | Lista de compras gerada pelo planejamento |
| `import_history` | Histórico de importações de Excel/XML |
| `cost_calculations` | Histórico de cálculos de custos e margens |
| `admin_notices` | Avisos administrativos (post-it, banner) |
| `setores` | Setores/departamentos da empresa |
| `bling_nfe` | NF-e sincronizadas do Bling |
| `etiquetas_historico` | Histórico de geração de etiquetas |
| `etiquetas_prioritarias` | Etiquetas com prioridade (NFe-Saída) |
| `nfes` | NF-e próprias (emissão via Sefaz) |
| `certificados` | Certificados A1 para assinatura de NF-e |
| `objetos_postagem` | Objetos de logística/envio |
| `audit_logs` | Logs de auditoria de ações críticas |
| `sync_config` / `sync_log` | Configuração e logs de sincronização Bling |
| `skus_vinculados` | Vinculação DANFE → SKU de etiqueta |
| `returns` | Devoluções de pedidos |
| `app_settings` | Configurações globais (JSONB) |

---

## 4. Navegação e Roteamento

### SPA com Hash-based Routing

O sistema usa **roteamento por hash** (sem React Router):

```
https://meudominio.com/#/dashboard
https://meudominio.com/#/estoque
https://meudominio.com/#/bipagem
https://meudominio.com/#/bling
```

**Como funciona:**
1. `App.tsx` mantém um estado `currentPage` que determina qual página renderizar
2. Ao mudar de página, atualiza o hash: `window.history.pushState(null, '', '#/pagina')`
3. Ao carregar, lê o hash: `window.location.hash` → extrai a página
4. Escuta eventos `hashchange` e `popstate` para navegação pelo browser

**Modos de navegação:**
- **Sidebar**: Menu lateral com ícones e categorias colapsáveis
- **Topnav**: Barra superior com links de navegação

---

## 5. Autenticação e Permissões

### Fluxo de Login

1. Usuário informa email + senha na tela de login
2. Sistema busca na tabela `users` pelo email
3. Verifica a senha
4. Armazena sessão em `localStorage` com timestamp
5. Sessão expira após 8 horas → logout automático

### Roles (Papéis)

| Role | Acesso |
|------|--------|
| **SUPER_ADMIN** | Acesso total a tudo (1 por empresa) |
| **ADMIN** | Acesso administrativo (conforme permissões) |
| **OPERATOR** | Sem login — acesso apenas via prefixo na bipagem |

### Permissões Granulares

Cada usuário ADMIN pode ter permissões específicas:

```json
{
  "estoque": true,
  "pacotes": true,
  "calculadora": false,
  "bling": true,
  "financeiro": false,
  "relatorios": true,
  "funcionarios": false,
  "configuracoes": true,
  "etiquetas": true
}
```

### Controle de Acesso

O arquivo `lib/accessControl.ts` define:
- `canAccessPage(user, page, settings)` — Verifica se o usuário pode acessar a página
- `getFirstAccessiblePage(user, preferred)` — Retorna a primeira página acessível
- `PAGE_ACCESS_RULES` — Matriz de regras de acesso por página

---

## 6. Páginas do Sistema

### 6.1 Dashboard (`DashboardPage.tsx`)
Hub central com KPIs principais:
- Total de pedidos do período
- Resumo de estoque (itens críticos, abaixo do mínimo)
- Últimas movimentações
- Avisos do sistema e alertas de estoque

### 6.2 Importação (`ImporterPage.tsx`)
Upload e processamento de planilhas de pedidos:
- Suporta Excel de ML, Shopee, TikTok, Site
- Detecta colunas automaticamente
- Identifica SKUs não vinculados
- Permite vincular ou criar novos produtos
- Filtra por data de envio prevista
- Grava na tabela `orders`

### 6.3 Bipagem (`BipagemPage.tsx`)
Escaneamento de pedidos para fulfillment:
- Leitura de código de barras/QR
- Dedução automática de estoque via BOM
- Histórico de scans
- Status visual (OK, erro, já bipado)
- Configuração de dispositivo

### 6.4 Estoque (`EstoquePage.tsx`)
Gerenciamento completo de inventário com abas:
- **Insumos**: Lista de itens, BOM, categorias, busca avançada
- **Movimentações**: Histórico completo de entradas/saídas
- **Pacotes Prontos**: Grupos de SKUs agrupados (ver seção 8)
- **Ensacamento**: Controle de pesagem e produção

### 6.5 Financeiro (`FinancePage.tsx`)
Análise financeira e custos:
- Cálculo de custo por SKU (material + taxas + frete + impostos)
- Margem de lucro por produto e por canal
- Despesas e lançamentos
- Relatórios de receita por período
- Importação de dados financeiros

### 6.6 Calculadora (`CalculadoraPage.tsx`)
Ferramenta de viabilidade:
- Seleciona produto e seus insumos
- Define custos de material, taxas de plataforma, frete
- Calcula margem de lucro automaticamente
- Simulação "E se?" com preços diferentes

### 6.7 Planejamento (`PlanejamentoPage.tsx`)
Previsão de produção:
- Análise de consumo médio diário por SKU
- Previsão de demanda com buffer de segurança
- Geração de plano de produção
- Lista de compras automática
- Histórico de planos

### 6.8 Pedidos (`PedidosPage.tsx`)
Visualização completa de todos os pedidos:
- Filtros por canal, status, data, cliente
- Detalhes de cada pedido (itens, valores, status)
- Resolução de erros
- Gestão de devoluções
- Status de bipagem

### 6.9 Relatórios (`RelatoriosPage.tsx`)
Múltiplos tipos de relatórios:
- Faturamento por período e canal
- Ranking de SKUs mais vendidos
- Relatório de estoque (valorizado)
- Produção por período
- Bipagem (produtividade por operador)
- RH (presença, horas)

### 6.10 Moagem (`MoagemPage.tsx`)
Controle de reciclagem/processamento:
- Transforma um insumo em outro (ex: 1kg bruto → 0.8kg processado)
- Registra perdas no processo
- Histórico de lotes de moagem

### 6.11 Configurações (`ConfiguracoesPage.tsx`)
Configurações operacionais:
- Gestão de usuários e permissões
- Mapeamento de colunas para importação
- Configuração de bipagem (modo, sons, dispositivo)
- Configuração de expedição
- Templates de etiquetas

### 6.12 Config. Gerais (`ConfiguracoesGeraisPage.tsx`)
Configurações da empresa:
- Nome, logo, dados da empresa
- Manutenção (backup, export, reset)
- Gestão de setores/departamentos

### 6.13 Etiquetas (`EtiquetasPage.tsx`)
Processamento e geração de etiquetas:
- Configuração ZPL por plataforma
- Geração de PDF de etiquetas
- Preview de etiquetas antes de imprimir
- Histórico de geração
- Impressão direta via ZPL

### 6.14 Bling (`BlingPage.tsx`)
Integração com o Bling ERP:
- Configuração OAuth (Client ID + Secret)
- Sincronização de pedidos, NF-e, produtos e estoque
- Gerenciamento de notas fiscais
- Vinculação de SKUs Bling → ERP
- Status de sincronização

### 6.15 Ajuda / Passo a Passo
- `AjudaPage.tsx` — FAQs e guias
- `PassoAPassoPage.tsx` — Tutoriais passo-a-passo

### 6.16 Setup Banco (`DatabaseSetupPage.tsx`)
Verificação de schema do Supabase (apenas desenvolvimento)

---

## 7. Gerenciamento de Estoque

### Tipos de Itens

| Tipo | Descrição | Estoque |
|------|-----------|---------|
| **INSUMO** | Matéria-prima comprada | Físico real |
| **PROCESSADO** | Fabricado internamente | Físico (resultado de produção) |
| **PRODUTO** | Produto final vendido | Virtual (calculado via BOM) |

### BOM (Bill of Materials) — Composição/Receita

Cada produto pode ter uma receita definindo quais insumos são necessários:

```json
{
  "items": [
    { "code": "INSUMO-PAPEL-BRANCO", "qty": 2.5 },
    { "code": "INSUMO-TINTA-AZUL", "qty": 0.3 },
    { "code": "INSUMO-EMBALAGEM", "qty": 1 }
  ]
}
```

### Movimentações de Estoque

**Origens possíveis:**
| Origin | Descrição |
|--------|-----------|
| `AJUSTE_MANUAL` | Correção manual pelo operador |
| `PRODUCAO_MANUAL` | Entrada manual de produção |
| `BIP` | Dedução automática na bipagem |
| `ENSACAMENTO` | Pesagem/empacotamento |
| `MOAGEM` | Processamento de reciclagem |
| `IMPORT_XML` | Entrada via NF-e XML |
| `PRODUCAO_INTERNA` | Produção interna |

### Fluxo de Dedução na Bipagem

1. Operador escaneia o pedido
2. Sistema identifica o SKU vendido
3. Resolve a receita BOM do produto
4. Para cada insumo da receita, cria um `stock_movement` negativo
5. Atualiza `current_qty` de cada insumo
6. Registra em `scan_logs`

---

## 8. Pacotes Prontos

### O que são

Agrupamentos de múltiplos SKUs como "pacote pronto para expedição". Permitem monitorar estoque de kits montados.

### Tipos

| Tipo | Como calcula o estoque |
|------|----------------------|
| **Tradicional** | Soma das `current_qty` dos insumos vinculados |
| **Volátil** | Valor manual informado pelo operador (independente dos insumos) |

### Funcionalidades

- **Busca e filtro**: Por nome, código de barras, SKU
- **Filtro por tipo**: Todos, Volátil, Tradicional
- **Paginação**: 12 pacotes por página
- **Visualização Grid ou Lista**: Cards visuais ou tabela
- **Entrada/Saída manual**: Para pacotes voláteis
- **Meta mínima**: Alerta visual quando abaixo do mínimo
- **Composição do estoque**: Mostra quantos pacotes completos + avulsos
- **Última entrada por item**: Histórico das últimas entradas
- **Geração de etiqueta**: Código de barras do pacote
- **Seleção em massa**: Checkbox para operações bulk
- **Geração de PDF**: Relatório dos pacotes selecionados
- **Importação via Excel**: Atualização em massa

### Histórico de Movimentações

- Visualização em **cards** ou **tabela**
- Paginação de 15 registros por página
- Mostra: data, item, tipo (entrada/saída), quantidade, operador, referência

---

## 9. Integração Bling

### Fluxo OAuth

1. **Configuração**: Admin cadastra Client ID + Client Secret nas configurações
2. **Autorização**: Clica em "Conectar", abre popup com URL do Bling:
   ```
   https://www.bling.com.br/Api/v3/oauth/authorize
   ?client_id=XXX&redirect_uri=XXX&response_type=code&state=XXX
   ```
3. **Callback**: Código de autorização retorna no redirect
4. **Fallback localStorage**: Se `window.opener.postMessage` for bloqueado (URLs públicas), o código é salvo em `localStorage` e a página principal faz polling
5. **Token Exchange**: POST para `/api/bling/token` com o código → recebe `access_token` + `refresh_token`

### Sincronização de Dados

| Dados | Endpoint | O que sincroniza |
|-------|----------|-----------------|
| **Pedidos** | `/api/bling/sync/orders` | Pedidos de venda com data range |
| **NF-e** | `/api/bling/sync/invoices` | Notas fiscais emitidas |
| **Produtos** | `/api/bling/sync/products` | Catálogo de produtos do Bling |
| **Estoque** | `/api/bling/sync/stock` | Saldos por depósito |

### Vinculação de SKUs

O sistema permite vincular SKUs do Bling aos SKUs internos do ERP:
- `POST /api/bling/sync/vinculate` — Liga `blingCode` → `erpSku`
- Salvo na tabela `sku_links`
- Pedidos importados usam essa vinculação para encontrar produtos locais

### Operações em Massa

- **Mudar status**: Altera status de múltiplos itens
- **Atribuir lote**: Agrupa itens em lotes
- **Deletar em massa**: Remove itens selecionados
- **Exportar CSV**: Exporta dados filtrados

---

## 10. Fluxo Financeiro

### Análise de Custos

**Fórmula básica:**

```
Custo Total Material = SUM(custo de cada insumo × quantidade)
Total Despesas = taxa_plataforma + frete + impostos + outros
Lucro = preço_venda - custo_material - despesas
Margem (%) = (lucro / preço_venda) × 100
```

### Entrada de Dados

1. Seleciona produto (SKU)
2. Define itens de material com preço unitário
3. Configura: taxa da plataforma (%), frete, impostos
4. Sistema calcula margem automaticamente

### Despesas e Lançamentos

Ao importar uma NF-e XML:
- Estoque é atualizado automaticamente (entrada dos produtos)
- Um lançamento financeiro (`DespesaLancamento`) é criado com:
  - Valor total da NF-e
  - Fornecedor
  - Data de competência
  - Tipo: "Compra via NF-e"

### Sincronização com Estoque

- Custos dos insumos em `stock_items.cost_price`
- Cálculos salvos em `cost_calculations` para análise comparativa
- Relatório de estoque valorizado (qty × cost_price)

---

## 11. Importação e Exportação

### Importação de Pedidos (Excel)

**Fluxo:**
1. Upload da planilha (ML, Shopee, TikTok, Site)
2. Parser detecta colunas automaticamente baseado no canal
3. Extrai: pedido_id, SKU, quantidade, cliente, canal
4. Identifica SKUs não vinculados
5. Usuário vincula ou cria novos itens
6. Filtra opcionalmente por data de envio
7. Salva na tabela `orders`

**Colunas mapeadas** (configurável em `generalSettings.importer`):
- Mapeamento independente por canal (ML, Shopee, TikTok, Site)
- Colunas: order_id, sku, quantity, shippingDate, customer_name, etc.

### Importação de NF-e (XML)

**Fluxo:**
1. Upload de XML ou ZIP de XMLs
2. `parseNFeXML()` extrai dados da nota
3. Itens são processados e vinculados ao estoque
4. `current_qty` dos itens é incrementada
5. Lançamento financeiro é criado automaticamente
6. Histórico registrado em `import_history`

### Exportação

| Formato | Função | Uso |
|---------|--------|-----|
| PDF | `exportPdf()` | Relatórios gerais |
| PPTX | `exportFinancePptx()` | Apresentações financeiras |
| Excel | `exportExcel()` | Dados tabulares |
| CSV | `/api/bling/export/csv` | Dados do Bling |
| SQL | `exportStateToSql()` | Snapshot completo do estado |
| ZIP | `gerarZipDosArquivos()` | DANFE + Etiqueta combinados |

---

## 12. Etiquetas e ZPL

### Configuração ZPL

Cada plataforma pode ter configurações diferentes:

```json
{
  "ml": {
    "label_width_mm": 100,
    "label_height_mm": 150,
    "image_area_percentage": 60,
    "footer": {
      "enabled": true,
      "x_position_mm": 5,
      "y_position_mm": 140,
      "template": "SKU: {sku} | {qty}un"
    }
  }
}
```

### Fluxo de Geração

1. Usuário seleciona pedidos/lotes
2. `processZplStream()` gera blocos ZPL para cada item:
   - Código de barras 128 (pedido_id)
   - QR code com dados estendidos
   - Texto: SKU, cliente, canal
   - Footer customizável (frete, rastreio)
3. Opcionalmente gera DANFE simplificada em PDF
4. Exporta para impressora ZPL ou arquivo

### Etiquetas Prioritárias

Sistema de fila para etiquetas de NF-e de saída:
- Status: pendente → processando → concluído
- Armazenagem: ZPL direto ou arquivo PC
- Rastreabilidade completa em JSONB

### DANFE Simplificada

- Gerada a partir do XML da NF-e
- Formato A4 ou 100×150mm (etiqueta)
- Inclui: número NF, cliente, itens, totais
- Pode ser combinada com etiqueta ZPL em ZIP

---

## 13. Produção (Pesagem e Moagem)

### Pesagem (`MaquinasPage.tsx`)

Controle de produção por máquina:

1. Operador seleciona insumo e quantidade
2. Define tipo: diária ou por hora
3. Registra operador da máquina e batedor
4. Sistema cria `weighing_batch` e decrementa insumo
5. Se produtos forem vinculados, incrementa produção

### Moagem (`MoagemPage.tsx`)

Reciclagem/processamento de insumos:

1. Define insumo de entrada e quantidade
2. Define insumo de saída e quantidade produzida
3. Registra perdas no processo (entrada - saída = perda)
4. Cria `grinding_batch` e atualiza ambos os estoques

### Ensacamento

Acessado como sub-aba do Estoque:
- Integra pesagem com empacotamento
- Vincula a pacotes prontos
- Registra movimentação de estoque

---

## 14. Serviços e Hooks

### Serviços (`services/`)

| Serviço | Descrição |
|---------|-----------|
| `auditLogService.ts` | Sistema de auditoria — registra ações críticas (NF-e, importação, Bling, DANFE) |
| `blingBulkLoaderService.ts` | Carregamento em massa de pedidos do Bling com múltiplas estratégias |
| `danfeService.ts` | Geração de DANFE simplificada + etiqueta de envio (PDF) |
| `danfeSimplificadoComEtiquetaService.ts` | DANFE + Etiqueta combinadas em um único fluxo |
| `etiquetaBlingFluxoCompleto.ts` | Pipeline completo: download TXT Bling → converte para ZPL → upload |
| `etiquetasPrioritariasService.ts` | Gerenciamento de etiquetas com fila de prioridade |
| `importacaoControllerService.ts` | Controle de importação com validação de headers |
| `pdfGenerator.ts` | Geração de PDFs com templates customizáveis |
| `syncBlingItems.ts` | Sincronização específica de itens Bling |
| `syncMarketplaceItems.ts` | Sincronização de itens de marketplaces (ML, Shopee) |
| `txtOfflineService.ts` | Processamento de TXT offline para etiquetas |
| `zplService.ts` | Processamento de fluxos/streams ZPL |

### Hooks Customizados (`hooks/`)

| Hook | Descrição |
|------|-----------|
| `useEstoque.ts` | Gerenciamento de estoque com cálculos de BOM |
| `useEtiquetasPrioritarias.ts` | Etiquetas prioritárias com sistema de fila |
| `useFluxoCompleteEtiquetas.ts` | Fluxo completo de etiquetas (DANFE + ZPL) |

### Bibliotecas (`lib/`)

| Arquivo | Descrição |
|---------|-----------|
| `supabaseClient.ts` | Cliente Supabase + funções de login/logout |
| `parser.ts` | Parser de Excel para múltiplas plataformas |
| `xmlParser.ts` | Parser de XML de NF-e + extração de ZIP |
| `export.ts` | Exportação para PDF, PPTX, Excel, SQL |
| `accessControl.ts` | Controle de acesso por role e permissões |
| `sefazIntegration.ts` | Integração com Sefaz (geração e envio de NF-e) |
| `danfeSimplificada.ts` | Geração de DANFE simplificada em PDF |

---

## 15. Componentes Principais

### Modals de CRUD

| Componente | Descrição |
|-----------|-----------|
| `AddItemModal` | Cadastro de novo item de estoque |
| `EditItemModal` | Edição de item existente |
| `BomConfigModal` | Configuração de receita BOM |
| `PackGroupModal` | Criar/editar pacotes prontos |
| `ManualMovementModal` | Ajuste manual de estoque |
| `ImportXmlModal` | Upload e processamento de NF-e XML |

### Modals Especializados

| Componente | Descrição |
|-----------|-----------|
| `LinkSkuModal` | Vinculação de SKU importado ao master |
| `CreateProductFromImportModal` | Cria produto a partir de importação |
| `BarcodeLabelModal` | Geração de etiqueta com código de barras |
| `VolatilMovementModal` | Entrada/saída de pacote volátil |
| `FinanceImportModal` | Importação de dados financeiros |
| `ZplMergerModal` | Merge de blocos ZPL |

### Componentes de Visualização

| Componente | Descrição |
|-----------|-----------|
| `GlobalHeader` | Barra superior (navegação, QR, alertas) |
| `Sidebar` | Menu lateral colapsável |
| `AdminNotices` | Avisos post-it do administrador |
| `DailyOverviewWidgets` | Widgets do dashboard |
| `Pagination` | Componente de paginação reutilizável |
| `FileUploader` | Upload drag-and-drop |

### Componentes Bling

| Componente | Descrição |
|-----------|-----------|
| `BlingSync` | Widget de sincronização Bling |
| `AbaImportacaoPedidosBling` | Aba de importação de pedidos |
| `AbaBlingNaoVinculados` | Aba de itens não vinculados |
| `AbaLogistica` | Gerenciamento de logística |
| `BlingPedidosItemsSync` | Sincronização de itens de pedidos |

### Componentes de Etiquetas

| Componente | Descrição |
|-----------|-----------|
| `EtiquetasPrioritarias` | Gerenciador de etiquetas prioritárias |
| `DANFEGerenciador` | Viewer/manager de DANFE |
| `FluxoCompleteEtiquetas` | Fluxo completo DANFE + ZPL |

---

## 16. Fluxos de Dados Entre Setores

### Fluxo 1: Importação → Bipagem → Estoque → Financeiro

```
Planilha Excel (ML / Shopee / TikTok)
  ↓ ImporterPage: parseExcelFile()
  ↓ Identifica SKUs e vincula via sku_links
  ↓ Grava em: orders
  ↓
BipagemPage: Operador escaneia pedido
  ↓ Resolve BOM do produto vendido
  ↓ Deduz insumos (stock_movements com origin=BIP)
  ↓ Registra em: scan_logs
  ↓
EstoquePage: Visualiza movimentações
  ↓ current_qty atualizado
  ↓
FinancePage: Analisa custos e margens
  ↓ Usa cost_price dos insumos + dados de pedidos
```

### Fluxo 2: Sincronização Bling

```
BlingPage: Configura OAuth Token
  ↓
/api/bling/sync/orders → Pedidos do Bling
  ↓ Transforma + vincula via sku_links
  ↓ Grava em: orders
  ↓
/api/bling/sync/invoices → NF-e do Bling
  ↓ Grava em: bling_nfe
  ↓
EtiquetasPage: Gera etiquetas ZPL
  ↓ Usa dados da NF-e + pedido
  ↓ Gera .zpl ou PDF para impressão
```

### Fluxo 3: Produção (Pesagem → Packing)

```
MaquinasPage: Operador registra pesagem
  ↓ weighing_batches (insumo → produto)
  ↓ stock_movements: -input insumo, +output produto
  ↓
MoagemPage: Reciclagem/processamento
  ↓ grinding_batches
  ↓ stock_movements: transforma insumo A em B
  ↓
EstoquePage > Pacotes Prontos
  ↓ Entrada manual (volátil) ou calculado (tradicional)
  ↓ stock_pack_groups atualizado
```

### Fluxo 4: Planejamento de Produção

```
PlanejamentoPage: Analisa histórico de vendas
  ↓ Calcula consumo médio diário por SKU
  ↓ Previsão de demanda + buffer de segurança
  ↓ Gera production_plans + production_plan_items
  ↓
  ↓ Calcula insumos necessários via BOM
  ↓ Gera shopping_list_items (lista de compras)
  ↓ Operador revisa e confirma compras
```

### Fluxo 5: Entrada de NF-e → Estoque + Financeiro

```
ImportXmlModal: Upload de XML/ZIP de NF-e
  ↓ parseNFeXML() extrai itens
  ↓ Vincula a stock_items via SKU
  ↓
  ↓ Incrementa current_qty de cada item (stock_movements origin=IMPORT_XML)
  ↓ Cria DespesaLancamento com valor total + fornecedor
  ↓ Registra em import_history
```

---

## 17. API Endpoints

### Bling OAuth

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/bling/token` | Troca authorization_code por access_token |
| GET | `/api/debug/token-test` | Página de teste de autenticação |

### Sincronização Bling

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/bling/sync/orders` | Busca pedidos de venda do Bling |
| GET | `/api/bling/sync/invoices` | Busca NF-e do Bling |
| GET | `/api/bling/sync/products` | Sincroniza catálogo de produtos |
| GET | `/api/bling/sync/stock` | Busca saldos de estoque |
| POST | `/api/bling/sync/all` | Sincroniza tudo em paralelo |
| POST | `/api/bling/sync/vinculate` | Vincula produto ERP → Bling |
| GET | `/api/bling/sync/status` | Status da última sincronização |
| POST | `/api/bling/estoque/atualizar` | Ajusta saldo no Bling |

### NF-e

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/bling/nfe/save-batch` | Salva NF-e em lote no Supabase |
| GET | `/api/erp/nfe/synced-ids` | Retorna chaves de NF-e já sincronizadas |

### Operações em Massa

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/bling/filter` | Filtra dados sincronizados |
| POST | `/api/bling/bulk/change-status` | Altera status em massa |
| POST | `/api/bling/bulk/assign-lote` | Atribui itens a lote |
| POST | `/api/bling/bulk/delete` | Deleta itens em massa |
| POST | `/api/bling/export/csv` | Exporta como CSV |

### Lotes

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/bling/lotes` | Lista lotes |
| POST | `/api/bling/lotes` | Cria novo lote |

### Utilitários

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/download-project` | Download do projeto como ZIP |

---

## 18. Deploy e Configuração

### Variáveis de Ambiente

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=sua_chave_publica
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
```

### Setup do Banco de Dados

1. Criar projeto no Supabase
2. Habilitar extensões: `uuid-ossp`, `pgcrypto`, `pg_trgm`
3. Executar `BANCO_COMPLETO_v8.sql`
4. Verificar em `DatabaseSetupPage`

### Build e Deploy

```bash
npm install              # Instala dependências
npm run dev              # Servidor de desenvolvimento + server.ts
npm run build            # Build via Vite → dist/
npm run start            # Produção (server.ts com HTTPS se certs existirem)
```

O servidor roda na porta `:3000` com HTTPS se os certificados estiverem presentes.

### Certificados SSL

Para HTTPS local, gere certificados:
- `generate_cert.py` ou `generate-cert.js`
- Coloque `server.key` e `server.cert` na raiz

---

> **Última atualização**: Documentação gerada automaticamente refletindo o estado atual do sistema.
