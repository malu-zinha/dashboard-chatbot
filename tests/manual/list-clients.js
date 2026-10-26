import dotenv from 'dotenv';
import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';

dotenv.config();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID || '';
const SHEET_RANGE = 'A2:Z1000'; // Começar da linha 2

console.log('📋 LISTA DE CLIENTES NA PLANILHA\n');

async function listClients() {
  try {
    const sheetsService = getGoogleSheetsService();
    const data = await sheetsService.readSheetAsObjects(SPREADSHEET_ID, SHEET_RANGE);
    
    console.log('═'.repeat(80));
    console.log('TODOS OS REGISTROS:');
    console.log('═'.repeat(80));
    
    data.forEach((row, idx) => {
      console.log(`\n${idx + 1}. Cliente: "${row.Cliente || '(vazio)'}" | Área: "${row['Áreas'] || '?'}" | Status: "${row['Status do Projeto'] || '?'}"`);
    });
    
    console.log('\n' + '═'.repeat(80));
    console.log('CLIENTES ÚNICOS:');
    console.log('═'.repeat(80));
    
    const clientes = [...new Set(data.map(row => row.Cliente).filter(c => c && c.trim()))];
    clientes.forEach((cliente, idx) => {
      console.log(`${idx + 1}. ${cliente}`);
    });
    
    console.log(`\n📊 Total de registros: ${data.length}`);
    console.log(`👥 Total de clientes únicos: ${clientes.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

listClients();

