import React from 'react'
import { RetrabalhoMotivo } from '@/lib/supabase'
import { agruparMotivosPorTipo } from '@/lib/ocorrencias'
import RetrabalhoPizzaChart from '@/components/RetrabalhoPizzaChart'

interface MotivosPorTipoProps {
  data: RetrabalhoMotivo[]
  // Vai no fim de cada titulo, ex.: "TecPred (geral)" ou o codigo do projeto.
  escopo: string
  height?: number
}

// Uma pizza por tipo: retrabalho, paralisacao e, enquanto houver, os registros antigos
// sem tipo. Cada motivo tem cor fixa (RetrabalhoPizzaChart), entao a mesma cor e o mesmo
// motivo nas tres.
export default function MotivosPorTipo({ data, escopo, height = 280 }: MotivosPorTipoProps) {
  const grupos = agruparMotivosPorTipo(data)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {grupos.map((grupo) => (
        <div key={grupo.tipo} className="min-w-0">
          <RetrabalhoPizzaChart
            data={grupo.linhas}
            title={`${grupo.titulo} — ${escopo}`}
            height={height}
          />
        </div>
      ))}
    </div>
  )
}
