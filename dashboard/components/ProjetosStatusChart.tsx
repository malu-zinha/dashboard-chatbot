'use client'

import React, { useState } from 'react'
import { ProjetosStatus } from '../lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ProjetosStatusChartProps {
  data: ProjetosStatus[]
  // Clicar num trecho da escala (ou na linha da lista) abre os projetos daquele status.
  onSelecionarStatus?: (status: string) => void
}

const CORES: Record<string, string> = {
  'Concluído': 'var(--success)',
  'Em Andamento': 'var(--primary)',
  'Atrasado': 'var(--alert)',
  'Aguardando': 'var(--warning)',
}
const corDoStatus = (status: string) => CORES[status] ?? 'var(--chart-3)'

// "Escala grafica": uma barra dividida por status, com a cota de cada trecho por cima,
// como as cotas de um desenho tecnico.
export default function ProjetosStatusChart({ data, onSelecionarStatus }: ProjetosStatusChartProps) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const total = data.reduce((s, item) => s + item.quantidade, 0)
  const trechos = data.filter((item) => item.quantidade > 0)

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle>Projetos por status</CardTitle>
        <CardDescription>
          <span className="font-wide text-foreground tabular-nums">{total}</span> projetos
          {onSelecionarStatus ? ', clique num trecho para ver a lista' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-8">
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum projeto ativo.</p>
        ) : (
          <div>
            {/* Cotas */}
            <div className="flex h-9 items-end">
              {trechos.map((item) => (
                <div
                  key={item.status}
                  style={{ width: `${(item.quantidade / total) * 100}%` }}
                  className={cn(
                    'relative flex min-w-0 justify-center transition-opacity',
                    ativo && ativo !== item.status && 'opacity-30'
                  )}
                >
                  {/* linha de cota com os dois tracos de chamada */}
                  <span className="absolute inset-x-0.5 bottom-[13px] border-t border-muted-foreground/50" />
                  <span className="absolute bottom-1 left-0.5 h-3 border-l border-muted-foreground/50" />
                  <span className="absolute right-0.5 bottom-1 h-3 border-l border-muted-foreground/50" />
                  <span className="relative mb-2 bg-card px-1.5 text-sm font-semibold tabular-nums">{item.quantidade}</span>
                </div>
              ))}
            </div>

            {/* Barra */}
            <div className="flex h-11 gap-0.5 overflow-hidden rounded-lg">
              {trechos.map((item) => (
                <Tooltip key={item.status}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`${item.status}: ${item.quantidade} projetos (${item.percentual}%)`}
                      onClick={() => onSelecionarStatus?.(item.status)}
                      onMouseEnter={() => setAtivo(item.status)}
                      onMouseLeave={() => setAtivo(null)}
                      onFocus={() => setAtivo(item.status)}
                      onBlur={() => setAtivo(null)}
                      style={{ width: `${(item.quantidade / total) * 100}%`, backgroundColor: corDoStatus(item.status) }}
                      className={cn(
                        'h-full min-w-2 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        ativo && ativo !== item.status && 'opacity-30',
                        !onSelecionarStatus && 'cursor-default'
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {item.status}: {item.quantidade} ({item.percentual}%)
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Escala 0 a 100% */}
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground tabular-nums">
              <span>0</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <ul className="grid gap-1 sm:grid-cols-2">
          {data.map((item) => {
            const conteudo = (
              <>
                <span className="flex items-center gap-2.5">
                  <span className="h-3 w-1 rounded-full" style={{ backgroundColor: corDoStatus(item.status) }} />
                  <span className="text-sm">{item.status}</span>
                </span>
                <span className="text-sm tabular-nums">
                  <span className="font-semibold">{item.quantidade}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{item.percentual}%</span>
                </span>
              </>
            )
            const classe = cn(
              'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left transition-colors',
              ativo === item.status ? 'bg-muted' : 'hover:bg-muted/70'
            )
            return (
              <li key={item.status} onMouseEnter={() => setAtivo(item.status)} onMouseLeave={() => setAtivo(null)}>
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
