import React from 'react'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AtalhoCardProps {
  titulo: string
  descricao: string
  icone: LucideIcon
  valor?: string | number
  tom?: 'primario' | 'sucesso' | 'alerta' | 'perigo'
  onClick: () => void
}

const TONS = {
  primario: 'bg-primary/10 text-primary',
  sucesso: 'bg-emerald-50 text-emerald-600',
  alerta: 'bg-amber-50 text-amber-600',
  perigo: 'bg-red-50 text-red-600',
}

// Card clicavel que abre uma lista (projetos, engenheiros, areas).
export default function AtalhoCard({ titulo, descricao, icone: Icone, valor, tom = 'primario', onClick }: AtalhoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-4 rounded-xl border bg-card p-5 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONS[tom])}>
        <Icone className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{titulo}</span>
          {valor !== undefined && <span className="text-2xl font-semibold tabular-nums">{valor}</span>}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{descricao}</span>
        <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
          Abrir
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  )
}
