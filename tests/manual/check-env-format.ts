#!/usr/bin/env ts-node
// =====================================================
// VERIFICAR FORMATO DO .env (sem mostrar valores)
// =====================================================

import fs from 'fs';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔍 VERIFICAR FORMATO DO .env                          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (!fs.existsSync('.env')) {
  console.log('❌ Arquivo .env não encontrado!\n');
  process.exit(1);
}

const content = fs.readFileSync('.env', 'utf-8');
const lines = content.split('\n');

console.log(`Total de linhas: ${lines.length}\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let hasErrors = false;
let validVars = 0;

lines.forEach((line, i) => {
  const lineNum = String(i + 1).padStart(3, ' ');
  const trimmed = line.trim();
  
  // Ignorar linhas vazias e comentários
  if (!trimmed || trimmed.startsWith('#')) {
    console.log(`${lineNum}│ (vazio ou comentário)`);
    return;
  }
  
  // Verificar formato
  let status = '✅';
  let issue = '';
  
  // Problema 1: tem "export"
  if (trimmed.startsWith('export ')) {
    status = '❌';
    issue = ' → TEM "export" (remova!)';
    hasErrors = true;
  }
  // Problema 2: não tem "="
  else if (!trimmed.includes('=')) {
    status = '❌';
    issue = ' → NÃO TEM "=" (formato errado!)';
    hasErrors = true;
  }
  // Problema 3: espaço antes do "="
  else if (trimmed.match(/\s+=/)) {
    status = '⚠️ ';
    issue = ' → TEM ESPAÇO ANTES DO "=" (remova!)';
    hasErrors = true;
  }
  // Problema 4: espaço depois do "="
  else if (trimmed.match(/=\s+/)) {
    status = '⚠️ ';
    issue = ' → TEM ESPAÇO DEPOIS DO "=" (remova!)';
    hasErrors = true;
  }
  // OK
  else {
    validVars++;
  }
  
  // Mostrar nome da variável (sem valor)
  const varName = trimmed.split('=')[0];
  const hasValue = trimmed.split('=')[1]?.trim().length > 0;
  
  console.log(`${lineNum}│ ${status} ${varName}=${hasValue ? '***' : '(vazio)'}${issue}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (hasErrors) {
  console.log('❌ PROBLEMAS ENCONTRADOS!\n');
  console.log('🔧 COMO CORRIGIR:\n');
  console.log('  1. Se tem "export", REMOVA');
  console.log('     ❌ export SUPABASE_URL=...');
  console.log('     ✅ SUPABASE_URL=...\n');
  console.log('  2. Se tem espaços ao redor do "=", REMOVA');
  console.log('     ❌ SUPABASE_URL = ...');
  console.log('     ✅ SUPABASE_URL=...\n');
  console.log('  3. Cada linha deve ser: VAR=valor');
  console.log('     • SEM export');
  console.log('     • SEM espaços ao redor do "="');
  console.log('     • Variável começa na coluna 1\n');
} else {
  console.log(`✅ Formato OK! (${validVars} variáveis válidas)\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

