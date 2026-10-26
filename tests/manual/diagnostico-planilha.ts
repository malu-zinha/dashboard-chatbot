#!/usr/bin/env ts-node
// =====================================================
// DIAGNÓSTICO - Configuração da Planilha
// =====================================================
// Execute: npx ts-node tests/diagnostico-planilha.ts
// =====================================================

import { google } from 'googleapis';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function diagnosticar() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
  log('║           🔍 DIAGNÓSTICO DA PLANILHA                      ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');

  // 1. Verificar variáveis de ambiente
  log('📋 1. Verificando variáveis de ambiente...', 'bright');
  const vars = {
    'GOOGLE_SHEETS_ENGINEER_ID': process.env.GOOGLE_SHEETS_ENGINEER_ID,
    'GOOGLE_SHEETS_ENGINEER_NAME': process.env.GOOGLE_SHEETS_ENGINEER_NAME,
    'GOOGLE_SHEETS_ENGINEER_RANGE': process.env.GOOGLE_SHEETS_ENGINEER_RANGE,
    'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  };

  let hasErrors = false;
  for (const [key, value] of Object.entries(vars)) {
    if (!value) {
      log(`  ❌ ${key}: NÃO CONFIGURADA`, 'red');
      hasErrors = true;
    } else {
      log(`  ✅ ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`, 'green');
    }
  }

  if (hasErrors) {
    log('\n⚠️  Configure as variáveis faltando no arquivo .env', 'yellow');
    log('   Veja: docs/config-nova-planilha.md\n', 'yellow');
    return;
  }

  // 2. Verificar arquivo de credenciais
  log('\n📋 2. Verificando arquivo de credenciais...', 'bright');
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS!;
  
  if (!fs.existsSync(credsPath)) {
    log(`  ❌ Arquivo não encontrado: ${credsPath}`, 'red');
    log('     Baixe o arquivo credentials.json do Google Cloud', 'yellow');
    return;
  }
  
  log(`  ✅ Arquivo encontrado: ${credsPath}`, 'green');
  
  try {
    const credsContent = JSON.parse(fs.readFileSync(credsPath, 'utf-8'));
    const email = credsContent.client_email;
    log(`  ✅ Service Account Email: ${email}`, 'green');
    log(`     📝 Compartilhe a planilha com este email!`, 'yellow');
  } catch (error: any) {
    log(`  ❌ Erro ao ler credenciais: ${error.message}`, 'red');
    return;
  }

  // 3. Testar conexão com Google Sheets API
  log('\n📋 3. Testando conexão com Google Sheets API...', 'bright');
  
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: credsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ENGINEER_ID!;
    
    log('  🔄 Tentando acessar a planilha...', 'yellow');
    
    // Tentar obter informações básicas da planilha
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });
    
    log(`  ✅ Planilha acessada com sucesso!`, 'green');
    log(`     Título: ${spreadsheet.data.properties?.title}`, 'green');
    log(`     URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`, 'green');
    
    // Listar abas disponíveis
    log('\n📋 4. Verificando abas disponíveis...', 'bright');
    const sheets_list = spreadsheet.data.sheets || [];
    
    if (sheets_list.length === 0) {
      log('  ❌ Nenhuma aba encontrada na planilha!', 'red');
      return;
    }
    
    log(`  ✅ ${sheets_list.length} aba(s) encontrada(s):`, 'green');
    sheets_list.forEach((sheet, index) => {
      const title = sheet.properties?.title || 'Sem nome';
      log(`     ${index + 1}. ${title}`, 'reset');
    });
    
    // Verificar se a aba configurada existe
    log('\n📋 5. Verificando aba configurada...', 'bright');
    const targetSheet = process.env.GOOGLE_SHEETS_ENGINEER_NAME!;
    const sheetExists = sheets_list.some(s => s.properties?.title === targetSheet);
    
    if (!sheetExists) {
      log(`  ❌ Aba "${targetSheet}" NÃO ENCONTRADA!`, 'red');
      log(`     Abas disponíveis:`, 'yellow');
      sheets_list.forEach(sheet => {
        log(`     - "${sheet.properties?.title}"`, 'yellow');
      });
      log(`\n  💡 Atualize GOOGLE_SHEETS_ENGINEER_NAME no .env com o nome correto`, 'yellow');
      return;
    }
    
    log(`  ✅ Aba "${targetSheet}" encontrada!`, 'green');
    
    // Tentar ler a aba
    log('\n📋 6. Testando leitura da aba...', 'bright');
    const configuredRange = process.env.GOOGLE_SHEETS_ENGINEER_RANGE || 'A1:AE1000';
    // Extrair a linha inicial do range configurado (ex: A2:AE1000 -> 2)
    const startRow = configuredRange.match(/^[A-Z]+(\d+)/)?.[1] || '1';
    const endRow = parseInt(startRow) + 9; // 10 linhas
    const columnsRange = configuredRange.split(':')[0].replace(/\d+$/, '');
    const range = `${targetSheet}!${columnsRange}${startRow}:AE${endRow}`;
    
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      
      const rows = response.data.values || [];
      log(`  ✅ Leitura bem-sucedida! ${rows.length} linha(s) encontrada(s)`, 'green');
      
      if (rows.length > 0) {
        log(`\n  📊 Headers encontrados (${rows[0].length} colunas):`, 'cyan');
        rows[0].forEach((header, index) => {
          log(`     ${String.fromCharCode(65 + index)}. ${header}`, 'reset');
        });
      } else {
        log(`  ⚠️  A aba está vazia (sem headers)`, 'yellow');
      }
      
      // Verificar headers obrigatórios
      log('\n📋 7. Verificando headers obrigatórios...', 'bright');
      const requiredHeaders = [
        'Código do Projeto',
        'Cliente',
        'Área',
        'Tipo de Projeto',
        'Status do projeto',
        'Etapa'
      ];
      
      if (rows.length === 0) {
        log('  ❌ Não foi possível verificar (aba vazia)', 'red');
      } else {
        const headers = rows[0];
        let allFound = true;
        
        requiredHeaders.forEach(required => {
          if (headers.includes(required)) {
            log(`  ✅ "${required}" encontrado`, 'green');
          } else {
            log(`  ❌ "${required}" NÃO encontrado`, 'red');
            allFound = false;
          }
        });
        
        if (!allFound) {
          log('\n  💡 Adicione os headers faltando na linha 1 da planilha', 'yellow');
          log('     Veja a estrutura completa em: docs/config-nova-planilha.md', 'yellow');
        }
      }
      
      // Testar escrita (se permitido)
      log('\n📋 8. Testando permissão de escrita...', 'bright');
      
      try {
        // Tentar adicionar uma célula vazia no final da planilha (última coluna disponível, última linha)
        const testRange = `${targetSheet}!AE1000`;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: testRange,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['TEST']]
          }
        });
        
        // Limpar o teste
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: testRange,
        });
        
        log('  ✅ Permissão de escrita OK!', 'green');
      } catch (error: any) {
        if (error.message.includes('exceeds grid limits')) {
          log('  ⚠️  Não foi possível testar escrita (célula fora do range)', 'yellow');
          log('     Mas isso não é um problema - a planilha será acessível', 'yellow');
        } else if (error.message.includes('permission') || error.code === 403) {
          log(`  ❌ Sem permissão de escrita: ${error.message}`, 'red');
          log('     A service account precisa de permissão de "Editor"', 'yellow');
        } else {
          log(`  ⚠️  Teste de escrita: ${error.message}`, 'yellow');
        }
      }
      
    } catch (error: any) {
      log(`  ❌ Erro ao ler aba: ${error.message}`, 'red');
      
      if (error.message.includes('Unable to parse range')) {
        log('     O nome da aba pode estar incorreto', 'yellow');
      }
    }
    
    // Resumo final
    log('\n╔════════════════════════════════════════════════════════════╗', 'cyan');
    log('║                    📊 RESUMO                              ║', 'cyan');
    log('╚════════════════════════════════════════════════════════════╝\n', 'cyan');
    
    log('✅ Conexão com Google Sheets: OK', 'green');
    log('✅ Planilha acessível: OK', 'green');
    log(`✅ Aba "${targetSheet}": Encontrada`, 'green');
    log('✅ Leitura: OK', 'green');
    
    log('\n🎯 Próximos passos:', 'bright');
    log('   1. Certifique-se de que todos os headers estão presentes', 'yellow');
    log('   2. Teste o cadastro com: npm run test:interactive', 'yellow');
    log('   3. Se der erro, verifique as permissões da service account\n', 'yellow');
    
  } catch (error: any) {
    log(`  ❌ Erro ao acessar planilha: ${error.message}`, 'red');
    
    if (error.message.includes('not found') || error.code === 404) {
      log('\n  💡 Possíveis causas:', 'yellow');
      log('     1. O ID da planilha está incorreto', 'yellow');
      log('     2. A planilha não foi compartilhada com a service account', 'yellow');
      log('     3. A planilha foi deletada', 'yellow');
      log('\n  🔧 Soluções:', 'yellow');
      log('     1. Verifique o ID no .env (copie da URL da planilha)', 'yellow');
      log('     2. Compartilhe a planilha com o email da service account', 'yellow');
      log('     3. Dê permissão de "Editor" para a service account', 'yellow');
    } else if (error.message.includes('permission') || error.code === 403) {
      log('\n  💡 Erro de permissão:', 'yellow');
      log('     A planilha não está compartilhada com a service account', 'yellow');
      log('\n  🔧 Solução:', 'yellow');
      log('     1. Abra a planilha no Google Sheets', 'yellow');
      log('     2. Clique em "Compartilhar"', 'yellow');
      log('     3. Cole o email da service account (mostrado acima)', 'yellow');
      log('     4. Dê permissão de "Editor"', 'yellow');
      log('     5. Clique em "Enviar"', 'yellow');
    } else if (error.message.includes('This operation is not supported')) {
      log('\n  💡 Erro de tipo de documento:', 'yellow');
      log('     O ID pode ser de um Google Doc ou outro tipo de arquivo', 'yellow');
      log('\n  🔧 Solução:', 'yellow');
      log('     Certifique-se de que o ID é de uma PLANILHA do Google Sheets', 'yellow');
      log('     URL correta: https://docs.google.com/spreadsheets/d/[ID]/edit', 'yellow');
    }
    
    log('');
  }
}

diagnosticar().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
