// Agrupa as recargas disparadas pelo Realtime.
//
// Cada mudanca em engenheiros_projetos, projetos ou retrabalho_projetos
// recarregava o painel inteiro (~19 consultas). Uma atribuicao com varios
// pavimentos gera dezenas de eventos em sequencia, e cada aba aberta repetia
// tudo, inclusive escondida. Agora os eventos esperam `esperaMs` sem novidade
// antes de recarregar uma vez so, e com a aba escondida a recarga fica para
// quando ela voltar a aparecer.

export interface OpcoesRecarga {
  esperaMs?: number
  estaVisivel?: () => boolean
}

export interface RecargaAgrupada {
  /** Chamado a cada evento do Realtime. */
  agendar(): void
  /** Chamado quando a aba volta a ficar visivel. */
  aoFicarVisivel(): void
  cancelar(): void
}

export function criarRecargaAgrupada(
  recarregar: () => void,
  { esperaMs = 1500, estaVisivel = () => true }: OpcoesRecarga = {}
): RecargaAgrupada {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendenteAteVisivel = false

  const disparar = () => {
    timer = null
    if (!estaVisivel()) {
      pendenteAteVisivel = true
      return
    }
    recarregar()
  }

  return {
    agendar() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(disparar, esperaMs)
    },
    aoFicarVisivel() {
      if (!pendenteAteVisivel) return
      pendenteAteVisivel = false
      recarregar()
    },
    cancelar() {
      if (timer) clearTimeout(timer)
      timer = null
      pendenteAteVisivel = false
    },
  }
}
