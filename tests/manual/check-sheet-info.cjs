const { google } = require('googleapis');
require('dotenv').config();

async function checkSheet() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔍 INFORMAÇÕES DA PLANILHA                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const sheetId = process.env.GOOGLE_SHEETS_ENGINEER_ID;
  
  if (!sheetId) {
    console.log('❌ GOOGLE_SHEETS_ENGINEER_ID não configurado no .env\n');
    process.exit(1);
  }

  console.log(`📊 ID da planilha: ${sheetId.substring(0, 15)}...\n`);

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ Planilha: "${response.data.properties.title}"\n`);
    console.log(`📑 Total de abas: ${response.data.sheets.length}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('ABAS ENCONTRADAS:\n');
    
    response.data.sheets.forEach((sheet, i) => {
      const title = sheet.properties.title;
      const rows = sheet.properties.gridProperties.rowCount;
      const cols = sheet.properties.gridProperties.columnCount;
      
      console.log(`${i + 1}. "${title}"`);
      console.log(`   Tamanho: ${rows} linhas x ${cols} colunas`);
      
      // Verificar se é a aba configurada
      const configuredName = process.env.GOOGLE_SHEETS_ENGINEER_SHEET;
      if (title === configuredName) {
        console.log('   ✅ Esta é a aba configurada no .env!');
      } else if (configuredName) {
        console.log(`   ⚠️  No .env está: "${configuredName}"`);
      }
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 RECOMENDAÇÃO PARA O .env:\n');
    
    const firstTab = response.data.sheets[0].properties.title;
    console.log(`GOOGLE_SHEETS_ENGINEER_SHEET=${firstTab}`);
    console.log(`GOOGLE_SHEETS_ENGINEER_RANGE=A3:AE1000\n`);
    
    console.log('(Se sua planilha tem 2 linhas de cabeçalho, use A3)\n');

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    
    if (error.code === 403) {
      console.log('\n💡 A planilha não foi compartilhada com a service account');
      console.log('   Compartilhe com o email em credentials.json\n');
    }
  }
}

checkSheet();
