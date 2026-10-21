import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { InvalidCredentialError, readCredential } from '@/lib/secrets'
import { decidirAcesso, type StatusPerfil } from '@/lib/acessoMiddleware'

/**
 * Protege todo o dashboard atrás do login. A decisão em si mora em
 * lib/acessoMiddleware.ts (testada sem Next); aqui só se coleta o estado:
 * - sem sessão e fora de /login -> /login (/api responde 401 por conta própria);
 * - logado abrindo /login -> home;
 * - login desativado ou sem perfil -> encerra a sessão e volta ao /login;
 * - produção sem credencial -> 503, nunca um deploy aberto com dados falsos.
 */
export async function middleware(request: NextRequest) {
  const producao = process.env.NODE_ENV === 'production'
  const { pathname } = request.nextUrl

  let url = ''
  let key = ''
  try {
    url = readCredential('NEXT_PUBLIC_SUPABASE_URL')
    key = readCredential('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  } catch (error) {
    // Credencial malformada. A mensagem do InvalidCredentialError nunca inclui
    // o valor; qualquer outra coisa não é logada, para não arriscar vazamento.
    console.error(
      error instanceof InvalidCredentialError
        ? `[middleware] ${error.message}`
        : '[middleware] Credencial Supabase inválida.'
    )
  }

  if (!url || !key) {
    const decisao = decidirAcesso({
      credencialOk: false,
      producao,
      logado: false,
      statusPerfil: null,
      pathname,
    })
    if (decisao === 'indisponivel') {
      return new NextResponse('Serviço indisponível.', { status: 503 })
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let statusPerfil: StatusPerfil = null
  if (user) {
    // A RLS de user_profiles deixa cada um ler só o próprio perfil.
    const { data, error } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) statusPerfil = 'erro'
    else if (!data) statusPerfil = 'ausente'
    else statusPerfil = data.status === 'active' ? 'active' : 'inactive'
  }

  const decisao = decidirAcesso({
    credencialOk: true,
    producao,
    logado: Boolean(user),
    statusPerfil,
    pathname,
  })

  if (decisao === 'seguir') return supabaseResponse

  const redirectUrl = request.nextUrl.clone()

  if (decisao === 'sair') {
    // signOut limpa os cookies via setAll em supabaseResponse; o redirect
    // precisa levar esses cookies, senão a sessão sobrevive no navegador.
    await supabase.auth.signOut()
    redirectUrl.pathname = '/login'
    const redirect = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  redirectUrl.pathname = decisao === 'home' ? '/' : '/login'
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    /*
     * Roda em todas as rotas, exceto estáticos do Next e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
