'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { 
  Briefcase, 
  CheckCircle, 
  Play, 
  AlertTriangle,
  TrendingUp,
  Users,
} from 'lucide-react'
import Header from '@/components/Header'
import KPICard from '@/components/KPICard'
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
  atribuirProjetoComPavimentos,
  transferirResponsavelAtribuicao,
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
import { useIsOwnerActive } from '@/hooks/useIsOwnerActive'

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
  const [isLoading, setIsLoading] = useState(true)
  const isOwner = useIsOwnerActive()
  
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
  const engenheirosExecucao = useMemo(() => buildEngenheirosExecucao(projetos), [projetos])
  const totalTarefasEngenheirosExecucao = engenheirosExecucao.reduce(
    (acc, grupo) => acc + grupo.total_tarefas,
    0
  )

  const loadData = async () => {
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
      ])

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
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoading(false)
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
    const channels = [
      subscribeToChanges('engenheiros_projetos', loadData),
      subscribeToChanges('projetos', loadData),
      subscribeToChanges('retrabalho_projetos', loadData),
    ]
    return () => {
      channels.forEach((channel) => {
        if (channel) supabase.removeChannel(channel)
      })
    }
  }, [])

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
    const projetoInfo = retrabalhoPorProjeto.find(
      (p) => p.projeto_id === projetoId
    )
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-tecpred-light">
      <Header lastUpdate={lastUpdate} isLoading={isLoading} isConnected={isSupabaseConfigured} />

      <main className="container mx-auto px-6 py-8">
        {isLoading && !lastUpdate && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-tecpred-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 text-sm">Carregando dados do dashboard...</p>
          </div>
        )}
        {(!isLoading || lastUpdate) && (
        <>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        <div className="mb-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowCriarProjetoModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-tecpred-primary to-tecpred-secondary text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-semibold flex items-center gap-2 border-2 border-tecpred-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              <line x1="12" x2="12" y1="11" y2="17"></line>
              <line x1="9" x2="15" y1="14" y2="14"></line>
            </svg>
            Criar Novo Projeto
          </button>
          <button
            onClick={() => setShowAtribuirTaskModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-tecpred-primary to-tecpred-secondary text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-semibold flex items-center gap-2 border-2 border-tecpred-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <line x1="19" x2="19" y1="8" y2="14"></line>
              <line x1="22" x2="16" y1="11" y2="11"></line>
            </svg>
            Atribuir Novo Projeto
          </button>
        </div>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Visão Geral da Produção
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <KPICard
              title="Total de Projetos"
              value={visaoGeral?.total_projetos || 0}
              subtitle={`${visaoGeral?.total_areas || 0} áreas`}
              icon={Briefcase}
              color="warning"
              onClick={() => { setModalFullscreen(false); setShowProjetosModal(true) }}
              onExpand={() => { setModalFullscreen(true); setShowProjetosModal(true) }}
            />
            <KPICard
              title="Projetos Concluídos"
              value={visaoGeral?.projetos_concluidos || 0}
              subtitle={`${visaoGeral?.areas_concluidas || 0} áreas concluídas`}
              icon={CheckCircle}
              color="warning"
              onClick={() => { setModalFullscreen(false); setShowProjetosConcluidosModal(true) }}
              onExpand={() => { setModalFullscreen(true); setShowProjetosConcluidosModal(true) }}
            />
            <KPICard
              title="Em Execução"
              value={visaoGeral?.projetos_em_execucao || 0}
              subtitle={`${visaoGeral?.areas_ativas || 0} áreas ativas`}
              icon={Play}
              color="warning"
              onClick={() => { setModalFullscreen(false); setShowProjetosExecucaoModal(true) }}
              onExpand={() => { setModalFullscreen(true); setShowProjetosExecucaoModal(true) }}
            />
            <KPICard
              title="Engenheiros em Execução"
              value={engenheirosExecucao.length}
              subtitle={`${totalTarefasEngenheirosExecucao} tarefa(s) em execução`}
              icon={Users}
              color="warning"
              onClick={() => { setModalFullscreen(false); setShowEngenheirosExecucaoModal(true) }}
              onExpand={() => { setModalFullscreen(true); setShowEngenheirosExecucaoModal(true) }}
            />
            <KPICard
              title="Atrasados"
              value={visaoGeral?.projetos_atrasados || 0}
              subtitle="Requer atenção"
              icon={AlertTriangle}
              color="warning"
              onClick={() => { setModalFullscreen(false); setShowAtrasadosModal(true) }}
              onExpand={() => { setModalFullscreen(true); setShowAtrasadosModal(true) }}
            />
          </div>
        </section>
        
        <ProjetosTable
          isOpen={showProjetosModal}
          onClose={() => setShowProjetosModal(false)}
          data={projetos}
          initialFilter="all"
          title="Total de Projetos"
          color="warning"
          onVerRetrabalho={handleVerRetrabalhoFromTable}
          engenheiros={engenheiros}
          onTransferirResponsavel={handleTransferirResponsavel}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
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
          onTransferirResponsavel={handleTransferirResponsavel}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
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
          onTransferirResponsavel={handleTransferirResponsavel}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
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
          onTransferirResponsavel={handleTransferirResponsavel}
          onExcluirTarefa={handleExcluirTarefa}
          onExcluirProjeto={handleExcluirProjeto}
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

        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-5 h-5 text-tecpred-primary" />
              <h3 className="text-lg font-bold text-gray-900">
                Progresso Geral
              </h3>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Percentual Concluído Médio
                  </span>
                  <span className="text-2xl font-bold text-tecpred-primary">
                    {(visaoGeral?.percentual_concluido_medio ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-gradient-to-r from-tecpred-primary to-tecpred-secondary h-4 rounded-full transition-all duration-500"
                    style={{ width: `${visaoGeral?.percentual_concluido_medio || 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Análises e Gráficos</h2>
            <button
              onClick={() => setShowAreasModal(true)}
              className="px-4 py-2 bg-tecpred-primary text-white rounded-lg hover:bg-tecpred-secondary transition-colors text-sm"
            >
              Ver Todas as Áreas
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjetosStatusChart data={projetosStatus} />
            <CargaTrabalhoChart data={cargaTrabalho} />
          </div>
        </section>

        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Atrasos</h2>
            <button
              onClick={() => setShowEngenheirosModal(true)}
              className="px-4 py-2 bg-tecpred-primary text-white rounded-lg hover:bg-tecpred-secondary transition-colors text-sm"
            >
              Ver Todos os Engenheiros
            </button>
          </div>
          <AtrasosTable data={atrasosEngenheiro} />
        </section>

        {isOwner && (
          <section className="mb-8">
            <ProducaoPeriodoCard />
          </section>
        )}

        <section className="mb-8">
          <RetrabalhoCard
            data={retrabalhos}
            retrabalhoGeral={retrabalhoGeral}
            retrabalhoPorProjeto={retrabalhoPorProjeto}
            motivosGeral={retrabalhoMotivosGeral}
            taxaAreaGeral={retrabalhoTaxaArea}
            onSelectProjeto={handleSelectProjetoRetrabalho}
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
        </section>
        </>
        )}
      </main>
    </div>
  )
}
