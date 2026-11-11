'use client'

import React, { useState } from 'react'
import { RetrabalhoMotivo } from '@/lib/supabase'
import { FiltroMotivos, motivosDoFiltro } from '@/lib/ocorrencias'
import RetrabalhoPizzaChart from '@/components/RetrabalhoPizzaChart'

interface MotivosPorTipoProps {
  data: RetrabalhoMotivo[]
  // Vai no fim do titulo, ex.: "TecPred" ou o codigo do projeto.
  escopo: string
  height?: number
}

const SUBTITULO: Record<FiltroMotivos, string> = {
  geral: 'Geral — retrabalho + paralisação',
  retrabalho: 'Só retrabalho',
  paralisacao: 'Só paralisação',
}

const VAZIO: Record<FiltroMotivos, string> = {
  geral: 'Nenhum motivo registrado',
  retrabalho: 'Nenhum retrabalho registrado ainda',
  paralisacao: 'Nenhuma paralisação registrada ainda',
}

// Uma pizza so. Abre no geral (soma de tudo, incluindo os registros de antes da
// separacao, que nao tem tipo); os dois botoes embaixo filtram so retrabalho ou so
// paralisacao. Clicar de novo no botao ativo volta para o geral.
export default function MotivosPorTipo({ data, escopo, height = 280 }: MotivosPorTipoProps) {
  const [filtro, setFiltro] = useState<FiltroMotivos>('geral')

  const alternar = (alvo: Exclude<FiltroMotivos, 'geral'>) =>
    setFiltro((atual) => (atual === alvo ? 'geral' : alvo))

  const botao = (alvo: Exclude<FiltroMotivos, 'geral'>, rotulo: string) => {
    const ativo = filtro === alvo
    return (
      <button
        type="button"
        onClick={() => alternar(alvo)}
        aria-pressed={ativo}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          ativo
            ? 'bg-tecpred-primary text-white border-tecpred-primary'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        {rotulo}
      </button>
    )
  }

  return (
    <div>
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-gray-700">Motivos mais frequentes — {escopo}</h4>
        <p className="text-xs text-gray-500 mt-0.5">{SUBTITULO[filtro]}</p>
      </div>

      <RetrabalhoPizzaChart
        data={motivosDoFiltro(data, filtro)}
        title=""
        height={height}
        mensagemVazia={VAZIO[filtro]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {botao('retrabalho', 'Ver só retrabalho')}
        {botao('paralisacao', 'Ver só paralisação')}
        {filtro !== 'geral' && (
          <button
            type="button"
            onClick={() => setFiltro('geral')}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 underline"
          >
            Voltar ao geral
          </button>
        )}
      </div>
    </div>
  )
}
