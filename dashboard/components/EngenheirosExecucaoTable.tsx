import React, { useMemo, useEffect } from 'react'
import { AlertTriangle, Search, User } from 'lucide-react'
import {
  buildEngenheirosExecucao,
  type EngenheiroExecucaoGroup,
  type EngenheiroExecucaoProjeto,
} from '@/lib/engenheirosExecucao'
import { searchScore } from '@/lib/search'
import ModalShell from '@/components/ModalShell'

interface EngenheirosExecucaoTableProps {
  isOpen: boolean
  onClose: () => void
  projetos: EngenheiroExecucaoProjeto[]
  fullscreen: boolean
  onToggleFullscreen: () => void
}

function formatPrazo(dataPrevista?: string) {
  if (!dataPrevista) return '-'
  return new Date(dataPrevista).toLocaleDateString('pt-BR')
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
  isOpen,
  onClose,
  projetos,
  fullscreen,
  onToggleFullscreen,
}: EngenheirosExecucaoTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')

  useEffect(() => {
    if (isOpen) setSearchTerm('')
  }, [isOpen])

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

  // Os dois modos sao o mesmo kanban: uma linha de colunas com rolagem horizontal. Em tela
  // cheia as colunas ficam mais estreitas, entao cabem ~6 engenheiros em vez de 4.
  const layout = fullscreen
    ? { board: 'gap-3', column: 'w-56' }
    : { board: 'gap-4', column: 'w-80' }

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
      title="Engenheiros em Execução"
      subtitle={`${filteredGroups.length} engenheiro(s), ${totalTarefas} tarefa(s) em execução`}
      headerGradientClass="from-tecpred-primary to-tecpred-secondary"
    >
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por engenheiro, código, cliente ou disciplina..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        {filteredGroups.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-gray-500">
            Nenhum engenheiro com projetos em execução
          </div>
        ) : (
          <div className={`flex min-w-max ${layout.board}`}>
            {filteredGroups.map((grupo) => (
              <section
                key={grupo.eng_id}
                className={`flex flex-shrink-0 flex-col rounded-lg border border-gray-200 bg-white ${layout.column}`}
              >
                <div className="border-b border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-tecpred-primary text-white">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900">{grupo.engenheiro_nome}</h3>
                      <p className="text-xs text-gray-500">
                        {grupo.total_tarefas} tarefa(s)
                        {grupo.total_atrasadas > 0 ? `, ${grupo.total_atrasadas} atrasada(s)` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  {grupo.tarefas.map((tarefa) => (
                    <article
                      key={tarefa.atribuicao_id || `${tarefa.projeto_id}-${tarefa.area_display_name}`}
                      className={`rounded-lg border p-3 text-sm shadow-sm ${
                        tarefa.dias_atraso > 0
                          ? 'border-red-200 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-tecpred-primary">{tarefa.codigo_projeto}</div>
                          <div className="line-clamp-2 text-gray-900">{tarefa.cliente}</div>
                        </div>
                        {tarefa.dias_atraso > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2 py-1 text-xs font-bold text-white">
                            <AlertTriangle className="h-3 w-3" />
                            {tarefa.dias_atraso}d
                          </span>
                        )}
                      </div>

                      <div className="mb-3 inline-flex rounded-full bg-tecpred-light px-2 py-1 text-xs font-medium text-tecpred-primary">
                        {tarefa.area_display_name}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-200">
                          <div
                            className={`h-2 rounded-full ${
                              tarefa.percentual_andamento >= 75 ? 'bg-info' :
                              tarefa.percentual_andamento >= 50 ? 'bg-warning' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(tarefa.percentual_andamento, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-semibold text-gray-700">
                          {tarefa.percentual_andamento.toFixed(0)}%
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-gray-500">
                        Prazo: {formatPrazo(tarefa.data_prevista)}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <div
        className={`p-4 border-t border-gray-200 bg-gray-50 ${
          fullscreen ? '' : 'rounded-b-xl'
        }`}
      >
        <div className="text-sm text-gray-600 text-center">
          Mostrando {filteredGroups.length} de {grupos.length} engenheiros
        </div>
      </div>
    </ModalShell>
  )
}
