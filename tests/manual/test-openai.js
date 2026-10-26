import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 Testando conexão com OpenAI...\n');

// Verificar se a chave existe
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY não encontrada no .env');
  process.exit(1);
}

console.log('✅ Chave encontrada:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');

// Testar conexão
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

try {
  console.log('\n📡 Testando conexão com a API...');
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "teste" }],
    max_tokens: 5
  });

  console.log('✅ Conexão OK! API funcionando perfeitamente.');
  console.log('💰 Sua conta tem créditos disponíveis.');
  
} catch (error) {
  console.error('\n❌ ERRO ao conectar:', error.message);
  
  if (error.message.includes('API key')) {
    console.error('\n🔑 Solução: Sua chave da API está inválida.');
    console.error('   → Gere uma nova em: https://platform.openai.com/api-keys');
  } else if (error.message.includes('insufficient_quota')) {
    console.error('\n💰 Solução: Sua conta não tem créditos.');
    console.error('   → Adicione créditos em: https://platform.openai.com/account/billing');
  } else if (error.message.includes('Connection error')) {
    console.error('\n🌐 Solução: Problema de conexão.');
    console.error('   → Verifique sua internet');
    console.error('   → Verifique se a chave está correta no .env');
  }
  
  process.exit(1);
}

