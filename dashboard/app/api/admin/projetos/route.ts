import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import { validarCriarProjeto } from '@/lib/adminProjetos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/admin/projetos
 * Body: { codigo, cliente, descricao }
 *
 * Exige owner; executa criar_projeto com a service role.
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

  const validacao = validarCriarProjeto(body)
  if (!validacao.ok) {
    return NextResponse.json({ error: validacao.error }, { status: 400 })
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('criar_projeto', validacao.args)

    if (error) {
      const { status, message } = handleApiError(
        'POST /admin/projetos',
        error,
        'Nao foi possivel criar o projeto. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    // A RPC recusa (ex.: codigo duplicado) devolvendo sucesso: false. O
    // navegador ignorava isso e anunciava "criado com sucesso".
    if (data && typeof data === 'object' && (data as { sucesso?: boolean }).sucesso === false) {
      const mensagem = (data as { mensagem?: string }).mensagem || 'Nao foi possivel criar o projeto.'
      return NextResponse.json({ error: mensagem, data }, { status: 422 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    const { status, message } = handleApiError(
      'POST /admin/projetos',
      error,
      'Nao foi possivel criar o projeto. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
