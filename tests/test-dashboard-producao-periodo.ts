import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const fetchSource = readFileSync(resolve('dashboard/lib/supabase.ts'), 'utf8')
const cardSource = readFileSync(resolve('dashboard/components/ProducaoPeriodoCard.tsx'), 'utf8')
const dashboardSource = readFileSync(resolve('dashboard/components/DashboardClient.tsx'), 'utf8')
// O link de Admin saiu do Header para o menu lateral (redesign 11/2026); a regra e a mesma.
const headerSource = readFileSync(resolve('dashboard/components/painel/AppSidebar.tsx'), 'utf8')
const hookSource = readFileSync(resolve('dashboard/hooks/useIsOwnerActive.ts'), 'utf8')

assert.match(fetchSource, /export async function fetchProducaoEngenheiroPeriodo/)
assert.match(fetchSource, /from\('retrabalho_projetos'\)/)
assert.match(fetchSource, /gte\('data_retrabalho'/)
assert.match(fetchSource, /lte\('data_retrabalho'/)
assert.match(fetchSource, /horas_trabalhadas_total/)
assert.match(fetchSource, /horas_retrabalho/)

assert.match(cardSource, /fetchProducaoApontamentosPeriodo/)
assert.match(cardSource, /buildProducaoPeriodo/)
assert.match(cardSource, /Valor da hora/)
assert.match(cardSource, /horas_trabalhadas_total \* taxa/)
assert.match(cardSource, /type="text"/)
assert.match(cardSource, /inputMode="decimal"/)
assert.match(cardSource, /aria-label=\{`Valor da hora para \$\{row\.engenheiro\}`\}/)
assert.doesNotMatch(cardSource, /type="number"/)
assert.doesNotMatch(
  cardSource,
  /\.from\('engenheiros'\)[\s\S]*\.(insert|update|upsert)/,
  'UI must not persist hourly rate on engenheiros'
)
assert.doesNotMatch(
  fetchSource,
  /valor_hora/,
  'fetch must not persist valor_hora on engenheiros'
)

assert.match(dashboardSource, /ProducaoPeriodoCard/)
assert.match(dashboardSource, /isOwner &&/)
assert.match(dashboardSource, /useIsOwnerActive/)
assert.match(headerSource, /useIsOwnerActive/)
assert.match(hookSource, /profile\?\.role === 'owner'/)
assert.match(hookSource, /profile\?\.status === 'active'/)
assert.doesNotMatch(
  dashboardSource,
  /profile\?\.role === 'owner'/,
  'owner check must live in useIsOwnerActive, not DashboardClient'
)

console.log('test-dashboard-producao-periodo: OK')
