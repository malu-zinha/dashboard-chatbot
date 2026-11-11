'use client'

import React, { useState } from 'react'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { ArrowRight } from 'lucide-react'
import { ProjetosStatus } from '../lib/supabase'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ProjetosStatusChartProps {
  data: ProjetosStatus[]
  // Clicar numa fatia (ou na linha da lista) abre os projetos daquele status.
  onSelecionarStatus?: (status: string) => void
}

const CORES: Record<string, string> = {
  'Concluído': 'var(--success)',
  'Em Andamento': 'var(--chart-2)',
  'Atrasado': 'var(--danger)',
  'Aguardando': 'var(--warning)',
}
const corDoStatus = (status: string) => CORES[status] ?? 'var(--chart-4)'

export default function ProjetosStatusChart({ data, onSelecionarStatus }: ProjetosStatusChartProps) {
  const [ativo, setAtivo] = useState<string | null>(null)

  const chartData = data.map((item) => ({
    status: item.status,
    quantidade: item.quantidade,
    percentual: item.percentual,
    fill: corDoStatus(item.status),
  }))
  const total = data.reduce((s, item) => s + item.quantidade, 0)
  // So rotulos: a cor vai direto na fatia (o status tem espaco e acento, nao serve de nome de variavel CSS).
  const config: ChartConfig = Object.fromEntries(data.map((item) => [item.status, { label: item.status }]))

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Projetos por status</CardTitle>
        <CardDescription>
          {onSelecionarStatus ? 'Clique numa fatia para ver os projetos' : 'Distribuição atual'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row">
        <ChartContainer config={config} className="aspect-square h-[220px] shrink-0">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
            <Pie
              data={chartData}
              dataKey="quantidade"
              nameKey="status"
              innerRadius={62}
              outerRadius={96}
              paddingAngle={2}
              strokeWidth={2}
              onMouseEnter={(_, index) => setAtivo(chartData[index]?.status ?? null)}
              onMouseLeave={() => setAtivo(null)}
              onClick={(_, index) => {
                const status = chartData[index]?.status
                if (status && onSelecionarStatus) onSelecionarStatus(status)
              }}
              className={cn(onSelecionarStatus && 'cursor-pointer')}
            >
              {chartData.map((item) => (
                <Cell
                  key={item.status}
                  fill={item.fill}
                  fillOpacity={ativo && ativo !== item.status ? 0.35 : 1}
                  className="transition-[fill-opacity] duration-200"
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !('cx' in viewBox)) return null
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-semibold">
                        {total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 22} className="fill-muted-foreground text-xs">
                        projetos
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <ul className="w-full space-y-1.5">
          {chartData.map((item) => {
            const conteudo = (
              <>
                <span className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm font-medium">{item.status}</span>
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-semibold tabular-nums">{item.quantidade}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                    {item.percentual}%
                  </span>
                  {onSelecionarStatus && (
                    <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </span>
              </>
            )
            const classe = cn(
              'group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors',
              ativo === item.status ? 'bg-muted' : 'hover:bg-muted/70'
            )
            return (
              <li
                key={item.status}
                onMouseEnter={() => setAtivo(item.status)}
                onMouseLeave={() => setAtivo(null)}
              >
                {onSelecionarStatus ? (
                  <button type="button" className={classe} onClick={() => onSelecionarStatus(item.status)}>
                    {conteudo}
                  </button>
                ) : (
                  <div className={classe}>{conteudo}</div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
