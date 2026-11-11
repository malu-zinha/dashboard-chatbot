'use client'

import React, { useState } from 'react'
import { X, FolderPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { criarProjeto } from '@/lib/supabase'

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

export default function CriarProjeto({ isOpen, onClose, onSuccess }: CriarProjetoProps) {
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (!isOpen) return null

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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="bg-linear-to-r from-tecpred-primary via-tecpred-secondary to-tecpred-primary p-6 rounded-t-xl border-b-4 border-tecpred-orange">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-7 h-7" />
                Criar Novo Projeto
              </h2>
              <p className="text-white/90 text-sm mt-1">
                Preencha os dados do projeto para cadastrá-lo na plataforma
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {successMessage && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código do Projeto <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.codigo}
                onChange={(e) =>
                  setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                }
                placeholder="ex: PRJ-001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent uppercase"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-400 mt-1">Mínimo 3 caracteres. Será salvo em maiúsculas.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Cliente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.cliente}
                onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
                placeholder="Nome do cliente"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva o projeto brevemente"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent resize-none"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-linear-to-r from-tecpred-orange to-tecpred-coral text-white rounded-lg hover:shadow-xl hover:scale-105 transition-all font-semibold border-2 border-tecpred-orange flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100 disabled:hover:shadow-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-5 h-5" />
                    Criar Projeto
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
