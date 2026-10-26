/**
 * Script de diagnóstico para número específico que não recebe resposta
 * Número: +55 83 90000-0000 (troque pelo numero investigado)
 */

import dotenv from 'dotenv';
dotenv.config();

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

const NUMERO_PROBLEMA = '5583900000000'; // +55 83 90000-0000 (troque pelo numero investigado)
const NUMERO_PROBLEMA_FORMATADO = '+5583900000000';

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║   🔍 DIAGNÓSTICO: NÚMERO ESPECÍFICO                        ║');
console.log(`║   Número: ${NUMERO_PROBLEMA_FORMATADO}                    ║`);
console.log('╚════════════════════════════════════════════════════════════╝\n');

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'debug-numero' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  }
});

// QR Code
client.on('qr', (qr) => {
  console.log('📱 Escaneie o QR Code abaixo:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n⏳ Aguardando autenticação...\n');
});

// Bot pronto
client.on('ready', async () => {
  console.log('✅ WhatsApp conectado!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔍 VERIFICANDO NÚMERO PROBLEMÁTICO\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Tentar obter informações do contato
    const contactId = `${NUMERO_PROBLEMA}@c.us`;
    console.log(`📞 Tentando obter informações do contato: ${contactId}\n`);
    
    try {
      const contact = await client.getContactById(contactId);
      console.log('✅ CONTATO ENCONTRADO!\n');
      console.log(`   Nome: ${contact.pushname || contact.name || 'Sem nome'}`);
      console.log(`   Número: ${contact.number}`);
      console.log(`   ID: ${contact.id}`);
      console.log(`   É meu contato: ${contact.isMyContact}`);
      console.log(`   É usuário: ${contact.isUser}`);
      console.log(`   É grupo: ${contact.isGroup}`);
      console.log(`   É WhatsApp Business: ${contact.isBusiness}`);
      console.log(`   É bloqueado: ${contact.isBlocked || 'N/A'}\n`);
    } catch (error: any) {
      console.log('❌ ERRO ao obter contato:', error.message);
      console.log('   Isso pode significar que o número não está nos contatos\n');
    }
    
    // Verificar se conseguimos enviar mensagem
    console.log('📤 Testando envio de mensagem...\n');
    try {
      const chatId = `${NUMERO_PROBLEMA}@c.us`;
      await client.sendMessage(chatId, '🔍 Teste de diagnóstico - Se você receber isso, o bot consegue enviar mensagens para você!');
      console.log('✅ Mensagem de teste enviada com sucesso!\n');
    } catch (error: any) {
      console.log('❌ ERRO ao enviar mensagem:', error.message);
      console.log('   Isso pode significar que o número está bloqueado ou não existe\n');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 DIAGNÓSTICO COMPLETO\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Agora peça para o número enviar uma mensagem e observe os logs abaixo:\n');
    
  } catch (error: any) {
    console.error('❌ Erro no diagnóstico:', error);
  }
});

// Monitor de TODAS as mensagens
client.on('message', async (msg) => {
  const isNumeroProblema = msg.from.includes(NUMERO_PROBLEMA) || msg.from.includes('98899');
  
  if (isNumeroProblema) {
    console.log(`\n${'🔴'.repeat(30)}`);
    console.log(`🔴🔴🔴 MENSAGEM DO NÚMERO PROBLEMÁTICO RECEBIDA! 🔴🔴🔴`);
    console.log(`${'🔴'.repeat(30)}\n`);
  }
  
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📨 MENSAGEM RECEBIDA`);
  console.log(`   De: ${msg.from}`);
  console.log(`   Tipo: ${msg.type}`);
  console.log(`   FromMe: ${msg.fromMe}`);
  console.log(`   Body: "${msg.body || '(sem texto)'}"`);
  console.log(`   Timestamp: ${msg.timestamp}`);
  
  if (isNumeroProblema) {
    console.log(`\n   🔴 É O NÚMERO PROBLEMÁTICO!`);
    console.log(`   Formato: ${msg.from}`);
    console.log(`   Termina com @c.us: ${msg.from.endsWith('@c.us')}`);
    console.log(`   Termina com @g.us: ${msg.from.endsWith('@g.us')}`);
  }
  
  console.log(`${'─'.repeat(60)}\n`);
  
  // Tentar responder
  if (isNumeroProblema && !msg.fromMe) {
    try {
      await client.sendMessage(msg.from, '✅ Bot recebeu sua mensagem! Se você receber isso, o problema está resolvido!');
      console.log('✅ Resposta enviada para o número problemático!\n');
    } catch (error: any) {
      console.error('❌ Erro ao enviar resposta:', error.message, '\n');
    }
  }
});

// Desconexão
client.on('disconnected', (reason) => {
  console.log('❌ WhatsApp desconectado:', reason);
  process.exit(1);
});

// Iniciar
console.log('🚀 Iniciando cliente WhatsApp...\n');
client.initialize();

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n\n👋 Encerrando diagnóstico...\n');
  client.destroy();
  process.exit(0);
});

