// =====================================================
// TESTE: migration que deixa authenticated somente leitura
// =====================================================
// Rodar com: npx tsx tests/test-authenticated-somente-leitura-migration.ts
//
// Le o SQL como texto. O risco desta migration e a LISTA de funcoes: revogar
// uma funcao de leitura que o dashboard usa quebra tela; esquecer uma de
// escrita deixa a porta aberta. Por isso as tres listas (revogacao,
// conferencia, rollback) sao comparadas entre si e contra o codigo.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const sql = readFileSync(resolve('supabase/migrations/20261022_authenticated_somente_leitura.sql'), 'utf8')
const codigo = sql.replace(/--.*$/gm, '')
const rollback = readFileSync(resolve('supabase/rollbacks/20261022_authenticated_somente_leitura.rollback.sql'), 'utf8')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

const nomes = (trecho: string) => new Set([...trecho.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))

const listaRevogacao = nomes(codigo.match(/INSERT INTO _funcoes_escrita[\s\S]*?;/)![0])
const listaConferencia = nomes(codigo.match(/p\.proname IN \(([\s\S]*?)\)/)![1])
const listaRollback = nomes(rollback.match(/p\.proname IN \(([\s\S]*?)\)/)![1])

// RPCs chamadas pelo codigo (chatbot e dashboard), para cruzar com a lista.
function rpcsChamadas(dir: string, acc = new Set<string>()): Set<string> {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (nome === 'node_modules' || nome === '.next') continue
    if (statSync(caminho).isDirectory()) rpcsChamadas(caminho, acc)
    else if (/\.(ts|tsx)$/.test(nome)) {
      for (const m of readFileSync(caminho, 'utf8').matchAll(/\.rpc\(\s*'([a-z_]+)'/g)) acc.add(m[1])
    }
  }
  return acc
}
const chamadas = new Set<string>()
for (const d of ['chatbot', 'integrations', 'src', 'dashboard']) rpcsChamadas(resolve(d), chamadas)

console.log('\n📖 Migration 20261022_authenticated_somente_leitura\n')

ok('28 funcoes na lista de revogacao', () => {
  assert.equal(listaRevogacao.size, 28)
})

ok('conferencia confere exatamente a lista revogada', () => {
  assert.deepEqual([...listaConferencia].sort(), [...listaRevogacao].sort())
})

ok('rollback devolve todas, menos as duas que ja eram so service_role', () => {
  const esperado = [...listaRevogacao].filter((f) => f !== 'transferir_atribuicao' && f !== 'desativar_atribuicao')
  assert.deepEqual([...listaRollback].sort(), esperado.sort())
})

ok('nenhuma funcao de leitura usada pelo codigo foi revogada', () => {
  const leitura = [...chamadas].filter((f) => /^(listar|buscar|calcular|verificar|dono_consultar|dono_recomendar)_/.test(f))
  // Guarda contra a busca de .rpc() parar de casar. Eram 8; caiu para 3 quando a
  // Onda 5 removeu metodos sem uso que chamavam listar_*/buscar_*.
  assert.ok(leitura.length >= 3, 'achou poucas funcoes de leitura no codigo')
  for (const f of leitura) assert.ok(!listaRevogacao.has(f), `${f} e leitura e foi revogada`)
})

ok('toda funcao de escrita chamada pelo codigo esta na lista', () => {
  const escrita = [...chamadas].filter((f) => !/^(listar|buscar|calcular|verificar|dono_consultar|dono_recomendar)_/.test(f))
  for (const f of escrita) assert.ok(listaRevogacao.has(f), `${f} escreve e nao foi revogada`)
})

ok('trava aborta se alguma view usar funcao da lista', () => {
  assert.match(codigo, /pg_get_viewdef[\s\S]*RAISE EXCEPTION/)
})

ok('tabelas: tira escrita, mantem leitura', () => {
  assert.match(codigo, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated/)
  assert.doesNotMatch(codigo, /REVOKE[^;]*SELECT[^;]*FROM authenticated/i)
  assert.match(codigo, /ALTER DEFAULT PRIVILEGES[\s\S]*REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM authenticated/)
})

ok('service_role mantem as funcoes; nada de dado tocado; transacao', () => {
  assert.match(codigo, /GRANT EXECUTE ON FUNCTION %s TO service_role/)
  assert.match(codigo, /^\s*BEGIN;/m)
  assert.match(codigo, /^\s*COMMIT;/m)
  assert.doesNotMatch(codigo, /\b(DELETE\s+FROM|TRUNCATE\s+\w+;|UPDATE\s+\w+\s+SET|DROP\s+(TABLE|VIEW))\b/i)
})

ok('cabecalho avisa que so pode ser aplicada depois do deploy', () => {
  assert.match(sql, /APLICAR SO DEPOIS DO DEPLOY/)
})

console.log(`\n✅ ${passou} verificacoes passaram\n`)
