// =====================================================
// TESTE: falha de consulta no dashboard nao vira zero
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-falha-nao-vira-zero.ts
//
// Cada fetch transformava erro em [] ou null e a tela mostrava zeros como se
// fossem dados. Agora a falha fica registrada (registrarFalha) e o painel
// avisa que os numeros podem estar incompletos; a producao por periodo lanca
// o erro para o card mostrar a mensagem que ja tinha. Junto: so a carga mais
// recente grava na tela (recargas do Realtime podiam terminar fora de ordem).
//
// Le os arquivos como texto (padrao dos test-dashboard-*.ts).
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const lib = readFileSync('dashboard/lib/supabase.ts', 'utf8')
const painel = readFileSync('dashboard/components/DashboardClient.tsx', 'utf8')

let passou = 0
function ok(nome: string, fn: () => void) {
  fn()
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🧯 Falha nao vira zero\n')

ok('nenhum fetch engole erro com console.error + return vazio', () => {
  const engolidos = lib.match(/console\.error\('Erro ao buscar[^']*', \w+\)\s*\n\s*return (\[\]|null)/g) ?? []
  assert.deepEqual(engolidos, [])
})

ok('falhas sao registradas e o painel consome a lista', () => {
  assert.match(lib, /export function consumirFalhasDeCarga\(\)/)
  assert.ok((lib.match(/registrarFalha\(/g) ?? []).length >= 15, 'poucas chamadas de registrarFalha')
  assert.match(painel, /consumirFalhasDeCarga\(\)/)
})

ok('erros secundarios de engenheiros/areas tambem sao registrados', () => {
  for (const campo of ['cargaRes', 'retRes', 'atrasosRes', 'epRes', 'etapasRes']) {
    assert.match(lib, new RegExp(`if \\(${campo}\\.error\\) registrarFalha\\(`), campo)
  }
})

ok('producao por periodo lanca o erro (o card ja tem catch)', () => {
  const inicio = lib.indexOf('export async function fetchProducaoApontamentosPeriodo')
  const trecho = lib.slice(inicio, lib.indexOf('\n}\n', inicio))
  assert.match(trecho, /throw /)
  assert.doesNotMatch(trecho, /return \[\]/)
})

ok('painel mostra aviso de dados incompletos com "tentar de novo"', () => {
  assert.match(painel, /podem estar incompletos/)
  assert.match(painel, /Tentar de novo/)
})

ok('so a carga mais recente grava na tela', () => {
  assert.match(painel, /useRef/)
  assert.match(painel, /const minhaCarga = \+\+cargaAtual\.current/)
  assert.match(painel, /if \(minhaCarga !== cargaAtual\.current\) return/)
})

console.log(`\n✅ ${passou} verificacoes passaram\n`)
