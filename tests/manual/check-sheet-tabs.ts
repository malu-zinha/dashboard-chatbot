#!/usr/bin/env ts-node
// =====================================================
// DIAGNÓSTICO: Verificar abas da planilha
// =====================================================

import { getGoogleSheetsService } from '../../integrations/sheets/googleSheetsService.ts';
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║     🔍 VERIFICAR ABAS DA PLANILHA                         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const sheetId = process.env.GOOGLE_SHEETS_ENGINEER_ID || process.env.GOOGLE_SHEETS_ENG1_ID;

if (!sheetId) {
  console.log('❌ Nenhuma planilha configurada no .env');
  console.log('\nAdicione uma destas variáveis:');
  console.log('  GOOGLE_SHEETS_ENGINEER_ID=...');
  console.log('  ou');
  console.log('  GOOGLE_SHEETS_ENG1_ID=...\n');
  process.exit(1);
}

console.log(`📊 Planilha ID: ${sheetId.substring(0, 15)}...\n`);

async function checkTabs() {
  try {
    // Inicializar Google Sheets API
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Buscar metadados da planilha
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const tabs = response.data.sheets || [];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Planilha encontrada: ${response.data.properties?.title}\n`);
    console.log(`📑 Total de abas: ${tabs.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('ABAS DISPONÍVEIS:\n');
    
    tabs.forEach((sheet, index) => {
      const title = sheet.properties?.title || '';
      const sheetId = sheet.properties?.sheetId || 0;
      const gridProps = sheet.properties?.gridProperties;
      const rows = gridProps?.rowCount || 0;
      const cols = gridProps?.columnCount || 0;
      
      console.log(`${index + 1}. "${title}"`);
      console.log(`   ID: ${sheetId}`);
      console.log(`   Tamanho: ${rows} linhas x ${cols} colunas\n`);
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 CONFIGURAÇÃO RECOMENDADA NO .env:\n');
    
    if (tabs.length > 0) {
      const firstTab = tabs[0].properties?.title || '';
      console.log(`Para usar a primeira aba ("${firstTab}"):\n`);
      console.log(`GOOGLE_SHEETS_ENGINEER_SHEET=${firstTab}`);
      console.log(`GOOGLE_SHEETS_ENGINEER_RANGE=A2:AE1000\n`);
      console.log('ou (para nova variável):\n');
      console.log(`GOOGLE_SHEETS_ENG1_NAME=${firstTab}`);
      console.log(`GOOGLE_SHEETS_ENG1_RANGE=A2:AE1000\n`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANTE:\n');
    console.log('  • O nome da aba deve ser EXATAMENTE como aparece acima');
    console.log('  • Incluindo parênteses, espaços e acentos');
    console.log('  • Exemplo: "Engenheiro(a)" é diferente de "Engenheiro"\n');

  } catch (error: any) {
    console.error('\n❌ Erro ao acessar planilha:', error.message);
    
    if (error.message.includes('credentials')) {
      console.log('\n💡 Verifique:');
      console.log('  1. Arquivo credentials.json existe');
      console.log('  2. GOOGLE_APPLICATION_CREDENTIALS no .env');
    } else if (error.message.includes('permission')) {
      console.log('\n💡 Verifique:');
      console.log('  1. Planilha foi compartilhada com a service account');
      console.log('  2. Service account tem permissão de Editor');
    }
    
    process.exit(1);
  }
}

checkTabs();

