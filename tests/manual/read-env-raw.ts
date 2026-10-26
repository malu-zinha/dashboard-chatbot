#!/usr/bin/env ts-node
// =====================================================
// LER .env SEM PROCESSAR
// =====================================================

import fs from 'fs';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          📄 CONTEÚDO DO .env (PRIMEIRAS 20 LINHAS)       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (!fs.existsSync('.env')) {
  console.log('❌ Arquivo .env não encontrado!\n');
  process.exit(1);
}

const content = fs.readFileSync('.env', 'utf-8');
const lines = content.split('\n');

console.log(`Total de linhas: ${lines.length}\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

lines.slice(0, 20).forEach((line, i) => {
  const lineNum = String(i + 1).padStart(3, ' ');
  const displayLine = line.replace(/=/g, ' = '); // espaçar para visualizar melhor
  
  // Marcar linhas com problemas
  if (line.trim().startsWith('export ')) {
    console.log(`${lineNum}│ ⚠️  ${displayLine}`);
  } else if (line.trim() && !line.trim().startsWith('#') && !line.includes('=')) {
    console.log(`${lineNum}│ ❓ ${displayLine}`);
  } else {
    console.log(`${lineNum}│ ${displayLine}`);
  }
});

if (lines.length > 20) {
  console.log(`\n... mais ${lines.length - 20} linhas ...\n`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('💡 PROBLEMAS COMUNS:\n');
console.log('  ❌ Usar "export VAR=value" → Remova "export"');
console.log('  ❌ Espaços antes da variável → Variável deve começar na coluna 1');
console.log('  ❌ Aspas duplas desnecessárias → Use aspas só se houver espaços no valor');
console.log('  ❌ Quebras de linha no meio do valor → Valor deve estar em uma linha\n');
console.log('  ✅ Formato correto: VAR_NAME=valor\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

