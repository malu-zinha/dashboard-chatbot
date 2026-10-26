// =====================================================
// SINCRONIZAÇÃO: Supabase → Google Sheets
// =====================================================
// Sincroniza dados do banco de dados para as planilhas
// Roda periodicamente via cron job
// =====================================================

import cron from 'node-cron';
import { getSupabaseService } from '../supabase/supabaseService.ts';
import { getGoogleSheetsService } from '../sheets/googleSheetsService.ts';
import dotenv from 'dotenv';
import { semSobreposicao } from './semSobreposicao.ts';

dotenv.config();

// =====================================================
// CONFIGURAÇÃO
// =====================================================

interface SheetConfig {
  id: string;
  name: string;
  range: string;
  engenheiroWhatsapp?: string; // Filtro por engenheiro (opcional)
}

// Configurar planilhas a sincronizar
const SHEETS_CONFIG: SheetConfig[] = [];

// COMPATIBILIDADE: Usar variável antiga se nova não existir
const engineerSheetId = process.env.GOOGLE_SHEETS_ENG1_ID || process.env.GOOGLE_SHEETS_ENGINEER_ID;
const engineerSheetName = process.env.GOOGLE_SHEETS_ENG1_NAME || process.env.GOOGLE_SHEETS_ENGINEER_NAME || process.env.GOOGLE_SHEETS_ENGINEER_SHEET || 'Engenheiro(a)';
const engineerSheetRange = process.env.GOOGLE_SHEETS_ENG1_RANGE || process.env.GOOGLE_SHEETS_ENGINEER_RANGE || 'A2:AE1000';
const engineerWhatsapp = process.env.GOOGLE_SHEETS_ENG1_WHATSAPP;

// Planilha 1: Engenheiro principal (usa ID antigo ou novo)
if (engineerSheetId) {
  SHEETS_CONFIG.push({
    id: engineerSheetId,
    name: engineerSheetName,
    range: engineerSheetRange,
    engenheiroWhatsapp: engineerWhatsapp // Opcional - se não tiver, mostra todos
  });
}

// Planilha 2: Engenheiro adicional (opcional)
if (process.env.GOOGLE_SHEETS_ENG2_ID) {
  SHEETS_CONFIG.push({
    id: process.env.GOOGLE_SHEETS_ENG2_ID,
    name: process.env.GOOGLE_SHEETS_ENG2_NAME || 'Engenheiro(a)',
    range: process.env.GOOGLE_SHEETS_ENG2_RANGE || 'A2:AE1000',
    engenheiroWhatsapp: process.env.GOOGLE_SHEETS_ENG2_WHATSAPP
  });
}

// Planilha 3: Engenheiro adicional (opcional)
if (process.env.GOOGLE_SHEETS_ENG3_ID) {
  SHEETS_CONFIG.push({
    id: process.env.GOOGLE_SHEETS_ENG3_ID,
    name: process.env.GOOGLE_SHEETS_ENG3_NAME || 'Engenheiro(a)',
    range: process.env.GOOGLE_SHEETS_ENG3_RANGE || 'A2:AE1000',
    engenheiroWhatsapp: process.env.GOOGLE_SHEETS_ENG3_WHATSAPP
  });
}

// Planilha CEO (dashboard consolidado) - opcional
const CEO_SHEET_CONFIG: SheetConfig | null = process.env.GOOGLE_SHEETS_CEO_ID ? {
  id: process.env.GOOGLE_SHEETS_CEO_ID,
  name: process.env.GOOGLE_SHEETS_CEO_NAME || 'Dashboard',
  range: process.env.GOOGLE_SHEETS_CEO_RANGE || 'A2:Z1000'
} : null;

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO
// =====================================================

/**
 * Sincroniza projetos do Supabase para uma planilha específica
 */
async function syncProjetosParaPlanilha(config: SheetConfig): Promise<void> {
  try {
    console.log(`🔄 Sincronizando: ${config.id.substring(0, 10)}...`);
    
    const supabase = getSupabaseService();
    const sheets = getGoogleSheetsService();

    if (!supabase.isConnected()) {
      console.log('   ⚠️  Supabase não conectado - pulando sincronização');
      return;
    }

    // NOVO SCHEMA: Buscar atribuições (engenheiros_projetos) via view consolidada
    // Cada atribuição = uma linha na planilha (mesmo projeto pode ter múltiplas linhas se tiver múltiplas áreas)
    
    // 1. Buscar engenheiro por WhatsApp se filtro especificado
    let eng_id: string | null = null;
    if (config.engenheiroWhatsapp) {
      const engenheiro = await supabase.buscarEngenheiroPorWhatsapp(config.engenheiroWhatsapp);
      if (engenheiro) {
        eng_id = engenheiro.eng_id;
      } else {
        console.log(`   ⚠️  Engenheiro não encontrado: ${config.engenheiroWhatsapp}`);
        return;
      }
    }

    // 2. Buscar atribuições usando métodos do supabaseService
    let atribuicoes: any[] = [];
    
    if (eng_id) {
      // Buscar atribuições do engenheiro específico
      const atribs = await supabase.listarAtribuicoesEngenheiro(eng_id);
      
      // Buscar nome do engenheiro uma vez
      const engenheiro = await supabase.buscarEngenheiroPorId(eng_id);
      const engenheiroNome = engenheiro?.nome || '';
      
      // Enriquecer com dados de projeto, área e status
      for (const atrib of atribs) {
        // Buscar projeto por ID (UUID)
        const projetoData = await supabase.buscarProjetoPorId(atrib.projeto_id);
        
        const area = await supabase.buscarAreaPorId(atrib.area_id);
        const status = atrib.status_id ? await supabase.buscarStatusPorId(atrib.status_id) : null;
        
        atribuicoes.push({
          id: atrib.id,
          eng_id: atrib.eng_id,
          projeto_id: atrib.projeto_id,
          area_id: atrib.area_id,
          codigo_projeto: projetoData?.codigo_projeto || '',
          cliente: projetoData?.cliente || '',
          engenheiro_nome: engenheiroNome,
          area_codigo: area?.codigo || '',
          area_descricao: area?.descricao || '',
          status_id: atrib.status_id,
          status_codigo: status?.codigo || '',
          status_descricao: status?.descricao || '',
          data_inicio: atrib.data_inicio,
          data_prevista: atrib.data_prevista,
          data_conclusao: atrib.data_conclusao,
          percentual_andamento: atrib.percentual_andamento,
          tempo_trabalho_dias: atrib.tempo_trabalho_dias,
          observacoes: atrib.observacoes,
          ativo: atrib.ativo,
          created_at: atrib.created_at,
        });
      }
    } else {
      // Buscar todas as atribuições usando novo método
      const todasAtribs = await supabase.listarTodasAtribuicoes();
      
      // Enriquecer cada uma
      for (const atrib of todasAtribs) {
        const projetoData = await supabase.buscarProjetoPorId(atrib.projeto_id);
        
        const engenheiro = await supabase.buscarEngenheiroPorId(atrib.eng_id);
        const area = await supabase.buscarAreaPorId(atrib.area_id);
        const status = atrib.status_id ? await supabase.buscarStatusPorId(atrib.status_id) : null;
        
        atribuicoes.push({
          id: atrib.id,
          eng_id: atrib.eng_id,
          projeto_id: atrib.projeto_id,
          area_id: atrib.area_id,
          codigo_projeto: projetoData?.codigo_projeto || '',
          cliente: projetoData?.cliente || '',
          engenheiro_nome: engenheiro?.nome || '',
          area_codigo: area?.codigo || '',
          area_descricao: area?.descricao || '',
          status_id: atrib.status_id,
          status_codigo: status?.codigo || '',
          status_descricao: status?.descricao || '',
          data_inicio: atrib.data_inicio,
          data_prevista: atrib.data_prevista,
          data_conclusao: atrib.data_conclusao,
          percentual_andamento: atrib.percentual_andamento,
          tempo_trabalho_dias: atrib.tempo_trabalho_dias,
          observacoes: atrib.observacoes,
          ativo: atrib.ativo,
          created_at: atrib.created_at,
        });
      }
    }

    if (!atribuicoes || atribuicoes.length === 0) {
      console.log('   ℹ️  Nenhuma atribuição encontrada');
      return;
    }

    console.log(`   📊 ${atribuicoes.length} atribuição(ões) encontrada(s)`);

    // 3. Formatar dados para planilha (uma linha por atribuição)
    const rows: any[][] = [];

    for (const atrib of atribuicoes) {
      // Buscar última previsão, retrabalho e prazos usando métodos do supabaseService
      const ultimaPrevisao = await supabase.buscarUltimaPrevisao(atrib.id);
      const ultimoRetrabalho = await supabase.buscarUltimoRetrabalho(atrib.id);
      const prazos = await supabase.buscarPrazos(atrib.id);

      // Mapear status_id para descrição
      const statusDescricao = atrib.status_descricao || atrib.status_codigo || '';
      
      // Mapear area_id para descrição
      const areaDescricao = atrib.area_descricao || atrib.area_codigo || '';

      // Montar linha com as 31 colunas (A-AE) - uma linha por atribuição
      const row = [
        atrib.codigo_projeto || '',                             // A - Código do Projeto
        atrib.cliente || '',                                     // B - Cliente
        '',                                                      // C - Contato (não está na view, pode adicionar depois)
        '',                                                      // D - Obra (não está na view, pode adicionar depois)
        areaDescricao,                                          // E - Área (da tabela areas)
        atrib.engenheiro_nome || '',                            // F - Eng. Responsável
        '',                                                      // G - Tipo de Projeto (não está na view)
        '',                                                      // H - Descrição do projeto
        '',                                                      // I - Complexidade
        atrib.tempo_trabalho_dias?.toString() || '',            // J - Dias estimados (interno) - tempo_trabalho_dias
        supabase.formatarDataParaExibicao(atrib.data_inicio),  // K - Data de Início
        supabase.formatarDataParaExibicao(atrib.data_prevista), // L - Data de Previsão
        prazos ? supabase.formatarDataParaExibicao(prazos.prazo_final_cliente) : '', // M - Data Final Cliente
        prazos ? (prazos.prazo_interno_dias?.toString() || '') : '', // N - Prazo Interno (dias úteis)
        prazos ? (prazos.prazo_cliente_dias?.toString() || '') : '', // O - Prazo Cliente (dias úteis)
        '',                                                      // P - Dias de atraso (calcular depois)
        statusDescricao,                                        // Q - Status do projeto (da tabela status_codes)
        ultimaPrevisao?.previsao_texto || '',                   // R - Previsão para o dia
        ultimaPrevisao?.feito_texto || '',                      // S - Feito ao final do dia
        ultimoRetrabalho ? 'sim' : 'não',                       // T - Necessitou de retrabalho?
        ultimoRetrabalho?.motivo_retrabalho || '',              // U - motivo da revisão
        supabase.formatarDataParaExibicao(ultimoRetrabalho?.data_retrabalho), // V - Data do registro do retrabalho
        statusDescricao,                                        // W - Etapa (mesmo que status por enquanto)
        atrib.percentual_andamento?.toString() || '0',          // X - % executado
        atrib.observacoes || '',                                 // Y - Observações
        '',                                                      // Z - Métrica de retrabalho (calcular depois)
        atrib.tempo_trabalho_dias?.toString() || '',            // AA - Dias estimados (dias úteis) [duplicado]
        supabase.formatarDataParaExibicao(atrib.data_conclusao), // AB - Data de entrega real
        '',                                                      // AC - Lead Time (calcular depois)
        '',                                                      // AD - Dias Parado cliente
        ''                                                       // AE - Dias parado TecPred
      ];

      rows.push(row);
    }

    // 3. Limpar planilha atual (exceto headers)
    const fullRange = `${config.name}!${config.range}`;
    await sheets.clearSheet(config.id, fullRange);

    // 4. Escrever novos dados
    if (rows.length > 0) {
      await sheets.writeSheet(config.id, fullRange, rows);
      console.log(`   ✅ ${rows.length} projeto(s) sincronizado(s)`);
    } else {
      console.log(`   ℹ️  Nenhum projeto para sincronizar`);
    }

  } catch (error: any) {
    console.error(`   ❌ Erro na sincronização:`, error.message);
  }
}

/**
 * Sincroniza dashboard consolidado para planilha CEO
 */
async function syncDashboardCEO(): Promise<void> {
  if (!CEO_SHEET_CONFIG) {
    return; // CEO sheet não configurado
  }

  try {
    console.log(`🔄 Sincronizando dashboard CEO...`);
    
    const supabase = getSupabaseService();
    const sheets = getGoogleSheetsService();

    if (!supabase.isConnected()) {
      console.log('   ⚠️  Supabase não conectado');
      return;
    }

    // Buscar todas as atribuições ativas
    const todasAtribs = await supabase.listarTodasAtribuicoes();
    
    if (!todasAtribs || todasAtribs.length === 0) {
      console.log('   ℹ️  Nenhuma atribuição encontrada');
      return;
    }
    
    // Enriquecer com dados de projeto, área, status e engenheiro
    const projetos: any[] = [];
    for (const atrib of todasAtribs) {
      const projetoData = await supabase.buscarProjetoPorId(atrib.projeto_id);
      
      const engenheiro = await supabase.buscarEngenheiroPorId(atrib.eng_id);
      const area = await supabase.buscarAreaPorId(atrib.area_id);
      const status = atrib.status_id ? await supabase.buscarStatusPorId(atrib.status_id) : null;
      
      projetos.push({
        codigo: projetoData?.codigo_projeto || '',
        cliente: projetoData?.cliente || '',
        engenheiro_nome: engenheiro?.nome || '',
        area: area?.descricao || '',
        status: status?.descricao || '',
        percentual_total: atrib.percentual_andamento,
        etapa_atual: status?.descricao || '',
        data_inicio: atrib.data_inicio,
        data_previsao_termino: atrib.data_prevista,
        dias_atraso: '0',
        metrica_retrabalho: '0'
      });
    }

    if (!projetos || projetos.length === 0) {
      console.log('   ℹ️  Nenhum dado para dashboard');
      return;
    }

    // Formatar dados para dashboard CEO (colunas resumidas)
    const rows = projetos.map((proj: any) => [
      proj.codigo || '',
      proj.cliente || '',
      proj.engenheiro_nome || '',
      proj.area || '',
      proj.status || '',
      proj.percentual_total || '0',
      proj.etapa_atual || '',
      supabase.formatarDataParaExibicao(proj.data_inicio),
      supabase.formatarDataParaExibicao(proj.data_previsao_termino),
      proj.dias_atraso || '0',
      proj.metrica_retrabalho || '0'
    ]);

    // Limpar e escrever
    const fullRange = `${CEO_SHEET_CONFIG.name}!${CEO_SHEET_CONFIG.range}`;
    await sheets.clearSheet(CEO_SHEET_CONFIG.id, fullRange);
    await sheets.writeSheet(CEO_SHEET_CONFIG.id, fullRange, rows);

    console.log(`   ✅ Dashboard CEO atualizado (${rows.length} projetos)`);

  } catch (error: any) {
    console.error(`   ❌ Erro no dashboard CEO:`, error.message);
  }
}

/**
 * Executa sincronização completa
 */
export async function executarSincronizacao(): Promise<void> {
  console.log('\n🔄 ========== SINCRONIZAÇÃO INICIADA ==========');
  console.log(`⏰ ${new Date().toLocaleString('pt-BR')}\n`);

  // Sincronizar cada planilha de engenheiro
  for (const config of SHEETS_CONFIG) {
    await syncProjetosParaPlanilha(config);
  }

  // Sincronizar dashboard CEO
  if (CEO_SHEET_CONFIG) {
    await syncDashboardCEO();
  }

  console.log('\n✅ ========== SINCRONIZAÇÃO CONCLUÍDA ==========\n');
}

/**
 * Limpa e reescreve a planilha: duas execucoes ao mesmo tempo (cron e comando
 * "sync" do dono, ou um cron lento) misturavam as linhas. Todo disparo passa
 * por aqui.
 */
export const sincronizarSemSobreposicao = semSobreposicao('Sincronização Sheets', executarSincronizacao);

/**
 * Configura cron job para sincronização automática
 */
export function iniciarSincronizacaoAutomatica(): void {
  console.log('⏰ Configurando sincronização automática...\n');

  // Executar a cada 5 minutos: */5 * * * *
  // Executar a cada 10 minutos: */10 * * * *
  // Executar a cada hora: 0 * * * *
  
  const cronExpression = process.env.SYNC_CRON_SCHEDULE || '*/5 * * * *';
  
  console.log(`📅 Agendamento: ${cronExpression}`);
  console.log(`   (a cada 5 minutos)\n`);

  // Executar sincronização imediatamente ao iniciar
  console.log('🚀 Executando primeira sincronização...');
  sincronizarSemSobreposicao().catch(error => {
    console.error('❌ Erro na primeira sincronização:', error);
  });

  // Agendar sincronizações periódicas
  cron.schedule(cronExpression, () => {
    sincronizarSemSobreposicao().catch(error => {
      console.error('❌ Erro na sincronização automática:', error);
    });
  });

  console.log('✅ Sincronização automática ativada!\n');
}

// Se executado diretamente (não importado)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Modo de teste: Executando sincronização única\n');
  executarSincronizacao()
    .then(() => {
      console.log('\n✅ Teste concluído!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erro no teste:', error);
      process.exit(1);
    });
}

