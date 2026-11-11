'use client'

import React, { useState, useRef } from 'react'
import { FileText, Upload, X } from 'lucide-react'

export default function MemoriaisDescritivosTab() {
  const [file, setFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) setFile(droppedFile)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleRemoveFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleGerarMemorial = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !prompt.trim()) return
    setIsLoading(true)
    setResultado(null)
    // Placeholder: em desenvolvimento; depois virá chamada à API
    setTimeout(() => {
      setResultado('Integração com backend em desenvolvimento. Arquivo: ' + file.name + ' | Prompt: ' + prompt.slice(0, 50) + '...')
      setIsLoading(false)
    }, 800)
  }

  const canSubmit = Boolean(file && prompt.trim())

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Memoriais Descritivos</h2>
        <p className="text-sm text-gray-500 mt-1">
          Envie o arquivo necessário, descreva as instruções no prompt e clique em Gerar memorial.
        </p>
      </div>

      <form onSubmit={handleGerarMemorial} className="space-y-6">
        {/* Bloco 1 – Upload de arquivo */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Arquivo
          </label>
          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={`
              min-h-[140px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors
              ${isDragging ? 'border-tecpred-primary bg-tecpred-light' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Selecionar arquivo"
            />
            <Upload className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-600 text-center px-4">
              Arraste o arquivo aqui ou clique para selecionar
            </p>
          </div>
          {file && (
            <div className="mt-3 flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-800 truncate">{file.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="p-1 rounded-sm hover:bg-gray-200 text-gray-500 hover:text-gray-700"
                aria-label="Remover arquivo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bloco 2 – Prompt */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <label htmlFor="memorial-prompt" className="block text-sm font-semibold text-gray-700 mb-3">
            Instruções para o memorial
          </label>
          <textarea
            id="memorial-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Descreva o que deve ser considerado no memorial..."
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-primary focus:border-tecpred-primary resize-y"
          />
        </div>

        {/* Bloco 3 – Ação */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="px-6 py-3 bg-linear-to-r from-tecpred-primary to-tecpred-secondary text-white rounded-lg font-semibold shadow-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-pulse">Gerando...</span>
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Gerar memorial
              </>
            )}
          </button>
        </div>

        {/* Bloco 4 – Área de resultado */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Memorial gerado</h3>
          <div className="min-h-[120px] p-4 border border-gray-200 rounded-lg bg-gray-50">
            {resultado ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{resultado}</p>
            ) : (
              <p className="text-sm text-gray-500">O memorial aparecerá aqui após o envio.</p>
            )}
          </div>
        </div>
      </form>
    </main>
  )
}
