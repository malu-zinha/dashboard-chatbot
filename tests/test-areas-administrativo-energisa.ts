import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/20260831_disciplinas_administrativo_energisa.sql')
const seedPath = resolve('supabase/seeds/seed_areas_completo.sql')
const mockPath = resolve('dashboard/lib/mockData.ts')
const sheetsPath = resolve('integrations/sheets/engineerSheetService.ts')

assert.ok(existsSync(migrationPath), 'migration das disciplinas Administrativo e Energisa deve existir')
assert.ok(existsSync(seedPath), 'seed_areas_completo.sql deve existir')
assert.ok(existsSync(mockPath), 'mockData.ts deve existir')
assert.ok(existsSync(sheetsPath), 'engineerSheetService.ts deve existir')

const migration = readFileSync(migrationPath, 'utf8')
const seed = readFileSync(seedPath, 'utf8')
const mock = readFileSync(mockPath, 'utf8')
const sheets = readFileSync(sheetsPath, 'utf8')

assert.match(migration, /ADMINISTRATIVO/)
assert.match(migration, /Administrativo/)
assert.match(migration, /ENERGISA/)
assert.match(migration, /Energisa/)
assert.match(
  migration,
  /tempo_trabalho_dias,\s*ativo\)\s*VALUES[\s\S]*'ADMINISTRATIVO',\s*'Administrativo',\s*0,\s*true/s
)
assert.match(
  migration,
  /tempo_trabalho_dias,\s*ativo\)\s*VALUES[\s\S]*'ENERGISA',\s*'Energisa',\s*0,\s*true/s
)
assert.match(migration, /area_etapas_template/)
assert.match(migration, /'global'/)
assert.match(migration, /ALTERACAO_ENERGISA/, 'migration deve preservar referencia historica a ALTERACAO_ENERGISA')

assert.match(seed, /'ADMINISTRATIVO', 'Administrativo', 0, true/)
assert.match(seed, /'ENERGISA', 'Energisa', 0, true/)
assert.match(seed, /'ALTERACAO_ENERGISA', 'Alteração Energisa', 0, true/)

assert.match(mock, /codigo: 'ADMINISTRATIVO'/)
assert.match(mock, /descricao: 'Administrativo'/)
assert.match(mock, /codigo: 'ENERGISA'/)
assert.match(mock, /descricao: 'Energisa'/)
assert.match(mock, /codigo: 'ALTERACAO_ENERGISA'/)

assert.match(sheets, /'administrativo'/)
assert.match(sheets, /'energisa'/)

console.log('test-areas-administrativo-energisa: OK')
