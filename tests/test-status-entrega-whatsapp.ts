// =====================================================
// TESTE: regras do status de entrega do WhatsApp
// =====================================================
// Rodar com: npx tsx tests/test-status-entrega-whatsapp.ts
//
// Regras puras que decidem se um callback de status da Twilio deve ser
// gravado: ordem enviado < sent < delivered < read, failed/undelivered sao
// finais, intermediarios e desconhecidos sao ignorados.
// =====================================================

import assert from 'node:assert/strict'
import { proximoStatusEntrega, motivoFalha } from '../integrations/whatsapp/statusEntrega.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📬 Status de entrega do WhatsApp\n')

{
  assert.equal(proximoStatusEntrega(null, 'sent'), 'sent')
  assert.equal(proximoStatusEntrega('enviado', 'delivered'), 'delivered')
  ok('avanca na ordem')
}

{
  assert.equal(proximoStatusEntrega('delivered', 'sent'), null)
  assert.equal(proximoStatusEntrega('read', 'delivered'), null)
  ok('fora de ordem nao rebaixa')
}

{
  assert.equal(proximoStatusEntrega('sent', 'undelivered'), 'undelivered')
  assert.equal(proximoStatusEntrega('failed', 'delivered'), null)
  ok('status final grava e nunca e sobrescrito')
}

{
  assert.equal(proximoStatusEntrega('enviado', 'queued'), null)
  assert.equal(proximoStatusEntrega('enviado', 'accepted'), null)
  assert.equal(proximoStatusEntrega('enviado', 'sending'), null)
  assert.equal(proximoStatusEntrega('enviado', 'qualquer'), null)
  ok('intermediarios e desconhecidos sao ignorados')
}

{
  assert.equal(motivoFalha('63016'), 'não fala com o bot há mais de 24h')
  assert.equal(motivoFalha('30008'), 'não entregue (código 30008)')
  assert.equal(motivoFalha(null), 'não entregue')
  ok('motivo da falha')
}

console.log(`\n${passou} casos passaram\n`)
