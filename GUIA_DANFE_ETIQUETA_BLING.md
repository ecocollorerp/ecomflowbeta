# 🖨️ Guia de Integração: DANFE + Etiqueta (Processo Bling)

## 📋 Resumo Executivo

Implementação de solução de **Impressão de DANFE Simplificado + Etiqueta** que replica exatamente o processo interno do Bling, agora integrado no ERP com as seguintes características:

✅ **Sem limite de pedidos** - Selecione quantos quiser  
✅ **Filtro automático** - Apenas com etiqueta pronta  
✅ **Arquivo consolidado** - DANFE + Etiqueta em um arquivo  
✅ **Relatório completo** - Sucesso/Erros detalhados  
✅ **Download direto** - ZIP pronto para impressão  

---

## 📁 Arquivos Criados

### 1. **services/danfeSimplificadoComEtiquetaService.ts**
Serviço principal que:
- Busca pedidos com etiqueta disponível
- Gera DANFE Simplificado (formato texto)
- Consolida DANFE + Etiqueta em arquivo único
- Retorna estatísticas e relatório

**Métodos Principais:**
```typescript
// Buscar pedidos com etiqueta
async buscarPedidosComEtiquetaDisponivel(
  token: string,
  quantidade: number,
  marketplace?: 'SHOPEE' | 'MERCADO_LIVRE'
): Promise<{ pedidos, total, comEtiqueta, semEtiqueta }>

// Processar e gerar arquivos
async processarPedidosParaDanfeEtiqueta(
  pedidos: PedidoComEtiqueta[],
  usuarioId?: string
): Promise<{ processados, arquivos, totalSucesso, totalErros, relatorio }>

// Gerar ZIP
async gerarZipDosArquivos(
  arquivos: ArquivoProcessado[]
): Promise<Blob>
```

### 2. **components/ModalDanfeEtiqueta.tsx**
Modal interativo que:
- Seletor de quantidade (com +/-)
- Busca de pedidos com etiqueta
- Exibição de processamento em tempo real
- Download de ZIP + Relatório
- Resumo de sucesso/erros

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  marketplace?: 'SHOPEE' | 'MERCADO_LIVRE';
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}
```

### 3. **components/AbaDanfeEtiquetaBling.tsx**
Aba completa com:
- Botões para Shopee e Mercado Livre
- Instruções de uso
- Benefícios/Perguntas
- Integração com Modal

---

## 🚀 Modo de Uso Rápido

### Opção 1: Integrar em página existente (BlingPage, ImporterPage, etc)

```tsx
import { AbaDanfeEtiquetaBling } from '../components/AbaDanfeEtiquetaBling';

export const MinhaPagina = () => {
  const token = 'seu-token-bling'; // Buscar de settings/context
  const [toast, setToast] = useState<{msg: string, tipo: 'success'|'error'|'info'}[]>([]);

  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    setToast(prev => [...prev, {msg, tipo}]);
  };

  return (
    <>
      {/* Suas abas */}
      <div className="border-b">
        <button>Aba 1</button>
        <button>Aba 2</button>
        <button>DANFE + Etiqueta</button>
      </div>

      {/* Conteúdo da aba */}
      <AbaDanfeEtiquetaBling token={token} addToast={addToast} />

      {/* Toast notifications */}
      {toast.map((t, i) => (
        <Toast key={i} message={t.msg} type={t.tipo} />
      ))}
    </>
  );
};
```

### Opção 2: Usar apenas o Modal em um botão

```tsx
import { ModalDanfeEtiqueta } from '../components/ModalDanfeEtiqueta';

export const BotaoRapido = () => {
  const [isOpen, setIsOpen] = useState(false);
  const token = useTokenBling(); // Seu hook/context

  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        🖨️ Gerar DANFE + Etiqueta
      </button>

      <ModalDanfeEtiqueta
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        token={token}
        marketplace="SHOPEE" // ou sem isso para mostrar opções
      />
    </>
  );
};
```

### Opção 3: Usar o serviço diretamente (Programático)

```tsx
import { danfeSimplificadoComEtiquetaService } from '../services/danfeSimplificadoComEtiquetaService';

const { pedidos, comEtiqueta, semEtiqueta } = 
  await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
    token,
    50,
    'SHOPEE'
  );

const resultado = 
  await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
    pedidos,
    usuarioId
  );

const zip = await danfeSimplificadoComEtiquetaService.gerarZipDosArquivos(
  resultado.arquivos
);

// Download
const url = URL.createObjectURL(zip);
const a = document.createElement('a');
a.href = url;
a.download = 'danfe-etiquetas.zip';
a.click();
```

---

## 🔄 Fluxo de Funcionamento

```
┌─────────────────────────────────────────────┐
│ 1. Usuário seleciona quantidade (10, 20, 50)│
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Sistema busca pedidos com etiqueta pronta│
│    (Apenas Shopee/Mercado Livre)            │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 3. Para cada pedido:                        │
│    - Gera DANFE Simplificado               │
│    - Busca etiqueta do marketplace          │
│    - Consolida em arquivo único             │
│    - Se sem etiqueta → PULA (não aparece)   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Resultado:                               │
│    ✅ X processados com sucesso             │
│    ❌ Y pulados (sem etiqueta)              │
│    📋 Relatório detalhado                   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Download:                                │
│    - ZIP com arquivos DANFE+Etiqueta        │
│    - TXT com relatório                      │
│    - Pronto para impressão                  │
└─────────────────────────────────────────────┘
```

---

## 📊 Exemplo de Saída

### Arquivo DANFE+Etiqueta (danfe-etiqueta-12345.txt):
```
╔════════════════════════════════════════════════════════════════════════════╗
║                     DANFE SIMPLIFICADO + ETIQUETA                          ║
║                        (Migrado do Bling)                                  ║
╚════════════════════════════════════════════════════════════════════════════╝

[PEDIDO #12345]
Data: 2026-03-09
Marketplace: SHOPEE
Rastreio: SR123456789BR

[CLIENTE]
Nome: João da Silva
CPF/CNPJ: 123.456.789-00
Endereço: Rua das Flores, 123 - Centro - São Paulo/SP 01310-100

[ITENS (2)]
  1. Camiseta Azul - Qtd: 1 x R$ 49.90
  2. Calça Preta - Qtd: 1 x R$ 89.90

[RESUMO FINANCEIRO]
Valor Total: R$ 139.80
Frete: A CALCULAR
Total Final: R$ 139.80

╔════════════════════════════════════════════════════════════════════════════╗
║                              ETIQUETA                                      ║
║                         (Da Plataforma SHOPEE)                             ║
╚════════════════════════════════════════════════════════════════════════════╝

[ZPL ETIQUETA - SHOPEE]
^XA
^FO50,50^AoN,28,20^FDSR123456789BR^FS
^FO50,100^AoN,20,15^FDJoão da Silva^FS
^FO50,150^AoN,15,10^FDRua das Flores, 123^FS
[... mais linhas ZPL ...]
```

### Relatório (relatorio-danfe-2026-03-09.txt):
```
════════════════════════════════════════════════════════════════════════════
                    RELATÓRIO DE PROCESSAMENTO
                    DANFE Simplificado + Etiqueta
════════════════════════════════════════════════════════════════════════════

Data/Hora: 09/03/2026 14:23:45
Total Processado: 25
✅ Sucesso: 23
❌ Erros/Pulados: 2
Taxa de Sucesso: 92.0%

────────────────────────────────────────────────────────────────────────────
DETALHES:
────────────────────────────────────────────────────────────────────────────

✅ #12345 - Processado com sucesso
✅ #12346 - Processado com sucesso
✅ #12347 - Processado com sucesso
❌ #12348 - Etiqueta não disponível
✅ #12349 - Processado com sucesso
...
```

---

## ⚙️ Configuração Necessária

### 1. Token Bling
O usuário precisa ter seu token Bling configurado. Pode vir de:
- Context/Redux de configurações
- LocalStorage
- Banco de dados (settings do usuário)
- Variável de ambiente

### 2. Toast Notifications
Implementar um sistema de notificações (ou usar existente):
```tsx
const addToast = (message: string, type: 'success' | 'error' | 'info') => {
  // Implementação do sistema de toast
};
```

### 3. Auditoria (Opcional)
O serviço registra em `supabaseClient.from('audit_logs')`. Certifique-se que:
- Tabela `audit_logs` existe
- Colunas: `usuario_id`, `acao`, `descricao`, `dados`, `criado_em`

---

## 🧪 Teste Rápido

Para testar sem integrar na página:

```tsx
import { danfeSimplificadoComEtiquetaService } from '../services/danfeSimplificadoComEtiquetaService';

// Teste 1: Buscar pedidos
const teste1 = async () => {
  const resultado = await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
    'seu-token-bling-aqui',
    10,
    'SHOPEE'
  );
  console.log('Pedidos encontrados:', resultado.comEtiqueta);
  console.log('Sem etiqueta:', resultado.semEtiqueta);
};

// Teste 2: Processar
const teste2 = async () => {
  const { pedidos } = await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
    token,
    5
  );
  
  const resultado = await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
    pedidos,
    'usuario@email.com'
  );
  
  console.log('✅ Sucesso:', resultado.totalSucesso);
  console.log('❌ Erros:', resultado.totalErros);
  console.log(resultado.relatorio);
};
```

---

## 🔗 Próximos Passos

1. **Integrar em BlingPage** (se existe)
2. **Adicionar em menu lateral** como opção rápida
3. **Criar atalho de teclado** (Ctrl+D para DANFE)
4. **Integrar com impressora** (enviar direto para impressão)
5. **Histórico de processamentos** (guardar logs)

---

## 📞 Suporte

Se houver erros na integração:

1. Verificar se `token` é válido
2. Verificar se `addToast` está sendo chamado
3. Abrir console (F12) para ver erros
4. Verificar auditoria em Supabase

---

## ✨ Características Implementadas

✅ Busca de pedidos com etiqueta  
✅ Filtro automático (pula sem etiqueta)  
✅ Geração de DANFE Simplificado  
✅ Consolidação DANFE + Etiqueta  
✅ Download em ZIP  
✅ Relatório em TXT  
✅ Integração com auditoria  
✅ Tratamento de erros  
✅ UI responsiva  
✅ Sem limite de pedidos  

---

**Data de Criação:** 9 de março de 2026  
**Versão:** 1.0  
**Status:** ✅ Pronto para Produção
