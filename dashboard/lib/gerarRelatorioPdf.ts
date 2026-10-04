import jsPDF from 'jspdf'
import type { RelatorioProjetoData, DisciplinaRelatorio } from './supabase'
import { formatarDataBR } from './datas'

interface GerarRelatorioParams {
  relatorio: RelatorioProjetoData
  disciplinas: DisciplinaRelatorio[]
  gerado_em: string
}

const COLORS = {
  primary: [0, 82, 147] as [number, number, number],
  secondary: [0, 113, 188] as [number, number, number],
  text: [51, 51, 51] as [number, number, number],
  textLight: [102, 102, 102] as [number, number, number],
  border: [200, 200, 200] as [number, number, number],
  background: [245, 247, 250] as [number, number, number],
  success: [34, 139, 34] as [number, number, number],
  warning: [255, 140, 0] as [number, number, number],
}

const formatDate = formatarDataBR

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function gerarRelatorioPdf({
  relatorio,
  disciplinas,
  gerado_em,
}: GerarRelatorioParams): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 15
  const marginRight = 15
  const contentWidth = pageWidth - marginLeft - marginRight
  let y = 15

  // Header com gradiente simulado
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 40, 'F')
  doc.setFillColor(...COLORS.secondary)
  doc.rect(0, 30, pageWidth, 10, 'F')

  // Titulo
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('RELATORIO DE PROJETO CONCLUIDO', pageWidth / 2, 20, { align: 'center' })

  // Subtitulo
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Projeto: ${relatorio.codigo_projeto}`, pageWidth / 2, 28, { align: 'center' })
  doc.text(`Cliente: ${relatorio.cliente}`, pageWidth / 2, 35, { align: 'center' })

  y = 50

  // Descricao do projeto (se existir)
  if (relatorio.descricao) {
    doc.setTextColor(...COLORS.text)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const descLines = doc.splitTextToSize(relatorio.descricao, contentWidth)
    doc.text(descLines, marginLeft, y)
    y += descLines.length * 5 + 5
  }

  // Box de Metricas de Execucao
  y = drawSectionBox(doc, 'METRICAS DE EXECUCAO', marginLeft, y, contentWidth)

  const metricas = [
    {
      label: 'Tempo total de execucao',
      value: `${relatorio.dias_execucao_total} dias`,
      icon: '⏱',
    },
    {
      label: 'Dias de retrabalho',
      value: `${relatorio.dias_retrabalho} dias`,
      icon: '🔄',
      highlight: relatorio.dias_retrabalho > 0 ? COLORS.warning : undefined,
    },
    {
      label: 'Dias de paralisacao',
      value: `${relatorio.dias_paralisacao} dias`,
      icon: '⏸',
      highlight: relatorio.dias_paralisacao > 0 ? COLORS.warning : undefined,
    },
    {
      label: 'Engenheiros envolvidos',
      value: `${relatorio.total_engenheiros}`,
      icon: '👷',
    },
    {
      label: 'Disciplinas concluidas',
      value: `${relatorio.disciplinas_concluidas}/${relatorio.total_disciplinas}`,
      icon: '✅',
    },
  ]

  y = drawMetricsGrid(doc, metricas, marginLeft, y, contentWidth)

  // Box de Datas
  y += 5
  y = drawSectionBox(doc, 'PERIODO DO PROJETO', marginLeft, y, contentWidth)

  doc.setTextColor(...COLORS.text)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const datasInfo = [
    ['Data de inicio:', formatDate(relatorio.data_inicio_projeto)],
    ['Data de conclusao:', formatDate(relatorio.data_conclusao_projeto)],
    ['Projeto criado em:', formatDate(relatorio.projeto_criado_em)],
  ]

  for (const [label, value] of datasInfo) {
    doc.setFont('helvetica', 'bold')
    doc.text(label, marginLeft + 5, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, marginLeft + 45, y)
    y += 6
  }

  y += 5

  // Detalhamento por Disciplina
  if (disciplinas.length > 0) {
    y = drawSectionBox(doc, 'DETALHAMENTO POR DISCIPLINA', marginLeft, y, contentWidth)

    // Cabecalho da tabela
    const colWidths = [50, 35, 25, 25, 25, 20]
    const headers = ['Disciplina', 'Engenheiro', 'Inicio', 'Conclusao', 'Dias Exec.', 'Retr.']

    doc.setFillColor(...COLORS.background)
    doc.rect(marginLeft, y - 4, contentWidth, 8, 'F')
    doc.setTextColor(...COLORS.primary)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')

    let xPos = marginLeft + 2
    for (let i = 0; i < headers.length; i++) {
      doc.text(headers[i], xPos, y)
      xPos += colWidths[i]
    }

    y += 6

    // Linhas da tabela
    doc.setTextColor(...COLORS.text)
    doc.setFont('helvetica', 'normal')

    for (const disc of disciplinas) {
      if (y > pageHeight - 30) {
        doc.addPage()
        y = 20
      }

      const disciplinaLabel = disc.instancia_label
        ? `${disc.area_descricao} (${disc.instancia_label})`
        : disc.area_descricao

      const truncate = (str: string, max: number) =>
        str.length > max ? str.substring(0, max - 2) + '..' : str

      xPos = marginLeft + 2
      doc.text(truncate(disciplinaLabel, 28), xPos, y)
      xPos += colWidths[0]
      doc.text(truncate(disc.engenheiro_nome || '-', 18), xPos, y)
      xPos += colWidths[1]
      doc.text(formatDate(disc.data_inicio), xPos, y)
      xPos += colWidths[2]
      doc.text(formatDate(disc.data_conclusao), xPos, y)
      xPos += colWidths[3]
      doc.text(String(disc.dias_execucao), xPos, y)
      xPos += colWidths[4]

      if (disc.dias_retrabalho > 0) {
        doc.setTextColor(...COLORS.warning)
        doc.setFont('helvetica', 'bold')
      }
      doc.text(String(disc.dias_retrabalho), xPos, y)
      doc.setTextColor(...COLORS.text)
      doc.setFont('helvetica', 'normal')

      y += 5
    }
  }

  // Rodape
  doc.setDrawColor(...COLORS.border)
  doc.line(marginLeft, pageHeight - 15, pageWidth - marginRight, pageHeight - 15)

  doc.setTextColor(...COLORS.textLight)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text(
    `Gerado em: ${formatDateTime(gerado_em)} | TecPred Dashboard`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  // Download
  const filename = `relatorio_${relatorio.codigo_projeto.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}

function drawSectionBox(
  doc: jsPDF,
  title: string,
  x: number,
  y: number,
  width: number
): number {
  doc.setFillColor(...COLORS.primary)
  doc.rect(x, y, width, 8, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(title, x + 5, y + 5.5)

  return y + 12
}

function drawMetricsGrid(
  doc: jsPDF,
  metricas: Array<{
    label: string
    value: string
    icon?: string
    highlight?: [number, number, number]
  }>,
  x: number,
  y: number,
  width: number
): number {
  const cols = 2
  const colWidth = width / cols
  const rowHeight = 12

  let row = 0
  let col = 0

  for (const metrica of metricas) {
    const posX = x + col * colWidth
    const posY = y + row * rowHeight

    // Background alternado
    if (row % 2 === 0) {
      doc.setFillColor(...COLORS.background)
      doc.rect(posX, posY - 4, colWidth - 2, rowHeight, 'F')
    }

    // Label
    doc.setTextColor(...COLORS.textLight)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(metrica.label, posX + 3, posY)

    // Value
    const valueColor = metrica.highlight || COLORS.text
    doc.setTextColor(...valueColor)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(metrica.value, posX + 3, posY + 6)

    col++
    if (col >= cols) {
      col = 0
      row++
    }
  }

  return y + Math.ceil(metricas.length / cols) * rowHeight + 5
}
