import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve(
  'supabase/migrations/20260825_disciplinas_calculo_areas_eee_canteiro_drt.sql'
)
const reverterPath = resolve('supabase/seeds/reverter_areas_genericas.sql')
const seedPath = resolve('supabase/seeds/seed_areas_completo.sql')
const mockPath = resolve('dashboard/lib/mockData.ts')
const sheetsPath = resolve('integrations/sheets/engineerSheetService.ts')
const insertTestPath = resolve('supabase/_arquivo/INSERT_TEST_TASK.sql')

assert.ok(existsSync(migrationPath), 'Migration 20260825 deve existir')
assert.ok(existsSync(reverterPath), 'reverter_areas_genericas.sql deve existir')
assert.ok(existsSync(seedPath), 'seed_areas_completo.sql deve existir')
assert.ok(existsSync(mockPath), 'mockData.ts deve existir')
assert.ok(existsSync(sheetsPath), 'engineerSheetService.ts deve existir')
assert.ok(existsSync(insertTestPath), 'INSERT_TEST_TASK.sql deve existir')

const migration = readFileSync(migrationPath, 'utf8')
const reverter = readFileSync(reverterPath, 'utf8')
const seed = readFileSync(seedPath, 'utf8')
const mock = readFileSync(mockPath, 'utf8')
const sheets = readFileSync(sheetsPath, 'utf8')
const insertTest = readFileSync(insertTestPath, 'utf8')

assert.match(migration, /UPDATE areas/i, 'Migration deve atualizar a tabela areas')
assert.match(
  migration,
  /codigo\s*=\s*'CANT_OBRA_DRT'/i,
  'Migration deve definir codigo CANT_OBRA_DRT'
)
assert.match(
  migration,
  /descricao\s*=\s*'Canteiro de Obra DRT'/i,
  'Migration deve definir descricao Canteiro de Obra DRT'
)
assert.match(
  migration,
  /WHERE codigo = 'CANT_OBRA_BT'/i,
  'Migration deve filtrar pelo codigo antigo CANT_OBRA_BT'
)
assert.doesNotMatch(
  migration,
  /descricao\s*=\s*'Canteiro de Obra BT'/i,
  'Migration nao deve manter o nome antigo na descricao'
)
assert.doesNotMatch(
  migration,
  /WHERE codigo = 'DRT'/i,
  'Migration nao deve alterar a area DRT existente'
)
assert.doesNotMatch(
  migration,
  /SET codigo = 'DRT'/i,
  'Migration nao deve redefinir codigo para DRT'
)

assert.match(migration, /CALCULO_AREAS/)
assert.match(migration, /Cálculo de Áreas/)
assert.match(migration, /ESTACAO_ELEVATORIA_ESGOTO/)
assert.match(migration, /Estação Elevatória de Esgoto/)
assert.match(
  migration,
  /tempo_trabalho_dias, ativo\)\s*VALUES[\s\S]*'CALCULO_AREAS',\s*'Cálculo de Áreas',\s*0,\s*true/s
)
assert.match(
  migration,
  /tempo_trabalho_dias, ativo\)\s*VALUES[\s\S]*'ESTACAO_ELEVATORIA_ESGOTO',\s*'Estação Elevatória de Esgoto',\s*0,\s*true/s
)
assert.match(migration, /area_etapas_template/)
assert.match(migration, /'global'/)

assert.match(
  reverter,
  /\('CANT_OBRA_DRT',\s*'Canteiro de Obra DRT',\s*5\)/,
  'Seed reverter_areas_genericas deve ter CANT_OBRA_DRT'
)
assert.match(
  reverter,
  /\('DRT',\s*'DRT',\s*5\)/,
  'Seed reverter_areas_genericas deve manter a area DRT'
)
assert.match(reverter, /'CALCULO_AREAS', 'Cálculo de Áreas', 0/)
assert.match(reverter, /'ESTACAO_ELEVATORIA_ESGOTO', 'Estação Elevatória de Esgoto', 0/)
assert.doesNotMatch(
  reverter,
  /CANT_OBRA_BT/,
  'Seed reverter_areas_genericas nao deve mais ter CANT_OBRA_BT'
)
assert.doesNotMatch(
  reverter,
  /Canteiro de Obra BT/,
  'Seed reverter_areas_genericas nao deve mais ter Canteiro de Obra BT'
)

assert.match(seed, /'CALCULO_AREAS', 'Cálculo de Áreas', 0, true/)
assert.match(seed, /'ESTACAO_ELEVATORIA_ESGOTO', 'Estação Elevatória de Esgoto', 0, true/)

assert.match(mock, /codigo: 'CALCULO_AREAS'/)
assert.match(mock, /descricao: 'Cálculo de Áreas'/)
assert.match(mock, /codigo: 'ESTACAO_ELEVATORIA_ESGOTO'/)
assert.match(mock, /descricao: 'Estação Elevatória de Esgoto'/)
assert.match(mock, /tem_etapas_globais: true/)

assert.match(sheets, /'cant de obra DRT'/)
assert.doesNotMatch(sheets, /'cant de obra BT'/)
assert.match(sheets, /'cálculo de áreas'/)
assert.match(sheets, /'estação elevatória de esgoto'/)

assert.match(insertTest, /areas\.codigo = 'CANT_OBRA_DRT'/)
assert.doesNotMatch(insertTest, /CANTEIRO_BT/)

console.log('test-disciplinas-calculo-areas-eee-canteiro-drt: OK')
