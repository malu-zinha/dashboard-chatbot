// =====================================================
// TESTE: sincronizacao com o Sheets opcional e sem sobreposicao
// =====================================================
// Rodar com: npx tsx tests/test-sync-sheets-opcional.ts
//
// - ENABLE_SHEETS_SYNC=false desliga a sincronizacao, e ai as variaveis do
//   Google deixam de ser obrigatorias no boot. Sem a variavel, continua ligada
//   (comportamento de hoje).
// - Uma execucao que demora nao deixa a seguinte comecar por cima.
// =====================================================

import assert from 'node:assert/strict'
import { semSobreposicao } from '../integrations/cron/semSobreposicao.ts'
import { sincronizacaoSheetsAtiva, variaveisObrigatoriasBoot } from '../integrations/cron/configSincronizacao.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📄 Sincronizacao com o Sheets\n')

assert.equal(sincronizacaoSheetsAtiva({}), true)
assert.equal(sincronizacaoSheetsAtiva({ ENABLE_SHEETS_SYNC: 'true' }), true)
assert.equal(sincronizacaoSheetsAtiva({ ENABLE_SHEETS_SYNC: 'false' }), false)
assert.equal(sincronizacaoSheetsAtiva({ ENABLE_SHEETS_SYNC: '0' }), false)
ok('ligada por padrao; ENABLE_SHEETS_SYNC=false ou 0 desliga')

assert.ok(variaveisObrigatoriasBoot({}).includes('GOOGLE_SHEETS_ENGINEER_ID'))
assert.deepEqual(variaveisObrigatoriasBoot({ ENABLE_SHEETS_SYNC: 'false' }), [])
ok('com a sincronizacao desligada, o boot nao exige as variaveis do Google')

{
  let execucoes = 0
  let liberar!: () => void
  const preso = new Promise<void>((r) => (liberar = r))
  const logOriginal = console.log
  console.log = () => {}
  try {
    const sync = semSobreposicao('teste', async () => {
      execucoes++
      await preso
    })
    const primeira = sync()
    await sync() // disparo seguinte com a primeira ainda rodando
    liberar()
    await primeira
    await sync() // depois de terminar, volta a rodar
  } finally {
    console.log = logOriginal
  }
  assert.equal(execucoes, 2)
  ok('disparo durante uma execucao em andamento e pulado; depois volta a rodar')
}

{
  let execucoes = 0
  const sync = semSobreposicao('teste', async () => {
    execucoes++
    throw new Error('falhou')
  })
  await assert.rejects(sync())
  await assert.rejects(sync())
  assert.equal(execucoes, 2)
  ok('uma execucao com erro nao trava as seguintes')
}

console.log(`\n${passou} casos passaram\n`)
