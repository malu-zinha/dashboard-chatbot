import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { projetoMatchesStatusFilter } = await import('../dashboard/lib/projetoFilters.ts')

const baseProjeto = {
  data_conclusao: null,
  percentual_andamento: 50,
  dias_atraso: 0,
}

assert.equal(
  projetoMatchesStatusFilter(baseProjeto, 'em_execucao'),
  true,
  'projeto em andamento no prazo aparece em Em Execucao'
)

assert.equal(
  projetoMatchesStatusFilter({ ...baseProjeto, dias_atraso: 12 }, 'em_execucao'),
  true,
  'projeto em andamento atrasado aparece em Em Execucao'
)

assert.equal(
  projetoMatchesStatusFilter({ ...baseProjeto, percentual_andamento: 0 }, 'em_execucao'),
  true,
  'projeto aguardando inicio aparece em Em Execucao'
)

assert.equal(
  projetoMatchesStatusFilter({ ...baseProjeto, percentual_andamento: 100 }, 'em_execucao'),
  false,
  'projeto com 100 por cento nao aparece em Em Execucao'
)

assert.equal(
  projetoMatchesStatusFilter({ ...baseProjeto, data_conclusao: '2026-07-20' }, 'em_execucao'),
  false,
  'projeto com data de conclusao nao aparece em Em Execucao'
)

assert.equal(
  projetoMatchesStatusFilter({ ...baseProjeto, dias_atraso: 12 }, 'atrasado'),
  true,
  'projeto atrasado tambem aparece em Atrasados'
)

// Desde o agrupamento por projeto, o filtro das abas vive em lib/projetosAgrupados.ts.
const projetosTableContent = readFileSync(
  resolve('dashboard/lib/projetosAgrupados.ts'),
  'utf8'
)
const emExecucaoBranch = projetosTableContent.match(
  /filterStatus === 'em_execucao'[\s\S]*?} else if \(filterStatus === 'atrasado'\)/
)?.[0]

assert.ok(emExecucaoBranch, 'projetoNaAba deve ter branch em_execucao')
assert.doesNotMatch(
  emExecucaoBranch,
  /dias_atraso\s*={0,3}\s*0|dias_atraso\s*===\s*0/,
  'branch em_execucao nao deve excluir projetos atrasados'
)

console.log('test-dashboard-projetos-em-execucao-filtro: OK')
