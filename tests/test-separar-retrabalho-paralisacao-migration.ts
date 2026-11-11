// =====================================================
// TESTE: migration que separa retrabalho e paralisacao nos motivos
// =====================================================
// Rodar com: npx tsx tests/test-separar-retrabalho-paralisacao-migration.ts
//
// Le o SQL como texto. Confere que nada altera dado (so constraint NOT VALID e
// views), que as views antigas ficam intactas (o dashboard no ar continua
// funcionando ate o deploy), que o registro antigo vira 'nao_classificado',
// que vw_retrabalho_detalhes_projeto so ganha coluna no fim e que o rollback
// desfaz tudo.
//
// O comportamento foi testado num Postgres local montado pelo baseline
// (PGlite): RPC gravando os dois tipos, soma igual a das views antigas,
// constraint recusando tipo invalido, permissoes e rollback; ver o PR.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20261111_separar_retrabalho_paralisacao.sql', 'utf8')
const rollback = readFileSync('supabase/rollbacks/20261111_separar_retrabalho_paralisacao.rollback.sql', 'utf8')
const codigo = sql.replace(/--.*$/gm, '')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🔀 Migration 20261111_separar_retrabalho_paralisacao\n')

ok('transacao', () => {
  assert.match(codigo, /^\s*BEGIN;/m)
  assert.match(codigo, /^\s*COMMIT;/m)
})

ok('nao altera nem apaga dado', () => {
  assert.doesNotMatch(codigo, /\bUPDATE\s+public\./i)
  assert.doesNotMatch(codigo, /\bDELETE\s+FROM/i)
  assert.doesNotMatch(codigo, /\bINSERT\s+INTO/i)
  assert.doesNotMatch(codigo, /DROP\s+(TABLE|VIEW|COLUMN)/i)
})

ok('constraint do tipo so para linhas novas', () => {
  assert.match(
    codigo,
    /ADD CONSTRAINT chk_retrabalho_tipo_ocorrencia\s+CHECK \(tipo_retrabalho IS NULL OR tipo_retrabalho IN \('retrabalho', 'paralisacao'\)\)\s+NOT VALID/
  )
})

ok('views antigas de motivos nao sao recriadas', () => {
  assert.doesNotMatch(codigo, /VIEW public\.vw_dono_retrabalhos_por_motivo AS/)
  assert.doesNotMatch(codigo, /VIEW public\.vw_retrabalho_motivos_por_projeto AS/)
})

ok('views novas separam por tipo, antigo vira nao_classificado', () => {
  for (const view of ['vw_ocorrencias_por_motivo', 'vw_ocorrencias_motivos_por_projeto']) {
    const def = codigo.match(new RegExp(`CREATE OR REPLACE VIEW public\\.${view} AS[\\s\\S]*?;`))?.[0]
    assert.ok(def, `migration nao cria ${view}`)
    assert.match(def, /COALESCE\((r\.)?tipo_retrabalho, 'nao_classificado'\) AS tipo/)
    assert.match(def, /necessitou_retrabalho = true AND (r\.)?motivo_retrabalho IS NOT NULL/)
    assert.match(codigo, new RegExp(`REVOKE ALL ON TABLE public\\.${view} FROM PUBLIC, anon, authenticated, service_role`))
    assert.match(codigo, new RegExp(`GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public\\.${view} TO authenticated`))
  }
})

ok('detalhes ganha tipo_retrabalho so no fim', () => {
  const def = codigo.match(/CREATE OR REPLACE VIEW public\.vw_retrabalho_detalhes_projeto AS[\s\S]*?;/)?.[0]
  assert.ok(def)
  assert.match(def, /r\.horas_retrabalho,\s+r\.tipo_retrabalho\s+FROM/)
})

ok('rollback desfaz tudo e nao apaga dado', () => {
  assert.match(rollback, /DROP VIEW IF EXISTS public\.vw_ocorrencias_por_motivo;/)
  assert.match(rollback, /DROP VIEW IF EXISTS public\.vw_ocorrencias_motivos_por_projeto;/)
  assert.match(rollback, /DROP CONSTRAINT IF EXISTS chk_retrabalho_tipo_ocorrencia/)
  assert.match(rollback, /r\.horas_retrabalho\s+FROM/, 'detalhes volta sem tipo_retrabalho')
  assert.match(rollback, /GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public\.vw_retrabalho_detalhes_projeto TO authenticated/)
  assert.doesNotMatch(rollback.replace(/--.*$/gm, ''), /DROP COLUMN|DELETE FROM|^\s*UPDATE\s/im)
})

console.log(`\n${passou} verificacoes passaram`)
