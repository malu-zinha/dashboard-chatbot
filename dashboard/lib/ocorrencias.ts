// Retrabalho e paralisacao usam os mesmos motivos e a mesma tabela; o que separa
// os dois e retrabalho_projetos.tipo_retrabalho. As views vw_ocorrencias_* devolvem
// 'nao_classificado' para os registros de antes da separacao (tipo NULL).
// Funcoes puras: o card geral e o modal do projeto usam as mesmas.

export type TipoOcorrencia = 'retrabalho' | 'paralisacao' | 'nao_classificado'

const ROTULO_TIPO: Record<TipoOcorrencia, string> = {
  retrabalho: 'Retrabalho',
  paralisacao: 'Paralisação',
  nao_classificado: 'Não classificado',
}

export function normalizarTipo(tipo: string | null | undefined): TipoOcorrencia {
  return tipo === 'retrabalho' || tipo === 'paralisacao' ? tipo : 'nao_classificado'
}

export function rotuloTipo(tipo: string | null | undefined): string {
  return ROTULO_TIPO[normalizarTipo(tipo)]
}

export type FiltroMotivos = 'geral' | 'retrabalho' | 'paralisacao'

/**
 * Linhas da pizza para o filtro escolhido, maior quantidade primeiro.
 * - geral: soma retrabalho, paralisacao e os registros antigos sem tipo, por motivo
 *   (o mesmo numero que a pizza unica mostrava antes da separacao);
 * - retrabalho / paralisacao: so as linhas daquele tipo (antigos sem tipo nao entram).
 */
export function motivosDoFiltro<T extends { tipo?: string | null; motivo_retrabalho: string; quantidade: number }>(
  linhas: T[],
  filtro: FiltroMotivos
): Array<{ motivo_retrabalho: string; quantidade: number }> {
  const escolhidas = filtro === 'geral' ? linhas : linhas.filter((l) => normalizarTipo(l.tipo) === filtro)
  const porMotivo = new Map<string, number>()
  for (const l of escolhidas) {
    porMotivo.set(l.motivo_retrabalho, (porMotivo.get(l.motivo_retrabalho) ?? 0) + l.quantidade)
  }
  return Array.from(porMotivo, ([motivo_retrabalho, quantidade]) => ({ motivo_retrabalho, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade)
}
