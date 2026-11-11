'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare,
  UserPlus,
  Loader2,
  Power,
  Pencil,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

interface EngenheiroChatbot {
  eng_id: string
  nome: string
  telefone: string
  exclusivo: boolean
  ativo: boolean
}

export default function EngenheirosChatbotAdmin() {
  const [list, setList] = useState<EngenheiroChatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // form de criação
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [exclusivo, setExclusivo] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // edição inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editExclusivo, setEditExclusivo] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/engenheiros', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar engenheiros.')
      setList(json.engenheiros as EngenheiroChatbot[])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar engenheiros.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)
    try {
      const res = await fetch('/api/admin/engenheiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim(), exclusivo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao cadastrar.')
      setFormSuccess(`${json.engenheiro.nome} cadastrado (${json.engenheiro.telefone}).`)
      setNome('')
      setTelefone('')
      setExclusivo(false)
      await loadList()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar.')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(eng: EngenheiroChatbot) {
    setEditId(eng.eng_id)
    setEditNome(eng.nome)
    setEditTelefone(eng.telefone)
    setEditExclusivo(eng.exclusivo)
  }

  function cancelEdit() {
    setEditId(null)
  }

  async function patchEng(id: string, patch: Record<string, unknown>) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/engenheiros/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao atualizar.')
      setList((prev) =>
        prev.map((e) => (e.eng_id === id ? (json.engenheiro as EngenheiroChatbot) : e))
      )
      return true
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function saveEdit(id: string) {
    const ok = await patchEng(id, {
      nome: editNome.trim(),
      telefone: editTelefone.trim(),
      exclusivo: editExclusivo,
    })
    if (ok) setEditId(null)
  }

  async function toggleAtivo(eng: EngenheiroChatbot) {
    const novo = !eng.ativo
    const acao = novo ? 'reativar' : 'desativar'
    if (!confirm(`Tem certeza que deseja ${acao} ${eng.nome} no chatbot?`)) return
    await patchEng(eng.eng_id, { ativo: novo })
  }

  return (
    <section className="mt-8">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-tecpred-primary" />
          <h2 className="text-lg font-bold text-gray-900">Engenheiros do Chatbot</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Quem o chatbot atende no WhatsApp (pelo telefone). Não é o mesmo que login do dashboard.
        </p>

        {/* Form de cadastro */}
        <form
          onSubmit={handleCreate}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-6"
        >
          <div className="md:col-span-4">
            <label htmlFor="eng-nome" className="block text-sm font-medium text-gray-700 mb-1">
              Nome
            </label>
            <input
              id="eng-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
              placeholder="Nome do engenheiro"
            />
          </div>
          <div className="md:col-span-4">
            <label htmlFor="eng-tel" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone (WhatsApp)
            </label>
            <input
              id="eng-tel"
              type="tel"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
              placeholder="+5583991234567"
            />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={exclusivo}
                onChange={(e) => setExclusivo(e.target.checked)}
                className="w-4 h-4 rounded-sm border-gray-300 text-tecpred-primary focus:ring-tecpred-orange"
              />
              Exclusivo
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-tecpred-primary hover:bg-tecpred-secondary text-white font-semibold px-4 py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              Adicionar
            </button>
          </div>

          {formError && (
            <div className="md:col-span-12 flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="md:col-span-12 flex items-center gap-2 text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {formSuccess}
            </div>
          )}
        </form>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-4 font-medium">Nome</th>
                  <th className="py-2 pr-4 font-medium">Telefone</th>
                  <th className="py-2 pr-4 font-medium">Exclusivo</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((eng) => {
                  const editing = editId === eng.eng_id
                  const busy = busyId === eng.eng_id
                  return (
                    <tr key={eng.eng_id} className="border-b border-gray-100 last:border-0">
                      <td className="py-3 pr-4">
                        {editing ? (
                          <input
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded-sm focus:ring-2 focus:ring-tecpred-orange outline-hidden"
                          />
                        ) : (
                          <span className="font-medium text-gray-900">{eng.nome}</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">
                        {editing ? (
                          <input
                            value={editTelefone}
                            onChange={(e) => setEditTelefone(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded-sm focus:ring-2 focus:ring-tecpred-orange outline-hidden"
                          />
                        ) : (
                          eng.telefone
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editing ? (
                          <input
                            type="checkbox"
                            checked={editExclusivo}
                            onChange={(e) => setEditExclusivo(e.target.checked)}
                            className="w-4 h-4 rounded-sm border-gray-300 text-tecpred-primary focus:ring-tecpred-orange"
                          />
                        ) : eng.exclusivo ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-tecpred-primary/10 text-tecpred-primary">
                            Sim
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Não</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            eng.ativo
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              eng.ativo ? 'bg-success' : 'bg-danger'
                            }`}
                          />
                          {eng.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          {editing ? (
                            <>
                              <button
                                onClick={() => saveEdit(eng.eng_id)}
                                disabled={busy}
                                title="Salvar"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-success text-success hover:bg-success hover:text-white transition disabled:opacity-60"
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                Salvar
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={busy}
                                title="Cancelar"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-500 hover:bg-gray-100 transition"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(eng)}
                                title="Editar"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                onClick={() => toggleAtivo(eng)}
                                disabled={busy}
                                title={eng.ativo ? 'Desativar' : 'Reativar'}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60 ${
                                  eng.ativo
                                    ? 'border border-danger text-danger hover:bg-danger hover:text-white'
                                    : 'border border-success text-success hover:bg-success hover:text-white'
                                }`}
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                                {eng.ativo ? 'Desativar' : 'Reativar'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
