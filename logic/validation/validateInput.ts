// =====================================================
// LÓGICA: Validação de Inputs
// =====================================================
// Responsabilidade: Colega (Lógica de Negócio)
//
// Este módulo contém validações de dados antes de
// enviar para as APIs do backend
// =====================================================

import { dataLocalBR } from '../datas/dataLocal.ts';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface ExecutionData {
  projeto_id?: string;
  codigo_projeto?: string; // Alternativa ao projeto_id
  data?: string;
  percentual_previsto?: number;
  percentual_realizado: number;
  observacoes?: string;
}

export interface ReworkData {
  projeto_id?: string;
  codigo_projeto?: string; // Alternativa ao projeto_id
  data?: string;
  motivo: string;
  descricao: string;
  impacto_percentual?: number;
  tempo_perdido_horas?: number;
}

export interface ProjectData {
  codigo?: string;
  nome: string;
  cliente: string;
  area?: string;
  tipo_obra?: string;
  status?: string;
  data_inicio?: string;
  data_previsao_termino?: string;
}

export interface ValidationResult {
  valido: boolean;
  erros: string[];
  avisos: string[];
  dados_normalizados?: any;
}

// =====================================================
// UTILITÁRIOS DE VALIDAÇÃO
// =====================================================

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function isValidPercentage(value: number): boolean {
  return typeof value === 'number' && value >= 0 && value <= 100;
}

function normalizeDate(dateString: string): string {
  // Aceita diversos formatos e normaliza para ISO (YYYY-MM-DD)
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function normalizeWhatsapp(whatsapp: string): string {
  // Remove caracteres especiais e garante formato +55XXXXXXXXXXX
  const cleaned = whatsapp.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    // Evitar duplo +55: se já começa com 55 e tem tamanho de celular BR (12-13 dígitos)
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      return '+' + cleaned;
    }
    return '+55' + cleaned;
  }
  return cleaned;
}

// =====================================================
// FUNÇÃO: Validar Dados de Execução
// =====================================================

export function validateExecution(data: ExecutionData): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];
  const dados_normalizados: any = { ...data };

  // Validar identificação do projeto
  if (!data.projeto_id && !data.codigo_projeto) {
    erros.push('É necessário fornecer projeto_id ou codigo_projeto');
  }

  // Validar percentual_realizado (obrigatório)
  if (data.percentual_realizado === undefined || data.percentual_realizado === null) {
    erros.push('percentual_realizado é obrigatório');
  } else if (!isValidPercentage(data.percentual_realizado)) {
    erros.push('percentual_realizado deve estar entre 0 e 100');
  }

  // Validar percentual_previsto (opcional)
  if (data.percentual_previsto !== undefined && data.percentual_previsto !== null) {
    if (!isValidPercentage(data.percentual_previsto)) {
      erros.push('percentual_previsto deve estar entre 0 e 100');
    }
  }

  // Validar e normalizar data
  if (data.data) {
    if (!isValidDate(data.data)) {
      erros.push('data inválida. Use formato YYYY-MM-DD');
    } else {
      dados_normalizados.data = normalizeDate(data.data);
      
      // Avisar se a data for futura
      const dataFornecida = new Date(data.data);
      const hoje = new Date();
      if (dataFornecida > hoje) {
        avisos.push('Data está no futuro');
      }
      
      // Avisar se a data for muito antiga (mais de 1 ano)
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
      if (dataFornecida < umAnoAtras) {
        avisos.push('Data está há mais de 1 ano atrás');
      }
    }
  } else {
    // Se não forneceu data, usar hoje
    dados_normalizados.data = dataLocalBR();
  }

  // Validar observações (tamanho máximo)
  if (data.observacoes && data.observacoes.length > 500) {
    avisos.push('Observações muito longas. Considere resumir (máx 500 caracteres)');
  }

  // Validar consistência (realizado vs previsto)
  if (data.percentual_previsto && data.percentual_realizado) {
    const diferenca = data.percentual_realizado - data.percentual_previsto;
    if (Math.abs(diferenca) > 50) {
      avisos.push(
        `Grande diferença entre previsto (${data.percentual_previsto}%) e realizado (${data.percentual_realizado}%)`
      );
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    dados_normalizados: erros.length === 0 ? dados_normalizados : undefined,
  };
}

// =====================================================
// FUNÇÃO: Validar Dados de Retrabalho
// =====================================================

export function validateRework(data: ReworkData): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];
  const dados_normalizados: any = { ...data };

  // Validar identificação do projeto
  if (!data.projeto_id && !data.codigo_projeto) {
    erros.push('É necessário fornecer projeto_id ou codigo_projeto');
  }

  // Validar motivo (obrigatório)
  if (!data.motivo || data.motivo.trim() === '') {
    erros.push('motivo é obrigatório');
  } else if (data.motivo.length < 5) {
    avisos.push('Motivo muito curto. Considere fornecer mais detalhes');
  }

  // Validar descrição (obrigatória)
  if (!data.descricao || data.descricao.trim() === '') {
    erros.push('descricao é obrigatória');
  } else if (data.descricao.length < 10) {
    avisos.push('Descrição muito curta. Forneça mais detalhes sobre o retrabalho');
  } else if (data.descricao.length > 1000) {
    avisos.push('Descrição muito longa. Considere resumir (máx 1000 caracteres)');
  }

  // Validar impacto_percentual (opcional)
  if (data.impacto_percentual !== undefined && data.impacto_percentual !== null) {
    if (!isValidPercentage(data.impacto_percentual)) {
      erros.push('impacto_percentual deve estar entre 0 e 100');
    } else if (data.impacto_percentual > 20) {
      avisos.push('Impacto alto (>20%). Considere revisar processos');
    }
  }

  // Validar tempo_perdido_horas (opcional)
  if (data.tempo_perdido_horas !== undefined && data.tempo_perdido_horas !== null) {
    if (data.tempo_perdido_horas < 0) {
      erros.push('tempo_perdido_horas não pode ser negativo');
    } else if (data.tempo_perdido_horas > 200) {
      avisos.push('Tempo perdido muito alto (>200h). Verificar se está correto');
    }
  }

  // Validar e normalizar data
  if (data.data) {
    if (!isValidDate(data.data)) {
      erros.push('data inválida. Use formato YYYY-MM-DD');
    } else {
      dados_normalizados.data = normalizeDate(data.data);
    }
  } else {
    dados_normalizados.data = dataLocalBR();
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    dados_normalizados: erros.length === 0 ? dados_normalizados : undefined,
  };
}

// =====================================================
// FUNÇÃO: Validar Dados de Projeto
// =====================================================

export function validateProjectData(data: ProjectData): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];
  const dados_normalizados: any = { ...data };

  // Validar nome (obrigatório)
  if (!data.nome || data.nome.trim() === '') {
    erros.push('nome é obrigatório');
  } else if (data.nome.length < 5) {
    avisos.push('Nome do projeto muito curto');
  }

  // Validar cliente (obrigatório)
  if (!data.cliente || data.cliente.trim() === '') {
    erros.push('cliente é obrigatório');
  }

  // Validar código (opcional, mas recomendado)
  if (!data.codigo) {
    avisos.push('Recomendado fornecer um código único para o projeto');
  } else {
    // Normalizar código (remover espaços, uppercase)
    dados_normalizados.codigo = data.codigo.trim().toUpperCase();
  }

  // Validar datas
  if (data.data_inicio) {
    if (!isValidDate(data.data_inicio)) {
      erros.push('data_inicio inválida');
    } else {
      dados_normalizados.data_inicio = normalizeDate(data.data_inicio);
    }
  }

  if (data.data_previsao_termino) {
    if (!isValidDate(data.data_previsao_termino)) {
      erros.push('data_previsao_termino inválida');
    } else {
      dados_normalizados.data_previsao_termino = normalizeDate(data.data_previsao_termino);
      
      // Validar consistência entre data_inicio e data_previsao_termino
      if (data.data_inicio && isValidDate(data.data_inicio)) {
        const inicio = new Date(data.data_inicio);
        const termino = new Date(data.data_previsao_termino);
        
        if (termino <= inicio) {
          erros.push('data_previsao_termino deve ser posterior a data_inicio');
        }
        
        // Avisar se o prazo for muito longo (mais de 2 anos)
        const diferencaDias = (termino.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24);
        if (diferencaDias > 730) {
          avisos.push('Prazo do projeto muito longo (>2 anos)');
        }
      }
    }
  }

  // Validar status (valores permitidos)
  const statusValidos = [
    'Em Planejamento',
    'Em Execução',
    'Parado',
    'Parado Cliente',
    'Concluído',
    'Cancelado',
  ];

  if (data.status && !statusValidos.includes(data.status)) {
    avisos.push(`Status '${data.status}' não é padrão. Valores sugeridos: ${statusValidos.join(', ')}`);
  }

  // Validar área (valores sugeridos)
  const areasSugeridas = ['Elétrico', 'Hidrossanitário', 'Estrutural', 'Civil', 'Mecânico'];
  if (data.area && !areasSugeridas.includes(data.area)) {
    avisos.push(`Área '${data.area}' não é padrão. Valores sugeridos: ${areasSugeridas.join(', ')}`);
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    dados_normalizados: erros.length === 0 ? dados_normalizados : undefined,
  };
}

// =====================================================
// FUNÇÃO: Validar WhatsApp
// =====================================================

export function validateWhatsapp(whatsapp: string): ValidationResult {
  const erros: string[] = [];
  const avisos: string[] = [];

  if (!whatsapp || whatsapp.trim() === '') {
    erros.push('WhatsApp é obrigatório');
    return { valido: false, erros, avisos };
  }

  // Normalizar
  const normalizado = normalizeWhatsapp(whatsapp);

  // Validar formato brasileiro (+55 + DDD + número)
  const regex = /^\+55\d{10,11}$/;
  if (!regex.test(normalizado)) {
    erros.push('Formato de WhatsApp inválido. Use: +5511999999999');
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    dados_normalizados: normalizado,
  };
}

// =====================================================
// FUNÇÃO: Sanitizar Texto (prevenir problemas)
// =====================================================

export function sanitizeText(text: string, maxLength?: number): string {
  if (!text) return '';

  // Remover caracteres especiais problemáticos
  let sanitized = text
    .trim()
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove caracteres de controle
    .replace(/\s+/g, ' '); // Normaliza espaços

  // Limitar tamanho
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

// =====================================================
// FUNÇÃO: Normalizar Código de Projeto
// =====================================================
// Testes unitários de referência:
// normalizeProjectCode("002") -> "PRJ-002"
// normalizeProjectCode("OBR-2024-01") -> "OBR-2024-01"
// normalizeProjectCode("prj2") -> "PRJ-2"
// normalizeProjectCode("prj-005") -> "PRJ-005"
// normalizeProjectCode("1") -> "PRJ-1"
export function normalizeProjectCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim().toUpperCase();
  
  // Se for apenas números (ex: "002")
  if (/^\d+$/.test(trimmed)) {
    return `PRJ-${trimmed}`;
  }
  
  // Se começar com texto e terminar com número, sem hífen (ex: "PRJ2")
  const match = trimmed.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  
  // Caso contrário, mantém como está (ex: "PRJ-002", "OBR-2024-01")
  return trimmed;
}

// =====================================================
// FUNÇÃO: Validar Lote de Dados
// =====================================================

export function validateBatch<T>(
  items: T[],
  validator: (item: T) => ValidationResult
): {
  validos: T[];
  invalidos: { item: T; erros: string[] }[];
  avisos_gerais: string[];
} {
  const validos: T[] = [];
  const invalidos: { item: T; erros: string[] }[] = [];
  const avisos_gerais: string[] = [];

  items.forEach((item) => {
    const resultado = validator(item);
    
    if (resultado.valido) {
      validos.push(resultado.dados_normalizados || item);
    } else {
      invalidos.push({ item, erros: resultado.erros });
    }
    
    // Coletar avisos
    if (resultado.avisos.length > 0) {
      avisos_gerais.push(...resultado.avisos);
    }
  });

  return { validos, invalidos, avisos_gerais };
}

// =====================================================
// EXEMPLO DE USO
// =====================================================

/*
import {
  validateExecution,
  validateRework,
  validateProjectData,
  validateWhatsapp,
} from './validateInput';

// Exemplo 1: Validar execução
const execucaoData = {
  codigo_projeto: 'PRJ-001',
  percentual_realizado: 8,
  percentual_previsto: 10,
  observacoes: 'Chuva atrasou o trabalho',
};

const resultadoExecucao = validateExecution(execucaoData);
if (resultadoExecucao.valido) {
  console.log('Dados válidos:', resultadoExecucao.dados_normalizados);
} else {
  console.log('Erros:', resultadoExecucao.erros);
}

// Exemplo 2: Validar retrabalho
const retrabalhoData = {
  codigo_projeto: 'PRJ-001',
  motivo: 'Erro de Projeto',
  descricao: 'Dimensionamento incorreto dos cabos elétricos',
  impacto_percentual: 5,
};

const resultadoRetrabalho = validateRework(retrabalhoData);
console.log(resultadoRetrabalho);

// Exemplo 3: Validar WhatsApp
const resultadoWhatsapp = validateWhatsapp('11999999999');
console.log(resultadoWhatsapp.dados_normalizados); // +5511999999999
*/

