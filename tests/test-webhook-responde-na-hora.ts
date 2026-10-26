// =====================================================
// TESTE: webhook do WhatsApp responde ao Twilio na hora
// =====================================================
// Rodar com: npx tsx tests/test-webhook-responde-na-hora.ts
//
// O Twilio espera no maximo 15 s pela resposta do webhook. O servidor so
// respondia depois de processar a mensagem inteira e enviar a resposta; nas
// conversas mais lentas o Twilio desistia e registrava erro 11200. E a
// resposta era o texto "OK", que nao e TwiML: aviso 12200 em toda mensagem.
// Agora o webhook devolve TwiML vazio na hora e processa em seguida, e a
// mesma mensagem (MessageSid) nao e processada duas vezes.
// =====================================================

import assert from 'node:assert/strict'
import { criarWebhookWhatsapp, TWIML_VAZIO } from '../integrations/whatsapp/webhookWhatsapp.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

function criarRes() {
  const res: any = { statusCode: 0, corpo: undefined as unknown, tipo: '' }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.type = (t: string) => ((res.tipo = t), res)
  res.send = (b: unknown) => ((res.corpo = b), res)
  return res
}

const req = (body: Record<string, string>) => ({ body }) as any

console.log('\n📨 Webhook do WhatsApp\n')

{
  const eventos: string[] = []
  let liberar!: () => void
  const lento = new Promise<void>((r) => (liberar = r))
  const webhook = criarWebhookWhatsapp({
    processar: async (tel, msg) => {
      eventos.push(`processar ${tel} ${msg}`)
      await lento
      return { resposta: 'resposta do bot' }
    },
    enviar: async (tel, msg) => {
      eventos.push(`enviar ${tel} ${msg}`)
      return true
    },
  })

  const res = criarRes()
  const pronto = webhook(req({ From: 'whatsapp:+5583999990000', Body: 'menu', MessageSid: 'SM1' }), res)

  // Ainda processando, e o Twilio ja recebeu a resposta.
  assert.equal(res.statusCode, 200)
  assert.equal(res.corpo, TWIML_VAZIO)
  assert.match(res.tipo, /xml/)
  assert.deepEqual(eventos, ['processar +5583999990000 menu'])
  ok('responde 200 com TwiML vazio antes de terminar o processamento')

  liberar()
  await pronto
  assert.deepEqual(eventos, ['processar +5583999990000 menu', 'enviar +5583999990000 resposta do bot'])
  ok('depois processa e envia a resposta pelo WhatsApp')
}

{
  assert.match(TWIML_VAZIO, /^<\?xml[^>]*\?>\s*<Response\s*\/?>(<\/Response>)?$/)
  ok('TWIML_VAZIO e um documento TwiML valido e sem mensagem (a resposta vai pela API)')
}

{
  let processadas = 0
  const webhook = criarWebhookWhatsapp({
    processar: async () => (processadas++, { resposta: 'x' }),
    enviar: async () => true,
  })
  const corpo = { From: 'whatsapp:+5583999990000', Body: '1', MessageSid: 'SM-repetida' }
  const r1 = criarRes()
  const r2 = criarRes()
  await webhook(req(corpo), r1)
  await webhook(req(corpo), r2)
  assert.equal(processadas, 1)
  assert.equal(r2.statusCode, 200, 'a repeticao tambem recebe 200, senao o Twilio insiste')
  ok('a mesma MessageSid entregue duas vezes e processada uma vez so')
}

{
  let processadas = 0
  const webhook = criarWebhookWhatsapp({
    processar: async () => (processadas++, { resposta: 'x' }),
    enviar: async () => true,
  })
  const res = criarRes()
  await webhook(req({ From: 'whatsapp:+5583999990000', MessageSid: 'SM2' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(processadas, 0)
  ok('sem From ou Body responde 400 e nao processa')
}

{
  const erros: string[] = []
  const errorOriginal = console.error
  console.error = (...a: unknown[]) => void erros.push(a.join(' '))
  try {
    const webhook = criarWebhookWhatsapp({
      processar: async () => {
        throw new Error('banco fora')
      },
      enviar: async () => true,
    })
    const res = criarRes()
    await webhook(req({ From: 'whatsapp:+5583999990000', Body: 'oi', MessageSid: 'SM3' }), res)
    assert.equal(res.statusCode, 200)
    assert.ok(erros.some((e) => e.includes('banco fora')), 'o erro aparece no log')
  } finally {
    console.error = errorOriginal
  }
  ok('erro no processamento vai para o log e nao derruba o servidor')
}

{
  const logs: string[] = []
  const logOriginal = console.log
  const errorOriginal = console.error
  console.log = (...a: unknown[]) => void logs.push(a.join(' '))
  console.error = (...a: unknown[]) => void logs.push(a.join(' '))
  try {
    const webhook = criarWebhookWhatsapp({
      processar: async () => ({ resposta: 'x' }),
      enviar: async () => false,
    })
    await webhook(req({ From: 'whatsapp:+5583999990000', Body: 'minha senha e 1234', MessageSid: 'SM4' }), criarRes())
  } finally {
    console.log = logOriginal
    console.error = errorOriginal
  }
  const tudo = logs.join('\n')
  assert.ok(!/enviada com sucesso/i.test(tudo), 'envio que falhou nao e registrado como sucesso')
  assert.ok(/nao foi enviada/i.test(tudo), 'a falha de envio aparece no log')
  assert.ok(!tudo.includes('5583999990000'), 'o telefone completo nao vai para o log')
  assert.ok(!tudo.includes('minha senha e 1234'), 'o texto da mensagem nao vai para o log')
  ok('log sem telefone completo nem texto da mensagem, e falha de envio registrada como falha')
}

{
  let liberar!: () => void
  const lento = new Promise<void>((r) => (liberar = r))
  let enviada = false
  const webhook = criarWebhookWhatsapp({
    processar: async () => (await lento, { resposta: 'x' }),
    enviar: async () => ((enviada = true), true),
  })
  webhook(req({ From: 'whatsapp:+5583999990000', Body: '2', MessageSid: 'SM5' }), criarRes())
  let terminou = false
  const espera = webhook.aguardarEmAndamento().then(() => (terminou = true))
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(terminou, false, 'ainda tem mensagem sendo processada')
  liberar()
  await espera
  assert.equal(enviada, true)
  ok('aguardarEmAndamento espera as mensagens em processamento (desligamento no deploy)')
}

console.log(`\n${passou} casos passaram\n`)
