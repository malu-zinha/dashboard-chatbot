'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Shield,
  UserPlus,
  Loader2,
  ArrowLeft,
  Power,
  CheckCircle2,
  AlertCircle,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import EngenheirosChatbotAdmin from '@/components/EngenheirosChatbotAdmin'

interface AdminClientProps {
  ownerId: string
  ownerEmail: string
}

interface ProfileRow {
  user_id: string
  email: string | null
  display_name: string | null
  role: 'owner' | 'engenheiro'
  status: 'active' | 'inactive'
  created_at: string
}

export default function AdminClient({ ownerId, ownerEmail }: AdminClientProps) {
  const router = useRouter()
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar usuários.')
      setUsers(json.users as ProfileRow[])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFormSuccess(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          display_name: displayName.trim(),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao criar login.')
      setFormSuccess(`Login criado para ${json.user.email}.`)
      setEmail('')
      setPassword('')
      setDisplayName('')
      await loadUsers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar login.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(user: ProfileRow) {
    const novoStatus = user.status === 'active' ? 'inactive' : 'active'
    const acao = novoStatus === 'inactive' ? 'desativar' : 'reativar'
    if (!confirm(`Tem certeza que deseja ${acao} o acesso de ${user.email}?`)) {
      return
    }
    setBusyId(user.user_id)
    try {
      const res = await fetch(`/api/admin/users/${user.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao atualizar status.')
      setUsers((prev) =>
        prev.map((u) => (u.user_id === user.user_id ? { ...u, status: novoStatus } : u))
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-tecpred-light">
      {/* Top bar */}
      <header className="bg-linear-to-r from-tecpred-primary via-tecpred-secondary to-tecpred-primary shadow-lg border-b-4 border-tecpred-orange">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/logo.png"
              alt="TecPred"
              width={240}
              height={76}
              priority
              className="h-12 w-auto brightness-110 contrast-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.45)]"
            />
            <div className="flex items-center gap-2 text-white">
              <Shield className="w-5 h-5 text-tecpred-orange" />
              <h1 className="text-lg font-semibold">Painel Administrativo</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition text-white text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Dashboard</span>
            </Link>
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 bg-white/10 hover:bg-white/20 transition text-white text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Criar login */}
        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-tecpred-primary" />
              <h2 className="text-lg font-bold text-gray-900">Criar login de engenheiro</h2>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Nome
                </label>
                <input
                  id="name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
                  placeholder="Nome do engenheiro"
                />
              </div>
              <div className="md:col-span-1">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
                  placeholder="engenheiro@empresa.com"
                />
              </div>
              <div className="md:col-span-1">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Senha provisória
                </label>
                <input
                  id="password"
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
                  placeholder="mín. 6 caracteres"
                />
              </div>

              {formError && (
                <div className="md:col-span-3 flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="md:col-span-3 flex items-center gap-2 text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {formSuccess}
                </div>
              )}

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 bg-tecpred-primary hover:bg-tecpred-secondary text-white font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" /> Criar login
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Lista de usuários */}
        <section>
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Logins da plataforma</h2>

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
                      <th className="py-2 pr-4 font-medium">Email</th>
                      <th className="py-2 pr-4 font-medium">Papel</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isOwner = u.role === 'owner'
                      const isSelf = u.user_id === ownerId
                      const ativo = u.status === 'active'
                      return (
                        <tr key={u.user_id} className="border-b border-gray-100 last:border-0">
                          <td className="py-3 pr-4 font-medium text-gray-900">
                            {u.display_name || '—'}
                          </td>
                          <td className="py-3 pr-4 text-gray-600">{u.email || '—'}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                isOwner
                                  ? 'bg-tecpred-primary/10 text-tecpred-primary'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isOwner && <Shield className="w-3 h-3" />}
                              {isOwner ? 'Owner' : 'Engenheiro'}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                ativo
                                  ? 'bg-success/10 text-success'
                                  : 'bg-danger/10 text-danger'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  ativo ? 'bg-success' : 'bg-danger'
                                }`}
                              />
                              {ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            {isOwner || isSelf ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <button
                                onClick={() => handleToggle(u)}
                                disabled={busyId === u.user_id}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-60 ${
                                  ativo
                                    ? 'border border-danger text-danger hover:bg-danger hover:text-white'
                                    : 'border border-success text-success hover:bg-success hover:text-white'
                                }`}
                              >
                                {busyId === u.user_id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                                {ativo ? 'Desativar' : 'Reativar'}
                              </button>
                            )}
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

        {/* Engenheiros do Chatbot (WhatsApp) */}
        <EngenheirosChatbotAdmin />
      </main>
    </div>
  )
}
