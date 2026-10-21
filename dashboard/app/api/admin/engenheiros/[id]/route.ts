import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import { normalizePhone } from '@/lib/phone'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/admin/engenheiros/[id] — edita ou ativa/desativa um engenheiro
 * do chatbot. Owner only. Desativar (ativo:false) NÃO apaga.
 * Body: { nome?, telefone?, exclusivo?, ativo? }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  // Next 15: params chega como Promise.
  const params = await context.params
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  let body: { nome?: string; telefone?: string; exclusivo?: boolean; ativo?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}

  if (body.nome !== undefined) {
    const nome = body.nome.trim()
    if (!nome) return NextResponse.json({ error: 'Nome não pode ficar vazio.' }, { status: 400 })
    patch.nome = nome
  }

  if (body.telefone !== undefined) {
    const telefone = normalizePhone(body.telefone)
    if (!telefone) {
      return NextResponse.json(
        { error: 'Telefone inválido. Use o formato +55DDDNÚMERO (ex.: +5583991234567).' },
        { status: 400 }
      )
    }
    patch.telefone = telefone
  }

  if (body.exclusivo !== undefined) patch.exclusivo = Boolean(body.exclusivo)
  if (body.ativo !== undefined) patch.ativo = Boolean(body.ativo)

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('engenheiros')
      .update(patch)
      .eq('eng_id', params.id)
      .select('eng_id, nome, telefone, exclusivo, ativo')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe um engenheiro com esse telefone.' },
          { status: 409 }
        )
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Engenheiro não encontrado.' }, { status: 404 })
      }
      const { status, message } = handleApiError(
        'PATCH /admin/engenheiros/[id]',
        error,
        'Não foi possível atualizar o engenheiro. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }
    if (!data) {
      return NextResponse.json({ error: 'Engenheiro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ engenheiro: data })
  } catch (error) {
    const { status, message } = handleApiError(
      'PATCH /admin/engenheiros/[id]',
      error,
      'Não foi possível atualizar o engenheiro. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
