import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import { montarArgsAtribuirProjeto } from '@/lib/adminProjetos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/atribuicoes
 * Body: { codigo_projeto, cliente, descricao?, area_id, eng_id, complexidade,
 *         data_prevista, pavimentos?, instancia_label?, complemento_area_ref_id? }
 *
 * Exige owner; executa dashboard_atribuir_projeto_com_pavimentos com a
 * service role.
 */
export async function POST(request: Request) {
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const montagem = montarArgsAtribuirProjeto(body)
  if (!montagem.ok) {
    return NextResponse.json({ error: montagem.error }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('dashboard_atribuir_projeto_com_pavimentos', montagem.args)

    if (error) {
      const { status, message } = handleApiError(
        'POST /admin/atribuicoes',
        error,
        'Nao foi possivel atribuir o projeto. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    // Mensagem de negocio da propria RPC: essa e escrita para o usuario.
    if (data && typeof data === 'object' && (data as { sucesso?: boolean }).sucesso === false) {
      const mensagem = (data as { mensagem?: string }).mensagem || 'Falha ao atribuir projeto'
      return NextResponse.json({ error: mensagem, data }, { status: 422 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    const { status, message } = handleApiError(
      'POST /admin/atribuicoes',
      error,
      'Nao foi possivel atribuir o projeto. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
