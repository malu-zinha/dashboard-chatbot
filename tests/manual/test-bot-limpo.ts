#!/usr/bin/env ts-node
// =====================================================
// TESTE DO BOT SIMPLIFICADO - Terminal
// =====================================================
// Testa o sistema limpo (sem QueryService/CommandService)
// Apenas fluxos guiados com menus
// Execute: npm run test:bot-limpo
// =====================================================

import readline from 'readline';
import { messageHandler } from '../../chatbot/handlers/messageHandler.ts';
import dotenv from 'dotenv';

dotenv.config();

// Cores para o terminal
const c = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const TEST_USER = '+5511999999999';

console.clear();
console.log(`${c.cyan}╔════════════════════════════════════════════════════════════╗${c.reset}`);
console.log(`${c.cyan}║        🤖 TESTE DO BOT SIMPLIFICADO - Terminal          ║${c.reset}`);
console.log(`${c.cyan}╚════════════════════════════════════════════════════════════╝${c.reset}\n`);
console.log(`${c.yellow}💡 Digite como se fosse no WhatsApp${c.reset}`);
console.log(`${c.yellow}   Comandos: menu, projeto, ajuda${c.reset}`);
console.log(`${c.yellow}   Para sair: sair${c.reset}\n`);
console.log(`${c.dim}Sistema atual: Apenas fluxos guiados (sem IA)${c.reset}`);
console.log('─'.repeat(60) + '\n');

async function processMessage(msg: string) {
  const trimmed = msg.trim();
  
  if (['sair', 'exit', 'quit'].includes(trimmed.toLowerCase())) {
    console.log(`\n${c.cyan}👋 Até logo!${c.reset}\n`);
    process.exit(0);
  }

  if (trimmed === '') {
    rl.prompt();
    return;
  }

  console.log(`${c.cyan}💬 Você: ${trimmed}${c.reset}\n`);
  
  try {
    const response = await messageHandler.processarMensagem(TEST_USER, trimmed);
    
    console.log(`${c.green}🤖 Bot:${c.reset}`);
    console.log(response.resposta);
    console.log('\n' + '─'.repeat(60) + '\n');
  } catch (error: any) {
    console.log(`${c.red}❌ Erro: ${error.message}${c.reset}\n`);
  }
  
  rl.prompt();
}

// Enviar mensagem inicial
(async () => {
  console.log(`${c.cyan}💬 Você: oi${c.reset}\n`);
  
  try {
    const welcome = await messageHandler.processarMensagem(TEST_USER, 'oi');
    console.log(`${c.green}🤖 Bot:${c.reset}`);
    console.log(welcome.resposta);
    console.log('\n' + '─'.repeat(60) + '\n');
  } catch (error: any) {
    console.log(`${c.red}❌ Erro ao iniciar: ${error.message}${c.reset}\n`);
  }
  
  rl.setPrompt(`${c.cyan}💬 Você: ${c.reset}`);
  rl.prompt();
  
  rl.on('line', processMessage);
  
  rl.on('close', () => {
    console.log(`\n${c.cyan}👋 Até logo!${c.reset}\n`);
    process.exit(0);
  });
  
  // Capturar Ctrl+C
  process.on('SIGINT', () => {
    console.log(`\n\n${c.cyan}👋 Até logo!${c.reset}\n`);
    process.exit(0);
  });
})();

