#!/usr/bin/env node

/**
 * Migration Script via Supabase SQL Editor
 * Lê a migration SQL e exibe instruções para executar no Supabase Dashboard
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runMigration() {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SUPABASE MIGRATION - NFE E CERTIFICADOS');
  console.log('='.repeat(80) + '\n');

  try {
    // Ler arquivo SQL
    const sqlPath = path.join(process.cwd(), 'lib', 'migrations', '001_create_nfe_tables.sql');
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Arquivo não encontrado: ${sqlPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    console.log(`✅ SQL carregado: ${sqlPath}`);
    console.log(`   Tamanho: ${sqlContent.length} bytes\n`);

    // Copiar para clipboard é difícil em Node.js cross-platform
    // Melhor abrir no editor ou mostrar as instruções

    console.log('📝 INSTRUÇÕES PARA EXECUTAR NO SUPABASE DASHBOARD:\n');
    console.log('1️⃣  Abra o Supabase Dashboard:');
    console.log('   → https://app.supabase.com\n');

    console.log('2️⃣  Selecione seu projeto:');
    console.log('   → uafsmsiwaxopxznupuqw\n');

    console.log('3️⃣  Vá para SQL Editor:');
    console.log('   → Menu lateral > SQL Editor\n');

    console.log('4️⃣  Clique em "New Query"\n');

    console.log('5️⃣  Copie o SQL abaixo:\n');
    console.log('─'.repeat(80));
    console.log(sqlContent);
    console.log('─'.repeat(80) + '\n');

    console.log('6️⃣  Cole no editor SQL\n');

    console.log('7️⃣  Clique em "RUN" (botão azul superior direito)\n');

    console.log('='.repeat(80));
    console.log('✅ RESULTADO ESPERADO:\n');
    console.log('   ✓ CREATE TYPE nfe_status');
    console.log('   ✓ CREATE TABLE nfes');
    console.log('   ✓ CREATE INDEX idx_nfes_status');
    console.log('   ✓ CREATE INDEX idx_nfes_pedidoId');
    console.log('   ✓ CREATE INDEX idx_nfes_chaveAcesso');
    console.log('   ✓ CREATE INDEX idx_nfes_criadoEm');
    console.log('   ✓ CREATE TABLE certificados');
    console.log('   ✓ CREATE INDEX idx_certificados_cnpj');
    console.log('   ✓ CREATE INDEX idx_certificados_thumbprint');
    console.log('   ✓ CREATE INDEX idx_certificados_valido');
    console.log('   ✓ CREATE INDEX idx_certificados_dataValidade');
    console.log('   ✓ ALTER TABLE (RLS enabled)');
    console.log('   ✓ CREATE POLICY (múltiplas vezes)');
    console.log('   ✓ CREATE OR REPLACE FUNCTION');
    console.log('   ✓ CREATE TRIGGER (2 vezes)\n');

    console.log('='.repeat(80));
    console.log('🎉 APÓS EXECUTAR:\n');
    console.log('   1. Verifique em "Table Editor" no Supabase');
    console.log('   2. Você deverá ver:');
    console.log('      • 📋 nfes (tabela)');
    console.log('      • 📜 certificados (tabela)');
    console.log('      • 📊 nfe_status (tipo ENUM)\n');

    console.log('   3. Volte para o VS Code e rode:');
    console.log('      → npm run dev\n');

    console.log('='.repeat(80) + '\n');

    // Salvar SQL em arquivo temp para fácil acesso
    const tempSqlPath = path.join(process.cwd(), 'MIGRATION.sql');
    fs.writeFileSync(tempSqlPath, sqlContent);
    console.log(`💾 SQL também salvo em: ${tempSqlPath}\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

runMigration();
