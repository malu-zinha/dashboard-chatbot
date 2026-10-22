// =====================================================
// TESTE: "não cadastrado" × "erro de infraestrutura"
// =====================================================
// O bug do incidente: uma falha de consulta ao Supabase era interpretada como
// ausência de registro, e engenheiros cadastrados recebiam
// "❌ Número não cadastrado" no WhatsApp.
//
// Rodar com: npx tsx tests/test-auth-erro-vs-nao-cadastrado.ts
// =====================================================

import assert from 'node:assert';
import {
  SupabaseService,
  SupabaseUnavailableError,
} from '../integrations/supabase/supabaseService.ts';

let passou = 0;

/**
 * Cliente Supabase falso: reproduz a cadeia
 * .from().select().in().eq() (aguardada direto, devolve lista — a busca por
 * telefone tenta com e sem o nono digito) e devolve o resultado combinado
 * passado aqui, com `data` de uma linha virando lista.
 */
function clienteFake(resultado: { data: unknown; error: unknown } | (() => never)) {
  const query: any = {
    select: () => query,
    in: () => query,
    eq: () => query,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      try {
        if (typeof resultado === 'function') resultado();
        const { data, error } = resultado as { data: unknown; error: unknown };
        return resolve({ data: data == null ? (error ? null : []) : [data], error });
      } catch (e) {
        return reject(e);
      }
    },
  };
  return { from: () => query };
}

/** Monta um SupabaseService com o cliente falso injetado. */
function servicoCom(resultado: Parameters<typeof clienteFake>[0], conectado = true) {
  const svc = Object.create(SupabaseService.prototype) as any;
  svc.supabase = clienteFake(resultado);
  svc.connected = conectado;
  return svc as SupabaseService;
}

async function esperaIndisponivel(nome: string, fn: () => Promise<unknown>) {
  await assert.rejects(
    fn,
    (err: unknown) => {
      assert.ok(
        err instanceof SupabaseUnavailableError,
        `[${nome}] esperava SupabaseUnavailableError, veio ${(err as Error)?.name}`
      );
      return true;
    },
    `[${nome}] deveria ter lançado`
  );
  passou++;
  console.log(`   ✅ ${nome}`);
}

console.log('\n🔍 TESTE: erro de infraestrutura × número não cadastrado\n');

// ---------------------------------------------------------------
// Caso A — consulta OK, engenheiro existe
// ---------------------------------------------------------------
{
  const svc = servicoCom({ data: { eng_id: 'e1', nome: 'Maria' }, error: null });
  const eng = await svc.buscarEngenheiroPorTelefone('+5583999990000');
  assert.ok(eng, 'engenheiro cadastrado deveria ser encontrado');
  assert.strictEqual((eng as any).nome, 'Maria');
  passou++;
  console.log('   ✅ consulta OK + cadastrado -> engenheiro');
}

// ---------------------------------------------------------------
// Caso B — consulta OK, telefone não existe -> null (e SÓ aqui)
// ---------------------------------------------------------------
{
  const svc = servicoCom({ data: null, error: null });
  const eng = await svc.buscarEngenheiroPorTelefone('+5583900000000');
  assert.strictEqual(eng, null, 'telefone inexistente deveria devolver null');
  passou++;
  console.log('   ✅ consulta OK + inexistente -> null (= não cadastrado)');

  const dono = await svc.buscarDonoPorTelefone('+5583900000000');
  assert.strictEqual(dono, null);
  passou++;
  console.log('   ✅ idem para dono');
}

// ---------------------------------------------------------------
// Caso C — Supabase devolveu erro -> NUNCA null
// ---------------------------------------------------------------
await esperaIndisponivel('erro do Supabase -> SupabaseUnavailableError (engenheiro)', () =>
  servicoCom({
    data: null,
    error: { message: 'JWT expired', code: 'PGRST301' },
  }).buscarEngenheiroPorTelefone('+5583999990000')
);

await esperaIndisponivel('erro do Supabase -> SupabaseUnavailableError (dono)', () =>
  servicoCom({
    data: null,
    error: { message: 'Unregistered API key', code: '401' },
  }).buscarDonoPorTelefone('+5583999990000')
);

// ---------------------------------------------------------------
// Caso D — exceção de rede dentro do fetch
// ---------------------------------------------------------------
await esperaIndisponivel('exceção de rede -> SupabaseUnavailableError', () =>
  servicoCom(() => {
    throw new TypeError('fetch failed');
  }).buscarEngenheiroPorTelefone('+5583999990000')
);

// ---------------------------------------------------------------
// Caso E — sem cliente configurado (connected = false)
// ---------------------------------------------------------------
// Antes isto devolvia null e derrubava 100% dos usuários para "não cadastrado".
await esperaIndisponivel('não conectado -> SupabaseUnavailableError (engenheiro)', () =>
  servicoCom({ data: null, error: null }, false).buscarEngenheiroPorTelefone('+5583999990000')
);

await esperaIndisponivel('não conectado -> SupabaseUnavailableError (dono)', () =>
  servicoCom({ data: null, error: null }, false).buscarDonoPorTelefone('+5583999990000')
);

// ---------------------------------------------------------------
// Caso F — o wrapper legado preserva o contrato antigo de propósito
// ---------------------------------------------------------------
{
  const svc = servicoCom({ data: null, error: { message: 'timeout', code: '504' } });
  const eng = await svc.buscarEngenheiroPorWhatsapp('+5583999990000');
  assert.strictEqual(
    eng,
    null,
    'buscarEngenheiroPorWhatsapp deve continuar devolvendo null (usado pelo sync, não pela auth)'
  );
  passou++;
  console.log('   ✅ wrapper legado (sync) mantém contrato antigo');
}

console.log(`\n✅ ${passou} verificações passaram\n`);
