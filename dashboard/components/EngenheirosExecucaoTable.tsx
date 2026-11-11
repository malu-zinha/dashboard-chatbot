'use client'

import React, { useMemo, useEffect } from 'react'
import { AlertTriangle, Search } from 'lucide-react'
import {
  buildEngenheirosExecucao,
  type EngenheiroExecucaoGroup,
  type EngenheiroExecucaoProjeto,
} from '@/lib/engenheirosExecucao'
import { searchScore } from '@/lib/search'
import ModalShell from '@/components/ModalShell'
import { formatarDataBR } from '@/lib/datas'
import { cn } from '@/lib/utils'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface EngenheirosExecucaoTableProps {
  // Modo modal (padrao): controlado por isOpen/onClose e pela tela cheia.
  isOpen?: boolean
  onClose?: () => void
  projetos: EngenheiroExecucaoProjeto[]
  fullscreen?: boolean
  onToggleFullscreen?: () => void
  // Busca ja preenchida ao abrir (ex.: clique no engenheiro do grafico de carga).
  buscaInicial?: string
  // Embutido: o mesmo quadro dentro de um card na pagina, sem ModalShell.
  embutido?: boolean
}

const semAcao = () => {}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Mesmos cortes de antes: 75% ou mais azul, 50% ou mais laranja, abaixo disso cinza.
function corAndamento(pct: number) {
  if (pct >= 75) return 'bg-info'
  if (pct >= 50) return 'bg-warning'
  return 'bg-gray-400'
}

function groupSearchScore(searchTerm: string, grupo: EngenheiroExecucaoGroup) {
  return searchScore(searchTerm, [
    grupo.engenheiro_nome,
    ...grupo.tarefas.flatMap((tarefa) => [
      tarefa.codigo_projeto,
      tarefa.cliente,
      tarefa.area_display_name,
      tarefa.area_descricao,
    ]),
  ])
}

export default function EngenheirosExecucaoTable({
  isOpen = false,
  onClose,
  projetos,
  fullscreen = false,
  onToggleFullscreen,
  buscaInicial = '',
  embutido = false,
}: EngenheirosExecucaoTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')

  // No modal a busca recomeca a cada abertura; embutido, ao montar e quando a busca inicial muda.
  useEffect(() => {
    if (isOpen || embutido) setSearchTerm(buscaInicial)
  }, [isOpen, embutido, buscaInicial])

  const grupos = useMemo(() => buildEngenheirosExecucao(projetos), [projetos])
  const filteredGroups = useMemo(
    () => grupos
      .map((grupo) => ({ grupo, score: groupSearchScore(searchTerm, grupo) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.grupo),
    [grupos, searchTerm]
  )

  const totalTarefas = filteredGroups.reduce((acc, grupo) => acc + grupo.total_tarefas, 0)
  const resumo = `${filteredGroups.length} engenheiro(s), ${totalTarefas} tarefa(s) em execução`

  // Os dois modos sao o mesmo kanban: uma linha de colunas com rolagem horizontal. Em tela
  // cheia as colunas ficam mais estreitas e densas (cabem ~6 engenheiros em vez de 4) e cada
  // uma rola por dentro, em vez de o board inteiro rolar junto. Embutido usa o tamanho normal,
  // rola so na horizontal e limita a altura de cada coluna para nao esticar a pagina.
  const telaCheia = fullscreen && !embutido
  const layout = telaCheia
    ? {
        scroller: 'min-h-0 overflow-x-auto overflow-y-hidden',
        board: 'h-full gap-3',
        column: 'w-56',
        colHeader: 'p-3',
        avatar: 'size-8 text-[11px]',
        engName: 'text-xs',
        taskList: 'min-h-0 overflow-y-auto gap-2 p-2',
        taskCard: 'p-2.5 text-xs',
        meta: 'text-[11px]',
      }
    : {
        scroller: embutido ? 'overflow-x-auto' : 'overflow-auto',
        board: 'gap-4',
        column: 'w-80',
        colHeader: 'p-4',
        avatar: 'size-9 text-xs',
        engName: 'text-sm',
        taskList: cn('gap-3 p-3', embutido && 'max-h-[560px] overflow-y-auto'),
        taskCard: 'p-3 text-sm',
        meta: 'text-xs',
      }

  const busca = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar por engenheiro, código, cliente ou disciplina..."
        aria-label="Buscar por engenheiro, código, cliente ou disciplina"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-9 bg-card pl-9"
      />
    </div>
  )

  const quadro = (
    <div className={cn('flex-1 bg-muted/40 p-4', layout.scroller)}>
      {filteredGroups.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Nenhum engenheiro com projetos em execução
        </div>
      ) : (
        <div className={cn('flex min-w-max', layout.board)}>
          {filteredGroups.map((grupo) => (
            <section
              key={grupo.eng_id}
              aria-label={grupo.engenheiro_nome}
              className={cn('flex shrink-0 flex-col rounded-lg border bg-card', layout.column)}
            >
              <div className={cn('border-b', layout.colHeader)}>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
                      layout.avatar
                    )}
                  >
                    {iniciais(grupo.engenheiro_nome)}
                  </span>
                  <div className="min-w-0">
                    <h3 className={cn('truncate font-semibold text-foreground', layout.engName)}>
                      {grupo.engenheiro_nome}
                    </h3>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {grupo.total_tarefas} tarefa(s)
                      {grupo.total_atrasadas > 0 ? (
                        <span className="text-[var(--alert)]">{`, ${grupo.total_atrasadas} atrasada(s)`}</span>
                      ) : ''}
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn('flex flex-1 flex-col', layout.taskList)}>
                {grupo.tarefas.map((tarefa) => {
                  const atrasada = tarefa.dias_atraso > 0
                  const pct = Math.min(tarefa.percentual_andamento, 100)
                  return (
                    <article
                      key={tarefa.atribuicao_id || `${tarefa.projeto_id}-${tarefa.area_display_name}`}
                      className={cn(
                        'shrink-0 rounded-md border',
                        layout.taskCard,
                        atrasada ? 'border-red-200 bg-red-50/60' : 'bg-card'
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-primary">{tarefa.codigo_projeto}</div>
                          <div className="line-clamp-2 text-foreground">{tarefa.cliente}</div>
                        </div>
                        {atrasada && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                            <AlertTriangle className="size-3" />
                            {tarefa.dias_atraso}d
                          </span>
                        )}
                      </div>

                      <div
                        className={cn(
                          'mb-3 inline-flex rounded-full bg-secondary px-2 py-0.5 font-medium text-secondary-foreground',
                          layout.meta
                        )}
                      >
                        {tarefa.area_display_name}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Andamento em cor cheia; o que falta hachurado, como corte em planta */}
                        <span className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className={cn('h-full', corAndamento(tarefa.percentual_andamento))} style={{ width: `${pct}%` }} />
                          <span className="hachura h-full flex-1 text-primary/20" />
                        </span>
                        <span className="w-10 text-right text-xs font-semibold text-foreground tabular-nums">
                          {tarefa.percentual_andamento.toFixed(0)}%
                        </span>
                      </div>

                      <div className={cn('mt-2 text-muted-foreground tabular-nums', layout.meta)}>
                        Prazo: {formatarDataBR(tarefa.data_prevista)}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )

  const rodape = (
    <p className="w-full text-center text-sm text-muted-foreground tabular-nums">
      Mostrando {filteredGroups.length} de {grupos.length} engenheiros
    </p>
  )

  if (embutido) {
    return (
      <Card className="animate-fade-in gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Engenheiros em execução</CardTitle>
          <CardDescription className="tabular-nums">{resumo}</CardDescription>
        </CardHeader>
        <div className="border-b bg-muted/40 px-5 py-3">{busca}</div>
        {quadro}
        <CardFooter className="py-3">{rodape}</CardFooter>
      </Card>
    )
  }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose ?? semAcao}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen ?? semAcao}
      title="Engenheiros em execução"
      subtitle={resumo}
      headerGradientClass="from-tecpred-primary to-tecpred-secondary"
    >
      <div className="border-b bg-muted/40 p-4">{busca}</div>

      {quadro}

      <div className={cn('border-t bg-muted/40 px-4 py-3', !fullscreen && 'rounded-b-xl')}>
        {rodape}
      </div>
    </ModalShell>
  )
}
