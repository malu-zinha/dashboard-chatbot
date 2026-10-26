/**
 * Script de Teste - Notificações Automáticas
 * 
 * Uso:
 * npm run test:notifications morning  - Testa notificação matinal
 * npm run test:notifications night    - Testa notificação noturna
 * npm run test:notifications worker   - Testa worker de notificações pendentes
 * npm run test:notifications stats    - Mostra estatísticas
 */

import dotenv from 'dotenv';
import { getNotificationService } from '../../integrations/notifications/notificationService.ts';
import { getNotificationWorker } from '../../integrations/notifications/notificationWorker.ts';
import { getWhatsAppService } from '../../integrations/whatsapp/whatsappService.ts';

// Carregar variáveis de ambiente
dotenv.config();

const tipoTeste = process.argv[2] || 'morning';

console.log('\n' + '='.repeat(60));
console.log('🧪 TESTE DE NOTIFICAÇÕES');
console.log('='.repeat(60) + '\n');

async function testarNotificacaoMatinal() {
  console.log('🌅 Testando Notificação Matinal...\n');
  
  try {
    // Inicializar serviços
    const whatsappService = getWhatsAppService();
    const notificationService = getNotificationService();
    notificationService.setWhatsAppService(whatsappService);
    
    // Disparar notificação matinal
    await notificationService.sendMorningNotifications();
    
    console.log('\n✅ Teste concluído com sucesso!\n');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function testarNotificacaoNoturna() {
  console.log('🌙 Testando Notificação Noturna...\n');
  
  try {
    // Inicializar serviços
    const whatsappService = getWhatsAppService();
    const notificationService = getNotificationService();
    notificationService.setWhatsAppService(whatsappService);
    
    // Disparar notificação noturna
    await notificationService.sendNightNotifications();
    
    console.log('\n✅ Teste concluído com sucesso!\n');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function testarWorker() {
  console.log('📬 Testando Worker de Notificações Pendentes...\n');
  
  try {
    // Inicializar serviços
    const whatsappService = getWhatsAppService();
    const notificationWorker = getNotificationWorker();
    notificationWorker.setWhatsAppService(whatsappService);
    
    // Processar notificações pendentes
    await notificationWorker.processarNotificacoesPendentes();
    
    console.log('\n✅ Teste concluído com sucesso!\n');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function mostrarEstatisticas() {
  console.log('📊 Estatísticas das Notificações\n');
  
  try {
    const notificationWorker = getNotificationWorker();
    const stats = await notificationWorker.obterEstatisticas();
    
    console.log('📈 Resumo:');
    console.log(`   📬 Pendentes: ${stats.pendentes}`);
    console.log(`   ✅ Enviadas (24h): ${stats.enviadasHoje}`);
    console.log(`   ❌ Falhadas: ${stats.falhadas}`);
    console.log('');
    
    if (stats.pendentes > 0) {
      console.log('ℹ️  Execute "npm run test:notifications worker" para processar pendentes');
    }
    
    console.log('');
    process.exit(0);
    
  } catch (error: any) {
    console.error('\n❌ Erro ao obter estatísticas:', error.message);
    process.exit(1);
  }
}

// Executar teste baseado no argumento
switch (tipoTeste) {
  case 'morning':
  case 'manha':
  case 'm':
    testarNotificacaoMatinal();
    break;
    
  case 'night':
  case 'noite':
  case 'n':
    testarNotificacaoNoturna();
    break;
    
  case 'worker':
  case 'w':
    testarWorker();
    break;
    
  case 'stats':
  case 'status':
  case 's':
    mostrarEstatisticas();
    break;
    
  default:
    console.log('❌ Tipo de teste inválido!\n');
    console.log('Uso:');
    console.log('  npm run test:notifications morning  - Notificação matinal');
    console.log('  npm run test:notifications night    - Notificação noturna');
    console.log('  npm run test:notifications worker   - Worker pendentes');
    console.log('  npm run test:notifications stats    - Estatísticas');
    console.log('');
    process.exit(1);
}
