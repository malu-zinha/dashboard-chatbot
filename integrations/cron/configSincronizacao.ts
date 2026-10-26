// =====================================================
// Sincronizacao Supabase → Google Sheets: ligada ou nao
// =====================================================
// A planilha e legada (o dashboard le direto do banco). ENABLE_SHEETS_SYNC=false
// desliga a sincronizacao e dispensa as credenciais do Google no boot. Sem a
// variavel, continua ligada, como sempre foi.
// =====================================================

const VARIAVEIS_GOOGLE = [
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_SHEETS_ENGINEER_ID',
  'GOOGLE_SHEETS_ENGINEER_NAME',
];

export function sincronizacaoSheetsAtiva(env: Record<string, string | undefined>): boolean {
  const v = (env.ENABLE_SHEETS_SYNC ?? '').trim().toLowerCase();
  return !(v === 'false' || v === '0');
}

export function variaveisObrigatoriasBoot(env: Record<string, string | undefined>): string[] {
  return sincronizacaoSheetsAtiva(env) ? [...VARIAVEIS_GOOGLE] : [];
}
