// =====================================================
// LÓGICA: Cálculo de Progresso e Execução
// =====================================================
// Responsabilidade: Colega (Lógica de Negócio)
//
// Este módulo contém toda a lógica de cálculo de percentuais
// de execução, progresso acumulado e análise de performance
// =====================================================

import { dataLocalBR } from '../datas/dataLocal.ts';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface ExecucaoDiaria {
  data: string;
  percentual_previsto?: number;
  percentual_realizado: number;
  percentual_acumulado?: number;
  observacoes?: string;
}

export interface ProgressoCalculado {
  percentual_acumulado: number;
  variacao_previsto_realizado?: number;
  status: 'no_prazo' | 'atrasado' | 'adiantado';
  dias_trabalhados: number;
  media_diaria: number;
  tendencia: 'acelerando' | 'estavel' | 'desacelerando';
}

export interface ProjecaoFutura {
  dias_restantes_estimado: number;
  data_conclusao_estimada: string;
  percentual_necessario_diario: number;
  viabilidade: 'viavel' | 'atencao' | 'critico';
}

// =====================================================
// FUNÇÃO: Calcular Progresso Diário
// =====================================================
// Calcula a diferença entre previsto e realizado
// e determina se está no prazo, atrasado ou adiantado
// =====================================================

export function calculateDailyProgress(
  previsto: number,
  realizado: number
): {
  variacao: number;
  percentual_variacao: number;
  status: 'no_prazo' | 'atrasado' | 'adiantado';
} {
  // Validar inputs
  if (previsto < 0 || previsto > 100) {
    throw new Error('percentual_previsto deve estar entre 0 e 100');
  }
  if (realizado < 0 || realizado > 100) {
    throw new Error('percentual_realizado deve estar entre 0 e 100');
  }

  // Calcular variação absoluta
  const variacao = realizado - previsto;

  // Calcular variação percentual (relativa ao previsto)
  const percentual_variacao = previsto > 0 ? (variacao / previsto) * 100 : 0;

  // Determinar status (com margem de tolerância de 5%)
  let status: 'no_prazo' | 'atrasado' | 'adiantado';
  if (Math.abs(variacao) <= 5) {
    status = 'no_prazo';
  } else if (variacao < 0) {
    status = 'atrasado';
  } else {
    status = 'adiantado';
  }

  return {
    variacao,
    percentual_variacao: Math.round(percentual_variacao * 100) / 100,
    status,
  };
}

// =====================================================
// FUNÇÃO: Calcular Progresso Acumulado
// =====================================================
// Soma todos os percentuais realizados até a data
// e calcula estatísticas gerais do projeto
// =====================================================

export function calculateAccumulatedProgress(
  execucoes: ExecucaoDiaria[]
): ProgressoCalculado {
  // Validar entrada
  if (!execucoes || execucoes.length === 0) {
    return {
      percentual_acumulado: 0,
      status: 'no_prazo',
      dias_trabalhados: 0,
      media_diaria: 0,
      tendencia: 'estavel',
    };
  }

  // Ordenar por data (mais antiga primeiro)
  const execucoesOrdenadas = [...execucoes].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  // Somar todos os percentuais realizados
  const percentual_acumulado = Math.min(
    execucoesOrdenadas.reduce((acc, exec) => acc + exec.percentual_realizado, 0),
    100 // Máximo 100%
  );

  // Calcular dias trabalhados
  const dias_trabalhados = execucoesOrdenadas.length;

  // Calcular média diária
  const media_diaria = percentual_acumulado / dias_trabalhados;

  // Calcular variação previsto vs realizado (se houver previsões)
  const execucoesComPrevisao = execucoesOrdenadas.filter((e) => e.percentual_previsto !== undefined);
  let variacao_previsto_realizado: number | undefined;

  if (execucoesComPrevisao.length > 0) {
    const total_previsto = execucoesComPrevisao.reduce(
      (acc, exec) => acc + (exec.percentual_previsto || 0),
      0
    );
    const total_realizado_com_previsao = execucoesComPrevisao.reduce(
      (acc, exec) => acc + exec.percentual_realizado,
      0
    );
    variacao_previsto_realizado = total_realizado_com_previsao - total_previsto;
  }

  // Determinar status geral
  let status: 'no_prazo' | 'atrasado' | 'adiantado' = 'no_prazo';
  if (variacao_previsto_realizado !== undefined) {
    if (variacao_previsto_realizado < -5) {
      status = 'atrasado';
    } else if (variacao_previsto_realizado > 5) {
      status = 'adiantado';
    }
  }

  // Calcular tendência (comparar últimas 3 execuções com a média geral)
  let tendencia: 'acelerando' | 'estavel' | 'desacelerando' = 'estavel';
  if (dias_trabalhados >= 5) {
    const ultimas3 = execucoesOrdenadas.slice(-3);
    const media_recente =
      ultimas3.reduce((acc, exec) => acc + exec.percentual_realizado, 0) / 3;

    if (media_recente > media_diaria + 1) {
      tendencia = 'acelerando';
    } else if (media_recente < media_diaria - 1) {
      tendencia = 'desacelerando';
    }
  }

  return {
    percentual_acumulado: Math.round(percentual_acumulado * 100) / 100,
    variacao_previsto_realizado: variacao_previsto_realizado
      ? Math.round(variacao_previsto_realizado * 100) / 100
      : undefined,
    status,
    dias_trabalhados,
    media_diaria: Math.round(media_diaria * 100) / 100,
    tendencia,
  };
}

// =====================================================
// FUNÇÃO: Projetar Conclusão do Projeto
// =====================================================
// Estima quando o projeto será concluído baseado no ritmo atual
// =====================================================

export function projectCompletion(
  percentual_atual: number,
  media_diaria: number,
  data_previsao?: string
): ProjecaoFutura {
  // Validar inputs
  if (percentual_atual < 0 || percentual_atual > 100) {
    throw new Error('percentual_atual deve estar entre 0 e 100');
  }

  if (media_diaria <= 0) {
    throw new Error('media_diaria deve ser maior que 0');
  }

  // Calcular percentual restante
  const percentual_restante = 100 - percentual_atual;

  // Estimar dias restantes
  const dias_restantes_estimado = Math.ceil(percentual_restante / media_diaria);

  // Calcular data estimada de conclusão
  const hoje = new Date();
  // Conta a partir do dia de Brasilia (o servidor roda em UTC); a soma de dias
  // e feita em UTC sobre essa data para nao depender do fuso da maquina.
  const data_conclusao = new Date(`${dataLocalBR(hoje)}T00:00:00Z`);
  data_conclusao.setUTCDate(data_conclusao.getUTCDate() + dias_restantes_estimado);
  const data_conclusao_estimada = data_conclusao.toISOString().split('T')[0];

  // Calcular percentual necessário diário para cumprir prazo (se houver)
  let percentual_necessario_diario = media_diaria;
  let viabilidade: 'viavel' | 'atencao' | 'critico' = 'viavel';

  if (data_previsao) {
    const prazo = new Date(data_previsao);
    const dias_ate_prazo = Math.ceil(
      (prazo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dias_ate_prazo > 0) {
      percentual_necessario_diario = percentual_restante / dias_ate_prazo;

      // Determinar viabilidade
      const diferenca = percentual_necessario_diario - media_diaria;
      if (diferenca <= 1) {
        viabilidade = 'viavel';
      } else if (diferenca <= 3) {
        viabilidade = 'atencao';
      } else {
        viabilidade = 'critico';
      }
    } else {
      // Prazo já vencido
      viabilidade = 'critico';
    }
  }

  return {
    dias_restantes_estimado,
    data_conclusao_estimada,
    percentual_necessario_diario: Math.round(percentual_necessario_diario * 100) / 100,
    viabilidade,
  };
}

// =====================================================
// FUNÇÃO: Validar Consistência dos Dados
// =====================================================
// Verifica se os dados de execução estão consistentes
// =====================================================

export function validateExecutionData(execucoes: ExecucaoDiaria[]): {
  valido: boolean;
  erros: string[];
  avisos: string[];
} {
  const erros: string[] = [];
  const avisos: string[] = [];

  // Verificar se há execuções
  if (!execucoes || execucoes.length === 0) {
    avisos.push('Nenhuma execução registrada');
    return { valido: true, erros, avisos };
  }

  // Verificar duplicatas de data
  const datas = execucoes.map((e) => e.data);
  const datasUnicas = new Set(datas);
  if (datas.length !== datasUnicas.size) {
    erros.push('Existem datas duplicadas');
  }

  // Verificar percentuais válidos
  execucoes.forEach((exec, index) => {
    if (exec.percentual_realizado < 0 || exec.percentual_realizado > 100) {
      erros.push(`Execução ${index + 1}: percentual_realizado inválido`);
    }

    if (
      exec.percentual_previsto !== undefined &&
      (exec.percentual_previsto < 0 || exec.percentual_previsto > 100)
    ) {
      erros.push(`Execução ${index + 1}: percentual_previsto inválido`);
    }
  });

  // Verificar se acumulado ultrapassa 100%
  const acumulado = execucoes.reduce((acc, e) => acc + e.percentual_realizado, 0);
  if (acumulado > 100) {
    avisos.push(`Percentual acumulado (${acumulado.toFixed(2)}%) ultrapassa 100%`);
  }

  // Verificar gaps de datas
  const execucoesOrdenadas = [...execucoes].sort(
    (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
  );

  for (let i = 1; i < execucoesOrdenadas.length; i++) {
    const dataAnterior = new Date(execucoesOrdenadas[i - 1].data);
    const dataAtual = new Date(execucoesOrdenadas[i].data);
    const diasDiferenca = Math.ceil(
      (dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diasDiferenca > 7) {
      avisos.push(`Gap de ${diasDiferenca} dias entre ${execucoesOrdenadas[i - 1].data} e ${execucoesOrdenadas[i].data}`);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

// =====================================================
// EXEMPLO DE USO
// =====================================================

/*
import {
  calculateDailyProgress,
  calculateAccumulatedProgress,
  projectCompletion,
  validateExecutionData,
} from './calculateProgress';

// Exemplo 1: Calcular progresso diário
const progressoDiario = calculateDailyProgress(10, 8);
console.log(progressoDiario);
// { variacao: -2, percentual_variacao: -20, status: 'atrasado' }

// Exemplo 2: Calcular progresso acumulado
const execucoes = [
  { data: '2024-01-01', percentual_previsto: 10, percentual_realizado: 8 },
  { data: '2024-01-02', percentual_previsto: 10, percentual_realizado: 12 },
  { data: '2024-01-03', percentual_previsto: 10, percentual_realizado: 9 },
];

const progressoAcumulado = calculateAccumulatedProgress(execucoes);
console.log(progressoAcumulado);

// Exemplo 3: Projetar conclusão
const projecao = projectCompletion(29, 9.67, '2024-02-15');
console.log(projecao);

// Exemplo 4: Validar dados
const validacao = validateExecutionData(execucoes);
console.log(validacao);
*/
