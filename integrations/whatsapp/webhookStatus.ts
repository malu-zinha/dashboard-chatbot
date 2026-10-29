// =====================================================
// Webhook Twilio - status de entrega das mensagens enviadas
// =====================================================
// Grava em notificacoes_whatsapp o resultado de cada callback. Responde 200
// sempre (a Twilio reenvia em qualquer outro codigo) e nunca lanca.
// A linha vem pelo id na query (?notificacao=) ou, na falta dele, pelo SID:
// o callback pode chegar antes de o worker gravar o SID.
// =====================================================

import type { Request, Response } from 'express';
import type { SupabaseService } from '../supabase/supabaseService.ts';
import { proximoStatusEntrega } from './statusEntrega.ts';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';
import { mascararTelefone } from '../../logic/security/mascararPII.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Leituras+gravacoes por callback quando o compare-and-set perde a corrida.
const MAX_TENTATIVAS = 3;

export interface DependenciasWebhookStatus {
  buscar: SupabaseService['buscarStatusEntrega'];
  gravar: SupabaseService['gravarStatusEntrega'];
}

export function criarWebhookStatus(deps: DependenciasWebhookStatus) {
  return async function webhookStatus(req: Request, res: Response): Promise<void> {
    try {
      const { MessageSid, MessageStatus, ErrorCode, To } = (req.body ?? {}) as Record<string, any>;
      console.log(`📬 Status da mensagem ${MessageSid} para ${mascararTelefone(To)}: ${MessageStatus}`);

      const q = (req.query ?? {}).notificacao;
      const notificacaoId = typeof q === 'string' && UUID.test(q) ? q : undefined;
      const sid = typeof MessageSid === 'string' && MessageSid ? MessageSid : undefined;

      if ((notificacaoId || sid) && typeof MessageStatus === 'string') {
        // Compare-and-set: se outro escritor avancou a linha entre a leitura e a
        // gravacao, le de novo e decide de novo (ex.: o worker gravou 'enviado'
        // e o 'undelivered' ainda precisa entrar por cima).
        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
          const linha = await deps.buscar({ notificacaoId, sid });
          if (!linha) break;
          const novo = proximoStatusEntrega(linha.status_entrega, MessageStatus);
          if (!novo) break;
          const gravou = await deps.gravar(
            linha.notificacao_id,
            {
              status_entrega: novo,
              erro_codigo: ErrorCode ? String(ErrorCode) : null,
              ...(sid ? { twilio_sid: sid } : {}),
            },
            linha.status_entrega,
          );
          if (gravou) break;
          if (tentativa === MAX_TENTATIVAS) {
            console.warn(`⚠️  Status ${novo} nao gravado apos ${MAX_TENTATIVAS} tentativas: a notificacao mudou a cada leitura`);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao gravar status de entrega:', redactSecrets(error?.message ?? error));
    }
    res.sendStatus(200);
  };
}
