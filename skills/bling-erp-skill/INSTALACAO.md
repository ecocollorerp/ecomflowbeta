# Como Instalar a Skill `bling-erp-integration` no Claude.ai

## Resposta rápida: o que é uma "pasta de skill"?

Uma skill é uma **pasta com arquivos de texto** que o Claude lê antes de responder.
Ela **não é um plugin**, **não é código executável** no Claude — é um conjunto de
instruções e referências que ficam disponíveis durante a conversa.

Os arquivos `.md` **já contêm tudo implementado**: código Python pronto, schemas SQL,
exemplos de payload — o Claude lê esses arquivos e usa o conteúdo deles para te
ajudar com precisão, sem precisar inventar nada.

---

## Estrutura da Skill (o que você recebeu)

```
bling-erp-skill/
├── SKILL.md                        ← Arquivo principal (lido primeiro)
├── references/
│   ├── oauth.md                    ← OAuth2 completo com código Python
│   ├── webhooks.md                 ← Todos os eventos + handlers prontos
│   ├── database.md                 ← Schema SQL completo (14 tabelas + views)
│   ├── api-endpoints.md            ← Endpoints críticos com exemplos
│   └── error-handling.md           ← Rate limit, retry, alertas
└── scripts/
    └── bootstrap_sync.py           ← Script de sync inicial (executável)
```

**Os arquivos `references/*.md` contêm código 100% implementado.**
Você copia o código deles para o seu projeto. Não precisa "ligar" os MDs entre si —
eles são documentação/referência que o Claude usa para gerar código para você.

---

## Opção 1 — Usar no Claude.ai (interface web) via System Prompt

Esta é a forma mais simples se você usa o Claude.ai Pro ou Team.

### Passo 1 — Concatenar os arquivos em um único system prompt

```bash
# No terminal, dentro da pasta bling-erp-skill/
cat SKILL.md > skill_completa.txt
echo "\n\n---\n" >> skill_completa.txt
cat references/oauth.md >> skill_completa.txt
echo "\n\n---\n" >> skill_completa.txt
cat references/webhooks.md >> skill_completa.txt
echo "\n\n---\n" >> skill_completa.txt
cat references/database.md >> skill_completa.txt
echo "\n\n---\n" >> skill_completa.txt
cat references/api-endpoints.md >> skill_completa.txt
echo "\n\n---\n" >> skill_completa.txt
cat references/error-handling.md >> skill_completa.txt
```

### Passo 2 — Colar no System Prompt de um Projeto

1. Abra o **Claude.ai**
2. Vá em **Projects** → **New Project** → nomeie "Bling ERP"
3. Clique em **Project Instructions** (ou "Custom Instructions")
4. Cole o conteúdo de `skill_completa.txt`
5. Salve

Agora toda conversa dentro desse projeto terá a skill ativa.

---

## Opção 2 — Usar via API Anthropic (produção)

Se você acessa o Claude via API, passe o conteúdo da skill no `system` prompt:

```python
import anthropic
from pathlib import Path

def load_skill() -> str:
    base = Path("bling-erp-skill")
    parts = [
        (base / "SKILL.md").read_text(),
        (base / "references/oauth.md").read_text(),
        (base / "references/webhooks.md").read_text(),
        (base / "references/database.md").read_text(),
        (base / "references/api-endpoints.md").read_text(),
        (base / "references/error-handling.md").read_text(),
    ]
    return "\n\n---\n\n".join(parts)

client = anthropic.Anthropic(api_key="SUA_API_KEY")

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8096,
    system=load_skill(),
    messages=[
        {"role": "user", "content": "Comece o tutorial do zero com FastAPI e PostgreSQL"}
    ]
)
print(response.content[0].text)
```

---

## Opção 3 — Usar com Claude Code (terminal)

Se você usa o Claude Code no terminal:

```bash
# Instalar Claude Code (se não tiver)
npm install -g @anthropic-ai/claude-code

# Dentro do seu projeto, criar arquivo de skill
cp -r /caminho/bling-erp-skill .claude/skills/

# Iniciar sessão com a skill carregada
claude --skill .claude/skills/bling-erp-skill/SKILL.md
```

Ou adicionar ao `.claude/settings.json` do projeto:
```json
{
  "skills": [
    ".claude/skills/bling-erp-skill/SKILL.md"
  ]
}
```

---

## Opção 4 — Copiar conteúdo diretamente na conversa (sem instalação)

Se não quiser instalar nada, simplesmente:

1. Abra uma conversa no Claude.ai
2. Cole esta mensagem no início:

```
Você é um especialista em integração com a API v3 do Bling.
Leia as referências abaixo e use-as para me ajudar.

[cole aqui o conteúdo de SKILL.md]
```

E quando precisar de detalhe específico, diga:
> "Use as instruções do oauth.md para me mostrar como fazer o refresh de token"

---

## O que cada arquivo já tem implementado

| Arquivo | O que tem pronto para usar |
|---------|---------------------------|
| `SKILL.md` | Visão geral, fluxo completo, checklist, tutorial automático |
| `references/oauth.md` | Código Python completo: autorização, callback, refresh, criptografia de token |
| `references/webhooks.md` | Handler FastAPI com HMAC, todos os eventos, retry logic, tabelas SQL |
| `references/database.md` | DDL completo PostgreSQL: 14 tabelas, índices, 3 views úteis |
| `references/api-endpoints.md` | Chamadas para todos endpoints críticos com exemplos reais |
| `references/error-handling.md` | BlingClient com retry/backoff, alertas, polling de NF-e |
| `scripts/bootstrap_sync.py` | Script CLI completo para sync inicial, executável direto |

---

## Como usar o script de bootstrap

```bash
# Instalar dependências
pip install httpx asyncpg cryptography

# Configurar .env
cp .env.example .env
# Editar .env com suas credenciais

# Rodar sync inicial completo
python bling-erp-skill/scripts/bootstrap_sync.py --empresa-id 1

# Sync apenas pedidos de venda
python bling-erp-skill/scripts/bootstrap_sync.py --empresa-id 1 --recurso pedidos_venda

# Sync apenas do que mudou desde 2024-01-01
python bling-erp-skill/scripts/bootstrap_sync.py --empresa-id 1 --desde 2024-01-01
```

---

## Resposta para sua dúvida: "preciso deixar tudo em uma pasta?"

**Sim, deixe tudo na mesma pasta** `bling-erp-skill/` com a estrutura exata mostrada acima.

- O `SKILL.md` referencia os outros arquivos com caminhos relativos como `/references/oauth.md`
- O Claude sabe que quando você diz "use o oauth.md" deve ler esse arquivo
- Os scripts em `scripts/` são executados diretamente no seu terminal — não são lidos automaticamente, você os copia para o seu projeto conforme necessário

**Você não precisa modificar nenhum arquivo da skill** — eles são lidos como estão.
O que você modifica é o **seu projeto**, copiando os trechos de código dos `.md` para os seus arquivos `.py`, `.js`, `.php`, etc.

---

## Fluxo de uso típico

```
1. Instalar a skill (uma vez) → Opção 1, 2 ou 3 acima
2. Abrir conversa no projeto "Bling ERP"
3. Dizer: "comece o tutorial do zero com FastAPI e PostgreSQL"
4. O Claude gera o PASSO 1, PASSO 2... até o PASSO 12
5. Para cada passo: copiar o código gerado para o seu projeto
6. Se der erro: colar o erro no chat → Claude corrige o arquivo exato
7. Quando precisar de detalhe: "como fazer o refresh do token?" → Claude usa oauth.md
```
