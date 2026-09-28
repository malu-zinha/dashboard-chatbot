import assert from 'node:assert/strict'
import { getSupabaseService } from '../integrations/supabase/supabaseService.ts'

// registrarRetrabalho terminava com `return await this.buscarUltimoRetrabalho(...)`, e essa busca
// filtra `necessitou_retrabalho = true`. Quem aponta SEM retrabalho grava uma linha com false, a
// busca nao acha nada e devolve null — mesmo tendo gravado. Como o fluxo passou a tratar null como
// falha, todo apontamento sem retrabalho numa atribuicao sem retrabalho anterior respondia
// "❌ Nao consegui gravar as horas" com as horas ja no banco.
//
// O sucesso tem que vir do que a RPC respondeu, nao de uma leitura posterior.

const ATRIBUICAO = 'f9b3e624-9d26-49e3-8908-ffa9bb2c8f91'

// Cliente falso no formato do supabase-js: .rpc() e a cadeia .from().select()...maybeSingle().
function criarClienteFalso(opcoes: {
  rpc: { data?: any; error?: any }
  ultimoRetrabalho?: any
}) {
  const cadeia: any = {
    select: () => cadeia,
    eq: () => cadeia,
    order: () => cadeia,
    limit: () => cadeia,
    maybeSingle: async () => ({ data: opcoes.ultimoRetrabalho ?? null, error: null }),
  }
  return {
    rpc: async () => opcoes.rpc,
    from: () => cadeia,
  }
}

function criarServico(opcoes: Parameters<typeof criarClienteFalso>[0], conectado = true) {
  const svc = getSupabaseService() as any
  svc.supabase = criarClienteFalso(opcoes)
  svc.connected = conectado
  return svc
}

const registrar = (svc: any, necessitou: boolean) =>
  svc.registrarRetrabalho(ATRIBUICAO, necessitou, necessitou ? 'Outro' : undefined, undefined, undefined, 6.7, necessitou ? 2 : 0)

let falhas = 0
const conferir = (nome: string, cond: boolean, detalhe = '') => {
  if (cond) {
    console.log(`   ✅ ${nome}`)
  } else {
    falhas++
    console.error(`   ❌ ${nome}${detalhe ? `\n      ${detalhe}` : ''}`)
  }
}

// =====================================================
// O bug: gravou, mas nao ha retrabalho anterior para achar
// =====================================================
{
  const svc = criarServico({
    rpc: { data: { sucesso: true, mensagem: 'Registro de retrabalho atualizado' } },
    ultimoRetrabalho: null, // nenhuma linha com necessitou_retrabalho = true
  })

  const r = await registrar(svc, false)
  conferir(
    'sem retrabalho anterior -> ainda assim e sucesso',
    r?.ok === true,
    `resultado: ${JSON.stringify(r)}`
  )
}

// =====================================================
// A RPC recusou os dados
// =====================================================
{
  const svc = criarServico({
    rpc: { data: { sucesso: false, mensagem: 'Atribuição não encontrada' } },
  })

  const r = await registrar(svc, false)
  conferir('RPC recusando -> ok false com motivo "recusado"', r?.ok === false && r?.motivo === 'recusado')
  conferir(
    'a mensagem do banco e preservada',
    typeof r?.mensagem === 'string' && r.mensagem.includes('Atribuição não encontrada'),
    `mensagem: ${r?.mensagem}`
  )
}

// =====================================================
// Erro de transporte / PostgREST
// =====================================================
{
  const svc = criarServico({
    rpc: { data: null, error: { message: 'could not find function', code: 'PGRST202' } },
  })

  const r = await registrar(svc, false)
  conferir('erro da RPC -> ok false com motivo "erro_rpc"', r?.ok === false && r?.motivo === 'erro_rpc')
}

// =====================================================
// Cliente sem conexao
// =====================================================
{
  const svc = criarServico({ rpc: { data: { sucesso: true } } }, false)

  const r = await registrar(svc, false)
  conferir('sem conexao -> ok false com motivo "sem_conexao"', r?.ok === false && r?.motivo === 'sem_conexao')
}

// =====================================================
// Ramo com retrabalho continua funcionando
// =====================================================
{
  const svc = criarServico({
    rpc: { data: { sucesso: true, mensagem: 'Retrabalho registrado' } },
    ultimoRetrabalho: { id: 'r1', necessitou_retrabalho: true },
  })

  const r = await registrar(svc, true)
  conferir('com retrabalho -> ok true', r?.ok === true)
}

if (falhas > 0) {
  console.error(`\ntest-registrar-retrabalho-retorno: ${falhas} verificacao(oes) falharam`)
  process.exit(1)
}

console.log('test-registrar-retrabalho-retorno: OK')
