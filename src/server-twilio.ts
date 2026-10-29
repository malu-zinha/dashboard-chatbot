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
import { getWhatsAppService, problemaConfigProvider } from '../integrations/whatsapp/whatsappService.ts';
import { criarWebhookWhatsapp } from '../integrations/whatsapp/webhookWhatsapp.ts';
import { criarWebhookStatus } from '../integrations/whatsapp/webhookStatus.ts';
import { getSupabaseService } from '../integrations/supabase/supabaseService.ts';
import { verificarSaude } from '../integrations/saude/healthcheck.ts';
import { sincronizacaoSheetsAtiva, variaveisObrigatoriasBoot } from '../integrations/cron/configSincronizacao.ts';
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

// Validações básicas (as do Google só valem com a sincronização do Sheets ligada)
const requiredEnvVars = variaveisObrigatoriasBoot(process.env);
const syncSheetsAtiva = sincronizacaoSheetsAtiva(process.env);

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

// Em produção, sem provider real o bot só imprimiria as mensagens no log.
const problemaProvider = problemaConfigProvider(process.env);
if (problemaProvider) {
  console.error(`❌ ${problemaProvider}`);
  process.exit(1);
}

// Verificar Supabase (opcional mas recomendado)
const temSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 Modo de operação:');
if (temSupabase) {
  console.log('   ✅ Supabase (Banco de dados)');
  if (syncSheetsAtiva) {
    console.log('   ✅ Google Sheets (Visualização)');
    console.log('   ✅ Sincronização automática a cada 5min');
  } else {
    console.log('   ⏸️  Sincronização com o Google Sheets desligada (ENABLE_SHEETS_SYNC=false)');
  }
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

// Health check usado pelo Railway no deploy: consulta o banco de verdade.
app.get('/health', async (req, res) => {
  const { http, corpo } = await verificarSaude(async () => {
    if (!temSupabase) throw new Error('Supabase não configurado');
    const { error } = await getSupabaseService()
      .getClient()
      .from('engenheiros')
      .select('eng_id', { head: true })
      .limit(1);
    if (error) throw new Error(error.message);
  });
  res.status(http).json(corpo);
});

// Webhook Twilio - Recebe mensagens do WhatsApp
// Responde ao Twilio na hora e processa depois (detalhes em webhookWhatsapp.ts).
const webhookWhatsapp = criarWebhookWhatsapp({
  processar: (telefone, mensagem) => messageHandler.processarMensagem(telefone, mensagem),
  enviar: (telefone, mensagem) => getWhatsAppService().sendMessage(telefone, mensagem),
});
app.post('/webhook/whatsapp', validarAssinaturaTwilio, webhookWhatsapp);

// Webhook Twilio - Status de mensagens enviadas
app.post('/webhook/status', validarAssinaturaTwilio, criarWebhookStatus({
  buscar: (r) => getSupabaseService().buscarStatusEntrega(r),
  gravar: (id, c, anterior) => getSupabaseService().gravarStatusEntrega(id, c, anterior),
}));

// =====================================================
// INICIALIZAÇÃO
// =====================================================

// Promise rejeitada sem catch: registra em vez de passar em silêncio.
process.on('unhandledRejection', (motivo: any) => {
  console.error('❌ Promise rejeitada sem tratamento:', redactSecrets(motivo?.stack ?? motivo?.message ?? motivo));
});

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
    if (temSupabase && syncSheetsAtiva) {
      console.log('\n🔄 Iniciando sincronização automática (Supabase → Sheets)...');
      iniciarSincronizacaoAutomatica();
    }

    // Iniciar servidor Express
    const server = app.listen(PORT, () => {
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

    // No deploy o Railway manda SIGTERM ao container antigo. Para de aceitar
    // conexões, desliga os crons e espera as mensagens em processamento
    // terminarem (até 10 s; o railway.json dá 15 s antes do SIGKILL).
    let desligando = false;
    const desligar = async (sinal: string) => {
      if (desligando) return;
      desligando = true;
      console.log(`\n🛑 ${sinal} recebido: encerrando...`);
      cronManager.stop();
      server.close();
      await Promise.race([
        webhookWhatsapp.aguardarEmAndamento(),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
      console.log('👋 Servidor encerrado');
      process.exit(0);
    };
    process.on('SIGTERM', () => void desligar('SIGTERM'));
    process.on('SIGINT', () => void desligar('SIGINT'));

  } catch (error: any) {
    console.error('❌ Erro fatal ao iniciar sistema:', error);
    process.exit(1);
  }
})();
