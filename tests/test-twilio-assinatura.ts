// =====================================================
// TESTE: validacao da assinatura do webhook Twilio
// =====================================================
// Rodar com: npx tsx tests/test-twilio-assinatura.ts
//
// Os webhooks so aceitam requisicoes com X-Twilio-Signature valida: corpo
// alterado, token errado ou header ausente sao rejeitados.
// =====================================================

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import twilio from 'twilio';
import {
  assinaturaTwilioValida,
  exigeAssinaturaTwilio,
  montarUrlWebhook,
} from '../logic/security/twilioSignature.ts';

let passou = 0;
function ok(nome: string, fn: () => void) {
  fn();
  passou++;
  console.log(`   ✅ ${nome}`);
}

// Token montado por partes: nada com cara de credencial inteiro no fonte.
const TOKEN = 'tok' + 'en-de-teste-' + '1234567890';
const URL = 'https://bot.example.com/webhook/whatsapp';
const PARAMS = { From: 'whatsapp:+5583999990000', Body: 'menu', MessageSid: 'SM' + '0001' };
const assinar = (url: string, params: Record<string, string>, token = TOKEN) =>
  twilio.getExpectedTwilioSignature(token, url, params);

console.log('\n🔐 Assinatura Twilio\n');

ok('aceita assinatura calculada pelo algoritmo documentado, sem o SDK', () => {
  // Oraculo independente: HMAC-SHA1(token, URL + chaves ordenadas com seus
  // valores), em base64 — o algoritmo descrito em "Validating Signatures
  // from Twilio". Se o SDK mudar de comportamento, este caso pega.
  const dados = URL + Object.keys(PARAMS).sort().map((k) => k + PARAMS[k as keyof typeof PARAMS]).join('');
  const assinatura = createHmac('sha1', TOKEN).update(dados).digest('base64');
  assert.equal(assinaturaTwilioValida({ authToken: TOKEN, assinatura, url: URL, params: PARAMS }), true);
});

ok('assinatura correta e aceita', () => {
  assert.equal(
    assinaturaTwilioValida({ authToken: TOKEN, assinatura: assinar(URL, PARAMS), url: URL, params: PARAMS }),
    true
  );
});

ok('sem header de assinatura e rejeitado', () => {
  assert.equal(assinaturaTwilioValida({ authToken: TOKEN, assinatura: undefined, url: URL, params: PARAMS }), false);
  assert.equal(assinaturaTwilioValida({ authToken: TOKEN, assinatura: '', url: URL, params: PARAMS }), false);
});

ok('corpo alterado depois de assinado e rejeitado', () => {
  const assinatura = assinar(URL, PARAMS);
  const alterado = { ...PARAMS, From: 'whatsapp:+5583988887777' };
  assert.equal(assinaturaTwilioValida({ authToken: TOKEN, assinatura, url: URL, params: alterado }), false);
});

ok('assinado com outro token e rejeitado', () => {
  const assinatura = assinar(URL, PARAMS, 'outro-' + 'token-qualquer-123');
  assert.equal(assinaturaTwilioValida({ authToken: TOKEN, assinatura, url: URL, params: PARAMS }), false);
});

ok('sem auth token configurado rejeita em vez de aceitar', () => {
  assert.equal(
    assinaturaTwilioValida({ authToken: '', assinatura: assinar(URL, PARAMS), url: URL, params: PARAMS }),
    false
  );
});

ok('URL publica atras do proxy usa https e o host encaminhado', () => {
  // Atras do Railway o Express ve http; com trust proxy, req.protocol vira o
  // X-Forwarded-Proto. A URL tem que bater com a que o Twilio assinou.
  assert.equal(
    montarUrlWebhook({ protocol: 'https', host: 'bot.example.com', originalUrl: '/webhook/whatsapp' }),
    URL
  );
});

ok('TWILIO_WEBHOOK_BASE_URL sobrepoe protocolo e host (com ou sem barra final)', () => {
  const req = { protocol: 'http', host: 'interno:3000', originalUrl: '/webhook/whatsapp?x=1' };
  assert.equal(
    montarUrlWebhook(req, 'https://bot.example.com/'),
    'https://bot.example.com/webhook/whatsapp?x=1'
  );
  assert.equal(
    montarUrlWebhook(req, 'https://bot.example.com'),
    'https://bot.example.com/webhook/whatsapp?x=1'
  );
});

ok('validacao e exigida com provider twilio ou com auth token presente', () => {
  assert.equal(exigeAssinaturaTwilio({ WHATSAPP_PROVIDER: 'twilio' }), true);
  assert.equal(exigeAssinaturaTwilio({ TWILIO_AUTH_TOKEN: TOKEN }), true);
  assert.equal(exigeAssinaturaTwilio({ WHATSAPP_PROVIDER: 'development', TWILIO_AUTH_TOKEN: TOKEN }), true);
});

ok('so dispensa validacao em desenvolvimento puro, sem token', () => {
  assert.equal(exigeAssinaturaTwilio({ WHATSAPP_PROVIDER: 'development' }), false);
  assert.equal(exigeAssinaturaTwilio({}), false);
});

console.log(`\n✅ ${passou} verificacoes passaram\n`);
