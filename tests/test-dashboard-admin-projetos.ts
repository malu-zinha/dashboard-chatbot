// =====================================================
// TESTE: validacao das rotas de criar e atribuir projeto
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-admin-projetos.ts
//
// criar_projeto e dashboard_atribuir_projeto_com_pavimentos passam por
// /api/admin/*, que exige owner. Estas funcoes puras montam os argumentos da
// RPC no servidor.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import * as modNs from '../dashboard/lib/adminProjetos.ts'

const mod = ((modNs as any).default ?? modNs)

// dashboard/ e CommonJS; daqui do ESM o modulo chega como default.
const { validarCriarProjeto, montarArgsAtribuirProjeto } = mod as typeof import('../dashboard/lib/adminProjetos.ts')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

const ENG = '68161e7b-ef66-47e5-97d8-13124526e423'
const AREA = '8ca5730f-799c-4f37-8c8b-40cdac9ad8c8'
const atribuirValido = {
  codigo_projeto: 'PRJ-050',
  cliente: 'Cliente X',
  descricao: 'Obra Y',
  area_id: AREA,
  eng_id: ENG,
  complexidade: 'alta',
  data_prevista: '2026-12-01',
  pavimentos: ['Terreo', 'Tipo'],
}

console.log('\n🏗️  Criar / atribuir projeto (rotas admin)\n')

ok('criar: monta os argumentos da RPC como o cliente montava', () => {
  const r = validarCriarProjeto({ codigo: ' PRJ-051 ', cliente: 'Cliente', descricao: 'Desc' })
  assert.deepEqual(r, { ok: true, args: { p_codigo: 'PRJ-051', p_cliente: 'Cliente', p_descricao: 'Desc' } })
})

ok('criar: codigo e cliente obrigatorios', () => {
  assert.equal(validarCriarProjeto({ codigo: '', cliente: 'C', descricao: '' }).ok, false)
  assert.equal(validarCriarProjeto({ codigo: 'PRJ-1', cliente: '  ', descricao: '' }).ok, false)
  assert.equal(validarCriarProjeto(null).ok, false)
  assert.equal(validarCriarProjeto('x').ok, false)
})

ok('atribuir: mapeia complexidade e normaliza opcionais', () => {
  const r = montarArgsAtribuirProjeto(atribuirValido)
  assert.ok(r.ok)
  assert.deepEqual(r.args, {
    p_codigo_projeto: 'PRJ-050',
    p_cliente: 'Cliente X',
    p_descricao: 'Obra Y',
    p_area_id: AREA,
    p_eng_id: ENG,
    p_complexidade_codigo: 'COMPLEXA',
    p_data_conclusao_prevista: '2026-12-01',
    p_pavimentos: ['Terreo', 'Tipo'],
    p_instancia_label: null,
    p_complemento_area_ref_id: null,
  })
})

ok('atribuir: complexidade desconhecida cai em MEDIA, como antes', () => {
  const r = montarArgsAtribuirProjeto({ ...atribuirValido, complexidade: 'xyz' })
  assert.ok(r.ok)
  assert.equal(r.args.p_complexidade_codigo, 'MEDIA')
})

ok('atribuir: area_id numerico vira string (contrato da RPC)', () => {
  const r = montarArgsAtribuirProjeto({ ...atribuirValido, area_id: 7, complemento_area_ref_id: 3, instancia_label: 'Complemento 1' })
  assert.ok(r.ok)
  assert.equal(r.args.p_area_id, '7')
  assert.equal(r.args.p_complemento_area_ref_id, '3')
  assert.equal(r.args.p_instancia_label, 'Complemento 1')
})

ok('atribuir: rejeita sem codigo, cliente, area ou engenheiro', () => {
  for (const campo of ['codigo_projeto', 'cliente', 'area_id', 'eng_id']) {
    const r = montarArgsAtribuirProjeto({ ...atribuirValido, [campo]: '' })
    assert.equal(r.ok, false, campo)
  }
})

ok('atribuir: eng_id tem que ser UUID', () => {
  assert.equal(montarArgsAtribuirProjeto({ ...atribuirValido, eng_id: '1; drop' }).ok, false)
})

ok('atribuir: pavimentos so aceita lista de textos', () => {
  assert.equal(montarArgsAtribuirProjeto({ ...atribuirValido, pavimentos: 'Terreo' }).ok, false)
  assert.equal(montarArgsAtribuirProjeto({ ...atribuirValido, pavimentos: [1, 2] }).ok, false)
  const semPav = montarArgsAtribuirProjeto({ ...atribuirValido, pavimentos: undefined })
  assert.ok(semPav.ok)
  assert.deepEqual(semPav.args.p_pavimentos, [])
})

ok('codigo do navegador nao escreve no banco nem chama RPC', () => {
  // A migration 20261021_authenticated_somente_leitura tira a escrita do
  // authenticated; uma chamada nova daqui quebraria em producao. Toda escrita
  // passa por /api/admin/* (service role, so owner).
  const raiz = resolve('dashboard')
  const arquivos: string[] = []
  const varrer = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) {
        if (nome === 'node_modules' || nome === '.next' || caminho === join(raiz, 'app', 'api')) continue
        varrer(caminho)
      } else if (/\.(ts|tsx)$/.test(nome) && nome !== 'supabaseAdmin.ts') {
        arquivos.push(caminho)
      }
    }
  }
  varrer(raiz)
  assert.ok(arquivos.length > 20, 'varredura achou poucos arquivos')
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, 'utf8')
    assert.doesNotMatch(texto, /\.rpc\(/, `${arquivo} chama RPC do navegador`)
    assert.doesNotMatch(texto, /\.from\([^)]*\)\s*\.(insert|update|upsert|delete)\(/, `${arquivo} escreve em tabela do navegador`)
  }
})

console.log(`\n✅ ${passou} verificacoes passaram\n`)
