'use client'

import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { RetrabalhoMotivo } from '@/lib/supabase'

interface RetrabalhoPizzaChartProps {
  data: RetrabalhoMotivo[]
  title: string
  height?: number
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
}: RetrabalhoPizzaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div>
        {title && (
          <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
        )}
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <p className="text-sm">Nenhum motivo registrado</p>
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

      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            outerRadius={Math.round(height * 0.28)}
            dataKey="value"
            labelLine={false}
          >
            {chartData.map((item, index) => (
              <Cell
                key={`cell-${index}`}
                fill={corDoMotivo(item.name, index)}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-700">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legenda detalhada com contagens */}
      <div className="mt-3 space-y-1">
        {data.map((item, index) => (
          <div
            key={item.motivo_retrabalho}
            className="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-50"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: corDoMotivo(item.motivo_retrabalho, index) }}
              />
              <span className="text-xs text-gray-700 truncate">
                {item.motivo_retrabalho}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-xs font-bold text-gray-900">
                {item.quantidade}
              </span>
              <span className="text-xs text-gray-400">
                ({total > 0 ? Math.round((item.quantidade / total) * 100) : 0}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
