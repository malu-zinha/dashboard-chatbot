// =====================================================
// Regras do status de entrega das mensagens de WhatsApp
// =====================================================
// Puro: decide se um callback de status da Twilio deve ser gravado.

export type StatusEntrega =
  | 'enviado'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'undelivered'
  | 'sem_telefone';

const ORDEM: Record<string, number> = { enviado: 0, sent: 1, delivered: 2, read: 3 };
const FINAIS = new Set(['failed', 'undelivered']);

// Devolve o novo status a gravar, ou null quando nao deve gravar.
export function proximoStatusEntrega(atual: string | null, recebido: string): StatusEntrega | null {
  const recebidoFinal = FINAIS.has(recebido);
  if (!recebidoFinal && !(recebido in ORDEM)) return null;
  if (atual && FINAIS.has(atual)) return null;
  if (recebidoFinal) return recebido as StatusEntrega;
  const posAtual = atual && atual in ORDEM ? ORDEM[atual] : -1;
  return ORDEM[recebido] > posAtual ? (recebido as StatusEntrega) : null;
}

export function motivoFalha(codigo: string | null | undefined): string {
  if (codigo === '63016') return 'não fala com o bot há mais de 24h';
  if (codigo) return `não entregue (código ${codigo})`;
  return 'não entregue';
}
