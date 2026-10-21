import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { logServerError } from '@/lib/apiError'
import { readCredential } from '@/lib/secrets'

/**
 * Cliente do Supabase baseado nos cookies da requisição (sessão do usuário
 * logado). Usa a ANON key + token do usuário -> respeita a RLS. Serve para
 * Server Components e Route Handlers identificarem QUEM está chamando.
 */
export async function createServerSupabase(): Promise<SupabaseClient> {
  // readCredential faz trim e rejeita \r\n antes de o valor virar header.
  const url = readCredential('NEXT_PUBLIC_SUPABASE_URL')
  const key = readCredential('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  // Next 15: cookies() e assincrono.
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Components não podem setar cookies — ignorado de propósito.
          // O middleware já cuida de renovar a sessão nas navegações.
        }
      },
    },
  })
}

/**
 * Resultado da verificação de owner.
 *
 * `unavailable` existe pelo mesmo motivo do SupabaseUnavailableError no
 * chatbot: uma falha de rede ou de RLS não é o mesmo que "você não tem
 * permissão". Antes as duas coisas viravam `null` e o owner legítimo recebia
 * 403 "Acesso negado." durante a indisponibilidade.
 */
export type OwnerCheck =
  | { ok: true; user: User }
  | { ok: false; reason: 'unauthorized' | 'unavailable' }

/**
 * Verifica se o usuário autenticado é o owner ativo da plataforma.
 * É a guarda de segurança das rotas de admin.
 */
export async function getOwnerOrError(): Promise<OwnerCheck> {
  try {
    // Pode lançar InvalidCredentialError se a env estiver malformada — cai no
    // catch abaixo como 'unavailable', que é exatamente o que é.
    const supabase = await createServerSupabase()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    // Qualquer falha de auth continua sendo tratada como "não autorizado",
    // exatamente como antes: o caso esmagadoramente comum é simplesmente não
    // haver sessão, e responder 503 aqui quebraria o redirect para o login.
    // O `unavailable` fica reservado para a consulta ao perfil, abaixo — que é
    // onde o falso "Acesso negado." acontecia de fato.
    if (authError || !user) return { ok: false, reason: 'unauthorized' }

    // maybeSingle(): 0 linhas devolve data null sem erro, então `error` volta
    // a significar apenas falha real da consulta.
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, status')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      logServerError('getOwnerOrError/profile', error)
      return { ok: false, reason: 'unavailable' }
    }

    if (!profile) return { ok: false, reason: 'unauthorized' }
    if (profile.role !== 'owner' || profile.status !== 'active') {
      return { ok: false, reason: 'unauthorized' }
    }

    return { ok: true, user }
  } catch (error) {
    logServerError('getOwnerOrError', error)
    return { ok: false, reason: 'unavailable' }
  }
}

/**
 * Retorna o usuário autenticado SE ele for o owner ativo; caso contrário null.
 *
 * Mantido para compatibilidade com chamadores que não precisam distinguir
 * "não autorizado" de "indisponível". Rotas de API devem usar
 * getOwnerOrError() para responder 503 em vez de 403 quando o banco falha.
 */
export async function getOwnerOrNull(): Promise<User | null> {
  const result = await getOwnerOrError()
  return result.ok ? result.user : null
}
