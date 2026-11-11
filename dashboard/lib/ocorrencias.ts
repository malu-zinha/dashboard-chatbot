// Retrabalho e paralisacao usam os mesmos motivos e a mesma tabela; o que separa
// os dois e retrabalho_projetos.tipo_retrabalho. As views vw_ocorrencias_* devolvem
// 'nao_classificado' para os registros de antes da separacao (tipo NULL).
// Funcoes puras: o card geral e o modal do projeto usam as mesmas.

export type TipoOcorrencia = 'retrabalho' | 'paralisacao' | 'nao_classificado'

export const ORDEM_TIPOS: TipoOcorrencia[] = ['retrabalho', 'paralisacao', 'nao_classificado']

export const TITULO_MOTIVOS_POR_TIPO: Record<TipoOcorrencia, string> = {
  retrabalho: 'Motivos de retrabalho',
  paralisacao: 'Motivos de paralisação',
  nao_classificado: 'Não classificado (registros de antes da separação)',
}

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

/**
 * Separa as linhas por tipo, na ordem retrabalho, paralisacao, nao classificado.
 * Retrabalho e paralisacao aparecem sempre (logo depois do deploy a paralisacao esta
 * vazia, e isso precisa ficar visivel); "nao classificado" so aparece se tiver linha.
 * Dentro de cada grupo, maior quantidade primeiro.
 */
export function agruparMotivosPorTipo<T extends { tipo?: string | null; quantidade: number }>(
  linhas: T[]
): Array<{ tipo: TipoOcorrencia; titulo: string; linhas: T[] }> {
  return ORDEM_TIPOS.map((tipo) => ({
    tipo,
    titulo: TITULO_MOTIVOS_POR_TIPO[tipo],
    linhas: linhas
      .filter((l) => normalizarTipo(l.tipo) === tipo)
      .sort((a, b) => b.quantidade - a.quantidade),
  })).filter((g) => g.tipo !== 'nao_classificado' || g.linhas.length > 0)
}
