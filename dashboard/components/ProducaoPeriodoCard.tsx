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
    <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Calculator className="w-5 h-5 text-tecpred-primary" />
          <h3 className="text-lg font-bold text-gray-900">
            Producao por engenheiro no periodo
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Horas do apontamento diario no WhatsApp. Dia sem registro = 0h.
          Valor = horas trabalhadas (o total do dia, que ja inclui o retrabalho) × valor da hora (nao grava a tarifa).
        </p>
      </div>

      <form onSubmit={handleConsultar} className="flex flex-wrap items-end gap-3 mb-4">
        <div>
          <label htmlFor="producao-inicio" className="block text-xs font-medium text-gray-600 mb-1">
            Data inicio
          </label>
          <input
            id="producao-inicio"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
          />
        </div>
        <div>
          <label htmlFor="producao-fim" className="block text-xs font-medium text-gray-600 mb-1">
            Data fim
          </label>
          <input
            id="producao-fim"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-tecpred-primary text-white rounded-lg hover:bg-tecpred-secondary transition-colors text-sm disabled:opacity-60"
        >
          {isLoading ? 'Consultando...' : 'Consultar'}
        </button>
      </form>

      {errorMessage && (
        <p className="text-sm text-danger mb-3">{errorMessage}</p>
      )}

      {consultou && rows && rows.length === 0 && !isLoading && (
        <p className="text-sm text-gray-500 py-3">
          Nenhum engenheiro com horas registradas neste periodo.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Engenheiro</th>
                <th className="py-2 pr-4 text-right">Horas trabalhadas (total)</th>
                <th className="py-2 pr-4 text-right">Dessas, retrabalho</th>
                <th className="py-2 pr-4 text-right">Valor da hora</th>
                <th className="py-2 pl-4 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const taxa = parseTaxa(taxas[row.eng_id] || '')
                const valor = taxa === null ? null : row.horas_trabalhadas_total * taxa
                return (
                  <tr
                    key={row.eng_id}
                    className={`border-b last:border-0 transition-colors ${
                      selectedEngId === row.eng_id ? 'bg-tecpred-light/70' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => setSelectedEngId(row.eng_id)}
                        className="text-left font-semibold text-tecpred-primary hover:text-tecpred-secondary hover:underline focus:outline-none focus:ring-2 focus:ring-tecpred-primary focus:ring-offset-2 rounded"
                      >
                        {row.engenheiro}
                      </button>
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-900">
                      {formatHoras(row.horas_trabalhadas_total)}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-500">
                      {formatHoras(row.horas_retrabalho_total)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]+([,.][0-9]{0,2})?"
                        aria-label={`Valor da hora para ${row.engenheiro}`}
                        placeholder="0,00"
                        value={taxas[row.eng_id] ?? ''}
                        onChange={(e) =>
                          setTaxas((prev) => ({ ...prev, [row.eng_id]: e.target.value }))
                        }
                        className="w-28 ml-auto px-2 py-1 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-tecpred-primary focus:border-transparent"
                      />
                    </td>
                    <td className="py-2 pl-4 text-right font-semibold text-gray-900">
                      {valor === null ? '—' : formatReais(valor)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold text-gray-900">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4 text-right">{formatHoras(totalHoras)}</td>
                <td className="py-2 pr-4 text-right text-gray-600">{formatHoras(totalRetrabalho)}</td>
                <td className="py-2 pr-4" />
                <td className="py-2 pl-4 text-right">
                  {algumValorPreenchido ? formatReais(totalValor) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>

          {detalheSelecionado && periodoConsultado && (
            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-bold text-gray-900">
                    Projetos no periodo - {detalheSelecionado.engenheiro}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {periodoConsultado.dataInicio} a {periodoConsultado.dataFim}
                  </p>
                </div>
                <div className="text-sm text-gray-700 sm:text-right">
                  <div className="font-semibold text-gray-900">
                    {formatHoras(detalheSelecionado.horas_trabalhadas_total)}
                  </div>
                  <div className="text-xs text-gray-500">
                    dessas, {formatHoras(detalheSelecionado.horas_retrabalho_total)} de retrabalho
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {detalheSelecionado.projetos.map((projeto) => (
                  <div
                    key={projeto.projeto_id}
                    className="rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {projeto.codigo_projeto}
                        </div>
                        <div className="text-xs text-gray-500">
                          {projeto.cliente}
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 sm:text-right">
                        <span className="font-semibold text-gray-900">
                          {formatHoras(projeto.horas_trabalhadas_total)}
                        </span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span>{formatHoras(projeto.horas_retrabalho_total)} retrab.</span>
                      </div>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b text-left text-gray-500">
                            <th className="py-2 pr-4">Area / disciplina</th>
                            <th className="py-2 pr-4 text-right">Horas trabalhadas (total)</th>
                            <th className="py-2 pl-4 text-right">Dessas, retrabalho</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projeto.disciplinas.map((disciplina) => (
                            <tr
                              key={`${projeto.projeto_id}-${disciplina.area_id}-${disciplina.instancia_label || disciplina.area_codigo}`}
                              className="border-b last:border-0"
                            >
                              <td className="py-2 pr-4 font-medium text-gray-800">
                                {disciplina.disciplina}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-900">
                                {formatHoras(disciplina.horas_trabalhadas_total)}
                              </td>
                              <td className="py-2 pl-4 text-right text-gray-600">
                                {formatHoras(disciplina.horas_retrabalho_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
