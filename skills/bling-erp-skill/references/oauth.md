# OAuth2 — Bling API v3

## Fluxo Authorization Code

### URLs
- **Authorize**: `https://bling.com.br/Api/v3/oauth/authorize`
- **Token**: `https://bling.com.br/Api/v3/oauth/token`
- **Base API**: `https://api.bling.com.br/Api/v3`

### Passo 1 — Redirecionar para Bling

```python
import secrets
import urllib.parse

def build_auth_url(client_id: str, redirect_uri: str, empresa_id: int) -> str:
    state = secrets.token_urlsafe(32)
    # Salvar state na sessão para validação no callback
    session.set(f"oauth_state_{empresa_id}", state, ttl=300)
    
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    return f"https://bling.com.br/Api/v3/oauth/authorize?{urllib.parse.urlencode(params)}"
```

### Passo 2 — Callback

```python
@app.get("/oauth/bling/callback")
async def oauth_callback(code: str, state: str, empresa_id: int):
    # Validar state (anti-CSRF)
    saved_state = session.get(f"oauth_state_{empresa_id}")
    if state != saved_state:
        raise HTTPException(400, "Invalid state")
    
    tokens = await exchange_code_for_tokens(code)
    await save_tokens(empresa_id, tokens)
    return RedirectResponse("/dashboard")
```

### Passo 3 — Troca de código por tokens

```python
import httpx
import base64

async def exchange_code_for_tokens(code: str) -> dict:
    credentials = base64.b64encode(
        f"{CLIENT_ID}:{CLIENT_SECRET}".encode()
    ).decode()
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://bling.com.br/Api/v3/oauth/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": REDIRECT_URI,
            }
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "access_token": data["access_token"],
            "refresh_token": data["refresh_token"],
            "expires_in": data["expires_in"],  # segundos, geralmente ~21600 (6h)
        }
```

### Passo 4 — Refresh de Token

```python
async def refresh_access_token(refresh_token_enc: str) -> dict:
    refresh_token = decrypt(refresh_token_enc)
    credentials = base64.b64encode(
        f"{CLIENT_ID}:{CLIENT_SECRET}".encode()
    ).decode()
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://bling.com.br/Api/v3/oauth/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            }
        )
        resp.raise_for_status()
        return resp.json()
```

### Armazenamento Seguro de Tokens

```python
from cryptography.fernet import Fernet

ENCRYPTION_KEY = Fernet(os.environ["TOKEN_ENCRYPTION_KEY"])

def encrypt(value: str) -> str:
    return ENCRYPTION_KEY.encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return ENCRYPTION_KEY.decrypt(value.encode()).decode()

async def save_tokens(empresa_id: int, tokens: dict):
    expires_at = datetime.utcnow() + timedelta(seconds=tokens["expires_in"] - 300)
    await db.execute("""
        INSERT INTO bling_oauth_tokens 
            (empresa_id, access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (empresa_id) DO UPDATE SET
            access_token  = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at    = EXCLUDED.expires_at,
            updated_at    = NOW()
    """, empresa_id, encrypt(tokens["access_token"]),
         encrypt(tokens["refresh_token"]), expires_at)
```

### Middleware de Token Automático

```python
class BlingTokenManager:
    def __init__(self, db, empresa_id: int):
        self.db = db
        self.empresa_id = empresa_id
        self._lock = asyncio.Lock()
    
    async def get_headers(self) -> dict:
        token = await self._get_or_refresh()
        return {"Authorization": f"Bearer {token}"}
    
    async def _get_or_refresh(self) -> str:
        async with self._lock:  # previne refresh concorrente
            row = await self.db.fetchrow(
                "SELECT * FROM bling_oauth_tokens WHERE empresa_id = $1",
                self.empresa_id
            )
            if not row:
                raise ValueError("Token não configurado para empresa")
            
            if row["expires_at"] < datetime.utcnow() + timedelta(minutes=5):
                new_tokens = await refresh_access_token(row["refresh_token"])
                await save_tokens(self.empresa_id, new_tokens)
                return new_tokens["access_token"]
            
            return decrypt(row["access_token"])
```

## Multi-empresa

Para SaaS com múltiplas empresas, cada empresa tem seu próprio par de tokens:

```python
# Instanciar manager por empresa_id
token_managers = {}

def get_token_manager(empresa_id: int) -> BlingTokenManager:
    if empresa_id not in token_managers:
        token_managers[empresa_id] = BlingTokenManager(db, empresa_id)
    return token_managers[empresa_id]
```

## Variáveis de Ambiente Necessárias

```env
BLING_CLIENT_ID=sua_client_id
BLING_CLIENT_SECRET=sua_client_secret  # NUNCA commitar
BLING_REDIRECT_URI=https://seuapp.com/oauth/bling/callback
BLING_WEBHOOK_SECRET=segredo_do_webhook  # NUNCA commitar
TOKEN_ENCRYPTION_KEY=chave_fernet_base64  # gerada com Fernet.generate_key()
```
