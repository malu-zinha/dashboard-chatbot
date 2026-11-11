'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Shield, UserPlus, Loader2, Power, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import EngenheirosChatbotAdmin from '@/components/EngenheirosChatbotAdmin'
import AppSidebar from '@/components/painel/AppSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

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

// Marca de campo obrigatorio (o `required` do input continua valendo).
function Obrigatorio() {
  return (
    <span aria-hidden className="text-danger">
      *
    </span>
  )
}

// Selo de situacao com ponto colorido, igual nas duas tabelas do admin.
function SeloStatus({ ativo }: { ativo: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5',
        ativo ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', ativo ? 'bg-success' : 'bg-danger')} />
      {ativo ? 'Ativo' : 'Inativo'}
    </Badge>
  )
}

export default function AdminClient({ ownerId, ownerEmail }: AdminClientProps) {
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
  // Login aguardando confirmacao no AlertDialog (substitui o confirm() do navegador).
  // O login fica guardado ate a animacao de fechar terminar, para o texto nao trocar no meio.
  const [confirmando, setConfirmando] = useState<ProfileRow | null>(null)
  const [confirmAberto, setConfirmAberto] = useState(false)

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

  // Chamado so depois da confirmacao no AlertDialog.
  async function handleToggle(user: ProfileRow) {
    const novoStatus = user.status === 'active' ? 'inactive' : 'active'
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
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status.')
    } finally {
      setBusyId(null)
    }
  }

  const desativando = confirmando?.status === 'active'
  const acaoConfirmando = desativando ? 'desativar' : 'reativar'

  return (
    <SidebarProvider>
      <AppSidebar secaoAtiva={null} adminAtivo />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger className="-ml-1" aria-label="Abrir ou recolher o menu" />
          <Separator orientation="vertical" className="h-5!" />
          <span className="truncate text-sm font-medium text-foreground">Admin</span>
          {ownerEmail && (
            <span
              className="ml-auto hidden min-w-0 items-center gap-2 truncate rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:flex"
              title="Conta de dono conectada"
            >
              <Shield className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">{ownerEmail}</span>
            </span>
          )}
        </header>

        <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 space-y-6 p-4 md:p-6 lg:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Painel administrativo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Logins da plataforma e engenheiros atendidos pelo chatbot
            </p>
          </div>

          {/* Criar login */}
          <Card className="animate-fade-in gap-0 py-0">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <KeyRound className="size-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle>Criar login de engenheiro</CardTitle>
                  <CardDescription>Acesso ao dashboard com email e senha provisória</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-5">
              <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="h-9"
                    placeholder="Nome do engenheiro"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">
                    Email <Obrigatorio />
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9"
                    placeholder="engenheiro@empresa.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="password">
                    Senha provisória <Obrigatorio />
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-9"
                    placeholder="mín. 6 caracteres"
                  />
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger md:col-span-3"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div
                    role="status"
                    className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success md:col-span-3"
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    {formSuccess}
                  </div>
                )}

                <div className="md:col-span-3">
                  <Button type="submit" size="lg" disabled={submitting} className="w-full px-4 sm:w-auto">
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" /> Criando...
                      </>
                    ) : (
                      <>
                        <UserPlus /> Criar login
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Lista de usuarios */}
          <Card className="animate-fade-in gap-0 py-0">
            <CardHeader className="border-b py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Shield className="size-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle>Logins da plataforma</CardTitle>
                  <CardDescription className="tabular-nums">
                    {loading || loadError ? 'Quem entra no dashboard' : `${users.length} login(s) cadastrado(s)`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Carregando...
              </div>
            ) : loadError ? (
              <div className="p-5">
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle className="size-4 shrink-0" />
                  {loadError}
                </div>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4">Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isOwner = u.role === 'owner'
                    const isSelf = u.user_id === ownerId
                    const ativo = u.status === 'active'
                    const busy = busyId === u.user_id
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="px-4 py-3 font-medium text-foreground">
                          {u.display_name || '—'}
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground">{u.email || '—'}</TableCell>
                        <TableCell className="py-3">
                          {isOwner ? (
                            <Badge variant="secondary">
                              <Shield /> Owner
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Engenheiro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <SeloStatus ativo={ativo} />
                        </TableCell>
                        <TableCell className="py-3 pr-4 text-right">
                          {isOwner || isSelf ? (
                            <>
                              <span aria-hidden className="text-xs text-muted-foreground">
                                —
                              </span>
                              <span className="sr-only">Sem ações</span>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConfirmando(u)
                                setConfirmAberto(true)
                              }}
                              disabled={busy}
                              className={cn(
                                ativo
                                  ? 'border-danger/40 text-danger hover:bg-danger/10 hover:text-danger'
                                  : 'border-success/40 text-success hover:bg-success/10 hover:text-success'
                              )}
                            >
                              {busy ? <Loader2 className="animate-spin" /> : <Power />}
                              {ativo ? 'Desativar' : 'Reativar'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Engenheiros do Chatbot (WhatsApp) */}
          <EngenheirosChatbotAdmin />
        </main>
      </SidebarInset>

      <AlertDialog
        open={confirmAberto}
        onOpenChange={setConfirmAberto}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={desativando ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}>
              <Power />
            </AlertDialogMedia>
            <AlertDialogTitle>{desativando ? 'Desativar acesso' : 'Reativar acesso'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando && `Tem certeza que deseja ${acaoConfirmando} o acesso de ${confirmando.email}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={desativando ? 'destructive' : 'default'}
              onClick={() => {
                if (confirmando) handleToggle(confirmando)
              }}
            >
              {desativando ? 'Desativar' : 'Reativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}
