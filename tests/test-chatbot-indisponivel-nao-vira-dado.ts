// =====================================================
// TESTE: banco indisponivel nao vira dado no chatbot
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-indisponivel-nao-vira-dado.ts
//
// Com o banco fora, o bot mostrava coisa errada como se fosse real:
//  - a lista de projetos caia numa planilha legada com id '' (gravar depois
//    falhava) ou vinha vazia ("nenhum projeto");
//  - o percentual virava 0% (status e filtro de pendentes errados);
//  - desativar engenheiro checava "tem projetos ativos?", a checagem falhava
//    e respondia "nao" — a desativacao seguia;
//  - editar engenheiro pelo dono dizia "Atualizado" sem olhar o resultado.
// Agora: listagem e progresso lancam SupabaseUnavailableError, o fluxo responde
// "nao consegui acessar"; desativar trava; editar so confirma o que gravou.
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

console.log('\n🔌 Indisponivel nao vira dado\n')

function flowCom(supabase: Record<string, any>) {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any
  let planilhaUsada = false
  flow.sheetService = { listAllProjects: async () => { planilhaUsada = true; return [] } }
  flow.supabase = new Proxy(
    { isConnected: () => true, ...supabase },
    { get: (alvo: any, prop) => (prop in alvo ? alvo[prop] : async () => []) }
  )
  flow.state = { step: 'escolher_acao', stepHistory: [], snapshotHistory: [], projectData: {} }
  return { flow, usouPlanilha: () => planilhaUsada }
}

// 1. Cadastro do engenheiro indisponivel
{
  const { flow, usouPlanilha } = flowCom({
    buscarEngenheiroPorTelefone: async () => { throw new SupabaseUnavailableError('teste') },
  })
  await assert.rejects(() => flow.buscarAtribuicoesEngenheiro(), SupabaseUnavailableError)
  assert.equal(usouPlanilha(), false)
  const r = await flow.processarMensagem('2') // notificacao noturna -> lista projetos
  assert.match(r.mensagem, /Não consegui acessar os dados agora/)
  assert.equal(usouPlanilha(), false, 'planilha legada nao pode ser usada')
  ok('sem banco, a lista de projetos responde "nao consegui acessar" (sem planilha com id vazio)')
}

// 2. Lista de atribuicoes indisponivel
{
  const { flow } = flowCom({
    buscarEngenheiroPorTelefone: async () => ({ eng_id: 'e1', nome: 'Maria' }),
    listarAtribuicoesEngenheiroOuFalha: async () => { throw new SupabaseUnavailableError('teste') },
  })
  await assert.rejects(() => flow.buscarAtribuicoesEngenheiro(), SupabaseUnavailableError)
  ok('falha ao listar atribuicoes nao vira "nenhum projeto"')
}

// 3. Projetos ou areas indisponiveis na listagem (o percentual vem na propria atribuicao)
for (const quebrado of ['buscarProjetosPorIdsOuFalha', 'buscarAreasPorIdsOuFalha']) {
  const { flow } = flowCom({
    buscarEngenheiroPorTelefone: async () => ({ eng_id: 'e1', nome: 'Maria' }),
    listarAtribuicoesEngenheiroOuFalha: async () => [{ id: 'a1', projeto_id: 'p1', area_id: 'x', percentual_ponderado: 40 }],
    buscarProjetosPorIdsOuFalha: async () => new Map([['p1', { codigo_projeto: 'PRJ-1' }]]),
    buscarAreasPorIdsOuFalha: async () => new Map([['x', { descricao: 'Eletrico' }]]),
    [quebrado]: async () => { throw new SupabaseUnavailableError('teste') },
  })
  await assert.rejects(() => flow.buscarAtribuicoesEngenheiro(), SupabaseUnavailableError)
}
ok('falha ao buscar projetos ou areas da lista nao vira lista sem codigos')

// 4. Servico: variantes OuFalha lancam; as antigas mantem o valor de reserva
{
  const svc = getSupabaseService() as any
  const cadeiaErro: any = {
    select: () => cadeiaErro, eq: () => cadeiaErro, order: () => cadeiaErro,
    limit: async () => ({ data: null, error: { message: 'timeout' } }),
    then: (res: any) => res({ data: null, error: { message: 'timeout' } }),
  }
  svc.supabase = { from: () => cadeiaErro }
  svc.connected = true
  await assert.rejects(() => svc.buscarProgressoAreaOuFalha('p', 'a', 'x'), SupabaseUnavailableError)
  assert.equal(await svc.buscarProgressoArea('p', 'a', 'x'), 0)
  await assert.rejects(() => svc.listarAtribuicoesEngenheiroOuFalha('e1'), SupabaseUnavailableError)
  assert.deepEqual(await svc.listarAtribuicoesEngenheiro('e1'), [])
  ok('OuFalha lanca; as funcoes antigas continuam com o valor de reserva para os outros chamadores')

  // 5. Desativar: checagem falhou -> nao desativa
  let atualizou = false
  const cadeiaDesativar: any = {
    select: () => cadeiaDesativar, eq: () => cadeiaDesativar,
    then: (res: any) => res({ count: null, error: { message: 'timeout' } }),
    update: () => { atualizou = true; return cadeiaDesativar },
  }
  svc.supabase = { from: () => cadeiaDesativar }
  const res = await svc.desativarEngenheiro('e1')
  assert.deepEqual(res, { success: false, error: 'nao_foi_possivel_verificar' })
  assert.equal(atualizou, false)
  ok('desativar trava quando nao da para checar projetos ativos (antes seguia)')
}

// 6. Dono: editar engenheiro so confirma o que gravou
{
  const svc = getSupabaseService() as any
  const owner = new OwnerFlow('+5583911112222', 'dono-1') as any
  owner.contexto = { viz_eng_id: 'e1', eng_campo_edit: 'telefone', edit_novo_valor: '+558399990000' }

  svc.atualizarEngenheiro = async () => ({ success: false, error: 'duplicate key value violates unique constraint "engenheiros_telefone_key"' })
  let r = await owner.stepEngEditarConfirmar('1')
  assert.doesNotMatch(r.mensagem, /Atualizado com sucesso/)
  assert.match(r.mensagem, /já está cadastrado/)
  ok('telefone duplicado: avisa e nao diz "Atualizado"')

  svc.atualizarEngenheiro = async () => ({ success: false, error: 'algo interno do banco' })
  r = await owner.stepEngEditarConfirmar('1')
  assert.match(r.mensagem, /Não consegui atualizar/)
  assert.doesNotMatch(r.mensagem, /interno do banco/)
  ok('outra falha: mensagem generica, sem texto cru do banco')

  svc.atualizarEngenheiro = async () => ({ success: true })
  r = await owner.stepEngEditarConfirmar('1')
  assert.match(r.mensagem, /Atualizado com sucesso/)
  ok('sucesso continua confirmando')

  svc.desativarEngenheiro = async () => ({ success: false, error: 'nao_foi_possivel_verificar' })
  r = await owner.stepEngExcluirConfirmar('1')
  assert.match(r.mensagem, /Não consegui verificar/)
  ok('exclusao sem verificacao avisa, sem repassar codigo de erro')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
process.exit(0)
