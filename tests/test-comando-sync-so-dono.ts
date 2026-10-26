// =====================================================
// TESTE: comando "sync" do bot so para o dono
// =====================================================
// Rodar com: npx tsx tests/test-comando-sync-so-dono.ts
//
// Qualquer numero, cadastrado ou nao, mandava "sync" e disparava a limpeza e
// reescrita da planilha do Google, por cima da sincronizacao automatica.
// Agora so o dono dispara, e nada acontece com a sincronizacao desligada.
// =====================================================

import assert from 'node:assert/strict'
import { MessageHandler } from '../chatbot/handlers/messageHandler.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const silenciar = () => {
  const o = { log: console.log, error: console.error }
  console.log = () => {}
  console.error = () => {}
  return () => Object.assign(console, o)
}

async function comandoSync(tipo: 'engenheiro' | 'dono' | 'nao_cadastrado', env: Record<string, string> = {}) {
  const h: any = new MessageHandler()
  let disparou = 0
  h.dispararSincronizacaoSheets = async () => void disparou++
  const anterior = process.env.ENABLE_SHEETS_SYNC
  if ('ENABLE_SHEETS_SYNC' in env) process.env.ENABLE_SHEETS_SYNC = env.ENABLE_SHEETS_SYNC
  else delete process.env.ENABLE_SHEETS_SYNC
  const restaurar = silenciar()
  try {
    const resposta = await h.processarComandoGlobal('sync', { tipo_usuario: tipo })
    return { resposta, disparou }
  } finally {
    restaurar()
    if (anterior === undefined) delete process.env.ENABLE_SHEETS_SYNC
    else process.env.ENABLE_SHEETS_SYNC = anterior
  }
}

console.log('\n🔄 Comando sync\n')

{
  const r = await comandoSync('dono')
  assert.equal(r.disparou, 1)
  assert.match(r.resposta, /Sincroniza/)
  ok('dono dispara a sincronizacao')
}

for (const tipo of ['engenheiro', 'nao_cadastrado'] as const) {
  const r = await comandoSync(tipo)
  assert.equal(r.disparou, 0)
  assert.equal(r.resposta, null, 'segue o fluxo normal, como qualquer outra mensagem')
  ok(`${tipo} nao dispara (a mensagem segue o fluxo normal)`)
}

{
  const r = await comandoSync('dono', { ENABLE_SHEETS_SYNC: 'false' })
  assert.equal(r.disparou, 0)
  assert.match(r.resposta, /desligada/i)
  ok('com a sincronizacao desligada, o dono recebe o aviso e nada roda')
}

console.log(`\n${passou} casos passaram\n`)
process.exit(0)
