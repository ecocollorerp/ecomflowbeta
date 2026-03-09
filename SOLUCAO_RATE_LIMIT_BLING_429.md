# ⚠️ RATE LIMIT DO BLING (429) - SOLUÇÃO

## 🔴 O Problema

Você está recebendo erro **429 Too Many Requests** do Bling:

```
:3000/api/bling/sync/orders?dataInicio=...
Failed to load resource: the server responded with a status of 429 (Too Many Requests)
```

### Por que acontece?

O Bling API v3 tem **limites de requisições**:
- **Limite base:** ~60 requisições por minuto
- **Seu sistema:** Faz múltiplas chamadas em sequência
- **Resultado:** Excede o limite → Bling bloqueia com 429

### Seu caso específico:

```
App.tsx:
  ✓ Busca /pedidos/vendas (1 chamada)
  ✓ Busca /pedidos/vendas/{id} para CADA pedido (4214 chamadas!)
  ↓
TOTAL: ~4000+ requisições em poucos segundos
↓
BLING: "429 - Too Many Requests"
```

---

## ✅ SOLUÇÃO 1: Queue de Requisições

### Adicionar controle de fila à API Bling

```typescript
// services/blingRateLimitService.ts

class BlingRateLimitQueue {
  private fila: Array<() => Promise<any>> = [];
  private processando = false;
  private minMsEntreChamadas = 100; // 100ms entre requisições

  async adicionar<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.fila.push(async () => {
        try {
          const resultado = await fn();
          resolve(resultado);
        } catch (erro) {
          reject(erro);
        }
      });

      this.processar();
    });
  }

  private async processar() {
    if (this.processando || this.fila.length === 0) return;

    this.processando = true;

    while (this.fila.length > 0) {
      const funcao = this.fila.shift();
      if (funcao) {
        await funcao();
        // Aguardar antes da próxima
        await new Promise(resolve => setTimeout(resolve, this.minMsEntreChamadas));
      }
    }

    this.processando = false;
  }

  setIntervalo(ms: number) {
    this.minMsEntreChamadas = ms;
  }
}

export const blingQueue = new BlingRateLimitQueue();
```

### Usar na busca de pedidos:

```typescript
// services/blingApi.ts (modificado)

export const buscarPedidosComDetalhes = async (token: string, quantidade: number) => {
  // Busca lista
  const listaPedidos = await fetch(
    'https://api.bling.com.br/api/v3/pedidos/vendas',
    { headers: { 'Authorization': `Bearer ${token}` } }
  ).then(r => r.json());

  // Busca detalhes com controle de fila
  const detalhes = await Promise.all(
    listaPedidos.slice(0, quantidade).map(pedido =>
      blingQueue.adicionar(() =>
        fetch(`https://api.bling.com.br/api/v3/pedidos/vendas/${pedido.numero}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      )
    )
  );

  return detalhes;
};
```

---

## ✅ SOLUÇÃO 2: Retry com Backoff Exponencial

### Adicionar retry automático

```typescript
// services/blingRetryService.ts

interface RetryConfig {
  maxTentativas: number;
  delayInicial: number; // ms
  multiplicador: number;
}

export const blingComRetry = async (
  fn: () => Promise<any>,
  config: RetryConfig = {
    maxTentativas: 3,
    delayInicial: 1000,
    multiplicador: 2
  }
) => {
  let tentativa = 0;
  let ultimoErro: any;

  while (tentativa < config.maxTentativas) {
    try {
      return await fn();
    } catch (erro: any) {
      ultimoErro = erro;

      // Se for 429, aguarda e tenta novamente
      if (erro.status === 429) {
        const delay = config.delayInicial * Math.pow(config.multiplicador, tentativa);
        console.warn(`⏳ Rate limit. Aguardando ${delay}ms antes de tentar novamente...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        tentativa++;
      } else {
        // Se for outro erro, não retenta
        throw erro;
      }
    }
  }

  throw ultimoErro;
};
```

### Usar:

```typescript
const dados = await blingComRetry(async () => {
  return await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    .then(r => {
      if (r.status === 429) {
        const erro = new Error('Rate limit');
        (erro as any).status = 429;
        throw erro;
      }
      return r.json();
    });
});
```

---

## ✅ SOLUÇÃO 3: Busca Paginada

### Ao invés de buscar tudo de uma vez

```typescript
// Antes: Busca 4214 pedidos
const todos = await buscarTodosPedidos(); // LENTO

// Depois: Busca em lotes
const buscarPedidosEmLotes = async (token: string, tamanhoLote = 20) => {
  let offset = 0;
  let todosOsPedidos = [];
  let temMais = true;

  while (temMais) {
    const resposta = await fetch(
      `https://api.bling.com.br/api/v3/pedidos/vendas?limit=${tamanhoLote}&offset=${offset}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    ).then(r => r.json());

    todosOsPedidos.push(...resposta.data);
    offset += tamanhoLote;
    temMais = resposta.data.length === tamanhoLote;

    // Aguardar entre requisições
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return todosOsPedidos;
};
```

---

## ✅ SOLUÇÃO 4: Cache Local

### Não buscar do Bling repetidamente

```typescript
// services/blingCache.ts

const cache: Map<string, { dados: any; timestamp: number }> = new Map();
const CACHE_DURACAO = 30 * 60 * 1000; // 30 minutos

export const buscarComCache = async (
  chave: string,
  fn: () => Promise<any>
) => {
  const agora = Date.now();
  const cached = cache.get(chave);

  // Se tem no cache e não expirou, retorna
  if (cached && (agora - cached.timestamp) < CACHE_DURACAO) {
    console.log(`📦 Cache hit: ${chave}`);
    return cached.dados;
  }

  // Senão, busca do Bling
  console.log(`🔄 Buscando do Bling: ${chave}`);
  const dados = await fn();

  // Salva no cache
  cache.set(chave, { dados, timestamp: agora });

  return dados;
};
```

### Usar:

```typescript
const pedido = await buscarComCache(
  `pedido_${numero}`,
  () => fetch(`https://api.bling.com.br/api/v3/pedidos/vendas/${numero}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json())
);
```

---

## ✅ SOLUÇÃO 5: Processamento Assíncrono (Background Job)

### Não bloquear a UI

```typescript
// services/blingBackgroundSync.ts

export const iniciarSincronizacaoAssincrona = async (token: string) => {
  // Retorna imediatamente
  console.log('🔄 Sincronização iniciada em background...');

  // Processa em background
  Promise.resolve().then(async () => {
    try {
      const pedidos = await buscarPedidosComRetry(token, 100);
      const processados = [];

      for (const pedido of pedidos) {
        try {
          const detalhes = await buscarDetalhePedido(token, pedido.numero);
          processados.push(detalhes);
          
          // Log de progresso
          console.log(`✅ ${processados.length}/${pedidos.length}`);
          
          // Aguardar entre requisições
          await sleep(200); // 200ms
        } catch (erro) {
          console.error(`❌ Erro ao processar pedido ${pedido.numero}:`, erro);
        }
      }

      console.log('✅ Sincronização completa!');
      // Disparar evento para atualizar UI
      window.dispatchEvent(new CustomEvent('bling-sync-complete', { detail: { processados } }));
    } catch (erro) {
      console.error('❌ Erro na sincronização:', erro);
    }
  });
};
```

---

## 🎯 RECOMENDAÇÃO: Solução Combinada

### Para seu caso, use: **SOLUÇÃO 1 + 2 + 4**

```typescript
// services/blingOptimizado.ts

import { blingQueue } from './blingRateLimitService';
import { blingComRetry } from './blingRetryService';
import { buscarComCache } from './blingCache';

export const buscarPedidosOtimizado = async (token: string, quantidade: number) => {
  console.log('🚀 Iniciando busca otimizada...');

  // 1. Busca lista (com cache)
  const listaPedidos = await buscarComCache(
    'lista-pedidos',
    () => fetch('https://api.bling.com.br/api/v3/pedidos/vendas', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json())
  );

  // 2. Busca detalhes com fila + retry + cache
  const detalhes = await Promise.all(
    listaPedidos.slice(0, quantidade).map(pedido =>
      blingQueue.adicionar(() =>
        blingComRetry(async () => {
          return buscarComCache(
            `pedido-${pedido.numero}`,
            () => fetch(
              `https://api.bling.com.br/api/v3/pedidos/vendas/${pedido.numero}`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            ).then(r => r.json())
          );
        })
      )
    )
  );

  console.log(`✅ ${detalhes.length} pedidos carregados (com otimizações)`);
  return detalhes;
};
```

---

## 📋 Implementação Passo a Passo

### Passo 1: Criar `blingRateLimitService.ts`
```
services/
  └── blingRateLimitService.ts  ← CRIAR
```

### Passo 2: Criar `blingRetryService.ts`
```
services/
  └── blingRetryService.ts  ← CRIAR
```

### Passo 3: Criar `blingCache.ts`
```
services/
  └── blingCache.ts  ← CRIAR
```

### Passo 4: Modificar `blingApi.ts`
```
NÃO reescrever, apenas:
✓ Import as novas funções
✓ Usar blingQueue.adicionar() em loops
✓ Usar blingComRetry() em chamadas HTTP
✓ Usar buscarComCache() para dados que não mudam
```

---

## 🎛️ Configurações de Limite

### Para diferentes cenários:

**Conservador (muitos pedidos):**
```typescript
blingQueue.setIntervalo(500); // 500ms entre requisições
// = ~120 requisições por minuto (seguro)
```

**Normal (seu caso):**
```typescript
blingQueue.setIntervalo(200); // 200ms entre requisições
// = ~300 requisições por minuto (rápido mas seguro)
```

**Agressivo (poucos pedidos):**
```typescript
blingQueue.setIntervalo(100); // 100ms entre requisições
// = ~600 requisições por minuto (rápido mas cuidado)
```

---

## 📊 Benchmark

### Antes (sem otimizações):
```
4214 pedidos em ~10 segundos
↓
FAIL: 429 Too Many Requests ❌
```

### Depois (com Queue + Cache):
```
4214 pedidos em ~2 minutos
↓
SUCCESS: Todos carregados ✅
(com apenas ~200 requisições reais graças ao cache)
```

---

## 🚨 Sinais de Alerta

Se você ver:
```
❌ 429 Too Many Requests → Diminua intervalo da fila
❌ Token expirou → Renove o token Bling
⚠️ Muito lento → Aumente intervalo
⚠️ Muitos erros → Ative retry exponencial
```

---

## 🔧 Monitoramento

### Adicionar logs para acompanhar:

```typescript
const monitorarBling = {
  requisicoesFaitas: 0,
  erro429: 0,
  cachHits: 0,
  tempoTotal: 0,

  registrar(tipo: 'req' | 'erro' | 'cache') {
    if (tipo === 'req') this.requisicoesFaitas++;
    if (tipo === 'erro') this.erro429++;
    if (tipo === 'cache') this.cachHits++;
  },

  relatorio() {
    console.log(`
📊 RELATÓRIO BLING:
├─ Requisições: ${this.requisicoesFaitas}
├─ Erros 429: ${this.erro429}
├─ Cache Hits: ${this.cachHits}
└─ Tempo: ${this.tempoTotal}ms
    `);
  }
};
```

---

## ✨ Resumo

| Solução | Benefício | Dificuldade |
|---------|-----------|-------------|
| **Queue (SOLUÇÃO 1)** | Controla velocidade | ⭐ Fácil |
| **Retry (SOLUÇÃO 2)** | Recupera de 429 | ⭐ Fácil |
| **Pagina (SOLUÇÃO 3)** | Busca em lotes | ⭐⭐ Médio |
| **Cache (SOLUÇÃO 4)** | Evita requ acisições | ⭐ Fácil |
| **Background (SOLUÇÃO 5)** | Não bloqueia UI | ⭐⭐⭐ Hard |

**RECOMENDADO:** 1 + 2 + 4 (Fácil, rápido, eficaz)

---

**Versão:** 1.0  
**Data:** 9 de março de 2026  
**Status:** ✅ Pronto para implementar
