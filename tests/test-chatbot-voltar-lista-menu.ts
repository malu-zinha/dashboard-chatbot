// =====================================================
// TESTE: 0/voltar numa lista de projetos volta ao menu
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-voltar-lista-menu.ts
//
// A lista de projetos e desenhada pelo passo escolher_projeto_* e ja avanca
// para o passo seguinte (que recebe a escolha). O 0 voltava so um passo, para
// o passo que desenha a lista — e a mesma lista reaparecia, sem fim, embora o
// rodape prometa "Voltar". Agora, numa lista aberta direto do menu, o 0 volta
// ao menu do engenheiro.
// =====================================================

import assert from 'node:assert/strict'
import { EngineerProjectFlow } from '../chatbot/flows/engineerProjectFlow.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

const ATRIBUICAO = {
  id: 'atrib-1', codigo: 'PRJ-001', cliente: 'Cliente X', area: 'Elétrica', area_id: 'area-1',
  status: 'Em Execução', projeto_id: 'proj-1', percentual: 40,
}

function criarFlow() {
  const flow = new EngineerProjectFlow('+5583999990000', 'Engenheira A') as any
  flow.buscarAtribuicoesEngenheiro = async () => [ATRIBUICAO]
  flow._isAtribuicaoConcluida = async () => false
  flow.supabase = {
    buscarPavimentosComEtapas: async () => [],
    buscarEtapasGlobais: async () => [],
    buscarProgressoArea: async () => 40,
  }
  flow.state = { step: 'escolher_acao', stepHistory: [], snapshotHistory: [], mode: null, projectData: {} }
  return flow
}

const enviar = async (flow: any, msg: string): Promise<string> => (await flow.processarMensagem(msg)).mensagem

console.log('\n↩️  0 na lista de projetos volta ao menu\n')

const menu = (criarFlow() as any).renderMenuEngenheiro() as string
const tituloMenu = menu.split('\n').find((l) => l.trim()) as string

for (const [opcao, nome] of [['1', 'notificacao matinal'], ['2', 'notificacao noturna'], ['4', 'marcar etapa']] as const) {
  const flow = criarFlow()
  const lista = await enviar(flow, opcao)
  assert.match(lista, /PRJ-001/, `${nome}: abriu a lista`)
  const resposta = await enviar(flow, '0')
  assert.ok(resposta.includes(tituloMenu), `${nome}: 0 deveria mostrar o menu, veio: ${resposta.split('\n')[0]}`)
  assert.equal(flow.state.step, 'escolher_acao', `${nome}: step`)
  // E o menu funciona depois de voltar.
  assert.match(await enviar(flow, opcao), /PRJ-001/, `${nome}: menu responde depois do voltar`)
  ok(`${nome}: 0 na lista volta ao menu`)
}

{
  // Um passo adiante (dentro do projeto), o 0 continua voltando para a lista.
  const flow = criarFlow()
  await enviar(flow, '1')
  await enviar(flow, '1')
  const resposta = await enviar(flow, '0')
  assert.match(resposta, /PRJ-001/)
  assert.equal(flow.state.step, 'escolher_area_manha')
  ok('depois de escolher o projeto, 0 volta para a lista (nao pula para o menu)')
}

{
  // E dali um unico 0 chega ao menu: redesenhar a lista nao empilha um passo a mais.
  const flow = criarFlow()
  await enviar(flow, '1')
  await enviar(flow, '1')
  await enviar(flow, '0')
  const resposta = await enviar(flow, '0')
  assert.ok(resposta.includes(tituloMenu), `veio: ${resposta.split('\n')[0]}`)
  assert.equal(flow.state.step, 'escolher_acao')
  ok('projeto -> 0 (lista) -> 0 (menu): sem precisar apertar 0 a mais')
}

console.log(`\n${passou} casos passaram\n`)
