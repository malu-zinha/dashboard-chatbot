'use client'

import React, { useEffect, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type { VisaoGeral } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type Filtro = 'all' | 'concluido' | 'em_execucao' | 'atrasado'

interface PranchaResumoProps {
  visaoGeral: VisaoGeral | null
  engenheirosEmExecucao: number
  tarefasEmExecucao: number
  lastUpdate: Date | null
  onAbrirProjetos: (filtro: Filtro, telaCheia?: boolean) => void
  onAbrirEngenheiros: (telaCheia?: boolean) => void
}

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Arco de 180 graus com marcacoes a cada 10% (maiores a cada 50%), como um transferidor.
function MedidorArco({ valor }: { valor: number }) {
  const [desenhado, setDesenhado] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => setDesenhado(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const pct = Math.max(0, Math.min(100, valor))
  const r = 104
  const cx = 130
  const cy = 150
  const comprimento = Math.PI * r
  const ponto = (p: number, raio: number) => {
    const ang = Math.PI * (1 - p / 100)
    return [cx + raio * Math.cos(ang), cy - raio * Math.sin(ang)]
  }
  const [px, py] = ponto(desenhado ? pct : 0, r)

  return (
    <svg viewBox="0 0 260 176" className="w-full max-w-[300px]" role="img" aria-label={`Progresso geral ${fmt1(pct)}%`}>
      {/* marcacoes */}
      {Array.from({ length: 11 }).map((_, i) => {
        const p = i * 10
        const longa = p % 50 === 0
        const [x1, y1] = ponto(p, r + 10)
        const [x2, y2] = ponto(p, r + (longa ? 22 : 16))
        return (
          <line
            key={p}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="white"
            strokeOpacity={longa ? 0.7 : 0.35}
            strokeWidth={longa ? 1.5 : 1}
          />
        )
      })}
      {/* 50 em cima; 0 e 100 embaixo das pontas do arco */}
      <text x={cx} y={cy - r - 30} textAnchor="middle" className="fill-white/55 text-[10px] tabular-nums">
        50
      </text>
      <text x={cx - r} y={cy + 20} textAnchor="middle" className="fill-white/55 text-[10px] tabular-nums">
        0
      </text>
      <text x={cx + r} y={cy + 20} textAnchor="middle" className="fill-white/55 text-[10px] tabular-nums">
        100
      </text>
      {/* trilho e valor */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="white"
        strokeOpacity={0.14}
        strokeWidth={14}
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="white"
        strokeWidth={14}
        strokeDasharray={comprimento}
        strokeDashoffset={comprimento * (1 - (desenhado ? pct : 0) / 100)}
        className="arco-animado transition-[stroke-dashoffset] duration-[1400ms] ease-out"
      />
      {/* ponta do arco */}
      <circle
        cx={px}
        cy={py}
        r={5}
        fill="var(--alert)"
        stroke="white"
        strokeWidth={2}
        className="arco-animado transition-all duration-[1400ms] ease-out"
      />
    </svg>
  )
}

interface CelulaProps {
  rotulo: string
  valor: number | string
  detalhe: string
  destaque?: boolean
  onAbrir: () => void
  onTelaCheia: () => void
  className?: string
}

// Celula do carimbo: o numero abre a lista; o icone abre em tela cheia.
function Celula({ rotulo, valor, detalhe, destaque, onAbrir, onTelaCheia, className }: CelulaProps) {
  return (
    <div className={cn('group relative bg-[var(--blueprint)]', className)}>
      <button
        type="button"
        onClick={onAbrir}
        className="flex h-full w-full flex-col items-start gap-1 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none"
      >
        <span className="text-[13px] text-white/60">{rotulo}</span>
        <span
          className={cn(
            'font-wide text-[2rem] leading-none font-semibold tabular-nums',
            destaque ? 'text-[var(--alert)]' : 'text-white'
          )}
        >
          {valor}
        </span>
        <span className="text-xs text-white/50">{detalhe}</span>
      </button>
      <button
        type="button"
        onClick={onTelaCheia}
        aria-label={`Expandir ${rotulo} em tela cheia`}
        title="Abrir em tela cheia"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-white/0 transition-colors group-hover:text-white/50 hover:!text-white focus-visible:text-white"
      >
        <Maximize2 className="size-3.5" />
      </button>
    </div>
  )
}

export default function PranchaResumo({
  visaoGeral,
  engenheirosEmExecucao,
  tarefasEmExecucao,
  lastUpdate,
  onAbrirProjetos,
  onAbrirEngenheiros,
}: PranchaResumoProps) {
  const progresso = visaoGeral?.percentual_concluido_medio ?? 0
  const hoje = new Intl.DateTimeFormat('pt-BR').format(new Date())

  return (
    <section className="malha-prancha overflow-hidden rounded-2xl text-white shadow-[0_18px_40px_-24px_rgba(22,26,92,0.7)]">
      <div className="grid lg:grid-cols-[minmax(280px,0.9fr)_1.6fr]">
        {/* Medidor */}
        <div className="flex flex-col justify-between gap-4 p-6 lg:p-8">
          <div>
            <h2 className="font-wide text-lg font-semibold">Produção TecPred</h2>
            <p className="mt-1 text-sm text-white/60">Média de conclusão das disciplinas ativas</p>
          </div>
          <div className="relative mx-auto w-full max-w-[300px]">
            <MedidorArco valor={progresso} />
            <p className="absolute inset-x-0 bottom-1 text-center">
              <span className="font-wide text-5xl font-semibold tabular-nums">{fmt1(progresso)}</span>
              <span className="font-wide text-2xl text-white/70">%</span>
            </p>
          </div>
        </div>

        {/* Carimbo: cada celula e um indicador clicavel */}
        <div className="m-3 flex flex-col overflow-hidden rounded-xl border border-white/25 lg:m-6 lg:ml-0">
          <div className="grid flex-1 grid-cols-2 gap-px bg-white/15 sm:grid-cols-3">
            <Celula
              rotulo="Projetos"
              valor={visaoGeral?.total_projetos ?? 0}
              detalhe={`${visaoGeral?.total_areas ?? 0} áreas`}
              onAbrir={() => onAbrirProjetos('all')}
              onTelaCheia={() => onAbrirProjetos('all', true)}
            />
            <Celula
              rotulo="Em execução"
              valor={visaoGeral?.projetos_em_execucao ?? 0}
              detalhe={`${visaoGeral?.areas_ativas ?? 0} áreas ativas`}
              onAbrir={() => onAbrirProjetos('em_execucao')}
              onTelaCheia={() => onAbrirProjetos('em_execucao', true)}
            />
            <Celula
              rotulo="Concluídos"
              valor={visaoGeral?.projetos_concluidos ?? 0}
              detalhe={`${visaoGeral?.areas_concluidas ?? 0} áreas concluídas`}
              onAbrir={() => onAbrirProjetos('concluido')}
              onTelaCheia={() => onAbrirProjetos('concluido', true)}
            />
            <Celula
              rotulo="Engenheiros em execução"
              valor={engenheirosEmExecucao}
              detalhe={`${tarefasEmExecucao} tarefa(s) em execução`}
              onAbrir={() => onAbrirEngenheiros()}
              onTelaCheia={() => onAbrirEngenheiros(true)}
            />
            <Celula
              rotulo="Atrasados"
              valor={visaoGeral?.projetos_atrasados ?? 0}
              detalhe="Requer atenção"
              destaque={(visaoGeral?.projetos_atrasados ?? 0) > 0}
              onAbrir={() => onAbrirProjetos('atrasado')}
              onTelaCheia={() => onAbrirProjetos('atrasado', true)}
              className="col-span-2 sm:col-span-2"
            />
          </div>
          {/* Faixa de identificacao, como no rodape do carimbo de uma prancha */}
          <div className="grid grid-cols-2 border-t border-white/25 bg-[var(--blueprint)] text-xs text-white/55 sm:grid-cols-3">
            <span className="border-r border-white/15 px-4 py-2">Folha: visão geral</span>
            <span className="px-4 py-2 sm:border-r sm:border-white/15">Data: {hoje}</span>
            <span className="col-span-2 border-t border-white/15 px-4 py-2 sm:col-span-1 sm:border-t-0">
              Atualizado: {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : '—'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
