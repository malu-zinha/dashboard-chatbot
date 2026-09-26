# Autenticação do chatbot

Como o bot decide quem está falando com ele, e por que existem **quatro** desfechos em vez de dois.

Para a visão geral do sistema, veja o [README](../README.md). Este documento detalha só a
autenticação, que tem sutilezas que já causaram bug em produção.

> Este documento cita funções e arquivos, **não números de linha** — de propósito. A versão anterior
> apontava para "linhas 234-254" e estava errada em poucos meses.

## O modelo

Não há senha, token nem login. A identidade é o **número de WhatsApp**, e a autorização é a presença
desse número no banco. Consequências que valem entender antes de mexer:

- Quem cadastra um engenheiro é o dashboard, em `/admin` → "Engenheiros do chatbot" (tabela
  `engenheiros`). Sem passar por lá, o número não é reconhecido.
- O bot usa a **service role key** do Supabase, que **ignora RLS**. Nenhuma policy do banco protege
  nada aqui; o controle é a consulta que o código faz.
- `engenheiros.telefone` tem constraint `UNIQUE`, adicionada por
  `supabase/adicionar_telefone_auth.sql` (não está no schema base).

## Fluxo

```
mensagem chega (webhook Twilio)
  → normalizarWhatsapp(numero)
  → buscarEngenheiroPorTelefone()        engenheiros, telefone + ativo = true
       ├─ achou  → tipo_usuario = 'engenheiro'  → menu do engenheiro
       └─ nao achou
            → buscarDonoPorTelefone()    dono_empresa
                 ├─ achou  → tipo_usuario = 'dono'  → ownerFlow inicia direto
                 └─ nao achou → tipo_usuario = 'nao_cadastrado'
  → se o banco falhar em qualquer ponto acima → 'indisponivel' (nao e um tipo_usuario)
```

Tudo isso vive em `MessageHandler.autenticarUsuario()`
(`chatbot/handlers/messageHandler.ts`).

### Normalização do número

`normalizarWhatsapp()` precisa existir porque o mesmo telefone chega em formatos diferentes
dependendo do provider e do dispositivo. Ela:

1. remove os sufixos `@c.us` e `@lid` (formatos do whatsapp-web.js)
2. tira tudo que não é dígito
3. garante o prefixo `+55` **sem duplicar** o `55` quando ele já está lá

O passo 3 é o que mais dá problema: sem ele, `5583999990000` viraria `+555583999990000` e nunca
casaria com o cadastro.

## Os quatro desfechos

O tipo de retorno (`ResultadoAutenticacao`) separa deliberadamente "não cadastrado" de "banco
indisponível". Eles parecem iguais para quem escreve o código e são **completamente diferentes** para
quem usa o bot.

| Desfecho | O que o usuário recebe | Sessão é criada? |
|---|---|---|
| Engenheiro | Menu do engenheiro | Sim, `tipo_usuario = 'engenheiro'` |
| Dono | `ownerFlow` já iniciado | Sim, `tipo_usuario = 'dono'` |
| Número não cadastrado | `mensagemNaoCadastrado()` | Sim, mas **reautentica a cada mensagem** |
| Banco indisponível | `mensagemServicoIndisponivel()` | **Não** |

### Por que "não cadastrado" reautentica

Um engenheiro novo manda mensagem antes de estar no banco, recebe "não cadastrado", e alguém o
cadastra pelo `/admin` cinco minutos depois. Se a sessão guardasse esse veredito por 15 minutos, ele
continuaria barrado sem entender por quê — e ninguém pensaria em reiniciar o processo.

Então a cada mensagem seguinte o handler **tenta autenticar de novo** no banco, e promove a sessão
quando encontra o cadastro. Coberto por `tests/test-reauth-sessao.ts`.

### Por que "banco indisponível" não cria sessão

Se a consulta falhar e o código gravasse `nao_cadastrado`, esse veredito errado ficaria em cache por
15 minutos: o banco volta em 30 segundos e o engenheiro continua recebendo "número não cadastrado"
por um quarto de hora.

Por isso `buscarEngenheiroPorTelefone()` **lança** `SupabaseUnavailableError` em vez de devolver
`null` quando o problema é infraestrutura. Ela cobre três casos:

- o cliente Supabase nunca conectou (falta de env, credencial inválida)
- o PostgREST devolveu erro
- a chamada estourou em rede — DNS, timeout, fetch

`autenticarUsuario()` traduz isso em `{ indisponivel: true }`, e o handler responde sem criar sessão.
Coberto por `tests/test-mensagem-indisponivel.ts` e
`tests/test-auth-erro-vs-nao-cadastrado.ts`.

Nenhum detalhe técnico vaza na resposta ao usuário. Os logs passam por
`logic/security/redactSecrets.ts` antes de sair.

## Sessões

Sessões são um `Map` **em memória** no `MessageHandler`:

- chave: o número normalizado
- TTL: **15 minutos** de inatividade
- limpeza: varredura a cada 5 minutos
- guardam `tipo_usuario`, `user_id`, qual fluxo está ativo e a **instância do flow** com todo o
  estado da conversa

Duas consequências operacionais:

- **Reiniciar o processo derruba todas as conversas em andamento.** Um deploy no meio da notificação
  noturna faz o engenheiro recomeçar. Não há persistência.
- Existe um `SessionService` com Redis em `integrations/session/sessionService.ts`, **não integrado**
  a nada — e `ioredis` não está nem declarado no `package.json`. Não confie nele.

Quando um fluxo termina (`finalizado: true`), o handler descarta a instância e limpa
`fluxo_ativo`, para a próxima mensagem começar do menu.

## Como testar

```bash
npm run test:seguranca      # roda os três testes de autenticação em sequência
```

Individualmente:

```bash
npx tsx tests/test-auth-erro-vs-nao-cadastrado.ts   # erro de banco != numero desconhecido
npx tsx tests/test-mensagem-indisponivel.ts         # banco fora nao envenena a sessao
npx tsx tests/test-reauth-sessao.ts                 # sessao stale reautentica
```

O padrão desses testes é trocar os métodos do `SupabaseService` na instância antes de processar
qualquer mensagem — o handler resolve o serviço de forma preguiçosa, então a troca vale para ele
também. Copie de `tests/test-mensagem-indisponivel.ts` se precisar escrever outro.

Para testar à mão com um número real, cadastre-o em `/admin` no dashboard e mande mensagem para o
número do Twilio. Em desenvolvimento, `WHATSAPP_PROVIDER=development` imprime as respostas no console
em vez de enviá-las.
