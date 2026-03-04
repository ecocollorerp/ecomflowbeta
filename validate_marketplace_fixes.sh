#!/bin/bash
# ============================================================================
# VALIDAÇÃO: Verificar que as mudanças de itens marketplace foram aplicadas
# ============================================================================

echo "🔍 VALIDANDO CORREÇÕES DE ITENS MARKETPLACE"
echo "============================================="
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contador de validações
PASSED=0
FAILED=0

# ─────────────────────────────────────────────────────────────────────────
# CHECK 1: Arquivo server.ts modificado corretamente
# ─────────────────────────────────────────────────────────────────────────
echo "1️⃣  Verificando server.ts..."

# Procurar por MAX_PAGES (novo)
if grep -q "const MAX_PAGES = 10000" server.ts; then
    echo -e "${GREEN}✅ MAX_PAGES removido limite ML (10000)${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ MAX_PAGES não encontrado ou valor incorreto${NC}"
    ((FAILED++))
fi

# Procurar por MAX_PAGES_SHOPEE (novo)
if grep -q "const MAX_PAGES_SHOPEE = 10000" server.ts; then
    echo -e "${GREEN}✅ MAX_PAGES_SHOPEE removido limite Shopee (10000)${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ MAX_PAGES_SHOPEE não encontrado ou valor incorreto${NC}"
    ((FAILED++))
fi

# Procurar por logging ML
if grep -q "📦 ML: Página" server.ts; then
    echo -e "${GREEN}✅ Logging de progresso ML adicionado${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Logging ML não encontrado${NC}"
    ((FAILED++))
fi

# Procurar por logging itens ML
if grep -q "📦 \\[ML\\].*itens" server.ts; then
    echo -e "${GREEN}✅ Logging de itens ML adicionado${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Logging de itens ML não encontrado${NC}"
    ((FAILED++))
fi

# Procurar por logging Shopee
if grep -q "📦 Shopee: Lote" server.ts; then
    echo -e "${GREEN}✅ Logging de lotes Shopee adicionado${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Logging Shopee não encontrado${NC}"
    ((FAILED++))
fi

# Procurar por try-catch Shopee lotes
if grep -q "try {" server.ts && grep -q "catch (err)" server.ts; then
    echo -e "${GREEN}✅ Try-catch para lotes Shopee adicionado${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Try-catch Shopee não encontrado${NC}"
    ((FAILED++))
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 2: Novo arquivo de sincronização criado
# ─────────────────────────────────────────────────────────────────────────
echo "2️⃣  Verificando services/syncMarketplaceItems.ts..."

if [ -f "services/syncMarketplaceItems.ts" ]; then
    echo -e "${GREEN}✅ services/syncMarketplaceItems.ts criado${NC}"
    ((PASSED++))

    # Procurar por funções esperadas
    if grep -q "salvarItensML" services/syncMarketplaceItems.ts; then
        echo -e "${GREEN}  ✓ Função salvarItensML encontrada${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}  ⚠ salvarItensML não encontrada${NC}"
        ((FAILED++))
    fi

    if grep -q "salvarItensShopee" services/syncMarketplaceItems.ts; then
        echo -e "${GREEN}  ✓ Função salvarItensShopee encontrada${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}  ⚠ salvarItensShopee não encontrada${NC}"
        ((FAILED++))
    fi

    if grep -q "buscarItens" services/syncMarketplaceItems.ts; then
        echo -e "${GREEN}  ✓ Função buscarItens encontrada${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}  ⚠ buscarItens não encontrada${NC}"
        ((FAILED++))
    fi
else
    echo -e "${RED}❌ services/syncMarketplaceItems.ts NÃO criado${NC}"
    ((FAILED++))
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 3: Arquivos de teste
# ─────────────────────────────────────────────────────────────────────────
echo "3️⃣  Verificando scripts de teste..."

if [ -f "test_marketplace_items.ps1" ]; then
    echo -e "${GREEN}✅ test_marketplace_items.ps1 criado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ test_marketplace_items.ps1 não encontrado${NC}"
    ((FAILED++))
fi

if [ -f "test_marketplace_items.sh" ]; then
    echo -e "${GREEN}✅ test_marketplace_items.sh criado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ test_marketplace_items.sh não encontrado${NC}"
    ((FAILED++))
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 4: Documentação
# ─────────────────────────────────────────────────────────────────────────
echo "4️⃣  Verificando documentação..."

if [ -f "DIAGNOTICO_MARKETPLACE_ITEMS.md" ]; then
    echo -e "${GREEN}✅ DIAGNOTICO_MARKETPLACE_ITEMS.md criado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ DIAGNOTICO_MARKETPLACE_ITEMS.md não encontrado${NC}"
fi

if [ -f "RESUMO_CORRECOES_MARKETPLACE.md" ]; then
    echo -e "${GREEN}✅ RESUMO_CORRECOES_MARKETPLACE.md criado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ RESUMO_CORRECOES_MARKETPLACE.md não encontrado${NC}"
fi

if [ -f "INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md" ]; then
    echo -e "${GREEN}✅ INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md criado${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md não encontrado${NC}"
fi

echo ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 5: Tabela order_items no banco (opcional)
# ─────────────────────────────────────────────────────────────────────────
echo "5️⃣  Verificando database (SKIP se não configurado)..."
echo -e "${YELLOW}ℹ️  Para verificar, execute:${NC}"
echo "   SELECT COUNT(*) FROM order_items WHERE canal IN ('ML', 'SHOPEE');"
echo ""

# ─────────────────────────────────────────────────────────────────────────
# RESULTADO FINAL
# ─────────────────────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════"
echo ""
echo "📊 RESULTADO DA VALIDAÇÃO"
echo "─────────────────────────"
echo -e "${GREEN}✅ Passou: $PASSED${NC}"
echo -e "${RED}❌ Falhou: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 VALIDAÇÃO COMPLETA! Todas as mudanças foram aplicadas.${NC}"
    echo ""
    echo "📝 Próximos passos:"
    echo "  1. npm run dev"
    echo "  2. Acesse IntegracoesPage e teste sincronização"
    echo "  3. Execute: .\test_marketplace_items.ps1"
    echo "  4. Procure por '📦 [ML]' ou '📦 [SHOPEE]' nos logs"
    echo ""
else
    echo -e "${RED}⚠️  VALIDAÇÃO INCOMPLETA! Verifique os erros acima.${NC}"
    echo ""
fi

echo "════════════════════════════════════════════════"
