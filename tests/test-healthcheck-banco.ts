// =====================================================
// TESTE: /health reflete o banco
// =====================================================
// Rodar com: npx tsx tests/test-healthcheck-banco.ts
//
// Antes o /health respondia "ok" fixo. Agora responde 503 quando a consulta
// ao banco falha ou demora alem do limite.
// =====================================================

import assert from 'node:assert/strict'
import { verificarSaude } from '../integrations/saude/healthcheck.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🩺 Health check\n')

const errorOriginal = console.error
console.error = () => {}
try {
  {
    const r = await verificarSaude(async () => {})
    assert.equal(r.http, 200)
    assert.equal(r.corpo.status, 'ok')
    assert.equal(r.corpo.banco, 'ok')
    ok('banco respondendo: 200')
  }

  {
    const r = await verificarSaude(async () => {
      throw new Error('connection refused')
    })
    assert.equal(r.http, 503)
    assert.equal(r.corpo.banco, 'indisponivel')
    ok('consulta com erro: 503')
  }

  {
    const inicio = Date.now()
    const r = await verificarSaude(() => new Promise(() => {}), 50)
    assert.equal(r.http, 503)
    assert.ok(Date.now() - inicio < 1000, 'nao fica preso esperando o banco')
    ok('banco sem resposta: 503 depois do limite de tempo')
  }
} finally {
  console.error = errorOriginal
}

console.log(`\n${passou} casos passaram\n`)
