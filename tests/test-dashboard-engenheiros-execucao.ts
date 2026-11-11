import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardClientPath = resolve('dashboard/components/DashboardClient.tsx')
const tablePath = resolve('dashboard/components/EngenheirosExecucaoTable.tsx')
const helperPath = resolve('dashboard/lib/engenheirosExecucao.ts')

assert.ok(existsSync(dashboardClientPath), 'DashboardClient.tsx deve existir')
assert.ok(existsSync(tablePath), 'EngenheirosExecucaoTable.tsx deve existir')
assert.ok(existsSync(helperPath), 'engenheirosExecucao.ts deve existir')

const { buildEngenheirosExecucao } = await import('../dashboard/lib/engenheirosExecucao.ts')

const projetos = [
  {
    atribuicao_id: 'atrasado-ana',
    eng_id: 'ana',
    projeto_id: 'p-1',
    codigo_projeto: 'PRJ-001',
    cliente: 'Cliente A',
    engenheiro_nome: 'Ana',
    area_codigo: 'ELETRICO',
    area_descricao: 'Eletrico',
    percentual_andamento: 40,
    data_prevista: '2026-07-10',
    data_conclusao: null,
    dias_atraso: 7,
  },
  {
    atribuicao_id: 'prazo-ana',
    eng_id: 'ana',
    projeto_id: 'p-2',
    codigo_projeto: 'PRJ-002',
    cliente: 'Cliente B',
    engenheiro_nome: 'Ana',
    area_codigo: 'HIDRO',
    area_descricao: 'Hidrossanitario',
    percentual_andamento: 30,
    data_prevista: '2026-07-30',
    data_conclusao: null,
    dias_atraso: 0,
  },
  {
    atribuicao_id: 'aguardando-ana',
    eng_id: 'ana',
    projeto_id: 'p-3',
    codigo_projeto: 'PRJ-003',
    cliente: 'Cliente C',
    engenheiro_nome: 'Ana',
    area_codigo: 'SPDA',
    area_descricao: 'SPDA',
    percentual_andamento: 0,
    data_prevista: '2026-07-25',
    data_conclusao: null,
    dias_atraso: 0,
  },
  {
    atribuicao_id: 'prazo-bruno',
    eng_id: 'bruno',
    projeto_id: 'p-4',
    codigo_projeto: 'PRJ-004',
    cliente: 'Cliente D',
    engenheiro_nome: 'Bruno',
    area_codigo: 'GAS',
    area_descricao: 'Gas',
    percentual_andamento: 10,
    data_prevista: '2026-08-01',
    data_conclusao: null,
    dias_atraso: 0,
  },
  {
    atribuicao_id: 'concluido-data',
    eng_id: 'bruno',
    projeto_id: 'p-5',
    codigo_projeto: 'PRJ-005',
    cliente: 'Cliente E',
    engenheiro_nome: 'Bruno',
    area_codigo: 'PCI',
    area_descricao: 'Incendio',
    percentual_andamento: 80,
    data_prevista: '2026-07-01',
    data_conclusao: '2026-07-20',
    dias_atraso: 0,
  },
  {
    atribuicao_id: 'concluido-percentual',
    eng_id: 'carla',
    projeto_id: 'p-6',
    codigo_projeto: 'PRJ-006',
    cliente: 'Cliente F',
    engenheiro_nome: 'Carla',
    area_codigo: 'COMPATIBILIZACAO',
    area_descricao: 'Compatibilizacao',
    instancia_label: 'Compatibilizacao 2',
    percentual_andamento: 100,
    data_prevista: '2026-07-01',
    data_conclusao: null,
    dias_atraso: 0,
  },
]

const grupos = buildEngenheirosExecucao(projetos)

assert.equal(grupos.length, 2, 'deve agrupar apenas engenheiros com tarefas nao concluidas')
assert.equal(grupos[0].engenheiro_nome, 'Ana', 'engenheiro com mais tarefas aparece primeiro')
assert.equal(grupos[0].total_tarefas, 3, 'conta tarefas em execucao da Ana')
assert.equal(grupos[0].total_atrasadas, 1, 'conta tarefas atrasadas da Ana')
assert.equal(grupos[1].engenheiro_nome, 'Bruno', 'engenheiro com menos tarefas aparece depois')
assert.equal(grupos[1].total_tarefas, 1, 'exclui tarefas concluidas por data')
assert.deepEqual(
  grupos[0].tarefas.map((t: any) => t.codigo_projeto),
  ['PRJ-001', 'PRJ-003', 'PRJ-002'],
  'ordena tarefas atrasadas primeiro e depois por prazo mais proximo'
)
assert.equal(
  grupos.some((grupo: any) => grupo.engenheiro_nome === 'Carla'),
  false,
  'exclui tarefas concluidas por percentual 100'
)

const dashboardClientContent = readFileSync(dashboardClientPath, 'utf8')
assert.match(
  dashboardClientContent,
  /import EngenheirosExecucaoTable from/,
  'DashboardClient deve importar EngenheirosExecucaoTable'
)
// Redesign 11/2026: os KPIs viraram as celulas do carimbo da prancha (PranchaResumo).
const pranchaContent = readFileSync('dashboard/components/painel/PranchaResumo.tsx', 'utf8')
assert.match(
  pranchaContent,
  /rotulo="Engenheiros em execu[cç][aã]o"[\s\S]*?onAbrir=\{\(\) => onAbrirEngenheiros\(\)\}/,
  'a prancha deve ter a celula Engenheiros em execucao ligada a onAbrirEngenheiros'
)
assert.match(
  dashboardClientContent,
  /<PranchaResumo[\s\S]*?onAbrirEngenheiros=/,
  'DashboardClient deve renderizar a prancha com onAbrirEngenheiros'
)
assert.match(
  dashboardClientContent,
  /const abrirEngenheirosExecucao = [\s\S]*?setShowEngenheirosExecucaoModal\(true\)/,
  'o card deve abrir o modal de engenheiros em execucao'
)
assert.match(
  dashboardClientContent,
  /<EngenheirosExecucaoTable/,
  'DashboardClient deve renderizar EngenheirosExecucaoTable'
)

const tableContent = readFileSync(tablePath, 'utf8')
assert.match(tableContent, /overflow-x-auto/, 'modal deve permitir scroll horizontal')
assert.match(tableContent, /buildEngenheirosExecucao/, 'modal deve usar o helper de agrupamento')
assert.match(tableContent, /searchScore/, 'modal deve ter busca por campos relevantes')

console.log('test-dashboard-engenheiros-execucao: OK')
