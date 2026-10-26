// =====================================================
// TESTE: o baseline nao leva segredo nem dado pessoal para o repo
// =====================================================
// Rodar com: npx tsx tests/test-baseline-sem-segredos.ts
//
// O repositorio e publico. O baseline e exportado do banco de producao e
// traz o corpo de todas as funcoes: uma chave ou telefone escrito dentro de
// uma funcao iria junto. Este teste barra isso a cada nova exportacao.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const baseline = readFileSync('supabase/migrations/00000000_baseline.sql', 'utf8')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🔒 Baseline sem segredos\n')

ok('sem chave, token ou senha', () => {
  for (const padrao of [/eyJ[A-Za-z0-9_-]{20,}/, /sb_(secret|publishable)_/, /sk-[A-Za-z0-9-]{20,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/, /password\s*[:=]/i]) {
    assert.doesNotMatch(baseline, padrao, String(padrao))
  }
})

ok('sem telefone, email ou URL', () => {
  assert.doesNotMatch(baseline, /\+?55\d{10,11}/, 'telefone')
  assert.doesNotMatch(baseline, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'email')
  assert.doesNotMatch(baseline, /https?:\/\//, 'url')
})

ok('sem UUID fixo alem do nulo', () => {
  const uuids = new Set(baseline.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? [])
  uuids.delete('00000000-0000-0000-0000-000000000000')
  assert.deepEqual([...uuids], [])
})

console.log(`\n${passou} casos passaram\n`)
