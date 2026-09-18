import assert from 'node:assert/strict'
import {
  MOTIVOS_RETRABALHO,
  calcularPercentualRetrabalhoHoras,
  parseHorasRetrabalho,
  validarHorasRetrabalho,
} from '../chatbot/flows/engineerProjectFlow.ts'

assert.deepEqual(MOTIVOS_RETRABALHO, [
  'Falta de informação (Construtora)',
  'Alteração de projeto (Construtora)',
  'Erro de projeto (TecPred)',
  'Projeto Suspenso',
  'Erro de comunicação',
  'Outro',
])

assert.equal(calcularPercentualRetrabalhoHoras(2, 8), 25)
assert.equal(parseHorasRetrabalho('1,5'), 1.5)
assert.equal(parseHorasRetrabalho('2.25'), 2.25)

assert.deepEqual(validarHorasRetrabalho({ horasTrabalhadasTotal: 0 }), {
  valido: false,
  mensagem: 'Informe um número maior que zero para as horas trabalhadas.',
})

assert.deepEqual(validarHorasRetrabalho({ horasTrabalhadasTotal: 8, horasRetrabalho: 9 }), {
  valido: false,
  mensagem: 'As horas de retrabalho não podem ser maiores que as horas trabalhadas totais.',
})

assert.deepEqual(validarHorasRetrabalho({ horasTrabalhadasTotal: 8, horasRetrabalho: 2 }), {
  valido: true,
})

// Sem exigirHorasRetrabalho, null significa "nao informado": e assim que o passo
// horas_trabalhadas reusa a funcao para validar so o total.
assert.deepEqual(validarHorasRetrabalho({ horasTrabalhadasTotal: 8, horasRetrabalho: null }), {
  valido: true,
})

// Ja no passo retrabalho_horas, null significa "o usuario digitou algo invalido" —
// parseHorasRetrabalho devolve null para 'abc', '2h', '-1' e vazio. Sem exigir, isso
// passava e gravava um retrabalho com horas nulas.
for (const entradaInvalida of ['abc', '', '  ', '2h', '-1']) {
  assert.equal(parseHorasRetrabalho(entradaInvalida), null)
  assert.deepEqual(
    validarHorasRetrabalho({
      horasTrabalhadasTotal: 8,
      horasRetrabalho: parseHorasRetrabalho(entradaInvalida),
      exigirHorasRetrabalho: true,
    }),
    {
      valido: false,
      mensagem: 'Informe um número maior que zero para as horas de retrabalho.',
    }
  )
}

assert.deepEqual(
  validarHorasRetrabalho({
    horasTrabalhadasTotal: 8,
    horasRetrabalho: 2,
    exigirHorasRetrabalho: true,
  }),
  { valido: true }
)

console.log('test-retrabalho-chatbot-horas: OK')
