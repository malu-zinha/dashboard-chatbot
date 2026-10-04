// Datas vindas do Postgres como DATE chegam no formato 'YYYY-MM-DD'. Passar essa string
// por new Date() a interpreta como UTC midnight, e toLocaleDateString('pt-BR') devolve o
// dia anterior em fusos negativos: new Date('2026-09-29') vira 28/09/2026 em Brasilia.
// Por isso a formatacao abaixo so reordena os campos, sem construir um Date.

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})/

export function formatarDataBR(valor?: string | null): string {
  if (!valor) return '-'

  const match = DATA_ISO.exec(valor.trim())
  if (!match) return '-'

  const [, ano, mes, dia] = match
  return `${dia}/${mes}/${ano}`
}

// Normaliza para 'YYYY-MM-DD' comparavel com os inputs type="date", que sempre
// produzem esse formato. Aceita tanto DATE quanto TIMESTAMP vindos da view.
export function toDataISO(valor?: string | null): string | null {
  if (!valor) return null

  const match = DATA_ISO.exec(valor.trim())
  return match ? match[0] : null
}
