'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Briefcase,
  CheckCircle,
  Play,
  AlertTriangle,
  FolderPlus,
  UserPlus,
  Layers,
  LayoutList,
  KanbanSquare,
} from 'lucide-react'
import Header from '@/components/Header'
import AppSidebar from '@/components/painel/AppSidebar'
import AtalhoCard from '@/components/painel/AtalhoCard'
import PranchaResumo from '@/components/painel/PranchaResumo'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { filtroDoStatus, infoSecao, resolverSecao, type FiltroProjetos, type SecaoId } from '@/lib/secoes'
import AtrasosTable from '@/components/AtrasosTable'
import RetrabalhoDetalhesModal from '@/components/RetrabalhoDetalhesModal'
import ProjetosTable from '@/components/ProjetosTable'
import EngenheirosTable from '@/components/EngenheirosTable'
import EngenheirosExecucaoTable from '@/components/EngenheirosExecucaoTable'
import AreasTable from '@/components/AreasTable'
import AtribuirTask, { TaskData } from '@/components/AtribuirTask'
import CriarProjeto from '@/components/CriarProjeto'
import {
  mockVisaoGeral,
  mockAtrasosEngenheiro,
  mockCargaTrabalho,
  mockRetrabalhos,
  mockProjetosStatus,
  mockProjetos,
  mockEngenheiros,
  mockAreas,
} from '@/lib/mockData'
import {
  supabase,
  fetchVisaoGeral,
  fetchAtrasosEngenheiro,
  fetchCargaTrabalho,
  fetchRetrabalhoEngenheiro,
  fetchRetrabalhoGeral,
  fetchRetrabalhoPorProjeto,
  fetchRetrabalhoDetalhesPorProjeto,
  fetchRetrabalhoAreaPorProjeto,
  fetchRetrabalhoMotivosPorProjeto,
  fetchRetrabalhoMotivosGeral,
  fetchRetrabalhoTaxaPorArea,
  fetchProjetosStatus,
  fetchProjetos,
  fetchEngenheiros,
  fetchAreas,
  consumirFalhasDeCarga,
  atribuirProjetoComPavimentos,
  transferirResponsavelAtribuicao,
  alterarPrazoAtribuicao,
  alterarDadosProjeto,
  buscarAvisosPrazo,
  excluirAtribuicao,
  excluirProjeto,
  subscribeToChanges,
  isSupabaseConfigured,
  VisaoGeral,
  AtrasosEngenheiro,
  CargaTrabalho,
  RetrabalhoEngenheiro,
  RetrabalhoGeral,
  RetrabalhoPorProjeto,
  RetrabalhoDetalheProjeto,
  RetrabalhoAreaProjeto,
  RetrabalhoMotivo,
  RetrabalhoTaxaArea,
  ProjetosStatus,
  Projeto,
  Engenheiro,
  Area,
} from '@/lib/supabase'
import { buildEngenheirosExecucao } from '@/lib/engenheirosExecucao'
import { criarRecargaAgrupada } from '@/lib/recargaAgrupada'
import { useIsOwnerActive } from '@/hooks/useIsOwnerActive'
import { temAvisoEnviando, type AvisoPrazoLinha } from '@/lib/avisoPrazo'
import { formatarDataBR } from '@/lib/datas'

// Enquanto algum aviso de prazo esta sendo enviado, a tabela reconsulta so os avisos.
const INTERVALO_POLLING_AVISOS_MS = 20_000

function indexarAvisos(linhas: AvisoPrazoLinha[]): Record<string, AvisoPrazoLinha> {
  const porAtribuicao: Record<string, AvisoPrazoLinha> = {}
  for (const linha of linhas) porAtribuicao[linha.eng_projeto_id] = linha
  return porAtribuicao
}

const ProjetosStatusChart = dynamic(() => import('@/components/ProjetosStatusChart'), {
  ssr: false,
})
const CargaTrabalhoChart = dynamic(() => import('@/components/CargaTrabalhoChart'), {
  ssr: false,
})
const RetrabalhoCard = dynamic(() => import('@/components/RetrabalhoCard'), {
  ssr: false,
})
const ProducaoPeriodoCard = dynamic(() => import('@/components/ProducaoPeriodoCard'), {
  ssr: false,
})

export default function DashboardClient() {
  const [visaoGeral, setVisaoGeral] = useState<VisaoGeral | null>(null)
  const [atrasosEngenheiro, setAtrasosEngenheiro] = useState<AtrasosEngenheiro[]>([])
  const [cargaTrabalho, setCargaTrabalho] = useState<CargaTrabalho[]>([])
  const [retrabalhos, setRetrabalhos] = useState<RetrabalhoEngenheiro[]>([])
  const [retrabalhoGeral, setRetrabalhoGeral] = useState<RetrabalhoGeral | null>(null)
  const [retrabalhoPorProjeto, setRetrabalhoPorProjeto] = useState<RetrabalhoPorProjeto[]>([])
  const [retrabalhoDetalhes, setRetrabalhoDetalhes] = useState<RetrabalhoDetalheProjeto[]>([])
  const [retrabalhoAreasProjeto, setRetrabalhoAreasProjeto] = useState<RetrabalhoAreaProjeto[]>([])
  const [retrabalhoMotivosProjeto, setRetrabalhoMotivosProjeto] = useState<RetrabalhoMotivo[]>([])
  const [retrabalhoMotivosGeral, setRetrabalhoMotivosGeral] = useState<RetrabalhoMotivo[]>([])
  const [retrabalhoTaxaArea, setRetrabalhoTaxaArea] = useState<RetrabalhoTaxaArea[]>([])
  const [projetosStatus, setProjetosStatus] = useState<ProjetosStatus[]>([])
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [engenheiros, setEngenheiros] = useState<Engenheiro[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  // Consultas que falharam na ultima carga: sem isto a tela mostrava zeros como se fossem dados.
  const [falhasCarga, setFalhasCarga] = useState<string[]>([])
  // Recargas do Realtime se sobrepoem; so a mais recente pode gravar na tela, senao uma
  // resposta atrasada sobrescreve dados mais novos.
  const cargaAtual = useRef(0)
  // Status de cada canal do Realtime: "Conectado" so quando todos estao recebendo eventos.
  const [canaisConectados, setCanaisConectados] = useState<Record<string, boolean>>({})
  const realtimeConectado =
    isSupabaseConfigured &&
    Object.keys(canaisConectados).length > 0 &&
    Object.values(canaisConectados).every(Boolean)
  const [isLoading, setIsLoading] = useState(true)
  const isOwner = useIsOwnerActive()
  // loadData e capturado pelo efeito de montagem (e pelo Realtime) antes de o perfil
  // carregar; o ref deixa a recarga saber se o usuario e dono sem refazer as assinaturas.
  const isOwnerRef = useRef(false)
  // Ultimo aviso de prazo por atribuicao_id; so e buscado para o dono.
  const [avisosPrazo, setAvisosPrazo] = useState<Record<string, AvisoPrazoLinha>>({})
  
  const [showProjetosModal, setShowProjetosModal] = useState(false)
  const [showProjetosConcluidosModal, setShowProjetosConcluidosModal] = useState(false)
  const [showProjetosExecucaoModal, setShowProjetosExecucaoModal] = useState(false)
  const [showAtrasadosModal, setShowAtrasadosModal] = useState(false)
  const [showEngenheirosModal, setShowEngenheirosModal] = useState(false)
  const [showEngenheirosExecucaoModal, setShowEngenheirosExecucaoModal] = useState(false)
  const [showAreasModal, setShowAreasModal] = useState(false)
  const [showAtribuirTaskModal, setShowAtribuirTaskModal] = useState(false)
  const [showCriarProjetoModal, setShowCriarProjetoModal] = useState(false)
  const [showRetrabalhoDetalhesModal, setShowRetrabalhoDetalhesModal] = useState(false)
  // Um so estado: apenas um dos modais de KPI fica aberto por vez
  const [modalFullscreen, setModalFullscreen] = useState(false)
  const [returnProjetosModal, setReturnProjetosModal] = useState<
    'all' | 'concluido' | 'em_execucao' | 'atrasado' | null
  >(null)
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null)
  const [projetoSelecionadoCodigo, setProjetoSelecionadoCodigo] = useState<string | undefined>()
  const [projetoSelecionadoCliente, setProjetoSelecionadoCliente] = useState<string | undefined>()
  // Clique num engenheiro do grafico de carga abre o quadro "em execucao" ja filtrado.
  const [buscaEngenheirosExecucao, setBuscaEngenheirosExecucao] = useState('')

  // Secao do menu lateral, guardada na URL (?secao=...).
  const router = useRouter()
  const searchParams = useSearchParams()
  const secao = resolverSecao(searchParams.get('secao'), isOwner)
  const irPara = (destino: SecaoId) => {
    router.push(destino === 'visao-geral' ? '/' : `/?secao=${destino}`, { scroll: false })
    window.scrollTo({ top: 0 })
  }
  const engenheirosExecucao = useMemo(() => buildEngenheirosExecucao(projetos), [projetos])
  const totalTarefasEngenheirosExecucao = engenheirosExecucao.reduce(
    (acc, grupo) => acc + grupo.total_tarefas,
    0
  )

  const loadData = async () => {
    const minhaCarga = ++cargaAtual.current
    setIsLoading(true)
    try {
      if (!isSupabaseConfigured) {
        setVisaoGeral(mockVisaoGeral)
        setAtrasosEngenheiro(mockAtrasosEngenheiro)
        setCargaTrabalho(mockCargaTrabalho)
        setRetrabalhos(mockRetrabalhos)
        setRetrabalhoGeral(null)
        setRetrabalhoPorProjeto([])
        setRetrabalhoMotivosGeral([])
        setRetrabalhoTaxaArea([])
        setProjetosStatus(mockProjetosStatus)
        setProjetos(mockProjetos)
        setEngenheiros(mockEngenheiros)
        setAreas(mockAreas)
        setLastUpdate(new Date())
        return
      }

      const [
        visaoGeralData,
        atrasosData,
        cargaData,
        retrabalhosData,
        retrabalhoGeralData,
        retrabalhoPorProjetoData,
        motivosGeralData,
        taxaAreaData,
        statusData,
        projetosData,
        engenheirosData,
        areasData,
        avisosData,
      ] = await Promise.all([
        fetchVisaoGeral(),
        fetchAtrasosEngenheiro(),
        fetchCargaTrabalho(),
        fetchRetrabalhoEngenheiro(),
        fetchRetrabalhoGeral(),
        fetchRetrabalhoPorProjeto(),
        fetchRetrabalhoMotivosGeral(),
        fetchRetrabalhoTaxaPorArea(),
        fetchProjetosStatus(),
        fetchProjetos(),
        fetchEngenheiros(),
        fetchAreas(),
        isOwnerRef.current ? buscarAvisosPrazo() : Promise.resolve(null),
      ])

      if (minhaCarga !== cargaAtual.current) return
      setFalhasCarga(consumirFalhasDeCarga())
      setVisaoGeral(visaoGeralData)
      setAtrasosEngenheiro(atrasosData)
      setCargaTrabalho(cargaData)
      setRetrabalhos(retrabalhosData)
      setRetrabalhoGeral(retrabalhoGeralData)
      setRetrabalhoPorProjeto(retrabalhoPorProjetoData)
      setRetrabalhoMotivosGeral(motivosGeralData)
      setRetrabalhoTaxaArea(taxaAreaData)
      setProjetosStatus(statusData)
      setProjetos(projetosData)
      setEngenheiros(engenheirosData)
      setAreas(areasData)
      if (avisosData) setAvisosPrazo(indexarAvisos(avisosData))
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      if (minhaCarga === cargaAtual.current) setFalhasCarga(['dados do painel'])
    } finally {
      if (minhaCarga === cargaAtual.current) setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    if (!isSupabaseConfigured) {
      console.warn(
        'Supabase: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local (Realtime desativado).'
      )
      return
    }
    // Eventos em sequencia viram uma recarga so; com a aba escondida, a recarga
    // espera a aba voltar (detalhes em lib/recargaAgrupada.ts).
    const recarga = criarRecargaAgrupada(loadData, {
      estaVisivel: () => document.visibilityState === 'visible',
    })
    const aoMudarVisibilidade = () => {
      if (document.visibilityState === 'visible') recarga.aoFicarVisivel()
    }
    document.addEventListener('visibilitychange', aoMudarVisibilidade)

    const tabelas = ['engenheiros_projetos', 'projetos', 'retrabalho_projetos']
    const channels = tabelas.map((tabela) =>
      subscribeToChanges(tabela, recarga.agendar, (conectado) =>
        setCanaisConectados((atual) => ({ ...atual, [tabela]: conectado }))
      )
    )
    return () => {
      recarga.cancelar()
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
      channels.forEach((channel) => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [])

  // O perfil de dono chega depois da primeira carga: quando confirmar, busca os avisos.
  useEffect(() => {
    isOwnerRef.current = isOwner
    if (!isOwner || !isSupabaseConfigured) return

    let cancelado = false
    buscarAvisosPrazo().then((linhas) => {
      if (!cancelado) setAvisosPrazo(indexarAvisos(linhas))
    })
    return () => {
      cancelado = true
    }
  }, [isOwner])

  // Polling so enquanto ha aviso "enviando" e so com a aba visivel. Cada resposta
  // troca o objeto de avisos, o efeito reavalia e para quando nenhum estiver enviando.
  useEffect(() => {
    if (!isOwner || !temAvisoEnviando(Object.values(avisosPrazo), Date.now())) return

    let cancelado = false
    const intervalo = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      buscarAvisosPrazo().then((linhas) => {
        if (!cancelado) setAvisosPrazo(indexarAvisos(linhas))
      })
    }, INTERVALO_POLLING_AVISOS_MS)

    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [isOwner, avisosPrazo])

  const handleAtribuirTask = async (data: TaskData) => {
    if (!isSupabaseConfigured) {
      alert('Supabase não está configurado. Não é possível salvar o projeto.')
      return
    }
    try {
      const result = await atribuirProjetoComPavimentos(data)

      if (!result.success) {
        alert(`Erro ao atribuir projeto: ${result.error}`)
        return
      }

      alert(`Projeto ${data.codigo_projeto} atribuido com sucesso!`)
      loadData()
    } catch (err) {
      console.error('Erro ao atribuir task:', err)
      alert('Erro inesperado ao atribuir projeto. Tente novamente em alguns instantes.')
    }
  }

  const handleCriarProjetoSuccess = () => {
    loadData()
  }

  const handleTransferirResponsavel = async (projeto: Projeto, novoEngId: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao esta configurado.')
    }
    if (!projeto.atribuicao_id) {
      throw new Error('Tarefa sem identificador de atribuicao.')
    }

    const result = await transferirResponsavelAtribuicao(projeto.atribuicao_id, novoEngId)
    if (!result.success) {
      throw new Error(result.error || 'Nao foi possivel alterar o responsavel.')
    }

    await loadData()
  }

  const handleAlterarDadosProjeto = async (
    projeto: Projeto,
    dados: { cliente: string; descricao: string | null }
  ) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao esta configurado.')
    }
    if (!projeto.projeto_id) {
      throw new Error('Projeto sem identificador.')
    }

    const result = await alterarDadosProjeto(projeto.projeto_id, dados)
    if (!result.success) {
      throw new Error(result.error || 'Nao foi possivel alterar os dados do projeto.')
    }

    await loadData()
  }

  const handleAlterarPrazo = async (projeto: Projeto, novoPrazo: string): Promise<string | null> => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao esta configurado.')
    }
    if (!projeto.atribuicao_id) {
      throw new Error('Tarefa sem identificador de atribuicao.')
    }

    const result = await alterarPrazoAtribuicao(projeto.atribuicao_id, novoPrazo)
    if (!result.success) {
      throw new Error(result.error || 'Nao foi possivel alterar o prazo.')
    }

    await loadData()

    const resultado = result.data?.result
    return resultado?.cliente_ajustado > 0
      ? 'Prazo do cliente ajustado para ' + formatarDataBR(resultado.prazo_cliente)
      : null
  }

  const handleExcluirTarefa = async (projeto: Projeto) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao esta configurado.')
    }
    if (!projeto.atribuicao_id) {
      throw new Error('Tarefa sem identificador de atribuicao.')
    }

    const result = await excluirAtribuicao(projeto.atribuicao_id)
    if (!result.success) {
      throw new Error(result.error || 'Nao foi possivel excluir a tarefa.')
    }

    await loadData()
  }

  const handleExcluirProjeto = async (projeto: Projeto) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase nao esta configurado.')
    }
    if (!projeto.projeto_id) {
      throw new Error('Projeto sem identificador.')
    }

    const result = await excluirProjeto(projeto.projeto_id)
    if (!result.success) {
      throw new Error(result.error || 'Nao foi possivel excluir o projeto.')
    }

    await loadData()
  }

  const openRetrabalhoModal = async (
    projetoId: string,
    codigoProjeto?: string,
    clienteNome?: string,
    sourceModal?: 'all' | 'concluido' | 'em_execucao' | 'atrasado' | null
  ) => {
    setProjetoSelecionadoId(projetoId)
    setProjetoSelecionadoCodigo(codigoProjeto)
    setProjetoSelecionadoCliente(clienteNome)
    setReturnProjetosModal(sourceModal ?? null)

    setShowProjetosModal(false)
    setShowProjetosConcluidosModal(false)
    setShowProjetosExecucaoModal(false)
    setShowAtrasadosModal(false)

    const [detalhes, areas, motivos] = await Promise.all([
      fetchRetrabalhoDetalhesPorProjeto(projetoId),
      fetchRetrabalhoAreaPorProjeto(projetoId),
      fetchRetrabalhoMotivosPorProjeto(projetoId),
    ])

    setRetrabalhoDetalhes(detalhes)
    setRetrabalhoAreasProjeto(areas)
    setRetrabalhoMotivosProjeto(motivos)
    setShowRetrabalhoDetalhesModal(true)
  }

  const handleSelectProjetoRetrabalho = async (projetoId: string) => {
    // O grafico por area tambem chama isto; o projeto pode nao estar na tabela por projeto.
    const projetoInfo =
      retrabalhoPorProjeto.find((p) => p.projeto_id === projetoId) ??
      retrabalhoTaxaArea.find((p) => p.projeto_id === projetoId)
    await openRetrabalhoModal(
      projetoId,
      projetoInfo?.codigo_projeto,
      projetoInfo?.cliente,
      null
    )
  }

  const handleVerRetrabalhoFromTable = async (projeto: {
    projeto_id: string
    codigo_projeto: string
    cliente: string
  }) => {
    const sourceModal =
      showProjetosModal ? 'all' :
      showProjetosConcluidosModal ? 'concluido' :
      showProjetosExecucaoModal ? 'em_execucao' :
      showAtrasadosModal ? 'atrasado' :
      null

    await openRetrabalhoModal(
      projeto.projeto_id,
      projeto.codigo_projeto,
      projeto.cliente,
      sourceModal
    )
  }

  // Abre a lista de projetos com o filtro pedido (KPIs, grafico de status, secao Projetos).
  const abrirProjetos = (filtro: FiltroProjetos, telaCheia = false) => {
    setModalFullscreen(telaCheia)
    if (filtro === 'all') setShowProjetosModal(true)
    if (filtro === 'concluido') setShowProjetosConcluidosModal(true)
    if (filtro === 'em_execucao') setShowProjetosExecucaoModal(true)
    if (filtro === 'atrasado') setShowAtrasadosModal(true)
  }

  const abrirEngenheirosExecucao = (busca = '', telaCheia = false) => {
    setBuscaEngenheirosExecucao(busca)
    setModalFullscreen(telaCheia)
    setShowEngenheirosExecucaoModal(true)
  }

  const info = infoSecao(secao)
  const carregandoPrimeiraVez = isLoading && !lastUpdate

  // Criar e atribuir exigem owner no servidor; para os demais o botao so falharia.
  const botoesDono = isOwner && (secao === 'visao-geral' || secao === 'projetos') && (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setShowCriarProjetoModal(true)}>
        <FolderPlus />
        Criar projeto
      </Button>
      <Button onClick={() => setShowAtribuirTaskModal(true)}>
        <UserPlus />
        Atribuir projeto
      </Button>
    </div>
  )

  return (
    <SidebarProvider>
      <AppSidebar secaoAtiva={secao} onSelecionar={irPara} />
      <SidebarInset>
        <Header lastUpdate={lastUpdate} isLoading={isLoading} isConnected={realtimeConectado} titulo={info.titulo} />

        <main className="mx-auto w-full max-w-[1500px] flex-1 space-y-6 p-4 md:p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{info.titulo}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{info.descricao}</p>
            </div>
            {botoesDono}
          </div>

          {falhasCarga.length > 0 && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            >
              <span>
                ⚠️ Parte dos dados não carregou ({falhasCarga.join(', ')}). Os números abaixo
                podem estar incompletos.
              </span>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => loadData()}>
                Tentar de novo
              </Button>
            </div>
          )}

          {carregandoPrimeiraVez && (
            <div className="space-y-6" aria-busy>
              <p className="sr-only">Carregando dados do dashboard...</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-24 rounded-xl" />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-80 rounded-xl" />
              </div>
            </div>
          )}

          {!carregandoPrimeiraVez && secao === 'visao-geral' && (
            <>
              <PranchaResumo
                visaoGeral={visaoGeral}
                engenheirosEmExecucao={engenheirosExecucao.length}
                tarefasEmExecucao={totalTarefasEngenheirosExecucao}
                lastUpdate={lastUpdate}
                onAbrirProjetos={abrirProjetos}
                onAbrirEngenheiros={(telaCheia) => abrirEngenheirosExecucao('', telaCheia)}
              />

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ProjetosStatusChart
                  data={projetosStatus}
                  onSelecionarStatus={(status) => abrirProjetos(filtroDoStatus(status))}
                />
                <CargaTrabalhoChart
                  data={cargaTrabalho}
                  onSelecionarEngenheiro={(nome) => abrirEngenheirosExecucao(nome)}
                />
              </section>

              <AtrasosTable
                data={atrasosEngenheiro}
                acao={
                  <Button variant="outline" size="sm" onClick={() => setShowEngenheirosModal(true)}>
                    Ver todos os engenheiros
                  </Button>
                }
              />
            </>
          )}

          {!carregandoPrimeiraVez && secao === 'projetos' && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AtalhoCard
                titulo="Todos os projetos"
                descricao="Busca, filtros, prazos, PDF e ações"
                icone={Briefcase}
                valor={visaoGeral?.total_projetos || 0}
                onClick={() => abrirProjetos('all')}
              />
              <AtalhoCard
                titulo="Em execução"
                descricao={`${visaoGeral?.areas_ativas || 0} áreas ativas`}
                icone={Play}
                valor={visaoGeral?.projetos_em_execucao || 0}
                onClick={() => abrirProjetos('em_execucao')}
              />
              <AtalhoCard
                titulo="Concluídos"
                descricao="Com filtro por período de conclusão"
                icone={CheckCircle}
                tom="sucesso"
                valor={visaoGeral?.projetos_concluidos || 0}
                onClick={() => abrirProjetos('concluido')}
              />
              <AtalhoCard
                titulo="Atrasados"
                descricao="Prazo vencido"
                icone={AlertTriangle}
                tom="perigo"
                valor={visaoGeral?.projetos_atrasados || 0}
                onClick={() => abrirProjetos('atrasado')}
              />
            </section>
          )}

          {!carregandoPrimeiraVez && secao === 'engenheiros' && (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <AtalhoCard
                  titulo="Listagem de engenheiros"
                  descricao="Projetos, áreas, progresso, retrabalho e atrasos de cada um"
                  icone={LayoutList}
                  valor={engenheiros.length}
                  onClick={() => setShowEngenheirosModal(true)}
                />
                <AtalhoCard
                  titulo="Em execução"
                  descricao={`${totalTarefasEngenheirosExecucao} tarefa(s) em execução, por engenheiro`}
                  icone={KanbanSquare}
                  valor={engenheirosExecucao.length}
                  onClick={() => abrirEngenheirosExecucao()}
                />
              </section>
              <CargaTrabalhoChart
                data={cargaTrabalho}
                onSelecionarEngenheiro={(nome) => abrirEngenheirosExecucao(nome)}
              />
            </>
          )}

          {!carregandoPrimeiraVez && secao === 'areas' && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AtalhoCard
                titulo="Listagem de áreas"
                descricao="Tempo médio, projetos, áreas ativas e taxa de conclusão"
                icone={Layers}
                valor={areas.length}
                onClick={() => setShowAreasModal(true)}
              />
            </section>
          )}

          {!carregandoPrimeiraVez && secao === 'retrabalho' && (
            <RetrabalhoCard
              data={retrabalhos}
              retrabalhoGeral={retrabalhoGeral}
              retrabalhoPorProjeto={retrabalhoPorProjeto}
              motivosGeral={retrabalhoMotivosGeral}
              taxaAreaGeral={retrabalhoTaxaArea}
              onSelectProjeto={handleSelectProjetoRetrabalho}
            />
          )}

          {!carregandoPrimeiraVez && secao === 'producao' && isOwner && (
            <ProducaoPeriodoCard />
          )}
        </main>
      </SidebarInset>

        <ProjetosTable
          isOpen={showProjetosModal}
          onClose={() => setShowProjetosModal(false)}
          data={projetos}
          initialFilter="all"
          title="Total de Projetos"
          color="warning"
          onVerRetrabalho={handleVerRetrabalhoFromTable}
          engenheiros={engenheiros}
          onTransferirResponsavel={isOwner ? handleTransferirResponsavel : undefined}
          onAlterarDadosProjeto={isOwner ? handleAlterarDadosProjeto : undefined}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
          onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}
          avisosPrazo={isOwner ? avisosPrazo : undefined}
          fullscreen={modalFullscreen}
          onToggleFullscreen={() => setModalFullscreen((v) => !v)}
        />
        <ProjetosTable
          isOpen={showProjetosConcluidosModal}
          onClose={() => setShowProjetosConcluidosModal(false)}
          data={projetos}
          initialFilter="concluido"
          title="Projetos Concluídos"
          color="warning"
          onVerRetrabalho={handleVerRetrabalhoFromTable}
          engenheiros={engenheiros}
          onTransferirResponsavel={isOwner ? handleTransferirResponsavel : undefined}
          onAlterarDadosProjeto={isOwner ? handleAlterarDadosProjeto : undefined}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
          onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}
          avisosPrazo={isOwner ? avisosPrazo : undefined}
          fullscreen={modalFullscreen}
          onToggleFullscreen={() => setModalFullscreen((v) => !v)}
        />
        <ProjetosTable
          isOpen={showProjetosExecucaoModal}
          onClose={() => setShowProjetosExecucaoModal(false)}
          data={projetos}
          initialFilter="em_execucao"
          title="Em Execução"
          color="warning"
          onVerRetrabalho={handleVerRetrabalhoFromTable}
          engenheiros={engenheiros}
          onTransferirResponsavel={isOwner ? handleTransferirResponsavel : undefined}
          onAlterarDadosProjeto={isOwner ? handleAlterarDadosProjeto : undefined}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
          onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}
          avisosPrazo={isOwner ? avisosPrazo : undefined}
          fullscreen={modalFullscreen}
          onToggleFullscreen={() => setModalFullscreen((v) => !v)}
        />
        <ProjetosTable
          isOpen={showAtrasadosModal}
          onClose={() => setShowAtrasadosModal(false)}
          data={projetos}
          initialFilter="atrasado"
          title="Atrasados"
          color="warning"
          onVerRetrabalho={handleVerRetrabalhoFromTable}
          engenheiros={engenheiros}
          onTransferirResponsavel={isOwner ? handleTransferirResponsavel : undefined}
          onAlterarDadosProjeto={isOwner ? handleAlterarDadosProjeto : undefined}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
          onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}
          avisosPrazo={isOwner ? avisosPrazo : undefined}
          fullscreen={modalFullscreen}
          onToggleFullscreen={() => setModalFullscreen((v) => !v)}
        />
        <EngenheirosTable
          isOpen={showEngenheirosModal}
          onClose={() => setShowEngenheirosModal(false)}
          data={engenheiros}
        />
        <EngenheirosExecucaoTable
          isOpen={showEngenheirosExecucaoModal}
          onClose={() => setShowEngenheirosExecucaoModal(false)}
          projetos={projetos}
          fullscreen={modalFullscreen}
          onToggleFullscreen={() => setModalFullscreen((v) => !v)}
          buscaInicial={buscaEngenheirosExecucao}
        />
        <AreasTable
          isOpen={showAreasModal}
          onClose={() => setShowAreasModal(false)}
          data={areas}
        />
        <CriarProjeto
          isOpen={showCriarProjetoModal}
          onClose={() => setShowCriarProjetoModal(false)}
          onSuccess={handleCriarProjetoSuccess}
        />
        <AtribuirTask
          isOpen={showAtribuirTaskModal}
          onClose={() => setShowAtribuirTaskModal(false)}
          engenheiros={engenheiros}
          areas={areas}
          onAtribuir={handleAtribuirTask}
        />

          <RetrabalhoDetalhesModal
            isOpen={showRetrabalhoDetalhesModal}
            onClose={() => {
              setShowRetrabalhoDetalhesModal(false)
              setProjetoSelecionadoId(null)
              setRetrabalhoAreasProjeto([])
              setRetrabalhoMotivosProjeto([])
              if (returnProjetosModal === 'all') setShowProjetosModal(true)
              if (returnProjetosModal === 'concluido') setShowProjetosConcluidosModal(true)
              if (returnProjetosModal === 'em_execucao') setShowProjetosExecucaoModal(true)
              if (returnProjetosModal === 'atrasado') setShowAtrasadosModal(true)
              setReturnProjetosModal(null)
            }}
            projetoCodigo={projetoSelecionadoCodigo}
            cliente={projetoSelecionadoCliente}
            detalhes={retrabalhoDetalhes}
            areasProjeto={retrabalhoAreasProjeto}
            motivosProjeto={retrabalhoMotivosProjeto}
          />
    </SidebarProvider>
  )
}
