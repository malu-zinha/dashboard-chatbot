#!/usr/bin/env ts-node
// =====================================================
// DIAGNÓSTICO: Verificar variáveis do .env
// =====================================================

import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          🔍 DIAGNÓSTICO DO .env                           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Verificar se .env existe
if (fs.existsSync('.env')) {
  console.log('✅ Arquivo .env encontrado\n');
} else {
  console.log('❌ Arquivo .env não encontrado!\n');
  process.exit(1);
}

// Variáveis essenciais
const essentialVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
  'GOOGLE_APPLICATION_CREDENTIALS': process.env.GOOGLE_APPLICATION_CREDENTIALS,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
};

// Variáveis de planilhas
const sheetVars = {
  'GOOGLE_SHEETS_ID': process.env.GOOGLE_SHEETS_ID,
  'GOOGLE_SHEETS_ENGINEER_ID': process.env.GOOGLE_SHEETS_ENGINEER_ID,
  'GOOGLE_SHEETS_ENGINEER_SHEET': process.env.GOOGLE_SHEETS_ENGINEER_SHEET,
  'GOOGLE_SHEETS_ENGINEER_RANGE': process.env.GOOGLE_SHEETS_ENGINEER_RANGE,
  'GOOGLE_SHEETS_ENG1_ID': process.env.GOOGLE_SHEETS_ENG1_ID,
  'GOOGLE_SHEETS_ENG1_WHATSAPP': process.env.GOOGLE_SHEETS_ENG1_WHATSAPP,
};

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📋 VARIÁVEIS ESSENCIAIS:\n');

for (const [key, value] of Object.entries(essentialVars)) {
  if (value) {
    const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
    console.log(`✅ ${key}`);
    console.log(`   ${displayValue}\n`);
  } else {
    console.log(`❌ ${key} - NÃO CONFIGURADA\n`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('📊 VARIÁVEIS DE PLANILHAS:\n');

for (const [key, value] of Object.entries(sheetVars)) {
  if (value) {
    const displayValue = value.length > 40 ? value.substring(0, 40) + '...' : value;
    console.log(`✅ ${key}`);
    console.log(`   ${displayValue}\n`);
  } else {
    console.log(`⚪ ${key} - não configurada\n`);
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verificar arquivo credentials.json
const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';
if (fs.existsSync(credsPath)) {
  console.log(`✅ Arquivo ${credsPath} encontrado\n`);
} else {
  console.log(`❌ Arquivo ${credsPath} NÃO encontrado!\n`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🎯 RESUMO:\n');

const missingEssential = Object.entries(essentialVars)
  .filter(([_, value]) => !value)
  .map(([key, _]) => key);

if (missingEssential.length === 0) {
  console.log('✅ Todas as variáveis essenciais configuradas!\n');
} else {
  console.log('❌ Variáveis essenciais faltando:');
  missingEssential.forEach(key => console.log(`   - ${key}`));
  console.log('');
}

const hasAnySheet = Object.values(sheetVars).some(v => !!v);
if (hasAnySheet) {
  console.log('✅ Pelo menos uma planilha configurada\n');
} else {
  console.log('⚠️  Nenhuma planilha configurada\n');
}

console.log('╚════════════════════════════════════════════════════════════╝\n');

