#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Supabase Direct SQL Executor via HTTP
Executa SQL diretamente usando a API REST do Supabase
"""

import requests
import json
from pathlib import Path

# Supabase credentials (usando service role para ter permissão de admin)
SUPABASE_URL = "https://uafsmsiwaxopxznupuqw.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXciLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzMwNTk3NjcwLCJleHAiOjE4MzgzNjM2NzB9.mwL8dUUjvvMJGqQ5WnhS3e-XH3H7hd75w7pzhFe5eG4"

def execute_sql(sql_statement):
    """Executar um comando SQL via REST API do Supabase"""
    try:
        headers = {
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }

        # URL para executar queries custom
        url = f"{SUPABASE_URL}/rest/v1/rpc/query"

        # Supabase não tem RPC query direto, precisamos usar SQL Editor
        # Melhor abordagem: usar a função sql_exec se disponível
        
        # Alternativa: usar URL admin com SQL direto
        admin_headers = {
            'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}',
            'Content-Type': 'application/json',
        }

        # Tentar query via admin API
        response = requests.post(
            f"{SUPABASE_URL}/rest/v1/rpc",
            headers=admin_headers,
            json={"sql": sql_statement},
            timeout=30
        )

        return response.status_code, response.text

    except Exception as e:
        return None, str(e)

def main():
    print("\n[INFO] Supabase SQL Executor\n")
    
    # Ler arquivo SQL
    sql_path = Path("lib/migrations/001_create_nfe_tables.sql")
    
    if not sql_path.exists():
        print(f"[ERROR] Arquivo não encontrado: {sql_path}")
        return False

    with open(sql_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    print(f"[OK] SQL carregado ({len(sql_content)} bytes)\n")

    # Listar comandos
    commands = [
        cmd.strip() 
        for cmd in sql_content.split(';') 
        if cmd.strip() and not cmd.strip().startswith('--') and not cmd.strip().startswith('/*')
    ]

    print(f"[INFO] Total de comandos: {len(commands)}\n")

    # Tentar executar cada comando
    success = 0
    failed = 0

    for i, cmd in enumerate(commands, 1):
        if not cmd.strip():
            continue

        try:
            status, response = execute_sql(cmd)

            if status is None:
                print(f"[FAIL] [{i}] Erro de conexão: {response}")
                failed += 1
            elif 200 <= status < 300:
                print(f"[OK] [{i}] {cmd[:50]}...")
                success += 1
            elif status == 404:
                print(f"[WARN] [{i}] RPC não disponível (esperado)")
                # Pedir execução manual
                if i == 1:
                    print("\n[INFO] RPC SQL não está disponível no seu plano Supabase")
                    print("[INFO] Favor executar manualmente no SQL Editor\n")
                    show_manual_instructions(sql_content)
                    return False
            else:
                print(f"[FAIL] [{i}] Status {status}: {response[:60]}")
                failed += 1

        except Exception as e:
            print(f"[ERROR] [{i}] {str(e)[:60]}")
            failed += 1

    print(f"\n[SUMMARY] Sucesso: {success}, Falhas: {failed}\n")

    if failed > 0:
        show_manual_instructions(sql_content)
        return False

    return True

def show_manual_instructions(sql_content):
    print("="*80)
    print("[MANUAL EXECUTION REQUIRED]")
    print("="*80 + "\n")
    
    print("1. Open Supabase Dashboard:")
    print("   https://app.supabase.com\n")
    
    print("2. Select project: uafsmsiwaxopxznupuqw\n")
    
    print("3. Go to SQL Editor\n")
    
    print("4. Click 'New Query'\n")
    
    print("5. Copy and paste this SQL:\n")
    print("-"*80)
    print(sql_content)
    print("-"*80 + "\n")
    
    print("6. Click RUN button (blue button on top right)\n")
    
    print("7. Wait for execution to complete\n")

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
