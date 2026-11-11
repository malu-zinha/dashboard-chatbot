import jsPDF from 'jspdf'
import type { RelatorioProjetoData, DisciplinaRelatorio } from './supabase'
import { dataBRDeTimestamp, formatarDataBR } from './datas'
import {
  diasCorridos,
  formatarDias,
  formatarResumoTipo,
  resumoVazio,
  type ResumoOcorrencias,
  type ResumoTipo,
} from './relatorioOcorrencias'

interface GerarRelatorioParams {
  relatorio: RelatorioProjetoData
  disciplinas: DisciplinaRelatorio[]
  // Retrabalho e paralisacao por tipo (retrabalho_projetos). Ver lib/relatorioOcorrencias.ts.
  ocorrencias?: ResumoOcorrencias
  // Relatos de disciplinas desativadas (removidas ou transferidas): contam no projeto, mas
  // nao aparecem na tabela por disciplina.
  relatos_fora_das_disciplinas?: number
  gerado_em: string
}

type RGB = [number, number, number]

// Azul da marca (#2e3192) e os mesmos tons do painel.
const COLORS = {
  primary: [46, 49, 146] as RGB,
  secondary: [74, 79, 183] as RGB,
  text: [33, 37, 64] as RGB,
  textLight: [96, 102, 128] as RGB,
  border: [220, 225, 239] as RGB,
  background: [243, 245, 250] as RGB,
  warning: [180, 95, 6] as RGB,
}

// Helvetica do jsPDF usa WinAnsi: acentos do portugues e o "·" saem certos.
function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function temRegistro(r: ResumoTipo) {
  return r.dias > 0 || r.horas > 0
}

// Celula compacta da tabela por disciplina: "2 d · 3,5 h" ou "-".
function celulaOcorrencia(r: ResumoTipo | undefined): string {
  if (!r || !temRegistro(r)) return '-'
  return `${r.dias} d · ${r.horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
}

export function gerarRelatorioPdf({
  relatorio,
  disciplinas,
  ocorrencias = resumoVazio(),
  relatos_fora_das_disciplinas = 0,
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

  // O relatorio e do projeto inteiro: so e "concluido" com todas as disciplinas concluidas.
  const projetoConcluido =
    relatorio.total_disciplinas > 0 && relatorio.disciplinas_concluidas === relatorio.total_disciplinas
  const hojeBR = dataBRDeTimestamp(new Date())

  // Cabecalho
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, 40, 'F')
  doc.setFillColor(...COLORS.secondary)
  doc.rect(0, 30, pageWidth, 10, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(
    projetoConcluido ? 'RELATÓRIO DE PROJETO CONCLUÍDO' : 'RELATÓRIO PARCIAL DO PROJETO',
    pageWidth / 2,
    20,
    { align: 'center' }
  )

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Projeto: ${relatorio.codigo_projeto}`, pageWidth / 2, 28, { align: 'center' })
  doc.text(`Cliente: ${relatorio.cliente}`, pageWidth / 2, 35, { align: 'center' })

  y = 50

  if (!projetoConcluido) {
    doc.setTextColor(...COLORS.warning)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `Projeto em andamento: ${relatorio.disciplinas_concluidas} de ${relatorio.total_disciplinas} disciplinas concluídas.`,
      marginLeft,
      y
    )
    y += 8
  }

  if (relatorio.descricao) {
    doc.setTextColor(...COLORS.text)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'italic')
    const descLines = doc.splitTextToSize(relatorio.descricao, contentWidth)
    doc.text(descLines, marginLeft, y)
    y += descLines.length * 5 + 5
  }

  // Metricas
  y = drawSectionBox(doc, 'MÉTRICAS DE EXECUÇÃO', marginLeft, y, contentWidth)

  // Dias corridos contando inicio e fim (mesmo dia = 1 dia). Em andamento: ate hoje.
  const diasExecucao = projetoConcluido
    ? diasCorridos(relatorio.data_inicio_projeto, relatorio.data_conclusao_projeto)
    : diasCorridos(relatorio.data_inicio_projeto, hojeBR)

  const metricas: Array<{ label: string; value: string; highlight?: RGB }> = [
    {
      label: projetoConcluido ? 'Tempo total de execução' : 'Tempo de execução até hoje',
      value: formatarDias(diasExecucao),
    },
    {
      label: 'Disciplinas concluídas',
      value: `${relatorio.disciplinas_concluidas}/${relatorio.total_disciplinas}`,
    },
    {
      label: 'Retrabalho (dias · horas)',
      value: formatarResumoTipo(ocorrencias.retrabalho),
      highlight: temRegistro(ocorrencias.retrabalho) ? COLORS.warning : undefined,
    },
    {
      label: 'Paralisação (dias · horas)',
      value: formatarResumoTipo(ocorrencias.paralisacao),
      highlight: temRegistro(ocorrencias.paralisacao) ? COLORS.warning : undefined,
    },
  ]
  // Relatos de antes de 11/11/2026 nao gravavam se eram retrabalho ou paralisacao.
  if (temRegistro(ocorrencias.nao_classificado)) {
    metricas.push({
      label: 'Não classificado (relatos antes de 11/11/2026)',
      value: formatarResumoTipo(ocorrencias.nao_classificado),
      highlight: COLORS.warning,
    })
  }
  metricas.push({ label: 'Engenheiros envolvidos', value: `${relatorio.total_engenheiros}` })

  y = drawMetricsGrid(doc, metricas, marginLeft, y, contentWidth)

  // Datas
  y += 5
  y = drawSectionBox(doc, 'PERÍODO DO PROJETO', marginLeft, y, contentWidth)

  doc.setTextColor(...COLORS.text)
  doc.setFontSize(10)

  const datasInfo = [
    ['Data de início:', formatarDataBR(relatorio.data_inicio_projeto)],
    ['Data de conclusão:', projetoConcluido ? formatarDataBR(relatorio.data_conclusao_projeto) : 'Em andamento'],
    ['Projeto criado em:', formatarDataBR(dataBRDeTimestamp(relatorio.projeto_criado_em))],
  ]

  for (const [label, value] of datasInfo) {
    doc.setFont('helvetica', 'bold')
    doc.text(label, marginLeft + 5, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, marginLeft + 45, y)
    y += 6
  }

  y += 5

  // Detalhamento por disciplina
  if (disciplinas.length > 0) {
    y = drawSectionBox(doc, 'DETALHAMENTO POR DISCIPLINA', marginLeft, y, contentWidth)

    const comNaoClassificado = disciplinas.some((d) => d.ocorrencias && temRegistro(d.ocorrencias.nao_classificado))
    const colunas: Array<{ titulo: string; largura: number }> = comNaoClassificado
      ? [
          { titulo: 'Disciplina', largura: 38 },
          { titulo: 'Engenheiro', largura: 30 },
          { titulo: 'Início', largura: 19 },
          { titulo: 'Conclusão', largura: 19 },
          { titulo: 'Dias exec.', largura: 16 },
          { titulo: 'Retrabalho', largura: 18 },
          { titulo: 'Paralisação', largura: 20 },
          { titulo: 'Não class.', largura: 20 },
        ]
      : [
          { titulo: 'Disciplina', largura: 46 },
          { titulo: 'Engenheiro', largura: 36 },
          { titulo: 'Início', largura: 20 },
          { titulo: 'Conclusão', largura: 20 },
          { titulo: 'Dias exec.', largura: 17 },
          { titulo: 'Retrabalho', largura: 20 },
          { titulo: 'Paralisação', largura: 21 },
        ]

    const desenharCabecalho = () => {
      doc.setFillColor(...COLORS.background)
      doc.rect(marginLeft, y - 4, contentWidth, 8, 'F')
      doc.setTextColor(...COLORS.primary)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      let x = marginLeft + 2
      for (const c of colunas) {
        doc.text(c.titulo, x, y)
        x += c.largura
      }
      y += 6
    }

    desenharCabecalho()
    doc.setFontSize(8)

    for (const disc of disciplinas) {
      const disciplinaLabel = disc.instancia_label
        ? `${disc.area_descricao} (${disc.instancia_label})`
        : disc.area_descricao

      // Nome e disciplina quebram em ate 2 linhas em vez de serem cortados.
      const linhasDisciplina = (doc.splitTextToSize(disciplinaLabel, colunas[0].largura - 3) as string[]).slice(0, 2)
      const linhasEngenheiro = (doc.splitTextToSize(disc.engenheiro_nome || '-', colunas[1].largura - 3) as string[]).slice(0, 2)
      const alturaLinha = Math.max(linhasDisciplina.length, linhasEngenheiro.length) * 3.6 + 1.8

      if (y + alturaLinha > pageHeight - 22) {
        doc.addPage()
        y = 20
        desenharCabecalho()
        doc.setFontSize(8)
      }

      const dias = diasCorridos(disc.data_inicio, disc.data_conclusao)
      const oc = disc.ocorrencias
      const valores: Array<{ texto: string | string[]; destaque?: boolean }> = [
        { texto: linhasDisciplina },
        { texto: linhasEngenheiro },
        { texto: formatarDataBR(disc.data_inicio) },
        { texto: formatarDataBR(disc.data_conclusao) },
        { texto: dias === null ? '-' : String(dias) },
        { texto: celulaOcorrencia(oc?.retrabalho), destaque: Boolean(oc && temRegistro(oc.retrabalho)) },
        { texto: celulaOcorrencia(oc?.paralisacao), destaque: Boolean(oc && temRegistro(oc.paralisacao)) },
      ]
      if (comNaoClassificado) {
        valores.push({
          texto: celulaOcorrencia(oc?.nao_classificado),
          destaque: Boolean(oc && temRegistro(oc.nao_classificado)),
        })
      }

      let x = marginLeft + 2
      valores.forEach((v, i) => {
        if (v.destaque) {
          doc.setTextColor(...COLORS.warning)
          doc.setFont('helvetica', 'bold')
        } else {
          doc.setTextColor(...COLORS.text)
          doc.setFont('helvetica', 'normal')
        }
        doc.text(v.texto, x, y)
        x += colunas[i].largura
      })

      y += alturaLinha
      doc.setDrawColor(...COLORS.border)
      doc.line(marginLeft, y - 3.2, pageWidth - marginRight, y - 3.2)
    }

    doc.setTextColor(...COLORS.textLight)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7.5)
    if (y > pageHeight - 26) {
      doc.addPage()
      y = 20
    }
    doc.text(
      'Retrabalho e paralisação: dias com relato · horas relatadas. Dias exec.: do início à conclusão, contando os dois dias.',
      marginLeft,
      y + 1
    )
    if (relatos_fora_das_disciplinas > 0) {
      doc.text(
        `Os totais incluem ${relatos_fora_das_disciplinas} relato(s) de disciplina removida ou transferida, que não aparece nesta tabela.`,
        marginLeft,
        y + 5
      )
    }
  }

  // Rodape em todas as paginas
  const totalPaginas = doc.getNumberOfPages()
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    doc.setPage(pagina)
    doc.setDrawColor(...COLORS.border)
    doc.line(marginLeft, pageHeight - 15, pageWidth - marginRight, pageHeight - 15)
    doc.setTextColor(...COLORS.textLight)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(
      `Gerado em: ${formatDateTime(gerado_em)} | TecPred Dashboard${totalPaginas > 1 ? ` | Página ${pagina} de ${totalPaginas}` : ''}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Data de Brasilia no nome do arquivo (a UTC viraria o dia seguinte depois das 21h).
  const filename = `relatorio_${relatorio.codigo_projeto.replace(/[^a-zA-Z0-9]/g, '_')}_${hojeBR}.pdf`
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
    highlight?: RGB
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

    // Fundo alternado por linha
    if (row % 2 === 0) {
      doc.setFillColor(...COLORS.background)
      doc.rect(posX, posY - 4, colWidth - 2, rowHeight, 'F')
    }

    doc.setTextColor(...COLORS.textLight)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(metrica.label, posX + 3, posY)

    doc.setTextColor(...(metrica.highlight || COLORS.text))
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
