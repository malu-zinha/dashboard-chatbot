export interface AtribuicaoActionResult {
  ok?: boolean
  sucesso?: boolean
  codigo?: string
  mensagem?: string
  [key: string]: unknown
}

export type TransferirResponsavelValidation =
  | { ok: true; novoEngId: string }
  | { ok: false; error: string }

export type AlterarPrazoValidation =
  | { ok: true; novoPrazo: string }
  | { ok: false; error: string }

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidRegex.test(value)
}

export function validateTransferirResponsavelBody(
  body: unknown
): TransferirResponsavelValidation {
  if (!body || typeof body !== 'object' || !('novo_eng_id' in body)) {
    return { ok: false, error: 'Informe o engenheiro destino.' }
  }

  const novoEngId = (body as { novo_eng_id?: unknown }).novo_eng_id
  if (!isUuid(novoEngId)) {
    return { ok: false, error: 'Engenheiro destino invalido.' }
  }

  return { ok: true, novoEngId }
}

// Data real no formato AAAA-MM-DD (rejeita 2026-02-30 por ida e volta em UTC)
export function validateAlterarPrazoBody(body: unknown): AlterarPrazoValidation {
  const novoPrazo =
    body && typeof body === 'object' ? (body as { novo_prazo?: unknown }).novo_prazo : undefined
  if (typeof novoPrazo !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(novoPrazo)) {
    return { ok: false, error: 'Informe o novo prazo no formato AAAA-MM-DD.' }
  }

  const [ano, mes, dia] = novoPrazo.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  const confere =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  if (!confere) {
    return { ok: false, error: 'Novo prazo invalido.' }
  }

  return { ok: true, novoPrazo }
}

export function isAtribuicaoActionSuccess(result: AtribuicaoActionResult | null | undefined) {
  return Boolean(result?.ok === true || result?.sucesso === true)
}

export function getAtribuicaoActionStatus(
  result: AtribuicaoActionResult | null | undefined
): number {
  if (isAtribuicaoActionSuccess(result)) return 200

  switch (result?.codigo) {
    case 'nao_encontrada':
      return 404
    case 'duplicata':
    case 'ultima_area':
    case 'mesmo_engenheiro':
    case 'concluida':
    case 'sem_mudanca':
      return 409
    case 'destino_invalido':
    case 'parametro_invalido':
      return 400
    case 'erro_interno':
      return 500
    default:
      return 500
  }
}

export function getAtribuicaoActionMessage(
  result: AtribuicaoActionResult | null | undefined
): string {
  const mensagem = typeof result?.mensagem === 'string' ? result.mensagem.trim() : ''
  return mensagem || 'Nao foi possivel concluir a acao.'
}

/**
 * Reduz o resultado da RPC aos campos que o browser pode ver.
 *
 * AtribuicaoActionResult tem index signature, entao devolver o objeto inteiro
 * no caminho de erro expunha qualquer campo novo que a funcao SQL passasse a
 * retornar. No caminho de SUCESSO o objeto continua indo completo — o cliente
 * consome result.data (lib/supabase.ts) e is_ultima_disciplina (ProjetosTable).
 */
export function sanitizeAtribuicaoActionResult(
  result: AtribuicaoActionResult | null | undefined
): { codigo?: string; mensagem?: string } {
  const safe: { codigo?: string; mensagem?: string } = {}
  if (typeof result?.codigo === 'string') safe.codigo = result.codigo
  if (typeof result?.mensagem === 'string') safe.mensagem = result.mensagem
  return safe
}
