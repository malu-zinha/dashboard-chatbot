// =====================================================
// TESTE: Realtime do dashboard agrupa as recargas
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-realtime-agrupado.ts
//
// Cada evento do Realtime recarregava o painel inteiro (~19 consultas), e
// uma atribuicao com varios pavimentos gera dezenas de eventos seguidos. Agora
// eventos em sequencia viram uma recarga so, e a aba escondida so recarrega
// quando volta a aparecer. O indicador "Conectado" passa a refletir o canal
// do Realtime, nao so a existencia das variaveis de ambiente.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// O dashboard e CommonJS para o tsx: importa o modulo inteiro (padrao dos test-dashboard-*.ts).
import mod from '../dashboard/lib/recargaAgrupada.ts'

const { criarRecargaAgrupada } = mod as typeof import('../dashboard/lib/recargaAgrupada.ts')

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

console.log('\n📡 Realtime agrupado\n')

{
  let recargas = 0
  const r = criarRecargaAgrupada(() => recargas++, { esperaMs: 30 })
  for (let i = 0; i < 20; i++) r.agendar()
  await esperar(10)
  assert.equal(recargas, 0, 'ainda dentro da espera')
  await esperar(50)
  assert.equal(recargas, 1)
  ok('20 eventos seguidos viram uma recarga so')
}

{
  let recargas = 0
  const r = criarRecargaAgrupada(() => recargas++, { esperaMs: 20 })
  r.agendar()
  await esperar(40)
  r.agendar()
  await esperar(40)
  assert.equal(recargas, 2)
  ok('eventos separados por mais que a espera recarregam cada um')
}

{
  let recargas = 0
  let visivel = false
  const r = criarRecargaAgrupada(() => recargas++, { esperaMs: 10, estaVisivel: () => visivel })
  r.agendar()
  r.agendar()
  await esperar(30)
  assert.equal(recargas, 0, 'aba escondida nao recarrega')
  visivel = true
  r.aoFicarVisivel()
  assert.equal(recargas, 1)
  r.aoFicarVisivel()
  assert.equal(recargas, 1, 'voltar a ficar visivel sem evento novo nao recarrega')
  ok('aba escondida guarda uma recarga para quando voltar a aparecer')
}

{
  let recargas = 0
  const r = criarRecargaAgrupada(() => recargas++, { esperaMs: 10 })
  r.agendar()
  r.cancelar()
  await esperar(30)
  assert.equal(recargas, 0)
  ok('cancelar (desmontar a tela) descarta a recarga agendada')
}

{
  const painel = readFileSync('dashboard/components/DashboardClient.tsx', 'utf8')
  const lib = readFileSync('dashboard/lib/supabase.ts', 'utf8')
  assert.match(painel, /criarRecargaAgrupada\(/, 'o painel usa a recarga agrupada')
  assert.doesNotMatch(painel, /subscribeToChanges\('[a-z_]+', loadData\)/, 'evento nao chama loadData direto')
  assert.match(painel, /visibilitychange/, 'o painel escuta a aba voltar a ficar visivel')
  assert.match(lib, /\.subscribe\(\(status/, 'o canal informa o status')
  assert.match(painel, /isConnected=\{realtimeConectado\}/, 'o Header mostra o status real do canal')
  ok('o painel liga a recarga agrupada e o status real do canal')
}

console.log(`\n${passou} casos passaram\n`)
