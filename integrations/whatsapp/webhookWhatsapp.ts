// =====================================================
// Webhook Twilio - mensagens recebidas pelo WhatsApp
// =====================================================
// Responde ao Twilio na hora, com TwiML vazio, e processa a mensagem em
// seguida. O Twilio desiste depois de 15 s (erro 11200) e reclama de resposta
// que nao e TwiML (aviso 12200). A resposta do bot sai pela API do Twilio,
// nao pelo TwiML, como ja era antes.
//
// A ordem das mensagens do mesmo telefone continua garantida pela fila do
// MessageHandler: processar() e chamado na ordem de chegada.
// =====================================================

import type { Request, Response } from 'express';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';
import { mascararTelefone, resumoTexto } from '../../logic/security/mascararPII.ts';

export const TWIML_VAZIO = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

// Quantas MessageSid recentes guardar para ignorar entrega repetida.
const MAX_SIDS_LEMBRADAS = 500;

export interface DependenciasWebhook {
  processar(telefone: string, mensagem: string): Promise<{ resposta: string }>;
  enviar(telefone: string, mensagem: string): Promise<boolean>;
}

export function criarWebhookWhatsapp(deps: DependenciasWebhook) {
  const sidsVistas = new Set<string>();
  // Processamentos em andamento: no desligamento (deploy) o servidor espera
  // estes terminarem antes de sair, para nao cortar uma conversa no meio.
  const emAndamento = new Set<Promise<void>>();

  function jaVista(sid: string | undefined): boolean {
    if (!sid) return false;
    if (sidsVistas.has(sid)) return true;
    sidsVistas.add(sid);
    if (sidsVistas.size > MAX_SIDS_LEMBRADAS) {
      // Set preserva a ordem de insercao: o primeiro e o mais antigo.
      sidsVistas.delete(sidsVistas.values().next().value as string);
    }
    return false;
  }

  // Devolve a promessa do processamento (sempre resolvida) para os testes
  // poderem esperar; o Express ignora o retorno.
  function webhookWhatsapp(req: Request, res: Response): Promise<void> {
    const { From, Body, MessageSid } = req.body ?? {};

    if (!From || !Body) {
      console.error('❌ Mensagem inválida (sem From ou Body)');
      res.status(400).send('Bad Request');
      return Promise.resolve();
    }

    const telefone = String(From).replace('whatsapp:', '').trim();
    const tel = mascararTelefone(telefone);

    if (jaVista(MessageSid)) {
      console.log(`↩️  Mensagem ${MessageSid} de ${tel} já recebida, ignorando a repetição`);
      res.status(200).type('text/xml').send(TWIML_VAZIO);
      return Promise.resolve();
    }

    console.log(`📨 Mensagem ${MessageSid ?? '(sem SID)'} de ${tel} ${resumoTexto(Body)}`);
    res.status(200).type('text/xml').send(TWIML_VAZIO);

    const processamento = (async () => {
      try {
        const { resposta } = await deps.processar(telefone, String(Body));
        const enviada = await deps.enviar(telefone, resposta);
        if (enviada) {
          console.log(`✅ Resposta enviada para ${tel} (${resposta.length} caracteres)`);
        } else {
          console.error(`❌ Resposta para ${tel} nao foi enviada (o provedor recusou)`);
        }
      } catch (error: any) {
        console.error(`❌ Erro ao processar mensagem de ${tel}: ${redactSecrets(error?.message ?? error)}`);
        console.error(`   Stack: ${redactSecrets(error?.stack)}`);
      }
    })();
    emAndamento.add(processamento);
    processamento.finally(() => emAndamento.delete(processamento));
    return processamento;
  }

  async function aguardarEmAndamento(): Promise<void> {
    await Promise.allSettled([...emAndamento]);
  }

  return Object.assign(webhookWhatsapp, { aguardarEmAndamento });
}
