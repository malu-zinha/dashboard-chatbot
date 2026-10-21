/**
 * Twilio WhatsApp Bot Server
 * 
 * Servidor Express que recebe webhooks do Twilio para WhatsApp
 * Ideal para deploy em plataformas como Railway, Heroku, etc.
 */

import dotenv from 'dotenv';
import express from 'express';
import { messageHandler } from '../chatbot/handlers/messageHandler.ts';
import { getCronJobManager } from '../integrations/cron/cronJobs.ts';
import { iniciarSincronizacaoAutomatica } from '../integrations/cron/syncDatabaseToSheets.ts';
import { getWhatsAppService } from '../integrations/whatsapp/whatsappService.ts';
import { getNotificationService } from '../integrations/notifications/notificationService.ts';
import { getNotificationWorker } from '../integrations/notifications/notificationWorker.ts';
import { redactSecrets } from '../logic/security/redactSecrets.ts';
import {
  assinaturaTwilioValida,
  exigeAssinaturaTwilio,
  montarUrlWebhook,
} from '../logic/security/twilioSignature.ts';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Atras do proxy do Railway: sem isto req.protocol e "http" e a URL usada na
// assinatura nao bate com a que o Twilio assinou (https).
app.set('trust proxy', true);

// Middleware para parsing de form data do Twilio
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// So aceita requisicoes assinadas pelo Twilio.
const validarAssinaturaTwilio: express.RequestHandler = (req, res, next) => {
  if (!exigeAssinaturaTwilio(process.env)) return next();

  const url = montarUrlWebhook(
    {
      protocol: req.protocol,
      host: req.get('x-forwarded-host') ?? req.get('host'),
      originalUrl: req.originalUrl,
    },
    process.env.TWILIO_WEBHOOK_BASE_URL
  );
  const valida = assinaturaTwilioValida({
    authToken: process.env.TWILIO_AUTH_TOKEN,
    assinatura: req.get('x-twilio-signature'),
    url,
    params: req.body ?? {},
  });
  if (valida) return next();

  console.warn(`⛔ Assinatura Twilio invalida em ${req.originalUrl} (url conferida: ${url})`);
  res.status(403).send('Forbidden');
};

console.log('🚀 Iniciando Twilio WhatsApp Bot Server...\n');

// Validações básicas
const requiredEnvVars = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_SHEETS_ENGINEER_ID',
  'GOOGLE_SHEETS_ENGINEER_NAME'
];

const twilioEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variáveis de ambiente obrigatórias faltando:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.error('\n📖 Configure o arquivo .env\n');
  process.exit(1);
}

// Verificar configuração Twilio
const missingTwilio = twilioEnvVars.filter(varName => !process.env[varName]);
if (missingTwilio.length > 0) {
  console.warn('⚠️  Twilio não completamente configurado:');
  missingTwilio.forEach(varName => console.warn(`   - ${varName}`));
  console.warn('   ℹ️  Configure Twilio para enviar mensagens pelo WhatsApp\n');
}

// Verificar Supabase (opcional mas recomendado)
const temSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 Modo de operação:');
if (temSupabase) {
  console.log('   ✅ Supabase (Banco de dados)');
  console.log('   ✅ Google Sheets (Visualização)');
  console.log('   ✅ Sincronização automática a cada 5min');
} else {
  console.log('   ⚠️  Apenas Google Sheets (sem banco de dados)');
  console.log('   ℹ️  Configure Supabase para melhor desempenho');
}

console.log('\n📱 WhatsApp Provider:');
const whatsappProvider = process.env.WHATSAPP_PROVIDER || 'development';
if (whatsappProvider === 'twilio') {
  console.log('   ✅ Twilio WhatsApp API');
} else {
  console.log('   ⚠️  Development Mode (apenas logs)');
  console.log('   ℹ️  Configure WHATSAPP_PROVIDER=twilio para enviar mensagens reais');
}

// =====================================================
// ROTAS
// =====================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Twilio WhatsApp Bot',
    provider: whatsappProvider,
    database: temSupabase ? 'supabase' : 'sheets-only',
    timestamp: new Date().toISOString()
  });
});

// Health check alternativo
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook Twilio - Recebe mensagens do WhatsApp
app.post('/webhook/whatsapp', validarAssinaturaTwilio, async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('📨 MENSAGEM RECEBIDA VIA TWILIO');
    console.log('='.repeat(60));
    console.log(`📞 De: ${From}`);
    console.log(`💬 Mensagem: "${Body}"`);
    console.log(`🆔 SID: ${MessageSid}`);
    console.log('='.repeat(60));

    if (!From || !Body) {
      console.error('❌ Mensagem inválida (sem From ou Body)');
      return res.status(400).send('Bad Request');
    }

    // Normalizar número de telefone
    // Twilio envia no formato: whatsapp:+5511999999999
    const userId = From.replace('whatsapp:', '').trim();

    console.log(`🔄 Processando mensagem de ${userId}...`);

    // Processar via messageHandler
    const handlerResponse = await messageHandler.processarMensagem(userId, Body);

    console.log(`✅ Resposta gerada (${handlerResponse.resposta.length} chars)`);

    // Enviar resposta via WhatsApp Service
    const whatsappService = getWhatsAppService();
    await whatsappService.sendMessage(userId, handlerResponse.resposta);

    console.log('✅ Resposta enviada com sucesso!\n');

    // Responder ao Twilio com 200 OK (sem TwiML para evitar duplicação)
    res.status(200).send('OK');

  } catch (error: any) {
    console.error('\n❌ ERRO NO WEBHOOK:');
    console.error(`   Erro: ${redactSecrets(error?.message ?? error)}`);
    console.error(`   Stack: ${redactSecrets(error?.stack)}\n`);

    res.status(500).send('Internal Server Error');
  }
});

// Webhook Twilio - Status de mensagens enviadas
app.post('/webhook/status', validarAssinaturaTwilio, (req, res) => {
  const { MessageSid, MessageStatus, To } = req.body;

  console.log(`📬 Status da mensagem ${MessageSid} para ${To}: ${MessageStatus}`);

  res.sendStatus(200);
});

// =====================================================
// HELPERS
// =====================================================

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// =====================================================
// INICIALIZAÇÃO
// =====================================================

(async () => {
  try {
    console.log('\n⏰ Iniciando sistema de notificações automáticas...');

    // Inicializar WhatsApp Service
    const whatsappService = getWhatsAppService();
    console.log(`   📱 ${whatsappService.getProviderName()}`);

    // Inicializar Notification Service e injetar WhatsApp Service
    const notificationService = getNotificationService();
    notificationService.setWhatsAppService(whatsappService);

    // Inicializar Notification Worker e injetar WhatsApp Service
    const notificationWorker = getNotificationWorker();
    notificationWorker.setWhatsAppService(whatsappService);

    // Iniciar Cron Jobs (notificações + worker)
    const cronManager = getCronJobManager();
    cronManager.start();

    // Iniciar sincronização automática Supabase → Google Sheets
    if (temSupabase) {
      console.log('\n🔄 Iniciando sincronização automática (Supabase → Sheets)...');
      iniciarSincronizacaoAutomatica();
    }

    // Iniciar servidor Express
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ SERVIDOR INICIADO COM SUCESSO!');
      console.log('='.repeat(60));
      console.log(`🌐 Servidor rodando na porta: ${PORT}`);
      console.log(`📱 Webhook WhatsApp: http://localhost:${PORT}/webhook/whatsapp`);
      console.log(`📊 Health Check: http://localhost:${PORT}/health`);
      console.log('='.repeat(60));
      console.log('\n📋 Próximos passos:');
      console.log('   1. Configure o webhook do Twilio para apontar para:');
      console.log(`      https://SEU_DOMINIO/webhook/whatsapp`);
      console.log('   2. Configure as variáveis de ambiente do Twilio no .env');
      console.log('   3. Configure WHATSAPP_PROVIDER=twilio no .env\n');
    });

  } catch (error: any) {
    console.error('❌ Erro fatal ao iniciar sistema:', error);
    process.exit(1);
  }
})();
