import assert from 'node:assert/strict'
import { EngineerProjectFlow, MOTIVOS_RETRABALHO } from '../chatbot/flows/engineerProjectFlow.ts'

// As horas do dia eram gravadas no instante em que o engenheiro digitava o numero, em dois
// pontos (retrabalho_horas e o ramo "sem retrabalho" de retrabalho_pergunta). Como a RPC
// registrar_retrabalho_dia e upsert por (atribuicao, dia), um 80 no lugar de 8 sobrescrevia o
// valor certo antes de alguem revisar. Agora ha um passo horas_confirmar e ele e o unico ponto
// de gravacao — o contador de chamadas abaixo e a prova: fica em 0 ate o "1".

interface Gravacao {
  necessitou: boolean
  motivo?: string
  horasTotal: number
  horasRetrabalho: number
}

const MOTIVO_ESCOLHIDO = MOTIVOS_RETRABALHO[2] // 'Erro de projeto (TecPred)'

// O flow resolve o SupabaseService no construtor; trocar a propriedade depois deixa a conversa
// rodar sem tocar no banco (mesmo atalho de tests/test-mensagem-indisponivel.ts).
function criarFlow() {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any
  const gravacoes: Gravacao[] = []

  flow.supabase = {
    registrarRetrabalho: async (
      _atribuicaoId: string,
      necessitou: boolean,
      motivo: string | undefined,
      _tipo: string | undefined,
      _descricao: string | undefined,
      horasTotal: number,
      horasRetrabalho: number
    ) => {
      gravacoes.push({ necessitou, motivo, horasTotal, horasRetrabalho })
      return {}
    },
  }

  // Semear o state no passo das horas, como se projeto, area e "o que foi feito" ja tivessem
  // sido respondidos (tests/test-reauth-sessao.ts semeia a sessao do mesmo jeito).
  flow.state = {
    step: 'horas_trabalhadas',
    stepHistory: ['escolher_acao', 'escolher_projeto_noite', 'escolher_area_noite', 'feito_dia'],
    snapshotHistory: [],
    mode: 'notif_noite',
    projectData: {},
    selectedAtribuicaoId: 'atrib-1',
    feitoTexto: 'Revisao das pranchas do 3o pavimento',
  }

  return { flow, gravacoes }
}

const enviar = async (flow: any, msg: string): Promise<string> =>
  (await flow.processarMensagem(msg)).mensagem

// =====================================================
// Ramo COM retrabalho: resumo aparece e nada e gravado
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '8') // horas trabalhadas
  await enviar(flow, '1') // teve retrabalho
  await enviar(flow, '3') // motivo
  const resumo = await enviar(flow, '2') // horas de retrabalho

  assert.equal(flow.state.step, 'horas_confirmar')
  assert.match(resumo, /Confirme as horas do dia/)
  assert.match(resumo, /Horas trabalhadas: \*8h\*/)
  assert.match(resumo, new RegExp(MOTIVO_ESCOLHIDO.replace(/[()]/g, '\\$&')))
  assert.match(resumo, /Horas de retrabalho: \*2h\* \(25\.0%\)/)
  assert.match(resumo, /1️⃣ Confirmar e gravar/)
  assert.match(resumo, /2️⃣ Corrigir as horas/)
  assert.equal(gravacoes.length, 0, 'nada pode ir ao banco antes da confirmacao')

  // Entrada invalida nao grava nem muda de passo
  const erro = await enviar(flow, 'x')
  assert.match(erro, /Digite \*1\* para confirmar ou \*2\* para corrigir/)
  assert.equal(flow.state.step, 'horas_confirmar')
  assert.equal(gravacoes.length, 0)

  console.log('   ✅ ramo com retrabalho -> resumo, zero gravacoes')
}

// =====================================================
// "2" corrige: volta a perguntar as horas trabalhadas
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '8')
  await enviar(flow, '1')
  await enviar(flow, '3')
  await enviar(flow, '2')
  const repergunta = await enviar(flow, '2') // corrigir

  assert.equal(flow.state.step, 'horas_trabalhadas')
  assert.match(repergunta, /Quantas horas foram trabalhadas hoje/)
  assert.equal(gravacoes.length, 0)

  // Voltar a horas_trabalhadas restaura o snapshot daquele passo, entao motivo e horas de
  // retrabalho somem — o engenheiro refaz a sequencia e nada obsoleto sobrevive.
  assert.equal(flow.state.motivoRetrabalho, undefined)
  assert.equal(flow.state.horasRetrabalho, undefined)
  assert.equal(flow.state.teveRetrabalho, undefined)

  // Refazendo a sequencia, grava so os valores novos
  await enviar(flow, '4')
  await enviar(flow, '1')
  await enviar(flow, '1')
  await enviar(flow, '1')
  await enviar(flow, '1') // confirmar
  assert.deepEqual(gravacoes, [
    { necessitou: true, motivo: MOTIVOS_RETRABALHO[0], horasTotal: 4, horasRetrabalho: 1 },
  ])

  console.log('   ✅ "2" reabre a pergunta de horas e limpa o retrabalho obsoleto')
}

// =====================================================
// "0" na confirmacao reabre a pergunta anterior sem erro
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '8')
  await enviar(flow, '1')
  await enviar(flow, '3')
  await enviar(flow, '2')
  const voltou = await enviar(flow, '0')

  assert.equal(flow.state.step, 'retrabalho_horas')
  assert.match(voltou, /Quantas horas foram gastas no retrabalho/)
  assert.doesNotMatch(voltou, /❌/, 'voltar nao pode parecer erro de validacao')
  assert.equal(gravacoes.length, 0)

  console.log('   ✅ "0" reabre a pergunta anterior sem mensagem de erro')
}

// =====================================================
// Confirmar no ramo COM retrabalho grava uma vez
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '8')
  await enviar(flow, '1')
  await enviar(flow, '3')
  await enviar(flow, '2')
  const gravado = await enviar(flow, '1') // confirmar

  assert.deepEqual(gravacoes, [
    { necessitou: true, motivo: MOTIVO_ESCOLHIDO, horasTotal: 8, horasRetrabalho: 2 },
  ])
  assert.equal(flow.state.step, 'observacoes_pergunta')
  assert.match(gravado, /Retrabalho registrado: 2h de 8h \(25\.0%\)/)
  assert.match(gravado, /Quer adicionar observações/)

  console.log('   ✅ confirmar com retrabalho -> uma gravacao (true, motivo, 8, 2)')
}

// =====================================================
// Ramo SEM retrabalho: resumo e uma gravacao com 0
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '8')
  const resumo = await enviar(flow, '2') // nao teve retrabalho

  assert.equal(flow.state.step, 'horas_confirmar')
  assert.match(resumo, /Horas trabalhadas: \*8h\*/)
  assert.match(resumo, /Sem retrabalho/)
  assert.doesNotMatch(resumo, /%/, 'sem retrabalho nao ha percentual a mostrar')
  assert.equal(gravacoes.length, 0)

  const gravado = await enviar(flow, '1')
  assert.deepEqual(gravacoes, [
    { necessitou: false, motivo: undefined, horasTotal: 8, horasRetrabalho: 0 },
  ])
  assert.equal(flow.state.step, 'observacoes_pergunta')
  assert.match(gravado, /Sem retrabalho!/)
  assert.match(gravado, /Quer adicionar observações/)

  console.log('   ✅ confirmar sem retrabalho -> uma gravacao (false, 8, 0)')
}

// =====================================================
// Horas com virgula atravessam o resumo intactas
// =====================================================
{
  const { flow, gravacoes } = criarFlow()

  await enviar(flow, '7,5')
  await enviar(flow, '1')
  await enviar(flow, '1')
  const resumo = await enviar(flow, '1,5')

  assert.match(resumo, /Horas trabalhadas: \*7\.5h\*/)
  assert.match(resumo, /Horas de retrabalho: \*1\.5h\* \(20\.0%\)/)

  await enviar(flow, '1')
  assert.deepEqual(gravacoes, [
    { necessitou: true, motivo: MOTIVOS_RETRABALHO[0], horasTotal: 7.5, horasRetrabalho: 1.5 },
  ])

  console.log('   ✅ 7,5 / 1,5 chegam ao resumo e ao banco como 7.5 / 1.5')
}

console.log('test-chatbot-horas-confirmacao: OK')
