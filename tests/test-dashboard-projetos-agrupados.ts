import assert from 'node:assert/strict'

// dashboard/ e um pacote CommonJS: daqui do ESM da raiz o modulo chega como default.
import * as modNs from '../dashboard/lib/projetosAgrupados.ts'

const mod = ((modNs as any).default ?? modNs) as typeof import('../dashboard/lib/projetosAgrupados.ts')
const { agruparProjetos, filtrarProjetos, buscaCasouPorDisciplina, projetoNaAba } = mod

// Dados ficticios (repo publico): nenhum nome, projeto ou cliente real.
let seq = 0
function disc(projeto: string, extra: Record<string, unknown> = {}) {
  seq += 1
  return {
    atribuicao_id: `a-${seq}`,
    projeto_id: projeto,
    codigo_projeto: `TST-${projeto}`,
    cliente: `Cliente ${projeto}`,
    descricao: null,
    engenheiro_nome: 'Eng Alfa',
    area_codigo: 'ELE',
    area_descricao: 'Eletrico',
    instancia_label: null,
    percentual_andamento: 50,
    data_prevista: '2099-01-10',
    data_conclusao: null as string | null,
    dias_atraso: 0,
    ...extra,
  }
}
const concluida = (projeto: string, data: string | null, extra: Record<string, unknown> = {}) =>
  disc(projeto, { percentual_andamento: 100, data_conclusao: data, ...extra })

const linhas = [
  // P1: 2 de 3 concluidas, uma atrasada
  concluida('P1', '2026-09-05', { engenheiro_nome: 'Eng Beta', area_descricao: 'Hidraulico', area_codigo: 'HID' }),
  disc('P1', { dias_atraso: 4, data_prevista: '2026-09-01', percentual_andamento: 40 }),
  concluida('P1', '2026-09-10'),
  // P2: tudo concluido, com data
  concluida('P2', '2026-09-20'),
  concluida('P2', '2026-09-25', { engenheiro_nome: 'Eng Gama' }),
  // P3: aguardando (nada iniciado)
  disc('P3', { percentual_andamento: 0, data_prevista: '2099-02-01' }),
  disc('P3', { percentual_andamento: 0, data_prevista: '2099-01-15' }),
  // P4: concluido mas uma disciplina sem data de conclusao
  concluida('P4', '2026-09-12'),
  concluida('P4', null),
  // P5: projeto sem disciplina (linha da view com atribuicao nula)
  { ...disc('P5'), atribuicao_id: null, engenheiro_nome: 'Sem engenheiro', percentual_andamento: 0 },
  // P6: em andamento, no prazo
  disc('P6', { percentual_andamento: 20 }),
  disc('P6', { percentual_andamento: 80 }),
]

const grupos = agruparProjetos(linhas)
const porId = Object.fromEntries(grupos.map((g) => [g.projeto_id, g]))

// Agrupamento e ordem de chegada (a view ja vem por created_at desc)
assert.deepEqual(grupos.map((g) => g.projeto_id), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'], 'um grupo por projeto, na ordem original')
assert.equal(porId.P1.total, 3)
assert.equal(porId.P1.concluidas, 2)
assert.equal(porId.P5.total, 0, 'linha sem atribuicao nao vira disciplina')

// Disciplinas: atrasadas primeiro, depois abertas, depois concluidas
assert.equal(porId.P1.disciplinas[0].dias_atraso, 4, 'atrasada vem primeiro')

// Situacao
assert.equal(porId.P1.situacao, 'atrasado')
assert.equal(porId.P2.situacao, 'concluido')
assert.equal(porId.P3.situacao, 'aguardando')
assert.equal(porId.P4.situacao, 'concluido')
assert.equal(porId.P5.situacao, 'sem_disciplinas')
assert.equal(porId.P6.situacao, 'em_andamento')

// Progresso = media simples das disciplinas (como recalcular_rollup_projeto)
assert.equal(porId.P1.progresso, 80)
assert.equal(porId.P6.progresso, 50)
assert.equal(porId.P1.maiorAtraso, 4)

// Proximo prazo = menor prazo entre as abertas; data de conclusao so com todas datadas
assert.equal(porId.P3.proximoPrazo, '2099-01-15')
assert.equal(porId.P2.dataConclusao, '2026-09-25')
assert.equal(porId.P4.dataConclusao, null, 'concluido com disciplina sem data nao tem data de conclusao')
assert.equal(porId.P1.dataConclusao, null, 'projeto aberto nao tem data de conclusao')

assert.deepEqual(porId.P2.engenheiros, ['Eng Alfa', 'Eng Gama'])

// Abas: mesmas regras de vw_bloco1_visao_geral
const ids = (filtro: 'all' | 'concluido' | 'em_execucao' | 'atrasado') =>
  grupos.filter((g) => projetoNaAba(g, filtro)).map((g) => g.projeto_id)
assert.deepEqual(ids('all'), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'])
assert.deepEqual(ids('concluido'), ['P2', 'P4'], 'concluido so com todas as disciplinas concluidas')
assert.deepEqual(ids('em_execucao'), ['P1', 'P3', 'P6'], 'em execucao inclui atrasados; sem disciplina fica fora')
assert.deepEqual(ids('atrasado'), ['P1'])

// Periodo de conclusao (aba concluidos), pela data de conclusao do projeto
const setembroFim = filtrarProjetos(grupos, 'concluido', '', { dataInicio: '2026-09-21', dataFim: '2026-09-30' })
assert.deepEqual(setembroFim.projetos.map((g) => g.projeto_id), ['P2'])
assert.deepEqual(setembroFim.ocultadosSemData.map((g) => g.projeto_id), ['P4'], 'concluido sem data vai para o aviso')
const semPeriodo = filtrarProjetos(grupos, 'concluido', '')
assert.equal(semPeriodo.ocultadosSemData.length, 0, 'sem periodo nao ha ocultados')
assert.deepEqual(semPeriodo.projetos.map((g) => g.projeto_id), ['P2', 'P4'])
const periodoEmOutraAba = filtrarProjetos(grupos, 'all', '', { dataInicio: '2026-09-21' })
assert.equal(periodoEmOutraAba.projetos.length, 6, 'o periodo so vale na aba de concluidos')

// Busca: engenheiro de uma disciplina ja concluida acha o projeto na aba Em execucao
const porBeta = filtrarProjetos(grupos, 'em_execucao', 'beta')
assert.deepEqual(porBeta.projetos.map((g) => g.projeto_id), ['P1'])
assert.equal(buscaCasouPorDisciplina(porId.P1, 'beta'), true, 'casou pela disciplina: a linha abre sozinha')
assert.equal(buscaCasouPorDisciplina(porId.P1, 'TST-P1'), false, 'casou pelo codigo: a linha fica fechada')
assert.equal(buscaCasouPorDisciplina(porId.P1, ''), false)

// Busca com varias palavras em disciplinas diferentes do mesmo projeto
assert.deepEqual(filtrarProjetos(grupos, 'all', 'beta eletrico').projetos.map((g) => g.projeto_id), ['P1'])

// Ranking: codigo exato vem antes de quem so contem o termo
const ranking = filtrarProjetos(grupos, 'all', 'tst-p2').projetos.map((g) => g.projeto_id)
assert.equal(ranking[0], 'P2')

console.log('test-dashboard-projetos-agrupados: OK')
