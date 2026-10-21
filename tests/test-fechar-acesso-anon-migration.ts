// =====================================================
// TESTE: migration que fecha o acesso do anon
// =====================================================
// Rodar com: npx tsx tests/test-fechar-acesso-anon-migration.ts
//
// Le o SQL como texto (padrao dos test-*-migration.ts). Protege as duas
// regressoes que devolveriam privilegio ao anon: GRANT explicito e view
// recriada herdando o privilegio padrao do Supabase.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve('supabase/migrations')
const sql = readFileSync(resolve(dir, '20261021_fechar_acesso_anon.sql'), 'utf8')
// Sem os comentarios, para os asserts nao casarem com a explicacao.
const codigo = sql.replace(/--.*$/gm, '')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🔒 Migration 20261021_fechar_acesso_anon\n')

ok('revoga do anon tabelas/views e sequences', () => {
  assert.match(codigo, /REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon/i)
  assert.match(codigo, /REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon/i)
  assert.match(codigo, /pg_matviews/i)
})

ok('funcoes: troca PUBLIC por authenticated + service_role so nas abertas', () => {
  assert.match(codigo, /proacl IS NULL OR EXISTS/i)
  assert.match(codigo, /grantee = 0/i)
  assert.match(codigo, /IF aberta_a_public THEN[\s\S]*?FROM PUBLIC[\s\S]*?TO authenticated, service_role[\s\S]*?END IF/i)
  // nenhum GRANT amplo que reabriria transferir_atribuicao/desativar_atribuicao
  assert.doesNotMatch(codigo, /GRANT EXECUTE ON ALL FUNCTIONS/i)
})

ok('muda os privilegios padrao para objetos futuros', () => {
  for (const tipo of ['TABLES', 'SEQUENCES', 'FUNCTIONS']) {
    assert.match(codigo, new RegExp(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON ${tipo} FROM anon`, 'i'))
  }
  assert.match(codigo, /REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i)
})

ok('roda numa transacao e nao toca em dado', () => {
  assert.match(codigo, /^\s*BEGIN;/m)
  assert.match(codigo, /^\s*COMMIT;/m)
  assert.doesNotMatch(codigo, /\b(DELETE\s+FROM|TRUNCATE|UPDATE\s+\w+\s+SET|DROP\s+(TABLE|VIEW))\b/i)
})

ok('traz a consulta de conferencia com has_*_privilege do anon', () => {
  assert.match(codigo, /has_table_privilege\('anon'/i)
  assert.match(codigo, /has_function_privilege\('anon'/i)
})

ok('nenhuma migration concede nada ao anon', () => {
  for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const texto = readFileSync(resolve(dir, arquivo), 'utf8').replace(/--.*$/gm, '')
    assert.doesNotMatch(texto, /\bGRANT\b[^;]*\bTO\b[^;]*\banon\b/i, `${arquivo} concede privilegio ao anon`)
  }
})

ok('existe o rollback ao lado', () => {
  const rb = readFileSync(resolve('supabase/rollbacks/20261021_fechar_acesso_anon.rollback.sql'), 'utf8')
  assert.match(rb, /GRANT SELECT ON[\s\S]*vw_atribuicao_apontamentos[\s\S]*TO anon/i)
})

console.log(`\n✅ ${passou} verificacoes passaram\n`)
