'use client'

import React from 'react'
import { X, Search, SearchX, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Loader2, Trash2, UserRoundCog, Eye, FileDown, CalendarClock, PencilLine, Building2 } from 'lucide-react'
import { buildCompletedDisciplineKey, getProjetoAreaDisplayName } from '@/lib/compatibilizacao'
import { formatarDataBR, toDataISO } from '@/lib/datas'
import { avisoValeParaPrazo, estadoAvisoPrazo, type AvisoPrazoLinha } from '@/lib/avisoPrazo'
import {
  isProjetoConcluido,
  particionarPorPeriodoConclusao,
  periodoConclusaoAtivo,
  projetoConcluidoNoPeriodo,
  projetoMatchesStatusFilter,
  type PeriodoConclusao,
  type ProjetoStatusFilter,
} from '@/lib/projetoFilters'
import { searchMatches, searchScore } from '@/lib/search'
import { verificarAtribuicaoInfo, fetchRelatorioProjetoPdf, type Engenheiro } from '@/lib/supabase'
import { gerarRelatorioPdf } from '@/lib/gerarRelatorioPdf'
import ProjetoDetalhesModal from './ProjetoDetalhesModal'
import ModalShell from './ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

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
  // Devolve a mensagem extra de sucesso (prazo do cliente ajustado) ou null; lanca Error na falha.
  onAlterarPrazo?: (projeto: Projeto, novoPrazo: string) => Promise<string | null>
  // Ultimo aviso de prazo por atribuicao_id (so o dono recebe).
  avisosPrazo?: Record<string, AvisoPrazoLinha>
  // Cliente e descricao valem para o projeto inteiro; lanca Error na falha.
  onAlterarDadosProjeto?: (projeto: Projeto, dados: { cliente: string; descricao: string | null }) => Promise<void>
  fullscreen: boolean
  onToggleFullscreen: () => void
  // Renderiza a listagem dentro de um card na pagina, sem modal: isOpen/onClose sao ignorados.
  embutido?: boolean
}

// Estilo comum de campos nativos (select, textarea) alinhado ao Input do shadcn.
const classeCampo =
  'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'

const classeBadge =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset'

const classeErro = 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'

// Acao da linha: so o icone; o nome vai no tooltip e no aria-label.
function BotaoAcao({
  rotulo,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & { rotulo: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={rotulo}
          className={cn('text-muted-foreground hover:text-foreground', className)}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{rotulo}</TooltipContent>
    </Tooltip>
  )
}

// X dos dialogos: fica por ultimo no DOM para o foco inicial cair no conteudo.
function BotaoFecharDialogo({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      disabled={disabled}
      aria-label="Fechar"
      className="absolute top-3 right-3 text-muted-foreground"
    >
      <X />
    </Button>
  )
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
  onAlterarPrazo,
  avisosPrazo,
  onAlterarDadosProjeto,
  fullscreen,
  onToggleFullscreen,
  embutido = false,
}: ProjetosTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [filterStatus, setFilterStatus] = React.useState<ProjetoStatusFilter>(initialFilter)
  const [tooltipOpen, setTooltipOpen] = React.useState<string | null>(null)
  const [expandedConcluidas, setExpandedConcluidas] = React.useState<Set<string>>(new Set())
  const [transferProjeto, setTransferProjeto] = React.useState<Projeto | null>(null)
  const [deleteProjeto, setDeleteProjeto] = React.useState<Projeto | null>(null)
  const [prazoProjeto, setPrazoProjeto] = React.useState<Projeto | null>(null)
  const [novoPrazo, setNovoPrazo] = React.useState('')
  // Botao "Alterar dados": menu com as opcoes e a janela de cliente/descricao.
  const [menuProjeto, setMenuProjeto] = React.useState<Projeto | null>(null)
  const [dadosProjeto, setDadosProjeto] = React.useState<Projeto | null>(null)
  const [novoCliente, setNovoCliente] = React.useState('')
  const [novaDescricao, setNovaDescricao] = React.useState('')
  const [avisoSucesso, setAvisoSucesso] = React.useState<string | null>(null)
  const [novoResponsavelId, setNovoResponsavelId] = React.useState('')
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isActionSubmitting, setIsActionSubmitting] = React.useState(false)
  const [isCheckingInfo, setIsCheckingInfo] = React.useState(false)
  const [isUltimaDisciplina, setIsUltimaDisciplina] = React.useState(false)
  const [detalheProjeto, setDetalheProjeto] = React.useState<Projeto | null>(null)
  const [gerandoPdfProjetoId, setGerandoPdfProjetoId] = React.useState<string | null>(null)
  const [dataConclusaoInicio, setDataConclusaoInicio] = React.useState('')
  const [dataConclusaoFim, setDataConclusaoFim] = React.useState('')

  // Atualiza o filtro e limpa busca quando o modal abre com um filtro inicial.
  // Embutido nao tem "abrir": o reset roda na montagem e a cada troca de initialFilter.
  React.useEffect(() => {
    if (isOpen || embutido) {
      if (initialFilter) {
        setFilterStatus(initialFilter)
      }
      // Limpa busca quando abre o modal
      setSearchTerm('')
      setExpandedConcluidas(new Set())
      setDataConclusaoInicio('')
      setDataConclusaoFim('')
      setAvisoSucesso(null)
    }
  }, [isOpen, initialFilter, embutido])

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
  const showFiltroPeriodo = filterStatus === 'concluido'
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

  // O periodo so vale na aba de concluidos. Com as datas invertidas nao filtramos nada:
  // o aviso abaixo dos inputs explica, em vez de esvaziar a tabela sem motivo aparente.
  const periodoInvalido = Boolean(
    dataConclusaoInicio && dataConclusaoFim && dataConclusaoInicio > dataConclusaoFim
  )

  const periodoConclusao: PeriodoConclusao = showFiltroPeriodo && !periodoInvalido
    ? { dataInicio: dataConclusaoInicio || undefined, dataFim: dataConclusaoFim || undefined }
    : {}

  // Lista unica de campos buscaveis. A tabela e o aviso de ocultados precisam concordar:
  // com duas listas, um campo novo entraria so numa e o aviso passaria a divergir da tabela.
  // engenheirosExtras entra so na aba em_execucao, que nao usa o aviso.
  const camposBusca = (item: Projeto, engenheirosExtras: string[] = []) => [
    item.codigo_projeto,
    item.cliente,
    item.engenheiro_nome,
    ...engenheirosExtras,
    item.area_descricao,
    getProjetoAreaDisplayName(item),
  ]

  const buscaCasa = (item: Projeto) => searchMatches(searchTerm, camposBusca(item))

  // Concluidos sem data_conclusao nao cabem num recorte por data. Em vez de deixa-los
  // sumir calados, a tela lista quem ficou de fora.
  const ocultadosSemData = React.useMemo(() => {
    if (!periodoConclusaoAtivo(periodoConclusao)) return [] as Projeto[]

    const concluidos = data.filter(isProjetoConcluido)
    return particionarPorPeriodoConclusao(concluidos, periodoConclusao)
      .ocultadosSemData
      .filter(buscaCasa)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, periodoConclusao.dataInicio, periodoConclusao.dataFim, searchTerm])

  const filteredData = data
    .map(item => {
      // Filtro mais preciso baseado no estado real do projeto
      let matchesFilter = false

      if (filterStatus === 'all') {
        matchesFilter = true
      } else if (filterStatus === 'concluido') {
        // Projeto concluído: tem data_conclusao OU percentual = 100%
        matchesFilter = isProjetoConcluido(item) &&
                        projetoConcluidoNoPeriodo(item, periodoConclusao)
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
        ? searchScore(searchTerm, camposBusca(item, engenheirosExtras))
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
    setMenuProjeto(null)
    setDeleteProjeto(null)
    setPrazoProjeto(null)
    setTransferProjeto(item)
    setNovoResponsavelId('')
    setActionError(null)
  }

  const abrirAlterarPrazo = (item: Projeto) => {
    setMenuProjeto(null)
    setTransferProjeto(null)
    setDeleteProjeto(null)
    setPrazoProjeto(item)
    setNovoPrazo(toDataISO(item.data_prevista) ?? '')
    setAvisoSucesso(null)
    setActionError(null)
  }

  const abrirMenuAlterarDados = (item: Projeto) => {
    setTransferProjeto(null)
    setDeleteProjeto(null)
    setPrazoProjeto(null)
    setDadosProjeto(null)
    setActionError(null)
    setMenuProjeto(item)
  }

  const abrirAlterarDadosProjeto = (item: Projeto) => {
    setMenuProjeto(null)
    setDadosProjeto(item)
    setNovoCliente(item.cliente ?? '')
    setNovaDescricao(item.descricao ?? '')
    setActionError(null)
  }

  // Motivo de cada opcao do menu estar desligada (null = disponivel).
  const motivoSemPrazo = (item: Projeto) =>
    !onAlterarPrazo ? 'sem permissão' :
    !item.atribuicao_id ? 'projeto sem tarefa' :
    item.percentual_andamento >= 100 ? 'tarefa concluída' : null
  const motivoSemEngenheiro = (item: Projeto) =>
    !onTransferirResponsavel ? 'sem permissão' :
    !item.atribuicao_id ? 'projeto sem tarefa' :
    !item.eng_id ? 'tarefa sem engenheiro' : null

  const abrirExclusao = async (item: Projeto) => {
    setMenuProjeto(null)
    setDadosProjeto(null)
    setTransferProjeto(null)
    setPrazoProjeto(null)
    setDeleteProjeto(item)
    setActionError(null)
    // Projeto sem nenhuma tarefa ativa: nao ha tarefa para excluir, a lixeira
    // exclui (desativa) o projeto direto.
    setIsUltimaDisciplina(!item.atribuicao_id)

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

  const fecharAcao = React.useCallback(() => {
    if (isActionSubmitting || isCheckingInfo) return
    setTransferProjeto(null)
    setDeleteProjeto(null)
    setPrazoProjeto(null)
    setMenuProjeto(null)
    setDadosProjeto(null)
    setNovoResponsavelId('')
    setNovoPrazo('')
    setNovoCliente('')
    setNovaDescricao('')
    setActionError(null)
    setIsUltimaDisciplina(false)
  }, [isActionSubmitting, isCheckingInfo])

  const algumaAcaoAberta = Boolean(transferProjeto || deleteProjeto || prazoProjeto || menuProjeto || dadosProjeto)

  // Escape e clique no fundo: os dialogos sao radix, que so entrega o Escape ao dialogo
  // do topo e chama onOpenChange(false) -> fecharAcao. fecharAcao ignora a chamada durante
  // uma requisicao em voo, e como o open e controlado, o dialogo continua aberto.
  // O ModalShell ainda recebe closeOnEscape desligado enquanto algo esta por cima.
  const aoMudarDialogo = (aberto: boolean) => {
    if (!aberto) fecharAcao()
  }

  const clienteNormalizado = novoCliente.trim()
  const descricaoNormalizada = novaDescricao.trim()
  const dadosMudaram = Boolean(
    dadosProjeto &&
      (clienteNormalizado !== (dadosProjeto.cliente ?? '').trim() ||
        descricaoNormalizada !== (dadosProjeto.descricao ?? '').trim())
  )

  const confirmarAlterarDadosProjeto = async () => {
    if (!dadosProjeto || !onAlterarDadosProjeto) return
    if (clienteNormalizado.length < 2) {
      setActionError('O cliente deve ter pelo menos 2 caracteres.')
      return
    }
    if (descricaoNormalizada && descricaoNormalizada.length < 3) {
      setActionError('A descrição deve ter pelo menos 3 caracteres.')
      return
    }

    setIsActionSubmitting(true)
    setActionError(null)
    try {
      await onAlterarDadosProjeto(dadosProjeto, {
        cliente: clienteNormalizado,
        descricao: descricaoNormalizada || null,
      })
      setDadosProjeto(null)
      setNovoCliente('')
      setNovaDescricao('')
    } catch (error: any) {
      setActionError(error?.message || 'Não foi possível alterar os dados do projeto.')
    } finally {
      setIsActionSubmitting(false)
    }
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

  const prazoAtualISO = toDataISO(prazoProjeto?.data_prevista)

  const confirmarAlterarPrazo = async () => {
    if (!prazoProjeto || !onAlterarPrazo) return
    if (!novoPrazo) {
      setActionError('Informe o novo prazo.')
      return
    }

    setIsActionSubmitting(true)
    setActionError(null)
    try {
      const mensagemExtra = await onAlterarPrazo(prazoProjeto, novoPrazo)
      setPrazoProjeto(null)
      setNovoPrazo('')
      if (mensagemExtra) setAvisoSucesso(mensagemExtra)
    } catch (error: any) {
      setActionError(error?.message || 'Não foi possível alterar o prazo.')
    } finally {
      setIsActionSubmitting(false)
    }
  }

  const renderIconeAviso = (item: Projeto) => {
    const aviso = item.atribuicao_id ? avisosPrazo?.[item.atribuicao_id] : undefined
    // Prazo mudou por outro caminho depois do aviso: o icone nao vale mais.
    if (!aviso || !avisoValeParaPrazo(aviso, item.data_prevista)) return null

    const { icone, texto } = estadoAvisoPrazo(aviso, Date.now())
    return (
      <span title={texto} aria-label={texto} role="img" className="inline-flex">
        {icone === 'enviando' && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-hidden="true" />}
        {icone === 'entregue' && <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />}
        {icone === 'enviado' && <CheckCircle className="h-4 w-4 text-gray-400" aria-hidden="true" />}
        {icone === 'falhou' && <AlertTriangle className="h-4 w-4 text-orange-500" aria-hidden="true" />}
      </span>
    )
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

  if (!isOpen && !embutido) return null

  const subtitulo = `${filteredData.length} projeto(s) encontrado(s)`

  const conteudo = (
    <>
        {/* Busca */}
        <div className="shrink-0 space-y-3 border-b bg-muted/40 p-3 sm:p-4">
          {avisoSucesso && (
            <div
              role="status"
              className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            >
              <span className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {avisoSucesso}
              </span>
              <button
                type="button"
                onClick={() => setAvisoSucesso(null)}
                className="rounded-sm p-0.5 text-emerald-700 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Fechar aviso"
                aria-label="Fechar aviso"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              aria-label="Buscar projetos"
              placeholder="Buscar por código, cliente, engenheiro ou área..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 bg-card pl-9"
            />
          </div>

          {showFiltroPeriodo && (
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="concluidos-inicio" className="text-xs font-medium text-muted-foreground">
                    Concluido de
                  </Label>
                  <Input
                    id="concluidos-inicio"
                    type="date"
                    value={dataConclusaoInicio}
                    onChange={(e) => setDataConclusaoInicio(e.target.value)}
                    className="h-9 w-auto bg-card tabular-nums"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="concluidos-fim" className="text-xs font-medium text-muted-foreground">
                    Concluido ate
                  </Label>
                  <Input
                    id="concluidos-fim"
                    type="date"
                    value={dataConclusaoFim}
                    onChange={(e) => setDataConclusaoFim(e.target.value)}
                    className="h-9 w-auto bg-card tabular-nums"
                  />
                </div>
                {(dataConclusaoInicio || dataConclusaoFim) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      setDataConclusaoInicio('')
                      setDataConclusaoFim('')
                    }}
                  >
                    Limpar período
                  </Button>
                )}
              </div>

              {periodoInvalido && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  A data inicial deve ser anterior ou igual a data final. O período não foi aplicado.
                </p>
              )}

              {ocultadosSemData.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {ocultadosSemData.length <= 5 ? (
                    <p>
                      <span className="font-semibold">
                        {ocultadosSemData.length} disciplina(s) concluída(s) sem data de conclusão
                      </span>{' '}
                      {ocultadosSemData.length === 1 ? 'foi ocultada' : 'foram ocultadas'} pelo período:{' '}
                      {ocultadosSemData.map((item, i) => (
                        <span key={item.atribuicao_id || `${item.projeto_id}-${i}`}>
                          {i > 0 && ', '}
                          <span className="font-semibold">{item.codigo_projeto}</span>
                          {' '}({item.engenheiro_nome} — {getProjetoAreaDisplayName(item)})
                        </span>
                      ))}
                    </p>
                  ) : (
                    <details>
                      <summary className="cursor-pointer rounded-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {ocultadosSemData.length} disciplinas concluídas sem data de conclusão foram
                        ocultadas pelo período (ver quais)
                      </summary>
                      <ul className="mt-2 ml-4 list-disc space-y-0.5">
                        {ocultadosSemData.map((item, i) => (
                          <li key={item.atribuicao_id || `${item.projeto_id}-${i}`}>
                            <span className="font-semibold">{item.codigo_projeto}</span>
                            {' '}({item.engenheiro_nome} — {getProjetoAreaDisplayName(item)})
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabela. Sem o wrapper do <Table> do shadcn: ele cria um scroll proprio e quebra o cabecalho fixo. */}
        <div className={cn('overflow-auto', embutido ? 'max-h-[70vh]' : 'min-h-0 flex-1')}>
          <table data-slot="table" className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-muted shadow-[inset_0_-1px_0_var(--border)]">
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className="px-4 text-xs font-medium text-muted-foreground">Código</TableHead>
                <TableHead className="px-4 text-xs font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="px-4 text-xs font-medium text-muted-foreground">Engenheiro</TableHead>
                <TableHead className="px-4 text-xs font-medium text-muted-foreground">Área</TableHead>
                {showConcluidas && (
                  <TableHead className="px-4 text-xs font-medium text-muted-foreground">Concluidas</TableHead>
                )}
                <TableHead className="px-4 text-xs font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="px-4 text-center text-xs font-medium text-muted-foreground">Progresso</TableHead>
                <TableHead className="px-4 text-center text-xs font-medium text-muted-foreground">Prazo</TableHead>
                <TableHead className="px-4 text-center text-xs font-medium text-muted-foreground">Atraso</TableHead>
                {onVerRetrabalho && (
                  <TableHead className="px-4 text-center text-xs font-medium text-muted-foreground">Retrabalho</TableHead>
                )}
                {showAcoes && (
                  <TableHead className="px-4 text-center text-xs font-medium text-muted-foreground">Ações</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card">
              {filteredData.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={totalColunas} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <SearchX className="size-8 text-muted-foreground/60" aria-hidden="true" />
                      <p>Nenhum projeto encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item, index) => {
                  const areaDisplayName = getProjetoAreaDisplayName(item)
                  const rowKey = item.atribuicao_id || `${item.projeto_id}-${areaDisplayName}-${item.engenheiro_nome}-${index}`
                  const concluidas = disciplinasConcluidasPorProjeto.get(item.projeto_id) || []
                  const isExpanded = expandedConcluidas.has(item.projeto_id)
                  // Mesma ordem de antes: aguardando vence atraso, que vence concluido/andamento.
                  const statusAguardando = isStatusAguardando(item.status_descricao)
                  const statusAtrasado = !statusAguardando && item.dias_atraso > 0

                  return (
                  <React.Fragment key={rowKey}>
                  <TableRow>
                    <TableCell className="px-4 py-3">
                      <span className="font-wide font-semibold text-primary tabular-nums">
                        {item.codigo_projeto}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[180px] px-4 py-3 whitespace-normal">
                      <div className="font-medium text-foreground">
                        {item.cliente}
                      </div>
                      {item.descricao && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {item.descricao.length > 50 ? item.descricao.substring(0, 50) + '...' : item.descricao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {item.engenheiro_nome}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                        {areaDisplayName}
                      </span>
                    </TableCell>
                    {showConcluidas && (
                      <TableCell className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleConcluidas(item.projeto_id)}
                          aria-expanded={isExpanded}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            concluidas.length > 0
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100'
                              : 'bg-muted text-muted-foreground ring-border'
                          )}
                          title={`Ver disciplinas concluidas de ${item.codigo_projeto}`}
                        >
                          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                          <span className="tabular-nums">
                            {concluidas.length > 0 ? `${concluidas.length} concluida(s)` : 'Nenhuma'}
                          </span>
                        </button>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-3">
                      {statusAguardando || statusAtrasado ? (
                        // Tooltip controlado: abre no hover, no foco do teclado e no toque.
                        <Tooltip
                          open={tooltipOpen === rowKey}
                          onOpenChange={(aberto) =>
                            setTooltipOpen((atual) => (aberto ? rowKey : atual === rowKey ? null : atual))
                          }
                        >
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={(e) => {
                                // O radix fecha o tooltip no clique; no toque o clique e o que abre.
                                e.preventDefault()
                                setTooltipOpen(rowKey)
                              }}
                              className={cn(
                                classeBadge,
                                'cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                statusAguardando
                                  ? 'bg-amber-50 text-amber-800 ring-amber-200'
                                  : 'bg-orange-50 text-orange-800 ring-orange-200'
                              )}
                            >
                              <span
                                aria-hidden="true"
                                className={cn('size-1.5 rounded-full', statusAguardando ? 'bg-amber-500' : 'bg-[var(--alert)]')}
                              />
                              {item.status_descricao}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start" className="max-w-72 flex-col items-start gap-1 px-3 py-2 text-left">
                            <span className="font-semibold">
                              {statusAguardando ? 'Motivo do aguardo' : 'Motivo do atraso'}
                            </span>
                            <span className="whitespace-normal leading-relaxed">
                              {statusAguardando ? getMotivoAguardo(item) : getMotivoAtraso(item)}
                            </span>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span
                          className={cn(
                            classeBadge,
                            item.data_conclusao
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                              : 'bg-secondary text-primary ring-primary/15'
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn('size-1.5 rounded-full', item.data_conclusao ? 'bg-emerald-500' : 'bg-primary')}
                          />
                          {item.status_descricao}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {/* O que falta fica hachurado, como na prancha */}
                        <div className="hachura relative h-1.5 w-16 overflow-hidden rounded-full bg-muted text-primary/15">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              item.percentual_andamento >= 100
                                ? 'bg-[var(--success)]'
                                : item.percentual_andamento >= 75
                                  ? 'bg-primary'
                                  : item.percentual_andamento >= 50
                                    ? 'bg-[var(--chart-3)]'
                                    : 'bg-muted-foreground/50'
                            )}
                            style={{ width: `${Math.min(item.percentual_andamento, 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-medium tabular-nums">
                          {item.percentual_andamento.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5 tabular-nums">
                        {formatarDataBR(item.data_prevista)}
                        {renderIconeAviso(item)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {item.dias_atraso > 0 ? (
                        <span className={cn(classeBadge, 'bg-orange-50 font-semibold text-orange-800 ring-orange-200 tabular-nums')}>
                          {item.dias_atraso} dias
                        </span>
                      ) : (
                        <span className="text-emerald-700">No prazo</span>
                      )}
                    </TableCell>
                    {onVerRetrabalho && (
                      <TableCell className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onVerRetrabalho(item)}
                          title={`Ver retrabalhos de ${item.codigo_projeto}`}
                          aria-label={`Ver retrabalhos de ${item.codigo_projeto}`}
                        >
                          <AlertTriangle className="text-[var(--alert)]" />
                          Ver
                        </Button>
                      </TableCell>
                    )}
                    {showAcoes && (
                      <TableCell className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-0.5">
                          <BotaoAcao rotulo="Ver detalhes" onClick={() => setDetalheProjeto(item)}>
                            <Eye />
                          </BotaoAcao>
                          {(onAlterarDadosProjeto || onAlterarPrazo || onTransferirResponsavel) && (
                            <BotaoAcao
                              rotulo="Alterar dados"
                              onClick={() => abrirMenuAlterarDados(item)}
                              aria-haspopup="dialog"
                              className="text-primary hover:bg-secondary hover:text-primary"
                            >
                              <PencilLine />
                            </BotaoAcao>
                          )}
                          {isDisciplinaConcluida(item) && (
                            <BotaoAcao
                              rotulo="Gerar PDF do projeto"
                              onClick={() => handleGerarPdf(item)}
                              disabled={gerandoPdfProjetoId === item.projeto_id}
                            >
                              {gerandoPdfProjetoId === item.projeto_id ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <FileDown />
                              )}
                            </BotaoAcao>
                          )}
                          {onExcluirTarefa && (
                            <BotaoAcao
                              rotulo={item.atribuicao_id ? 'Excluir tarefa' : 'Excluir projeto'}
                              onClick={() => abrirExclusao(item)}
                              disabled={!item.atribuicao_id && !onExcluirProjeto}
                              className="hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 />
                            </BotaoAcao>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {showConcluidas && isExpanded && (
                    <TableRow className="bg-emerald-50/40 hover:bg-emerald-50/40">
                      <TableCell colSpan={totalColunas} className="px-4 py-3 whitespace-normal">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">Disciplinas concluidas:</span>
                          {concluidas.length > 0 ? (
                            concluidas.map((disciplina) => (
                              <span
                                key={`${getProjetoAreaDisplayName(disciplina)}-${disciplina.engenheiro_nome}`}
                                className={cn(classeBadge, 'bg-card text-emerald-800 ring-emerald-200')}
                              >
                                <CheckCircle className="size-3.5" aria-hidden="true" />
                                {getProjetoAreaDisplayName(disciplina)} - {disciplina.engenheiro_nome}
                              </span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">Nenhuma concluida.</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                  )
                })
              )}
            </TableBody>
          </table>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t bg-muted/40 px-4 py-3">
          <p className="text-center text-sm text-muted-foreground tabular-nums">
            Mostrando {filteredData.length} de {data.length} projetos
          </p>
        </div>
    </>
  )

  return (
    <>
    {embutido ? (
      <Card className="animate-fade-in gap-0 py-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-5">
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground tabular-nums">{subtitulo}</p>
        </div>
        <div className="flex flex-col border-t">{conteudo}</div>
      </Card>
    ) : (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      fullscreen={fullscreen}
      onToggleFullscreen={onToggleFullscreen}
      title={title}
      subtitle={subtitulo}
      headerGradientClass={colorClasses[color]}
      // Com uma confirmacao aberta por cima, o Escape nao pode fechar a tabela por baixo
      closeOnEscape={!algumaAcaoAberta && !detalheProjeto}
    >
      {conteudo}
    </ModalShell>
    )}

      {transferProjeto && (
        <Dialog open onOpenChange={aoMudarDialogo}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <div className="pr-8">
              <DialogTitle className="text-base font-semibold">Alterar responsavel</DialogTitle>
              <DialogDescription className="mt-1">
                {transferProjeto.codigo_projeto} - {getProjetoAreaDisplayName(transferProjeto)}
              </DialogDescription>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Responsavel atual</p>
                <div className="rounded-lg border bg-muted/60 px-3 py-2 text-sm">
                  {transferProjeto.engenheiro_nome}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="novo-responsavel">Novo responsavel</Label>
                <select
                  id="novo-responsavel"
                  value={novoResponsavelId}
                  onChange={(e) => setNovoResponsavelId(e.target.value)}
                  disabled={isActionSubmitting}
                  className={cn(classeCampo, 'h-9 py-0')}
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
                <div className={classeErro} role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fecharAcao} disabled={isActionSubmitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarTransferencia}
                disabled={isActionSubmitting || !novoResponsavelId}
              >
                {isActionSubmitting && <Loader2 className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
            <BotaoFecharDialogo onClick={fecharAcao} disabled={isActionSubmitting} />
          </DialogContent>
        </Dialog>
      )}

      {menuProjeto && (
        <Dialog open onOpenChange={aoMudarDialogo}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <div className="pr-8">
              <DialogTitle className="text-base font-semibold">Alterar dados</DialogTitle>
              <DialogDescription className="mt-1">
                {menuProjeto.codigo_projeto} - {getProjetoAreaDisplayName(menuProjeto)}
              </DialogDescription>
            </div>

            <div className="space-y-2">
              {[
                {
                  chave: 'dados',
                  icone: <Building2 className="size-5" />,
                  titulo: 'Cliente e descrição',
                  detalhe: 'Vale para o projeto inteiro (todas as disciplinas)',
                  motivo: onAlterarDadosProjeto ? null : 'sem permissão',
                  abrir: () => abrirAlterarDadosProjeto(menuProjeto),
                },
                {
                  chave: 'prazo',
                  icone: <CalendarClock className="size-5" />,
                  titulo: 'Prazo',
                  detalhe: `Prazo atual: ${formatarDataBR(menuProjeto.data_prevista)}`,
                  motivo: motivoSemPrazo(menuProjeto),
                  abrir: () => abrirAlterarPrazo(menuProjeto),
                },
                {
                  chave: 'engenheiro',
                  icone: <UserRoundCog className="size-5" />,
                  titulo: 'Engenheiro',
                  detalhe: `Responsável atual: ${menuProjeto.engenheiro_nome}`,
                  motivo: motivoSemEngenheiro(menuProjeto),
                  abrir: () => abrirTransferencia(menuProjeto),
                },
              ].map((opcao, i, opcoes) => (
                <button
                  key={opcao.chave}
                  type="button"
                  // Foco na primeira opcao disponivel, para o teclado comecar no menu.
                  autoFocus={i === opcoes.findIndex((o) => !o.motivo)}
                  onClick={opcao.abrir}
                  disabled={Boolean(opcao.motivo)}
                  className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors outline-none hover:border-primary/40 hover:bg-secondary/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-transparent"
                >
                  <span className="text-primary">{opcao.icone}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{opcao.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {opcao.motivo ? `Indisponível: ${opcao.motivo}` : opcao.detalhe}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <BotaoFecharDialogo onClick={fecharAcao} />
          </DialogContent>
        </Dialog>
      )}

      {dadosProjeto && (
        <Dialog open onOpenChange={aoMudarDialogo}>
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <div className="pr-8">
              <DialogTitle className="text-base leading-snug font-semibold">
                Cliente e descrição — {dadosProjeto.codigo_projeto}
              </DialogTitle>
              <DialogDescription className="mt-1">Vale para todas as disciplinas deste projeto.</DialogDescription>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="novo-cliente">Cliente</Label>
                <Input
                  id="novo-cliente"
                  type="text"
                  autoFocus
                  maxLength={200}
                  value={novoCliente}
                  onChange={(e) => setNovoCliente(e.target.value)}
                  disabled={isActionSubmitting}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nova-descricao">
                  Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <textarea
                  id="nova-descricao"
                  rows={3}
                  maxLength={1000}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  disabled={isActionSubmitting}
                  className={classeCampo}
                />
              </div>

              {actionError && (
                <div className={classeErro} role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fecharAcao} disabled={isActionSubmitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarAlterarDadosProjeto}
                disabled={isActionSubmitting || clienteNormalizado.length < 2 || !dadosMudaram}
              >
                {isActionSubmitting && <Loader2 className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
            <BotaoFecharDialogo onClick={fecharAcao} disabled={isActionSubmitting} />
          </DialogContent>
        </Dialog>
      )}

      {prazoProjeto && (
        <Dialog open onOpenChange={aoMudarDialogo}>
          <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-md">
            <DialogTitle className="pr-8 text-base leading-snug font-semibold">
              Alterar prazo — {prazoProjeto.codigo_projeto} / {prazoProjeto.engenheiro_nome}
            </DialogTitle>

            <div className="space-y-4">
              <div className="space-y-1 rounded-lg border bg-muted/60 px-3 py-2 text-sm tabular-nums">
                <p>Início: {formatarDataBR(prazoProjeto.data_inicio)}</p>
                <p>Prazo atual: {formatarDataBR(prazoProjeto.data_prevista)}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="novo-prazo">Novo prazo</Label>
                <Input
                  id="novo-prazo"
                  type="date"
                  min={toDataISO(prazoProjeto.data_inicio) ?? undefined}
                  value={novoPrazo}
                  onChange={(e) => setNovoPrazo(e.target.value)}
                  disabled={isActionSubmitting}
                  className="h-9 tabular-nums"
                />
              </div>

              {actionError && (
                <div className={classeErro} role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={fecharAcao} disabled={isActionSubmitting}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmarAlterarPrazo}
                disabled={isActionSubmitting || !novoPrazo || novoPrazo === prazoAtualISO}
              >
                {isActionSubmitting && <Loader2 className="animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
            <BotaoFecharDialogo onClick={fecharAcao} disabled={isActionSubmitting} />
          </DialogContent>
        </Dialog>
      )}

      {deleteProjeto && (
        // Dialog (e nao AlertDialog) para o clique no fundo continuar cancelando, como antes;
        // o papel de alerta vai no role.
        <Dialog open onOpenChange={aoMudarDialogo}>
          <DialogContent showCloseButton={false} role="alertdialog" className="sm:max-w-md">
            {isCheckingInfo ? (
              <>
                <DialogTitle className="sr-only">
                  {deleteProjeto.atribuicao_id ? 'Excluir tarefa' : 'Excluir projeto'}
                </DialogTitle>
                <DialogDescription className="sr-only">Verificando a tarefa</DialogDescription>
                <div className="flex items-center justify-center py-8" role="status" aria-label="Carregando">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-red-50 p-2 text-red-700">
                    <AlertTriangle className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold">
                      {isUltimaDisciplina ? 'Excluir projeto' : 'Excluir tarefa'}
                    </DialogTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {deleteProjeto.codigo_projeto} - {getProjetoAreaDisplayName(deleteProjeto)} - {deleteProjeto.engenheiro_nome}
                    </p>
                  </div>
                </div>

                <DialogDescription className="text-foreground/85">
                  {!deleteProjeto.atribuicao_id
                    ? 'Este projeto nao tem tarefas atribuidas. Ao excluir, ele sera desativado e deixara de aparecer no dashboard e no chatbot.'
                    : isUltimaDisciplina
                    ? 'Este projeto possui apenas esta disciplina. Ao excluir, o projeto inteiro sera desativado e deixara de aparecer no dashboard e no chatbot.'
                    : 'Esta tarefa deixara de aparecer no dashboard e no chatbot, mas permanecera no historico do banco.'}
                </DialogDescription>

                {isUltimaDisciplina && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    O projeto sera marcado como inativo e podera ser reativado futuramente ao cadastrar um novo projeto com o mesmo codigo.
                  </div>
                )}

                {actionError && (
                  <div className={classeErro} role="alert">
                    {actionError}
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={fecharAcao} disabled={isActionSubmitting}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={confirmarExclusao}
                    disabled={isActionSubmitting || (!onExcluirTarefa && !isUltimaDisciplina) || (isUltimaDisciplina && !onExcluirProjeto)}
                    className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40"
                  >
                    {isActionSubmitting && <Loader2 className="animate-spin" />}
                    {isUltimaDisciplina ? 'Excluir projeto' : 'Excluir'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}

      <ProjetoDetalhesModal
        isOpen={detalheProjeto !== null}
        onClose={() => setDetalheProjeto(null)}
        projeto={detalheProjeto}
      />
    </>
  )
}
