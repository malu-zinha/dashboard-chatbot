# Alterar prazo pelo dashboard: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o dono muda o prazo (`engenheiros_projetos.data_prevista`) de uma tarefa pelo dashboard, o engenheiro é avisado no WhatsApp e a linha da tabela mostra se o aviso chegou.

**Architecture:** uma RPC nova (`alterar_prazo_atribuicao`, só `service_role`) faz a mudança e enfileira o aviso em `notificacoes_whatsapp`. O worker do bot envia o aviso pedindo ao Twilio um callback de status que identifica a notificação. O `/webhook/status` grava o resultado e o dashboard lê esse resultado por uma rota do dono.

**Tech Stack:** Postgres/Supabase (plpgsql), Node 20 + Express + tsx (bot), Next.js 15 + React (dashboard), testes `node:assert` rodados por `npm test`.

**Spec:** `docs/superpowers/specs/2026-10-29-alterar-prazo-design.md`

## Global Constraints

- Migrations só aditivas e reversíveis: `BEGIN/COMMIT`, rollback em `supabase/rollbacks/`, sem `CURRENT_DATE` (usar `public.hoje_brt()`), sem alterar dado antigo.
- A migration é aplicada no SQL Editor **antes** do deploy. O código precisa continuar funcionando, sem reenviar nada, se rodar antes da migration.
- RPC nova: `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.
- Nenhum `SQLERRM` em `mensagem` que chegue ao navegador.
- No navegador, nenhum `.rpc(` nem `.from(...).insert|update|upsert|delete(` fora de `dashboard/app/api` (regra de `tests/test-dashboard-admin-projetos.ts`).
- Repositório público: nenhum telefone, nome ou email reais em código, teste ou doc. Telefone em log sempre passa por `mascararTelefone`.
- Commits sem trailer de coautoria.
- Datas no formato `YYYY-MM-DD` não passam por `new Date()` para exibir; usar `formatarDataBR` (`dashboard/lib/datas.ts`) ou `to_char` no SQL.
- Regra de concluída: `percentual_ponderado >= 100`, que é `percentual_andamento` na view.

## Review Focus

1. **Callback chegando antes de o SID ser gravado.** O Twilio pode chamar `/webhook/status` antes do update do worker. Por isso o callback leva o `notificacao_id` na URL (`?notificacao=<uuid>`) e o webhook atualiza por ele, não pelo SID. Teste na Task 4.
2. **Status fora de ordem ou desconhecido** (`queued`, `accepted`, `sending`, ou `sent` depois de `delivered`) nunca rebaixa o status, e `failed`/`undelivered` não são sobrescritos. Teste na Task 2.
3. **Data impossível ou mal formatada vinda do navegador** (`2026-02-30`, `29/10/2026`, vazio) recebe 400 antes de chegar ao banco. Teste na Task 5.
4. **Código novo rodando antes da migration:** o update do SID falha porque a coluna não existe, a notificação continua `enviada=true` e não sai de novo. Teste na Task 3.
5. **Não dono abrindo o dashboard:** não vê o botão nem pede os avisos, e a rota responde 403. Coberto por `guardOwnerRoute` e pela checagem estática na Task 6.

---

### Task 1: migration, rollback e testes do SQL

**Files:**
- Create: `supabase/migrations/20261029_alterar_prazo_atribuicao.sql`
- Create: `supabase/rollbacks/20261029_alterar_prazo_atribuicao.rollback.sql`
- Create: `tests/test-alterar-prazo-migration.ts`
- Modify: `tests/test-authenticated-somente-leitura-migration.ts:60-72`
- Modify: `package.json:10` (`test:seguranca`)

**Interfaces:**
- Produces:
  - Colunas novas em `notificacoes_whatsapp`: `eng_projeto_id uuid` (FK `engenheiros_projetos(id) ON DELETE SET NULL`), `twilio_sid text`, `status_entrega text`, `erro_codigo text`, `status_atualizado_em timestamptz`.
  - Índices: `idx_notif_twilio_sid (twilio_sid)` e `idx_notif_eng_projeto_tipo (eng_projeto_id, tipo, created_at DESC)`.
  - `public.alterar_prazo_atribuicao(p_atribuicao_id uuid, p_novo_prazo date, p_actor_user_id uuid) RETURNS json`.
    - Sucesso: `{ ok: true, codigo: 'ok', mensagem, prazo_anterior, prazo_novo, cliente_ajustado: int, prazo_cliente: date|null, aviso: 'na_fila'|'sem_telefone' }`.
    - Erro: `{ ok: false, codigo: 'nao_encontrada'|'concluida'|'parametro_invalido'|'sem_mudanca'|'erro_interno', mensagem }`.
  - `tipo = 'prazo_alterado'`, `titulo = 'Prazo alterado'`.

- [ ] **Step 1: Write the failing test** `tests/test-alterar-prazo-migration.ts`. Segue o estilo de `tests/test-proteger-historico-migration.ts`: lê o SQL como texto e remove os comentários para o código (`sql.replace(/--.*$/gm, '')`). Casos e asserções:
  - `transacao e rollback`: `/^\s*BEGIN;/m` e `/^\s*COMMIT;/m` na migration; o rollback existe e contém `DROP FUNCTION IF EXISTS public.alterar_prazo_atribuicao(uuid, date, uuid)` e `DROP COLUMN IF EXISTS twilio_sid`.
  - `sem current_date e sem SQLERRM`: `doesNotMatch(codigo, /current_date/i)` e `doesNotMatch(codigo, /SQLERRM/)`.
  - `so service_role executa`: `match(codigo, /REVOKE ALL ON FUNCTION public\.alterar_prazo_atribuicao\(uuid, date, uuid\) FROM PUBLIC, anon, authenticated/)` e `match(codigo, /GRANT EXECUTE ON FUNCTION public\.alterar_prazo_atribuicao\(uuid, date, uuid\) TO service_role/)`.
  - `colunas novas sem data_agendamento`: `match(codigo, /ADD COLUMN IF NOT EXISTS eng_projeto_id uuid REFERENCES public\.engenheiros_projetos\(id\) ON DELETE SET NULL/)`; um `ADD COLUMN IF NOT EXISTS` para cada uma das outras 4 colunas; `doesNotMatch(codigo, /data_agendamento/)`.
  - `recusas`: o corpo contém `'nao_encontrada'`, `'concluida'`, `'parametro_invalido'` e `'sem_mudanca'`; `match(corpo, /percentual_ponderado, 0\) >= 100/)`; `match(corpo, /p_novo_prazo < v_data_inicio/)`.
  - `prazo do cliente so empurra para frente`: `match(corpo, /UPDATE public\.prazos\s+SET prazo_final_cliente = p_novo_prazo[\s\S]*prazo_final_cliente < p_novo_prazo/)`.
  - `substitui aviso pendente antes de inserir`: o índice de `UPDATE public.notificacoes_whatsapp` é menor que o de `INSERT INTO public.notificacoes_whatsapp`, e o update contém `enviada = false` e `tentativas = 0`.
  - `sem telefone`: `match(corpo, /'sem_telefone'/)`.
  - `nao mexe em dado antigo`: fora do corpo da função, nenhum `UPDATE … SET` nem `DELETE FROM`.

- [ ] **Step 2: Run** `npx tsx tests/test-alterar-prazo-migration.ts`. Expected: FAIL com ENOENT na migration.

- [ ] **Step 3: Write the migration.** Cabeçalho no estilo de `20261026_proteger_historico_contra_exclusao.sql`: o que muda, "aplicar ANTES do deploy", como conferir e como desfazer. A seção 1 traz colunas e índices (`IF NOT EXISTS`). A seção 2 traz a função:
  - `SELECT ep.*, p.codigo_projeto, p.cliente, COALESCE(ep.instancia_label, a.descricao), e.telefone … FROM engenheiros_projetos ep JOIN projetos p … LEFT JOIN areas a … LEFT JOIN engenheiros e … WHERE ep.id = p_atribuicao_id AND ep.ativo FOR UPDATE OF ep`.
  - Se não achar, devolve `nao_encontrada`. Se `COALESCE(ep.percentual_ponderado, 0) >= 100`, devolve `concluida` ("Tarefa concluída não muda de prazo."). Se `p_novo_prazo IS NULL OR p_novo_prazo < v_data_inicio`, devolve `parametro_invalido` ("O prazo não pode ser antes do início (dd/mm/aaaa)."). Se `p_novo_prazo = data_prevista`, devolve `sem_mudanca` ("O prazo já é essa data.").
  - Faz o `UPDATE public.engenheiros_projetos SET data_prevista = p_novo_prazo`, depois o `UPDATE public.prazos SET prazo_final_cliente = p_novo_prazo WHERE eng_projeto_id = p_atribuicao_id AND prazo_final_cliente < p_novo_prazo`, com `GET DIAGNOSTICS cliente_ajustado = ROW_COUNT`, e depois o `UPDATE public.evandro_distribuicao_tasks SET data_conclusao_prevista = p_novo_prazo, updated_at = now() WHERE eng_projeto_id = p_atribuicao_id`.
  - Mensagem (copy fixa):
    ```
    📅 *Prazo alterado*

    📋 Projeto: <codigo> - <cliente>
    🔧 Área: <area>
    ⏰ Prazo anterior: <dd/mm/aaaa>
    ✅ Novo prazo: <dd/mm/aaaa>

    _Digite "menu" para ver seus projetos_
    ```
  - Aviso pendente da mesma atribuição: `SELECT notificacao_id, substring(mensagem from 'Prazo anterior: (\d{2}/\d{2}/\d{4})') … WHERE eng_projeto_id = p_atribuicao_id AND tipo = 'prazo_alterado' AND enviada = false AND tentativas = 0 ORDER BY created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED`.
    - Se existir, o "Prazo anterior" da mensagem nova é o extraído, ou seja, o que o engenheiro ainda conhece. Em seguida, `UPDATE … SET mensagem, telefone, status_entrega WHERE notificacao_id = … AND enviada = false AND tentativas = 0`.
    - Se o update não mudar nenhuma linha, porque o worker reservou a linha no meio, o prazo anterior volta a ser o `data_prevista` antigo e a função faz o `INSERT`.
  - Sem telefone: `telefone NULL` e `status_entrega = 'sem_telefone'`.
  - `EXCEPTION WHEN OTHERS` devolve `erro_interno` com a mensagem fixa "Não foi possível alterar o prazo." e um `RAISE WARNING` com `SQLSTATE`.

  A seção 3 traz REVOKE/GRANT. A seção 4 traz a conferência em comentário: colunas pela `information_schema.columns`, `has_function_privilege('authenticated', …)` = false e `has_function_privilege('service_role', …)` = true.

- [ ] **Step 4: Write the rollback.** `BEGIN`; `DROP FUNCTION IF EXISTS …`; `DROP INDEX IF EXISTS` dos dois índices; `ALTER TABLE … DROP COLUMN IF EXISTS` das 5 colunas, com um aviso de que os status gravados se perdem; `COMMIT`.

- [ ] **Step 5: Run** `npx tsx tests/test-alterar-prazo-migration.ts`. Expected: PASS.

- [ ] **Step 6: Adjust `tests/test-authenticated-somente-leitura-migration.ts`.** Acrescente `protegidasDepois`, o conjunto de nomes capturados por `/REVOKE ALL ON FUNCTION public\.([a-z_]+)\([^)]*\) FROM PUBLIC, anon, authenticated/g` nas migrations de `supabase/migrations/` com prefixo de data `> 20261022`. Em `toda funcao de escrita chamada pelo codigo esta na lista`, a condição passa a `listaRevogacao.has(f) || protegidasDepois.has(f)`, com a mensagem `${f} escreve e nao foi revogada de authenticated`. As outras asserções ficam como estão, inclusive o 28.

- [ ] **Step 7: Run** `npx tsx tests/test-authenticated-somente-leitura-migration.ts`. Expected: PASS. A RPC ainda não é chamada pelo código; ela passa a ser na Task 6, e este teste a cobre.

- [ ] **Step 8: Validar a migration num Postgres de verdade.** O script de validação com PGlite fica na área temporária e não é commitado, como na Onda 3. Passos: carregar `00000000_baseline.sql` e a migration, inserir dados de mentira e chamar a função. Expected:
  - caminho feliz: `data_prevista` muda; a linha de `prazos` (se criada) tem `prazo_final_eng` novo; a cópia em tasks muda; existe 1 linha `prazo_alterado`;
  - prazo do cliente: empurrado quando é menor que o novo prazo e intocado quando é maior;
  - duas chamadas seguidas: continua 1 linha, com o "Prazo anterior" original e o prazo novo final;
  - recusas: antes do início, mesma data e concluída, sem efeito colateral;
  - sem telefone: 1 linha com `status_entrega='sem_telefone'`;
  - rollback roda limpo e a migration roda de novo.

- [ ] **Step 9: Add** `tests/test-alterar-prazo-migration.ts` a `test:seguranca` em `package.json`; **run** `npm test`. Expected: tudo passa.

- [ ] **Step 10: Commit**
```bash
git add supabase/migrations/20261029_alterar_prazo_atribuicao.sql supabase/rollbacks/20261029_alterar_prazo_atribuicao.rollback.sql tests/test-alterar-prazo-migration.ts tests/test-authenticated-somente-leitura-migration.ts package.json
git commit -m "feat(banco): funcao para alterar o prazo de uma atribuicao e avisar o engenheiro"
```

### Task 2: regras do status de entrega (puro)

**Files:**
- Create: `integrations/whatsapp/statusEntrega.ts`
- Create: `tests/test-status-entrega-whatsapp.ts` (as Tasks 3 e 4 acrescentam casos neste arquivo)

**Interfaces:**
- Produces:
  - `export type StatusEntrega = 'enviado' | 'sent' | 'delivered' | 'read' | 'failed' | 'undelivered' | 'sem_telefone'`
  - `export function proximoStatusEntrega(atual: string | null, recebido: string): StatusEntrega | null`, que devolve `null` quando não deve gravar.
  - `export function motivoFalha(codigo: string | null | undefined): string`

- [ ] **Step 1: Write the failing test**
```ts
assert.equal(proximoStatusEntrega(null, 'sent'), 'sent')
assert.equal(proximoStatusEntrega('enviado', 'delivered'), 'delivered')
assert.equal(proximoStatusEntrega('delivered', 'sent'), null)          // fora de ordem nao rebaixa
assert.equal(proximoStatusEntrega('read', 'delivered'), null)
assert.equal(proximoStatusEntrega('sent', 'undelivered'), 'undelivered')
assert.equal(proximoStatusEntrega('failed', 'delivered'), null)        // final
assert.equal(proximoStatusEntrega('enviado', 'queued'), null)          // intermediario ignorado
assert.equal(proximoStatusEntrega('enviado', 'accepted'), null)
assert.equal(proximoStatusEntrega('enviado', 'sending'), null)
assert.equal(proximoStatusEntrega('enviado', 'qualquer'), null)
assert.equal(motivoFalha('63016'), 'não fala com o bot há mais de 24h')
assert.equal(motivoFalha('30008'), 'não entregue (código 30008)')
assert.equal(motivoFalha(null), 'não entregue')
```

- [ ] **Step 2: Run** `npx tsx tests/test-status-entrega-whatsapp.ts`. Expected: FAIL com o módulo não encontrado.

- [ ] **Step 3: Implement.** Ordem `enviado(0) < sent(1) < delivered(2) < read(3)`; `failed`/`undelivered` são finais. Um status final nunca é sobrescrito, e um final recebido sempre é gravado se o atual não for final. Recebido fora do conjunto devolve `null`.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(bot): regras do status de entrega do WhatsApp`.

### Task 3: envio rastreado e worker

**Files:**
- Modify: `integrations/whatsapp/whatsappService.ts` (interface `WhatsAppProvider`, `TwilioWhatsAppProvider.sendMessage`, `WhatsAppService.sendMessage`)
- Modify: `integrations/notifications/notificationWorker.ts` (`buscarNotificacoesPendentes`, `processarNotificacao`)
- Test: `tests/test-status-entrega-whatsapp.ts`; `tests/test-worker-notificacao-sem-duplicar.ts` precisa continuar passando sem mudança.

**Interfaces:**
- Consumes: nada das tarefas anteriores além das colunas da Task 1.
- Produces:
  - `export interface ResultadoEnvio { ok: boolean; sid?: string }`
  - `export function urlCallbackStatus(env: Record<string, string | undefined>, notificacaoId: string): string | null`: base `TWILIO_WEBHOOK_BASE_URL` (sem `/` final) ou `https://${RAILWAY_PUBLIC_DOMAIN}`, depois `/webhook/status?notificacao=<id>`; `null` sem base.
  - `WhatsAppProvider.sendMessage(to, message, opcoes?: { statusCallback?: string }): Promise<ResultadoEnvio | boolean>`. Dev e Meta continuam devolvendo boolean.
  - `WhatsAppService.sendMessageRastreado(to: string, message: string, notificacaoId?: string): Promise<ResultadoEnvio>`. Para mensagem dividida, o SID é o da última parte.
  - `WhatsAppService.sendMessage(to, message): Promise<boolean>`, com assinatura e comportamento inalterados.

- [ ] **Step 1: Write the failing tests** (em `tests/test-status-entrega-whatsapp.ts`):
  - `urlCallbackStatus({ TWILIO_WEBHOOK_BASE_URL: 'https://bot.exemplo.test/' }, 'n1')` → `'https://bot.exemplo.test/webhook/status?notificacao=n1'`; `({ RAILWAY_PUBLIC_DOMAIN: 'bot.up.railway.app' }, 'n1')` → `'https://bot.up.railway.app/webhook/status?notificacao=n1'`; `({}, 'n1')` → `null`.
  - `envio Twilio pede o callback`. Montagem:
    - `globalThis.fetch` falso que guarda o corpo e devolve `{ sid: 'SM1' }`;
    - `process.env` com SID, token e número fictícios, `WHATSAPP_PROVIDER='twilio'` e `TWILIO_WEBHOOK_BASE_URL='https://bot.exemplo.test'`, definido antes de `new WhatsAppService()`.

    Chamada: `sendMessageRastreado('+5583900000000', 'oi', 'n1')`. Asserções:
    - devolve `{ ok: true, sid: 'SM1' }`;
    - `new URLSearchParams(corpo).get('StatusCallback') === 'https://bot.exemplo.test/webhook/status?notificacao=n1'`.

    Sem a base, ou chamando sem `notificacaoId`, `get('StatusCallback') === null`.
  - Worker, com o banco falso copiado de `test-worker-notificacao-sem-duplicar.ts` e estendido com `.not(col,'is',null)`, e um serviço falso `{ sendMessageRastreado: async () => ({ ok: true, sid: 'SM1' }) }`. Casos:
    - `grava o SID depois de marcar enviada`: a linha fica com `enviada=true`, `twilio_sid='SM1'` e `status_entrega='enviado'`.
    - `falha ao gravar o SID nao reenvia`: o banco falso devolve erro em update com `twilio_sid`. Depois de 2 rodadas, só 1 envio e `enviada=true`.
    - `sem SID nao tenta gravar`: o envio devolve `{ ok: true }` e nenhum update contém `twilio_sid`.
    - `pula telefone nulo`: uma linha com `telefone: null` não é enviada e `tentativas` continua 0.

- [ ] **Step 2: Run** `npx tsx tests/test-status-entrega-whatsapp.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** no Twilio provider. Com `opcoes.statusCallback`, faz `formData.append('StatusCallback', …)`. No sucesso devolve `{ ok: true, sid: data.sid }`; nos erros, `{ ok: false }`. Em `WhatsAppService`, uma normalização `typeof r === 'boolean' ? { ok: r } : r`. `sendMessage` delega a `sendMessageRastreado(to, message)` e devolve `.ok`.

- [ ] **Step 4: Implement no worker:**
  - `buscarNotificacoesPendentes` acrescenta `.not('telefone', 'is', null)`.
  - `processarNotificacao` chama `this.whatsappService.sendMessageRastreado(notif.telefone, notif.mensagem, notif.notificacao_id)`.
  - O update `{ enviada: true, data_envio }` continua igual.
  - Só se `resultado.sid` existir, um segundo update `{ twilio_sid, status_entrega: 'enviado', status_atualizado_em }`. Esse update fica dentro do próprio try/catch, e um erro dele só vai para o log com `redactSecrets`.

- [ ] **Step 5: Run** `npx tsx tests/test-status-entrega-whatsapp.ts && npx tsx tests/test-worker-notificacao-sem-duplicar.ts`. Expected: os dois passam. Se o teste antigo usa `{ sendMessage }` como serviço falso, ajustar só o dublê para `sendMessageRastreado`, sem mudar a intenção dos casos.

- [ ] **Step 6: Commit** `feat(bot): guarda o SID e pede o status de entrega das notificacoes`.

### Task 4: webhook de status grava o resultado

**Files:**
- Create: `integrations/whatsapp/webhookStatus.ts`
- Modify: `integrations/supabase/supabaseService.ts` (método novo perto dos outros de notificação)
- Modify: `src/server-twilio.ts:165-172`
- Test: `tests/test-status-entrega-whatsapp.ts`

**Interfaces:**
- Consumes: `proximoStatusEntrega` e `StatusEntrega` (Task 2).
- Produces:
  - `SupabaseService.buscarStatusEntrega(ref: { notificacaoId?: string; sid?: string }): Promise<{ notificacao_id: string; status_entrega: string | null } | null>`
  - `SupabaseService.gravarStatusEntrega(notificacaoId: string, campos: { status_entrega: string; erro_codigo: string | null; twilio_sid?: string }): Promise<void>` (lança em erro).
  - `export function criarWebhookStatus(deps: { buscar: SupabaseService['buscarStatusEntrega']; gravar: SupabaseService['gravarStatusEntrega'] }): (req: Request, res: Response) => Promise<void>`

- [ ] **Step 1: Write the failing tests** com `req`/`res` falsos (`res.sendStatus` registra o código) e `buscar`/`gravar` em memória:
  - `callback com notificacao na query atualiza por ela`: com `query.notificacao` sendo um UUID válido e o body `{ MessageSid: 'SM1', MessageStatus: 'undelivered', ErrorCode: '63016' }`, a linha `status_entrega='enviado'` fica `undelivered`, `erro_codigo='63016'` e `twilio_sid='SM1'`; a resposta é 200.
  - `callback antes do SID ser gravado funciona`: a linha não tem SID e a query tem o id; mesmo resultado.
  - `sem query, acha pelo SID`.
  - `status que nao avanca nao grava`: com o atual `delivered` e `sent` recebido, `gravar` não é chamado; 200.
  - `notificacao inexistente ou query invalida`: com `notificacao=abc` ou id desconhecido, `gravar` não é chamado; 200, sem lançar.
  - `erro do banco vira log, nao 500`: se `gravar` lança, a resposta é 200 e o `console.error` não contém o telefone do body `To`.

- [ ] **Step 2: Run** `npx tsx tests/test-status-entrega-whatsapp.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `criarWebhookStatus`. Valida o UUID da query; `buscar` por id ou SID; `proximoStatusEntrega(atual, MessageStatus)`; se não for `null`, `gravar(id, { status_entrega, erro_codigo: ErrorCode ?? null, twilio_sid: MessageSid })`; `res.sendStatus(200)` sempre. O log mantém a linha atual com `mascararTelefone(To)`. Os métodos do `SupabaseService` usam `this.getClient().from('notificacoes_whatsapp')`.

- [ ] **Step 4: Wire** em `src/server-twilio.ts`: `app.post('/webhook/status', validarAssinaturaTwilio, criarWebhookStatus({ buscar: (r) => getSupabaseService().buscarStatusEntrega(r), gravar: (id, c) => getSupabaseService().gravarStatusEntrega(id, c) }))`. A assinatura continua validando a URL com a query, porque `montarUrlWebhook` usa `originalUrl`.

- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: tudo passa.

- [ ] **Step 6: Commit** `feat(bot): webhook de status grava se a notificacao chegou`.

### Task 5: regras do dashboard (puras)

**Files:**
- Modify: `dashboard/lib/adminAtribuicoes.ts`
- Create: `dashboard/lib/avisoPrazo.ts`
- Create: `tests/test-dashboard-alterar-prazo.ts`

**Interfaces:**
- Produces:
  - `export type AlterarPrazoValidation = { ok: true; novoPrazo: string } | { ok: false; error: string }`
  - `export function validateAlterarPrazoBody(body: unknown): AlterarPrazoValidation`
  - `getAtribuicaoActionStatus`: `concluida` → 409 e `sem_mudanca` → 409, somados aos existentes.
  - `export interface AvisoPrazoLinha { eng_projeto_id: string; created_at: string; enviada: boolean; tentativas: number; status_entrega: string | null; erro_codigo: string | null }`
  - `export type EstadoAvisoPrazo = { icone: 'enviando' | 'entregue' | 'enviado' | 'falhou'; texto: string }`
  - `export function estadoAvisoPrazo(linha: AvisoPrazoLinha): EstadoAvisoPrazo`
  - `export function temAvisoEnviando(linhas: AvisoPrazoLinha[], agoraMs: number): boolean` (algum `enviando` com menos de 10 minutos).

- [ ] **Step 1: Write the failing test.** Importa os módulos com `import * as modNs` + `.default ?? modNs`, como em `tests/test-dashboard-admin-projetos.ts`.
```ts
assert.deepEqual(validateAlterarPrazoBody({ novo_prazo: '2026-11-20' }), { ok: true, novoPrazo: '2026-11-20' })
for (const ruim of [null, {}, { novo_prazo: '' }, { novo_prazo: '20/11/2026' }, { novo_prazo: '2026-02-30' }, { novo_prazo: '2026-13-01' }, { novo_prazo: 20261120 }])
  assert.equal(validateAlterarPrazoBody(ruim).ok, false)
assert.equal(getAtribuicaoActionStatus({ ok: false, codigo: 'concluida' }), 409)
assert.equal(getAtribuicaoActionStatus({ ok: false, codigo: 'sem_mudanca' }), 409)
const base = { eng_projeto_id: 'a', created_at: '2026-10-29T12:00:00Z', enviada: false, tentativas: 0, status_entrega: null, erro_codigo: null }
assert.equal(estadoAvisoPrazo(base).icone, 'enviando')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'enviado' }).icone, 'enviado')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'sent' }).icone, 'enviando')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'delivered' }).icone, 'entregue')
assert.equal(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'read' }).icone, 'entregue')
assert.deepEqual(estadoAvisoPrazo({ ...base, enviada: true, status_entrega: 'undelivered', erro_codigo: '63016' }),
  { icone: 'falhou', texto: 'Aviso não entregue: o engenheiro não fala com o bot há mais de 24h' })
assert.deepEqual(estadoAvisoPrazo({ ...base, status_entrega: 'sem_telefone' }),
  { icone: 'falhou', texto: 'Aviso não enviado: engenheiro sem telefone cadastrado' })
assert.equal(estadoAvisoPrazo({ ...base, tentativas: 5 }).icone, 'falhou')
assert.equal(temAvisoEnviando([base], Date.parse('2026-10-29T12:05:00Z')), true)
assert.equal(temAvisoEnviando([base], Date.parse('2026-10-29T12:11:00Z')), false)
```
Textos de ✓: `entregue` → "Aviso entregue ao engenheiro"; `enviado` → "Aviso enviado, sem confirmação de entrega"; `enviando` → "Enviando aviso ao engenheiro…".

- [ ] **Step 2: Run** `npx tsx tests/test-dashboard-alterar-prazo.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Data real em `validateAlterarPrazoBody`: regex `^\d{4}-\d{2}-\d{2}$` e ida e volta por `Date.UTC`. `motivoFalha` do dashboard repete a regra da Task 2 (63016 → "não fala com o bot há mais de 24h"), porque dashboard e bot não compartilham módulo.

- [ ] **Step 4: Run.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(dashboard): regras de validacao do prazo e do estado do aviso`.

### Task 6: rotas do dono e helpers de fetch

**Files:**
- Create: `dashboard/app/api/admin/atribuicoes/[id]/prazo/route.ts`
- Create: `dashboard/app/api/admin/atribuicoes/avisos-prazo/route.ts`
- Modify: `dashboard/lib/supabase.ts` (perto de `transferirResponsavelAtribuicao`, linha ~710)
- Test: `tests/test-dashboard-alterar-prazo.ts`

**Interfaces:**
- Consumes: `validateAlterarPrazoBody` e `AvisoPrazoLinha` (Task 5); a RPC (Task 1).
- Produces:
  - `PATCH /api/admin/atribuicoes/[id]/prazo`, body `{ novo_prazo }`. 200 `{ result }` com o JSON da RPC. Erros `{ error, result: { codigo, mensagem } }` com o status de `getAtribuicaoActionStatus`.
  - `GET /api/admin/atribuicoes/avisos-prazo` → 200 `{ avisos: AvisoPrazoLinha[] }`, só o mais recente por `eng_projeto_id`, de `tipo='prazo_alterado'` nos últimos 60 dias.
  - `export async function alterarPrazoAtribuicao(atribuicaoId: string, novoPrazo: string): Promise<{ success: boolean; data?: any; error?: string }>`
  - `export async function buscarAvisosPrazo(): Promise<AvisoPrazoLinha[]>`, que devolve `[]` em erro.

- [ ] **Step 1: Write the failing tests** (checagens estáticas, como no teste de rotas existente; ler os arquivos como texto):
  - `rota de prazo exige dono e chama a RPC`: o arquivo contém `guardOwnerRoute()`, `isUuid(params.id)`, `validateAlterarPrazoBody`, `rpc('alterar_prazo_atribuicao'`, `p_actor_user_id: guard.owner.id` e `sanitizeAtribuicaoActionResult`.
  - `rota de avisos exige dono e nao expoe telefone nem mensagem`: contém `guardOwnerRoute()` e `.eq('tipo', 'prazo_alterado')`; a string do `.select(` não contém `telefone`, `mensagem` nem `*`.

- [ ] **Step 2: Run.** Expected: FAIL (ENOENT).

- [ ] **Step 3: Implement** a rota de prazo copiando a estrutura de `dashboard/app/api/admin/atribuicoes/[id]/responsavel/route.ts`, com o fallback "Nao foi possivel alterar o prazo. Tente novamente.". A rota de avisos faz `createAdminClient().from('notificacoes_whatsapp').select('eng_projeto_id, created_at, enviada, tentativas, status_entrega, erro_codigo').eq('tipo', 'prazo_alterado').not('eng_projeto_id', 'is', null).gte('created_at', <agora - 60 dias>).order('created_at', { ascending: false })`. Deduplica por `eng_projeto_id` no servidor, fica com o primeiro de cada, e erros passam por `handleApiError`. Os helpers em `lib/supabase.ts` usam o mesmo formato de `transferirResponsavelAtribuicao`.

- [ ] **Step 4: Run** `npm test`. Expected: tudo passa, inclusive `test-authenticated-somente-leitura-migration` (a RPC agora é chamada e é aceita por `protegidasDepois`) e `test-dashboard-admin-projetos`, sem escrita no navegador.

- [ ] **Step 5: Commit** `feat(dashboard): rotas do dono para alterar prazo e ver os avisos`.

### Task 7: botão, modal e ícone na tabela

**Files:**
- Modify: `dashboard/components/ProjetosTable.tsx` (props 50-57, estado ~77-90, célula do prazo 632-636, ações 659-713, modais ~757-909)
- Modify: `dashboard/components/DashboardClient.tsx` (handlers 271-301, `loadData`, as 4 `<ProjetosTable>` 495-549)

**Interfaces:**
- Consumes: `alterarPrazoAtribuicao`, `buscarAvisosPrazo` e `AvisoPrazoLinha` (Task 6); `estadoAvisoPrazo` e `temAvisoEnviando` (Task 5).
- Produces (props novas de `ProjetosTable`):
  - `onAlterarPrazo?: (projeto: Projeto, novoPrazo: string) => Promise<string | null>`, que devolve a mensagem de sucesso extra ("Prazo do cliente ajustado para dd/mm/aaaa") ou `null`, e lança `Error` com a mensagem do servidor;
  - `avisosPrazo?: Record<string, AvisoPrazoLinha>`, indexado por `atribuicao_id`.

- [ ] **Step 1: Implement `ProjetosTable`:**
  - Botão `CalendarClock` (lucide) entre o Eye e o UserRoundCog, só se `onAlterarPrazo` vier, com `title`/`aria-label` "Alterar prazo". Fica `disabled` sem `atribuicao_id` ou com `item.percentual_andamento >= 100`.
  - Modal inline no padrão do de transferência: título "Alterar prazo — <codigo> / <engenheiro>"; linhas "Início: dd/mm/aaaa" e "Prazo atual: dd/mm/aaaa", com `formatarDataBR`; `<input type="date" min={toDataISO(data_inicio) ?? undefined} value=...>`, que já vem com o prazo atual; botões Cancelar e Salvar, com Salvar desabilitado enquanto envia ou se a data for igual à atual; Escape fecha; o erro do servidor aparece em `actionError`. No sucesso fecha e, se o retorno não for `null`, mostra a mensagem extra pelo mesmo mecanismo de aviso que a tabela já usa (sem `alert()`).
  - Na célula do prazo, se `avisosPrazo?.[item.atribuicao_id]` existir, ao lado da data aparece um ícone com `estadoAvisoPrazo`: `Loader2` animado (enviando), `CheckCircle` verde (entregue), `CheckCircle` cinza (enviado) ou `AlertTriangle` laranja (falhou). Todos levam `title={texto}` e `aria-label={texto}`.

- [ ] **Step 2: Implement `DashboardClient`:**
  - `handleAlterarPrazo(projeto, novoPrazo)` no modelo de `handleTransferirResponsavel`. Chama `alterarPrazoAtribuicao` e lança em falha. Depois roda `await loadData()`. Devolve `"Prazo do cliente ajustado para " + formatarDataBR(result.prazo_cliente)` quando `cliente_ajustado > 0`; senão, `null`.
  - Estado `avisosPrazo`, preenchido em `loadData` por `buscarAvisosPrazo()` só se `isOwner`.
  - `useEffect` de polling: enquanto `isOwner && temAvisoEnviando(Object.values(avisosPrazo), Date.now())`, um `setInterval` de 20 s chama só `buscarAvisosPrazo()` quando `document.visibilityState === 'visible'`. O intervalo é limpo no cleanup.
  - Nas 4 `<ProjetosTable>`: `onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}` e `avisosPrazo={isOwner ? avisosPrazo : undefined}`.

- [ ] **Step 3: Run** `cd dashboard && npm run lint && npm run build`. Expected: lint sem erros e build ok. Depois, **run** `npm test && npm run typecheck` na raiz. Expected: tudo passa.

- [ ] **Step 4: Run the app locally** (`cd dashboard && npm run dev`, logado como dono, apontando para o banco de produção só em leitura): o botão aparece, o modal abre com o prazo atual, o `min` bloqueia datas antes do início e a concluída aparece com o botão desabilitado. **Não salvar contra produção** antes de a migration estar aplicada; o salvar é verificado na Task 8.

- [ ] **Step 5: Commit** `feat(dashboard): alterar prazo na tabela de projetos e mostrar se o aviso chegou`.

### Task 8: documentação, PR e verificação em produção

**Files:**
- Modify: `README.md` (seção do dashboard, nas ações do dono)
- Modify: `docs/DEPLOY.md` (ordem migration → deploy; `TWILIO_WEBHOOK_BASE_URL` / `RAILWAY_PUBLIC_DOMAIN` para o callback)

- [ ] **Step 1: Docs.** No README: "Alterar prazo", com o que acontece (aviso no WhatsApp; o prazo do cliente é empurrado se ficar para trás) e o que cada ícone significa. No DEPLOY: aplicar `20261029_alterar_prazo_atribuicao.sql` antes do deploy, a conferência da seção 4, e que o callback usa `TWILIO_WEBHOOK_BASE_URL` ou, se ela faltar, `RAILWAY_PUBLIC_DOMAIN`.

- [ ] **Step 2: Run** `npm test && npm run typecheck && (cd dashboard && npm run lint && npm run build)`. Expected: tudo verde. Commit `docs: alterar prazo pelo dashboard`, push e PR para `main`, com a descrição incluindo a ordem de aplicação e o resultado do PGlite (Task 1, Step 8). CI verde.

- [ ] **Step 3: Produção**, com a migration já aplicada, o merge e o deploy feitos:
  - a conferência da migration dá as 5 colunas, `authenticated` sem execução e `service_role` com execução;
  - `GET /health` responde 200;
  - no Railway, `RAILWAY_PUBLIC_DOMAIN` ou `TWILIO_WEBHOOK_BASE_URL` existe no serviço do bot.

- [ ] **Step 4: Ao vivo.** Escolher uma atribuição de um engenheiro que falou com o bot nas últimas 24h, de preferência um número de teste, e mudar o prazo no dashboard logado como dono. Expected:
  - a data nova aparece na tabela e em "Meus projetos" no bot;
  - a mensagem "📅 Prazo alterado" chega;
  - o ícone vai de ⏳ para ✓ verde em até ~2 min;
  - a linha em `notificacoes_whatsapp` tem `twilio_sid` e `status_entrega` `delivered` ou `read`;
  - o log do Railway mostra o callback, sem "Assinatura Twilio invalida".

  Depois, uma atribuição de engenheiro há mais de 24h sem falar com o bot deve mostrar ⚠ "não fala com o bot há mais de 24h". Voltar os prazos originais se as atribuições forem reais (isso gera mais um aviso, o que é esperado).

- [ ] **Step 5: Sem regressão.** Uma atribuição nova gera 1 `NOVA_TAREFA`, agora com `twilio_sid`. Os lembretes da manhã e da noite saem uma vez só, conferido no Twilio no dia seguinte, como nas ondas anteriores.
