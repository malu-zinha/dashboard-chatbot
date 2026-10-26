/**
 * Lê MODELO_PLANILHA GERAL_ 2026.xlsx e gera os INSERTs de
 * area_pavimentos_template e area_etapas_template.
 *
 * Uso:
 *   npm i -D xlsx
 *   npx tsx scripts/extract-xlsx-templates.ts > /tmp/templates.sql
 *
 * Cole a saída no migration 20260429_pavimentos_etapas_por_area.sql,
 * substituindo o marcador TEMPLATES_INSERTS_PLACEHOLDER.
 */
import * as XLSX from 'xlsx';

const SHEET_TO_CODIGO: Record<string, string> = {
  'PLANILHA PADRÃO ELÉTRICO': 'ELETRICO',
  'PLANILHA PADRÃO TELECOM': 'TELEFONIA',
  'PLANILHA PADRÃO HIDROSSANITÁRIO': 'HIDRAULICO',
  'PLANILHA PADRÃO CLIMATIZAÇÃO': 'CLIMATIZACAO',
  'PLANILHA PADRÃO EXAUSTÃO': 'EXAUSTAO',
  'PLANILHA PADRÃO GÁS': 'GAS',
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function norm(s: any): string {
  return (s ?? '').toString().trim();
}

const wb = XLSX.readFile('MODELO_PLANILHA GERAL_ 2026.xlsx');

for (const [sheetName, codigo] of Object.entries(SHEET_TO_CODIGO)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error(`-- ⚠️ Sheet não encontrada: ${sheetName}`);
    continue;
  }
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Col P (idx 15) = nome da etapa, Col R (idx 17) = nome do pavimento
  const pavimentos = new Map<string, number>();
  const etapaCounts = new Map<string, number>();
  const etapaFirstRow = new Map<string, number>();
  let pavOrdem = 0;

  // rows[0] e rows[1] são cabeçalhos
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] || [];
    const etapa = norm(row[15]);
    const pav = norm(row[17]);

    if (pav && !pavimentos.has(pav)) pavimentos.set(pav, ++pavOrdem);
    if (etapa) {
      etapaCounts.set(etapa, (etapaCounts.get(etapa) ?? 0) + 1);
      if (!etapaFirstRow.has(etapa)) etapaFirstRow.set(etapa, i);
    }
  }

  // Etapas que se repetem (uma por pavimento) são per-pavimento;
  // as que aparecem 1x são globais.
  const etapasOrdered = [...etapaFirstRow.entries()].sort((a, b) => a[1] - b[1]);
  const etapasPav = new Map<string, number>();
  const etapasGlobal = new Map<string, number>();
  for (const [nome] of etapasOrdered) {
    if ((etapaCounts.get(nome) ?? 0) > 1) {
      etapasPav.set(nome, etapasPav.size + 1);
    } else {
      etapasGlobal.set(nome, etapasGlobal.size + 1);
    }
  }

  const a = `(SELECT area_id FROM areas WHERE codigo = '${codigo}')`;
  console.log(`-- ${codigo}`);

  if (pavimentos.size > 0) {
    const pavRows = [...pavimentos].map(([n, o]) => `    (${a}, '${esc(n)}', ${o})`);
    console.log(`INSERT INTO area_pavimentos_template (area_id, nome, ordem) VALUES`);
    console.log(`${pavRows.join(',\n')}`);
    console.log(`ON CONFLICT (area_id, nome) DO NOTHING;`);
  }

  if (etapasPav.size > 0 || etapasGlobal.size > 0) {
    const ePav = [...etapasPav].map(([n, o]) => `    (${a}, '${esc(n)}', 'pavimento', ${o})`);
    const eGlb = [...etapasGlobal].map(([n, o]) => `    (${a}, '${esc(n)}', 'global', ${o})`);
    console.log(`INSERT INTO area_etapas_template (area_id, nome, tipo, ordem) VALUES`);
    console.log(`${[...ePav, ...eGlb].join(',\n')}`);
    console.log(`ON CONFLICT (area_id, tipo, nome) DO NOTHING;`);
  }
  console.log('');
}
