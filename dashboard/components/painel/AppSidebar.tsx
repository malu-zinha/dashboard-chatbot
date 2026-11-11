'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Layers,
  RotateCcw,
  Wallet,
  Shield,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { supabase } from '@/lib/supabase'
import { secoesVisiveis, type SecaoId } from '@/lib/secoes'
import { useIsOwnerActive } from '@/hooks/useIsOwnerActive'

const ICONES: Record<SecaoId, LucideIcon> = {
  'visao-geral': LayoutDashboard,
  projetos: FolderKanban,
  engenheiros: Users,
  areas: Layers,
  retrabalho: RotateCcw,
  producao: Wallet,
}

interface AppSidebarProps {
  // null = pagina fora do painel (ex.: /admin): os itens viram links para o painel.
  secaoAtiva: SecaoId | null
  onSelecionar?: (secao: SecaoId) => void
  // /admin destaca o proprio item.
  adminAtivo?: boolean
}

export default function AppSidebar({ secaoAtiva, onSelecionar, adminAtivo = false }: AppSidebarProps) {
  const router = useRouter()
  // Producao e Admin so aparecem para o dono ativo (as rotas tambem exigem dono).
  const isOwner = useIsOwnerActive()
  const { isMobile, setOpenMobile } = useSidebar()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const selecionar = (secao: SecaoId) => {
    if (isMobile) setOpenMobile(false)
    if (onSelecionar) onSelecionar(secao)
    else router.push(`/?secao=${secao}`)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {/* Expandido: logo inteiro (branco sobre o azul escuro). Recolhido: so a inicial. */}
          <Image
            src="/logo-menu.png"
            alt="TecPred"
            width={480}
            height={110}
            priority
            className="h-9 w-auto group-data-[collapsible=icon]:hidden"
          />
          <span
            aria-hidden
            className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold text-sidebar-primary-foreground group-data-[collapsible=icon]:flex"
          >
            T
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Painel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {secoesVisiveis(isOwner).map((secao) => {
                const Icone = ICONES[secao.id]
                const ativo = secaoAtiva === secao.id
                return (
                  <SidebarMenuItem key={secao.id}>
                    <SidebarMenuButton
                      isActive={ativo}
                      tooltip={secao.titulo}
                      onClick={() => selecionar(secao.id)}
                      className="data-[active=true]:bg-white data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-semibold"
                    >
                      <Icone />
                      <span>{secao.titulo}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isOwner && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60">Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={adminAtivo}
                    tooltip="Painel administrativo"
                    className="data-[active=true]:bg-white data-[active=true]:text-sidebar-primary-foreground data-[active=true]:font-semibold"
                  >
                    <Link href="/admin">
                      <Shield />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={handleLogout}>
              <LogOut />
              <span>Sair</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
