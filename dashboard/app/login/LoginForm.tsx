'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { LogIn, Loader2, AlertCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    <main className="flex min-h-svh flex-col bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Prancha azul: faixa compacta no celular, coluna inteira no desktop */}
      <section className="malha-prancha flex flex-col gap-3 px-4 py-5 text-white sm:px-8 lg:justify-between lg:gap-10 lg:px-14 lg:py-12">
        <Image
          src="/logo-menu.png"
          alt="TecPred"
          width={480}
          height={110}
          priority
          className="h-8 w-auto self-start sm:h-9 lg:h-11"
        />

        <div className="lg:max-w-md">
          <p className="hidden text-xs font-medium tracking-wide text-white/55 lg:block">Painel TecPred</p>
          <p className="font-wide hidden text-4xl leading-[1.1] font-semibold lg:mt-3 lg:block xl:text-5xl">
            Acompanhe a produção da engenharia
          </p>
          <p className="text-sm text-white/70 lg:mt-5 lg:text-base">
            Projetos, engenheiros e prazos em tempo real.
          </p>
        </div>

        {/* Carimbo da prancha (so no desktop) */}
        <dl className="hidden w-fit grid-cols-2 border border-white/25 text-xs lg:grid">
          <div className="border-r border-white/25 px-4 py-2.5">
            <dt className="text-white/55">Acesso</dt>
            <dd className="mt-0.5 font-medium">Restrito à equipe</dd>
          </div>
          <div className="px-4 py-2.5">
            <dt className="text-white/55">Atualização</dt>
            <dd className="mt-0.5 font-medium">Ao vivo</dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6">
        <Card className="w-full max-w-sm gap-0 py-0 shadow-sm">
          <CardHeader className="border-b py-5">
            <CardTitle className="text-xl">
              <h1>Entrar na plataforma</h1>
            </CardTitle>
            <CardDescription>Acesso restrito ao painel TecPred</CardDescription>
          </CardHeader>

          <CardContent className="py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10"
                  placeholder="voce@empresa.com"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="h-10 w-full font-semibold">
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Entrando...
                  </>
                ) : (
                  <>
                    <LogIn /> Entrar
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">Esqueceu a senha? Fale com o administrador.</p>
      </section>
    </main>
  )
}
