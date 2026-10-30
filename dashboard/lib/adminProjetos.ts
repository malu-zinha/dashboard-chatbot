// Validação e montagem dos argumentos das RPCs de criar e atribuir projeto,
// usadas pelas rotas /api/admin/projetos e /api/admin/atribuicoes (só owner,
// service role). Sem Next aqui, para ser testável direto.
//
// Import relativo (não '@/'): os testes da raiz carregam este arquivo via tsx.
import { isUuid } from './adminAtribuicoes'

type Resultado<T> = { ok: true; args: T } | { ok: false; error: string }

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

function objeto(body: unknown): Record<string, unknown> | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null
}

export interface ArgsCriarProjeto {
  p_codigo: string
  p_cliente: string
  p_descricao: string
}

export function validarCriarProjeto(body: unknown): Resultado<ArgsCriarProjeto> {
  const b = objeto(body)
  if (!b) return { ok: false, error: 'Dados invalidos.' }

  const codigo = texto(b.codigo)
  const cliente = texto(b.cliente)
  if (!codigo) return { ok: false, error: 'Informe o codigo do projeto.' }
  if (!cliente) return { ok: false, error: 'Informe o cliente.' }

  return { ok: true, args: { p_codigo: codigo, p_cliente: cliente, p_descricao: texto(b.descricao) } }
}

export interface DadosProjeto {
  cliente: string
  // Ausente = nao mexe na descricao; null = apaga.
  descricao?: string | null
}

const MIN_CLIENTE = 2
const MAX_CLIENTE = 200
const MIN_DESCRICAO = 3
const MAX_DESCRICAO = 1000

// Cliente e descricao valem para o projeto inteiro (todas as disciplinas).
// O codigo nao muda por aqui. Minimos iguais aos do formulario de criar projeto.
export function validarAlterarDadosProjeto(
  body: unknown
): { ok: true; dados: DadosProjeto } | { ok: false; error: string } {
  const b = objeto(body)
  if (!b) return { ok: false, error: 'Dados invalidos.' }
  if (typeof b.cliente !== 'string') return { ok: false, error: 'Informe o cliente.' }
  if (b.descricao !== undefined && b.descricao !== null && typeof b.descricao !== 'string') {
    return { ok: false, error: 'Descricao invalida.' }
  }

  const cliente = texto(b.cliente)
  if (!cliente) return { ok: false, error: 'Informe o cliente.' }
  if (cliente.length < MIN_CLIENTE) {
    return { ok: false, error: `O cliente deve ter pelo menos ${MIN_CLIENTE} caracteres.` }
  }
  if (cliente.length > MAX_CLIENTE) return { ok: false, error: `Cliente muito longo (max. ${MAX_CLIENTE} caracteres).` }

  if (b.descricao === undefined) return { ok: true, dados: { cliente } }

  const descricao = texto(b.descricao)
  if (descricao && descricao.length < MIN_DESCRICAO) {
    return { ok: false, error: `A descricao deve ter pelo menos ${MIN_DESCRICAO} caracteres.` }
  }
  if (descricao.length > MAX_DESCRICAO) {
    return { ok: false, error: `Descricao muito longa (max. ${MAX_DESCRICAO} caracteres).` }
  }

  return { ok: true, dados: { cliente, descricao: descricao || null } }
}

// Unico objeto que a rota grava em projetos: so cliente, descricao (se veio)
// e updated_at. Nada do corpo da requisicao passa direto.
export function camposAtualizacaoProjeto(
  dados: DadosProjeto,
  agoraISO: string
): { cliente: string; descricao?: string | null; updated_at: string } {
  return dados.descricao === undefined
    ? { cliente: dados.cliente, updated_at: agoraISO }
    : { cliente: dados.cliente, descricao: dados.descricao, updated_at: agoraISO }
}

const COMPLEXIDADE = { baixa: 'SIMPLES', media: 'MEDIA', alta: 'COMPLEXA' } as const

export interface ArgsAtribuirProjeto {
  p_codigo_projeto: string
  p_cliente: string
  p_descricao: string | null
  p_area_id: string
  p_eng_id: string
  p_complexidade_codigo: string
  p_data_conclusao_prevista: string | null
  p_pavimentos: string[]
  p_instancia_label: string | null
  p_complemento_area_ref_id: string | null
}

// Mesmo mapeamento que lib/supabase.ts fazia no navegador.
export function montarArgsAtribuirProjeto(body: unknown): Resultado<ArgsAtribuirProjeto> {
  const b = objeto(body)
  if (!b) return { ok: false, error: 'Dados invalidos.' }

  const codigo = texto(b.codigo_projeto)
  const cliente = texto(b.cliente)
  const areaId = b.area_id === undefined || b.area_id === null ? '' : String(b.area_id).trim()
  const engId = texto(b.eng_id)

  if (!codigo) return { ok: false, error: 'Informe o codigo do projeto.' }
  if (!cliente) return { ok: false, error: 'Informe o cliente.' }
  if (!areaId) return { ok: false, error: 'Informe a disciplina.' }
  if (!isUuid(engId)) return { ok: false, error: 'Engenheiro invalido.' }

  let pavimentos: string[] = []
  if (b.pavimentos !== undefined && b.pavimentos !== null) {
    if (!Array.isArray(b.pavimentos) || !b.pavimentos.every((p) => typeof p === 'string')) {
      return { ok: false, error: 'Pavimentos invalidos.' }
    }
    pavimentos = b.pavimentos as string[]
  }

  const complexidade = COMPLEXIDADE[texto(b.complexidade) as keyof typeof COMPLEXIDADE] ?? 'MEDIA'
  const ref = b.complemento_area_ref_id

  return {
    ok: true,
    args: {
      p_codigo_projeto: codigo,
      p_cliente: cliente,
      p_descricao: texto(b.descricao) || null,
      p_area_id: areaId,
      p_eng_id: engId,
      p_complexidade_codigo: complexidade,
      p_data_conclusao_prevista: texto(b.data_prevista) || null,
      p_pavimentos: pavimentos,
      p_instancia_label: texto(b.instancia_label) || null,
      p_complemento_area_ref_id: ref ? String(ref) : null,
    },
  }
}
