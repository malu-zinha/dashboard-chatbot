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

// Data de Brasilia de um TIMESTAMPTZ (ex.: projetos.created_at), em 'YYYY-MM-DD'.
// Cortar a string pegaria a data UTC: um projeto criado as 22h de Brasilia apareceria com o
// dia seguinte. DATE puro ('YYYY-MM-DD', sem hora) volta como esta.
// 'en-CA' e o locale que formata como YYYY-MM-DD (mesmo Intl de logic/datas/dataLocal.ts).
const FORMATADOR_DATA_BRT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function dataBRDeTimestamp(valor?: string | Date | null): string | null {
  if (!valor) return null
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return valor.trim()
  const momento = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(momento.getTime())) return null
  return FORMATADOR_DATA_BRT.format(momento)
}
