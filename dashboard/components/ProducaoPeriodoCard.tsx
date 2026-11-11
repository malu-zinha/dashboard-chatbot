'use client'

import React, { useState } from 'react'
import { Calculator } from 'lucide-react'
import {
  fetchProducaoApontamentosPeriodo,
} from '@/lib/supabase'
import {
  buildProducaoPeriodo,
  getProducaoDetalheEngenheiro,
  type ProducaoPeriodo,
} from '@/lib/producaoPeriodo'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function parseTaxa(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function formatHoras(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h`
}

function formatReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ProducaoPeriodoCard() {
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [producao, setProducao] = useState<ProducaoPeriodo | null>(null)
  const [periodoConsultado, setPeriodoConsultado] = useState<{ dataInicio: string; dataFim: string } | null>(null)
  const [selectedEngId, setSelectedEngId] = useState<string | null>(null)
  const [taxas, setTaxas] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [consultou, setConsultou] = useState(false)

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!dataInicio || !dataFim) {
      setErrorMessage('Informe a data de inicio e a data de fim.')
      return
    }

    if (dataInicio > dataFim) {
      setErrorMessage('A data de inicio deve ser anterior ou igual a data de fim.')
      return
    }

    setIsLoading(true)
    setSelectedEngId(null)
    const periodo = { dataInicio, dataFim }
    try {
      const data = await fetchProducaoApontamentosPeriodo(periodo.dataInicio, periodo.dataFim)
      setProducao(buildProducaoPeriodo(data, periodo))
      setPeriodoConsultado(periodo)
      setConsultou(true)
    } catch {
      setErrorMessage('Erro ao buscar producao no periodo.')
      setProducao(null)
      setPeriodoConsultado(null)
    } finally {
      setIsLoading(false)
    }
  }

  const rows = producao?.resumo || null
  const detalheSelecionado = producao
    ? getProducaoDetalheEngenheiro(producao, selectedEngId)
    : null
  const totalHoras = (rows || []).reduce((sum, row) => sum + row.horas_trabalhadas_total, 0)
  const totalRetrabalho = (rows || []).reduce((sum, row) => sum + row.horas_retrabalho_total, 0)
  const totalValor = (rows || []).reduce((sum, row) => {
    const taxa = parseTaxa(taxas[row.eng_id] || '')
    if (taxa === null) return sum
    return sum + row.horas_trabalhadas_total * taxa
  }, 0)
  const algumValorPreenchido = (rows || []).some((row) => parseTaxa(taxas[row.eng_id] || '') !== null)

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          Producao por engenheiro no periodo
        </CardTitle>
        <CardDescription className="text-xs">
          Horas do apontamento diario no WhatsApp. Dia sem registro = 0h.
          Valor = horas trabalhadas (o total do dia, que ja inclui o retrabalho) × valor da hora (nao grava a tarifa).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form
          onSubmit={handleConsultar}
          className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/40 p-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="producao-inicio" className="text-xs text-muted-foreground">
              Data inicio
            </Label>
            <Input
              id="producao-inicio"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-9 w-auto bg-card tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="producao-fim" className="text-xs text-muted-foreground">
              Data fim
            </Label>
            <Input
              id="producao-fim"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-9 w-auto bg-card tabular-nums"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="h-9 px-4">
            {isLoading ? 'Consultando...' : 'Consultar'}
          </Button>
        </form>

        {errorMessage && (
          <p role="alert" className="text-sm text-danger">{errorMessage}</p>
        )}

        {consultou && rows && rows.length === 0 && !isLoading && (
          <p className="py-3 text-sm text-muted-foreground">
            Nenhum engenheiro com horas registradas neste periodo.
          </p>
        )}

        {rows && rows.length > 0 && (
          <div className="space-y-5">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Engenheiro</TableHead>
                  <TableHead className="text-right">Horas trabalhadas (total)</TableHead>
                  <TableHead className="text-right">Dessas, retrabalho</TableHead>
                  <TableHead className="text-right">Valor da hora</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const taxa = parseTaxa(taxas[row.eng_id] || '')
                  const valor = taxa === null ? null : row.horas_trabalhadas_total * taxa
                  const selecionado = selectedEngId === row.eng_id
                  return (
                    <TableRow
                      key={row.eng_id}
                      data-state={selecionado ? 'selected' : undefined}
                      className={cn(selecionado && 'bg-accent hover:bg-accent')}
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setSelectedEngId(row.eng_id)}
                          aria-pressed={selecionado}
                          className="rounded-sm text-left font-semibold text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {row.engenheiro}
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHoras(row.horas_trabalhadas_total)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {formatHoras(row.horas_retrabalho_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text"
                          inputMode="decimal"
                          pattern="[0-9]+([,.][0-9]{0,2})?"
                          aria-label={`Valor da hora para ${row.engenheiro}`}
                          placeholder="0,00"
                          value={taxas[row.eng_id] ?? ''}
                          onChange={(e) =>
                            setTaxas((prev) => ({ ...prev, [row.eng_id]: e.target.value }))
                          }
                          className="ml-auto w-28 bg-card text-right tabular-nums"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {valor === null ? '—' : formatReais(valor)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatHoras(totalHoras)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{formatHoras(totalRetrabalho)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {algumValorPreenchido ? formatReais(totalValor) : '—'}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {detalheSelecionado && periodoConsultado && (
              <section className="overflow-hidden rounded-lg border">
                <div className="flex flex-col gap-2 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold">
                      Projetos no periodo - {detalheSelecionado.engenheiro}
                    </h4>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {periodoConsultado.dataInicio} a {periodoConsultado.dataFim}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="font-wide text-xl font-semibold tabular-nums">
                      {formatHoras(detalheSelecionado.horas_trabalhadas_total)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      dessas, {formatHoras(detalheSelecionado.horas_retrabalho_total)} de retrabalho
                    </div>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  {detalheSelecionado.projetos.map((projeto) => (
                    <div key={projeto.projeto_id} className="rounded-lg border bg-card p-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-semibold text-primary">{projeto.codigo_projeto}</div>
                          <div className="text-xs text-muted-foreground">{projeto.cliente}</div>
                        </div>
                        <div className="text-sm sm:text-right tabular-nums">
                          <span className="font-semibold">{formatHoras(projeto.horas_trabalhadas_total)}</span>
                          <span className="mx-2 text-border">|</span>
                          <span className="text-muted-foreground">
                            {formatHoras(projeto.horas_retrabalho_total)} retrab.
                          </span>
                        </div>
                      </div>

                      <Table className="mt-3 text-xs">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-xs text-muted-foreground">Area / disciplina</TableHead>
                            <TableHead className="h-8 text-right text-xs text-muted-foreground">Horas trabalhadas (total)</TableHead>
                            <TableHead className="h-8 text-right text-xs text-muted-foreground">Dessas, retrabalho</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projeto.disciplinas.map((disciplina) => (
                            <TableRow
                              key={`${projeto.projeto_id}-${disciplina.area_id}-${disciplina.instancia_label || disciplina.area_codigo}`}
                            >
                              <TableCell className="font-medium">{disciplina.disciplina}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatHoras(disciplina.horas_trabalhadas_total)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground tabular-nums">
                                {formatHoras(disciplina.horas_retrabalho_total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
