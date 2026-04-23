#!/usr/bin/env python3
"""
Smoke test Playwright para a tela "Produção Diária".

Uso:
  - Com helper (recomendado):
    python scripts/with_server.py --server "npm run dev" --port 5173 -- python scripts/production_daily_test.py --route /producao
  - Se o servidor já estiver rodando:
    python scripts/production_daily_test.py --base-url http://localhost:5173 --route /producao

O script faz: navegação + wait_for_load_state('networkidle'), captura screenshot/HTML,
procura palavras-chave relevantes (título, funcionários, moagem, ensacamento, mistura de cor,
pedidos coletados) e tenta preencher campos de observação/itens pressionando Enter.
"""

import argparse
import sys
import time
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError

KEYWORD_GROUPS = {
    "titulo": ["Produção Diária", "Produção diária", "Produção", "Produção Diário"],
    "funcionarios": ["Funcionários do dia", "Funcionários", "Escala"],
    "moagem": ["moagem", "moinho", "moedor"],
    "ensacamento": ["Ensacamento", "ensacadeira", "pacotes", "ensacar"],
    "mistura_cor": ["mistura de cor", "pigmento", "mistura"],
    "pacotes_feitos_a_parte": ["pacotes feitos", "pacotes prontos", "pacotes feitos à parte"],
    "pedidos_coletados": ["bipagens", "bipagem", "pedidos coletados", "coletados"],
    "observacao": ["Observação", "Observações", "Notas", "Nota"]
}


def save_inspection(page, outdir: Path):
    outdir.mkdir(parents=True, exist_ok=True)
    shot = outdir / "production_daily_initial.png"
    html = outdir / "production_daily_content.html"
    page.screenshot(path=str(shot), full_page=True)
    html.write_text(page.content(), encoding="utf-8")
    print(f"Saved screenshot: {shot}")
    print(f"Saved DOM: {html}")


def count_text(page, text):
    try:
        return page.locator(f"text={text}").count()
    except Exception:
        return 0


def find_keyword(page, keywords):
    # returns True if any keyword is present (by text=) or in page HTML (case-insensitive)
    content = ""
    try:
        content = page.content()
    except Exception:
        content = ""
    for k in keywords:
        try:
            if page.locator(f"text={k}").count() > 0:
                return True
        except Exception:
            pass
        if k.lower() in content.lower():
            return True
    return False


def try_fill_and_enter(page, value, want_keywords=None):
    # scan inputs/textareas and try to fill ones that match want_keywords in placeholder/name/aria-label
    inputs = page.locator("input, textarea")
    n = inputs.count()
    for i in range(n):
        loc = inputs.nth(i)
        try:
            ph = (loc.get_attribute("placeholder") or "") or ""
            nm = (loc.get_attribute("name") or "") or ""
            aria = (loc.get_attribute("aria-label") or "") or ""
            attrs = " ".join([ph, nm, aria]).lower()
            if not want_keywords or any(k.lower() in attrs for k in want_keywords):
                loc.click()
                loc.fill(value)
                try:
                    loc.press("Enter")
                except Exception:
                    # fallback: use keyboard
                    page.keyboard.press("Enter")
                time.sleep(0.5)
                # verify text appeared
                if page.locator(f"text={value}").count() > 0:
                    return True
        except Exception:
            continue
    return False

def snapshot_section(page, outdir: Path, section_name: str, keywords):
    outdir.mkdir(parents=True, exist_ok=True)
    for k in keywords:
        try:
            locs = page.locator(f"text={k}")
            count = locs.count()
            if count > 0:
                for idx in range(min(count, 3)):
                    loc = locs.nth(idx)
                    try:
                        shot = outdir / f"{section_name}_{idx+1}.png"
                        loc.screenshot(path=str(shot))
                        print(f"Saved section screenshot: {shot}")
                    except Exception:
                        fullshot = outdir / f"{section_name}_full_{idx+1}.png"
                        page.screenshot(path=str(fullshot), full_page=True)
                        print(f"Fallback saved full page shot for {section_name}: {fullshot}")
                return True
        except Exception:
            continue
    return False

def try_expand_and_click(page, keywords):
    for k in keywords:
        try:
            # prefer buttons
            btns = page.locator(f"role=button >> text={k}")
            cnt = btns.count()
            for i in range(cnt):
                try:
                    btns.nth(i).click()
                    time.sleep(0.25)
                except Exception:
                    continue
            # fallback to clickable text elements (limited)
            els = page.locator(f"text={k}")
            cnt2 = min(els.count(), 3)
            for i in range(cnt2):
                try:
                    els.nth(i).click()
                    time.sleep(0.25)
                except Exception:
                    continue
        except Exception:
            continue
    return True


def _slugify(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", text)
    return s.strip("_")[:40] or "val"


def add_items(page, items, outdir: Path, screenshot_per_action: bool = False):
    results = []
    if not items:
        return results
    # try to expand possible item sections first
    try_expand_and_click(page, ["Adicionar", "Adicionar item", "Novo item", "Itens"])
    for idx, item in enumerate(items, start=1):
        print(f"Tentando adicionar item {idx}: {item}")
        success = try_fill_and_enter(page, item, want_keywords=["Adicionar", "Item", "Nova", "Novo", "Quant", "Quantidade", "produto", "sku", "codigo"]) 
        if not success:
            # try contenteditable fallback
            try:
                eds = page.locator('[contenteditable="true"]')
                if eds.count() > 0:
                    ed = eds.nth(0)
                    try:
                        ed.click()
                        ed.evaluate("(el, v) => { el.innerText = v }", item)
                        page.keyboard.press("Enter")
                        time.sleep(0.5)
                        if page.locator(f"text={item}").count() > 0:
                            success = True
                    except Exception:
                        success = False
            except Exception:
                success = False

        if screenshot_per_action:
            shot = outdir / f"add_item_{idx}_{_slugify(item)}.png"
            try:
                page.screenshot(path=str(shot), full_page=True)
                print(f"Saved action screenshot: {shot}")
            except Exception:
                pass

        print(f"Item {idx} {'ADICIONADO' if success else 'FALHA'}")
        results.append({"item": item, "success": success})
    return results


def add_notes(page, notes, outdir: Path, screenshot_per_action: bool = False):
    results = []
    if not notes:
        return results
    try_expand_and_click(page, ["Observação", "Notas", "Comentário", "Adicionar nota"])
    for idx, note in enumerate(notes, start=1):
        print(f"Tentando adicionar nota {idx}: {note}")
        success = try_fill_and_enter(page, note, want_keywords=["Observ", "Nota", "Notas", "Observação", "Coment", "Descrição"])
        if screenshot_per_action:
            shot = outdir / f"add_note_{idx}_{_slugify(note)}.png"
            try:
                page.screenshot(path=str(shot), full_page=True)
                print(f"Saved note action screenshot: {shot}")
            except Exception:
                pass
        print(f"Nota {idx} {'ADICIONADA' if success else 'FALHA'}")
        results.append({"note": note, "success": success})
    return results


def main():
    parser = argparse.ArgumentParser(description="Smoke test Playwright para Produção Diária")
    parser.add_argument("--base-url", default="http://localhost:5173", help="Base URL do frontend")
    parser.add_argument("--route", default="/", help="Rota relativa para abrir (ex: /producao)")
    parser.add_argument("--screenshot-dir", default="tmp/production_daily_test", help="Diretório para salvar screenshots e HTML")
    parser.add_argument("--headed", action="store_true", help="Executar em modo headed (não-headless)")
    parser.add_argument("--add-item", action="append", help="Item para adicionar (pode usar várias vezes)")
    parser.add_argument("--items-file", help="Arquivo com itens, uma linha por item")
    parser.add_argument("--note", action="append", help="Observação para adicionar (pode usar várias vezes)")
    parser.add_argument("--screenshot-per-action", action="store_true", help="Salvar screenshot após cada ação de adicionar")
    args = parser.parse_args()

    outdir = Path(args.screenshot_dir)
    url = args.base_url.rstrip("/") + args.route
    print(f"Visiting {url}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page()
        try:
            page.goto(url, timeout=60000)
            page.wait_for_load_state("networkidle", timeout=60000)
        except PWTimeoutError as e:
            print("Erro: timeout ao carregar a página:", e)
            save_inspection(page, outdir)
            browser.close()
            sys.exit(2)

        save_inspection(page, outdir)

        results = {}
        for key, kws in KEYWORD_GROUPS.items():
            ok = find_keyword(page, kws)
            results[key] = ok
            print(f"{key}: {'ENCONTRADO' if ok else 'NÃO ENCONTRADO'}")

        # tentar adicionar observação manual (campo com placeholder/label observação/notas)
        # items / notes vindo da CLI
        items = []
        if args.items_file:
            try:
                items_path = Path(args.items_file)
                if items_path.exists():
                    items = [l.strip() for l in items_path.read_text(encoding='utf-8').splitlines() if l.strip()]
            except Exception as e:
                print(f"Erro lendo items-file: {e}")
        if args.add_item:
            items.extend(args.add_item)

        notes = []
        if args.note:
            notes = args.note

        if notes:
            note_results = add_notes(page, notes, outdir, screenshot_per_action=args.screenshot_per_action)
        else:
            # tentativa automática de um teste de observação se nenhum foi passado
            note_text = "Teste automático: observação de QA"
            note_results = add_notes(page, [note_text], outdir, screenshot_per_action=args.screenshot_per_action)

        if items:
            item_results = add_items(page, items, outdir, screenshot_per_action=args.screenshot_per_action)
        else:
            # tentativa automática de um item de teste se nenhum foi passado
            item_results = add_items(page, ["Item de teste Playwright - Enter"], outdir, screenshot_per_action=args.screenshot_per_action)

        print("Notas adicionadas:", note_results)
        print("Itens adicionados:", item_results)

        browser.close()

        # Heurística de sucesso: título + pelo menos uma área de produção encontrada
        production_present = results.get("moagem") or results.get("ensacamento") or results.get("pedidos_coletados")
        if results.get("titulo") and production_present:
            print("Smoke test: PASS")
            sys.exit(0)
        else:
            print("Smoke test: FAIL — componentes principais não encontrados.")
            sys.exit(2)

if __name__ == "__main__":
    main()
