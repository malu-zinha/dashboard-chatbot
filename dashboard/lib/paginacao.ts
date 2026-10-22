/**
 * Busca todas as páginas de uma consulta do Supabase.
 *
 * O Supabase devolve no máximo 1000 linhas por consulta (max-rows). O
 * dashboard somava horas no navegador sobre o que viesse, então passar de
 * 1000 apontamentos no período encolhia o total sem aviso.
 *
 * `montar(de, ate)` deve aplicar `.range(de, ate)` numa consulta com ordem
 * única (senão páginas podem repetir ou pular linhas). O avanço usa o tamanho
 * real da página, não o pedido: se o servidor cortar abaixo de 1000, o laço
 * não para cedo. Erro em qualquer página devolve o erro e nenhuma linha —
 * total parcial apresentado como completo é exatamente o bug que isto evita.
 */
export const TAMANHO_PAGINA = 1000
const MAX_PAGINAS = 1000

export async function buscarTodasAsPaginas<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<{ data: T[]; error: unknown }> {
  const todas: T[] = []
  let de = 0
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await montar(de, de + TAMANHO_PAGINA - 1)
    if (error) return { data: [], error }
    const linhas = data ?? []
    if (linhas.length === 0) break
    todas.push(...linhas)
    de += linhas.length
    // Página curta pode ser o fim ou um servidor que corta abaixo de 1000:
    // só uma página vazia confirma o fim (um pedido a mais no caso comum).
  }
  return { data: todas, error: null }
}
