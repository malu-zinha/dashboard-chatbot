'use client'

import React, { useState } from 'react'
import { CargaTrabalho } from '../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface CargaTrabalhoChartProps {
  data: CargaTrabalho[]
  // Clicar na linha abre as tarefas em execucao daquele engenheiro.
  onSelecionarEngenheiro?: (nome: string) => void
}

type Serie = 'executados' | 'restantes'

const ROTULOS: Record<Serie, string> = {
  executados: 'Dias executados',
  restantes: 'Dias restantes',
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Uma linha por engenheiro: executado em azul cheio, restante hachurado (como corte em planta).
// A escala e a mesma para todos (o maior total de dias ocupa a largura toda).
export default function CargaTrabalhoChart({ data, onSelecionarEngenheiro }: CargaTrabalhoChartProps) {
  // Legenda clicavel: esconde/mostra cada serie.
  const [ocultas, setOcultas] = useState<Set<Serie>>(new Set())
  const alternar = (serie: Serie) =>
    setOcultas((atual) => {
      const nova = new Set(atual)
      if (nova.has(serie)) nova.delete(serie)
      else nova.add(serie)
      return nova
    })

  const linhas = data.map((item) => ({
    ...item,
    executados: Math.max(0, item.dias_estimados_totais - item.dias_restantes),
    restantes: item.dias_restantes,
  }))
  const escala = Math.max(
    1,
    ...linhas.map((l) => (ocultas.has('executados') ? 0 : l.executados) + (ocultas.has('restantes') ? 0 : l.restantes))
  )

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Carga de trabalho por engenheiro</CardTitle>
        <CardDescription>
          {onSelecionarEngenheiro ? 'Clique num engenheiro para ver as tarefas em execução' : 'Dias estimados por engenheiro'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROTULOS) as Serie[]).map((serie) => {
            const oculta = ocultas.has(serie)
            return (
              <button
                key={serie}
                type="button"
                onClick={() => alternar(serie)}
                aria-pressed={!oculta}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors',
                  oculta ? 'text-muted-foreground line-through opacity-60' : 'bg-card hover:bg-muted'
                )}
              >
                {serie === 'executados' ? (
                  <span className="h-2.5 w-4 rounded-[2px] bg-primary" />
                ) : (
                  <span className="hachura h-2.5 w-4 rounded-[2px] border border-primary/50 text-primary/45" />
                )}
                {ROTULOS[serie]}
              </button>
            )
          })}
        </div>

        {linhas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum engenheiro com carga ativa.</p>
        ) : (
          <ul className="divide-y">
            {linhas.map((l) => {
              const total = l.executados + l.restantes
              const pctExec = total > 0 ? Math.round((l.executados / total) * 100) : 0
              const larguraExec = ocultas.has('executados') ? 0 : (l.executados / escala) * 100
              const larguraRest = ocultas.has('restantes') ? 0 : (l.restantes / escala) * 100
              const conteudo = (
                <>
                  <span className="flex min-w-0 flex-1 items-center gap-2.5 sm:w-48 sm:flex-none">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {iniciais(l.engenheiro)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium group-hover:text-primary">{l.engenheiro}</span>
                      {l.exclusivo && (
                        <Badge variant="secondary" className="mt-0.5 h-4 px-1.5 text-[10px]">
                          Exclusivo
                        </Badge>
                      )}
                    </span>
                  </span>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="order-last flex h-6 w-full min-w-0 items-stretch sm:order-none sm:w-auto sm:flex-1">
                        <span
                          className="rounded-l-[5px] bg-primary transition-[width] duration-300"
                          style={{ width: `${larguraExec}%` }}
                        />
                        <span
                          className={cn(
                            'hachura border border-primary/40 text-primary/35 transition-[width] duration-300',
                            larguraExec === 0 && 'rounded-l-[5px]',
                            'rounded-r-[5px]',
                            larguraRest === 0 && 'border-0'
                          )}
                          style={{ width: `${larguraRest}%` }}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {l.executados} dias executados, {l.restantes} restantes ({pctExec}% do estimado)
                    </TooltipContent>
                  </Tooltip>

                  <span className="w-24 shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums">{l.dias_restantes} dias</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {l.percentual_execucao_media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% concluído
                    </span>
                  </span>
                </>
              )
              return (
                <li key={l.eng_id}>
                  {onSelecionarEngenheiro ? (
                    <button
                      type="button"
                      onClick={() => onSelecionarEngenheiro(l.engenheiro)}
                      className="group flex w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-md py-3 text-left transition-colors hover:bg-muted/50 sm:flex-nowrap"
                    >
                      {conteudo}
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 sm:flex-nowrap">{conteudo}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">Barras na mesma escala: a mais longa tem {escala} dias.</p>
      </CardContent>
    </Card>
  )
}
