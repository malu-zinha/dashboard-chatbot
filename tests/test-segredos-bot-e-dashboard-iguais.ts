// =====================================================
// TESTE: bot e dashboard mascaram segredos do mesmo jeito
// =====================================================
// Rodar com: npx tsx tests/test-segredos-bot-e-dashboard-iguais.ts
//
// dashboard/lib/secrets.ts e uma copia deliberada de
// logic/security/redactSecrets.ts (o tsconfig do Next nao alcanca pastas fora
// de dashboard/). O README pede "se mexer em um, mexa no outro"; este teste
// garante isso: a mesma bateria de entradas tem que sair igual dos dois.
// =====================================================

import assert from 'node:assert/strict'
import { redactSecrets as doBot } from '../logic/security/redactSecrets.ts'
import * as dashboardNs from '../dashboard/lib/secrets.ts'

const { redactSecrets: doDashboard } = ((dashboardNs as any).default ?? dashboardNs) as typeof import('../dashboard/lib/secrets.ts')

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

// Valores montados por partes: nada com cara de credencial inteiro no fonte.
const jwt = 'eyJ' + 'hbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiIxMjM0In0' + '.' + 'assinatura_falsa_123'
const entradas: unknown[] = [
  'sem segredo nenhum',
  `chave sb_${'secret'}_abcdefghij1234567890 no texto`,
  `publica sb_${'publishable'}_abcdefghij123456`,
  `token ${jwt} no meio`,
  `openai sk-${'proj'}-abcdefghijklmnopqrstuvwxyz0123`,
  `twilio AC${'0123456789abcdef0123456789abcdef'} e SK${'0123456789abcdef0123456789abcdef'}`,
  `postgres://usuario:${'senha-muito-secreta'}@db.exemplo:5432/postgres`,
  `Authorization: Bearer ${'abc.def-ghi_jkl'}`,
  `{"apikey":"${'valor-da-chave-123'}","x-api-key": "${'outra-chave'}"}`,
  new Error(`falhou com ${jwt}`),
  { headers: { Authorization: `Bearer ${'xyz123'}` }, corpo: 'ok' },
  null,
  undefined,
  42,
]

console.log('\n🔐 Mascara de segredos igual no bot e no dashboard\n')

for (const e of entradas) {
  // Error tem stack com caminho do arquivo, que difere entre os dois; compara so a primeira linha.
  const a = doBot(e).split('\n')[0]
  const b = doDashboard(e).split('\n')[0]
  assert.equal(b, a, `diferente para ${String(e).slice(0, 40)}`)
}
ok(`${entradas.length} entradas (cada tipo de segredo, Error, objeto, nulos) saem iguais`)

{
  const nome = 'TESTE_SEGREDO_' + 'API_KEY'
  process.env[nome] = 'valor-do-ambiente-' + '1234567890'
  try {
    const texto = `vazou ${process.env[nome]} no log`
    assert.equal(doDashboard(texto), doBot(texto))
    assert.ok(!doBot(texto).includes(process.env[nome]!), 'valor de variavel sensivel mascarado')
  } finally {
    delete process.env[nome]
  }
  ok('valores de variaveis de ambiente sensiveis: mascarados igual nos dois')
}

console.log(`\n${passou} casos passaram\n`)
