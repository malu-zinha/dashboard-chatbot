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

interface RetrabalhoCardProps {
  data: RetrabalhoEngenheiro[]
  retrabalhoGeral: RetrabalhoGeral | null
  retrabalhoPorProjeto?: RetrabalhoPorProjeto[]
  motivosGeral?: RetrabalhoMotivo[]
  taxaAreaGeral?: RetrabalhoTaxaArea[]
  onSelectProjeto?: (projetoId: string) => void
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
    <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <h3 className="text-lg font-bold text-gray-900">
            Retrabalho por Engenheiro
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Visao geral TecPred + por projeto (clique na % para ver datas, engenheiro e motivo)
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-warning to-orange-600 rounded-lg p-4 text-white">
          <div className="text-sm font-medium opacity-90">Horas de Retrabalho</div>
          <div className="text-3xl font-bold mt-1">{totalHorasRetrabalho.toFixed(1)}h</div>
          <div className="text-xs opacity-90 mt-0.5">{totalRetrabalhos} ocorrencias</div>
        </div>
        <div className="bg-gradient-to-r from-tecpred-primary to-tecpred-secondary rounded-lg p-4 text-white">
          <div className="text-sm font-medium opacity-90">% Geral TecPred</div>
          <div className="text-3xl font-bold mt-1">
            {retrabalhoGeral ? `${retrabalhoGeral.percentual_geral_retrabalho.toFixed(1)}%` : '0%'}
          </div>
          <div className="text-xs opacity-90 mt-0.5">
            horas de retrabalho / horas trabalhadas totais
          </div>
        </div>
        <div className="bg-gradient-to-r from-danger to-red-600 rounded-lg p-4 text-white">
          <div className="text-sm font-medium opacity-90">Media por Horas</div>
          <div className="text-3xl font-bold mt-1">{mediaGeral.toFixed(1)}%</div>
          <div className="text-xs opacity-90 mt-0.5">
            media por horas dos engenheiros
          </div>
        </div>
      </div>

      {data.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Por engenheiro</h4>
          <div className="space-y-3">
            {data.slice(0, 5).map((item) => (
              <div
                key={item.eng_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.engenheiro}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.qtde_areas_retrabalho} areas • {item.projetos_com_retrabalho} projetos
                  </div>
                </div>
                <div className="text-right flex items-center space-x-3">
                  <div>
                    <div className="text-lg font-bold text-danger">
                      {(item.horas_retrabalho_total || 0).toFixed(1)}h
                    </div>
                    <div className="text-xs text-gray-500">horas retrab.</div>
                  </div>
                  <div>
                    <div
                      className={`text-lg font-bold ${
                        (item.retrabalho_medio_percentual || 0) > 20
                          ? 'text-danger'
                          : (item.retrabalho_medio_percentual || 0) > 10
                            ? 'text-warning'
                            : 'text-success'
                      }`}
                    >
                      {(item.retrabalho_medio_percentual ?? 0).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">por horas</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Por projeto</h4>
        <p className="text-xs text-gray-500 mb-3">
          % = horas de retrabalho / horas trabalhadas totais. Clique na % para ver areas, motivos e detalhes.
        </p>
        {retrabalhoPorProjeto && retrabalhoPorProjeto.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">Projeto</th>
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4 text-right">Horas retrab.</th>
                  <th className="py-2 pr-4 text-right">Horas totais</th>
                  <th className="py-2 pl-4 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {retrabalhoPorProjeto.map((item) => (
                  <tr
                    key={item.projeto_id}
                    className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-2 pr-4 font-medium text-gray-900">{item.codigo_projeto}</td>
                    <td className="py-2 pr-4 text-gray-700">{item.cliente}</td>
                    <td className="py-2 pr-4 text-right text-gray-900">
                      {(item.horas_retrabalho_total || 0).toFixed(1)}h
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-900">
                      {(item.horas_trabalhadas_total || 0).toFixed(1)}h
                    </td>
                    <td className="py-2 pl-4 text-right">
                      {onSelectProjeto ? (
                        <button
                          type="button"
                          onClick={() => onSelectProjeto(item.projeto_id)}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200"
                        >
                          {item.percentual_retrabalho_projeto.toFixed(1)}%
                        </button>
                      ) : (
                        <span className="text-orange-700 font-semibold">
                          {item.percentual_retrabalho_projeto.toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-3">Nenhum projeto com retrabalho registrado.</p>
        )}
      </div>

      {taxaAreaGeral.length > 0 && (
        <div className="pt-4 border-t border-gray-200 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">
            Retrabalho por area / projeto
          </h4>
          <RetrabalhoTaxaAreaChart data={taxaAreaGeral} />
        </div>
      )}

      {motivosGeral.length > 0 && (
        <div className="pt-4 border-t border-gray-200 mt-4">
          <MotivosPorTipo data={motivosGeral} escopo="TecPred" height={280} />
        </div>
      )}
    </div>
  )
}
