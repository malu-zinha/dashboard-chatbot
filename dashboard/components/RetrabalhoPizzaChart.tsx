'use client'

import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

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

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold text-gray-800">{payload[0].name}</p>
        <p className="text-gray-600">
          <span className="font-bold text-danger">{payload[0].value}</span>{' '}
          ocorrência{payload[0].value !== 1 ? 's' : ''}
        </p>
      </div>
    )
  }
  return null
}

export default function RetrabalhoPizzaChart({
  data,
  title,
  height = 280,
  mensagemVazia = 'Nenhum motivo registrado',
}: RetrabalhoPizzaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div>
        {title && (
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <p className="text-sm">{mensagemVazia}</p>
        </div>
      </div>
    )
  }

  const chartData = data.map((item) => ({
    name: item.motivo_retrabalho,
    value: item.quantidade,
  }))

  const total = data.reduce((sum, item) => sum + item.quantidade, 0)

  return (
    <div>
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}

      {/* Pizza a esquerda e lista a direita; em tela estreita, uma embaixo da outra. */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 max-w-3xl mx-auto">
        <div className="w-full md:w-1/2 shrink-0">
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={Math.round(height * 0.4)}
                dataKey="value"
                labelLine={false}
              >
                {chartData.map((item, index) => (
                  <Cell key={`cell-${index}`} fill={corDoMotivo(item.name, index)} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lista com contagens (e a unica legenda) */}
        <div className="w-full md:w-1/2 space-y-1">
          {data.map((item, index) => (
            <div
              key={item.motivo_retrabalho}
              className="flex items-center justify-between py-1 px-2 rounded-sm hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: corDoMotivo(item.motivo_retrabalho, index) }}
                />
                <span className="text-xs text-gray-700 truncate">{item.motivo_retrabalho}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs font-bold text-gray-900">{item.quantidade}</span>
                <span className="text-xs text-gray-400">
                  ({total > 0 ? Math.round((item.quantidade / total) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
