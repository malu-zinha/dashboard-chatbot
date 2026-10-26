import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/20260722_renomear_brt_para_drt.sql')
const reverterPath = resolve('supabase/seeds/reverter_areas_genericas.sql')

assert.ok(existsSync(migrationPath), 'Migration 20260722_renomear_brt_para_drt.sql deve existir')
assert.ok(existsSync(reverterPath), 'reverter_areas_genericas.sql deve existir')

const migration = readFileSync(migrationPath, 'utf8')
const reverter = readFileSync(reverterPath, 'utf8')

assert.match(
  migration,
  /UPDATE areas/i,
  'Migration deve atualizar a tabela areas'
)
assert.match(
  migration,
  /codigo\s*=\s*'DRT'/i,
  'Migration deve definir codigo DRT'
)
assert.match(
  migration,
  /descricao\s*=\s*'DRT'/i,
  'Migration deve definir descricao DRT'
)
assert.match(
  migration,
  /WHERE codigo = 'CANT_OBRA_BRT'/i,
  'Migration deve filtrar pelo codigo antigo CANT_OBRA_BRT'
)
assert.doesNotMatch(
  migration,
  /descricao\s*=\s*'Canteiro de Obra BRT'/i,
  'Migration nao deve manter o nome antigo na descricao'
)

assert.match(
  reverter,
  /\('DRT',\s*'DRT',\s*5\)/,
  'Seed reverter_areas_genericas deve ter DRT'
)
assert.doesNotMatch(
  reverter,
  /CANT_OBRA_BRT/,
  'Seed reverter_areas_genericas nao deve mais ter CANT_OBRA_BRT'
)
assert.doesNotMatch(
  reverter,
  /Canteiro de Obra BRT/,
  'Seed reverter_areas_genericas nao deve mais ter Canteiro de Obra BRT'
)

console.log('test-renomear-brt-para-drt: OK')
