// =====================================================
// TESTE: alterar cliente e descricao de um projeto pelo dashboard
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-alterar-dados-projeto.ts
//
// O botao "Alterar dados" da tabela de projetos abre um menu com cliente e
// descricao (do projeto inteiro), prazo e engenheiro (da tarefa). Cliente e
// descricao passam por PATCH /api/admin/projetos/[id], so do dono, que grava
// direto em projetos com o cliente service role. Aqui: a validacao do corpo
// e uma checagem estatica da rota (guarda antes da escrita, so projeto ativo,
// so os campos permitidos — nunca o codigo).
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as modNs from '../dashboard/lib/adminProjetos.ts'

const mod = ((modNs as any).default ?? modNs)

// dashboard/ e CommonJS; daqui do ESM o modulo chega como default.
const { validarAlterarDadosProjeto } = mod as typeof import('../dashboard/lib/adminProjetos.ts')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n✏️  Alterar dados do projeto\n')

ok('apara o cliente e a descricao; descricao vazia vira null', () => {
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: '  Cliente X ', descricao: ' Obra Y ' }), {
    ok: true,
    dados: { cliente: 'Cliente X', descricao: 'Obra Y' },
  })
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'Cliente X', descricao: '   ' }), {
    ok: true,
    dados: { cliente: 'Cliente X', descricao: null },
  })
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'Cliente X' }), {
    ok: true,
    dados: { cliente: 'Cliente X', descricao: null },
  })
})

ok('cliente obrigatorio e com no maximo 200 caracteres', () => {
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: '  ', descricao: 'x' }), { ok: false, error: 'Informe o cliente.' })
  assert.equal(validarAlterarDadosProjeto({ cliente: 'a'.repeat(200) }).ok, true)
  assert.equal(validarAlterarDadosProjeto({ cliente: 'a'.repeat(201) }).ok, false)
})

ok('descricao com no maximo 1000 caracteres', () => {
  assert.equal(validarAlterarDadosProjeto({ cliente: 'C', descricao: 'a'.repeat(1000) }).ok, true)
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'C', descricao: 'a'.repeat(1001) }), {
    ok: false,
    error: 'Descricao muito longa (max. 1000 caracteres).',
  })
})

ok('recusa corpo invalido e tipos errados', () => {
  for (const ruim of [null, 'x', [], {}, { cliente: 123 }, { cliente: 'C', descricao: 5 }]) {
    assert.equal(validarAlterarDadosProjeto(ruim).ok, false, JSON.stringify(ruim))
  }
})

ok('rota PATCH: so dono, so projeto ativo, so cliente/descricao/updated_at', () => {
  const rota = readFileSync('dashboard/app/api/admin/projetos/[id]/route.ts', 'utf8')
  const patch = rota.slice(rota.indexOf('export async function PATCH'))
  assert.ok(patch.length > 0 && rota.includes('export async function PATCH'), 'rota PATCH existe')
  const guarda = patch.indexOf('guardOwnerRoute()')
  const escrita = patch.indexOf('.update(')
  assert.ok(guarda >= 0 && escrita > guarda, 'guardOwnerRoute antes da escrita')
  assert.ok(patch.indexOf('validarAlterarDadosProjeto') < escrita, 'valida antes de gravar')
  assert.match(patch, /\.eq\('ativo', true\)/)
  const campos = patch.slice(escrita, patch.indexOf(')', patch.indexOf('}', escrita)))
  assert.match(campos, /cliente/)
  assert.match(campos, /descricao/)
  assert.match(campos, /updated_at/)
  assert.doesNotMatch(patch, /codigo_projeto/)
})

console.log(`\n${passou} casos passaram\n`)
