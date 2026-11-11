'use client'

import React from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  title: string
  subtitle?: string
  /**
   * Classes do gradiente do cabecalho, ex.: 'from-tecpred-primary to-tecpred-secondary'.
   * Mantido por compatibilidade: o cabecalho agora e sempre a prancha azul (malha-prancha).
   */
  headerGradientClass: string
  /** Desligar quando houver um modal aberto por cima, para o Escape nao fechar este por baixo */
  closeOnEscape?: boolean
  children: React.ReactNode
}

// Botoes do cabecalho: brancos sobre a prancha, com foco visivel.
const classeBotaoCabecalho =
  'inline-flex size-9 items-center justify-center rounded-lg text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70'

export default function ModalShell({
  isOpen,
  onClose,
  fullscreen,
  onToggleFullscreen,
  title,
  subtitle,
  closeOnEscape = true,
  children,
}: ModalShellProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        // Clique no fundo e Escape chegam aqui; o radix ja so entrega ao modal do topo.
        if (!aberto) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (!closeOnEscape) e.preventDefault()
        }}
        {...(subtitle ? {} : { 'aria-describedby': undefined })}
        className={cn(
          'flex flex-col gap-0 overflow-hidden bg-card p-0 text-card-foreground shadow-2xl ring-1 ring-black/10',
          fullscreen
            ? 'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:max-w-none'
            : 'max-h-[90vh] w-full max-w-[calc(100%-1rem)] rounded-xl sm:max-w-7xl'
        )}
      >
        <div className="malha-prancha shrink-0 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="font-wide text-lg leading-tight font-semibold text-white sm:text-xl">
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="mt-1 text-sm text-white/65 tabular-nums">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={onToggleFullscreen}
                className={classeBotaoCabecalho}
                aria-label={fullscreen ? 'Restaurar tamanho' : 'Expandir em tela cheia'}
                title={fullscreen ? 'Restaurar tamanho' : 'Expandir em tela cheia'}
                type="button"
              >
                {fullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
              </button>
              <button
                onClick={onClose}
                className={classeBotaoCabecalho}
                aria-label="Fechar"
                title="Fechar"
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {children}
      </DialogContent>
    </Dialog>
  )
}
