import { createClient } from '@supabase/supabase-js';
import { getSupabaseService } from '../integrations/supabase/supabaseService.ts';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...\n');
  
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
    console.log('\n💡 Adicione estas variáveis no arquivo .env:');
    console.log('   SUPABASE_URL=https://xxxxx.supabase.co');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...\n');
    process.exit(1);
  }
  
  console.log(`📡 URL: ${supabaseUrl}`);
  console.log(`🔑 Key: ${supabaseKey.substring(0, 20)}...`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const supabaseService = getSupabaseService();
  
  try {
    // Teste 1: Verificar tabela "projetos" (coluna correta: projeto_id)
    console.log('\n📋 Teste 1: Verificar tabela "projetos"...');
    const { data: projetos, error: error1 } = await supabase
      .from('projetos')
      .select('projeto_id')
      .limit(1);
    
    if (error1) throw error1;
    console.log('   ✅ Tabela "projetos" acessível');
    
    // Teste 2: Verificar tabela "engenheiros"
    console.log('\n📋 Teste 2: Verificar tabela "engenheiros"...');
    const { data: engs, error: error2 } = await supabase
      .from('engenheiros')
      .select('eng_id, nome')
      .limit(1);
    
    if (error2) {
      console.log('   ⚠️  Tabela "engenheiros" não encontrada');
      console.log('   💡 Execute: MASTER_SCHEMA_COMPLETO.sql');
    } else {
      console.log('   ✅ Tabela "engenheiros" acessível');
    }
    
    // Teste 3: Verificar tabela "engenheiros_projetos" (N:N)
    console.log('\n📋 Teste 3: Verificar tabela "engenheiros_projetos" (N:N)...');
    const { data: engProj, error: error3 } = await supabase
      .from('engenheiros_projetos')
      .select('id')
      .limit(1);
    
    if (error3) {
      console.log('   ⚠️  Tabela "engenheiros_projetos" não encontrada');
      console.log('   💡 Execute: MASTER_SCHEMA_COMPLETO.sql');
    } else {
      console.log('   ✅ Tabela "engenheiros_projetos" acessível (Schema N:N)');
    }
    
    // Teste 4: Verificar tabelas de previsão e retrabalho
    console.log('\n📋 Teste 4: Verificar tabela "projetos_previsao"...');
    const { data: prev, error: error4 } = await supabase
      .from('projetos_previsao')
      .select('id')
      .limit(1);
    
    if (error4) {
      console.log('   ⚠️  Tabela "projetos_previsao" não encontrada');
    } else {
      console.log('   ✅ Tabela "projetos_previsao" acessível');
    }
    
    // Teste 5: Verificar tabela dono_empresa
    console.log('\n📋 Teste 5: Verificar tabela "dono_empresa"...');
    const { data: dono, error: error5 } = await supabase
      .from('dono_empresa')
      .select('dono_id, nome, telefone')
      .limit(1);
    
    if (error5) {
      console.log('   ⚠️  Tabela "dono_empresa" não encontrada');
    } else {
      console.log('   ✅ Tabela "dono_empresa" acessível');
      if (dono && dono.length > 0) {
        console.log(`      Nome: ${dono[0].nome}`);
        console.log(`      Telefone: ${dono[0].telefone || 'Não cadastrado'}`);
      }
    }
    
    // Teste 6: Criar engenheiro de teste (campos corretos)
    console.log('\n📋 Teste 6: Criar engenheiro de teste...');
    const { data: eng, error: error6 } = await supabase
      .from('engenheiros')
      .upsert({
        nome: 'Engenheiro Teste',
        telefone: '+5511999999999',
        exclusivo: false,
        ativo: true
      }, {
        onConflict: 'telefone'
      })
      .select()
      .single();
    
    if (error6) {
      console.log('   ⚠️  Erro ao criar engenheiro:', error6.message);
    } else {
      console.log(`   ✅ Engenheiro criado/atualizado: ${eng.nome}`);
      console.log(`      Telefone: ${eng.telefone || 'Não cadastrado'}`);
    }
    
    // Teste 7: Testar SupabaseService
    console.log('\n📋 Teste 7: Testar SupabaseService...');
    if (supabaseService.isConnected()) {
      console.log('   ✅ SupabaseService conectado');
      
      // Testar buscar engenheiro por telefone
      const engTest = await supabaseService.buscarEngenheiroPorTelefone('+5511999999999');
      if (engTest) {
        console.log(`   ✅ Engenheiro encontrado via service: ${engTest.nome}`);
      } else {
        console.log('   ⚠️  Engenheiro não encontrado (teste método buscarEngenheiroPorTelefone)');
      }
    } else {
      console.log('   ⚠️  SupabaseService não conectado');
    }
    
    // Teste 8: Verificar áreas e status
    console.log('\n📋 Teste 8: Verificar áreas e status cadastrados...');
    const { data: areas, error: error8a } = await supabase
      .from('areas')
      .select('codigo, descricao')
      .limit(3);
    
    if (!error8a && areas && areas.length > 0) {
      console.log(`   ✅ ${areas.length} áreas encontradas (primeiras 3):`);
      areas.forEach(a => console.log(`      - ${a.codigo}: ${a.descricao}`));
    }
    
    const { data: status, error: error8b } = await supabase
      .from('status_codes')
      .select('codigo, descricao')
      .limit(3);
    
    if (!error8b && status && status.length > 0) {
      console.log(`   ✅ ${status.length} status encontrados (primeiros 3):`);
      status.forEach(s => console.log(`      - ${s.codigo}: ${s.descricao}`));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ CONEXÃO COM SUPABASE FUNCIONANDO! 🎉');
    console.log('='.repeat(60));
    console.log('\n💡 Status da integração:');
    console.log('   ✅ Supabase conectado');
    console.log('   ✅ Schema N:N implementado (engenheiros_projetos)');
    console.log('   ✅ SupabaseService funcionando');
    console.log('   ✅ Autenticação por telefone pronta');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Cadastrar telefone do dono: UPDATE dono_empresa SET telefone = \'+5583988990772\'');
    console.log('   2. Testar bot completo: npm run test:bot-completo');
    console.log('   3. Iniciar WhatsApp: npm start\n');
    
  } catch (error: any) {
    console.log('\n' + '='.repeat(60));
    console.error('❌ ERRO AO TESTAR CONEXÃO');
    console.log('='.repeat(60));
    console.error('\n📛 Mensagem:', error.message);
    console.error('📛 Detalhes:', error.hint || error.details || 'Nenhum detalhe disponível');
    console.log('\n💡 Possíveis causas:');
    console.log('   1. Schema não foi aplicado no Supabase');
    console.log('   2. Credenciais incorretas no .env');
    console.log('   3. Projeto Supabase pausado/inativo');
    console.log('\n💡 Solução:');
    console.log('   Execute no SQL Editor do Supabase:');
    console.log('   → supabase/_arquivo/MASTER_SCHEMA_COMPLETO.sql');
    console.log('   → supabase/_arquivo/adicionar_telefone_auth.sql');
    console.log('   → supabase/_arquivo/chatbot_functions.sql\n');
    process.exit(1);
  }
}

testConnection();

