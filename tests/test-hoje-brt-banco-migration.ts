// =====================================================
// TESTE: migration que troca CURRENT_DATE por hoje_brt() no banco
// =====================================================
// Rodar com: npx tsx tests/test-hoje-brt-banco-migration.ts
//
// A migration recria 21 objetos copiados do baseline, trocando so
// CURRENT_DATE por public.hoje_brt(). Este teste confere isso bloco a bloco:
// qualquer outra diferenca (edicao manual, copia de versao antiga) falha. O
// rollback tem que ser o baseline sem alteracao nenhuma.
//
// Aplicado num Postgres local montado pelo baseline: a conferencia cai de 21
// objetos para 0 e o rollback volta identico (ver descricao do PR).
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const ler = (p: string) => readFileSync(p, 'utf8')
const baseline = ler('supabase/migrations/00000000_baseline.sql')
const migration = ler('supabase/migrations/20261027_hoje_brt_em_todo_o_banco.sql')
const rollback = ler('supabase/rollbacks/20261027_hoje_brt_em_todo_o_banco.rollback.sql')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

// Blocos "-- funcao: nome\n<ddl>" / "-- view: ..." como o montar-baseline escreve.
function blocos(texto: string): Map<string, string> {
  const mapa = new Map<string, string>()
  const partes = texto.split(/^(-- (?:funcao|view|default|tabela|restricao|indice|trigger|rls|policy|permissao|sequencia|sequencia_dona|tipo|extensao|privilegio_padrao): .*)$/m)
  for (let i = 1; i < partes.length; i += 2) {
    const corpo = partes[i + 1].split(/\n(?:-- -{10,}|COMMIT;)/)[0].trim()
    mapa.set(partes[i].slice(3), corpo)
  }
  return mapa
}

const doBaseline = blocos(baseline)
const daMigration = blocos(migration)
const doRollback = blocos(rollback)
const objetos = [...daMigration.keys()].filter((k) => !k.startsWith('default:'))

console.log('\n🕘 hoje_brt() em todo o banco\n')

ok('a migration cobre todas as funcoes e views do baseline que usam CURRENT_DATE', () => {
  const comCurrentDate = [...doBaseline]
    .filter(([k, v]) => /^(funcao|view):/.test(k) && v.includes('CURRENT_DATE'))
    .map(([k]) => k)
    .sort()
  assert.deepEqual(objetos.sort(), comCurrentDate)
  assert.equal(objetos.length, 19)
})

ok('cada objeto e o do baseline trocando so CURRENT_DATE por public.hoje_brt()', () => {
  for (const k of objetos) {
    assert.equal(daMigration.get(k), doBaseline.get(k)!.replaceAll('CURRENT_DATE', 'public.hoje_brt()'), k)
  }
})

ok('os dois defaults de coluna passam a hoje_brt()', () => {
  const defaults = [...daMigration].filter(([k]) => k.startsWith('default:'))
  assert.deepEqual(defaults.map(([k]) => k).sort(), ['default: projetos_previsao.data_registro', 'default: retrabalho_projetos.data_retrabalho'])
  for (const [, v] of defaults) assert.match(v, /SET DEFAULT public\.hoje_brt\(\);$/)
})

ok('fora dos comentarios, a parte executada nao tem mais CURRENT_DATE', () => {
  const executada = migration.slice(0, migration.indexOf('-- Conferencia')).replace(/^--.*$/gm, '')
  assert.doesNotMatch(executada, /CURRENT_DATE/)
  assert.match(migration, /SELECT 'public\.hoje_brt\(\)'::regprocedure;/, 'aborta se hoje_brt nao existir')
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/)
})

ok('o rollback e o baseline sem alteracao', () => {
  for (const k of objetos) assert.equal(doRollback.get(k), doBaseline.get(k), k)
  assert.match(rollback, /SET DEFAULT CURRENT_DATE;/)
})

console.log(`\n${passou} casos passaram\n`)
