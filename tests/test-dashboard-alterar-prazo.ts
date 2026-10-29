// =====================================================
// TESTE: regras puras de alterar prazo (validacao, status HTTP, icone do aviso)
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-alterar-prazo.ts
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as atribNs from '../dashboard/lib/adminAtribuicoes.ts'
import * as avisoNs from '../dashboard/lib/avisoPrazo.ts'

const atrib = ((atribNs as any).default ?? atribNs) as typeof import('../dashboard/lib/adminAtribuicoes.ts')
const aviso = ((avisoNs as any).default ?? avisoNs) as typeof import('../dashboard/lib/avisoPrazo.ts')
const { validateAlterarPrazoBody, getAtribuicaoActionStatus } = atrib
const { estadoAvisoPrazo, temAvisoEnviando, avisoValeParaPrazo } = aviso

assert.deepEqual(validateAlterarPrazoBody({ novo_prazo: '2026-11-20' }), { ok: true, novoPrazo: '2026-11-20' })
for (const ruim of [null, {}, { novo_prazo: '' }, { novo_prazo: '20/11/2026' }, { novo_prazo: '2026-02-30' }, { novo_prazo: '2026-13-01' }, { novo_prazo: 20261120 }])
  assert.equal(validateAlterarPrazoBody(ruim).ok, false)
assert.equal(getAtribuicaoActionStatus({ ok: false, codigo: 'concluida' }), 409)
assert.equal(getAtribuicaoActionStatus({ ok: false, codigo: 'sem_mudanca' }), 409)
assert.equal(getAtribuicaoActionStatus({ ok: false, codigo: 'duplicata' }), 409)

const base = { eng_projeto_id: 'a', created_at: '2026-10-29T12:00:00Z', enviada: false, tentativas: 0, status_entrega: null, erro_codigo: null, prazo_avisado: '2026-11-20' }
const t1 = Date.parse('2026-10-29T12:01:00Z'), t11 = Date.parse('2026-10-29T12:11:00Z')
assert.equal(estadoAvisoPrazo(base, t1).icone, 'enviando')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'enviado' }, t1).icone, 'enviando')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'sent' }, t1).icone, 'enviando')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'enviado' }, t11).icone, 'enviado')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'sent' }, t11).icone, 'enviado')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'delivered' }, t1).icone, 'entregue')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'read' }, t1).icone, 'entregue')
assert.deepEqual(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'undelivered', erro_codigo: '63016' }, t1),
  { icone: 'falhou', texto: 'Aviso não entregue: o engenheiro não fala com o bot há mais de 24h' })
assert.deepEqual(estadoAvisoPrazo({ ...base, status_entrega: 'sem_telefone' }, t1),
  { icone: 'falhou', texto: 'Aviso não enviado: engenheiro sem telefone cadastrado' })
assert.equal(estadoAvisoPrazo({ ...base, tentativas: 5 }, t1).icone, 'falhou')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'delivered' }, t1).texto, 'Aviso entregue ao engenheiro')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'enviado' }, t11).texto, 'Aviso enviado, sem confirmação de entrega')
assert.equal(estadoAvisoPrazo(base, t1).texto, 'Enviando aviso ao engenheiro…')
assert.equal(temAvisoEnviando([base], t1), true)
assert.equal(temAvisoEnviando([{ ...base, enviada: true, status_entrega: 'delivered' }], t1), false)
assert.equal(temAvisoEnviando([base], t11), false)

assert.equal(avisoValeParaPrazo(base, '2026-11-20'), true)
assert.equal(avisoValeParaPrazo(base, '2026-11-20T00:00:00'), true)
assert.equal(avisoValeParaPrazo(base, '2026-11-21'), false)
assert.equal(avisoValeParaPrazo(base, null), false)
assert.equal(avisoValeParaPrazo({ prazo_avisado: null }, '2026-11-20'), false)
assert.equal(avisoValeParaPrazo({ prazo_avisado: null }, null), false)

console.log('   ✅ alterar prazo: regras puras')

const lerRota = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const rotaPrazo = lerRota('dashboard/app/api/admin/atribuicoes/[id]/prazo/route.ts')
for (const trecho of ['guardOwnerRoute()', 'isUuid(params.id)', 'validateAlterarPrazoBody', "rpc('alterar_prazo_atribuicao'", 'p_actor_user_id: guard.owner.id', 'sanitizeAtribuicaoActionResult'])
  assert.ok(rotaPrazo.includes(trecho), `rota de prazo sem ${trecho}`)
console.log('   ✅ rota de prazo exige dono e chama a RPC')

const rotaAvisos = lerRota('dashboard/app/api/admin/atribuicoes/avisos-prazo/route.ts')
assert.ok(rotaAvisos.includes('guardOwnerRoute()'))
assert.ok(rotaAvisos.includes(".eq('tipo', 'prazo_alterado')"))
const selectArg = /\.select\(\s*(['"`])([^]*?)\1/.exec(rotaAvisos)?.[2] ?? ''
assert.ok(selectArg.length > 0, 'select nao encontrado')
for (const proibido of ['telefone', 'mensagem', '*'])
  assert.ok(!selectArg.includes(proibido), `select expoe ${proibido}`)
assert.ok(selectArg.split(',').map((c) => c.trim()).includes('prazo_avisado'), 'select sem prazo_avisado')
console.log('   ✅ rota de avisos exige dono e nao expoe telefone nem mensagem')
