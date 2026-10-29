// Estado do aviso de WhatsApp enviado ao engenheiro quando o prazo muda.
// Funcoes puras: a tabela mostra o icone e o polling usa temAvisoEnviando.

import { toDataISO } from './datas'

export interface AvisoPrazoLinha {
  eng_projeto_id: string
  created_at: string
  enviada: boolean
  tentativas: number
  status_entrega: string | null
  erro_codigo: string | null
  // Prazo que o aviso levou ao engenheiro (nulo em avisos antigos).
  prazo_avisado: string | null
}

export type EstadoAvisoPrazo = {
  icone: 'enviando' | 'entregue' | 'enviado' | 'falhou'
  texto: string
}

// Depois disso, 'enviado'/'sent' sem callback viram check cinza.
const JANELA_ENVIANDO_MS = 10 * 60 * 1000
const MAX_TENTATIVAS = 5

const TEXTO_ENVIANDO = 'Enviando aviso ao engenheiro…'

// Repete a regra do bot (integrations/whatsapp/statusEntrega.ts, motivoFalha):
// dashboard e bot sao pacotes separados e nao compartilham modulo.
function motivoFalha(erroCodigo: string | null): string {
  if (erroCodigo === '63016') {
    return 'Aviso não entregue: o engenheiro não fala com o bot há mais de 24h'
  }
  return erroCodigo
    ? `Aviso não entregue (erro ${erroCodigo})`
    : 'Aviso não entregue'
}

export function estadoAvisoPrazo(linha: AvisoPrazoLinha, agoraMs: number): EstadoAvisoPrazo {
  const status = linha.status_entrega

  if (status === 'delivered' || status === 'read') {
    return { icone: 'entregue', texto: 'Aviso entregue ao engenheiro' }
  }
  if (status === 'sem_telefone') {
    return { icone: 'falhou', texto: 'Aviso não enviado: engenheiro sem telefone cadastrado' }
  }
  if (status === 'failed' || status === 'undelivered') {
    return { icone: 'falhou', texto: motivoFalha(linha.erro_codigo) }
  }
  if (!linha.enviada && linha.tentativas >= MAX_TENTATIVAS) {
    return { icone: 'falhou', texto: 'Aviso não enviado: o envio falhou após várias tentativas' }
  }

  const criadoMs = Date.parse(linha.created_at)
  const dentroDaJanela = Number.isNaN(criadoMs) || agoraMs - criadoMs < JANELA_ENVIANDO_MS

  if (!linha.enviada) {
    // Na fila: dentro da janela e enviando; passou dela, o worker nao pegou.
    return dentroDaJanela
      ? { icone: 'enviando', texto: TEXTO_ENVIANDO }
      : { icone: 'falhou', texto: 'Aviso não enviado: ainda na fila após 10 minutos' }
  }

  // Enviado pelo worker, sem callback final ('enviado' ou 'sent').
  return dentroDaJanela
    ? { icone: 'enviando', texto: TEXTO_ENVIANDO }
    : { icone: 'enviado', texto: 'Aviso enviado, sem confirmação de entrega' }
}

export function temAvisoEnviando(linhas: AvisoPrazoLinha[], agoraMs: number): boolean {
  return linhas.some((l) => estadoAvisoPrazo(l, agoraMs).icone === 'enviando')
}

// O aviso so vale enquanto a tarefa esta no prazo que ele levou. Se o prazo
// mudou por outro caminho (retrabalho, fluxo do dono no WhatsApp), o icone
// some para nao parecer que o engenheiro recebeu a data atual.
export function avisoValeParaPrazo(
  aviso: Pick<AvisoPrazoLinha, 'prazo_avisado'>,
  dataPrevista: string | null | undefined
): boolean {
  const avisado = toDataISO(aviso.prazo_avisado)
  return avisado !== null && avisado === toDataISO(dataPrevista)
}
