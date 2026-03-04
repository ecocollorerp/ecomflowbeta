@{
  pedidoId = "PEDIDO-001"
  cliente = @{
    nome = "Teste LTDA"
    cnpj = "12.345.678/0001-90"
  }
  valor = 1500.00
} | ConvertTo-Json | Out-File -Encoding UTF8 -FilePath payload.json
