# Roteiro de testes manuais — fluxo do engenheiro

Testes que só fazem sentido à mão, no WhatsApp de verdade: navegação, mensagens que o engenheiro vê,
e o que chega ao banco. O que dá para automatizar já está automatizado — veja
[Testes no README](../README.md#testes) antes de percorrer isto.

## Pré-requisitos

- Engenheiro cadastrado em `engenheiros` com o telefone a ser usado e `ativo = true`. O caminho é o
  dashboard, `/admin` → "Engenheiros do chatbot". Sem isso o bot responde
  `❌ *Número não cadastrado*`.
- **Atribuições** desse engenheiro em `engenheiros_projetos`, com pavimentos e etapas. Sem elas todo
  fluxo morre em `📭 Você não tem projetos pendentes para atualizar no momento.`
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas.
- Para testar sem enviar mensagem real, `WHATSAPP_PROVIDER=development` imprime as respostas no
  console.

Ao conferir o banco, as tabelas que interessam são `projetos_previsao` (previsão e feito do dia) e
`retrabalho_projetos` (horas do dia).

---

## Teste 1: Notificação Matinal

1. `menu` → esperado: `📋 *Menu do Engenheiro*` com as 4 opções
2. `1` → esperado: `🌅 *Notificação Matinal*` + `📋 Escolha o projeto:` + lista com `Área:` e
   `Status:` por item
3. `1` (ou o número de um projeto da lista) → esperado:
   `📝 *O que você pretende fazer hoje?*`
4. `abc` → esperado: `❌ Previsão muito curta. Digite pelo menos 5 caracteres.`
5. `Dimensionar os quadros do 2o pavimento` → esperado:
   `✅ *Notificação Matinal Registrada!*` com projeto e previsão, terminando em
   `Tenha um ótimo dia de trabalho! 🚀`
   - [ ] `projetos_previsao` tem linha de hoje para a atribuição, com `previsao_texto` preenchido

---

## Teste 2: Notificação Noturna (fluxo completo)

O fluxo mais longo, e o que alimenta os indicadores.

1. `menu` → `2` → esperado: `🌙 *Notificação Noturna*` + lista de projetos
2. escolher o projeto → esperado: `✅ Projeto: *<CODIGO>*` seguido de
   `✔️ *O que foi feito hoje?*`
3. `abc` → esperado: `❌ Descrição muito curta. Digite pelo menos 5 caracteres.`
4. `Revisao das pranchas do 3o pavimento` → esperado: `✅ Feito registrado!` +
   `⏱️ *Quantas horas foram trabalhadas hoje nesta tarefa/disciplina?*`
5. `abc` → esperado: `❌ Informe um número maior que zero para as horas trabalhadas.`
6. `8` → esperado: `✅ Horas registradas: 8` + `🔄 *Teve retrabalho/paralisação hoje?*`
7. `1` (sim) → esperado: `⚠️ *Motivo do Retrabalho / Paralisação*` com os 6 motivos
8. `3` → esperado: `✅ Motivo registrado: Erro de projeto (TecPred)` +
   `⏱️ *Quantas horas foram gastas no retrabalho/paralisação?*`
9. `9` → esperado:
   `❌ As horas de retrabalho não podem ser maiores que as horas trabalhadas totais.`
10. `2` → **cai na tela de confirmação** (Teste 3)
11. `1` para confirmar → esperado: `✅ Retrabalho registrado: 2h de 8h (25.0%)` +
    `📝 *Quer adicionar observações?*`
12. `1` → `📝 *Observações*`; `ab` → `❌ Observação muito curta. Digite pelo menos 3 caracteres.`
13. `Cliente enviou revisao no fim do dia` → esperado:
    `✅ *Notificação Noturna Registrada!*` com projeto, feito, retrabalho e observações
14. Se a disciplina tiver etapa pendente, a mensagem emenda
    `📐 *Alguma etapa foi concluída hoje?*`; `2` encerra com `Descanse bem! 🌙`

Verificações no banco:

- [ ] `retrabalho_projetos` tem **uma** linha de hoje, com `horas_trabalhadas_total = 8`,
      `horas_retrabalho = 2` e o motivo
- [ ] `projetos_previsao` de hoje tem `feito_texto` e `data_fim_dia` preenchidos
- [ ] o percentual de retrabalho no dashboard bate com os 25,0% mostrados

---

## Teste 3: Confirmação das horas

A tela de confirmação é o **único ponto de gravação** das horas. Ela existe porque
`registrar_retrabalho_dia` é upsert por (atribuição, dia): sem revisão, um `80` digitado no lugar de
`8` sobrescreveria o valor certo e contaminaria o indicador.

### 3.1 Ramo com retrabalho — confirmar

Percorra o Teste 2 até o passo 10. Esperado:

```
🔎 *Confirme as horas do dia:*

⏱️ Horas trabalhadas: *8h*
⚠️ Motivo: Erro de projeto (TecPred)
🔄 Horas de retrabalho: *2h* (25.0%)

1️⃣ Confirmar e gravar
2️⃣ Corrigir as horas

*0.* Voltar | *menu* — início
```

- [ ] **No Supabase: nenhuma linha de hoje em `retrabalho_projetos` para esta atribuição ainda**
- [ ] Depois de `1`: a linha aparece, com 8 e 2

### 3.2 Corrigir as horas

1. Chegue à tela de confirmação
2. `2` → esperado: volta a `⏱️ *Quantas horas foram trabalhadas hoje...*`, **sem** mensagem de erro
   - [ ] Nada gravado no banco
3. Refaça com `4` / `1` / `1` / `1` e confirme
   - [ ] A linha tem as horas **novas** (4 e 1), sem resquício das anteriores

### 3.3 Voltar com `0` na confirmação

1. Chegue à tela de confirmação
2. `0` → esperado: volta a `⏱️ *Quantas horas foram gastas no retrabalho/paralisação?*`
   - [ ] Sem `❌` na resposta — voltar não é erro de validação
   - [ ] Nada gravado no banco

### 3.4 Ramo sem retrabalho

1. Percorra até as horas trabalhadas, informe `8`, responda `2` (não teve retrabalho)
   - Esperado: confirmação com `⏱️ Horas trabalhadas: *8h*` e `🔄 Sem retrabalho hoje`, **sem**
     percentual
   - [ ] Nada gravado ainda
2. `1` → esperado: `✅ Sem retrabalho!` + pergunta de observações
   - [ ] Linha com `horas_trabalhadas_total = 8` e `horas_retrabalho = 0`

### 3.5 Entrada inválida

Na tela de confirmação, enviar `x`, `3` e `sim`:

- Esperado nas três: `❌ Digite *1* para confirmar ou *2* para corrigir.`
- [ ] Continua na tela de confirmação, nada gravado

---

## Teste 4: Visualizar Meus Projetos

1. `menu` → `3` → esperado: `📊 *Meus Projetos (N)*` com código, área, status, andamento e data
   prevista por item
2. escolher um número → esperado: bloco `📊 *Detalhes do Projeto*` com projeto, cliente, área,
   status da área, andamento global e datas
3. [ ] Nada é gravado — este fluxo é só leitura

---

## Teste 5: Marcar Etapa Concluída

1. `menu` → `4` → esperado: `📐 *Marcar Etapa Concluída*` + lista de projetos
2. escolher projeto → esperado: `📦 *Áreas do Projeto <CODIGO>:*` com o percentual por disciplina
3. escolher uma disciplina **não** concluída → esperado:
   `📋 *O que deseja marcar em <CODIGO>?*` com as opções de escopo
4. Escolher um escopo e percorrer até a confirmação `🔎 *Confirme a marcação:*`
5. `1` → esperado: `✅ *N etapa(s) marcada(s) como concluída(s)!*` + `⚡ Andamento: *X%*`
   - [ ] O percentual subiu de acordo com o peso da etapa (ver
         [progresso ponderado](../README.md#progresso-ponderado))
   - [ ] `pavimento_etapas.concluida` e `data_conclusao` preenchidos
   - [ ] `engenheiros_projetos.percentual_ponderado` recalculado, e
         `projetos.percentual_ponderado` também (o trigger propaga na mesma transação)
6. Depois de confirmar, `0` → esperado:
   `ℹ️ Esta ação já foi registrada. Digite *menu* para voltar ao início.`

### 5.1 Disciplina sem etapas cadastradas

Se a disciplina não tiver estrutura, esperado
`ℹ️ Esta disciplina de *<CODIGO>* não possui etapas cadastradas.` com a opção de marcar 100%
manualmente (RPC `marcar_area_concluida`).

---

## Teste 6: Navegação

O ponto fraco histórico do fluxo — teste com atenção.

1. Em **qualquer** tela intermediária, `0` deve devolver a **pergunta anterior**, nunca um `❌`.
   Percorra a noturna e aperte `0` em cada passo:
   - [ ] horas trabalhadas → `✔️ *O que foi feito hoje?*`
   - [ ] motivo do retrabalho → `🔄 *Teve retrabalho/paralisação hoje?*`
   - [ ] horas de retrabalho → `⚠️ *Motivo do Retrabalho / Paralisação*`
   - [ ] observações → `📝 *Quer adicionar observações?*`
   - [ ] "alguma etapa foi concluída" → `📝 *Observações*`
2. `menu` em qualquer ponto → esperado: `⬅️ *Voltando ao menu principal*` + o menu
3. `cancelar` → esperado: `❌ *Fluxo cancelado*`
4. Opção inexistente no menu (`9`) → esperado: `❌ Opção inválida. Digite *1*, *2*, *3* ou *4*.`

> **Limitação conhecida:** nas telas de **lista de projetos**, o `0` re-renderiza a mesma lista e
> nunca sobe até o menu, apesar do rodapé anunciar "Voltar". Use `menu`. Ver
> [Limitações](../README.md#limitações-conhecidas).

---

## Teste 7: Listas vazias e disciplina concluída

1. Engenheiro sem nenhuma atribuição pendente, opção `1` ou `2` → esperado:
   `📭 Você não tem projetos pendentes para atualizar no momento.`
   (nas opções `3` e `4` a mensagem é `📭 Você não tem projetos pendentes no momento.`)
2. Escolher uma atribuição já em 100% → esperado:
   `✅ *<CODIGO>* (<Área>) já está concluída!` com o andamento
3. Projeto com todas as disciplinas em 100%, na opção `4` → esperado:
   `🎉 Todas as disciplinas do projeto *<CODIGO>* já foram concluídas!`

---

## Teste 8: Número não reconhecido e banco fora

1. Mandar mensagem de um número **não cadastrado** → esperado: `❌ *Número não cadastrado*`
2. Cadastrar esse número em `/admin` e mandar **outra** mensagem, sem reiniciar o processo →
   esperado: o menu aparece (o handler reautentica a cada mensagem)
3. Derrubar o acesso ao banco (ex.: `SUPABASE_URL` inválida) e mandar mensagem → esperado:
   `⚠️ *Serviço temporariamente indisponível*`
   - [ ] Nenhum detalhe técnico ou credencial aparece na resposta
   - [ ] Ao restaurar o banco, a mensagem seguinte já funciona — o veredito errado **não** ficou em
         cache por 15 minutos

O comportamento dos três casos é coberto por `npm run test:seguranca`; o teste manual serve para
confirmar o texto que o usuário final vê.

---

## Teste 9: Áudio

**Só funciona no caminho legado.** Com `npm run dev:whatsapp-web` (whatsapp-web.js + QR Code), o
áudio é transcrito pelo Whisper e tratado como texto — exige `OPENAI_API_KEY`.

1. `npm run dev:whatsapp-web`, escanear o QR Code
2. Enviar áudio dizendo `menu` → esperado: o menu aparece
3. Enviar áudio com um número (`dois`) → **provavelmente falha**: o fluxo espera o dígito `2`, e a
   transcrição devolve a palavra

> **Em produção áudio não funciona.** O servidor Twilio lê apenas o campo `Body` do webhook e ignora
> mídia: um áudio chega sem `Body` e devolve `400 Bad Request`. Não teste áudio contra o ambiente de
> produção esperando que funcione.

---

## Teste 10: Múltiplos usuários

Isolamento de sessões — cada número tem sua própria instância de fluxo.

1. Engenheiro A inicia a Notificação Noturna e para no passo das horas
2. Engenheiro B inicia a Notificação Matinal e conclui
3. Engenheiro A envia as horas
   - [ ] A continua exatamente onde parou, com o projeto que **ele** escolheu
   - [ ] Os registros vão para as atribuições corretas, sem troca
4. Aguardar 15 minutos sem interagir e mandar mensagem
   - [ ] A sessão expirou e o fluxo recomeça do menu

> Sessões vivem em memória: **um deploy no meio de um fluxo derruba as conversas em andamento**. Vale
> testar reiniciando o processo com um fluxo aberto, para saber como isso aparece para o usuário.

---

## Checklist final

Antes de considerar o fluxo pronto para produção:

- [ ] Notificação matinal grava `previsao_texto` em `projetos_previsao`
- [ ] Notificação noturna grava feito, horas e retrabalho, cada um na sua tabela
- [ ] **Nenhuma** gravação de horas acontece antes do `1` na tela de confirmação
- [ ] `2` na confirmação reabre a pergunta de horas e descarta motivo e horas antigos
- [ ] `0` devolve a pergunta anterior em todos os passos intermediários, sem `❌`
- [ ] `menu` e `cancelar` funcionam de qualquer ponto
- [ ] Marcar etapa recalcula o percentual da disciplina e do projeto
- [ ] Disciplina e projeto concluídos são bloqueados para nova ação
- [ ] Número não cadastrado, e banco fora, dão mensagens **diferentes**
- [ ] Nenhuma credencial ou detalhe técnico aparece nas respostas
- [ ] O percentual de retrabalho no dashboard bate com as horas apontadas

## Bugs encontrados

Registre aqui o que aparecer durante os testes. As limitações já conhecidas estão em
[Limitações conhecidas](../README.md#limitações-conhecidas) — não precisa repetir.
