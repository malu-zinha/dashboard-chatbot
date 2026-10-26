// =====================================================
// TESTE: montar o baseline a partir do CSV exportado
// =====================================================
// Rodar com: npx tsx tests/test-montar-baseline.ts
//
// O CSV do SQL Editor traz o SQL de cada objeto numa celula, com virgulas,
// aspas e quebras de linha. O script tem que ler isso sem perder nada e
// escrever os objetos na ordem em que precisam ser criados.
// =====================================================

import assert from 'node:assert/strict'
import { lerCsv, linhasDoCsv, montarBaseline } from '../scripts/montar-baseline.ts'

let passou = 0
function ok(nome: string) {
  passou++
  console.log(`   ✅ ${nome}`)
}

console.log('\n🧱 Montar baseline\n')

{
  const csv = 'a,b\r\n"x, y","linha 1\nlinha 2 com ""aspas"""\r\n'
  assert.deepEqual(lerCsv(csv), [
    ['a', 'b'],
    ['x, y', 'linha 1\nlinha 2 com "aspas"'],
  ])
  ok('le campos com virgula, aspas dobradas e quebra de linha')
}

const funcao = "CREATE OR REPLACE FUNCTION public.f()\n RETURNS text\n LANGUAGE sql\nAS $function$ SELECT 'a, \"b\"' $function$\n;"
const csv = [
  '﻿ordem,seq,tipo,nome,ddl',
  `7,500,funcao,f(),"${funcao.replaceAll('"', '""')}"`,
  '3,20,tabela,b,"CREATE TABLE public.b (\n  id integer\n);"',
  '3,10,tabela,a,"CREATE TABLE public.a (\n  id integer\n);"',
  '5,30,restricao,b.fk,"ALTER TABLE public.b ADD CONSTRAINT fk FOREIGN KEY (id) REFERENCES a(id);"',
  '4,25,restricao,a.pk,"ALTER TABLE public.a ADD CONSTRAINT pk PRIMARY KEY (id);"',
].join('\r\n')

{
  const linhas = linhasDoCsv(csv)
  assert.equal(linhas.length, 5)
  assert.equal(linhas.find((l) => l.tipo === 'funcao')?.ddl, funcao)
  ok('le o CSV do SQL Editor (com BOM) sem alterar o SQL de cada objeto')
}

{
  const sql = montarBaseline(linhasDoCsv(csv), 'export.csv')
  const pos = (trecho: string) => {
    const i = sql.indexOf(trecho)
    assert.ok(i >= 0, `faltou: ${trecho}`)
    return i
  }
  assert.ok(pos('CREATE TABLE public.a') < pos('CREATE TABLE public.b'), 'tabelas na ordem do seq')
  assert.ok(pos('CREATE TABLE public.b') < pos('ADD CONSTRAINT pk'), 'restricoes depois das tabelas')
  assert.ok(pos('ADD CONSTRAINT pk') < pos('ADD CONSTRAINT fk'), 'chave primaria antes da estrangeira')
  assert.ok(pos('ADD CONSTRAINT fk') < pos('CREATE OR REPLACE FUNCTION'), 'funcoes depois das restricoes')
  assert.ok(pos('SET check_function_bodies = false;') < pos('CREATE TABLE'), 'cabecalho antes de tudo')
  assert.match(sql, /NAO rodar na producao/)
  assert.match(sql, /Tabelas: 2/)
  ok('escreve na ordem de criacao, com cabecalho e contagem por tipo')
}

console.log(`\n${passou} casos passaram\n`)
