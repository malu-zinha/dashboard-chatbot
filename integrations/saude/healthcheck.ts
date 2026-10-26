// =====================================================
// Health check do servidor do chatbot
// =====================================================
// O /health respondia "ok" fixo, mesmo com o banco fora: o Railway nunca
// sabia que o bot estava sem conseguir trabalhar. Agora faz uma consulta
// leve ao banco, com limite de tempo, e responde 503 se ela falhar.
// =====================================================

import { redactSecrets } from '../../logic/security/redactSecrets.ts';

export interface ResultadoSaude {
  http: 200 | 503;
  corpo: { status: 'ok' | 'degradado'; banco: 'ok' | 'indisponivel'; timestamp: string };
}

export async function verificarSaude(
  checarBanco: () => Promise<void>,
  timeoutMs = 3000,
): Promise<ResultadoSaude> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`banco sem resposta em ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    await Promise.race([checarBanco(), limite]);
    return { http: 200, corpo: { status: 'ok', banco: 'ok', timestamp: new Date().toISOString() } };
  } catch (error: any) {
    console.error(`❌ Health check: ${redactSecrets(error?.message ?? error)}`);
    return {
      http: 503,
      corpo: { status: 'degradado', banco: 'indisponivel', timestamp: new Date().toISOString() },
    };
  } finally {
    clearTimeout(timer);
  }
}
