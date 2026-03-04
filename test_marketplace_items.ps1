# PowerShell script para testar sincronização de itens em marketplace
# Teste: Verifica se itens marketplace estão sendo importados

Write-Host "🧪 Testando sincronização de itens em MARKETPLACE" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# URL base (ajuste conforme sua configuração)
$BASE_URL = "https://localhost:3000"

# Credenciais de teste (SUBSTITUA PELAS SUAS)
# Mercado Livre
$ML_ACCESS_TOKEN = "SEU_ACCESS_TOKEN_ML"
$ML_DATE_FROM = "2024-01-01"
$ML_DATE_TO = "2025-12-31"

# Shopee
$SHOPEE_PARTNER_ID = "1234567"
$SHOPEE_PARTNER_KEY = "sua_chave_partner"
$SHOPEE_SHOP_ID = "123456789"
$SHOPEE_ACCESS_TOKEN = "seu_token_acesso"
$SHOPEE_DATE_FROM = "2024-01-01"
$SHOPEE_DATE_TO = "2025-12-31"

# Ignorar erro de certificado SSL (self-signed)
if (-not ([System.Management.Automation.PSTypeName]'ServerCertificateValidationCallback').Type) {
    $certCallback = @"
        using System;
        using System.Net;
        using System.Net.Security;
        using System.Security.Cryptography.X509Certificates;
        public class ServerCertificateValidationCallback
        {
            public static void Ignore()
            {
                if(ServicePointManager.ServerCertificateValidationCallback ==null)
                {
                    ServicePointManager.ServerCertificateValidationCallback += 
                        delegate (
                            Object obj,
                            X509Certificate certificate,
                            X509Chain chain,
                            SslPolicyErrors errors)
                        {
                            return true;
                        };
                }
            }
        }
"@
    Add-Type $certCallback
}
[ServerCertificateValidationCallback]::Ignore()

# ─────────────────────────────── MERCADO LIVRE ────────────────────────────────
Write-Host "📦 Testando Mercado Livre..." -ForegroundColor Yellow
$mlUri = "$BASE_URL/api/ml/sync/orders?access_token=$ML_ACCESS_TOKEN&dateFrom=$ML_DATE_FROM&dateTo=$ML_DATE_TO"
Write-Host "GET $mlUri" -ForegroundColor Green
Write-Host ""

try {
    $mlResponse = Invoke-WebRequest $mlUri -Method GET -ContentType "application/json" -ErrorAction Stop
    $mlData = $mlResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ RESPOSTA MERCADO LIVRE:" -ForegroundColor Green
    Write-Host "Status: $($mlResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Pedidos: $($mlData.orders.Count)" -ForegroundColor Cyan
    Write-Host "Itens Totais: $($mlData.orders | ForEach-Object { $_.itens.Count } | Measure-Object -Sum | Select-Object -ExpandProperty Sum)" -ForegroundColor Cyan
    
    # Mostrar detalhes de cada pedido
    Write-Host ""
    Write-Host "Detalhes dos pedidos:" -ForegroundColor Yellow
    foreach ($order in $mlData.orders) {
        $itemCount = $order.itens.Count
        if ($itemCount -eq 0) {
            Write-Host "  ⚠️  Pedido $($order.orderId): SEM ITENS" -ForegroundColor Red
        } else {
            Write-Host "  ✅ Pedido $($order.orderId): $itemCount itens" -ForegroundColor Green
        }
    }
    
} catch {
    Write-Host "❌ Erro ao testar Mercado Livre: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────── SHOPEE ────────────────────────────────
Write-Host "📦 Testando Shopee..." -ForegroundColor Yellow
$shopeeUri = "$BASE_URL/api/shopee/sync/orders?partnerId=$SHOPEE_PARTNER_ID&partnerKey=$SHOPEE_PARTNER_KEY&shopId=$SHOPEE_SHOP_ID&accessToken=$SHOPEE_ACCESS_TOKEN&dateFrom=$SHOPEE_DATE_FROM&dateTo=$SHOPEE_DATE_TO"
Write-Host "GET $shopeeUri" -ForegroundColor Green
Write-Host ""

try {
    $shopeeResponse = Invoke-WebRequest $shopeeUri -Method GET -ContentType "application/json" -ErrorAction Stop
    $shopeeData = $shopeeResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ RESPOSTA SHOPEE:" -ForegroundColor Green
    Write-Host "Status: $($shopeeResponse.StatusCode)" -ForegroundColor Green
    Write-Host "Pedidos: $($shopeeData.orders.Count)" -ForegroundColor Cyan
    Write-Host "Itens Totais: $($shopeeData.orders | ForEach-Object { $_.itens.Count } | Measure-Object -Sum | Select-Object -ExpandProperty Sum)" -ForegroundColor Cyan
    
    # Mostrar detalhes de cada pedido
    Write-Host ""
    Write-Host "Detalhes dos pedidos:" -ForegroundColor Yellow
    foreach ($order in $shopeeData.orders) {
        $itemCount = $order.itens.Count
        if ($itemCount -eq 0) {
            Write-Host "  ⚠️  Pedido $($order.orderId): SEM ITENS" -ForegroundColor Red
        } else {
            Write-Host "  ✅ Pedido $($order.orderId): $itemCount itens" -ForegroundColor Green
        }
    }
    
} catch {
    Write-Host "❌ Erro ao testar Shopee: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Teste completo!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 DICAS DE DEBUG:" -ForegroundColor Yellow
Write-Host "  1. Procure por '📦 [ML]' ou '📦 [SHOPEE]' nos logs do servidor" -ForegroundColor Gray
Write-Host "  2. Se ver 'PEDIDO ... SEM ITENS', o problema está na extração de itens" -ForegroundColor Gray
Write-Host "  3. Se a contagem de pedidos estiver baixa, verifique a paginação" -ForegroundColor Gray
Write-Host "  4. Confirme credenciais e datas estão corretas" -ForegroundColor Gray
Write-Host "  5. Verifique console do servidor com: npm run dev" -ForegroundColor Gray
