// =====================================================
// Notification Worker
// =====================================================
// Processa notificações pendentes na tabela notificacoes_whatsapp
// Executa a cada 1 minuto via cron job
// =====================================================

import { getSupabaseService } from '../supabase/supabaseService.ts';
import { getWhatsAppService } from '../whatsapp/whatsappService.ts';
import type { WhatsAppService } from '../whatsapp/whatsappService.ts';
import { mascararTelefone } from '../../logic/security/mascararPII.ts';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';

// =====================================================
// TIPOS
// =====================================================

interface NotificacaoPendente {
  notificacao_id: string;
  eng_id: string;
  telefone: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  tentativas: number;
  created_at: string;
}

// =====================================================
// CLASSE: NotificationWorker
// =====================================================

export class NotificationWorker {
  private supabaseService;
  private whatsappService: WhatsAppService;
  private maxTentativas: number = 5;
  private loteSize: number = 10;
  // Rodada em andamento: o cron dispara a cada minuto mesmo se a anterior
  // ainda estiver enviando, e as duas pegariam as mesmas pendentes.
  private processando: boolean = false;

  constructor(whatsappService?: WhatsAppService) {
    this.supabaseService = getSupabaseService();
    this.whatsappService = whatsappService || getWhatsAppService();
  }

  /**
   * Define o WhatsApp Service (para injeção de dependência)
   */
  setWhatsAppService(service: WhatsAppService): void {
    this.whatsappService = service;
  }

  /**
   * Processa notificações pendentes
   * Busca até 10 notificações não enviadas e tenta enviar
   */
  async processarNotificacoesPendentes(): Promise<void> {
    if (this.processando) return;
    this.processando = true;
    try {
      const pendentes = await this.buscarNotificacoesPendentes();

      if (pendentes.length === 0) {
        // Sem notificações pendentes (normal)
        return;
      }

      console.log(`\n📬 Processando ${pendentes.length} notificação(ões) pendente(s)...`);

      let enviadas = 0;
      let falhas = 0;

      for (const notif of pendentes) {
        const sucesso = await this.processarNotificacao(notif);
        if (sucesso) {
          enviadas++;
        } else {
          falhas++;
        }

        // Delay entre envios
        await this.sleep(500);
      }

      if (enviadas > 0 || falhas > 0) {
        console.log(`✅ Enviadas: ${enviadas} | ❌ Falhas: ${falhas}\n`);
      }

    } catch (error: any) {
      console.error('❌ Erro ao processar notificações pendentes:', redactSecrets(error?.message ?? error));
    } finally {
      this.processando = false;
    }
  }

  /**
   * Busca notificações não enviadas do Supabase
   */
  private async buscarNotificacoesPendentes(): Promise<NotificacaoPendente[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('notificacoes_whatsapp')
      .select('*')
      .eq('enviada', false)
      .not('telefone', 'is', null)
      .lt('tentativas', this.maxTentativas)
      .order('created_at', { ascending: true })
      .limit(this.loteSize);

    if (error) {
      console.error('❌ Erro ao buscar notificações pendentes:', redactSecrets(error));
      return [];
    }

    return data || [];
  }

  /**
   * Reserva a notificacao antes de enviar: soma 1 em tentativas so se ela
   * ainda estiver pendente e com o mesmo numero de tentativas que foi lido.
   * Se outra rodada (ou outra instancia, na troca de container do deploy) ja
   * reservou, nenhuma linha muda e esta desiste. Assim cada tentativa sai
   * uma vez so. Devolve a mensagem atual da linha (a do UPDATE, nao a do
   * SELECT: um prazo alterado de novo pode ter reescrito o texto no meio),
   * ou null se nao reservou.
   */
  private async reservar(notif: NotificacaoPendente): Promise<string | null> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('notificacoes_whatsapp')
      .update({ tentativas: notif.tentativas + 1 })
      .eq('notificacao_id', notif.notificacao_id)
      .eq('enviada', false)
      .eq('tentativas', notif.tentativas)
      .select('notificacao_id, mensagem');

    if (error) {
      console.error(`   ❌ Erro ao reservar notificação ${notif.notificacao_id}:`, redactSecrets(error));
      return null;
    }
    if (!data || data.length === 0) return null;
    return data[0].mensagem;
  }

  /**
   * Processa uma notificação individual
   */
  private async processarNotificacao(notif: NotificacaoPendente): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const tel = mascararTelefone(notif.telefone);
    const tentativa = notif.tentativas + 1;

    const mensagem = await this.reservar(notif);
    if (mensagem === null) return false;

    try {
      const resultado = await this.whatsappService.sendMessageRastreado(
        notif.telefone,
        mensagem,
        notif.notificacao_id,
      );

      if (!resultado.ok) {
        console.log(`   ❌ Falha no envio (tentativa ${tentativa}/${this.maxTentativas}): ${tel}`);
        return false;
      }

      const { error } = await supabase
        .from('notificacoes_whatsapp')
        .update({ enviada: true, data_envio: new Date().toISOString() })
        .eq('notificacao_id', notif.notificacao_id);

      if (error) {
        // A mensagem saiu, mas a linha continua pendente: o worker vai
        // reenviar na proxima rodada (ate o limite de tentativas).
        console.error(
          `   ❌ Notificação ${notif.notificacao_id} enviada, mas não foi marcada como enviada:`,
          redactSecrets(error),
        );
      }

      if (resultado.sid && !error) {
        // Falhar aqui nunca pode levar a reenvio: a linha ja esta enviada.
        // So grava se o callback ainda nao chegou (status_entrega nulo): o
        // webhook pode vencer a corrida e guardar um status final.
        const { error: erroSid } = await supabase
          .from('notificacoes_whatsapp')
          .update({
            twilio_sid: resultado.sid,
            status_entrega: 'enviado',
            status_atualizado_em: new Date().toISOString(),
          })
          .eq('notificacao_id', notif.notificacao_id)
          .is('status_entrega', null);

        if (erroSid) {
          console.error(
            `   ⚠️ Notificação ${notif.notificacao_id} enviada, mas o SID não foi gravado:`,
            redactSecrets(erroSid),
          );
        }
      }

      console.log(`   ✅ Notificação enviada: ${notif.tipo} - ${tel}`);
      return true;

    } catch (error: any) {
      console.error(`   ❌ Erro ao processar notificação ${notif.notificacao_id}:`, redactSecrets(error?.message ?? error));
      return false;
    }
  }

  /**
   * Retorna estatísticas das notificações
   */
  async obterEstatisticas(): Promise<any> {
    const supabase = this.supabaseService.getClient();

    try {
      // Total pendentes
      const { count: pendentes } = await supabase
        .from('notificacoes_whatsapp')
        .select('*', { count: 'exact', head: true })
        .eq('enviada', false)
        .lt('tentativas', this.maxTentativas);

      // Total enviadas (últimas 24h)
      const dataLimite = new Date();
      dataLimite.setHours(dataLimite.getHours() - 24);

      const { count: enviadasHoje } = await supabase
        .from('notificacoes_whatsapp')
        .select('*', { count: 'exact', head: true })
        .eq('enviada', true)
        .gte('data_envio', dataLimite.toISOString());

      // Total falhadas (max tentativas)
      const { count: falhadas } = await supabase
        .from('notificacoes_whatsapp')
        .select('*', { count: 'exact', head: true })
        .eq('enviada', false)
        .gte('tentativas', this.maxTentativas);

      return {
        pendentes: pendentes || 0,
        enviadasHoje: enviadasHoje || 0,
        falhadas: falhadas || 0
      };

    } catch (error: any) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
      return { pendentes: 0, enviadasHoje: 0, falhadas: 0 };
    }
  }

  /**
   * Utilitário: sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =====================================================
// SINGLETON
// =====================================================

let notificationWorkerInstance: NotificationWorker | null = null;

export function getNotificationWorker(): NotificationWorker {
  if (!notificationWorkerInstance) {
    notificationWorkerInstance = new NotificationWorker();
  }
  return notificationWorkerInstance;
}

export function setNotificationWorker(worker: NotificationWorker): void {
  notificationWorkerInstance = worker;
}

