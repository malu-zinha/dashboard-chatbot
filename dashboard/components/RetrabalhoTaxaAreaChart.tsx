'use client'

import React, { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { RetrabalhoTaxaArea } from '@/lib/supabase'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

interface RetrabalhoTaxaAreaChartProps {
  data: RetrabalhoTaxaArea[]
  // Clicar numa barra abre os detalhes de retrabalho daquele projeto.
  onSelecionarProjeto?: (projetoId: string) => void
}

// Mesma regra de antes (relativa ao maior percentual): verde, ambar, vermelho.
function percentualColor(percentual: number, max: number): string {
  const ratio = max > 0 ? percentual / max : 0
  if (ratio < 0.33) return 'var(--success)'
  if (ratio < 0.66) return 'var(--warning)'
  return 'var(--danger)'
}

const config = {
  percentual_retrabalho_disciplina: { label: '% por horas' },
} satisfies ChartConfig

function textoLimpo(valor?: string | null): string {
  return (valor || '').trim().replace(/\s+/g, ' ')
}

function truncarNome(nome: string, max = 24): string {
  if (nome.length <= max) return nome
  return `${nome.slice(0, max - 1)}…`
}

function formatEdificioDisciplina(
  d: Pick<RetrabalhoTaxaArea, 'cliente' | 'codigo_projeto' | 'area_codigo'>,
  truncar = false
): string {
  const codigo = textoLimpo(d.codigo_projeto)
  const nomeCompleto = textoLimpo(d.cliente) || codigo
  const nome = truncar ? truncarNome(nomeCompleto) : nomeCompleto
  const area = textoLimpo(d.area_codigo)

  if (!codigo || nomeCompleto.toUpperCase() === codigo.toUpperCase()) {
    return area ? `${nome} / ${area}` : nome
  }

  return area ? `${nome} (${codigo}) / ${area}` : `${nome} (${codigo})`
}

function TooltipArea({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: RetrabalhoTaxaArea }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="grid max-w-[240px] gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{formatEdificioDisciplina(d)}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Horas retrab.</span>
        <span className="font-mono font-medium tabular-nums">{(d.horas_retrabalho_total || 0).toFixed(1)}h</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">Horas totais</span>
        <span className="font-mono font-medium tabular-nums">{(d.horas_trabalhadas_total || 0).toFixed(1)}h</span>
      </div>
      <div className="flex justify-between gap-4 border-t pt-1.5">
        <span className="font-medium">Retrabalho (%)</span>
        <span className="font-mono font-semibold tabular-nums">{d.percentual_retrabalho_disciplina.toFixed(2)}%</span>
      </div>
    </div>
  )
}

export default function RetrabalhoTaxaAreaChart({ data, onSelecionarProjeto }: RetrabalhoTaxaAreaChartProps) {
  const [ativo, setAtivo] = useState<number | null>(null)

  if (!data || data.length === 0) {
    return <p className="py-3 text-sm text-muted-foreground">Nenhum dado de retrabalho por horas disponivel.</p>
  }

  const sorted = [...data]
    .sort((a, b) => b.percentual_retrabalho_disciplina - a.percentual_retrabalho_disciplina)
    .slice(0, 15)

  const maxPercentual = sorted[0]?.percentual_retrabalho_disciplina ?? 1
  const chartData = sorted.map((d) => ({
    ...d,
    label: formatEdificioDisciplina(d, true),
  }))
  const chartHeight = Math.max(250, chartData.length * 44)

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Percentual = horas de retrabalho / horas trabalhadas totais. Mostrando ate 15 combinacoes projeto/area com maior
        percentual.{onSelecionarProjeto ? ' Clique numa barra para abrir o projeto.' : ''}
      </p>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: chartHeight }}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 56, left: 4, bottom: 4 }}
          barCategoryGap="22%"
          onMouseLeave={() => setAtivo(null)}
        >
          <CartesianGrid horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 'auto']}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis type="category" dataKey="label" width={200} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={{ fill: 'var(--muted)', opacity: 0.6 }} content={<TooltipArea />} />
          <Bar
            dataKey="percentual_retrabalho_disciplina"
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
            onMouseEnter={(_, index) => setAtivo(index)}
            onClick={(entrada) => {
              const projetoId = (entrada?.payload as RetrabalhoTaxaArea | undefined)?.projeto_id
              if (projetoId && onSelecionarProjeto) onSelecionarProjeto(projetoId)
            }}
            className={cn(onSelecionarProjeto && 'cursor-pointer')}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={percentualColor(entry.percentual_retrabalho_disciplina, maxPercentual)}
                fillOpacity={ativo !== null && ativo !== index ? 0.45 : 1}
                className="transition-[fill-opacity] duration-200"
              />
            ))}
            <LabelList
              dataKey="percentual_retrabalho_disciplina"
              position="right"
              formatter={(v: unknown) => `${Number(v).toFixed(1)}%`}
              className="fill-foreground text-[11px] font-semibold"
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
