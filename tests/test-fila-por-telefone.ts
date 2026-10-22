// =====================================================
// TESTE: mensagens do mesmo telefone em fila
// =====================================================
// Rodar com: npx tsx tests/test-fila-por-telefone.ts
//
// O webhook chama processarMensagem a cada POST, sem esperar o anterior. Duas
// mensagens rapidas do mesmo numero (um "1" repetido na confirmacao, por
// exemplo) mexiam no mesmo state da conversa ao mesmo tempo. Agora cada
// telefone tem uma fila: a segunda so comeca quando a primeira termina.
// Telefones diferentes continuam em paralelo.
// =====================================================

import assert from 'node:assert/strict'
import { MessageHandler } from '../chatbot/handlers/messageHandler.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

function criarHandler() {
  const h: any = new MessageHandler()
  const eventos: string[] = []
  // Substitui o processamento real: registra inicio e fim, com atraso.
  h.processarMensagemInterno = async (whatsapp: string, msg: string) => {
    eventos.push(`inicio ${whatsapp} ${msg}`)
    await esperar(msg === 'lenta' ? 60 : 10)
    if (msg === 'erro') throw new Error('falha simulada')
    eventos.push(`fim ${whatsapp} ${msg}`)
    return { resposta: `ok ${msg}` }
  }
  return { h, eventos }
}

console.log('\n📬 Fila por telefone\n')

{
  const { h, eventos } = criarHandler()
  const [a, b] = await Promise.all([
    h.processarMensagem('+5583999990000', 'lenta'),
    h.processarMensagem('+5583999990000', 'rapida'),
  ])
  assert.deepEqual(eventos, [
    'inicio +5583999990000 lenta',
    'fim +5583999990000 lenta',
    'inicio +5583999990000 rapida',
    'fim +5583999990000 rapida',
  ])
  assert.equal(a.resposta, 'ok lenta')
  assert.equal(b.resposta, 'ok rapida')
  ok('mesmo telefone: a segunda espera a primeira terminar, e cada uma recebe a sua resposta')
}

{
  const { h, eventos } = criarHandler()
  await Promise.all([
    h.processarMensagem('+5583999990000', 'lenta'),
    h.processarMensagem('+5583988880000', 'rapida'),
  ])
  assert.equal(eventos[0], 'inicio +5583999990000 lenta')
  assert.equal(eventos[1], 'inicio +5583988880000 rapida', 'outro telefone nao espera')
  ok('telefones diferentes rodam em paralelo')
}

{
  const { h, eventos } = criarHandler()
  const r1 = h.processarMensagem('+5583999990000', 'erro').catch((e: Error) => e.message)
  const r2 = h.processarMensagem('+5583999990000', 'depois')
  assert.equal(await r1, 'falha simulada')
  assert.equal((await r2).resposta, 'ok depois')
  assert.ok(eventos.includes('fim +5583999990000 depois'))
  ok('falha numa mensagem nao trava a fila do telefone')
}

{
  const { h } = criarHandler()
  await h.processarMensagem('whatsapp:+55 83 99999-0000', 'x')
  await esperar(5)
  assert.equal(h.filas.size, 0, 'fila vazia tem que ser descartada')
  ok('fila do telefone e descartada quando esvazia (sem vazamento de memoria)')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
process.exit(0) // o MessageHandler agenda limpeza com setInterval
