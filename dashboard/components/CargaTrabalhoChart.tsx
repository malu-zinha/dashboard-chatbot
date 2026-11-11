'use client'

import React, { useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { CargaTrabalho } from '../lib/supabase'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CargaTrabalhoChartProps {
  data: CargaTrabalho[]
  // Clicar na barra (ou no nome na lista) abre as tarefas em execucao daquele engenheiro.
  onSelecionarEngenheiro?: (nome: string) => void
}

const config = {
  executados: { label: 'Dias executados', color: 'var(--chart-1)' },
  restantes: { label: 'Dias restantes', color: 'var(--chart-4)' },
} satisfies ChartConfig

type Serie = keyof typeof config

interface Linha {
  nome: string
  nomeCompleto: string
  executados: number
  restantes: number
}

function TooltipCarga({ active, payload }: { active?: boolean; payload?: Array<{ payload: Linha }> }) {
  const linha = payload?.[0]?.payload
  if (!active || !linha) return null
  const total = linha.executados + linha.restantes
  const pct = total > 0 ? Math.round((linha.executados / total) * 100) : 0
  return (
    <div className="grid min-w-44 gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{linha.nomeCompleto}</p>
      {(Object.keys(config) as Serie[]).map((serie) => (
        <div key={serie} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-[2px]" style={{ backgroundColor: config[serie].color }} />
            {config[serie].label}
          </span>
          <span className="font-mono font-medium tabular-nums">{linha[serie]} d</span>
        </div>
      ))}
      <div className="mt-0.5 border-t pt-1.5 text-muted-foreground">
        {pct}% do estimado já executado
      </div>
    </div>
  )
}

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

  const chartData: Linha[] = data.map((item) => ({
    nome: item.engenheiro.split(' ')[0], // Primeiro nome
    nomeCompleto: item.engenheiro,
    executados: Math.max(0, item.dias_estimados_totais - item.dias_restantes),
    restantes: item.dias_restantes,
  }))

  const clicar = (linha?: Linha) => {
    if (linha && onSelecionarEngenheiro) onSelecionarEngenheiro(linha.nomeCompleto)
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Carga de trabalho por engenheiro</CardTitle>
        <CardDescription>
          Dias executados e restantes{onSelecionarEngenheiro ? ' · clique num engenheiro para ver as tarefas' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(config) as Serie[]).map((serie) => {
            const oculta = ocultas.has(serie)
            return (
              <button
                key={serie}
                type="button"
                onClick={() => alternar(serie)}
                aria-pressed={!oculta}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  oculta ? 'text-muted-foreground opacity-60' : 'bg-card hover:bg-muted'
                )}
              >
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ backgroundColor: oculta ? 'var(--muted-foreground)' : config[serie].color }}
                />
                {config[serie].label}
              </button>
            )
          })}
        </div>

        <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
          <BarChart data={chartData} margin={{ left: -8, right: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="nome" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<TooltipCarga />} />
            {(Object.keys(config) as Serie[]).map((serie, i, todas) => {
              // Cantos arredondados so no topo da pilha visivel.
              const visiveis = todas.filter((s) => !ocultas.has(s))
              const topo = visiveis[visiveis.length - 1] === serie
              return (
                <Bar
                  key={serie}
                  dataKey={serie}
                  stackId="carga"
                  fill={`var(--color-${serie})`}
                  hide={ocultas.has(serie)}
                  radius={topo ? [6, 6, 0, 0] : 0}
                  maxBarSize={56}
                  onClick={(entrada) => clicar(entrada?.payload as Linha | undefined)}
                  className={cn(onSelecionarEngenheiro && 'cursor-pointer')}
                />
              )
            })}
          </BarChart>
        </ChartContainer>

        <ul className="divide-y">
          {data.slice(0, 5).map((item) => (
            <li key={item.eng_id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {onSelecionarEngenheiro ? (
                  <button
                    type="button"
                    onClick={() => onSelecionarEngenheiro(item.engenheiro)}
                    className="truncate text-sm font-medium hover:text-primary hover:underline"
                  >
                    {item.engenheiro}
                  </button>
                ) : (
                  <span className="truncate text-sm font-medium">{item.engenheiro}</span>
                )}
                {item.exclusivo && (
                  <Badge variant="secondary" className="shrink-0">
                    Exclusivo
                  </Badge>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{item.dias_restantes} dias</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {item.percentual_execucao_media.toFixed(1)}% concluído
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
