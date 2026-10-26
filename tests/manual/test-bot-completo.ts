#!/usr/bin/env ts-node
// =====================================================
// TESTE COMPLETO: Bot + Supabase + Sincronização
// =====================================================
// Simula bot no terminal com salvamento no Supabase
// Execute: npm run test:bot-completo
// =====================================================

// CRITICAL: Carregar .env ANTES de qualquer outra coisa
import './init-env.ts';

console.log('🔍 [INICIO] Script iniciado!');

// Agora importar o resto (com .env já carregado)
console.log('🔍 [INICIO] Importando readline...');
import readline from 'readline';
console.log('🔍 [INICIO] readline importado!');

console.log('🔍 [INICIO] Importando messageHandler...');
import { messageHandler } from '../../chatbot/handlers/messageHandler.ts';
console.log('🔍 [INICIO] messageHandler importado!');

console.log('🔍 [INICIO] Importando getSupabaseService...');
import { getSupabaseService } from '../../integrations/supabase/supabaseService.ts';
console.log('🔍 [INICIO] getSupabaseService importado!');

console.log('🔍 [INICIO] Importando executarSincronizacao...');
import { executarSincronizacao } from '../../integrations/cron/syncDatabaseToSheets.ts';
console.log('🔍 [INICIO] executarSincronizacao importado!');

console.log('🔍 [INICIO] Todas as importações concluídas!');

// Cores
const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  bold: '\x1b[1m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let TEST_USER = '+5511999999999'; // Será atualizado com input do usuário

console.clear();
console.log(`${c.cyan}╔════════════════════════════════════════════════════════════╗${c.reset}`);
console.log(`${c.cyan}║     🤖 TESTE COMPLETO DO BOT - Terminal                  ║${c.reset}`);
console.log(`${c.cyan}║     (Bot + Supabase + Sincronização)                     ║${c.reset}`);
console.log(`${c.cyan}╚════════════════════════════════════════════════════════════╝${c.reset}\n`);

console.log(`${c.yellow}🔍 [DEBUG] Carregando variáveis de ambiente...${c.reset}`);
console.log(`${c.yellow}🔍 [DEBUG] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Configurada' : 'NÃO configurada'}${c.reset}`);
console.log(`${c.yellow}🔍 [DEBUG] SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configurada' : 'NÃO configurada'}${c.reset}\n`);

// Verificar configuração
console.log(`${c.yellow}🔍 [DEBUG] Tentando conectar ao Supabase...${c.reset}`);
const supabase = getSupabaseService();
console.log(`${c.yellow}🔍 [DEBUG] getSupabaseService() retornou!${c.reset}`);

console.log(`${c.yellow}🔍 [DEBUG] Verificando isConnected()...${c.reset}`);
if (supabase.isConnected()) {
  console.log(`${c.green}✅ Supabase conectado${c.reset}`);
} else {
  console.log(`${c.red}❌ Supabase não configurado${c.reset}`);
  console.log(`${c.yellow}   Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env${c.reset}\n`);
}
console.log(`${c.yellow}🔍 [DEBUG] isConnected() verificado!${c.reset}`);

const hasSyncConfig = 
  process.env.GOOGLE_SHEETS_ENGINEER_ID ||
  process.env.GOOGLE_SHEETS_ENG1_ID ||
  process.env.GOOGLE_SHEETS_ENG2_ID ||
  process.env.GOOGLE_SHEETS_CEO_ID;

if (hasSyncConfig) {
  console.log(`${c.green}✅ Sincronização configurada${c.reset}`);
} else {
  console.log(`${c.yellow}⚠️  Sincronização não configurada${c.reset}`);
  console.log(`${c.yellow}   Configure GOOGLE_SHEETS_ENGINEER_ID no .env para visualizar em planilhas${c.reset}\n`);
}

console.log(`${c.magenta}═══════════════════════════════════════════════════════${c.reset}\n`);
console.log(`${c.yellow}💡 Como usar:${c.reset}`);
console.log(`   • Digite como se fosse no WhatsApp`);
console.log(`   • Comandos: menu, projeto, ajuda`);
console.log(`   • Para testar sincronização: sync`);
console.log(`   • Para sair: sair\n`);
console.log(`${c.magenta}═══════════════════════════════════════════════════════${c.reset}\n`);

console.log(`${c.yellow}🔍 [DEBUG] Configuração completa, iniciando bot...${c.reset}\n`);

async function processMessage(msg: string) {
  const msgLower = msg.toLowerCase().trim();
  
  console.log(`${c.yellow}🔍 [DEBUG] processMessage() chamada com: "${msg}"${c.reset}`);
  
  // Comandos especiais
  if (['sair', 'exit', 'quit'].includes(msgLower)) {
    console.log(`\n${c.cyan}👋 Até logo!${c.reset}\n`);
    process.exit(0);
  }
  
  if (msgLower === 'sync') {
    console.log(`\n${c.cyan}🔄 Executando sincronização manual...${c.reset}\n`);
    try {
      await executarSincronizacao();
      console.log(`\n${c.green}✅ Sincronização concluída!${c.reset}`);
      console.log(`${c.yellow}💡 Verifique suas planilhas no Google Sheets${c.reset}\n`);
    } catch (error: any) {
      console.error(`\n${c.red}❌ Erro na sincronização:${c.reset}`, error.message);
    }
    console.log(`${c.magenta}───────────────────────────────────────────────────────${c.reset}\n`);
    rl.prompt();
    return;
  }

  console.log(`${c.cyan}💬 Você: ${msg}${c.reset}\n`);
  
  try {
    console.log(`${c.yellow}🔍 [DEBUG] Chamando messageHandler.processarMensagem()...${c.reset}`);
    const response = await messageHandler.processarMensagem(TEST_USER, msg);
    console.log(`${c.yellow}🔍 [DEBUG] messageHandler retornou com sucesso!${c.reset}`);
    
    console.log(`${c.green}🤖 Bot:${c.reset}`);
    console.log(response.resposta);
    
    // Indicar se salvou no banco
    if (response.resposta.includes('Dados salvos no banco de dados')) {
      console.log(`\n${c.magenta}💾 Projeto salvo no Supabase!${c.reset}`);
      console.log(`${c.yellow}🔄 Planilhas serão atualizadas em até 5 minutos${c.reset}`);
      console.log(`${c.yellow}   Ou digite 'sync' para sincronizar agora${c.reset}`);
    }
    
    console.log(`\n${c.magenta}───────────────────────────────────────────────────────${c.reset}\n`);
  } catch (error: any) {
    console.error(`\n${c.red}❌ Erro:${c.reset}`, error.message);
    console.log(`\n${c.magenta}───────────────────────────────────────────────────────${c.reset}\n`);
  }
  
  rl.prompt();
}

// Pedir número do usuário antes de começar
function perguntarNumero(): Promise<string> {
  return new Promise((resolve) => {
    console.log(`${c.yellow}📱 Digite seu número de WhatsApp (ex: +5583900000000):${c.reset}`);
    rl.question(`${c.cyan}> ${c.reset}`, (numero) => {
      const numeroLimpo = numero.trim();
      if (!numeroLimpo) {
        console.log(`${c.yellow}⚠️  Usando número padrão: +5511999999999${c.reset}\n`);
        resolve('+5511999999999');
      } else if (!numeroLimpo.startsWith('+')) {
        console.log(`${c.yellow}⚠️  Formato inválido. Usando: +55${numeroLimpo}${c.reset}\n`);
        resolve(`+55${numeroLimpo.replace(/\D/g, '')}`);
      } else {
        console.log(`${c.green}✅ Usando número: ${numeroLimpo}${c.reset}\n`);
        resolve(numeroLimpo);
      }
    });
  });
}

// Enviar mensagem inicial
(async () => {
  // Perguntar número antes de iniciar
  TEST_USER = await perguntarNumero();
  
  console.log(`${c.yellow}🔍 [DEBUG] Enviando mensagem inicial com número: ${TEST_USER}${c.reset}`);
  console.log(`${c.cyan}💬 Você: oi${c.reset}\n`);
  console.log(`${c.yellow}🔍 [DEBUG] Chamando messageHandler.processarMensagem()...${c.reset}`);
  const welcome = await messageHandler.processarMensagem(TEST_USER, 'oi');
  console.log(`${c.yellow}🔍 [DEBUG] messageHandler retornou!${c.reset}`);
  console.log(`${c.green}🤖 Bot:${c.reset}`);
  console.log(welcome.resposta);
  console.log(`\n${c.magenta}───────────────────────────────────────────────────────${c.reset}\n`);
  
  rl.setPrompt(`${c.cyan}💬 Você: ${c.reset}`);
  rl.prompt();
  
  rl.on('line', processMessage);
  rl.on('close', () => {
    console.log(`\n${c.cyan}👋 Até logo!${c.reset}\n`);
    process.exit(0);
  });
})();

