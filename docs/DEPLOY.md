# Deploy: os passos fora do repositório

O [README](../README.md#deploy) descreve o que está versionado — `Procfile`, `railway.json`,
`nixpacks.toml`, os dois serviços. Este documento cobre o que precisa ser feito **nos painéis** do
Railway, do Twilio e do Supabase, que é onde alguém trava.

## Railway

Deploy é por push no GitHub. Dois serviços, no mesmo repositório:

| Serviço | Root Directory | Start |
|---|---|---|
| Chatbot | **raiz** do repo (deixe vazio) | `npx tsx src/server-twilio.ts` |
| Dashboard | `dashboard/` | `npm run start` |

**A URL pública não vem de graça.** Em cada serviço: *Settings → Networking → Generate Domain*. Sem
isso não existe endereço para apontar o webhook do Twilio, e o serviço fica acessível só internamente.

As variáveis de ambiente vão em *Variables*, por serviço — o chatbot e o dashboard têm conjuntos
diferentes (ver [Variáveis de ambiente](../README.md#variáveis-de-ambiente)).

### Verificação pós-deploy

```bash
curl https://<seu-app>.up.railway.app/
```

Deve responder JSON com `status`, `provider` e `database`. O `GET /health` devolve só
`{status, timestamp}` — serve para monitor externo. Se quiser um ping periódico, aponte um UptimeRobot
para `/health`.

Nos logs, o boot bem-sucedido termina em `SERVIDOR INICIADO COM SUCESSO`.

### O problema do `credentials.json`

O chatbot lê a credencial do Google por **caminho de arquivo**:
`GoogleAuth({ keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS })`. Não há suporte a credencial em
variável — `GOOGLE_CREDENTIALS_JSON` **não é lida por nenhum código**, apesar de guias antigos
recomendarem.

E `credentials.json` está no `.gitignore`, então não vai junto com o push. Somando as duas coisas:
**pelo repositório, não existe caminho para esse arquivo chegar ao Railway.** O boot passa de qualquer
forma, porque a validação checa se a *variável* está definida, não se o arquivo existe — a falha
aparece só quando a sincronização tenta falar com o Google.

Se a sincronização com Sheets precisa funcionar em produção, as opções são montar um volume no Railway
com o arquivo, ou alterar `integrations/sheets/googleSheetsService.ts` para aceitar o JSON via
variável. Hoje nenhuma das duas está feita no repositório. Nada além do Sheets depende disso — o
sistema inteiro funciona sem.

## Twilio

### Webhook

No console, em *Messaging → Senders* (ou no Sandbox), configure:

| Campo | URL |
|---|---|
| When a message comes in | `https://<seu-app>.up.railway.app/webhook/whatsapp` |
| Status callback URL | `https://<seu-app>.up.railway.app/webhook/status` |

Método `POST` nos dois. São **essas** as rotas — guias antigos deste repositório citavam
`/webhook/twilio`, que nunca existiu e responde 404.

### Sandbox: o `join` e as 72 horas

Para testar sem número próprio, use o Sandbox (*Messaging → Try it out → Send a WhatsApp message*).
Cada pessoa que for testar precisa enviar `join <codigo>` para o número do Sandbox, com o código que
aparece no console.

**A sessão do Sandbox expira depois de 72 horas sem atividade.** Quando isso acontece, o bot
simplesmente para de responder àquele número, sem erro em lugar nenhum — e nada mudou no código. É a
causa mais comum de "o bot parou de funcionar do nada". A correção é reenviar o `join`.

### Produção: aprovação do sender e templates

Para usar um número próprio:

1. *Messaging → WhatsApp Senders → Business Profile* — a aprovação do sender leva de 1 a 3 dias úteis
2. **Templates aprovados** para mensagens que **iniciam** conversa: *Content → Content Template
   Builder*

O passo 2 é obrigatório e fácil de esquecer. O bot envia notificações **proativas** às 11:20 e 16:30
(ver [notificações](../README.md#notificações-proativas)): fora da janela de 24 horas desde a última
mensagem do engenheiro, o WhatsApp só entrega mensagem baseada em template aprovado. Sem os templates,
as notificações diárias falham — e falham silenciosamente, porque o erro fica no callback de status,
não no fluxo da conversa.

### Custos, em ordem de grandeza

Número próprio ~US$ 1–2/mês; mensagens **enviadas** ~US$ 0,005; mensagens **recebidas** são gratuitas.

## Supabase

Além das migrations (ver [Banco de dados](../README.md#banco-de-dados-como-montar)), duas
configurações de painel:

**Redirect URLs do Auth** — *Authentication → URL Configuration*: adicione a URL de produção do
dashboard (`https://<seu-app>.up.railway.app`). Sem isso o login funciona local e **quebra em
produção**, porque o redirect pós-login é rejeitado.

**Replication para o Realtime** — *Database → Replication*: habilite `engenheiros_projetos`,
`projetos` e `retrabalho_projetos`. Sem isso o dashboard não atualiza sozinho. Detalhes em
[dashboard/README.md](../dashboard/README.md#habilitar-realtime-no-supabase).

## Diagnóstico: notificação não chegou

As notificações proativas passam por uma fila, então há três lugares onde podem parar:

1. **O telefone está no formato certo?** `engenheiros.telefone` precisa estar como `+55DDNNNNNNNNN`.
   Um número sem o `+55` não casa com a normalização e a notificação é enfileirada para um
   destinatário que não existe.
2. **A fila está sendo consumida?** Em `notificacoes_whatsapp`, linhas com `enviada = false` e data
   antiga significam que o worker não rodou — ele é um cron de 1 minuto dentro do processo, então
   verifique se o serviço está de pé.
3. **O envio foi rejeitado?** Se a linha está marcada como enviada mas nada chegou, o problema é do
   lado do WhatsApp: janela de 24 horas sem template aprovado, ou sessão de Sandbox expirada.

## O que não existe

Para poupar tempo de quem for procurar: não há Dockerfile, docker-compose, fly.toml, render.yaml,
PM2, systemd nem CI (`.github/` não existe — nada roda testes automaticamente). `dashboard/vercel.json`
existe, mas a Vercel é caminho legado; Railway é o que está em uso. O chatbot **não compila** — roda
TypeScript direto com `tsx`, e `npm run build` é apenas typecheck.
