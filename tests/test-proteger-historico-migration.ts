// =====================================================
// TESTE: migration que impede apagar historico em cascata
// =====================================================
// Rodar com: npx tsx tests/test-proteger-historico-migration.ts
//
// Le o SQL como texto. Confere que migration e rollback mexem nas mesmas
// cinco chaves, que o baseline mostra essas chaves em CASCADE (o estado de
// antes) e que a limpeza de projetos antigos apaga os filhos antes do
// projeto — senao ela quebraria com RESTRICT.
//
// O comportamento foi testado num Postgres local montado pelo baseline
// (apagar atribuicao com horas: antes apagava, agora e barrado; a limpeza
// continua funcionando); ver a descricao do PR da Onda 3.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20261026_proteger_historico_contra_exclusao.sql', 'utf8')
const rollback = readFileSync('supabase/rollbacks/20261026_proteger_historico_contra_exclusao.rollback.sql', 'utf8')
const baseline = readFileSync('supabase/migrations/00000000_baseline.sql', 'utf8')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

const chaves = (texto: string, regra: string) =>
  [...texto.matchAll(new RegExp(`ADD CONSTRAINT (\\w+)\\s+FOREIGN KEY[^;]*ON DELETE ${regra};`, 'g'))].map((m) => m[1]).sort()

const CINCO = [
  'engenheiros_projetos_eng_id_fkey',
  'engenheiros_projetos_projeto_id_fkey',
  'prazos_eng_projeto_id_fkey',
  'projetos_previsao_eng_projeto_id_fkey',
  'retrabalho_projetos_eng_projeto_id_fkey',
]

console.log('\n🛡️  Historico protegido contra exclusao\n')

ok('a migration troca exatamente as cinco chaves para RESTRICT, numa transacao', () => {
  assert.deepEqual(chaves(sql, 'RESTRICT'), CINCO)
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;/)
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\b(DELETE FROM|UPDATE \w+ SET|TRUNCATE|DROP TABLE)\b/i, 'nao mexe em dado')
})

ok('o rollback devolve as mesmas cinco para CASCADE', () => {
  assert.deepEqual(chaves(rollback, 'CASCADE'), CINCO)
})

ok('no baseline (antes da migration) as cinco estao em CASCADE', () => {
  for (const nome of CINCO) {
    assert.match(baseline, new RegExp(`ADD CONSTRAINT ${nome} FOREIGN KEY[^;]*ON DELETE CASCADE;`), nome)
  }
})

ok('a conferencia lista as cinco chaves', () => {
  const conferencia = sql.slice(sql.indexOf('-- 2. Conferencia'))
  for (const nome of CINCO) assert.ok(conferencia.includes(`'${nome}'`), nome)
})

ok('limpar_projetos_finalizados_antigos apaga os filhos antes do projeto', () => {
  const inicio = baseline.indexOf('CREATE OR REPLACE FUNCTION public.limpar_projetos_finalizados_antigos(')
  const corpo = baseline.slice(inicio, baseline.indexOf('$function$', baseline.indexOf('$function$', inicio) + 1))
  const pos = (t: string) => {
    // o corpo desta funcao em producao tem quebras de linha \r\n
    const i = corpo.search(new RegExp(`DELETE FROM ${t}\\r?\\n`))
    assert.ok(i >= 0, `limpeza nao apaga ${t}`)
    return i
  }
  for (const filho of ['retrabalho_projetos', 'projetos_previsao', 'prazos']) {
    assert.ok(pos(filho) < pos('engenheiros_projetos'), `${filho} antes de engenheiros_projetos`)
  }
  assert.ok(pos('engenheiros_projetos') < pos('projetos'), 'engenheiros_projetos antes de projetos')
})

console.log(`\n${passou} casos passaram\n`)
