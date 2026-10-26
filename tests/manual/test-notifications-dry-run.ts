import dotenv from 'dotenv';
import { NotificationService } from '../../integrations/notifications/notificationService.ts';
import { WhatsAppService, type WhatsAppProvider } from '../../integrations/whatsapp/whatsappService.ts';

dotenv.config();

class FakeWhatsAppProvider implements WhatsAppProvider {
  sent: Array<{ to: string; message: string }> = [];

  async sendMessage(to: string, message: string): Promise<boolean> {
    this.sent.push({ to, message });
    return true;
  }

  getProviderName(): string {
    return 'Fake WhatsApp';
  }
}

async function main() {
  const fakeProvider = new FakeWhatsAppProvider();
  const whatsappService = new WhatsAppService(fakeProvider);
  const service = new NotificationService(whatsappService);

  await service.sendMorningNotifications();

  if (fakeProvider.sent.length === 0) {
    throw new Error('Dry-run nao gerou nenhuma notificacao matinal');
  }

  console.log(`test-notifications-dry-run: OK (${fakeProvider.sent.length} notificacoes simuladas)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
