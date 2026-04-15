#!/usr/bin/env python3
"""
bootstrap_sync.py — Sincronização inicial completa do Bling para o ERP

Uso:
    python bootstrap_sync.py --empresa-id 1
    python bootstrap_sync.py --empresa-id 1 --recurso pedidos_venda
    python bootstrap_sync.py --empresa-id 1 --desde 2024-01-01
"""

import asyncio
import argparse
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger("bootstrap")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Ordem de sincronização (respeita dependências de FK)
SYNC_ORDER = [
    ("contatos",           "/contatos",              {}),
    ("categorias_produto", "/categorias/produtos",   {}),
    ("produtos",           "/produtos",              {"tipo": "T", "criterio": 5}),
    ("depositos",          "/depositos",             {}),
    ("formas_pagamento",   "/formas-pagamentos",     {}),
    ("pedidos_venda",      "/pedidos/vendas",        {}),
    ("notas_fiscais",      "/nfe",                   {"tipo": "1"}),  # saída
    ("contas_receber",     "/contas/receber",        {}),
    ("contas_pagar",       "/contas/pagar",          {}),
]

async def sync_recurso(
    cliente,
    db,
    empresa_id: int,
    recurso: str,
    endpoint: str,
    extra_params: dict,
    desde: Optional[datetime] = None,
    processador=None
):
    """Sincroniza um recurso completamente, página por página"""
    logger.info(f"Iniciando sync: {recurso}")
    
    params = {"pagina": 1, "limite": 100, **extra_params}
    if desde:
        if recurso in ("pedidos_venda", "contatos", "produtos"):
            params["dataAlteracaoInicial"] = desde.strftime("%Y-%m-%d %H:%M:%S")
        elif recurso in ("notas_fiscais",):
            params["dataEmissaoInicial"] = desde.strftime("%Y-%m-%d %H:%M:%S")
    
    total = 0
    pagina = 1
    
    while True:
        params["pagina"] = pagina
        
        try:
            resp = await cliente.get(endpoint, params=params)
            items = resp.get("data", [])
        except Exception as e:
            logger.error(f"Erro ao buscar {recurso} página {pagina}: {e}")
            break
        
        if not items:
            break
        
        for item in items:
            try:
                if processador:
                    await processador(item, empresa_id, db)
                else:
                    await upsert_generico(recurso, item, empresa_id, db)
                total += 1
            except Exception as e:
                logger.error(f"Erro ao processar {recurso} id={item.get('id')}: {e}")
        
        logger.info(f"  {recurso}: página {pagina}, total={total}")
        
        if len(items) < 100:
            break
        
        pagina += 1
        await asyncio.sleep(0.2)  # throttle gentil (300 req/min)
    
    # Atualizar status de sync
    await db.execute("""
        INSERT INTO sync_status (empresa_id, recurso, last_sync_at, total_synced, status)
        VALUES ($1, $2, NOW(), $3, 'idle')
        ON CONFLICT (empresa_id, recurso) DO UPDATE SET
            last_sync_at = NOW(),
            total_synced = EXCLUDED.total_synced,
            status = 'idle'
    """, empresa_id, recurso, total)
    
    logger.info(f"Concluído {recurso}: {total} registros")
    return total


async def upsert_generico(recurso: str, data: dict, empresa_id: int, db):
    """Upsert genérico salvando payload raw e mapeando bling_id"""
    bling_id = data.get("id")
    if not bling_id:
        return
    
    # Salvar no mapeamento de IDs
    await db.execute("""
        INSERT INTO bling_id_map (recurso, bling_id, interno_id, empresa_id, sincronizado_em)
        VALUES ($1, $2, $2, $3, NOW())
        ON CONFLICT (recurso, bling_id, empresa_id) DO UPDATE SET
            sincronizado_em = NOW()
    """, recurso, bling_id, empresa_id)
    
    # Salvar dados específicos por recurso
    processors = {
        "pedidos_venda":    upsert_pedido_venda,
        "notas_fiscais":    upsert_nota_fiscal,
        "contas_receber":   upsert_conta_receber,
        "contatos":         upsert_contato,
        "produtos":         upsert_produto,
    }
    
    processor = processors.get(recurso)
    if processor:
        await processor(data, empresa_id, db)


async def upsert_pedido_venda(data: dict, empresa_id: int, db):
    import json
    situacao = data.get("situacao", {})
    contato = data.get("contato", {})
    await db.execute("""
        INSERT INTO pedidos_venda (
            bling_id, numero, numero_loja,
            situacao_id, situacao_valor, situacao_nome,
            data_pedido, data_saida, data_prevista,
            total_produtos, total,
            contato_bling_id, loja_bling_id,
            payload_raw, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
        ON CONFLICT (bling_id) DO UPDATE SET
            situacao_id    = EXCLUDED.situacao_id,
            situacao_valor = EXCLUDED.situacao_valor,
            situacao_nome  = EXCLUDED.situacao_nome,
            total          = EXCLUDED.total,
            payload_raw    = EXCLUDED.payload_raw,
            updated_at     = NOW()
    """,
        data.get("id"),
        data.get("numero"),
        data.get("numeroLoja"),
        situacao.get("id"),
        situacao.get("valor"),
        str(situacao.get("valor", "")),
        data.get("data"),
        data.get("dataSaida"),
        data.get("dataPrevista"),
        data.get("totalProdutos"),
        data.get("total"),
        contato.get("id"),
        data.get("loja", {}).get("id"),
        json.dumps(data)
    )


async def upsert_nota_fiscal(data: dict, empresa_id: int, db):
    import json
    await db.execute("""
        INSERT INTO notas_fiscais (
            bling_id, numero, serie, chave_acesso, tipo, situacao,
            valor_total, data_emissao, contato_nome, payload_raw
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (bling_id) DO UPDATE SET
            situacao    = EXCLUDED.situacao,
            chave_acesso = EXCLUDED.chave_acesso,
            payload_raw = EXCLUDED.payload_raw,
            updated_at  = NOW()
    """,
        data.get("id"),
        data.get("numero"),
        str(data.get("serie", "")),
        data.get("chaveAcesso"),
        data.get("tipo"),
        data.get("situacao"),
        data.get("valorNota"),
        data.get("dataEmissao"),
        data.get("contato", {}).get("nome"),
        json.dumps(data)
    )


async def upsert_conta_receber(data: dict, empresa_id: int, db):
    import json
    contato = data.get("contato", {})
    await db.execute("""
        INSERT INTO contas_receber (
            bling_id, situacao, vencimento, valor, saldo,
            numero_documento, historico, contato_bling_id,
            id_transacao, payload_raw
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (bling_id) DO UPDATE SET
            situacao    = EXCLUDED.situacao,
            saldo       = EXCLUDED.saldo,
            payload_raw = EXCLUDED.payload_raw,
            updated_at  = NOW()
    """,
        data.get("id"),
        data.get("situacao"),
        data.get("vencimento"),
        data.get("valor"),
        data.get("saldo"),
        data.get("numeroDocumento"),
        data.get("historico"),
        contato.get("id"),
        data.get("idTransacao"),
        json.dumps(data)
    )


async def upsert_contato(data: dict, empresa_id: int, db):
    import json
    await db.execute("""
        INSERT INTO contatos (
            bling_id, nome, fantasia, codigo, tipo_pessoa,
            numero_documento, situacao, email, telefone, payload_raw
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (bling_id) DO UPDATE SET
            nome            = EXCLUDED.nome,
            situacao        = EXCLUDED.situacao,
            numero_documento = EXCLUDED.numero_documento,
            payload_raw     = EXCLUDED.payload_raw,
            updated_at      = NOW()
    """,
        data.get("id"),
        data.get("nome"),
        data.get("fantasia"),
        data.get("codigo"),
        data.get("tipo"),
        data.get("numeroDocumento"),
        data.get("situacao"),
        data.get("email"),
        data.get("telefone"),
        json.dumps(data)
    )


async def upsert_produto(data: dict, empresa_id: int, db):
    import json
    await db.execute("""
        INSERT INTO produtos (
            bling_id, nome, codigo, tipo, situacao, formato,
            preco, unidade, gtin, payload_raw
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (bling_id) DO UPDATE SET
            nome        = EXCLUDED.nome,
            preco       = EXCLUDED.preco,
            situacao    = EXCLUDED.situacao,
            payload_raw = EXCLUDED.payload_raw,
            updated_at  = NOW()
    """,
        data.get("id"),
        data.get("nome"),
        data.get("codigo"),
        data.get("tipo"),
        data.get("situacao"),
        data.get("formato"),
        data.get("preco"),
        data.get("unidade"),
        data.get("gtin"),
        json.dumps(data)
    )


async def run_bootstrap(empresa_id: int, recurso: Optional[str] = None, desde: Optional[datetime] = None):
    """Ponto de entrada principal"""
    # Importar dependências do projeto
    from app.database import get_db
    from app.bling.client import BlingClient
    from app.bling.auth import get_token_manager
    
    db = await get_db()
    token_manager = get_token_manager(empresa_id)
    cliente = BlingClient(token_manager)
    
    recursos_para_sync = SYNC_ORDER
    if recurso:
        recursos_para_sync = [(r, e, p) for r, e, p in SYNC_ORDER if r == recurso]
    
    for nome, endpoint, params in recursos_para_sync:
        await sync_recurso(
            cliente, db, empresa_id,
            nome, endpoint, params, desde
        )
    
    logger.info("Bootstrap concluído!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--empresa-id", type=int, required=True)
    parser.add_argument("--recurso", type=str, help="Sincronizar apenas este recurso")
    parser.add_argument("--desde", type=str, help="Data inicial YYYY-MM-DD")
    args = parser.parse_args()
    
    desde = datetime.strptime(args.desde, "%Y-%m-%d") if args.desde else None
    
    asyncio.run(run_bootstrap(args.empresa_id, args.recurso, desde))
