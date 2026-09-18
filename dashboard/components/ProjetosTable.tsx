import React from 'react'
import { X, Search, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Loader2, Trash2, UserRoundCog, Eye, FileDown } from 'lucide-react'
import { buildCompletedDisciplineKey, getProjetoAreaDisplayName } from '@/lib/compatibilizacao'
import { isProjetoConcluido, projetoMatchesStatusFilter, type ProjetoStatusFilter } from '@/lib/projetoFilters'
import { searchScore } from '@/lib/search'
import { verificarAtribuicaoInfo, fetchRelatorioProjetoPdf, type Engenheiro } from '@/lib/supabase'
import { gerarRelatorioPdf } from '@/lib/gerarRelatorioPdf'
import ProjetoDetalhesModal from './ProjetoDetalhesModal'
import ModalShell from './ModalShell'

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

interface ProjetosTableProps {
  isOpen: boolean
  onClose: () => void
  data: Projeto[]
  initialFilter?: 'all' | 'concluido' | 'em_execucao' | 'atrasado'
  title?: string
  color?: 'primary' | 'success' | 'info' | 'danger' | 'warning'
  onVerRetrabalho?: (projeto: Projeto) => void
  engenheiros?: Engenheiro[]
  onTransferirResponsavel?: (projeto: Projeto, novoEngId: string) => Promise<void>
  onExcluirTarefa?: (projeto: Projeto) => Promise<void>
  onExcluirProjeto?: (projeto: Projeto) => Promise<void>
  fullscreen: boolean
  onToggleFullscreen: () => void
}

export default function ProjetosTable({ 
  isOpen, 
  onClose, 
  data, 
  initialFilter = 'all',
  title = 'Listagem de Projetos',
  color = 'primary',
  onVerRetrabalho,
  engenheiros = [],
  onTransferirResponsavel,
  onExcluirTarefa,
  onExcluirProjeto,
  fullscreen,
  onToggleFullscreen,
}: ProjetosTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<ProjetoStatusFilter>(initialFilter)
  const [tooltipOpen, setTooltipOpen] = React.useState<string | null>(null)
  const [expandedConcluidas, setExpandedConcluidas] = React.useState<Set<string>>(new Set())
  const [transferProjeto, setTransferProjeto] = React.useState<Projeto | null>(null)
  const [deleteProjeto, setDeleteProjeto] = React.useState<Projeto | null>(null)
  const [novoResponsavelId, setNovoResponsavelId] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isActionSubmitting, setIsActionSubmitting] = React.useState(false)
  const [isCheckingInfo, setIsCheckingInfo] = React.useState(false)
  const [isUltimaDisciplina, setIsUltimaDisciplina] = React.useState(false)
  const [detalheProjeto, setDetalheProjeto] = React.useState<Projeto | null>(null)
  const [gerandoPdfProjetoId, setGerandoPdfProjetoId] = React.useState<string | null>(null)
  
  // Atualiza o filtro e limpa busca quando o modal abre com um filtro inicial
  React.useEffect(() => {
    if (isOpen) {
      if (initialFilter) {
        setFilterStatus(initialFilter)
      }
      // Limpa busca quando abre o modal
      setSearchTerm('')
      setExpandedConcluidas(new Set())
    }
  }, [isOpen, initialFilter])

  // Mapa de cores para o header
  const colorClasses = {
    primary: 'from-tecpred-primary to-tecpred-secondary',
    success: 'from-success to-green-600',
    info: 'from-info to-blue-600',
    danger: 'from-danger to-red-600',
    warning: 'from-tecpred-orange to-tecpred-coral',
  }

  const isStatusAguardando = (status?: string) =>
    (status || '').toLowerCase().includes('aguard')

  const getMotivoAguardo = (item: Projeto) =>
    item.motivo_aguardo?.trim() ||
    item.descricao?.trim() ||
    'Sem motivo de aguardo registrado.'

  const getMotivoAtraso = (item: Projeto) =>
    item.motivo_aguardo?.trim() ||
    `Projeto atrasado há ${item.dias_atraso} dia(s). Nenhuma observação registrada.`

  const isDisciplinaConcluida = isProjetoConcluido

  const disciplinasConcluidasPorProjeto = React.useMemo(() => {
    const grupos = new Map<string, Projeto[]>()
    const chavesPorProjeto = new Map<string, Set<string>>()

    for (const item of data) {
      if (!isDisciplinaConcluida(item)) continue

      const chave = buildCompletedDisciplineKey(item)
      if (!chavesPorProjeto.has(item.projeto_id)) chavesPorProjeto.set(item.projeto_id, new Set())
      const chaves = chavesPorProjeto.get(item.projeto_id)!
      if (chaves.has(chave)) continue

      chaves.add(chave)
      if (!grupos.has(item.projeto_id)) grupos.set(item.projeto_id, [])
      grupos.get(item.projeto_id)!.push(item)
    }

    return grupos
  }, [data])

  const showConcluidas = filterStatus === 'em_execucao'
  const showAcoes = true
  const totalColunas = 8 + (showConcluidas ? 1 : 0) + (onVerRetrabalho ? 1 : 0) + (showAcoes ? 1 : 0)

  const toggleConcluidas = (projetoId: string) => {
    setExpandedConcluidas((prev) => {
      const next = new Set(prev)
      if (next.has(projetoId)) {
        next.delete(projetoId)
      } else {
        next.add(projetoId)
      }
      return next
    })
  }

  const filteredData = data
    .map(item => {
      // Filtro mais preciso baseado no estado real do projeto
      let matchesFilter = false

      if (filterStatus === 'all') {
        matchesFilter = true
      } else if (filterStatus === 'concluido') {
        // Projeto concluído: tem data_conclusao OU percentual = 100%
        matchesFilter = (item.data_conclusao !== null && item.data_conclusao !== undefined) ||
                        item.percentual_andamento >= 100
      } else if (filterStatus === 'em_execucao') {
        // Em execução: não concluído, incluindo projetos atrasados.
        matchesFilter = projetoMatchesStatusFilter(item, filterStatus)
      } else if (filterStatus === 'atrasado') {
        // Atrasado: tem dias de atraso
        matchesFilter = item.dias_atraso > 0
      }

      // Na aba em_execucao, incluir engenheiros das disciplinas concluidas do mesmo projeto na busca
      const engenheirosExtras = filterStatus === 'em_execucao'
        ? (disciplinasConcluidasPorProjeto.get(item.projeto_id) || [])
            .map(d => d.engenheiro_nome)
        : []

      // Pontuação de relevância da busca (0 = não casa). Só pontua se passou no filtro.
      const score = matchesFilter
        ? searchScore(searchTerm, [
            item.codigo_projeto,
            item.cliente,
            item.engenheiro_nome,
            ...engenheirosExtras,
            item.area_descricao,
            getProjetoAreaDisplayName(item),
          ])
        : 0

      return { item, score }
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score) // mais relevantes primeiro (empate mantém ordem)
    .map(entry => entry.item)

  const engenheirosDestino = engenheiros.filter((eng) =>
    eng.ativo !== false && eng.eng_id !== transferProjeto?.eng_id
  )

  const abrirTransferencia = (item: Projeto) => {
    setDeleteProjeto(null)
    setTransferProjeto(item)
    setNovoResponsavelId('')
    setActionError(null)
  }

  const abrirExclusao = async (item: Projeto) => {
    setTransferProjeto(null)
    setDeleteProjeto(item)
    setActionError(null)
    setIsUltimaDisciplina(false)

    if (!item.atribuicao_id) return

    setIsCheckingInfo(true)
    try {
      const result = await verificarAtribuicaoInfo(item.atribuicao_id)
      if (result.success && result.data?.is_ultima_disciplina) {
        setIsUltimaDisciplina(true)
      }
    } catch {
      // Ignore errors - just show normal delete modal
    } finally {
      setIsCheckingInfo(false)
    }
  }

  const fecharAcao = () => {
    if (isActionSubmitting || isCheckingInfo) return
    setTransferProjeto(null)
    setDeleteProjeto(null)
    setNovoResponsavelId('')
    setActionError(null)
    setIsUltimaDisciplina(false)
  }

  const confirmarTransferencia = async () => {
    if (!transferProjeto || !onTransferirResponsavel) return
    if (!novoResponsavelId) {
      setActionError('Selecione o novo responsavel.')
      return
    }

    setIsActionSubmitting(true)
    setActionError(null)
    try {
      await onTransferirResponsavel(transferProjeto, novoResponsavelId)
      setTransferProjeto(null)
      setNovoResponsavelId('')
    } catch (error: any) {
      setActionError(error?.message || 'Nao foi possivel alterar o responsavel.')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const confirmarExclusao = async () => {
    if (!deleteProjeto) return

    setIsActionSubmitting(true)
    setActionError(null)
    try {
      if (isUltimaDisciplina && onExcluirProjeto) {
        await onExcluirProjeto(deleteProjeto)
      } else if (onExcluirTarefa) {
        await onExcluirTarefa(deleteProjeto)
      }
      setDeleteProjeto(null)
      setIsUltimaDisciplina(false)
    } catch (error: any) {
      setActionError(error?.message || 'Nao foi possivel excluir.')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const handleGerarPdf = async (item: Projeto) => {
    if (gerandoPdfProjetoId) return

    setGerandoPdfProjetoId(item.projeto_id)
    try {
      const result = await fetchRelatorioProjetoPdf(item.projeto_id)
      if (!result.success || !result.data) {
        console.error('Erro ao buscar dados do relatorio:', result.error)
        return
      }
      gerarRelatorioPdf(result.data)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
    } finally {
      setGerandoPdfProjetoId(null)
    }
  }

  if (!isOpen) return null

  return (
    <>
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
      title={title}
      subtitle={`${filteredData.length} projeto(s) encontrado(s)`}
      headerGradientClass={colorClasses[color]}
      // Com uma confirmacao aberta por cima, o Escape nao pode fechar a tabela por baixo
      closeOnEscape={!transferProjeto && !deleteProjeto && !detalheProjeto}
    >
        {/* Busca */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por código, cliente, engenheiro ou área..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-1 overflow-auto">
          <table className="min-w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Engenheiro
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Área
                </th>
                {showConcluidas && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Concluidas
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Progresso
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Prazo
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Atraso
                </th>
                {onVerRetrabalho && (
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Retrabalho
                  </th>
                )}
                {showAcoes && (
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={totalColunas} className="px-6 py-12 text-center text-gray-500">
                    Nenhum projeto encontrado
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => {
                  const areaDisplayName = getProjetoAreaDisplayName(item)
                  const rowKey = item.atribuicao_id || `${item.projeto_id}-${areaDisplayName}-${item.engenheiro_nome}-${index}`
                  const concluidas = disciplinasConcluidasPorProjeto.get(item.projeto_id) || []
                  const isExpanded = expandedConcluidas.has(item.projeto_id)

                  return (
                  <React.Fragment key={rowKey}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-tecpred-primary">
                        {item.codigo_projeto}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {item.cliente}
                      </div>
                      {item.descricao && (
                        <div className="text-xs text-gray-500 mt-1">
                          {item.descricao.length > 50 ? item.descricao.substring(0, 50) + '...' : item.descricao}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.engenheiro_nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-tecpred-light text-tecpred-primary rounded-full">
                        {areaDisplayName}
                      </span>
                    </td>
                    {showConcluidas && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleConcluidas(item.projeto_id)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            concluidas.length > 0
                              ? 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'
                              : 'text-gray-500 bg-gray-50 border-gray-200'
                          }`}
                          title={`Ver disciplinas concluidas de ${item.codigo_projeto}`}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          {concluidas.length > 0 ? `${concluidas.length} concluida(s)` : 'Nenhuma'}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isStatusAguardando(item.status_descricao) ? (
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => setTooltipOpen(rowKey)}
                          onMouseLeave={() => setTooltipOpen(null)}
                        >
                          <span className="px-2 py-1 text-xs font-medium rounded-full cursor-help bg-yellow-400 text-white">
                            {item.status_descricao}
                          </span>
                          {tooltipOpen === rowKey && (
                            <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-lg border border-yellow-200 bg-white p-3 text-xs text-gray-700 shadow-xl">
                              <div className="mb-1 font-semibold text-yellow-700">Motivo do aguardo</div>
                              <div className="whitespace-normal leading-relaxed">
                                {getMotivoAguardo(item)}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : item.dias_atraso > 0 ? (
                        <div
                          className="relative inline-block"
                          onMouseEnter={() => setTooltipOpen(rowKey)}
                          onMouseLeave={() => setTooltipOpen(null)}
                        >
                          <span className="px-2 py-1 text-xs font-medium rounded-full cursor-help bg-danger text-white">
                            {item.status_descricao}
                          </span>
                          {tooltipOpen === rowKey && (
                            <div className="absolute left-0 top-full mt-2 z-50 w-72 rounded-lg border border-red-200 bg-white p-3 text-xs text-gray-700 shadow-xl">
                              <div className="mb-1 font-semibold text-red-700">Motivo do atraso</div>
                              <div className="whitespace-normal leading-relaxed">
                                {getMotivoAtraso(item)}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.data_conclusao
                            ? 'bg-success text-white'
                            : 'bg-info text-white'
                        }`}>
                          {item.status_descricao}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              item.percentual_andamento >= 100 ? 'bg-success' :
                              item.percentual_andamento >= 75 ? 'bg-info' :
                              item.percentual_andamento >= 50 ? 'bg-warning' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(item.percentual_andamento, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900 w-12 text-right">
                          {item.percentual_andamento.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">
                        {item.data_prevista 
                          ? new Date(item.data_prevista).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {item.dias_atraso > 0 ? (
                        <span className="px-2 py-1 text-xs font-bold bg-danger text-white rounded-full">
                          {item.dias_atraso} dias
                        </span>
                      ) : (
                        <span className="text-sm text-success">No prazo</span>
                      )}
                    </td>
                    {onVerRetrabalho && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => onVerRetrabalho(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                          title={`Ver retrabalhos de ${item.codigo_projeto}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Ver
                        </button>
                      </td>
                    )}
                    {showAcoes && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetalheProjeto(item)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700 transition-colors hover:bg-gray-100"
                            title="Ver detalhes"
                            aria-label="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isDisciplinaConcluida(item) && (
                            <button
                              type="button"
                              onClick={() => handleGerarPdf(item)}
                              disabled={gerandoPdfProjetoId === item.projeto_id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                              title="Gerar PDF do projeto"
                              aria-label="Gerar PDF do projeto"
                            >
                              {gerandoPdfProjetoId === item.projeto_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {onTransferirResponsavel && (
                            <button
                              type="button"
                              onClick={() => abrirTransferencia(item)}
                              disabled={!item.atribuicao_id || !item.eng_id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                              title="Alterar responsavel"
                              aria-label="Alterar responsavel"
                            >
                              <UserRoundCog className="h-4 w-4" />
                            </button>
                          )}
                          {onExcluirTarefa && (
                            <button
                              type="button"
                              onClick={() => abrirExclusao(item)}
                              disabled={!item.atribuicao_id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                              title="Excluir tarefa"
                              aria-label="Excluir tarefa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                  {showConcluidas && isExpanded && (
                    <tr className="bg-green-50/40">
                      <td colSpan={totalColunas} className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                          <span className="font-semibold text-gray-900">Disciplinas concluidas:</span>
                          {concluidas.length > 0 ? (
                            concluidas.map((disciplina) => (
                              <span
                                key={`${getProjetoAreaDisplayName(disciplina)}-${disciplina.engenheiro_nome}`}
                                className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-medium text-green-700"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                {getProjetoAreaDisplayName(disciplina)} - {disciplina.engenheiro_nome}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">Nenhuma concluida.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className={`p-4 border-t border-gray-200 bg-gray-50 ${
            fullscreen ? '' : 'rounded-b-xl'
          }`}
        >
          <div className="text-sm text-gray-600 text-center">
            Mostrando {filteredData.length} de {data.length} projetos
          </div>
        </div>
    </ModalShell>

      {transferProjeto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={(e) => {
            e.stopPropagation()
            fecharAcao()
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Alterar responsavel</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {transferProjeto.codigo_projeto} - {getProjetoAreaDisplayName(transferProjeto)}
                </p>
              </div>
              <button
                type="button"
                onClick={fecharAcao}
                disabled={isActionSubmitting}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Responsavel atual</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {transferProjeto.engenheiro_nome}
                </div>
              </div>

              <div>
                <label htmlFor="novo-responsavel" className="mb-1 block text-sm font-medium text-gray-700">Novo responsavel</label>
                <select
                  id="novo-responsavel"
                  value={novoResponsavelId}
                  onChange={(e) => setNovoResponsavelId(e.target.value)}
                  disabled={isActionSubmitting}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-tecpred-primary disabled:bg-gray-50"
                >
                  <option value="">Selecione um engenheiro</option>
                  {engenheirosDestino.map((eng) => (
                    <option key={eng.eng_id} value={eng.eng_id}>
                      {eng.nome}
                    </option>
                  ))}
                </select>
              </div>

              {actionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {actionError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={fecharAcao}
                  disabled={isActionSubmitting}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarTransferencia}
                  disabled={isActionSubmitting || !novoResponsavelId}
                  className="inline-flex items-center gap-2 rounded-lg bg-tecpred-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-tecpred-secondary disabled:cursor-not-allowed disabled:bg-gray-300"
                >
                  {isActionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteProjeto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={(e) => {
            e.stopPropagation()
            fecharAcao()
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {isCheckingInfo ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-red-50 p-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {isUltimaDisciplina ? 'Excluir projeto' : 'Excluir tarefa'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {deleteProjeto.codigo_projeto} - {getProjetoAreaDisplayName(deleteProjeto)} - {deleteProjeto.engenheiro_nome}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-gray-700">
                  {isUltimaDisciplina
                    ? 'Este projeto possui apenas esta disciplina. Ao excluir, o projeto inteiro sera desativado e deixara de aparecer no dashboard e no chatbot.'
                    : 'Esta tarefa deixara de aparecer no dashboard e no chatbot, mas permanecera no historico do banco.'}
                </p>

                {isUltimaDisciplina && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    O projeto sera marcado como inativo e podera ser reativado futuramente ao cadastrar um novo projeto com o mesmo codigo.
                  </div>
                )}

                {actionError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {actionError}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={fecharAcao}
                    disabled={isActionSubmitting}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarExclusao}
                    disabled={isActionSubmitting || (!onExcluirTarefa && !isUltimaDisciplina) || (isUltimaDisciplina && !onExcluirProjeto)}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {isActionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isUltimaDisciplina ? 'Excluir projeto' : 'Excluir'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ProjetoDetalhesModal
        isOpen={detalheProjeto !== null}
        onClose={() => setDetalheProjeto(null)}
        projeto={detalheProjeto}
      />
    </>
  )
}

