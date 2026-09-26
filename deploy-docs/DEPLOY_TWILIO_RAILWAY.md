# Guia de Deploy: Twilio + Railway

Este guia mostra como fazer o deploy do chatbot no Railway e conectar com o Twilio para WhatsApp.

## 📋 Pré-requisitos

1. **Conta Twilio** (https://www.twilio.com/)
   - Criar uma conta gratuita ou paga
   - Ativar o Twilio Sandbox para WhatsApp (para testes)
   - OU comprar um número Twilio com WhatsApp habilitado (para produção)

2. **Conta Railway** (https://railway.app/)
   - Criar uma conta (pode usar GitHub)
   - Plano gratuito disponível ($5 de crédito/mês)

3. **Arquivos necessários**
   - `credentials.json` (Google Sheets API)
   - Variáveis de ambiente configuradas

## 🚀 Passo 1: Configurar Twilio

### 1.1 Criar Conta e Obter Credenciais

1. Acesse https://www.twilio.com/ e crie uma conta
2. Vá para o Console: https://console.twilio.com/
3. Anote suas credenciais:
   - **Account SID** (ex: ACxxxxxxxxxxxxx)
   - **Auth Token** (clique em "Show" para ver)

### 1.2 Configurar WhatsApp

#### Opção A: Twilio Sandbox (GRÁTIS - Para Testes)

1. No Console Twilio, vá em: **Messaging** > **Try it out** > **Send a WhatsApp message**
2. Siga as instruções para conectar seu WhatsApp:
   - Envie uma mensagem para o número do Twilio Sandbox
   - Ex: "join [seu-codigo]" para +1 415 523 8886
3. Anote o número do Sandbox:
   - Formato: `whatsapp:+14155238886`

#### Opção B: Número Twilio com WhatsApp (PAGO - Para Produção)

1. No Console Twilio, vá em: **Phone Numbers** > **Buy a number**
2. Filtre por números com WhatsApp habilitado
3. Compre um número (custa ~$1-2/mês + mensagens)
4. Seu número estará no formato: `+1234567890`

## 🚀 Passo 2: Deploy no Railway

### 2.1 Conectar Repositório ao Railway

1. Acesse https://railway.app/
2. Clique em **"New Project"**
3. Escolha **"Deploy from GitHub repo"**
4. Selecione seu repositório
5. Selecione a pasta `chatbot-tril` (se necessário)

### 2.2 Configurar Variáveis de Ambiente

No Railway, vá em **Variables** e adicione:

```env
# Google Sheets
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
GOOGLE_SHEETS_ENGINEER_ID=<id-da-planilha-do-engenheiro>
GOOGLE_SHEETS_ENGINEER_NAME=Engenheira(o)
GOOGLE_SHEETS_ENGINEER_RANGE=A3:AE1000

# Supabase (opcional mas recomendado)
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_ANON_KEY=<SUA_ANON_KEY_AQUI>
SUPABASE_SERVICE_ROLE_KEY=<SUA_SERVICE_ROLE_KEY_AQUI>

# Twilio WhatsApp (IMPORTANTE!)
TWILIO_ACCOUNT_SID=<SEU_ACCOUNT_SID_AQUI>
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+14155238886

# WhatsApp Provider
WHATSAPP_PROVIDER=twilio

# OpenAI (para transcrição de áudio - opcional)
OPENAI_API_KEY=sk-proj-...

# Port (Railway define automaticamente)
PORT=3000
```

### 2.3 Adicionar credentials.json

O Railway não suporta arquivos diretamente no dashboard. Opções:

#### Opção A: Incluir no Repositório (CUIDADO!)

1. Adicione o `credentials.json` na raiz do projeto
2. **NÃO FAÇA COMMIT PARA REPOSITÓRIOS PÚBLICOS!**
3. Use um repositório privado

#### Opção B: Usar Variável de Ambiente (RECOMENDADO)

1. Abra seu `credentials.json` e copie todo o conteúdo
2. No Railway, adicione a variável:
   ```
   GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
   ```
3. Atualize o código para ler da variável (se necessário)

#### Opção C: Railway Volumes (AVANÇADO)

1. Crie um Volume no Railway
2. Monte em `/app/credentials.json`
3. Faça upload do arquivo

### 2.4 Deploy

1. O Railway faz deploy automaticamente ao detectar mudanças
2. Acompanhe os logs em **Deployments**
3. Aguarde a mensagem: **"✅ SERVIDOR INICIADO COM SUCESSO!"**

### 2.5 Obter URL do Projeto

1. No Railway, vá em **Settings** > **Networking**
2. Clique em **Generate Domain**
3. Anote a URL gerada:
   - Ex: `https://seu-projeto.up.railway.app`

## 🚀 Passo 3: Conectar Twilio ao Railway

### 3.1 Configurar Webhook no Twilio

1. Acesse o Console Twilio
2. Vá em **Messaging** > **Services** > **WhatsApp senders**
3. Ou, se estiver usando Sandbox: **Messaging** > **Try it out** > **Send a WhatsApp message**

4. Configure o Webhook:

   **When a message comes in:**
   ```
   https://seu-projeto.up.railway.app/webhook/whatsapp
   ```
   - HTTP Method: **POST**

   **Status callback URL (opcional):**
   ```
   https://seu-projeto.up.railway.app/webhook/status
   ```
   - HTTP Method: **POST**

5. Clique em **Save**

## ✅ Passo 4: Testar o Bot

### 4.1 Enviar Mensagem de Teste

1. Se estiver usando **Twilio Sandbox**:
   - Certifique-se de ter enviado "join [codigo]" antes
   - Envie qualquer mensagem para o número do Sandbox

2. Se estiver usando **número Twilio próprio**:
   - Envie uma mensagem direta para seu número

### 4.2 Verificar Logs

1. No Railway, vá em **Deployments** > **View Logs**
2. Você deve ver:
   ```
   📨 MENSAGEM RECEBIDA VIA TWILIO
   📞 De: whatsapp:+5511999999999
   💬 Mensagem: "menu"
   ```

### 4.3 Comandos para Testar

Envie estas mensagens para testar:

```
menu
```
→ Deve retornar o menu principal

```
ajuda
```
→ Deve retornar informações de ajuda

```
1
```
→ Selecionar opção 1 do menu (Cadastrar Novo Projeto)

## 🔧 Troubleshooting

### Erro: "Not Found" ou "Cannot POST /webhook/whatsapp"

**Problema:** URL do webhook está incorreta

**Solução:**
1. Verifique se a URL no Twilio está correta
2. Certifique-se de que o servidor está rodando
3. Teste o health check: `https://seu-projeto.up.railway.app/health`

### Erro: "Unauthorized" ou "Forbidden"

**Problema:** Credenciais do Twilio incorretas

**Solução:**
1. Verifique `TWILIO_ACCOUNT_SID` e `TWILIO_AUTH_TOKEN` no Railway
2. Certifique-se de que não há espaços extras
3. Regenere o Auth Token se necessário

### Mensagens não são enviadas

**Problema:** `WHATSAPP_PROVIDER` não está configurado

**Solução:**
1. No Railway Variables, adicione:
   ```
   WHATSAPP_PROVIDER=twilio
   ```
2. Aguarde o redeploy

### Erro: "Google Sheets API"

**Problema:** `credentials.json` não está disponível

**Solução:**
1. Verifique se o arquivo está no repositório OU
2. Configure `GOOGLE_CREDENTIALS_JSON` como variável de ambiente OU
3. Use Railway Volumes

### Bot não responde no Sandbox

**Problema:** Não enviou "join [codigo]" para o Sandbox

**Solução:**
1. Envie a mensagem de join para ativar o Sandbox
2. O código está em: Console Twilio > Messaging > Try it out
3. Exemplo: "join happy-cat" para +1 415 523 8886

## 📊 Monitoramento

### Logs do Railway

Veja logs em tempo real:
```bash
railway logs
```

Ou acesse no dashboard: **Deployments** > **View Logs**

### Health Check

Teste se o servidor está online:
```bash
curl https://seu-projeto.up.railway.app/health
```

Resposta esperada:
```json
{"status":"ok","timestamp":"2026-01-30T00:00:00.000Z"}
```

### Status da Aplicação

Veja informações do sistema:
```bash
curl https://seu-projeto.up.railway.app/
```

Resposta esperada:
```json
{
  "status": "online",
  "service": "Twilio WhatsApp Bot",
  "provider": "twilio",
  "database": "supabase",
  "timestamp": "2026-01-30T00:00:00.000Z"
}
```

## 💰 Custos

### Railway (Hosting)

- **Plano Free:** $5 de crédito/mês grátis
- **Consumo típico:** ~$3-5/mês
- **Plano Pro:** $20/mês (se necessário)

### Twilio

#### Sandbox (GRÁTIS)
- Mensagens ilimitadas
- Limitado a números pré-cadastrados
- Expira após 72h de inatividade

#### Número Próprio (PAGO)
- **Número com WhatsApp:** ~$1-2/mês
- **Mensagens enviadas:** $0.005/mensagem (~R$ 0.025)
- **Mensagens recebidas:** Grátis

## 🔐 Segurança

### Variáveis Sensíveis

**NUNCA** commite no Git:
- `credentials.json`
- `.env`
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_SERVICE_ROLE_KEY`

### Recomendações

1. Use repositório privado no GitHub
2. Adicione ao `.gitignore`:
   ```
   .env
   credentials.json
   ```
3. Rotacione tokens periodicamente
4. Use Railway Volumes para arquivos sensíveis

## 📞 Suporte

### Documentação Oficial

- **Twilio:** https://www.twilio.com/docs/whatsapp
- **Railway:** https://docs.railway.app/
- **Supabase:** https://supabase.com/docs

### Recursos Úteis

- **Console Twilio:** https://console.twilio.com/
- **Railway Dashboard:** https://railway.app/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard

## ✅ Checklist de Deploy

- [ ] Conta Twilio criada
- [ ] WhatsApp configurado (Sandbox ou número próprio)
- [ ] Credenciais Twilio obtidas (SID e Token)
- [ ] Conta Railway criada
- [ ] Repositório conectado ao Railway
- [ ] Variáveis de ambiente configuradas
- [ ] `credentials.json` disponível
- [ ] Deploy realizado com sucesso
- [ ] URL do projeto gerada
- [ ] Webhook configurado no Twilio
- [ ] Teste de mensagem realizado
- [ ] Bot respondendo corretamente

## 🎉 Pronto!

Seu bot WhatsApp está agora rodando em produção no Railway, conectado ao Twilio!

**Próximos passos:**
1. Cadastrar mais engenheiros no sistema
2. Configurar notificações automáticas
3. Monitorar logs e métricas
4. Escalar conforme necessário
