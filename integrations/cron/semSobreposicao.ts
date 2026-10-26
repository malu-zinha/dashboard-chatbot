// =====================================================
// Evita que uma tarefa agendada rode por cima dela mesma
// =====================================================
// O node-cron dispara no horario mesmo se a execucao anterior ainda estiver
// rodando. Na sincronizacao com o Sheets (limpa a planilha e reescreve) duas
// execucoes ao mesmo tempo misturavam as linhas.
// =====================================================

export function semSobreposicao<A extends unknown[]>(
  nome: string,
  tarefa: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  let rodando = false;
  return async (...args: A) => {
    if (rodando) {
      console.log(`⏭️  ${nome}: a execução anterior ainda está rodando, pulando esta`);
      return;
    }
    rodando = true;
    try {
      await tarefa(...args);
    } finally {
      rodando = false;
    }
  };
}
