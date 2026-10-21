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
 * GET /api/admin/atribuicoes/[id]/info
 * Returns info about the attribution, including if it's the last active discipline
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
    return NextResponse.json({ error: 'Tarefa invalida.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('verificar_atribuicao_info', {
      p_atribuicao_id: params.id,
    })

    if (error) {
      const { status, message } = handleApiError(
        'GET /admin/atribuicoes/[id]/info',
        error,
        'Nao foi possivel carregar as informacoes da tarefa.'
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
      'GET /admin/atribuicoes/[id]/info',
      error,
      'Nao foi possivel carregar as informacoes da tarefa.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
