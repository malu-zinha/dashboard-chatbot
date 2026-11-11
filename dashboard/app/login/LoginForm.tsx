'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogIn, Loader2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (signInError) {
      setError('Email ou senha inválidos.')
      return
    }

    router.replace('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-tecpred-primary via-tecpred-secondary to-tecpred-primary px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="TecPred"
            width={320}
            height={101}
            priority
            className="h-24 w-auto brightness-110 contrast-125 drop-shadow-[0_2px_10px_rgba(255,255,255,0.45)]"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">
            Entrar na plataforma
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Acesso restrito · TecPred Dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
                placeholder="voce@empresa.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tecpred-orange focus:border-transparent outline-hidden transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-tecpred-primary hover:bg-tecpred-secondary text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" /> Entrar
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/70 text-xs mt-6">
          Esqueceu a senha? Fale com o administrador.
        </p>
      </div>
    </main>
  )
}
