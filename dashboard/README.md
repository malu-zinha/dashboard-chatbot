# Dashboard TecPred

Aplicação Next.js que mostra o andamento dos projetos a partir do que os engenheiros apontam pelo
WhatsApp. É **um dos dois apps deste repositório** — tem `package.json`, variáveis de ambiente e
serviço de deploy próprios, e não compartilha código por import com o chatbot.

Para entender o sistema como um todo (modelo de dados, como progresso ponderado e retrabalho são
calculados, fluxos do WhatsApp), leia o [README da raiz](../README.md). Aqui fica só o que é
específico do dashboard.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · Recharts (gráficos) · jsPDF
(relatório) · `@supabase/ssr` (sessão em cookie)

## Rodando

```bash
npm install
npm run dev      # next dev em 0.0.0.0:3000
npm run build
npm run start
```

`.env.local` nesta pasta:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<sua-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key>
```

As duas `NEXT_PUBLIC_*` são usadas pelo cliente e pelo middleware. A service role key é usada
**somente no servidor**, nas rotas `/api/admin/*`.

> **Sem as duas `NEXT_PUBLIC_*`, o dashboard sobe com dados falsos** de `lib/mockData.ts` e Realtime
> desligado. Aparece um warning no console, mas a tela parece normal — é fácil passar meia hora
> analisando números inventados. Se os dados parecerem estranhos, confira primeiro se o `.env.local`
> está lido.

## Habilitar Realtime no Supabase

A tela principal se atualiza sozinha quando alguém aponta algo no WhatsApp. Isso depende de
**replication habilitada no Supabase** — em *Database → Replication*, habilite exatamente estas três
tabelas:

- `engenheiros_projetos`
- `projetos`
- `retrabalho_projetos`

São as que `components/DashboardClient.tsx` assina. Sem isso o dashboard funciona, mas só atualiza
com refresh manual — e o sintoma (dados velhos, sem erro nenhum) não aponta para a causa.

## Rotas

| Rota | O que é |
|---|---|
| `/` e `/inicio` | A tela principal — as duas renderizam o mesmo `DashboardClient` |
| `/login` | Email e senha via Supabase Auth |
| `/admin` | Só owner ativo; qualquer outro é redirecionado para `/` |
| `/test` | Devolve `OK`. Health check |

## A tela principal

Página única e longa, com modais. Cada KPI abre uma tabela detalhada, e os modais têm modo tela cheia
(`components/ModalShell.tsx`).

| Bloco | Componente | Fonte do dado |
|---|---|---|
| Criar / atribuir projeto | `CriarProjeto`, `AtribuirTask` | RPCs `criar_projeto`, `dashboard_atribuir_projeto_com_pavimentos` |
| 5 KPIs + progresso geral | `KPICard` | `vw_bloco1_visao_geral` |
| Pizza de status | `ProjetosStatusChart` | `vw_grafico_projetos_status` |
| Carga por engenheiro | `CargaTrabalhoChart` | `vw_bloco3_carga_trabalho` |
| Atrasos | `AtrasosTable` | `vw_bloco2_atrasos_engenheiro` |
| Produção no período (**só owner**) | `ProducaoPeriodoCard` | `vw_dashboard_producao_apontamentos` |
| Retrabalho | `RetrabalhoCard` + gráficos | views `vw_retrabalho_*` |

`ProjetosTable` é o maior componente do app e é instanciado quatro vezes, mudando só o
`initialFilter` (`all`, `concluido`, `em_execucao`, `atrasado`). De lá saem as ações: transferir
responsável, excluir atribuição ou projeto, ver detalhes, ver retrabalho e gerar o relatório PDF.
`EngenheirosExecucaoTable` vira um kanban por engenheiro no modo tela cheia.

## Acesso

Supabase Auth (email e senha), em três camadas:

1. **`middleware.ts`** — sem sessão, redireciona para `/login`. Rotas `/api/*` não são
   redirecionadas: devolvem 401/403. Se as variáveis de ambiente não estiverem definidas o middleware
   **não bloqueia nada** (decisão deliberada, para não derrubar o desenvolvimento local).
2. **RLS permissiva** — a policy é `for all to authenticated using (true)` em todas as tabelas:
   qualquer usuário logado lê e escreve tudo. `anon` não lê nada. A exceção é `user_profiles`, onde
   cada um lê só o próprio perfil e a escrita é restrita a `service_role` — é isso que impede alguém
   se promover a owner.
3. **Papel owner** — `user_profiles.role = 'owner'` com `status = 'active'`. No servidor, todas as
   rotas `/api/admin/*` passam por `guardOwnerRoute` (`lib/apiGuard.ts`) e usam a service key. No
   cliente, `hooks/useIsOwnerActive.ts` apenas **esconde UI** — não é proteção.

Ou seja: a separação real é **logado vs. não logado**, mais o papel de owner aplicado na aplicação.
Não há isolamento por engenheiro no banco.

`lib/supabaseServer.ts` distingue `unauthorized` (403) de `unavailable` (503), para um banco fora do
ar não parecer falta de permissão.

## `/admin`

Duas responsabilidades:

- **Logins da plataforma** (`user_profiles`) — criar, listar, ativar e desativar
- **Engenheiros do chatbot** (`engenheiros`) — nome, telefone, exclusivo, ativo

É por aqui que um número passa a ser reconhecido no WhatsApp. Cadastrar o engenheiro aqui é o que
faz o bot deixar de responder "número não cadastrado".

## Deploy

Railway, serviço próprio (`railway.json`):

```
build:  npm install && (rm -rf .next/cache/* || true) && npm run build
deploy: npm run start
```

O `rm -rf .next/cache/*`, o `config.cache = false` no webpack e o `Cache-Control: no-store` em
`next.config.js` existem porque o volume persistente do Railway servia bundles antigos. É também por
isso que quase toda página declara `export const dynamic = 'force-dynamic'`. **Não remova esses
ajustes sem testar um deploy real** — o sintoma é o app servir código de versões anteriores.

`vercel.json` existe, mas a Vercel é caminho alternativo/legado. Railway é o que está em uso.

## Coisas a saber antes de mexer

- **`lib/secrets.ts` é cópia deliberada** de `logic/security/redactSecrets.ts` e
  `logic/security/envSecret.ts` da raiz, porque o `tsconfig` do Next não alcança pastas fora de
  `dashboard/`. Se corrigir um, corrija o outro.
- **O card "Média por Horas"** do retrabalho é média aritmética simples dos percentuais por
  engenheiro, **não ponderada por horas** — então ele diverge do "% Geral TecPred", que é ponderado.
  Não é bug de dado.
- **O "valor da hora"** da produção por período é digitado na tela e **não é persistido**.
- **Componentes não referenciados:** `MemoriaisDescritivosTab.tsx` (tela planejada, nunca ligada) e
  `RetrabalhoPorProjetoTable.tsx` (absorvido pelo `RetrabalhoCard`).
- **Funções não chamadas** em `lib/supabase.ts`: `fetchRetrabalhoGeralLegado`,
  `fetchRetrabalhoPorProjetoLegado`, `fetchRetrabalhoTaxaPorAreaLegado` e
  `fetchProducaoEngenheiroPeriodo`. As três "legado" recalculavam métricas quando as views não
  existiam e devolvem horas zeradas — não use como referência.
- **Os testes do dashboard ficam na raiz**, em `tests/test-dashboard-*.ts`, e validam o código
  **lendo os arquivos como texto** com regex, não importando os módulos. Rodam com
  `npx tsx tests/<arquivo>.ts`.
