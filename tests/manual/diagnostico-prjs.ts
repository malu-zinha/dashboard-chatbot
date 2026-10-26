import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import {
  DEFAULT_AUDIT_CODES,
  classifyAuditRow,
  generateApprovalCsv,
  type ClassifiedConclusionAuditRow,
  type ConclusionAuditRow,
} from '../../logic/auditoria/conclusaoAudit.ts';

dotenv.config();

type OutputFormat = 'summary' | 'json' | 'csv' | 'approval';

interface CliOptions {
  codes: string[];
  format: OutputFormat;
  reportedConcludedCodes: Set<string>;
  output?: string;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseArgs(argv: string[]): CliOptions {
  const codes: string[] = [];
  let format: OutputFormat = 'summary';
  let reportedRaw = 'defaults';
  let output: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--format=')) {
      const value = arg.slice('--format='.length) as OutputFormat;
      if (!['summary', 'json', 'csv', 'approval'].includes(value)) {
        throw new Error(`Formato invalido: ${value}`);
      }
      format = value;
    } else if (arg.startsWith('--reported-concluded=')) {
      reportedRaw = arg.slice('--reported-concluded='.length);
    } else if (arg.startsWith('--output=')) {
      output = arg.slice('--output='.length);
    } else {
      codes.push(arg.toUpperCase());
    }
  }

  const finalCodes = codes.length > 0 ? codes : [...DEFAULT_AUDIT_CODES];
  const reportedConcludedCodes = new Set<string>();

  if (reportedRaw === 'defaults') {
    finalCodes.forEach((code) => reportedConcludedCodes.add(code));
  } else if (reportedRaw !== 'none') {
    reportedRaw
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean)
      .forEach((code) => reportedConcludedCodes.add(code));
  }

  return { codes: finalCodes, format, reportedConcludedCodes, output };
}

function pct(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function getStatusMap(statusIds: Array<number | null | undefined>): Promise<Map<number, string>> {
  const ids = Array.from(new Set(statusIds.filter((id): id is number => Boolean(id))));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from('status_codes')
    .select('status_id,codigo')
    .in('status_id', ids);

  if (error) throw error;
  return new Map((data ?? []).map((status: any) => [status.status_id, status.codigo]));
}

async function buildAuditRows(options: CliOptions): Promise<ClassifiedConclusionAuditRow[]> {
  const { data: projetos, error: projetosError } = await supabase
    .from('projetos')
    .select('projeto_id,codigo_projeto,cliente,ativo,percentual_ponderado,created_at,updated_at')
    .in('codigo_projeto', options.codes)
    .order('codigo_projeto');

  if (projetosError) throw projetosError;

  const rows: ClassifiedConclusionAuditRow[] = [];

  for (const projeto of projetos ?? []) {
    const { data: atribuicoes, error: atribError } = await supabase
      .from('engenheiros_projetos')
      .select('id,eng_id,area_id,status_id,percentual_andamento,percentual_ponderado,data_conclusao,data_prevista,ativo,instancia_label,complemento_area_ref_id,created_at,updated_at')
      .eq('projeto_id', projeto.projeto_id)
      .order('created_at');

    if (atribError) throw atribError;

    const duplicateCounts = new Map<string, number>();
    for (const atrib of atribuicoes ?? []) {
      if (!atrib.ativo) continue;
      const key = `${projeto.projeto_id}:${atrib.area_id}:${atrib.instancia_label ?? ''}`;
      duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
    }

    for (const atrib of atribuicoes ?? []) {
      const [{ data: eng }, { data: area }, { data: dashboardRows }] = await Promise.all([
        supabase.from('engenheiros').select('nome,telefone,ativo').eq('eng_id', atrib.eng_id).maybeSingle(),
        supabase.from('areas').select('codigo,descricao,ativo').eq('area_id', atrib.area_id).maybeSingle(),
        supabase.from('vw_projetos_completo').select('percentual_andamento,status_descricao').eq('atribuicao_id', atrib.id).limit(1),
      ]);

      const { data: pavimentos, error: pavError } = await supabase
        .from('projeto_pavimentos')
        .select('pavimento_id,nome,peso,ativo,eng_projeto_id')
        .eq('projeto_id', projeto.projeto_id)
        .eq('area_id', atrib.area_id)
        .eq('ativo', true)
        .eq('eng_projeto_id', atrib.id)
        .order('ordem');

      if (pavError) throw pavError;

      const pavIds = (pavimentos ?? []).map((p: any) => p.pavimento_id);
      const { data: etapas, error: etapasError } = pavIds.length > 0
        ? await supabase
            .from('pavimento_etapas')
            .select('etapa_id,pavimento_id,peso,concluida,ativo')
            .in('pavimento_id', pavIds)
            .eq('ativo', true)
        : { data: [], error: null } as any;

      if (etapasError) throw etapasError;

      const { data: globais, error: globError } = await supabase
        .from('projeto_etapas_globais')
        .select('etapa_global_id,nome,peso,concluida,ativo,eng_projeto_id')
        .eq('projeto_id', projeto.projeto_id)
        .eq('area_id', atrib.area_id)
        .eq('ativo', true)
        .eq('eng_projeto_id', atrib.id);

      if (globError) throw globError;

      const { data: historico } = await supabase
        .from('status_historico')
        .select('data_mudanca,origem,status_anterior_id,status_novo_id')
        .eq('eng_projeto_id', atrib.id)
        .order('data_mudanca', { ascending: false })
        .limit(10);

      const { data: previsoes } = await supabase
        .from('projetos_previsao')
        .select('data_registro,status_id,previsao_texto,feito_texto,updated_at')
        .eq('eng_projeto_id', atrib.id)
        .order('data_registro', { ascending: false })
        .limit(30);

      const statusMap = await getStatusMap([
        ...(historico ?? []).flatMap((h: any) => [h.status_anterior_id, h.status_novo_id]),
        ...(previsoes ?? []).map((p: any) => p.status_id),
      ]);

      const duplicateKey = `${projeto.projeto_id}:${atrib.area_id}:${atrib.instancia_label ?? ''}`;
      const auditRow: ConclusionAuditRow = {
        eng_projeto_id: atrib.id,
        projeto_id: projeto.projeto_id,
        codigo_projeto: projeto.codigo_projeto,
        cliente: projeto.cliente,
        eng_id: atrib.eng_id,
        engenheiro_nome: eng?.nome ?? atrib.eng_id,
        area_id: atrib.area_id,
        area_descricao: area?.descricao ?? atrib.area_id,
        instancia_label: atrib.instancia_label,
        ativo: Boolean(atrib.ativo),
        percentual_ponderado: pct(atrib.percentual_ponderado),
        data_conclusao: atrib.data_conclusao,
        etapa_pavimento_total: etapas?.length ?? 0,
        etapa_pavimento_concluidas: (etapas ?? []).filter((e: any) => e.concluida).length,
        etapa_global_total: globais?.length ?? 0,
        etapa_global_concluidas: (globais ?? []).filter((g: any) => g.concluida).length,
        status_historico_codigos: (historico ?? [])
          .flatMap((h: any) => [statusMap.get(h.status_anterior_id), statusMap.get(h.status_novo_id)])
          .filter(Boolean) as string[],
        previsao_status_codigos: (previsoes ?? [])
          .map((p: any) => statusMap.get(p.status_id))
          .filter(Boolean) as string[],
        previsoes_count: (previsoes ?? []).filter((p: any) => p.previsao_texto).length,
        feitos_count: (previsoes ?? []).filter((p: any) => p.feito_texto).length,
        dashboard_percentual_andamento: dashboardRows?.[0]?.percentual_andamento ?? null,
        dashboard_status_descricao: dashboardRows?.[0]?.status_descricao ?? null,
        chatbot_deve_aparecer: pct(atrib.percentual_ponderado) < 100 && Boolean(atrib.ativo),
        duplicate_key_count: duplicateCounts.get(duplicateKey) ?? 1,
        relato_humano_concluido: options.reportedConcludedCodes.has(projeto.codigo_projeto),
      };

      rows.push(classifyAuditRow(auditRow));
    }
  }

  return rows;
}

function renderSummary(rows: ClassifiedConclusionAuditRow[], codes: string[]): string {
  const lines: string[] = [];
  const foundCodes = new Set(rows.map((row) => row.codigo_projeto));
  const missing = codes.filter((code) => !foundCodes.has(code));
  lines.push(`Projetos encontrados: ${foundCodes.size}/${codes.length}`);
  if (missing.length > 0) lines.push(`Nao encontrados: ${missing.join(', ')}`);

  const counts = rows.reduce((acc, row) => {
    acc.set(row.classificacao, (acc.get(row.classificacao) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  lines.push('Classificacoes:');
  for (const [classificacao, count] of Array.from(counts.entries()).sort()) {
    lines.push(`- ${classificacao}: ${count}`);
  }

  for (const row of rows) {
    lines.push([
      row.classificacao,
      row.codigo_projeto,
      row.engenheiro_nome,
      row.disciplina_instancia,
      `${row.percentual_ponderado}%`,
      `data=${row.data_conclusao ?? 'NULL'}`,
      `chatbot=${row.chatbot_deve_aparecer ? 'aparece' : 'nao_aparece'}`,
      `dashboard=${row.dashboard_status_descricao ?? 'sem_view'}`,
      `evidencia=${row.evidencia}`,
      `id=${row.eng_projeto_id}`,
    ].join(' | '));
  }

  return lines.join('\n');
}

function renderCsv(rows: ClassifiedConclusionAuditRow[]): string {
  const headers = [
    'classificacao',
    'eng_projeto_id',
    'codigo_projeto',
    'cliente',
    'engenheiro',
    'disciplina_instancia',
    'percentual_ponderado',
    'data_conclusao',
    'ativo',
    'etapas_pavimento',
    'etapas_globais',
    'chatbot_deve_aparecer',
    'dashboard_percentual_andamento',
    'dashboard_status_descricao',
    'dashboard_consistente',
    'evidencia',
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      row.classificacao,
      row.eng_projeto_id,
      row.codigo_projeto,
      row.cliente,
      row.engenheiro_nome,
      row.disciplina_instancia,
      row.percentual_ponderado,
      row.data_conclusao ?? '',
      row.ativo,
      `${row.etapa_pavimento_concluidas}/${row.etapa_pavimento_total}`,
      `${row.etapa_global_concluidas}/${row.etapa_global_total}`,
      row.chatbot_deve_aparecer,
      row.dashboard_percentual_andamento ?? '',
      row.dashboard_status_descricao ?? '',
      row.dashboard_consistente,
      row.evidencia,
    ].map(csvCell).join(','));
  }

  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = await buildAuditRows(options);

  let output: string;
  if (options.format === 'json') {
    output = JSON.stringify(rows, null, 2);
  } else if (options.format === 'csv') {
    output = renderCsv(rows);
  } else if (options.format === 'approval') {
    output = generateApprovalCsv(rows);
  } else {
    output = renderSummary(rows, options.codes);
  }

  if (options.output) {
    writeFileSync(options.output, `${output}\n`, 'utf8');
    console.log(`Arquivo gerado: ${options.output}`);
  } else {
    console.log(output);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
