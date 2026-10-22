// =====================================================
// TESTE: limite de horas por dia no apontamento noturno
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-limite-horas.ts
//
// Em producao (21/10/2026) havia 15 apontamentos acima de 12h num dia (20,
// 30, 32, 40, 80h), dois deles depois da tela de confirmacao. A confirmacao
// mostrava o numero, mas nao barrava nem chamava atencao. Agora: acima de 16h
// e recusado; entre 12h e 16h o resumo avisa antes do "1". O banco ganha um
// CHECK de 24h (NOT VALID: os registros antigos ficam como estao).
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  EngineerProjectFlow,
  HORAS_ALERTA_DIA,
  HORAS_MAXIMAS_DIA,
  formatarResumoHoras,
  validarHorasRetrabalho,
} from '../chatbot/flows/engineerProjectFlow.ts'

let passou = 0
function ok(nome: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => {
    passou++
    console.log(`   ✅ ${nome}`)
  })
}

console.log('\n⏱️  Limite de horas por dia\n')

await ok('limites: alerta acima de 12h, recusa acima de 16h', () => {
  assert.equal(HORAS_ALERTA_DIA, 12)
  assert.equal(HORAS_MAXIMAS_DIA, 16)
})

await ok('16h e aceito; 16,5h e 80h sao recusados', () => {
  assert.deepEqual(validarHorasRetrabalho({ horasTrabalhadasTotal: 16 }), { valido: true })
  for (const h of [16.5, 20, 80]) {
    const r = validarHorasRetrabalho({ horasTrabalhadasTotal: h })
    assert.equal(r.valido, false, `${h}h deveria ser recusado`)
    if (!r.valido) assert.match(r.mensagem, /16h/)
  }
})

await ok('resumo avisa acima de 12h e nao avisa ate 12h', () => {
  assert.doesNotMatch(formatarResumoHoras({ horasTrabalhadasTotal: 12 }), /confira/i)
  assert.match(formatarResumoHoras({ horasTrabalhadasTotal: 13 }), /Mais de 12h[\s\S]*confira/i)
  assert.match(
    formatarResumoHoras({ horasTrabalhadasTotal: 14, teveRetrabalho: true, motivoRetrabalho: 'Outro', horasRetrabalho: 2 }),
    /Mais de 12h/
  )
})

await ok('no fluxo, 80 nao chega a confirmacao e nada e gravado', async () => {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any
  let gravacoes = 0
  flow.supabase = new Proxy(
    { registrarRetrabalho: async () => { gravacoes++; return { ok: true } } },
    { get: (alvo: any, prop) => (prop in alvo ? alvo[prop] : async () => []) }
  )
  flow.state = {
    step: 'horas_trabalhadas',
    stepHistory: ['escolher_acao', 'escolher_projeto_noite', 'escolher_area_noite', 'feito_dia'],
    snapshotHistory: [],
    mode: 'notif_noite',
    projectData: {},
    selectedAtribuicaoId: 'atrib-1',
    feitoTexto: 'x',
  }
  const resposta = (await flow.processarMensagem('80')).mensagem
  assert.equal(flow.state.step, 'horas_trabalhadas')
  assert.match(resposta, /16h/)
  assert.equal(gravacoes, 0)
})

await ok('migration: CHECK de 24h NOT VALID e a RPC recusa acima de 24h', () => {
  const sql = readFileSync('supabase/migrations/20261023_retrabalho_dia_brt_e_limite_horas.sql', 'utf8')
    .replace(/--.*$/gm, '')
  assert.match(sql, /horas_trabalhadas_total <= 24[\s\S]*?NOT VALID/)
  assert.match(sql, /p_horas_trabalhadas_total > 24/)
})

console.log(`\n✅ ${passou} verificacoes passaram\n`)
