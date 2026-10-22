import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const atribuirTaskPath = resolve('dashboard/components/AtribuirTask.tsx')
const supabaseLibPath = resolve('dashboard/lib/supabase.ts')
const compatPath = resolve('dashboard/lib/compatibilizacao.ts')
const migrationPath = resolve('supabase/migrations/20260729_complemento_instancias.sql')

assert.ok(existsSync(atribuirTaskPath), 'AtribuirTask.tsx deve existir')
assert.ok(existsSync(supabaseLibPath), 'supabase.ts deve existir')
assert.ok(existsSync(compatPath), 'compatibilizacao.ts deve existir')
assert.ok(existsSync(migrationPath), 'migration de complemento multi-instancia deve existir')

const { getProjetoAreaDisplayName, isComplementoArea } = await import('../dashboard/lib/compatibilizacao.ts')

assert.equal(
  isComplementoArea({ codigo: 'COMPLEMENTO', descricao: 'Complemento' }),
  true,
  'helper deve detectar area Complemento por codigo'
)

assert.equal(
  getProjetoAreaDisplayName({
    area_codigo: 'COMPLEMENTO',
    area_descricao: 'Complemento',
    instancia_label: 'Complemento de Eletrico 1',
  }),
  'Complemento de Eletrico 1',
  'display deve usar instancia_label para Complemento'
)

assert.equal(
  getProjetoAreaDisplayName({
    area_codigo: 'ELETRICO',
    area_descricao: 'Eletrico',
    instancia_label: 'Complemento de Eletrico 1',
  }),
  'Eletrico',
  'display nao deve usar instancia_label para areas comuns'
)

const atribuirTaskContent = readFileSync(atribuirTaskPath, 'utf8')
assert.match(
  atribuirTaskContent,
  /isComplementoArea/,
  'AtribuirTask deve detectar area Complemento'
)
assert.match(
  atribuirTaskContent,
  /complemento_area_ref_id/,
  'AtribuirTask deve controlar complemento_area_ref_id'
)
assert.match(
  atribuirTaskContent,
  /areaComplemento[\s\S]*<select/,
  'AtribuirTask deve renderizar segunda selecao para Complemento'
)
assert.match(
  atribuirTaskContent,
  /Informe a disciplina que este complemento se refere/,
  'AtribuirTask deve validar disciplina referida obrigatoria'
)

const supabaseLibContent = readFileSync(supabaseLibPath, 'utf8')
assert.match(
  supabaseLibContent,
  /complemento_area_ref_id\?: string \| number/,
  'TaskData/RPC params devem expor complemento_area_ref_id'
)
// Os argumentos da RPC sao montados no servidor (rota /api/admin/atribuicoes)
// desde que atribuir saiu do navegador.
const adminProjetosContent = readFileSync('dashboard/lib/adminProjetos.ts', 'utf8')
assert.match(
  adminProjetosContent,
  /p_complemento_area_ref_id: ref \? String\(ref\) : null/,
  'RPC deve enviar p_complemento_area_ref_id'
)
assert.match(adminProjetosContent, /const ref = b\.complemento_area_ref_id/)

const migrationSql = readFileSync(migrationPath, 'utf8')
assert.match(
  migrationSql,
  /ALTER TABLE engenheiros_projetos[\s\S]*ADD COLUMN IF NOT EXISTS complemento_area_ref_id UUID REFERENCES areas\(area_id\)/i,
  'migration deve adicionar complemento_area_ref_id em engenheiros_projetos'
)
assert.match(
  migrationSql,
  /ALTER TABLE evandro_distribuicao_tasks[\s\S]*ADD COLUMN IF NOT EXISTS complemento_area_ref_id UUID REFERENCES areas\(area_id\)/i,
  'migration deve adicionar complemento_area_ref_id em evandro_distribuicao_tasks'
)
assert.match(
  migrationSql,
  /p_complemento_area_ref_id UUID DEFAULT NULL/i,
  'RPC deve aceitar p_complemento_area_ref_id'
)
assert.match(
  migrationSql,
  /v_area_codigo = 'COMPLEMENTO'[\s\S]*p_complemento_area_ref_id IS NULL/i,
  'RPC deve exigir disciplina referida para Complemento'
)
assert.match(
  migrationSql,
  /Complemento de '\s*\|\|\s*v_complemento_area_descricao\s*\|\|\s*' '\s*\|\|\s*v_fallback_numero/i,
  'RPC deve gerar label numerado de Complemento'
)
assert.match(
  migrationSql,
  /v_area_codigo IN \('COMPATIBILIZACAO', 'COMPLEMENTO'\)/i,
  'migration deve tratar Complemento e Compatibilizacao como multi-instancia'
)
assert.match(
  migrationSql,
  /normalizar_label_compatibilizacao/i,
  'Compatibilizacao deve manter normalizacao existente'
)

console.log('test-dashboard-complemento-instancias: OK')
