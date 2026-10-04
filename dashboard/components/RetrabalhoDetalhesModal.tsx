'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  RetrabalhoDetalheProjeto,
  RetrabalhoAreaProjeto,
  RetrabalhoMotivo,
} from '@/lib/supabase'
import RetrabalhoPizzaChart from '@/components/RetrabalhoPizzaChart'
import { formatarDataBR } from '@/lib/datas'

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

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
      }
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'areas', label: 'Por Área' },
    { key: 'motivos', label: 'Motivos' },
    { key: 'detalhes', label: 'Todos os Detalhes' },
  ]

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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Retrabalho do Projeto
            </h3>
            {projetoCodigo && (
              <p className="text-xs text-gray-600 mt-1">
                Projeto <span className="font-semibold">{projetoCodigo}</span>
                {cliente ? ` • ${cliente}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-md hover:bg-gray-100"
          >
            Fechar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-tecpred-primary text-tecpred-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">

          {/* Aba: Por Área — expandable */}
          {activeTab === 'areas' && (
            <div>
              {areasProjeto.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  Nenhum retrabalho registrado por área neste projeto.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-3">
                    Clique em uma área para ver os registros individuais.
                  </p>
                  {areasProjeto.map((area) => {
                    const isExpanded = expandedAreas.has(area.area_id)
                    const registros = detalhesPorArea[area.area_id] || []

                    return (
                      <div
                        key={area.area_id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        {/* Linha da área (clicável) */}
                        <button
                          type="button"
                          onClick={() => toggleArea(area.area_id)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            )}
                            <span className="text-xs font-mono text-gray-500">
                              {area.area_codigo}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
                              {area.area}
                            </span>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 flex-shrink-0">
                            {area.total_retrabalhos_area} retrabalho{area.total_retrabalhos_area !== 1 ? 's' : ''}
                          </span>
                        </button>

                        {/* Registros individuais da área */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-100 bg-white">
                            {registros.length === 0 ? (
                              <p className="px-6 py-3 text-sm text-gray-400">
                                Sem registros detalhados.
                              </p>
                            ) : (
                              registros.map((item) => (
                                <div
                                  key={item.retrabalho_id}
                                  className="px-6 py-3 flex gap-4 items-start"
                                >
                                  <div className="flex-shrink-0 text-xs text-gray-500 w-20 pt-0.5">
                                    {formatarDataBR(item.data_retrabalho)}
                                  </div>
                                  <div className="flex-shrink-0 text-xs font-semibold text-tecpred-primary w-28 pt-0.5">
                                    {item.engenheiro_nome}
                                  </div>
                                  <div className="flex-1 text-sm text-gray-700">
                                    {item.motivo_retrabalho || (
                                      <span className="italic text-gray-400">Sem motivo informado</span>
                                    )}
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
                  <div className="pt-2 flex justify-end">
                    <span className="text-xs text-gray-500">
                      Total:{' '}
                      <span className="font-bold text-gray-800">
                        {areasProjeto.reduce((s, a) => s + a.total_retrabalhos_area, 0)}
                      </span>{' '}
                      retrabalhos em {areasProjeto.length} área{areasProjeto.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aba: Motivos */}
          {activeTab === 'motivos' && (
            <div>
              {motivosProjeto.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  Nenhum motivo registrado para este projeto.
                </p>
              ) : (
                <RetrabalhoPizzaChart
                  data={motivosProjeto}
                  title={`Distribuição de motivos — ${projetoCodigo || 'Projeto'}`}
                  height={300}
                />
              )}
            </div>
          )}

          {/* Aba: Todos os Detalhes */}
          {activeTab === 'detalhes' && (
            <div>
              {detalhes.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                  Nenhum retrabalho registrado para este projeto.
                </p>
              ) : (
                <ul className="space-y-3">
                  {detalhes.map((item) => (
                    <li
                      key={item.retrabalho_id}
                      className="p-4 border rounded-lg bg-gray-50"
                    >
                      <div className="flex justify-between items-center mb-1 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-600">
                            {formatarDataBR(item.data_retrabalho)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-tecpred-light text-tecpred-primary font-medium">
                            {item.area_descricao}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Engenheiro:{' '}
                          <span className="font-semibold text-gray-800">
                            {item.engenheiro_nome}
                          </span>
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {item.motivo_retrabalho || (
                          <span className="italic text-gray-400">Sem motivo informado</span>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
