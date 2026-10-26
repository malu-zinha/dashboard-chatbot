import { NextResponse } from 'next/server'

// Health check do deploy (railway.json): o servidor Next esta de pe.
// Publico: o middleware deixa /api passar sem sessao.
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}
