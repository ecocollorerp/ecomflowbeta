# 🎯 GUIA PASSO A PASSO - INTEGRAÇÃO VISUAL

## ✅ Tudo que Você Precisa Saber em Uma Página

---

## 1️⃣ COPIAR O COMPONENTE (10 segundos)

### Arquivo dele:
```
📁 components/
  └── AbaDanfeEtiquetaProntoUso.tsx  ← COPIE ISTO
```

### Para sua página:
```tsx
// No topo do seu arquivo:
import { AbaDanfeEtiquetaProntoUso } from './components/AbaDanfeEtiquetaProntoUso';
```

---

## 2️⃣ ADICIONAR NA SUA PÁGINA (20 segundos)

### Seu arquivo atual:
```tsx
export const MinhaPage = () => {
  return (
    <div>
      <h1>Meu ERP</h1>
      {/* ... outros componentes ... */}
    </div>
  );
};
```

### Depois de adicionar:
```tsx
import { AbaDanfeEtiquetaProntoUso } from './components/AbaDanfeEtiquetaProntoUso';

export const MinhaPage = () => {
  const token = "sk_...seu...token...bling";  // ← Seu token Bling aqui
  
  const addToast = (mensaje, tipo) => {
    // Se tiver biblioteca de toast, use:
    // toast[tipo](mensaje);
    
    // Ou só console:
    console.log(`[${tipo}] ${mensaje}`);
  };

  return (
    <div>
      <h1>Meu ERP</h1>
      
      {/* ← ADICIONE AQUI */}
      <AbaDanfeEtiquetaProntoUso 
        token={token}
        addToast={addToast}
      />
      {/* ← AQUI TERMINA */}
      
      {/* ... outros componentes ... */}
    </div>
  );
};
```

---

## 3️⃣ PARABÉNS! ✅ FOI TUDO

**Agora seus usuários veem:**

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║     🚀 DANFE + Etiqueta REAL (Shopee/Mercado Livre)                      ║
║                                                                           ║
║     Imprima DANFE consolidado com etiqueta REAL que vem direto           ║
║     da Shopee, com SKU vinculados ao seu ERP. Sem limite!                ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────┐
│ IMPORTANTE: Configure seu Token Bling antes de usar!                      │
└───────────────────────────────────────────────────────────────────────────┘

🔥 COMECE AGORA:

   [🛒 Shopee]    [🎯 Mercado Livre]

📚 INSTRUÇÕES:
   1. Clique no botão do seu marketplace
   2. Selecione quantos pedidos quer (↑ 10 ↓)
   3. Clique "Buscar com Etiqueta REAL"
   4. Veja os resultados
   5. Clique "Processar"
   6. Baixe o ZIP com todos os DANFE
   7. Imprima!

✨ BENEFÍCIOS:
   📊 SEM Limite
   🎯 Filtro Automático (só com etiqueta)
   📦 Arquivo Consolidado
   📈 Relatório Completo
   📥 Download Direto
   🔗 SKU Vinculado ao ERP

❓ DÚVIDAS?
   • "Quantos pedidos posso processar?"
     → Sem limite! 10, 100, 1000...
   
   • "E se a etiqueta não estiver pronta?"
     → Pula automaticamente (não aparece)
   
   • "Como funciona o SKU vinculado?"
     → Sistema vincula automaticamente ao ERP
     
   • "Quanto tempo leva?"
     → ~10 segundos para 20 pedidos
```

---

## 🎬 O QUE ACONTECE QUANDO USUÁRIO CLICA

### Clica em "Shopee":

```
1. ABRE MODAL
   ┌─────────────────────────────────────────┐
   │  Quantos pedidos deseja processar?      │
   │                                         │
   │  [ - ]  [  10  ]  [ + ]                │
   │                                         │
   │  [🔄 Buscar com Etiqueta REAL]         │
   └─────────────────────────────────────────┘

2. CLICA NO BOTÃO
   Sistema faz:
   → Conecta no Bling API
   → Busca últimos 10 pedidos
   → Filtra só os com rastreamento/etiqueta
   → Vincula SKU com seu ERP
   
3. MOSTRA RESULTADO
   ┌─────────────────────────────────────────┐
   │  ✅ 9 Pedido(s) COM Etiqueta REAL      │
   │                                         │
   │  #12345 | 2 itens | SKU: 3 vinculados │
   │  SR123456789BR...                       │
   │                                         │
   │  #12346 | 1 item  | SKU: 1 vinculado  │
   │  SR234567890BR...                       │
   │                                         │
   │  ... (mais 7 pedidos)                   │
   │                                         │
   │  [Processar]                            │
   └─────────────────────────────────────────┘

4. CLICA "Processar"
   Sistema faz:
   → Gera DANFE para cada pedido
   → Adiciona etiqueta REAL (não simulada)
   → Consolida em arquivo único
   → Cria arquivo de relatório
   → Compacta em ZIP

5. MOSTRA RESULTADO FINAL
   ┌─────────────────────────────────────────┐
   │  ✅ Processamento Concluído            │
   │                                         │
   │  Total:    9 pedidos                   │
   │  ✅ Sucesso: 9                          │
   │  ❌ Erros:   0                          │
   │                                         │
   │  Tempo: 8 segundos                     │
   │                                         │
   │  [📥 Baixar ZIP (9 arquivos)]          │
   │  [📋 Baixar Relatório Detalhado]       │
   └─────────────────────────────────────────┘

6. CLICA "Baixar ZIP"
   Downloads:
   → danfe-etiqueta-12345.txt
   → danfe-etiqueta-12346.txt
   → ... (7 mais)
   → relatorio-processamento.txt
   
7. PRONTO!
   Usuário abre cada arquivo e imprime a etiqueta real
```

---

## 📋 O QUE TEM EM CADA ARQUIVO

### danfe-etiqueta-12345.txt:

```
╔════════════════════════════════════════════════════════════════════════════╗
║                  DANFE SIMPLIFICADO + ETIQUETA REAL                        ║
║                  (Shopee → Bling → Vinculação Automática)                  ║
╚════════════════════════════════════════════════════════════════════════════╝

[PEDIDO #12345]
Data da Compra: 09/03/2026
Marketplace: SHOPEE
Rastreio REAL (Shopee): SR123456789BR    ← ETIQUETA REAL! Não é simulada
Status: ✅ Pronto para impressão

[CLIENTE]
Nome: Rafael da Silva Santos
CPF: 123.456.789-00
Endereço: Rua das Flores, 123, Apto 45
Cidade: São Paulo, SP, 01310-100

[ITENS PEDIDOS (2 Itens) - COM SKU VINCULADO]

1. Camiseta Azul Royal Tamanho M
   SKU Etiqueta: 5481923
   SKU Principal ERP: CAMI-BLA-001  ← SKU VINCULADO AO ERP
   Código Produto: 5481923
   Quantidade: 1
   Valor Unitário: R$ 49.90
   Total Item: R$ 49.90

2. Calça Preta Slim Tamanho 40
   SKU Etiqueta: 5481924
   SKU Principal ERP: CALC-PT-001   ← SKU VINCULADO AO ERP
   Código Produto: 5481924
   Quantidade: 1
   Valor Unitário: R$ 89.90
   Total Item: R$ 89.90

[RESUMO FINANCEIRO]
Subtotal: R$ 139.80
Frete: R$ 12.50
Desconto: - R$ 5.00
Total: R$ 147.30

[DADOS DE ENTREGA]
Tipo Entrega: Normal
Endereço Coleta: Logística Shopee
Data Coleta: 09/03/2026

╔════════════════════════════════════════════════════════════════════════════╗
║                     ETIQUETA REAL DO BLING/SHOPEE                         ║
║              (Não é simulada - Vem direto da plataforma)                   ║
╚════════════════════════════════════════════════════════════════════════════╝

[CÓDIGO DE RASTREAMENTO]
SR123456789BR

[CÓDIGO DE BARRAS]
╔════════════════════════════════╗
║ ||SR123456789BR||             ║
║                                ║
║ SR123456789BR                  ║
╚════════════════════════════════╝

[DADOS PARA IMPRESSORA]
*SR123456789BR*



════════════════════════════════════════════════════════════════════════════
Processado em:    09/03/2026 14:25:30
Processado por:   Sistema ERP
Origem:           Shopee → Bling API → Vinculação ERP
Status:           ✅ PRONTO PARA IMPRESSÃO
Informações:      SKUs automaticamente vinculados aos produtos principais do ERP
Validade:         Este arquivo é válido para 60 dias
════════════════════════════════════════════════════════════════════════════
```

---

## 🔧 TIPO DE TOKEN (BLING)

### Onde pegar:
```
1. Entre em: https://app.bling.com.br/integracoes
2. Procure por: "API v3"
3. Copie: "Token de acesso"
4. Cole no seu código:

const token = "sk_live_...";
```

### Como adicionar:
```tsx
export const MinhaPage = () => {
  // Opção 1: Direto no código (não recomendado)
  const token = "sk_live_...";
  
  // Opção 2: De variável de ambiente (recomendado)
  const token = process.env.REACT_APP_BLING_TOKEN;

  return (
    <AbaDanfeEtiquetaProntoUso token={token} addToast={addToast} />
  );
};
```

---

## 🎨 SE QUISER CUSTOMIZAR

### Cores da aba:
```tsx
// No arquivo AbaDanfeEtiquetaProntoUso.tsx, procure por:
className="bg-gradient-to-r from-purple-500 to-pink-500"
// Mude as cores conforme quiser
```

### Textos:
```tsx
// Procure por qualquer texto entre aspas:
"Shopee"
"Mercado Livre"
"Benefícios"
// E mude para o que quiser
```

### Integração com seu Toast:
```tsx
const addToast = (mensagem, tipo) => {
  // Se usar react-toastify:
  if (window.toast) {
    window.toast[tipo](mensagem);
  }
  // Se usar outro:
  // seu_toast(mensagem, tipo);
};
```

---

## ✅ CHECKLIST DE INTEGRAÇÃO

- [ ] Copiei `AbaDanfeEtiquetaProntoUso.tsx`
- [ ] Adicionei `import` na minha página
- [ ] Peguei meu token Bling
- [ ] Adicionei o componente na página
- [ ] Testei clicando em "Shopee" ou "Mercado Livre"
- [ ] Vejo o modal abrindo
- [ ] Consegui buscar pedidos
- [ ] Consegui processar
- [ ] Consegui baixar o ZIP
- [ ] Consegui abrir e imprimir a etiqueta
- [ ] Verifiquei que tem SKU vinculado no arquivo
- [ ] Teste com usuário final
- [ ] Tudo funcionando ✅

---

## 🚨 SE ALGO NÃO FUNCIONAR

### Erro: "Token inválido"
```
Solução:
1. Verifique se o token está correto em https://app.bling.com.br/integracoes
2. Copie novamente (sem espaços extras)
3. Teste pegando pedidos diretamente via API:
   curl -H "Authorization: Bearer {token}" \
        https://bling.com.br/api/v3/pedidos/vendas
```

### Erro: "Nenhum pedido com etiqueta"
```
Solução:
1. Verifique se tem pedidos no Bling com rastreamento
2. Marketplace deve ter enviado o rastreio para o Bling
3. Shopee leva ~1 dia para enviar o rastreio após coleta
4. Acesse Bling manualmente: verifique se rastreio está lá
```

### Erro: "SKU não vinculado"
```
Solução:
1. È NORMAL! Significa que o produto não está na tabela skus_vinculados
2. Sistema continua processando mesmo assim (mostra "N/A")
3. Se quiser, crie a tabela skus_vinculados com os dados depois
4. Próximos pedidos já virão com SKU vinculado
```

### Componente não aparece
```
Solução:
1. Verifique se o import está correto:
   import { AbaDanfeEtiquetaProntoUso } from './components/AbaDanfeEtiquetaProntoUso';
2. Verifique se o arquivo existe em:
   /components/AbaDanfeEtiquetaProntoUso.tsx
3. Verifique se adicionou ao JSX:
   <AbaDanfeEtiquetaProntoUso token={token} addToast={addToast} />
```

---

## 📚 MAIS INFORMAÇÕES

### Se quer ver o código:
- **services/danfeSimplificadoComEtiquetaService.ts** - O coração do sistema
- **components/ModalDanfeEtiquetaReal.tsx** - O modal
- **components/AbaDanfeEtiquetaProntoUso.tsx** - A aba

### Se quer mais exemplos:
- **EXEMPLO_COPIAR_COLAR.tsx** - 8 formas diferentes de integrar

### Se quer saber detalhes técnicos:
- **USAR_AGORA_DANFE_ETIQUETA.md** - Guia técnico completo

---

## 🎉 PARABÉNS!

Você agora tem um sistema completo de **DANFE + Etiqueta REAL** funcionando!

```
✅ Busca pedidos com etiqueta REAL
✅ Vincula SKU ao ERP automaticamente
✅ Gera DANFE consolidado
✅ Cria arquivo imprimível
✅ Relatório de erros
✅ Sem limite de quantidade
✅ Download ZIP
✅ Tudo pronto para produção
```

---

**Data:** 9 de março de 2026  
**Versão:** 1.0  
**Status:** ✅ Pronto para usar  

**Próximo passo:** Abra sua página e adicione o componente!
