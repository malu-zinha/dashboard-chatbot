import React from 'react'
import { ArrowRight, LucideIcon, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  onClick?: () => void
  onExpand?: () => void
}

// Cor so no icone: o card fica neutro e o numero e o destaque.
const iconClasses = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
}

export default function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'primary',
  trend,
  trendValue,
  onClick,
  onExpand,
}: KPICardProps) {
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-all duration-200 animate-fade-in',
        onClick && 'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md'
      )}
    >
      <Wrapper
        onClick={onClick}
        className="block w-full p-5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconClasses[color])}>
            <Icon className="size-[18px]" />
          </div>
        </div>

        <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}

        {trend && trendValue && (
          <p
            className={cn(
              'mt-2 text-xs font-semibold',
              trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
            )}
          >
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </p>
        )}

        {onClick && (
          <p className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
            Ver detalhes
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        )}
      </Wrapper>

      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          aria-label={`Expandir ${title} em tela cheia`}
          title="Abrir em tela cheia"
          className="absolute right-3 bottom-3 rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-primary"
        >
          <Maximize2 className="size-4" />
        </button>
      )}
    </div>
  )
}
