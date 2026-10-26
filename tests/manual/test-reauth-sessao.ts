// =====================================================
// TESTE: reautenticação de sessão "nao_cadastrado"
// =====================================================
// Reproduz o bug: número cadastrado no Supabase DEPOIS de já ter
// criado uma sessão em memória como "nao_cadastrado" — sem o fix,
// só um redeploy o reconheceria.
//
// Estratégia (read-only no banco): instanciar um MessageHandler
// isolado, semear uma sessão stale "nao_cadastrado" para um número
// que JÁ existe no banco, e verificar que a próxima mensagem o
// reconhece (não retorna "Número não cadastrado").
//
// Uso: TELEFONE_CADASTRADO_TESTE=+55... npx tsx tests/manual/test-reauth-sessao.ts
// =====================================================

import dotenv from 'dotenv';
dotenv.config();

import { MessageHandler } from '../../chatbot/handlers/messageHandler.ts';

// Telefone de um engenheiro que existe no banco do .env. Fica fora do codigo
// (o repositorio e publico).
const TELEFONE_CADASTRADO = process.env.TELEFONE_CADASTRADO_TESTE ?? '';
if (!TELEFONE_CADASTRADO) {
  console.error('Defina TELEFONE_CADASTRADO_TESTE com o telefone de um engenheiro cadastrado.');
  process.exit(1);
}

async function main() {
  const h: any = new MessageHandler();
  const chave = h.normalizarWhatsapp(TELEFONE_CADASTRADO);

  // Semear sessão stale "nao_cadastrado" (como se o número tivesse falado
  // com o bot ANTES de ser cadastrado no Supabase)
  h.sessoes.set(chave, {
    whatsapp: chave,
    tipo_usuario: 'nao_cadastrado',
    user_id: undefined,
    fluxo_ativo: null,
    ultima_interacao: new Date(),
  });

  const { resposta } = await h.processarMensagem(TELEFONE_CADASTRADO, 'oi');

  let pass = 0, fail = 0;
  const assert = (cond: boolean, name: string) => {
    if (cond) { pass++; console.log('✅', name); } else { fail++; console.error('❌', name); }
  };

  assert(!resposta.includes('Número não cadastrado'),
    'número cadastrado NÃO é mais rejeitado por sessão stale (reautenticou)');
  assert(h.sessoes.get(chave)?.tipo_usuario === 'engenheiro',
    'sessão foi atualizada para "engenheiro" após reautenticação');

  // Caso negativo: número realmente desconhecido continua rejeitado
  const desconhecido = '+5500000000000';
  const r2 = await h.processarMensagem(desconhecido, 'oi');
  assert(r2.resposta.includes('Número não cadastrado'),
    'número desconhecido continua recebendo "Número não cadastrado"');

  console.log(`\n${pass} passaram, ${fail} falharam`);
  process.exit(fail ? 1 : 0);
}

main();
