// Mostrar exatamente o que o Node.js está lendo
require('dotenv').config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔍 O QUE O NODE.JS ESTÁ LENDO DO .env                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const sheetName = process.env.GOOGLE_SHEETS_ENGINEER_SHEET;

console.log('Variável: GOOGLE_SHEETS_ENGINEER_SHEET\n');
console.log(`Valor lido: "${sheetName}"`);
console.log(`Tamanho: ${sheetName?.length || 0} caracteres\n`);

if (sheetName) {
  console.log('Análise caractere por caractere:');
  for (let i = 0; i < sheetName.length; i++) {
    const char = sheetName[i];
    const code = char.charCodeAt(0);
    console.log(`  [${i}] '${char}' (código: ${code})`);
  }
  console.log('');
  
  // Verificar se é o esperado
  const esperado = 'Engenheira(o)';
  if (sheetName === esperado) {
    console.log('✅ CORRETO! É exatamente "Engenheira(o)"');
  } else {
    console.log(`❌ DIFERENTE do esperado!`);
    console.log(`   Esperado: "${esperado}"`);
    console.log(`   Lido:     "${sheetName}"`);
    
    // Mostrar diferenças
    if (sheetName.includes('Engenheiro(a)')) {
      console.log('\n⚠️  ENCONTRADO: "Engenheiro(a)" no valor!');
      console.log('   Parece que ainda está com o nome antigo.');
    }
  }
} else {
  console.log('❌ Variável não encontrada ou vazia!\n');
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verificar outras variáveis relacionadas
console.log('Outras variáveis de planilha:\n');
console.log(`GOOGLE_SHEETS_ENGINEER_ID: ${process.env.GOOGLE_SHEETS_ENGINEER_ID ? '✅' : '❌'}`);
console.log(`GOOGLE_SHEETS_ENGINEER_RANGE: ${process.env.GOOGLE_SHEETS_ENGINEER_RANGE || 'não encontrado'}`);
console.log(`GOOGLE_SHEETS_ENG1_NAME: ${process.env.GOOGLE_SHEETS_ENG1_NAME || '(não definido)'}`);

console.log('\n');

