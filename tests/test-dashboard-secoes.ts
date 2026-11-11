// =====================================================
// TESTE: secoes do menu lateral (quem ve o que, URL -> secao, status -> lista)
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-secoes.ts
// =====================================================

import assert from 'node:assert/strict'
import * as secNs from '../dashboard/lib/secoes.ts'

const sec = ((secNs as any).default ?? secNs) as typeof import('../dashboard/lib/secoes.ts')
const { secoesVisiveis, resolverSecao, filtroDoStatus, infoSecao } = sec

// Producao e so do dono, no menu e na URL
assert.ok(secoesVisiveis(true).some((s) => s.id === 'producao'))
assert.ok(!secoesVisiveis(false).some((s) => s.id === 'producao'))
assert.equal(resolverSecao('producao', false), 'visao-geral', 'quem nao e dono nao abre producao pela URL')
assert.equal(resolverSecao('producao', true), 'producao')
console.log('   ✅ producao so para o dono, inclusive digitando a URL')

// URL desconhecida ou vazia cai na visao geral
for (const v of [null, undefined, '', 'xyz', 'VISAO-GERAL']) assert.equal(resolverSecao(v as any, true), 'visao-geral')
for (const v of ['projetos', 'engenheiros', 'areas', 'retrabalho']) assert.equal(resolverSecao(v, false), v)
assert.equal(infoSecao('retrabalho').titulo, 'Retrabalho')
console.log('   ✅ ?secao= valido abre a secao; invalido cai na visao geral')

// Fatia do grafico de status -> lista de projetos equivalente aos KPIs
assert.equal(filtroDoStatus('Concluído'), 'concluido')
assert.equal(filtroDoStatus('Em Andamento'), 'em_execucao')
assert.equal(filtroDoStatus('Atrasado'), 'atrasado')
assert.equal(filtroDoStatus('Aguardando'), 'all')
console.log('   ✅ clique no status abre a lista certa')

console.log('test-dashboard-secoes: OK')
