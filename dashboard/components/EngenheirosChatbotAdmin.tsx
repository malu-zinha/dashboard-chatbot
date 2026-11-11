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
import { toast } from 'sonner'
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

interface EngenheiroChatbot {
  eng_id: string
  nome: string
  telefone: string
  exclusivo: boolean
  ativo: boolean
}

// Checkbox nativo com a cor da marca e foco visivel (nao ha Checkbox do shadcn no projeto).
const classeCheckbox =
  'size-4 shrink-0 cursor-pointer rounded-sm border-input accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export default function EngenheirosChatbotAdmin() {
  const [list, setList] = useState<EngenheiroChatbot[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // form de criacao
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [exclusivo, setExclusivo] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // edicao inline
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editExclusivo, setEditExclusivo] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Engenheiro aguardando confirmacao no AlertDialog (substitui o confirm() do navegador).
  const [confirmando, setConfirmando] = useState<EngenheiroChatbot | null>(null)
  const [confirmAberto, setConfirmAberto] = useState(false)

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
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar.')
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

  // Chamado so depois da confirmacao no AlertDialog.
  async function toggleAtivo(eng: EngenheiroChatbot) {
    await patchEng(eng.eng_id, { ativo: !eng.ativo })
  }

  const reativando = confirmando ? !confirmando.ativo : false
  const acaoConfirmando = reativando ? 'reativar' : 'desativar'

  return (
    <Card className="animate-fade-in gap-0 py-0">
      <CardHeader className="border-b py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MessageSquare className="size-4" />
          </span>
          <div className="min-w-0">
            <CardTitle>Engenheiros do Chatbot</CardTitle>
            <CardDescription>
              Quem o chatbot atende no WhatsApp (pelo telefone). Não é o mesmo que login do dashboard.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* Form de cadastro */}
      <CardContent className="border-b bg-muted/40 py-5">
        <form onSubmit={handleCreate} className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
          <div className="grid gap-1.5 md:col-span-4">
            <Label htmlFor="eng-nome">
              Nome{' '}
              <span aria-hidden className="text-danger">
                *
              </span>
            </Label>
            <Input
              id="eng-nome"
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 bg-card"
              placeholder="Nome do engenheiro"
            />
          </div>
          <div className="grid gap-1.5 md:col-span-4">
            <Label htmlFor="eng-tel">
              Telefone (WhatsApp){' '}
              <span aria-hidden className="text-danger">
                *
              </span>
            </Label>
            <Input
              id="eng-tel"
              type="tel"
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="h-9 bg-card"
              placeholder="+5583991234567"
            />
          </div>
          <div className="flex h-9 items-center md:col-span-2">
            <Label htmlFor="eng-exclusivo" className="cursor-pointer">
              <input
                id="eng-exclusivo"
                type="checkbox"
                checked={exclusivo}
                onChange={(e) => setExclusivo(e.target.checked)}
                className={classeCheckbox}
              />
              Exclusivo
            </Label>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="animate-spin" /> : <UserPlus />}
              Adicionar
            </Button>
          </div>

          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger md:col-span-12"
            >
              <AlertCircle className="size-4 shrink-0" />
              {formError}
            </div>
          )}
          {formSuccess && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success md:col-span-12"
            >
              <CheckCircle2 className="size-4 shrink-0" />
              {formSuccess}
            </div>
          )}
        </form>
      </CardContent>

      {/* Lista */}
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
              <TableHead>Telefone</TableHead>
              <TableHead>Exclusivo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhum engenheiro cadastrado no chatbot
                </TableCell>
              </TableRow>
            ) : (
              list.map((eng) => {
                const editing = editId === eng.eng_id
                const busy = busyId === eng.eng_id
                return (
                  <TableRow key={eng.eng_id} className={cn(editing && 'bg-accent/50 hover:bg-accent/50')}>
                    <TableCell className="px-4 py-3">
                      {editing ? (
                        <Input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          aria-label={`Nome de ${eng.nome}`}
                          className="h-8 min-w-36 bg-card"
                        />
                      ) : (
                        <span className="font-medium text-foreground">{eng.nome}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 text-muted-foreground tabular-nums">
                      {editing ? (
                        <Input
                          type="tel"
                          value={editTelefone}
                          onChange={(e) => setEditTelefone(e.target.value)}
                          aria-label={`Telefone de ${eng.nome}`}
                          className="h-8 min-w-36 bg-card"
                        />
                      ) : (
                        eng.telefone
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {editing ? (
                        <input
                          type="checkbox"
                          checked={editExclusivo}
                          onChange={(e) => setEditExclusivo(e.target.checked)}
                          aria-label={`${eng.nome} é exclusivo`}
                          className={classeCheckbox}
                        />
                      ) : eng.exclusivo ? (
                        <Badge variant="secondary">Sim</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          'gap-1.5',
                          eng.ativo
                            ? 'border-success/30 bg-success/10 text-success'
                            : 'border-danger/30 bg-danger/10 text-danger'
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn('size-1.5 rounded-full', eng.ativo ? 'bg-success' : 'bg-danger')}
                        />
                        {eng.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        {editing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => saveEdit(eng.eng_id)}
                              disabled={busy}
                              className="bg-success text-white hover:bg-success/85"
                            >
                              {busy ? <Loader2 className="animate-spin" /> : <Check />}
                              Salvar
                            </Button>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={cancelEdit}
                              disabled={busy}
                              aria-label="Cancelar edição"
                              title="Cancelar"
                            >
                              <X />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEdit(eng)}>
                              <Pencil />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConfirmando(eng)
                                setConfirmAberto(true)
                              }}
                              disabled={busy}
                              className={cn(
                                eng.ativo
                                  ? 'border-danger/40 text-danger hover:bg-danger/10 hover:text-danger'
                                  : 'border-success/40 text-success hover:bg-success/10 hover:text-success'
                              )}
                            >
                              {busy ? <Loader2 className="animate-spin" /> : <Power />}
                              {eng.ativo ? 'Desativar' : 'Reativar'}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={confirmAberto} onOpenChange={setConfirmAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={reativando ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}>
              <Power />
            </AlertDialogMedia>
            <AlertDialogTitle>{reativando ? 'Reativar no chatbot' : 'Desativar no chatbot'}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmando && `Tem certeza que deseja ${acaoConfirmando} ${confirmando.nome} no chatbot?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant={reativando ? 'default' : 'destructive'}
              onClick={() => {
                if (confirmando) toggleAtivo(confirmando)
              }}
            >
              {reativando ? 'Reativar' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
