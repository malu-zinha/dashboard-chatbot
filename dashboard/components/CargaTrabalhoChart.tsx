import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { CargaTrabalho } from '../lib/supabase'

interface CargaTrabalhoChartProps {
  data: CargaTrabalho[]
}

export default function CargaTrabalhoChart({ data }: CargaTrabalhoChartProps) {
  const chartData = data.map(item => ({
    name: item.engenheiro.split(' ')[0], // Primeiro nome
    'Dias Executados': Math.max(0, item.dias_estimados_totais - item.dias_restantes),
    'Dias Restantes': item.dias_restantes,
  }))

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        Carga de Trabalho por Engenheiro
      </h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis label={{ value: 'Dias', angle: -90, position: 'insideLeft' }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Dias Executados" stackId="a" fill="#10B981" />
          <Bar dataKey="Dias Restantes" stackId="a" fill="#3B82F6" />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 space-y-2">
        {data.slice(0, 5).map((item) => (
          <div 
            key={item.eng_id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-gray-700">
                {item.engenheiro}
              </span>
              {item.exclusivo && (
                <span className="ml-2 text-xs bg-tecpred-accent text-white px-2 py-1 rounded-sm">
                  Exclusivo
                </span>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">
                {item.dias_restantes} dias
              </div>
              <div className="text-xs text-gray-500">
                {item.percentual_execucao_media.toFixed(1)}% concluído
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

