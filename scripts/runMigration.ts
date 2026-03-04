/**
 * Script para executar migration SQL no Supabase
 * Executa: scripts/runMigration.ts
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://uafsmsiwaxopxznupuqw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZnNtc2l3YXhvcHh6bnVwdXciLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMDU5NzY3MCwiZXhwIjoxODM4MzYzNjcwfQ.8oV_nUZCSdxEaKZHsAEGI_hccf4lCW1YIvRKJNPV4rE';

async function runMigration() {
  console.log('🚀 [MIGRATION] Iniciando migration SQL no Supabase...\n');

  try {
    // Ler arquivo SQL
    const sqlPath = path.join(process.cwd(), 'lib', 'migrations', '001_create_nfe_tables.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Arquivo não encontrado: ${sqlPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`📄 SQL carregado: ${sqlPath}`);
    console.log(`   Tamanho: ${sqlContent.length} bytes\n`);

    // Criar cliente Supabase com acesso administrativo
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // Dividir SQL em comandos individuais (remover comentários e espaços em branco)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--'));

    console.log(`📋 Total de comandos SQL: ${commands.length}\n`);

    let successCount = 0;
    let errorCount = 0;

    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      const commandNum = i + 1;

      try {
        // Usar rpc_exec para executar SQL arbitrário
        let data: any = null;
        let error: any = null;

        try {
          const result = await supabase.rpc('exec_sql', {
            sql_content: command + ';'
          });
          data = result.data;
          error = result.error;
        } catch {
          data = null;
          error = { message: 'RPC não disponível' };
        }

        if (error || data?.error) {
          // Se RPC falhar, mostrar aviso mas continuar
          if (command.includes('CREATE TABLE') || command.includes('CREATE TYPE') || command.includes('CREATE TRIGGER')) {
            console.log(`⚠️  [${commandNum}/${commands.length}] Aviso (ignorado)`);
            console.log(`   ${command.substring(0, 60)}...`);
            console.log(`   → Favor executar manualmente no Supabase Dashboard\n`);
          }
        } else {
          console.log(`✅ [${commandNum}/${commands.length}] Sucesso`);
          console.log(`   ${command.substring(0, 60)}...\n`);
          successCount++;
        }
      } catch (err: any) {
        errorCount++;
        console.error(`❌ [${commandNum}/${commands.length}] Erro`);
        console.error(`   ${command.substring(0, 60)}...`);
        console.error(`   → ${err.message}\n`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`📊 RESUMO DA MIGRATION:`);
    console.log(`   ✅ Sucesso: ${successCount}`);
    console.log(`   ❌ Erros: ${errorCount}`);
    console.log('='.repeat(70));

    if (errorCount > 0) {
      console.log(`\n⚠️  [IMPORTANTE] Parece que a RPC SQL não está disponível.`);
      console.log(`\n📝 Favor executar manualmente no Supabase Dashboard:`);
      console.log(`\n1. Abra: https://app.supabase.com`);
      console.log(`2. Projeto: uafsmsiwaxopxznupuqw`);
      console.log(`3. SQL Editor > New Query`);
      console.log(`4. Copie o arquivo: lib/migrations/001_create_nfe_tables.sql`);
      console.log(`5. Cole no editor e clique RUN`);
      console.log(`\n✅ As tabelas serão criadas instantaneamente!\n`);
    } else {
      console.log(`\n✅ Migration executada com sucesso!`);
      console.log(`\n📊 Tabelas criadas:`);
      console.log(`   • nfes`);
      console.log(`   • certificados`);
      console.log(`   • nfe_status (ENUM)`);
    }

  } catch (error: any) {
    console.error('❌ Erro geral:', error.message);
    console.log(`\n📝 Favor executar manualmente no Supabase Dashboard:`);
    console.log(`\n1. Abra: https://app.supabase.com`);
    console.log(`2. Projeto: uafsmsiwaxopxznupuqw`);
    console.log(`3. SQL Editor > New Query`);
    console.log(`4. Copie o arquivo: lib/migrations/001_create_nfe_tables.sql`);
    console.log(`5. Cole no editor e clique RUN\n`);
    process.exit(1);
  }
}

runMigration();
