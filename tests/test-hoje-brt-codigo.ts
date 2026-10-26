// =====================================================
// TESTE: "hoje" no codigo do bot e o dia de Brasilia
// =====================================================
// Rodar com: npx tsx tests/test-hoje-brt-codigo.ts
//
// O servidor do Railway roda em UTC. new Date().toISOString().split('T')[0]
// devolve o dia UTC: a partir das 21h de Brasilia ja e o dia seguinte. O dono
// que respondia "hoje" na data de inicio de uma distribuicao, as 22h,
// gravava o dia de amanha. Agora todo "hoje" usa dataLocalBR().
//
// O relogio e fixado em 27/10/2026 02:30 UTC = 26/10/2026 23:30 em Brasilia.
// =====================================================

import assert from 'node:assert/strict'

const AGORA = Date.parse('2026-10-27T02:30:00Z')
const DateReal = Date
class DateFixa extends DateReal {
  constructor(...args: any[]) {
    if (args.length === 0) super(AGORA)
    else super(...(args as [any]))
  }
  static now() {
    return AGORA
  }
}
globalThis.Date = DateFixa as DateConstructor

const { OwnerFlow } = await import('../chatbot/flows/ownerFlow.ts')
const { validateExecution, validateRework } = await import('../logic/validation/validateInput.ts')
const { projectCompletion } = await import('../logic/execucao/calculateProgress.ts')

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const HOJE_BRT = '2026-10-26'

console.log('\n🕘 "Hoje" no fuso de Brasilia (23:30 BRT, ja 02:30 UTC do dia seguinte)\n')

{
  const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
  assert.equal(owner.parsearData('hoje'), HOJE_BRT)
  ok('dono responde "hoje" numa data: grava o dia de Brasilia')
}

{
  const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
  const logOriginal = console.log
  console.log = () => {}
  try {
    await owner.stepDistDataInicio('hoje')
  } finally {
    console.log = logOriginal
  }
  assert.equal(owner.contexto.dist_data_inicio, HOJE_BRT)
  ok('distribuicao com inicio "hoje": dia de Brasilia')
}

{
  assert.equal(validateExecution({ projeto_id: 'p1', percentual_realizado: 10 } as any).dados_normalizados?.data, HOJE_BRT)
  assert.equal(validateRework({ projeto_id: 'p1', motivo: 'erro de projeto', descricao: 'parede fora do lugar no pavimento 2' } as any).dados_normalizados?.data, HOJE_BRT)
  ok('validacao sem data usa o dia de Brasilia')
}

{
  assert.equal(projectCompletion(50, 10).data_conclusao_estimada, '2026-10-31')
  ok('projecao de conclusao conta a partir do dia de Brasilia (+5 dias)')
}

globalThis.Date = DateReal
console.log(`\n${passou} casos passaram\n`)
process.exit(0)
