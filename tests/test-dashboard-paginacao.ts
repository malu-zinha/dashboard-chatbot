// =====================================================
// TESTE: buscar todas as paginas (sem corte em 1000 linhas)
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-paginacao.ts
//
// O Supabase devolve no maximo 1000 linhas por consulta e o dashboard somava
// horas no navegador sobre o que viesse: com mais de 1000 apontamentos no
// periodo, o total saia menor, sem aviso. (Em 21/10/2026: 480 apontamentos,
// crescendo ~150 por semana.)
// =====================================================

import assert from 'node:assert/strict'
import mod from '../dashboard/lib/paginacao.ts'

// dashboard/ e CommonJS; daqui do ESM o modulo chega como default.
const { buscarTodasAsPaginas } = mod as typeof import('../dashboard/lib/paginacao.ts')

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

// Servidor falso: respeita o range pedido, mas corta em `limite` linhas.
function servidor(total: number, limite = 1000) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i }))
  const pedidos: Array<[number, number]> = []
  const montar = async (de: number, ate: number) => {
    pedidos.push([de, ate])
    const fim = Math.min(ate + 1, de + limite)
    return { data: linhas.slice(de, fim), error: null }
  }
  return { montar, pedidos }
}

console.log('\n📄 Paginacao\n')

{
  const { montar } = servidor(2500)
  const { data, error } = await buscarTodasAsPaginas(montar)
  assert.equal(error, null)
  assert.equal(data.length, 2500)
  assert.equal(new Set(data.map((l) => l.id)).size, 2500)
  ok('2500 linhas chegam inteiras, sem repetir nem pular')
}

{
  const { montar } = servidor(1700, 600)
  const { data } = await buscarTodasAsPaginas(montar)
  assert.equal(data.length, 1700)
  ok('servidor com limite menor (600) nao faz o laco parar cedo')
}

{
  const { montar, pedidos } = servidor(480)
  const { data } = await buscarTodasAsPaginas(montar)
  assert.equal(data.length, 480)
  assert.ok(pedidos.length <= 2, `fez ${pedidos.length} pedidos para 480 linhas`)
  ok('caso atual (480): no maximo 2 pedidos')
}

{
  const { montar } = servidor(0)
  const { data, error } = await buscarTodasAsPaginas(montar)
  assert.deepEqual(data, [])
  assert.equal(error, null)
  ok('vazio devolve lista vazia sem erro')
}

{
  let chamada = 0
  const { data, error } = await buscarTodasAsPaginas(async (de: number) => {
    chamada++
    if (chamada === 2) return { data: null, error: { message: 'timeout' } }
    return { data: Array.from({ length: 1000 }, (_, i) => ({ id: de + i })), error: null }
  })
  assert.deepEqual(error, { message: 'timeout' })
  assert.deepEqual(data, [], 'falha no meio nao pode virar soma parcial')
  ok('erro no meio devolve o erro e nenhuma linha (nada de total parcial)')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
