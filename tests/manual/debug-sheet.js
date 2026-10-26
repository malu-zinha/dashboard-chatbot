import dotenv from 'dotenv';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const SHEET_RANGE = process.env.GOOGLE_SHEETS_RANGE || 'A1:Z1000';

console.log('🔍 DEBUG - Estrutura da Planilha\n');
console.log(`📊 SPREADSHEET_ID: ${SPREADSHEET_ID}`);
console.log(`📋 RANGE: ${SHEET_RANGE}\n`);

async function debug() {
  try {
    const sheetsService = getGoogleSheetsService();
    const { headers, rows } = await sheetsService.readSheet(SPREADSHEET_ID, SHEET_RANGE);
    
    console.log('═'.repeat(80));
    console.log('CABEÇALHOS (Headers):');
    console.log('═'.repeat(80));
    headers.forEach((header, idx) => {
      console.log(`Coluna ${idx}: "${header}" ${header === '' ? '← VAZIA!' : ''}`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('PRIMEIRAS 10 LINHAS (Raw Data):');
    console.log('═'.repeat(80));
    rows.slice(0, 10).forEach((row, idx) => {
      console.log(`\nLinha ${idx + 1}:`);
      row.forEach((cell, cellIdx) => {
        console.log(`  [${cellIdx}] = "${cell}"`);
      });
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('RESUMO:');
    console.log('═'.repeat(80));
    console.log(`Total de colunas: ${headers.length}`);
    console.log(`Total de linhas: ${rows.length}`);
    console.log(`Colunas vazias: ${headers.filter(h => !h || h.trim() === '').length}`);
    
    console.log('\n💡 SUGESTÃO:');
    console.log('Se a primeira linha NÃO é o cabeçalho, ajuste o SHEET_RANGE no .env');
    console.log('Exemplo: Se os dados começam na linha 2, use: A2:Z1000');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

debug();

