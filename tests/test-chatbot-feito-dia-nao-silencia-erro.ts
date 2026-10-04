import assert from 'node:assert/strict'
import { EngineerProjectFlow } from '../chatbot/flows/engineerProjectFlow.ts'

// O upsert de projetos_previsao em atualizarFeitoDia nao passa previsao_texto, e a coluna era
// NOT NULL. Toda notificacao noturna num dia sem notificacao matinal violava a constraint, o
// erro virava console.warn e o fluxo seguia anunciando "Notificacao Noturna Registrada!" — o
// relato do engenheiro ia para o lixo sem ninguem perceber. Medicao no banco em 04/10/2026:
// 203 registros em projetos_previsao, 1 unico com feito_texto, contra 393 apontamentos
// noturnos em retrabalho_projetos no mesmo periodo.
//
// A migration 20261004 tirou o NOT NULL; estes testes travam o outro lado: a falha de
// gravacao nao pode mais ser engolida.

function criarFlow(resultadoFeitoDia: any) {
  const flow = new EngineerProjectFlow('+5583999990000', 'Maria') as any
  const chamadas: Array<{ atribuicaoId: string; feito: string; observacoes?: string }> = []

  flow.supabase = {
    atualizarFeitoDia: async (atribuicaoId: string, feito: string, observacoes?: string) => {
      chamadas.push({ atribuicaoId, feito, observacoes })
      return resultadoFeitoDia
    },
    // Chamadas do caminho feliz, depois da gravacao: sem etapas pendentes o fluxo encerra.
    buscarPavimentosComEtapas: async () => [],
    buscarEtapasGlobais: async () => [],
  }

  flow.state = {
    step: 'observacoes_pergunta',
    stepHistory: ['escolher_acao', 'escolher_projeto_noite', 'escolher_area_noite', 'feito_dia'],
    snapshotHistory: [],
    mode: 'notif_noite',
    projectData: {},
    selectedAtribuicaoId: 'atrib-1',
    selectedProjetoId: 'proj-1',
    selectedAreaId: 'area-1',
    projectCode: 'PRJ-109',
    feitoTexto: 'Revisao das pranchas do 3o pavimento',
    teveRetrabalho: false,
  }

  return { flow, chamadas }
}

const enviar = async (flow: any, msg: string): Promise<string> =>
  (await flow.processarMensagem(msg)).mensagem

// =====================================================
// Falha ao gravar o relato do dia
// =====================================================
{
  const { flow, chamadas } = criarFlow({
    ok: false,
    motivo: 'erro_feito',
    mensagem: 'null value in column "previsao_texto" violates not-null constraint',
  })

  const resposta = await enviar(flow, '2') // nao quer adicionar observacoes

  assert.equal(chamadas.length, 1, 'a gravacao deve ter sido tentada')
  assert.doesNotMatch(
    resposta,
    /Notificação Noturna Registrada/,
    'nao pode anunciar registro quando a gravacao falhou'
  )
  assert.match(resposta, /não consegui gravar o relato do dia/i, 'deve dizer o que se perdeu')

  // As horas foram gravadas pela RPC antes deste passo. Mandar refazer tudo levaria o
  // engenheiro a sobrescrever um apontamento que esta correto no banco.
  assert.match(resposta, /horas e o retrabalho já foram registrados/i, 'deve dizer o que ficou salvo')
  assert.match(resposta, /não precisa refazer o apontamento de horas/i, 'nao pode mandar refazer as horas')
}

// =====================================================
// Falha so na observacao: a mensagem aponta a observacao, nao o relato
// =====================================================
{
  const { flow } = criarFlow({
    ok: false,
    motivo: 'erro_observacoes',
    mensagem: 'erro ao gravar observacao',
  })

  flow.state.step = 'observacoes_texto'
  const resposta = await enviar(flow, 'Falta Dr. Evandro revisar')

  assert.doesNotMatch(resposta, /Notificação Noturna Registrada/, 'nao pode anunciar registro')
  assert.match(resposta, /não consegui gravar a observação/i, 'deve nomear a observacao')
}

// =====================================================
// Caminho feliz continua confirmando
// =====================================================
{
  const { flow, chamadas } = criarFlow({ ok: true })

  const resposta = await enviar(flow, '2')

  assert.equal(chamadas.length, 1)
  assert.match(resposta, /Notificação Noturna Registrada/, 'sucesso continua confirmando')
  assert.match(resposta, /PRJ-109/, 'o resumo mantem o projeto')
}

// =====================================================
// O servico nao pode mais engolir a falha do upsert
// =====================================================
{
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const servico = readFileSync(resolve('integrations/supabase/supabaseService.ts'), 'utf8')

  // listarStatus( com parentese: listarStatusDisponiveis aparece bem antes no arquivo.
  const inicio = servico.indexOf('async atualizarFeitoDia')
  const fim = servico.indexOf('async listarStatus(')
  const trecho = servico.slice(inicio, fim)

  assert.ok(trecho.length > 0, 'deve encontrar atualizarFeitoDia')
  assert.doesNotMatch(
    trecho,
    /console\.warn\([^)]*previs/i,
    'a falha do upsert de previsao nao pode voltar a ser um warning'
  )
  assert.match(trecho, /motivo: 'erro_feito'/, 'a falha do relato deve ser reportada ao chamador')
}

// =====================================================
// A migration precisa soltar o NOT NULL que causava a perda
// =====================================================
{
  const { readFileSync } = await import('node:fs')
  const { resolve } = await import('node:path')
  const migration = readFileSync(
    resolve('supabase/migrations/20261004_observacoes_e_feito_do_dia.sql'),
    'utf8'
  )

  assert.match(
    migration,
    /ALTER TABLE projetos_previsao\s+ALTER COLUMN previsao_texto DROP NOT NULL/,
    'previsao_texto precisa deixar de ser NOT NULL'
  )
  assert.match(
    migration,
    /SET atribuido_por = observacoes,\s+observacoes = NULL/,
    'o backfill deve copiar o carimbo antes de limpar observacoes'
  )
  // O carimbo existe com e sem acento no historico: 'Atribuido por' nas migrations recentes,
  // 'Atribuído por' nas antigas (supabase/triggers_e_views.sql).
  assert.match(
    migration,
    /observacoes ~\* '\^Atribu\[ií\]do por:'/,
    'o backfill deve cobrir as duas grafias do carimbo'
  )
}

console.log('test-chatbot-feito-dia-nao-silencia-erro: OK')
