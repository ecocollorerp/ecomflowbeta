#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Migration Executor para Supabase PostgreSQL
Executa SQL diretamente via Supabase RPC
"""

import sys
import os
import json
import requests
from pathlib import Path

# Supabase credentials
SUPABASE_URL = "https://uafsmsiwaxopxznupuqw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMDU5NzY3MCwiZXhwIjoxODM4MzYzNjcwfQ.8oV_nUZCSdxEaKZHsAEGI_hccf4lCW1YIvRKJNPV4rE"

def run_migration():
    print("\n" + "="*80)
    print("[MIGRATION] SUPABASE - NFE E CERTIFICADOS")
    print("="*80 + "\n")
    
    try:
        # Ler arquivo SQL
        sql_path = Path(__file__).parent.parent / "lib" / "migrations" / "001_create_nfe_tables.sql"
        
        if not sql_path.exists():
            print(f"[ERROR] Arquivo nao encontrado: {sql_path}")
            sys.exit(1)
        
        with open(sql_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        print(f"[OK] SQL carregado: {sql_path}")
        print(f"     Tamanho: {len(sql_content)} bytes\n")
        
        # Preparar headers
        headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'tx=rollback'  # Rollback em caso de erro
        }
        
        print("[INFO] Conectando ao Supabase...\n")
        
        # Dividir em comandos
        commands = [cmd.strip() for cmd in sql_content.split(';') if cmd.strip() and not cmd.strip().startswith('--')]
        
        print(f"[INFO] Total de comandos SQL: {len(commands)}\n")
        
        success_count = 0
        error_count = 0
        
        # Tentar usar RPC para executar
        rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/exec_sql"
        
        for i, cmd in enumerate(commands, 1):
            try:
                # Verificar se RPC existe tentando um comando simples
                if i == 1:
                    test_response = requests.post(
                        rpc_url,
                        headers=headers,
                        json={'sql_content': 'SELECT 1;'},
                        timeout=5
                    )
                    
                    if test_response.status_code == 404:
                        print("[WARN] RPC 'exec_sql' nao disponivel no Supabase")
                        print("       Favor executar manualmente no SQL Editor\n")
                        show_manual_instructions(sql_content)
                        return
                
                # Executar comando
                response = requests.post(
                    rpc_url,
                    headers=headers,
                    json={'sql_content': cmd + ';'},
                    timeout=10
                )
                
                if 200 <= response.status_code < 300:
                    print(f"[OK] [{i}/{len(commands)}] Sucesso")
                    print(f"     {cmd[:60]}...\n")
                    success_count += 1
                else:
                    error_count += 1
                    print(f"[WARN] [{i}/{len(commands)}] Status {response.status_code}")
                    print(f"       {response.text[:80]}...\n")
                    
            except requests.exceptions.Timeout:
                error_count += 1
                print(f"[TIMEOUT] [{i}/{len(commands)}] Timeout")
                print(f"          {cmd[:60]}...\n")
            except Exception as err:
                error_count += 1
                print(f"[ERROR] [{i}/{len(commands)}] Erro: {str(err)[:60]}")
                print(f"        {cmd[:60]}...\n")
        
        print("="*80)
        print(f"[SUMMARY] RESUMO DA MIGRATION:")
        print(f"          Sucesso: {success_count}")
        print(f"          Erros: {error_count}")
        print("="*80 + "\n")
        
        if error_count > 0:
            show_manual_instructions(sql_content)
        else:
            print("[OK] Migration executada com sucesso!")
            print("\n[OK] Tabelas criadas:")
            print("     - nfes")
            print("     - certificados")
            print("     - nfe_status (ENUM)\n")
            
    except Exception as err:
        print(f"[ERROR] Erro: {err}\n")
        show_manual_instructions(sql_content if 'sql_content' in locals() else "")
        sys.exit(1)

def show_manual_instructions(sql_content):
    print("[INFO] INSTRUCOES PARA EXECUTAR MANUALMENTE:\n")
    print("1. Abra: https://app.supabase.com")
    print("2. Projeto: uafsmsiwaxopxznupuqw")
    print("3. SQL Editor > New Query")
    print("4. Cole este SQL:\n")
    print("-"*80)
    print(sql_content)
    print("-"*80 + "\n")
    print("5. Clique em RUN\n")

if __name__ == '__main__':
    run_migration()
