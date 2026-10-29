// =====================================================
// TESTE: regras do status de entrega do WhatsApp
// =====================================================
// Rodar com: npx tsx tests/test-status-entrega-whatsapp.ts
//
// Regras puras que decidem se um callback de status da Twilio deve ser
// gravado: ordem enviado < sent < delivered < read, failed/undelivered sao
// finais, intermediarios e desconhecidos sao ignorados.
// =====================================================

import assert from 'node:assert/strict'
import { proximoStatusEntrega, motivoFalha } from '../integrations/whatsapp/statusEntrega.ts'
import { urlCallbackStatus, WhatsAppService } from '../integrations/whatsapp/whatsappService.ts'
import { NotificationWorker } from '../integrations/notifications/notificationWorker.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📬 Status de entrega do WhatsApp\n')

{
  assert.equal(proximoStatusEntrega(null, 'sent'), 'sent')
  assert.equal(proximoStatusEntrega('enviado', 'delivered'), 'delivered')
  ok('avanca na ordem')
}

{
  assert.equal(proximoStatusEntrega('delivered', 'sent'), null)
  assert.equal(proximoStatusEntrega('read', 'delivered'), null)
  ok('fora de ordem nao rebaixa')
}

{
  assert.equal(proximoStatusEntrega('sent', 'undelivered'), 'undelivered')
  assert.equal(proximoStatusEntrega('failed', 'delivered'), null)
  ok('status final grava e nunca e sobrescrito')
}

{
  assert.equal(proximoStatusEntrega('enviado', 'queued'), null)
  assert.equal(proximoStatusEntrega('enviado', 'accepted'), null)
  assert.equal(proximoStatusEntrega('enviado', 'sending'), null)
  assert.equal(proximoStatusEntrega('enviado', 'qualquer'), null)
  ok('intermediarios e desconhecidos sao ignorados')
}

{
  assert.equal(motivoFalha('63016'), 'não fala com o bot há mais de 24h')
  assert.equal(motivoFalha('30008'), 'não entregue (código 30008)')
  assert.equal(motivoFalha(null), 'não entregue')
  ok('motivo da falha')
}

// ---------- URL do callback e envio Twilio ----------

{
  assert.equal(
    urlCallbackStatus({ TWILIO_WEBHOOK_BASE_URL: 'https://bot.exemplo.test/' }, 'n1'),
    'https://bot.exemplo.test/webhook/status?notificacao=n1',
  )
  assert.equal(
    urlCallbackStatus({ RAILWAY_PUBLIC_DOMAIN: 'bot.up.railway.app' }, 'n1'),
    'https://bot.up.railway.app/webhook/status?notificacao=n1',
  )
  assert.equal(urlCallbackStatus({}, 'n1'), null)
  ok('url do callback de status')
}

const silenciar = () => {
  const o = { log: console.log, error: console.error, warn: console.warn }
  console.log = () => {}
  console.error = () => {}
  console.warn = () => {}
  return () => Object.assign(console, o)
}

// Envia uma mensagem pelo provider Twilio com fetch falso; devolve resultado e corpos enviados.
async function enviarPeloTwilio(
  envExtra: Record<string, string | undefined>,
  texto: string,
  notificacaoId?: string,
) {
  const chaves = [
    'WHATSAPP_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
    'TWILIO_WEBHOOK_BASE_URL', 'RAILWAY_PUBLIC_DOMAIN',
  ]
  const envAntes: Record<string, string | undefined> = {}
  for (const k of chaves) envAntes[k] = process.env[k]
  const fetchAntes = globalThis.fetch
  const corpos: string[] = []
  const restaurar = silenciar()
  try {
    for (const k of chaves) delete process.env[k]
    Object.assign(process.env, {
      WHATSAPP_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'ACfake',
      TWILIO_AUTH_TOKEN: 'tokenfake',
      TWILIO_PHONE_NUMBER: '+15550000000',
    })
    for (const [k, v] of Object.entries(envExtra)) if (v !== undefined) process.env[k] = v
    let n = 0
    globalThis.fetch = (async (_url: unknown, init: any) => {
      corpos.push(String(init.body))
      n++
      return { ok: true, json: async () => ({ sid: `SM${n}` }) }
    }) as any
    const svc = new WhatsAppService()
    ;(svc as any).sleep = async () => {}
    const resultado = await svc.sendMessageRastreado('+5583900000000', texto, notificacaoId)
    return { resultado, corpos }
  } finally {
    restaurar()
    globalThis.fetch = fetchAntes
    for (const k of chaves) {
      if (envAntes[k] === undefined) delete process.env[k]
      else process.env[k] = envAntes[k]
    }
  }
}

{
  const { resultado, corpos } = await enviarPeloTwilio({ TWILIO_WEBHOOK_BASE_URL: 'https://bot.exemplo.test' }, 'oi', 'n1')
  assert.deepEqual(resultado, { ok: true, sid: 'SM1' })
  assert.equal(
    new URLSearchParams(corpos[0]).get('StatusCallback'),
    'https://bot.exemplo.test/webhook/status?notificacao=n1',
  )
  ok('envio Twilio pede o callback')
}

{
  const semBase = await enviarPeloTwilio({}, 'oi', 'n1')
  assert.equal(new URLSearchParams(semBase.corpos[0]).get('StatusCallback'), null)
  const semId = await enviarPeloTwilio({ TWILIO_WEBHOOK_BASE_URL: 'https://bot.exemplo.test' }, 'oi')
  assert.equal(new URLSearchParams(semId.corpos[0]).get('StatusCallback'), null)
  ok('sem base ou sem id da notificacao, nao pede callback')
}

{
  const longa = ('linha de texto razoavelmente comprida\n').repeat(100) // > 1600
  const { resultado, corpos } = await enviarPeloTwilio({ TWILIO_WEBHOOK_BASE_URL: 'https://bot.exemplo.test' }, longa, 'n1')
  assert.ok(corpos.length >= 2)
  assert.deepEqual(resultado, { ok: true, sid: `SM${corpos.length}` })
  ok('mensagem dividida devolve o SID da ultima parte')
}

{
  const rest = silenciar()
  const bool = new WhatsAppService({ sendMessage: async () => true, getProviderName: () => 'x' } as any)
  const falha = new WhatsAppService({ sendMessage: async () => false, getProviderName: () => 'x' } as any)
  rest()
  assert.deepEqual(await bool.sendMessageRastreado('+5583900000000', 'oi'), { ok: true })
  assert.equal(await bool.sendMessage('+5583900000000', 'oi'), true)
  assert.equal(await falha.sendMessage('+5583900000000', 'oi'), false)
  ok('provider que devolve boolean continua valendo; sendMessage devolve boolean')
}

// ---------- Worker ----------

interface Linha {
  notificacao_id: string
  eng_id: string
  telefone: string | null
  tipo: string
  titulo: string
  mensagem: string
  tentativas: number
  enviada: boolean
  data_envio?: string
  twilio_sid?: string
  status_entrega?: string | null
  created_at: string
}

interface OptsBanco {
  falharGravarSid?: boolean
  falharMarcarEnviada?: boolean
  aposSelect?: (linhas: Linha[]) => void
}

// Banco falso: filtros eq/lt/not-is-null, update que devolve linhas com .select(), erro injetavel.
function criarBanco(linhas: Linha[], opts: OptsBanco = {}) {
  const banco = { linhas, updates: [] as Array<Partial<Linha>> }
  const client = {
    from(_tabela: string) {
      let op: 'select' | 'update' = 'select'
      let valores: Partial<Linha> = {}
      const filtros: Array<(l: Linha) => boolean> = []
      let limite = Infinity
      const q: any = {
        select: () => q,
        update: (v: Partial<Linha>) => ((op = 'update'), (valores = v), q),
        eq: (c: keyof Linha, v: unknown) => (filtros.push((l) => l[c] === v), q),
        lt: (c: keyof Linha, v: any) => (filtros.push((l) => (l[c] as any) < v), q),
        is: (c: keyof Linha, v: unknown) => (filtros.push((l) => (l[c] ?? null) === v), q),
        not: (c: keyof Linha, operador: string, v: unknown) => {
          assert.equal(operador, 'is')
          filtros.push((l) => (l[c] === v ? false : true))
          return q
        },
        order: () => q,
        limit: (n: number) => ((limite = n), q),
        then(resolve: (r: unknown) => void) {
          const alvo = banco.linhas.filter((l) => filtros.every((f) => f(l)))
          if (op === 'select') {
            const lidas = alvo.slice(0, limite).map((l) => ({ ...l }))
            opts.aposSelect?.(banco.linhas)
            return resolve({ data: lidas, error: null })
          }
          banco.updates.push(valores)
          if (opts.falharMarcarEnviada && valores.enviada === true) {
            return resolve({ data: null, error: { message: 'falha simulada ao marcar enviada' } })
          }
          if (opts.falharGravarSid && 'twilio_sid' in valores) {
            return resolve({ data: null, error: { message: 'falha simulada ao gravar sid' } })
          }
          for (const l of alvo) Object.assign(l, valores)
          return resolve({ data: alvo.map((l) => ({ ...l })), error: null })
        },
      }
      return q
    },
  }
  return { banco, client }
}

function linha(id: string, extra: Partial<Linha> = {}): Linha {
  return {
    notificacao_id: id,
    eng_id: 'e1',
    telefone: '+5583900000000',
    tipo: 'atribuicao',
    titulo: 't',
    mensagem: `msg ${id}`,
    tentativas: 0,
    enviada: false,
    created_at: '2026-10-26T00:00:00Z',
    ...extra,
  }
}

function criarWorker(client: unknown, enviar: (to: string, msg: string, id?: string) => Promise<{ ok: boolean; sid?: string }>) {
  const rest = silenciar()
  const w: any = new NotificationWorker({ sendMessageRastreado: enviar } as any)
  rest()
  w.supabaseService = { getClient: () => client }
  w.sleep = async () => {}
  return w as NotificationWorker
}

async function rodar(w: NotificationWorker, vezes = 1) {
  const restaurar = silenciar()
  try {
    for (let i = 0; i < vezes; i++) await w.processarNotificacoesPendentes()
  } finally {
    restaurar()
  }
}

{
  const { banco, client } = criarBanco([linha('n1')])
  await rodar(criarWorker(client, async () => ({ ok: true, sid: 'SM1' })))
  const l = banco.linhas[0]
  assert.equal(l.enviada, true)
  assert.equal(l.twilio_sid, 'SM1')
  assert.equal(l.status_entrega, 'enviado')
  ok('grava o SID depois de marcar enviada')
}

{
  const { banco, client } = criarBanco([linha('n1')], { falharGravarSid: true })
  let envios = 0
  await rodar(criarWorker(client, async () => (envios++, { ok: true, sid: 'SM1' })), 2)
  assert.equal(envios, 1)
  assert.equal(banco.linhas[0].enviada, true)
  ok('falha ao gravar o SID nao reenvia')
}

{
  const { banco, client } = criarBanco([linha('n1')])
  await rodar(criarWorker(client, async () => ({ ok: true })))
  assert.ok(banco.updates.every((u) => !('twilio_sid' in u)))
  assert.equal(banco.linhas[0].enviada, true)
  ok('sem SID nao tenta gravar')
}

{
  const { banco, client } = criarBanco([linha('n1', { telefone: null })])
  let envios = 0
  await rodar(criarWorker(client, async () => (envios++, { ok: true, sid: 'SM1' })))
  assert.equal(envios, 0)
  assert.equal(banco.linhas[0].tentativas, 0)
  ok('pula telefone nulo')
}

{
  // O prazo muda de novo entre o SELECT do worker e a reserva: sai o texto atual.
  let mexeu = false
  const { client } = criarBanco([linha('n1', { tipo: 'prazo_alterado', mensagem: 'texto velho' })], {
    aposSelect: (linhas) => {
      if (mexeu) return
      mexeu = true
      linhas[0].mensagem = 'texto novo'
    },
  })
  const enviados: string[] = []
  await rodar(criarWorker(client, async (_to, msg) => (enviados.push(msg), { ok: true, sid: 'SM1' })))
  assert.deepEqual(enviados, ['texto novo'])
  ok('envia a mensagem atual devolvida pela reserva, nao a lida antes')
}

{
  // O callback da Twilio chegou antes do update do SID: status final nao e sobrescrito.
  const { banco, client } = criarBanco([linha('n1', { status_entrega: 'undelivered' })])
  await rodar(criarWorker(client, async () => ({ ok: true, sid: 'SM1' })))
  assert.equal(banco.linhas[0].status_entrega, 'undelivered')
  assert.equal(banco.linhas[0].enviada, true)
  ok('nao sobrescreve o status que o callback ja gravou')
}

{
  const { banco, client } = criarBanco([linha('n1')], { falharMarcarEnviada: true })
  await rodar(criarWorker(client, async () => ({ ok: true, sid: 'SM1' })))
  assert.ok(banco.updates.every((u) => !('twilio_sid' in u)))
  ok('falha ao marcar enviada: nao tenta gravar o SID')
}

console.log(`\n${passou} casos passaram\n`)
