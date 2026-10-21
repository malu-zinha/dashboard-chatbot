// =====================================================
// SEGURANCA: assinatura do webhook Twilio
// =====================================================
// O Twilio assina cada POST com HMAC-SHA1 da URL publica + parametros,
// usando o Auth Token da conta (header X-Twilio-Signature). Conferir isso
// garante que a requisicao veio do Twilio e que o corpo nao foi alterado.
//
// Funcoes puras, sem I/O: o middleware em src/server-twilio.ts so monta
// os argumentos a partir do request.
// =====================================================

import twilio from 'twilio';

export interface ArgsAssinatura {
  authToken: string | undefined;
  assinatura: string | undefined;
  url: string;
  params: Record<string, unknown>;
}

/**
 * Sem token ou sem assinatura, rejeita: na duvida, a requisicao nao entra.
 */
export function assinaturaTwilioValida({ authToken, assinatura, url, params }: ArgsAssinatura): boolean {
  if (!authToken || !assinatura) return false;
  return twilio.validateRequest(authToken, assinatura, url, params);
}

export interface RequestUrlParts {
  protocol: string;
  host: string | undefined;
  originalUrl: string;
}

/**
 * A URL tem que ser identica a configurada no console do Twilio. Atras do
 * proxy do Railway o Express ve http e um host interno, entao o servidor
 * liga trust proxy; TWILIO_WEBHOOK_BASE_URL fica como saida quando o host
 * encaminhado nao bate com o configurado (dominio proprio, por exemplo).
 */
export function montarUrlWebhook(req: RequestUrlParts, baseOverride?: string): string {
  if (baseOverride) return baseOverride.replace(/\/+$/, '') + req.originalUrl;
  return `${req.protocol}://${req.host}${req.originalUrl}`;
}

/**
 * Exigida sempre que ha Twilio de verdade em jogo. So o desenvolvimento local
 * puro (sem provider twilio e sem token) dispensa, para testar com curl.
 */
export function exigeAssinaturaTwilio(env: Record<string, string | undefined>): boolean {
  return env.WHATSAPP_PROVIDER === 'twilio' || Boolean(env.TWILIO_AUTH_TOKEN);
}
