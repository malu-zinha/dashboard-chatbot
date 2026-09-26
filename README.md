# TecPred — Chatbot de apontamento + Dashboard

Sistema de acompanhamento de projetos de engenharia da TecPred. Um bot de WhatsApp coleta o
apontamento diário dos engenheiros (o que foi feito, quantas horas, quanto foi retrabalho, quais
etapas concluíram) e um dashboard web transforma isso em indicadores de progresso, retrabalho,
carga de trabalho e atraso.

**O Supabase (Postgres) é a fonte de verdade.** Todo o resto lê ou escreve nele. A sincronização com
Google Sheets existe, mas é legado e unidirecional (banco → planilha), apenas para visualização.

## Índice

1. [Os dois apps deste repositório](#os-dois-apps-deste-repositório)
2. [Setup local](#setup-local)
3. [Variáveis de ambiente](#variáveis-de-ambiente)
4. [Banco de dados: como montar](#banco-de-dados-como-montar)
5. [Modelo de dados](#modelo-de-dados)
6. [Como os números são calculados](#como-os-números-são-calculados)
7. [Fluxos no WhatsApp](#fluxos-no-whatsapp)
8. [Dashboard](#dashboard)
9. [Testes](#testes)
10. [Deploy](#deploy)
11. [Convenções do projeto](#convenções-do-projeto)
12. [Limitações conhecidas](#limitações-conhecidas)

---

## Os dois apps deste repositório

São **duas aplicações independentes** no mesmo repo, com `package.json`, dependências, variáveis de
ambiente e deploy separados. Não compartilham código por import — integram-se pelo banco.

| | Chatbot | Dashboard |
|---|---|---|
| Onde | raiz do repo | `dashboard/` |
| `name` | `whatsapp-sheets-bot` | `tecpred-dashboard-evandro` |
| Stack | Node 20 + TypeScript (ESM), Express, Twilio | Next.js 14 (App Router), React 18, Tailwind, Recharts, jsPDF |
| Roda com | `npm start` (porta `PORT`, default 3000) | `npm run dev` / `npm run start` (porta 3000) |
| Build | **não compila** — roda TypeScript direto com `tsx` | `next build` |
| Deploy | Railway (serviço próprio) | Railway (outro serviço) |

Estrutura do chatbot:

```
src/server-twilio.ts      entrypoint de produção: Express + webhook Twilio
src/index.ts              entrypoint legado: whatsapp-web.js com QR Code (uso local)
chatbot/flows/            máquinas de estado da conversa
  engineerProjectFlow.ts    fluxo do engenheiro (~2200 linhas)
  ownerFlow.ts              fluxo do dono
chatbot/handlers/
  messageHandler.ts         roteamento, autenticação e sessões
  sheetsBot.ts              cliente whatsapp-web.js (só no caminho legado)
  whisperService.ts         transcrição de áudio (só no caminho legado)
logic/                    funções puras, sem I/O — é aqui que mora a lógica testável
integrations/supabase/    acesso ao banco (supabaseService.ts)
integrations/sheets/      sincronização legada com Google Sheets
integrations/cron/        agendamentos (notificações e sync)
supabase/migrations/      SQL do schema
tests/                    78 arquivos de teste (64 deles .ts)
```

> Uma nota sobre `logic/`: o dashboard tem uma **cópia deliberada** de
> `logic/security/redactSecrets.ts` em `dashboard/lib/secrets.ts`, porque o `tsconfig` do Next não
> alcança pastas fora de `dashboard/`. Se mexer em um, mexa no outro.

---

## Setup local

**Pré-requisitos**

- Node 20 (não há `engines` nem `.nvmrc`; o `nixpacks.toml` fixa `nodejs_20`)
- Projeto Supabase com as migrations aplicadas (ver [seção 4](#banco-de-dados-como-montar))
- Conta Twilio, se for testar envio real de WhatsApp
- Service account do Google Cloud, **só** se for usar a sincronização com Sheets

**Instalação** — são dois `npm install`:

```bash
npm install                      # chatbot, na raiz
cd dashboard && npm install      # dashboard
```

**Rodando o chatbot**

```bash
npm run dev          # nodemon + tsx src/server-twilio.ts (webhook Twilio)
npm start            # produção: tsx src/server-twilio.ts
npm run build        # NÃO gera dist/ — o tsconfig usa noEmit, então isto é só typecheck
```

O servidor expõe `GET /` e `GET /health` (health check com status do banco),
`POST /webhook/whatsapp` (mensagens) e `POST /webhook/status` (callbacks de entrega do Twilio).

Para desenvolvimento sem Twilio, deixe `WHATSAPP_PROVIDER=development`: as respostas vão para o
console em vez de serem enviadas.

Existe também o caminho legado com QR Code, útil para testar no seu próprio WhatsApp:

```bash
npm run dev:whatsapp-web    # src/index.ts, imprime QR Code no terminal
```

É o **único** caminho que transcreve áudio (via Whisper). O servidor Twilio de produção lê apenas o
campo `Body` do webhook e ignora mídia.

**Rodando o dashboard**

```bash
cd dashboard
npm run dev      # next dev em 0.0.0.0:3000
```

Sem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, o dashboard sobe com **dados
falsos** de `dashboard/lib/mockData.ts` e Realtime desligado — útil para mexer na UI, enganoso se
você achar que está vendo dados reais.

---

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz. O dashboard usa um `.env.local` próprio dentro de
`dashboard/`.

### Chatbot (raiz)

| Variável | Para quê | Obrigatória | Default |
|---|---|---|---|
| `SUPABASE_URL` | Projeto Supabase | **Sim, na prática** — sem ela nenhuma autenticação resolve e todo usuário recebe "serviço indisponível" | `''` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (ignora RLS) | **Sim, na prática** | `''` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Caminho do JSON da service account | **Sim** — o boot faz `exit(1)` se faltar | — |
| `GOOGLE_SHEETS_ENGINEER_ID` | Planilha do engenheiro | **Sim** — `exit(1)` se faltar | `''` |
| `GOOGLE_SHEETS_ENGINEER_NAME` | Nome da aba | **Sim** — `exit(1)` se faltar | `Engenheiro(a)` |
| `GOOGLE_SHEETS_ENGINEER_RANGE` | Intervalo lido | Não | `A1:AE1000` |
| `WHATSAPP_PROVIDER` | `development` \| `twilio` \| `meta` | Não | `development` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Credenciais Twilio | Se `WHATSAPP_PROVIDER=twilio` (a falta só gera warning no boot) | `''` |
| `META_ACCESS_TOKEN` / `META_PHONE_NUMBER_ID` / `META_API_VERSION` | Credenciais Meta | Se `WHATSAPP_PROVIDER=meta` | `''` / `''` / `v18.0` |
| `PORT` | Porta do Express | Não | `3000` |
| `OPENAI_API_KEY` | Whisper (áudio, caminho legado) | Não | — |
| `SYNC_CRON_SCHEDULE` | Frequência do sync banco → Sheets | Não | `*/5 * * * *` |
| `ENABLE_PROJECT_CLEANUP_CRON` | Liga a limpeza semestral de projetos | Não | desligado (ativa só com a string `true`) |
| `GOOGLE_SHEETS_ENG1_*` … `ENG3_*` | Planilhas adicionais por engenheiro | Não | fallback para as `_ENGINEER_` |
| `GOOGLE_SHEETS_CEO_ID` / `_NAME` / `_RANGE` | Planilha consolidada | Não | — / `Dashboard` / `A2:Z1000` |

Atenção a duas armadilhas:

- A validação de boot checa se a **variável** está definida, não se o arquivo de credenciais
  existe. Com `GOOGLE_APPLICATION_CREDENTIALS=./credentials.json` e nenhum `credentials.json` no
  disco, o servidor sobe normalmente e só falha quando tenta falar com o Sheets.
- `GOOGLE_SHEETS_ENGINEER_ID` e `_NAME` são exigidas no boot mesmo que você não use Sheets. Para
  rodar só com Supabase, defina qualquer valor nelas.

### Dashboard (`dashboard/.env.local`)

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente e middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente e middleware (sujeita a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Apenas no servidor, nas rotas `/api/admin/*` |

---

## Banco de dados: como montar

Não há `supabase/config.toml` nem migrations versionadas pelo CLI. A prática real — declarada nos
cabeçalhos dos próprios arquivos — é **colar o SQL no SQL Editor do Supabase, na ordem**:

1. `supabase/MASTER_SCHEMA_COMPLETO.sql` — schema base (tabelas do núcleo)
2. `supabase/migrations/*.sql` — 28 arquivos, em ordem cronológica pelo nome
3. Os arquivos soltos em `supabase/` que definem funções e views usadas em produção:
   `chatbot_functions.sql`, `functions_dono.sql`, `seed_complemento_chatbot.sql`,
   `criar_tipos_projeto.sql`, `CRIAR_VIEWS.sql`, `triggers_e_views.sql`

Três coisas que você precisa saber antes de confiar num banco novo:

**Parte das RPCs vive fora de `migrations/`.** Funções que o código chama em produção —
`cadastrar_engenheiro`, `atribuir_area_projeto`, `buscar_meus_projetos`, `listar_areas_disponiveis`,
`gerar_proximo_codigo_projeto`, `dono_distribuir_tarefa` e outras — estão apenas nos arquivos soltos
listados acima. Aplicar só `migrations/` deixa o chatbot quebrado em tempo de execução.

**O owner inicial é um UUID fixo.** `supabase/migrations/20260601_auth_dashboard.sql` insere o
primeiro `user_profiles` com role `owner` a partir de um UUID hardcoded. Num Supabase novo esse
insert não encontra ninguém e **o projeto nasce sem owner** — o dashboard sobe, mas `/admin` e tudo
que depende de owner ficam inacessíveis. Crie o usuário no Auth e insira o `user_profiles`
manualmente.

**`supabase/sql-editor-patches/` pode divergir a semântica.** O patch
`20260804_corrigir_filtros_instancia_legada.sql` redefine funções de cálculo de progresso para
tratar `eng_projeto_id IS NULL` como instância legada em vez de coringa. Bancos que receberam o
patch e bancos que não receberam **calculam progresso de forma diferente**. Não há como saber pelo
repositório qual é o estado de um banco; confira as funções antes de investigar divergência de
percentual.

Há ainda dezenas de `.sql` soltos em `supabase/` (`CORRIGIR_RETRABALHO*.sql`,
`RECRIAR_TODAS_VIEWS.sql`, `views_retrabalho_apenas.sql`, `NOVAS_VIEWS_RETRABALHO.sql`…) com
versões **antigas e conflitantes** das mesmas views. Quando houver dúvida sobre qual definição vale,
a resposta é: **a mais recente em `supabase/migrations/`**.

---

## Modelo de dados

### `engenheiros_projetos` é o centro de tudo

Uma linha de `engenheiros_projetos` é uma **atribuição**: um engenheiro responsável por uma
disciplina de um projeto. Quase tudo pendura nela por `eng_projeto_id` — apontamentos diários,
prazos, pavimentos, etapas, histórico de status, tasks.

```
engenheiros ──┐
projetos ─────┼──> engenheiros_projetos (atribuição) ──┬──> projetos_previsao   (previsão e feito do dia)
areas ────────┘         │                              ├──> retrabalho_projetos (horas do dia)
                        │                              ├──> prazos
                        │                              ├──> projeto_pavimentos ──> pavimento_etapas
                        │                              ├──> projeto_etapas_globais
                        │                              └──> status_historico
                        └──> instancia_label, complemento_area_ref_id
```

### Vocabulário

- **Disciplina** = uma linha de `areas` (`ELETRICO`, `HIDRAULICO`, `COMPATIBILIZACAO`,
  `COMPLEMENTO`, `DRT`…). A UI diz "disciplina"; as views expõem `area_descricao`. `areas.area_id` é
  **UUID**.
- **Atribuição** = engenheiro × projeto × disciplina × instância.
- **Instância** = Compatibilização e Complemento podem se repetir no mesmo projeto (várias rodadas),
  cada uma com seu `instancia_label` e sua própria árvore de pavimentos e etapas. É por isso que
  `projeto_pavimentos` e `projeto_etapas_globais` têm `eng_projeto_id`: sem ele, concluir uma rodada
  de Compatibilização concluiria todas.
- **Pavimento** = subdivisão física ("Térreo", "Tipo", "Cobertura"), com peso.
- **Etapa global** = trabalho que não pertence a nenhum pavimento, com peso.

### Tabelas principais

| Tabela | O que guarda |
|---|---|
| `engenheiros` | Cadastro. `telefone` é a chave de autenticação no WhatsApp |
| `projetos` | `codigo_projeto`, cliente, `percentual_ponderado` (roll-up) |
| `areas` | As disciplinas, com `tempo_trabalho_dias` (base das estimativas de carga) |
| `engenheiros_projetos` | **A atribuição.** Datas, `percentual_ponderado`, `instancia_label` |
| `projetos_previsao` | Um registro por atribuição por dia: previsão da manhã e feito da noite |
| `retrabalho_projetos` | Um registro por atribuição por dia: `horas_trabalhadas_total`, `horas_retrabalho`, motivo. Apesar do nome, é o **apontamento diário de horas** |
| `prazos` | As quatro datas (início, início esperado pelo cliente, prazo interno, prazo cliente) |
| `projeto_pavimentos` / `pavimento_etapas` | A árvore de progresso, com pesos |
| `projeto_etapas_globais` | Etapas sem pavimento, com peso |
| `area_pavimentos_template` / `area_etapas_template` | Templates por disciplina, usados para semear uma atribuição nova |
| `dono_empresa` | Cadastro do dono (outro fluxo no WhatsApp) |
| `evandro_distribuicao_tasks` | Distribuição de tarefas feita pelo dono |
| `notificacoes_whatsapp` | Fila de notificações proativas |
| `status_historico` | Auditoria de mudança de status (base do cálculo de paralisação) |
| `user_profiles` | Login do dashboard: `role` = `owner` \| `engenheiro` |

### Duas colunas que enganam

- **`engenheiros_projetos.percentual_andamento` está morta.** O valor real é
  `percentual_ponderado`. Para não quebrar o front, as views expõem um campo *chamado*
  `percentual_andamento` que na verdade lê `percentual_ponderado` — nome igual, fonte diferente.
- **`status_codes` / `status_id` são vestigiais.** Ainda são populados, mas o status exibido não vem
  deles: é derivado do percentual (ver abaixo).

---

## Como os números são calculados

### Progresso ponderado

Ninguém digita percentual. Ele é **derivado de etapas marcadas como concluídas**, cada uma com peso,
em dois níveis:

```
percentual da disciplina =
    Σ  peso_do_pavimento × (Σ pesos das etapas concluídas dentro dele ÷ 100)
  + Σ  peso_das_etapas_globais concluídas
```

Nível 1 são os pavimentos **e** as etapas globais; seus pesos somam 100. Nível 2 são as etapas
dentro de cada pavimento; seus pesos somam 100 *dentro daquele pavimento*.

Os pesos são distribuídos **igualmente e automaticamente** quando a atribuição é criada (trigger
`trg_seed_pav_etapa` → `seed_pavimentos_etapas`, a partir do template da disciplina). Com 4
pavimentos + 1 etapa global, cada item de nível 1 vale 20,00. Como o arredondamento gera resíduo
(3 × 33,33 = 99,99), `ajustar_residuo_pesos` joga a diferença no último item para fechar exatamente
100.

Exemplo: 2 pavimentos de peso 50, cada um com 2 etapas de peso 50. Concluir uma etapa do Térreo dá
`50 × 50/100 = 25%`.

Marcar uma etapa dispara um trigger que recalcula a disciplina e propaga até
`projetos.percentual_ponderado` na mesma transação. O roll-up do projeto é a **média** das
atribuições ativas.

O status nunca vem de `status_codes`: `>= 100` → Concluído, `> 0` → Em Andamento, senão Aguardando
Início. Um projeto só conta como concluído quando **todas** as disciplinas ativas estão em 100.

### Retrabalho por horas

Desde `20260728_retrabalho_por_horas.sql`, retrabalho é medido em **horas**, não em dias nem em
contagem de ocorrências:

```
percentual de retrabalho = SUM(horas_retrabalho) / SUM(horas_trabalhadas_total) × 100
```

Os dois números vêm do apontamento noturno do engenheiro no WhatsApp, gravados em
`retrabalho_projetos` pela RPC `registrar_retrabalho_dia` — um **upsert por (atribuição, dia)**.

Cuidado ao ler SQL antigo: arquivos como `supabase/CRIAR_VIEWS.sql` e
`supabase/views_retrabalho_apenas.sql` ainda contêm a fórmula anterior
(`AVG(CASE WHEN necessitou_retrabalho THEN 100 ELSE 0 END)`). A definição válida é a da migration de
2026-07-28.

### Outros indicadores

- **Carga de trabalho**: `dias_restantes = SUM(tempo_trabalho_dias × (100 − percentual) / 100)` das
  atribuições não concluídas.
- **Atraso**: `data_prevista < hoje AND percentual < 100` → `hoje − data_prevista`.
- **Paralisação**: dias em status `PARADO_CLIENTE`, `PARADO_TECPRED`, `AGUARDANDO_INF_CLIENTE` ou
  `AGUARDANDO_INICIO`, contados de `status_historico`. Alimenta o relatório PDF.

---

## Fluxos no WhatsApp

### Quem é quem

O bot identifica o usuário pelo número (`autenticarUsuario` em `chatbot/handlers/messageHandler.ts`):
busca em `engenheiros` por `telefone` com `ativo = true`, depois em `dono_empresa`. São quatro
desfechos, deliberadamente distintos:

- **Engenheiro** → menu do engenheiro
- **Dono** → `ownerFlow` inicia direto
- **Número não cadastrado** → mensagem de não cadastrado. A sessão guarda esse estado, mas **cada
  mensagem seguinte tenta reautenticar**, para reconhecer um número cadastrado depois sem redeploy
- **Banco indisponível** → "serviço temporariamente indisponível", **sem criar sessão** (gravar
  `nao_cadastrado` aqui envenenaria o cache por 15 minutos)

Sessões são um `Map` **em memória**, com TTL de 15 minutos. Reiniciar o processo derruba todas as
conversas em andamento.

### Menu do engenheiro

```
1️⃣ Notificação Matinal        previsão do dia
2️⃣ Notificação Noturna        feito + horas + retrabalho + etapas
3️⃣ Visualizar Meus Projetos   só leitura
4️⃣ Marcar Etapa Concluída     progresso ponderado
```

**Notificação Matinal** — escolhe a atribuição, descreve a previsão do dia (mínimo 5 caracteres),
grava em `projetos_previsao`.

**Notificação Noturna** — é o fluxo mais longo e o que alimenta os indicadores:

```
escolhe a atribuição
  → "O que foi feito hoje?"
  → "Quantas horas foram trabalhadas hoje?"
  → "Teve retrabalho/paralisação hoje?"
       ├─ Sim → motivo (lista fechada de 6) → horas de retrabalho
       └─ Não
  → CONFIRMAÇÃO: resumo das horas → 1 confirma e grava | 2 corrige
  → observações (opcional)
  → "Alguma etapa foi concluída hoje?" (se houver etapa pendente)
```

A tela de confirmação é o **único ponto de gravação** das horas. Ela existe porque
`registrar_retrabalho_dia` é upsert por (atribuição, dia): sem revisão, um `80` digitado no lugar de
`8` sobrescreveria o valor certo e contaminaria o indicador de retrabalho.

**Navegação** — comandos globais válidos em qualquer passo: `0` ou `voltar` (passo anterior, com
restauração do estado por snapshot), `menu` (volta ao início), `cancelar`.

### Fluxo do dono

`chatbot/flows/ownerFlow.ts` — distribuição de tarefas para engenheiros, criação de projetos e
consultas, via RPCs `dono_*`. Usa uma máquina de estados mais simples que a do engenheiro: só
`menu`, sem `0`/voltar.

### Notificações proativas

Agendadas no próprio processo (`integrations/cron/cronJobs.ts`, timezone `America/Sao_Paulo`):

| Quando | O quê |
|---|---|
| 11:20, seg–sex | Lembrete da notificação matinal |
| 16:30, seg–sex | Lembrete da notificação noturna |
| a cada minuto | Worker que envia a fila de `notificacoes_whatsapp` |
| semestral | Limpeza de projetos finalizados — **só** com `ENABLE_PROJECT_CLEANUP_CRON=true` |

---

## Dashboard

Next.js 14 em `dashboard/`. Quatro rotas:

- **`/` e `/inicio`** — a tela principal (mesma página nos dois caminhos)
- **`/login`** — email e senha via Supabase Auth
- **`/admin`** — só owner ativo; senão redireciona
- **`/test`** — devolve `OK`, health check

### A tela principal

| Bloco | Mostra | Vem de |
|---|---|---|
| Ações | Criar projeto, atribuir projeto | RPCs `criar_projeto`, `dashboard_atribuir_projeto_com_pavimentos` |
| 5 KPIs | Total, concluídos, em execução, engenheiros em execução, atrasados | `vw_bloco1_visao_geral` |
| Progresso geral | Percentual médio | `vw_bloco1_visao_geral` |
| Gráficos | Pizza de status, barras de carga por engenheiro | `vw_grafico_projetos_status`, `vw_bloco3_carga_trabalho` |
| Atrasos | Tabela por engenheiro | `vw_bloco2_atrasos_engenheiro` |
| Produção no período | Horas apontadas por engenheiro (**só owner**) | `vw_dashboard_producao_apontamentos` |
| Retrabalho | Percentual geral, por projeto, por disciplina, por motivo, por engenheiro | views `vw_retrabalho_*` |

Cada KPI abre um modal com a tabela detalhada, e os modais têm modo tela cheia. A tabela de projetos
permite busca, transferir responsável, excluir atribuição ou projeto, ver detalhes e **gerar
relatório PDF** (`vw_relatorio_projeto_pdf` + jsPDF, via `/api/admin/projetos/[id]/relatorio`).

O dashboard assina Realtime em `engenheiros_projetos`, `projetos` e `retrabalho_projetos`, e
recarrega quando algo muda — então um apontamento feito no WhatsApp aparece sem refresh.

### `/admin`

Duas partes: gerenciar **logins da plataforma** (`user_profiles`) e cadastrar **engenheiros do
chatbot** (tabela `engenheiros` — nome, telefone, exclusivo, ativo). É por aqui que um número passa
a ser reconhecido no WhatsApp.

### Acesso

Supabase Auth (email e senha), em três camadas:

1. `dashboard/middleware.ts` — sem sessão, redireciona para `/login`
2. **RLS é permissiva**: a policy é `for all to authenticated using (true)` em todas as tabelas.
   Qualquer usuário logado lê e escreve tudo. `anon` não lê nada. `user_profiles` é a exceção (cada
   um lê só o próprio, e escrita só por `service_role`, o que impede auto-promoção a owner)
3. **Papel owner** — `user_profiles.role = 'owner'` com `status = 'active'`. Verificado no servidor
   em todas as rotas `/api/admin/*`; no cliente, serve apenas para esconder UI

Ou seja: a separação real hoje é **logado vs não logado**, mais o papel de owner aplicado na
aplicação. Não é uma separação no banco.

---

## Testes

Não há framework nem runner único. Cada arquivo em `tests/` é um script auto-executável com
`node:assert/strict`, rodado individualmente:

```bash
npx tsx tests/test-chatbot-horas-confirmacao.ts
```

**Não existe `npm test`.** O agrupamento que existe é:

```bash
npm run test:seguranca    # redação de segredos, autenticação, banco indisponível
npm run test:redact
npm run test:auth-erro
npm run test:indisponivel
npx tsc --noEmit          # typecheck (é o que `npm run build` faz)
```

Os 64 arquivos `.ts` em `tests/` seguem quatro padrões:

| Padrão | O que faz |
|---|---|
| `test-chatbot-*.ts` | Dirige o flow por várias mensagens, com duplo de Supabase. Ex.: `test-chatbot-voltar.ts`, `test-chatbot-horas-confirmacao.ts` |
| `test-dashboard-*.ts` | Lê os arquivos do dashboard **como texto** e faz assert com regex (não importa os módulos) |
| `test-*-migration.ts` | Valida o SQL de uma migration |
| `test-marcar-etapa.ts`, `test-interactive.ts` | REPL interativo para percorrer o fluxo à mão — **gravam de verdade** no Supabase |

Para escrever um teste de conversa novo, copie o harness de `tests/test-chatbot-voltar.ts`:
instancia `EngineerProjectFlow`, troca `(flow as any).supabase` por um duplo e semeia
`(flow as any).state` para começar no passo que interessa.

Roteiros manuais ficam em `tests/test-engineer-flow.md` — **atenção: os Testes 1 a 10 descrevem um
fluxo que não existe mais** (ver [Limitações](#limitações-conhecidas)). O Teste 13 é fiel.

---

## Deploy

**Railway, dois serviços**, deploy por push no GitHub. Nada é compilado no chatbot: TypeScript roda
direto com `tsx` em produção.

Chatbot (raiz) — três fontes redundantes e idênticas de start command:

```
Procfile         web: npx tsx src/server-twilio.ts
railway.json     NIXPACKS, restart ON_FAILURE (10 tentativas)
nixpacks.toml    nodejs_20, install: npm ci
```

Dashboard (`dashboard/railway.json`):

```
build:  npm install && (rm -rf .next/cache/* || true) && npm run build
deploy: npm run start
```

O `rm -rf .next/cache/*` e os ajustes de cache em `dashboard/next.config.js`
(`config.cache = false`, `Cache-Control: no-store`) existem porque o volume persistente do Railway
servia bundles antigos. Não remova sem testar.

**Webhook Twilio** — aponte o número para:

```
https://<seu-app>.up.railway.app/webhook/whatsapp    (mensagens)
https://<seu-app>.up.railway.app/webhook/status      (status de entrega)
```

Não existe Dockerfile, CI, nem pipeline de testes. `dashboard/vercel.json` existe, mas a Vercel é
caminho alternativo/legado — Railway é o que está em uso.

---

## Convenções do projeto

**Commits** — Conventional Commits com escopo, assunto em português **sem acentos**, corpo
explicando o *porquê* (não o *o quê*) e fechando com uma frase de evidência dos testes:

```
fix(chatbot): rejeitar entrada invalida nas horas de retrabalho

Sem isto, '2h' e 'abc' viravam null e passavam pela validacao, gravando
retrabalho com horas nulas.

Teste primeiro: os tres casos falharam antes da correcao. tsc limpo.
```

Escopos em uso: `chatbot`, `dashboard`, `tests`, `security`. **Sem trailer de coautoria.**

**Código** — comentários em português sem acentos, explicando por que aquilo existe, não o que a
linha faz. Lógica pura vai para `logic/`, que não faz I/O e é testável direto. Nos fluxos de
conversa, a convenção é um `render*()` por pergunta e uma guarda `if (!msg.trim())` no início do
step, para que `0`/voltar re-renderize a pergunta em vez de cair na validação.

---

## Limitações conhecidas

Coisas em que você vai tropeçar. Estão aqui de propósito — um README que esconde isso vira ficção.

**Ferramental**

- **~22 scripts do `package.json` estão quebrados.** Todos os que usam `ts-node --esm` falham com
  `ERR_UNKNOWN_FILE_EXTENSION` (ts-node 10 + ESM em Node 20). Inclui `test:supabase`,
  `test:interactive`, `test:marcar-etapa`, `check:env`, `diagnostico`. Use `npx tsx <arquivo>` no
  lugar. Alguns scripts apontam para arquivos ou módulos que não existem mais
  (`test:planilha`, `test:query`, `test:update`, `test:bot`).
- **Não há `npm test` nem CI.** Não existe `.github/`; nada roda automaticamente.
- `npm run build` **não gera build** — o `tsconfig` tem `noEmit: true`, então é só typecheck.
- `ioredis` e `xlsx` são importados por algum código mas **não estão declarados** no
  `package.json` nem instalados. `SessionService` (Redis) existe e não é usado por ninguém.

**Chatbot**

- **O webhook Twilio não valida assinatura.** Não há checagem de `X-Twilio-Signature`: qualquer POST
  em `/webhook/whatsapp` é aceito e processado.
- **Áudio não funciona em produção.** O Whisper só é chamado no caminho legado
  (`npm run dev:whatsapp-web`). No servidor Twilio, um áudio chega sem `Body` e devolve
  `400 Bad Request`.
- **`0`/Voltar não sobe ao menu nas telas de lista.** Nas listas de projeto, o `0` re-renderiza a
  mesma lista indefinidamente — o rodapé anuncia "Voltar" e nada acontece. Como consequência, o
  trecho que renderiza o menu no voltar é código inalcançável.
- **Seis passos mortos** no fluxo do engenheiro: `progresso_escolher_pavimento`,
  `progresso_escolher_etapa`, `progresso_continuar`, `noite_etapa_pavimento`,
  `noite_etapa_escolher`, `noite_etapa_mais`. Os três últimos formam um ciclo fechado cujos únicos
  `goToStep` estão dentro dele mesmo — nada leva o engenheiro até lá.
- Sessões em memória: reiniciar o processo perde as conversas em andamento.
- `integrations/sheets/ceo_sync.ts` consulta uma view `view_dashboard_ceo` que **não é criada por
  nenhum SQL do repo**, e o arquivo não é importado por ninguém. Caminho morto.

**Banco**

- Parte das RPCs em uso vive **fora de `migrations/`** (ver [seção 4](#banco-de-dados-como-montar)).
- `supabase/sql-editor-patches/` pode deixar bancos com semânticas diferentes de progresso.
- O owner inicial é um UUID hardcoded: banco novo nasce sem owner.
- Várias funções e views foram **redefinidas múltiplas vezes** em migrations diferentes
  (`dashboard_atribuir_projeto_com_pavimentos` 6×, `vw_projetos_detalhado` 5×,
  `vw_projetos_completo` 3×). Só a mais recente vale.
- `20260529_sync_ponderado_dashboard.sql` se autodeclara obsoleta.
  `20260831_dashboard_producao_apontamentos.sql` é byte a byte idêntica à de `20260901`.
- `20260319_progresso_ponderado.sql` cria triggers sem `IF NOT EXISTS`: reexecutar falha.

**Dashboard**

- RLS é permissiva: qualquer usuário logado lê e escreve tudo (ver [Acesso](#acesso)).
- Sem as variáveis `NEXT_PUBLIC_*`, sobe com dados falsos de `mockData.ts` — fácil confundir com
  dados reais.
- O card "Média por Horas" do retrabalho é média aritmética simples dos percentuais por engenheiro,
  **não ponderada por horas** — então diverge do "% Geral TecPred", que é ponderado.
- O "valor da hora" da produção por período é digitado na tela e **não é persistido**.
- Componentes não referenciados: `MemoriaisDescritivosTab.tsx` (tela planejada, nunca ligada),
  `RetrabalhoPorProjetoTable.tsx`.

**Documentação**

Este README é a fonte de verdade. Os documentos que sobraram e são confiáveis:

| Documento | Para quê |
|---|---|
| [`docs/AUTENTICACAO_CHATBOT.md`](docs/AUTENTICACAO_CHATBOT.md) | Como o bot identifica quem fala, e por que "não cadastrado" e "banco fora" são desfechos distintos |
| [`dashboard/README.md`](dashboard/README.md) | Rodar e mexer no dashboard: telas, Realtime, acesso, armadilhas |
| [`tests/test-engineer-flow.md`](tests/test-engineer-flow.md) | Roteiro de testes manuais do fluxo do engenheiro |

Ainda **defasados**, descrevendo status manual, criação de projeto pelo engenheiro e/ou gravação em
planilha: `deploy-docs/` (5 arquivos) e a maior parte de `supabase/docs-bd/` (14). Em particular,
`supabase/docs-bd/new_db_schema.sql` declara `areas.area_id` como `SERIAL` quando o banco usa
`UUID`, e `deploy-docs/ENV_VARIABLES.md` omite o Twilio, que é o provider de produção.
