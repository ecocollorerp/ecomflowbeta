# ============================================================================
# VALIDAÇÃO: Verificar que as mudanças de itens marketplace foram aplicadas
# ============================================================================

Write-Host "🔍 VALIDANDO CORREÇÕES DE ITENS MARKETPLACE" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Contador de validações
$passed = 0
$failed = 0

# ─────────────────────────────────────────────────────────────────────────
# CHECK 1: Arquivo server.ts modificado corretamente
# ─────────────────────────────────────────────────────────────────────────
Write-Host "1️⃣  Verificando server.ts..." -ForegroundColor Yellow

$serverContent = Get-Content "server.ts" -Raw -ErrorAction SilentlyContinue

if ($serverContent -match "const MAX_PAGES = 10000") {
    Write-Host "✅ MAX_PAGES removido limite ML (10000)" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ MAX_PAGES não encontrado ou valor incorreto" -ForegroundColor Red
    $failed++
}

if ($serverContent -match "const MAX_PAGES_SHOPEE = 10000") {
    Write-Host "✅ MAX_PAGES_SHOPEE removido limite Shopee (10000)" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ MAX_PAGES_SHOPEE não encontrado ou valor incorreto" -ForegroundColor Red
    $failed++
}

if ($serverContent -match "📦 ML: Página") {
    Write-Host "✅ Logging de progresso ML adicionado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ Logging ML não encontrado" -ForegroundColor Red
    $failed++
}

if ($serverContent -match "📦 \[ML\].*itens") {
    Write-Host "✅ Logging de itens ML adicionado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ Logging de itens ML não encontrado" -ForegroundColor Red
    $failed++
}

if ($serverContent -match "📦 Shopee: Lote") {
    Write-Host "✅ Logging de lotes Shopee adicionado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ Logging Shopee não encontrado" -ForegroundColor Red
    $failed++
}

if ($serverContent -match "try \{" -and $serverContent -match "catch \(err\)") {
    Write-Host "✅ Try-catch para lotes Shopee adicionado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "❌ Try-catch Shopee não encontrado" -ForegroundColor Red
    $failed++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 2: Novo arquivo de sincronização criado
# ─────────────────────────────────────────────────────────────────────────
Write-Host "2️⃣  Verificando services/syncMarketplaceItems.ts..." -ForegroundColor Yellow

if (Test-Path "services/syncMarketplaceItems.ts") {
    Write-Host "✅ services/syncMarketplaceItems.ts criado" -ForegroundColor Green
    $passed++

    $syncContent = Get-Content "services/syncMarketplaceItems.ts" -Raw -ErrorAction SilentlyContinue

    if ($syncContent -match "salvarItensML") {
        Write-Host "  ✓ Função salvarItensML encontrada" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  ⚠ salvarItensML não encontrada" -ForegroundColor Yellow
        $failed++
    }

    if ($syncContent -match "salvarItensShopee") {
        Write-Host "  ✓ Função salvarItensShopee encontrada" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  ⚠ salvarItensShopee não encontrada" -ForegroundColor Yellow
        $failed++
    }

    if ($syncContent -match "buscarItens") {
        Write-Host "  ✓ Função buscarItens encontrada" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "  ⚠ buscarItens não encontrada" -ForegroundColor Yellow
        $failed++
    }
} else {
    Write-Host "❌ services/syncMarketplaceItems.ts NÃO criado" -ForegroundColor Red
    $failed++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 3: Arquivos de teste
# ─────────────────────────────────────────────────────────────────────────
Write-Host "3️⃣  Verificando scripts de teste..." -ForegroundColor Yellow

if (Test-Path "test_marketplace_items.ps1") {
    Write-Host "✅ test_marketplace_items.ps1 criado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "⚠ test_marketplace_items.ps1 não encontrado" -ForegroundColor Yellow
    $failed++
}

if (Test-Path "test_marketplace_items.sh") {
    Write-Host "✅ test_marketplace_items.sh criado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "⚠ test_marketplace_items.sh não encontrado" -ForegroundColor Yellow
    $failed++
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 4: Documentação
# ─────────────────────────────────────────────────────────────────────────
Write-Host "4️⃣  Verificando documentação..." -ForegroundColor Yellow

if (Test-Path "DIAGNOTICO_MARKETPLACE_ITEMS.md") {
    Write-Host "✅ DIAGNOTICO_MARKETPLACE_ITEMS.md criado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "⚠ DIAGNOTICO_MARKETPLACE_ITEMS.md não encontrado" -ForegroundColor Yellow
}

if (Test-Path "RESUMO_CORRECOES_MARKETPLACE.md") {
    Write-Host "✅ RESUMO_CORRECOES_MARKETPLACE.md criado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "⚠ RESUMO_CORRECOES_MARKETPLACE.md não encontrado" -ForegroundColor Yellow
}

if (Test-Path "INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md") {
    Write-Host "✅ INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md criado" -ForegroundColor Green
    $passed++
} else {
    Write-Host "⚠ INTEGRACAO_RAPIDA_ITEMS_MARKETPLACE.md não encontrado" -ForegroundColor Yellow
}

Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# CHECK 5: Tabela order_items no banco (opcional)
# ─────────────────────────────────────────────────────────────────────────
Write-Host "5️⃣  Verificando database (SKIP se não configurado)..." -ForegroundColor Yellow
Write-Host "ℹ️  Para verificar, execute:" -ForegroundColor Cyan
Write-Host "   SELECT COUNT(*) FROM order_items WHERE canal IN ('ML', 'SHOPEE');" -ForegroundColor Gray
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────
# RESULTADO FINAL
# ─────────────────────────────────────────────────────────────────────────
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 RESULTADO DA VALIDAÇÃO" -ForegroundColor Cyan
Write-Host "─────────────────────────"
Write-Host "✅ Passou: $passed" -ForegroundColor Green
Write-Host "❌ Falhou: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "🎉 VALIDAÇÃO COMPLETA! Todas as mudanças foram aplicadas." -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
    Write-Host "  1. npm run dev" -ForegroundColor Gray
    Write-Host "  2. Acesse IntegracoesPage e teste sincronização" -ForegroundColor Gray
    Write-Host "  3. Execute: .\test_marketplace_items.ps1" -ForegroundColor Gray
    Write-Host "  4. Procure por '📦 [ML]' ou '📦 [SHOPEE]' nos logs" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️  VALIDAÇÃO INCOMPLETA! Verifique os erros acima." -ForegroundColor Red
    Write-Host ""
}

Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
