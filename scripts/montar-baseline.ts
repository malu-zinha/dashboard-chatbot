// =====================================================
// MONTAR O BASELINE A PARTIR DO CSV EXPORTADO
// =====================================================
// Rodar com: npx tsx scripts/montar-baseline.ts <export.csv> [saida.sql]
//
// Le o CSV de supabase/consultas/exportar_estrutura.sql (Export -> Download
// CSV no SQL Editor) e escreve supabase/migrations/00000000_baseline.sql: a
// estrutura atual do banco num arquivo so, na ordem em que precisa ser criada.
//
// So documenta. Nao conecta em banco nenhum.
// =====================================================

import { readFileSync, writeFileSync } from 'node:fs'

export interface LinhaEstrutura {
  ordem: number
  seq: number
  tipo: string
  nome: string
  ddl: string
}

/** CSV com campos entre aspas que podem ter virgula, aspas dobradas e quebra de linha. */
export function lerCsv(texto: string): string[][] {
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let entreAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          entreAspas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      entreAspas = true
    } else if (c === ',') {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else {
      campo += c
    }
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas.filter((l) => l.some((v) => v !== ''))
}

export function linhasDoCsv(texto: string): LinhaEstrutura[] {
  const [cabecalho, ...resto] = lerCsv(texto.replace(/^﻿/, ''))
  const col = (nome: string) => {
    const i = cabecalho.indexOf(nome)
    if (i < 0) throw new Error(`CSV sem a coluna "${nome}" (veio: ${cabecalho.join(', ')})`)
    return i
  }
  const [iOrdem, iSeq, iTipo, iNome, iDdl] = ['ordem', 'seq', 'tipo', 'nome', 'ddl'].map(col)
  return resto.map((l) => ({
    ordem: Number(l[iOrdem]),
    seq: Number(l[iSeq]),
    tipo: l[iTipo],
    nome: l[iNome],
    ddl: l[iDdl],
  }))
}

const TITULOS: Record<string, string> = {
  extensao: 'Extensoes',
  tipo: 'Tipos',
  sequencia: 'Sequencias',
  tabela: 'Tabelas',
  sequencia_dona: 'Sequencias ligadas as colunas',
  restricao: 'Restricoes',
  indice: 'Indices',
  funcao: 'Funcoes',
  view: 'Views',
  view_materializada: 'Views materializadas',
  trigger: 'Triggers',
  rls: 'Row Level Security',
  policy: 'Policies',
  permissao: 'Permissoes',
  privilegio_padrao: 'Privilegios padrao (so registro)',
}

export function montarBaseline(linhas: LinhaEstrutura[], origem: string): string {
  const ordenadas = [...linhas].sort(
    (a, b) => a.ordem - b.ordem || a.seq - b.seq || a.nome.localeCompare(b.nome),
  )
  const contagem = new Map<string, number>()
  for (const l of ordenadas) contagem.set(l.tipo, (contagem.get(l.tipo) ?? 0) + 1)

  const partes: string[] = [
    '-- =====================================================',
    '-- BASELINE: estrutura do banco de producao',
    '-- =====================================================',
    `-- Gerado por scripts/montar-baseline.ts a partir de ${origem}`,
    '-- (consulta supabase/consultas/exportar_estrutura.sql, so leitura).',
    '--',
    '-- E a fotografia da estrutura que esta valendo: tabelas, funcoes, views,',
    '-- triggers, RLS, policies e permissoes. NAO tem dados.',
    '--',
    '-- NAO rodar na producao: ela ja tem tudo isto. Serve para saber qual versao',
    '-- de cada funcao/view esta valendo e para montar um banco novo (outro projeto',
    '-- Supabase, testes). As migrations com data depois deste arquivo continuam',
    '-- sendo o historico das mudancas.',
    '--',
    '-- Conteudo:',
    ...[...contagem].map(([tipo, n]) => `--   ${TITULOS[tipo] ?? tipo}: ${n}`),
    '-- =====================================================',
    '',
    'SET check_function_bodies = false;',
    "SET client_min_messages = warning;",
    'SET search_path = public, extensions;',
    '',
  ]

  let tipoAtual = ''
  for (const l of ordenadas) {
    if (l.tipo !== tipoAtual) {
      tipoAtual = l.tipo
      partes.push('', '-- -----------------------------------------------------', `-- ${TITULOS[l.tipo] ?? l.tipo}`, '-- -----------------------------------------------------', '')
    }
    partes.push(`-- ${l.tipo}: ${l.nome}`, l.ddl.trimEnd(), '')
  }
  return partes.join('\n').replace(/\n{3,}/g, '\n\n') + '\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [csv, saida = 'supabase/migrations/00000000_baseline.sql'] = process.argv.slice(2)
  if (!csv) {
    console.error('Uso: npx tsx scripts/montar-baseline.ts <export.csv> [saida.sql]')
    process.exit(1)
  }
  const linhas = linhasDoCsv(readFileSync(csv, 'utf8'))
  writeFileSync(saida, montarBaseline(linhas, csv.split('/').pop() ?? csv))
  console.log(`✅ ${linhas.length} objetos -> ${saida}`)
}
