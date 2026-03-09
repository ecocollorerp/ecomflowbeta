# 🔗 VINCULAR PRODUTOS DANFE COM SKU DO ERP

## 📋 O Problema

Quando você recebe uma nota fiscal de saída do Bling (gerada pela Shopee/Mercado Livre):
- A nota tem produtos com códigos da Shopee
- O DANFE mostra esses códigos Shopee
- Mas você precisa que mostre os **SKUs do seu ERP**
- Não havia forma de fazer esse mapeamento antes

---

## ✅ A Solução

### Novo Componente: `VincularProdutoDanfeComSKU.tsx`

Permite vincular cada produto da DANFE com o SKU principal do seu ERP.

**Características:**
- ✅ Interface de tabela intuitiva
- ✅ Busca de SKUs em tempo real
- ✅ Salva no banco de dados
- ✅ Valida os campos
- ✅ Mostra resumo de vinculações

---

## 🎯 Onde Adicionar

### Na página de Vendas/Notas Fiscais de Saída:

```tsx
// pages/VendasPage.tsx (ou similar)

import { AbaVincularSkuDanfe } from '../components/AbaVincularSkuDanfe';

export const VendasPage = () => {
  const [notaFiscalSelecionada, setNotaFiscalSelecionada] = useState(null);

  return (
    <div className="space-y-6">
      {/* ... lista de notas fiscais ... */}
      
      <div className="border-t pt-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => console.log('Imprimir DANFE')}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            🖨️ Imprimir DANFE
          </button>
          
          <button
            onClick={() => setMostrarVinculoSkus(true)}
            className="px-4 py-2 bg-orange-600 text-white rounded"
          >
            🔗 Vincular SKUs
          </button>
        </div>

        {mostrarVinculoSkus && (
          <AbaVincularSkuDanfe
            notaFiscal={notaFiscalSelecionada}
            marketplace="SHOPEE"
            onVinculoSalvo={() => {
              console.log('✅ SKUs vinculados');
              // Recarrega nota ou atualiza estado
            }}
          />
        )}
      </div>
    </div>
  );
};
```

---

## 📊 O Que Acontece

### 1. Usuário Clica em "Vincular SKUs"
```
Modal/Aba Abre Mostrando:
┌────────────────────────────────────────────────────┐
│ 🔗 Vincular Produtos DANFE com SKUs do ERP        │
│                                                    │
│ Código DANFE | Descrição | SKU Principal | Ação   │
├────────────────────────────────────────────────────┤
│ 5481923      | Camiseta  | [select SKU] | [edit]  │
│ 5481924      | Calça     | [select SKU] | [edit]  │
│ 5481925      | Tênis     | [select SKU] | [edit]  │
└────────────────────────────────────────────────────┘
```

### 2. Seleciona SKU para cada Produto
```
Clica em [select SKU]:
1. Mostra dropdown com SKUs disponíveis
2. Pode buscar por nome ou código
3. Seleciona um SKU

Resultado:
┌────────────────────────────────────────────────────┐
│ 5481923 | Camiseta | CAMI-001 | ✓                  │
│ 5481924 | Calça    | CALC-002 | ✓                  │
│ 5481925 | Tênis    | TENIS-01 | ✓                  │
└────────────────────────────────────────────────────┘
```

### 3. Salva as Vinculações
```
Clica em [✅ Salvar Vinculações]

Sistema:
✓ Valida que todos têm SKU
✓ Insere/atualiza na tabela skus_vinculados
✓ Mostra mensagem de sucesso
✓ Retorna callback onVinculoSalvo()

Resultado:
✅ 3 vinculação(ões) salva(s) com sucesso!
```

### 4. Usa ao Gerar DANFE Consolidada
```
Quando gera DANFE + Etiqueta:

❌ Antes (sem vinculação):
DANFE mostra:
- Produto: Camiseta (SKU: 5481923)

✅ Depois (com vinculação):
DANFE mostra:
- Produto: Camiseta (SKU: CAMI-001)  ← Vinculação usada!
```

---

## 💾 O Que Salva no Banco

### Tabela: `skus_vinculados`

```sql
INSERT INTO skus_vinculados (
  codigoDanfe,      -- "5481923" (código original da Shopee)
  descricaoDanfe,   -- "Camiseta Azul"
  skuEtiqueta,      -- "5481923" (mesmo que codigoDanfe)
  skuPrincipal,     -- "CAMI-001" (SKU do ERP selecionado)
  nomeProduto,      -- "Camiseta Azul" (nome do SKU do ERP)
  marketplace       -- "SHOPEE"
) VALUES (...)
```

**Próximas vezes:** Quando buscar produtos da Shopee novamente, o sistema já encontra a vinculação salva.

---

## 🔄 Fluxo Completo de Uso

```
1. USUÁRIO ACESSA UM PEDIDO DO BLING
   ↓
2. CLICA EM "Vendas > Notas Fiscais de Saída"
   ↓
3. SELECIONA UMA NOTA FISCAL
   ↓
4. CLICA EM "🔗 Vincular SKUs"
   ↓
5. ABRE MODAL COM PRODUTOS
   ↓
6. PARA CADA PRODUTO:
   • Clica em [select SKU]
   • Busca ou seleciona o SKU correspondente
   • Confirma
   ↓
7. CLICA EM "✅ Salvar Vinculações"
   ↓
8. VINCULAÇÕES SALVAS NO BANCO
   ↓
9. USUÁRIO CLICA EM "🖨️ Imprimir DANFE + Etiqueta"
   ↓
10. DANFE IMPRIME COM SKUs VINCULADOS
    (não mais com códigos Shopee)
```

---

## 🎨 UI da Tabela

```
┌──────────────┬────────────────┬───┬───────────────┬────────────────┬──────┐
│ Código DANFE │   Descrição    │   │ SKU Principal │ Nome do Produto│ Ação │
├──────────────┼────────────────┼───┼───────────────┼────────────────┼──────┤
│ 5481923      │ Camiseta Azul  │ → │ [select SKU]  │               │ [+]  │
│ 5481924      │ Calça Preta    │ → │ [select SKU]  │               │ [+]  │
│ 5481925      │ Tênis Branco   │ → │ [select SKU]  │               │ [+]  │
└──────────────┴────────────────┴───┴───────────────┴────────────────┴──────┘

Quando clica em [select SKU]:
┌─────────────────────────────────────────┐
│ Selecionar SKU...                       │
│ CAMI-001 - Camiseta Azul               │
│ CAMI-002 - Camiseta Preta              │
│ CALC-001 - Calça Jeans                 │
│ TENIS-01 - Tênis Esportivo             │
└─────────────────────────────────────────┘

Depois de selecionar:
┌──────────────┬────────────────┬───┬───────────────┬────────────────┬──────┐
│ 5481923      │ Camiseta Azul  │ → │ CAMI-001      │ Camiseta Azul │ [✓]  │
└──────────────┴────────────────┴───┴───────────────┴────────────────┴──────┘
```

---

## 🔧 Integração Passo a Passo

### Passo 1: Importar Componentes
```tsx
import { AbaVincularSkuDanfe } from '../components/AbaVincularSkuDanfe';
import VincularProdutoDanfeComSKU from '../components/VincularProdutoDanfeComSKU';
```

### Passo 2: Estado na Página
```tsx
const [mostrarVinculoSkus, setMostrarVinculoSkus] = useState(false);
const [notaFiscalSelecionada, setNotaFiscalSelecionada] = useState(null);
```

### Passo 3: Botão para Abrir
```tsx
<button
  onClick={() => setMostrarVinculoSkus(true)}
  className="px-4 py-2 bg-orange-600 text-white rounded flex items-center gap-2"
>
  🔗 Vincular SKUs
</button>
```

### Passo 4: Render Condicional
```tsx
{mostrarVinculoSkus && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Vincular SKUs</h2>
        <button
          onClick={() => setMostrarVinculoSkus(false)}
          className="text-gray-500 hover:text-gray-700 text-2xl"
        >
          ✕
        </button>
      </div>

      <AbaVincularSkuDanfe
        notaFiscal={notaFiscalSelecionada}
        marketplace="SHOPEE"
        onVinculoSalvo={() => {
          setMostrarVinculoSkus(false);
          toast.success('✅ SKUs vinculados com sucesso!');
        }}
      />
    </div>
  </div>
)}
```

---

## 🎯 Integração com Geração de DANFE

### Ao Gerar DANFE Consolidada:

```typescript
// services/danfeSimplificadoComEtiquetaService.ts

const gerarDanfeSimplificado = async (pedido) => {
  // Buscar vinculações salvas
  const { data: vinculos } = await supabaseClient
    .from('skus_vinculados')
    .select('*')
    .eq('marketplace', pedido.marketplace);

  // Para cada item, procurar vinculação
  const itensComSku = pedido.itens.map(item => {
    const vinculo = vinculos?.find(v => v.skuEtiqueta === item.codigo);
    
    return {
      ...item,
      skuPrincipal: vinculo?.skuPrincipal || item.codigo,
      nomeProduto: vinculo?.nomeProduto || item.descricao
    };
  });

  // Usar itensComSku no DANFE
  // ...
};
```

---

## 📍 Onde Aparece na Interface

### Vendas → Notas Fiscais de Saída

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Notas Fiscais de Saída (Bling)                           │
└─────────────────────────────────────────────────────────────┘

[Lista de Notas Fiscais]
#12345 | Cliente XYZ | 3 itens
  ├─ [🖨️ Imprimir DANFE]
  ├─ [🔗 Vincular SKUs]    ← NOVO!
  └─ [📉 Detalhes]

[Ao clicar em "🔗 Vincular SKUs"]
  └─→ Abre Modal com Tabela de Vinculação
```

---

## ✨ Benefícios

✅ **Sem Re-digitação** - Vincula uma vez, usa sempre  
✅ **Automático** - Sistema usa a vinculação na geração  
✅ **Flexível** - Pode mudar a qualquer momento  
✅ **Rastreável** - Registra a data de vinculação  
✅ **Marketplace-Específico** - Diferentes vinculações por Shopee/Mercado Livre  
✅ **Persistente** - Salvo no banco de dados  

---

## 🚀 Próximos Passos

1. **Adicionar à sua página de Vendas**
   ```tsx
   <AbaVincularSkuDanfe notaFiscal={nota} />
   ```

2. **Testar vinculação**
   - Selecione uma nota fiscal
   - Clique em "Vincular SKUs"
   - Escolha SKUs para cada produto
   - Clique em "Salvar"

3. **Gerar DANFE com SKUs vinculados**
   - Sistema automaticamente usa as vinculações
   - DANFE imprime com SKUs corretos

---

## 🐛 Troubleshooting

### Erro: "Nenhum SKU encontrado"
```
Causa: Não há SKUs cadastrados no sistema
Solução: 
1. Verifique se a tabela product_boms tem dados
2. Certifique-se que existem produtos cadastrados
```

### Erro: "Falha ao salvar vinculações"
```
Causa: Banco de dados indisponível ou erro de permissão
Solução:
1. Verifique conexão com Supabase
2. Certifique-se que a tabela skus_vinculados existe
3. Verifique permissões RLS
```

### Vinculação não aparece no DANFE
```
Causa: Serviço de DANFE não busca as vinculações
Solução:
1. Atualize danfeSimplificadoComEtiquetaService.ts
2. Adicione busca de vinculos no método gerarDanfeSimplificado()
3. Use skuPrincipal em vez de skuEtiqueta no output
```

---

## 📞 Resumo

| Aspecto | Detalhes |
|---------|----------|
| **Arquivo** | VincularProdutoDanfeComSKU.tsx |
| **Componente** | AbaVincularSkuDanfe.tsx |
| **Banco** | Tabela: skus_vinculados |
| **Localização** | Vendas > Notas Fiscais de Saída |
| **Botão** | 🔗 Vincular SKUs |
| **Ação** | Click → Modal → Vincule → Salve |
| **Resultado** | DANFE com SKUs do ERP |

---

**Versão:** 1.0  
**Data:** 9 de março de 2026  
**Status:** ✅ Pronto para integração
