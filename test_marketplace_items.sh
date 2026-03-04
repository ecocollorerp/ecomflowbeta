#!/bin/bash
# Script de teste: Verifica se itens marketplace estão sendo importados
# Uso: ./test_marketplace_items.sh

echo "🧪 Testando sincronização de itens em MARKETPLACE"
echo "=================================================="
echo ""

# URL base (ajuste conforme sua configuração)
BASE_URL="https://localhost:3000"

# Credenciais de teste (substitua pelas suas)
# Para Mercado Livre
ML_ACCESS_TOKEN="seu_access_token_ml"
ML_SELLER_ID="123456"

# Para Shopee
SHOPEE_PARTNER_ID="1234567"
SHOPEE_PARTNER_KEY="sua_chave_partner"
SHOPEE_SHOP_ID="123456789"
SHOPEE_ACCESS_TOKEN="seu_token_acesso"

echo "📦 Testando Mercado Livre..."
echo "GET ${BASE_URL}/api/ml/sync/orders?access_token=${ML_ACCESS_TOKEN}&dateFrom=2025-01-01&dateTo=2025-12-31"
echo ""
curl -X GET "${BASE_URL}/api/ml/sync/orders?access_token=${ML_ACCESS_TOKEN}&dateFrom=2025-01-01&dateTo=2025-12-31" \
  --insecure \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  2>/dev/null | jq .

echo ""
echo "════════════════════════════════════════════════"
echo ""
echo "📦 Testando Shopee..."
echo "GET ${BASE_URL}/api/shopee/sync/orders?partnerId=${SHOPEE_PARTNER_ID}&partnerKey=${SHOPEE_PARTNER_KEY}&shopId=${SHOPEE_SHOP_ID}&accessToken=${SHOPEE_ACCESS_TOKEN}&dateFrom=2025-01-01&dateTo=2025-12-31"
echo ""
curl -X GET "${BASE_URL}/api/shopee/sync/orders?partnerId=${SHOPEE_PARTNER_ID}&partnerKey=${SHOPEE_PARTNER_KEY}&shopId=${SHOPEE_SHOP_ID}&accessToken=${SHOPEE_ACCESS_TOKEN}&dateFrom=2025-01-01&dateTo=2025-12-31" \
  --insecure \
  -H "Content-Type: application/json" \
  -w "\n\nStatus: %{http_code}\n" \
  2>/dev/null | jq .

echo ""
echo "✅ Teste completo!"
echo ""
echo "📝 Dicas de debug:"
echo "  1. Verifique console.log no servidor (procure por '📦 [ML]' ou '📦 [SHOPEE]')"
echo "  2. Se ver 'PEDIDO ... SEM ITENS', o problema está na extração de itens"
echo "  3. Se a contagem de pedidos estiver baixa, verifique a paginação"
echo "  4. Confirme credenciais e datas no intervalo desejado"
