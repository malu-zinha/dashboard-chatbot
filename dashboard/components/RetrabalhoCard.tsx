import React from 'react'
import { AlertCircle } from 'lucide-react'
import {
  RetrabalhoEngenheiro,
  RetrabalhoGeral,
  RetrabalhoPorProjeto,
  RetrabalhoMotivo,
  RetrabalhoTaxaArea,
} from '@/lib/supabase'
import MotivosPorTipo from '@/components/MotivosPorTipo'
import RetrabalhoTaxaAreaChart from '@/components/RetrabalhoTaxaAreaChart'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface RetrabalhoCardProps {
  data: RetrabalhoEngenheiro[]
  retrabalhoGeral: RetrabalhoGeral | null
  retrabalhoPorProjeto?: RetrabalhoPorProjeto[]
  motivosGeral?: RetrabalhoMotivo[]
  taxaAreaGeral?: RetrabalhoTaxaArea[]
  onSelectProjeto?: (projetoId: string) => void
}

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Mesmos cortes de antes: acima de 20% vermelho, acima de 10% laranja, senao verde.
function corPercentual(pct: number) {
  if (pct > 20) return 'text-danger'
  if (pct > 10) return 'text-warning'
  return 'text-success'
}

// Celula do carimbo (versao clara): rotulo, numero largo e uma linha de detalhe.
function CelulaCarimbo({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string
  valor: string
  detalhe: string
  destaque?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 bg-card px-4 py-3.5">
      <span className="text-[13px] text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          'font-wide text-[2rem] leading-none font-semibold tabular-nums',
          destaque ? 'text-primary' : 'text-foreground'
        )}
      >
        {valor}
      </span>
      <span className="text-xs text-muted-foreground">{detalhe}</span>
    </div>
  )
}

export default function RetrabalhoCard({
  data,
  retrabalhoGeral,
  retrabalhoPorProjeto = [],
  motivosGeral = [],
  taxaAreaGeral = [],
  onSelectProjeto,
}: RetrabalhoCardProps) {
  const totalRetrabalhos = data.reduce((sum, item) => sum + item.total_retrabalhos, 0)
  const totalHorasRetrabalho =
    retrabalhoGeral?.horas_retrabalho_total ??
    data.reduce((sum, item) => sum + (item.horas_retrabalho_total || 0), 0)
  const mediaGeral = data.length > 0
    ? data.reduce((sum, item) => sum + (item.retrabalho_medio_percentual || 0), 0) / data.length
    : 0

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="size-4 text-[var(--alert)]" />
          Retrabalho por engenheiro
        </CardTitle>
        <CardDescription>
          Visão geral TecPred e por projeto (clique na % para ver datas, engenheiro e motivo)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Carimbo claro: tres indicadores separados por linhas finas */}
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
            <CelulaCarimbo
              rotulo="Horas de retrabalho"
              valor={`${fmt1(totalHorasRetrabalho)}h`}
              detalhe={`${totalRetrabalhos} ocorrências`}
            />
            <CelulaCarimbo
              rotulo="% geral TecPred"
              valor={retrabalhoGeral ? `${fmt1(retrabalhoGeral.percentual_geral_retrabalho)}%` : '0%'}
              detalhe="horas de retrabalho / horas trabalhadas totais"
              destaque
            />
            <CelulaCarimbo
              rotulo="Média por horas"
              valor={`${fmt1(mediaGeral)}%`}
              detalhe="média por horas dos engenheiros"
            />
          </div>
        </div>

        {data.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-semibold">Por engenheiro</h4>
            <ul className="divide-y rounded-lg border">
              {data.slice(0, 5).map((item) => {
                const pct = item.retrabalho_medio_percentual || 0
                return (
                  <li
                    key={item.eng_id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {iniciais(item.engenheiro)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{item.engenheiro}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {item.qtde_areas_retrabalho} áreas, {item.projetos_com_retrabalho} projetos
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-5 text-right">
                      <div>
                        <div className="text-base font-semibold text-danger tabular-nums">
                          {fmt1(item.horas_retrabalho_total || 0)}h
                        </div>
                        <div className="text-xs text-muted-foreground">horas retrab.</div>
                      </div>
                      <div>
                        <div className={cn('text-base font-semibold tabular-nums', corPercentual(pct))}>
                          {fmt1(item.retrabalho_medio_percentual ?? 0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">por horas</div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <Separator />

        <section>
          <h4 className="text-sm font-semibold">Por projeto</h4>
          <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
            % = horas de retrabalho / horas trabalhadas totais. Clique na % para ver áreas, motivos e detalhes.
          </p>
          {retrabalhoPorProjeto && retrabalhoPorProjeto.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Horas retrab.</TableHead>
                  <TableHead className="text-right">Horas totais</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {retrabalhoPorProjeto.map((item) => {
                  const pct = `${fmt1(item.percentual_retrabalho_projeto)}%`
                  return (
                    <TableRow key={item.projeto_id}>
                      <TableCell className="font-medium">{item.codigo_projeto}</TableCell>
                      <TableCell className="text-muted-foreground">{item.cliente}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt1(item.horas_retrabalho_total || 0)}h
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt1(item.horas_trabalhadas_total || 0)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {onSelectProjeto ? (
                          <button
                            type="button"
                            onClick={() => onSelectProjeto(item.projeto_id)}
                            aria-label={`Ver retrabalho do projeto ${item.codigo_projeto}: ${pct}`}
                            className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 tabular-nums transition-colors hover:bg-orange-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {pct}
                          </button>
                        ) : (
                          <span className="font-semibold text-orange-700 tabular-nums">{pct}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">Nenhum projeto com retrabalho registrado.</p>
          )}
        </section>

        {taxaAreaGeral.length > 0 && (
          <>
            <Separator />
            <section>
              <h4 className="mb-1 text-sm font-semibold">Retrabalho por área / projeto</h4>
              <RetrabalhoTaxaAreaChart data={taxaAreaGeral} onSelecionarProjeto={onSelectProjeto} />
            </section>
          </>
        )}

        {motivosGeral.length > 0 && (
          <>
            <Separator />
            <MotivosPorTipo data={motivosGeral} escopo="TecPred" height={280} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
