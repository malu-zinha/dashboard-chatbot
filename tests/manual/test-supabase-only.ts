#!/usr/bin/env ts-node
// =====================================================
// TESTE GRADUAL: Descobrir qual import trava
// =====================================================

console.log('✅ [1/6] Script iniciou!');

import dotenv from 'dotenv';
console.log('✅ [2/6] dotenv importado!');

dotenv.config();
console.log('✅ [3/6] dotenv.config() executado!');
console.log('✅ SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'FALTA');

console.log('🔍 [4/6] Tentando importar getSupabaseService...');
import { getSupabaseService } from '../../integrations/supabase/supabaseService.ts';
console.log('✅ [4/6] getSupabaseService importado!');

console.log('🔍 [5/6] Tentando chamar getSupabaseService()...');
const supabase = getSupabaseService();
console.log('✅ [5/6] getSupabaseService() chamado!');

console.log('🔍 [6/6] Tentando isConnected()...');
const connected = supabase.isConnected();
console.log('✅ [6/6] isConnected() retornou:', connected);

console.log('\n✅ TESTE CONCLUÍDO! Supabase funciona.\n');
process.exit(0);

