# 🚀 Guia de Deploy - Dashboard TecPred

## Opção 1: Deploy na Vercel (RECOMENDADO - Grátis)

### 1️⃣ Fazer Login
```bash
cd /Users/maluquintela/tecpred/chatbot-tril/dashboard
vercel login
```
- Escolha seu método de login (GitHub recomendado)
- Confirme no navegador

### 2️⃣ Deploy
```bash
vercel
```

**Responda as perguntas:**
- Set up and deploy? **Y** (sim)
- Which scope? Escolha sua conta
- Link to existing project? **N** (não)
- What's your project's name? **tecpred-dashboard** (ou outro nome)
- In which directory is your code located? **./** (Enter)
- Want to override the settings? **N** (não)

### 3️⃣ Configurar Variáveis de Ambiente

Depois do primeiro deploy, você precisa adicionar as variáveis:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
```
Cole: `https://<seu-projeto>.supabase.co`

```bash
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```
Cole: `<SUA_ANON_KEY_AQUI>`

### 4️⃣ Deploy Novamente (com as variáveis)
```bash
vercel --prod
```

### 5️⃣ Pronto! 🎉
Você receberá uma URL tipo:
```
https://tecpred-dashboard.vercel.app
```

---

## Opção 2: Deploy Manual pela Interface Web

1. Acesse: https://vercel.com/new
2. Importe o repositório do GitHub
3. Configure:
   - Framework: **Next.js**
   - Root Directory: **chatbot-tril/dashboard**
4. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Clique em **Deploy**

---

## Opção 3: Deploy no Netlify (Alternativa)

### 1️⃣ Instalar Netlify CLI
```bash
npm install -g netlify-cli
```

### 2️⃣ Login
```bash
netlify login
```

### 3️⃣ Build
```bash
npm run build
```

### 4️⃣ Deploy
```bash
netlify deploy --prod
```

---

## 🌐 Domínio Personalizado (Opcional)

### Na Vercel:
1. Vá em **Settings** → **Domains**
2. Adicione seu domínio (ex: dashboard.tecpred.com.br)
3. Configure os DNS conforme instruções

### Exemplo de DNS:
```
Tipo: A
Nome: dashboard (ou @)
Valor: 76.76.21.21 (IP da Vercel)
```

---

## 🔒 Segurança Recomendada

### 1. Habilitar HTTPS (automático na Vercel)
### 2. Adicionar autenticação (futura implementação)
### 3. Configurar CORS no Supabase:
   - Vá em **Authentication** → **URL Configuration**
   - Adicione: `https://seu-dominio.vercel.app`

---

## 📊 Monitoramento

Após deploy, você pode:
- Ver logs: `vercel logs`
- Ver analytics na dashboard da Vercel
- Configurar notificações de erro

---

## 🔄 Atualizações Futuras

Para atualizar o site:
```bash
git add .
git commit -m "Atualização"
git push
```

A Vercel vai fazer **deploy automático** a cada push!

---

## 🆘 Problemas Comuns

### Build falhou:
```bash
# Teste localmente primeiro
npm run build
```

### Variáveis não funcionam:
- Verifique se começam com `NEXT_PUBLIC_`
- Refaça o deploy após adicionar: `vercel --prod`

### Erro 404:
- Verifique o Root Directory
- Deve ser: `chatbot-tril/dashboard`

---

**Dúvidas?** Consulte: https://vercel.com/docs
