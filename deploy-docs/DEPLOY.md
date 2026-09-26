 Guia de Deploy - Railway + Twilio

Este guia detalha como fazer o deploy do chatbot no Railway e configurar o Twilio para receber mensagens do WhatsApp.

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração do Railway](#configuração-do-railway)
3. [Configuração do Twilio](#configuração-do-twilio)
4. [Variáveis de Ambiente](#variáveis-de-ambiente)
5. [Deploy e Testes](#deploy-e-testes)
6. [Monitoramento](#monitoramento)
7. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

Antes de começar, você precisa ter:

- ✅ Conta no [Railway](https://railway.app/) (gratuito - $5 crédito/mês)
- ✅ Conta no [Twilio](https://www.twilio.com/) com número WhatsApp Business
- ✅ Conta no [Supabase](https://supabase.com/) com projeto criado
- ✅ Repositório GitHub com o código do bot
- ✅ Tabelas e triggers do Supabase já criados (ver `/supabase/*.sql`)

---

## Configuração do Railway

### Passo 1: Criar Novo Projeto

1. Acesse [Railway Dashboard](https://railway.app/dashboard)
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Autorize o Railway a acessar seu GitHub (se necessário)
5. Selecione o repositório `chatbot-tril-consult`

### Passo 2: Configurar Build

O Railway detecta automaticamente que é um projeto Node.js, mas você pode ajustar:

**Settings > Build:**
- Build Command: `npm install && npm run build`
- Start Command: `npm start`

**Nota:** O `Procfile` na raiz já define isso automaticamente.

### Passo 3: Configurar Variáveis de Ambiente

No Railway Dashboard, vá em **Variables** e adicione:

#### Obrigatórias (Supabase):

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Onde encontrar:**
- Supabase Dashboard → Project Settings → API
- `URL` está em "Project URL"
- `service_role key` está em "Project API keys" (⚠️ secreta!)
- `anon key` está em "Project API keys" (pública)

#### Obrigatórias (Twilio):

```bash
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886
```

**Onde encontrar:**
- Twilio Console → Account Info
- `Account SID` e `Auth Token` estão na dashboard principal
- `Phone Number` é o número WhatsApp que você configurou

#### Opcionais:

```bash
# OpenAI (se usar transcrição de áudio)
OPENAI_API_KEY=sk-proj-...

# Google Sheets (se quiser visualização em planilhas)
GOOGLE_SHEETS_ENGINEER_ID=<id-da-planilha-do-engenheiro>
GOOGLE_SHEETS_ENGINEER_NAME=Engenheira(o)
```

### Passo 4: Deploy Inicial

1. Após configurar as variáveis, clique em **"Deploy"**
2. O Railway fará:
   - Clone do repositório
   - Instalação das dependências (`npm install`)
   - Build do TypeScript (`npm run build`)
   - Inicialização do servidor (`npm start`)

3. Aguarde o deploy (1-3 minutos)
4. Quando concluir, você verá uma URL do tipo:
   ```
   https://seu-app.railway.app
   ```

### Passo 5: Verificar Saúde

Acesse no navegador:
```
https://seu-app.railway.app/health
```

Deve retornar:
```json
{
  "status": "ok",
  "service": "whatsapp-bot",
  "timestamp": "2026-01-27T10:30:00.000Z",
  "uptime": 123.456
}
```

---

## Configuração do Twilio

### Passo 1: Obter Número WhatsApp

1. Acesse [Twilio Console](https://console.twilio.com/)
2. Vá em **Messaging → Try it out → Send a WhatsApp message**
3. Se ainda não tem, solicite um número WhatsApp Business:
   - **Develop → Phone Numbers → Manage → Buy a number**
   - Filtre por "WhatsApp"
   - Compre um número (ou use trial)

4. Para produção, você precisa aprovar seu número via **WhatsApp Business API**

### Passo 2: Configurar Webhook

1. No Twilio Console, vá em:
   ```
   Messaging → Settings → WhatsApp Sandbox Settings
   ```
   (Para testes use Sandbox, para produção use seu número aprovado)

2. Na seção **"When a message comes in"**, configure:
   - URL: `https://seu-app.railway.app/webhook/twilio`
   - HTTP Method: **POST**
   - Content Type: `application/x-www-form-urlencoded`

3. Clique em **Save**

### Passo 3: Testar Sandbox (Desenvolvimento)

1. No Twilio Sandbox, você verá uma mensagem tipo:
   ```
   Join this sandbox by sending "join <code>" to +1 415 523 8886
   ```

2. Envie essa mensagem do seu WhatsApp pessoal
3. Aguarde confirmação do Twilio
4. Envie qualquer mensagem - o bot deve responder!

### Passo 4: Produção (WhatsApp Business)

Para usar em produção com clientes reais:

1. **Solicite aprovação do número:**
   - Twilio Console → WhatsApp → Senders
   - Complete o formulário de Business Profile
   - Aguarde aprovação (1-3 dias úteis)

2. **Configure o número aprovado:**
   - Messaging → WhatsApp Senders → seu número
   - Configure o webhook igual ao Sandbox

3. **Template de mensagens iniciais:**
   - Twilio requer templates aprovados para iniciar conversas
   - Crie templates em: Content → Content Template Builder

---

## Variáveis de Ambiente

### Resumo de Todas as Variáveis

```bash
# ========================================
# OBRIGATÓRIAS
# ========================================

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SUPABASE_ANON_KEY=eyJhbGci...

# Twilio
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+14155238886

# ========================================
# OPCIONAIS
# ========================================

# OpenAI (transcrição de áudio)
OPENAI_API_KEY=sk-proj-...

# Google Sheets (visualização)
GOOGLE_SHEETS_ENGINEER_ID=1aarPLXxnt...
GOOGLE_SHEETS_ENGINEER_NAME=Engenheira(o)
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json

# Railway (gerado automaticamente)
PORT=3000
```

### Como Configurar no Railway

**Opção 1: Via Dashboard**
1. Vá em **Variables**
2. Clique em **+ New Variable**
3. Cole as variáveis (formato: `KEY=value`)

**Opção 2: Via CLI**
```bash
railway login
railway link
railway variables set SUPABASE_URL=https://...
railway variables set TWILIO_ACCOUNT_SID=AC...
```

---

## Deploy e Testes

### Deploy Automático

O Railway detecta mudanças no GitHub automaticamente:

1. Faça commit das suas mudanças:
   ```bash
   git add .
   git commit -m "feat: adicionar nova funcionalidade"
   git push origin main
   ```

2. Railway iniciará deploy automático
3. Acompanhe os logs no Dashboard
4. Quando concluir, teste o `/health`

### Deploy Manual

Se quiser forçar um redeploy:

1. Railway Dashboard → **Deployments**
2. Clique em **Redeploy**

### Testar o Bot

**1. Verificar health:**
```bash
curl https://seu-app.railway.app/health
```

**2. Testar webhook (simular Twilio):**
```bash
curl -X POST https://seu-app.railway.app/webhook/twilio \
  -d "From=whatsapp:+5511999999999" \
  -d "Body=oi"
```

**3. Testar via WhatsApp:**
- Envie "oi" para o número do Twilio
- Bot deve responder com menu principal

---

## Monitoramento

### Logs do Railway

**Ver logs em tempo real:**
1. Railway Dashboard → **Deployments** → **View Logs**
2. Ou via CLI:
   ```bash
   railway logs
   ```

**Filtrar logs:**
```bash
railway logs --filter "❌"  # apenas erros
railway logs --tail 100     # últimas 100 linhas
```

### Endpoints de Monitoramento

**Health Check:**
```
GET https://seu-app.railway.app/health
```

**Root (informações básicas):**
```
GET https://seu-app.railway.app/
```

### Uptime Monitoring

Configure um serviço externo para monitorar:

**[UptimeRobot](https://uptimerobot.com/) (gratuito):**
1. Crie nova monitor
2. URL: `https://seu-app.railway.app/health`
3. Intervalo: 5 minutos
4. Receba alertas por email se cair

### Notificações Agendadas

O bot envia notificações automaticamente:

- **11:20 (seg-sex):** Notificação matinal
- **16:30 (seg-sex):** Notificação noturna
- **A cada 1 minuto:** Processa fila de notificações pendentes

**Verificar nos logs:**
```
⏰ Cron Job: Notificações Matinais (11:20)
📬 Processando 3 notificação(ões) pendente(s)...
✅ Enviadas: 3 | ❌ Falhas: 0
```

---

## Troubleshooting

### Problema: Deploy Falhou

**Erro comum:**
```
Error: Cannot find module 'express'
```

**Solução:**
1. Verifique se `express` está em `dependencies` (não `devDependencies`)
2. Force reinstalação:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   git add package-lock.json
   git commit -m "fix: reinstalar dependências"
   git push
   ```

### Problema: Bot Não Responde

**Checklist:**

1. **Servidor está online?**
   ```bash
   curl https://seu-app.railway.app/health
   ```
   Deve retornar `{"status":"ok"}`

2. **Webhook configurado corretamente?**
   - Twilio Console → Messaging → WhatsApp Settings
   - URL deve ser: `https://seu-app.railway.app/webhook/twilio`
   - Método: POST

3. **Variáveis configuradas?**
   - Railway → Variables
   - Verifique `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `SUPABASE_URL`

4. **Logs têm erros?**
   ```bash
   railway logs --filter "❌"
   ```

### Problema: Erro 401 Unauthorized (Twilio)

**Erro nos logs:**
```
❌ Erro ao enviar mensagem via Twilio: 401 Unauthorized
```

**Solução:**
- Verifique `TWILIO_AUTH_TOKEN` está correto
- Token fica em: Twilio Console → Account Info → Auth Token
- Clique no ícone "👁️" para revelar

### Problema: Erro ao Conectar Supabase

**Erro nos logs:**
```
❌ Erro fatal ao iniciar servidor: Invalid JWT
```

**Solução:**
- Verifique `SUPABASE_SERVICE_ROLE_KEY`
- Deve ser a **service_role key** (não a anon key)
- Supabase Dashboard → Settings → API → service_role

### Problema: Notificações Não Enviam

**Checklist:**

1. **Cron jobs iniciados?**
   Ver nos logs:
   ```
   ✅ Cron Jobs iniciados com sucesso!
   📅 Agendamentos configurados:
      🌅 Notificação Matinal:  11:20 (seg-sex)
   ```

2. **Engenheiros cadastrados?**
   - Verifique tabela `engenheiros` no Supabase
   - Telefone deve ter formato: `+5511999999999`

3. **Notificações pendentes?**
   - Verifique tabela `notificacoes_whatsapp`
   - Coluna `enviada` deve ser `false`

### Problema: Build Muito Lento

O Railway tem timeout de 10 minutos. Se o build demora muito:

**Solução 1: Usar cache do npm**
```json
// package.json
{
  "scripts": {
    "build": "npm ci && tsc"
  }
}
```

**Solução 2: Excluir arquivos desnecessários**
Adicione ao `.gitignore`:
```
tests/
docs/
*.md
!DEPLOY.md
!README.md
```

---

## Custos

### Railway (Hosting)

**Plano Hobby (gratuito):**
- $5 de crédito/mês
- ~500h de execução
- Suficiente para testes e uso moderado

**Plano Pro:**
- $20/mês + uso
- Para produção com alto volume

### Twilio (WhatsApp)

**Trial (gratuito):**
- Número de teste (Sandbox)
- Mensagens ilimitadas para números aprovados
- Ideal para desenvolvimento

**Produção:**
- ~$0.005 por mensagem recebida
- ~$0.005 por mensagem enviada
- Para 1000 mensagens/mês: ~$10

**Exemplo de custo mensal:**
- 500 mensagens recebidas: $2.50
- 500 mensagens enviadas: $2.50
- **Total: ~$5/mês**

### Supabase (Banco de Dados)

**Plano Free:**
- 500MB database
- 50k auth users
- Suficiente para começar

**Plano Pro:**
- $25/mês
- 8GB database
- Backups diários

---

## Próximos Passos

Após o deploy bem-sucedido:

1. ✅ Testar todos os fluxos do bot
2. ✅ Configurar monitoramento (UptimeRobot)
3. ✅ Documentar número do WhatsApp para equipe
4. ✅ Treinar usuários sobre comandos do bot
5. ✅ Configurar backup do Supabase (Settings → Database)
6. ✅ Adicionar domínio customizado no Railway (opcional)

---

## Suporte

**Problemas com Railway:**
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

**Problemas com Twilio:**
- Docs: https://www.twilio.com/docs/whatsapp
- Support: https://support.twilio.com

**Problemas com Supabase:**
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

## Resumo Rápido

```bash
# 1. Deploy no Railway
railway login
railway link
railway up

# 2. Configurar variáveis
railway variables set SUPABASE_URL=https://...
railway variables set TWILIO_ACCOUNT_SID=AC...
railway variables set WHATSAPP_PROVIDER=twilio

# 3. Verificar saúde
curl https://seu-app.railway.app/health

# 4. Configurar webhook Twilio
# URL: https://seu-app.railway.app/webhook/twilio
# Method: POST

# 5. Testar no WhatsApp
# Envie "oi" para o número do Twilio
```

**Pronto! Seu bot está no ar! 🚀**
