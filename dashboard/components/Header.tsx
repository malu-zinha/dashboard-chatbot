'use client'

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface HeaderProps {
  lastUpdate: Date | null
  isLoading: boolean
  isConnected?: boolean
  // Nome da secao atual (aparece ao lado do botao do menu).
  titulo?: string
}

// Barra do topo do painel. O logo, as secoes, o Admin e o Sair ficam no menu lateral
// (components/painel/AppSidebar.tsx).
export default function Header({ lastUpdate, isLoading, isConnected = true, titulo }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-sm md:px-6">
      <SidebarTrigger className="-ml-1" aria-label="Abrir ou recolher o menu" />
      <Separator orientation="vertical" className="h-5!" />
      {titulo && <span className="truncate text-sm font-medium text-foreground">{titulo}</span>}

      <div className="ml-auto flex items-center gap-2">
        <div
          className="flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground"
          title="Os dados se atualizam sozinhos quando algo muda no banco"
        >
          <RefreshCw className={cn('size-3.5 text-primary', isLoading && 'animate-spin')} />
          <span className="font-medium text-foreground">{isLoading ? 'Atualizando...' : 'Ao vivo'}</span>
          {lastUpdate && (
            <span className="hidden tabular-nums sm:inline">{lastUpdate.toLocaleTimeString('pt-BR')}</span>
          )}
        </div>
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            isConnected
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          )}
        >
          <span
            className={cn(
              'size-2 rounded-full',
              isConnected ? 'bg-emerald-500 animate-pulse-slow' : 'bg-red-500'
            )}
          />
          <span className="hidden sm:inline">{isConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>
    </header>
  )
}
