import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migrationPath = resolve('supabase/migrations/20260717_status_historico_paralisacao.sql')
const apiRelatorioPath = resolve('dashboard/app/api/admin/projetos/[id]/relatorio/route.ts')
const gerarPdfPath = resolve('dashboard/lib/gerarRelatorioPdf.ts')
const supabaseLibPath = resolve('dashboard/lib/supabase.ts')
const projetosTablePath = resolve('dashboard/components/ProjetosTable.tsx')
const packageJsonPath = resolve('dashboard/package.json')

// Verifica que os arquivos existem
assert.ok(existsSync(migrationPath), 'Migration de status_historico deve existir')
assert.ok(existsSync(apiRelatorioPath), 'API de relatorio deve existir')
assert.ok(existsSync(gerarPdfPath), 'Utilitario gerarRelatorioPdf deve existir')
assert.ok(existsSync(supabaseLibPath), 'Lib supabase deve existir')
assert.ok(existsSync(projetosTablePath), 'ProjetosTable deve existir')
assert.ok(existsSync(packageJsonPath), 'package.json do dashboard deve existir')

// Leitura dos conteudos
const migrationContent = readFileSync(migrationPath, 'utf8')
const apiContent = readFileSync(apiRelatorioPath, 'utf8')
const gerarPdfContent = readFileSync(gerarPdfPath, 'utf8')
const supabaseLibContent = readFileSync(supabaseLibPath, 'utf8')
const projetosTableContent = readFileSync(projetosTablePath, 'utf8')
const packageJsonContent = readFileSync(packageJsonPath, 'utf8')

// ============================================
// MIGRATION: status_historico
// ============================================

// Verifica que a tabela status_historico foi criada
assert.match(
  migrationContent,
  /CREATE TABLE.*status_historico/is,
  'Migration deve criar tabela status_historico'
)

// Verifica campos essenciais
assert.match(
  migrationContent,
  /eng_projeto_id.*UUID/i,
  'status_historico deve ter eng_projeto_id'
)
assert.match(
  migrationContent,
  /projeto_id.*UUID/i,
  'status_historico deve ter projeto_id'
)
assert.match(
  migrationContent,
  /status_anterior_id.*INTEGER/i,
  'status_historico deve ter status_anterior_id'
)
assert.match(
  migrationContent,
  /status_novo_id.*INTEGER/i,
  'status_historico deve ter status_novo_id'
)
assert.match(
  migrationContent,
  /data_mudanca.*TIMESTAMPTZ/i,
  'status_historico deve ter data_mudanca'
)

// Verifica trigger de captura de mudancas
assert.match(
  migrationContent,
  /CREATE.*FUNCTION.*registrar_mudanca_status/is,
  'Migration deve criar funcao registrar_mudanca_status'
)
assert.match(
  migrationContent,
  /CREATE TRIGGER.*trg_registrar_mudanca_status/is,
  'Migration deve criar trigger trg_registrar_mudanca_status'
)
assert.match(
  migrationContent,
  /AFTER UPDATE ON engenheiros_projetos/i,
  'Trigger deve ser disparado AFTER UPDATE em engenheiros_projetos'
)
assert.match(
  migrationContent,
  /OLD\.status_id IS DISTINCT FROM NEW\.status_id/i,
  'Trigger deve verificar mudanca de status_id'
)

// Verifica view de relatorio
assert.match(
  migrationContent,
  /CREATE.*VIEW.*vw_relatorio_projeto_pdf/is,
  'Migration deve criar view vw_relatorio_projeto_pdf'
)
assert.match(
  migrationContent,
  /dias_execucao_total/i,
  'View deve calcular dias_execucao_total'
)
assert.match(
  migrationContent,
  /total_engenheiros/i,
  'View deve calcular total_engenheiros'
)
assert.match(
  migrationContent,
  /dias_retrabalho/i,
  'View deve calcular dias_retrabalho'
)
assert.match(
  migrationContent,
  /dias_paralisacao/i,
  'View deve calcular dias_paralisacao'
)

// Verifica view auxiliar de disciplinas
assert.match(
  migrationContent,
  /CREATE.*VIEW.*vw_relatorio_disciplinas_projeto/is,
  'Migration deve criar view vw_relatorio_disciplinas_projeto'
)

// ============================================
// API: GET /api/admin/projetos/[id]/relatorio
// ============================================

assert.match(
  apiContent,
  /export async function GET/,
  'API deve exportar funcao GET'
)
assert.match(
  apiContent,
  /vw_relatorio_projeto_pdf/,
  'API deve consultar view vw_relatorio_projeto_pdf'
)
assert.match(
  apiContent,
  /vw_relatorio_disciplinas_projeto/,
  'API deve consultar view vw_relatorio_disciplinas_projeto'
)
assert.match(
  apiContent,
  /RelatorioProjetoData/,
  'API deve ter interface RelatorioProjetoData'
)
assert.match(
  apiContent,
  /DisciplinaRelatorio/,
  'API deve ter interface DisciplinaRelatorio'
)

// ============================================
// LIB: gerarRelatorioPdf.ts
// ============================================

assert.match(
  gerarPdfContent,
  /import jsPDF from 'jspdf'/,
  'gerarRelatorioPdf deve importar jsPDF'
)
assert.match(
  gerarPdfContent,
  /export function gerarRelatorioPdf/,
  'gerarRelatorioPdf deve exportar funcao gerarRelatorioPdf'
)
assert.match(
  gerarPdfContent,
  /RELATÓRIO DE PROJETO CONCLUÍDO/,
  'PDF deve ter titulo RELATÓRIO DE PROJETO CONCLUÍDO'
)
assert.match(
  gerarPdfContent,
  /Tempo total de execução/,
  'PDF deve exibir Tempo total de execução'
)
assert.match(
  gerarPdfContent,
  /Retrabalho \(dias · horas\)/,
  'PDF deve exibir o retrabalho (dias e horas)'
)
assert.match(
  gerarPdfContent,
  /Paralisação \(dias · horas\)/,
  'PDF deve exibir a paralisação (dias e horas)'
)
assert.match(
  gerarPdfContent,
  /Engenheiros envolvidos/,
  'PDF deve exibir Engenheiros envolvidos'
)
assert.match(
  gerarPdfContent,
  /DETALHAMENTO POR DISCIPLINA/,
  'PDF deve ter secao DETALHAMENTO POR DISCIPLINA'
)
assert.match(
  gerarPdfContent,
  /doc\.save\(/,
  'gerarRelatorioPdf deve salvar o PDF'
)

// ============================================
// LIB: supabase.ts (cliente)
// ============================================

assert.match(
  supabaseLibContent,
  /export interface RelatorioProjetoData/,
  'supabase.ts deve ter interface RelatorioProjetoData'
)
assert.match(
  supabaseLibContent,
  /export interface DisciplinaRelatorio/,
  'supabase.ts deve ter interface DisciplinaRelatorio'
)
assert.match(
  supabaseLibContent,
  /export interface RelatorioProjetoResponse/,
  'supabase.ts deve ter interface RelatorioProjetoResponse'
)
assert.match(
  supabaseLibContent,
  /export async function fetchRelatorioProjetoPdf/,
  'supabase.ts deve ter funcao fetchRelatorioProjetoPdf'
)
assert.match(
  supabaseLibContent,
  /\/api\/admin\/projetos\/.*\/relatorio/,
  'fetchRelatorioProjetoPdf deve chamar endpoint correto'
)

// ============================================
// COMPONENT: ProjetosTable.tsx
// ============================================

assert.match(
  projetosTableContent,
  /import.*FileDown.*from 'lucide-react'/,
  'ProjetosTable deve importar icone FileDown'
)
assert.match(
  projetosTableContent,
  /import.*fetchRelatorioProjetoPdf.*from '@\/lib\/supabase'/,
  'ProjetosTable deve importar fetchRelatorioProjetoPdf'
)
assert.match(
  projetosTableContent,
  /import.*gerarRelatorioPdf.*from '@\/lib\/gerarRelatorioPdf'/,
  'ProjetosTable deve importar gerarRelatorioPdf'
)
assert.match(
  projetosTableContent,
  /gerandoPdfProjetoId/,
  'ProjetosTable deve ter estado gerandoPdfProjetoId'
)
assert.match(
  projetosTableContent,
  /handleGerarPdf/,
  'ProjetosTable deve ter handler handleGerarPdf'
)
assert.match(
  projetosTableContent,
  /isDisciplinaConcluida\(item\).*FileDown/s,
  'Botao PDF deve aparecer apenas para disciplinas concluidas'
)

// ============================================
// PACKAGE.JSON: jspdf instalado
// ============================================

const packageJson = JSON.parse(packageJsonContent)
assert.ok(
  packageJson.dependencies?.jspdf,
  'package.json deve ter jspdf nas dependencias'
)

console.log('test-relatorio-pdf: OK')
