// A view vw_projetos_detalhado devolve uma linha por disciplina (atribuicao: projeto + area
// + engenheiro). A tabela de Projetos mostra uma linha por PROJETO, que abre e lista as
// disciplinas. As regras das abas sao as mesmas de vw_bloco1_visao_geral, entao o numero
// da aba, o subtitulo e a lista contam a mesma coisa.

import { getProjetoAreaDisplayName, type ProjetoAreaLike } from './compatibilizacao'
import { toDataISO } from './datas'
import {
  isProjetoConcluido,
  periodoConclusaoAtivo,
  type PeriodoConclusao,
  type ProjetoStatusFilter,
} from './projetoFilters'
import { searchScore } from './search'

export interface DisciplinaLinha extends ProjetoAreaLike {
  atribuicao_id?: string | null
  projeto_id: string
  codigo_projeto: string
  cliente: string
  descricao?: string | null
  engenheiro_nome: string
  percentual_andamento: number
  data_prevista?: string | null
  data_conclusao?: string | null
  dias_atraso: number
}

export type SituacaoProjeto = 'sem_disciplinas' | 'concluido' | 'atrasado' | 'aguardando' | 'em_andamento'

export interface ProjetoAgrupado<T extends DisciplinaLinha = DisciplinaLinha> {
  projeto_id: string
  codigo_projeto: string
  cliente: string
  descricao?: string | null
  // Linha da view para acoes do projeto (retrabalho, PDF, excluir projeto sem disciplina).
  linhaBase: T
  disciplinas: T[]
  total: number
  concluidas: number
  // Media simples das disciplinas, a mesma conta de recalcular_rollup_projeto no banco.
  progresso: number
  situacao: SituacaoProjeto
  maiorAtraso: number
  // Menor prazo entre as disciplinas abertas (YYYY-MM-DD).
  proximoPrazo: string | null
  // Maior data de conclusao, so quando o projeto esta concluido e todas as disciplinas tem data.
  dataConclusao: string | null
  engenheiros: string[]
}

// Atrasadas primeiro (mais atraso antes), depois abertas, depois concluidas.
function ordemDisciplina(item: DisciplinaLinha): number {
  if (item.dias_atraso > 0) return 0
  if (!isProjetoConcluido(item)) return 1
  return 2
}

export function agruparProjetos<T extends DisciplinaLinha>(linhas: T[]): ProjetoAgrupado<T>[] {
  const grupos = new Map<string, { base: T; disciplinas: T[] }>()

  for (const linha of linhas) {
    let grupo = grupos.get(linha.projeto_id)
    if (!grupo) {
      grupo = { base: linha, disciplinas: [] }
      grupos.set(linha.projeto_id, grupo)
    }
    if (linha.atribuicao_id) grupo.disciplinas.push(linha)
  }

  return Array.from(grupos.values()).map(({ base, disciplinas }) => {
    const ordenadas = disciplinas
      .map((d, i) => ({ d, i }))
      .sort((a, b) =>
        ordemDisciplina(a.d) - ordemDisciplina(b.d) ||
        b.d.dias_atraso - a.d.dias_atraso ||
        a.i - b.i
      )
      .map(({ d }) => d)

    const total = ordenadas.length
    const concluidas = ordenadas.filter(isProjetoConcluido).length
    const progresso = total
      ? ordenadas.reduce((s, d) => s + Number(d.percentual_andamento || 0), 0) / total
      : 0
    const maiorAtraso = ordenadas.reduce((m, d) => Math.max(m, d.dias_atraso || 0), 0)

    let situacao: SituacaoProjeto
    if (total === 0) situacao = 'sem_disciplinas'
    else if (concluidas === total) situacao = 'concluido'
    else if (maiorAtraso > 0) situacao = 'atrasado'
    else if (ordenadas.every((d) => Number(d.percentual_andamento || 0) <= 0)) situacao = 'aguardando'
    else situacao = 'em_andamento'

    const prazosAbertos = ordenadas
      .filter((d) => !isProjetoConcluido(d))
      .map((d) => toDataISO(d.data_prevista))
      .filter((d): d is string => Boolean(d))
      .sort()

    const datasConclusao = ordenadas.map((d) => toDataISO(d.data_conclusao))
    const ordenadasPorData = (datasConclusao.filter(Boolean) as string[]).sort()
    const dataConclusao =
      situacao === 'concluido' && ordenadasPorData.length === total
        ? ordenadasPorData[ordenadasPorData.length - 1]
        : null

    const engenheiros = Array.from(new Set(ordenadas.map((d) => d.engenheiro_nome).filter(Boolean)))

    return {
      projeto_id: base.projeto_id,
      codigo_projeto: base.codigo_projeto,
      cliente: base.cliente,
      descricao: base.descricao,
      linhaBase: base,
      disciplinas: ordenadas,
      total,
      concluidas,
      progresso,
      situacao,
      maiorAtraso,
      proximoPrazo: prazosAbertos[0] ?? null,
      dataConclusao,
      engenheiros,
    }
  })
}

// Regras de vw_bloco1_visao_geral: concluido = todas as disciplinas concluidas; em execucao
// = alguma aberta (inclui os atrasados); atrasado = alguma com prazo vencido e aberta.
export function projetoNaAba(projeto: ProjetoAgrupado, filterStatus: ProjetoStatusFilter): boolean {
  if (filterStatus === 'all') {
    return true
  } else if (filterStatus === 'concluido') {
    return projeto.situacao === 'concluido'
  } else if (filterStatus === 'em_execucao') {
    // Em execucao inclui os atrasados.
    return projeto.total > projeto.concluidas
  } else if (filterStatus === 'atrasado') {
    return projeto.maiorAtraso > 0
  }
  return false
}

export function projetoConcluidoNoPeriodoAgrupado(projeto: ProjetoAgrupado, periodo: PeriodoConclusao) {
  if (!periodoConclusaoAtivo(periodo)) return true
  const data = projeto.dataConclusao
  if (!data) return false
  if (periodo.dataInicio && data < periodo.dataInicio) return false
  if (periodo.dataFim && data > periodo.dataFim) return false
  return true
}

// Lista unica de campos buscaveis: a tabela e o aviso de ocultados precisam concordar.
// Os campos das disciplinas entram todos juntos, entao "joao eletrico" acha o projeto mesmo
// com o Joao numa disciplina e o eletrico em outra, e o engenheiro de uma disciplina ja
// concluida continua achando o projeto na aba Em execucao.
export const camposBusca = (projeto: ProjetoAgrupado) => [
  projeto.codigo_projeto,
  projeto.cliente,
  ...projeto.disciplinas.flatMap((d) => [d.engenheiro_nome, d.area_descricao, getProjetoAreaDisplayName(d)]),
]

/** A busca casou so por campos de disciplina (engenheiro/area): a linha abre sozinha. */
export function buscaCasouPorDisciplina(projeto: ProjetoAgrupado, termo: string): boolean {
  if (!termo.trim()) return false
  return searchScore(termo, [projeto.codigo_projeto, projeto.cliente]) === 0 &&
    searchScore(termo, camposBusca(projeto)) > 0
}

export interface ResultadoFiltroProjetos<T extends DisciplinaLinha> {
  projetos: ProjetoAgrupado<T>[]
  // Concluidos sem data de conclusao nao cabem num recorte por data: a tela lista quem ficou de fora.
  ocultadosSemData: ProjetoAgrupado<T>[]
}

export function filtrarProjetos<T extends DisciplinaLinha>(
  grupos: ProjetoAgrupado<T>[],
  filterStatus: ProjetoStatusFilter,
  termo: string,
  periodo: PeriodoConclusao = {}
): ResultadoFiltroProjetos<T> {
  const periodoAtivo = filterStatus === 'concluido' && periodoConclusaoAtivo(periodo)

  const projetos = grupos
    .map((projeto) => {
      const naAba =
        projetoNaAba(projeto, filterStatus) &&
        (!periodoAtivo || projetoConcluidoNoPeriodoAgrupado(projeto, periodo))
      // Pontuacao de relevancia da busca (0 = nao casa). So pontua se passou no filtro.
      const score = naAba ? searchScore(termo, camposBusca(projeto)) : 0
      return { projeto, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score) // mais relevantes primeiro (empate mantem a ordem)
    .map((e) => e.projeto)

  const ocultadosSemData = periodoAtivo
    ? grupos.filter(
        (p) => p.situacao === 'concluido' && !p.dataConclusao && searchScore(termo, camposBusca(p)) > 0
      )
    : []

  return { projetos, ocultadosSemData }
}
