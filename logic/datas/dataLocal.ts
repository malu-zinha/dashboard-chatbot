// O bot roda em servidor UTC (Railway), entao new Date().toISOString().split('T')[0] devolve
// a data UTC. A notificacao noturna dispara 16:30 BRT e o engenheiro responde quando pode:
// qualquer resposta a partir das 21:00 BRT ja e o dia seguinte em UTC. O efeito era o
// apontamento cair num dia que ainda nao foi trabalhado, deixar de casar com o registro da
// manha no onConflict (eng_projeto_id, data_registro) e aparecer com um dia de atraso no
// relato diario do dashboard.
//
// 'en-CA' porque e o locale que formata como YYYY-MM-DD, o mesmo formato que a coluna DATE
// espera e que o dashboard compara como string.
const FORMATADOR_BRT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function dataLocalBR(momento: Date = new Date()): string {
  return FORMATADOR_BRT.format(momento);
}
