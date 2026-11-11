import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import { isUuid } from '@/lib/adminAtribuicoes'
import { resumirOcorrencias, resumoVazio, type ResumoOcorrencias } from '@/lib/relatorioOcorrencias'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  // Retrabalho e paralisacao desta disciplina, por tipo (de retrabalho_projetos).
  ocorrencias?: ResumoOcorrencias
}

/**
 * GET /api/admin/projetos/[id]/relatorio
 * Returns metrics for PDF report generation
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next 15: params chega como Promise.
  const params = await context.params
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Projeto invalido.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // Buscar metricas agregadas do projeto
    const { data: relatorio, error: errorRelatorio } = await admin
      .from('vw_relatorio_projeto_pdf')
      .select('*')
      .eq('projeto_id', params.id)
      .single()

    if (errorRelatorio) {
      if (errorRelatorio.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Projeto nao encontrado.' },
          { status: 404 }
        )
      }
      const { status, message } = handleApiError(
        'GET /admin/projetos/[id]/relatorio',
        errorRelatorio,
        'Nao foi possivel carregar os dados do relatorio.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    // Buscar detalhamento por disciplina
    const { data: disciplinas, error: errorDisciplinas } = await admin
      .from('vw_relatorio_disciplinas_projeto')
      .select('*')
      .eq('projeto_id', params.id)
      .order('data_inicio', { ascending: true, nullsFirst: false })

    if (errorDisciplinas) {
      const { status, message } = handleApiError(
        'GET /admin/projetos/[id]/relatorio/disciplinas',
        errorDisciplinas,
        'Nao foi possivel carregar os dados do relatorio.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    // Retrabalho e paralisacao vem dos relatos (retrabalho_projetos), separados por tipo.
    // As colunas dias_retrabalho/dias_paralisacao da view continuam na resposta, mas o PDF
    // nao as usa: dias_paralisacao le status_historico (sempre 0) e dias_retrabalho conta
    // linhas, misturando os dois tipos. Detalhe em lib/relatorioOcorrencias.ts.
    const { data: relatos, error: errorRelatos } = await admin
      .from('retrabalho_projetos')
      .select('eng_projeto_id, data_retrabalho, tipo_retrabalho, horas_retrabalho')
      .eq('projeto_id', params.id)
      .eq('necessitou_retrabalho', true)

    if (errorRelatos) {
      const { status, message } = handleApiError(
        'GET /admin/projetos/[id]/relatorio/ocorrencias',
        errorRelatos,
        'Nao foi possivel carregar os dados do relatorio.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    const ocorrencias = resumirOcorrencias(relatos || [])
    // Relatos de disciplina desativada (removida ou transferida) contam no projeto, mas a
    // disciplina nao aparece na tabela do PDF: o PDF avisa.
    const idsAtivos = new Set(((disciplinas || []) as DisciplinaRelatorio[]).map((d) => d.eng_projeto_id))
    const relatosForaDasDisciplinas = (relatos || []).filter(
      (r) => !r.eng_projeto_id || !idsAtivos.has(r.eng_projeto_id)
    ).length

    return NextResponse.json({
      relatorio: relatorio as RelatorioProjetoData,
      disciplinas: ((disciplinas || []) as DisciplinaRelatorio[]).map((d) => ({
        ...d,
        ocorrencias: ocorrencias.porDisciplina[d.eng_projeto_id] ?? resumoVazio(),
      })),
      ocorrencias: ocorrencias.projeto,
      relatos_fora_das_disciplinas: relatosForaDasDisciplinas,
      gerado_em: new Date().toISOString(),
    })
  } catch (error) {
    const { status, message } = handleApiError(
      'GET /admin/projetos/[id]/relatorio',
      error,
      'Nao foi possivel carregar os dados do relatorio.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
