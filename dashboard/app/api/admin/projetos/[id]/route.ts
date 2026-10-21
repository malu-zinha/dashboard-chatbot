import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
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
