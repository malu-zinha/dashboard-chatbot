// =====================================================
// TESTE: telefone reconhecido com ou sem o 9 depois do DDD
// =====================================================
// Rodar com: npx tsx tests/test-telefone-nono-digito.ts
//
// O WhatsApp entrega muitos celulares brasileiros sem o 9 (+55 DDD XXXXXXXX)
// e a busca era por igualdade exata. Em producao (21/10/2026) os 13
// engenheiros ativos estao cadastrados sem o 9, e os 3 cadastrados com o 9
// estao inativos — quem e cadastrado no formato natural nao e reconhecido.
// Agora a busca tenta as duas formas e prefere a exata.
// =====================================================

import assert from 'node:assert/strict'
import { variantesTelefoneBR } from '../logic/validation/telefoneBR.ts'
import { getSupabaseService } from '../integrations/supabase/supabaseService.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n📱 Nono digito\n')

assert.deepEqual(variantesTelefoneBR('+558399886288'), ['+558399886288', '+5583999886288'])
ok('sem o 9: tambem procura com o 9')
assert.deepEqual(variantesTelefoneBR('+5583999886288'), ['+5583999886288', '+558399886288'])
ok('com o 9: tambem procura sem o 9')
assert.deepEqual(variantesTelefoneBR('+558332221111'), ['+558332221111'])
ok('fixo (comeca com 2-5) nao ganha variante')
assert.deepEqual(variantesTelefoneBR('+14155238886'), ['+14155238886'])
ok('numero estrangeiro nao ganha variante')
assert.deepEqual(variantesTelefoneBR('5583999886288'), ['5583999886288', '558399886288'])
ok('sem o + continua funcionando (mantem o formato recebido)')

// Busca no servico: cliente falso captura o filtro e devolve as linhas
function servico(linhas: any[], erro: any = null) {
  const svc = getSupabaseService() as any
  const capturado: any = {}
  const cadeia: any = {
    select: () => cadeia,
    in: (col: string, vals: string[]) => { capturado.in = { col, vals }; return cadeia },
    eq: () => cadeia,
    then: (res: any) => res({ data: erro ? null : linhas, error: erro }),
  }
  svc.supabase = { from: (t: string) => { capturado.tabela = t; return cadeia } }
  svc.connected = true
  return { svc, capturado }
}

{
  const { svc, capturado } = servico([{ nome: 'Marina', telefone: '+558399886288' }])
  const eng = await svc.buscarEngenheiroPorTelefone('+5583999886288')
  assert.deepEqual(capturado.in, { col: 'telefone', vals: ['+5583999886288', '+558399886288'] })
  assert.equal(eng.nome, 'Marina')
  ok('engenheiro cadastrado sem o 9 e reconhecido quando chega com o 9')
}

{
  const { svc } = servico([
    { nome: 'Outro', telefone: '+558399886288' },
    { nome: 'Exato', telefone: '+5583999886288' },
  ])
  const eng = await svc.buscarEngenheiroPorTelefone('+5583999886288')
  assert.equal(eng.nome, 'Exato')
  ok('se as duas formas existirem, prefere a exata (sem erro de "varias linhas")')
}

{
  const { svc } = servico([])
  assert.equal(await svc.buscarEngenheiroPorTelefone('+558399886288'), null)
  ok('nenhuma das formas: continua "nao cadastrado" (null)')
}

{
  const { svc, capturado } = servico([{ nome: 'Dono', telefone: '+558391112222' }])
  const dono = await svc.buscarDonoPorTelefone('+5583991112222')
  assert.equal(capturado.tabela, 'dono_empresa')
  assert.equal(dono.nome, 'Dono')
  ok('dono tambem e reconhecido com ou sem o 9')
}

{
  const { svc } = servico([], { message: 'timeout' })
  await assert.rejects(() => svc.buscarEngenheiroPorTelefone('+558399886288'), /indispon|Unavailable/i)
  ok('erro do banco continua sendo "indisponivel", nunca "nao cadastrado"')
}

console.log(`\n✅ ${passou} verificacoes passaram\n`)
