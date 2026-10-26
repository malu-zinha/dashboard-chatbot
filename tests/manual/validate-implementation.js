// =====================================================
// SCRIPT DE VALIDAÇÃO DA IMPLEMENTAÇÃO
// =====================================================
// Este script verifica se todos os arquivos necessários
// para o novo fluxo de engenheiros foram criados/modificados
// =====================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// =====================================================
// CORES PARA OUTPUT
// =====================================================
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// =====================================================
// VERIFICAÇÕES
// =====================================================

const checks = {
  files: [
    {
      path: 'integrations/sheets/engineerSheetService.ts',
      description: 'Serviço da nova planilha de engenheiros',
      required: true,
    },
    {
      path: 'chatbot/flows/engineerProjectFlow.ts',
      description: 'Fluxo de gestão de projetos',
      required: true,
    },
    {
      path: 'docs/config-nova-planilha.md',
      description: 'Documentação de configuração',
      required: true,
    },
    {
      path: 'tests/test-engineer-flow.md',
      description: 'Plano de testes',
      required: true,
    },
  ],
  
  modifications: [
    {
      path: 'chatbot/handlers/messageHandler.ts',
      description: 'MessageHandler com novo intent',
      checks: [
        {
          content: 'EngineerProjectFlow',
          description: 'Import do EngineerProjectFlow',
        },
        {
          content: 'gerenciar_projeto',
          description: 'Intent gerenciar_projeto',
        },
        {
          content: 'iniciarFluxoProjeto',
          description: 'Função iniciarFluxoProjeto',
        },
      ],
    },
    {
      path: 'chatbot/handlers/sheetsBot.ts',
      description: 'SheetsBot com suporte à nova planilha',
      checks: [
        {
          content: 'ENGINEER_NEW_SPREADSHEET_ID',
          description: 'Variável ENGINEER_NEW_SPREADSHEET_ID',
        },
        {
          content: 'GOOGLE_SHEETS_ENGINEER_ID',
          description: 'Carregamento da variável de ambiente',
        },
        {
          content: 'GESTÃO DE PROJETOS',
          description: 'Menu atualizado com nova opção',
        },
      ],
    },
  ],

  constants: [
    {
      path: 'integrations/sheets/engineerSheetService.ts',
      description: 'Constantes da planilha',
      checks: [
        {
          content: 'TIPOS_PROJETO',
          description: 'Array TIPOS_PROJETO',
        },
        {
          content: 'STATUS_PROJETO',
          description: 'Array STATUS_PROJETO',
        },
        {
          content: 'ETAPAS_PROJETO',
          description: 'Array ETAPAS_PROJETO',
        },
        {
          content: 'MOTIVOS_REVISAO',
          description: 'Array MOTIVOS_REVISAO',
        },
      ],
    },
  ],
};

// =====================================================
// FUNÇÕES DE VERIFICAÇÃO
// =====================================================

function checkFileExists(filePath) {
  const fullPath = path.join(rootDir, filePath);
  return fs.existsSync(fullPath);
}

function checkFileContent(filePath, searchString) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return content.includes(searchString);
}

// =====================================================
// EXECUTAR VALIDAÇÕES
// =====================================================

function runValidation() {
  log('\n🔍 VALIDANDO IMPLEMENTAÇÃO DO FLUXO DE ENGENHEIROS\n', 'cyan');
  
  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = [];

  // Verificar arquivos criados
  log('📁 Verificando arquivos criados...', 'blue');
  checks.files.forEach((file) => {
    totalChecks++;
    const exists = checkFileExists(file.path);
    
    if (exists) {
      log(`  ✅ ${file.description}`, 'green');
      passedChecks++;
    } else {
      log(`  ❌ ${file.description} - FALTANDO`, 'red');
      failedChecks.push(`Arquivo faltando: ${file.path}`);
    }
  });

  // Verificar modificações em arquivos
  log('\n✏️  Verificando modificações...', 'blue');
  checks.modifications.forEach((mod) => {
    log(`  📄 ${mod.description}:`, 'yellow');
    
    const fileExists = checkFileExists(mod.path);
    if (!fileExists) {
      log(`    ❌ Arquivo não encontrado: ${mod.path}`, 'red');
      totalChecks += mod.checks.length;
      failedChecks.push(`Arquivo não encontrado: ${mod.path}`);
      return;
    }

    mod.checks.forEach((check) => {
      totalChecks++;
      const hasContent = checkFileContent(mod.path, check.content);
      
      if (hasContent) {
        log(`    ✅ ${check.description}`, 'green');
        passedChecks++;
      } else {
        log(`    ❌ ${check.description} - NÃO ENCONTRADO`, 'red');
        failedChecks.push(`${mod.path}: ${check.description}`);
      }
    });
  });

  // Verificar constantes
  log('\n🔢 Verificando constantes...', 'blue');
  checks.constants.forEach((constant) => {
    log(`  📄 ${constant.description}:`, 'yellow');
    
    const fileExists = checkFileExists(constant.path);
    if (!fileExists) {
      log(`    ❌ Arquivo não encontrado: ${constant.path}`, 'red');
      totalChecks += constant.checks.length;
      return;
    }

    constant.checks.forEach((check) => {
      totalChecks++;
      const hasContent = checkFileContent(constant.path, check.content);
      
      if (hasContent) {
        log(`    ✅ ${check.description}`, 'green');
        passedChecks++;
      } else {
        log(`    ❌ ${check.description} - NÃO ENCONTRADO`, 'red');
        failedChecks.push(`${constant.path}: ${check.description}`);
      }
    });
  });

  // Resumo
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 RESUMO DA VALIDAÇÃO', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const percentage = ((passedChecks / totalChecks) * 100).toFixed(1);
  log(`\n  Total de verificações: ${totalChecks}`);
  log(`  ✅ Aprovadas: ${passedChecks}`, 'green');
  log(`  ❌ Falharam: ${totalChecks - passedChecks}`, 'red');
  log(`  📈 Taxa de sucesso: ${percentage}%\n`);

  if (failedChecks.length > 0) {
    log('❌ VERIFICAÇÕES QUE FALHARAM:', 'red');
    failedChecks.forEach((fail) => {
      log(`  • ${fail}`, 'red');
    });
    log('');
  }

  // Próximos passos
  log('📋 PRÓXIMOS PASSOS:\n', 'cyan');
  
  if (passedChecks === totalChecks) {
    log('  ✅ Implementação completa!', 'green');
    log('  1. Configure as variáveis de ambiente no .env', 'yellow');
    log('  2. Compartilhe a planilha com a service account', 'yellow');
    log('  3. Execute: npm run dev', 'yellow');
    log('  4. Siga o plano de testes: tests/test-engineer-flow.md', 'yellow');
  } else {
    log('  ⚠️  Implementação incompleta', 'yellow');
    log('  1. Corrija as verificações que falharam', 'yellow');
    log('  2. Execute este script novamente', 'yellow');
    log('  3. Quando todas passarem, configure o .env', 'yellow');
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan');

  // Exit code
  process.exit(passedChecks === totalChecks ? 0 : 1);
}

// =====================================================
// EXECUTAR
// =====================================================

runValidation();
