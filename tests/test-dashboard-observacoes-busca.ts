import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projetosTablePath = resolve('dashboard/components/ProjetosTable.tsx')
const projetoDetalhesModalPath = resolve('dashboard/components/ProjetoDetalhesModal.tsx')
const searchLibPath = resolve('dashboard/lib/search.ts')

// Verifica que os arquivos existem
assert.ok(existsSync(projetosTablePath), 'ProjetosTable.tsx deve existir')
assert.ok(existsSync(projetoDetalhesModalPath), 'ProjetoDetalhesModal.tsx deve existir')
assert.ok(existsSync(searchLibPath), 'search.ts deve existir')

const projetosTableContent = readFileSync(projetosTablePath, 'utf8')
const projetoDetalhesModalContent = readFileSync(projetoDetalhesModalPath, 'utf8')

// Verifica que ProjetosTable importa ProjetoDetalhesModal
assert.match(
  projetosTableContent,
  /import ProjetoDetalhesModal from/,
  'ProjetosTable deve importar ProjetoDetalhesModal'
)

// Verifica que ProjetosTable tem estado para detalheProjeto
assert.match(
  projetosTableContent,
  /\[detalheProjeto, setDetalheProjeto\]/,
  'ProjetosTable deve ter estado detalheProjeto'
)

// Verifica que ProjetosTable renderiza o modal de detalhes
assert.match(
  projetosTableContent,
  /<ProjetoDetalhesModal/,
  'ProjetosTable deve renderizar ProjetoDetalhesModal'
)

// Verifica que ProjetosTable tem botao Eye para ver detalhes
assert.match(
  projetosTableContent,
  /<Eye/,
  'ProjetosTable deve ter icone Eye para ver detalhes'
)

// Verifica correcao da busca: o engenheiro de uma disciplina ja concluida continua achando
// o projeto na aba em_execucao. Desde o agrupamento por projeto, a busca olha os campos de
// TODAS as disciplinas do projeto (lib/projetosAgrupados.ts); o comportamento tem teste em
// test-dashboard-projetos-agrupados.ts.
const projetosAgrupadosContent = readFileSync(resolve('dashboard/lib/projetosAgrupados.ts'), 'utf8')
assert.match(
  projetosAgrupadosContent,
  /export const camposBusca = [\s\S]*?projeto\.disciplinas\.flatMap\(\(d\) => \[d\.engenheiro_nome/,
  'camposBusca deve incluir o engenheiro de todas as disciplinas do projeto'
)
assert.match(
  projetosTableContent,
  /filtrarProjetos\(projetosAgrupados, filterStatus, searchTerm/,
  'ProjetosTable deve filtrar e buscar pelos projetos agrupados'
)

// Verifica ProjetoDetalhesModal exibe observacoes
assert.match(
  projetoDetalhesModalContent,
  /motivo_aguardo/,
  'ProjetoDetalhesModal deve exibir motivo_aguardo (observacoes)'
)

assert.match(
  projetoDetalhesModalContent,
  /Observacoes do Engenheiro/i,
  'ProjetoDetalhesModal deve ter titulo de observacoes'
)

assert.match(
  projetoDetalhesModalContent,
  /MessageSquare/,
  'ProjetoDetalhesModal deve ter icone MessageSquare para observacoes'
)

// Testa a funcao searchScore
const { searchScore } = await import('../dashboard/lib/search.ts')

// Busca vazia retorna 1
assert.equal(searchScore('', ['campo']), 1, 'Busca vazia deve retornar 1')

// Busca exata tem maior score
assert.ok(
  searchScore('joao', ['joao']) > searchScore('joao', ['joao silva']),
  'Busca exata deve ter maior score que parcial'
)

// Busca por prefixo funciona
assert.ok(
  searchScore('joa', ['joao']) > 0,
  'Busca por prefixo deve encontrar'
)

// Busca por conteudo funciona
assert.ok(
  searchScore('silva', ['joao silva santos']) > 0,
  'Busca por conteudo deve encontrar'
)

// Busca sem match retorna 0
assert.equal(
  searchScore('xyz', ['joao', 'maria']),
  0,
  'Busca sem match deve retornar 0'
)

// Busca em multiplos campos funciona
assert.ok(
  searchScore('joao', ['codigo123', 'cliente abc', 'joao silva', 'area x']) > 0,
  'Busca deve encontrar em qualquer campo'
)

// Busca case-insensitive
assert.ok(
  searchScore('JOAO', ['joao silva']) > 0,
  'Busca deve ser case-insensitive'
)

// Busca tolera acentos
assert.ok(
  searchScore('joao', ['joão silva']) > 0,
  'Busca deve tolerar acentos'
)

console.log('test-dashboard-observacoes-busca: OK')
