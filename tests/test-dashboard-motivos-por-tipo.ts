// =====================================================
// TESTE: motivos separados por retrabalho / paralisacao / nao classificado
// =====================================================
// Rodar com: npx tsx tests/test-dashboard-motivos-por-tipo.ts
// =====================================================

import assert from 'node:assert/strict'
import * as ocNs from '../dashboard/lib/ocorrencias.ts'

const oc = ((ocNs as any).default ?? ocNs) as typeof import('../dashboard/lib/ocorrencias.ts')
const { agruparMotivosPorTipo, normalizarTipo, rotuloTipo } = oc

// Tipo vindo do banco: so os dois do bot valem; o resto (NULL dos antigos, valor estranho) e nao classificado
assert.equal(normalizarTipo('retrabalho'), 'retrabalho')
assert.equal(normalizarTipo('paralisacao'), 'paralisacao')
assert.equal(normalizarTipo('nao_classificado'), 'nao_classificado')
assert.equal(normalizarTipo(null), 'nao_classificado')
assert.equal(normalizarTipo(undefined), 'nao_classificado')
assert.equal(rotuloTipo('paralisacao'), 'Paralisação')
assert.equal(rotuloTipo(null), 'Não classificado')
console.log('   ✅ tipo do banco vira o rotulo certo')

// Como hoje em producao: so registros antigos
{
  const grupos = agruparMotivosPorTipo([
    { tipo: 'nao_classificado', motivo_retrabalho: 'Alteração de projeto (Construtora)', quantidade: 26 },
    { tipo: 'nao_classificado', motivo_retrabalho: 'Outro', quantidade: 36 },
  ])
  assert.deepEqual(grupos.map((g) => [g.tipo, g.linhas.length]), [
    ['retrabalho', 0],
    ['paralisacao', 0],
    ['nao_classificado', 2],
  ])
  assert.equal(grupos[2].linhas[0].motivo_retrabalho, 'Outro', 'maior quantidade primeiro')
  assert.match(grupos[2].titulo, /Não classificado/)
  console.log('   ✅ so antigos: retrabalho e paralisacao vazios aparecem, antigos no proprio grupo')
}

// Depois que todos os antigos sairem de cena, o grupo "nao classificado" some
{
  const grupos = agruparMotivosPorTipo([
    { tipo: 'paralisacao', motivo_retrabalho: 'Projeto Suspenso', quantidade: 2 },
    { tipo: 'retrabalho', motivo_retrabalho: 'Erro de projeto (TecPred)', quantidade: 1 },
    { tipo: 'paralisacao', motivo_retrabalho: 'Outro', quantidade: 5 },
  ])
  assert.deepEqual(grupos.map((g) => g.tipo), ['retrabalho', 'paralisacao'])
  assert.deepEqual(grupos[1].linhas.map((l) => l.motivo_retrabalho), ['Outro', 'Projeto Suspenso'])
  assert.deepEqual(grupos.map((g) => g.titulo), ['Motivos de retrabalho', 'Motivos de paralisação'])
  console.log('   ✅ sem antigos: so as pizzas de retrabalho e paralisacao')
}

// Nenhuma linha se perde nem aparece em dois grupos
{
  const linhas = [
    { tipo: 'retrabalho', motivo_retrabalho: 'Outro', quantidade: 1 },
    { tipo: 'paralisacao', motivo_retrabalho: 'Outro', quantidade: 3 },
    { tipo: 'nao_classificado', motivo_retrabalho: 'Outro', quantidade: 7 },
  ]
  const soma = agruparMotivosPorTipo(linhas).flatMap((g) => g.linhas).reduce((s, l) => s + l.quantidade, 0)
  assert.equal(soma, 11)
  console.log('   ✅ o mesmo motivo em tipos diferentes fica em pizzas diferentes, sem perder contagem')
}

console.log('test-dashboard-motivos-por-tipo: OK')
