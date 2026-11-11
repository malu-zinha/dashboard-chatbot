'use client'

import React from 'react'
import { Search, X } from 'lucide-react'
import { filterAndRank } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

interface EngenheirosTableProps {
  // Modo modal (padrao): controlado por isOpen/onClose.
  isOpen?: boolean
  onClose?: () => void
  data: Engenheiro[]
  // Embutido: mesma listagem dentro de um card na pagina, sem overlay nem botao de fechar.
  embutido?: boolean
}

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}

// Mesmos cortes de antes: 75% ou mais verde, 50% ou mais azul, abaixo disso laranja.
function corProgresso(pct: number) {
  if (pct >= 75) return 'bg-success'
  if (pct >= 50) return 'bg-info'
  return 'bg-warning'
}

// Mesmos cortes de antes: acima de 30 dias vermelho, acima de 15 laranja.
function corDiasPendentes(dias: number) {
  if (dias > 30) return 'text-danger'
  if (dias > 15) return 'text-warning'
  return 'text-foreground'
}

function Contador({ valor, tom }: { valor: number; tom: 'atencao' | 'perigo' }) {
  if (valor > 0) {
    return (
      <span
        className={cn(
          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ring-1 ring-inset',
          tom === 'atencao' ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-red-50 text-red-700 ring-red-200'
        )}
      >
        {valor}
      </span>
    )
  }
  return <span className="text-sm text-success tabular-nums">0</span>
}

export default function EngenheirosTable({ isOpen = false, onClose, data, embutido = false }: EngenheirosTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')

  const filteredData = filterAndRank(data, searchTerm, item => [item.nome])
  const contagem = `${filteredData.length} engenheiro(s) encontrado(s)`

  const busca = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar engenheiro..."
        aria-label="Buscar engenheiro"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="h-9 bg-card pl-9"
      />
    </div>
  )

  const tabela = (
    <table data-slot="table" className="w-full caption-bottom text-sm">
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-transparent">
          <TableHead className="px-4">Engenheiro</TableHead>
          <TableHead className="text-center">Tipo</TableHead>
          <TableHead className="text-center">Projetos</TableHead>
          <TableHead className="text-center">Áreas ativas</TableHead>
          <TableHead className="text-center">Progresso médio</TableHead>
          <TableHead className="text-center">Retrabalhos</TableHead>
          <TableHead className="text-center">Dias pendentes</TableHead>
          <TableHead className="pr-4 text-center">Áreas atrasadas</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredData.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
              Nenhum engenheiro encontrado
            </TableCell>
          </TableRow>
        ) : (
          filteredData.map((item) => {
            const pct = item.media_percentual ?? 0
            const dias = item.dias_trabalho_pendentes ?? 0
            return (
              <TableRow key={item.eng_id}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {iniciais(item.nome)}
                    </span>
                    <span className="font-medium text-foreground">{item.nome}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {item.exclusivo ? (
                    <Badge variant="secondary">Exclusivo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Freelancer</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-semibold tabular-nums">
                  {item.total_projetos ?? 0}
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {item.areas_ativas ?? 0}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    {/* Feito em cor cheia; o que falta hachurado, como corte em planta */}
                    <span className="flex h-2.5 w-20 overflow-hidden rounded-full bg-muted">
                      <span className={cn('h-full', corProgresso(pct))} style={{ width: `${Math.min(pct, 100)}%` }} />
                      <span className="hachura h-full flex-1 text-primary/20" />
                    </span>
                    <span className="w-12 text-right font-medium tabular-nums">{fmt1(pct)}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Contador valor={item.total_retrabalhos} tom="atencao" />
                </TableCell>
                <TableCell className="text-center">
                  <span className={cn('font-medium tabular-nums', corDiasPendentes(dias))}>
                    {dias} dias
                  </span>
                </TableCell>
                <TableCell className="pr-4 text-center">
                  <Contador valor={item.areas_atrasadas} tom="perigo" />
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </table>
  )

  const rodape = (
    <p className="w-full text-center text-sm text-muted-foreground tabular-nums">
      Mostrando {filteredData.length} de {data.length} engenheiros
    </p>
  )

  if (embutido) {
    return (
      <Card className="animate-fade-in gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Engenheiros</CardTitle>
          <CardDescription className="tabular-nums">{contagem}</CardDescription>
        </CardHeader>
        <CardContent className="border-b bg-muted/40 py-3">{busca}</CardContent>
        <div className="overflow-x-auto">{tabela}</div>
        <CardFooter className="py-3">{rodape}</CardFooter>
      </Card>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose?.() }}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-7xl"
      >
        <div className="malha-prancha flex items-start justify-between gap-4 px-6 py-5 text-white">
          <div className="min-w-0">
            <DialogTitle className="font-wide text-xl font-semibold text-white">Listagem de engenheiros</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-white/65 tabular-nums">{contagem}</DialogDescription>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              className="shrink-0 text-white hover:bg-white/15 hover:text-white focus-visible:ring-white/50"
            >
              <X />
            </Button>
          </DialogClose>
        </div>

        <div className="border-b bg-muted/40 p-4">{busca}</div>

        <div className="min-h-0 flex-1 overflow-auto">{tabela}</div>

        <div className="border-t bg-muted/40 px-4 py-3">{rodape}</div>
      </DialogContent>
    </Dialog>
  )
}
