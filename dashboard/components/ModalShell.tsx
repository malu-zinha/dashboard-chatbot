'use client'

import React, { useCallback, useEffect, useId } from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'

interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  title: string
  subtitle?: string
  /** Classes do gradiente do cabecalho, ex.: 'from-tecpred-primary to-tecpred-secondary' */
  headerGradientClass: string
  /** Desligar quando houver um modal aberto por cima, para o Escape nao fechar este por baixo */
  closeOnEscape?: boolean
  children: React.ReactNode
}

export default function ModalShell({
  isOpen,
  onClose,
  fullscreen,
  onToggleFullscreen,
  title,
  subtitle,
  headerGradientClass,
  closeOnEscape = true,
  children,
}: ModalShellProps) {
  const titleId = useId()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    document.body.style.overflow = 'hidden'
    if (closeOnEscape) document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      if (closeOnEscape) document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeOnEscape, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center ${
        fullscreen ? '' : 'p-4'
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white shadow-2xl flex flex-col animate-fade-in ${
          fullscreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none'
            : 'w-full max-w-7xl max-h-[90vh] rounded-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`bg-gradient-to-r ${headerGradientClass} p-6 ${
            fullscreen ? '' : 'rounded-t-xl'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 id={titleId} className="text-2xl font-bold text-white">
                {title}
              </h2>
              {subtitle && (
                <p className="text-white text-opacity-90 text-sm mt-1">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleFullscreen}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                aria-label={fullscreen ? 'Restaurar tamanho' : 'Expandir em tela cheia'}
                type="button"
              >
                {fullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
              </button>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                aria-label="Fechar"
                type="button"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
