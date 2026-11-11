'use client'

import React, { useState } from 'react'
import { X, FolderPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { criarProjeto } from '@/lib/supabase'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface CriarProjetoProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface FormData {
  codigo: string
  cliente: string
  descricao: string
}

const emptyForm: FormData = {
  codigo: '',
  cliente: '',
  descricao: '',
}

// Textarea com o mesmo visual do Input do shadcn.
const classeTextarea =
  'w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

function Obrigatorio() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

export default function CriarProjeto({ isOpen, onClose, onSuccess }: CriarProjetoProps) {
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleClose = () => {
    setFormData(emptyForm)
    setSuccessMessage(null)
    setErrorMessage(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const codigo = formData.codigo.trim().toUpperCase()
    const cliente = formData.cliente.trim()
    const descricao = formData.descricao.trim()

    if (codigo.length < 3) {
      setErrorMessage('O código do projeto deve ter pelo menos 3 caracteres.')
      return
    }
    if (cliente.length < 2) {
      setErrorMessage('O nome do cliente deve ter pelo menos 2 caracteres.')
      return
    }
    if (descricao.length < 3) {
      setErrorMessage('A descrição deve ter pelo menos 3 caracteres.')
      return
    }

    setIsLoading(true)
    try {
      const resultado = await criarProjeto({ codigo, cliente, descricao })

      if (!resultado.success) {
        setErrorMessage(resultado.error || 'Erro desconhecido ao criar projeto.')
      } else {
        setSuccessMessage(`Projeto ${codigo} criado com sucesso!`)
        setFormData(emptyForm)
        onSuccess()
      }
    } catch {
      // Mensagem fixa: err.message pode carregar detalhe do PostgREST.
      setErrorMessage('Erro inesperado ao criar projeto.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        // Escape e clique no fundo chegam aqui; bloqueados enquanto a requisicao esta em andamento.
        if (!aberto && !isLoading) handleClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          // Foco inicial no primeiro campo, nao no botao de fechar.
          e.preventDefault()
          document.getElementById('criar-projeto-codigo')?.focus()
        }}
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
        className="flex max-h-[90vh] max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden bg-card p-0 text-card-foreground shadow-2xl ring-1 ring-black/10 sm:max-w-lg"
      >
        {/* Cabecalho: prancha azul, igual aos demais modais */}
        <div className="malha-prancha flex shrink-0 items-start justify-between gap-3 px-4 py-4 text-white sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
              <FolderPlus className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-wide text-lg leading-tight font-semibold text-white sm:text-xl">
                Criar novo projeto
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/65">
                Preencha os dados do projeto para cadastrá-lo na plataforma
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Fechar"
            title="Fechar"
            className="shrink-0 text-white/75 hover:bg-white/15 hover:text-white focus-visible:ring-white/50"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {successMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-status-success" aria-hidden="true" />
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-status-danger" aria-hidden="true" />
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="criar-projeto-codigo">
                Código do projeto <Obrigatorio />
              </Label>
              <Input
                id="criar-projeto-codigo"
                type="text"
                value={formData.codigo}
                onChange={(e) =>
                  setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                }
                placeholder="ex: PRJ-001"
                aria-describedby="criar-projeto-codigo-ajuda"
                className="h-9 uppercase"
                required
                disabled={isLoading}
              />
              <p id="criar-projeto-codigo-ajuda" className="text-xs text-muted-foreground">
                Mínimo 3 caracteres. Será salvo em maiúsculas.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="criar-projeto-cliente">
                Nome do cliente <Obrigatorio />
              </Label>
              <Input
                id="criar-projeto-cliente"
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                placeholder="Nome do cliente"
                className="h-9"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="criar-projeto-descricao">
                Descrição <Obrigatorio />
              </Label>
              <textarea
                id="criar-projeto-descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva o projeto brevemente"
                rows={4}
                className={classeTextarea}
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleClose}
                disabled={isLoading}
                className="sm:min-w-28"
              >
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={isLoading} className="px-4 sm:min-w-36">
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <FolderPlus />
                    Criar projeto
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
