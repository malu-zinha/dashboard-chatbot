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
  validateAlterarPrazoBody,
  type AtribuicaoActionResult,
} from '@/lib/adminAtribuicoes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/atribuicoes/[id]/prazo
 * Body: { novo_prazo }
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
    return NextResponse.json({ error: 'Tarefa invalida.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalido.' }, { status: 400 })
  }

  const validation = validateAlterarPrazoBody(body)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('alterar_prazo_atribuicao', {
      p_atribuicao_id: params.id,
      p_novo_prazo: validation.novoPrazo,
      p_actor_user_id: guard.owner.id,
    })

    if (error) {
      const { status, message } = handleApiError(
        'PATCH /admin/atribuicoes/[id]/prazo',
        error,
        'Nao foi possivel alterar o prazo. Tente novamente.'
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
      'PATCH /admin/atribuicoes/[id]/prazo',
      error,
      'Nao foi possivel alterar o prazo. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
