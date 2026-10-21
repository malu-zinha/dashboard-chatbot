// =====================================================
// SONDA: o que a chave anon (publica) consegue ler?
// =====================================================
// Rodar com: npx tsx scripts/sondar-acesso-anon.ts
//
// So leitura. Lista todas as tabelas e views pela API com a chave de
// servico e pergunta, com a chave anon, quantas linhas cada uma devolve.
// Sai com codigo 1 se alguma relacao entregar linhas ao anon.
//
// Usa SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY do .env.
// Nao chama nenhuma funcao (RPC): algumas apagam dados.
// =====================================================

import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error('Faltam SUPABASE_URL, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(2);
}

async function listarRelacoes(): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: service! } });
  if (!res.ok) throw new Error(`OpenAPI respondeu ${res.status}`);
  const spec = (await res.json()) as { paths: Record<string, unknown> };
  return Object.keys(spec.paths)
    .filter((p) => p !== '/' && !p.startsWith('/rpc/'))
    .map((p) => p.slice(1))
    .sort();
}

async function linhasVisiveisAoAnon(relacao: string): Promise<number | string> {
  const res = await fetch(`${url}/rest/v1/${relacao}?select=*`, {
    headers: { apikey: anon!, Prefer: 'count=exact', Range: '0-0' },
  });
  // 401/403/404 = anon nao alcanca a relacao, que e o esperado
  if (!res.ok && res.status !== 206) return `HTTP ${res.status}`;
  const total = res.headers.get('content-range')?.split('/')[1];
  return total === undefined || total === '*' ? 0 : Number(total);
}

const relacoes = await listarRelacoes();
const abertas: Array<[string, number]> = [];

for (const relacao of relacoes) {
  const resultado = await linhasVisiveisAoAnon(relacao);
  if (typeof resultado === 'number' && resultado > 0) abertas.push([relacao, resultado]);
}

console.log(`\n🔎 ${relacoes.length} relacoes sondadas com a chave anon\n`);
if (abertas.length === 0) {
  console.log('✅ Nenhuma entrega linhas sem login.\n');
} else {
  console.log(`❌ ${abertas.length} entregam dados sem login:`);
  for (const [relacao, linhas] of abertas) console.log(`   - ${relacao}: ${linhas} linhas`);
  console.log('');
  process.exit(1);
}
