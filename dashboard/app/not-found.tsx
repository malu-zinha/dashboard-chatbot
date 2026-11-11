import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-tecpred-light flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Página não encontrada</h1>
        <p className="text-gray-600 mb-6">
          A URL que você acessou não existe. Use o link abaixo para ir ao início.
        </p>
        <Link
          href="/inicio"
          className="inline-block px-6 py-3 bg-tecpred-primary text-white rounded-lg font-semibold hover:bg-tecpred-secondary transition-colors"
        >
          Ir para Planilhas
        </Link>
      </div>
    </div>
  )
}
