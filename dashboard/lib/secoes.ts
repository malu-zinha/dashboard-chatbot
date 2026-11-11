// Secoes do menu lateral do dashboard. A secao ativa fica na URL (?secao=...), entao
// voltar, recarregar e mandar o link funcionam. Funcoes puras: o menu e o painel usam as
// mesmas regras, e os testes conferem quem ve o que.

export type SecaoId = 'visao-geral' | 'projetos' | 'engenheiros' | 'areas' | 'retrabalho' | 'producao'

export interface SecaoInfo {
  id: SecaoId
  titulo: string
  descricao: string
  // Producao e so do dono (a rota de dados tambem exige dono).
  soDono: boolean
}

export const SECOES: SecaoInfo[] = [
  { id: 'visao-geral', titulo: 'Visão geral', descricao: 'Indicadores da produção em tempo real', soDono: false },
  { id: 'projetos', titulo: 'Projetos', descricao: 'Projetos e disciplinas por situação', soDono: false },
  { id: 'engenheiros', titulo: 'Engenheiros', descricao: 'Equipe, carga e tarefas em execução', soDono: false },
  { id: 'areas', titulo: 'Áreas', descricao: 'Disciplinas e taxa de conclusão', soDono: false },
  { id: 'retrabalho', titulo: 'Retrabalho', descricao: 'Horas, motivos e projetos com retrabalho ou paralisação', soDono: false },
  { id: 'producao', titulo: 'Produção', descricao: 'Horas e valores por período', soDono: true },
]

export const SECAO_PADRAO: SecaoId = 'visao-geral'

export function secoesVisiveis(isOwner: boolean): SecaoInfo[] {
  return SECOES.filter((s) => isOwner || !s.soDono)
}

/**
 * Le o ?secao= da URL. Valor desconhecido, ausente ou de dono para quem nao e dono cai na
 * visao geral (quem nao e dono nunca ve a secao de producao, nem digitando a URL).
 */
export function resolverSecao(valor: string | null | undefined, isOwner: boolean): SecaoId {
  const secao = SECOES.find((s) => s.id === valor)
  if (!secao) return SECAO_PADRAO
  if (secao.soDono && !isOwner) return SECAO_PADRAO
  return secao.id
}

export function infoSecao(id: SecaoId): SecaoInfo {
  return SECOES.find((s) => s.id === id) ?? SECOES[0]
}

// Status do grafico "Projetos por status" -> lista de projetos com o filtro equivalente.
export type FiltroProjetos = 'all' | 'concluido' | 'em_execucao' | 'atrasado'

export function filtroDoStatus(status: string): FiltroProjetos {
  const s = status
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
  if (s.startsWith('conclu')) return 'concluido'
  if (s.startsWith('atrasad')) return 'atrasado'
  if (s.includes('andamento') || s.includes('execu')) return 'em_execucao'
  return 'all'
}

// Aba da secao Projetos na URL (?filtro=...). Valor desconhecido = todos.
const FILTROS_PROJETOS: FiltroProjetos[] = ['all', 'em_execucao', 'concluido', 'atrasado']
export function resolverFiltroProjetos(valor: string | null | undefined): FiltroProjetos {
  return FILTROS_PROJETOS.find((f) => f === valor) ?? 'all'
}

// Aba da secao Engenheiros na URL (?aba=...).
export type AbaEngenheiros = 'lista' | 'execucao'
export function resolverAbaEngenheiros(valor: string | null | undefined): AbaEngenheiros {
  return valor === 'execucao' ? 'execucao' : 'lista'
}

/** Monta o endereco do painel: secao + parametros extras (sem os vazios). */
export function urlDaSecao(secao: SecaoId, extras: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams()
  if (secao !== SECAO_PADRAO) params.set('secao', secao)
  for (const [k, v] of Object.entries(extras)) if (v) params.set(k, v)
  const q = params.toString()
  return q ? `/?${q}` : '/'
}
