#!/usr/bin/env ts-node
// =====================================================
// TESTE INTERATIVO — Fluxo "Marcar Etapa Concluída"
// =====================================================
// Cobre: filtro de concluídos, multi-seleção (modos 1 e 2),
//        voltar com `0`, atalho `menu`, bloqueio em terminal.
//
// Uso:
//   WHATSAPP=+5511999999999 npx ts-node --esm tests/test-marcar-etapa.ts
//
// Sem WHATSAPP: pede no terminal.
//
// O script vai gravar de fato no Supabase quando você confirmar
// a marcação (opção 1 da tela de confirmação). Aponte para um
// projeto descartável.
// =====================================================

import readline from 'readline';
import dotenv from 'dotenv';
import { EngineerProjectFlow } from '../../chatbot/flows/engineerProjectFlow.ts';

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


dotenv.config();

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

function printBanner() {
  console.log(`${C.cyan}╔═══════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}║  TESTE: Marcar Etapa Concluída — fluxo do engenheiro     ║${C.reset}`);
  console.log(`${C.cyan}╚═══════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}Cenários sugeridos para validar:${C.reset}`);
  console.log(`${C.dim} 1. Filtros — escolher um projeto onde alguma área esteja 100% concluída${C.reset}`);
  console.log(`${C.dim}    e confirmar que ela NÃO aparece na seleção de área.${C.reset}`);
  console.log(`${C.dim} 2. Modo 1 — escolher pavimento e digitar '1,3-5' nas etapas.${C.reset}`);
  console.log(`${C.dim} 3. Modo 2 — escolher uma etapa e digitar 'todos' nos pavimentos.${C.reset}`);
  console.log(`${C.dim} 4. Voltar — digitar '0' em qualquer passo intermediário.${C.reset}`);
  console.log(`${C.dim} 5. Menu — digitar 'menu' em qualquer ponto.${C.reset}`);
  console.log(`${C.dim} 6. Terminal — após confirmar a gravação, digitar '0' (deve avisar).${C.reset}`);
  console.log();
  console.log(`${C.yellow}Atalhos: 'sair' encerra | 'estado' mostra debug do FlowState${C.reset}`);
  console.log(`${C.yellow}         'iniciar' reinicia o flow do zero${C.reset}\n`);
}

function dumpState(flow: EngineerProjectFlow) {
  const s: any = (flow as any).state;
  console.log(`${C.magenta}── FlowState (debug) ─────────────────────────${C.reset}`);
  console.log(`  step:             ${C.bold}${s.step}${C.reset}`);
  console.log(`  stepHistory:      [${(s.stepHistory ?? []).join(', ')}]`);
  console.log(`  snapshotHistory:  ${C.bold}${(s.snapshotHistory ?? []).length}${C.reset} snapshots`);
  if ((s.snapshotHistory ?? []).length > 0) {
    const top = s.snapshotHistory[s.snapshotHistory.length - 1];
    console.log(`  └─ topo:          step=${top.step}`);
  }
  console.log(`  modoMultiSelecao: ${s.modoMultiSelecao ?? '—'}`);
  console.log(`  selectedProjeto:  ${s.selectedProjetoCodigo ?? '—'} (${s.selectedProjetoId ?? '—'})`);
  console.log(`  selectedArea:     ${s.selectedAreaId ?? '—'}`);
  console.log(`  selectedPav:      ${s.selectedPavimentoNome ?? '—'}`);
  console.log(`  pavsDisponiveis:  ${(s.pavimentosDisponiveis ?? []).length}`);
  console.log(`  etapasDisponiveis: ${(s.etapasDisponiveis ?? []).length}`);
  console.log(`  etapaIdsSelec:    ${(s.etapaIdsSelecionados ?? []).length}`);
  console.log(`${C.magenta}──────────────────────────────────────────────${C.reset}\n`);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(res => rl.question(q, res));

  printBanner();

  let whatsapp = process.env.WHATSAPP || process.argv[2] || '';
  if (!whatsapp) {
    whatsapp = (await ask(`${C.cyan}WhatsApp do engenheiro (ex: +5511999999999): ${C.reset}`)).trim();
  }
  if (!whatsapp) {
    console.error(`${C.red}WhatsApp obrigatório.${C.reset}`);
    process.exit(1);
  }

  let flow = new EngineerProjectFlow(whatsapp);
  console.log(`\n${C.green}Flow criado para ${whatsapp}.${C.reset}`);
  console.log(`${C.dim}Para começar pelo fluxo "Marcar Etapa", digite ${C.bold}iniciar${C.reset}${C.dim} e depois ${C.bold}4${C.reset}${C.dim}.${C.reset}\n`);

  while (true) {
    const input = (await ask(`${C.cyan}Você: ${C.reset}`)).trim();

    if (input === '') continue;
    if (input.toLowerCase() === 'sair' || input.toLowerCase() === 'exit') break;
    if (input.toLowerCase() === 'estado') { dumpState(flow); continue; }
    if (input.toLowerCase() === 'iniciar' && (flow as any).state.step !== 'inicio') {
      flow = new EngineerProjectFlow(whatsapp);
      console.log(`${C.yellow}↻ Flow resetado.${C.reset}\n`);
      continue;
    }

    try {
      const result = await flow.processarMensagem(input);
      console.log(`${C.blue}Bot:${C.reset} ${result.mensagem}`);
      if (result.finalizado) {
        console.log(`${C.dim}(fim do passo — finalizado=true)${C.reset}`);
      }
      console.log();
    } catch (err: any) {
      console.error(`${C.red}❌ Erro: ${err.message}${C.reset}`);
      if (err.stack) console.error(C.dim + err.stack + C.reset);
    }
  }

  rl.close();
  console.log(`${C.green}Tchau!${C.reset}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
