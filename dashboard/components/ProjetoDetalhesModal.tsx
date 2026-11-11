'use client'

import React, { useEffect, useState } from 'react'
import { X, Calendar, User, Layers, Clock, AlertTriangle, CheckCircle, MessageSquare } from 'lucide-react'
import { formatarDataBR } from '@/lib/datas'
import { fetchApontamentosAtribuicao, type ResultadoApontamentos } from '@/lib/supabase'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
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

interface ProjetoDetalhesModalProps {
  isOpen: boolean
  onClose: () => void
  projeto: Projeto | null
}

export default function ProjetoDetalhesModal({
  isOpen,
  onClose,
  projeto: projetoAtual,
}: ProjetoDetalhesModalProps) {
  // O painel desliza para fora depois que o pai zera o projeto: guardamos o ultimo exibido
  // para a animacao de saida nao renderizar um painel vazio.
  const [ultimoProjeto, setUltimoProjeto] = useState<Projeto | null>(projetoAtual)
  if (projetoAtual && projetoAtual !== ultimoProjeto) setUltimoProjeto(projetoAtual)
  const projeto = projetoAtual ?? ultimoProjeto

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

  if (!projeto) return null

  // Efeito roda depois da pintura: ate ele responder, o estado honesto e "carregando", nao
  // "nao ha registro". Afirmar ausencia antes de olhar e o mesmo erro que esta branch corrige.
  const resultado = apontamentos && apontamentos.atribuicaoId === atribuicaoId
    ? apontamentos.resultado
    : null
  const relatosDiarios = resultado?.ok
    ? resultado.registros.filter((a) => a.feito_texto?.trim())
    : []

  // Mesma ordem de antes: concluido, atrasado, aguardando, em andamento.
  const getStatusColor = () => {
    if (projeto.data_conclusao || projeto.percentual_andamento >= 100) {
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
    }
    if (projeto.dias_atraso > 0) {
      return 'bg-orange-50 text-orange-800 ring-orange-200'
    }
    if (projeto.status_descricao?.toLowerCase().includes('aguard')) {
      return 'bg-amber-50 text-amber-800 ring-amber-200'
    }
    return 'bg-secondary text-primary ring-primary/15'
  }

  const concluido = projeto.percentual_andamento >= 100
  const percentual = Math.min(Math.max(projeto.percentual_andamento, 0), 100)

  return (
    <Sheet
      open={isOpen && projetoAtual !== null}
      onOpenChange={(aberto) => {
        if (!aberto) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
      >
        {/* Cabecalho: prancha azul */}
        <div className="malha-prancha shrink-0 px-5 py-5 text-white sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="font-wide text-xl leading-tight font-semibold text-white">
                {projeto.codigo_projeto}
              </SheetTitle>
              <SheetDescription className="mt-1 text-sm text-white/65">
                {projeto.cliente}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              title="Fechar"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Conteudo */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Status e Progresso */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                getStatusColor()
              )}
            >
              {projeto.status_descricao}
            </span>
            <div className="flex min-w-[160px] max-w-[220px] flex-1 items-center gap-2">
              <div className="hachura relative h-2 flex-1 overflow-hidden rounded-full bg-muted text-primary/15">
                <div
                  className={cn('h-full rounded-full', concluido ? 'bg-[var(--success)]' : 'bg-primary')}
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <span className="w-12 text-right text-sm font-semibold tabular-nums">
                {projeto.percentual_andamento.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Atraso */}
          {projeto.dias_atraso > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
              <AlertTriangle className="size-4 shrink-0 text-[var(--alert)]" />
              <span className="text-sm text-orange-900">
                <span className="font-semibold tabular-nums">{projeto.dias_atraso} dia(s)</span> de atraso
              </span>
            </div>
          )}

          {/* Concluido */}
          {projeto.data_conclusao && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle className="size-4 shrink-0 text-emerald-600" />
              <span className="text-sm text-emerald-800">
                Concluido em <span className="font-semibold tabular-nums">{formatarDataBR(projeto.data_conclusao)}</span>
              </span>
            </div>
          )}

          {/* Informacoes */}
          <div className="divide-y rounded-xl border">
            <div className="flex items-start gap-3 px-4 py-3">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Engenheiro</p>
                <p className="text-sm font-medium">{projeto.engenheiro_nome}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3">
              <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Area / Disciplina</p>
                <p className="text-sm font-medium">
                  {projeto.area_descricao}
                  {projeto.instancia_label && (
                    <span className="text-muted-foreground"> ({projeto.instancia_label})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3">
              <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Datas</p>
                <div className="space-y-0.5 text-sm">
                  <p>Inicio: <span className="font-medium tabular-nums">{formatarDataBR(projeto.data_inicio)}</span></p>
                  <p>Prevista: <span className="font-medium tabular-nums">{formatarDataBR(projeto.data_prevista)}</span></p>
                  {projeto.data_conclusao && (
                    <p>Conclusao: <span className="font-medium tabular-nums">{formatarDataBR(projeto.data_conclusao)}</span></p>
                  )}
                </div>
              </div>
            </div>

            {projeto.descricao && (
              <div className="flex items-start gap-3 px-4 py-3">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Descricao</p>
                  <p className="text-sm text-foreground/85">{projeto.descricao}</p>
                </div>
              </div>
            )}
          </div>

          {/* Observacoes do Engenheiro */}
          <section className="border-t pt-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="mb-2 text-sm font-semibold">Observacoes do engenheiro</h3>
                {projeto.motivo_aguardo ? (
                  <div className="rounded-lg border bg-muted/60 px-4 py-3">
                    <p className="text-sm whitespace-pre-wrap text-foreground/85">
                      {projeto.motivo_aguardo}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Nenhuma observacao registrada.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Relato diario do chatbot */}
          <section className="border-t pt-4">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h3 className="mb-2 text-sm font-semibold">Relato diario no chatbot</h3>

                {!atribuicaoId ? (
                  <p className="text-sm text-muted-foreground italic">
                    Sem atribuicao ativa — nao ha relato diario para consultar.
                  </p>
                ) : resultado === null ? (
                  <p className="text-sm text-muted-foreground italic" role="status">Carregando...</p>
                ) : !resultado.ok ? (
                  <p className="text-sm text-muted-foreground italic">
                    Nao foi possivel carregar o relato diario. Tente reabrir o projeto.
                  </p>
                ) : relatosDiarios.length > 0 ? (
                  <ul className="space-y-2">
                    {relatosDiarios.map((registro) => (
                      <li
                        key={registro.data_registro}
                        className="rounded-lg border bg-muted/60 px-4 py-2"
                      >
                        <p className="text-xs font-semibold text-primary tabular-nums">
                          {formatarDataBR(registro.data_registro)}
                        </p>
                        <p className="text-sm whitespace-pre-wrap text-foreground/85">
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
                    <p className="text-sm text-muted-foreground italic">
                      Nenhum registro diario gravado para esta disciplina.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      O relato diario so passou a ser gravado em 04/10/2026. Antes disso ele era
                      perdido na gravacao, entao a ausencia aqui nao indica falta de trabalho.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Rodape */}
        <div className="flex shrink-0 justify-end border-t bg-muted/50 px-5 py-3 sm:px-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
