import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import { validarAlterarDadosProjeto } from '@/lib/adminProjetos'
import {
  getAtribuicaoActionMessage,
  getAtribuicaoActionStatus,
  isAtribuicaoActionSuccess,
  isUuid,
  sanitizeAtribuicaoActionResult,
  type AtribuicaoActionResult,
} from '@/lib/adminAtribuicoes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * DELETE /api/admin/projetos/[id]
 * Deactivates a project and all its attributions/tasks
 */
export async function DELETE(
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
    const { data, error } = await admin.rpc('desativar_projeto_completo', {
      p_projeto_id: params.id,
      p_origem: 'dashboard',
      p_actor_user_id: guard.owner.id,
    })

    if (error) {
      const { status, message } = handleApiError(
        'DELETE /admin/projetos/[id]',
        error,
        'Nao foi possivel excluir o projeto. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    const result = data as AtribuicaoActionResult
    if (!isAtribuicaoActionSuccess(result)) {
      return NextResponse.json(
        {
          error: getAtribuicaoActionMessage(result),
          result: sanitizeAtribuicaoActionResult(result),
        },
        { status: getAtribuicaoActionStatus(result) }
      )
    }

    return NextResponse.json({ result })
  } catch (error) {
    const { status, message } = handleApiError(
      'DELETE /admin/projetos/[id]',
      error,
      'Nao foi possivel excluir o projeto. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * PATCH /api/admin/projetos/[id]
 * Body: { cliente, descricao? } — vale para o projeto inteiro (todas as
 * disciplinas). O codigo do projeto nao muda por aqui.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next 15: params chega como Promise.
  const params = await context.params
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  if (!isUuid(params.id)) {
    return NextResponse.json({ error: 'Projeto invalido.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const validation = validarAlterarDadosProjeto(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('projetos')
      .update({
        cliente: validation.dados.cliente,
        descricao: validation.dados.descricao,
        updated_at: new Date().toISOString(),
      })
      .eq('projeto_id', params.id)
      .eq('ativo', true)
      .select('projeto_id, cliente, descricao')

    if (error) {
      const { status, message } = handleApiError(
        'PATCH /admin/projetos/[id]',
        error,
        'Nao foi possivel alterar os dados do projeto. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    const projeto = data?.[0]
    if (!projeto) {
      return NextResponse.json({ error: 'Projeto nao encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ projeto })
  } catch (error) {
    const { status, message } = handleApiError(
      'PATCH /admin/projetos/[id]',
      error,
      'Nao foi possivel alterar os dados do projeto. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
