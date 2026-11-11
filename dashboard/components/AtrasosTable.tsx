import React from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AtrasosEngenheiro } from '../lib/supabase'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface AtrasosTableProps {
  data: AtrasosEngenheiro[]
  // Botao no canto do card (ex.: "Ver todos os engenheiros").
  acao?: React.ReactNode
}

// Mesmos cortes de antes: acima de 30 dias vermelho, acima de 15 laranja, senao amarelo.
function classeAtrasoMaximo(dias: number) {
  if (dias > 30) return 'bg-red-50 text-red-700 ring-red-200'
  if (dias > 15) return 'bg-orange-50 text-orange-700 ring-orange-200'
  return 'bg-amber-50 text-amber-700 ring-amber-200'
}

export default function AtrasosTable({ data, acao }: AtrasosTableProps) {
  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          Atrasos por engenheiro
        </CardTitle>
        <CardDescription>Quem tem projetos ou áreas com prazo vencido</CardDescription>
        {acao && <CardAction>{acao}</CardAction>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p>🎉 Nenhum atraso registrado!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Engenheiro</TableHead>
                <TableHead className="text-center">Projetos atrasados</TableHead>
                <TableHead className="text-center">Áreas atrasadas</TableHead>
                <TableHead className="text-center">Média de atraso</TableHead>
                <TableHead className="text-right">Atraso máximo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                // O primeiro da lista (mais atrasado) continua destacado.
                <TableRow key={item.eng_id} className={cn(index === 0 && 'bg-red-50/60 hover:bg-red-50')}>
                  <TableCell className="font-medium">{item.engenheiro}</TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-red-100 text-xs font-semibold text-red-700">
                      {item.qtde_projetos_atrasados}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="inline-flex size-7 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                      {item.qtde_areas_atrasadas}
                    </span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">
                    {item.dias_medios_atraso.toFixed(1)} dias
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums',
                        classeAtrasoMaximo(item.atraso_maximo_dias)
                      )}
                    >
                      {item.atraso_maximo_dias} dias
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
