// =====================================================
// HANDLER PRINCIPAL: Mensagens do Chatbot
// =====================================================
// Responsabilidade: Colega (Chatbot)
//
// Este módulo orquestra todos os fluxos conversacionais
// e decide qual fluxo ativar baseado na mensagem do usuário
// E TAMBÉM faz autenticação por número de WhatsApp
// =====================================================

// Flows ativos
import { EngineerProjectFlow } from '../flows/engineerProjectFlow.ts';
import { OwnerFlow } from '../flows/ownerFlow.ts';

// Supabase para autenticação (lazy loading para evitar problemas com dotenv)
import {
  getSupabaseService,
  SupabaseService,
  SupabaseUnavailableError,
} from '../../integrations/supabase/supabaseService.ts';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';

// Lazy loading: criar instância apenas quando necessário
let supabaseServiceInstance: SupabaseService | null = null;
function getSupabase(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = getSupabaseService();
  }
  return supabaseServiceInstance;
}

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export type TipoUsuario = 'engenheiro' | 'dono' | 'nao_cadastrado';

/**
 * Resultado da autenticação por telefone.
 *
 * `indisponivel` é um estado à parte de propósito: ele NÃO entra em
 * TipoUsuario porque não pode ser gravado como tipo de sessão. Uma falha
 * momentânea do banco não é uma característica do usuário.
 */
export type ResultadoAutenticacao =
  | { tipo: TipoUsuario; user_id?: string }
  | { indisponivel: true };

export interface UserSession {
  whatsapp: string;
  tipo_usuario?: TipoUsuario;
  user_id?: string; // eng_id ou dono_id
  fluxo_ativo?: 'engineer_project' | 'owner' | null;
  instancia_fluxo?: any;
  ultima_interacao: Date;
}

export interface MessageResponse {
  resposta: string;
  erro?: string;
}

// =====================================================
// CLASSE: Handler de Mensagens
// =====================================================

export class MessageHandler {
  private sessoes: Map<string, UserSession>;
  // Uma fila por telefone: o webhook chama processarMensagem a cada POST sem esperar o
  // anterior, e duas mensagens rapidas do mesmo numero mexiam no mesmo state ao mesmo tempo
  // (um "1" repetido na confirmacao batia no UNIQUE do apontamento). Guarda so a ultima
  // promessa de cada telefone; a entrada sai quando a fila esvazia.
  private filas: Map<string, Promise<unknown>> = new Map();
  private readonly MAX_STACK_DEPTH = 10;
  private timeout_sessao: number = 15 * 60 * 1000; // 15 minutos

  constructor() {
    this.sessoes = new Map();

    // Sessões são mantidas em memória (Map)
    // SessionService (Redis) está disponível mas não integrado ao MessageHandler
    console.log('✅ MessageHandler inicializado com sessões in-memory');

    // Limpar sessões antigas a cada 5 minutos para evitar memory leak
    setInterval(() => this.limparSessoesAntigas(), 5 * 60 * 1000);
  }

  // =====================================================
  // FUNÇÃO PRINCIPAL: Processar Mensagem
  // =====================================================

  async processarMensagem(whatsapp: string, mensagem: string): Promise<MessageResponse> {
    const chave = this.normalizarWhatsapp(whatsapp);
    const anterior = this.filas.get(chave) ?? Promise.resolve();
    // Falha da mensagem anterior nao pode travar as seguintes do mesmo telefone.
    const atual = anterior.catch(() => undefined).then(() => this.processarMensagemInterno(whatsapp, mensagem));
    const marcador = atual.catch(() => undefined);
    this.filas.set(chave, marcador);
    marcador.then(() => {
      if (this.filas.get(chave) === marcador) this.filas.delete(chave);
    });
    return atual;
  }

  private async processarMensagemInterno(whatsapp: string, mensagem: string): Promise<MessageResponse> {
    try {
      console.log(`\n🔵 MessageHandler.processarMensagem()`);
      console.log(`   WhatsApp: ${whatsapp}`);
      console.log(`   Mensagem: "${mensagem}"`);

      // Normalizar WhatsApp
      const whatsappNormalizado = this.normalizarWhatsapp(whatsapp);

      // Obter ou criar sessão
      let sessao = this.sessoes.get(whatsappNormalizado);

      if (!sessao) {
        console.log(`   📝 Criando nova sessão para ${whatsappNormalizado}`);

        // AUTENTICAÇÃO: Verificar se é engenheiro ou dono
        console.log(`   🔍 [DEBUG] Iniciando autenticação...`);
        const tipoUsuario = await this.autenticarUsuario(whatsappNormalizado);

        if ('indisponivel' in tipoUsuario) {
          // Sem sessão criada de propósito: gravar 'nao_cadastrado' aqui
          // envenenaria o cache em memória por até 15 minutos, fazendo a
          // falha sobreviver à recuperação do banco.
          console.error(`   ⚠️ Autenticação indisponível — nenhuma sessão criada`);
          return { resposta: this.mensagemServicoIndisponivel() };
        }

        console.log(`   🔍 [DEBUG] Autenticação concluída: ${tipoUsuario.tipo}`);

        sessao = {
          whatsapp: whatsappNormalizado,
          tipo_usuario: tipoUsuario.tipo,
          user_id: tipoUsuario.user_id,
          fluxo_ativo: null,
          ultima_interacao: new Date(),
        };
        this.sessoes.set(whatsappNormalizado, sessao);

        console.log(`   ✅ Sessão criada - Tipo: ${tipoUsuario.tipo}`);

        // Se for dono, iniciar OwnerFlow imediatamente
        if (tipoUsuario.tipo === 'dono') {
          console.log(`   🔄 Iniciando OwnerFlow automaticamente para novo dono`);
          return await this.iniciarFluxoDono(sessao);
        }

        // Se for engenheiro, mostrar menu
        if (tipoUsuario.tipo === 'engenheiro') {
          return { resposta: this.mensagemMenu(tipoUsuario.tipo) };
        }
      } else {
        console.log(`   ✅ Sessão existente encontrada`);
        console.log(`   Tipo de usuário: ${sessao.tipo_usuario || 'não autenticado'}`);
        console.log(`   Fluxo ativo: ${sessao.fluxo_ativo || 'nenhum'}`);
      }

      // Atualizar timestamp da última interação
      sessao.ultima_interacao = new Date();

      // VERIFICAR SE É NÚMERO NÃO CADASTRADO
      if (sessao.tipo_usuario === 'nao_cadastrado') {
        // Reautenticar: o número pode ter sido cadastrado no Supabase DEPOIS
        // desta sessão ter sido criada. Como as sessões ficam em memória, sem
        // isto só um redeploy reconheceria o número recém-cadastrado.
        console.log(`   🔁 Sessão 'nao_cadastrado' — reautenticando no banco...`);
        const reauth = await this.autenticarUsuario(sessao.whatsapp);

        if ('indisponivel' in reauth) {
          // Sessão preservada como está: não sabemos nada de novo sobre ela.
          console.error(`   ⚠️ Reautenticação indisponível — sessão preservada`);
          return { resposta: this.mensagemServicoIndisponivel() };
        }

        if (reauth.tipo === 'nao_cadastrado') {
          return { resposta: this.mensagemNaoCadastrado() };
        }

        // Número agora reconhecido → atualizar a sessão e dar o ponto de entrada certo
        console.log(`   ✅ Número agora reconhecido: ${reauth.tipo}`);
        sessao.tipo_usuario = reauth.tipo;
        sessao.user_id = reauth.user_id;
        sessao.fluxo_ativo = null;
        sessao.instancia_fluxo = null;

        if (reauth.tipo === 'dono') {
          return await this.iniciarFluxoDono(sessao);
        }
        return { resposta: this.mensagemMenu(reauth.tipo) };
      }

      // Verificar comandos globais
      console.log(`   🔍 Verificando comandos globais...`);
      const comandoGlobal = await this.processarComandoGlobal(mensagem, sessao);
      if (comandoGlobal) {
        console.log(`   ✅ Comando global processado\n`);
        return { resposta: comandoGlobal };
      }

      // Se há fluxo ativo, continuar nele
      if (sessao.fluxo_ativo && sessao.instancia_fluxo) {
        const resultado = await sessao.instancia_fluxo.processarMensagem(mensagem);

        // Se o fluxo finalizou, limpar sessão
        if (resultado.finalizado) {
          sessao.fluxo_ativo = null;
          sessao.instancia_fluxo = null;
        }

        return { resposta: resultado.mensagem, erro: resultado.erro };
      }

      // Classificar intenção e iniciar fluxo apropriado
      const intencao = this.classificarIntencao(mensagem);

      switch (intencao) {
        case 'gerenciar_projeto':
          console.log(`   🔄 Processando fluxo de gerenciamento de projeto`);

          // DECISÃO: Fluxo de engenheiro OU fluxo de dono
          if (sessao.tipo_usuario === 'dono') {
            return await this.iniciarFluxoDono(sessao);
          }

          // Se for comando direto de menu (1, 2, 3, 4), processar diretamente
          const mensagemNorm = mensagem.trim();
          if (mensagemNorm === '1' || mensagemNorm === '2' || mensagemNorm === '3' || mensagemNorm === '4') {
            console.log(`   ✅ Opção do menu detectada: ${mensagemNorm}`);
            // Iniciar fluxo e processar a escolha imediatamente
            const flow = new EngineerProjectFlow(sessao.whatsapp);
            sessao.fluxo_ativo = 'engineer_project';
            sessao.instancia_fluxo = flow;

            // Processar "iniciar" primeiro (vai para stepInicio → escolher_acao)
            await flow.processarMensagem('iniciar');

            // Depois processar a escolha (1, 2, 3 ou 4)
            const resultado = await flow.processarMensagem(mensagemNorm);
            console.log(`   ✅ Fluxo processado, retornando resposta\n`);
            return { resposta: resultado.mensagem };
          } else {
            console.log(`   ✅ Iniciando fluxo de projeto\n`);
            // Palavra-chave genérica (projeto, cadastrar, etc) - mostrar menu
            return await this.iniciarFluxoProjeto(sessao);
          }

        case 'ajuda':
          console.log(`   ✅ Retornando mensagem de ajuda\n`);
          return { resposta: this.mensagemAjuda(sessao.tipo_usuario) };

        case 'menu':
          console.log(`   ✅ Retornando menu principal\n`);
          // Para o dono, iniciar o OwnerFlow diretamente
          if (sessao.tipo_usuario === 'dono') {
            return await this.iniciarFluxoDono(sessao);
          }
          return { resposta: this.mensagemMenu(sessao.tipo_usuario) };

        case 'desconhecido':
        default:
          // Não tenta mais processar via IA - força uso do menu
          console.log(`   ⚠️ Intenção não reconhecida\n`);
          // Se for dono, iniciar OwnerFlow ao invés de mostrar mensagem de erro
          if (sessao.tipo_usuario === 'dono') {
            console.log(`   🔄 Iniciando OwnerFlow para dono (intenção não reconhecida)`);
            return await this.iniciarFluxoDono(sessao);
          }
          return { resposta: this.mensagemNaoEntendida() };
      }
    } catch (error: any) {
      console.error('\n❌ ERRO no MessageHandler:');
      console.error(`   WhatsApp: ${whatsapp}`);
      console.error(`   Mensagem: "${mensagem}"`);
      console.error(`   Erro: ${redactSecrets(error?.message ?? error)}`);
      console.error(`   Stack: ${redactSecrets(error?.stack)}\n`);
      return {
        resposta: '❌ Desculpe, ocorreu um erro. Tente novamente.',
        erro: redactSecrets(error?.message ?? error),
      };
    }
  }

  // =====================================================
  // FUNÇÃO: Autenticar Usuário
  // =====================================================

  private async autenticarUsuario(whatsapp: string): Promise<ResultadoAutenticacao> {
    try {
      // Verificar se é engenheiro
      const engenheiro = await getSupabase().buscarEngenheiroPorTelefone(whatsapp);
      if (engenheiro) {
        console.log(`   ✅ Engenheiro identificado: ${engenheiro.nome}`);
        return { tipo: 'engenheiro', user_id: engenheiro.eng_id };
      }

      // Verificar se é dono
      const dono = await getSupabase().buscarDonoPorTelefone(whatsapp);
      if (dono) {
        console.log(`   ✅ Dono identificado: ${dono.nome}`);
        return { tipo: 'dono', user_id: dono.dono_id };
      }
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) {
        // As consultas não rodaram. Afirmar "não cadastrado" aqui seria mentir
        // para um engenheiro que está, sim, cadastrado.
        console.error(`   ⚠️ Cadastro não verificável agora (${error.scope})`);
        return { indisponivel: true };
      }
      throw error;
    }

    // Consultas rodaram normalmente e o telefone não existe em nenhuma tabela.
    console.log(`   ⚠️ Número não cadastrado: ${whatsapp}`);
    return { tipo: 'nao_cadastrado' };
  }

  // =====================================================
  // FUNÇÃO: Processar Comandos Globais
  // =====================================================

  private async processarComandoGlobal(mensagem: string, sessao: UserSession): Promise<string | null> {
    const mensagemLower = mensagem.toLowerCase().trim();

    // Comando: Sincronizar manualmente
    if (mensagemLower === 'sync' || mensagemLower === 'sincronizar') {
      return await this.executarSincronizacaoManual();
    }

    // Comando: Cancelar fluxo atual
    if (mensagemLower === 'cancelar' || mensagemLower === 'sair') {
      if (sessao.fluxo_ativo) {
        sessao.fluxo_ativo = null;
        sessao.instancia_fluxo = null;
        return '❌ Fluxo cancelado.\n\nDigite "menu" para ver as opções.';
      }
      return null;
    }

    // Comando: Menu
    if (mensagemLower === 'menu' || mensagemLower === 'oi' || mensagemLower === 'olá') {
      sessao.fluxo_ativo = null;
      sessao.instancia_fluxo = null;
      return null; // Deixar passar para o classificador processar
    }

    return null;
  }

  // =====================================================
  // FUNÇÃO: Classificar Intenção do Usuário
  // =====================================================

  private classificarIntencao(mensagem: string): string {
    const mensagemLower = mensagem.toLowerCase().trim();

    // Atalhos numéricos do menu
    if (mensagemLower === '1' || mensagemLower === '2' || mensagemLower === '3' || mensagemLower === '4') {
      return 'gerenciar_projeto'; // Opções 1, 2, 3, 4 = Gestão de projetos
    }

    // Palavras-chave para MODIFICAR projetos (Engenheiros)
    const keywordsModificar = [
      'projeto',
      'atualizar',
      'registrar',
    ];

    // Palavras-chave para ajuda
    const keywordsAjuda = [
      'ajuda',
      'help',
      'como usar',
      'comandos',
    ];

    // Palavras-chave para menu
    const keywordsMenu = [
      'menu',
      'oi',
      'olá',
      'ola',
      'início',
      'inicio',
    ];

    // Classificar (prioridade: específico → genérico)
    if (keywordsMenu.some(kw => mensagemLower === kw)) {
      return 'menu';
    }

    if (keywordsAjuda.some(kw => mensagemLower.includes(kw))) {
      return 'ajuda';
    }

    if (keywordsModificar.some(kw => mensagemLower.includes(kw))) {
      return 'gerenciar_projeto';
    }

    // Default: mensagem não reconhecida
    return 'desconhecido';
  }

  // =====================================================
  // FUNÇÕES: Iniciar Fluxos
  // =====================================================

  private async iniciarFluxoProjeto(sessao: UserSession): Promise<MessageResponse> {
    const flow = new EngineerProjectFlow(sessao.whatsapp);
    sessao.fluxo_ativo = 'engineer_project';
    sessao.instancia_fluxo = flow;

    // Iniciar fluxo (avança state para escolher_acao)
    await flow.processarMensagem('iniciar');
    // Mostrar menu do engenheiro (stepInicio retorna mensagem vazia)
    return { resposta: this.mensagemMenu(sessao.tipo_usuario) };
  }

  private async iniciarFluxoDono(sessao: UserSession): Promise<MessageResponse> {
    if (!sessao.user_id) {
      return {
        resposta: '❌ Erro de autenticação. Digite "menu" para recomeçar.',
      };
    }

    // Sempre criar nova instância (reset do fluxo) para evitar enviar 'iniciar' ao step atual
    const flow = new OwnerFlow(sessao.whatsapp, sessao.user_id);
    sessao.fluxo_ativo = 'owner';
    sessao.instancia_fluxo = flow;

    // Iniciar fluxo (mostra menu do dono)
    const resultado = await flow.processarMensagem('iniciar');
    return { resposta: resultado.mensagem };
  }

  // =====================================================
  // MENSAGENS PADRÃO
  // =====================================================

  private mensagemMenu(tipoUsuario?: TipoUsuario): string {
    if (tipoUsuario === 'dono') {
      return `📋 *Menu do Dono*

📊 *Gestão da Empresa*
1️⃣ Distribuir tarefa para engenheiro
2️⃣ Verificar status dos projetos
3️⃣ Consultar histórico e relatórios

❓ *Ajuda*
Digite "ajuda" para instruções

_Digite o número da opção desejada_`;
    }

    // Menu de engenheiro (padrão)
    return `📋 *Menu do Engenheiro*

🔔 *Atualizações Diárias*
1️⃣ Notificação Matinal
2️⃣ Notificação Noturna

📊 *Gestão*
3️⃣ Visualizar Meus Projetos
4️⃣ Marcar Etapa Concluída

❓ *Ajuda*
Digite "ajuda" para instruções

_Digite o número da opção desejada_`;
  }

  private mensagemAjuda(tipoUsuario?: TipoUsuario): string {
    if (tipoUsuario === 'dono') {
      return `❓ *Ajuda - Dono da Empresa*

1️⃣ *Distribuir tarefa para engenheiro*
Atribua projetos aos engenheiros: escolha o engenheiro, defina área, prazos e observações.

2️⃣ *Verificar status dos projetos*
Acompanhe o andamento de todos os projetos, consulte prazos e veja a performance da equipe.

3️⃣ *Consultar histórico e relatórios*
Acesse históricos de retrabalho, projetos concluídos e indicadores por área.

🔄 *Comandos úteis*
• *menu* — volta ao menu principal
• *cancelar* — sai do fluxo atual
• *sync* — força sincronização

_Digite "menu" para voltar_`;
    }

    // Ajuda de engenheiro (padrão)
    return `❓ *Ajuda - Engenheiro*

1️⃣ *Notificação Matinal*
Informe o status atual e a previsão do dia para cada projeto.

2️⃣ *Notificação Noturna*
Registre o que foi feito, retrabalho e observações do dia.

3️⃣ *Visualizar Meus Projetos*
Veja a lista completa dos seus projetos com status e detalhes.

4️⃣ *Marcar Etapa Concluída*
Marque etapas de pavimentos como concluídas para atualizar o progresso ponderado.

🔔 *Notificações automáticas*
• Manhã (11:20): lembrete para informar status
• Noite (16:30): lembrete para registrar o que foi feito

🔄 *Comandos úteis*
• *menu* — volta ao menu principal
• *cancelar* — sai do fluxo atual
• *voltar* ou *0* — volta ao passo anterior
• *sync* — força sincronização

_Digite "menu" para voltar_`;
  }

  /**
   * Enviada quando a consulta de cadastro NÃO pôde ser feita.
   *
   * Sem nome de banco, tabela, status HTTP, stack ou credencial: o usuário do
   * WhatsApp não precisa (e não pode) ver detalhe técnico nenhum.
   */
  private mensagemServicoIndisponivel(): string {
    return `⚠️ *Serviço temporariamente indisponível*

Não foi possível verificar seu cadastro neste momento.
Por favor, tente novamente em alguns minutos.`;
  }

  /** Enviada SOMENTE quando a consulta rodou e o telefone realmente não existe. */
  private mensagemNaoCadastrado(): string {
    return `❌ *Número não cadastrado*

Seu número de WhatsApp não está cadastrado no sistema.

Para obter acesso, entre em contato com o administrador da TecPred.

ℹ️ *Informações necessárias:*
• Seu nome completo
• Cargo/função (Engenheiro ou Dono)
• Número de WhatsApp (este número)

_Após o cadastro, você receberá acesso automático ao sistema._`;
  }

  private mensagemNaoEntendida(): string {
    return `⚠️ Desculpe, não entendi sua mensagem.

Digite *menu* para ver as opções disponíveis`;
  }

  // =====================================================
  // FUNÇÃO: Sincronização Manual
  // =====================================================

  private async executarSincronizacaoManual(): Promise<string> {
    try {
      const { executarSincronizacao } = await import('../../integrations/cron/syncDatabaseToSheets.ts');

      // Executar sincronização em background
      executarSincronizacao().catch(error => {
        console.error('❌ Erro na sincronização manual:', error);
      });

      return `🔄 *Sincronização iniciada!*\n\n` +
        `Os dados do Supabase estão sendo sincronizados\n` +
        `para o Google Sheets agora.\n\n` +
        `⏱️ Aguarde alguns segundos e verifique a planilha.\n\n` +
        `_A sincronização automática continua a cada 5 minutos_`;
    } catch (error: any) {
      console.error('Erro ao executar sincronização manual:', error);
      return `❌ Erro ao iniciar sincronização.\n\n` +
        `Verifique se o Supabase está configurado corretamente.`;
    }
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================

  private normalizarWhatsapp(whatsapp: string): string {
    try {
      // Se já tem @c.us ou @g.us, remover primeiro
      let numero = whatsapp;
      if (whatsapp.includes('@')) {
        numero = whatsapp.split('@')[0];
      }

      // Remove caracteres especiais e garante formato +55XXXXXXXXXXX
      const cleaned = numero.replace(/[^\d+]/g, '');

      if (!cleaned.startsWith('+')) {
        // Evitar duplo +55: se o número já começa com 55 (código do país Brasil),
        // não adicionar outro 55
        if (cleaned.startsWith('55') && cleaned.length >= 12) {
          return '+' + cleaned;
        }
        return '+55' + cleaned;
      }

      return cleaned;
    } catch (error: any) {
      console.error(`❌ Erro ao normalizar WhatsApp "${whatsapp}":`, error);
      return whatsapp.replace(/[^\d+]/g, '').replace(/^(\d+)$/, '+55$1');
    }
  }

  private limparSessoesAntigas(): void {
    const agora = new Date();
    const sessoesARemover: string[] = [];

    this.sessoes.forEach((sessao, whatsapp) => {
      const tempoDecorrido = agora.getTime() - sessao.ultima_interacao.getTime();
      if (tempoDecorrido > this.timeout_sessao) {
        sessoesARemover.push(whatsapp);
      }
    });

    sessoesARemover.forEach(whatsapp => {
      this.sessoes.delete(whatsapp);
      console.log(`Sessão expirada removida: ${whatsapp}`);
    });

    if (sessoesARemover.length > 0) {
      console.log(`${sessoesARemover.length} sessões antigas removidas`);
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================

  getSessaoAtiva(whatsapp: string): UserSession | undefined {
    return this.sessoes.get(this.normalizarWhatsapp(whatsapp));
  }

  getTotalSessoes(): number {
    return this.sessoes.size;
  }
}

// =====================================================
// EXPORTAR INSTÂNCIA SINGLETON
// =====================================================

export const messageHandler = new MessageHandler();

// =====================================================
// EXEMPLO DE USO
// =====================================================

/*
import { messageHandler } from './messageHandler';

// Processar mensagens
const resposta1 = await messageHandler.processarMensagem('+5511999999999', 'oi');
console.log(resposta1.resposta);

const resposta2 = await messageHandler.processarMensagem('+5511999999999', 'registrar execução');
console.log(resposta2.resposta);

const resposta3 = await messageHandler.processarMensagem('+5511999999999', 'PRJ-001');
console.log(resposta3.resposta);

// ... continuar o fluxo
*/

