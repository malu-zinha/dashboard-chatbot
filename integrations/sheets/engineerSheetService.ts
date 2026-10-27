import { getGoogleSheetsService } from './googleSheetsService.ts';

// =====================================================
// INTERFACES E TIPOS
// =====================================================

export interface ProjectData {
  'Código do Projeto'?: string;
  'Cliente'?: string;
  'Contato'?: string;
  'Obra'?: string;
  'Área'?: string;
  'Eng. Responsável'?: string;
  'Tipo de Projeto'?: string;
  'Descrição do projeto'?: string;
  'Complexidade'?: string;
  'Dias estimados (interno)'?: string;
  'Data de Início'?: string;
  'Data de Previsão de entrega (interna)'?: string;
  'Data Final (acordado com o cliente)'?: string;
  'Prazo Interno (dias úteis)'?: string;
  'Prazo Cliente (dias úteis)'?: string;
  'Dias de atraso'?: string;
  'Status do projeto'?: string;
  'Previsão para o dia'?: string;
  'Feito ao final do dia'?: string;
  'Necessitou de retrabalho?'?: string;
  'motivo da revisão'?: string;
  'Data do registro do retrabalho'?: string;
  'Etapa'?: string;
  '% executado'?: string;
  'Observações'?: string;
  'Métrica de retrabalho'?: string;
  'Dias estimados (dias úteis)'?: string;
  'Data de entrega real'?: string;
  'Lead Time (dias úteis)'?: string;
  'Dias Parado cliente (dias úteis)'?: string;
  'Dias parado TecPred (dias úteis)'?: string;
}

export interface DailyExecutionData {
  'Status do projeto': string;
  'Previsão para o dia': string;
  'Feito ao final do dia': string;
  'Necessitou de retrabalho?': string;
  'motivo da revisão'?: string;
  'Data do registro do retrabalho'?: string;
  'Etapa': string;
}

export interface MorningUpdateData {
  'Status do projeto': string;
  'Previsão para o dia': string;
}

export interface NightUpdateData {
  'Feito ao final do dia': string;
  'Necessitou de retrabalho?': string;
  'motivo da revisão'?: string;
  'Data do registro do retrabalho'?: string;
  'Etapa': string;
  'Observações'?: string;
}

export interface ReworkData {
  motivo: string;
  data: string;
}

export interface Project {
  codigo: string;
  cliente: string;
  obra: string;
  area: string;
  tipo: string;
  descricao: string;
  status: string;
  etapa: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// =====================================================
// CONSTANTES
// =====================================================

// TIPOS_PROJETO - expandido de 9 para 24 opções
export const TIPOS_PROJETO = [
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'E1', 'E2', 'E3', 'E4',
  'T1', 'T2', 'T3', 'T4',
  'G1', 'G2', 'G3', 'G4',
  'CL1', 'CL2', 'CL3', 'CL4'
];

// AREAS_PROJETO - expandido de 3 para 24 opções
export const AREAS_PROJETO = [
  'administrativo',
  'climatização',
  'elétrica',
  'energisa',
  'hidrossanitário',
  'telecom',
  'gás',
  'drenagem',
  'rede de água',
  'furação e encamisamento',
  'esgoto',
  'cant de obra DRT',
  'cant de obra energisa',
  'subestação',
  'rede de esgoto',
  'rede de drenagem',
  'rede elétrica subterrânea',
  'rede elétrica aérea',
  'exaustão',
  'solar fotovoltaico',
  'hidrossanitário piscina',
  'solução sanitária',
  'cálculo de áreas',
  'estação elevatória de esgoto'
];

// TIPOS_OBRA - nova constante
export const TIPOS_OBRA = [
  'casa',
  'prédio',
  'comercial',
  'misto'
];

// STATUS_PROJETO - atualizado com novos status
export const STATUS_PROJETO = [
  'em planejamento',
  'aguardando início',
  'aguardando inf. cliente',
  'em execução',
  'em aprovação',
  'parado cliente',
  'parado tecpred',
  'concluído'
];

export const MOTIVOS_REVISAO = [
  'erro interno',
  'falta de informação do cliente',
  'mudança de escopo devido cliente',
  'mudança de escopo devido TecPred',
  'adequação à concessionária',
  'atraso de documentação'
];

export const ETAPAS_PROJETO = [
  'Aguardando início',
  'Recebimento da documentação',
  'Serviços Preliminares e Infraestrutura',
  'Instalações de Primeira Fase (Grosso)',
  'Detalhamento e instalações',
  'Instalações de Segunda Fase (Acabamento)',
  'Revisão interna',
  'Enviado ao cliente',
  'Aprovado cliente/concessionária',
  'Concluído'
];

// PERCENTUAIS_POR_ETAPA - novo mapeamento
export const PERCENTUAIS_POR_ETAPA: Record<string, number> = {
  'Aguardando início': 0,
  'Recebimento da documentação': 5,
  'Serviços Preliminares e Infraestrutura': 20,
  'Instalações de Primeira Fase (Grosso)': 35,
  'Detalhamento e instalações': 55,
  'Instalações de Segunda Fase (Acabamento)': 70,
  'Revisão interna': 75,
  'Enviado ao cliente': 80,
  'Aprovado cliente/concessionária': 90,
  'Concluído': 100
};

// DESCRICOES_POR_TIPO - mapeamento completo de descrições automáticas
export const DESCRICOES_POR_TIPO: Record<string, string> = {
  'H1': 'H - CASA PADRÃO: TÉRREO E PAV. SUPERIOR',
  'H2': 'H - CASA PADRÃO: SUBSOLO, TERREO E PAV. SUPERIOR',
  'H3': 'H - PRÉDIO PADRÃO: TÉRREO, 1° PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS',
  'H4': 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, 1° PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS',
  'H5': 'H - PRÉDIO PADRÃO: SUBSOLO, TÉRREO, MEZANINO, 1° PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS',
  'H6': 'H - PRÉDIO PADRÃO: SUBSOLO 01, SUBSOLO 02, TÉRREO, MEZANINO, 1º PAV, PAV TIPO, COBERTURA, COBERTA, RESERVATÓRIOS',
  'E1': 'E - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR',
  'E2': 'E - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO',
  'E3': 'E - PRÉDIO (MODELO ATLANTIS NEW): SEMISSUBSOLO, TÉRREO, 1° PAV, PAV TIPO, COBERTURA, CORTE ESQUEMATICO, ENERGISA',
  'E4': 'E - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA',
  'T1': 'T - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR',
  'T2': 'T - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO',
  'T3': 'T - PRÉDIO (MODELO ATLANTIS NEW): SEMISSUBSOLO, TÉRREO, 1º PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA',
  'T4': 'T - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA',
  'G1': 'G - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR',
  'G2': 'G - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO',
  'G3': 'G - PRÉDIO (MODELO ATLANTIS NEW): SEMISSUBSOLO, TÉRREO, 1° PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA',
  'G4': 'G - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMATICO, ENERGISA',
  'CL1': 'CL - CASA PADRÃO (MODELO SETAI): TÉRREO E PAV. SUPERIOR',
  'CL2': 'CL - CASA PADRÃO (MODELO ÉDREI): SUBSOLO E TÉRREO',
  'CL3': 'CL - PRÉDIO (MODELO ATLANTIS NEW): SEMISSUBSOLO, TÉRREO, 1° PAV, PAV TIPO, COBERTURA, CORTE ESQUEMÁTICO, ENERGISA',
  'CL4': 'CL - PRÉDIO (MODELO ALLIANCE ESSENCE): SUBSOLO-03, SUBSOLO-02, SUBSOLO-01, TÉRREO, SOBRESSOLO, PAV. LAZER, PAV TIPO A,B, PAV. TIPO C,D, ROOFTOP, CORTE ESQUEMÁTICO, ENERGISA'
};

// PREVISAO_DIA_POR_STATUS - menus dinâmicos de previsão conforme status
export const PREVISAO_DIA_POR_STATUS: Record<string, string[]> = {
  'em planejamento': [
    'Definir escopo detalhado do projeto',
    'Alinhar expectativas com o cliente',
    'Mapear riscos e dependências',
    'Estimar recursos necessários',
    'Preparar cronograma inicial',
    'Validar requisitos técnicos com a equipe'
  ],
  'aguardando início': [
    'Revisar documentação enviada pelo cliente',
    'Solicitar planta baixa/arquitetônico',
    'Checar compatibilização com disciplinas',
    'Preparar checklist de requisitos técnicos',
    'Confirmar briefing com o cliente',
    'Organizar arquivos e criar pasta do projeto'
  ],
  'em execução': [
    'Realizar pré-dimensionamento',
    'Realizar traçado preliminar',
    'Dimensionar ramais principais',
    'Dimensionar quadros/painéis/coletores',
    'Executar levantamento de cargas',
    'Gerar prancha de lançamento',
    'Realizar detalhamento final',
    'Conferir normas e requisitos',
    'Completar 50% do detalhamento',
    'Finalizar circuito/ramal X',
    'Ajustar compatibilização com área elétrica/hidráulica',
    'Preparar material para revisão interna',
    'Revisar desvios encontrados no projeto'
  ],
  'em aprovação': [
    'Enviar projeto revisado ao cliente',
    'Responder observações pendentes do cliente',
    'Realizar pequenas correções antes do envio',
    'Registrar pendências do cliente para controle',
    'Acompanhar retorno do cliente até 17h'
  ],
  'parado cliente': [
    'Cobrar documentação pendente',
    'Atualizar planilha com pendências do cliente',
    'Enviar e-mail formal de solicitação de informações',
    'Preparar relatório de pendências técnicas',
    'Aguardar retorno da revisão do cliente'
  ],
  'parado tecpred': [
    'Aguardar decisão interna',
    'Aguardar OK do Engenheiro Chefe',
    'Atualizar documentos e diagramas internos',
    'Preparar justificativa técnica para decisão',
    'Registrar motivo da pausa'
  ],
  'concluído': [
    'Enviar arquivos finais',
    'Organizar arquivos para arquivamento',
    'Gerar versão final das pranchas',
    'Subir documentação pro portal'
  ],
  'aguardando inf. cliente': [] // redirecionar para 'parado cliente'
};

// FEITO_DIA_POR_STATUS - menus dinâmicos de feito conforme status
export const FEITO_DIA_POR_STATUS: Record<string, string[]> = {
  'em planejamento': [
    'Análise inicial do escopo',
    'Reunião de kickoff realizada',
    'Cronograma preliminar criado',
    'Documentação inicial organizada',
    'Levantamento de requisitos técnicos',
    'Definição de equipe e recursos'
  ],
  'aguardando início': [
    'Checklist inicial concluído',
    'Documentação solicitada ao cliente',
    'Arquitetônico recebido e validado',
    'Pasta do projeto criada e organizada'
  ],
  'em execução': [
    'Pré-dimensionamento finalizado',
    'Traçado preliminar concluído',
    'Dimensionamento dos ramais principais concluído',
    'Prancha X finalizada',
    'Revisão interna submetida',
    'Compatibilização concluída',
    'Detalhamento 70% executado',
    'Cálculo de carga concluído',
    'Revisões internas aplicadas'
  ],
  'em aprovação': [
    'Ajustes solicitados pelo cliente aplicados',
    'Projeto reenviado para análise',
    'Correções menores concluídas',
    'Checklist de revisão preenchido'
  ],
  'parado cliente': [
    'E-mail de cobrança enviado',
    'Contato telefônico realizado',
    'Aguardando envio de plantas corrigidas',
    'Cliente confirmou retorno para amanhã'
  ],
  'parado tecpred': [
    'Aguardando validação do Engenheiro Chefe',
    'Projeto revisado internamente, aguardando decisão',
    'Pauta da reunião interna organizada'
  ],
  'concluído': [
    'Arquivos enviados ao cliente',
    'Projeto arquivado',
    'Checklist final concluído'
  ],
  'aguardando inf. cliente': [] // redirecionar para 'parado cliente'
};

// =====================================================
// CLASSE: EngineerSheetService
// =====================================================

export class EngineerSheetService {
  private spreadsheetId: string;
  private sheetName: string;
  private range: string;
  private sheetsService;

  constructor(spreadsheetId: string, sheetName: string = 'Engenheiro(a)', range: string = 'A1:AE1000') {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.range = range;
    this.sheetsService = getGoogleSheetsService();
  }

  /**
   * Calcula o range de headers baseado no range de dados
   * Ex: "A3:AE1000" -> "A2:AE2"
   */
  private getHeaderRange(): string {
    // Extrair o número da linha inicial do range de dados
    const match = this.range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) {
      // Se não conseguir parsear, assume que há header na primeira linha
      return this.range.replace(/\d+$/, '1');
    }

    const startCol = match[1]; // Ex: "A"
    const startRow = parseInt(match[2], 10); // Ex: 3
    const endCol = match[3]; // Ex: "AE"

    // Header está uma linha acima dos dados
    const headerRow = startRow - 1;

    return `${startCol}${headerRow}:${endCol}${headerRow}`;
  }

  // =====================================================
  // LISTAR TODOS OS PROJETOS
  // =====================================================

  async listAllProjects(): Promise<Project[]> {
    try {
      const dataRange = `${this.sheetName}!${this.range}`;
      const headerRange = `${this.sheetName}!${this.getHeaderRange()}`;
      
      console.log(`🔍 DEBUG - Header range: ${headerRange}`);
      console.log(`🔍 DEBUG - Data range: ${dataRange}`);

      const data = await this.sheetsService.readSheetAsObjectsWithSeparateHeaders(
        this.spreadsheetId,
        dataRange,
        headerRange
      );

      console.log(`🔍 DEBUG - Total de linhas lidas: ${data.length}`);

      // NOVO SCHEMA: Múltiplas linhas podem ter o mesmo código (diferentes áreas)
      // Agrupar por código e criar uma entrada por projeto+área
      const projectsMap = new Map<string, Project[]>();
      
      data
        .filter(row => row['Código do Projeto']) // Só projetos com código
        .forEach(row => {
          const codigo = row['Código do Projeto'] || '';
          const area = row['Área'] || '';
          
          // Criar chave única: código + área (para diferenciar múltiplas áreas do mesmo projeto)
          const key = `${codigo}::${area}`;
          
          if (!projectsMap.has(key)) {
            projectsMap.set(key, []);
          }
          
          projectsMap.get(key)!.push({
            codigo,
          cliente: row['Cliente'] || '',
          obra: row['Obra'] || '',
            area,
          tipo: row['Tipo de Projeto'] || '',
          descricao: row['Descrição do projeto'] || '',
          status: row['Status do projeto'] || '',
          etapa: row['Etapa'] || ''
          });
        });

      // Converter map para array (uma entrada por projeto+área)
      const projects: Project[] = [];
      projectsMap.forEach((projs) => {
        // Se houver múltiplas linhas com mesmo código+área, pegar a primeira
        if (projs.length > 0) {
          projects.push(projs[0]);
        }
      });

      console.log(`🔍 DEBUG - Projetos únicos (código+área): ${projects.length}`);
      
      return projects;
    } catch (error: any) {
      console.error('Erro ao listar projetos:', error.message);
      return [];
    }
  }

  // =====================================================
  // BUSCAR PROJETO POR CÓDIGO
  // =====================================================

  // =====================================================
  // CRIAR NOVO PROJETO
  // =====================================================

  // =====================================================
  // ATUALIZAR EXECUÇÃO DIÁRIA
  // =====================================================

  // =====================================================
  // ATUALIZAR DADOS DA MANHÃ
  // =====================================================

  // =====================================================
  // ATUALIZAR DADOS DA NOITE
  // =====================================================

  // =====================================================
  // REGISTRAR RETRABALHO
  // =====================================================

  // =====================================================
  // VALIDAR ESTRUTURA DA PLANILHA
  // =====================================================

  async validateSheetStructure(): Promise<ValidationResult> {
    try {
      // Obter headers do range configurado (que já começa na linha correta)
      const fullRange = `${this.sheetName}!${this.range}`;
      const { headers } = await this.sheetsService.readSheet(this.spreadsheetId, fullRange);
      const errors: string[] = [];

      // Headers obrigatórios
      const requiredHeaders = [
        'Código do Projeto',
        'Cliente',
        'Área',
        'Tipo de Projeto',
        'Status do projeto',
        'Etapa'
      ];

      for (const required of requiredHeaders) {
        if (!headers.includes(required)) {
          errors.push(`Header obrigatório faltando: ${required}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error: any) {
      console.error('Erro ao validar estrutura:', error.message);
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  // =====================================================
  // MÉTODOS AUXILIARES - MENUS DINÂMICOS E CÁLCULOS
  // =====================================================

  // =====================================================
  // GERAÇÃO DE CÓDIGO DE PROJETO
  // =====================================================

  /**
   * Busca o último código de projeto no formato PRJ-XXX
   */
  async getUltimoCodigoProjeto(): Promise<string | null> {
    try {
      const allProjects = await this.listAllProjects();
      
      if (allProjects.length === 0) {
        return null;
      }

      // Filtrar apenas códigos no formato PRJ-XXX
      const codigosValidos = allProjects
        .map(p => p.codigo)
        .filter(codigo => /^PRJ-\d{3}$/.test(codigo))
        .sort((a, b) => {
          const numA = parseInt(a.split('-')[1], 10);
          const numB = parseInt(b.split('-')[1], 10);
          return numB - numA; // Ordem decrescente
        });

      return codigosValidos.length > 0 ? codigosValidos[0] : null;
    } catch (error: any) {
      console.error('Erro ao buscar último código:', error.message);
      return null;
    }
  }

  /**
   * Gera o próximo código de projeto sequencial (PRJ-001, PRJ-002, ...)
   */
  async generateNextProjectCode(): Promise<string> {
    try {
      const ultimoCodigo = await this.getUltimoCodigoProjeto();
      
      if (!ultimoCodigo) {
        // Primeiro projeto
        return 'PRJ-001';
      }

      // Extrair número do último código
      const match = ultimoCodigo.match(/^PRJ-(\d{3})$/);
      if (!match) {
        // Fallback: se formato inválido, começar de 001
        return 'PRJ-001';
      }

      const ultimoNumero = parseInt(match[1], 10);
      const proximoNumero = ultimoNumero + 1;

      // Formatar com 3 dígitos (001, 002, ...)
      const codigoFormatado = proximoNumero.toString().padStart(3, '0');
      
      return `PRJ-${codigoFormatado}`;
    } catch (error: any) {
      console.error('Erro ao gerar código:', error.message);
      // Em caso de erro, usar timestamp como fallback
      const timestamp = Date.now().toString().slice(-6);
      return `PRJ-${timestamp}`;
    }
  }

  // =====================================================
  // UTILITÁRIOS - FORMATAÇÃO E VALIDAÇÃO DE DATAS
  // =====================================================

  parseDate(dateStr: string): Date | null {
    // Aceita DD/MM/AAAA
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Mês começa em 0
    const year = parseInt(match[3], 10);

    const date = new Date(year, month, day);

    // Validar data
    if (
      date.getDate() !== day ||
      date.getMonth() !== month ||
      date.getFullYear() !== year
    ) {
      return null;
    }

    return date;
  }

  validateDateFormat(dateStr: string): boolean {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr);
  }
}

// =====================================================
// SINGLETON
// =====================================================

let engineerSheetServiceInstance: EngineerSheetService | null = null;

export function getEngineerSheetService(
  spreadsheetId?: string,
  sheetName?: string,
  range?: string
): EngineerSheetService {
  if (!engineerSheetServiceInstance || spreadsheetId) {
    const id = spreadsheetId || process.env.GOOGLE_SHEETS_ENGINEER_ID || '';
    const name = sheetName || process.env.GOOGLE_SHEETS_ENGINEER_NAME || 'Engenheiro(a)';
    const rng = range || process.env.GOOGLE_SHEETS_ENGINEER_RANGE || 'A1:AE1000';
    
    engineerSheetServiceInstance = new EngineerSheetService(id, name, rng);
  }
  
  return engineerSheetServiceInstance;
}
