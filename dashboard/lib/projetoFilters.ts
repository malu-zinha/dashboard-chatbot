import { toDataISO } from './datas'

export type ProjetoStatusFilter = 'all' | 'concluido' | 'em_execucao' | 'atrasado'

export interface ProjetoFilterLike {
  data_conclusao?: string | null
  percentual_andamento: number
  dias_atraso: number
}

export function isProjetoConcluido(item: ProjetoFilterLike) {
  return Boolean(item.data_conclusao) || item.percentual_andamento >= 100
}

export function projetoMatchesStatusFilter(
  item: ProjetoFilterLike,
  filterStatus: ProjetoStatusFilter
) {
  if (filterStatus === 'all') return true

  if (filterStatus === 'concluido') {
    return isProjetoConcluido(item)
  }

  if (filterStatus === 'em_execucao') {
    return !isProjetoConcluido(item)
  }

  if (filterStatus === 'atrasado') {
    return item.dias_atraso > 0
  }

  return false
}

export interface PeriodoConclusao {
  dataInicio?: string
  dataFim?: string
}

export function periodoConclusaoAtivo(periodo: PeriodoConclusao) {
  return Boolean(periodo.dataInicio || periodo.dataFim)
}

// Comparacao lexicografica de 'YYYY-MM-DD', como em producaoPeriodo.isApontamentoNoPeriodo.
// Os limites sao inclusivos e os inputs type="date" ja produzem exatamente esse formato.
// Um concluido sem data_conclusao (so pelo percentual) nunca casa com um periodo: nao da
// para afirmar que ele caiu dentro do recorte. Quem precisa dele usa particionar...().
export function projetoConcluidoNoPeriodo(item: ProjetoFilterLike, periodo: PeriodoConclusao) {
  if (!periodoConclusaoAtivo(periodo)) return true

  const dataConclusao = toDataISO(item.data_conclusao)
  if (!dataConclusao) return false

  if (periodo.dataInicio && dataConclusao < periodo.dataInicio) return false
  if (periodo.dataFim && dataConclusao > periodo.dataFim) return false
  return true
}

// Separa o que o periodo esconde para que a tela possa dizer quem ficou de fora,
// em vez de deixar o projeto sumir sem explicacao.
export function particionarPorPeriodoConclusao<T extends ProjetoFilterLike>(
  itens: T[],
  periodo: PeriodoConclusao
): { dentro: T[]; ocultadosSemData: T[] } {
  if (!periodoConclusaoAtivo(periodo)) {
    return { dentro: itens, ocultadosSemData: [] }
  }

  const dentro: T[] = []
  const ocultadosSemData: T[] = []

  for (const item of itens) {
    if (!toDataISO(item.data_conclusao)) {
      ocultadosSemData.push(item)
    } else if (projetoConcluidoNoPeriodo(item, periodo)) {
      dentro.push(item)
    }
  }

  return { dentro, ocultadosSemData }
}
