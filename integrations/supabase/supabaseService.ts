// =====================================================
// SERVIÇO: Conexão e Operações com Supabase
// =====================================================
// Responsabilidade: Gerenciar todas as operações com o banco de dados
// Usado por: EngineerProjectFlow, NotificationFlows
// Schema: Novo schema N:N (engenheiros_projetos)
// =====================================================

console.log('🔍 [SUPABASE] Arquivo supabaseService.ts sendo importado...');

import { createClient } from '@supabase/supabase-js';
import { logSupabaseError, redactSecrets } from '../../logic/security/redactSecrets.ts';
import { InvalidCredentialError, readCredential } from '../../logic/security/envSecret.ts';
import { dataLocalBR } from '../../logic/datas/dataLocal';
import { variantesTelefoneBR } from '../../logic/validation/telefoneBR';
import { mascararTelefone } from '../../logic/security/mascararPII.ts';

console.log('🔍 [SUPABASE] createClient importado do @supabase/supabase-js');

// =====================================================
// ERROS
// =====================================================

/**
 * Falha de INFRAESTRUTURA ao consultar o Supabase.
 *
 * Existe para separar dois estados que o código antigo fundia num único
 * `null`: "a consulta rodou e não há registro" (usuário não cadastrado) e
 * "a consulta não rodou" (chave inválida, rede, timeout, RLS). Confundir os
 * dois foi o que fez engenheiros cadastrados receberem
 * "❌ Número não cadastrado" durante a indisponibilidade.
 *
 * A mensagem é um código fixo — nunca carrega detalhe do Supabase.
 */
export class SupabaseUnavailableError extends Error {
  constructor(public readonly scope: string) {
    super('SUPABASE_QUERY_FAILED');
    this.name = 'SupabaseUnavailableError';
  }
}

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface Engenheiro {
  eng_id: string;
  nome: string;
  telefone?: string;
  exclusivo: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DonoEmpresa {
  dono_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  created_at: string;
}

export interface TipoObra {
  codigo: string;
  descricao: string;
}

export interface MotivoRetrabalho {
  codigo: string;
  descricao: string;
}

export interface TipoProjeto {
  codigo: string;
  area_codigo: string;
  descricao: string;
  tempo_dias: number;
}

export interface Complexidade {
  codigo: string;
  descricao: string;
  dias_estimados: number;
}

export interface Area {
  area_id: string;
  codigo: string;
  descricao: string;
  tempo_trabalho_dias: number;
  ativo: boolean;
}

export interface StatusCode {
  status_id: number;
  codigo: string;
  descricao: string;
  ordem: number;
  percentual_base: number;
  ativo: boolean;
}

export interface Projeto {
  projeto_id: string;
  codigo_projeto: string;
  cliente: string;
  descricao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Atribuicao {
  id: string;
  eng_id: string;
  projeto_id: string;
  area_id: string;
  data_inicio?: string;
  data_prevista?: string;
  data_conclusao?: string;
  status_id?: number;
  percentual_andamento: number;
  percentual_ponderado?: number;
  tempo_trabalho_dias?: number;
  observacoes?: string;
  instancia_label?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Previsao {
  id: string;
  eng_projeto_id: string;
  projeto_id: string;
  eng_id: string;
  data_registro: string;
  previsao_texto: string;
  feito_texto?: string;
  status_id?: number;
  nova_data_prevista?: string;
  editavel: boolean;
  created_at: string;
  updated_at: string;
}

export interface Retrabalho {
  id: string;
  eng_projeto_id: string;
  projeto_id: string;
  eng_id: string;
  necessitou_retrabalho: boolean;
  data_retrabalho: string;
  motivo_retrabalho?: string;
  descricao?: string;
  tipo_retrabalho?: string;
  horas_trabalhadas_total?: number | null;
  horas_retrabalho?: number | null;
  status_id?: number;
  created_at: string;
}

/**
 * Resultado de registrarRetrabalho. Discriminado de proposito: os quatro modos de falha sao
 * problemas diferentes (configuracao, transporte, validacao do banco, excecao) e precisam ser
 * distinguiveis no log. Mesmo formato de validarHorasRetrabalho, no fluxo do engenheiro.
 */
export type ResultadoRegistroRetrabalho =
  | { ok: true }
  | {
      ok: false;
      motivo: 'sem_conexao' | 'erro_rpc' | 'recusado' | 'excecao';
      mensagem: string;
    };

/**
 * Resultado de atualizarFeitoDia. Separa as duas gravacoes porque elas vao para tabelas
 * diferentes e falham por motivos diferentes: o relato do dia em projetos_previsao e a
 * observacao em engenheiros_projetos. Quem avisa o engenheiro precisa saber qual das duas
 * se perdeu para nao mandar refazer o que ja esta gravado.
 */
export type ResultadoFeitoDia =
  | { ok: true }
  | {
      ok: false;
      motivo: 'sem_conexao' | 'atribuicao_nao_encontrada' | 'erro_feito' | 'erro_observacoes' | 'excecao';
      mensagem: string;
    };

// Interface de compatibilidade (para código antigo)
export interface LimpezaProjetosResult {
  dry_run: boolean;
  meses_retencao: number;
  data_limite: string;
  projetos_candidatos: number;
  projetos_excluidos: number;
}

export interface ProjetoLegacy {
  id: string;
  codigo: string;
  nome?: string;
  cliente: string;
  engenheiro_id: string;
  area?: string;
  status: string;
  percentual_total: number;
  data_inicio?: string;
  data_previsao_termino?: string;
  ativo: boolean;
}

// =====================================================
// SERVIÇO PRINCIPAL
// =====================================================

export class SupabaseService {
  private supabase: any;
  private connected: boolean = false;

  constructor() {
    console.log('🔍 [SUPABASE] Construtor chamado...');

    // trim + validação ANTES do createClient: um \n colado ao copiar a chave
    // para o painel do Railway vira `Headers.set: "<chave>" is an invalid
    // header value` lá dentro do fetch, com a credencial na mensagem.
    let supabaseUrl = '';
    let supabaseKey = '';
    try {
      supabaseUrl = readCredential('SUPABASE_URL');
      supabaseKey = readCredential('SUPABASE_SERVICE_ROLE_KEY');
    } catch (error) {
      // Credencial presente mas malformada. Não derrubamos o processo: sem
      // cliente, `connected` fica false e as buscas de autenticação lançam
      // SupabaseUnavailableError — o engenheiro recebe "serviço
      // indisponível", não "número não cadastrado".
      console.error(
        error instanceof InvalidCredentialError
          ? `❌ [SUPABASE] ${error.message}`
          : `❌ [SUPABASE] ${redactSecrets(error)}`
      );
      this.supabase = null as any;
      return;
    }

    console.log('🔍 [SUPABASE] URL:', supabaseUrl ? 'OK' : 'FALTA');
    console.log('🔍 [SUPABASE] KEY:', supabaseKey ? 'OK' : 'FALTA');

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
      console.warn('   Sistema funcionará apenas com Google Sheets');
      this.supabase = null as any;
      console.log('🔍 [SUPABASE] Construtor finalizado (sem config)');
      return;
    }

    try {
      console.log('🔍 [SUPABASE] Chamando createClient()...');
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('🔍 [SUPABASE] createClient() retornou!');
      this.connected = true;
      console.log('✅ Supabase conectado (Schema N:N)');
    } catch (error: any) {
      console.error('❌ Erro ao conectar Supabase:', redactSecrets(error?.message ?? error));
      this.supabase = null as any;
    }
    console.log('🔍 [SUPABASE] Construtor finalizado');
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Retorna o cliente Supabase para queries diretas
   */
  getClient() {
    return this.supabase;
  }

  /**
   * Acha a notificacao pelo id ou pelo SID da Twilio (status de entrega).
   */
  async buscarStatusEntrega(
    ref: { notificacaoId?: string; sid?: string },
  ): Promise<{ notificacao_id: string; status_entrega: string | null } | null> {
    if (!ref.notificacaoId && !ref.sid) return null;
    let consulta = this.supabase
      .from('notificacoes_whatsapp')
      .select('notificacao_id, status_entrega');
    consulta = ref.notificacaoId
      ? consulta.eq('notificacao_id', ref.notificacaoId)
      : consulta.eq('twilio_sid', ref.sid as string);
    const { data, error } = await consulta.limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  }

  /**
   * Grava o resultado da entrega; lanca em erro do banco.
   */
  async gravarStatusEntrega(
    notificacaoId: string,
    campos: { status_entrega: string; erro_codigo: string | null; twilio_sid?: string },
  ): Promise<void> {
    const { error } = await this.supabase
      .from('notificacoes_whatsapp')
      .update({ ...campos, status_atualizado_em: new Date().toISOString() })
      .eq('notificacao_id', notificacaoId);
    if (error) throw new Error(error.message);
  }

  // =====================================================
  // AUTENTICAÇÃO VIA WHATSAPP
  // =====================================================

  /**
   * Busca engenheiro por WhatsApp (via campo telefone)
   *
   * NÃO usar para autenticação — use buscarEngenheiroPorTelefone, que
   * distingue "não cadastrado" de "banco indisponível".
   *
   * Este wrapper serve o sync de planilhas (syncDatabaseToSheets,
   * criarOuBuscarEngenheiro) e o engineerProjectFlow, que já rodam DEPOIS da
   * autenticação e cujo contrato histórico é "null em qualquer problema".
   * Mantemos esse contrato de propósito: propagar a exceção aqui mudaria o
   * comportamento do cron em produção, fora do escopo deste fix.
   */
  async buscarEngenheiroPorWhatsapp(whatsapp: string): Promise<Engenheiro | null> {
    try {
      return await this.buscarEngenheiroPorTelefone(whatsapp);
    } catch (error) {
      if (error instanceof SupabaseUnavailableError) return null;
      throw error;
    }
  }

  /**
   * Cria engenheiro com telefone/WhatsApp
   */
  async criarEngenheiroComAuth(
    nome: string,
    whatsapp: string,
    exclusivo: boolean = false
  ): Promise<Engenheiro | null> {
    if (!this.connected) return null;

    try {
      const whatsappNormalizado = whatsapp.replace(/[^\d+]/g, '');

      // Criar engenheiro com telefone
      const { data: engenheiro, error: engError } = await this.supabase
        .from('engenheiros')
        .insert({
          nome,
          telefone: whatsappNormalizado,
          exclusivo,
          ativo: true,
        })
        .select()
        .single();

      if (engError || !engenheiro) {
        console.error('❌ Erro ao criar engenheiro:', engError);
        return null;
      }

      console.log(`✅ Engenheiro criado: ${nome} (${mascararTelefone(whatsappNormalizado)})`);
      return engenheiro;
    } catch (error: any) {
      console.error('❌ Erro ao criar engenheiro:', error.message);
      return null;
    }
  }

  /**
   * Busca ou cria engenheiro pelo WhatsApp (compatibilidade)
   */
  async criarOuBuscarEngenheiro(whatsapp: string, nome: string): Promise<Engenheiro | null> {
    if (!this.connected) return null;

    // Tentar buscar existente
    const existente = await this.buscarEngenheiroPorWhatsapp(whatsapp);
    if (existente) {
      console.log(`✅ Engenheiro encontrado: ${existente.nome}`);
      return existente;
    }

    // Criar novo
    return await this.criarEngenheiroComAuth(nome, whatsapp, false);
  }

  /**
   * Busca engenheiro por ID
   */
  async buscarEngenheiroPorId(eng_id: string): Promise<Engenheiro | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('engenheiros')
        .select('*')
        .eq('eng_id', eng_id)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar engenheiro:', error.message);
      return null;
    }
  }

  /**
   * Atualiza dados de um engenheiro
   */
  async atualizarEngenheiro(
    eng_id: string,
    campos: Partial<{ nome: string; telefone: string }>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const updateData: any = { ...campos, updated_at: new Date().toISOString() };
      
      if (campos.telefone) {
        updateData.telefone = campos.telefone.replace(/[^\d+]/g, '');
      }

      const { error } = await this.supabase
        .from('engenheiros')
        .update(updateData)
        .eq('eng_id', eng_id);

      if (error) {
        console.error('❌ Erro ao atualizar engenheiro:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar engenheiro:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Checa se o engenheiro tem atribuições (projetos) ativas
   */
  // Lanca quando nao consegue checar: devolver false liberava a desativacao de quem tem
  // projetos ativos sempre que o banco falhava.
  async checarEngenheiroTemAtribuicoesAtivas(eng_id: string): Promise<boolean> {
    if (!this.connected) throw new SupabaseUnavailableError('checarEngenheiroTemAtribuicoesAtivas');

    try {
      const { count, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('id', { count: 'exact', head: true })
        .eq('eng_id', eng_id)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao checar atribuições do engenheiro:', error);
        throw new SupabaseUnavailableError('checarEngenheiroTemAtribuicoesAtivas');
      }

      return (count ?? 0) > 0;
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) throw error;
      console.error('❌ Erro ao checar atribuições:', error.message);
      throw new SupabaseUnavailableError('checarEngenheiroTemAtribuicoesAtivas');
    }
  }

  /**
   * Desativa (soft-delete) um engenheiro
   */
  async desativarEngenheiro(
    eng_id: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const temAtivos = await this.checarEngenheiroTemAtribuicoesAtivas(eng_id);
      if (temAtivos) {
        return { success: false, error: 'engenheiro_com_projetos' };
      }

      const { error } = await this.supabase
        .from('engenheiros')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('eng_id', eng_id);

      if (error) {
        console.error('❌ Erro ao desativar engenheiro:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) {
        return { success: false, error: 'nao_foi_possivel_verificar' };
      }
      console.error('❌ Erro ao desativar engenheiro:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // ÁREAS E STATUS
  // =====================================================

  /**
   * Lista todas as áreas disponíveis usando SQL function
   */
  async listarAreasDisponiveis(): Promise<Area[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_areas_disponiveis');

      if (error) {
        console.error('❌ Erro ao listar áreas:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar áreas:', error.message);
      return [];
    }
  }

  /**
   * Busca área por ID
   */
  async buscarAreaPorId(area_id: string): Promise<Area | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('areas')
        .select('*')
        .eq('area_id', area_id)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar área por ID:', error.message);
      return null;
    }
  }

  /**
   * Lista todos os status disponíveis usando SQL function
   */
  async listarStatusDisponiveis(): Promise<StatusCode[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_status_disponiveis');

      if (error) {
        console.error('❌ Erro ao listar status:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar status:', error.message);
      return [];
    }
  }

  /**
   * Busca status por ID
   */
  async buscarStatusPorId(status_id: number): Promise<StatusCode | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('status_codes')
        .select('*')
        .eq('status_id', status_id)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar status por ID:', error.message);
      return null;
    }
  }

  // =====================================================
  // PROJETOS
  // =====================================================

  /**
   * Cria um novo projeto usando SQL function
   */
  async criarProjeto(
    codigo: string,
    cliente: string,
    descricao?: string
  ): Promise<Projeto | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase.rpc('criar_projeto', {
        p_codigo: codigo,
        p_cliente: cliente,
        p_descricao: descricao || null,
      });

      if (error) {
        console.error('❌ Erro ao criar projeto:', error);
        return null;
      }

      if (!data || !data.sucesso) {
        console.error('❌ Erro ao criar projeto:', data?.mensagem);
        return null;
      }

      console.log(`✅ Projeto criado: ${codigo}`);

      // Retornar projeto criado
      return await this.buscarProjetoPorId(data.projeto_id);
    } catch (error: any) {
      console.error('❌ Erro ao criar projeto:', error.message);
      return null;
    }
  }

  /**
   * Busca projeto por ID (UUID)
   */
  async buscarProjetoPorId(projeto_id: string): Promise<Projeto | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('projetos')
        .select('*')
        .eq('projeto_id', projeto_id)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar projeto por ID:', error.message);
      return null;
    }
  }

  /**
   * Projetos ativos de varios IDs numa consulta so (listas de atribuicoes).
   * Projeto inativo ou inexistente fica fora do Map, como em buscarProjetoPorId.
   * Falha em vez de devolver vazio: uma lista sem codigos seria dado errado.
   */
  async buscarProjetosPorIdsOuFalha(ids: string[]): Promise<Map<string, Projeto>> {
    if (!this.connected) throw new SupabaseUnavailableError('buscarProjetosPorIds');
    const unicos = [...new Set(ids.filter(Boolean))];
    if (unicos.length === 0) return new Map();
    const { data, error } = await this.supabase
      .from('projetos')
      .select('*')
      .in('projeto_id', unicos)
      .eq('ativo', true);
    if (error) {
      logSupabaseError('buscarProjetosPorIds', error);
      throw new SupabaseUnavailableError('buscarProjetosPorIds');
    }
    return new Map((data ?? []).map((p: Projeto) => [p.projeto_id, p]));
  }

  /**
   * Areas ativas de varios IDs numa consulta so. Mesmas regras de buscarProjetosPorIdsOuFalha.
   */
  async buscarAreasPorIdsOuFalha(ids: Array<string | number>): Promise<Map<string, Area>> {
    if (!this.connected) throw new SupabaseUnavailableError('buscarAreasPorIds');
    const unicos = [...new Set(ids.filter((id) => id !== null && id !== undefined && id !== '').map(String))];
    if (unicos.length === 0) return new Map();
    const { data, error } = await this.supabase
      .from('areas')
      .select('*')
      .in('area_id', unicos)
      .eq('ativo', true);
    if (error) {
      logSupabaseError('buscarAreasPorIds', error);
      throw new SupabaseUnavailableError('buscarAreasPorIds');
    }
    return new Map((data ?? []).map((a: Area) => [String(a.area_id), a]));
  }

  // =====================================================
  // ATRIBUIÇÕES (engenheiros_projetos)
  // =====================================================

  /**
   * Lista todas as atribuições de um engenheiro
   */
  async listarAtribuicoesEngenheiro(eng_id: string): Promise<Atribuicao[]> {
    try {
      return await this.listarAtribuicoesEngenheiroOuFalha(eng_id);
    } catch {
      return [];
    }
  }

  /**
   * Como listarAtribuicoesEngenheiro, mas falha em vez de devolver [] — para quem mostra a
   * lista ao engenheiro: lista vazia por erro aparecia como "nenhum projeto".
   */
  async listarAtribuicoesEngenheiroOuFalha(eng_id: string): Promise<Atribuicao[]> {
    if (!this.connected) throw new SupabaseUnavailableError('listarAtribuicoesEngenheiro');

    try {
      const { data, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('*')
        .eq('eng_id', eng_id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao listar atribuições:', error);
        throw new SupabaseUnavailableError('listarAtribuicoesEngenheiro');
      }

      return data || [];
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) throw error;
      console.error('❌ Erro ao listar atribuições:', error.message);
      throw new SupabaseUnavailableError('listarAtribuicoesEngenheiro');
    }
  }

  /**
   * Conta quantas atribuições ativas um projeto tem
   */
  async contarAreasAtivasDoProjeto(projeto_id: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const { count, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('id', { count: 'exact', head: true })
        .eq('projeto_id', projeto_id)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao contar áreas do projeto:', error);
        return 0;
      }

      return count ?? 0;
    } catch (error: any) {
      console.error('❌ Erro ao contar áreas:', error.message);
      return 0;
    }
  }

  /**
   * Desativa (soft-delete) uma atribuição (área) específica
   */
  async desativarAtribuicao(
    atribuicao_id: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const { data, error } = await this.supabase.rpc('desativar_atribuicao', {
        p_atribuicao_id: atribuicao_id,
        p_origem: 'chatbot',
        p_actor_user_id: null,
      });

      if (error) {
        console.error('❌ Erro ao desativar atribuição:', error);
        return { success: false, error: error.message };
      }

      if (!data?.ok) {
        return {
          success: false,
          error: data?.mensagem || 'Nao foi possivel desativar a atribuicao',
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao desativar atribuição:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Transfere uma atribuição (área) de um engenheiro para outro
   */
  async transferirAtribuicao(
    atribuicao_id: string,
    novo_eng_id: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const { data, error } = await this.supabase.rpc('transferir_atribuicao', {
        p_atribuicao_id: atribuicao_id,
        p_novo_eng_id: novo_eng_id,
        p_origem: 'chatbot',
        p_actor_user_id: null,
      });

      // A RPC centraliza validacao e sincronizacao com evandro_distribuicao_tasks.
      if (!error && !data?.ok) {
        return {
          success: false,
          error: data?.mensagem || 'Nao foi possivel transferir a atribuicao',
        };
      }

      if (error) {
        console.error('❌ Erro ao transferir atribuição:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao transferir atribuição:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // PREVISÕES E RETRABALHOS
  // =====================================================

  // Dead code removed: registrarFeitoDia().
  // Seu unico chamador era o salvar() do engineerProjectFlow, que estava inalcancavel.
  // Ela chamava registrarRetrabalho sem as horas, e como registrar_retrabalho_dia e
  // upsert por (atribuicao, dia) com UPDATE que sobrescreve, isso gravaria NULL em
  // horas_trabalhadas_total e horas_retrabalho, apagando as horas ja informadas.

  /**
   * Busca última previsão de uma atribuição
   */
  async buscarUltimaPrevisao(eng_projeto_id: string): Promise<Previsao | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('projetos_previsao')
        .select('*')
        .eq('eng_projeto_id', eng_projeto_id)
        .order('data_registro', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Busca último retrabalho de uma atribuição
   */
  async buscarUltimoRetrabalho(eng_projeto_id: string): Promise<Retrabalho | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('retrabalho_projetos')
        .select('*')
        .eq('eng_projeto_id', eng_projeto_id)
        .eq('necessitou_retrabalho', true)
        .order('data_retrabalho', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Busca prazos de uma atribuição
   */
  async buscarPrazos(eng_projeto_id: string): Promise<any | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('prazos')
        .select('*')
        .eq('eng_projeto_id', eng_projeto_id)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Lista todas as atribuições (para sincronização)
   */
  async listarTodasAtribuicoes(): Promise<Atribuicao[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao listar todas atribuições:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar todas atribuições:', error.message);
      return [];
    }
  }

  /**
   * Registra retrabalho usando SQL function.
   *
   * As horas sao obrigatorias de proposito: registrar_retrabalho_dia e upsert por
   * (atribuicao, dia) e o UPDATE sobrescreve as colunas, entao chamar sem elas apagaria
   * as horas ja informadas no dia. Deixa-las opcionais permitia exatamente isso.
   *
   * O sucesso vem do que a RPC respondeu, e nao de uma leitura posterior. Antes esta funcao
   * terminava em buscarUltimoRetrabalho(), que filtra necessitou_retrabalho = true: quem
   * apontava SEM retrabalho gravava uma linha com false, a busca nao achava nada, e a funcao
   * devolvia null tendo gravado. O chamador lia esse null como falha e dizia ao engenheiro que
   * nada tinha sido registrado, com as horas ja no banco.
   *
   * O motivo acompanha a falha porque os quatro caminhos abaixo sao problemas diferentes —
   * configuracao, transporte, validacao do banco e excecao — e colapsa-los num unico null
   * deixava quem investiga dependendo do log de producao.
   */
  async registrarRetrabalho(
    eng_projeto_id: string,
    necessitou_retrabalho: boolean,
    motivo: string | undefined,
    tipo: string | undefined,
    descricao: string | undefined,
    horasTrabalhadasTotal: number,
    horasRetrabalho: number,
    // Dia em BRT. A RPC usava CURRENT_DATE (UTC no Supabase): apontar depois das 21h BRT
    // gravava as horas no dia seguinte, longe do relato.
    dataApontamento: string = dataLocalBR()
  ): Promise<ResultadoRegistroRetrabalho> {
    if (!this.connected) {
      console.error(`❌ Erro ao registrar retrabalho (${eng_projeto_id}): sem conexão`);
      return { ok: false, motivo: 'sem_conexao', mensagem: 'Sem conexão com o banco.' };
    }

    try {
      const { data, error } = await this.supabase.rpc('registrar_retrabalho_dia', {
        p_atribuicao_id: eng_projeto_id,
        p_necessitou_retrabalho: necessitou_retrabalho,
        p_motivo_retrabalho: motivo || null,
        p_tipo_retrabalho: tipo || null,
        p_descricao: descricao || null,
        p_horas_trabalhadas_total: horasTrabalhadasTotal ?? null,
        p_horas_retrabalho: horasRetrabalho ?? null,
        p_data: dataApontamento,
      });

      if (error) {
        console.error(`❌ Erro ao registrar retrabalho (${eng_projeto_id}):`, error);
        return { ok: false, motivo: 'erro_rpc', mensagem: error.message ?? 'Erro na chamada do banco.' };
      }

      if (!data || !data.sucesso) {
        const mensagem = data?.mensagem ?? 'O banco recusou o registro.';
        console.error(`❌ Retrabalho recusado (${eng_projeto_id}):`, mensagem);
        return { ok: false, motivo: 'recusado', mensagem };
      }

      console.log(`✅ ${data.mensagem}`);
      console.log(`   Total de retrabalhos: ${data.quantidade_total_retrabalhos}`);

      return { ok: true };
    } catch (error: any) {
      console.error(`❌ Erro ao registrar retrabalho (${eng_projeto_id}):`, error.message);
      return { ok: false, motivo: 'excecao', mensagem: error.message ?? 'Falha inesperada.' };
    }
  }

  // =====================================================
  // COMPATIBILIDADE (métodos antigos)
  // =====================================================

  // =====================================================
  // NOVOS MÉTODOS - MENUS E OPÇÕES DO CHATBOT
  // =====================================================

  // =====================================================
  // AUTENTICAÇÃO - TELEFONE
  // =====================================================

  /**
   * Busca engenheiro por telefone (campo telefone direto na tabela engenheiros)
   *
   * Contrato:
   *   consulta rodou e não achou linha  -> null  (usuário não cadastrado)
   *   consulta não rodou                -> SupabaseUnavailableError
   *
   * Os dois casos NUNCA se misturam. É esta distinção que impede o chatbot
   * de dizer "número não cadastrado" para um engenheiro cadastrado quando o
   * banco está fora do ar.
   */
  async buscarEngenheiroPorTelefone(telefone: string): Promise<Engenheiro | null> {
    console.log(`      🔍 [SUPABASE] buscarEngenheiroPorTelefone(${mascararTelefone(telefone)})`);
    if (!this.connected) {
      // Sem cliente não houve consulta — não dá para afirmar que o número não
      // existe. Antes isto retornava null e derrubava 100% dos usuários para
      // "não cadastrado" sempre que faltasse configuração.
      console.error(`      ❌ [SUPABASE] Não conectado — impossível verificar cadastro`);
      throw new SupabaseUnavailableError('buscarEngenheiroPorTelefone');
    }

    try {
      const telefoneNormalizado = telefone.replace(/[^\d+]/g, '');
      console.log(`      🔍 [SUPABASE] Telefone normalizado: ${mascararTelefone(telefoneNormalizado)}`);
      console.log(`      🔍 [SUPABASE] Executando query...`);

      // maybeSingle(), não single(): com single() "0 linhas" chega como erro
      // PGRST116, pelo mesmo caminho de um timeout. Aqui, 0 linhas devolve
      // data: null / error: null, e `error` volta a significar falha real.
      // Com e sem o 9 depois do DDD (o WhatsApp entrega muitos celulares sem ele). Sem
      // maybeSingle(): se as duas formas existirem, ele erraria por "varias linhas" e isso
      // viraria "banco indisponivel". Prefere a forma exata.
      const variantes = variantesTelefoneBR(telefoneNormalizado);
      const { data: linhas, error } = await this.supabase
        .from('engenheiros')
        .select('*')
        .in('telefone', variantes)
        .eq('ativo', true);
      const data = linhas?.find((l: any) => l.telefone === telefoneNormalizado) ?? linhas?.[0] ?? null;

      console.log(`      🔍 [SUPABASE] Query concluída!`);

      if (error) {
        logSupabaseError('Falha ao consultar cadastro do engenheiro', error);
        throw new SupabaseUnavailableError('buscarEngenheiroPorTelefone');
      }

      if (!data) {
        console.log(`      ⚠️ [SUPABASE] Nenhum engenheiro com este telefone`);
        return null;
      }

      console.log(`      ✅ [SUPABASE] Engenheiro encontrado: ${data.nome}`);
      return data;
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) throw error;
      // fetch failed, DNS, timeout, chave inválida: também é infraestrutura.
      logSupabaseError('Exceção ao consultar cadastro do engenheiro', error);
      throw new SupabaseUnavailableError('buscarEngenheiroPorTelefone');
    }
  }

  /**
   * Busca dono por telefone
   *
   * Mesmo contrato de buscarEngenheiroPorTelefone: null = não cadastrado,
   * SupabaseUnavailableError = a consulta não rodou.
   */
  async buscarDonoPorTelefone(telefone: string): Promise<any | null> {
    console.log(`      🔍 [SUPABASE] buscarDonoPorTelefone(${mascararTelefone(telefone)})`);
    if (!this.connected) {
      console.error(`      ❌ [SUPABASE] Não conectado — impossível verificar cadastro`);
      throw new SupabaseUnavailableError('buscarDonoPorTelefone');
    }

    try {
      const telefoneNormalizado = telefone.replace(/[^\d+]/g, '');
      console.log(`      🔍 [SUPABASE] Telefone normalizado: ${mascararTelefone(telefoneNormalizado)}`);
      console.log(`      🔍 [SUPABASE] Executando query...`);

      // Com e sem o 9 depois do DDD (o WhatsApp entrega muitos celulares sem ele). Sem
      // maybeSingle(): se as duas formas existirem, ele erraria por "varias linhas" e isso
      // viraria "banco indisponivel". Prefere a forma exata.
      const variantes = variantesTelefoneBR(telefoneNormalizado);
      const { data: linhas, error } = await this.supabase
        .from('dono_empresa')
        .select('*')
        .in('telefone', variantes)
        .eq('ativo', true);
      const data = linhas?.find((l: any) => l.telefone === telefoneNormalizado) ?? linhas?.[0] ?? null;

      console.log(`      🔍 [SUPABASE] Query concluída!`);

      if (error) {
        logSupabaseError('Falha ao consultar cadastro do dono', error);
        throw new SupabaseUnavailableError('buscarDonoPorTelefone');
      }

      if (!data) {
        console.log(`      ⚠️ [SUPABASE] Nenhum dono com este telefone`);
        return null;
      }

      console.log(`      ✅ [SUPABASE] Dono encontrado: ${data.nome}`);
      return data;
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) throw error;
      logSupabaseError('Exceção ao consultar cadastro do dono', error);
      throw new SupabaseUnavailableError('buscarDonoPorTelefone');
    }
  }

  // =====================================================
  // MÉTODOS PARA O DONO (OWNER)
  // =====================================================

  /**
   * Lista todos os engenheiros cadastrados
   */
  async listarEngenheiros(): Promise<{ success: boolean; data?: Engenheiro[]; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('engenheiros')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) {
        console.error('❌ Erro ao listar engenheiros:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao listar engenheiros:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lista todos os projetos (para o dono visualizar)
   */
  async listarTodosProjetos(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('projetos')
        .select(`
          projeto_id,
          codigo_projeto,
          cliente,
          descricao,
          ativo,
          created_at
        `)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao listar todos os projetos:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao listar projetos:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Distribui projeto existente com prazos completos
   */
  async distribuirProjetoComPrazos(params: {
    dono_id: string;
    eng_id: string;
    projeto_id: string;
    area_codigo: string;
    data_inicio: string;
    data_inicio_esperada_cliente?: string;
    prazo_final_eng: string;
    prazo_final_cliente: string;
    observacoes?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase.rpc('dono_distribuir_projeto_com_prazos', {
        p_dono_id: params.dono_id,
        p_eng_id: params.eng_id,
        p_projeto_id: params.projeto_id,
        p_area_codigo: params.area_codigo,
        p_data_inicio: params.data_inicio,
        p_data_inicio_esperada_cliente: params.data_inicio_esperada_cliente || null,
        p_prazo_final_eng: params.prazo_final_eng,
        p_prazo_final_cliente: params.prazo_final_cliente,
        p_observacoes: params.observacoes || null,
      });

      if (error) {
        console.error('❌ Erro ao distribuir projeto com prazos:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Projeto distribuído com prazos:', data);
      return { success: true, data };
    } catch (error: any) {
      console.error('❌ Erro ao distribuir projeto:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cria projeto completo (apenas tabela projetos)
   */
  async criarProjetoCompleto(params: {
    codigo: string;
    cliente: string;
    descricao: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase.rpc('criar_projeto', {
        p_codigo: params.codigo,
        p_cliente: params.cliente,
        p_descricao: params.descricao,
      });

      if (error) {
        console.error('❌ Erro ao criar projeto:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Projeto criado:', data);
      return { success: true, data };
    } catch (error: any) {
      console.error('❌ Erro ao criar projeto:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca detalhes completos de um projeto específico por ID
   */
  async buscarProjetoDetalhado(projetoId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('vw_projetos_completo')
        .select('*')
        .eq('projeto_id', projetoId);

      if (error) {
        console.error('❌ Erro ao buscar projeto detalhado:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao buscar projeto:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca projetos de um engenheiro específico
   */
  async buscarProjetosPorEngenheiro(engId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('vw_projetos_completo')
        .select('*')
        .eq('eng_id', engId)
        .order('data_inicio', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar projetos do engenheiro:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao buscar projetos:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca histórico de retrabalhos com filtros opcionais
   */
  async buscarHistoricoRetrabalhos(filters?: {
    engId?: string;
    projetoId?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      let query = this.supabase
        .from('vw_dono_retrabalhos_historico')
        .select('*')
        .order('data_retrabalho', { ascending: false });

      if (filters?.engId) {
        query = query.eq('eng_id', filters.engId);
      }

      if (filters?.projetoId) {
        query = query.eq('projeto_id', filters.projetoId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao buscar histórico de retrabalhos:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao buscar retrabalhos:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca áreas de um projeto específico
   */
  async buscarAreasDoProjeto(projetoId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('engenheiros_projetos')
        .select(`
          id,
          area_id,
          areas!engenheiros_projetos_area_id_fkey!inner(area_id, codigo, descricao),
          engenheiros(nome)
        `)
        .eq('projeto_id', projetoId)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao buscar áreas do projeto:', error);
        return { success: false, error: error.message };
      }

      // Mapear atribuições preservando todas (inclusive múltiplos engenheiros na mesma área)
      const areasCompletas = data?.map((curr: any) => ({
        ...curr.areas,
        atribuicao_id: curr.id,
        engenheiro_nome: curr.engenheiros?.nome || null,
      })) || [];

      return { success: true, data: areasCompletas };
    } catch (error: any) {
      console.error('❌ Erro ao buscar áreas:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca última atualização noturna do engenheiro (feito do dia + observações)
   */
  async buscarUltimaAtualizacaoNoturna(
    engProjetoId: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      // Buscar observações do engenheiros_projetos
      const { data: atribuicao, error: errorAtrib } = await this.supabase
        .from('engenheiros_projetos')
        .select('observacoes')
        .eq('id', engProjetoId)
        .single();

      if (errorAtrib) {
        console.error('❌ Erro ao buscar atribuição:', errorAtrib);
        return { success: false, error: errorAtrib.message };
      }

      // Buscar último feito_dia do projetos_previsao
      const { data: previsao, error: errorPrev } = await this.supabase
        .from('projetos_previsao')
        .select('feito_texto, data_registro')
        .eq('eng_projeto_id', engProjetoId)
        .not('feito_texto', 'is', null)
        .order('data_registro', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorPrev) {
        console.error('❌ Erro ao buscar previsão:', errorPrev);
        return { success: false, error: errorPrev.message };
      }

      return {
        success: true,
        data: {
          feito_texto: previsao?.feito_texto || null,
          data_registro: previsao?.data_registro || null,
          observacoes: atribuicao?.observacoes || null,
        },
      };
    } catch (error: any) {
      console.error('❌ Erro ao buscar última atualização:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // MÉTODOS PARA NOTIFICAÇÕES E EDIÇÃO DO ENGENHEIRO
  // =====================================================

  /**
   * Registra previsão do dia (manhã)
   */
  async registrarPrevisaoDia(
    eng_projeto_id: string,
    status_id: number | null,
    previsao_texto: string
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      // Buscar eng_id e projeto_id da atribuição
      const { data: atrib, error: erroAtrib } = await this.supabase
        .from('engenheiros_projetos')
        .select('eng_id, projeto_id')
        .eq('id', eng_projeto_id)
        .single();

      if (erroAtrib || !atrib) {
        console.error('❌ Erro ao buscar atribuição:', erroAtrib);
        return false;
      }

      // Inserir ou atualizar previsão
      const { error } = await this.supabase
        .from('projetos_previsao')
        .upsert({
          eng_projeto_id,
          projeto_id: atrib.projeto_id,
          eng_id: atrib.eng_id,
          data_registro: dataLocalBR(),
          previsao_texto,
          status_id: status_id ?? null,
          editavel: true,
        }, {
          onConflict: 'eng_projeto_id,data_registro'
        });

      if (error) {
        console.error('❌ Erro ao registrar previsão:', error);
        return false;
      }

      console.log('✅ Previsão registrada com sucesso');
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao registrar previsão:', error.message);
      return false;
    }
  }

  /**
   * Atualiza atribuição com feito do dia (noite)
   */
  async atualizarFeitoDia(
    eng_projeto_id: string,
    feito_texto: string,
    observacoes?: string,
    // Mesmo dia das horas (o fluxo passa o que usou em registrarRetrabalho).
    dataRegistro: string = dataLocalBR()
  ): Promise<ResultadoFeitoDia> {
    if (!this.connected) {
      console.error(`❌ Erro ao registrar feito do dia (${eng_projeto_id}): sem conexão`);
      return { ok: false, motivo: 'sem_conexao', mensagem: 'Sem conexão com o banco.' };
    }

    try {
      // Atualizar previsão com feito
      const { data: atrib, error: erroAtrib } = await this.supabase
        .from('engenheiros_projetos')
        .select('eng_id, projeto_id')
        .eq('id', eng_projeto_id)
        .single();

      if (erroAtrib || !atrib) {
        console.error('❌ Erro ao buscar atribuição:', erroAtrib);
        return {
          ok: false,
          motivo: 'atribuicao_nao_encontrada',
          mensagem: erroAtrib?.message ?? 'Atribuição não encontrada.',
        };
      }

      // Upsert previsão do dia com o feito (cria registro se manhã não foi preenchida)
      const { error: erroPrevisao } = await this.supabase
        .from('projetos_previsao')
        .upsert({
          eng_projeto_id,
          projeto_id: atrib.projeto_id,
          eng_id: atrib.eng_id,
          data_registro: dataRegistro,
          feito_texto,
          data_fim_dia: new Date().toISOString(),
          editavel: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'eng_projeto_id,data_registro'
        });

      // Este erro era um console.warn e a funcao seguia dizendo que gravou. Como o upsert nao
      // passa previsao_texto, todo dia sem notificacao matinal caia no NOT NULL da coluna e o
      // relato do engenheiro era descartado em silencio — 203 registros no banco, um unico com
      // feito_texto, contra 393 apontamentos noturnos no mesmo periodo. A migration
      // 20261004 tirou o NOT NULL; aqui a falha deixa de ser engolida.
      if (erroPrevisao) {
        console.error('❌ Erro ao gravar o feito do dia:', erroPrevisao);
        return {
          ok: false,
          motivo: 'erro_feito',
          mensagem: erroPrevisao.message ?? 'Erro ao gravar o relato do dia.',
        };
      }

      // Atualizar observações na atribuição se fornecidas
      if (observacoes) {
        const { error: erroObs } = await this.supabase
          .from('engenheiros_projetos')
          .update({
            observacoes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', eng_projeto_id);

        if (erroObs) {
          console.error('❌ Erro ao atualizar observações:', erroObs);
          return {
            ok: false,
            motivo: 'erro_observacoes',
            mensagem: erroObs.message ?? 'Erro ao gravar a observação.',
          };
        }
      }

      console.log('✅ Feito do dia registrado com sucesso');
      return { ok: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar feito do dia:', error.message);
      return { ok: false, motivo: 'excecao', mensagem: error.message ?? 'Falha inesperada.' };
    }
  }

  /**
   * Lista status disponíveis
   */
  async listarStatus(): Promise<Array<{ status_id: number; descricao: string; codigo: string }>> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase
        .from('status_codes')
        .select('status_id, descricao, codigo')
        .eq('ativo', true)
        .order('ordem');

      if (error) {
        console.error('❌ Erro ao listar status:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar status:', error.message);
      return [];
    }
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================

  /**
   * Converte data YYYY-MM-DD para DD/MM/AAAA
   */
  formatarDataParaExibicao(dataStr?: string): string {
    if (!dataStr) return '';

    try {
      const partes = dataStr.split('-');
      if (partes.length !== 3) return dataStr;

      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    } catch (error) {
      return dataStr;
    }
  }

  // =====================================================
  // SOFT DELETE DE PROJETOS (DONO)
  // =====================================================

  /**
   * Desativa (soft delete) um projeto e todas suas atribuições
   */
  async desativarProjeto(
    projeto_id: string
  ): Promise<{ success: boolean; error?: string; data?: { atribuicoes_desativadas: number } }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const { data, error } = await this.supabase.rpc('desativar_projeto_completo', {
        p_projeto_id: projeto_id,
        p_origem: 'chatbot',
        p_actor_user_id: null,
      });

      if (error) {
        console.error('Erro ao desativar projeto:', error);
        return { success: false, error: error.message };
      }

      if (!data?.ok) {
        return {
          success: false,
          error: data?.mensagem || 'Erro desconhecido ao desativar projeto',
        };
      }

      const qtd = Number(data.atribuicoes_desativadas || 0);
      console.log(`Projeto ${projeto_id} desativado com ${qtd} atribuicao(oes)`);
      return { success: true, data: { atribuicoes_desativadas: qtd } };
    } catch (error: any) {
      console.error('❌ Erro ao desativar projeto:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Exclui fisicamente projetos finalizados ha pelo menos N meses via RPC.
   * Use dryRun=true para auditar candidatos sem remover dados.
   */
  async limparProjetosFinalizadosAntigos(
    meses: number = 6,
    dryRun: boolean = true
  ): Promise<LimpezaProjetosResult> {
    if (!this.connected) {
      return {
        dry_run: dryRun,
        meses_retencao: meses,
        data_limite: '',
        projetos_candidatos: 0,
        projetos_excluidos: 0,
      };
    }

    try {
      const { data, error } = await this.supabase.rpc('limpar_projetos_finalizados_antigos', {
        p_meses: meses,
        p_dry_run: dryRun,
      });

      if (error) {
        console.error('❌ Erro ao limpar projetos finalizados antigos:', error);
        throw error;
      }

      return data as LimpezaProjetosResult;
    } catch (error: any) {
      console.error('❌ Erro ao executar limpeza de projetos:', error.message);
      throw error;
    }
  }

  // =====================================================
  // EDIÇÃO DE PROJETOS (DONO)
  // =====================================================

  /**
   * Atualiza campos do projeto master (tabela projetos)
   */
  async atualizarProjeto(
    projeto_id: string,
    campos: Partial<{ codigo_projeto: string; cliente: string; descricao: string; percentual_ponderado: number }>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const updateData: any = { ...campos, updated_at: new Date().toISOString() };

      const { error } = await this.supabase
        .from('projetos')
        .update(updateData)
        .eq('projeto_id', projeto_id);

      if (error) {
        console.error('❌ Erro ao atualizar projeto:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Projeto ${projeto_id} atualizado:`, campos);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar projeto:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Atualiza campos da atribuição (engenheiros_projetos) - versão genérica para o dono
   */
  async atualizarAtribuicaoDono(
    atribuicao_id: string,
    campos: Partial<{
      data_inicio: string;
      data_prevista: string;
      status_id: number;
      percentual_andamento: number;
      observacoes: string;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const updateData: any = { ...campos, updated_at: new Date().toISOString() };

      const { error } = await this.supabase
        .from('engenheiros_projetos')
        .update(updateData)
        .eq('id', atribuicao_id);

      if (error) {
        console.error('❌ Erro ao atualizar atribuição:', error);
        return { success: false, error: error.message };
      }

      console.log(`✅ Atribuição ${atribuicao_id} atualizada:`, campos);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar atribuição:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Atualiza campos de prazos
   */
  async atualizarPrazos(
    eng_projeto_id: string,
    campos: Partial<{
      prazo_final_eng: string;
      prazo_final_cliente: string;
      data_inicio_esperada_cliente: string;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const updateData: any = { ...campos, updated_at: new Date().toISOString() };

      const { data: updated, error } = await this.supabase
        .from('prazos')
        .update(updateData)
        .eq('eng_projeto_id', eng_projeto_id)
        .select('eng_projeto_id');

      if (error) {
        console.error('❌ Erro ao atualizar prazos:', error);
        return { success: false, error: error.message };
      }

      // Se nenhuma linha foi atualizada, criar o registro via upsert
      if (!updated || updated.length === 0) {
        console.warn(`⚠️ Nenhum registro de prazos encontrado para ${eng_projeto_id}, criando via upsert...`);
        const { error: upsertError } = await this.supabase
          .from('prazos')
          .upsert(
            { eng_projeto_id, ...campos, updated_at: new Date().toISOString() },
            { onConflict: 'eng_projeto_id' }
          );

        if (upsertError) {
          console.error('❌ Erro ao criar prazos via upsert:', upsertError);
          return { success: false, error: upsertError.message };
        }

        console.log(`✅ Prazos criados via upsert para atribuição ${eng_projeto_id}:`, campos);
        return { success: true };
      }

      console.log(`✅ Prazos atualizados para atribuição ${eng_projeto_id}:`, campos);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao atualizar prazos:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca atribuição com detalhes para edição (projeto + área + engenheiro + prazos)
   */
  async buscarAtribuicaoParaEdicao(atribuicao_id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) return { success: false, error: 'Supabase não conectado' };

    try {
      const { data, error } = await this.supabase
        .from('vw_projetos_completo')
        .select('*')
        .eq('atribuicao_id', atribuicao_id)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar atribuição para edição:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error('❌ Erro ao buscar atribuição:', error.message);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // PROGRESSO PONDERADO (PAVIMENTOS / ETAPAS)
  // =====================================================

  /**
   * Busca todos os pavimentos de um projeto com suas etapas aninhadas
   */
  async buscarPavimentosComEtapas(projetoId: string, areaId?: string | number, engProjetoId?: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      // Buscar pavimentos
      let pavQuery = this.supabase
        .from('projeto_pavimentos')
        .select('*')
        .eq('projeto_id', projetoId)
        .eq('ativo', true);
      if (areaId !== undefined && areaId !== null && areaId !== '') {
        pavQuery = pavQuery.eq('area_id', areaId);
      }
      if (engProjetoId) {
        pavQuery = pavQuery.eq('eng_projeto_id', engProjetoId);
      }
      const { data: pavimentos, error: pavError } = await pavQuery.order('ordem', { ascending: true });

      if (pavError) {
        console.error('❌ Erro ao buscar pavimentos:', pavError);
        return [];
      }

      if (!pavimentos || pavimentos.length === 0) {
        return [];
      }

      // Buscar etapas de todos os pavimentos de uma vez
      const pavimentoIds = pavimentos.map((p: any) => p.pavimento_id);
      const { data: etapas, error: etapaError } = await this.supabase
        .from('pavimento_etapas')
        .select('*')
        .in('pavimento_id', pavimentoIds)
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (etapaError) {
        console.error('❌ Erro ao buscar etapas dos pavimentos:', etapaError);
        // Retorna pavimentos sem etapas em vez de falhar completamente
        return pavimentos.map((p: any) => ({ ...p, etapas: [] }));
      }

      // Aninhar etapas dentro dos pavimentos
      const etapasPorPavimento = new Map<string, any[]>();
      (etapas || []).forEach((e: any) => {
        const lista = etapasPorPavimento.get(e.pavimento_id) || [];
        lista.push(e);
        etapasPorPavimento.set(e.pavimento_id, lista);
      });

      return pavimentos.map((p: any) => ({
        ...p,
        etapas: etapasPorPavimento.get(p.pavimento_id) || [],
      }));
    } catch (error: any) {
      console.error('❌ Erro ao buscar pavimentos com etapas:', error.message);
      return [];
    }
  }

  /**
   * Busca todas as etapas globais de um projeto
   */
  async buscarEtapasGlobais(projetoId: string, areaId?: string | number, engProjetoId?: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      let q = this.supabase
        .from('projeto_etapas_globais')
        .select('*')
        .eq('projeto_id', projetoId)
        .eq('ativo', true);
      if (areaId !== undefined && areaId !== null && areaId !== '') {
        q = q.eq('area_id', areaId);
      }
      if (engProjetoId) {
        q = q.eq('eng_projeto_id', engProjetoId);
      }
      const { data, error } = await q.order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Erro ao buscar etapas globais:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao buscar etapas globais:', error.message);
      return [];
    }
  }

  /**
   * Marca várias etapas de pavimento de uma só vez (UPDATE WHERE IN).
   * Retorna { ok: número de etapas atualizadas, falhas: ids que não foram atualizados }.
   */
  async marcarEtapasBatch(etapaIds: string[], concluida = true): Promise<{ ok: number; falhas: string[] }> {
    if (!this.connected || etapaIds.length === 0) return { ok: 0, falhas: [...etapaIds] };

    try {
      const { data, error } = await this.supabase
        .from('pavimento_etapas')
        .update({ concluida })
        .in('etapa_id', etapaIds)
        .eq('ativo', true)
        .select('etapa_id');

      if (error) {
        console.error('❌ Erro ao marcar etapas em batch:', error);
        return { ok: 0, falhas: [...etapaIds] };
      }

      const okIds = new Set((data ?? []).map((r: any) => r.etapa_id));
      const falhas = etapaIds.filter(id => !okIds.has(id));
      console.log(`✅ ${okIds.size}/${etapaIds.length} etapa(s) marcada(s) como ${concluida ? 'concluída' : 'pendente'}`);
      return { ok: okIds.size, falhas };
    } catch (error: any) {
      console.error('❌ Erro ao marcar etapas em batch:', error.message);
      return { ok: 0, falhas: [...etapaIds] };
    }
  }

  /**
   * Busca o percentual_ponderado cacheado de um projeto
   */
  async buscarProgressoPonderado(projetoId: string): Promise<number | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('projetos')
        .select('percentual_ponderado')
        .eq('projeto_id', projetoId)
        .eq('ativo', true)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar progresso ponderado:', error);
        return null;
      }

      return (data as any)?.percentual_ponderado ?? null;
    } catch (error: any) {
      console.error('❌ Erro ao buscar progresso ponderado:', error.message);
      return null;
    }
  }

  /**
   * Progresso ponderado de uma disciplina (projeto+área).
   * Fonte única do status/✅ por área (engenheiros_projetos.percentual_ponderado).
   */
  async buscarProgressoArea(projetoId: string, areaId: string | number, engProjetoId?: string): Promise<number> {
    try {
      return await this.buscarProgressoAreaOuFalha(projetoId, areaId, engProjetoId);
    } catch {
      return 0;
    }
  }

  /**
   * Como buscarProgressoArea, mas falha em vez de devolver 0 — para listagens, onde um 0%
   * falso troca o status e o filtro de pendentes. Quem so recalcula o numero para a mensagem
   * depois de gravar continua usando buscarProgressoArea.
   */
  async buscarProgressoAreaOuFalha(projetoId: string, areaId: string | number, engProjetoId?: string): Promise<number> {
    if (!this.connected) throw new SupabaseUnavailableError('buscarProgressoArea');
    try {
      let query = this.supabase
        .from('engenheiros_projetos')
        .select('percentual_ponderado')
        .eq('projeto_id', projetoId)
        .eq('area_id', areaId)
        .eq('ativo', true);

      if (engProjetoId) {
        query = query.eq('id', engProjetoId);
      }

      const { data, error } = await query.limit(1);
      if (error) {
        console.error('❌ Erro ao buscar progresso da área:', error);
        throw new SupabaseUnavailableError('buscarProgressoArea');
      }
      return Number((data as any)?.[0]?.percentual_ponderado ?? 0);
    } catch (error: any) {
      if (error instanceof SupabaseUnavailableError) throw error;
      console.error('❌ Erro ao buscar progresso da área:', error.message);
      throw new SupabaseUnavailableError('buscarProgressoArea');
    }
  }

  /**
   * Marca várias etapas GLOBAIS de uma vez (UPDATE WHERE IN).
   * Retorna { ok: número atualizado, falhas: ids não atualizados }.
   */
  async marcarEtapasGlobaisBatch(ids: string[], concluida = true): Promise<{ ok: number; falhas: string[] }> {
    if (!this.connected || ids.length === 0) return { ok: 0, falhas: [...ids] };
    try {
      const { data, error } = await this.supabase
        .from('projeto_etapas_globais')
        .update({ concluida })
        .in('etapa_global_id', ids)
        .eq('ativo', true)
        .select('etapa_global_id');
      if (error) {
        console.error('❌ Erro ao marcar etapas globais em batch:', error);
        return { ok: 0, falhas: [...ids] };
      }
      const okIds = new Set((data ?? []).map((r: any) => r.etapa_global_id));
      const falhas = ids.filter(id => !okIds.has(id));
      console.log(`✅ ${okIds.size}/${ids.length} etapa(s) global(is) marcada(s) como ${concluida ? 'concluída' : 'pendente'}`);
      return { ok: okIds.size, falhas };
    } catch (error: any) {
      console.error('❌ Erro ao marcar etapas globais em batch:', error.message);
      return { ok: 0, falhas: [...ids] };
    }
  }

  /**
   * Marca (100%) ou reabre (0%) uma disciplina (projeto+área) SEM etapas configuradas.
   * Afeta apenas a área indicada; recalcula o roll-up do projeto via RPC.
   */
  async marcarAreaConcluida(projetoId: string, areaId: string | number, concluido = true, engProjetoId?: string): Promise<number | null> {
    if (!this.connected) return null;
    try {
      const { data, error } = await this.supabase.rpc('marcar_area_concluida', {
        p_projeto_id: projetoId,
        p_area_id: areaId,
        p_concluido: concluido,
        p_eng_projeto_id: engProjetoId ?? null,
      });
      if (error) {
        console.error('❌ Erro ao marcar área como concluída:', error);
        return null;
      }
      console.log(`✅ Área ${areaId} do projeto ${projetoId} ${concluido ? 'concluída (100%)' : 'reaberta (0%)'}`);
      return typeof data === 'number' ? data : (concluido ? 100 : 0);
    } catch (error: any) {
      console.error('❌ Erro ao marcar área como concluída:', error.message);
      return null;
    }
  }
}

// =====================================================
// SINGLETON
// =====================================================

let supabaseServiceInstance: SupabaseService | null = null;

export function getSupabaseService(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = new SupabaseService();
  }
  return supabaseServiceInstance;
}

// Exportar instância direta também (para facilitar imports)
// COMENTADO: Causa problema de timing com dotenv.config()
// A instância é criada ANTES do dotenv carregar as variáveis
// export const supabaseService = getSupabaseService();

// Use getSupabaseService() em vez de importar supabaseService diretamente
export const supabaseService = {
  get instance() {
    return getSupabaseService();
  }
};

export default SupabaseService;
