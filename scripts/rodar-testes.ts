// =====================================================
// npm test: roda todos os testes automaticos
// =====================================================
// Rodar com: npm test            (todos)
//            npm test -- fuso    (so os arquivos com "fuso" no nome)
//
// Cada arquivo tests/*.ts e um teste independente que sai com codigo 1 se
// falhar (node:assert ou contagem propria). Roda 4 por vez, mostra a saida so
// dos que falharam e sai com 1 se algum falhou. Nao acessa banco nem rede:
// scripts que acessam ficam em tests/manual/ e nao entram aqui.
// =====================================================

import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const PARALELO = 4
const filtro = process.argv[2] ?? ''
const arquivos = readdirSync('tests')
  .filter((f) => f.endsWith('.ts') && f.includes(filtro))
  .sort()
  .map((f) => join('tests', f))

if (arquivos.length === 0) {
  console.error(`Nenhum teste em tests/ com "${filtro}" no nome.`)
  process.exit(1)
}

interface Resultado {
  arquivo: string
  ok: boolean
  saida: string
  ms: number
}

function rodar(arquivo: string): Promise<Resultado> {
  const inicio = Date.now()
  return new Promise((resolve) => {
    const filho = spawn(process.execPath, ['--import', 'tsx', arquivo], {
      env: { ...process.env, NODE_NO_WARNINGS: '1' },
    })
    let saida = ''
    filho.stdout.on('data', (d) => (saida += d))
    filho.stderr.on('data', (d) => (saida += d))
    filho.on('close', (codigo) => resolve({ arquivo, ok: codigo === 0, saida, ms: Date.now() - inicio }))
  })
}

const resultados: Resultado[] = []
const fila = [...arquivos]
await Promise.all(
  Array.from({ length: PARALELO }, async () => {
    for (let arquivo = fila.shift(); arquivo; arquivo = fila.shift()) {
      const r = await rodar(arquivo)
      resultados.push(r)
      console.log(`${r.ok ? '✅' : '❌'} ${r.arquivo} (${(r.ms / 1000).toFixed(1)} s)`)
    }
  }),
)

const falhas = resultados.filter((r) => !r.ok)
for (const f of falhas) {
  console.log(`\n${'='.repeat(60)}\n❌ ${f.arquivo}\n${'='.repeat(60)}\n${f.saida.trim()}`)
}
console.log(`\n${resultados.length - falhas.length} de ${resultados.length} arquivos de teste passaram`)
process.exit(falhas.length > 0 ? 1 : 0)
