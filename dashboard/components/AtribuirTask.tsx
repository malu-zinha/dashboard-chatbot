import React, { useState } from 'react'
import { X, UserPlus, AlertCircle, CheckCircle, Layers } from 'lucide-react'
import { isCompatibilizacaoArea, isComplementoArea } from '@/lib/compatibilizacao'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

// Campo que recebe a mensagem de validacao; 'geral' aparece junto do botao de enviar.
type CampoErro = 'geral' | 'codigo_projeto' | 'cliente' | 'descricao' | 'pavimentos' | 'complemento_area_ref_id'

// Ids dos campos, usados no foco apos erro e no aria-describedby.
const ID = {
  codigo_projeto: 'atribuir-codigo',
  cliente: 'atribuir-cliente',
  descricao: 'atribuir-descricao',
  area_id: 'atribuir-area',
  pavimentos: 'atribuir-pavimentos',
  instancia_label: 'atribuir-instancia',
  complemento_area_ref_id: 'atribuir-complemento',
  complexidade: 'atribuir-complexidade',
  data_prevista: 'atribuir-data',
  eng_id: 'atribuir-engenheiro',
} as const

// Campos nativos (select, textarea) com o mesmo visual do Input do shadcn.
const classeCampo =
  'w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm'

function iniciais(nome: string) {
  const partes = (nome ?? '').trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Junta ids para aria-describedby ignorando os vazios.
function idsDescricao(...ids: (string | null | false | undefined)[]) {
  return ids.filter(Boolean).join(' ')
}

function Obrigatorio() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

function MensagemErro({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

export default function AtribuirTask({ isOpen, onClose, engenheiros, areas, onAtribuir }: AtribuirTaskProps) {
  const [formData, setFormData] = useState<Partial<TaskData>>({
    complexidade: 'media'
  })
  const [selectedArea, setSelectedArea] = useState<Area | null>(null)
  const [pavimentosText, setPavimentosText] = useState('')
  const [erro, setErro] = useState<{ campo: CampoErro; mensagem: string } | null>(null)

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

  // Mostra a mensagem junto do campo e leva o foco ate ele (substitui o antigo alert()).
  const falhar = (campo: CampoErro, mensagem: string, idFoco?: string) => {
    setErro({ campo, mensagem })
    if (idFoco) document.getElementById(idFoco)?.focus()
  }

  // Editar o campo com erro (ou qualquer campo, no caso do erro geral) limpa a mensagem.
  const limparErro = (campo: CampoErro) => {
    setErro((atual) => (atual && (atual.campo === campo || atual.campo === 'geral') ? null : atual))
  }

  const erroDe = (campo: CampoErro) => (erro?.campo === campo ? erro.mensagem : null)

  const fechar = () => {
    setErro(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (!formData.codigo_projeto || !formData.cliente || !formData.area_id || !formData.eng_id || !formData.data_prevista) {
      // Foco no primeiro obrigatorio vazio, na ordem em que aparecem no formulario.
      const primeiroVazio =
        (!formData.codigo_projeto && ID.codigo_projeto) ||
        (!formData.cliente && ID.cliente) ||
        (!formData.area_id && ID.area_id) ||
        (!formData.data_prevista && ID.data_prevista) ||
        ID.eng_id
      falhar('geral', 'Por favor, preencha todos os campos obrigatórios', primeiroVazio)
      return
    }

    const codigoRegex = /^[A-Za-z0-9\-]{1,30}$/
    if (!codigoRegex.test(formData.codigo_projeto)) {
      falhar('codigo_projeto', 'Código do projeto deve conter apenas letras, números e hífens (máx. 30 caracteres)', ID.codigo_projeto)
      return
    }

    if (formData.cliente.length > 200) {
      falhar('cliente', 'Nome do cliente não pode exceder 200 caracteres', ID.cliente)
      return
    }

    if (formData.descricao && formData.descricao.length > 1000) {
      falhar('descricao', 'Descrição não pode exceder 1000 caracteres', ID.descricao)
      return
    }

    const pavimentos = normalizarPavimentos()

    if (areaUsaPavimentos && pavimentos.length === 0) {
      falhar('pavimentos', 'Informe pelo menos um pavimento para esta disciplina', ID.pavimentos)
      return
    }

    // Sem pavimentos na disciplina o campo nao existe: a mensagem vai para junto do botao.
    if (nomesDuplicados(pavimentos)) {
      falhar(areaUsaPavimentos ? 'pavimentos' : 'geral', 'A lista de pavimentos nao pode ter nomes duplicados', ID.pavimentos)
      return
    }

    if (pavimentos.some((nome) => nome.length > 80)) {
      falhar(areaUsaPavimentos ? 'pavimentos' : 'geral', 'Cada nome de pavimento deve ter no maximo 80 caracteres', ID.pavimentos)
      return
    }

    if (areaComplemento && !formData.complemento_area_ref_id) {
      falhar('complemento_area_ref_id', 'Informe a disciplina que este complemento se refere', ID.complemento_area_ref_id)
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

  // Barra de sobrecarga: verde abaixo de 40%, ambar abaixo de 70%, vermelho acima.
  const getSobrecargaColor = (sobrecarga: number) => {
    if (sobrecarga < 40) return 'text-status-success'
    if (sobrecarga < 70) return 'text-amber-700'
    return 'text-status-danger'
  }

  const getSobrecargaBg = (sobrecarga: number) => {
    if (sobrecarga < 40) return 'bg-status-success'
    if (sobrecarga < 70) return 'bg-status-warning'
    return 'bg-status-danger'
  }

  const erroGeral = erroDe('geral')

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        // Escape e clique no fundo fecham, como antes (sem limpar o formulario).
        if (!aberto) fechar()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          // Foco inicial no primeiro campo, nao no botao de fechar.
          e.preventDefault()
          document.getElementById(ID.codigo_projeto)?.focus()
        }}
        className="flex max-h-[90vh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden bg-card p-0 text-card-foreground shadow-2xl ring-1 ring-black/10 sm:max-w-7xl"
      >
        {/* Cabecalho: prancha azul, igual aos demais modais */}
        <div className="malha-prancha flex shrink-0 items-start justify-between gap-3 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-wide text-lg leading-tight font-semibold text-white sm:text-xl">
                Atribuir novo projeto
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/65">
                Distribuição inteligente baseada em carga de trabalho e exclusividade
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={fechar}
            aria-label="Fechar"
            title="Fechar"
            className="shrink-0 text-white/75 hover:bg-white/15 hover:text-white focus-visible:ring-white/50"
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Formulário */}
            <section aria-labelledby="atribuir-dados-titulo" className="rounded-xl border bg-muted/50 p-4 sm:p-5">
              <h3 id="atribuir-dados-titulo" className="font-wide mb-4 text-base font-semibold text-foreground">
                Dados do projeto
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor={ID.codigo_projeto}>
                    Código do projeto <Obrigatorio />
                  </Label>
                  <Input
                    id={ID.codigo_projeto}
                    type="text"
                    value={formData.codigo_projeto || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, codigo_projeto: e.target.value })
                      limparErro('codigo_projeto')
                    }}
                    placeholder="PRJ-XXX"
                    aria-invalid={Boolean(erroDe('codigo_projeto')) || undefined}
                    aria-describedby={erroDe('codigo_projeto') ? `${ID.codigo_projeto}-erro` : undefined}
                    className="h-9 bg-card"
                    required
                  />
                  {erroDe('codigo_projeto') && (
                    <MensagemErro id={`${ID.codigo_projeto}-erro`}>{erroDe('codigo_projeto')}</MensagemErro>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={ID.cliente}>
                    Cliente <Obrigatorio />
                  </Label>
                  <Input
                    id={ID.cliente}
                    type="text"
                    value={formData.cliente || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, cliente: e.target.value })
                      limparErro('cliente')
                    }}
                    placeholder="Nome do cliente"
                    aria-invalid={Boolean(erroDe('cliente')) || undefined}
                    aria-describedby={erroDe('cliente') ? `${ID.cliente}-erro` : undefined}
                    className="h-9 bg-card"
                    required
                  />
                  {erroDe('cliente') && <MensagemErro id={`${ID.cliente}-erro`}>{erroDe('cliente')}</MensagemErro>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={ID.descricao}>
                    Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <textarea
                    id={ID.descricao}
                    value={formData.descricao || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, descricao: e.target.value })
                      limparErro('descricao')
                    }}
                    placeholder="Descrição do projeto"
                    rows={3}
                    aria-invalid={Boolean(erroDe('descricao')) || undefined}
                    aria-describedby={erroDe('descricao') ? `${ID.descricao}-erro` : undefined}
                    className={classeCampo}
                  />
                  {erroDe('descricao') && <MensagemErro id={`${ID.descricao}-erro`}>{erroDe('descricao')}</MensagemErro>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={ID.area_id}>
                    Área <Obrigatorio />
                  </Label>
                  <select
                    id={ID.area_id}
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
                      // Trocar a area refaz os campos dependentes: nenhuma mensagem antiga vale mais.
                      setErro(null)
                    }}
                    className={cn(classeCampo, 'h-9 py-0')}
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
                  <div className="space-y-1.5">
                    {areaUsaPavimentos ? (
                      <>
                        <Label htmlFor={ID.pavimentos}>
                          Pavimentos do empreendimento <Obrigatorio />
                        </Label>
                        <textarea
                          id={ID.pavimentos}
                          value={pavimentosText}
                          onChange={(e) => {
                            setPavimentosText(e.target.value)
                            limparErro('pavimentos')
                          }}
                          placeholder={'Subsolo\nTerreo\nPav. Tipo\nCobertura'}
                          rows={5}
                          aria-invalid={Boolean(erroDe('pavimentos')) || undefined}
                          aria-describedby={idsDescricao(`${ID.pavimentos}-ajuda`, erroDe('pavimentos') && `${ID.pavimentos}-erro`)}
                          className={classeCampo}
                          required={areaUsaPavimentos}
                        />
                        {erroDe('pavimentos') && (
                          <MensagemErro id={`${ID.pavimentos}-erro`}>{erroDe('pavimentos')}</MensagemErro>
                        )}
                        <div id={`${ID.pavimentos}-ajuda`} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Layers className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                          <span>Informe um pavimento por linha. Nomes vazios sao ignorados e nomes repetidos nao sao permitidos.</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 rounded-lg border border-dashed bg-card px-3 py-2.5 text-sm text-muted-foreground">
                        <Layers className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>Esta disciplina usa apenas etapas gerais; nao e necessario cadastrar pavimentos.</span>
                      </div>
                    )}
                  </div>
                )}

                {areaCompatibilizacao && (
                  <div className="space-y-1.5">
                    <Label htmlFor={ID.instancia_label}>
                      Identificação da compatibilização
                    </Label>
                    <Input
                      id={ID.instancia_label}
                      type="text"
                      value={formData.instancia_label || ''}
                      onChange={(e) => setFormData({ ...formData, instancia_label: e.target.value })}
                      placeholder="Ex.: Revisão Cliente"
                      maxLength={120}
                      aria-describedby={`${ID.instancia_label}-ajuda`}
                      className="h-9 bg-card"
                    />
                    <p id={`${ID.instancia_label}-ajuda`} className="text-xs text-muted-foreground">
                      Se ficar vazio, o sistema numera automaticamente.
                    </p>
                  </div>
                )}

                {areaComplemento && (
                  <div className="space-y-1.5">
                    <Label htmlFor={ID.complemento_area_ref_id}>
                      Disciplina do complemento <Obrigatorio />
                    </Label>
                    <select
                      id={ID.complemento_area_ref_id}
                      value={formData.complemento_area_ref_id ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        const areaId = Number(raw)
                        setFormData({
                          ...formData,
                          complemento_area_ref_id: isNaN(areaId) ? (raw as any) : areaId,
                        })
                        limparErro('complemento_area_ref_id')
                      }}
                      aria-invalid={Boolean(erroDe('complemento_area_ref_id')) || undefined}
                      aria-describedby={idsDescricao(
                        `${ID.complemento_area_ref_id}-ajuda`,
                        erroDe('complemento_area_ref_id') && `${ID.complemento_area_ref_id}-erro`
                      )}
                      className={cn(classeCampo, 'h-9 py-0')}
                      required={areaComplemento}
                    >
                      <option value="">Selecione a disciplina referida</option>
                      {areasReferenciaComplemento.map((area) => (
                        <option key={area.area_id} value={area.area_id}>
                          {area.descricao ?? area.codigo ?? 'Area'}
                        </option>
                      ))}
                    </select>
                    {erroDe('complemento_area_ref_id') && (
                      <MensagemErro id={`${ID.complemento_area_ref_id}-erro`}>
                        {erroDe('complemento_area_ref_id')}
                      </MensagemErro>
                    )}
                    <p id={`${ID.complemento_area_ref_id}-ajuda`} className="text-xs text-muted-foreground">
                      O sistema vai numerar automaticamente este complemento para a disciplina selecionada.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={ID.complexidade}>
                      Complexidade <Obrigatorio />
                    </Label>
                    <select
                      id={ID.complexidade}
                      value={formData.complexidade || 'media'}
                      onChange={(e) => setFormData({ ...formData, complexidade: e.target.value as any })}
                      className={cn(classeCampo, 'h-9 py-0')}
                      required
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={ID.data_prevista}>
                      Data prevista <Obrigatorio />
                    </Label>
                    <Input
                      id={ID.data_prevista}
                      type="date"
                      value={formData.data_prevista || ''}
                      onChange={(e) => {
                        setFormData({ ...formData, data_prevista: e.target.value })
                        limparErro('geral')
                      }}
                      className="h-9 bg-card tabular-nums"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={ID.eng_id}>
                    Engenheiro <Obrigatorio />
                  </Label>
                  <select
                    id={ID.eng_id}
                    value={formData.eng_id || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, eng_id: e.target.value })
                      limparErro('geral')
                    }}
                    className={cn(classeCampo, 'h-9 py-0')}
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

                {erroGeral && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-status-danger" aria-hidden="true" />
                    {erroGeral}
                  </div>
                )}

                <Button type="submit" size="lg" className="h-10 w-full">
                  <UserPlus />
                  Atribuir projeto
                </Button>
              </form>
            </section>

            {/* Lista de Engenheiros */}
            <section aria-labelledby="atribuir-engenheiros-titulo" className="min-w-0">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h3 id="atribuir-engenheiros-titulo" className="font-wide text-base font-semibold text-foreground">
                  Engenheiros disponíveis
                </h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Ordenados por pontuação
                </span>
              </div>

              <ul className="space-y-3">
                {engenheirosOrdenados.map((eng) => {
                  const recomendado = eng.eng_id === melhorEngenheiro.eng_id
                  return (
                    <li
                      key={eng.eng_id}
                      className={cn(
                        'rounded-xl border bg-card p-4 transition-colors',
                        recomendado
                          ? 'border-primary shadow-md ring-2 ring-primary/15'
                          : 'hover:border-primary/40'
                      )}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                            recomendado ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                          )}
                        >
                          {iniciais(eng.nome)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="truncate font-semibold text-foreground">{eng.nome}</h4>
                            {recomendado && (
                              <Badge>
                                <CheckCircle aria-hidden="true" />
                                Recomendado
                              </Badge>
                            )}
                            {eng.exclusivo && (
                              <Badge variant="secondary">
                                Exclusivo
                              </Badge>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                            Pontuação: {eng.pontuacao.toFixed(0)}/100
                          </div>
                        </div>
                      </div>

                      {/* Sobrecarga */}
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Sobrecarga</span>
                          <span className={cn('font-wide font-semibold tabular-nums', getSobrecargaColor(eng.sobrecarga))}>
                            {eng.sobrecarga.toFixed(0)}%
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`Sobrecarga de ${eng.nome}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(eng.sobrecarga)}
                          className="h-2 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border"
                        >
                          <div
                            className={cn('h-2 rounded-full', getSobrecargaBg(eng.sobrecarga))}
                            style={{ width: `${eng.sobrecarga}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Estatísticas */}
                      <dl className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/70 px-2.5 py-2">
                          <dt className="text-muted-foreground">Projetos</dt>
                          <dd className="font-wide text-sm font-semibold text-foreground tabular-nums">{eng.total_projetos}</dd>
                        </div>
                        <div className="rounded-lg bg-muted/70 px-2.5 py-2">
                          <dt className="text-muted-foreground">Áreas</dt>
                          <dd className="font-wide text-sm font-semibold text-foreground tabular-nums">{eng.areas_ativas}</dd>
                        </div>
                        <div className="rounded-lg bg-muted/70 px-2.5 py-2">
                          <dt className="text-muted-foreground">Dias</dt>
                          <dd className="font-wide text-sm font-semibold text-foreground tabular-nums">{eng.dias_trabalho_pendentes}</dd>
                        </div>
                      </dl>

                      {/* Alertas */}
                      {(eng.total_retrabalhos > 0 || eng.areas_atrasadas > 0) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-amber-700">
                          <AlertCircle className="size-4" aria-hidden="true" />
                          {eng.total_retrabalhos > 0 && <span>{eng.total_retrabalhos} retrabalho(s)</span>}
                          {eng.areas_atrasadas > 0 && <span>{eng.areas_atrasadas} atraso(s)</span>}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
