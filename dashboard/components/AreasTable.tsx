'use client'

import React from 'react'
import { Folder, Search, X } from 'lucide-react'
import { filterAndRank } from '@/lib/search'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface Area {
  area_id: string | number
  codigo: string
  descricao: string
  tempo_trabalho_dias: number
  total_projetos: number
  areas_ativas: number
  areas_concluidas: number
  percentual_conclusao: number
}

interface AreasTableProps {
  // Modo modal (padrao): controlado por isOpen/onClose.
  isOpen?: boolean
  onClose?: () => void
  data: Area[]
  // Embutido: mesma listagem dentro de um card na pagina, sem overlay nem botao de fechar.
  embutido?: boolean
}

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function AreasTable({ isOpen = false, onClose, data, embutido = false }: AreasTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('')

  const filteredData = filterAndRank(data, searchTerm, item => [item.descricao, item.codigo])
  const contagem = `${filteredData.length} área(s) encontrada(s)`

  const busca = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Buscar área..."
        aria-label="Buscar área"
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
          <TableHead className="px-4">Área</TableHead>
          <TableHead className="text-center">Código</TableHead>
          <TableHead className="text-center">Tempo médio</TableHead>
          <TableHead className="text-center">Total de projetos</TableHead>
          <TableHead className="text-center">Áreas ativas</TableHead>
          <TableHead className="text-center">Concluídas</TableHead>
          <TableHead className="pr-4 text-center">Taxa de conclusão</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredData.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
              Nenhuma área encontrada
            </TableCell>
          </TableRow>
        ) : (
          filteredData.map((item) => {
            const pct = item.percentual_conclusao ?? 0
            return (
              <TableRow key={item.area_id}>
                <TableCell className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Folder className="size-4" />
                    </span>
                    <span className="font-medium text-foreground">{item.descricao}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-mono">{item.codigo}</Badge>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {item.tempo_trabalho_dias ?? 0} dias
                </TableCell>
                <TableCell className="text-center font-semibold tabular-nums">
                  {item.total_projetos ?? 0}
                </TableCell>
                <TableCell className="text-center font-medium text-info tabular-nums">
                  {item.areas_ativas ?? 0}
                </TableCell>
                <TableCell className="text-center font-medium text-success tabular-nums">
                  {item.areas_concluidas ?? 0}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-center gap-2">
                    {/* Concluido em cor cheia; o que falta hachurado, como corte em planta */}
                    <span className="flex h-2.5 w-20 overflow-hidden rounded-full bg-muted">
                      <span className="h-full bg-success" style={{ width: `${Math.min(pct, 100)}%` }} />
                      <span className="hachura h-full flex-1 text-primary/20" />
                    </span>
                    <span className="w-12 text-right font-medium tabular-nums">{fmt1(pct)}%</span>
                  </div>
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
      Mostrando {filteredData.length} de {data.length} áreas
    </p>
  )

  if (embutido) {
    return (
      <Card className="animate-fade-in gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Áreas</CardTitle>
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
        className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <div className="malha-prancha flex items-start justify-between gap-4 px-6 py-5 text-white">
          <div className="min-w-0">
            <DialogTitle className="font-wide text-xl font-semibold text-white">Listagem de áreas</DialogTitle>
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
