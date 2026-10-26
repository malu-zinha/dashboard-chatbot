// =====================================================
// TESTE: worker de notificacoes nao envia a mesma notificacao duas vezes
// =====================================================
// Rodar com: npx tsx tests/test-worker-notificacao-sem-duplicar.ts
//
// O worker roda a cada minuto. Antes:
// - uma rodada lenta (envio preso) se sobrepunha a seguinte, e as duas
//   pegavam as mesmas notificacoes pendentes;
// - o "marcar como enviada" nao era conferido: se falhasse, a notificacao
//   continuava pendente e saia de novo no minuto seguinte;
// - duas instancias do servidor (troca de container no deploy) pegavam as
//   mesmas linhas.
// Agora cada notificacao e reservada antes do envio (update condicionado ao
// numero de tentativas lido) e so quem reservou envia.
// =====================================================

import assert from 'node:assert/strict'
import { NotificationWorker } from '../integrations/notifications/notificationWorker.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

interface Linha {
  notificacao_id: string
  eng_id: string
  telefone: string
  tipo: string
  titulo: string
  mensagem: string
  tentativas: number
  enviada: boolean
  data_envio?: string
  created_at: string
}

// Banco falso com a semantica que importa: filtros eq/lt, update que devolve
// as linhas alteradas com .select(), e erro injetavel no update.
function criarBanco(linhas: Linha[], opts: { falharMarcarEnviada?: boolean } = {}) {
  const banco = { linhas, updates: 0 }
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
        order: () => q,
        limit: (n: number) => ((limite = n), q),
        then(resolve: (r: unknown) => void) {
          const alvo = banco.linhas.filter((l) => filtros.every((f) => f(l)))
          if (op === 'select') return resolve({ data: alvo.slice(0, limite).map((l) => ({ ...l })), error: null })
          if (opts.falharMarcarEnviada && valores.enviada === true) {
            return resolve({ data: null, error: { message: 'falha simulada ao marcar enviada' } })
          }
          banco.updates++
          for (const l of alvo) Object.assign(l, valores)
          return resolve({ data: alvo.map((l) => ({ ...l })), error: null })
        },
      }
      return q
    },
  }
  return { banco, client }
}

function linha(id: string, tentativas = 0): Linha {
  return {
    notificacao_id: id,
    eng_id: 'e1',
    telefone: '+5583999990000',
    tipo: 'atribuicao',
    titulo: 't',
    mensagem: `msg ${id}`,
    tentativas,
    enviada: false,
    created_at: '2026-10-26T00:00:00Z',
  }
}

function criarWorker(client: unknown, enviar: (to: string, msg: string) => Promise<boolean>) {
  const w: any = new NotificationWorker({ sendMessage: enviar } as any)
  w.supabaseService = { getClient: () => client }
  w.sleep = async () => {}
  return w as NotificationWorker
}

const silenciar = () => {
  const o = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = () => {}
  return () => Object.assign(console, o)
}

console.log('\n📬 Worker de notificacoes\n')

{
  const { banco, client } = criarBanco([linha('n1'), linha('n2')])
  const enviados: string[] = []
  const w = criarWorker(client, async (_to, msg) => (enviados.push(msg), true))
  const restaurar = silenciar()
  try {
    await w.processarNotificacoesPendentes()
  } finally {
    restaurar()
  }
  assert.deepEqual(enviados, ['msg n1', 'msg n2'])
  assert.ok(banco.linhas.every((l) => l.enviada && l.tentativas === 1 && l.data_envio))
  ok('envia as pendentes e marca como enviadas, com 1 tentativa')
}

{
  // Rodada lenta: o primeiro envio so termina depois que a segunda rodada ja comecou.
  const { client } = criarBanco([linha('n1')])
  const enviados: string[] = []
  let liberar!: () => void
  const preso = new Promise<void>((r) => (liberar = r))
  const w = criarWorker(client, async (_to, msg) => {
    enviados.push(msg)
    await preso
    return true
  })
  const restaurar = silenciar()
  try {
    const primeira = w.processarNotificacoesPendentes()
    await new Promise((r) => setTimeout(r, 10))
    await w.processarNotificacoesPendentes() // minuto seguinte, a primeira ainda rodando
    liberar()
    await primeira
  } finally {
    restaurar()
  }
  assert.deepEqual(enviados, ['msg n1'])
  ok('rodada nova nao comeca enquanto a anterior ainda esta enviando')
}

{
  // Duas instancias leem a mesma linha pendente; so uma consegue reservar.
  const { banco, client } = criarBanco([linha('n1')])
  const enviados: string[] = []
  const enviar = async (_to: string, msg: string) => (enviados.push(msg), true)
  const a = criarWorker(client, enviar)
  const b = criarWorker(client, enviar)
  const restaurar = silenciar()
  try {
    await Promise.all([a.processarNotificacoesPendentes(), b.processarNotificacoesPendentes()])
  } finally {
    restaurar()
  }
  assert.deepEqual(enviados, ['msg n1'])
  assert.equal(banco.linhas[0].tentativas, 1)
  ok('duas instancias ao mesmo tempo: a notificacao sai uma vez so')
}

{
  const { banco, client } = criarBanco([linha('n1')])
  const w = criarWorker(client, async () => false)
  const restaurar = silenciar()
  try {
    await w.processarNotificacoesPendentes()
  } finally {
    restaurar()
  }
  assert.equal(banco.linhas[0].enviada, false)
  assert.equal(banco.linhas[0].tentativas, 1)
  ok('envio recusado: continua pendente e conta a tentativa')
}

{
  const { banco, client } = criarBanco([linha('n1')], { falharMarcarEnviada: true })
  const w = criarWorker(client, async () => true)
  const erros: string[] = []
  const o = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = (...a: unknown[]) => void erros.push(a.join(' '))
  try {
    await w.processarNotificacoesPendentes()
  } finally {
    Object.assign(console, o)
  }
  assert.ok(erros.some((e) => /n1/.test(e) && /enviada/i.test(e)), 'falha ao marcar aparece no log com o id')
  assert.equal(banco.linhas[0].tentativas, 1, 'a tentativa ja ficou registrada na reserva')
  ok('falha ao marcar como enviada aparece no log, em vez de passar calada')
}

{
  const { client } = criarBanco([linha('n1')])
  const logs: string[] = []
  const o = { log: console.log, error: console.error }
  console.log = (...a: unknown[]) => void logs.push(a.join(' '))
  console.error = (...a: unknown[]) => void logs.push(a.join(' '))
  try {
    await criarWorker(client, async () => true).processarNotificacoesPendentes()
  } finally {
    Object.assign(console, o)
  }
  assert.ok(!logs.join('\n').includes('5583999990000'), 'telefone completo fora do log')
  ok('log sem o telefone completo')
}

console.log(`\n${passou} casos passaram\n`)
