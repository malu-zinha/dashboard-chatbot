import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ~100 anos: efetivamente bloqueia o login enquanto o usuário está inativo.
const BAN_DURATION = '876000h'

const FALHA_ATUALIZAR = 'Não foi possível atualizar o login. Tente novamente.'

/**
 * PATCH /api/admin/users/[id]
 * Ativa/desativa um login. Desativar NÃO apaga: marca status inactive e
 * bane no Auth (não consegue mais logar). Reativar limpa o ban.
 * Body: { status: 'active' | 'inactive' }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next 15: params chega como Promise.
  const params = await context.params
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  const targetId = params.id
  if (targetId === guard.owner.id) {
    return NextResponse.json(
      { error: 'Você não pode desativar a própria conta de owner.' },
      { status: 400 }
    )
  }

  let body: { status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const status = body.status
  if (status !== 'active' && status !== 'inactive') {
    return NextResponse.json(
      { error: "status deve ser 'active' ou 'inactive'." },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()

    // Garante que o alvo existe e não é outro owner (não mexer em owners).
    // maybeSingle(): antes, `if (targetError || !target)` respondia
    // "Usuário não encontrado." também quando a consulta falhava — o mesmo
    // erro de fundo do "número não cadastrado" no chatbot.
    const { data: target, error: targetError } = await admin
      .from('user_profiles')
      .select('user_id, role')
      .eq('user_id', targetId)
      .maybeSingle()

    if (targetError) {
      const { status: httpStatus, message } = handleApiError(
        'PATCH /admin/users/[id]/lookup',
        targetError,
        FALHA_ATUALIZAR
      )
      return NextResponse.json({ error: message }, { status: httpStatus })
    }
    if (!target) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
    if (target.role === 'owner') {
      return NextResponse.json(
        { error: 'Não é possível alterar o status de um owner.' },
        { status: 400 }
      )
    }

    // 1. Banir / desbanir no Auth.
    const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
      ban_duration: status === 'inactive' ? BAN_DURATION : 'none',
    })
    if (banError) {
      const { status: httpStatus, message } = handleApiError(
        'PATCH /admin/users/[id]/ban',
        banError,
        FALHA_ATUALIZAR
      )
      return NextResponse.json({ error: message }, { status: httpStatus })
    }

    // 2. Atualizar o perfil.
    const { data: profile, error: updateError } = await admin
      .from('user_profiles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('user_id', targetId)
      .select('user_id, email, display_name, role, status, created_at')
      .single()

    if (updateError) {
      const { status: httpStatus, message } = handleApiError(
        'PATCH /admin/users/[id]/update',
        updateError,
        FALHA_ATUALIZAR
      )
      return NextResponse.json({ error: message }, { status: httpStatus })
    }

    return NextResponse.json({ user: profile })
  } catch (error) {
    const { status: httpStatus, message } = handleApiError(
      'PATCH /admin/users/[id]',
      error,
      FALHA_ATUALIZAR
    )
    return NextResponse.json({ error: message }, { status: httpStatus })
  }
}
