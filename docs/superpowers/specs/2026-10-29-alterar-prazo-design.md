# Alterar o prazo de uma tarefa pelo dashboard (TecPred)

Desenho aprovado em 29/10/2026. Plano de execução: `docs/superpowers/plans/2026-10-29-alterar-prazo.md`.

## Contexto

Hoje o prazo (`engenheiros_projetos.data_prevista`) só é definido na criação (`dashboard/components/AtribuirTask.tsx:415`) e depois é só leitura no dashboard. O dono já consegue mudar pelo WhatsApp (`chatbot/flows/ownerFlow.ts:1438-1590`), mas o dashboard, que é onde dono e admin trabalham, não tem essa opção. Engenheiros só usam o bot.

Decisões de produto:
- Funcionalidade **só do dashboard**, para quem é dono (no sistema só existe o papel `owner`; "admin" é um dono também).
- Ao mudar, **avisar o engenheiro pelo WhatsApp**.
- Se o aviso não chegar (o 63016, engenheiro há mais de 24h sem falar com o bot), **mostrar na linha da tabela**: um ícone ao lado do prazo (⏳ enviando, ✓ entregue, ⚠ não entregue, com o motivo no tooltip). O ícone fica até a próxima mudança de prazo.

Fato técnico que molda o plano: o 63016 não aparece no envio. O Twilio aceita a mensagem e só depois manda o resultado para `/webhook/status` (`src/server-twilio.ts:166`), que hoje só escreve no log. Para saber se chegou é preciso guardar o SID da mensagem e gravar o resultado do callback.

## Objetivos, fora do escopo, anti-objetivos

- **Objetivo:** botão "Alterar prazo" na linha da tabela de projetos; data nova vale em todas as telas, no bot, nas views de atraso e no Sheets; engenheiro recebe o aviso; dashboard mostra se chegou.
- **Fora do escopo:**
  - histórico de mudanças de prazo (só fica a própria notificação);
  - editar o prazo do cliente diretamente (ele só é empurrado junto, ver abaixo);
  - edição pela tabela de execução dos engenheiros;
  - o fluxo do dono pelo WhatsApp: continua como está e não avisa;
  - o +1 dia automático do retrabalho (`atualizar_status_retrabalho`): continua sem aviso.
- **Anti-objetivos:**
  - aviso duplicado para o engenheiro;
  - qualquer mudança que reescreva dados antigos de produção;
  - engenheiro (papel `engenheiro`) conseguindo alterar;
  - telefone ou nome real em arquivo versionado.

## Prazo do cliente

- se a tarefa tiver linha em `prazos` e o novo prazo passar de `prazo_final_cliente`, o prazo do cliente é **empurrado junto** para a mesma data. O dashboard informa "prazo do cliente ajustado para dd/mm". Isso vale só para as tarefas distribuídas pelo bot, porque as criadas no dashboard não têm linha em `prazos`.

## Decisões do builder (minhas, para conferir)

1. **Novo prazo ≥ data de início** da atribuição. É a mesma regra que `dono_distribuir_projeto_com_prazos` já aplica (`baseline:2584`); só o caminho do dashboard não tinha essa trava. Prazo no passado é permitido se for ≥ início, porque serve para corrigir.
2. **Mesma data que a atual:** recusado com "O prazo já é essa data", sem aviso.
3. **Só atribuições ativas e não concluídas.** Concluída é `percentual_ponderado >= 100`, a regra única do projeto (`tests/test-regra-atribuicao-concluida.ts`). O botão e a RPC usam a mesma regra.
4. **Duas mudanças antes do aviso sair:** a RPC **substitui** o aviso ainda pendente (`enviada=false AND tentativas=0`, update condicional) em vez de criar outro. O engenheiro recebe só o prazo final. Se o worker já reservou a linha, entra um aviso novo.
5. **Engenheiro sem telefone:** o prazo muda. A RPC grava o aviso com `telefone NULL` e `status_entrega='sem_telefone'`, e o worker passa a pular linhas sem telefone, que hoje falham 5 vezes. O ícone mostra ⚠ "engenheiro sem telefone cadastrado" e continua lá depois de recarregar.
6. **Sem callback configurado:** o status fica "enviado" (✓ cinza, "enviado, sem confirmação de entrega"), nunca "entregue".
7. **SID e status para todas as notificações** que passam pela fila. Não muda nada visível para os outros tipos e ajuda no diagnóstico.

## Achados na produção (consulta só leitura, 29/10)

- `notificacoes_whatsapp` tem as colunas `created_at`, `data_envio`, `eng_id`, `enviada`, `erro_envio`, `mensagem`, `notificacao_id`, `projeto_id`, `task_id`, `telefone`, `tentativas`, `tipo` e `titulo`. **Não tem `eng_projeto_id`**, e a migration precisa adicioná-la.
- Nas 394 linhas, todas são `NOVA_TAREFA` e todas foram enviadas. O aviso `novo_projeto` (`notificar_novo_projeto`, `baseline:2748-2805`) **nunca foi criado**. Ele grava `eng_projeto_id` e `data_agendamento`, que não existem, e o erro some no `EXCEPTION`. Isso fica fora do escopo: o aviso que vale é o `NOVA_TAREFA`. Ao adicionar `eng_projeto_id`, **não** adicionar `data_agendamento`, para não ressuscitar sem querer um segundo aviso de criação.

## Implementação

### 1. Migration `supabase/migrations/20261029_alterar_prazo_atribuicao.sql` + `supabase/rollbacks/20261029_alterar_prazo_atribuicao.rollback.sql`

Aditiva, em `BEGIN/COMMIT`, sem `CURRENT_DATE` (usar `public.hoje_brt()` se precisar). Quem administra o Supabase aplica no SQL Editor fora da rede OpenDNS, **antes** do deploy.

- `ALTER TABLE notificacoes_whatsapp ADD COLUMN IF NOT EXISTS`:
  - `eng_projeto_id uuid REFERENCES engenheiros_projetos(id) ON DELETE SET NULL`, que não bloqueia a limpeza de `20260618`;
  - `twilio_sid text`;
  - `status_entrega text`;
  - `erro_codigo text`;
  - `status_atualizado_em timestamptz`.

  Índice em `twilio_sid` e em `(eng_projeto_id, tipo, created_at DESC)`. Linhas antigas ficam intocadas (colunas nulas).
- `CREATE FUNCTION public.alterar_prazo_atribuicao(p_atribuicao_id uuid, p_novo_prazo date, p_actor_user_id uuid) RETURNS json`. Segue o formato de `transferir_atribuicao` (`baseline:3281-3418`): `json_build_object('ok', …, 'codigo', …, 'mensagem', …)`. Passos:
  - `SELECT … FOR UPDATE` da `engenheiros_projetos` junto com projeto, área e engenheiro. Se não achar ou estiver inativa, devolve `nao_encontrada`. Se `percentual_ponderado >= 100`, devolve `concluida`. Se o prazo for nulo ou menor que `data_inicio`, devolve `parametro_invalido`. Se a data for a mesma, devolve `sem_mudanca`.
  - `UPDATE engenheiros_projetos SET data_prevista`. O trigger `trg_sync_datas_para_prazos` já atualiza `prazos.prazo_final_eng` se a linha existir. Depois disso, `UPDATE prazos SET prazo_final_cliente = p_novo_prazo WHERE eng_projeto_id = … AND prazo_final_cliente < p_novo_prazo`. Pode haver mais de uma linha, porque não existe UNIQUE; a quantidade ajustada volta em `cliente_ajustado`. Atualizar também a cópia `evandro_distribuicao_tasks.data_conclusao_prevista WHERE eng_projeto_id = p_atribuicao_id`.
  - Montar o aviso `prazo_alterado` com `eng_projeto_id`, `projeto_id`, `eng_id`, `telefone` e uma mensagem com projeto, cliente, área, prazo anterior e prazo novo. As datas saem de `to_char(…, 'DD/MM/YYYY')`, sem fuso. A mensagem termina com `_Digite "menu"…_`, no formato do `NOVA_TAREFA` (`20260703_dashboard_corrigir_notificacao_task_fk.sql:96`).
  - Gravar o aviso: primeiro tenta `UPDATE` do aviso pendente da mesma atribuição (`tipo='prazo_alterado' AND enviada=false AND tentativas=0`). O "prazo anterior" da mensagem continua sendo o que o engenheiro conhecia. Se nenhuma linha mudar, faz `INSERT`. Sem telefone, grava `telefone NULL` e `status_entrega='sem_telefone'`.
  - Retorna `prazo_anterior`, `prazo_novo`, `cliente_ajustado` e `aviso`, que vale `na_fila` ou `sem_telefone`. Erros internos vão **sem** `SQLERRM` na mensagem que chega ao navegador.
  - `REVOKE ALL … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`.
- Rollback: `DROP FUNCTION`, índices e colunas, com um aviso de que os status gravados se perdem.
- Trecho de conferência no fim, em comentário: `SELECT` que confirma colunas, função e grants.

### 2. Bot: gravar o SID e o resultado da entrega

- `integrations/whatsapp/whatsappService.ts`:
  - Novo `sendMessageRastreado(to, msg)` que devolve `{ ok, sid? }`.
  - O provider Twilio manda `StatusCallback = <base>/webhook/status`. A base vem de `TWILIO_WEBHOOK_BASE_URL` e, se faltar, de `https://${RAILWAY_PUBLIC_DOMAIN}`. Sem nenhuma das duas, não manda o callback.
  - Dev e Meta devolvem sem SID.
  - `sendMessage` vira um invólucro (`.ok`), e quem já o chama não muda.
- `integrations/notifications/notificationWorker.ts`: `buscarNotificacoesPendentes` passa a ignorar `telefone IS NULL`, que hoje falha 5 vezes. Usa o método novo. **Mantém o update `enviada: true` exatamente como está** e grava `twilio_sid`/`status_entrega='enviado'` num segundo update que não pode derrubar o envio. Se as colunas não existirem ou o update falhar, só registra no log: nunca reenviar (anti-duplicata).
- Novo `integrations/whatsapp/statusEntrega.ts` (puro):
  - `proximoStatusEntrega(atual, recebido)`: só avança na ordem `enviado < sent < delivered < read`; `failed`/`undelivered` são finais e não voltam atrás por callback fora de ordem.
  - `motivoFalha(codigo)`: `63016` → "não fala com o bot há mais de 24h"; outro código → "não entregue (código N)".
- `src/server-twilio.ts` `/webhook/status` (já valida assinatura): lê `MessageSid`, `MessageStatus` e `ErrorCode`, acha a linha pelo `notificacao_id` que vai na URL do callback (`/webhook/status?notificacao=<id>`) e, se ele faltar, pelo `twilio_sid`, e atualiza com `proximoStatusEntrega`. O id na URL evita a corrida de o Twilio chamar antes de o worker gravar o SID. Sempre responde 200; um erro só vai para o log, mascarado.

### 3. Dashboard

- `dashboard/lib/adminAtribuicoes.ts`:
  - `validateAlterarPrazoBody` exige `{ novo_prazo: 'YYYY-MM-DD' }` com data real;
  - os códigos novos entram em `getAtribuicaoActionStatus`: `concluida` → 409, `sem_mudanca` → 409.
- `PATCH dashboard/app/api/admin/atribuicoes/[id]/prazo/route.ts`: copia `…/[id]/responsavel/route.ts` (`guardOwnerRoute`, `isUuid`, JSON, validator, `rpc('alterar_prazo_atribuicao', { …, p_actor_user_id: guard.owner.id })`, `handleApiError`, `sanitizeAtribuicaoActionResult`).
- `GET dashboard/app/api/admin/atribuicoes/avisos-prazo/route.ts`: só para o dono. Com service role, devolve o último `prazo_alterado` de cada `eng_projeto_id` dos últimos 60 dias, só com `eng_projeto_id`, `created_at`, `enviada`, `tentativas`, `status_entrega` e `erro_codigo`. **Sem telefone e sem mensagem.**
- `dashboard/lib/avisoPrazo.ts` (puro): `estadoAvisoPrazo(linha)` devolve `{ icone: 'enviando'|'entregue'|'enviado'|'falhou', texto }`. Na fila ou enviando dá ⏳. Delivered ou read dá ✓. Enviado sem callback dá ✓ cinza. Failed, undelivered ou 5 tentativas sem sucesso dão ⚠ com o motivo.
- `dashboard/lib/supabase.ts`: os helpers `alterarPrazoAtribuicao(id, novoPrazo)` e `buscarAvisosPrazo()` são só `fetch`, sem `.rpc` nem `.from().update` no navegador, porque o teste `test-dashboard-admin-projetos` proíbe.
- `dashboard/components/ProjetosTable.tsx`:
  - botão `CalendarClock` entre o Eye e o UserRoundCog, só quando `onAlterarPrazo` vier, desabilitado para concluída ou sem `atribuicao_id`;
  - modal inline no mesmo padrão da transferência (757-845), com prazo atual, data de início e `<input type="date" min={data_inicio}>`, erro do servidor exibido e Escape fecha;
  - na célula do prazo (632-636), o ícone de `estadoAvisoPrazo` com `title` e `aria-label`.
- `dashboard/components/DashboardClient.tsx`:
  - `handleAlterarPrazo` igual a `handleTransferirResponsavel` (271-285);
  - passa `onAlterarPrazo={isOwner ? handleAlterarPrazo : undefined}` nas 4 `ProjetosTable`;
  - busca os avisos em `loadData` só se `isOwner`;
  - enquanto houver aviso ⏳ de menos de 10 minutos, refaz só `buscarAvisosPrazo` a cada 20 s, com a aba visível.

### 4. Testes (`npm test`)

- `tests/test-alterar-prazo-migration.ts`: modelo em `test-proteger-historico-migration.ts`. Confere:
  - `BEGIN/COMMIT`, o rollback e a ausência de `current_date`;
  - o revoke/grant `service_role`;
  - a trava de `data_inicio`, `sem_mudanca` e `concluida` (`percentual_ponderado`);
  - `ADD COLUMN eng_projeto_id` com `ON DELETE SET NULL` e **sem** `data_agendamento`;
  - o ajuste de `prazo_final_cliente` só quando for menor;
  - a substituição do aviso pendente antes do insert;
  - `sem_telefone`;
  - a ausência de `SQLERRM` no retorno.
- `tests/test-dashboard-alterar-prazo.ts`: modelo em `test-dashboard-admin-projetos.ts`. Cobre o validator, o mapeamento de códigos, `estadoAvisoPrazo` e a garantia de que a rota de avisos não seleciona `telefone` nem `mensagem`.
- `tests/test-status-entrega-whatsapp.ts`. Cobre:
  - `proximoStatusEntrega`, com fora de ordem e finais;
  - `motivoFalha`;
  - o worker com Supabase falso:
    - grava o SID depois de `enviada`;
    - se o update do SID falhar, **não** reenvia;
    - sem SID, não tenta gravar.
  - `sendMessageRastreado` Twilio com `fetch` falso: manda `StatusCallback` com a base certa e não manda sem base.
- Ajustar `tests/test-authenticated-somente-leitura-migration.ts:51-76` para aceitar RPCs de escrita criadas em migrations posteriores que fazem o revoke de `authenticated`, em vez de só a lista fixa de 28. Sem afrouxar a regra para os outros nomes.
- Incluir o teste de migration em `test:seguranca` (`package.json:10`).

### 5. Documentação

README: seção de ações do dono no dashboard e o que o ícone significa. Docs de deploy: ordem migration → deploy e a variável da base do callback.

## Arquivos

- **Novos:** a migration e o rollback de `20261029`; `integrations/whatsapp/statusEntrega.ts`; as rotas `dashboard/app/api/admin/atribuicoes/[id]/prazo/route.ts` e `avisos-prazo/route.ts`; `dashboard/lib/avisoPrazo.ts`; e 3 testes.
- **Alterados:** `whatsappService.ts`, `notificationWorker.ts`, `src/server-twilio.ts`, `dashboard/lib/adminAtribuicoes.ts`, `dashboard/lib/supabase.ts`, `ProjetosTable.tsx`, `DashboardClient.tsx`, `test-authenticated-somente-leitura-migration.ts`, `package.json` e o README.

## Verificação

1. **Local:**
   - `npm test`, `npm run typecheck` e o lint e build do dashboard (`cd dashboard && npm run lint && npm run build`), tudo verde e sem regressões;
   - CI verde no PR.
2. **Migration contra o banco real em miniatura:** PGlite (como na Onda 3) com o baseline e a migration. Chamar `alterar_prazo_atribuicao` com dados de mentira e conferir os quatro casos:
   - caminho feliz: `data_prevista` muda, `prazos` muda se existir, a cópia em tasks muda e entra 1 notificação;
   - prazo do cliente empurrado quando passa dele e intocado quando não passa;
   - duas mudanças seguidas produzem 1 aviso, com o prazo final;
   - recusas: antes do início, mesma data e concluída, sem efeito colateral;
   - sem telefone: aviso gravado com `status_entrega='sem_telefone'`, que o worker não tenta enviar;
   - rollback limpo.
3. **Produção** (aplicar a migration, depois merge e deploy):
   - conferir colunas, função e grants pelo trecho de conferência;
   - `GET /health` 200;
   - no Railway, ver `RAILWAY_PUBLIC_DOMAIN` ou `TWILIO_WEBHOOK_BASE_URL` presentes.
4. **Ao vivo, com o dashboard logado como dono:** mudar o prazo de uma atribuição de um engenheiro que falou com o bot nas últimas 24h, de preferência um número de teste. Conferir:
   - a data nova na tabela, em "Meus projetos" no bot e no detalhe;
   - a mensagem chega no WhatsApp;
   - o ícone vai de ⏳ para ✓ em até ~2 min;
   - a linha da notificação tem `twilio_sid` e `status_entrega='delivered'`;
   - o log do Railway mostra o callback aceito, sem 403.

   Em seguida, uma atribuição de engenheiro fora das 24h mostra ⚠ "não fala com o bot há mais de 24h". Voltar o prazo original depois do teste, se for uma atribuição real.
5. **Sem regressão:**
   - o `NOVA_TAREFA` de uma atribuição nova e os lembretes de manhã e de noite (que chamam `sendMessage` direto) continuam saindo uma vez só;
   - as linhas novas de `NOVA_TAREFA` passam a ter `twilio_sid` e `status_entrega`;
   - verificar no Twilio depois do deploy, como nas ondas anteriores.
