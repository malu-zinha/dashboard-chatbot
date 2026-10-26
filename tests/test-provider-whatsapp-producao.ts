// =====================================================
// TESTE: producao nao sobe sem provedor real de WhatsApp
// =====================================================
// Rodar com: npx tsx tests/test-provider-whatsapp-producao.ts
//
// Sem WHATSAPP_PROVIDER o servico caia no modo desenvolvimento, que so
// imprime a mensagem e devolve sucesso: em producao as notificacoes ficavam
// marcadas como enviadas sem nunca sair. Agora o boot recusa.
// =====================================================

import assert from 'node:assert/strict'
import { problemaConfigProvider } from '../integrations/whatsapp/whatsappService.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📱 Provedor de WhatsApp em producao\n')

assert.match(problemaConfigProvider({ RAILWAY_ENVIRONMENT_NAME: 'production' }) ?? '', /WHATSAPP_PROVIDER/)
assert.match(problemaConfigProvider({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'development' }) ?? '', /desenvolvimento/)
ok('producao sem provedor, ou com "development", e recusada')

assert.equal(problemaConfigProvider({ RAILWAY_ENVIRONMENT_NAME: 'production', WHATSAPP_PROVIDER: 'twilio' }), null)
assert.equal(problemaConfigProvider({ NODE_ENV: 'production', WHATSAPP_PROVIDER: 'meta' }), null)
ok('producao com twilio ou meta sobe')

assert.equal(problemaConfigProvider({}), null)
assert.equal(problemaConfigProvider({ WHATSAPP_PROVIDER: 'development' }), null)
ok('na maquina local o modo desenvolvimento continua valendo')

console.log(`\n${passou} casos passaram\n`)
