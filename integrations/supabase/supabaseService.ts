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

      console.log(`✅ Engenheiro criado: ${nome} (${whatsappNormalizado})`);
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
  async checarEngenheiroTemAtribuicoesAtivas(eng_id: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const { count, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('id', { count: 'exact', head: true })
        .eq('eng_id', eng_id)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao checar atribuições do engenheiro:', error);
        return false;
      }

      return (count ?? 0) > 0;
    } catch (error: any) {
      console.error('❌ Erro ao checar atribuições:', error.message);
      return false;
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
   * Busca área por código
   */
  async buscarAreaPorCodigo(codigo: string): Promise<Area | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('areas')
        .select('*')
        .eq('codigo', codigo.toUpperCase())
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar área:', error.message);
      return null;
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
   * Busca status por código
   */
  async buscarStatusPorCodigo(codigo: string): Promise<StatusCode | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('status_codes')
        .select('*')
        .eq('codigo', codigo.toUpperCase())
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar status:', error.message);
      return null;
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
   * Busca projeto por código
   */
  async buscarProjetoPorCodigo(codigo: string): Promise<Projeto | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('projetos')
        .select('*')
        .eq('codigo_projeto', codigo)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar projeto:', error.message);
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
   * Gera próximo código de projeto automaticamente
   */
  async getUltimoCodigoProjeto(): Promise<string | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase.rpc('gerar_proximo_codigo_projeto');

      if (error) {
        console.error('❌ Erro ao gerar código:', error);
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao gerar código:', error.message);
      return null;
    }
  }

  /**
   * Gera próximo código de projeto (alias)
   */
  async gerarProximoCodigoProjeto(): Promise<string> {
    const codigo = await this.getUltimoCodigoProjeto();
    return codigo || 'PRJ-001';
  }

  // =====================================================
  // ATRIBUIÇÕES (engenheiros_projetos)
  // =====================================================

  /**
   * Atribui engenheiro a uma área de um projeto usando SQL function
   */
  async atribuirAreaProjeto(
    eng_id: string,
    projeto_id: string,
    area_codigo: string,
    data_inicio?: string,
    data_prevista?: string,
    status_codigo?: string
  ): Promise<Atribuicao | null> {
    if (!this.connected) return null;

    try {
      const dataInicioFormatada = data_inicio ? this.formatarDataParaDB(data_inicio) : null;
      const dataPrevistaFormatada = data_prevista ? this.formatarDataParaDB(data_prevista) : null;

      const { data, error } = await this.supabase.rpc('atribuir_area_projeto', {
        p_eng_id: eng_id,
        p_projeto_id: projeto_id,
        p_area_codigo: area_codigo.toUpperCase(),
        p_data_inicio: dataInicioFormatada,
        p_data_prevista: dataPrevistaFormatada,
        p_status_codigo: status_codigo || 'AGUARDANDO_INICIO',
      });

      if (error) {
        console.error('❌ Erro ao atribuir área:', error);
        return null;
      }

      if (!data || !data.sucesso) {
        console.error('❌ Erro ao atribuir área:', data?.mensagem);
        return null;
      }

      console.log(`✅ Área ${area_codigo} atribuída ao projeto`);
      console.log(`   Tempo de trabalho: ${data.tempo_trabalho_dias} dias`);
      console.log(`   Percentual: ${data.percentual_andamento}%`);

      // Retornar atribuição criada
      return await this.buscarAtribuicaoPorId(data.atribuicao_id);
    } catch (error: any) {
      console.error('❌ Erro ao atribuir área:', error.message);
      return null;
    }
  }

  /**
   * Lista todas as atribuições de um engenheiro
   */
  async listarAtribuicoesEngenheiro(eng_id: string): Promise<Atribuicao[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('*')
        .eq('eng_id', eng_id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao listar atribuições:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar atribuições:', error.message);
      return [];
    }
  }

  /**
   * Busca atribuição por ID
   */
  async buscarAtribuicaoPorId(atribuicao_id: string): Promise<Atribuicao | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase
        .from('engenheiros_projetos')
        .select('*')
        .eq('id', atribuicao_id)
        .eq('ativo', true)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Erro ao buscar atribuição:', error.message);
      return null;
    }
  }

  /**
   * Atualiza status de uma atribuição usando SQL function
   */
  async atualizarStatusAtribuicao(
    atribuicao_id: string,
    status_codigo: string
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const { data, error } = await this.supabase.rpc('atualizar_status_projeto', {
        p_atribuicao_id: atribuicao_id,
        p_status_codigo: status_codigo.toUpperCase(),
      });

      if (error) {
        console.error('❌ Erro ao atualizar status:', error);
        return false;
      }

      if (!data || !data.sucesso) {
        console.error('❌ Erro ao atualizar status:', data?.mensagem);
        return false;
      }

      console.log(`✅ Status atualizado: ${status_codigo}`);
      console.log(`   Percentual calculado: ${data.percentual_andamento}%`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar status:', error.message);
      return false;
    }
  }

  /**
   * Atualiza previsão de uma atribuição
   */
  async atualizarPrevisaoAtribuicao(
    atribuicao_id: string,
    nova_data: string
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const dataFormatada = this.formatarDataParaDB(nova_data);
      if (!dataFormatada) {
        console.error('❌ Data inválida:', nova_data);
        return false;
      }

      const { error } = await this.supabase
        .from('engenheiros_projetos')
        .update({ data_prevista: dataFormatada })
        .eq('id', atribuicao_id);

      if (error) {
        console.error('❌ Erro ao atualizar previsão:', error);
        return false;
      }

      console.log(`✅ Previsão atualizada: ${nova_data}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar previsão:', error.message);
      return false;
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
   */
  async registrarRetrabalho(
    eng_projeto_id: string,
    necessitou_retrabalho: boolean,
    motivo: string | undefined,
    tipo: string | undefined,
    descricao: string | undefined,
    horasTrabalhadasTotal: number,
    horasRetrabalho: number
  ): Promise<Retrabalho | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase.rpc('registrar_retrabalho_dia', {
        p_atribuicao_id: eng_projeto_id,
        p_necessitou_retrabalho: necessitou_retrabalho,
        p_motivo_retrabalho: motivo || null,
        p_tipo_retrabalho: tipo || null,
        p_descricao: descricao || null,
        p_horas_trabalhadas_total: horasTrabalhadasTotal ?? null,
        p_horas_retrabalho: horasRetrabalho ?? null,
      });

      if (error) {
        console.error('❌ Erro ao registrar retrabalho:', error);
        return null;
      }

      if (!data || !data.sucesso) {
        console.error('❌ Erro ao registrar retrabalho:', data?.mensagem);
        return null;
      }

      console.log(`✅ ${data.mensagem}`);
      console.log(`   Total de retrabalhos: ${data.quantidade_total_retrabalhos}`);

      // Retornar último retrabalho
      return await this.buscarUltimoRetrabalho(eng_projeto_id);
    } catch (error: any) {
      console.error('❌ Erro ao registrar retrabalho:', error.message);
      return null;
    }
  }

  // =====================================================
  // COMPATIBILIDADE (métodos antigos)
  // =====================================================

  /**
   * Lista projetos de engenheiro (compatibilidade - retorna atribuições)
   */
  async listarProjetosEngenheiro(engenheiroId: string): Promise<ProjetoLegacy[]> {
    const atribuicoes = await this.listarAtribuicoesEngenheiro(engenheiroId);

    // Agrupar por projeto e converter para formato legado
    const projetosMap = new Map<string, ProjetoLegacy>();

    for (const atrib of atribuicoes) {
      const projeto = await this.buscarProjetoPorId(atrib.projeto_id);
      if (!projeto) continue;

      const area = await this.buscarAreaPorId(atrib.area_id);
      const status = atrib.status_id ? await this.supabase
        .from('status_codes')
        .select('*')
        .eq('status_id', atrib.status_id)
        .single() : null;

      const key = projeto.projeto_id;
      if (!projetosMap.has(key)) {
        projetosMap.set(key, {
          id: projeto.projeto_id,
          codigo: projeto.codigo_projeto,
          cliente: projeto.cliente,
          engenheiro_id: atrib.eng_id,
          area: area?.descricao || '',
          status: status?.data?.descricao || '',
          percentual_total: atrib.percentual_andamento,
          data_inicio: atrib.data_inicio || undefined,
          data_previsao_termino: atrib.data_prevista || undefined,
          ativo: atrib.ativo,
        });
      }
    }

    return Array.from(projetosMap.values());
  }

  /**
   * Busca projeto por código (compatibilidade)
   */
  async buscarProjetoPorCodigoLegacy(codigo: string): Promise<ProjetoLegacy | null> {
    const projeto = await this.buscarProjetoPorCodigo(codigo);
    if (!projeto) return null;

    // Buscar primeira atribuição para preencher dados
    const { data: atribuicao } = await this.supabase
      .from('engenheiros_projetos')
      .select('*')
      .eq('projeto_id', projeto.projeto_id)
      .eq('ativo', true)
      .limit(1)
      .single();

    if (!atribuicao) {
      return {
        id: projeto.projeto_id,
        codigo: projeto.codigo_projeto,
        cliente: projeto.cliente,
        engenheiro_id: '',
        area: '',
        status: '',
        percentual_total: 0,
        ativo: projeto.ativo,
      };
    }

    const area = await this.buscarAreaPorId(atribuicao.area_id);
    const status = atribuicao.status_id ? await this.supabase
      .from('status_codes')
      .select('*')
      .eq('status_id', atribuicao.status_id)
      .single() : null;

    return {
      id: projeto.projeto_id,
      codigo: projeto.codigo_projeto,
      cliente: projeto.cliente,
      engenheiro_id: atribuicao.eng_id,
      area: area?.descricao || '',
      status: status?.data?.descricao || '',
      percentual_total: atribuicao.percentual_andamento,
      data_inicio: atribuicao.data_inicio || undefined,
      data_previsao_termino: atribuicao.data_prevista || undefined,
      ativo: projeto.ativo,
    };
  }

  // =====================================================
  // NOVOS MÉTODOS - MENUS E OPÇÕES DO CHATBOT
  // =====================================================

  /**
   * Lista tipos de obra disponíveis
   */
  async listarTiposObra(): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_tipos_obra');

      if (error) {
        console.error('❌ Erro ao listar tipos de obra:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar tipos de obra:', error.message);
      return [];
    }
  }

  /**
   * Lista motivos de retrabalho disponíveis
   */
  async listarMotivosRetrabalho(): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_motivos_retrabalho');

      if (error) {
        console.error('❌ Erro ao listar motivos de retrabalho:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar motivos de retrabalho:', error.message);
      return [];
    }
  }

  /**
   * Lista tipos de projeto por área genérica
   */
  async listarTiposProjetoPorArea(area_codigo: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_tipos_projeto_por_area', {
        p_area_codigo: area_codigo.toUpperCase(),
      });

      if (error) {
        console.error('❌ Erro ao listar tipos de projeto:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar tipos de projeto:', error.message);
      return [];
    }
  }

  /**
   * Lista todos os tipos de projeto
   */
  async listarTodosTiposProjeto(): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('listar_tipos_projeto');

      if (error) {
        console.error('❌ Erro ao listar todos os tipos de projeto:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao listar todos os tipos de projeto:', error.message);
      return [];
    }
  }

  /**
   * Busca sugestões de previsão por status (se status_detalhamento existir)
   */
  async buscarSugestoesPrevisao(status_codigo: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('buscar_sugestoes_previsao', {
        p_status_codigo: status_codigo.toUpperCase(),
      });

      if (error) {
        return [];
      }

      return data || [];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Busca sugestões de feito por status (se status_detalhamento existir)
   */
  async buscarSugestoesFeito(status_codigo: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('buscar_sugestoes_feito', {
        p_status_codigo: status_codigo.toUpperCase(),
      });

      if (error) {
        return [];
      }

      return data || [];
    } catch (error: any) {
      return [];
    }
  }

  /**
   * Cria ou atualiza prazos do projeto
   */
  async criarOuAtualizarPrazos(
    atribuicao_id: string,
    data_inicio_projeto: string,
    prazo_final_eng: string,
    prazo_final_cliente: string,
    data_inicio_esperada_cliente?: string,
    observacoes?: string
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const { data, error } = await this.supabase.rpc('criar_atualizar_prazos', {
        p_atribuicao_id: atribuicao_id,
        p_data_inicio_projeto: this.formatarDataParaDB(data_inicio_projeto),
        p_prazo_final_eng: this.formatarDataParaDB(prazo_final_eng),
        p_prazo_final_cliente: this.formatarDataParaDB(prazo_final_cliente),
        p_data_inicio_esperada_cliente: data_inicio_esperada_cliente
          ? this.formatarDataParaDB(data_inicio_esperada_cliente)
          : null,
        p_observacoes: observacoes || null,
      });

      if (error) {
        console.error('❌ Erro ao criar/atualizar prazos:', error);
        return false;
      }

      if (!data || !data.sucesso) {
        console.error('❌ Erro ao criar/atualizar prazos:', data?.mensagem);
        return false;
      }

      console.log(`✅ ${data.mensagem}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao criar/atualizar prazos:', error.message);
      return false;
    }
  }

  /**
   * Busca meus projetos (view consolidada)
   */
  async buscarMeusProjetos(eng_id: string): Promise<any[]> {
    if (!this.connected) return [];

    try {
      const { data, error } = await this.supabase.rpc('buscar_meus_projetos', {
        p_eng_id: eng_id,
      });

      if (error) {
        console.error('❌ Erro ao buscar meus projetos:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao buscar meus projetos:', error.message);
      return [];
    }
  }

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
    console.log(`      🔍 [SUPABASE] buscarEngenheiroPorTelefone("${telefone}")`);
    if (!this.connected) {
      // Sem cliente não houve consulta — não dá para afirmar que o número não
      // existe. Antes isto retornava null e derrubava 100% dos usuários para
      // "não cadastrado" sempre que faltasse configuração.
      console.error(`      ❌ [SUPABASE] Não conectado — impossível verificar cadastro`);
      throw new SupabaseUnavailableError('buscarEngenheiroPorTelefone');
    }

    try {
      const telefoneNormalizado = telefone.replace(/[^\d+]/g, '');
      console.log(`      🔍 [SUPABASE] Telefone normalizado: "${telefoneNormalizado}"`);
      console.log(`      🔍 [SUPABASE] Executando query...`);

      // maybeSingle(), não single(): com single() "0 linhas" chega como erro
      // PGRST116, pelo mesmo caminho de um timeout. Aqui, 0 linhas devolve
      // data: null / error: null, e `error` volta a significar falha real.
      const { data, error } = await this.supabase
        .from('engenheiros')
        .select('*')
        .eq('telefone', telefoneNormalizado)
        .eq('ativo', true)
        .maybeSingle();

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
    console.log(`      🔍 [SUPABASE] buscarDonoPorTelefone("${telefone}")`);
    if (!this.connected) {
      console.error(`      ❌ [SUPABASE] Não conectado — impossível verificar cadastro`);
      throw new SupabaseUnavailableError('buscarDonoPorTelefone');
    }

    try {
      const telefoneNormalizado = telefone.replace(/[^\d+]/g, '');
      console.log(`      🔍 [SUPABASE] Telefone normalizado: "${telefoneNormalizado}"`);
      console.log(`      🔍 [SUPABASE] Executando query...`);

      const { data, error } = await this.supabase
        .from('dono_empresa')
        .select('*')
        .eq('telefone', telefoneNormalizado)
        .eq('ativo', true)
        .maybeSingle();

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

  /**
   * Atualiza telefone de um engenheiro
   */
  async atualizarTelefoneEngenheiro(eng_id: string, telefone: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const telefoneNormalizado = telefone.replace(/[^\d+]/g, '');

      const { error } = await this.supabase
        .from('engenheiros')
        .update({ telefone: telefoneNormalizado, updated_at: new Date().toISOString() })
        .eq('eng_id', eng_id);

      if (error) {
        console.error('❌ Erro ao atualizar telefone:', error);
        return false;
      }

      console.log(`✅ Telefone atualizado para engenheiro ${eng_id}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar telefone:', error.message);
      return false;
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
   * Lista todas as complexidades disponíveis
   */
  async listarComplexidades(): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase
        .from('complexidade_tarefas')
        .select('*')
        .eq('ativo', true)
        .order('nivel');

      if (error) {
        console.error('❌ Erro ao listar complexidades:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error: any) {
      console.error('❌ Erro ao listar complexidades:', error.message);
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
   * Distribui tarefa do dono para um engenheiro (usando função .rpc())
   */
  async donoDistribuirTarefa(params: {
    dono_id: string;
    eng_id: string;
    area_codigo: string;
    descricao_task: string;
    projeto_id?: string;
    codigo_projeto?: string;
    cliente?: string;
    complexidade_codigo?: string;
    data_inicio_prevista?: string;
    data_conclusao_prevista?: string;
    observacoes_dono?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.connected) {
      return { success: false, error: 'Supabase não conectado' };
    }

    try {
      const { data, error } = await this.supabase.rpc('dono_distribuir_tarefa', {
        p_dono_id: params.dono_id,
        p_eng_id: params.eng_id,
        p_area_codigo: params.area_codigo,
        p_descricao_task: params.descricao_task,
        p_projeto_id: params.projeto_id || null,
        p_codigo_projeto: params.codigo_projeto || null,
        p_cliente: params.cliente || null,
        p_complexidade_codigo: params.complexidade_codigo || 'MEDIA',
        p_data_inicio_prevista: params.data_inicio_prevista || null,
        p_data_conclusao_prevista: params.data_conclusao_prevista || null,
        p_observacoes_dono: params.observacoes_dono || null,
      });

      if (error) {
        console.error('❌ Erro ao distribuir tarefa:', error);
        return { success: false, error: error.message };
      }

      console.log('✅ Tarefa distribuída com sucesso:', data);
      return { success: true, data };
    } catch (error: any) {
      console.error('❌ Erro ao distribuir tarefa:', error.message);
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
   * Atualiza campo específico da atribuição
   */
  async atualizarCampoAtribuicao(
    eng_projeto_id: string,
    campo: 'data_inicio' | 'data_prevista' | 'percentual_andamento' | 'observacoes',
    valor: any
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const updateData: any = {};
      updateData[campo] = valor;
      updateData.updated_at = new Date().toISOString();

      const { error } = await this.supabase
        .from('engenheiros_projetos')
        .update(updateData)
        .eq('id', eng_projeto_id);

      if (error) {
        console.error(`❌ Erro ao atualizar ${campo}:`, error);
        return false;
      }

      console.log(`✅ Campo ${campo} atualizado com sucesso`);
      return true;
    } catch (error: any) {
      console.error(`❌ Erro ao atualizar ${campo}:`, error.message);
      return false;
    }
  }

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
          data_registro: new Date().toISOString().split('T')[0],
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
    observacoes?: string
  ): Promise<boolean> {
    if (!this.connected) return false;

    try {
      // Atualizar previsão com feito
      const { data: atrib, error: erroAtrib } = await this.supabase
        .from('engenheiros_projetos')
        .select('eng_id, projeto_id')
        .eq('id', eng_projeto_id)
        .single();

      if (erroAtrib || !atrib) {
        console.error('❌ Erro ao buscar atribuição:', erroAtrib);
        return false;
      }

      // Upsert previsão do dia com o feito (cria registro se manhã não foi preenchida)
      const { error: erroPrevisao } = await this.supabase
        .from('projetos_previsao')
        .upsert({
          eng_projeto_id,
          projeto_id: atrib.projeto_id,
          eng_id: atrib.eng_id,
          data_registro: new Date().toISOString().split('T')[0],
          feito_texto,
          data_fim_dia: new Date().toISOString(),
          editavel: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'eng_projeto_id,data_registro'
        });

      if (erroPrevisao) {
        console.warn('⚠️ Aviso ao atualizar previsão:', erroPrevisao);
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
          return false;
        }
      }

      console.log('✅ Feito do dia registrado com sucesso');
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao atualizar feito do dia:', error.message);
      return false;
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
   * Converte data DD/MM/AAAA para YYYY-MM-DD
   */
  private formatarDataParaDB(dataStr?: string): string | null {
    if (!dataStr) return null;

    try {
      // Se já está em formato ISO (YYYY-MM-DD), retornar diretamente
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr.trim())) {
        return dataStr.trim();
      }

      // Formato DD/MM/AAAA → YYYY-MM-DD
      const partes = dataStr.split('/');
      if (partes.length !== 3) return null;

      const [dia, mes, ano] = partes;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    } catch (error) {
      return null;
    }
  }

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
   * Marca uma etapa de pavimento como concluída ou não concluída
   */
  async marcarEtapaConcluida(etapaId: string, concluida: boolean): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const { error } = await this.supabase
        .from('pavimento_etapas')
        .update({ concluida })
        .eq('etapa_id', etapaId)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao marcar etapa:', error);
        return false;
      }

      console.log(`✅ Etapa ${etapaId} marcada como ${concluida ? 'concluída' : 'pendente'}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao marcar etapa:', error.message);
      return false;
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
   * Marca uma etapa global como concluída ou não concluída
   */
  async marcarEtapaGlobalConcluida(etapaGlobalId: string, concluida: boolean): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const { error } = await this.supabase
        .from('projeto_etapas_globais')
        .update({ concluida })
        .eq('etapa_global_id', etapaGlobalId)
        .eq('ativo', true);

      if (error) {
        console.error('❌ Erro ao marcar etapa global:', error);
        return false;
      }

      console.log(`✅ Etapa global ${etapaGlobalId} marcada como ${concluida ? 'concluída' : 'pendente'}`);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao marcar etapa global:', error.message);
      return false;
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
   * Marca (100%) ou desmarca (0%) um projeto como concluído.
   * Usado para projetos SEM etapas configuradas, onde não há marcação por etapa.
   * Grava em projetos.percentual_ponderado (fonte única) via RPC.
   */
  async marcarProjetoConcluido(projetoId: string, concluido = true): Promise<number | null> {
    if (!this.connected) return null;

    try {
      const { data, error } = await this.supabase.rpc('marcar_projeto_concluido', {
        p_projeto_id: projetoId,
        p_concluido: concluido,
      });

      if (error) {
        console.error('❌ Erro ao marcar projeto como concluído:', error);
        return null;
      }

      console.log(`✅ Projeto ${projetoId} ${concluido ? 'concluído (100%)' : 'reaberto (0%)'}`);
      return typeof data === 'number' ? data : (concluido ? 100 : 0);
    } catch (error: any) {
      console.error('❌ Erro ao marcar projeto como concluído:', error.message);
      return null;
    }
  }

  /**
   * Progresso ponderado de uma disciplina (projeto+área).
   * Fonte única do status/✅ por área (engenheiros_projetos.percentual_ponderado).
   */
  async buscarProgressoArea(projetoId: string, areaId: string | number, engProjetoId?: string): Promise<number> {
    if (!this.connected) return 0;
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
        return 0;
      }
      return Number((data as any)?.[0]?.percentual_ponderado ?? 0);
    } catch (error: any) {
      console.error('❌ Erro ao buscar progresso da área:', error.message);
      return 0;
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
