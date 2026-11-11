/**
 * Retrabalho e paralisacao usam os mesmos 6 motivos e a mesma linha do dia em
 * retrabalho_projetos; o que separa os dois e a coluna tipo_retrabalho.
 * NULL nessa coluna = registro de antes da separacao ("Nao classificado").
 */
export type TipoOcorrencia = 'retrabalho' | 'paralisacao';

export const ROTULO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  retrabalho: 'Retrabalho',
  paralisacao: 'Paralisação',
};

export const ROTULO_NAO_CLASSIFICADO = 'Não classificado';

/** Rotulo para exibir um valor vindo do banco (inclui o NULL dos registros antigos). */
export function rotuloTipoOcorrencia(tipo: string | null | undefined): string {
  return ROTULO_OCORRENCIA[tipo as TipoOcorrencia] ?? ROTULO_NAO_CLASSIFICADO;
}

// Retrabalho e masculino, paralisacao e feminino: as frases precisam do artigo certo.
const TEXTOS_OCORRENCIA: Record<TipoOcorrencia, { doTipo: string; noTipo: string; registrado: string }> = {
  retrabalho: { doTipo: 'do retrabalho', noTipo: 'no retrabalho', registrado: 'Retrabalho registrado' },
  paralisacao: { doTipo: 'da paralisação', noTipo: 'na paralisação', registrado: 'Paralisação registrada' },
};

/** Sem tipo cai em retrabalho, como era antes da separacao. */
export function textosOcorrencia(tipo?: TipoOcorrencia) {
  return TEXTOS_OCORRENCIA[tipo ?? 'retrabalho'];
}
