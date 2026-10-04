import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { formatarDataBR, toDataISO } from '../dashboard/lib/datas.ts'
import {
  particionarPorPeriodoConclusao,
  periodoConclusaoAtivo,
  projetoConcluidoNoPeriodo,
} from '../dashboard/lib/projetoFilters.ts'

// =====================================================
// formatarDataBR — o bug do print
// =====================================================

// PRJ-109 / Andrea Dias tem data_conclusao 2026-09-29 no banco, mas o modal exibia
// 28/09/2026: new Date('2026-09-29') e UTC midnight, que em BRT cai no dia anterior.
assert.equal(formatarDataBR('2026-09-29'), '29/09/2026', 'DATE nao pode voltar um dia')
assert.equal(formatarDataBR('2026-01-01'), '01/01/2026', 'virada de ano nao pode voltar um dia')
assert.equal(formatarDataBR('2026-09-29T13:45:00Z'), '29/09/2026', 'timestamp usa a parte da data')
assert.equal(formatarDataBR(null), '-', 'nulo vira traco')
assert.equal(formatarDataBR(undefined), '-', 'indefinido vira traco')
assert.equal(formatarDataBR(''), '-', 'vazio vira traco')
assert.equal(formatarDataBR('data invalida'), '-', 'texto invalido vira traco')

assert.equal(toDataISO('2026-09-29T13:45:00Z'), '2026-09-29', 'toDataISO corta a hora')
assert.equal(toDataISO(null), null, 'toDataISO aceita nulo')

// =====================================================
// projetoConcluidoNoPeriodo
// =====================================================

const concluidoEm = (data: string | null) => ({
  data_conclusao: data,
  percentual_andamento: 100,
  dias_atraso: 0,
})

assert.equal(periodoConclusaoAtivo({}), false, 'periodo vazio nao esta ativo')
assert.equal(periodoConclusaoAtivo({ dataInicio: '2026-09-01' }), true, 'so inicio ja ativa')
assert.equal(periodoConclusaoAtivo({ dataFim: '2026-09-30' }), true, 'so fim ja ativa')

// Sem periodo nada e filtrado — nem os que nao tem data de conclusao.
assert.equal(
  projetoConcluidoNoPeriodo(concluidoEm(null), {}),
  true,
  'sem periodo, concluido sem data continua na lista'
)

const setembro = { dataInicio: '2026-09-01', dataFim: '2026-09-30' }

assert.equal(projetoConcluidoNoPeriodo(concluidoEm('2026-09-15'), setembro), true, 'dentro do periodo')
assert.equal(projetoConcluidoNoPeriodo(concluidoEm('2026-09-01'), setembro), true, 'limite inicial e inclusivo')
assert.equal(projetoConcluidoNoPeriodo(concluidoEm('2026-09-30'), setembro), true, 'limite final e inclusivo')
assert.equal(projetoConcluidoNoPeriodo(concluidoEm('2026-08-31'), setembro), false, 'antes do inicio fica fora')
assert.equal(projetoConcluidoNoPeriodo(concluidoEm('2026-10-01'), setembro), false, 'depois do fim fica fora')

// Timestamp no limite do dia nao pode cair fora por causa da hora.
assert.equal(
  projetoConcluidoNoPeriodo(concluidoEm('2026-09-30T23:59:00Z'), setembro),
  true,
  'timestamp no ultimo dia continua dentro'
)

// Concluido por percentual, sem data: com periodo ativo nao da para afirmar que caiu dentro.
assert.equal(
  projetoConcluidoNoPeriodo(concluidoEm(null), setembro),
  false,
  'concluido sem data fica fora quando ha periodo'
)

// Periodo aberto de um lado so.
assert.equal(
  projetoConcluidoNoPeriodo(concluidoEm('2026-12-01'), { dataInicio: '2026-09-01' }),
  true,
  'so com inicio, qualquer data posterior entra'
)
assert.equal(
  projetoConcluidoNoPeriodo(concluidoEm('2026-01-01'), { dataFim: '2026-09-30' }),
  true,
  'so com fim, qualquer data anterior entra'
)

// =====================================================
// particionarPorPeriodoConclusao
// =====================================================

const itens = [
  { ...concluidoEm('2026-09-10'), codigo: 'A' },
  { ...concluidoEm('2026-10-05'), codigo: 'B' },
  { ...concluidoEm(null), codigo: 'C' },
  { ...concluidoEm(null), codigo: 'D' },
]

const particao = particionarPorPeriodoConclusao(itens, setembro)

assert.deepEqual(
  particao.dentro.map((i) => i.codigo),
  ['A'],
  'so o concluido dentro do periodo permanece'
)
assert.deepEqual(
  particao.ocultadosSemData.map((i) => i.codigo),
  ['C', 'D'],
  'os sem data sao reportados para a tela poder nomea-los'
)

// B ficou fora por data, nao por falta de data: nao entra no aviso de ocultados.
assert.ok(
  !particao.ocultadosSemData.some((i) => i.codigo === 'B'),
  'quem tem data e caiu fora do periodo nao conta como ocultado sem data'
)

const semPeriodo = particionarPorPeriodoConclusao(itens, {})
assert.equal(semPeriodo.dentro.length, 4, 'sem periodo nada e particionado')
assert.equal(semPeriodo.ocultadosSemData.length, 0, 'sem periodo nao ha ocultados')

// =====================================================
// Asserts de fonte — a UI do periodo so existe na aba de concluidos
// =====================================================

const projetosTablePath = resolve('dashboard/components/ProjetosTable.tsx')
const modalPath = resolve('dashboard/components/ProjetoDetalhesModal.tsx')

assert.ok(existsSync(projetosTablePath), 'ProjetosTable.tsx deve existir')
assert.ok(existsSync(modalPath), 'ProjetoDetalhesModal.tsx deve existir')

const projetosTable = readFileSync(projetosTablePath, 'utf8')
const modal = readFileSync(modalPath, 'utf8')

assert.match(
  projetosTable,
  /const showFiltroPeriodo = filterStatus === 'concluido'/,
  'o filtro de periodo deve ser restrito a aba de concluidos'
)
assert.match(projetosTable, /id="concluidos-inicio"[\s\S]*?type="date"/, 'input de data inicial')
assert.match(projetosTable, /id="concluidos-fim"[\s\S]*?type="date"/, 'input de data final')
assert.match(
  projetosTable,
  /\{showFiltroPeriodo && \(/,
  'os inputs devem ficar atras da guarda showFiltroPeriodo'
)
assert.match(projetosTable, /ocultadosSemData/, 'a tela deve listar os ocultados sem data')
assert.match(projetosTable, /periodoInvalido/, 'datas invertidas devem ser avisadas')

// As duas formatacoes que criavam Date a partir de 'YYYY-MM-DD' sumiram.
assert.doesNotMatch(
  projetosTable,
  /new Date\(item\.data_prevista\)/,
  'ProjetosTable nao pode formatar data via new Date'
)
assert.doesNotMatch(
  modal,
  /new Date\(dateStr\)/,
  'ProjetoDetalhesModal nao pode formatar data via new Date'
)
assert.match(modal, /formatarDataBR/, 'o modal deve usar formatarDataBR')
assert.match(modal, /vw_atribuicao_apontamentos|fetchApontamentosAtribuicao/, 'o modal busca o relato diario')

console.log('test-dashboard-concluidos-periodo: OK')
