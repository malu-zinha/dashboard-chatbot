// =====================================================
// FLUXO: Funcionalidades do Dono da Empresa (REFATORADO)
// =====================================================
// Este fluxo gerencia as operações disponíveis para o dono:
// 1. Visualizar informações (por projeto, engenheiro, ou retrabalhos)
// 2. Distribuir projetos (existentes) para engenheiros
// 3. Criar novos projetos
// =====================================================

import { getSupabaseService, SupabaseService, SupabaseUnavailableError } from '../../integrations/supabase/supabaseService.ts';
import { isPercentualPendente, statusPorPercentual } from '../../logic/execucao/filtros.ts';
import { formatProjetoDisciplinaLinha } from '../../logic/projetos/display.ts';
import { normalizeProjectCode, validateWhatsapp } from '../../logic/validation/validateInput.ts';
import { redactSecrets } from '../../logic/security/redactSecrets.ts';
import { resumoTexto } from '../../logic/security/mascararPII.ts';

// Lazy loading para evitar problemas com dotenv
let supabaseServiceInstance: SupabaseService | null = null;
function getSupabase(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = getSupabaseService();
  }
  return supabaseServiceInstance;
}

export function statusDonoPorProgresso(
  info: {
    percentual_ponderado?: number | string | null;
    percentual_andamento?: number | string | null;
    data_conclusao?: string | null;
  }
): string {
  const progresso = info.percentual_ponderado ?? info.percentual_andamento ?? 0;
  return statusPorPercentual(Number(progresso) || 0);
}

// =====================================================
// TIPOS E INTERFACES
// =====================================================

interface FlowResult {
  mensagem: string;
  finalizado: boolean;
  erro?: string;
}

type StepFunction = (mensagem: string) => Promise<FlowResult>;

type FlowMode = 'visualizar' | 'distribuir' | 'criar' | 'editar' | 'deletar' | 'transferir';
type VizTipo = 'projeto' | 'engenheiro' | 'retrabalhos';

// =====================================================
// CLASSE: OwnerFlow
// =====================================================

export class OwnerFlow {
  private whatsapp: string;
  private donoId?: string;
  private stepAtual: string;
  
  // Contexto unificado
  private contexto: {
    // Modo atual
    modo?: FlowMode;
    
    // Visualização
    viz_tipo?: VizTipo;
    viz_projeto_id?: string;
    viz_eng_id?: string;
    viz_area_id?: string;
    viz_atribuicao_id?: string;
    
    // Distribuição
    dist_eng_id?: string;
    dist_eng_nome?: string;
    dist_projeto_id?: string;
    dist_codigo_projeto?: string;
    dist_area_codigo?: string;
    dist_area_descricao?: string;
    dist_data_inicio?: string;
    dist_data_inicio_cliente?: string;
    dist_prazo_eng?: string;
    dist_prazo_cliente?: string;
    dist_observacoes?: string;
    
    // Criação
    criar_codigo?: string;
    criar_cliente?: string;
    criar_descricao?: string;

    // Deleção
    del_projeto_id?: string;
    del_codigo_projeto?: string;
    del_cliente?: string;
    
    // Engenheiros
    eng_nome_novo?: string;
    eng_telefone_novo?: string;
    eng_campo_edit?: string;

    // Edição
    edit_projeto_id?: string;
    edit_codigo_projeto?: string;
    edit_atribuicao_id?: string;
    edit_area_descricao?: string;
    edit_eng_nome?: string;
    edit_dados_atuais?: any;
    edit_campo?: string;
    edit_novo_valor?: any;

    // Transferência
    transf_eng_origem_id?: string;
    transf_eng_origem_nome?: string;
    transf_atribuicao_id?: string;
    transf_atribuicao_desc?: string;
    transf_eng_destino_id?: string;
    transf_eng_destino_nome?: string;
    transf_atribuicoes?: any[];

    // Listas
    engenheiros?: any[];
    projetos?: any[];
    areas?: any[];
    retrabalhos?: any[];
    status_list?: any[];
  } = {};

  constructor(whatsapp: string, donoId: string) {
    this.whatsapp = whatsapp;
    this.donoId = donoId;
    this.stepAtual = 'inicio';
  }

  // =====================================================
  // PROCESSAMENTO PRINCIPAL
  // =====================================================

  async processarMensagem(mensagem: string): Promise<FlowResult> {
    console.log(`\n🔷 OwnerFlow [${this.stepAtual}]: ${resumoTexto(mensagem)}`);

    const steps: Record<string, StepFunction> = {
      inicio: this.stepInicio.bind(this),
      escolher_acao: this.stepEscolherAcao.bind(this),
      
      // Visualizar
      visualizar_menu: this.stepVisualizarMenu.bind(this),
      viz_listar_projetos: this.stepVizListarProjetos.bind(this),
      viz_escolher_projeto: this.stepVizEscolherProjeto.bind(this),
      viz_escolher_area_proj: this.stepVizEscolherAreaProjeto.bind(this),
      viz_mostrar_info: this.stepVizMostrarInfo.bind(this),
      viz_listar_engenheiros: this.stepVizListarEngenheiros.bind(this),
      viz_escolher_engenheiro: this.stepVizEscolherEngenheiro.bind(this),
      viz_listar_projetos_eng: this.stepVizListarProjetosEng.bind(this),
      viz_escolher_projeto_eng: this.stepVizEscolherProjetoEng.bind(this),
      viz_escolher_area_eng: this.stepVizEscolherAreaEng.bind(this),
      viz_historico_menu: this.stepVizHistoricoMenu.bind(this),
      viz_escolher_filtro_ret: this.stepVizEscolherFiltroRet.bind(this),
      viz_filtrar_ret_projeto: this.stepVizFiltrarRetProjeto.bind(this),
      viz_filtrar_ret_engenheiro: this.stepVizFiltrarRetEngenheiro.bind(this),
      viz_mostrar_retrabalhos: this.stepVizMostrarRetrabalhos.bind(this),
      
      // Distribuir
      dist_escolher_engenheiro: this.stepDistEscolherEngenheiro.bind(this),
      dist_escolher_projeto: this.stepDistEscolherProjeto.bind(this),
      dist_escolher_area: this.stepDistEscolherArea.bind(this),
      dist_data_inicio: this.stepDistDataInicio.bind(this),
      dist_data_inicio_cliente: this.stepDistDataInicioCliente.bind(this),
      dist_prazo_eng: this.stepDistPrazoEng.bind(this),
      dist_prazo_cliente: this.stepDistPrazoCliente.bind(this),
      dist_observacoes: this.stepDistObservacoes.bind(this),
      dist_confirmar: this.stepDistConfirmar.bind(this),
      
      // Criar
      criar_codigo: this.stepCriarCodigo.bind(this),
      criar_cliente: this.stepCriarCliente.bind(this),
      criar_descricao: this.stepCriarDescricao.bind(this),
      criar_confirmar: this.stepCriarConfirmar.bind(this),

      // Editar
      edit_escolher_projeto: this.stepEditEscolherProjeto.bind(this),
      edit_escolher_area: this.stepEditEscolherArea.bind(this),
      edit_menu_categorias: this.stepEditMenuCategorias.bind(this),
      edit_menu_campos: this.stepEditMenuCampos.bind(this),
      edit_digitar_valor: this.stepEditDigitarValor.bind(this),
      edit_confirmar: this.stepEditConfirmar.bind(this),

      // Gerenciar Engenheiros
      eng_menu: this.stepEngMenu.bind(this),
      eng_menu_escolha: this.stepEngMenuEscolha.bind(this),
      eng_criar_nome: this.stepEngCriarNome.bind(this),
      eng_criar_telefone: this.stepEngCriarTelefone.bind(this),
      eng_editar_selecionar: this.stepEngEditarSelecionar.bind(this),
      eng_editar_campo: this.stepEngEditarCampo.bind(this),
      eng_editar_valor: this.stepEngEditarValor.bind(this),
      eng_editar_confirmar: this.stepEngEditarConfirmar.bind(this),
      eng_excluir_selecionar: this.stepEngExcluirSelecionar.bind(this),
      eng_excluir_confirmar: this.stepEngExcluirConfirmar.bind(this),

      // Exclusão Unificada
      excluir_selecionar_projeto: this.stepExcluirSelecionarProjeto.bind(this),
      excluir_acao: this.stepExcluirAcao.bind(this),
      excluir_projeto_confirmar: this.stepExcluirProjetoConfirmar.bind(this),
      area_excluir_selecionar: this.stepAreaExcluirSelecionar.bind(this),
      area_excluir_confirmar: this.stepAreaExcluirConfirmar.bind(this),

      // Transferir tarefa
      transf_escolher_eng_origem: this.stepTransfEscolherEngOrigem.bind(this),
      transf_escolher_atribuicao: this.stepTransfEscolherAtribuicao.bind(this),
      transf_escolher_eng_destino: this.stepTransfEscolherEngDestino.bind(this),
      transf_confirmar: this.stepTransfConfirmar.bind(this),
    };

    const stepFunction = steps[this.stepAtual];
    
    if (!stepFunction) {
      console.error(`❌ Step "${this.stepAtual}" não encontrado`);
      return {
        mensagem: '❌ Erro interno. Digite "menu" para recomeçar.',
        finalizado: true,
      };
    }

    // Comandos globais
    if (mensagem.toLowerCase().trim() === 'menu') {
      this.stepAtual = 'escolher_acao';
      this.contexto = {};
      return this.stepEscolherAcao('');
    }

    try {
      return await stepFunction(mensagem);
    } catch (error: any) {
      // A mensagem crua ia direto para o WhatsApp do dono — podia carregar
      // detalhe do Postgres ou, no caso do incidente, a própria Secret Key.
      console.error(`❌ Erro no step ${this.stepAtual}:`, redactSecrets(error));
      if (error instanceof SupabaseUnavailableError) {
        return {
          mensagem: '⚠️ Não consegui acessar os dados agora. Tente de novo em alguns minutos.\n\nDigite "menu" para recomeçar.',
          finalizado: true,
          erro: 'indisponivel',
        };
      }
      return {
        mensagem: '❌ Ocorreu um erro ao processar sua solicitação.\n\nDigite "menu" para recomeçar.',
        finalizado: true,
        erro: redactSecrets(error?.message ?? error),
      };
    }
  }

  // =====================================================
  // STEPS PRINCIPAIS
  // =====================================================

  private async stepInicio(mensagem: string): Promise<FlowResult> {
    this.stepAtual = 'escolher_acao';
    
    return {
      mensagem: `📋 *Bem-vindo, Dono!*\n\n` +
                `O que deseja fazer?\n\n` +
                `1️⃣ Visualizar informações\n` +
                `2️⃣ Distribuir projeto para engenheiro\n` +
                `3️⃣ Criar novo projeto\n` +
                `4️⃣ Editar projeto\n` +
                `5️⃣ Gerenciar Engenheiros\n` +
                `6️⃣ Excluir (Projeto/Área)\n` +
                `7️⃣ Transferir tarefa entre engenheiros\n\n` +
                `_Digite o número da opção desejada_`,
      finalizado: false,
    };
  }

  private async stepEscolherAcao(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();

    switch (opcao) {
      case '1':
        this.contexto.modo = 'visualizar';
        this.stepAtual = 'visualizar_menu';
        return {
          mensagem: `📊 *Visualizar Informações*\n\n` +
                    `Escolha o tipo de visualização:\n\n` +
                    `a) Por Projeto\n` +
                    `b) Por Engenheiro\n` +
                    `c) Histórico de Retrabalhos\n\n` +
                    `_Digite a letra da opção (a, b ou c)_`,
          finalizado: false,
        };
      
      case '2':
        this.contexto.modo = 'distribuir';
        return await this.iniciarDistribuicao();
      
      case '3':
        this.contexto.modo = 'criar';
        this.stepAtual = 'criar_codigo';
        return {
          mensagem: `🏗️ *Criar Novo Projeto*\n\n` +
                    `Digite o código do projeto\n` +
                    `(ex: PRJ-009, RES-2024-15)\n\n` +
                    `_Digite o código_`,
          finalizado: false,
        };

      case '4':
        this.contexto.modo = 'editar';
        return await this.iniciarEdicao();

      case '5':
        this.stepAtual = 'eng_menu';
        return this.stepEngMenu('');

      case '6':
        this.contexto.modo = 'deletar';
        return await this.iniciarExclusaoUnificada();

      case '7':
        this.contexto.modo = 'transferir';
        return await this.iniciarTransferencia();

      default:
        return {
          mensagem: `❌ Opção inválida.\n\n` +
                    `Digite uma opção entre 1 e 7.`,
          finalizado: false,
        };
    }
  }

  // =====================================================
  // FLUXO 1: VISUALIZAR
  // =====================================================

  private async stepVisualizarMenu(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.toLowerCase().trim();

    switch (opcao) {
      case 'a':
        this.contexto.viz_tipo = 'projeto';
        return await this.listarProjetosParaViz();
      
      case 'b':
        this.contexto.viz_tipo = 'engenheiro';
        return await this.listarEngenheirosParaViz();
      
      case 'c':
        this.contexto.viz_tipo = 'retrabalhos';
        this.stepAtual = 'viz_historico_menu';
        return {
          mensagem: `📋 *Histórico de Retrabalhos*\n\n` +
                    `Como deseja visualizar?\n\n` +
                    `1️⃣ Ver todos os retrabalhos\n` +
                    `2️⃣ Filtrar por projeto\n` +
                    `3️⃣ Filtrar por engenheiro\n\n` +
                    `_Digite o número da opção_`,
          finalizado: false,
        };
      
      default:
        return {
          mensagem: `❌ Opção inválida.\n\n` +
                    `Digite:\n` +
                    `a) Por Projeto\n` +
                    `b) Por Engenheiro\n` +
                    `c) Histórico de Retrabalhos`,
          finalizado: false,
        };
    }
  }

  // 1a) Por Projeto
  private async listarProjetosParaViz(): Promise<FlowResult> {
    const resultado = await getSupabase().listarTodosProjetos();
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `📭 Nenhum projeto encontrado.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.projetos = resultado.data;
    this.stepAtual = 'viz_escolher_projeto';

    let msg = `📋 *Escolha o Projeto:*\n\n`;
    resultado.data.forEach((proj: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${proj.codigo_projeto} - ${proj.cliente}\n`;
    });
    msg += `\n_Digite o número do projeto_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepVizListarProjetos(mensagem: string): Promise<FlowResult> {
    return await this.listarProjetosParaViz();
  }

  private async stepVizEscolherProjeto(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.projetos?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.projetos?.length}`,
        finalizado: false,
      };
    }

    const projeto = this.contexto.projetos![escolha];
    this.contexto.viz_projeto_id = projeto.projeto_id;

    // Buscar áreas do projeto
    const resultado = await getSupabase().buscarAreasDoProjeto(projeto.projeto_id);
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `⚠️ Este projeto não possui áreas cadastradas.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.areas = resultado.data;
    this.stepAtual = 'viz_escolher_area_proj';

    let msg = `📦 *Áreas do Projeto ${projeto.codigo_projeto}:*\n\n`;
    resultado.data.forEach((area: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${area.descricao}\n`;
    });
    msg += `\n_Digite o número da área_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepVizEscolherAreaProjeto(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.areas?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.areas?.length}`,
        finalizado: false,
      };
    }

    const area = this.contexto.areas![escolha];
    this.contexto.viz_area_id = area.area_id;
    
    return await this.mostrarInformacoesCompletas();
  }

  // 1b) Por Engenheiro
  private async listarEngenheirosParaViz(): Promise<FlowResult> {
    const resultado = await getSupabase().listarEngenheiros();
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `📭 Nenhum engenheiro encontrado.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.engenheiros = resultado.data;
    this.stepAtual = 'viz_escolher_engenheiro';

    let msg = `👤 *Escolha o Engenheiro:*\n\n`;
    resultado.data.forEach((eng: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${eng.nome}\n`;
    });
    msg += `\n_Digite o número do engenheiro_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepVizListarEngenheiros(mensagem: string): Promise<FlowResult> {
    return await this.listarEngenheirosParaViz();
  }

  private async stepVizEscolherEngenheiro(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.engenheiros?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.engenheiros?.length}`,
        finalizado: false,
      };
    }

    const eng = this.contexto.engenheiros![escolha];
    this.contexto.viz_eng_id = eng.eng_id;
    
    // Buscar projetos do engenheiro
    const resultado = await getSupabase().buscarProjetosPorEngenheiro(eng.eng_id);
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `📭 ${eng.nome} não possui projetos atribuídos.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.projetos = resultado.data;
    this.stepAtual = 'viz_escolher_projeto_eng';

    let msg = `📋 *Projetos de ${eng.nome}:*\n\n`;
    resultado.data.forEach((proj: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${formatProjetoDisciplinaLinha(proj)}\n`;
    });
    msg += `\n_Digite o número do projeto_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepVizListarProjetosEng(mensagem: string): Promise<FlowResult> {
    // Recarrega lista de projetos do engenheiro
    if (!this.contexto.viz_eng_id) {
      return { mensagem: '❌ Erro: engenheiro não selecionado. Digite "menu" para recomeçar.', finalizado: true };
    }
    const resultado = await getSupabase().buscarProjetosPorEngenheiro(this.contexto.viz_eng_id);
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return { mensagem: '📭 Nenhum projeto encontrado.\n\n_Digite "menu" para voltar_', finalizado: true };
    }
    this.contexto.projetos = resultado.data;
    this.stepAtual = 'viz_escolher_projeto_eng';
    let msg = `📋 *Projetos:*\n\n`;
    resultado.data.forEach((proj: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${formatProjetoDisciplinaLinha(proj)}\n`;
    });
    msg += `\n_Digite o número do projeto_`;
    return { mensagem: msg, finalizado: false };
  }

  private async stepVizEscolherProjetoEng(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.projetos?.length || 0)) {
    return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.projetos?.length}`,
      finalizado: false,
    };
  }

    const proj = this.contexto.projetos![escolha];
    this.contexto.viz_projeto_id = proj.projeto_id;
    this.contexto.viz_area_id = proj.area_id;
    this.contexto.viz_atribuicao_id = proj.atribuicao_id;
    
    return await this.mostrarInformacoesCompletas();
  }

  private async stepVizEscolherAreaEng(mensagem: string): Promise<FlowResult> {
    // Implementar se necessário (quando engenheiro tem múltiplas áreas no mesmo projeto)
    return { mensagem: 'Em implementação', finalizado: true };
  }

  // 1c) Histórico Retrabalhos
  private async stepVizHistoricoMenu(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();

    switch (opcao) {
      case '1':
        // Ver todos
        return await this.carregarRetrabalhos();
      
      case '2': {
        // Filtrar por projeto
        const resultProjeto = await this.listarProjetosParaViz();
        this.stepAtual = 'viz_filtrar_ret_projeto';
        return resultProjeto;
      }

      case '3': {
        // Filtrar por engenheiro
        const resultEng = await this.listarEngenheirosParaViz();
        this.stepAtual = 'viz_filtrar_ret_engenheiro';
        return resultEng;
      }
      
      default:
        return {
          mensagem: `❌ Opção inválida.\n\nDigite 1, 2 ou 3`,
          finalizado: false,
        };
    }
  }

  private async stepVizEscolherFiltroRet(mensagem: string): Promise<FlowResult> {
    return { mensagem: 'Em processamento', finalizado: false };
  }

  private async stepVizFiltrarRetProjeto(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.projetos?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.projetos?.length}`,
        finalizado: false,
      };
    }

    const projeto = this.contexto.projetos![escolha];
    return await this.carregarRetrabalhos({ projetoId: projeto.projeto_id });
  }

  private async stepVizFiltrarRetEngenheiro(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.engenheiros?.length || 0)) {
    return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.engenheiros?.length}`,
      finalizado: false,
    };
  }

    const eng = this.contexto.engenheiros![escolha];
    return await this.carregarRetrabalhos({ engId: eng.eng_id });
  }

  private async carregarRetrabalhos(filters?: { engId?: string; projetoId?: string }): Promise<FlowResult> {
    const resultado = await getSupabase().buscarHistoricoRetrabalhos(filters);
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
    return {
        mensagem: `📭 Nenhum retrabalho encontrado.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.retrabalhos = resultado.data;
    this.stepAtual = 'viz_mostrar_retrabalhos';
    
    let msg = `🔄 *Histórico de Retrabalhos*\n\n`;
    msg += `Total: ${resultado.data.length} retrabalho(s)\n\n`;
    
    resultado.data.slice(0, 10).forEach((ret: any) => {
      msg += `📅 ${ret.data_retrabalho}\n`;
      msg += `👷 ${ret.engenheiro_nome}\n`;
      msg += `📋 ${ret.codigo_projeto} - ${ret.area_descricao}\n`;
      msg += `❗ Motivo: ${ret.motivo_retrabalho}\n`;
      if (ret.tipo_retrabalho) {
        msg += `📊 Tipo: ${ret.tipo_retrabalho}\n`;
      }
      msg += `\n`;
    });
    
    if (resultado.data.length > 10) {
      msg += `_...e mais ${resultado.data.length - 10} retrabalho(s)_\n\n`;
    }
    
    msg += `_Digite "menu" para voltar ao menu principal_`;
    
    return { mensagem: msg, finalizado: true };
  }

  private async stepVizMostrarRetrabalhos(mensagem: string): Promise<FlowResult> {
    return { mensagem: 'Digite "menu" para voltar', finalizado: true };
  }

  // Mostrar informações completas
  private async stepVizMostrarInfo(mensagem: string): Promise<FlowResult> {
    return await this.mostrarInformacoesCompletas();
  }

  private async mostrarInformacoesCompletas(): Promise<FlowResult> {
    const resultado = await getSupabase().buscarProjetoDetalhado(this.contexto.viz_projeto_id!);
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `❌ Erro ao buscar informações do projeto.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    // Filtrar pela área se especificada
    let dados = resultado.data;
    if (this.contexto.viz_area_id) {
      dados = dados.filter((d: any) => d.area_id == this.contexto.viz_area_id);
    }

    if (dados.length === 0) {
      return {
        mensagem: `⚠️ Nenhuma informação encontrada.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    const info = dados[0];
    
    // Buscar última atualização noturna do engenheiro
    let ultimaAtualizacao = null;
    if (info.atribuicao_id) {
      const resultadoAtualizacao = await getSupabase().buscarUltimaAtualizacaoNoturna(info.atribuicao_id);
      if (resultadoAtualizacao.success && resultadoAtualizacao.data) {
        ultimaAtualizacao = resultadoAtualizacao.data;
      }
    }
    
    let msg = `📊 *Informações Completas*\n\n`;
    msg += `📋 *Projeto:* ${info.codigo_projeto}\n`;
    msg += `👤 *Cliente:* ${info.cliente}\n`;
    msg += `📦 *Área:* ${info.area_descricao}\n`;
    msg += `👷 *Engenheiro:* ${info.engenheiro_nome}\n\n`;
    
    msg += `📊 *Status:* ${statusDonoPorProgresso(info)}\n`;
    const progressoPonderado = await getSupabase().buscarProgressoPonderado(info.projeto_id);
    const andamento = progressoPonderado ?? info.percentual_andamento ?? 0;
    msg += `⚡ *Andamento Global do Projeto:* ${andamento}%\n\n`;
    
    msg += `📅 *Data Início:* ${info.data_inicio || 'N/A'}\n`;
    msg += `⏰ *Data Prevista:* ${info.data_prevista || 'N/A'}\n`;
    if (info.data_conclusao) {
      msg += `✅ *Concluído em:* ${info.data_conclusao}\n`;
    }
    msg += `\n`;
    
    if (info.prazo_final_eng || info.prazo_final_cliente) {
      msg += `⏱️ *Prazos:*\n`;
      if (info.prazo_final_eng) {
        msg += `  • Interno: ${info.prazo_final_eng}`;
        if (info.prazo_interno_dias) {
          msg += ` (${info.prazo_interno_dias} dias)`;
        }
        msg += `\n`;
      }
      if (info.prazo_final_cliente) {
        msg += `  • Cliente: ${info.prazo_final_cliente}`;
        if (info.prazo_cliente_dias) {
          msg += ` (${info.prazo_cliente_dias} dias)`;
        }
        msg += `\n`;
      }
      msg += `\n`;
    }
    
    if (info.quantidade_retrabalhos > 0) {
      msg += `🔄 *Retrabalhos:* ${info.quantidade_retrabalhos}\n`;
      msg += `📊 *Taxa:* ${info.percentual_retrabalhos}%\n\n`;
    }
    
    if (info.dias_atraso > 0) {
      msg += `⚠️ *Atraso:* ${info.dias_atraso} dia(s)\n\n`;
    }
    
    // Adicionar última atualização do engenheiro (NOVO!)
    if (ultimaAtualizacao) {
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🌙 *Última Atualização Noturna*\n\n`;
      
      if (ultimaAtualizacao.feito_texto) {
        const dataFormatada = ultimaAtualizacao.data_registro 
          ? new Date(ultimaAtualizacao.data_registro).toLocaleDateString('pt-BR')
          : 'N/A';
        msg += `📅 Data: ${dataFormatada}\n`;
        msg += `✅ *Feito:* ${ultimaAtualizacao.feito_texto}\n\n`;
      }
      
      if (ultimaAtualizacao.observacoes) {
        msg += `💬 *Observações:* ${ultimaAtualizacao.observacoes}\n\n`;
      }
    }
    
    msg += `_Digite "menu" para voltar ao menu principal_`;
    
    this.stepAtual = 'viz_mostrar_info';
    return { mensagem: msg, finalizado: true };
  }

  // =====================================================
  // FLUXO 2: DISTRIBUIR
  // =====================================================

  private async iniciarDistribuicao(): Promise<FlowResult> {
    const resultado = await getSupabase().listarEngenheiros();
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `❌ Nenhum engenheiro cadastrado.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.engenheiros = resultado.data;
    this.stepAtual = 'dist_escolher_engenheiro';

    let msg = `👤 *Escolha o Engenheiro:*\n\n`;
    resultado.data.forEach((eng: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${eng.nome}\n`;
    });
    msg += `\n_Digite o número do engenheiro_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepDistEscolherEngenheiro(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.engenheiros?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.engenheiros?.length}`,
        finalizado: false,
      };
    }

    const eng = this.contexto.engenheiros![escolha];
    this.contexto.dist_eng_id = eng.eng_id;
    this.contexto.dist_eng_nome = eng.nome;
    
    // Listar projetos existentes
    const resultado = await getSupabase().listarTodosProjetos();
    
    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `❌ Nenhum projeto cadastrado.\n\n` +
                  `Use a opção "3 - Criar novo projeto" no menu principal.\n\n` +
                  `_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.projetos = resultado.data;
    this.stepAtual = 'dist_escolher_projeto';

    let msg = `📋 *Escolha o Projeto:*\n\n`;
    resultado.data.forEach((proj: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${proj.codigo_projeto} - ${proj.cliente}\n`;
    });
    msg += `\n_Digite o número do projeto_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepDistEscolherProjeto(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.projetos?.length || 0)) {
    return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.projetos?.length}`,
      finalizado: false,
    };
  }

    const projeto = this.contexto.projetos![escolha];
    this.contexto.dist_projeto_id = projeto.projeto_id;
    this.contexto.dist_codigo_projeto = projeto.codigo_projeto;
    
    // Listar áreas disponíveis
    const resultado = await getSupabase().listarAreasDisponiveis();
    
    if (!resultado || resultado.length === 0) {
      return {
        mensagem: `❌ Nenhuma área disponível.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.areas = resultado;
    this.stepAtual = 'dist_escolher_area';

    let msg = `📦 *Escolha a Área:*\n\n`;
    resultado.forEach((area: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${area.descricao} (${area.tempo_trabalho_dias} dias)\n`;
    });
    msg += `\n_Digite o número da área_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepDistEscolherArea(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;
    
    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.areas?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.areas?.length}`,
        finalizado: false,
      };
    }

    const area = this.contexto.areas![escolha];
    this.contexto.dist_area_codigo = area.codigo;
    this.contexto.dist_area_descricao = area.descricao;

    this.stepAtual = 'dist_data_inicio';
    return {
      mensagem: `📅 *Data de Início*\n\n` +
                `Digite a data de início do projeto\n` +
                `Formato: DD/MM/AAAA\n` +
                `Ou digite "hoje" para usar a data atual\n\n` +
                `_Digite a data_`,
      finalizado: false,
    };
  }

  private async stepDistDataInicio(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim().toLowerCase();
    
    if (input === 'hoje') {
      this.contexto.dist_data_inicio = new Date().toISOString().split('T')[0];
    } else {
      const data = this.parsearData(input);
      if (!data) {
        return {
          mensagem: `❌ Data inválida.\n\n` +
                    `Use: DD/MM/AAAA ou digite "hoje"`,
          finalizado: false,
        };
      }
      
      // Usar data validada
      this.contexto.dist_data_inicio = data;
    }

    this.stepAtual = 'dist_data_inicio_cliente';
    
    return {
      mensagem: `📅 *Data de Início Esperada pelo Cliente* (opcional)\n\n` +
                `Digite a data esperada pelo cliente\n` +
                `Formato: DD/MM/AAAA\n` +
                `Ou digite "pular" para não informar\n\n` +
                `_Digite a data ou "pular"_`,
      finalizado: false,
    };
  }

  private async stepDistDataInicioCliente(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim().toLowerCase();
      
    if (input !== 'pular') {
      const data = this.parsearData(input);
      if (!data) {
        return {
          mensagem: `❌ Data inválida.\n\n` +
                    `Use: DD/MM/AAAA ou digite "pular"`,
          finalizado: false,
        };
      }

      this.contexto.dist_data_inicio_cliente = data;
    }

    this.stepAtual = 'dist_prazo_eng';
    return {
      mensagem: `⏰ *Prazo Final Interno (Engenheiro)*\n\n` +
                `Digite o prazo final interno\n` +
                `Formato: DD/MM/AAAA\n\n` +
                `_Digite a data_`,
      finalizado: false,
    };
  }

  private async stepDistPrazoEng(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim();
    const prazoEng = this.parsearData(input);
    if (!prazoEng) {
      return {
        mensagem: `❌ Data inválida.\n\nUse: DD/MM/AAAA (ex: 15/02/2026)`,
        finalizado: false,
      };
    }

    // Validar: prazo_eng >= data_inicio
    if (prazoEng < this.contexto.dist_data_inicio!) {
      return {
        mensagem: `❌ O prazo interno deve ser maior ou igual à data de início.\n\n` +
                  `Data início: ${this.contexto.dist_data_inicio}\n\n` +
                  `Digite um prazo válido:`,
        finalizado: false,
      };
    }
    
    this.contexto.dist_prazo_eng = prazoEng;
    this.stepAtual = 'dist_prazo_cliente';

    return {
      mensagem: `📅 *Prazo Final para o Cliente*\n\n` +
                `Digite o prazo final para o cliente\n` +
                `Formato: DD/MM/AAAA\n\n` +
                `_Digite a data_`,
      finalizado: false,
    };
  }

  private async stepDistPrazoCliente(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim();
    const prazoCliente = this.parsearData(input);
    if (!prazoCliente) {
      return {
        mensagem: `❌ Data inválida.\n\nUse: DD/MM/AAAA (ex: 28/02/2026)`,
        finalizado: false,
      };
    }
    
    // Validar: prazo_cliente >= prazo_eng
    if (prazoCliente < this.contexto.dist_prazo_eng!) {
      return {
        mensagem: `❌ O prazo do cliente deve ser maior ou igual ao prazo interno.\n\n` +
                  `Prazo interno: ${this.contexto.dist_prazo_eng}\n\n` +
                  `Digite um prazo válido:`,
        finalizado: false,
      };
    }
    
    this.contexto.dist_prazo_cliente = prazoCliente;
    this.stepAtual = 'dist_observacoes';
    
    return {
      mensagem: `📝 *Observações* (opcional)\n\n` +
                `Digite observações sobre a distribuição\n` +
                `Ou digite "pular" para não incluir observações\n\n` +
                `_Digite o texto ou "pular"_`,
      finalizado: false,
    };
  }

  private async stepDistObservacoes(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim();
    
    if (input.toLowerCase() !== 'pular') {
      this.contexto.dist_observacoes = input;
    }
    
    this.stepAtual = 'dist_confirmar';
    
    let resumo = `✅ *Confirmar Distribuição*\n\n`;
    resumo += `👷 *Engenheiro:* ${this.contexto.dist_eng_nome}\n`;
    resumo += `📋 *Projeto:* ${this.contexto.dist_codigo_projeto}\n`;
    resumo += `📦 *Área:* ${this.contexto.dist_area_descricao}\n\n`;
    resumo += `📅 *Data Início:* ${this.contexto.dist_data_inicio}\n`;
    if (this.contexto.dist_data_inicio_cliente) {
      resumo += `📅 *Início Cliente:* ${this.contexto.dist_data_inicio_cliente}\n`;
    }
    resumo += `⏰ *Prazo Interno:* ${this.contexto.dist_prazo_eng}\n`;
    resumo += `📅 *Prazo Cliente:* ${this.contexto.dist_prazo_cliente}\n`;
    if (this.contexto.dist_observacoes) {
      resumo += `📝 *Observações:* ${this.contexto.dist_observacoes}\n`;
    }
    resumo += `\n1️⃣ Confirmar\n`;
    resumo += `2️⃣ Cancelar\n\n`;
    resumo += `_Digite 1 para confirmar ou 2 para cancelar_`;
    
    return { mensagem: resumo, finalizado: false };
  }

  private async stepDistConfirmar(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();

    if (opcao === '2') {
      this.contexto = {};
      this.stepAtual = 'escolher_acao';
      return {
        mensagem: `❌ Distribuição cancelada.\n\n` +
                  `_Digite "menu" para voltar ao menu principal_`,
        finalizado: true,
      };
    }

    if (opcao !== '1') {
      return {
        mensagem: `❌ Opção inválida.\n\nDigite 1 para confirmar ou 2 para cancelar`,
        finalizado: false,
      };
    }
    
    // Executar distribuição
    const resultado = await getSupabase().distribuirProjetoComPrazos({
      dono_id: this.donoId!,
      eng_id: this.contexto.dist_eng_id!,
      projeto_id: this.contexto.dist_projeto_id!,
      area_codigo: this.contexto.dist_area_codigo!,
      data_inicio: this.contexto.dist_data_inicio!,
      data_inicio_esperada_cliente: this.contexto.dist_data_inicio_cliente,
      prazo_final_eng: this.contexto.dist_prazo_eng!,
      prazo_final_cliente: this.contexto.dist_prazo_cliente!,
      observacoes: this.contexto.dist_observacoes,
    });

    if (!resultado.success) {
      return {
        mensagem: `❌ Erro ao distribuir projeto:\n\n${resultado.error}\n\n` +
                  `_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }
    
    const resposta = resultado.data;
    
    let msg = `✅ ${resposta.mensagem || 'Projeto distribuído com sucesso!'}\n\n`;
    if (resposta.detalhes) {
      msg += `📋 Detalhes:\n`;
      msg += `  • Engenheiro: ${resposta.detalhes.engenheiro}\n`;
      msg += `  • Projeto: ${resposta.detalhes.projeto}\n`;
      msg += `  • Área: ${resposta.detalhes.area}\n`;
      msg += `  • Início: ${resposta.detalhes.data_inicio}\n`;
      msg += `  • Prazo Interno: ${resposta.detalhes.prazo_eng}\n`;
      msg += `  • Prazo Cliente: ${resposta.detalhes.prazo_cliente}\n\n`;
    }
    msg += `📱 Notificação enviada ao engenheiro!\n\n`;
    msg += `_Digite "menu" para voltar ao menu principal_`;
    
    this.contexto = {};
    return { mensagem: msg, finalizado: true };
  }

  // =====================================================
  // FLUXO 3: CRIAR PROJETO
  // =====================================================

  private async stepCriarCodigo(mensagem: string): Promise<FlowResult> {
    const rawCodigo = mensagem.trim();
    const codigo = normalizeProjectCode(rawCodigo);
    
    if (codigo.length < 3) {
      return {
        mensagem: `❌ Código muito curto.\n\nDigite um código com pelo menos 3 caracteres:`,
        finalizado: false,
      };
    }

    this.contexto.criar_codigo = codigo;
    this.stepAtual = 'criar_cliente';

    return {
      mensagem: `👤 *Nome do Cliente*\n\n` +
                `Digite o nome do cliente\n\n` +
                `_Digite o nome_`,
      finalizado: false,
    };
  }

  private async stepCriarCliente(mensagem: string): Promise<FlowResult> {
    const cliente = mensagem.trim();
    
    if (cliente.length < 2) {
      return {
        mensagem: `❌ Nome muito curto.\n\nDigite um nome válido:`,
        finalizado: false,
      };
    }
    
    this.contexto.criar_cliente = cliente;
    this.stepAtual = 'criar_descricao';
    
    return {
      mensagem: `📝 *Descrição do Projeto*\n\n` +
                `Digite uma descrição para o projeto\n\n` +
                `_Digite a descrição_`,
      finalizado: false,
    };
  }

  private async stepCriarDescricao(mensagem: string): Promise<FlowResult> {
    const descricao = mensagem.trim();
    
    if (descricao.length < 3) {
      return {
        mensagem: `❌ Descrição muito curta.\n\nDigite uma descrição com pelo menos 3 caracteres:`,
        finalizado: false,
      };
    }
    
    this.contexto.criar_descricao = descricao;
    this.stepAtual = 'criar_confirmar';
    
    let resumo = `✅ *Confirmar Criação de Projeto*\n\n`;
    resumo += `🏗️ *Código:* ${this.contexto.criar_codigo}\n`;
    resumo += `👤 *Cliente:* ${this.contexto.criar_cliente}\n`;
    resumo += `📝 *Descrição:* ${this.contexto.criar_descricao}\n\n`;
    resumo += `1️⃣ Confirmar\n`;
    resumo += `2️⃣ Cancelar\n\n`;
    resumo += `_Digite 1 para confirmar ou 2 para cancelar_`;
    
    return { mensagem: resumo, finalizado: false };
  }

  private async stepCriarConfirmar(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();
    
    if (opcao === '2') {
      this.contexto = {};
      this.stepAtual = 'escolher_acao';
      return {
        mensagem: `❌ Criação cancelada.\n\n` +
                  `_Digite "menu" para voltar ao menu principal_`,
      finalizado: true,
    };
  }

    if (opcao !== '1') {
      return {
        mensagem: `❌ Opção inválida.\n\nDigite 1 para confirmar ou 2 para cancelar`,
        finalizado: false,
      };
    }
    
    // Criar projeto
    const resultado = await getSupabase().criarProjetoCompleto({
      codigo: this.contexto.criar_codigo!,
      cliente: this.contexto.criar_cliente!,
      descricao: this.contexto.criar_descricao!,
    });
    
    if (!resultado.success) {
      return {
        mensagem: `❌ Erro ao criar projeto:\n\n${resultado.error}\n\n` +
                  `_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }
    
    const resposta = resultado.data;
    
    let msg = `✅ ${resposta.mensagem || 'Projeto criado com sucesso!'}\n\n`;
    msg += `🏗️ *Código:* ${resposta.codigo || this.contexto.criar_codigo}\n`;
    msg += `👤 *Cliente:* ${resposta.cliente || this.contexto.criar_cliente}\n\n`;
    msg += `💡 *Próximo passo:*\n`;
    msg += `Use a opção "2 - Distribuir projeto" no menu principal para atribuir este projeto a um engenheiro.\n\n`;
    msg += `_Digite "menu" para voltar ao menu principal_`;
    
    this.contexto = {};
    return { mensagem: msg, finalizado: true };
  }



  private async iniciarEdicao(): Promise<FlowResult> {
    const resultado = await getSupabase().listarTodosProjetos();

    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `📭 Nenhum projeto encontrado.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto.projetos = resultado.data;
    this.stepAtual = 'edit_escolher_projeto';

    let msg = `✏️ *Editar Projeto*\n\n`;
    msg += `Escolha o projeto:\n\n`;
    resultado.data.forEach((proj: any, idx: number) => {
      msg += `${idx + 1}️⃣ ${proj.codigo_projeto} - ${proj.cliente}\n`;
    });
    msg += `\n_Digite o número do projeto_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepEditEscolherProjeto(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;

    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.projetos?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.projetos?.length}`,
        finalizado: false,
      };
    }

    const projeto = this.contexto.projetos![escolha];
    this.contexto.edit_projeto_id = projeto.projeto_id;
    this.contexto.edit_codigo_projeto = projeto.codigo_projeto;

    // Buscar áreas (atribuições) do projeto
    const resultado = await getSupabase().buscarAreasDoProjeto(projeto.projeto_id);

    if (!resultado.success || !resultado.data || resultado.data.length === 0) {
      return {
        mensagem: `⚠️ Este projeto não possui áreas/atribuições para editar.\n\nUse a opção "2 - Distribuir projeto" para atribuir uma área primeiro.\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    // Sempre pedir a escolha da área — mesmo que haja só uma (mostra a opção única)
    this.contexto.areas = resultado.data;
    this.stepAtual = 'edit_escolher_area';

    let msg = `📦 *Áreas do Projeto ${projeto.codigo_projeto}:*\n\n`;
    resultado.data.forEach((area: any, idx: number) => {
      const engNome = area.engenheiro_nome ? ` (${area.engenheiro_nome})` : '';
      msg += `${idx + 1}️⃣ ${area.descricao}${engNome}\n`;
    });
    msg += `\n_Digite o número da área_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepEditEscolherArea(mensagem: string): Promise<FlowResult> {
    const escolha = parseInt(mensagem.trim()) - 1;

    if (isNaN(escolha) || escolha < 0 || escolha >= (this.contexto.areas?.length || 0)) {
      return {
        mensagem: `❌ Opção inválida. Digite um número entre 1 e ${this.contexto.areas?.length}`,
        finalizado: false,
      };
    }

    const area = this.contexto.areas![escolha];
    this.contexto.edit_atribuicao_id = area.atribuicao_id || area.id;
    this.contexto.edit_area_descricao = area.descricao;
    this.contexto.edit_eng_nome = area.engenheiro_nome;

    // Buscar dados completos
    const detalhes = await getSupabase().buscarAtribuicaoParaEdicao(this.contexto.edit_atribuicao_id!);
    if (detalhes.success && detalhes.data) {
      this.contexto.edit_dados_atuais = detalhes.data;
    } else {
      console.warn('⚠️ Dados atuais não carregados para edição:', detalhes.error);
    }

    this.stepAtual = 'edit_menu_categorias';
    const resultMenu = this.mostrarMenuCategorias();
    if (!this.contexto.edit_dados_atuais) {
      resultMenu.mensagem =
        `⚠️ _Não foi possível carregar os valores atuais. Os campos mostrarão "N/A"._\n\n` +
        resultMenu.mensagem;
    }
    return resultMenu;
  }

  private mostrarMenuCategorias(): FlowResult {
    let msg = `✏️ *Editar: ${this.contexto.edit_codigo_projeto}*\n`;
    msg += `📦 Área: ${this.contexto.edit_area_descricao}\n`;
    if (this.contexto.edit_eng_nome) {
      msg += `👷 Engenheiro: ${this.contexto.edit_eng_nome}\n`;
    }
    msg += `\nEscolha a categoria para editar:\n\n`;
    msg += `1️⃣ Dados do projeto (código, cliente, descrição)\n`;
    msg += `2️⃣ Datas e prazos\n`;
    msg += `3️⃣ Status e andamento\n`;
    msg += `4️⃣ Observações\n`;
    msg += `\n_Digite o número da categoria_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepEditMenuCategorias(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();
    const dados = this.contexto.edit_dados_atuais;

    switch (opcao) {
      case '1': {
        this.stepAtual = 'edit_menu_campos';
        let msg = `📋 *Dados do Projeto*\n\n`;
        msg += `Valores atuais:\n`;
        msg += `  • Código: ${dados?.codigo_projeto || this.contexto.edit_codigo_projeto}\n`;
        msg += `  • Cliente: ${dados?.cliente || 'N/A'}\n`;
        msg += `  • Descrição: ${dados?.descricao || 'N/A'}\n\n`;
        msg += `Qual campo deseja editar?\n\n`;
        msg += `a) Código do projeto\n`;
        msg += `b) Cliente\n`;
        msg += `c) Descrição\n\n`;
        msg += `_Digite a letra do campo_`;
        this.contexto.edit_campo = 'cat_projeto';
        return { mensagem: msg, finalizado: false };
      }

      case '2': {
        this.stepAtual = 'edit_menu_campos';
        let msg = `📅 *Datas e Prazos*\n\n`;
        msg += `Valores atuais:\n`;
        msg += `  • Data início: ${this.formatarData(dados?.data_inicio)}\n`;
        msg += `  • Data prevista: ${this.formatarData(dados?.data_prevista)}\n`;
        msg += `  • Prazo interno: ${this.formatarData(dados?.prazo_final_eng)}\n`;
        msg += `  • Prazo cliente: ${this.formatarData(dados?.prazo_final_cliente)}\n`;
        msg += `  • Início esperado cliente: ${this.formatarData(dados?.data_inicio_esperada_cliente)}\n\n`;
        msg += `Qual campo deseja editar?\n\n`;
        msg += `a) Data de início\n`;
        msg += `b) Data prevista de conclusão\n`;
        msg += `c) Prazo interno (engenheiro)\n`;
        msg += `d) Prazo do cliente\n`;
        msg += `e) Data início esperada pelo cliente\n\n`;
        msg += `_Digite a letra do campo_`;
        this.contexto.edit_campo = 'cat_datas';
        return { mensagem: msg, finalizado: false };
      }

      case '3': {
        this.stepAtual = 'edit_menu_campos';
        let msg = `📊 *Andamento*\n\n`;
        msg += `Valores atuais:\n`;
        msg += `  • Status: ${dados?.status_descricao || 'N/A'} _(derivado do andamento)_\n`;
        msg += `  • Andamento: ${dados?.percentual_andamento ?? 'N/A'}%\n\n`;
        msg += `O status é calculado automaticamente a partir do andamento ` +
               `(0% = Aguardando Início, 1–99% = Em Andamento, 100% = Concluído).\n\n`;
        msg += `a) Percentual de andamento (0 a 100)\n\n`;
        msg += `_Digite a letra do campo_`;
        this.contexto.edit_campo = 'cat_status';
        return { mensagem: msg, finalizado: false };
      }

      case '4': {
        let msg = `📝 *Observações*\n\n`;
        msg += `Valor atual: ${dados?.observacoes || '(sem observações)'}\n\n`;
        msg += `Digite as novas observações:\n`;
        msg += `(ou "limpar" para remover)\n\n`;
        msg += `_Digite o novo texto_`;
        this.contexto.edit_campo = 'observacoes';
        this.stepAtual = 'edit_digitar_valor';
        return { mensagem: msg, finalizado: false };
      }

      default:
        return {
          mensagem: `❌ Opção inválida.\n\nDigite:\n1️⃣ Dados do projeto\n2️⃣ Datas e prazos\n3️⃣ Status e andamento\n4️⃣ Observações`,
          finalizado: false,
        };
    }
  }

  private async stepEditMenuCampos(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.toLowerCase().trim();
    const categoria = this.contexto.edit_campo;

    this.stepAtual = 'edit_digitar_valor';

    if (categoria === 'cat_projeto') {
      switch (opcao) {
        case 'a':
          this.contexto.edit_campo = 'codigo_projeto';
          return {
            mensagem: `Digite o novo código do projeto:\n\n_Atual: ${this.contexto.edit_dados_atuais?.codigo_projeto || this.contexto.edit_codigo_projeto}_`,
            finalizado: false,
          };
        case 'b':
          this.contexto.edit_campo = 'cliente';
          return {
            mensagem: `Digite o novo nome do cliente:\n\n_Atual: ${this.contexto.edit_dados_atuais?.cliente || 'N/A'}_`,
            finalizado: false,
          };
        case 'c':
          this.contexto.edit_campo = 'descricao';
          return {
            mensagem: `Digite a nova descrição:\n\n_Atual: ${this.contexto.edit_dados_atuais?.descricao || 'N/A'}_`,
            finalizado: false,
          };
        default:
          this.stepAtual = 'edit_menu_campos';
          return { mensagem: `❌ Opção inválida. Digite a, b ou c`, finalizado: false };
      }
    }

    if (categoria === 'cat_datas') {
      const campoMap: Record<string, string> = {
        'a': 'data_inicio',
        'b': 'data_prevista',
        'c': 'prazo_final_eng',
        'd': 'prazo_final_cliente',
        'e': 'data_inicio_esperada_cliente',
      };

      const campo = campoMap[opcao];
      if (!campo) {
        this.stepAtual = 'edit_menu_campos';
        return { mensagem: `❌ Opção inválida. Digite a, b, c, d ou e`, finalizado: false };
      }

      this.contexto.edit_campo = campo;
      return {
        mensagem: `📅 Digite a nova data:\n\nFormato: DD/MM/AAAA\nOu "hoje" para data atual\n\n_Digite a data_`,
        finalizado: false,
      };
    }

    if (categoria === 'cat_status') {
      switch (opcao) {
        case 'a':
          this.contexto.edit_campo = 'percentual_andamento';
          return {
            mensagem: `📊 Digite o novo percentual de andamento:\n\n(0 a 100)\n\n_Atual: ${this.contexto.edit_dados_atuais?.percentual_andamento ?? 'N/A'}%_`,
            finalizado: false,
          };
        default:
          this.stepAtual = 'edit_menu_campos';
          return { mensagem: `❌ Opção inválida. Digite a`, finalizado: false };
      }
    }

    return { mensagem: `❌ Erro interno. Digite "menu" para recomeçar.`, finalizado: true };
  }

  private async stepEditDigitarValor(mensagem: string): Promise<FlowResult> {
    const input = mensagem.trim();
    const campo = this.contexto.edit_campo!;

    // Validação e parsing por tipo de campo
    if (campo === 'codigo_projeto') {
      const codigo = normalizeProjectCode(input);
      if (codigo.length < 3) {
        return { mensagem: `❌ Código muito curto. Mínimo 3 caracteres.`, finalizado: false };
      }
      this.contexto.edit_novo_valor = codigo;
    } else if (campo === 'cliente') {
      if (input.length < 2) {
        return { mensagem: `❌ Nome muito curto. Mínimo 2 caracteres.`, finalizado: false };
      }
      this.contexto.edit_novo_valor = input;
    } else if (campo === 'descricao') {
      if (input.length < 3) {
        return { mensagem: `❌ Descrição muito curta. Mínimo 3 caracteres.`, finalizado: false };
      }
      this.contexto.edit_novo_valor = input;
    } else if (campo === 'observacoes') {
      this.contexto.edit_novo_valor = input.toLowerCase() === 'limpar' ? '' : input;
    } else if (['data_inicio', 'data_prevista', 'prazo_final_eng', 'prazo_final_cliente', 'data_inicio_esperada_cliente'].includes(campo)) {
      const data = this.parsearData(input);
      if (!data) {
        return { mensagem: `❌ Formato inválido.\n\nUse: DD/MM/AAAA ou "hoje"`, finalizado: false };
      }
      this.contexto.edit_novo_valor = data;
    } else if (campo === 'percentual_andamento') {
      const valor = parseInt(input);
      if (isNaN(valor) || valor < 0 || valor > 100) {
        return { mensagem: `❌ Digite um número entre 0 e 100.`, finalizado: false };
      }
      this.contexto.edit_novo_valor = valor;
    } else {
      console.error(`❌ Campo desconhecido em stepEditDigitarValor: "${campo}"`);
      return {
        mensagem: `❌ Erro interno: campo desconhecido. Digite "menu" para recomeçar.`,
        finalizado: true,
      };
    }

    // Mostrar confirmação
    this.stepAtual = 'edit_confirmar';
    const nomeCampo = this.getNomeCampo(campo);
    const valorExibicao = this.getValorExibicao(campo, this.contexto.edit_novo_valor);

    let msg = `✅ *Confirmar Edição*\n\n`;
    msg += `📋 *Projeto:* ${this.contexto.edit_codigo_projeto}\n`;
    if (this.contexto.edit_area_descricao) {
      msg += `📦 *Área:* ${this.contexto.edit_area_descricao}\n`;
    }
    msg += `\n✏️ *Campo:* ${nomeCampo}\n`;
    msg += `📝 *Novo valor:* ${valorExibicao}\n\n`;
    msg += `1️⃣ Confirmar\n`;
    msg += `2️⃣ Cancelar\n\n`;
    msg += `_Digite 1 para confirmar ou 2 para cancelar_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepEditConfirmar(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.trim();

    if (opcao === '2') {
      this.contexto = {};
      return {
        mensagem: `❌ Edição cancelada.\n\n_Digite "menu" para voltar ao menu principal_`,
        finalizado: true,
      };
    }

    if (opcao !== '1') {
      return {
        mensagem: `❌ Opção inválida.\n\nDigite 1 para confirmar ou 2 para cancelar`,
        finalizado: false,
      };
    }

    const campo = this.contexto.edit_campo!.split('||')[0]; // Remove descrição do status se houver
    const valor = this.contexto.edit_novo_valor;
    const nomeCampo = this.getNomeCampo(this.contexto.edit_campo!); // Extrair antes de limpar contexto
    let resultado: { success: boolean; error?: string };

    // Campos da tabela projetos (master)
    if (['codigo_projeto', 'cliente', 'descricao'].includes(campo)) {
      resultado = await getSupabase().atualizarProjeto(
        this.contexto.edit_projeto_id!,
        { [campo]: valor }
      );
    }
    // Campos de prazos (tabela prazos)
    else if (['prazo_final_eng', 'prazo_final_cliente', 'data_inicio_esperada_cliente'].includes(campo)) {
      resultado = await getSupabase().atualizarPrazos(
        this.contexto.edit_atribuicao_id!,
        { [campo]: valor }
      );
    }
    // Andamento: grava na fonte única (projetos.percentual_ponderado).
    // O status e a data_conclusão derivam automaticamente via trigger no banco.
    else if (campo === 'percentual_andamento') {
      resultado = await getSupabase().atualizarProjeto(
        this.contexto.edit_projeto_id!,
        { percentual_ponderado: valor }
      );
    }
    // Demais campos da atribuição (engenheiros_projetos)
    else if (['data_inicio', 'data_prevista', 'observacoes'].includes(campo)) {
      resultado = await getSupabase().atualizarAtribuicaoDono(
        this.contexto.edit_atribuicao_id!,
        { [campo]: valor }
      );
    }
    else {
      resultado = { success: false, error: 'Campo desconhecido' };
    }

    if (!resultado.success) {
      return {
        mensagem: `❌ Erro ao salvar: ${resultado.error}\n\n_Digite "menu" para voltar_`,
        finalizado: true,
      };
    }

    this.contexto = {};
    return {
      mensagem: `✅ *${nomeCampo}* atualizado com sucesso!\n\n_Digite "menu" para voltar ao menu principal_`,
      finalizado: true,
    };
  }

  // =====================================================
  // UTILITÁRIOS DE EDIÇÃO
  // =====================================================

  private parsearData(input: string): string | null {
    const val = input.toLowerCase().trim();
    if (val === 'hoje') {
      return new Date().toISOString().split('T')[0];
    }

    const partes = val.split('/');
    if (partes.length !== 3) return null;

    const dia = parseInt(partes[0]);
    const mes = parseInt(partes[1]);
    const ano = parseInt(partes[2]);

    if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;

    // Checar se a data realmente existe (ex: rejeita 30/02, 31/04)
    const d = new Date(ano, mes - 1, dia);
    if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) {
      return null;
    }

    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }

  private formatarData(data?: string): string {
    if (!data) return 'N/A';
    try {
      const partes = data.split('-');
      if (partes.length !== 3) return data;
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    } catch {
      return data;
    }
  }

  private getNomeCampo(campo: string): string {
    const nomes: Record<string, string> = {
      'codigo_projeto': 'Código do projeto',
      'cliente': 'Cliente',
      'descricao': 'Descrição',
      'data_inicio': 'Data de início',
      'data_prevista': 'Data prevista',
      'prazo_final_eng': 'Prazo interno (engenheiro)',
      'prazo_final_cliente': 'Prazo do cliente',
      'data_inicio_esperada_cliente': 'Data início esperada pelo cliente',
      'status_id': 'Status',
      'percentual_andamento': 'Percentual de andamento',
      'observacoes': 'Observações',
    };
    // Handle status_id||descricao format
    const campoBase = campo.split('||')[0];
    return nomes[campoBase] || campo;
  }

  private getValorExibicao(campo: string, valor: any): string {
    const campoBase = campo.split('||')[0];
    if (['data_inicio', 'data_prevista', 'prazo_final_eng', 'prazo_final_cliente', 'data_inicio_esperada_cliente'].includes(campoBase)) {
      return this.formatarData(valor);
    }
    if (campoBase === 'status_id') {
      // Use a descrição guardada no campo
      const descricao = campo.split('||')[1];
      return descricao || `ID ${valor}`;
    }
    if (campoBase === 'percentual_andamento') {
      return `${valor}%`;
    }
    if (campoBase === 'observacoes' && valor === '') {
      return '(limpo)';
    }
    return String(valor);
  }

  // =====================================================
  // GERENCIAR ENGENHEIROS (Feature 1)
  // =====================================================

  private async stepEngMenu(mensagem: string): Promise<FlowResult> {
    const res = await getSupabase().listarEngenheiros();
    const engenheiros = res.data || [];
    this.contexto.engenheiros = engenheiros;

    let lista = `👨‍💻 *Gerenciar Engenheiros*\n\n`;
    if (engenheiros.length === 0) {
      lista += `_(Nenhum engenheiro cadastrado)_\n`;
    } else {
      engenheiros.forEach((e: any, i: number) => {
        lista += `${i + 1}. ${e.nome} ${e.telefone ? '(' + e.telefone + ')' : ''}\n`;
      });
    }

    lista += `\nO que deseja fazer?\n`;
    lista += `a) Criar Engenheiro\n`;
    if (engenheiros.length > 0) {
      lista += `b) Editar Engenheiro\n`;
      lista += `c) Excluir Engenheiro\n`;
    }
    lista += `d) Voltar\n\n`;
    lista += `_Digite a letra desejada_`;

    this.stepAtual = 'eng_menu_escolha';
    return { mensagem: lista, finalizado: false };
  }

  private async stepEngMenuEscolha(mensagem: string): Promise<FlowResult> {
    const opcao = mensagem.toLowerCase().trim();
    const temEngenheiros = (this.contexto.engenheiros || []).length > 0;

    if (opcao === 'a') {
      this.stepAtual = 'eng_criar_nome';
      return { mensagem: `Qual o *NOME COMPLETO* do engenheiro?`, finalizado: false };
    }
    if (opcao === 'b' && temEngenheiros) {
      this.stepAtual = 'eng_editar_selecionar';
      return { mensagem: `Digite o *NÚMERO* do engenheiro que deseja editar:`, finalizado: false };
    }
    if (opcao === 'c' && temEngenheiros) {
      this.stepAtual = 'eng_excluir_selecionar';
      return { mensagem: `Digite o *NÚMERO* do engenheiro que deseja excluir (desativar):`, finalizado: false };
    }
    if (opcao === 'd') {
      return this.stepInicio('');
    }

    return { mensagem: `❌ Opção inválida. Digite a, ${temEngenheiros ? 'b, c, ' : ''}ou d.`, finalizado: false };
  }

  private async stepEngCriarNome(mensagem: string): Promise<FlowResult> {
    const nome = mensagem.trim();
    if (nome.length < 3) {
      return { mensagem: `❌ Nome muito curto. Mínimo 3 caracteres.`, finalizado: false };
    }
    this.contexto.eng_nome_novo = nome;
    this.stepAtual = 'eng_criar_telefone';
    return { mensagem: `Qual o *WHATSAPP (Telefone)* do engenheiro (ex: 11999999999)?`, finalizado: false };
  }

  private async stepEngCriarTelefone(mensagem: string): Promise<FlowResult> {
    const res = validateWhatsapp(mensagem);
    if (!res.valido) {
      return { mensagem: `❌ Telefone inválido. ${res.erros.join(', ')}\n\nDigite novamente:`, finalizado: false };
    }
    this.contexto.eng_telefone_novo = res.dados_normalizados;
    
    const criador = getSupabase();
    // criarOuBuscarEngenheiro(whatsapp, nome) — verificar se já existe
    const eng = await criador.criarOuBuscarEngenheiro(this.contexto.eng_telefone_novo!, this.contexto.eng_nome_novo!);
    
    if (!eng) {
      return { mensagem: `❌ Erro ao cadastrar engenheiro. Tente novamente.\n\n_Digite "menu" para voltar._`, finalizado: true };
    }

    // Se retornou engenheiro com nome diferente do que digitamos, é porque já existia
    if (eng.nome !== this.contexto.eng_nome_novo) {
      return { mensagem: `⚠️ Já existe um engenheiro com esse telefone: *${eng.nome}*\n\n_Digite "menu" para voltar._`, finalizado: true };
    }
    
    return { mensagem: `✅ Engenheiro *${this.contexto.eng_nome_novo}* cadastrado com sucesso!\n\n_Digite "menu" para voltar._`, finalizado: true };
  }

  private async stepEngEditarSelecionar(mensagem: string): Promise<FlowResult> {
    const i = parseInt(mensagem.trim()) - 1;
    const lista = this.contexto.engenheiros || [];
    if (isNaN(i) || !lista[i]) {
      return { mensagem: `❌ Engenheiro inválido. Digite um número da lista:`, finalizado: false };
    }
    this.contexto.viz_eng_id = lista[i].eng_id;
    this.contexto.eng_nome_novo = lista[i].nome;
    
    this.stepAtual = 'eng_editar_campo';
    return { 
      mensagem: `Editando: *${lista[i].nome}*\nO que deseja editar?\n1. Nome\n2. Telefone`, 
      finalizado: false 
    };
  }

  private async stepEngEditarCampo(mensagem: string): Promise<FlowResult> {
    const op = mensagem.trim();
    if (op === '1') this.contexto.eng_campo_edit = 'nome';
    else if (op === '2') this.contexto.eng_campo_edit = 'telefone';
    else return { mensagem: `❌ Opção inválida. (1 = Nome, 2 = Telefone)`, finalizado: false };

    this.stepAtual = 'eng_editar_valor';
    return { mensagem: `Ok, digite o novo valor para *${this.contexto.eng_campo_edit}*:`, finalizado: false };
  }

  private async stepEngEditarValor(mensagem: string): Promise<FlowResult> {
    let val = mensagem.trim();
    if (this.contexto.eng_campo_edit === 'telefone') {
      const r = validateWhatsapp(val);
      if (!r.valido) return { mensagem: `❌ Telefone inválido. ${r.erros.join(', ')}`, finalizado: false };
      val = r.dados_normalizados;
    }
    this.contexto.edit_novo_valor = val;
    this.stepAtual = 'eng_editar_confirmar';
    return { mensagem: `Confirma alterar ${this.contexto.eng_campo_edit} para *${val}*?\n1. Sim\n2. Não`, finalizado: false };
  }

  private async stepEngEditarConfirmar(mensagem: string): Promise<FlowResult> {
    if (mensagem.trim() === '1') {
      const payload: any = {};
      payload[this.contexto.eng_campo_edit!] = this.contexto.edit_novo_valor;
      // O resultado era ignorado: telefone repetido (UNIQUE) ou banco fora respondiam "Atualizado".
      const res = await getSupabase().atualizarEngenheiro(this.contexto.viz_eng_id!, payload);
      if (!res.success) {
        if (/duplicate key|unique/i.test(res.error ?? '')) {
          return { mensagem: `❌ Esse telefone já está cadastrado para outro engenheiro. Nada foi alterado.\n\n_Digite "menu" para voltar._`, finalizado: true };
        }
        return { mensagem: `❌ Não consegui atualizar agora. Nada foi alterado — tente de novo em alguns minutos.\n\n_Digite "menu" para voltar._`, finalizado: true };
      }
      return { mensagem: `✅ Atualizado com sucesso!\n\n_Digite "menu" para voltar._`, finalizado: true };
    }
    return { mensagem: `❌ Cancelado.\n\n_Digite "menu" para voltar._`, finalizado: true };
  }

  private async stepEngExcluirSelecionar(mensagem: string): Promise<FlowResult> {
    const i = parseInt(mensagem.trim()) - 1;
    const lista = this.contexto.engenheiros || [];
    if (isNaN(i) || !lista[i]) {
      return { mensagem: `❌ Engenheiro inválido. Digite um número da lista:`, finalizado: false };
    }
    this.contexto.viz_eng_id = lista[i].eng_id;
    this.contexto.eng_nome_novo = lista[i].nome;
    
    this.stepAtual = 'eng_excluir_confirmar';
    return { mensagem: `⚠️ Você tem certeza que deseja remover o engenheiro *${lista[i].nome}*?\n1. Sim\n2. Não`, finalizado: false };
  }

  private async stepEngExcluirConfirmar(mensagem: string): Promise<FlowResult> {
    if (mensagem.trim() === '1') {
      const res = await getSupabase().desativarEngenheiro(this.contexto.viz_eng_id!);
      if (!res.success) {
        if (res.error === 'engenheiro_com_projetos') {
          return { mensagem: `❌ Este engenheiro possui projetos ativos! Retire-o dos projetos antes de excluí-lo.\n\n_Digite "menu" para voltar._`, finalizado: true };
        }
        if (res.error === 'nao_foi_possivel_verificar') {
          return { mensagem: `❌ Não consegui verificar se ele tem projetos ativos, então nada foi removido. Tente de novo em alguns minutos.\n\n_Digite "menu" para voltar._`, finalizado: true };
        }
        // Sem repassar o texto cru do banco para o WhatsApp.
        return { mensagem: `❌ Não consegui remover agora. Tente de novo em alguns minutos.\n\n_Digite "menu" para voltar._`, finalizado: true };
      }
      return { mensagem: `✅ Engenheiro excluído.\n\n_Digite "menu" para voltar._`, finalizado: true };
    }
    return { mensagem: `❌ Cancelado.\n\n_Digite "menu" para voltar._`, finalizado: true };
  }

  // =====================================================
  // EXCLUSÃO UNIFICADA (Feature 4)
  // =====================================================

  private async iniciarExclusaoUnificada(): Promise<FlowResult> {
    const res = await getSupabase().listarTodosProjetos();
    const infoProjetos = res.data || [];
    if (infoProjetos.length === 0) {
      return {
        mensagem: `❌ Não há projetos ativos para excluir.\n\n_Digite "menu" para voltar._`,
        finalizado: true,
      };
    }
    this.contexto.projetos = infoProjetos;
    this.stepAtual = 'excluir_selecionar_projeto';
    
    let listaProjetos = `🗑️ *Fluxo de Exclusão*\n\nDe qual projeto você quer excluir algo?\n\n`;
    infoProjetos.forEach((p: any, i: number) => {
      listaProjetos += `${i + 1}. [${p.codigo_projeto}] ${p.cliente}\n`;
    });
    
    return { mensagem: listaProjetos, finalizado: false };
  }

  private async stepExcluirSelecionarProjeto(mensagem: string): Promise<FlowResult> {
    const i = parseInt(mensagem.trim()) - 1;
    const p = this.contexto.projetos?.[i];
    if (!p) return { mensagem: `❌ Opção inválida.`, finalizado: false };
    
    this.contexto.del_projeto_id = p.projeto_id;
    this.contexto.del_codigo_projeto = p.codigo_projeto;
    
    this.stepAtual = 'excluir_acao';
    return {
      mensagem: `Opções para o projeto *${p.codigo_projeto}*:\n\n` +
                `1. ⚠️ Excluir Projeto Completo\n` +
                `2. 🎯 Excluir uma Área Específica\n` +
                `3. Cancelar`,
      finalizado: false
    };
  }

  private async stepExcluirAcao(mensagem: string): Promise<FlowResult> {
    const op = mensagem.trim();
    if (op === '1') {
      this.stepAtual = 'excluir_projeto_confirmar';
      return { mensagem: `Tem certeza que deseja desativar COMPLETAMENTE o projeto *${this.contexto.del_codigo_projeto}*?\n1. Sim\n2. Não`, finalizado: false };
    } else if (op === '2') {
      const areas = await getSupabase().buscarAreasDoProjeto(this.contexto.del_projeto_id!);
      if (!areas.success || !areas.data || areas.data.length === 0) {
        return { mensagem: `❌ Não há áreas para excluir neste projeto.\n\n_Digite "menu"_`, finalizado: true };
      }
      this.contexto.areas = areas.data;
      this.stepAtual = 'area_excluir_selecionar';
      
      let res = `Qual área você deseja remover?\n\n`;
      areas.data.forEach((a: any, idx: number) => {
         res += `${idx + 1}. ${a.descricao} (${a.engenheiro_nome || 'Sem Eng.'})\n`;
      });
      return { mensagem: res, finalizado: false };
    } else {
      return { mensagem: `❌ Operação cancelada.\n\n_Digite "menu"_`, finalizado: true };
    }
  }

  private async stepExcluirProjetoConfirmar(mensagem: string): Promise<FlowResult> {
    if (mensagem.trim() === '1') {
      const r = await getSupabase().desativarProjeto(this.contexto.del_projeto_id!);
      if (r.success) {
        return { mensagem: `✅ Projeto desativado com sucesso.\n\n_Digite "menu"_`, finalizado: true };
      }
      return { mensagem: `❌ Erro ao desativar projeto: ${r.error || 'Erro desconhecido'}\n\n_Digite "menu"_`, finalizado: true };
    }
    return { mensagem: `❌ Cancelado.\n\n_Digite "menu"_`, finalizado: true };
  }

  private async stepAreaExcluirSelecionar(mensagem: string): Promise<FlowResult> {
    const i = parseInt(mensagem.trim()) - 1;
    const a = this.contexto.areas?.[i];
    if (!a) return { mensagem: `❌ Inválido.`, finalizado: false };
    
    this.contexto.viz_atribuicao_id = a.atribuicao_id;
    this.contexto.edit_area_descricao = a.descricao;
    
    this.stepAtual = 'area_excluir_confirmar';
    return { mensagem: `Confirma exclusão da área *${a.descricao}*?\n1. Sim\n2. Não`, finalizado: false };
  }

  private async stepAreaExcluirConfirmar(mensagem: string): Promise<FlowResult> {
    if (mensagem.trim() === '1') {
      const qtd = await getSupabase().contarAreasAtivasDoProjeto(this.contexto.del_projeto_id!);
      if (qtd <= 1) {
        return { mensagem: `❌ Um projeto deve ter no mínimo uma área ativa! Você não pode excluir a última área. Se não existe mais o projeto, exclua o *Projeto Completo*.\n\n_Digite "menu"_`, finalizado: true };
      }
      
      const res = await getSupabase().desativarAtribuicao(this.contexto.viz_atribuicao_id!);
      if (res.success) {
        return { mensagem: `✅ Área removida com sucesso.\n\n_Digite "menu"_`, finalizado: true };
      }
      return { mensagem: `❌ Erro ao remover área: ${res.error || 'Erro desconhecido'}\n\n_Digite "menu"_`, finalizado: true };
    }
    return { mensagem: `❌ Cancelado.\n\n_Digite "menu"_`, finalizado: true };
  }

  // =====================================================
  // TRANSFERIR TAREFA ENTRE ENGENHEIROS
  // =====================================================

  private async iniciarTransferencia(): Promise<FlowResult> {
    const resultado = await getSupabase().listarEngenheiros();
    if (!resultado.success || !resultado.data?.length) {
      return { mensagem: '❌ Nenhum engenheiro cadastrado.', finalizado: true };
    }

    this.contexto.engenheiros = resultado.data;
    this.stepAtual = 'transf_escolher_eng_origem';

    let msg = `🔄 *Transferir Tarefa*\n\n`;
    msg += `Escolha o engenheiro que possui a tarefa:\n\n`;
    resultado.data.forEach((eng: any, i: number) => {
      msg += `${i + 1}️⃣ ${eng.nome}\n`;
    });
    msg += `\n_Digite o número do engenheiro_`;

    return { mensagem: msg, finalizado: false };
  }

  private async stepTransfEscolherEngOrigem(msg: string): Promise<FlowResult> {
    const escolha = parseInt(msg.trim()) - 1;
    const engenheiros = this.contexto.engenheiros || [];

    if (isNaN(escolha) || escolha < 0 || escolha >= engenheiros.length) {
      return { mensagem: `❌ Opção inválida. Digite um número entre 1 e ${engenheiros.length}.`, finalizado: false };
    }

    const engOrigem = engenheiros[escolha];
    this.contexto.transf_eng_origem_id = engOrigem.eng_id;
    this.contexto.transf_eng_origem_nome = engOrigem.nome;

    // Buscar atribuições do engenheiro (OuFalha: erro nao pode virar "nao tem tarefas")
    const atribuicoes = await getSupabase().listarAtribuicoesEngenheiroOuFalha(engOrigem.eng_id);

    if (atribuicoes.length === 0) {
      return { mensagem: `❌ ${engOrigem.nome} não tem tarefas atribuídas.\n\n_Digite "menu"_`, finalizado: true };
    }

    // Enriquecer com dados de projeto e área (e filtrar 100% concluídas)
    const atribsEnriquecidas = [];
    for (const atrib of atribuicoes) {
      const projeto = await getSupabase().buscarProjetoPorId(atrib.projeto_id);
      const area = await getSupabase().buscarAreaPorId(atrib.area_id);
      // Pular as 100% concluidas. Mesma regra do fluxo do engenheiro e do dashboard: o
      // percentual ponderado. A regra antiga olhava so os pavimentos e escondia atribuicoes
      // com todos os pavimentos prontos e etapas globais pendentes.
      const pct = await getSupabase().buscarProgressoAreaOuFalha(atrib.projeto_id, String(atrib.area_id), atrib.id);
      if (!isPercentualPendente(pct)) continue;
      atribsEnriquecidas.push({
        ...atrib,
        codigo_projeto: projeto?.codigo_projeto || '?',
        cliente: projeto?.cliente || '',
        descricao: projeto?.descricao || '',
        area_codigo: area?.codigo || '',
        area_descricao: area?.descricao || '?',
        instancia_label: (atrib as any).instancia_label || null,
      });
    }

    if (atribsEnriquecidas.length === 0) {
      return { mensagem: `🎉 ${engOrigem.nome} não tem tarefas pendentes para transferir.\n\n_Digite "menu"_`, finalizado: true };
    }

    this.contexto.transf_atribuicoes = atribsEnriquecidas;
    this.stepAtual = 'transf_escolher_atribuicao';

    let mensagem = `📋 Tarefas de *${engOrigem.nome}*:\n\n`;
    atribsEnriquecidas.forEach((atrib: any, i: number) => {
      mensagem += `${i + 1}️⃣ *${formatProjetoDisciplinaLinha(atrib)}*\n\n`;
    });
    mensagem += `_Digite o número da tarefa para transferir_`;

    return { mensagem, finalizado: false };
  }

  private async stepTransfEscolherAtribuicao(msg: string): Promise<FlowResult> {
    const escolha = parseInt(msg.trim()) - 1;
    const atribuicoes = this.contexto.transf_atribuicoes || [];

    if (isNaN(escolha) || escolha < 0 || escolha >= atribuicoes.length) {
      return { mensagem: `❌ Opção inválida. Digite um número entre 1 e ${atribuicoes.length}.`, finalizado: false };
    }

    const atrib = atribuicoes[escolha];
    this.contexto.transf_atribuicao_id = atrib.id;
    this.contexto.transf_atribuicao_desc = formatProjetoDisciplinaLinha(atrib);

    // Listar engenheiros destino (excluindo o de origem)
    const resultado = await getSupabase().listarEngenheiros();
    const engDestinos = (resultado.data || []).filter((eng: any) => eng.eng_id !== this.contexto.transf_eng_origem_id);

    if (engDestinos.length === 0) {
      return { mensagem: `❌ Não há outros engenheiros para transferir.\n\n_Digite "menu"_`, finalizado: true };
    }

    this.contexto.engenheiros = engDestinos;
    this.stepAtual = 'transf_escolher_eng_destino';

    let mensagem = `👷 Escolha o engenheiro destino:\n\n`;
    engDestinos.forEach((eng: any, i: number) => {
      mensagem += `${i + 1}️⃣ ${eng.nome}\n`;
    });
    mensagem += `\n_Digite o número do engenheiro_`;

    return { mensagem, finalizado: false };
  }

  private async stepTransfEscolherEngDestino(msg: string): Promise<FlowResult> {
    const escolha = parseInt(msg.trim()) - 1;
    const engenheiros = this.contexto.engenheiros || [];

    if (isNaN(escolha) || escolha < 0 || escolha >= engenheiros.length) {
      return { mensagem: `❌ Opção inválida. Digite um número entre 1 e ${engenheiros.length}.`, finalizado: false };
    }

    const engDestino = engenheiros[escolha];
    this.contexto.transf_eng_destino_id = engDestino.eng_id;
    this.contexto.transf_eng_destino_nome = engDestino.nome;

    this.stepAtual = 'transf_confirmar';

    return {
      mensagem: `🔄 *Confirmar Transferência*\n\n` +
                `📋 Tarefa: *${this.contexto.transf_atribuicao_desc}*\n` +
                `👷 De: *${this.contexto.transf_eng_origem_nome}*\n` +
                `👷 Para: *${this.contexto.transf_eng_destino_nome}*\n\n` +
                `1️⃣ Confirmar\n` +
                `2️⃣ Cancelar`,
      finalizado: false,
    };
  }

  private async stepTransfConfirmar(msg: string): Promise<FlowResult> {
    const opcao = msg.trim();

    if (opcao === '1') {
      const resultado = await getSupabase().transferirAtribuicao(
        this.contexto.transf_atribuicao_id!,
        this.contexto.transf_eng_destino_id!
      );

      if (resultado.success) {
        return {
          mensagem: `✅ Tarefa transferida com sucesso!\n\n` +
                    `*${this.contexto.transf_atribuicao_desc}*\n` +
                    `${this.contexto.transf_eng_origem_nome} → ${this.contexto.transf_eng_destino_nome}\n\n` +
                    `_Digite "menu" para voltar_`,
          finalizado: true,
        };
      }

      return {
        mensagem: `❌ Erro ao transferir: ${resultado.error}\n\n_Digite "menu"_`,
        finalizado: true,
      };
    }

    if (opcao === '2') {
      return { mensagem: `❌ Transferência cancelada.\n\n_Digite "menu"_`, finalizado: true };
    }

    return { mensagem: `❌ Opção inválida. Digite *1* para confirmar ou *2* para cancelar.`, finalizado: false };
  }
}
