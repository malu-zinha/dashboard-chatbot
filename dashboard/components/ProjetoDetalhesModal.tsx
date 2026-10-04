'use client'

import React, { useEffect, useCallback, useState } from 'react'
import { X, Calendar, User, Layers, Clock, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react'
import { formatarDataBR } from '@/lib/datas'
import { fetchApontamentosAtribuicao, type ResultadoApontamentos } from '@/lib/supabase'

interface Projeto {
  atribuicao_id?: string
  eng_id?: string | null
  area_id?: string | null
  projeto_id: string
  codigo_projeto: string
  cliente: string
  descricao?: string
  engenheiro_nome: string
  area_codigo?: string
  area_descricao: string
  instancia_label?: string | null
  status_descricao: string
  percentual_andamento: number
  data_inicio?: string
  data_prevista?: string
  data_conclusao?: string | null
  dias_atraso: number
  created_at?: string
  motivo_aguardo?: string
}

interface ProjetoDetalhesModalProps {
  isOpen: boolean
  onClose: () => void
  projeto: Projeto | null
}

export default function ProjetoDetalhesModal({
  isOpen,
  onClose,
  projeto,
}: ProjetoDetalhesModalProps) {
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

  // O resultado carrega o id que o produziu. Sem isso, o intervalo entre trocar de projeto e
  // o efeito rodar mostraria o relato do projeto anterior como se fosse do novo.
  const [apontamentos, setApontamentos] = useState<
    { atribuicaoId: string; resultado: ResultadoApontamentos } | null
  >(null)
  const atribuicaoId = projeto?.atribuicao_id

  useEffect(() => {
    if (!isOpen || !atribuicaoId) return

    let cancelado = false

    fetchApontamentosAtribuicao(atribuicaoId).then((resultado) => {
      if (!cancelado) setApontamentos({ atribuicaoId, resultado })
    })

    return () => {
      cancelado = true
    }
  }, [isOpen, atribuicaoId])

  if (!isOpen || !projeto) return null

  // Efeito roda depois da pintura: ate ele responder, o estado honesto e "carregando", nao
  // "nao ha registro". Afirmar ausencia antes de olhar e o mesmo erro que esta branch corrige.
  const resultado = apontamentos && apontamentos.atribuicaoId === atribuicaoId
    ? apontamentos.resultado
    : null
  const relatosDiarios = resultado?.ok
    ? resultado.registros.filter((a) => a.feito_texto?.trim())
    : []


  const getStatusColor = () => {
    if (projeto.data_conclusao || projeto.percentual_andamento >= 100) {
      return 'bg-success text-white'
    }
    if (projeto.dias_atraso > 0) {
      return 'bg-danger text-white'
    }
    if (projeto.status_descricao?.toLowerCase().includes('aguard')) {
      return 'bg-yellow-400 text-white'
    }
    return 'bg-info text-white'
  }

  const getProgressColor = () => {
    if (projeto.percentual_andamento >= 100) return 'bg-success'
    if (projeto.percentual_andamento >= 75) return 'bg-info'
    if (projeto.percentual_andamento >= 50) return 'bg-warning'
    return 'bg-gray-400'
  }

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-tecpred-primary to-tecpred-secondary px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">
                {projeto.codigo_projeto}
              </h3>
              <p className="text-white/80 text-sm mt-1">
                {projeto.cliente}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {/* Status e Progresso */}
          <div className="flex items-center justify-between gap-4">
            <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${getStatusColor()}`}>
              {projeto.status_descricao}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[200px]">
              <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${getProgressColor()}`}
                  style={{ width: `${Math.min(projeto.percentual_andamento, 100)}%` }}
                />
              </div>
              <span className="text-sm font-bold text-gray-700 w-12 text-right">
                {projeto.percentual_andamento.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Atraso */}
          {projeto.dias_atraso > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-700">
                <span className="font-bold">{projeto.dias_atraso} dia(s)</span> de atraso
              </span>
            </div>
          )}

          {/* Concluido */}
          {projeto.data_conclusao && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-sm text-green-700">
                Concluido em <span className="font-bold">{formatarDataBR(projeto.data_conclusao)}</span>
              </span>
            </div>
          )}

          {/* Informacoes */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Engenheiro</p>
                <p className="text-sm font-medium text-gray-900">{projeto.engenheiro_nome}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Layers className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Area / Disciplina</p>
                <p className="text-sm font-medium text-gray-900">
                  {projeto.area_descricao}
                  {projeto.instancia_label && (
                    <span className="text-gray-500"> ({projeto.instancia_label})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Datas</p>
                <div className="text-sm text-gray-900 space-y-0.5">
                  <p>Inicio: <span className="font-medium">{formatarDataBR(projeto.data_inicio)}</span></p>
                  <p>Prevista: <span className="font-medium">{formatarDataBR(projeto.data_prevista)}</span></p>
                  {projeto.data_conclusao && (
                    <p>Conclusao: <span className="font-medium">{formatarDataBR(projeto.data_conclusao)}</span></p>
                  )}
                </div>
              </div>
            </div>

            {projeto.descricao && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Descricao</p>
                  <p className="text-sm text-gray-700">{projeto.descricao}</p>
                </div>
              </div>
            )}
          </div>

          {/* Observacoes do Engenheiro */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-tecpred-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Observacoes do Engenheiro
                </p>
                {projeto.motivo_aguardo ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {projeto.motivo_aguardo}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    Nenhuma observacao registrada.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Relato diario do chatbot */}
          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-tecpred-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Relato diario no chatbot
                </p>

                {!atribuicaoId ? (
                  <p className="text-sm text-gray-400 italic">
                    Sem atribuicao ativa — nao ha relato diario para consultar.
                  </p>
                ) : resultado === null ? (
                  <p className="text-sm text-gray-400 italic">Carregando...</p>
                ) : !resultado.ok ? (
                  <p className="text-sm text-gray-400 italic">
                    Nao foi possivel carregar o relato diario. Tente reabrir o projeto.
                  </p>
                ) : relatosDiarios.length > 0 ? (
                  <ul className="space-y-2">
                    {relatosDiarios.map((registro) => (
                      <li
                        key={registro.data_registro}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2"
                      >
                        <p className="text-xs font-semibold text-tecpred-primary">
                          {formatarDataBR(registro.data_registro)}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {registro.feito_texto}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  // Ate 04/10/2026 o relato noturno era descartado antes de chegar ao banco:
                  // 203 registros, 1 unico com feito_texto. Ausencia aqui nao diz nada sobre o
                  // trabalho feito, e a tela precisa dizer isso — nao so o comentario.
                  <div>
                    <p className="text-sm text-gray-400 italic">
                      Nenhum registro diario gravado para esta disciplina.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      O relato diario so passou a ser gravado em 04/10/2026. Antes disso ele era
                      perdido na gravacao, entao a ausencia aqui nao indica falta de trabalho.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
