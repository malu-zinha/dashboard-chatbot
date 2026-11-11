'use client'

import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  RetrabalhoDetalheProjeto,
  RetrabalhoAreaProjeto,
  RetrabalhoMotivo,
} from '@/lib/supabase'
import MotivosPorTipo from '@/components/MotivosPorTipo'
import { formatarDataBR } from '@/lib/datas'
import { normalizarTipo, rotuloTipo } from '@/lib/ocorrencias'
import { cn } from '@/lib/utils'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Etiqueta do tipo na lista de registros.
const CLASSE_TIPO = {
  retrabalho: 'bg-orange-50 text-orange-700 border-orange-200',
  paralisacao: 'bg-sky-50 text-sky-700 border-sky-200',
  nao_classificado: 'bg-gray-100 text-gray-500 border-gray-200',
} as const

function EtiquetaTipo({ tipo }: { tipo: string | null | undefined }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${CLASSE_TIPO[normalizarTipo(tipo)]}`}>
      {rotuloTipo(tipo)}
    </span>
  )
}

function SemMotivo() {
  return <span className="text-muted-foreground italic">Sem motivo informado</span>
}

interface RetrabalhoDetalhesModalProps {
  isOpen: boolean
  onClose: () => void
  projetoCodigo?: string
  cliente?: string
  detalhes: RetrabalhoDetalheProjeto[]
  areasProjeto: RetrabalhoAreaProjeto[]
  motivosProjeto: RetrabalhoMotivo[]
}

type TabKey = 'areas' | 'motivos' | 'detalhes'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'areas', label: 'Por Área' },
  { key: 'motivos', label: 'Motivos' },
  { key: 'detalhes', label: 'Todos os Detalhes' },
]

export default function RetrabalhoDetalhesModal({
  isOpen,
  onClose,
  projetoCodigo,
  cliente,
  detalhes,
  areasProjeto,
  motivosProjeto,
}: RetrabalhoDetalhesModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('areas')
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())

  // Agrupar detalhes por área
  const detalhesPorArea = detalhes.reduce<Record<string, RetrabalhoDetalheProjeto[]>>(
    (acc, item) => {
      const id = item.area_id
      if (!acc[id]) acc[id] = []
      acc[id].push(item)
      return acc
    },
    {}
  )

  const toggleArea = (areaId: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(areaId)) {
        next.delete(areaId)
      } else {
        next.add(areaId)
      }
      return next
    })
  }

  const totalRetrabalhos = areasProjeto.reduce((s, a) => s + a.total_retrabalhos_area, 0)

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        {/* Cabecalho */}
        <div className="malha-prancha flex items-start justify-between gap-4 px-6 py-5 text-white">
          <div className="min-w-0">
            <DialogTitle className="font-wide text-lg font-semibold text-white">
              Retrabalho do Projeto
            </DialogTitle>
            {projetoCodigo ? (
              <DialogDescription className="mt-1.5 text-sm text-white/65">
                Projeto <span className="font-semibold text-white">{projetoCodigo}</span>
                {cliente ? `, ${cliente}` : ''}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Detalhes de retrabalho do projeto</DialogDescription>
            )}
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/50"
            >
              Fechar
            </Button>
          </DialogClose>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(valor) => setActiveTab(valor as TabKey)}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="overflow-x-auto border-b px-4 py-1.5 sm:px-6">
            <TabsList variant="line">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="px-3 after:bg-primary data-active:text-primary">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Aba: Por Área — expansivel */}
          <TabsContent value="areas" className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {areasProjeto.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhum retrabalho registrado por área neste projeto.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="mb-3 text-xs text-muted-foreground">
                  Clique em uma área para ver os registros individuais.
                </p>
                {areasProjeto.map((area) => {
                  const isExpanded = expandedAreas.has(area.area_id)
                  const registros = detalhesPorArea[area.area_id] || []
                  const painelId = `retrabalho-area-${area.area_id}`

                  return (
                    <div key={area.area_id} className="overflow-hidden rounded-lg border">
                      {/* Linha da área (clicável) */}
                      <button
                        type="button"
                        onClick={() => toggleArea(area.area_id)}
                        aria-expanded={isExpanded}
                        aria-controls={painelId}
                        className="flex w-full items-center justify-between gap-3 bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <ChevronRight
                            className={cn(
                              'size-4 shrink-0 text-muted-foreground transition-transform',
                              isExpanded && 'rotate-90'
                            )}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{area.area_codigo}</span>
                          <span className="truncate text-sm font-semibold">{area.area}</span>
                        </div>
                        <span className="inline-flex shrink-0 items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 tabular-nums">
                          {area.total_retrabalhos_area} retrabalho{area.total_retrabalhos_area !== 1 ? 's' : ''}
                        </span>
                      </button>

                      {/* Registros individuais da área */}
                      {isExpanded && (
                        <div id={painelId} className="divide-y bg-card">
                          {registros.length === 0 ? (
                            <p className="px-6 py-3 text-sm text-muted-foreground">Sem registros detalhados.</p>
                          ) : (
                            registros.map((item) => (
                              <div
                                key={item.retrabalho_id}
                                className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4 sm:px-6"
                              >
                                <div className="flex gap-3 sm:contents">
                                  <div className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums sm:w-20">
                                    {formatarDataBR(item.data_retrabalho)}
                                  </div>
                                  <div className="shrink-0 pt-0.5 text-xs font-semibold text-primary sm:w-28">
                                    {item.engenheiro_nome}
                                  </div>
                                </div>
                                <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                                  <EtiquetaTipo tipo={item.tipo_retrabalho} />
                                  {item.motivo_retrabalho || <SemMotivo />}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Totalizador */}
                <div className="flex justify-end pt-2">
                  <span className="text-xs text-muted-foreground">
                    Total:{' '}
                    <span className="font-semibold text-foreground tabular-nums">{totalRetrabalhos}</span>{' '}
                    retrabalhos em {areasProjeto.length} área{areasProjeto.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Aba: Motivos */}
          <TabsContent value="motivos" className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {motivosProjeto.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhum motivo registrado para este projeto.
              </p>
            ) : (
              <MotivosPorTipo data={motivosProjeto} escopo={projetoCodigo || 'Projeto'} height={300} />
            )}
          </TabsContent>

          {/* Aba: Todos os Detalhes */}
          <TabsContent value="detalhes" className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
            {detalhes.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhum retrabalho registrado para este projeto.
              </p>
            ) : (
              <ul className="space-y-3">
                {detalhes.map((item) => (
                  <li key={item.retrabalho_id} className="rounded-lg border bg-muted/40 p-4">
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                          {formatarDataBR(item.data_retrabalho)}
                        </span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                          {item.area_descricao}
                        </span>
                        <EtiquetaTipo tipo={item.tipo_retrabalho} />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Engenheiro: <span className="font-semibold text-foreground">{item.engenheiro_nome}</span>
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">
                      {item.motivo_retrabalho || <SemMotivo />}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
