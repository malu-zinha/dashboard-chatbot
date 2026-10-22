// =====================================================
// TESTE: horas e relato da noite gravados no mesmo dia (BRT)
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-data-apontamento-brt.ts
//
// registrar_retrabalho_dia gravava as horas em CURRENT_DATE, que no Supabase
// e UTC, enquanto o relato usava dataLocalBR(). Quem apontava depois das 21h
// BRT tinha as horas no dia seguinte e o relato no dia certo: 6 de 480
// apontamentos em producao (21/10/2026) cairam assim. Agora o fluxo calcula a
// data uma vez, em BRT, e manda a mesma para as horas e para o relato.
// =====================================================

import assert from 'node:assert/strict'

// Relogio congelado em 22/10 01:30 UTC = 21/10 22:30 BRT: o caso do bug.
const INSTANTE = Date.parse('2026-10-22T01:30:00Z')
const DateReal = Date
class DateCongelado extends DateReal {
  constructor(...args: any[]) {
    if (args.length === 0) super(INSTANTE)
    else super(...(args as [any]))
  }
  static now() {
    return INSTANTE
  }
}
globalThis.Date = DateCongelado as DateConstructor

const { EngineerProjectFlow } = await import('../chatbot/flows/engineerProjectFlow.ts')
const { getSupabaseService } = await import('../integrations/supabase/supabaseService.ts')

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🕘 Data do apontamento noturno em BRT\n')

// ---------------------------------------------------------------------------
// 1. O fluxo manda a mesma data (BRT) para as horas e para o relato
// ---------------------------------------------------------------------------
{
  const chamadas: { horas?: string; relato?: string } = {}
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any

  // Metodos nao listados devolvem vazio: o fluxo consulta etapas pendentes etc.
  flow.supabase = new Proxy(
    {
      registrarRetrabalho: async (...args: any[]) => {
        chamadas.horas = args[7]
        return { ok: true }
      },
      atualizarFeitoDia: async (...args: any[]) => {
        chamadas.relato = args[3]
        return { ok: true }
      },
    },
    { get: (alvo: any, prop) => (prop in alvo ? alvo[prop] : async () => []) }
  )

  flow.state = {
    step: 'horas_trabalhadas',
    stepHistory: ['escolher_acao', 'escolher_projeto_noite', 'escolher_area_noite', 'feito_dia'],
    snapshotHistory: [],
    mode: 'notif_noite',
    projectData: {},
    selectedAtribuicaoId: 'atrib-1',
    feitoTexto: 'Revisao das pranchas',
  }

  const enviar = async (m: string) => (await flow.processarMensagem(m)).mensagem
  await enviar('8') // horas trabalhadas
  await enviar('2') // sem retrabalho
  await enviar('1') // confirma e grava as horas
  await enviar('2') // sem observacoes -> grava o relato

  assert.equal(chamadas.horas, '2026-10-21', `horas foram para ${chamadas.horas}`)
  ok('horas gravadas em 21/10 (BRT), nao 22/10 (UTC)')
  assert.equal(chamadas.relato, chamadas.horas, `relato em ${chamadas.relato}, horas em ${chamadas.horas}`)
  ok('relato gravado no mesmo dia das horas')
}

// ---------------------------------------------------------------------------
// 2. O servico repassa a data para a RPC e para o upsert do relato
// ---------------------------------------------------------------------------
{
  const svc = getSupabaseService() as any
  let argsRpc: any
  let linhaRelato: any
  const cadeia: any = {
    select: () => cadeia,
    eq: () => cadeia,
    single: async () => ({ data: { eng_id: 'e', projeto_id: 'p' }, error: null }),
    upsert: async (linha: any) => {
      linhaRelato = linha
      return { error: null }
    },
    update: () => cadeia,
  }
  svc.supabase = {
    rpc: async (_nome: string, args: any) => {
      argsRpc = args
      return { data: { sucesso: true, mensagem: 'ok' }, error: null }
    },
    from: () => cadeia,
  }
  svc.connected = true

  await svc.registrarRetrabalho('atrib-1', false, undefined, undefined, undefined, 8, 0, '2026-10-21')
  assert.equal(argsRpc.p_data, '2026-10-21')
  ok('registrarRetrabalho manda p_data para registrar_retrabalho_dia')

  await svc.registrarRetrabalho('atrib-1', false, undefined, undefined, undefined, 8, 0)
  assert.equal(argsRpc.p_data, '2026-10-21', 'sem data explicita, usa o dia BRT')
  ok('sem data explicita, registrarRetrabalho usa o dia BRT (nunca o UTC)')

  await svc.atualizarFeitoDia('atrib-1', 'feito', undefined, '2026-10-20')
  assert.equal(linhaRelato.data_registro, '2026-10-20')
  ok('atualizarFeitoDia grava o relato no dia recebido')
}

globalThis.Date = DateReal
console.log(`\n✅ ${passou} verificacoes passaram\n`)
