// =====================================================
// TESTE DE INTEGRAÇÃO — Conclusão por área (pavimentos + globais)
// =====================================================
// Prova que marcar TODAS as etapas de pavimento E as globais de uma
// disciplina leva o percentual da área a 100% e preenche data_conclusao.
// Faz BACKUP do estado e RESTAURA ao final (try/finally), mesmo em erro.
//
// Uso: npx tsx tests/test-conclusao-area.ts
// Requer a migração 20260606_conclusao_por_area.sql já aplicada.
// =====================================================

import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseService } from '../../integrations/supabase/supabaseService.ts';

// Grava no banco do .env (hoje, a producao). So roda de proposito, contra um
// projeto Supabase de teste.
if (process.env.RUN_DB_TESTS !== '1') {
  console.error(
    'Este script GRAVA no banco apontado pelo .env. Para rodar de proposito, contra um ' +
      'projeto Supabase de teste: RUN_DB_TESTS=1 npx tsx tests/manual/' +
      new URL(import.meta.url).pathname.split('/').pop(),
  );
  process.exit(1);
}


async function main() {
  const sb = getSupabaseService();
  const db: any = (sb as any).supabase;

  // Escolher uma disciplina (projeto, área) COM estrutura de pavimentos
  const { data: pav } = await db
    .from('projeto_pavimentos')
    .select('projeto_id, area_id')
    .eq('ativo', true)
    .limit(1);
  if (!pav?.length) { console.error('❌ Nenhum pavimento ativo encontrado.'); process.exit(1); }
  const { projeto_id, area_id } = pav[0];
  console.log('Testando (projeto,area):', projeto_id, area_id);

  const { data: pavs } = await db
    .from('projeto_pavimentos').select('pavimento_id')
    .eq('projeto_id', projeto_id).eq('area_id', area_id).eq('ativo', true);
  const pavIds = pavs.map((p: any) => p.pavimento_id);
  const { data: ets } = await db
    .from('pavimento_etapas').select('etapa_id, concluida')
    .in('pavimento_id', pavIds).eq('ativo', true);
  const { data: globs } = await db
    .from('projeto_etapas_globais').select('etapa_global_id, concluida')
    .eq('projeto_id', projeto_id).eq('area_id', area_id).eq('ativo', true);

  // BACKUP
  const backupEt = (ets ?? []).map((e: any) => ({ id: e.etapa_id, c: e.concluida }));
  const backupGl = (globs ?? []).map((g: any) => ({ id: g.etapa_global_id, c: g.concluida }));

  let pass = 0, fail = 0;
  const assert = (cond: boolean, name: string) => {
    if (cond) { pass++; console.log('✅', name); } else { fail++; console.error('❌', name); }
  };

  try {
    // Só pavimentos → deve ficar < 100 se houver globais (senão já 100)
    await sb.marcarEtapasBatch((ets ?? []).map((e: any) => e.etapa_id), true);
    const pctSoPav = await sb.buscarProgressoArea(projeto_id, area_id);
    assert(
      (globs?.length ?? 0) === 0 ? pctSoPav >= 100 : pctSoPav < 100,
      `só pavimentos: pct=${pctSoPav} (deve ser <100 quando há globais; ${globs?.length ?? 0} globais)`
    );

    // Pavimentos + globais → deve chegar a 100
    if (globs?.length) await sb.marcarEtapasGlobaisBatch(globs.map((g: any) => g.etapa_global_id), true);
    const pctTudo = await sb.buscarProgressoArea(projeto_id, area_id);
    assert(pctTudo >= 100, `pavimentos + globais: pct=${pctTudo} (deve ser 100)`);

    // data_conclusao preenchida
    const { data: epAfter } = await db
      .from('engenheiros_projetos').select('data_conclusao')
      .eq('projeto_id', projeto_id).eq('area_id', area_id).eq('ativo', true).limit(1);
    assert(!!epAfter?.[0]?.data_conclusao, 'data_conclusao preenchida ao chegar a 100%');
  } finally {
    // RESTAURAR estado original
    for (const e of backupEt) await db.from('pavimento_etapas').update({ concluida: e.c }).eq('etapa_id', e.id);
    for (const g of backupGl) await db.from('projeto_etapas_globais').update({ concluida: g.c }).eq('etapa_global_id', g.id);
    console.log('🔄 Estado original restaurado.');
  }

  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
}

main();
