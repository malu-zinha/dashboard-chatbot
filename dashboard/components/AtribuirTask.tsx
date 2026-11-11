import React, { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, AlertCircle, CheckCircle, TrendingUp, Calendar, Layers } from 'lucide-react'
import { isCompatibilizacaoArea, isComplementoArea } from '@/lib/compatibilizacao'

interface Engenheiro {
  eng_id: string
  nome: string
  exclusivo: boolean
  total_projetos: number
  areas_ativas: number
  media_percentual: number
  total_retrabalhos: number
  dias_trabalho_pendentes: number
  areas_atrasadas: number
}

interface Area {
  area_id: string | number
  codigo: string
  descricao: string
  tempo_trabalho_dias: number
  tem_etapas_pavimento?: boolean
  tem_etapas_globais?: boolean
}

interface AtribuirTaskProps {
  isOpen: boolean
  onClose: () => void
  engenheiros: Engenheiro[]
  areas: Area[]
  onAtribuir: (data: TaskData) => void
}

export interface TaskData {
  codigo_projeto: string
  cliente: string
  descricao: string
  area_id: string | number
  eng_id: string
  complexidade: 'baixa' | 'media' | 'alta'
  data_prevista: string
  pavimentos?: string[]
  instancia_label?: string
  complemento_area_ref_id?: string | number
}

export default function AtribuirTask({ isOpen, onClose, engenheiros, areas, onAtribuir }: AtribuirTaskProps) {
  const [formData, setFormData] = useState<Partial<TaskData>>({
    complexidade: 'media'
  })
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [pavimentosText, setPavimentosText] = useState('')

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

  // Calcular sobrecarga de cada engenheiro (0-100%)
  const calcularSobrecarga = (eng: Engenheiro): number => {
    const peso_projetos = (eng.total_projetos ?? 0) * 15
    const peso_areas = (eng.areas_ativas ?? 0) * 10
    const peso_dias = Math.min(eng.dias_trabalho_pendentes ?? 0, 60)
    const peso_retrabalho = (eng.total_retrabalhos ?? 0) * 5
    const peso_atrasos = (eng.areas_atrasadas ?? 0) * 15
    
    const sobrecarga = peso_projetos + peso_areas + peso_dias + peso_retrabalho + peso_atrasos
    return Math.min(100, sobrecarga)
  }

  // Calcular pontuação de recomendação
  const calcularPontuacao = (eng: Engenheiro): number => {
    const sobrecarga = calcularSobrecarga(eng)
    
    // Bonus por exclusividade
    const bonus_exclusivo = eng.exclusivo ? 20 : 0
    
    // Penalidade por sobrecarga alta
    const penalidade_sobrecarga = sobrecarga * 0.5
    
    // Bonus por baixo retrabalho
    const bonus_qualidade = (eng.total_retrabalhos ?? 0) === 0 ? 15 : Math.max(0, 15 - (eng.total_retrabalhos ?? 0) * 3)

    // Bonus por não ter atrasos
    const bonus_pontualidade = (eng.areas_atrasadas ?? 0) === 0 ? 15 : 0
    
    // Pontuação final (0-100)
    const pontuacao = Math.max(0, Math.min(100, 
      50 + bonus_exclusivo + bonus_qualidade + bonus_pontualidade - penalidade_sobrecarga
    ))
    
    return pontuacao
  }

  // Ordenar engenheiros por recomendação
  const engenheirosOrdenados = [...engenheiros]
    .map(eng => ({
      ...eng,
      sobrecarga: calcularSobrecarga(eng),
      pontuacao: calcularPontuacao(eng)
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao)

  const melhorEngenheiro = engenheirosOrdenados[0]
  const areaUsaPavimentos = Boolean(selectedArea?.tem_etapas_pavimento)
  const areaCompatibilizacao = isCompatibilizacaoArea(selectedArea || undefined)
  const areaComplemento = isComplementoArea(selectedArea || undefined)
  const areasReferenciaComplemento = areas.filter((area) => !isComplementoArea(area))

  const normalizarPavimentos = () =>
    pavimentosText
      .split(/\r?\n/)
      .map((nome) => nome.trim().replace(/\s+/g, ' '))
      .filter(Boolean)

  const nomesDuplicados = (nomes: string[]) => {
    const vistos = new Set<string>()
    return nomes.some((nome) => {
      const chave = nome.toLowerCase()
      if (vistos.has(chave)) return true
      vistos.add(chave)
      return false
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.codigo_projeto || !formData.cliente || !formData.area_id || !formData.eng_id || !formData.data_prevista) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    const codigoRegex = /^[A-Za-z0-9\-]{1,30}$/
    if (!codigoRegex.test(formData.codigo_projeto)) {
      alert('Código do projeto deve conter apenas letras, números e hífens (máx. 30 caracteres)')
      return
    }

    if (formData.cliente.length > 200) {
      alert('Nome do cliente não pode exceder 200 caracteres')
      return
    }

    if (formData.descricao && formData.descricao.length > 1000) {
      alert('Descrição não pode exceder 1000 caracteres')
      return
    }

    const pavimentos = normalizarPavimentos()

    if (areaUsaPavimentos && pavimentos.length === 0) {
      alert('Informe pelo menos um pavimento para esta disciplina')
      return
    }

    if (nomesDuplicados(pavimentos)) {
      alert('A lista de pavimentos nao pode ter nomes duplicados')
      return
    }

    if (pavimentos.some((nome) => nome.length > 80)) {
      alert('Cada nome de pavimento deve ter no maximo 80 caracteres')
      return
    }

    if (areaComplemento && !formData.complemento_area_ref_id) {
      alert('Informe a disciplina que este complemento se refere')
      return
    }

    const instanciaLabel = formData.instancia_label?.trim().replace(/\s+/g, ' ')

    onAtribuir({
      ...(formData as TaskData),
      pavimentos: areaUsaPavimentos ? pavimentos : [],
      instancia_label: areaCompatibilizacao ? instanciaLabel : undefined,
      complemento_area_ref_id: areaComplemento ? formData.complemento_area_ref_id : undefined,
    })
    
    // Limpar formulário
    setFormData({ complexidade: 'media' })
    setSelectedArea(null)
    setPavimentosText('')
    onClose()
  }

  const getSobrecargaColor = (sobrecarga: number) => {
    if (sobrecarga < 40) return 'text-success'
    if (sobrecarga < 70) return 'text-warning'
    return 'text-danger'
  }

  const getSobrecargaBg = (sobrecarga: number) => {
    if (sobrecarga < 40) return 'bg-success'
    if (sobrecarga < 70) return 'bg-warning'
    return 'bg-danger'
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-linear-to-r from-tecpred-primary via-tecpred-secondary to-tecpred-primary p-6 rounded-t-xl border-b-4 border-tecpred-orange">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-7 h-7" />
                Atribuir Novo Projeto
              </h2>
              <p className="text-white/90 text-sm mt-1">
                Distribuição inteligente baseada em carga de trabalho e exclusividade
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Dados do Projeto</h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Código do Projeto *
                  </label>
                  <input
                    type="text"
                    value={formData.codigo_projeto || ''}
                    onChange={(e) => setFormData({ ...formData, codigo_projeto: e.target.value })}
                    placeholder="PRJ-XXX"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cliente *
                  </label>
                  <input
                    type="text"
                    value={formData.cliente || ''}
                    onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                    placeholder="Nome do cliente"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.descricao || ''}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição do projeto"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Área *
                  </label>
                  <select
                    value={formData.area_id ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      const areaId = Number(raw)
                      const area = areas.find(a => String(a.area_id) === raw)
                      setFormData({
                        ...formData,
                        area_id: isNaN(areaId) ? (raw as any) : areaId,
                        instancia_label: '',
                        complemento_area_ref_id: '',
                      })
                      setSelectedArea(area || null)
                      setPavimentosText('')
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  >
                    <option value="">Selecione uma área</option>
                    {areas.map((area) => (
                      <option key={area.area_id} value={area.area_id}>
                        {area.descricao ?? area.codigo ?? 'Área'}{area.tempo_trabalho_dias != null ? ` (${area.tempo_trabalho_dias} dias)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedArea && (
                  <div>
                    {areaUsaPavimentos ? (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Pavimentos do Empreendimento *
                        </label>
                        <textarea
                          value={pavimentosText}
                          onChange={(e) => setPavimentosText(e.target.value)}
                          placeholder={'Subsolo\nTerreo\nPav. Tipo\nCobertura'}
                          rows={5}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                          required={areaUsaPavimentos}
                        />
                        <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                          <Layers className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>Informe um pavimento por linha. Nomes vazios sao ignorados e nomes repetidos nao sao permitidos.</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                        <Layers className="w-4 h-4 mt-0.5 shrink-0 text-tecpred-primary" />
                        <span>Esta disciplina usa apenas etapas gerais; nao e necessario cadastrar pavimentos.</span>
                      </div>
                    )}
                  </div>
                )}

                {areaCompatibilizacao && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Identificação da compatibilização
                    </label>
                    <input
                      type="text"
                      value={formData.instancia_label || ''}
                      onChange={(e) => setFormData({ ...formData, instancia_label: e.target.value })}
                      placeholder="Ex.: Revisão Cliente"
                      maxLength={120}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Se ficar vazio, o sistema numera automaticamente.
                    </p>
                  </div>
                )}

                {areaComplemento && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Disciplina do complemento *
                    </label>
                    <select
                      value={formData.complemento_area_ref_id ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const areaId = Number(raw)
                        setFormData({
                          ...formData,
                          complemento_area_ref_id: isNaN(areaId) ? (raw as any) : areaId,
                        })
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                      required={areaComplemento}
                    >
                      <option value="">Selecione a disciplina referida</option>
                      {areasReferenciaComplemento.map((area) => (
                        <option key={area.area_id} value={area.area_id}>
                          {area.descricao ?? area.codigo ?? 'Area'}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      O sistema vai numerar automaticamente este complemento para a disciplina selecionada.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Complexidade *
                  </label>
                  <select
                    value={formData.complexidade || 'media'}
                    onChange={(e) => setFormData({ ...formData, complexidade: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Prevista *
                  </label>
                  <input
                    type="date"
                    value={formData.data_prevista || ''}
                    onChange={(e) => setFormData({ ...formData, data_prevista: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Engenheiro *
                  </label>
                  <select
                    value={formData.eng_id || ''}
                    onChange={(e) => setFormData({ ...formData, eng_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um engenheiro</option>
                    {engenheirosOrdenados.map((eng) => (
                      <option key={eng.eng_id} value={eng.eng_id}>
                        {eng.nome} - Sobrecarga: {eng.sobrecarga.toFixed(0)}% 
                        {eng.eng_id === melhorEngenheiro.eng_id && ' ⭐ Recomendado'}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-linear-to-r from-tecpred-orange to-tecpred-coral text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-semibold border-2 border-tecpred-orange"
                >
                  Atribuir Projeto
                </button>
              </form>
            </div>

            {/* Lista de Engenheiros */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Engenheiros Disponíveis</h3>
              
              <div className="space-y-3">
                {engenheirosOrdenados.map((eng, index) => (
                  <div
                    key={eng.eng_id}
                    className={`bg-white rounded-lg p-4 border-2 transition-all ${
                      eng.eng_id === melhorEngenheiro.eng_id
                        ? 'border-tecpred-orange shadow-xl shadow-tecpred-orange/20'
                        : 'border-gray-200 hover:border-tecpred-primary'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{eng.nome}</h4>
                          {eng.eng_id === melhorEngenheiro.eng_id && (
                            <span className="px-2 py-1 bg-linear-to-r from-tecpred-orange to-tecpred-coral text-white text-xs rounded-full flex items-center gap-1 shadow-lg">
                              <CheckCircle className="w-3 h-3" />
                              Recomendado
                            </span>
                          )}
                          {eng.exclusivo && (
                            <span className="px-2 py-1 bg-tecpred-primary text-white text-xs rounded-full">
                              Exclusivo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Pontuação: {eng.pontuacao.toFixed(0)}/100
                        </div>
                      </div>
                    </div>

                    {/* Sobrecarga */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Sobrecarga</span>
                        <span className={`font-bold ${getSobrecargaColor(eng.sobrecarga)}`}>
                          {eng.sobrecarga.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getSobrecargaBg(eng.sobrecarga)}`}
                          style={{ width: `${eng.sobrecarga}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Estatísticas */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-sm p-2">
                        <div className="text-gray-500">Projetos</div>
                        <div className="font-bold text-gray-900">{eng.total_projetos}</div>
                      </div>
                      <div className="bg-gray-50 rounded-sm p-2">
                        <div className="text-gray-500">Áreas</div>
                        <div className="font-bold text-gray-900">{eng.areas_ativas}</div>
                      </div>
                      <div className="bg-gray-50 rounded-sm p-2">
                        <div className="text-gray-500">Dias</div>
                        <div className="font-bold text-gray-900">{eng.dias_trabalho_pendentes}</div>
                      </div>
                    </div>

                    {/* Alertas */}
                    {(eng.total_retrabalhos > 0 || eng.areas_atrasadas > 0) && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-warning">
                        <AlertCircle className="w-4 h-4" />
                        {eng.total_retrabalhos > 0 && <span>{eng.total_retrabalhos} retrabalho(s)</span>}
                        {eng.areas_atrasadas > 0 && <span>{eng.areas_atrasadas} atraso(s)</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

