// =====================================================
// TESTE: pizza de motivos com filtro geral / retrabalho / paralisacao
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-motivos-por-tipo.ts
// =====================================================

import assert from 'node:assert/strict'
import * as ocNs from '../dashboard/lib/ocorrencias.ts'

const oc = ((ocNs as any).default ?? ocNs) as typeof import('../dashboard/lib/ocorrencias.ts')
const { motivosDoFiltro, normalizarTipo, rotuloTipo } = oc

// Tipo vindo do banco: so os dois do bot valem; o resto (NULL dos antigos, valor estranho) e nao classificado
assert.equal(normalizarTipo('retrabalho'), 'retrabalho')
assert.equal(normalizarTipo('paralisacao'), 'paralisacao')
assert.equal(normalizarTipo('nao_classificado'), 'nao_classificado')
assert.equal(normalizarTipo(null), 'nao_classificado')
assert.equal(normalizarTipo(undefined), 'nao_classificado')
assert.equal(rotuloTipo('paralisacao'), 'Paralisação')
assert.equal(rotuloTipo(null), 'Não classificado')
console.log('   ✅ tipo do banco vira o rotulo certo')

const linhas = [
  { tipo: 'nao_classificado', motivo_retrabalho: 'Outro', quantidade: 36 },
  { tipo: 'nao_classificado', motivo_retrabalho: 'Alteração de projeto (Construtora)', quantidade: 26 },
  { tipo: 'retrabalho', motivo_retrabalho: 'Outro', quantidade: 2 },
  { tipo: 'retrabalho', motivo_retrabalho: 'Erro de projeto (TecPred)', quantidade: 3 },
  { tipo: 'paralisacao', motivo_retrabalho: 'Projeto Suspenso', quantidade: 4 },
  { tipo: 'paralisacao', motivo_retrabalho: 'Outro', quantidade: 1 },
]

// Geral: soma por motivo de tudo, inclusive os antigos sem tipo; um motivo aparece uma vez so
assert.deepEqual(motivosDoFiltro(linhas, 'geral'), [
  { motivo_retrabalho: 'Outro', quantidade: 39 },
  { motivo_retrabalho: 'Alteração de projeto (Construtora)', quantidade: 26 },
  { motivo_retrabalho: 'Projeto Suspenso', quantidade: 4 },
  { motivo_retrabalho: 'Erro de projeto (TecPred)', quantidade: 3 },
])
console.log('   ✅ geral soma retrabalho + paralisacao + antigos, sem motivo repetido')

assert.deepEqual(motivosDoFiltro(linhas, 'retrabalho'), [
  { motivo_retrabalho: 'Erro de projeto (TecPred)', quantidade: 3 },
  { motivo_retrabalho: 'Outro', quantidade: 2 },
])
assert.deepEqual(motivosDoFiltro(linhas, 'paralisacao'), [
  { motivo_retrabalho: 'Projeto Suspenso', quantidade: 4 },
  { motivo_retrabalho: 'Outro', quantidade: 1 },
])
console.log('   ✅ filtros so retrabalho / so paralisacao nao trazem os antigos')

// Como hoje em producao: so antigos -> geral cheio, filtros vazios
const soAntigos = linhas.filter((l) => l.tipo === 'nao_classificado')
assert.equal(motivosDoFiltro(soAntigos, 'geral').length, 2)
assert.deepEqual(motivosDoFiltro(soAntigos, 'retrabalho'), [])
assert.deepEqual(motivosDoFiltro(soAntigos, 'paralisacao'), [])
console.log('   ✅ so registros antigos: geral igual ao grafico de antes, filtros vazios')

console.log('test-dashboard-motivos-por-tipo: OK')
