#!/usr/bin/env ts-node
// =====================================================
// TESTE: Apenas messageHandler
// =====================================================

console.log('✅ [1/4] Script iniciou!');

import dotenv from 'dotenv';
dotenv.config();
console.log('✅ [2/4] dotenv configurado!');

console.log('🔍 [3/4] Tentando importar messageHandler...');
import { messageHandler } from '../../chatbot/handlers/messageHandler.ts';
console.log('✅ [3/4] messageHandler importado!');

console.log('🔍 [4/4] Tentando chamar processarMensagem()...');
const result = await messageHandler.processarMensagem('+5511999999999', 'oi');
console.log('✅ [4/4] processarMensagem() funcionou!');

console.log('\n📋 Resposta:');
console.log(result.resposta.substring(0, 100) + '...');

console.log('\n✅ TESTE CONCLUÍDO! messageHandler funciona.\n');
process.exit(0);

