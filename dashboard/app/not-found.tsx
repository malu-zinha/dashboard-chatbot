import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="malha-prancha flex min-h-svh flex-col px-4 py-6 text-white sm:px-8 lg:px-14 lg:py-10">
      <Image src="/logo-menu.png" alt="TecPred" width={480} height={110} className="h-8 w-auto self-start sm:h-9" />

      <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
        {/* Numero em contorno, como cota de desenho tecnico */}
        <p
          aria-hidden
          className="font-wide text-[7rem] leading-none font-semibold text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.75)] sm:text-[10rem]"
        >
          404
        </p>
        <div aria-hidden className="mt-4 flex w-48 items-center gap-2 text-white/40 sm:w-64">
          <span className="h-3 w-px bg-current" />
          <span className="h-px flex-1 bg-current" />
          <span className="h-3 w-px bg-current" />
        </div>

        <h1 className="font-wide mt-6 text-2xl font-semibold sm:text-3xl">Página não encontrada</h1>
        <p className="mt-2 max-w-md text-sm text-white/70 sm:text-base">
          A URL que você acessou não existe. Use o botão abaixo para voltar ao painel.
        </p>

        <Button
          asChild
          size="lg"
          className="mt-8 h-10 bg-white px-4 font-semibold text-primary hover:bg-white/90 focus-visible:ring-white/50"
        >
          <Link href="/inicio">
            <ArrowLeft /> Voltar ao painel
          </Link>
        </Button>
      </div>
    </main>
  )
}
