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
tests/                    68 testes automaticos (npm test); tests/manual/ para scripts que falam com o banco
```

> Uma nota sobre `logic/`: o dashboard tem uma **cópia deliberada** de
> `logic/security/redactSecrets.ts` em `dashboard/lib/secrets.ts`, porque o `tsconfig` do Next não
> alcança pastas fora de `dashboard/`. Se mexer em um, mexa no outro —
> `tests/test-segredos-bot-e-dashboard-iguais.ts` falha se os dois divergirem.

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

O servidor expõe `GET /`, `GET /health` (consulta o banco, com limite de 3 s: 200 com o banco
respondendo, 503 sem ele — o Railway usa no deploy, ver `railway.json`), `POST /webhook/whatsapp`
(mensagens) e `POST /webhook/status` (callbacks de entrega do Twilio).

O webhook de mensagens responde ao Twilio **na hora**, com TwiML vazio, e processa depois; a resposta
do bot sai pela API do Twilio. Antes ele só respondia depois de processar tudo, e nas conversas mais
lentas o Twilio desistia em 15 s (erro 11200). A mesma `MessageSid` não é processada duas vezes. No
`SIGTERM` do deploy, o servidor para os crons e espera até 10 s as mensagens em andamento
(`drainingSeconds: 15` no `railway.json`). Os logs mostram só os 4 últimos dígitos do telefone e o
tamanho do texto, nunca o conteúdo da mensagem.
Os dois webhooks exigem `X-Twilio-Signature` válida (403 sem ela) sempre que
`WHATSAPP_PROVIDER=twilio` ou `TWILIO_AUTH_TOKEN` estiver definido; só o desenvolvimento local puro
dispensa, para testar com `curl`.

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
| `ENABLE_SHEETS_SYNC` | Liga a sincronização banco → Google Sheets (automática e o comando `sync` do dono) | Não | ligada; `false` ou `0` desliga |
| `GOOGLE_APPLICATION_CREDENTIALS` | Caminho do JSON da service account | **Com o Sheets ligado** — o boot faz `exit(1)` se faltar | — |
| `GOOGLE_SHEETS_ENGINEER_ID` | Planilha do engenheiro | **Com o Sheets ligado** — `exit(1)` se faltar | `''` |
| `GOOGLE_SHEETS_ENGINEER_NAME` | Nome da aba | **Com o Sheets ligado** — `exit(1)` se faltar | `Engenheiro(a)` |
| `GOOGLE_SHEETS_ENGINEER_RANGE` | Intervalo lido | Não | `A1:AE1000` |
| `WHATSAPP_PROVIDER` | `development` \| `twilio` \| `meta` | **Em produção** (`NODE_ENV=production` ou Railway): o boot recusa sem `twilio`/`meta`, porque o modo `development` só imprime no log e dava as notificações como enviadas | `development` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | Credenciais Twilio | Se `WHATSAPP_PROVIDER=twilio` (a falta só gera warning no boot) | `''` |
| `TWILIO_WEBHOOK_BASE_URL` | URL pública exatamente como no console do Twilio, usada para conferir `X-Twilio-Signature` quando o host encaminhado pelo proxy não bate (domínio próprio) | Não | host do request |
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
- Para rodar sem Sheets, use `ENABLE_SHEETS_SYNC=false`: as variáveis do Google deixam de ser
  exigidas no boot.

### Dashboard (`dashboard/.env.local`)

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente e middleware |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente e middleware (sujeita a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Apenas no servidor, nas rotas `/api/admin/*` |

---

## Banco de dados: como montar

Não há `supabase/config.toml` nem migrations versionadas pelo CLI: o SQL é colado no SQL Editor
do Supabase. A pasta `supabase/` tem:

| Onde | O que é |
|---|---|
| `migrations/00000000_baseline.sql` | **A estrutura que está valendo em produção**: 23 tabelas, 66 funções, 34 views, 28 triggers, RLS, policies e permissões, exportadas do banco em 26/10/2026. Sem dados. |
| `migrations/2026*.sql` | O histórico das mudanças. As anteriores a 26/10/2026 já estão no baseline; as posteriores são aplicadas por cima dele. |
| `rollbacks/` | O SQL que desfaz cada migration nova. |
| `consultas/` | Consultas avulsas: `exportar_estrutura.sql` (só leitura, gera o baseline) e `definir_owner.sql`. |
| `seeds/` | Dados de referência antigos (disciplinas, status, tipos de projeto). Ver o aviso abaixo. |
| `_arquivo/` | SQL antigo, só como histórico. **Não rodar** — muitos sobrescrevem a versão que vale. |

**Qual versão de uma função ou view vale?** A do baseline, ou a de uma migration mais nova que ela.
Para conferir se o baseline continua igual à produção, rode de novo
`supabase/consultas/exportar_estrutura.sql` e gere o arquivo com
`npx tsx scripts/montar-baseline.ts <export.csv>`; o `git diff` mostra o que mudou fora das
migrations.

**Banco novo** (outro projeto Supabase, testes):
1. `migrations/00000000_baseline.sql`, depois as migrations com data posterior a 26/10/2026.
2. Os dados de referência (disciplinas em `areas`, `status_codes`, `tipos_obra`,
   `motivos_retrabalho`…). O baseline não traz dados, e os arquivos de `seeds/` são **anteriores**
   ao estado atual — confira contra a produção antes de usar. Em particular, os dois seeds de
   disciplinas se excluem: `seed_areas_completo.sql` insere a taxonomia antiga (`H1`–`H6`,
   `E1`–`E4`…) e `reverter_areas_genericas.sql` apaga esses códigos e insere os genéricos
   (`ELETRICO`, `HIDRAULICO`, `DRT`…), que são os que valem hoje.
3. Crie o usuário do dono em Authentication → Users e rode `consultas/definir_owner.sql` com o
   email dele. A migration `20260601_auth_dashboard.sql` marca como owner um UUID fixo que só existe
   na produção — sem este passo o projeto nasce sem owner e o `/admin` fica inacessível.

O baseline foi conferido num Postgres local: aplicado num banco vazio, a nova exportação sai
idêntica à da produção (459 objetos, nenhuma diferença).

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
`retrabalho_projetos` pela RPC `registrar_retrabalho_dia` — um **upsert por (atribuição, dia)**
(`INSERT ... ON CONFLICT`).

**O dia é o de Brasília**, nunca o UTC do Supabase: a RPC recebe `p_data` (o bot manda a data BRT)
e, sem ele, usa `hoje_brt()` (`20261023_retrabalho_dia_brt_e_limite_horas.sql`). Antes, quem
apontava depois das 21h BRT tinha as horas gravadas no dia seguinte. Use `hoje_brt()` no lugar de
`CURRENT_DATE` em SQL novo. Ela também serve para lançamento retroativo (`p_data` no passado);
data futura e mais de 24h num dia são recusadas, e a tabela tem `CHECK` de 24h (`NOT VALID`: os
registros antigos não são verificados).

"Total de retrabalhos" (por engenheiro) conta só os dias com `necessitou_retrabalho = true`: a
tabela guarda todo apontamento diário desde 2026-07-28.

Cuidado ao ler SQL antigo: arquivos como `supabase/_arquivo/CRIAR_VIEWS.sql` e
`supabase/_arquivo/views_retrabalho_apenas.sql` ainda contêm a fórmula anterior
(`AVG(CASE WHEN necessitou_retrabalho THEN 100 ELSE 0 END)`). A definição válida é a do baseline.

### Outros indicadores

- **Carga de trabalho**: `dias_restantes = SUM(tempo_trabalho_dias × (100 − percentual) / 100)` das
  atribuições não concluídas. As funções do fluxo do dono classificam esse número em quatro faixas:
  `> 30` dias → `SOBRECARREGADO`, `> 15` → `CARGA_ALTA`, `> 7` → `CARGA_MEDIA`, senão `DISPONIVEL`.
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

A tela de confirmação é o **único ponto de gravação** das horas e do relato do dia. Ela existe
porque `registrar_retrabalho_dia` é upsert por (atribuição, dia): sem revisão, um `80` digitado no
lugar de `8` sobrescreveria o valor certo e contaminaria o indicador de retrabalho. Acima de 16h o
bot recusa; acima de 12h o resumo avisa antes do "1". O relato vai junto com as horas para não se
perder se a sessão (15 min) expirar na pergunta de observações; o fim só grava a observação.

Mensagens do mesmo telefone são processadas em fila (uma de cada vez). O telefone é reconhecido
com ou sem o 9 depois do DDD (`logic/validation/telefoneBR.ts`). Com o banco fora, o bot responde
"Não consegui acessar os dados agora" — não cai mais na planilha legada nem mostra 0%.

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
- **`/api/health`** — `{"status":"ok"}`, health check do deploy (público)

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

Supabase Auth (email e senha), em quatro camadas:

1. `dashboard/middleware.ts` — sem sessão, redireciona para `/login`; login com `status` inativo
   (ou sem perfil) é desconectado; em produção sem as variáveis `NEXT_PUBLIC_*` responde 503. A
   decisão fica em `dashboard/lib/acessoMiddleware.ts`.
2. **`anon` não acessa nada** — nem tabela, nem view, nem função
   (`supabase/migrations/20261021_fechar_acesso_anon.sql`). Os privilégios padrão também foram
   alterados, para que objetos novos já nasçam fechados. `npm run sondar:anon` prova isso ao vivo,
   só com leitura.
3. **`authenticated` só lê** (`20261022_authenticated_somente_leitura.sql`): SELECT em tabelas e
   views, EXECUTE só nas funções de leitura. A policy de RLS continua `using (true)`, então
   qualquer logado **lê** tudo.
4. **Toda escrita do dashboard passa por `/api/admin/*`**, que exige owner ativo
   (`user_profiles.role = 'owner'`, `status = 'active'`) e usa a service role. No cliente, o papel
   de owner só esconde botões. O chatbot também escreve com a service role.

Ao criar uma view ou função nova: `authenticated` recebe leitura (e EXECUTE) automaticamente pelos
privilégios padrão; funções que **escrevem** precisam de `REVOKE EXECUTE ... FROM authenticated` e
`GRANT ... TO service_role`, como em `20261022`. Nunca conceda nada a `anon`: o teste
`tests/test-fechar-acesso-anon-migration.ts` falha se alguma migration der `GRANT ... TO anon`.

---

## Testes

```bash
npm test                  # os 68 testes automaticos, 4 por vez (scripts/rodar-testes.ts)
npm test -- fuso          # so os arquivos com "fuso" no nome
npm run typecheck         # tsc --noEmit, incluindo tests/ e scripts/
npm run test:seguranca    # redacao de segredos, autenticacao, banco indisponivel, acesso
cd dashboard && npm run lint && npm run build
```

Cada arquivo `tests/*.ts` é um script independente que sai com código 1 se falhar
(`node:assert/strict` ou contagem própria) — dá para rodar um só com `npx tsx tests/<arquivo>`.
**Nenhum acessa banco nem rede**: o Supabase é substituído por dublês. É o que o CI roda
(`.github/workflows/ci.yml`, em todo PR e push na `main`), junto com o lint e o build do dashboard.

Os padrões:

| Padrão | O que faz |
|---|---|
| `test-chatbot-*.ts` | Dirige o flow por várias mensagens, com dublê de Supabase. Ex.: `test-chatbot-voltar.ts`, `test-chatbot-horas-confirmacao.ts` |
| `test-dashboard-*.ts` | Lê os arquivos do dashboard como texto e faz assert com regex, ou importa a lógica pura de `dashboard/lib/` |
| `test-*-migration.ts` | Valida o SQL de uma migration (contra o baseline, quando ela recria objetos) |

`tests/manual/` guarda o que **não** é automático: diagnósticos, REPLs e testes de integração que
leem ou gravam no Supabase do `.env`. Os que gravam (`test-marcar-etapa.ts`, `test-interactive.ts`,
`test-conclusao-area.ts`) só rodam com `RUN_DB_TESTS=1` — aponte o `.env` para um projeto de teste.

Para escrever um teste de conversa novo, copie o harness de `tests/test-chatbot-voltar.ts`:
instancia `EngineerProjectFlow`, troca `(flow as any).supabase` por um dublê e semeia
`(flow as any).state` para começar no passo que interessa. Não use telefone, email ou nome real em
teste: o repositório é público.

Roteiros manuais ficam em `tests/manual/test-engineer-flow.md` — **atenção: os Testes 1 a 10
descrevem um fluxo que não existe mais** (ver [Limitações](#limitações-conhecidas)). O Teste 13 é fiel.

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

Não existe Dockerfile. O CI (`.github/workflows/ci.yml`) roda tipos, testes, lint e build em todo
PR, mas não faz deploy: o Railway publica sozinho a cada push na `main`. Os dois serviços têm health
check de deploy (`/health` no chatbot, `/api/health` no dashboard).

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

- `xlsx` (em `scripts/extract-xlsx-templates.ts`) não está declarado no `package.json`; o script
  fica fora do typecheck.
- `whatsapp-web.js` (caminho legado) puxa um Chromium no `npm ci`; o CI pula esse download com
  `PUPPETEER_SKIP_DOWNLOAD`, o deploy do Railway ainda baixa.

**Chatbot**

- **Áudio não funciona em produção.** O Whisper só é chamado no caminho legado
  (`npm run dev:whatsapp-web`). No servidor Twilio, um áudio chega sem `Body` e devolve
  `400 Bad Request`.
- Sessões em memória: reiniciar o processo perde as conversas em andamento.

**Banco**

- A estrutura vale pelo **baseline** (`supabase/migrations/00000000_baseline.sql`, ver
  [seção 4](#banco-de-dados-como-montar)). As migrations antigas são histórico: várias funções e
  views foram redefinidas muitas vezes (`dashboard_atribuir_projeto_com_pavimentos` 6×,
  `vw_projetos_detalhado` 5×), `20260529_sync_ponderado_dashboard.sql` se autodeclara obsoleta e
  `20260319_progresso_ponderado.sql` não é reexecutável. Não reaplique migration antiga.
- **"Hoje" é o dia de Brasília** em todo o banco desde `20261027_hoje_brt_em_todo_o_banco.sql`:
  funções, views e defaults usam `hoje_brt()`, nunca `CURRENT_DATE` (que no Supabase é UTC e, das
  21h à meia-noite, já é o dia seguinte). No código, use `dataLocalBR()` (`logic/datas/dataLocal.ts`),
  nunca `new Date().toISOString().split('T')[0]`. Registros gravados antes ficaram como estavam.
- **Código morto no banco:** `atribuir_area_projeto` declara `v_area_id INTEGER` com `areas.area_id`
  UUID e falha sempre; `gerar_proximo_codigo_projeto()` junta todos os dígitos do código (`PRJ-2025-001`
  vira 2025001). Nenhum código chama as duas — os projetos recebem o código digitado no dashboard.
- Os triggers `trg_calcular_percentual_status` e `trg_auto_conclusao` **não são resíduo**: o bot ainda
  muda `status_id` (pela função do banco `registrar_retrabalho_dia`) e várias telas leem
  `percentual_andamento`, que o primeiro preenche. O par `trg_sync_datas_para_prazos` /
  `trg_sync_datas_de_prazos` é uma sincronização nos dois sentidos, protegida contra laço.
- **Os 5 níveis de `complexidade_tarefas` são provisórios.** O seed traz 1/3/7/15/30 dias com o
  comentário "ajustar conforme sua tabela" — nunca foram validados pelo cliente. Qualquer número
  derivado de complexidade é estimativa de placeholder.

**Sheets**

- **Pelo repositório, `credentials.json` não tem como chegar ao Railway.** O arquivo está no
  `.gitignore`, o código só aceita caminho de arquivo (`keyFile`) e não há volume configurado.
  `GOOGLE_CREDENTIALS_JSON` não é lida por nenhum código, apesar de guias antigos sugerirem. O boot
  passa de qualquer forma — a validação checa a variável, não o arquivo — então a sincronização falha
  só em runtime, depois de fazer as consultas ao banco. Nada além do Sheets depende disso: sem uso da
  planilha, `ENABLE_SHEETS_SYNC=false` desliga tudo. Ver [docs/DEPLOY.md](docs/DEPLOY.md).
- A sincronização limpa e reescreve a planilha; execuções nunca se sobrepõem (o cron e o comando
  `sync`, que agora é só do dono, passam pela mesma trava).

**Notificações**

- O worker reserva cada notificação antes de enviar (soma a tentativa só se ninguém mexeu nela desde
  a leitura), então duas rodadas ou duas instâncias não mandam a mesma notificação.
- Lembretes para quem não fala com o bot há mais de 24 h saem com erro 63016 do WhatsApp (fora da
  janela de atendimento). **É o comportamento desejado**: sem conversa recente, sem lembrete.
- Os lembretes das 11:20 e 16:30 não têm trava entre instâncias: se um deploy cair exatamente nesse
  minuto, os dois containers podem disparar. Em um mês de histórico do Twilio isso não aconteceu.

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

Este README é a fonte de verdade e é autocontido. Os documentos abaixo detalham um assunto cada, sem
repeti-lo — todos foram verificados contra o código:

| Documento | Para quê |
|---|---|
| [`docs/MODELO_DE_DADOS.md`](docs/MODELO_DE_DADOS.md) | Diagrama do schema, nomes de coluna, instâncias, views vigentes e as armadilhas de leitura |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | O que fazer nos painéis: Railway, Twilio (sandbox, templates), Supabase |
| [`docs/AUTENTICACAO_CHATBOT.md`](docs/AUTENTICACAO_CHATBOT.md) | Como o bot identifica quem fala, e por que "não cadastrado" e "banco fora" são desfechos distintos |
| [`dashboard/README.md`](dashboard/README.md) | Rodar e mexer no dashboard: telas, Realtime, acesso, armadilhas |
| [`tests/manual/test-engineer-flow.md`](tests/manual/test-engineer-flow.md) | Roteiro de testes manuais do fluxo do engenheiro |

Se encontrar um documento que contradiz este README, o README está certo — e o documento deveria ter
sido apagado. Vinte e nove arquivos de documentação foram removidos por descreverem um sistema que não
existe mais; o histórico do git preserva todos.
