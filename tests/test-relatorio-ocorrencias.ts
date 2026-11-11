import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// dashboard/ e um pacote CommonJS: daqui do ESM da raiz o modulo chega como default.
import * as ocNs from '../dashboard/lib/relatorioOcorrencias.ts'
import * as datasNs from '../dashboard/lib/datas.ts'

const oc = ((ocNs as any).default ?? ocNs) as typeof import('../dashboard/lib/relatorioOcorrencias.ts')
const datas = ((datasNs as any).default ?? datasNs) as typeof import('../dashboard/lib/datas.ts')
const { resumirOcorrencias, diasCorridos, formatarDias, formatarHoras, formatarResumoTipo } = oc
const { dataBRDeTimestamp } = datas

// Dados ficticios (repo publico).
const linhas = [
  // Disciplina A: retrabalho em 2 dias, paralisacao em 1
  { eng_projeto_id: 'A', data_retrabalho: '2026-11-12', tipo_retrabalho: 'retrabalho', horas_retrabalho: 2 },
  { eng_projeto_id: 'A', data_retrabalho: '2026-11-13', tipo_retrabalho: 'retrabalho', horas_retrabalho: '1.5' },
  { eng_projeto_id: 'A', data_retrabalho: '2026-11-14', tipo_retrabalho: 'paralisacao', horas_retrabalho: 3 },
  // Disciplina B: retrabalho no MESMO dia que A (conta 1 dia no projeto, nao 2)
  { eng_projeto_id: 'B', data_retrabalho: '2026-11-12', tipo_retrabalho: 'retrabalho', horas_retrabalho: 1 },
  // Relatos antigos: sem tipo (nao classificado) e sem horas
  { eng_projeto_id: 'B', data_retrabalho: '2026-06-09', tipo_retrabalho: null, horas_retrabalho: null },
  { eng_projeto_id: 'A', data_retrabalho: '2026-06-10', tipo_retrabalho: null, horas_retrabalho: 0.5 },
]

const r = resumirOcorrencias(linhas)

// Projeto: dias distintos por tipo e soma das horas
assert.deepEqual(r.projeto.retrabalho, { dias: 2, horas: 4.5 }, 'dias distintos: 12/11 conta uma vez')
assert.deepEqual(r.projeto.paralisacao, { dias: 1, horas: 3 }, 'paralisacao separada do retrabalho')
assert.deepEqual(r.projeto.nao_classificado, { dias: 2, horas: 0.5 }, 'relato sem horas conta o dia e nao soma hora')

// Por disciplina
assert.deepEqual(r.porDisciplina.A.retrabalho, { dias: 2, horas: 3.5 })
assert.deepEqual(r.porDisciplina.A.paralisacao, { dias: 1, horas: 3 })
assert.deepEqual(r.porDisciplina.B.retrabalho, { dias: 1, horas: 1 })
assert.deepEqual(r.porDisciplina.B.paralisacao, { dias: 0, horas: 0 })

// Sem relatos
const vazio = resumirOcorrencias([])
assert.deepEqual(vazio.projeto.retrabalho, { dias: 0, horas: 0 })
assert.deepEqual(vazio.porDisciplina, {})

// Dias corridos contando inicio e fim
assert.equal(diasCorridos('2026-11-09', '2026-11-09'), 1, 'mesmo dia = 1 dia')
assert.equal(diasCorridos('2026-11-09', '2026-11-11'), 3)
assert.equal(diasCorridos('2026-02-27', '2026-03-02'), 4, 'atravessa o fim do mes')
assert.equal(diasCorridos(null, '2026-11-11'), null)
assert.equal(diasCorridos('2026-11-11', '2026-11-09'), null, 'fim antes do inicio nao vira numero negativo')

// Formatos
assert.equal(formatarDias(1), '1 dia')
assert.equal(formatarDias(3), '3 dias')
assert.equal(formatarDias(null), '-')
assert.equal(formatarHoras(4.5), '4,5 h')
assert.equal(formatarResumoTipo({ dias: 2, horas: 4.5 }), '2 dias · 4,5 h')
assert.equal(formatarResumoTipo({ dias: 0, horas: 0 }), 'Nenhum registro')

// Data de Brasilia de um timestamp: 23h de Brasilia (02h UTC do dia seguinte) e o mesmo dia
assert.equal(dataBRDeTimestamp('2026-11-10T02:00:00+00:00'), '2026-11-09')
assert.equal(dataBRDeTimestamp('2026-11-09T17:27:33.532063+00:00'), '2026-11-09')
assert.equal(dataBRDeTimestamp('2026-11-09'), '2026-11-09', 'DATE puro volta como esta')
assert.equal(dataBRDeTimestamp(null), null)
assert.equal(dataBRDeTimestamp('nao e data'), null)

// A rota le os relatos e o PDF nao usa mais as colunas da view que nao mediam o que diziam
const rota = readFileSync(resolve('dashboard/app/api/admin/projetos/[id]/relatorio/route.ts'), 'utf8')
assert.match(rota, /from\('retrabalho_projetos'\)[\s\S]*?eq\('necessitou_retrabalho', true\)/, 'rota le os relatos do projeto')
assert.match(rota, /resumirOcorrencias\(/, 'rota resume por tipo')
assert.match(rota, /relatos_fora_das_disciplinas/, 'rota conta os relatos de disciplinas desativadas para o PDF avisar')
const pdf = readFileSync(resolve('dashboard/lib/gerarRelatorioPdf.ts'), 'utf8')
assert.doesNotMatch(pdf, /relatorio\.dias_paralisacao/, 'PDF nao pode usar dias_paralisacao (status_historico, sempre 0)')
assert.doesNotMatch(pdf, /relatorio\.dias_retrabalho|disc\.dias_retrabalho/, 'PDF nao pode usar a contagem de linhas')
assert.doesNotMatch(pdf, /disc\.dias_execucao|relatorio\.dias_execucao_total/, 'PDF usa dias corridos com inicio e fim')

console.log('test-relatorio-ocorrencias: OK')
