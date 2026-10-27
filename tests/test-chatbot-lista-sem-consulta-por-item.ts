// =====================================================
// TESTE: listas de atribuicoes sem uma consulta por item
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-lista-sem-consulta-por-item.ts
//
// Para montar a lista de projetos, o bot fazia 3 consultas por atribuicao
// (projeto, area e percentual) e, ao desenhar a lista, mais 1 por item para
// saber se estava concluida. Com 10 atribuicoes: ~42 consultas a cada lista.
// O percentual e o percentual_ponderado da propria linha de
// engenheiros_projetos, que ja vem na consulta das atribuicoes. Agora:
// atribuicoes + projetos (uma consulta) + areas (uma consulta), qualquer que
// seja o numero de itens, com o mesmo resultado.
// =====================================================

import assert from 'node:assert/strict'
import { EngineerProjectFlow } from '../chatbot/flows/engineerProjectFlow.ts'
import { OwnerFlow } from '../chatbot/flows/ownerFlow.ts'
import { getSupabaseService, SupabaseUnavailableError } from '../integrations/supabase/supabaseService.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const ATRIBUICOES = [
  { id: 'a1', eng_id: 'e1', projeto_id: 'p1', area_id: 'ar1', percentual_ponderado: 40, ativo: true, instancia_label: null },
  { id: 'a2', eng_id: 'e1', projeto_id: 'p1', area_id: 'ar2', percentual_ponderado: 100, ativo: true, instancia_label: null },
  { id: 'a3', eng_id: 'e1', projeto_id: 'p2', area_id: 'ar1', percentual_ponderado: 0, ativo: true, instancia_label: 'Elétrica - Bloco B' },
  { id: 'a4', eng_id: 'e1', projeto_id: 'p3', area_id: 'ar2', percentual_ponderado: 99.5, ativo: true, instancia_label: null },
  { id: 'a5', eng_id: 'e1', projeto_id: 'p-inativo', area_id: 'ar1', percentual_ponderado: 10, ativo: true, instancia_label: null },
]
const PROJETOS = new Map([
  ['p1', { projeto_id: 'p1', codigo_projeto: 'PRJ-001', cliente: 'Cliente 1', descricao: 'd1' }],
  ['p2', { projeto_id: 'p2', codigo_projeto: 'PRJ-002', cliente: 'Cliente 2', descricao: 'd2' }],
  ['p3', { projeto_id: 'p3', codigo_projeto: 'PRJ-003', cliente: 'Cliente 3', descricao: 'd3' }],
])
const AREAS = new Map([
  ['ar1', { area_id: 'ar1', codigo: 'ELETRICO', descricao: 'Elétrica' }],
  ['ar2', { area_id: 'ar2', codigo: 'HIDRAULICO', descricao: 'Hidráulica' }],
])

function criarSupabaseFalso() {
  const chamadas: string[] = []
  const porItem = (nome: string) => async () => {
    throw new Error(`${nome} nao deveria ser chamada por item da lista`)
  }
  const svc = {
    chamadas,
    isConnected: () => true,
    buscarEngenheiroPorTelefone: async () => (chamadas.push('engenheiro'), { eng_id: 'e1', nome: 'Engenheira A' }),
    listarAtribuicoesEngenheiroOuFalha: async () => (chamadas.push('atribuicoes'), ATRIBUICOES.map((a) => ({ ...a }))),
    buscarProjetosPorIdsOuFalha: async (ids: string[]) => {
      chamadas.push(`projetos(${new Set(ids).size})`)
      return new Map([...PROJETOS].filter(([k]) => ids.includes(k)))
    },
    buscarAreasPorIdsOuFalha: async (ids: string[]) => {
      chamadas.push(`areas(${new Set(ids.map(String)).size})`)
      return new Map([...AREAS].filter(([k]) => ids.includes(k)))
    },
    buscarProjetoPorId: porItem('buscarProjetoPorId'),
    buscarAreaPorId: porItem('buscarAreaPorId'),
    buscarProgressoAreaOuFalha: porItem('buscarProgressoAreaOuFalha'),
  }
  return svc
}

const silenciar = () => {
  const o = { log: console.log }
  console.log = () => {}
  return () => Object.assign(console, o)
}

console.log('\n📋 Listas sem consulta por item\n')

{
  const flow = new EngineerProjectFlow('+5583999990000', 'Engenheira A') as any
  const svc = criarSupabaseFalso()
  flow.supabase = svc
  const restaurar = silenciar()
  let lista: any[]
  try {
    lista = await flow.buscarAtribuicoesEngenheiro()
  } finally {
    restaurar()
  }
  assert.deepEqual(svc.chamadas, ['engenheiro', 'atribuicoes', 'projetos(4)', 'areas(2)'])
  assert.deepEqual(
    lista!.map((a) => [a.id, a.codigo, a.cliente, a.area, a.percentual, a.status]),
    [
      ['a1', 'PRJ-001', 'Cliente 1', 'Elétrica', 40, 'Em Andamento'],
      ['a3', 'PRJ-002', 'Cliente 2', 'Elétrica - Bloco B', 0, 'Aguardando Início'],
      ['a4', 'PRJ-003', 'Cliente 3', 'Hidráulica', 99.5, 'Em Andamento'],
      ['a5', '', '', 'Elétrica', 10, 'Em Andamento'],
    ],
  )
  ok('engenheiro: 4 consultas para 5 atribuicoes, mesmo resultado (concluida fora, projeto inativo sem codigo)')
}

{
  const flow = new EngineerProjectFlow('+5583999990000', 'Engenheira A') as any
  const svc = criarSupabaseFalso()
  flow.supabase = svc
  flow.state = { step: 'escolher_acao', stepHistory: [], snapshotHistory: [], mode: null, projectData: {} }
  const restaurar = silenciar()
  try {
    for (const opcao of ['1', '2', '3']) {
      svc.chamadas.length = 0
      const r = await flow.processarMensagem(opcao)
      assert.match(r.mensagem, /PRJ-003/)
      assert.equal(svc.chamadas.length, 4, `opcao ${opcao}: ${svc.chamadas.join(', ')}`)
      flow.state = { step: 'escolher_acao', stepHistory: [], snapshotHistory: [], mode: null, projectData: {} }
    }
  } finally {
    restaurar()
  }
  ok('listas da manha, da noite e de meus projetos: sem consulta extra ao desenhar')
}

{
  const svcReal = getSupabaseService() as any
  const falso = criarSupabaseFalso()
  const originais: Record<string, unknown> = {}
  for (const k of ['listarAtribuicoesEngenheiroOuFalha', 'buscarProjetosPorIdsOuFalha', 'buscarAreasPorIdsOuFalha', 'buscarProjetoPorId', 'buscarAreaPorId', 'buscarProgressoAreaOuFalha']) {
    originais[k] = svcReal[k]
    svcReal[k] = (falso as any)[k]
  }
  const restaurar = silenciar()
  try {
    const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
    owner.contexto.engenheiros = [{ eng_id: 'e1', nome: 'Engenheira A' }]
    const r = await owner.stepTransfEscolherEngOrigem('1')
    assert.deepEqual(falso.chamadas, ['atribuicoes', 'projetos(4)', 'areas(2)'])
    assert.deepEqual(
      owner.contexto.transf_atribuicoes.map((a: any) => [a.id, a.codigo_projeto, a.area_descricao]),
      [['a1', 'PRJ-001', 'Elétrica'], ['a3', 'PRJ-002', 'Elétrica'], ['a4', 'PRJ-003', 'Hidráulica'], ['a5', '?', 'Elétrica']],
    )
    assert.doesNotMatch(r.mensagem, /❌/)
  } finally {
    restaurar()
    Object.assign(svcReal, originais)
  }
  ok('dono transferindo tarefas: 3 consultas, mesmas atribuicoes pendentes')
}

{
  // As consultas em lote: erro do banco falha (nao vira lista sem codigos), lista vazia nao consulta.
  const svc = getSupabaseService() as any
  const original = { connected: svc.connected, supabase: svc.supabase }
  let consultas = 0
  const errorOriginal = console.error
  console.error = () => {}
  try {
    svc.connected = true
    svc.supabase = {
      from: () => {
        consultas++
        const q: any = { select: () => q, in: () => q, eq: () => Promise.resolve({ data: null, error: { message: 'fora' } }) }
        return q
      },
    }
    assert.equal((await svc.buscarProjetosPorIdsOuFalha([])).size, 0)
    assert.equal((await svc.buscarAreasPorIdsOuFalha([])).size, 0)
    assert.equal(consultas, 0, 'lista vazia nao consulta')
    await assert.rejects(() => svc.buscarProjetosPorIdsOuFalha(['p1']), SupabaseUnavailableError)
    await assert.rejects(() => svc.buscarAreasPorIdsOuFalha(['ar1']), SupabaseUnavailableError)
  } finally {
    console.error = errorOriginal
    Object.assign(svc, original)
  }
  ok('consultas em lote: erro do banco falha e lista vazia nao consulta')
}

console.log(`\n${passou} casos passaram\n`)
