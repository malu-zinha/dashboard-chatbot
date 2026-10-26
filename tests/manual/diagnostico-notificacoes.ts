import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isPendente(value: unknown): boolean {
  const n = Number(value ?? 0);
  return !Number.isFinite(n) || n < 100;
}

async function main() {
  console.log(`WHATSAPP_PROVIDER=${process.env.WHATSAPP_PROVIDER || 'development'}`);
  console.log(`TWILIO_CONFIG=${process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER ? 'presente' : 'incompleta'}`);

  const { data, error } = await supabase
    .from('engenheiros_projetos')
    .select(`
      id,
      percentual_ponderado,
      ativo,
      engenheiros!inner(eng_id,nome,telefone,ativo),
      projetos!inner(codigo_projeto,cliente,ativo),
      areas!engenheiros_projetos_area_id_fkey!inner(descricao)
    `)
    .eq('ativo', true)
    .eq('projetos.ativo', true)
    .eq('engenheiros.ativo', true);

  if (error) throw error;

  const porEngenheiro = new Map<string, { nome: string; telefone: string | null; pendentes: string[] }>();

  for (const atrib of data ?? []) {
    if (!isPendente((atrib as any).percentual_ponderado)) continue;

    const engenheiro: any = (atrib as any).engenheiros;
    const projeto: any = (atrib as any).projetos;
    const area: any = (atrib as any).areas;

    if (!porEngenheiro.has(engenheiro.eng_id)) {
      porEngenheiro.set(engenheiro.eng_id, {
        nome: engenheiro.nome,
        telefone: engenheiro.telefone ?? null,
        pendentes: [],
      });
    }

    porEngenheiro.get(engenheiro.eng_id)!.pendentes.push(
      `${projeto.codigo_projeto}/${area.descricao}/${Number((atrib as any).percentual_ponderado ?? 0)}%`
    );
  }

  const engenheiros = Array.from(porEngenheiro.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  const semTelefone = engenheiros.filter((e) => !e.telefone);

  console.log(`engenheiros_com_pendencias=${engenheiros.length}`);
  console.log(`engenheiros_sem_telefone=${semTelefone.length}`);

  for (const eng of engenheiros) {
    console.log(`- ${eng.nome} | telefone=${eng.telefone ? 'sim' : 'nao'} | pendentes=${eng.pendentes.length}`);
    console.log(`  ${eng.pendentes.slice(0, 8).join(', ')}${eng.pendentes.length > 8 ? ', ...' : ''}`);
  }

  const desde = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const { data: notificacoes, error: notifError } = await supabase
    .from('notificacoes_whatsapp')
    .select('tipo,enviada,tentativas,data_envio,created_at,erro_envio')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(20);

  if (notifError) throw notifError;

  console.log(`notificacoes_tabela_ultimas_72h=${notificacoes?.length ?? 0}`);
  for (const notif of notificacoes ?? []) {
    console.log(
      `- ${notif.created_at} | tipo=${notif.tipo} | enviada=${notif.enviada} | tentativas=${notif.tentativas} | data_envio=${notif.data_envio ?? 'NULL'} | erro=${notif.erro_envio ?? 'NULL'}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
