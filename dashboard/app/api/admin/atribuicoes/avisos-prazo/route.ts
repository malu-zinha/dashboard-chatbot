import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseAdmin'
import { guardOwnerRoute } from '@/lib/apiGuard'
import { handleApiError } from '@/lib/apiError'
import type { AvisoPrazoLinha } from '@/lib/avisoPrazo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JANELA_DIAS = 60

/**
 * GET /api/admin/atribuicoes/avisos-prazo
 * Ultimo aviso de prazo alterado por eng_projeto_id (sem telefone nem mensagem).
 */
export async function GET() {
  const guard = await guardOwnerRoute()
  if (!guard.ok) return guard.response

  try {
    const admin = createAdminClient()
    const desde = new Date(Date.now() - JANELA_DIAS * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await admin
      .from('notificacoes_whatsapp')
      .select('eng_projeto_id, created_at, enviada, tentativas, status_entrega, erro_codigo')
      .eq('tipo', 'prazo_alterado')
      .not('eng_projeto_id', 'is', null)
      .gte('created_at', desde)
      .order('created_at', { ascending: false })

    if (error) {
      const { status, message } = handleApiError(
        'GET /admin/atribuicoes/avisos-prazo',
        error,
        'Nao foi possivel carregar os avisos de prazo. Tente novamente.'
      )
      return NextResponse.json({ error: message }, { status })
    }

    // Ordenado do mais recente para o mais antigo: o primeiro de cada projeto vence.
    const vistos = new Set<string>()
    const avisos: AvisoPrazoLinha[] = []
    for (const linha of (data ?? []) as AvisoPrazoLinha[]) {
      if (vistos.has(linha.eng_projeto_id)) continue
      vistos.add(linha.eng_projeto_id)
      avisos.push(linha)
    }

    return NextResponse.json({ avisos })
  } catch (error) {
    const { status, message } = handleApiError(
      'GET /admin/atribuicoes/avisos-prazo',
      error,
      'Nao foi possivel carregar os avisos de prazo. Tente novamente.'
    )
    return NextResponse.json({ error: message }, { status })
  }
}
