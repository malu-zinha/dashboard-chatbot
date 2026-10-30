import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarTodasAsPaginas } from '@/lib/paginacao'
import type { AvisoPrazoLinha } from '@/lib/avisoPrazo'

// Erro de consulta virava [] ou null e a tela mostrava zeros como se fossem dados. Cada falha
// fica registrada aqui; o painel consulta depois de carregar e avisa que os numeros podem
// estar incompletos.
const falhasDeCarga = new Set<string>()

function registrarFalha(origem: string, error: unknown) {
  console.error(`Erro ao buscar ${origem}:`, error)
  falhasDeCarga.add(origem)
}

export function consumirFalhasDeCarga(): string[] {
  const lista = [...falhasDeCarga]
  falhasDeCarga.clear()
  return lista
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || ''

/** Evita chamadas inválidas e WebSocket de Realtime quando o .env não está preenchido. */
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) && /^https?:\/\//i.test(supabaseUrl)

const placeholderUrl = 'https://placeholder.supabase.co'
// NÃO É SEGREDO: chave anon pública de demonstração do Supabase local
// (payload: iss "supabase-demo", role "anon"), publicada na documentação
// oficial. Existe só para o createBrowserClient não quebrar quando o .env não
// está preenchido, junto do placeholderUrl acima. Auditorias de credencial
// costumam sinalizar esta linha — é falso positivo.
const placeholderKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Cliente do browser baseado em cookies (@supabase/ssr). A sessão fica em
// cookie -> compartilhada com o middleware do Next.js, que protege as rotas.
// Quando o usuário está logado, o token de acesso é enviado automaticamente
// nas queries, fazendo a RLS liberar os dados para o papel `authenticated`.
export const supabase: SupabaseClient = createBrowserClient(
  isSupabaseConfigured ? supabaseUrl : placeholderUrl,
  isSupabaseConfigured ? supabaseAnonKey : placeholderKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// Types
export interface VisaoGeral {
  total_projetos: number
  projetos_concluidos: number
  projetos_em_execucao: number
  projetos_atrasados: number
  percentual_concluido_medio: number
  total_areas: number
  areas_concluidas: number
  areas_ativas: number
}

export interface AtrasosEngenheiro {
  eng_id: string
  engenheiro: string
  qtde_projetos_atrasados: number
  qtde_areas_atrasadas: number
  dias_medios_atraso: number
  atraso_maximo_dias: number
}

export interface CargaTrabalho {
  eng_id: string
  engenheiro: string
  exclusivo: boolean
  dias_estimados_totais: number
  percentual_execucao_media: number
  dias_restantes: number
  areas_ativas: number
  projetos_ativos: number
}

export interface RetrabalhoEngenheiro {
  eng_id: string
  engenheiro: string
  qtde_areas_retrabalho: number
  total_retrabalhos: number
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
  retrabalho_medio_percentual: number
  projetos_com_retrabalho: number
}

export interface RetrabalhoGeral {
  total_retrabalhos_geral: number
  total_projetos_ativos: number
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
  percentual_geral_retrabalho: number
}

export interface RetrabalhoPorProjeto {
  projeto_id: string
  codigo_projeto: string
  cliente: string
  total_retrabalhos_projeto: number
  total_engenheiros_projeto: number
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
  percentual_retrabalho_projeto: number
}

export interface RetrabalhoDetalheProjeto {
  retrabalho_id: string
  projeto_id: string
  codigo_projeto: string
  cliente: string
  data_retrabalho: string
  eng_id: string
  engenheiro_nome: string
  motivo_retrabalho: string | null
  horas_trabalhadas_total: number | null
  horas_retrabalho: number | null
  area_id: string
  area_codigo: string
  area_descricao: string
}

export interface RetrabalhoAreaProjeto {
  projeto_id: string
  codigo_projeto: string
  cliente: string
  area_id: string
  area_codigo: string
  area: string
  total_retrabalhos_area: number
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
  percentual_retrabalho_disciplina: number
}

export interface RetrabalhoMotivo {
  motivo_retrabalho: string
  quantidade: number
  engenheiros_afetados?: number
  projetos_afetados?: number
  horas_retrabalho_total?: number
}

export interface RetrabalhoTaxaArea {
  projeto_id: string
  codigo_projeto: string
  cliente: string
  area_id: string
  area_codigo: string
  area: string
  total_retrabalhos_area: number
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
  percentual_retrabalho_disciplina: number
}

export interface ProducaoEngenheiroPeriodo {
  eng_id: string
  engenheiro: string
  horas_trabalhadas_total: number
  horas_retrabalho_total: number
}

export interface ProducaoApontamentoPeriodo {
  eng_id: string
  engenheiro: string
  projeto_id: string
  codigo_projeto: string
  cliente: string
  area_id: string
  area_codigo: string
  area_descricao: string
  instancia_label: string | null
  data_retrabalho: string
  horas_trabalhadas_total: number
  horas_retrabalho: number
}

export interface ProjetosStatus {
  status: string
  quantidade: number
  percentual: number
}

export interface Projeto {
  atribuicao_id?: string
  eng_id?: string | null
  area_id?: string | null
  projeto_id: string
  codigo_projeto: string
  cliente: string
  descricao?: string
  engenheiro_nome: string
  area_codigo?: string
  area_descricao: string
  instancia_label?: string | null
  status_descricao: string
  percentual_andamento: number
  data_inicio?: string
  data_prevista?: string
  data_conclusao?: string | null
  dias_atraso: number
  created_at?: string
  motivo_aguardo?: string
  ativo?: boolean
}

export interface Engenheiro {
  eng_id: string
  nome: string
  exclusivo: boolean
  total_projetos: number
  areas_ativas: number
  media_percentual: number
  total_retrabalhos: number
  dias_trabalho_pendentes: number
  areas_atrasadas: number
  ativo?: boolean
}

export interface Area {
  area_id: string
  codigo: string
  descricao: string
  tempo_trabalho_dias: number
  total_projetos: number
  areas_ativas: number
  areas_concluidas: number
  percentual_conclusao: number
  tem_etapas_pavimento?: boolean
  tem_etapas_globais?: boolean
  ativo?: boolean
}

// Funções para buscar dados
export async function fetchVisaoGeral(): Promise<VisaoGeral | null> {
  const { data, error } = await supabase
    .from('vw_bloco1_visao_geral')
    .select('*')
    .single()

  if (error) {
    registrarFalha('visão geral', error)
    return null
  }

  return data
}

export async function fetchAtrasosEngenheiro(): Promise<AtrasosEngenheiro[]> {
  const { data, error } = await supabase
    .from('vw_bloco2_atrasos_engenheiro')
    .select('*')
    .order('dias_medios_atraso', { ascending: false })

  if (error) {
    registrarFalha('atrasos por engenheiro', error)
    return []
  }

  return data || []
}

export async function fetchCargaTrabalho(): Promise<CargaTrabalho[]> {
  const { data, error } = await supabase
    .from('vw_bloco3_carga_trabalho')
    .select('*')
    .order('dias_restantes', { ascending: false })

  if (error) {
    registrarFalha('carga de trabalho', error)
    return []
  }

  return data || []
}

export async function fetchRetrabalhoEngenheiro(): Promise<RetrabalhoEngenheiro[]> {
  const { data, error } = await supabase
    .from('vw_bloco5_retrabalho_engenheiro')
    .select('*')
    .order('total_retrabalhos', { ascending: false })

  if (error) {
    registrarFalha('retrabalho por engenheiro', error)
    return []
  }

  return data || []
}

export async function fetchRetrabalhoGeral(): Promise<RetrabalhoGeral | null> {
  const { data, error } = await supabase
    .from('vw_retrabalho_geral')
    .select('*')
    .single()

  if (error) {
    registrarFalha('retrabalho geral', error)
    return null
  }

  return data as RetrabalhoGeral
}

export async function fetchRetrabalhoPorProjeto(): Promise<RetrabalhoPorProjeto[]> {
  const { data, error } = await supabase
    .from('vw_retrabalho_por_projeto')
    .select('*')
    .order('percentual_retrabalho_projeto', { ascending: false })

  if (error) {
    registrarFalha('retrabalho por projeto', error)
    return []
  }

  return (data as RetrabalhoPorProjeto[]) || []
}

export async function fetchRetrabalhoDetalhesPorProjeto(
  projetoId: string
): Promise<RetrabalhoDetalheProjeto[]> {
  const { data, error } = await supabase
    .from('vw_retrabalho_detalhes_projeto')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('data_retrabalho', { ascending: false })

  if (error) {
    registrarFalha('detalhes de retrabalho por projeto', error)
    return []
  }

  return (data as RetrabalhoDetalheProjeto[]) || []
}

export async function fetchRetrabalhoAreaPorProjeto(
  projetoId: string
): Promise<RetrabalhoAreaProjeto[]> {
  const { data, error } = await supabase
    .from('vw_retrabalho_por_area_projeto')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('total_retrabalhos_area', { ascending: false })

  if (error) {
    registrarFalha('retrabalho por área do projeto', error)
    return []
  }

  return (data as RetrabalhoAreaProjeto[]) || []
}

export async function fetchRetrabalhoMotivosPorProjeto(
  projetoId: string
): Promise<RetrabalhoMotivo[]> {
  const { data, error } = await supabase
    .from('vw_retrabalho_motivos_por_projeto')
    .select('*')
    .eq('projeto_id', projetoId)
    .order('quantidade', { ascending: false })

  if (error) {
    registrarFalha('motivos de retrabalho por projeto', error)
    return []
  }

  return (data as RetrabalhoMotivo[]) || []
}

export async function fetchRetrabalhoMotivosGeral(): Promise<RetrabalhoMotivo[]> {
  const { data, error } = await supabase
    .from('vw_dono_retrabalhos_por_motivo')
    .select('*')
    .order('quantidade', { ascending: false })

  if (error) {
    registrarFalha('motivos gerais de retrabalho', error)
    return []
  }

  return (data as RetrabalhoMotivo[]) || []
}

export async function fetchRetrabalhoTaxaPorArea(): Promise<RetrabalhoTaxaArea[]> {
  const { data, error } = await supabase
    .from('vw_retrabalho_taxa_area_projeto')
    .select('*')
    .order('percentual_retrabalho_disciplina', { ascending: false })

  if (error) {
    registrarFalha('retrabalho por horas por area', error)
    return []
  }

  return (data as RetrabalhoTaxaArea[]) || []
}

export async function fetchProducaoApontamentosPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<ProducaoApontamentoPeriodo[]> {
  // As horas sao somadas no navegador: sem paginar, passar de 1000 apontamentos no periodo
  // encolhia o total sem aviso. apontamento_id fecha a ordem (paginas sem repetir/pular).
  const { data, error } = await buscarTodasAsPaginas<ProducaoApontamentoPeriodo>((de, ate) =>
    supabase
      .from('vw_dashboard_producao_apontamentos')
      .select(
        'eng_id, engenheiro, projeto_id, codigo_projeto, cliente, area_id, area_codigo, area_descricao, instancia_label, data_retrabalho, horas_trabalhadas_total, horas_retrabalho'
      )
      .gte('data_retrabalho', dataInicio)
      .lte('data_retrabalho', dataFim)
      .order('engenheiro', { ascending: true })
      .order('codigo_projeto', { ascending: true })
      .order('area_descricao', { ascending: true })
      .order('apontamento_id', { ascending: true })
      .range(de, ate)
  )

  // Lanca: o ProducaoPeriodoCard ja tem catch com mensagem; devolver [] mostrava "0h".
  if (error) {
    console.error('Erro ao buscar apontamentos de producao por periodo:', error)
    throw new Error('Falha ao buscar apontamentos de producao por periodo')
  }

  return (data as ProducaoApontamentoPeriodo[]) || []
}

export interface ApontamentoAtribuicao {
  atribuicao_id: string
  data_registro: string
  feito_texto: string | null
}

// Resultado discriminado em vez do [] vazio que o resto do arquivo usa: a tela precisa
// distinguir "a atribuicao nao tem registro" de "nao consegui ler". Colapsar as duas num
// array vazio faria o modal afirmar que nada foi registrado quando so houve falha de rede.
export type ResultadoApontamentos =
  | { ok: true; registros: ApontamentoAtribuicao[] }
  | { ok: false }

// Relato diario que o engenheiro escreve no chatbot, por atribuicao. Vem de uma view
// porque a chave anon do dashboard nao enxerga projetos_previsao direto.
export async function fetchApontamentosAtribuicao(
  atribuicaoId: string
): Promise<ResultadoApontamentos> {
  const { data, error } = await supabase
    .from('vw_atribuicao_apontamentos')
    .select('atribuicao_id, data_registro, feito_texto')
    .eq('atribuicao_id', atribuicaoId)
    .order('data_registro', { ascending: false })

  if (error) {
    console.error('Erro ao buscar apontamentos da atribuicao:', error)
    return { ok: false }
  }

  return { ok: true, registros: (data as ApontamentoAtribuicao[]) || [] }
}

export async function fetchProducaoEngenheiroPeriodo(
  dataInicio: string,
  dataFim: string
): Promise<ProducaoEngenheiroPeriodo[]> {
  const [horasRes, engRes] = await Promise.all([
    supabase
      .from('retrabalho_projetos')
      .select('eng_id, horas_trabalhadas_total, horas_retrabalho')
      .gte('data_retrabalho', dataInicio)
      .lte('data_retrabalho', dataFim),
    supabase.from('engenheiros').select('eng_id, nome'),
  ])

  if (horasRes.error) {
    registrarFalha('producao por periodo', horasRes.error)
    return []
  }

  if (engRes.error) {
    registrarFalha('nomes de engenheiros', engRes.error)
  }

  const nomeMap = new Map((engRes.data || []).map((e) => [e.eng_id, e.nome]))
  const agg = new Map<string, { horas: number; retrabalho: number }>()

  for (const row of horasRes.data || []) {
    if (!row.eng_id) continue
    const horas = Number(row.horas_trabalhadas_total) || 0
    const retrabalho = Number(row.horas_retrabalho) || 0
    const prev = agg.get(row.eng_id) || { horas: 0, retrabalho: 0 }
    prev.horas += horas
    prev.retrabalho += retrabalho
    agg.set(row.eng_id, prev)
  }

  return Array.from(agg.entries())
    .filter(([, v]) => v.horas > 0)
    .map(([eng_id, v]) => ({
      eng_id,
      engenheiro: nomeMap.get(eng_id) || 'Sem nome',
      horas_trabalhadas_total: v.horas,
      horas_retrabalho_total: v.retrabalho,
    }))
    .sort((a, b) => a.engenheiro.localeCompare(b.engenheiro, 'pt-BR'))
}

export async function fetchProjetosStatus(): Promise<ProjetosStatus[]> {
  const { data, error } = await supabase
    .from('vw_grafico_projetos_status')
    .select('*')

  if (error) {
    registrarFalha('projetos por status', error)
    return []
  }

  return data || []
}

export async function fetchProjetos(): Promise<Projeto[]> {
  const { data, error } = await buscarTodasAsPaginas<Projeto>((de, ate) =>
    supabase
      .from('vw_projetos_detalhado')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .order('projeto_id', { ascending: true })
      .order('atribuicao_id', { ascending: true, nullsFirst: true })
      .range(de, ate)
  )

  if (error) {
    registrarFalha('projetos', error)
    return []
  }

  return data || []
}

export async function fetchEngenheiros(): Promise<Engenheiro[]> {
  // Busca engenheiros base + carga de trabalho + retrabalhos em paralelo
  const [engRes, cargaRes, retRes, atrasosRes] = await Promise.all([
    supabase.from('engenheiros').select('*').eq('ativo', true).order('nome', { ascending: true }),
    supabase.from('vw_bloco3_carga_trabalho').select('*'),
    // So dias COM retrabalho: desde 20260728 a tabela guarda todo apontamento diario, e
    // contar linhas inflava o "total de retrabalhos" com dias sem retrabalho. Paginado
    // porque cresce todo dia.
    buscarTodasAsPaginas<{ eng_id: string }>((de, ate) =>
      supabase
        .from('retrabalho_projetos')
        .select('eng_id')
        .eq('necessitou_retrabalho', true)
        .order('id', { ascending: true })
        .range(de, ate)
    ),
    supabase.from('vw_bloco2_atrasos_engenheiro').select('*'),
  ])

  if (engRes.error) {
    registrarFalha('engenheiros', engRes.error)
    return []
  }
  if (cargaRes.error) registrarFalha('carga de trabalho', cargaRes.error)
  if (retRes.error) registrarFalha('retrabalhos', retRes.error)
  if (atrasosRes.error) registrarFalha('atrasos', atrasosRes.error)

  const cargaMap = new Map<string, CargaTrabalho>()
  for (const c of (cargaRes.data || [])) {
    cargaMap.set(c.eng_id, c)
  }

  // Contar retrabalhos por engenheiro
  const retCountMap = new Map<string, number>()
  for (const r of (retRes.data || [])) {
    retCountMap.set(r.eng_id, (retCountMap.get(r.eng_id) || 0) + 1)
  }

  // Atrasos por engenheiro
  const atrasosMap = new Map<string, AtrasosEngenheiro>()
  for (const a of (atrasosRes.data || [])) {
    atrasosMap.set(a.eng_id, a)
  }

  return (engRes.data || []).map((eng): Engenheiro => {
    const carga = cargaMap.get(eng.eng_id)
    const atrasos = atrasosMap.get(eng.eng_id)
    return {
      eng_id: eng.eng_id,
      nome: eng.nome,
      exclusivo: eng.exclusivo,
      total_projetos: carga?.projetos_ativos ?? 0,
      areas_ativas: carga?.areas_ativas ?? 0,
      media_percentual: carga?.percentual_execucao_media ?? 0,
      total_retrabalhos: retCountMap.get(eng.eng_id) ?? 0,
      dias_trabalho_pendentes: carga?.dias_restantes ?? 0,
      areas_atrasadas: atrasos?.qtde_areas_atrasadas ?? 0,
      ativo: eng.ativo,
    }
  })
}

export async function fetchAreas(): Promise<Area[]> {
  // Busca areas base + engenheiros_projetos para agregar
  const [areasRes, epRes, etapasRes] = await Promise.all([
    supabase.from('areas').select('*').eq('ativo', true).order('codigo', { ascending: true }),
    buscarTodasAsPaginas<{ area_id: string; ativo: boolean; data_conclusao: string | null }>((de, ate) =>
      supabase
        .from('engenheiros_projetos')
        .select('area_id, ativo, data_conclusao')
        .eq('ativo', true)
        .order('id', { ascending: true })
        .range(de, ate)
    ),
    supabase.from('area_etapas_template').select('area_id, tipo, ativo').eq('ativo', true),
  ])

  if (areasRes.error) {
    registrarFalha('áreas', areasRes.error)
    return []
  }

  if (epRes.error) registrarFalha('atribuicoes por area', epRes.error)
  if (etapasRes.error) registrarFalha('templates de area', etapasRes.error)

  // Agregar por area_id
  const aggMap = new Map<string, { total: number; ativas: number; concluidas: number }>()
  for (const ep of (epRes.data || [])) {
    const id = ep.area_id
    if (!aggMap.has(id)) aggMap.set(id, { total: 0, ativas: 0, concluidas: 0 })
    const agg = aggMap.get(id)!
    agg.total++
    if (ep.data_conclusao) {
      agg.concluidas++
    } else {
      agg.ativas++
    }
  }

  const templateMap = new Map<string, { pavimento: boolean; global: boolean }>()
  for (const etapa of (etapasRes.data || [])) {
    const id = etapa.area_id
    if (!templateMap.has(id)) templateMap.set(id, { pavimento: false, global: false })
    const flags = templateMap.get(id)!
    if (etapa.tipo === 'pavimento') flags.pavimento = true
    if (etapa.tipo === 'global') flags.global = true
  }

  return (areasRes.data || []).map((area): Area => {
    const agg = aggMap.get(area.area_id) || { total: 0, ativas: 0, concluidas: 0 }
    const templateFlags = templateMap.get(area.area_id) || { pavimento: false, global: false }
    return {
      area_id: area.area_id,
      codigo: area.codigo,
      descricao: area.descricao,
      tempo_trabalho_dias: area.tempo_trabalho_dias,
      total_projetos: agg.total,
      areas_ativas: agg.ativas,
      areas_concluidas: agg.concluidas,
      percentual_conclusao: agg.total > 0 ? (agg.concluidas / agg.total) * 100 : 0,
      tem_etapas_pavimento: templateFlags.pavimento,
      tem_etapas_globais: templateFlags.global,
      ativo: area.ativo,
    }
  })
}

export interface AtribuirProjetoComPavimentosParams {
  codigo_projeto: string
  cliente: string
  descricao?: string
  area_id: string | number
  eng_id: string
  complexidade: 'baixa' | 'media' | 'alta'
  data_prevista: string
  pavimentos?: string[]
  instancia_label?: string
  complemento_area_ref_id?: string | number
}

export async function atribuirProjetoComPavimentos(
  params: AtribuirProjetoComPavimentosParams
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Vai pelo servidor (/api/admin/atribuicoes), que exige owner.
  const response = await fetch('/api/admin/atribuicoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data: json?.data,
      error: json?.error || 'Nao foi possivel atribuir o projeto. Tente novamente.',
    }
  }

  return { success: true, data: json?.data }
}

export async function transferirResponsavelAtribuicao(
  atribuicaoId: string,
  novoEngId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(`/api/admin/atribuicoes/${atribuicaoId}/responsavel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novo_eng_id: novoEngId }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao alterar responsavel da tarefa.',
    }
  }

  return { success: true, data }
}

export async function alterarPrazoAtribuicao(
  atribuicaoId: string,
  novoPrazo: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(`/api/admin/atribuicoes/${atribuicaoId}/prazo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ novo_prazo: novoPrazo }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao alterar prazo da tarefa.',
    }
  }

  return { success: true, data }
}

export async function alterarDadosProjeto(
  projetoId: string,
  dados: { cliente: string; descricao: string | null }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(`/api/admin/projetos/${projetoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao alterar os dados do projeto.',
    }
  }

  return { success: true, data }
}

export async function buscarAvisosPrazo(): Promise<AvisoPrazoLinha[]> {
  try {
    const response = await fetch('/api/admin/atribuicoes/avisos-prazo', { cache: 'no-store' })
    if (!response.ok) return []
    const json = await response.json().catch(() => null)
    return Array.isArray(json?.avisos) ? (json.avisos as AvisoPrazoLinha[]) : []
  } catch {
    return []
  }
}

export async function excluirAtribuicao(
  atribuicaoId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(`/api/admin/atribuicoes/${atribuicaoId}`, {
    method: 'DELETE',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao excluir tarefa.',
    }
  }

  return { success: true, data }
}

export interface AtribuicaoInfo {
  ok: boolean
  atribuicao_id?: string
  projeto_id?: string
  codigo_projeto?: string
  area_descricao?: string
  engenheiro_nome?: string
  total_disciplinas_ativas?: number
  is_ultima_disciplina?: boolean
  codigo?: string
  mensagem?: string
}

export async function verificarAtribuicaoInfo(
  atribuicaoId: string
): Promise<{ success: boolean; data?: AtribuicaoInfo; error?: string }> {
  const response = await fetch(`/api/admin/atribuicoes/${atribuicaoId}/info`, {
    method: 'GET',
  })

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data: json?.result,
      error: json?.error || 'Erro ao verificar informacoes da tarefa.',
    }
  }

  return { success: true, data: json?.result }
}

export async function excluirProjeto(
  projetoId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await fetch(`/api/admin/projetos/${projetoId}`, {
    method: 'DELETE',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao excluir projeto.',
    }
  }

  return { success: true, data }
}

export interface RelatorioProjetoData {
  projeto_id: string
  codigo_projeto: string
  cliente: string
  descricao: string | null
  percentual_projeto: number
  data_inicio_projeto: string | null
  data_conclusao_projeto: string | null
  dias_execucao_total: number
  total_engenheiros: number
  total_disciplinas: number
  disciplinas_concluidas: number
  dias_retrabalho: number
  dias_paralisacao: number
  projeto_criado_em: string
}

export interface DisciplinaRelatorio {
  eng_projeto_id: string
  engenheiro_nome: string
  area_descricao: string
  area_codigo: string
  instancia_label: string | null
  data_inicio: string | null
  data_conclusao: string | null
  data_prevista: string | null
  percentual_ponderado: number
  dias_execucao: number
  dias_retrabalho: number
}

export interface RelatorioProjetoResponse {
  relatorio: RelatorioProjetoData
  disciplinas: DisciplinaRelatorio[]
  gerado_em: string
}

export async function fetchRelatorioProjetoPdf(
  projetoId: string
): Promise<{ success: boolean; data?: RelatorioProjetoResponse; error?: string }> {
  const response = await fetch(`/api/admin/projetos/${projetoId}/relatorio`, {
    method: 'GET',
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data,
      error: data?.error || 'Erro ao buscar dados do relatorio.',
    }
  }

  return { success: true, data }
}

export async function criarProjeto(params: {
  codigo: string
  cliente: string
  descricao: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  // Vai pelo servidor (/api/admin/projetos), que exige owner.
  const response = await fetch('/api/admin/projetos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  const json = await response.json().catch(() => null)
  if (!response.ok) {
    return {
      success: false,
      data: json?.data,
      error: json?.error || 'Nao foi possivel criar o projeto. Tente novamente.',
    }
  }

  return { success: true, data: json?.data }
}

// Setup realtime subscriptions
export function subscribeToChanges(
  table: string,
  callback: () => void,
  onStatus?: (conectado: boolean) => void
) {
  if (!isSupabaseConfigured) {
    return null
  }

  const channel = supabase
    .channel(`realtime-${table}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: table,
      },
      () => {
        callback()
      }
    )
    // SUBSCRIBED = recebendo eventos; CHANNEL_ERROR, TIMED_OUT e CLOSED = nao.
    .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'))

  return channel
}



