// =====================================================
// WhatsApp Service - Abstração para múltiplos providers
// =====================================================
// Suporta três modos:
// - Development: Apenas logs no console
// - Meta API: Envio real via WhatsApp Business API
// - Twilio API: Envio real via Twilio WhatsApp API
// =====================================================

import dotenv from 'dotenv';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';
import { mascararTelefone } from '../../logic/security/mascararPII.ts';
dotenv.config();

// Sem resposta do provedor neste tempo, o envio conta como falha. Sem limite,
// um fetch preso segurava o worker de notificacoes e a conversa.
export const TIMEOUT_ENVIO_MS = 15_000;

/**
 * Em producao, sem WHATSAPP_PROVIDER real, o servico caia no modo
 * desenvolvimento: so imprime no log e devolve sucesso, e as notificacoes
 * eram marcadas como enviadas sem sair. Devolve o motivo para recusar o boot,
 * ou null se a configuracao serve.
 */
export function problemaConfigProvider(env: Record<string, string | undefined>): string | null {
  const producao =
    env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT);
  if (!producao) return null;
  const provider = env.WHATSAPP_PROVIDER;
  if (provider === 'twilio' || provider === 'meta') return null;
  return `WHATSAPP_PROVIDER=${provider ?? '(vazio)'} em producao: use "twilio" ou "meta". ` +
    'O modo desenvolvimento so imprime as mensagens no log e as daria como enviadas.';
}

// =====================================================
// INTERFACE: WhatsAppProvider
// =====================================================

export interface ResultadoEnvio {
  ok: boolean;
  sid?: string;
}

/**
 * URL que a Twilio chama a cada mudanca de status da mensagem. O id da
 * notificacao vai na query para o webhook saber qual linha atualizar.
 * Sem base publica configurada devolve null (nao pede callback).
 */
export function urlCallbackStatus(
  env: Record<string, string | undefined>,
  notificacaoId: string,
): string | null {
  let base: string | undefined;
  if (env.TWILIO_WEBHOOK_BASE_URL) {
    base = env.TWILIO_WEBHOOK_BASE_URL.replace(/\/+$/, '');
  } else if (env.RAILWAY_PUBLIC_DOMAIN) {
    base = `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  if (!base) return null;
  return `${base}/webhook/status?notificacao=${encodeURIComponent(notificacaoId)}`;
}

export interface WhatsAppProvider {
  sendMessage(
    to: string,
    message: string,
    opcoes?: { statusCallback?: string },
  ): Promise<ResultadoEnvio | boolean>;
  getProviderName(): string;
}

// =====================================================
// PROVIDER: Development (Logs apenas)
// =====================================================

class DevWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(to: string, message: string): Promise<boolean> {
    console.log('\n' + '='.repeat(60));
    console.log('📱 [DEV] Mensagem WhatsApp (simulação)');
    console.log('='.repeat(60));
    console.log(`📞 Para: ${to}`);
    console.log('💬 Mensagem:');
    console.log('-'.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  getProviderName(): string {
    return 'Development (Console Logs)';
  }
}

// =====================================================
// PROVIDER: Meta WhatsApp Business API
// =====================================================

class MetaWhatsAppProvider implements WhatsAppProvider {
  private accessToken: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.accessToken = process.env.META_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
    this.apiVersion = process.env.META_API_VERSION || 'v18.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('⚠️  Meta API não configurada corretamente. Configure META_ACCESS_TOKEN e META_PHONE_NUMBER_ID no .env');
    }
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    if (!this.accessToken || !this.phoneNumberId) {
      console.error('❌ Meta API não configurada. Mensagem não enviada.');
      return false;
    }

    try {
      // Normalizar número de telefone (remover + e espaços)
      const phoneNumber = to.replace(/[^\d]/g, '');

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phoneNumber,
          type: 'text',
          text: {
            preview_url: false,
            body: message
          }
        }),
        signal: AbortSignal.timeout(TIMEOUT_ENVIO_MS)
      });

      if (!response.ok) {
        const errorData = await response.json();
        // A resposta de erro da Meta pode ecoar o header Authorization.
        console.error('❌ Erro ao enviar mensagem via Meta API:', redactSecrets(errorData));
        return false;
      }

      const data = await response.json();
      console.log(`✅ Mensagem enviada via Meta API para ${mascararTelefone(to)}`);
      console.log(`   Message ID: ${data.messages?.[0]?.id || 'N/A'}`);
      return true;

    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem via Meta API:', redactSecrets(error?.message ?? error));
      return false;
    }
  }

  getProviderName(): string {
    return 'Meta WhatsApp Business API';
  }
}

// =====================================================
// PROVIDER: Twilio WhatsApp API
// =====================================================

class TwilioWhatsAppProvider implements WhatsAppProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private baseUrl: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.warn('⚠️  Twilio API não configurada corretamente. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN e TWILIO_PHONE_NUMBER no .env');
    }
  }

  async sendMessage(
    to: string,
    message: string,
    opcoes?: { statusCallback?: string },
  ): Promise<ResultadoEnvio> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      console.error('❌ Twilio API não configurada. Mensagem não enviada.');
      return { ok: false };
    }

    try {
      // Normalizar número: garantir formato whatsapp:+5511999999999
      let toNumber = to.trim();
      if (!toNumber.startsWith('whatsapp:')) {
        // Se não tem prefixo whatsapp:, adicionar
        if (!toNumber.startsWith('+')) {
          toNumber = '+' + toNumber;
        }
        toNumber = 'whatsapp:' + toNumber;
      }

      let fromNumber = this.fromNumber;
      if (!fromNumber.startsWith('whatsapp:')) {
        if (!fromNumber.startsWith('+')) {
          fromNumber = '+' + fromNumber;
        }
        fromNumber = 'whatsapp:' + fromNumber;
      }

      // Criar credenciais Base64 para autenticação
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Preparar dados do form
      const formData = new URLSearchParams();
      formData.append('From', fromNumber);
      formData.append('To', toNumber);
      formData.append('Body', message);
      if (opcoes?.statusCallback) formData.append('StatusCallback', opcoes.statusCallback);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(TIMEOUT_ENVIO_MS)
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Idem: a resposta do Twilio pode carregar o Auth Token no eco do request.
        console.error('❌ Erro ao enviar mensagem via Twilio:', redactSecrets(errorData));
        return { ok: false };
      }

      const data = await response.json();
      console.log(`✅ Mensagem enviada via Twilio para ${mascararTelefone(to)}`);
      console.log(`   Message SID: ${data.sid || 'N/A'}`);
      return { ok: true, sid: data.sid };

    } catch (error: any) {
      console.error('❌ Erro ao enviar mensagem via Twilio:', redactSecrets(error?.message ?? error));
      return { ok: false };
    }
  }

  getProviderName(): string {
    return 'Twilio WhatsApp API';
  }
}

// =====================================================
// SERVICE: WhatsAppService (Singleton)
// =====================================================

export class WhatsAppService {
  private provider: WhatsAppProvider;

  constructor(provider?: WhatsAppProvider) {
    // Determinar provider baseado na variável de ambiente
    const providerType = process.env.WHATSAPP_PROVIDER || 'development';

    if (provider) {
      this.provider = provider;
    } else if (providerType === 'meta') {
      this.provider = new MetaWhatsAppProvider();
    } else if (providerType === 'twilio') {
      this.provider = new TwilioWhatsAppProvider();
    } else {
      this.provider = new DevWhatsAppProvider();
    }

    console.log(`📱 WhatsApp Provider: ${this.provider.getProviderName()}`);
  }

  /**
   * Envia mensagem via WhatsApp.
   * Mensagens acima de 1600 caracteres são divididas automaticamente.
   */
  async sendMessage(to: string, message: string): Promise<boolean> {
    return (await this.sendMessageRastreado(to, message)).ok;
  }

  /**
   * Igual a sendMessage, mas devolve o SID da Twilio e, com notificacaoId,
   * pede o callback de status identificando a notificacao. Para mensagem
   * dividida, o SID e o da ultima parte.
   */
  async sendMessageRastreado(
    to: string,
    message: string,
    notificacaoId?: string,
  ): Promise<ResultadoEnvio> {
    const MAX_LENGTH = 1600;
    const url = notificacaoId ? urlCallbackStatus(process.env, notificacaoId) : null;
    const opcoes = url ? { statusCallback: url } : undefined;

    if (message.length <= MAX_LENGTH) {
      return this.normalizar(await this.provider.sendMessage(to, message, opcoes));
    }

    const parts = this.splitMessage(message, MAX_LENGTH);
    let ultimo: ResultadoEnvio = { ok: true };
    for (let i = 0; i < parts.length; i++) {
      const partLabel = `[${i + 1}/${parts.length}]\n`;
      ultimo = this.normalizar(await this.provider.sendMessage(to, partLabel + parts[i], opcoes));
      if (!ultimo.ok) return { ok: false };
      if (i < parts.length - 1) await this.sleep(1000);
    }
    return ultimo;
  }

  private normalizar(r: ResultadoEnvio | boolean): ResultadoEnvio {
    return typeof r === 'boolean' ? { ok: r } : r;
  }

  /**
   * Divide mensagem em partes respeitando quebras de linha e palavras.
   */
  private splitMessage(message: string, maxLength: number): string[] {
    // Reserva espaço para o label "[X/Y]\n"
    const reservado = 10;
    const limit = maxLength - reservado;
    const parts: string[] = [];
    let remaining = message;

    while (remaining.length > limit) {
      let cutAt = remaining.lastIndexOf('\n', limit);
      if (cutAt <= 0) cutAt = remaining.lastIndexOf(' ', limit);
      if (cutAt <= 0) cutAt = limit;
      parts.push(remaining.slice(0, cutAt).trimEnd());
      remaining = remaining.slice(cutAt).trimStart();
    }
    if (remaining.length > 0) parts.push(remaining);
    return parts;
  }

  /**
   * Retorna o nome do provider atual
   */
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  /**
   * Utilitário: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =====================================================
// SINGLETON
// =====================================================

let whatsappServiceInstance: WhatsAppService | null = null;

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappServiceInstance) {
    whatsappServiceInstance = new WhatsAppService();
  }
  return whatsappServiceInstance;
}

/**
 * Permite setar um provider customizado (útil para testes)
 */
export function setWhatsAppService(service: WhatsAppService): void {
  whatsappServiceInstance = service;
}

