import type { Metadata } from 'next'
import { Archivo } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

// Archivo com eixo de largura: expandida nos numeros e titulos, normal no texto.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo' })

export const metadata: Metadata = {
  title: 'TecPred Dashboard | Visão Executiva em Tempo Real',
  description: 'Dashboard executivo para visualização em tempo real do banco de dados TecPred',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={cn('font-sans', archivo.variable)}>
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}

