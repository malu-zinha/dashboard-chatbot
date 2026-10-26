import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve(
  'supabase/migrations/20260708_dashboard_reativar_projetos_inativos.sql'
)
const migrationSql = readFileSync(migrationPath, 'utf8')
const chatbotFunctionsSql = readFileSync(
  resolve('supabase/_arquivo/chatbot_functions.sql'),
  'utf8'
)
const supabaseService = readFileSync(
  resolve('integrations/supabase/supabaseService.ts'),
  'utf8'
)
const dashboardSupabaseLib = readFileSync(
  resolve('dashboard/lib/supabase.ts'),
  'utf8'
)

assert.match(migrationSql, /CREATE OR REPLACE FUNCTION dashboard_atribuir_projeto_com_pavimentos\(/)
assert.match(migrationSql, /UPDATE projetos\s+SET[\s\S]*ativo = true/)
assert.match(migrationSql, /reativado/)
assert.doesNotMatch(
  migrationSql,
  /RETURN json_build_object\('sucesso', false, 'mensagem', 'Projeto existe, mas esta inativo'\)/
)

assert.match(migrationSql, /CREATE OR REPLACE FUNCTION desativar_projeto_completo\(/)
assert.match(migrationSql, /UPDATE engenheiros_projetos\s+SET[\s\S]*ativo = false/)
assert.match(migrationSql, /UPDATE evandro_distribuicao_tasks\s+SET[\s\S]*ativo = false/)
assert.match(migrationSql, /UPDATE notificacoes_whatsapp\s+SET[\s\S]*enviada = true/)
assert.match(migrationSql, /Cancelada por exclusao do projeto/)
assert.match(migrationSql, /DELETE FROM projeto_etapas_globais/)
assert.match(migrationSql, /DELETE FROM projeto_pavimentos/)

assert.match(migrationSql, /CREATE OR REPLACE FUNCTION criar_projeto\(/)
assert.match(migrationSql, /IF v_projeto_ativo = false THEN/)
assert.match(migrationSql, /UPDATE projetos\s+SET[\s\S]*ativo = true/)
assert.match(chatbotFunctionsSql, /CREATE OR REPLACE FUNCTION criar_projeto\(/)
assert.match(chatbotFunctionsSql, /IF v_projeto_id IS NOT NULL AND v_projeto_ativo = false THEN/)
assert.match(chatbotFunctionsSql, /DELETE FROM projeto_pavimentos/)

assert.match(
  supabaseService,
  /\.rpc\('desativar_projeto_completo'/
)

// Verifica funcao SQL verificar_atribuicao_info
assert.match(migrationSql, /CREATE OR REPLACE FUNCTION verificar_atribuicao_info\(/)
assert.match(migrationSql, /is_ultima_disciplina/)
assert.match(migrationSql, /total_disciplinas_ativas/)
assert.match(chatbotFunctionsSql, /CREATE OR REPLACE FUNCTION verificar_atribuicao_info\(/)

// Verifica funcoes cliente no dashboard
assert.match(dashboardSupabaseLib, /export async function verificarAtribuicaoInfo\(/)
assert.match(dashboardSupabaseLib, /export async function excluirProjeto\(/)
assert.match(dashboardSupabaseLib, /\/api\/admin\/atribuicoes\/.*\/info/)
assert.match(dashboardSupabaseLib, /\/api\/admin\/projetos\//)

// Verifica endpoints API existem
const infoRouteExists = existsSync(
  resolve('dashboard/app/api/admin/atribuicoes/[id]/info/route.ts')
)
assert.ok(infoRouteExists, 'API route /atribuicoes/[id]/info deve existir')

const projetosRouteExists = existsSync(
  resolve('dashboard/app/api/admin/projetos/[id]/route.ts')
)
assert.ok(projetosRouteExists, 'API route /projetos/[id] deve existir')

console.log('test-projetos-inativos-recadastramento: OK')
