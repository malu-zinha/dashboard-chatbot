// =====================================================
// TESTE: uma regra so para "atribuicao concluida"
// =====================================================
// Rodar com: npx tsx tests/test-regra-atribuicao-concluida.ts
//
// Havia tres regras: o fluxo do engenheiro usava o percentual ponderado
// (>= 100), uma funcao morta olhava pavimentos, e a transferencia do dono
// considerava concluida a atribuicao com todos os pavimentos prontos —
// ignorando as etapas globais. Uma atribuicao com pavimentos prontos e
// etapas globais pendentes sumia da lista de transferencia. Agora tudo usa o
// percentual ponderado (isPercentualPendente), a mesma fonte do dashboard.
// =====================================================

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OwnerFlow } from '../chatbot/flows/ownerFlow.ts'
import { getSupabaseService, SupabaseUnavailableError } from '../integrations/supabase/supabaseService.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n✔️  Regra unica de atribuicao concluida\n')

const svc = getSupabaseService() as any
const PCT: Record<string, number> = { concluida: 100, globaisPendentes: 60, semEtapas: 0 }

function preparar() {
  // O percentual ponderado vem na propria linha de engenheiros_projetos.
  svc.listarAtribuicoesEngenheiroOuFalha = async () =>
    ['concluida', 'globaisPendentes', 'semEtapas'].map((id, i) => ({
      id, projeto_id: `p${i + 1}`, area_id: 'a', percentual_ponderado: PCT[id],
    }))
  svc.buscarProjetosPorIdsOuFalha = async (ids: string[]) =>
    new Map(ids.map((id) => [id, { codigo_projeto: id.toUpperCase(), cliente: 'C' }]))
  svc.buscarAreasPorIdsOuFalha = async () => new Map([['a', { codigo: 'ELE', descricao: 'Eletrico' }]])
  svc.buscarProgressoAreaOuFalha = async (_p: string, _a: string, atribId: string) => PCT[atribId]
  // Pela regra antiga, todos os pavimentos prontos = "concluida" — inclusive a de globais pendentes.
  svc.buscarPavimentosComEtapas = async () => [{ ativo: true, etapas: [{ concluida: true, ativo: true }] }]
}

{
  preparar()
  const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
  owner.contexto = { engenheiros: [{ eng_id: 'e1', nome: 'Marina' }] }
  const r = await owner.stepTransfEscolherEngOrigem('1')
  const ids = owner.contexto.transf_atribuicoes.map((a: any) => a.id)
  assert.deepEqual(ids, ['globaisPendentes', 'semEtapas'], `lista de transferencia: ${ids}`)
  assert.doesNotMatch(r.mensagem, /\bP1\b/)
  ok('transferencia mostra a de etapas globais pendentes e esconde so a de 100%')
}

{
  preparar()
  svc.listarAtribuicoesEngenheiroOuFalha = async () => { throw new SupabaseUnavailableError('teste') }
  const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
  owner.contexto = { engenheiros: [{ eng_id: 'e1', nome: 'Marina' }] }
  owner.stepAtual = 'transf_escolher_eng_origem'
  const r = await owner.processarMensagem('1')
  assert.match(r.mensagem, /Não consegui acessar os dados agora/)
  assert.doesNotMatch(r.mensagem, /não tem tarefas/)
  ok('banco fora na transferencia: avisa, nao diz "nao tem tarefas"')
}

{
  const fluxo = readFileSync('chatbot/flows/engineerProjectFlow.ts', 'utf8')
  const dono = readFileSync('chatbot/flows/ownerFlow.ts', 'utf8')
  assert.doesNotMatch(fluxo, /filtrarAtribuicoesPendentes/, 'funcao morta deveria ter saido')
  assert.match(fluxo, /isPercentualPendente\(/)
  assert.match(dono, /isPercentualPendente\(/)
  assert.doesNotMatch(dono, /const aindaPendente = pavs\.length === 0/)
  ok('engenheiro e dono usam isPercentualPendente; regra por pavimentos saiu')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
process.exit(0)
