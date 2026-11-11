// Numeros de retrabalho e paralisacao do relatorio PDF, a partir de retrabalho_projetos.
//
// Antes o PDF usava duas colunas da view vw_relatorio_projeto_pdf que nao mediam o que o
// nome diz: dias_paralisacao lia status_historico (que ninguem alimenta com "parado", entao
// dava sempre 0) e dias_retrabalho contava linhas (misturando paralisacao, ignorando as horas
// e contando duas vezes o mesmo dia quando duas disciplinas relatam). Aqui:
//   - o tipo vem de tipo_retrabalho ('retrabalho' | 'paralisacao'); relato antigo, sem tipo,
//     fica como 'nao_classificado' (o mesmo da tela de Retrabalho);
//   - dias = dias DISTINTOS de data_retrabalho; horas = soma de horas_retrabalho (relato
//     antigo sem horas conta o dia e nao soma hora).

export type TipoOcorrenciaRelatorio = 'retrabalho' | 'paralisacao' | 'nao_classificado'

export const TIPOS_OCORRENCIA: TipoOcorrenciaRelatorio[] = ['retrabalho', 'paralisacao', 'nao_classificado']

export interface LinhaOcorrencia {
  eng_projeto_id: string | null
  data_retrabalho: string | null
  tipo_retrabalho: string | null
  horas_retrabalho: number | string | null
}

export interface ResumoTipo {
  dias: number
  horas: number
}

export type ResumoOcorrencias = Record<TipoOcorrenciaRelatorio, ResumoTipo>

export interface ResumoOcorrenciasProjeto {
  projeto: ResumoOcorrencias
  porDisciplina: Record<string, ResumoOcorrencias>
}

function tipoDaLinha(tipo: string | null): TipoOcorrenciaRelatorio {
  if (tipo === 'retrabalho' || tipo === 'paralisacao') return tipo
  return 'nao_classificado'
}

function acumular(linhas: LinhaOcorrencia[]): ResumoOcorrencias {
  const dias: Record<TipoOcorrenciaRelatorio, Set<string>> = {
    retrabalho: new Set(),
    paralisacao: new Set(),
    nao_classificado: new Set(),
  }
  const horas: Record<TipoOcorrenciaRelatorio, number> = { retrabalho: 0, paralisacao: 0, nao_classificado: 0 }

  for (const linha of linhas) {
    const tipo = tipoDaLinha(linha.tipo_retrabalho)
    const dia = (linha.data_retrabalho ?? '').slice(0, 10)
    if (dia) dias[tipo].add(dia)
    const h = Number(linha.horas_retrabalho)
    if (Number.isFinite(h) && h > 0) horas[tipo] += h
  }

  const resumo = {} as ResumoOcorrencias
  for (const tipo of TIPOS_OCORRENCIA) {
    resumo[tipo] = { dias: dias[tipo].size, horas: Math.round(horas[tipo] * 100) / 100 }
  }
  return resumo
}

export function resumirOcorrencias(linhas: LinhaOcorrencia[]): ResumoOcorrenciasProjeto {
  const porEng = new Map<string, LinhaOcorrencia[]>()
  for (const linha of linhas) {
    if (!linha.eng_projeto_id) continue
    const lista = porEng.get(linha.eng_projeto_id) ?? []
    lista.push(linha)
    porEng.set(linha.eng_projeto_id, lista)
  }

  const porDisciplina: Record<string, ResumoOcorrencias> = {}
  for (const [id, lista] of porEng) porDisciplina[id] = acumular(lista)

  return { projeto: acumular(linhas), porDisciplina }
}

export function resumoVazio(): ResumoOcorrencias {
  return acumular([])
}

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Dias corridos de execucao contando o dia de inicio e o de fim: comecar e terminar no
 * mesmo dia = 1 dia. Sem uma das datas (ou fim antes do inicio) devolve null.
 */
export function diasCorridos(inicio?: string | null, fim?: string | null): number | null {
  const a = DATA_ISO.exec(inicio ?? '')
  const b = DATA_ISO.exec(fim ?? '')
  if (!a || !b) return null
  const t0 = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]))
  const t1 = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]))
  if (t1 < t0) return null
  return Math.round((t1 - t0) / 86_400_000) + 1
}

export function formatarDias(n: number | null): string {
  if (n === null) return '-'
  return `${n} ${n === 1 ? 'dia' : 'dias'}`
}

export function formatarHoras(h: number): string {
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

/** "3 dias · 5,5 h"; sem relato devolve "Nenhum registro". */
export function formatarResumoTipo(r: ResumoTipo): string {
  if (r.dias === 0 && r.horas === 0) return 'Nenhum registro'
  return `${formatarDias(r.dias)} · ${formatarHoras(r.horas)}`
}
