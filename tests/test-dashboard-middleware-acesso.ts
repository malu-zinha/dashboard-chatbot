// =====================================================
// TESTE: decisao de acesso do middleware do dashboard
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-middleware-acesso.ts
//
// Cobre: producao sem as variaveis NEXT_PUBLIC_* (fixadas no build) responde
// 503 em vez de subir com mock; login com status inativo ou sem perfil e
// desconectado; erro ao ler o perfil nao tranca ninguem.
// =====================================================

import assert from 'node:assert/strict'
import type { EntradaAcesso } from '../dashboard/lib/acessoMiddleware.ts'
// dashboard/ e um pacote CommonJS (sem "type": "module"); daqui do ESM da
// raiz o modulo chega como default.
import acessoMiddleware from '../dashboard/lib/acessoMiddleware.ts'

const { decidirAcesso } = acessoMiddleware as typeof import('../dashboard/lib/acessoMiddleware.ts')

let passou = 0
function caso(nome: string, entrada: Partial<EntradaAcesso>, esperado: string) {
  const base: EntradaAcesso = {
    credencialOk: true,
    producao: true,
    logado: true,
    statusPerfil: 'active',
    pathname: '/',
  }
  assert.equal(decidirAcesso({ ...base, ...entrada }), esperado, nome)
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🚪 Middleware do dashboard\n')

caso('producao sem credencial: indisponivel, nao libera', { credencialOk: false }, 'indisponivel')
caso('producao sem credencial vale tambem para /login', { credencialOk: false, pathname: '/login' }, 'indisponivel')
caso('desenvolvimento sem credencial: segue (UI com mock)', { credencialOk: false, producao: false }, 'seguir')

caso('sem sessao em pagina: vai para o login', { logado: false, statusPerfil: null }, 'login')
caso('sem sessao no /login: segue', { logado: false, statusPerfil: null, pathname: '/login' }, 'seguir')
caso('sem sessao em /api: segue (a rota responde 401)', { logado: false, statusPerfil: null, pathname: '/api/admin/users' }, 'seguir')

caso('logado e ativo: segue', {}, 'seguir')
caso('logado e ativo no /login: vai para a home', { pathname: '/login' }, 'home')

caso('logado mas desativado: sai', { statusPerfil: 'inactive' }, 'sair')
caso('logado sem perfil: sai (todo login legitimo tem perfil)', { statusPerfil: 'ausente' }, 'sair')
caso('desativado tentando /api tambem sai', { statusPerfil: 'inactive', pathname: '/api/admin/users' }, 'sair')

// Falha ao ler o perfil nao tranca todo mundo para fora por um soluco do
// banco: o ban no Auth ja impede renovar a sessao; isto so encurta a janela.
caso('logado e perfil ilegivel (erro de banco): segue', { statusPerfil: 'erro' }, 'seguir')

console.log(`\n✅ ${passou} verificacoes passaram\n`)
