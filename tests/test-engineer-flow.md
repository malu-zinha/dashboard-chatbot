# Plano de Testes - Fluxo de Gestão de Projetos de Engenharia

## Pré-requisitos

Antes de iniciar os testes:

- [ ] Variáveis de ambiente configuradas no `.env`
- [ ] Planilha compartilhada com a service account
- [ ] Bot rodando (`npm run dev`)
- [ ] WhatsApp Web conectado (QR Code escaneado)

---

## Teste 1: Cadastro de Novo Projeto Completo

### Objetivo
Testar o fluxo completo de cadastro de um novo projeto com todos os campos.

### Passos

1. **Iniciar conversa**
   - Enviar: `projeto`
   - Esperado: Mensagem com opções 1️⃣ Cadastrar novo projeto / 2️⃣ Atualizar projeto existente

2. **Escolher cadastrar**
   - Enviar: `1`
   - Esperado: 
     - Mensagem confirmando "Novo Projeto"
     - Código gerado automaticamente (ex: PRJ-004)
     - Pergunta sobre tipo de projeto com botões H1-H6, T2, T4, G2

3. **Escolher tipo**
   - Enviar: `3` (H3)
   - Esperado:
     - Confirmação "Tipo H3 selecionado ✅"
     - Pergunta sobre área com botões (Climatização, Elétrica, Hidrossanitária)

4. **Escolher área**
   - Enviar: `2` (Elétrica)
   - Esperado:
     - Confirmação "Área Elétrica selecionada ✅"
     - Pergunta sobre data de início (formato DD/MM/AAAA)

5. **Informar data de início**
   - Enviar: `05/12/2024`
   - Esperado:
     - Confirmação "Data 05/12/2024 registrada ✅"
     - Pergunta sobre data de previsão de entrega interna

6. **Informar data de previsão**
   - Enviar: `20/12/2024`
   - Esperado:
     - Confirmação "Data de previsão: 20/12/2024 ✅"
     - Pergunta sobre status com botões (7 opções)

7. **Escolher status**
   - Enviar: `2` (Em Execução)
   - Esperado:
     - Confirmação "Status: Em Execução ✅"
     - Pergunta sobre previsão para o dia (texto livre)

8. **Informar previsão do dia**
   - Enviar: `Concluir instalação do quadro elétrico principal`
   - Esperado:
     - Confirmação "Previsão registrada ✅"
     - Pergunta sobre o que foi feito ao final do dia

9. **Informar feito ao final do dia**
   - Enviar: `Instalado 80% do quadro elétrico, faltam apenas os disjuntores`
   - Esperado:
     - Confirmação "Feito registrado ✅"
     - Pergunta sobre retrabalho (1=Sim / 2=Não)

10. **Informar retrabalho**
    - Enviar: `2` (Não)
    - Esperado:
      - Confirmação "Sem retrabalho ✅"
      - Pergunta sobre etapa com botões (10 opções)

11. **Escolher etapa**
    - Enviar: `4` (Instalações de Primeira Fase (Grosso))
    - Esperado:
      - Resumo completo com todos os dados
      - Pergunta de confirmação (1=Sim, salvar / 2=Não, cancelar)

12. **Confirmar salvamento**
    - Enviar: `1`
    - Esperado:
      - Mensagem "✅ Projeto criado com sucesso!"
      - Código do projeto
      - Status e etapa
      - "Dados salvos na planilha de engenheiros"

13. **Verificar na planilha**
    - [ ] Abrir a planilha no Google Sheets
    - [ ] Verificar se nova linha foi adicionada
    - [ ] Verificar todos os campos preenchidos corretamente

### Resultados Esperados
- ✅ Projeto criado com sucesso
- ✅ Todos os campos preenchidos
- ✅ Código gerado automaticamente
- ✅ Data de retrabalho NÃO preenchida (respondeu não)

---

## Teste 2: Cadastro com Retrabalho

### Objetivo
Testar cadastro incluindo retrabalho e verificar preenchimento automático da data.

### Passos

Seguir passos 1-9 do Teste 1, mas na etapa de retrabalho:

10. **Informar retrabalho**
    - Enviar: `1` (Sim)
    - Esperado:
      - Mensagem "⚠️ Motivo do retrabalho"
      - Botões com 6 opções de motivo

11. **Escolher motivo**
    - Enviar: `1` (Erro interno)
    - Esperado:
      - Confirmação "Motivo: Erro interno ✅"
      - Data automática preenchida (data de hoje)
      - Pergunta sobre etapa

12. **Verificar na confirmação**
    - Conferir se o resumo mostra:
      - "🔄 Retrabalho: sim"
      - "⚠️ Motivo: Erro interno"
      - "📅 Data retrabalho: [data de hoje]"

13. **Salvar e verificar planilha**
    - [ ] Campo "Necessitou de retrabalho?" = "sim"
    - [ ] Campo "motivo da revisão" = "Erro interno"
    - [ ] Campo "Data do registro do retrabalho" = data de hoje (DD/MM/AAAA)

### Resultados Esperados
- ✅ Data de retrabalho preenchida automaticamente
- ✅ Motivo registrado corretamente

---

## Teste 3: Atualização de Projeto Existente

### Objetivo
Testar o fluxo de atualização diária de um projeto já cadastrado.

### Passos

1. **Iniciar conversa**
   - Enviar: `atualizar projeto`
   - Esperado:
     - Mensagem "📋 Seus Projetos"
     - Lista numerada de projetos existentes

2. **Escolher projeto**
   - Enviar: `1` (primeiro projeto da lista)
   - Esperado:
     - Confirmação do projeto selecionado
     - Dados do projeto (código, cliente, obra)
     - Pergunta sobre status

3. **Seguir fluxo de execução diária**
   - Status → Previsão → Feito → Retrabalho → Etapa
   - Confirmar e salvar

4. **Verificar na planilha**
   - [ ] Campos atualizados: Status, Previsão, Feito, Retrabalho, Etapa
   - [ ] Campos NÃO alterados: Código, Cliente, Tipo, Área, Datas

### Resultados Esperados
- ✅ Apenas campos de execução diária atualizados
- ✅ Dados básicos do projeto preservados

---

## Teste 4: Validações de Data

### Objetivo
Testar validações de formato de data.

### Cenários

#### 4.1: Data com formato inválido
- Enviar: `05-12-2024` (formato errado)
- Esperado: ❌ "Formato inválido. Use DD/MM/AAAA"

#### 4.2: Data com barras mas inválida
- Enviar: `32/13/2024` (dia e mês inválidos)
- Esperado: ❌ "Data inválida. Verifique o dia, mês e ano."

#### 4.3: Data com formato correto
- Enviar: `05/12/2024`
- Esperado: ✅ "Data 05/12/2024 registrada"

### Resultados Esperados
- ✅ Formatos inválidos rejeitados
- ✅ Datas inválidas rejeitadas
- ✅ Datas válidas aceitas

---

## Teste 5: Validações de Botões

### Objetivo
Testar validações de opções numéricas.

### Cenários

#### 5.1: Número fora do range
- Contexto: Escolher tipo de projeto (9 opções)
- Enviar: `15`
- Esperado: ❌ "Número inválido. Digite um número entre 1 e 9."

#### 5.2: Texto ao invés de número
- Contexto: Escolher status (7 opções)
- Enviar: `Em Execução` (texto)
- Esperado: ❌ "Número inválido. Digite um número entre 1 e 7."

#### 5.3: Número negativo
- Contexto: Escolher área (3 opções)
- Enviar: `-1`
- Esperado: ❌ "Número inválido. Digite um número entre 1 e 3."

### Resultados Esperados
- ✅ Validações numéricas funcionando
- ✅ Mensagens de erro claras

---

## Teste 6: Validações de Texto

### Objetivo
Testar validações de campos de texto livre.

### Cenários

#### 6.1: Texto muito curto (previsão do dia)
- Enviar: `ok` (2 caracteres)
- Esperado: ❌ "Texto muito curto. Digite pelo menos 5 caracteres."

#### 6.2: Texto adequado
- Enviar: `Concluir instalação` (18 caracteres)
- Esperado: ✅ "Previsão registrada"

### Resultados Esperados
- ✅ Textos muito curtos rejeitados
- ✅ Textos adequados aceitos

---

## Teste 7: Comando Cancelar

### Objetivo
Testar cancelamento do fluxo em diferentes momentos.

### Cenários

#### 7.1: Cancelar no início
- Iniciar fluxo com `projeto`
- Enviar: `cancelar`
- Esperado: ❌ "Fluxo cancelado. Digite 'menu' para voltar ao início."

#### 7.2: Cancelar no meio do cadastro
- Iniciar fluxo, preencher tipo e área
- Enviar: `cancelar`
- Esperado: ❌ "Fluxo cancelado"

#### 7.3: Cancelar na confirmação
- Chegar até a confirmação
- Enviar: `2` (Não, cancelar)
- Esperado: ❌ "Fluxo cancelado"

### Resultados Esperados
- ✅ Cancelamento funciona em qualquer etapa
- ✅ Dados não são salvos ao cancelar
- ✅ Usuário pode iniciar novo fluxo

---

## Teste 8: Lista de Projetos Vazia

### Objetivo
Testar comportamento quando engenheiro não tem projetos.

### Passos

1. Criar planilha sem projetos para o engenheiro
2. Enviar: `atualizar projeto`
3. Esperado:
   - ❌ "Nenhum projeto encontrado para você."
   - "Cadastre um novo projeto primeiro."
   - Fluxo finalizado

### Resultados Esperados
- ✅ Mensagem clara quando não há projetos
- ✅ Sugestão de cadastrar novo projeto

---

## Teste 9: Geração de Código Automático

### Objetivo
Testar geração sequencial de códigos de projeto.

### Passos

1. Verificar último código na planilha (ex: PRJ-003)
2. Cadastrar novo projeto
3. Verificar código gerado (deve ser PRJ-004)
4. Cadastrar outro projeto
5. Verificar código gerado (deve ser PRJ-005)

### Resultados Esperados
- ✅ Códigos gerados sequencialmente
- ✅ Formato PRJ-XXX (3 dígitos)
- ✅ Sem duplicatas

---

## Teste 10: Integração com Menu Principal

### Objetivo
Testar integração do novo fluxo com o menu existente.

### Passos

1. Enviar: `menu` ou `oi`
2. Verificar se aparece opção de "Gestão de Projetos"
3. Testar outros comandos ainda funcionam:
   - `registrar execução`
   - `registrar retrabalho`
   - `consultar status`

### Resultados Esperados
- ✅ Novo fluxo aparece no menu
- ✅ Fluxos antigos continuam funcionando
- ✅ Comandos não interferem uns com os outros

---

## Teste 11: Compatibilidade com Áudio

### Objetivo
Verificar se mensagens de voz são processadas corretamente.

### Passos

1. Gravar áudio dizendo: "projeto"
2. Verificar se fluxo inicia
3. Testar respostas por áudio durante o fluxo

### Resultados Esperados
- ✅ Áudio transcrito corretamente
- ✅ Fluxo iniciado com áudio
- ✅ Respostas por áudio funcionam

---

## Teste 12: Múltiplos Usuários

### Objetivo
Testar isolamento de sessões entre usuários.

### Passos

1. Usuário A inicia cadastro de projeto
2. Usuário B inicia atualização de projeto
3. Usuário A continua seu cadastro
4. Verificar se não há interferência

### Resultados Esperados
- ✅ Sessões isoladas por usuário
- ✅ Dados não se misturam
- ✅ Cada usuário mantém seu contexto

---

## Teste 13: Confirmação das Horas (Notificação Noturna)

### Objetivo
Garantir que as horas do dia só vão ao banco depois de o engenheiro revisar e confirmar.
A RPC `registrar_retrabalho_dia` é upsert por (atribuição, dia): gravar antes da revisão deixa um
número errado sobrescrever o certo.

> Os Testes 1 e 2 acima são da época em que o fluxo salvava na planilha e **não** descrevem a
> Notificação Noturna atual (não têm o passo de horas, e os motivos listados não são os de
> `MOTIVOS_RETRABALHO`). Para o fluxo de horas, use este teste.

### 13.1: Ramo com retrabalho — confirmar

1. Menu → `2` (Notificação Noturna) → escolher projeto → escolher disciplina
2. **O que foi feito:** `Revisao das pranchas do 3o pavimento`
3. **Horas trabalhadas:** `8`
4. **Teve retrabalho:** `1` (Sim)
5. **Motivo:** `3` (Erro de projeto (TecPred))
6. **Horas de retrabalho:** `2`
   - Esperado: tela `🔎 Confirme as horas do dia:` com `Horas trabalhadas: *8h*`,
     `Motivo: Erro de projeto (TecPred)`, `Horas de retrabalho: *2h* (25.0%)`,
     `1️⃣ Confirmar e gravar` / `2️⃣ Corrigir as horas`
   - [ ] **No Supabase: nenhuma linha em `retrabalho` para hoje nesta atribuição ainda**
7. **Confirmar:** `1`
   - Esperado: `✅ Retrabalho registrado: 2h de 8h (25.0%)` + pergunta de observações
   - [ ] Linha gravada com `horas_trabalhadas_total = 8`, `horas_retrabalho = 2`

### 13.2: Corrigir as horas

1. Repetir 13.1 até a tela de confirmação
2. **Enviar:** `2` (Corrigir as horas)
   - Esperado: volta a `⏱️ Quantas horas foram trabalhadas hoje...` (sem mensagem de erro)
   - [ ] Nada gravado no banco
3. Refazer a sequência com `4` / `1` / `3` / `1` e confirmar
   - [ ] Linha gravada com as horas **novas** (4 e 1), sem resquício das anteriores

### 13.3: Voltar com `0` na confirmação

1. Repetir 13.1 até a tela de confirmação
2. **Enviar:** `0`
   - Esperado: volta a `⏱️ Quantas horas foram gastas no retrabalho/paralisação?`
   - [ ] Sem `❌` na resposta — voltar não é erro de validação
   - [ ] Nada gravado no banco

### 13.4: Ramo sem retrabalho

1. Menu → `2` → projeto → disciplina → feito do dia → **Horas:** `8`
2. **Teve retrabalho:** `2` (Não)
   - Esperado: confirmação com `Horas trabalhadas: *8h*` e `🔄 Sem retrabalho hoje`, sem percentual
   - [ ] Nada gravado no banco ainda
3. **Confirmar:** `1`
   - Esperado: `✅ Sem retrabalho!` + pergunta de observações
   - [ ] Linha com `horas_trabalhadas_total = 8`, `horas_retrabalho = 0`

### 13.5: Entrada inválida na confirmação

1. Na tela de confirmação, enviar `x`, `3`, `sim`
   - Esperado: `❌ Digite *1* para confirmar ou *2* para corrigir.` nas três
   - [ ] Continua na tela de confirmação, nada gravado

### Resultados Esperados
- ✅ Zero gravações antes do `1`
- ✅ `2` reabre a pergunta de horas trabalhadas e descarta motivo/horas de retrabalho antigos
- ✅ Percentual do dashboard bate com o mostrado no resumo

---

## Checklist de Validação Final

Antes de considerar o fluxo pronto para produção:

### Funcionalidades Core
- [ ] Cadastro completo funciona
- [ ] Atualização funciona
- [ ] Retrabalho com data automática funciona
- [ ] Cancelamento funciona

### Validações
- [ ] Datas validadas corretamente
- [ ] Botões validados corretamente
- [ ] Textos validados corretamente
- [ ] Códigos únicos gerados

### Integração
- [ ] Integra com menu principal
- [ ] Não quebra fluxos existentes
- [ ] Funciona com áudio
- [ ] Sessões isoladas por usuário

### Planilha
- [ ] Dados salvos corretamente
- [ ] Todos os campos preenchidos
- [ ] Formato de data correto (DD/MM/AAAA)
- [ ] Atualização não sobrescreve dados básicos

### Performance
- [ ] Responde em menos de 3 segundos
- [ ] Não trava em planilhas grandes
- [ ] Cache funcionando

### UX
- [ ] Mensagens claras e objetivas
- [ ] Emojis ajudam na navegação
- [ ] Erros explicam o problema
- [ ] Confirmação antes de salvar

---

## Bugs Conhecidos / To-Do

Liste aqui bugs encontrados durante os testes:

1. [ ] _Nenhum bug conhecido ainda_

---

## Notas

- Sempre testar com dados reais (nomes de clientes, obras, etc)
- Verificar formatação na planilha após cada teste
- Testar em diferentes horários para validar data automática
- Fazer backup da planilha antes de testes em massa
