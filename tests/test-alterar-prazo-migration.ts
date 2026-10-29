// =====================================================
// TESTE: migration que deixa o dono alterar o prazo de uma atribuicao
// =====================================================
// Rodar com: npx tsx tests/test-alterar-prazo-migration.ts
//
// Le o SQL como texto. Confere as colunas novas do aviso (sem
// data_agendamento, que reativaria um trigger antigo quebrado), que so o
// service_role executa a funcao, as recusas, que o prazo do cliente so e
// empurrado para frente, que o aviso pendente e substituido antes de inserir
// outro e que nada fora da funcao mexe em dado.
//
// O comportamento foi testado num Postgres local montado pelo baseline
// (PGlite); ver o relatorio da Task 1 e a descricao do PR.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20261029_alterar_prazo_atribuicao.sql', 'utf8')
const rollback = readFileSync('supabase/rollbacks/20261029_alterar_prazo_atribuicao.rollback.sql', 'utf8')
const codigo = sql.replace(/--.*$/gm, '')

const inicioCorpo = codigo.indexOf('CREATE OR REPLACE FUNCTION public.alterar_prazo_atribuicao(')
assert.ok(inicioCorpo >= 0, 'migration nao cria alterar_prazo_atribuicao')
const fimCorpo = codigo.indexOf('$function$', codigo.indexOf('$function$', inicioCorpo) + 1)
assert.ok(fimCorpo > inicioCorpo, 'corpo da funcao sem $function$ de fechamento')
const corpo = codigo.slice(inicioCorpo, fimCorpo)
const foraDoCorpo = codigo.slice(0, inicioCorpo) + codigo.slice(fimCorpo)

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📅 Migration 20261029_alterar_prazo_atribuicao\n')

ok('transacao e rollback', () => {
  assert.match(codigo, /^\s*BEGIN;/m)
  assert.match(codigo, /^\s*COMMIT;/m)
  assert.ok(
    rollback.includes('DROP FUNCTION IF EXISTS public.alterar_prazo_atribuicao(uuid, date, uuid)'),
    'rollback nao remove a funcao'
  )
  assert.ok(rollback.includes('DROP COLUMN IF EXISTS twilio_sid'), 'rollback nao remove twilio_sid')
  assert.ok(rollback.includes('DROP COLUMN IF EXISTS prazo_avisado'), 'rollback nao remove prazo_avisado')
})

ok('sem current_date e sem SQLERRM', () => {
  assert.doesNotMatch(codigo, /current_date/i)
  assert.doesNotMatch(codigo, /SQLERRM/)
})

ok('so service_role executa', () => {
  assert.match(
    codigo,
    /REVOKE ALL ON FUNCTION public\.alterar_prazo_atribuicao\(uuid, date, uuid\) FROM PUBLIC, anon, authenticated/
  )
  assert.match(codigo, /GRANT EXECUTE ON FUNCTION public\.alterar_prazo_atribuicao\(uuid, date, uuid\) TO service_role/)
})

ok('colunas novas sem data_agendamento', () => {
  assert.match(
    codigo,
    /ADD COLUMN IF NOT EXISTS eng_projeto_id uuid REFERENCES public\.engenheiros_projetos\(id\) ON DELETE SET NULL/
  )
  assert.match(codigo, /ADD COLUMN IF NOT EXISTS twilio_sid text/)
  assert.match(codigo, /ADD COLUMN IF NOT EXISTS status_entrega text/)
  assert.match(codigo, /ADD COLUMN IF NOT EXISTS erro_codigo text/)
  assert.match(codigo, /ADD COLUMN IF NOT EXISTS status_atualizado_em timestamptz/)
  assert.match(codigo, /ADD COLUMN IF NOT EXISTS prazo_avisado date/)
  assert.doesNotMatch(codigo, /data_agendamento/)
})

ok('recusas', () => {
  for (const c of ["'nao_encontrada'", "'concluida'", "'parametro_invalido'", "'sem_mudanca'"]) {
    assert.ok(corpo.includes(c), `corpo sem ${c}`)
  }
  assert.match(corpo, /percentual_ponderado, 0\) >= 100/)
  assert.match(corpo, /p_novo_prazo < v_data_inicio/)
})

ok('prazo do cliente so empurra para frente', () => {
  assert.match(corpo, /UPDATE public\.prazos\s+SET prazo_final_cliente = p_novo_prazo[\s\S]*prazo_final_cliente < p_novo_prazo/)
})

ok('substitui aviso pendente antes de inserir', () => {
  const iUpdate = corpo.indexOf('UPDATE public.notificacoes_whatsapp')
  const iInsert = corpo.indexOf('INSERT INTO public.notificacoes_whatsapp')
  assert.ok(iUpdate >= 0, 'sem UPDATE do aviso pendente')
  assert.ok(iInsert >= 0, 'sem INSERT do aviso')
  assert.ok(iUpdate < iInsert, 'UPDATE do pendente deve vir antes do INSERT')
  const update = corpo.slice(iUpdate, corpo.indexOf(';', iUpdate))
  assert.match(update, /enviada = false/)
  assert.match(update, /tentativas = 0/)
})

ok('aviso reescrito volta a contar do zero e leva o prazo novo', () => {
  const iUpdate = corpo.indexOf('UPDATE public.notificacoes_whatsapp')
  const update = corpo.slice(iUpdate, corpo.indexOf(';', iUpdate))
  assert.match(update, /prazo_avisado = p_novo_prazo/)
  assert.match(update, /created_at = now\(\)/)
})

ok('aviso novo grava o prazo avisado', () => {
  const iInsert = corpo.indexOf('INSERT INTO public.notificacoes_whatsapp')
  const insert = corpo.slice(iInsert, corpo.indexOf(';', iInsert))
  const colunas = /\(([^)]*)\)\s*VALUES/.exec(insert)?.[1].split(',').map((c) => c.trim()) ?? []
  const valores = /VALUES\s*\(([\s\S]*)\)\s*$/.exec(insert)?.[1].split(/,(?![^(]*\))/).map((v) => v.trim()) ?? []
  assert.equal(colunas.length, valores.length, 'INSERT com colunas e valores desalinhados')
  assert.equal(valores[colunas.indexOf('prazo_avisado')], 'p_novo_prazo')
})

ok('prazo anterior do pendente vem da linha inteira (inclui "não definido")', () => {
  assert.ok(corpo.includes("'Prazo anterior: ([^\\n]+)'"), 'regex do prazo anterior nao pega o resto da linha')
  assert.doesNotMatch(corpo, /Prazo anterior: \(\\d/)
})

ok('sem telefone', () => {
  assert.match(corpo, /'sem_telefone'/)
})

ok('nao mexe em dado antigo', () => {
  assert.doesNotMatch(foraDoCorpo, /\bUPDATE\s+[\w.]+\s+SET\b/i)
  assert.doesNotMatch(foraDoCorpo, /\bDELETE\s+FROM\b/i)
})

console.log(`\n${passou} casos passaram\n`)
