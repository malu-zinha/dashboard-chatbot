/**
 * Decisão de acesso do middleware, sem nada de Next — para ser testável
 * direto (tests/test-dashboard-middleware-acesso.ts).
 */

/** O que o middleware descobriu sobre o perfil do usuário logado. */
export type StatusPerfil = 'active' | 'inactive' | 'ausente' | 'erro' | null

export interface EntradaAcesso {
  /** NEXT_PUBLIC_SUPABASE_URL/ANON_KEY presentes e bem formadas. */
  credencialOk: boolean
  producao: boolean
  logado: boolean
  /** null quando não há sessão. */
  statusPerfil: StatusPerfil
  pathname: string
}

export type DecisaoAcesso = 'seguir' | 'login' | 'home' | 'sair' | 'indisponivel'

export function decidirAcesso(e: EntradaAcesso): DecisaoAcesso {
  if (!e.credencialOk) {
    // NEXT_PUBLIC_* são fixadas no build: um build sem elas virava um deploy
    // aberto e com dados falsos. Em produção, fecha. Em dev, deixa a UI subir
    // com mock para quem só mexe em tela.
    return e.producao ? 'indisponivel' : 'seguir'
  }

  const isLogin = e.pathname.startsWith('/login')
  const isApi = e.pathname.startsWith('/api')

  if (!e.logado) {
    // /api responde 401 por conta própria, em vez de HTML de redirect.
    return isLogin || isApi ? 'seguir' : 'login'
  }

  // Desativar o login marca status inactive e bane no Auth, mas o token já
  // emitido segue válido até expirar. Sem perfil também não entra: todo login
  // legítimo é criado junto com o perfil. Erro ao ler o perfil não tranca
  // ninguém — o ban no Auth já impede renovar a sessão.
  if (e.statusPerfil === 'inactive' || e.statusPerfil === 'ausente') return 'sair'

  return isLogin ? 'home' : 'seguir'
}
