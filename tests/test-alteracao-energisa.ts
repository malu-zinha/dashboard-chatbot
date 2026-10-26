import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(
  'supabase/migrations/20260708_dashboard_alteracao_energisa.sql',
  'utf8',
);
const seed = readFileSync('supabase/seeds/seed_areas_completo.sql', 'utf8');
const mock = readFileSync('dashboard/lib/mockData.ts', 'utf8');

assert.match(migration, /ALTERACAO_ENERGISA/);
assert.match(migration, /Alteração Energisa/);
assert.match(migration, /tempo_trabalho_dias, ativo\)\s*VALUES\s*\(\s*'ALTERACAO_ENERGISA',\s*'Alteração Energisa',\s*0,\s*true\s*\)/s);
assert.match(migration, /area_etapas_template/);
assert.match(migration, /'global'/);

assert.match(seed, /'ALTERACAO_ENERGISA', 'Alteração Energisa', 0, true/);
assert.match(mock, /codigo: 'ALTERACAO_ENERGISA'/);
assert.match(mock, /descricao: 'Alteração Energisa'/);
assert.match(mock, /tem_etapas_globais: true/);

console.log('test-alteracao-energisa: OK');
