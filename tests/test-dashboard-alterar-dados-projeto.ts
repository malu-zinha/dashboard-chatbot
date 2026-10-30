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
const { validarAlterarDadosProjeto, camposAtualizacaoProjeto } = mod as typeof import('../dashboard/lib/adminProjetos.ts')

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
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'Cliente X', descricao: null }), {
    ok: true,
    dados: { cliente: 'Cliente X', descricao: null },
  })
})

ok('sem o campo descricao, a descricao nao muda (nao vira null)', () => {
  const r = validarAlterarDadosProjeto({ cliente: 'Cliente X' })
  assert.deepEqual(r, { ok: true, dados: { cliente: 'Cliente X' } })
  assert.ok(r.ok && !('descricao' in r.dados))
})

ok('cliente obrigatorio, com 2 a 200 caracteres (como no criar projeto)', () => {
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: '  ', descricao: 'xyz' }), { ok: false, error: 'Informe o cliente.' })
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: ' A ' }), {
    ok: false,
    error: 'O cliente deve ter pelo menos 2 caracteres.',
  })
  assert.equal(validarAlterarDadosProjeto({ cliente: 'AB' }).ok, true)
  assert.equal(validarAlterarDadosProjeto({ cliente: 'a'.repeat(200) }).ok, true)
  assert.equal(validarAlterarDadosProjeto({ cliente: 'a'.repeat(201) }).ok, false)
})

ok('descricao opcional; se preenchida, de 3 a 1000 caracteres (como no criar projeto)', () => {
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'CC', descricao: 'ab' }), {
    ok: false,
    error: 'A descricao deve ter pelo menos 3 caracteres.',
  })
  assert.equal(validarAlterarDadosProjeto({ cliente: 'CC', descricao: 'abc' }).ok, true)
  assert.equal(validarAlterarDadosProjeto({ cliente: 'CC', descricao: 'a'.repeat(1000) }).ok, true)
  assert.deepEqual(validarAlterarDadosProjeto({ cliente: 'CC', descricao: 'a'.repeat(1001) }), {
    ok: false,
    error: 'Descricao muito longa (max. 1000 caracteres).',
  })
})

ok('campos gravados: exatamente cliente, descricao (se veio) e updated_at', () => {
  const agora = '2026-10-30T12:00:00.000Z'
  assert.deepEqual(
    Object.keys(camposAtualizacaoProjeto({ cliente: 'CC', descricao: null }, agora)).sort(),
    ['cliente', 'descricao', 'updated_at'],
  )
  assert.deepEqual(camposAtualizacaoProjeto({ cliente: 'CC' }, agora), { cliente: 'CC', updated_at: agora })
})

ok('recusa corpo invalido e tipos errados', () => {
  for (const ruim of [null, 'x', [], {}, { cliente: 123 }, { cliente: 'CC', descricao: 5 }]) {
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
  // A escrita usa so o montador testado acima, nunca o corpo da requisicao.
  assert.match(patch, /\.update\(camposAtualizacaoProjeto\(validation\.dados, /)
  assert.doesNotMatch(patch, /codigo_projeto/)
})

console.log(`\n${passou} casos passaram\n`)
