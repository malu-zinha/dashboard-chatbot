// =====================================================
// TESTE: relato do dia gravado junto com as horas
// =====================================================
// Rodar com: npx tsx tests/test-chatbot-relato-gravado-com-horas.ts
//
// O relato ("o que foi feito hoje") so era gravado no fim, depois da pergunta
// de observacoes. A sessao expira em 15 min: quem parava ali tinha as horas
// no banco e o relato perdido, sem aviso. Agora o relato vai na confirmacao,
// junto com as horas; o fim so volta ao banco se houver observacao ou se o
// relato tiver falhado antes (nova tentativa).
// =====================================================

import assert from 'node:assert/strict'
import { EngineerProjectFlow } from '../chatbot/flows/engineerProjectFlow.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

interface ChamadaRelato { feito: string; obs?: string; data?: string; passo: string }

function criarFlow(relatoFalhaNaPrimeira = false) {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any
  const relatos: ChamadaRelato[] = []
  const horas: string[] = []
  flow.supabase = new Proxy(
    {
      registrarRetrabalho: async (...a: any[]) => {
        horas.push(a[7])
        return { ok: true }
      },
      atualizarFeitoDia: async (_id: string, feito: string, obs?: string, data?: string) => {
        relatos.push({ feito, obs, data, passo: flow.state.step })
        if (relatoFalhaNaPrimeira && relatos.length === 1) {
          return { ok: false, motivo: 'erro_feito', mensagem: 'falhou' }
        }
        return { ok: true }
      },
    },
    { get: (alvo: any, prop) => (prop in alvo ? alvo[prop] : async () => []) }
  )
  flow.state = {
    step: 'horas_trabalhadas',
    stepHistory: ['escolher_acao', 'escolher_projeto_noite', 'escolher_area_noite', 'feito_dia'],
    snapshotHistory: [],
    mode: 'notif_noite',
    projectData: {},
    selectedAtribuicaoId: 'atrib-1',
    feitoTexto: 'Revisao das pranchas',
  }
  const enviar = async (m: string) => (await flow.processarMensagem(m)).mensagem as string
  return { flow, relatos, horas, enviar }
}

console.log('\n📝 Relato gravado com as horas\n')

// 1. Confirmou as horas e sumiu na pergunta de observacoes: relato ja esta salvo
{
  const { flow, relatos, horas, enviar } = criarFlow()
  await enviar('8')
  await enviar('2') // sem retrabalho
  await enviar('1') // confirma
  assert.equal(flow.state.step, 'observacoes_pergunta')
  assert.equal(relatos.length, 1, 'relato tem que ir junto com as horas')
  assert.equal(relatos[0].feito, 'Revisao das pranchas')
  assert.equal(relatos[0].obs, undefined)
  assert.equal(relatos[0].data, horas[0], 'relato e horas no mesmo dia')
  ok('na confirmacao, relato gravado junto com as horas (mesmo dia)')

  await enviar('2') // sem observacoes
  assert.equal(relatos.length, 1, 'sem observacao nao precisa gravar de novo')
  ok('sem observacao, o fim nao grava de novo')
}

// 2. Com observacao: o fim grava a observacao
{
  const { relatos, enviar } = criarFlow()
  await enviar('8')
  await enviar('2')
  await enviar('1')
  await enviar('1') // quer observacao
  await enviar('Faltou a planta do 4o pavimento')
  assert.equal(relatos.length, 2)
  assert.equal(relatos[1].obs, 'Faltou a planta do 4o pavimento')
  assert.equal(relatos[1].data, relatos[0].data)
  ok('com observacao, o fim grava a observacao no mesmo dia')
}

// 3. Relato falhou na confirmacao: o fim tenta de novo e, dando certo, conclui
{
  const { relatos, enviar } = criarFlow(true)
  await enviar('8')
  await enviar('2')
  await enviar('1')
  const fim = await enviar('2') // sem observacoes
  assert.equal(relatos.length, 2, 'relato que falhou tem que ser tentado de novo no fim')
  assert.match(fim, /Notificação Noturna Registrada/)
  ok('relato que falhou na confirmacao e regravado no fim')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
