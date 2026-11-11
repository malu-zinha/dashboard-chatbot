'use client'

import React, { useState } from 'react'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface RetrabalhoPizzaChartProps {
  data: Array<{ motivo_retrabalho: string; quantidade: number }>
  title: string
  height?: number
  mensagemVazia?: string
}

const COLORS = [
  '#EF4444', // vermelho
  '#F59E0B', // âmbar
  '#3B82F6', // azul
  '#10B981', // verde
  '#8B5CF6', // roxo
  '#EC4899', // rosa
  '#06B6D4', // ciano
  '#F97316', // laranja
  '#6366F1', // índigo
  '#14B8A6', // teal
]

// Cor fixa por motivo: com retrabalho e paralisacao em pizzas separadas, a cor por
// posicao faria o mesmo motivo mudar de cor de uma pizza para a outra. As cores sao as
// que cada motivo ja tinha na pizza unica, para quem ja conhece o grafico.
const COR_POR_MOTIVO: Record<string, string> = {
  'Outro': '#EF4444',
  'Alteração de projeto (Construtora)': '#F59E0B',
  'Erro de projeto (TecPred)': '#3B82F6',
  'Projeto Suspenso': '#10B981',
  'Falta de informação (Construtora)': '#8B5CF6',
  'Erro de comunicação': '#EC4899',
}

function corDoMotivo(motivo: string, index: number): string {
  return COR_POR_MOTIVO[motivo] ?? COLORS[index % COLORS.length]
}

function TooltipMotivo({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number; payload: { fill: string } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: item.payload.fill }} />
      <span className="font-medium">{item.name}</span>
      <span className="font-mono tabular-nums text-muted-foreground">
        {item.value} ocorrência{item.value !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

const config: ChartConfig = {}

export default function RetrabalhoPizzaChart({
  data,
  title,
  height = 280,
  mensagemVazia = 'Nenhum motivo registrado',
}: RetrabalhoPizzaChartProps) {
  // Fatia e linha da lista se destacam juntas.
  const [ativo, setAtivo] = useState<string | null>(null)

  if (!data || data.length === 0) {
    return (
      <div>
        {title && <h4 className="mb-3 text-sm font-semibold">{title}</h4>}
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <p className="text-sm">{mensagemVazia}</p>
        </div>
      </div>
    )
  }

  const chartData = data.map((item, index) => ({
    name: item.motivo_retrabalho,
    value: item.quantidade,
    fill: corDoMotivo(item.motivo_retrabalho, index),
  }))

  const total = data.reduce((sum, item) => sum + item.quantidade, 0)

  return (
    <div>
      {title && <h4 className="mb-3 text-sm font-semibold">{title}</h4>}

      {/* Pizza a esquerda e lista a direita; em tela estreita, uma embaixo da outra. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-4 md:flex-row md:items-center md:gap-8">
        <div className="w-full shrink-0 md:w-1/2">
          <ChartContainer config={config} className="mx-auto aspect-square" style={{ height, maxHeight: height }}>
            <PieChart>
              <ChartTooltip cursor={false} content={<TooltipMotivo />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={Math.round(height * 0.26)}
                outerRadius={Math.round(height * 0.4)}
                paddingAngle={2}
                strokeWidth={2}
                onMouseEnter={(_, index) => setAtivo(chartData[index]?.name ?? null)}
                onMouseLeave={() => setAtivo(null)}
              >
                {chartData.map((item) => (
                  <Cell
                    key={item.name}
                    fill={item.fill}
                    fillOpacity={ativo && ativo !== item.name ? 0.35 : 1}
                    className="transition-[fill-opacity] duration-200"
                  />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !('cx' in viewBox)) return null
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                          {total}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                          ocorrências
                        </tspan>
                      </text>
                    )
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        {/* Lista com contagens (e a unica legenda) */}
        <ul className="w-full space-y-1 md:w-1/2">
          {data.map((item, index) => (
            <li
              key={item.motivo_retrabalho}
              onMouseEnter={() => setAtivo(item.motivo_retrabalho)}
              onMouseLeave={() => setAtivo(null)}
              className={cn(
                'flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors',
                ativo === item.motivo_retrabalho ? 'bg-muted' : 'hover:bg-muted/70'
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: corDoMotivo(item.motivo_retrabalho, index) }}
                />
                <span className="truncate text-sm">{item.motivo_retrabalho}</span>
              </div>
              <div className="ml-2 flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums">{item.quantidade}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {total > 0 ? Math.round((item.quantidade / total) * 100) : 0}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
