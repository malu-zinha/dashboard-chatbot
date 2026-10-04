import assert from 'node:assert/strict'
import { EngineerProjectFlow } from '../chatbot/flows/engineerProjectFlow.ts'

// O comando global 0/voltar faz popStep() e depois processarMensagem('') para RE-RENDERIZAR o passo
// anterior. Isso so funciona se o handler daquele passo tratar string vazia devolvendo a pergunta.
// Quem nao trata cai na validacao e responde "❌ Opcao invalida..." — o engenheiro aperta voltar e o
// bot responde como se ele tivesse digitado besteira. Este teste dirige o fluxo ate cada tela,
// aperta 0 e exige a pergunta anterior.

const ATRIBUICAO = {
  id: 'atrib-1',
  codigo: 'PRJ-001',
  cliente: 'Cliente X',
  area: 'Elétrica',
  area_id: 'area-1',
  status: 'Em Execução',
  projeto_id: 'proj-1',
  percentual: 40,
}

const PAVIMENTOS = [
  {
    pavimento_id: 'pav-1',
    nome: '1º Pavimento',
    peso: 50,
    ativo: true,
    etapas: [
      { etapa_id: 'et-1', nome: 'Alvenaria', peso: 100, concluida: false, ativo: true },
    ],
  },
]

// Monkeypatch no estilo de tests/test-mensagem-indisponivel.ts e tests/test-reauth-sessao.ts:
// trocar as dependencias na instancia deixa a conversa rodar sem tocar no banco.
function criarFlow() {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any

  flow.buscarAtribuicoesEngenheiro = async () => [ATRIBUICAO]
  flow._isAtribuicaoConcluida = async () => false

  flow.supabase = {
    registrarRetrabalho: async () => ({ ok: true }),
    atualizarFeitoDia: async () => ({ ok: true }),
    registrarPrevisaoDia: async () => true,
    buscarPavimentosComEtapas: async () => PAVIMENTOS,
    buscarEtapasGlobais: async () => [],
    buscarProgressoArea: async () => 40,
  }

  // O fluxo comeca onde stepInicio o deixa: aguardando a escolha do menu.
  flow.state = {
    step: 'escolher_acao',
    stepHistory: [],
    snapshotHistory: [],
    mode: null,
    projectData: {},
  }

  return flow
}

const enviar = async (flow: any, msg: string): Promise<string> =>
  (await flow.processarMensagem(msg)).mensagem

// Caminho da Notificacao Noturna ate a pergunta das observacoes, reusado por varios casos.
const ATE_OBSERVACOES = ['2', '1', 'Revisao das pranchas do 3o pavimento', '8', '1', '3', '2', '1']

// =====================================================
// Um caso por passo alcancavel por 0/voltar
// =====================================================
const casos: Array<{ nome: string; chegarAte: string[]; esperado: RegExp[]; step: string }> = [
  {
    nome: 'previsao_dia -> lista de projetos da manha',
    chegarAte: ['1', '1'],
    esperado: [/🌅 \*Notificação Matinal\*/, /📋 Escolha o projeto/],
    step: 'escolher_area_manha',
  },
  {
    nome: 'feito_dia -> lista de projetos da noite',
    chegarAte: ['2', '1'],
    esperado: [/🌙 \*Notificação Noturna\*/, /📋 Escolha o projeto/],
    step: 'escolher_area_noite',
  },
  {
    nome: 'horas_trabalhadas -> o que foi feito hoje',
    chegarAte: ['2', '1', 'Revisao das pranchas do 3o pavimento'],
    esperado: [/✔️ \*O que foi feito hoje\?\*/],
    step: 'feito_dia',
  },
  {
    nome: 'retrabalho_motivo -> teve retrabalho?',
    chegarAte: ['2', '1', 'Revisao das pranchas do 3o pavimento', '8', '1'],
    esperado: [/🔄 \*Teve retrabalho\/paralisação hoje\?\*/, /1️⃣ Sim/],
    step: 'retrabalho_pergunta',
  },
  {
    nome: 'retrabalho_horas -> motivo do retrabalho',
    chegarAte: ['2', '1', 'Revisao das pranchas do 3o pavimento', '8', '1', '3'],
    esperado: [/⚠️ \*Motivo do Retrabalho \/ Paralisação\*/, /3️⃣ Erro de projeto \(TecPred\)/],
    step: 'retrabalho_motivo',
  },
  {
    nome: 'observacoes_texto -> quer adicionar observacoes?',
    chegarAte: [...ATE_OBSERVACOES, '1'],
    esperado: [/📝 \*Quer adicionar observações\?\*/, /1️⃣ Sim/],
    step: 'observacoes_pergunta',
  },
  {
    nome: 'noite_etapa_pergunta -> texto das observacoes',
    chegarAte: [...ATE_OBSERVACOES, '1', 'Trabalho conforme previsto'],
    esperado: [/📝 \*Observações\*/, /_Digite suas observações sobre o dia de trabalho_/],
    step: 'observacoes_texto',
  },
  {
    nome: 'progresso_escopo -> alguma etapa foi concluida?',
    chegarAte: [...ATE_OBSERVACOES, '1', 'Trabalho conforme previsto', '1'],
    esperado: [/📐 \*Alguma etapa foi concluída hoje\?\*/, /1️⃣ Sim/],
    step: 'noite_etapa_pergunta',
  },
]

// Coletar falhas em vez de parar na primeira, como tests/test-reauth-sessao.ts: com 8 telas, uma
// rodada precisa mostrar todas as que estao quebradas.
let falhas = 0

for (const caso of casos) {
  const flow = criarFlow()
  for (const msg of caso.chegarAte) await enviar(flow, msg)

  const resposta = await enviar(flow, '0')

  const problemas: string[] = []
  if (/❌/.test(resposta)) problemas.push(`voltar parece erro: ${resposta.split('\n')[0]}`)
  for (const re of caso.esperado) {
    if (!re.test(resposta)) problemas.push(`falta ${re}`)
  }
  if (flow.state.step !== caso.step) {
    problemas.push(`step ${flow.state.step}, esperado ${caso.step}`)
  }

  if (problemas.length === 0) {
    console.log(`   ✅ ${caso.nome}`)
  } else {
    falhas++
    console.error(`   ❌ ${caso.nome}\n      ${problemas.join('\n      ')}`)
  }
}

// =====================================================
// As perguntas extraidas continuam coladas ao prefixo de sucesso
// =====================================================
// O risco da extracao e o prefixo se soltar da pergunta: "✅ Horas registradas: 8" sozinho, ou com
// uma linha em branco a mais. Cada caso abaixo exige prefixo E pergunta na mesma resposta.
{
  const flow = criarFlow()

  await enviar(flow, '2')
  const aposProjeto = await enviar(flow, '1')
  assert.match(aposProjeto, /✅ Projeto: \*PRJ-001\*\n\n✔️ \*O que foi feito hoje\?\*/)

  const aposFeito = await enviar(flow, 'Revisao das pranchas do 3o pavimento')
  assert.match(aposFeito, /✅ Feito registrado!\n\n⏱️ \*Quantas horas foram trabalhadas hoje/)

  const aposHoras = await enviar(flow, '8')
  assert.match(aposHoras, /✅ Horas registradas: 8\n\n🔄 \*Teve retrabalho\/paralisação hoje\?\*/)

  const aposMotivo = await enviar(flow, '1')
  assert.match(aposMotivo, /⚠️ \*Motivo do Retrabalho \/ Paralisação\*/)

  const aposHorasRetrabalho = await enviar(flow, '3')
  assert.match(aposHorasRetrabalho, /✅ Motivo registrado: Erro de projeto \(TecPred\)\n\n⏱️ \*Quantas horas foram gastas no retrabalho/)

  const aposConfirmar = await enviar(flow, '2')
  assert.match(aposConfirmar, /🔎 \*Confirme as horas do dia:\*/)

  const aposGravar = await enviar(flow, '1')
  assert.match(aposGravar, /✅ Retrabalho registrado: 2h de 8h \(25\.0%\)\n\n📝 \*Quer adicionar observações\?\*/)

  const aposSim = await enviar(flow, '1')
  assert.match(aposSim, /📝 \*Observações\*/)

  const aposTexto = await enviar(flow, 'Trabalho conforme previsto')
  assert.match(aposTexto, /✅ \*Notificação Noturna Registrada!\*/)
  assert.match(aposTexto, /📐 \*Alguma etapa foi concluída hoje\?\*/)

  console.log('   ✅ prefixos de sucesso seguem colados as perguntas')
}

// O ramo sem retrabalho tem o proprio prefixo antes da pergunta de observacoes
{
  const flow = criarFlow()
  await enviar(flow, '2')
  await enviar(flow, '1')
  await enviar(flow, 'Revisao das pranchas do 3o pavimento')
  await enviar(flow, '8')
  await enviar(flow, '2') // nao teve retrabalho
  const aposGravar = await enviar(flow, '1')

  assert.match(aposGravar, /✅ Sem retrabalho!\n\n📝 \*Quer adicionar observações\?\*/)

  console.log('   ✅ "Sem retrabalho!" segue colado a pergunta de observacoes')
}

if (falhas > 0) {
  console.error(`\ntest-chatbot-voltar: ${falhas} tela(s) respondem erro no voltar`)
  process.exit(1)
}

console.log('test-chatbot-voltar: OK')
