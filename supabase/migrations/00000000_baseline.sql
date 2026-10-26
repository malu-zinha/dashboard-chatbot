-- =====================================================
-- BASELINE: estrutura do banco de producao
-- =====================================================
-- Gerado por scripts/montar-baseline.ts a partir do export de producao de 26/10/2026
-- (consulta supabase/consultas/exportar_estrutura.sql, so leitura).
--
-- E a fotografia da estrutura que esta valendo: tabelas, funcoes, views,
-- triggers, RLS, policies e permissoes. NAO tem dados.
--
-- NAO rodar na producao: ela ja tem tudo isto. Serve para saber qual versao
-- de cada funcao/view esta valendo e para montar um banco novo (outro projeto
-- Supabase, testes). As migrations com data depois deste arquivo continuam
-- sendo o historico das mudancas.
--
-- Conteudo:
--   Extensoes: 4
--   Sequencias: 4
--   Tabelas: 23
--   Sequencias ligadas as colunas: 4
--   Restricoes: 85
--   Indices: 43
--   Funcoes: 66
--   Views: 34
--   Triggers: 28
--   Row Level Security: 23
--   Policies: 22
--   Permissoes: 127
--   Privilegios padrao (so registro): 6
-- =====================================================

SET check_function_bodies = false;
SET client_min_messages = warning;
SET search_path = public, extensions;

-- -----------------------------------------------------
-- Extensoes
-- -----------------------------------------------------

-- extensao: pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- extensao: pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- extensao: supabase_vault
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- extensao: uuid-ossp
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- -----------------------------------------------------
-- Sequencias
-- -----------------------------------------------------

-- sequencia: status_codes_status_id_seq
CREATE SEQUENCE IF NOT EXISTS public.status_codes_status_id_seq AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1;

-- sequencia: complexidade_tarefas_complexidade_id_seq
CREATE SEQUENCE IF NOT EXISTS public.complexidade_tarefas_complexidade_id_seq AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1;

-- sequencia: area_pavimentos_template_id_seq
CREATE SEQUENCE IF NOT EXISTS public.area_pavimentos_template_id_seq AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1;

-- sequencia: area_etapas_template_id_seq
CREATE SEQUENCE IF NOT EXISTS public.area_etapas_template_id_seq AS integer INCREMENT 1 MINVALUE 1 MAXVALUE 2147483647 START 1;

-- -----------------------------------------------------
-- Tabelas
-- -----------------------------------------------------

-- tabela: engenheiros
CREATE TABLE public.engenheiros (
  eng_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  nome text NOT NULL,
  exclusivo boolean DEFAULT false NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  telefone character varying(20)
);

-- tabela: areas
CREATE TABLE public.areas (
  area_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  tempo_trabalho_dias integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: status_codes
CREATE TABLE public.status_codes (
  status_id integer DEFAULT nextval('status_codes_status_id_seq'::regclass) NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  percentual_base numeric(5,2) DEFAULT 0.00,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: projetos
CREATE TABLE public.projetos (
  projeto_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  codigo_projeto text NOT NULL,
  cliente text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  percentual_ponderado numeric(5,2) DEFAULT 0.00
);

-- tabela: engenheiros_projetos
CREATE TABLE public.engenheiros_projetos (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  area_id uuid NOT NULL,
  data_inicio date,
  data_prevista date,
  data_conclusao date,
  status_id integer,
  percentual_andamento numeric(5,2) DEFAULT 0.00,
  tempo_trabalho_dias integer,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  percentual_ponderado numeric(5,2) DEFAULT 0.00,
  instancia_label text,
  complemento_area_ref_id uuid,
  atribuido_por text
);

-- tabela: projetos_previsao
CREATE TABLE public.projetos_previsao (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_projeto_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  eng_id uuid NOT NULL,
  data_registro date DEFAULT CURRENT_DATE NOT NULL,
  previsao_texto text,
  feito_texto text,
  nova_data_prevista date,
  tempo_estimado integer,
  status_id integer,
  editavel boolean DEFAULT true,
  data_fim_dia timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: retrabalho_projetos
CREATE TABLE public.retrabalho_projetos (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_projeto_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  eng_id uuid NOT NULL,
  necessitou_retrabalho boolean DEFAULT false NOT NULL,
  data_retrabalho date DEFAULT CURRENT_DATE NOT NULL,
  motivo_retrabalho text,
  descricao text,
  tipo_retrabalho text,
  status_id integer,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  horas_trabalhadas_total numeric,
  horas_retrabalho numeric
);

-- tabela: prazos
CREATE TABLE public.prazos (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_projeto_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  eng_id uuid NOT NULL,
  data_inicio_projeto date NOT NULL,
  data_inicio_esperada_cliente date,
  prazo_final_eng date NOT NULL,
  prazo_final_cliente date NOT NULL,
  prazo_interno_dias integer,
  prazo_cliente_dias integer,
  observacoes text,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: dono_empresa
CREATE TABLE public.dono_empresa (
  dono_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  nome text NOT NULL,
  email text,
  telefone text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: complexidade_tarefas
CREATE TABLE public.complexidade_tarefas (
  complexidade_id integer DEFAULT nextval('complexidade_tarefas_complexidade_id_seq'::regclass) NOT NULL,
  codigo text NOT NULL,
  descricao text NOT NULL,
  nivel integer NOT NULL,
  tempo_estimado_dias integer,
  ativo boolean DEFAULT true
);

-- tabela: evandro_distribuicao_tasks
CREATE TABLE public.evandro_distribuicao_tasks (
  task_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  dono_id uuid,
  eng_id uuid NOT NULL,
  projeto_id uuid,
  codigo_projeto text,
  cliente text,
  area_id uuid NOT NULL,
  complexidade_id integer,
  descricao_task text NOT NULL,
  data_atribuicao timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  data_inicio_prevista date,
  data_conclusao_prevista date,
  status_task text DEFAULT 'PENDENTE'::text,
  notificacao_enviada boolean DEFAULT false,
  data_notificacao timestamp with time zone,
  eng_projeto_id uuid,
  sincronizado boolean DEFAULT false,
  data_sincronizacao timestamp with time zone,
  observacoes_dono text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  instancia_label text,
  updated_at timestamp with time zone DEFAULT now(),
  complemento_area_ref_id uuid
);

-- tabela: notificacoes_whatsapp
CREATE TABLE public.notificacoes_whatsapp (
  notificacao_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_id uuid NOT NULL,
  telefone text,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  task_id uuid,
  projeto_id uuid,
  enviada boolean DEFAULT false,
  data_envio timestamp with time zone,
  erro_envio text,
  tentativas integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: chatbot_logs
CREATE TABLE public.chatbot_logs (
  log_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_id uuid,
  prompt_original text NOT NULL,
  acao_executada text,
  sucesso boolean DEFAULT true,
  mensagem_retorno text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: tipos_obra
CREATE TABLE public.tipos_obra (
  codigo text NOT NULL,
  descricao text NOT NULL,
  ordem integer,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- tabela: motivos_retrabalho
CREATE TABLE public.motivos_retrabalho (
  codigo text NOT NULL,
  descricao text NOT NULL,
  ordem integer,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- tabela: tipos_projeto
CREATE TABLE public.tipos_projeto (
  codigo text NOT NULL,
  area_codigo text NOT NULL,
  descricao text NOT NULL,
  tempo_trabalho_dias integer NOT NULL,
  ordem integer,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- tabela: projeto_pavimentos
CREATE TABLE public.projeto_pavimentos (
  pavimento_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  projeto_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  peso numeric(5,2) DEFAULT 0.00 NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  area_id uuid,
  eng_projeto_id uuid
);

-- tabela: pavimento_etapas
CREATE TABLE public.pavimento_etapas (
  etapa_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  pavimento_id uuid NOT NULL,
  nome text NOT NULL,
  peso numeric(5,2) DEFAULT 0.00 NOT NULL,
  concluida boolean DEFAULT false,
  data_conclusao date,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- tabela: projeto_etapas_globais
CREATE TABLE public.projeto_etapas_globais (
  etapa_global_id uuid DEFAULT uuid_generate_v4() NOT NULL,
  projeto_id uuid NOT NULL,
  nome text NOT NULL,
  peso numeric(5,2) DEFAULT 0.00 NOT NULL,
  concluida boolean DEFAULT false,
  data_conclusao date,
  observacoes text,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  area_id uuid,
  eng_projeto_id uuid
);

-- tabela: area_pavimentos_template
CREATE TABLE public.area_pavimentos_template (
  id integer DEFAULT nextval('area_pavimentos_template_id_seq'::regclass) NOT NULL,
  area_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true
);

-- tabela: area_etapas_template
CREATE TABLE public.area_etapas_template (
  id integer DEFAULT nextval('area_etapas_template_id_seq'::regclass) NOT NULL,
  area_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  ativo boolean DEFAULT true
);

-- tabela: user_profiles
CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  email text,
  display_name text,
  role text DEFAULT 'engenheiro'::text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- tabela: status_historico
CREATE TABLE public.status_historico (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  eng_projeto_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  status_anterior_id integer,
  status_novo_id integer,
  data_mudanca timestamp with time zone DEFAULT now(),
  origem text DEFAULT 'sistema'::text,
  created_at timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------
-- Sequencias ligadas as colunas
-- -----------------------------------------------------

-- sequencia_dona: status_codes_status_id_seq
ALTER SEQUENCE public.status_codes_status_id_seq OWNED BY public.status_codes.status_id;

-- sequencia_dona: complexidade_tarefas_complexidade_id_seq
ALTER SEQUENCE public.complexidade_tarefas_complexidade_id_seq OWNED BY public.complexidade_tarefas.complexidade_id;

-- sequencia_dona: area_pavimentos_template_id_seq
ALTER SEQUENCE public.area_pavimentos_template_id_seq OWNED BY public.area_pavimentos_template.id;

-- sequencia_dona: area_etapas_template_id_seq
ALTER SEQUENCE public.area_etapas_template_id_seq OWNED BY public.area_etapas_template.id;

-- -----------------------------------------------------
-- Restricoes
-- -----------------------------------------------------

-- restricao: engenheiros.engenheiros_pkey
ALTER TABLE public.engenheiros ADD CONSTRAINT engenheiros_pkey PRIMARY KEY (eng_id);

-- restricao: areas.areas_pkey
ALTER TABLE public.areas ADD CONSTRAINT areas_pkey PRIMARY KEY (area_id);

-- restricao: areas.areas_codigo_key
ALTER TABLE public.areas ADD CONSTRAINT areas_codigo_key UNIQUE (codigo);

-- restricao: status_codes.status_codes_pkey
ALTER TABLE public.status_codes ADD CONSTRAINT status_codes_pkey PRIMARY KEY (status_id);

-- restricao: status_codes.status_codes_codigo_key
ALTER TABLE public.status_codes ADD CONSTRAINT status_codes_codigo_key UNIQUE (codigo);

-- restricao: projetos.projetos_pkey
ALTER TABLE public.projetos ADD CONSTRAINT projetos_pkey PRIMARY KEY (projeto_id);

-- restricao: projetos.projetos_codigo_projeto_key
ALTER TABLE public.projetos ADD CONSTRAINT projetos_codigo_projeto_key UNIQUE (codigo_projeto);

-- restricao: engenheiros_projetos.engenheiros_projetos_pkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_pkey PRIMARY KEY (id);

-- restricao: projetos_previsao.projetos_previsao_pkey
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_pkey PRIMARY KEY (id);

-- restricao: projetos_previsao.projetos_previsao_eng_projeto_id_data_registro_key
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_eng_projeto_id_data_registro_key UNIQUE (eng_projeto_id, data_registro);

-- restricao: retrabalho_projetos.retrabalho_projetos_pkey
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_pkey PRIMARY KEY (id);

-- restricao: retrabalho_projetos.retrabalho_projetos_eng_projeto_id_data_retrabalho_key
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_eng_projeto_id_data_retrabalho_key UNIQUE (eng_projeto_id, data_retrabalho);

-- restricao: prazos.prazos_pkey
ALTER TABLE public.prazos ADD CONSTRAINT prazos_pkey PRIMARY KEY (id);

-- restricao: dono_empresa.dono_empresa_pkey
ALTER TABLE public.dono_empresa ADD CONSTRAINT dono_empresa_pkey PRIMARY KEY (dono_id);

-- restricao: dono_empresa.dono_empresa_email_key
ALTER TABLE public.dono_empresa ADD CONSTRAINT dono_empresa_email_key UNIQUE (email);

-- restricao: complexidade_tarefas.complexidade_tarefas_pkey
ALTER TABLE public.complexidade_tarefas ADD CONSTRAINT complexidade_tarefas_pkey PRIMARY KEY (complexidade_id);

-- restricao: complexidade_tarefas.complexidade_tarefas_codigo_key
ALTER TABLE public.complexidade_tarefas ADD CONSTRAINT complexidade_tarefas_codigo_key UNIQUE (codigo);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_pkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_pkey PRIMARY KEY (task_id);

-- restricao: notificacoes_whatsapp.notificacoes_whatsapp_pkey
ALTER TABLE public.notificacoes_whatsapp ADD CONSTRAINT notificacoes_whatsapp_pkey PRIMARY KEY (notificacao_id);

-- restricao: chatbot_logs.chatbot_logs_pkey
ALTER TABLE public.chatbot_logs ADD CONSTRAINT chatbot_logs_pkey PRIMARY KEY (log_id);

-- restricao: engenheiros.engenheiros_telefone_key
ALTER TABLE public.engenheiros ADD CONSTRAINT engenheiros_telefone_key UNIQUE (telefone);

-- restricao: tipos_obra.tipos_obra_pkey
ALTER TABLE public.tipos_obra ADD CONSTRAINT tipos_obra_pkey PRIMARY KEY (codigo);

-- restricao: motivos_retrabalho.motivos_retrabalho_pkey
ALTER TABLE public.motivos_retrabalho ADD CONSTRAINT motivos_retrabalho_pkey PRIMARY KEY (codigo);

-- restricao: tipos_projeto.tipos_projeto_pkey
ALTER TABLE public.tipos_projeto ADD CONSTRAINT tipos_projeto_pkey PRIMARY KEY (codigo);

-- restricao: projeto_pavimentos.projeto_pavimentos_pkey
ALTER TABLE public.projeto_pavimentos ADD CONSTRAINT projeto_pavimentos_pkey PRIMARY KEY (pavimento_id);

-- restricao: pavimento_etapas.pavimento_etapas_pkey
ALTER TABLE public.pavimento_etapas ADD CONSTRAINT pavimento_etapas_pkey PRIMARY KEY (etapa_id);

-- restricao: pavimento_etapas.pavimento_etapas_pavimento_id_nome_key
ALTER TABLE public.pavimento_etapas ADD CONSTRAINT pavimento_etapas_pavimento_id_nome_key UNIQUE (pavimento_id, nome);

-- restricao: projeto_etapas_globais.projeto_etapas_globais_pkey
ALTER TABLE public.projeto_etapas_globais ADD CONSTRAINT projeto_etapas_globais_pkey PRIMARY KEY (etapa_global_id);

-- restricao: area_pavimentos_template.area_pavimentos_template_pkey
ALTER TABLE public.area_pavimentos_template ADD CONSTRAINT area_pavimentos_template_pkey PRIMARY KEY (id);

-- restricao: area_pavimentos_template.area_pavimentos_template_area_id_nome_key
ALTER TABLE public.area_pavimentos_template ADD CONSTRAINT area_pavimentos_template_area_id_nome_key UNIQUE (area_id, nome);

-- restricao: area_etapas_template.area_etapas_template_tipo_check
ALTER TABLE public.area_etapas_template ADD CONSTRAINT area_etapas_template_tipo_check CHECK ((tipo = ANY (ARRAY['pavimento'::text, 'global'::text])));

-- restricao: area_etapas_template.area_etapas_template_pkey
ALTER TABLE public.area_etapas_template ADD CONSTRAINT area_etapas_template_pkey PRIMARY KEY (id);

-- restricao: area_etapas_template.area_etapas_template_area_id_tipo_nome_key
ALTER TABLE public.area_etapas_template ADD CONSTRAINT area_etapas_template_area_id_tipo_nome_key UNIQUE (area_id, tipo, nome);

-- restricao: user_profiles.user_profiles_role_check
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'engenheiro'::text])));

-- restricao: user_profiles.user_profiles_status_check
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])));

-- restricao: user_profiles.user_profiles_pkey
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);

-- restricao: status_historico.status_historico_pkey
ALTER TABLE public.status_historico ADD CONSTRAINT status_historico_pkey PRIMARY KEY (id);

-- restricao: retrabalho_projetos.chk_retrabalho_motivo_padrao
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT chk_retrabalho_motivo_padrao CHECK (((motivo_retrabalho IS NULL) OR (motivo_retrabalho = ANY (ARRAY['Falta de informação (Construtora)'::text, 'Alteração de projeto (Construtora)'::text, 'Erro de projeto (TecPred)'::text, 'Projeto Suspenso'::text, 'Erro de comunicação'::text, 'Outro'::text])))) NOT VALID;

-- restricao: retrabalho_projetos.chk_retrabalho_horas_nao_negativas
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT chk_retrabalho_horas_nao_negativas CHECK ((((horas_trabalhadas_total IS NULL) OR (horas_trabalhadas_total >= (0)::numeric)) AND ((horas_retrabalho IS NULL) OR (horas_retrabalho >= (0)::numeric)))) NOT VALID;

-- restricao: retrabalho_projetos.chk_retrabalho_horas_consistentes
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT chk_retrabalho_horas_consistentes CHECK (((horas_trabalhadas_total IS NULL) OR (horas_retrabalho IS NULL) OR (horas_retrabalho <= horas_trabalhadas_total))) NOT VALID;

-- restricao: retrabalho_projetos.chk_retrabalho_sem_retrabalho_horas_zero
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT chk_retrabalho_sem_retrabalho_horas_zero CHECK (((necessitou_retrabalho = true) OR (horas_retrabalho IS NULL) OR (horas_retrabalho = (0)::numeric))) NOT VALID;

-- restricao: retrabalho_projetos.chk_retrabalho_horas_max_dia
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT chk_retrabalho_horas_max_dia CHECK (((horas_trabalhadas_total IS NULL) OR (horas_trabalhadas_total <= (24)::numeric))) NOT VALID;

-- restricao: engenheiros_projetos.engenheiros_projetos_eng_id_fkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id) ON DELETE CASCADE;

-- restricao: engenheiros_projetos.engenheiros_projetos_projeto_id_fkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE CASCADE;

-- restricao: engenheiros_projetos.engenheiros_projetos_area_id_fkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id);

-- restricao: engenheiros_projetos.engenheiros_projetos_status_id_fkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_status_id_fkey FOREIGN KEY (status_id) REFERENCES status_codes(status_id);

-- restricao: projetos_previsao.projetos_previsao_eng_projeto_id_fkey
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- restricao: projetos_previsao.projetos_previsao_projeto_id_fkey
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id);

-- restricao: projetos_previsao.projetos_previsao_eng_id_fkey
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: projetos_previsao.projetos_previsao_status_id_fkey
ALTER TABLE public.projetos_previsao ADD CONSTRAINT projetos_previsao_status_id_fkey FOREIGN KEY (status_id) REFERENCES status_codes(status_id);

-- restricao: retrabalho_projetos.retrabalho_projetos_eng_projeto_id_fkey
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- restricao: retrabalho_projetos.retrabalho_projetos_projeto_id_fkey
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id);

-- restricao: retrabalho_projetos.retrabalho_projetos_eng_id_fkey
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: retrabalho_projetos.retrabalho_projetos_status_id_fkey
ALTER TABLE public.retrabalho_projetos ADD CONSTRAINT retrabalho_projetos_status_id_fkey FOREIGN KEY (status_id) REFERENCES status_codes(status_id);

-- restricao: prazos.prazos_eng_projeto_id_fkey
ALTER TABLE public.prazos ADD CONSTRAINT prazos_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- restricao: prazos.prazos_projeto_id_fkey
ALTER TABLE public.prazos ADD CONSTRAINT prazos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id);

-- restricao: prazos.prazos_eng_id_fkey
ALTER TABLE public.prazos ADD CONSTRAINT prazos_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_dono_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_dono_id_fkey FOREIGN KEY (dono_id) REFERENCES dono_empresa(dono_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_eng_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_projeto_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_area_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_complexidade_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_complexidade_id_fkey FOREIGN KEY (complexidade_id) REFERENCES complexidade_tarefas(complexidade_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_eng_projeto_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id);

-- restricao: notificacoes_whatsapp.notificacoes_whatsapp_eng_id_fkey
ALTER TABLE public.notificacoes_whatsapp ADD CONSTRAINT notificacoes_whatsapp_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: notificacoes_whatsapp.notificacoes_whatsapp_task_id_fkey
ALTER TABLE public.notificacoes_whatsapp ADD CONSTRAINT notificacoes_whatsapp_task_id_fkey FOREIGN KEY (task_id) REFERENCES evandro_distribuicao_tasks(task_id);

-- restricao: notificacoes_whatsapp.notificacoes_whatsapp_projeto_id_fkey
ALTER TABLE public.notificacoes_whatsapp ADD CONSTRAINT notificacoes_whatsapp_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id);

-- restricao: chatbot_logs.chatbot_logs_eng_id_fkey
ALTER TABLE public.chatbot_logs ADD CONSTRAINT chatbot_logs_eng_id_fkey FOREIGN KEY (eng_id) REFERENCES engenheiros(eng_id);

-- restricao: tipos_projeto.tipos_projeto_area_codigo_fkey
ALTER TABLE public.tipos_projeto ADD CONSTRAINT tipos_projeto_area_codigo_fkey FOREIGN KEY (area_codigo) REFERENCES areas(codigo) ON DELETE CASCADE;

-- restricao: projeto_pavimentos.projeto_pavimentos_projeto_id_fkey
ALTER TABLE public.projeto_pavimentos ADD CONSTRAINT projeto_pavimentos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE CASCADE;

-- restricao: pavimento_etapas.pavimento_etapas_pavimento_id_fkey
ALTER TABLE public.pavimento_etapas ADD CONSTRAINT pavimento_etapas_pavimento_id_fkey FOREIGN KEY (pavimento_id) REFERENCES projeto_pavimentos(pavimento_id) ON DELETE CASCADE;

-- restricao: projeto_etapas_globais.projeto_etapas_globais_projeto_id_fkey
ALTER TABLE public.projeto_etapas_globais ADD CONSTRAINT projeto_etapas_globais_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE CASCADE;

-- restricao: projeto_pavimentos.projeto_pavimentos_area_id_fkey
ALTER TABLE public.projeto_pavimentos ADD CONSTRAINT projeto_pavimentos_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE;

-- restricao: projeto_etapas_globais.projeto_etapas_globais_area_id_fkey
ALTER TABLE public.projeto_etapas_globais ADD CONSTRAINT projeto_etapas_globais_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE;

-- restricao: area_pavimentos_template.area_pavimentos_template_area_id_fkey
ALTER TABLE public.area_pavimentos_template ADD CONSTRAINT area_pavimentos_template_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE;

-- restricao: area_etapas_template.area_etapas_template_area_id_fkey
ALTER TABLE public.area_etapas_template ADD CONSTRAINT area_etapas_template_area_id_fkey FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE;

-- restricao: user_profiles.user_profiles_user_id_fkey
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- restricao: user_profiles.user_profiles_created_by_fkey
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- restricao: status_historico.status_historico_eng_projeto_id_fkey
ALTER TABLE public.status_historico ADD CONSTRAINT status_historico_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- restricao: status_historico.status_historico_projeto_id_fkey
ALTER TABLE public.status_historico ADD CONSTRAINT status_historico_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES projetos(projeto_id) ON DELETE CASCADE;

-- restricao: status_historico.status_historico_status_anterior_id_fkey
ALTER TABLE public.status_historico ADD CONSTRAINT status_historico_status_anterior_id_fkey FOREIGN KEY (status_anterior_id) REFERENCES status_codes(status_id);

-- restricao: status_historico.status_historico_status_novo_id_fkey
ALTER TABLE public.status_historico ADD CONSTRAINT status_historico_status_novo_id_fkey FOREIGN KEY (status_novo_id) REFERENCES status_codes(status_id);

-- restricao: engenheiros_projetos.engenheiros_projetos_complemento_area_ref_id_fkey
ALTER TABLE public.engenheiros_projetos ADD CONSTRAINT engenheiros_projetos_complemento_area_ref_id_fkey FOREIGN KEY (complemento_area_ref_id) REFERENCES areas(area_id);

-- restricao: evandro_distribuicao_tasks.evandro_distribuicao_tasks_complemento_area_ref_id_fkey
ALTER TABLE public.evandro_distribuicao_tasks ADD CONSTRAINT evandro_distribuicao_tasks_complemento_area_ref_id_fkey FOREIGN KEY (complemento_area_ref_id) REFERENCES areas(area_id);

-- restricao: projeto_pavimentos.projeto_pavimentos_eng_projeto_id_fkey
ALTER TABLE public.projeto_pavimentos ADD CONSTRAINT projeto_pavimentos_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- restricao: projeto_etapas_globais.projeto_etapas_globais_eng_projeto_id_fkey
ALTER TABLE public.projeto_etapas_globais ADD CONSTRAINT projeto_etapas_globais_eng_projeto_id_fkey FOREIGN KEY (eng_projeto_id) REFERENCES engenheiros_projetos(id) ON DELETE CASCADE;

-- -----------------------------------------------------
-- Indices
-- -----------------------------------------------------

-- indice: idx_engenheiros_ativo
CREATE INDEX idx_engenheiros_ativo ON public.engenheiros USING btree (ativo);

-- indice: idx_areas_codigo
CREATE INDEX idx_areas_codigo ON public.areas USING btree (codigo);

-- indice: idx_areas_ativo
CREATE INDEX idx_areas_ativo ON public.areas USING btree (ativo);

-- indice: idx_status_ordem
CREATE INDEX idx_status_ordem ON public.status_codes USING btree (ordem);

-- indice: idx_status_ativo
CREATE INDEX idx_status_ativo ON public.status_codes USING btree (ativo);

-- indice: idx_projetos_codigo
CREATE INDEX idx_projetos_codigo ON public.projetos USING btree (codigo_projeto);

-- indice: idx_projetos_ativo
CREATE INDEX idx_projetos_ativo ON public.projetos USING btree (ativo);

-- indice: idx_eng_proj_eng_id
CREATE INDEX idx_eng_proj_eng_id ON public.engenheiros_projetos USING btree (eng_id);

-- indice: idx_eng_proj_projeto_id
CREATE INDEX idx_eng_proj_projeto_id ON public.engenheiros_projetos USING btree (projeto_id);

-- indice: idx_eng_proj_area_id
CREATE INDEX idx_eng_proj_area_id ON public.engenheiros_projetos USING btree (area_id);

-- indice: idx_proj_prev_eng_proj
CREATE INDEX idx_proj_prev_eng_proj ON public.projetos_previsao USING btree (eng_projeto_id);

-- indice: idx_proj_prev_data
CREATE INDEX idx_proj_prev_data ON public.projetos_previsao USING btree (data_registro);

-- indice: idx_retrab_eng_proj
CREATE INDEX idx_retrab_eng_proj ON public.retrabalho_projetos USING btree (eng_projeto_id);

-- indice: idx_retrab_data
CREATE INDEX idx_retrab_data ON public.retrabalho_projetos USING btree (data_retrabalho);

-- indice: idx_prazos_eng_proj
CREATE INDEX idx_prazos_eng_proj ON public.prazos USING btree (eng_projeto_id);

-- indice: idx_evandro_tasks_eng
CREATE INDEX idx_evandro_tasks_eng ON public.evandro_distribuicao_tasks USING btree (eng_id);

-- indice: idx_notif_enviada
CREATE INDEX idx_notif_enviada ON public.notificacoes_whatsapp USING btree (enviada);

-- indice: idx_engenheiros_telefone
CREATE INDEX idx_engenheiros_telefone ON public.engenheiros USING btree (telefone);

-- indice: idx_dono_telefone
CREATE INDEX idx_dono_telefone ON public.dono_empresa USING btree (telefone);

-- indice: idx_chatbot_logs_eng_id
CREATE INDEX idx_chatbot_logs_eng_id ON public.chatbot_logs USING btree (eng_id);

-- indice: idx_chatbot_logs_created
CREATE INDEX idx_chatbot_logs_created ON public.chatbot_logs USING btree (created_at);

-- indice: idx_tipos_projeto_area
CREATE INDEX idx_tipos_projeto_area ON public.tipos_projeto USING btree (area_codigo);

-- indice: idx_tipos_projeto_ativo
CREATE INDEX idx_tipos_projeto_ativo ON public.tipos_projeto USING btree (ativo);

-- indice: idx_pav_projeto_id
CREATE INDEX idx_pav_projeto_id ON public.projeto_pavimentos USING btree (projeto_id);

-- indice: idx_pav_ativo
CREATE INDEX idx_pav_ativo ON public.projeto_pavimentos USING btree (ativo);

-- indice: idx_pav_etapa_pavimento_id
CREATE INDEX idx_pav_etapa_pavimento_id ON public.pavimento_etapas USING btree (pavimento_id);

-- indice: idx_pav_etapa_concluida
CREATE INDEX idx_pav_etapa_concluida ON public.pavimento_etapas USING btree (concluida);

-- indice: idx_etapa_global_projeto_id
CREATE INDEX idx_etapa_global_projeto_id ON public.projeto_etapas_globais USING btree (projeto_id);

-- indice: idx_etapa_global_concluida
CREATE INDEX idx_etapa_global_concluida ON public.projeto_etapas_globais USING btree (concluida);

-- indice: idx_pav_area_id
CREATE INDEX idx_pav_area_id ON public.projeto_pavimentos USING btree (area_id);

-- indice: idx_etapa_global_area_id
CREATE INDEX idx_etapa_global_area_id ON public.projeto_etapas_globais USING btree (area_id);

-- indice: idx_pav_tpl_area
CREATE INDEX idx_pav_tpl_area ON public.area_pavimentos_template USING btree (area_id);

-- indice: idx_etapa_tpl_area_tipo
CREATE INDEX idx_etapa_tpl_area_tipo ON public.area_etapas_template USING btree (area_id, tipo);

-- indice: uq_eng_proj_active_instancia
CREATE UNIQUE INDEX uq_eng_proj_active_instancia ON public.engenheiros_projetos USING btree (eng_id, projeto_id, area_id, COALESCE(instancia_label, ''::text)) WHERE (ativo = true);

-- indice: uq_eng_proj_area_instancia_label_active
CREATE UNIQUE INDEX uq_eng_proj_area_instancia_label_active ON public.engenheiros_projetos USING btree (projeto_id, area_id, lower(instancia_label)) WHERE ((ativo = true) AND (instancia_label IS NOT NULL));

-- indice: idx_status_historico_projeto
CREATE INDEX idx_status_historico_projeto ON public.status_historico USING btree (projeto_id);

-- indice: idx_status_historico_eng_projeto
CREATE INDEX idx_status_historico_eng_projeto ON public.status_historico USING btree (eng_projeto_id);

-- indice: idx_status_historico_data
CREATE INDEX idx_status_historico_data ON public.status_historico USING btree (data_mudanca);

-- indice: idx_status_historico_status_novo
CREATE INDEX idx_status_historico_status_novo ON public.status_historico USING btree (status_novo_id);

-- indice: uq_pav_projeto_area_instancia_nome
CREATE UNIQUE INDEX uq_pav_projeto_area_instancia_nome ON public.projeto_pavimentos USING btree (projeto_id, area_id, COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- indice: uq_etapa_global_projeto_area_instancia_nome
CREATE UNIQUE INDEX uq_etapa_global_projeto_area_instancia_nome ON public.projeto_etapas_globais USING btree (projeto_id, area_id, COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- indice: idx_pav_eng_projeto_id
CREATE INDEX idx_pav_eng_projeto_id ON public.projeto_pavimentos USING btree (eng_projeto_id);

-- indice: idx_etapa_global_eng_projeto_id
CREATE INDEX idx_etapa_global_eng_projeto_id ON public.projeto_etapas_globais USING btree (eng_projeto_id);

-- -----------------------------------------------------
-- Funcoes
-- -----------------------------------------------------

-- funcao: cadastrar_engenheiro(text,boolean)
CREATE OR REPLACE FUNCTION public.cadastrar_engenheiro(p_nome text, p_exclusivo boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_eng_id UUID;
    v_result JSON;
BEGIN
    -- Validação
    IF p_nome IS NULL OR TRIM(p_nome) = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Nome do engenheiro é obrigatório'
        );
    END IF;
    
    -- Verifica se já existe
    SELECT eng_id INTO v_eng_id 
    FROM engenheiros 
    WHERE LOWER(nome) = LOWER(TRIM(p_nome)) AND ativo = true;
    
    IF v_eng_id IS NOT NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já cadastrado',
            'eng_id', v_eng_id
        );
    END IF;
    
    -- Insere
    INSERT INTO engenheiros (nome, exclusivo)
    VALUES (TRIM(p_nome), p_exclusivo)
    RETURNING eng_id INTO v_eng_id;
    
    -- Retorna resultado
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Engenheiro cadastrado com sucesso!',
        'eng_id', v_eng_id,
        'nome', TRIM(p_nome),
        'exclusivo', p_exclusivo
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao cadastrar: ' || SQLERRM
    );
END;
$function$
;

-- funcao: atualizar_engenheiro(uuid,text,boolean)
CREATE OR REPLACE FUNCTION public.atualizar_engenheiro(p_eng_id uuid, p_nome text DEFAULT NULL::text, p_exclusivo boolean DEFAULT NULL::boolean)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_updated_fields TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Verifica se engenheiro existe
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    -- Atualiza nome se fornecido
    IF p_nome IS NOT NULL THEN
        UPDATE engenheiros 
        SET nome = TRIM(p_nome)
        WHERE eng_id = p_eng_id;
        v_updated_fields := array_append(v_updated_fields, 'nome');
    END IF;
    
    -- Atualiza exclusividade se fornecida
    IF p_exclusivo IS NOT NULL THEN
        UPDATE engenheiros 
        SET exclusivo = p_exclusivo
        WHERE eng_id = p_eng_id;
        v_updated_fields := array_append(v_updated_fields, 'exclusivo');
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Dados atualizados com sucesso',
        'campos_atualizados', v_updated_fields
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar: ' || SQLERRM
    );
END;
$function$
;

-- funcao: criar_projeto(text,text,text)
CREATE OR REPLACE FUNCTION public.criar_projeto(p_codigo text, p_cliente text, p_descricao text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_projeto_ativo BOOLEAN;
    v_codigo TEXT;
    v_cliente TEXT;
    v_descricao TEXT;
    v_reativado BOOLEAN := false;
BEGIN
    v_codigo := UPPER(TRIM(COALESCE(p_codigo, '')));
    v_cliente := TRIM(COALESCE(p_cliente, ''));
    v_descricao := NULLIF(TRIM(COALESCE(p_descricao, '')), '');

    IF v_codigo = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Codigo do projeto e obrigatorio'
        );
    END IF;

    IF v_cliente = '' THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Nome do cliente e obrigatorio'
        );
    END IF;

    SELECT projeto_id, ativo INTO v_projeto_id, v_projeto_ativo
    FROM projetos
    WHERE codigo_projeto = v_codigo
    FOR UPDATE;

    IF v_projeto_id IS NOT NULL AND v_projeto_ativo = true THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Codigo de projeto ja existe'
        );
    END IF;

    IF v_projeto_id IS NOT NULL AND v_projeto_ativo = false THEN
        UPDATE projetos
        SET
            ativo = true,
            cliente = v_cliente,
            descricao = v_descricao,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id;

        UPDATE engenheiros_projetos
        SET
            ativo = false,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE evandro_distribuicao_tasks
        SET
            ativo = false,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE notificacoes_whatsapp
        SET
            enviada = true,
            data_envio = COALESCE(data_envio, NOW()),
            erro_envio = COALESCE(erro_envio, 'Cancelada por exclusao do projeto')
        WHERE projeto_id = v_projeto_id
          AND enviada = false;

        DELETE FROM projeto_etapas_globais
        WHERE projeto_id = v_projeto_id;

        DELETE FROM projeto_pavimentos
        WHERE projeto_id = v_projeto_id;

        v_reativado := true;
    ELSE
        INSERT INTO projetos (codigo_projeto, cliente, descricao, ativo)
        VALUES (v_codigo, v_cliente, v_descricao, true)
        RETURNING projeto_id INTO v_projeto_id;
    END IF;

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE
            WHEN v_reativado THEN 'Projeto reativado com sucesso!'
            ELSE 'Projeto criado com sucesso!'
        END,
        'projeto_id', v_projeto_id,
        'codigo', v_codigo,
        'cliente', v_cliente,
        'reativado', v_reativado
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao criar projeto: ' || SQLERRM
    );
END;
$function$
;

-- funcao: atribuir_area_projeto(uuid,uuid,text,date,date,text)
CREATE OR REPLACE FUNCTION public.atribuir_area_projeto(p_eng_id uuid, p_projeto_id uuid, p_area_codigo text, p_data_inicio date DEFAULT CURRENT_DATE, p_data_prevista date DEFAULT NULL::date, p_status_codigo text DEFAULT 'AGUARDANDO_INICIO'::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_area_id INTEGER;
    v_status_id INTEGER;
    v_atribuicao_id UUID;
    v_tempo_trabalho INTEGER;
    v_percentual NUMERIC;
BEGIN
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    -- Valida projeto
    IF NOT EXISTS (SELECT 1 FROM projetos WHERE projeto_id = p_projeto_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Projeto não encontrado'
        );
    END IF;
    
    -- Busca área
    SELECT area_id INTO v_area_id
    FROM areas 
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada. Áreas disponíveis: ELETRICO, HIDRAULICO, ESTRUTURAL, etc.'
        );
    END IF;
    
    -- Busca status
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE UPPER(codigo) = UPPER(TRIM(p_status_codigo)) AND ativo = true;
    
    IF v_status_id IS NULL THEN
        v_status_id := (SELECT status_id FROM status_codes WHERE codigo = 'AGUARDANDO_INICIO');
    END IF;
    
    -- Verifica duplicidade
    IF EXISTS (
        SELECT 1 FROM engenheiros_projetos 
        WHERE eng_id = p_eng_id 
        AND projeto_id = p_projeto_id 
        AND area_id = v_area_id 
        AND ativo = true
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já está atribuído a esta área neste projeto'
        );
    END IF;
    
    -- Insere atribuição (triggers calculam tempo e percentual automaticamente)
    INSERT INTO engenheiros_projetos (
        eng_id, 
        projeto_id, 
        area_id, 
        data_inicio, 
        data_prevista,
        status_id
    ) VALUES (
        p_eng_id,
        p_projeto_id,
        v_area_id,
        COALESCE(p_data_inicio, CURRENT_DATE),
        p_data_prevista,
        v_status_id
    ) RETURNING id, tempo_trabalho_dias, percentual_andamento 
    INTO v_atribuicao_id, v_tempo_trabalho, v_percentual;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Área atribuída com sucesso! Tempo e percentual calculados automaticamente.',
        'atribuicao_id', v_atribuicao_id,
        'tempo_trabalho_dias', v_tempo_trabalho,
        'percentual_andamento', v_percentual
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atribuir área: ' || SQLERRM
    );
END;
$function$
;

-- funcao: atualizar_status_projeto(uuid,text)
CREATE OR REPLACE FUNCTION public.atualizar_status_projeto(p_atribuicao_id uuid, p_status_codigo text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_status_id INTEGER;
    v_percentual NUMERIC;
BEGIN
    -- Busca status
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE UPPER(codigo) = UPPER(TRIM(p_status_codigo)) AND ativo = true;
    
    IF v_status_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Status não encontrado. Use: AGUARDANDO_INICIO, EM_PLANEJAMENTO, etc.'
        );
    END IF;
    
    -- Atualiza (trigger calcula percentual automaticamente)
    UPDATE engenheiros_projetos
    SET status_id = v_status_id
    WHERE id = p_atribuicao_id AND ativo = true
    RETURNING percentual_andamento INTO v_percentual;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Status atualizado! Percentual calculado automaticamente.',
        'percentual_andamento', v_percentual
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar status: ' || SQLERRM
    );
END;
$function$
;

-- funcao: atualizar_previsao(uuid,date)
CREATE OR REPLACE FUNCTION public.atualizar_previsao(p_atribuicao_id uuid, p_nova_data date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE engenheiros_projetos
    SET data_prevista = p_nova_data
    WHERE id = p_atribuicao_id AND ativo = true;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Registra no histórico
    INSERT INTO projetos_previsao (eng_projeto_id, data_previsao)
    VALUES (p_atribuicao_id, p_nova_data);
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão atualizada com sucesso!',
        'nova_data', p_nova_data
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar previsão: ' || SQLERRM
    );
END;
$function$
;

-- funcao: registrar_retrabalho(uuid,text,text)
CREATE OR REPLACE FUNCTION public.registrar_retrabalho(p_atribuicao_id uuid, p_motivo text, p_descricao text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_retrabalho_id UUID;
BEGIN
    INSERT INTO retrabalho_projetos (
        eng_projeto_id,
        necessitou_retrabalho,
        motivo,
        descricao,
        data_retrabalho
    ) VALUES (
        p_atribuicao_id,
        true,
        p_motivo,
        p_descricao,
        CURRENT_DATE
    ) RETURNING id INTO v_retrabalho_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Retrabalho registrado',
        'retrabalho_id', v_retrabalho_id
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao registrar retrabalho: ' || SQLERRM
    );
END;
$function$
;

-- funcao: buscar_meus_projetos(uuid)
CREATE OR REPLACE FUNCTION public.buscar_meus_projetos(p_eng_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'projeto_codigo', codigo_projeto,
            'cliente', cliente,
            'area', area_descricao,
            'data_inicio', data_inicio,
            'data_prevista', data_prevista,
            'status', status_descricao,
            'percentual', percentual_andamento,
            'tempo_trabalho_dias', tempo_trabalho_dias
        ) ORDER BY data_inicio DESC
    ) INTO v_result
    FROM vw_engenheiros_projetos
    WHERE eng_id = p_eng_id AND ativo = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$
;

-- funcao: listar_areas_disponiveis()
CREATE OR REPLACE FUNCTION public.listar_areas_disponiveis()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'area_id', area_id,
            'codigo', codigo,
            'descricao', descricao,
            'tempo_trabalho_dias', tempo_trabalho_dias
        ) ORDER BY descricao
    ) INTO v_result
    FROM areas
    WHERE ativo = true;
    
    RETURN v_result;
END;
$function$
;

-- funcao: listar_status_disponiveis()
CREATE OR REPLACE FUNCTION public.listar_status_disponiveis()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao,
            'percentual', percentual_base
        ) ORDER BY ordem
    ) INTO v_result
    FROM status_codes
    WHERE ativo = true;
    
    RETURN v_result;
END;
$function$
;

-- funcao: processar_prompt_chatbot(uuid,text,jsonb)
CREATE OR REPLACE FUNCTION public.processar_prompt_chatbot(p_eng_id uuid, p_prompt text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_log_id UUID;
    v_resultado JSON;
BEGIN
    -- Registra log inicial
    INSERT INTO chatbot_logs (eng_id, prompt_original, metadata)
    VALUES (p_eng_id, p_prompt, p_metadata)
    RETURNING log_id INTO v_log_id;
    
    -- Aqui o chatbot/LLM interpretará o prompt e chamará as functions apropriadas
    -- Por enquanto, retorna estrutura para o chatbot processar
    v_resultado := json_build_object(
        'log_id', v_log_id,
        'prompt_recebido', p_prompt,
        'funcoes_disponiveis', json_build_array(
            'cadastrar_engenheiro',
            'criar_projeto',
            'atribuir_area_projeto',
            'atualizar_status_projeto',
            'atualizar_previsao',
            'registrar_retrabalho',
            'buscar_meus_projetos'
        )
    );
    
    -- Atualiza log
    UPDATE chatbot_logs
    SET sucesso = true,
        mensagem_retorno = 'Prompt processado'
    WHERE log_id = v_log_id;
    
    RETURN v_resultado;
    
EXCEPTION WHEN OTHERS THEN
    UPDATE chatbot_logs
    SET sucesso = false,
        mensagem_retorno = SQLERRM
    WHERE log_id = v_log_id;
    
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro: ' || SQLERRM
    );
END;
$function$
;

-- funcao: registrar_previsao_dia(uuid,text,integer,date)
CREATE OR REPLACE FUNCTION public.registrar_previsao_dia(p_atribuicao_id uuid, p_previsao_texto text, p_tempo_estimado integer DEFAULT NULL::integer, p_nova_data_prevista date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_previsao_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_previsao_existente UUID;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Verifica se já existe previsão para hoje
    SELECT id INTO v_previsao_existente
    FROM projetos_previsao 
    WHERE eng_projeto_id = p_atribuicao_id 
    AND data_registro = CURRENT_DATE
    LIMIT 1;
    
    -- Se já existe, ATUALIZA
    IF v_previsao_existente IS NOT NULL THEN
        UPDATE projetos_previsao
        SET 
            previsao_texto = p_previsao_texto,
            tempo_estimado = COALESCE(p_tempo_estimado, tempo_estimado),
            nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista),
            status_id = v_status_id,
            updated_at = NOW()
        WHERE id = v_previsao_existente
        RETURNING id INTO v_previsao_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Previsão atualizada',
            'previsao_id', v_previsao_id,
            'data', CURRENT_DATE
        );
    END IF;
    
    -- Se não existe, INSERE
    INSERT INTO projetos_previsao (
        eng_projeto_id,
        projeto_id,
        eng_id,
        data_registro,
        previsao_texto,
        tempo_estimado,
        nova_data_prevista,
        status_id,
        editavel
    ) VALUES (
        p_atribuicao_id,
        v_projeto_id,
        v_eng_id,
        CURRENT_DATE,
        p_previsao_texto,
        p_tempo_estimado,
        p_nova_data_prevista,
        v_status_id,
        true
    )
    RETURNING id INTO v_previsao_id;
    
    -- Atualiza data prevista se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET 
            data_prevista = p_nova_data_prevista,
            updated_at = NOW()
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Previsão registrada',
        'previsao_id', v_previsao_id,
        'data', CURRENT_DATE
    );
END;
$function$
;

-- funcao: atualizar_feito_dia(uuid,text,date)
CREATE OR REPLACE FUNCTION public.atualizar_feito_dia(p_atribuicao_id uuid, p_feito_texto text, p_nova_data_prevista date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_previsao_id UUID;
BEGIN
    -- Busca previsão de hoje
    SELECT id INTO v_previsao_id
    FROM projetos_previsao
    WHERE eng_projeto_id = p_atribuicao_id
    AND data_registro = CURRENT_DATE
    AND editavel = true;
    
    IF v_previsao_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Não há previsão para hoje ou ela já foi finalizada'
        );
    END IF;
    
    -- Atualiza feito e nova data prevista (trigger tornará imutável)
    UPDATE projetos_previsao
    SET 
        feito_texto = p_feito_texto,
        nova_data_prevista = COALESCE(p_nova_data_prevista, nova_data_prevista)
    WHERE id = v_previsao_id;
    
    -- Atualiza data prevista na atribuição se fornecida
    IF p_nova_data_prevista IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET data_prevista = p_nova_data_prevista
        WHERE id = p_atribuicao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Feito do dia registrado! Registro agora é imutável.',
        'previsao_id', v_previsao_id,
        'nova_data_prevista', p_nova_data_prevista
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atualizar feito: ' || SQLERRM
    );
END;
$function$
;

-- funcao: criar_atualizar_prazos(uuid,date,date,date,date,text)
CREATE OR REPLACE FUNCTION public.criar_atualizar_prazos(p_atribuicao_id uuid, p_data_inicio_projeto date, p_prazo_final_eng date, p_prazo_final_cliente date, p_data_inicio_esperada_cliente date DEFAULT NULL::date, p_observacoes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_prazo_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_existe BOOLEAN;
BEGIN
    -- Valida atribuição
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Atribuição não encontrada'
        );
    END IF;
    
    -- Busca dados da atribuição
    SELECT projeto_id, eng_id INTO v_projeto_id, v_eng_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;
    
    -- Verifica se já existe prazo
    SELECT EXISTS (
        SELECT 1 FROM prazos WHERE eng_projeto_id = p_atribuicao_id
    ) INTO v_existe;
    
    IF v_existe THEN
        -- Atualiza
        UPDATE prazos
        SET 
            data_inicio_projeto = p_data_inicio_projeto,
            data_inicio_esperada_cliente = p_data_inicio_esperada_cliente,
            prazo_final_eng = p_prazo_final_eng,
            prazo_final_cliente = p_prazo_final_cliente,
            observacoes = p_observacoes
        WHERE eng_projeto_id = p_atribuicao_id
        RETURNING id INTO v_prazo_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Prazos atualizados com sucesso!',
            'prazo_id', v_prazo_id
        );
    ELSE
        -- Insere
        INSERT INTO prazos (
            eng_projeto_id,
            projeto_id,
            eng_id,
            data_inicio_projeto,
            data_inicio_esperada_cliente,
            prazo_final_eng,
            prazo_final_cliente,
            observacoes
        ) VALUES (
            p_atribuicao_id,
            v_projeto_id,
            v_eng_id,
            p_data_inicio_projeto,
            p_data_inicio_esperada_cliente,
            p_prazo_final_eng,
            p_prazo_final_cliente,
            p_observacoes
        ) RETURNING id INTO v_prazo_id;
        
        RETURN json_build_object(
            'sucesso', true,
            'mensagem', 'Prazos criados com sucesso!',
            'prazo_id', v_prazo_id
        );
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao criar/atualizar prazos: ' || SQLERRM
    );
END;
$function$
;

-- funcao: buscar_historico_previsoes(uuid,integer)
CREATE OR REPLACE FUNCTION public.buscar_historico_previsoes(p_atribuicao_id uuid, p_limite integer DEFAULT 30)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'data', data_registro,
            'previsao', previsao_texto,
            'feito', feito_texto,
            'nova_data_prevista', nova_data_prevista,
            'tempo_estimado', tempo_estimado,
            'editavel', editavel
        ) ORDER BY data_registro DESC
    ) INTO v_result
    FROM projetos_previsao
    WHERE eng_projeto_id = p_atribuicao_id
    LIMIT p_limite;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$
;

-- funcao: buscar_historico_retrabalhos(uuid)
CREATE OR REPLACE FUNCTION public.buscar_historico_retrabalhos(p_atribuicao_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'data', data_retrabalho,
            'necessitou', necessitou_retrabalho,
            'motivo', motivo_retrabalho,
            'tipo', tipo_retrabalho,
            'descricao', descricao
        ) ORDER BY data_retrabalho DESC
    ) INTO v_result
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
    AND necessitou_retrabalho = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$
;

-- funcao: calcular_prazos()
CREATE OR REPLACE FUNCTION public.calcular_prazos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.prazo_interno_dias := (NEW.prazo_final_eng - NEW.data_inicio_projeto);
    NEW.prazo_cliente_dias := (NEW.prazo_final_cliente - NEW.data_inicio_projeto);
    RETURN NEW;
END;
$function$
;

-- funcao: dono_distribuir_tarefa(uuid,uuid,text,text,uuid,text,text,text,date,date,text)
CREATE OR REPLACE FUNCTION public.dono_distribuir_tarefa(p_dono_id uuid, p_eng_id uuid, p_area_codigo text, p_descricao_task text, p_projeto_id uuid DEFAULT NULL::uuid, p_codigo_projeto text DEFAULT NULL::text, p_cliente text DEFAULT NULL::text, p_complexidade_codigo text DEFAULT 'MEDIA'::text, p_data_inicio_prevista date DEFAULT NULL::date, p_data_conclusao_prevista date DEFAULT NULL::date, p_observacoes_dono text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_task_id UUID;
    v_area_id UUID;
    v_complexidade_id INTEGER;
    v_eng_nome TEXT;
    v_area_descricao TEXT;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado ou inativo'
        );
    END IF;
    
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado ou inativo'
        );
    END IF;
    
    -- Valida projeto ou código
    IF p_projeto_id IS NULL AND (p_codigo_projeto IS NULL OR p_cliente IS NULL) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Informe projeto_id OU código_projeto + cliente'
        );
    END IF;
    
    -- Busca área
    SELECT area_id, descricao INTO v_area_id, v_area_descricao
    FROM areas
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada: ' || p_area_codigo
        );
    END IF;
    
    -- Busca complexidade
    SELECT complexidade_id INTO v_complexidade_id
    FROM complexidade_tarefas
    WHERE UPPER(codigo) = UPPER(TRIM(p_complexidade_codigo)) AND ativo = true;
    
    IF v_complexidade_id IS NULL THEN
        -- Usa complexidade média como padrão
        SELECT complexidade_id INTO v_complexidade_id
        FROM complexidade_tarefas
        WHERE codigo = 'MEDIA';
    END IF;
    
    -- Busca nome do engenheiro
    SELECT nome INTO v_eng_nome
    FROM engenheiros
    WHERE eng_id = p_eng_id;
    
    -- Insere tarefa (trigger sincronizará automaticamente)
    INSERT INTO evandro_distribuicao_tasks (
        dono_id,
        eng_id,
        projeto_id,
        codigo_projeto,
        cliente,
        area_id,
        complexidade_id,
        descricao_task,
        data_inicio_prevista,
        data_conclusao_prevista,
        observacoes_dono,
        status_task
    ) VALUES (
        p_dono_id,
        p_eng_id,
        p_projeto_id,
        p_codigo_projeto,
        p_cliente,
        v_area_id,
        v_complexidade_id,
        p_descricao_task,
        p_data_inicio_prevista,
        p_data_conclusao_prevista,
        p_observacoes_dono,
        'PENDENTE'
    ) RETURNING task_id INTO v_task_id;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', format('✅ Tarefa distribuída para %s!', v_eng_nome),
        'task_id', v_task_id,
        'engenheiro', v_eng_nome,
        'area', v_area_descricao,
        'detalhes', json_build_object(
            'sincronizado', true,
            'notificacao_whatsapp', 'Será enviada automaticamente',
            'status', 'PENDENTE'
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao distribuir tarefa: ' || SQLERRM
    );
END;
$function$
;

-- funcao: dono_consultar_status_engenheiro(uuid,uuid)
CREATE OR REPLACE FUNCTION public.dono_consultar_status_engenheiro(p_dono_id uuid, p_eng_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Busca detalhes do engenheiro
    SELECT json_build_object(
        'eng_id', eng_id,
        'nome', engenheiro_nome,
        'exclusivo', exclusivo,
        'total_projetos', total_projetos,
        'total_areas', total_areas,
        'media_percentual', media_percentual,
        'areas_ativas', areas_ativas,
        'total_retrabalhos', total_retrabalhos,
        'complexidade_media', complexidade_media,
        'dias_trabalho_pendentes', dias_trabalho_pendentes,
        'areas_atrasadas', areas_atrasadas,
        'projetos', (
            SELECT json_agg(
                json_build_object(
                    'projeto', codigo_projeto,
                    'cliente', cliente,
                    'area', area_descricao,
                    'status', status_descricao,
                    'taxa_execucao', taxa_execucao,
                    'complexidade', complexidade_descricao,
                    'retrabalhos', quantidade_retrabalhos,
                    'dias_atraso', dias_atraso,
                    'prazo_final', prazo_final_eng
                ) ORDER BY taxa_execucao ASC
            )
            FROM vw_dono_engenheiro_detalhado
            WHERE eng_id = p_eng_id
        )
    ) INTO v_result
    FROM vw_dono_visao_geral
    WHERE eng_id = p_eng_id;
    
    IF v_result IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado'
        );
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'dados', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao consultar: ' || SQLERRM
    );
END;
$function$
;

-- funcao: dono_consultar_todos_engenheiros(uuid)
CREATE OR REPLACE FUNCTION public.dono_consultar_todos_engenheiros(p_dono_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    SELECT json_agg(
        json_build_object(
            'eng_id', eng_id,
            'nome', engenheiro_nome,
            'exclusivo', exclusivo,
            'total_projetos', total_projetos,
            'areas_ativas', areas_ativas,
            'media_percentual', media_percentual,
            'total_retrabalhos', total_retrabalhos,
            'complexidade_media', complexidade_media,
            'dias_trabalho_pendentes', dias_trabalho_pendentes,
            'areas_atrasadas', areas_atrasadas,
            'status_carga', CASE
                WHEN dias_trabalho_pendentes > 30 THEN 'SOBRECARREGADO'
                WHEN dias_trabalho_pendentes > 15 THEN 'CARGA_ALTA'
                WHEN dias_trabalho_pendentes > 7 THEN 'CARGA_MEDIA'
                ELSE 'DISPONIVEL'
            END
        ) ORDER BY dias_trabalho_pendentes ASC
    ) INTO v_result
    FROM vw_dono_visao_geral;
    
    RETURN json_build_object(
        'sucesso', true,
        'total_engenheiros', (SELECT COUNT(*) FROM vw_dono_visao_geral),
        'engenheiros', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao consultar: ' || SQLERRM
    );
END;
$function$
;

-- funcao: dono_buscar_historico_retrabalhos(uuid,uuid,uuid,date,date)
CREATE OR REPLACE FUNCTION public.dono_buscar_historico_retrabalhos(p_dono_id uuid, p_eng_id uuid DEFAULT NULL::uuid, p_projeto_id uuid DEFAULT NULL::uuid, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
    v_query TEXT;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Busca histórico
    SELECT json_build_object(
        'total_retrabalhos', COUNT(*),
        'engenheiros_afetados', COUNT(DISTINCT eng_id),
        'projetos_afetados', COUNT(DISTINCT projeto_id),
        'historico', json_agg(
            json_build_object(
                'data', data_retrabalho,
                'engenheiro', engenheiro_nome,
                'projeto', codigo_projeto,
                'area', area_descricao,
                'motivo', motivo_retrabalho,
                'tipo', tipo_retrabalho,
                'status', status_na_epoca
            ) ORDER BY data_retrabalho DESC
        ),
        'por_motivo', (
            SELECT json_agg(
                json_build_object(
                    'motivo', motivo_retrabalho,
                    'quantidade', quantidade
                ) ORDER BY quantidade DESC
            )
            FROM vw_dono_retrabalhos_por_motivo
        )
    ) INTO v_result
    FROM vw_dono_retrabalhos_historico
    WHERE 
        (p_eng_id IS NULL OR eng_id = p_eng_id)
        AND (p_projeto_id IS NULL OR projeto_id = p_projeto_id)
        AND (p_data_inicio IS NULL OR data_retrabalho >= p_data_inicio)
        AND (p_data_fim IS NULL OR data_retrabalho <= p_data_fim);
    
    RETURN json_build_object(
        'sucesso', true,
        'filtros', json_build_object(
            'eng_id', p_eng_id,
            'projeto_id', p_projeto_id,
            'periodo', CASE 
                WHEN p_data_inicio IS NOT NULL OR p_data_fim IS NOT NULL 
                THEN json_build_object('inicio', p_data_inicio, 'fim', p_data_fim)
                ELSE 'todos'
            END
        ),
        'dados', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao buscar retrabalhos: ' || SQLERRM
    );
END;
$function$
;

-- funcao: dono_recomendar_engenheiro(uuid,integer)
CREATE OR REPLACE FUNCTION public.dono_recomendar_engenheiro(p_dono_id uuid, p_complexidade_desejada integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado'
        );
    END IF;
    
    -- Calcula score e recomenda
    SELECT json_agg(
        json_build_object(
            'eng_id', vg.eng_id,
            'nome', vg.engenheiro_nome,
            'exclusivo', vg.exclusivo,
            'score', score,
            'motivo', motivo,
            'carga_atual', vg.dias_trabalho_pendentes || ' dias',
            'taxa_execucao', vr.taxa_execucao_media || '%',
            'total_retrabalhos', vg.total_retrabalhos,
            'areas_atrasadas', vg.areas_atrasadas,
            'status_carga', CASE
                WHEN vg.dias_trabalho_pendentes > 30 THEN 'SOBRECARREGADO'
                WHEN vg.dias_trabalho_pendentes > 15 THEN 'CARGA_ALTA'
                WHEN vg.dias_trabalho_pendentes > 7 THEN 'CARGA_MEDIA'
                ELSE 'DISPONIVEL'
            END
        ) ORDER BY score DESC
    ) INTO v_result
    FROM (
        SELECT 
            vg.eng_id,
            vg.engenheiro_nome,
            vg.exclusivo,
            vg.dias_trabalho_pendentes,
            vg.total_retrabalhos,
            vg.areas_atrasadas,
            -- Score: quanto maior, melhor
            (
                -- Baixa carga de trabalho (+pontos)
                (50 - COALESCE(vg.dias_trabalho_pendentes, 0)) +
                
                -- Alta taxa de execução (+pontos)
                (vr.taxa_execucao_media * 0.5) +
                
                -- Poucos retrabalhos (+pontos)
                (20 - COALESCE(vg.total_retrabalhos, 0)) +
                
                -- Sem atrasos (+pontos)
                (CASE WHEN vg.areas_atrasadas = 0 THEN 20 ELSE 0 END) +
                
                -- Exclusivo (+pontos)
                (CASE WHEN vg.exclusivo = true THEN 10 ELSE 0 END)
            ) AS score,
            
            -- Motivo da recomendação
            CASE 
                WHEN COALESCE(vg.dias_trabalho_pendentes, 0) <= 7 THEN 'Baixa carga de trabalho'
                WHEN vr.taxa_execucao_media >= 70 THEN 'Alta taxa de execução'
                WHEN vg.exclusivo = true THEN 'Engenheiro exclusivo'
                ELSE 'Disponível'
            END AS motivo
            
        FROM vw_dono_visao_geral vg
        LEFT JOIN vw_dono_taxa_execucao_ranking vr ON vr.eng_id = vg.eng_id
    ) AS ranked
    JOIN vw_dono_visao_geral vg ON vg.eng_id = ranked.eng_id
    JOIN vw_dono_taxa_execucao_ranking vr ON vr.eng_id = ranked.eng_id
    LIMIT 5;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Top 5 engenheiros recomendados',
        'complexidade_tarefa', p_complexidade_desejada,
        'recomendacoes', v_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao recomendar: ' || SQLERRM
    );
END;
$function$
;

-- funcao: processar_fila_notificacoes()
CREATE OR REPLACE FUNCTION public.processar_fila_notificacoes()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_notificacoes JSON;
    v_count INTEGER;
BEGIN
    -- Busca notificações pendentes
    SELECT 
        json_agg(
            json_build_object(
                'notificacao_id', notificacao_id,
                'eng_id', eng_id,
                'telefone', telefone,
                'tipo', tipo,
                'titulo', titulo,
                'mensagem', mensagem,
                'task_id', task_id,
                'projeto_id', projeto_id
            )
        ),
        COUNT(*)
    INTO v_notificacoes, v_count
    FROM notificacoes_whatsapp
    WHERE enviada = false
    AND tentativas < 3
    ORDER BY created_at ASC
    LIMIT 50;
    
    RETURN json_build_object(
        'sucesso', true,
        'pendentes', v_count,
        'notificacoes', COALESCE(v_notificacoes, '[]'::json)
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao processar fila: ' || SQLERRM
    );
END;
$function$
;

-- funcao: marcar_notificacao_enviada(uuid,boolean,text)
CREATE OR REPLACE FUNCTION public.marcar_notificacao_enviada(p_notificacao_id uuid, p_sucesso boolean DEFAULT true, p_erro text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF p_sucesso THEN
        UPDATE notificacoes_whatsapp
        SET 
            enviada = true,
            data_envio = NOW()
        WHERE notificacao_id = p_notificacao_id;
        
        -- Atualiza flag na task
        UPDATE evandro_distribuicao_tasks
        SET 
            notificacao_enviada = true,
            data_notificacao = NOW()
        WHERE task_id = (
            SELECT task_id FROM notificacoes_whatsapp 
            WHERE notificacao_id = p_notificacao_id
        );
    ELSE
        UPDATE notificacoes_whatsapp
        SET 
            tentativas = tentativas + 1,
            erro_envio = p_erro
        WHERE notificacao_id = p_notificacao_id;
    END IF;
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE WHEN p_sucesso THEN 'Notificação enviada' ELSE 'Erro registrado' END
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro: ' || SQLERRM
    );
END;
$function$
;

-- funcao: update_updated_at_column()
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- funcao: calcular_tempo_trabalho()
CREATE OR REPLACE FUNCTION public.calcular_tempo_trabalho()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Busca o tempo de trabalho da área e atribui automaticamente
    SELECT tempo_trabalho_dias INTO NEW.tempo_trabalho_dias
    FROM areas
    WHERE area_id = NEW.area_id;
    
    RETURN NEW;
END;
$function$
;

-- funcao: calcular_percentual_status()
CREATE OR REPLACE FUNCTION public.calcular_percentual_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Se o status mudou, atualiza o percentual baseado no status
    IF NEW.status_id IS NOT NULL THEN
        SELECT percentual_base INTO NEW.percentual_andamento
        FROM status_codes
        WHERE status_id = NEW.status_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: validar_motivo_retrabalho()
CREATE OR REPLACE FUNCTION public.validar_motivo_retrabalho()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Se necessitou retrabalho = true, motivo é obrigatório
    IF NEW.necessitou_retrabalho = true THEN
        IF NEW.motivo_retrabalho IS NULL OR TRIM(NEW.motivo_retrabalho) = '' THEN
            RAISE EXCEPTION 'Motivo do retrabalho é obrigatório quando necessitou_retrabalho = TRUE';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: atualizar_status_retrabalho()
CREATE OR REPLACE FUNCTION public.atualizar_status_retrabalho()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Se houve retrabalho, registra o status atual
    IF NEW.necessitou_retrabalho = true THEN
        -- Busca o status atual da atribuição
        SELECT status_id INTO NEW.status_id
        FROM engenheiros_projetos
        WHERE id = NEW.eng_projeto_id;
        
        -- Atualiza a data prevista na atribuição (adiciona 1 dia de atraso)
        UPDATE engenheiros_projetos
        SET data_prevista = data_prevista + INTERVAL '1 day'
        WHERE id = NEW.eng_projeto_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: preencher_variaveis_compartilhadas()
CREATE OR REPLACE FUNCTION public.preencher_variaveis_compartilhadas()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Para projetos_previsao, retrabalho_projetos e prazos
    -- Busca projeto_id e eng_id da atribuição
    IF NEW.eng_projeto_id IS NOT NULL THEN
        SELECT projeto_id, eng_id 
        INTO NEW.projeto_id, NEW.eng_id
        FROM engenheiros_projetos
        WHERE id = NEW.eng_projeto_id;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: listar_tipos_obra()
CREATE OR REPLACE FUNCTION public.listar_tipos_obra()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM tipos_obra
    WHERE ativo = true;
    
    RETURN v_result;
END;
$function$
;

-- funcao: listar_motivos_retrabalho()
CREATE OR REPLACE FUNCTION public.listar_motivos_retrabalho()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao
        ) ORDER BY ordem
    ) INTO v_result
    FROM motivos_retrabalho
    WHERE ativo = true;
    
    RETURN v_result;
END;
$function$
;

-- funcao: gerar_proximo_codigo_projeto()
CREATE OR REPLACE FUNCTION public.gerar_proximo_codigo_projeto()
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_ultimo_numero INTEGER;
    v_proximo_codigo TEXT;
BEGIN
    -- Busca o maior número de projeto existente
    SELECT COALESCE(
        MAX(
            NULLIF(
                regexp_replace(codigo_projeto, '[^0-9]', '', 'g'),
                ''
            )::INTEGER
        ),
        0
    ) INTO v_ultimo_numero
    FROM projetos;
    
    -- Gera próximo código
    v_proximo_codigo := 'PRJ-' || LPAD((v_ultimo_numero + 1)::TEXT, 3, '0');
    
    RETURN v_proximo_codigo;
END;
$function$
;

-- funcao: listar_tipos_projeto_por_area(text)
CREATE OR REPLACE FUNCTION public.listar_tipos_projeto_por_area(p_area_codigo text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', codigo,
            'descricao', descricao,
            'tempo_dias', tempo_trabalho_dias
        ) ORDER BY ordem
    ) INTO v_result
    FROM tipos_projeto
    WHERE area_codigo = p_area_codigo
    AND ativo = true;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$function$
;

-- funcao: listar_tipos_projeto()
CREATE OR REPLACE FUNCTION public.listar_tipos_projeto()
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'codigo', tp.codigo,
            'area', a.descricao,
            'descricao', tp.descricao,
            'tempo_dias', tp.tempo_trabalho_dias
        ) ORDER BY a.codigo, tp.ordem
    ) INTO v_result
    FROM tipos_projeto tp
    JOIN areas a ON a.codigo = tp.area_codigo
    WHERE tp.ativo = true;
    
    RETURN v_result;
END;
$function$
;

-- funcao: sincronizar_task_para_engenheiro()
CREATE OR REPLACE FUNCTION public.sincronizar_task_para_engenheiro()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_eng_projeto_id UUID;
    v_status_id INTEGER;
BEGIN
    IF NEW.sincronizado = false THEN
        IF NEW.projeto_id IS NULL AND NEW.codigo_projeto IS NOT NULL THEN
            INSERT INTO projetos (codigo_projeto, cliente)
            VALUES (NEW.codigo_projeto, NEW.cliente)
            ON CONFLICT (codigo_projeto) DO NOTHING
            RETURNING projeto_id INTO v_projeto_id;

            IF v_projeto_id IS NULL THEN
                SELECT projeto_id INTO v_projeto_id
                FROM projetos
                WHERE codigo_projeto = NEW.codigo_projeto
                LIMIT 1;
            END IF;

            NEW.projeto_id := v_projeto_id;
        ELSE
            v_projeto_id := NEW.projeto_id;
        END IF;

        SELECT status_id INTO v_status_id
        FROM status_codes
        WHERE codigo = 'AGUARDANDO_INICIO'
        LIMIT 1;

        INSERT INTO engenheiros_projetos (
            eng_id,
            projeto_id,
            area_id,
            instancia_label,
            complemento_area_ref_id,
            data_inicio,
            data_prevista,
            status_id,
            atribuido_por
        ) VALUES (
            NEW.eng_id,
            v_projeto_id,
            NEW.area_id,
            NEW.instancia_label,
            NEW.complemento_area_ref_id,
            COALESCE(NEW.data_inicio_prevista, CURRENT_DATE),
            NEW.data_conclusao_prevista,
            v_status_id,
            'Atribuido por: ' || COALESCE(
                (SELECT nome FROM dono_empresa WHERE dono_id = NEW.dono_id),
                'Sistema'
            )
        ) RETURNING id, instancia_label, complemento_area_ref_id
        INTO v_eng_projeto_id, NEW.instancia_label, NEW.complemento_area_ref_id;

        NEW.eng_projeto_id := v_eng_projeto_id;
        NEW.sincronizado := true;
        NEW.data_sincronizacao := NOW();
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: sync_datas_para_prazos()
CREATE OR REPLACE FUNCTION public.sync_datas_para_prazos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Quando data_inicio ou data_prevista mudam em engenheiros_projetos
    -- atualiza as datas correspondentes em prazos
    
    -- IMPORTANTE: Só atualiza se os valores mudaram (evita recursão infinita)
    IF (TG_OP = 'UPDATE' AND 
        (OLD.data_inicio IS DISTINCT FROM NEW.data_inicio OR 
         OLD.data_prevista IS DISTINCT FROM NEW.data_prevista)) OR
       TG_OP = 'INSERT' THEN
        
        IF EXISTS (SELECT 1 FROM prazos WHERE eng_projeto_id = NEW.id) THEN
            UPDATE prazos
            SET 
                data_inicio_projeto = NEW.data_inicio,
                prazo_final_eng = NEW.data_prevista,
                updated_at = NOW()
            WHERE eng_projeto_id = NEW.id
            -- Só atualiza se realmente mudou (evita trigger em loop)
            AND (data_inicio_projeto IS DISTINCT FROM NEW.data_inicio OR
                 prazo_final_eng IS DISTINCT FROM NEW.data_prevista);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: sync_datas_de_prazos()
CREATE OR REPLACE FUNCTION public.sync_datas_de_prazos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Quando data_inicio_projeto ou prazo_final_eng mudam em prazos
    -- atualiza as datas correspondentes em engenheiros_projetos
    
    -- IMPORTANTE: Só atualiza se os valores mudaram (evita recursão infinita)
    IF (TG_OP = 'UPDATE' AND 
        (OLD.data_inicio_projeto IS DISTINCT FROM NEW.data_inicio_projeto OR 
         OLD.prazo_final_eng IS DISTINCT FROM NEW.prazo_final_eng)) OR
       TG_OP = 'INSERT' THEN
        
        UPDATE engenheiros_projetos
        SET 
            data_inicio = NEW.data_inicio_projeto,
            data_prevista = NEW.prazo_final_eng,
            updated_at = NOW()
        WHERE id = NEW.eng_projeto_id
        -- Só atualiza se realmente mudou (evita trigger em loop)
        AND (data_inicio IS DISTINCT FROM NEW.data_inicio_projeto OR
             data_prevista IS DISTINCT FROM NEW.prazo_final_eng);
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: auto_preencher_data_conclusao()
CREATE OR REPLACE FUNCTION public.auto_preencher_data_conclusao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_status_codigo TEXT;
BEGIN
    -- Busca o código do status
    SELECT codigo INTO v_status_codigo
    FROM status_codes
    WHERE status_id = NEW.status_id;
    
    -- Se o status foi alterado para CONCLUIDO e data_conclusao está vazia
    IF v_status_codigo = 'CONCLUIDO' AND NEW.data_conclusao IS NULL THEN
        NEW.data_conclusao := CURRENT_DATE;
    END IF;
    
    -- Se o status foi alterado de CONCLUIDO para outro, limpa data_conclusao
    IF v_status_codigo != 'CONCLUIDO' AND OLD.status_id IS NOT NULL THEN
        DECLARE
            v_old_status_codigo TEXT;
        BEGIN
            SELECT codigo INTO v_old_status_codigo
            FROM status_codes
            WHERE status_id = OLD.status_id;
            
            IF v_old_status_codigo = 'CONCLUIDO' THEN
                NEW.data_conclusao := NULL;
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$function$
;

-- funcao: dono_distribuir_projeto_com_prazos(uuid,uuid,uuid,text,date,date,date,date,text)
CREATE OR REPLACE FUNCTION public.dono_distribuir_projeto_com_prazos(p_dono_id uuid, p_eng_id uuid, p_projeto_id uuid, p_area_codigo text, p_data_inicio date, p_prazo_final_eng date, p_prazo_final_cliente date, p_data_inicio_esperada_cliente date DEFAULT NULL::date, p_observacoes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_area_id UUID;
    v_status_id INTEGER;
    v_eng_projeto_id UUID;
    v_prazo_id UUID;
    v_eng_nome TEXT;
    v_area_descricao TEXT;
    v_codigo_projeto TEXT;
BEGIN
    -- Valida dono
    IF NOT EXISTS (SELECT 1 FROM dono_empresa WHERE dono_id = p_dono_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Dono não encontrado ou inativo'
        );
    END IF;
    
    -- Valida engenheiro
    IF NOT EXISTS (SELECT 1 FROM engenheiros WHERE eng_id = p_eng_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro não encontrado ou inativo'
        );
    END IF;
    
    -- Valida projeto
    IF NOT EXISTS (SELECT 1 FROM projetos WHERE projeto_id = p_projeto_id AND ativo = true) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Projeto não encontrado ou inativo'
        );
    END IF;
    
    -- Valida datas
    IF p_prazo_final_eng < p_data_inicio THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Prazo final do engenheiro deve ser maior ou igual à data de início'
        );
    END IF;
    
    IF p_prazo_final_cliente < p_prazo_final_eng THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Prazo final do cliente deve ser maior ou igual ao prazo interno'
        );
    END IF;
    
    -- Busca área
    SELECT area_id, descricao INTO v_area_id, v_area_descricao
    FROM areas
    WHERE UPPER(codigo) = UPPER(TRIM(p_area_codigo)) AND ativo = true;
    
    IF v_area_id IS NULL THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Área não encontrada: ' || p_area_codigo
        );
    END IF;
    
    -- Busca dados complementares
    SELECT nome INTO v_eng_nome FROM engenheiros WHERE eng_id = p_eng_id;
    SELECT codigo_projeto INTO v_codigo_projeto FROM projetos WHERE projeto_id = p_projeto_id;
    
    -- Busca status inicial
    SELECT status_id INTO v_status_id
    FROM status_codes
    WHERE codigo = 'AGUARDANDO_INICIO'
    LIMIT 1;
    
    -- Verifica duplicidade
    IF EXISTS (
        SELECT 1 FROM engenheiros_projetos 
        WHERE eng_id = p_eng_id 
        AND projeto_id = p_projeto_id 
        AND area_id = v_area_id 
        AND ativo = true
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro já está atribuído a esta área neste projeto'
        );
    END IF;
    
    -- 1. Cria atribuição em engenheiros_projetos
    INSERT INTO engenheiros_projetos (
        eng_id,
        projeto_id,
        area_id,
        data_inicio,
        data_prevista,
        status_id,
        observacoes
    ) VALUES (
        p_eng_id,
        p_projeto_id,
        v_area_id,
        p_data_inicio,
        p_prazo_final_eng,
        v_status_id,
        p_observacoes
    ) RETURNING id INTO v_eng_projeto_id;
    
    -- 2. Cria registro de prazos (triggers calcularão prazo_interno_dias e prazo_cliente_dias)
    INSERT INTO prazos (
        eng_projeto_id,
        projeto_id,
        eng_id,
        data_inicio_projeto,
        data_inicio_esperada_cliente,
        prazo_final_eng,
        prazo_final_cliente,
        observacoes
    ) VALUES (
        v_eng_projeto_id,
        p_projeto_id,
        p_eng_id,
        p_data_inicio,
        p_data_inicio_esperada_cliente,
        p_prazo_final_eng,
        p_prazo_final_cliente,
        p_observacoes
    ) RETURNING id INTO v_prazo_id;
    
    -- 3. Registra em evandro_distribuicao_tasks
    INSERT INTO evandro_distribuicao_tasks (
        dono_id,
        eng_id,
        projeto_id,
        area_id,
        eng_projeto_id,
        descricao_task,
        data_inicio_prevista,
        data_conclusao_prevista,
        observacoes_dono,
        status_task,
        sincronizado,
        data_sincronizacao
    ) VALUES (
        p_dono_id,
        p_eng_id,
        p_projeto_id,
        v_area_id,
        v_eng_projeto_id,
        'Projeto distribuído com prazos definidos',
        p_data_inicio,
        p_prazo_final_cliente,
        p_observacoes,
        'CONCLUIDO', -- Já está sincronizado
        true,
        NOW()
    );
    
    -- 4. Cria notificação WhatsApp
    INSERT INTO notificacoes_whatsapp (
        eng_id,
        telefone,
        tipo,
        titulo,
        mensagem,
        projeto_id
    ) VALUES (
        p_eng_id,
        (SELECT telefone FROM engenheiros WHERE eng_id = p_eng_id),
        'NOVA_TAREFA',
        '🆕 Novo Projeto Atribuído!',
        '📋 Projeto: ' || v_codigo_projeto || 
        E'\n📦 Área: ' || v_area_descricao ||
        E'\n📅 Início: ' || p_data_inicio ||
        E'\n⏰ Prazo interno: ' || p_prazo_final_eng ||
        E'\n📆 Prazo cliente: ' || p_prazo_final_cliente,
        p_projeto_id
    );
    
    RETURN json_build_object(
        'sucesso', true,
        'mensagem', format('✅ Projeto distribuído para %s com prazos cadastrados!', v_eng_nome),
        'eng_projeto_id', v_eng_projeto_id,
        'prazo_id', v_prazo_id,
        'detalhes', json_build_object(
            'engenheiro', v_eng_nome,
            'projeto', v_codigo_projeto,
            'area', v_area_descricao,
            'data_inicio', p_data_inicio,
            'prazo_eng', p_prazo_final_eng,
            'prazo_cliente', p_prazo_final_cliente
        )
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao distribuir projeto: ' || SQLERRM
    );
END;
$function$
;

-- funcao: notificar_novo_projeto()
CREATE OR REPLACE FUNCTION public.notificar_novo_projeto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_eng_telefone VARCHAR(20);
    v_eng_nome VARCHAR(255);
    v_projeto_codigo VARCHAR(50);
    v_cliente VARCHAR(255);
    v_descricao TEXT;
    v_area_desc VARCHAR(255);
    v_mensagem TEXT;
BEGIN
    SELECT
        e.telefone, e.nome, p.codigo_projeto, p.cliente, p.descricao, a.descricao
    INTO
        v_eng_telefone, v_eng_nome, v_projeto_codigo, v_cliente, v_descricao, v_area_desc
    FROM engenheiros e
    JOIN projetos p ON p.projeto_id = NEW.projeto_id
    JOIN areas a ON a.area_id = NEW.area_id
    WHERE e.eng_id = NEW.eng_id;

    v_eng_nome := SPLIT_PART(v_eng_nome, ' ', 1);

    v_mensagem := '🎯 *Novo Projeto Atribuído!*' || E'\n\n';
    v_mensagem := v_mensagem || 'Olá ' || v_eng_nome || '!' || E'\n\n';
    v_mensagem := v_mensagem || '📋 *Projeto:* ' || v_projeto_codigo || E'\n';
    v_mensagem := v_mensagem || '👤 *Cliente:* ' || v_cliente || E'\n';
    IF v_descricao IS NOT NULL THEN
        v_mensagem := v_mensagem || '📝 *Descrição:* ' || v_descricao || E'\n';
    END IF;
    v_mensagem := v_mensagem || '📦 *Área:* ' || v_area_desc || E'\n\n';
    IF NEW.data_inicio IS NOT NULL THEN
        v_mensagem := v_mensagem || '📅 *Início:* ' || TO_CHAR(NEW.data_inicio, 'DD/MM/YYYY') || E'\n';
    END IF;
    IF NEW.data_prevista IS NOT NULL THEN
        v_mensagem := v_mensagem || '⏰ *Prazo:* ' || TO_CHAR(NEW.data_prevista, 'DD/MM/YYYY') || E'\n';
    END IF;
    v_mensagem := v_mensagem || E'\n';
    v_mensagem := v_mensagem || '_Digite "menu" para visualizar os detalhes_';

    INSERT INTO notificacoes_whatsapp (
        eng_id, telefone, tipo, titulo, mensagem, projeto_id, eng_projeto_id, enviada, data_agendamento
    ) VALUES (
        NEW.eng_id, v_eng_telefone, 'novo_projeto', 'Novo Projeto Atribuído',
        v_mensagem, NEW.projeto_id, NEW.id, false, NOW()
    );

    RAISE NOTICE 'Notificação criada para engenheiro % - Projeto %', v_eng_nome, v_projeto_codigo;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao criar notificação de novo projeto: %', SQLERRM;
        RETURN NEW;
END;
$function$
;

-- funcao: calcular_progresso_ponderado(uuid)
CREATE OR REPLACE FUNCTION public.calcular_progresso_ponderado(p_projeto_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_progresso NUMERIC(5,2) := 0.00;
    v_contrib_pavimentos NUMERIC := 0.00;
    v_contrib_globais NUMERIC := 0.00;
    v_pav RECORD;
    v_progresso_interno NUMERIC;
BEGIN
    -- Contribuição dos pavimentos
    FOR v_pav IN
        SELECT pavimento_id, peso
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id AND ativo = true
    LOOP
        -- Soma dos pesos das etapas concluídas dentro deste pavimento
        SELECT COALESCE(SUM(peso), 0.00)
        INTO v_progresso_interno
        FROM pavimento_etapas
        WHERE pavimento_id = v_pav.pavimento_id
            AND concluida = true
            AND ativo = true;

        v_contrib_pavimentos := v_contrib_pavimentos
            + (v_pav.peso * v_progresso_interno / 100.00);
    END LOOP;

    -- Contribuição das etapas globais concluídas
    SELECT COALESCE(SUM(peso), 0.00)
    INTO v_contrib_globais
    FROM projeto_etapas_globais
    WHERE projeto_id = p_projeto_id
        AND concluida = true
        AND ativo = true;

    v_progresso := v_contrib_pavimentos + v_contrib_globais;

    -- Limita entre 0 e 100
    IF v_progresso > 100.00 THEN
        v_progresso := 100.00;
    ELSIF v_progresso < 0.00 THEN
        v_progresso := 0.00;
    END IF;

    RETURN ROUND(v_progresso, 2);
END;
$function$
;

-- funcao: atualizar_percentual_ponderado()
CREATE OR REPLACE FUNCTION public.atualizar_percentual_ponderado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'pavimento_etapas' THEN
        SELECT pp.projeto_id INTO v_projeto_id
        FROM projeto_pavimentos pp
        WHERE pp.pavimento_id = COALESCE(NEW.pavimento_id, OLD.pavimento_id);
    ELSIF TG_TABLE_NAME = 'projeto_etapas_globais' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
    ELSIF TG_TABLE_NAME = 'projeto_pavimentos' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
    END IF;

    IF v_projeto_id IS NOT NULL THEN
        UPDATE projetos
        SET percentual_ponderado = calcular_progresso_ponderado(v_projeto_id)
        WHERE projeto_id = v_projeto_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$function$
;

-- funcao: auto_data_conclusao_etapa()
CREATE OR REPLACE FUNCTION public.auto_data_conclusao_etapa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Preenche data_conclusao ao marcar como concluída
    IF NEW.concluida = true AND (OLD.concluida = false OR OLD.concluida IS NULL) THEN
        NEW.data_conclusao := COALESCE(NEW.data_conclusao, CURRENT_DATE);
    END IF;

    -- Limpa data_conclusao ao desmarcar
    IF NEW.concluida = false AND OLD.concluida = true THEN
        NEW.data_conclusao := NULL;
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: trg_seed_on_atribuicao()
CREATE OR REPLACE FUNCTION public.trg_seed_on_atribuicao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.area_id IS NOT NULL AND NEW.ativo = true THEN
        PERFORM seed_pavimentos_etapas(NEW.projeto_id, NEW.area_id, NEW.id);
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: sync_conclusao_por_ponderado()
CREATE OR REPLACE FUNCTION public.sync_conclusao_por_ponderado()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF COALESCE(NEW.percentual_ponderado, 0) >= 100 THEN
        UPDATE engenheiros_projetos
        SET data_conclusao = COALESCE(data_conclusao, CURRENT_DATE),
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = NEW.projeto_id
          AND ativo = true
          AND data_conclusao IS NULL;
    ELSE
        UPDATE engenheiros_projetos
        SET data_conclusao = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = NEW.projeto_id
          AND ativo = true
          AND data_conclusao IS NOT NULL;
    END IF;
    RETURN NEW;
END;
$function$
;

-- funcao: marcar_projeto_concluido(uuid,boolean)
CREATE OR REPLACE FUNCTION public.marcar_projeto_concluido(p_projeto_id uuid, p_concluido boolean DEFAULT true)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pct NUMERIC(5,2);
BEGIN
    v_pct := CASE WHEN p_concluido THEN 100.00 ELSE 0.00 END;
    UPDATE projetos
    SET percentual_ponderado = v_pct
    WHERE projeto_id = p_projeto_id;
    RETURN v_pct;
END;
$function$
;

-- funcao: recalcular_rollup_projeto(uuid)
CREATE OR REPLACE FUNCTION public.recalcular_rollup_projeto(p_projeto_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_avg NUMERIC(5,2);
BEGIN
    SELECT COALESCE(ROUND(AVG(COALESCE(percentual_ponderado, 0)), 2), 0) INTO v_avg
    FROM engenheiros_projetos
    WHERE projeto_id = p_projeto_id
      AND ativo = true;

    UPDATE projetos
    SET percentual_ponderado = v_avg
    WHERE projeto_id = p_projeto_id;
END;
$function$
;

-- funcao: atualizar_progresso_area()
CREATE OR REPLACE FUNCTION public.atualizar_progresso_area()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_area_id UUID;
    v_eng_projeto_id UUID;
    v_pct NUMERIC(5,2);
BEGIN
    IF TG_TABLE_NAME = 'pavimento_etapas' THEN
        SELECT pp.projeto_id, pp.area_id, pp.eng_projeto_id
        INTO v_projeto_id, v_area_id, v_eng_projeto_id
        FROM projeto_pavimentos pp
        WHERE pp.pavimento_id = COALESCE(NEW.pavimento_id, OLD.pavimento_id);
    ELSIF TG_TABLE_NAME = 'projeto_etapas_globais' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
        v_area_id := COALESCE(NEW.area_id, OLD.area_id);
        v_eng_projeto_id := COALESCE(NEW.eng_projeto_id, OLD.eng_projeto_id);
    ELSIF TG_TABLE_NAME = 'projeto_pavimentos' THEN
        v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
        v_area_id := COALESCE(NEW.area_id, OLD.area_id);
        v_eng_projeto_id := COALESCE(NEW.eng_projeto_id, OLD.eng_projeto_id);
    END IF;

    IF v_projeto_id IS NOT NULL AND v_area_id IS NOT NULL THEN
        v_pct := calcular_progresso_area(v_projeto_id, v_area_id, v_eng_projeto_id);

        IF v_eng_projeto_id IS NOT NULL THEN
            UPDATE engenheiros_projetos
            SET percentual_ponderado = v_pct,
                data_conclusao = CASE WHEN v_pct >= 100 THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE projeto_id = v_projeto_id
              AND area_id = v_area_id
              AND id = v_eng_projeto_id
              AND ativo = true;
        ELSE
            UPDATE engenheiros_projetos
            SET percentual_ponderado = v_pct,
                data_conclusao = CASE WHEN v_pct >= 100 THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
            WHERE projeto_id = v_projeto_id
              AND area_id = v_area_id
              AND ativo = true;
        END IF;

        PERFORM recalcular_rollup_projeto(v_projeto_id);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: limpar_projetos_finalizados_antigos(integer,boolean)
CREATE OR REPLACE FUNCTION public.limpar_projetos_finalizados_antigos(p_meses integer DEFAULT 6, p_dry_run boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_data_limite DATE;
    v_projeto_ids UUID[];
    v_candidatos INTEGER;
    v_excluidos INTEGER := 0;
BEGIN
    IF p_meses IS NULL OR p_meses < 1 THEN
        RAISE EXCEPTION 'p_meses deve ser maior ou igual a 1';
    END IF;

    v_data_limite := (CURRENT_DATE - make_interval(months => p_meses))::DATE;

    SELECT COALESCE(array_agg(projeto_id), ARRAY[]::UUID[])
    INTO v_projeto_ids
    FROM (
        SELECT
            p.projeto_id,
            MAX(ep.data_conclusao) AS ultima_conclusao
        FROM projetos p
        JOIN engenheiros_projetos ep
            ON ep.projeto_id = p.projeto_id
           AND ep.ativo = true
        WHERE p.ativo = true
        GROUP BY p.projeto_id
        HAVING
            COUNT(*) > 0
            AND BOOL_AND(COALESCE(ep.percentual_ponderado, 0) >= 100)
            AND MAX(ep.data_conclusao) IS NOT NULL
            AND MAX(ep.data_conclusao)::DATE <= v_data_limite
    ) candidatos;

    v_candidatos := COALESCE(array_length(v_projeto_ids, 1), 0);

    IF p_dry_run OR v_candidatos = 0 THEN
        RETURN jsonb_build_object(
            'dry_run', p_dry_run,
            'meses_retencao', p_meses,
            'data_limite', v_data_limite,
            'projetos_candidatos', v_candidatos,
            'projetos_excluidos', 0
        );
    END IF;

    DELETE FROM notificacoes_whatsapp
    WHERE projeto_id = ANY(v_projeto_ids)
       OR task_id IN (
            SELECT task_id
            FROM evandro_distribuicao_tasks
            WHERE projeto_id = ANY(v_projeto_ids)
       );

    DELETE FROM projetos_previsao
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM retrabalho_projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM prazos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM evandro_distribuicao_tasks
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM projeto_etapas_globais
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM pavimento_etapas
    WHERE pavimento_id IN (
        SELECT pavimento_id
        FROM projeto_pavimentos
        WHERE projeto_id = ANY(v_projeto_ids)
    );

    DELETE FROM projeto_pavimentos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM engenheiros_projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    DELETE FROM projetos
    WHERE projeto_id = ANY(v_projeto_ids);

    GET DIAGNOSTICS v_excluidos = ROW_COUNT;

    RETURN jsonb_build_object(
        'dry_run', false,
        'meses_retencao', p_meses,
        'data_limite', v_data_limite,
        'projetos_candidatos', v_candidatos,
        'projetos_excluidos', v_excluidos
    );
END;
$function$
;

-- funcao: normalizar_label_compatibilizacao(text,integer)
CREATE OR REPLACE FUNCTION public.normalizar_label_compatibilizacao(p_label text, p_fallback_numero integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    v_label TEXT;
BEGIN
    v_label := btrim(regexp_replace(COALESCE(p_label, ''), '\s+', ' ', 'g'));

    IF v_label = '' THEN
        RETURN 'Compatibilização ' || p_fallback_numero;
    END IF;

    IF lower(v_label) LIKE lower('Compatibilização') || '%' THEN
        RETURN v_label;
    END IF;

    RETURN 'Compatibilização ' || v_label;
END;
$function$
;

-- funcao: validar_instancia_engenheiros_projetos()
CREATE OR REPLACE FUNCTION public.validar_instancia_engenheiros_projetos()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_area_codigo TEXT;
    v_complemento_area_descricao TEXT;
    v_fallback_numero INTEGER;
BEGIN
    IF COALESCE(NEW.ativo, true) = false THEN
        RETURN NEW;
    END IF;

    SELECT codigo INTO v_area_codigo
    FROM areas
    WHERE area_id = NEW.area_id;

    -- Disciplinas multi-instancia: v_area_codigo IN ('COMPATIBILIZACAO', 'COMPLEMENTO')
    IF v_area_codigo = 'COMPATIBILIZACAO' THEN
        NEW.complemento_area_ref_id := NULL;

        SELECT COUNT(*) + 1 INTO v_fallback_numero
        FROM engenheiros_projetos
        WHERE projeto_id = NEW.projeto_id
          AND area_id = NEW.area_id
          AND ativo = true
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

        NEW.instancia_label := normalizar_label_compatibilizacao(
            NEW.instancia_label,
            v_fallback_numero
        );

        IF EXISTS (
            SELECT 1
            FROM engenheiros_projetos ep
            WHERE ep.projeto_id = NEW.projeto_id
              AND ep.area_id = NEW.area_id
              AND ep.ativo = true
              AND ep.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
              AND lower(ep.instancia_label) = lower(NEW.instancia_label)
        ) THEN
            RAISE EXCEPTION 'Ja existe uma compatibilizacao com esta identificacao neste projeto';
        END IF;
    ELSIF v_area_codigo = 'COMPLEMENTO' THEN
        IF NEW.complemento_area_ref_id IS NULL THEN
            RAISE EXCEPTION 'Informe a disciplina que este complemento se refere';
        END IF;

        IF NEW.complemento_area_ref_id = NEW.area_id THEN
            RAISE EXCEPTION 'Complemento nao pode referenciar Complemento';
        END IF;

        SELECT descricao INTO v_complemento_area_descricao
        FROM areas
        WHERE area_id = NEW.complemento_area_ref_id
          AND ativo = true;

        IF v_complemento_area_descricao IS NULL THEN
            RAISE EXCEPTION 'Disciplina de referencia do complemento nao encontrada ou inativa';
        END IF;

        SELECT COUNT(*) + 1 INTO v_fallback_numero
        FROM engenheiros_projetos ep
        WHERE ep.projeto_id = NEW.projeto_id
          AND ep.area_id = NEW.area_id
          AND ep.complemento_area_ref_id = NEW.complemento_area_ref_id
          AND ep.ativo = true
          AND ep.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

        NEW.instancia_label := 'Complemento de ' || v_complemento_area_descricao || ' ' || v_fallback_numero;

        IF EXISTS (
            SELECT 1
            FROM engenheiros_projetos ep
            WHERE ep.projeto_id = NEW.projeto_id
              AND ep.area_id = NEW.area_id
              AND ep.ativo = true
              AND ep.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
              AND lower(ep.instancia_label) = lower(NEW.instancia_label)
        ) THEN
            RAISE EXCEPTION 'Ja existe um complemento com esta identificacao neste projeto';
        END IF;
    ELSE
        NEW.instancia_label := NULL;
        NEW.complemento_area_ref_id := NULL;

        IF EXISTS (
            SELECT 1
            FROM engenheiros_projetos ep
            WHERE ep.eng_id = NEW.eng_id
              AND ep.projeto_id = NEW.projeto_id
              AND ep.area_id = NEW.area_id
              AND ep.ativo = true
              AND ep.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        ) THEN
            RAISE EXCEPTION 'Engenheiro ja esta atribuido a esta disciplina neste projeto';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: transferir_atribuicao(uuid,uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.transferir_atribuicao(p_atribuicao_id uuid, p_novo_eng_id uuid, p_origem text DEFAULT 'sistema'::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_area_id UUID;
    v_eng_antigo_id UUID;
    v_instancia_label TEXT;
    v_area_codigo TEXT;
    v_codigo_projeto TEXT;
    v_eng_antigo_nome TEXT;
    v_eng_novo_nome TEXT;
    v_tasks_atualizadas INTEGER := 0;
BEGIN
    SELECT
        ep.projeto_id,
        ep.area_id,
        ep.eng_id,
        ep.instancia_label,
        a.codigo,
        p.codigo_projeto,
        e.nome
    INTO
        v_projeto_id,
        v_area_id,
        v_eng_antigo_id,
        v_instancia_label,
        v_area_codigo,
        v_codigo_projeto,
        v_eng_antigo_nome
    FROM engenheiros_projetos ep
    JOIN areas a ON a.area_id = ep.area_id
    JOIN projetos p ON p.projeto_id = ep.projeto_id
    LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
    WHERE ep.id = p_atribuicao_id
      AND ep.ativo = true
    LIMIT 1;

    IF v_projeto_id IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrada',
            'mensagem', 'Tarefa nao encontrada ou ja excluida.'
        );
    END IF;

    IF p_novo_eng_id = v_eng_antigo_id THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'mesmo_engenheiro',
            'mensagem', 'O engenheiro destino ja e o responsavel atual.'
        );
    END IF;

    SELECT nome INTO v_eng_novo_nome
    FROM engenheiros
    WHERE eng_id = p_novo_eng_id
      AND ativo = true
    LIMIT 1;

    IF v_eng_novo_nome IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'destino_invalido',
            'mensagem', 'Engenheiro destino nao encontrado ou inativo.'
        );
    END IF;

    IF EXISTS (
        SELECT 1
        FROM engenheiros_projetos ep
        WHERE ep.eng_id = p_novo_eng_id
          AND ep.projeto_id = v_projeto_id
          AND ep.area_id = v_area_id
          AND ep.ativo = true
          AND ep.id <> p_atribuicao_id
          AND (
              v_area_codigo <> 'COMPATIBILIZACAO'
              OR COALESCE(ep.instancia_label, '') = COALESCE(v_instancia_label, '')
          )
    ) THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'duplicata',
            'mensagem', 'O engenheiro destino ja possui essa mesma tarefa neste projeto.'
        );
    END IF;

    UPDATE engenheiros_projetos
    SET
        eng_id = p_novo_eng_id,
        updated_at = NOW()
    WHERE id = p_atribuicao_id
      AND ativo = true;

    UPDATE evandro_distribuicao_tasks
    SET
        eng_id = p_novo_eng_id,
        updated_at = NOW()
    WHERE eng_projeto_id = p_atribuicao_id
      AND ativo = true;

    GET DIAGNOSTICS v_tasks_atualizadas = ROW_COUNT;

    RETURN json_build_object(
        'ok', true,
        'codigo', 'transferida',
        'mensagem', 'Responsavel alterado com sucesso.',
        'atribuicao_id', p_atribuicao_id,
        'projeto_id', v_projeto_id,
        'codigo_projeto', v_codigo_projeto,
        'area_id', v_area_id,
        'area_codigo', v_area_codigo,
        'instancia_label', v_instancia_label,
        'eng_antigo_id', v_eng_antigo_id,
        'eng_antigo_nome', v_eng_antigo_nome,
        'eng_novo_id', p_novo_eng_id,
        'eng_novo_nome', v_eng_novo_nome,
        'tasks_atualizadas', v_tasks_atualizadas,
        'origem', p_origem,
        'actor_user_id', p_actor_user_id
    );
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'duplicata',
            'mensagem', 'O engenheiro destino ja possui essa mesma tarefa neste projeto.'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'erro_interno',
            'mensagem', 'Erro ao transferir tarefa: ' || SQLERRM
        );
END;
$function$
;

-- funcao: desativar_atribuicao(uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.desativar_atribuicao(p_atribuicao_id uuid, p_origem text DEFAULT 'sistema'::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_area_id UUID;
    v_eng_id UUID;
    v_codigo_projeto TEXT;
    v_area_codigo TEXT;
    v_area_descricao TEXT;
    v_eng_nome TEXT;
    v_total_areas_ativas INTEGER := 0;
    v_tasks_atualizadas INTEGER := 0;
BEGIN
    SELECT
        ep.projeto_id,
        ep.area_id,
        ep.eng_id,
        p.codigo_projeto,
        a.codigo,
        a.descricao,
        e.nome
    INTO
        v_projeto_id,
        v_area_id,
        v_eng_id,
        v_codigo_projeto,
        v_area_codigo,
        v_area_descricao,
        v_eng_nome
    FROM engenheiros_projetos ep
    JOIN projetos p ON p.projeto_id = ep.projeto_id
    JOIN areas a ON a.area_id = ep.area_id
    LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
    WHERE ep.id = p_atribuicao_id
      AND ep.ativo = true
    LIMIT 1;

    IF v_projeto_id IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrada',
            'mensagem', 'Tarefa nao encontrada ou ja excluida.'
        );
    END IF;

    SELECT COUNT(*) INTO v_total_areas_ativas
    FROM engenheiros_projetos
    WHERE projeto_id = v_projeto_id
      AND ativo = true;

    IF v_total_areas_ativas <= 1 THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'ultima_area',
            'mensagem', 'Nao e possivel excluir a ultima disciplina ativa do projeto.'
        );
    END IF;

    UPDATE engenheiros_projetos
    SET
        ativo = false,
        updated_at = NOW()
    WHERE id = p_atribuicao_id
      AND ativo = true;

    UPDATE evandro_distribuicao_tasks
    SET
        ativo = false,
        updated_at = NOW()
    WHERE eng_projeto_id = p_atribuicao_id
      AND ativo = true;

    GET DIAGNOSTICS v_tasks_atualizadas = ROW_COUNT;

    RETURN json_build_object(
        'ok', true,
        'codigo', 'desativada',
        'mensagem', 'Tarefa excluida com sucesso.',
        'atribuicao_id', p_atribuicao_id,
        'projeto_id', v_projeto_id,
        'codigo_projeto', v_codigo_projeto,
        'area_id', v_area_id,
        'area_codigo', v_area_codigo,
        'area_descricao', v_area_descricao,
        'eng_id', v_eng_id,
        'engenheiro_nome', v_eng_nome,
        'tasks_atualizadas', v_tasks_atualizadas,
        'origem', p_origem,
        'actor_user_id', p_actor_user_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'ok', false,
        'codigo', 'erro_interno',
        'mensagem', 'Erro ao excluir tarefa: ' || SQLERRM
    );
END;
$function$
;

-- funcao: notificar_task_criada()
CREATE OR REPLACE FUNCTION public.notificar_task_criada()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_telefone TEXT;
    v_codigo_projeto TEXT;
    v_area_label TEXT;
BEGIN
    IF NEW.sincronizado = true THEN
        SELECT telefone INTO v_telefone
        FROM engenheiros
        WHERE eng_id = NEW.eng_id;

        SELECT codigo_projeto INTO v_codigo_projeto
        FROM projetos
        WHERE projeto_id = NEW.projeto_id;

        SELECT COALESCE(NEW.instancia_label, a.descricao) INTO v_area_label
        FROM areas a
        WHERE a.area_id = NEW.area_id;

        INSERT INTO notificacoes_whatsapp (
            eng_id,
            telefone,
            tipo,
            titulo,
            mensagem,
            task_id,
            projeto_id
        ) VALUES (
            NEW.eng_id,
            v_telefone,
            'NOVA_TAREFA',
            'Nova Tarefa Atribuida!',
            'Projeto: ' || COALESCE(NEW.codigo_projeto, v_codigo_projeto, 'N/A') ||
            E'\nArea: ' || COALESCE(v_area_label, 'Nao definido') ||
            E'\nDescricao: ' || NEW.descricao_task ||
            E'\nInicio previsto: ' || COALESCE(NEW.data_inicio_prevista::TEXT, 'Nao definido') ||
            E'\nConclusao prevista: ' || COALESCE(NEW.data_conclusao_prevista::TEXT, 'Nao definido'),
            NEW.task_id,
            NEW.projeto_id
        );
    END IF;

    RETURN NEW;
END;
$function$
;

-- funcao: desativar_projeto_completo(uuid,text,uuid)
CREATE OR REPLACE FUNCTION public.desativar_projeto_completo(p_projeto_id uuid, p_origem text DEFAULT 'sistema'::text, p_actor_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_codigo_projeto TEXT;
    v_projeto_ativo BOOLEAN;
    v_atribuicoes_desativadas INTEGER := 0;
    v_tasks_desativadas INTEGER := 0;
    v_notificacoes_canceladas INTEGER := 0;
BEGIN
    SELECT codigo_projeto, ativo INTO v_codigo_projeto, v_projeto_ativo
    FROM projetos
    WHERE projeto_id = p_projeto_id
    FOR UPDATE;

    IF v_codigo_projeto IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrado',
            'mensagem', 'Projeto nao encontrado.'
        );
    END IF;

    UPDATE projetos
    SET
        ativo = false,
        updated_at = NOW()
    WHERE projeto_id = p_projeto_id
      AND ativo = true;

    UPDATE engenheiros_projetos
    SET
        ativo = false,
        updated_at = NOW()
    WHERE projeto_id = p_projeto_id
      AND ativo = true;
    GET DIAGNOSTICS v_atribuicoes_desativadas = ROW_COUNT;

    UPDATE evandro_distribuicao_tasks
    SET
        ativo = false,
        updated_at = NOW()
    WHERE projeto_id = p_projeto_id
      AND ativo = true;
    GET DIAGNOSTICS v_tasks_desativadas = ROW_COUNT;

    UPDATE notificacoes_whatsapp
    SET
        enviada = true,
        data_envio = COALESCE(data_envio, NOW()),
        erro_envio = COALESCE(erro_envio, 'Cancelada por exclusao do projeto')
    WHERE projeto_id = p_projeto_id
      AND enviada = false;
    GET DIAGNOSTICS v_notificacoes_canceladas = ROW_COUNT;

    RETURN json_build_object(
        'ok', true,
        'codigo', CASE WHEN v_projeto_ativo THEN 'desativado' ELSE 'ja_inativo' END,
        'mensagem', CASE
            WHEN v_projeto_ativo THEN 'Projeto desativado com sucesso.'
            ELSE 'Projeto ja estava inativo.'
        END,
        'projeto_id', p_projeto_id,
        'codigo_projeto', v_codigo_projeto,
        'atribuicoes_desativadas', v_atribuicoes_desativadas,
        'tasks_desativadas', v_tasks_desativadas,
        'notificacoes_canceladas', v_notificacoes_canceladas,
        'origem', p_origem,
        'actor_user_id', p_actor_user_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'ok', false,
        'codigo', 'erro_interno',
        'mensagem', 'Erro ao desativar projeto: ' || SQLERRM
    );
END;
$function$
;

-- funcao: verificar_atribuicao_info(uuid)
CREATE OR REPLACE FUNCTION public.verificar_atribuicao_info(p_atribuicao_id uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_codigo_projeto TEXT;
    v_area_descricao TEXT;
    v_eng_nome TEXT;
    v_total_disciplinas INTEGER := 0;
BEGIN
    SELECT
        ep.projeto_id,
        p.codigo_projeto,
        a.descricao,
        e.nome
    INTO
        v_projeto_id,
        v_codigo_projeto,
        v_area_descricao,
        v_eng_nome
    FROM engenheiros_projetos ep
    JOIN projetos p ON p.projeto_id = ep.projeto_id
    JOIN areas a ON a.area_id = ep.area_id
    LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
    WHERE ep.id = p_atribuicao_id
      AND ep.ativo = true
    LIMIT 1;

    IF v_projeto_id IS NULL THEN
        RETURN json_build_object(
            'ok', false,
            'codigo', 'nao_encontrada',
            'mensagem', 'Atribuicao nao encontrada ou ja excluida.'
        );
    END IF;

    SELECT COUNT(*) INTO v_total_disciplinas
    FROM engenheiros_projetos
    WHERE projeto_id = v_projeto_id
      AND ativo = true;

    RETURN json_build_object(
        'ok', true,
        'atribuicao_id', p_atribuicao_id,
        'projeto_id', v_projeto_id,
        'codigo_projeto', v_codigo_projeto,
        'area_descricao', v_area_descricao,
        'engenheiro_nome', v_eng_nome,
        'total_disciplinas_ativas', v_total_disciplinas,
        'is_ultima_disciplina', (v_total_disciplinas <= 1)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'ok', false,
        'codigo', 'erro_interno',
        'mensagem', 'Erro ao verificar atribuicao: ' || SQLERRM
    );
END;
$function$
;

-- funcao: registrar_mudanca_status()
CREATE OR REPLACE FUNCTION public.registrar_mudanca_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        INSERT INTO status_historico (
            eng_projeto_id,
            projeto_id,
            status_anterior_id,
            status_novo_id,
            origem
        ) VALUES (
            NEW.id,
            NEW.projeto_id,
            OLD.status_id,
            NEW.status_id,
            'sistema'
        );
    END IF;
    RETURN NEW;
END;
$function$
;

-- funcao: dashboard_atribuir_projeto_com_pavimentos(text,text,text,uuid,uuid,text,date,text[],text,uuid)
CREATE OR REPLACE FUNCTION public.dashboard_atribuir_projeto_com_pavimentos(p_codigo_projeto text, p_cliente text, p_descricao text, p_area_id uuid, p_eng_id uuid, p_complexidade_codigo text DEFAULT 'MEDIA'::text, p_data_conclusao_prevista date DEFAULT NULL::date, p_pavimentos text[] DEFAULT ARRAY[]::text[], p_instancia_label text DEFAULT NULL::text, p_complemento_area_ref_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_projeto_id UUID;
    v_task_id UUID;
    v_eng_projeto_id UUID;
    v_complexidade_id INTEGER;
    v_area_codigo TEXT;
    v_area_descricao TEXT;
    v_complemento_area_descricao TEXT;
    v_eng_nome TEXT;
    v_projeto_ativo BOOLEAN;
    v_instancia_label TEXT;
    v_fallback_numero INTEGER;
    v_codigo_projeto TEXT;
    v_cliente TEXT;
    v_descricao TEXT;
    v_reativado BOOLEAN := false;
BEGIN
    v_codigo_projeto := btrim(COALESCE(p_codigo_projeto, ''));
    v_cliente := btrim(COALESCE(p_cliente, ''));
    v_descricao := NULLIF(btrim(COALESCE(p_descricao, '')), '');

    IF NULLIF(v_codigo_projeto, '') IS NULL THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Codigo do projeto e obrigatorio');
    END IF;

    IF NULLIF(v_cliente, '') IS NULL THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Cliente e obrigatorio');
    END IF;

    SELECT codigo, descricao INTO v_area_codigo, v_area_descricao
    FROM areas
    WHERE area_id = p_area_id
      AND ativo = true;

    IF v_area_descricao IS NULL THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Area nao encontrada ou inativa');
    END IF;

    IF v_area_codigo = 'COMPLEMENTO' THEN
        IF p_complemento_area_ref_id IS NULL THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'Informe a disciplina que este complemento se refere'
            );
        END IF;

        IF p_complemento_area_ref_id = p_area_id THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'Complemento nao pode referenciar Complemento'
            );
        END IF;

        SELECT descricao INTO v_complemento_area_descricao
        FROM areas
        WHERE area_id = p_complemento_area_ref_id
          AND ativo = true;

        IF v_complemento_area_descricao IS NULL THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'Disciplina de referencia do complemento nao encontrada ou inativa'
            );
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM area_etapas_template
        WHERE area_id = p_area_id
          AND tipo = 'pavimento'
          AND ativo = true
    ) AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p_pavimentos, ARRAY[]::TEXT[])) AS pavimento(nome)
        WHERE btrim(regexp_replace(COALESCE(pavimento.nome, ''), '\s+', ' ', 'g')) <> ''
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Informe ao menos um pavimento para esta disciplina'
        );
    END IF;

    SELECT nome INTO v_eng_nome
    FROM engenheiros
    WHERE eng_id = p_eng_id
      AND ativo = true;

    IF v_eng_nome IS NULL THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Engenheiro nao encontrado ou inativo');
    END IF;

    SELECT projeto_id, ativo INTO v_projeto_id, v_projeto_ativo
    FROM projetos
    WHERE codigo_projeto = v_codigo_projeto
    FOR UPDATE;

    IF v_projeto_id IS NULL THEN
        INSERT INTO projetos (codigo_projeto, cliente, descricao, ativo)
        VALUES (v_codigo_projeto, v_cliente, v_descricao, true)
        RETURNING projeto_id, ativo INTO v_projeto_id, v_projeto_ativo;
    ELSIF v_projeto_ativo = false THEN
        UPDATE projetos
        SET
            ativo = true,
            cliente = v_cliente,
            descricao = v_descricao,
            updated_at = NOW()
        WHERE projeto_id = v_projeto_id
        RETURNING ativo INTO v_projeto_ativo;

        v_reativado := true;

        UPDATE engenheiros_projetos
        SET ativo = false, updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE evandro_distribuicao_tasks
        SET ativo = false, updated_at = NOW()
        WHERE projeto_id = v_projeto_id
          AND ativo = true;

        UPDATE notificacoes_whatsapp
        SET
            enviada = true,
            data_envio = COALESCE(data_envio, NOW()),
            erro_envio = COALESCE(erro_envio, 'Cancelada por exclusao do projeto')
        WHERE projeto_id = v_projeto_id
          AND enviada = false;

        DELETE FROM projeto_etapas_globais
        WHERE projeto_id = v_projeto_id;

        DELETE FROM projeto_pavimentos
        WHERE projeto_id = v_projeto_id;
    END IF;

    IF v_area_codigo = 'COMPATIBILIZACAO' THEN
        SELECT COUNT(*) + 1 INTO v_fallback_numero
        FROM engenheiros_projetos
        WHERE projeto_id = v_projeto_id
          AND area_id = p_area_id
          AND ativo = true;

        v_instancia_label := normalizar_label_compatibilizacao(p_instancia_label, v_fallback_numero);

        IF EXISTS (
            SELECT 1
            FROM engenheiros_projetos
            WHERE projeto_id = v_projeto_id
              AND area_id = p_area_id
              AND ativo = true
              AND lower(instancia_label) = lower(v_instancia_label)
        ) THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'Ja existe uma compatibilizacao com esta identificacao neste projeto'
            );
        END IF;
    ELSIF v_area_codigo = 'COMPLEMENTO' THEN
        SELECT COUNT(*) + 1 INTO v_fallback_numero
        FROM engenheiros_projetos
        WHERE projeto_id = v_projeto_id
          AND area_id = p_area_id
          AND complemento_area_ref_id = p_complemento_area_ref_id
          AND ativo = true;

        v_instancia_label := 'Complemento de ' || v_complemento_area_descricao || ' ' || v_fallback_numero;

        IF EXISTS (
            SELECT 1
            FROM engenheiros_projetos
            WHERE projeto_id = v_projeto_id
              AND area_id = p_area_id
              AND ativo = true
              AND lower(instancia_label) = lower(v_instancia_label)
        ) THEN
            RETURN json_build_object(
                'sucesso', false,
                'mensagem', 'Ja existe um complemento com esta identificacao neste projeto'
            );
        END IF;
    ELSIF EXISTS (
        SELECT 1
        FROM engenheiros_projetos
        WHERE eng_id = p_eng_id
          AND projeto_id = v_projeto_id
          AND area_id = p_area_id
          AND ativo = true
    ) THEN
        RETURN json_build_object(
            'sucesso', false,
            'mensagem', 'Engenheiro ja esta atribuido a esta disciplina neste projeto'
        );
    END IF;

    SELECT complexidade_id INTO v_complexidade_id
    FROM complexidade_tarefas
    WHERE UPPER(codigo) = UPPER(TRIM(COALESCE(p_complexidade_codigo, 'MEDIA')))
      AND ativo = true;

    IF v_complexidade_id IS NULL THEN
        SELECT complexidade_id INTO v_complexidade_id
        FROM complexidade_tarefas
        WHERE codigo = 'MEDIA'
          AND ativo = true;
    END IF;

    INSERT INTO evandro_distribuicao_tasks (
        eng_id,
        projeto_id,
        codigo_projeto,
        cliente,
        area_id,
        complemento_area_ref_id,
        complexidade_id,
        descricao_task,
        data_conclusao_prevista,
        status_task,
        instancia_label
    ) VALUES (
        p_eng_id,
        v_projeto_id,
        v_codigo_projeto,
        v_cliente,
        p_area_id,
        CASE WHEN v_area_codigo = 'COMPLEMENTO' THEN p_complemento_area_ref_id ELSE NULL END,
        v_complexidade_id,
        COALESCE(v_descricao, 'Projeto ' || v_codigo_projeto),
        p_data_conclusao_prevista,
        'PENDENTE',
        v_instancia_label
    )
    RETURNING task_id, eng_projeto_id, instancia_label
    INTO v_task_id, v_eng_projeto_id, v_instancia_label;

    IF v_eng_projeto_id IS NULL THEN
        SELECT id, instancia_label INTO v_eng_projeto_id, v_instancia_label
        FROM engenheiros_projetos
        WHERE eng_id = p_eng_id
          AND projeto_id = v_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND (
              v_area_codigo NOT IN ('COMPATIBILIZACAO', 'COMPLEMENTO')
              OR lower(instancia_label) = lower(v_instancia_label)
          )
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    PERFORM configurar_pavimentos_customizados_area(v_projeto_id, p_area_id, p_pavimentos, v_eng_projeto_id);

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', 'Projeto atribuido com sucesso',
        'projeto_id', v_projeto_id,
        'task_id', v_task_id,
        'eng_projeto_id', v_eng_projeto_id,
        'engenheiro', v_eng_nome,
        'area', v_area_descricao,
        'instancia_label', v_instancia_label,
        'complemento_area_ref_id', CASE WHEN v_area_codigo = 'COMPLEMENTO' THEN p_complemento_area_ref_id ELSE NULL END,
        'reativado', v_reativado
    );

EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'sucesso', false,
        'mensagem', 'Erro ao atribuir projeto: ' || SQLERRM
    );
END;
$function$
;

-- funcao: seed_pavimentos_etapas(uuid,uuid,uuid)
CREATE OR REPLACE FUNCTION public.seed_pavimentos_etapas(p_projeto_id uuid, p_area_id uuid, p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pav_count INTEGER;
    v_glb_count INTEGER;
    v_etapa_pav_count INTEGER;
    v_total_n1 INTEGER;
    v_peso_n1 NUMERIC(5,2);
    v_peso_etapa NUMERIC(5,2);
    v_pav RECORD;
BEGIN
    IF EXISTS (
        SELECT 1
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) OR EXISTS (
        SELECT 1
        FROM projeto_etapas_globais
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_pav_count
    FROM area_pavimentos_template
    WHERE area_id = p_area_id
      AND ativo = true;

    SELECT COUNT(*) INTO v_glb_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'global'
      AND ativo = true;

    SELECT COUNT(*) INTO v_etapa_pav_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'pavimento'
      AND ativo = true;

    v_total_n1 := v_pav_count + v_glb_count;
    IF v_total_n1 = 0 THEN
        RETURN;
    END IF;

    v_peso_n1 := ROUND(100.0 / v_total_n1, 2);
    v_peso_etapa := CASE
        WHEN v_etapa_pav_count > 0 THEN ROUND(100.0 / v_etapa_pav_count, 2)
        ELSE 0
    END;

    FOR v_pav IN
        SELECT nome, ordem
        FROM area_pavimentos_template
        WHERE area_id = p_area_id
          AND ativo = true
        ORDER BY ordem
    LOOP
        INSERT INTO projeto_pavimentos (
            projeto_id,
            area_id,
            eng_projeto_id,
            nome,
            ordem,
            peso,
            ativo
        ) VALUES (
            p_projeto_id,
            p_area_id,
            p_eng_projeto_id,
            v_pav.nome,
            v_pav.ordem,
            v_peso_n1,
            true
        );

        INSERT INTO pavimento_etapas (pavimento_id, nome, peso, ativo)
        SELECT pp.pavimento_id, t.nome, v_peso_etapa, true
        FROM projeto_pavimentos pp
        CROSS JOIN area_etapas_template t
        WHERE pp.projeto_id = p_projeto_id
          AND pp.area_id = p_area_id
          AND COALESCE(pp.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND pp.nome = v_pav.nome
          AND t.area_id = p_area_id
          AND t.tipo = 'pavimento'
          AND t.ativo = true;
    END LOOP;

    INSERT INTO projeto_etapas_globais (
        projeto_id,
        area_id,
        eng_projeto_id,
        nome,
        peso,
        ativo
    )
    SELECT p_projeto_id, p_area_id, p_eng_projeto_id, nome, v_peso_n1, true
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'global'
      AND ativo = true
    ORDER BY ordem;

    PERFORM ajustar_residuo_pesos(p_projeto_id, p_area_id, p_eng_projeto_id);
END;
$function$
;

-- funcao: ajustar_residuo_pesos(uuid,uuid,uuid)
CREATE OR REPLACE FUNCTION public.ajustar_residuo_pesos(p_projeto_id uuid, p_area_id uuid, p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_soma_n1 NUMERIC(5,2);
    v_residuo_n1 NUMERIC(5,2);
    v_pav RECORD;
    v_soma_etapa NUMERIC(5,2);
    v_residuo_etapa NUMERIC(5,2);
    v_target_pav UUID;
    v_target_glb UUID;
BEGIN
    SELECT
        COALESCE((
            SELECT SUM(pp.peso)
            FROM projeto_pavimentos pp
            WHERE pp.projeto_id = p_projeto_id
              AND pp.area_id = p_area_id
              AND pp.ativo = true
              AND COALESCE(pp.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ), 0) +
        COALESCE((
            SELECT SUM(peg.peso)
            FROM projeto_etapas_globais peg
            WHERE peg.projeto_id = p_projeto_id
              AND peg.area_id = p_area_id
              AND peg.ativo = true
              AND COALESCE(peg.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ), 0)
    INTO v_soma_n1;

    v_residuo_n1 := 100 - v_soma_n1;

    IF v_residuo_n1 != 0 THEN
        SELECT pavimento_id INTO v_target_pav
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
        ORDER BY ordem DESC
        LIMIT 1;

        IF v_target_pav IS NOT NULL THEN
            UPDATE projeto_pavimentos
            SET peso = peso + v_residuo_n1
            WHERE pavimento_id = v_target_pav;
        ELSE
            SELECT etapa_global_id INTO v_target_glb
            FROM projeto_etapas_globais
            WHERE projeto_id = p_projeto_id
              AND area_id = p_area_id
              AND ativo = true
              AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
                  COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
            ORDER BY created_at DESC
            LIMIT 1;

            IF v_target_glb IS NOT NULL THEN
                UPDATE projeto_etapas_globais
                SET peso = peso + v_residuo_n1
                WHERE etapa_global_id = v_target_glb;
            END IF;
        END IF;
    END IF;

    FOR v_pav IN
        SELECT pavimento_id
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    LOOP
        SELECT COALESCE(SUM(peso), 0) INTO v_soma_etapa
        FROM pavimento_etapas
        WHERE pavimento_id = v_pav.pavimento_id
          AND ativo = true;

        v_residuo_etapa := 100 - v_soma_etapa;

        IF v_soma_etapa > 0 AND v_residuo_etapa != 0 THEN
            UPDATE pavimento_etapas
            SET peso = peso + v_residuo_etapa
            WHERE etapa_id = (
                SELECT etapa_id
                FROM pavimento_etapas
                WHERE pavimento_id = v_pav.pavimento_id
                  AND ativo = true
                ORDER BY created_at DESC
                LIMIT 1
            );
        END IF;
    END LOOP;
END;
$function$
;

-- funcao: calcular_progresso_area(uuid,uuid,uuid)
CREATE OR REPLACE FUNCTION public.calcular_progresso_area(p_projeto_id uuid, p_area_id uuid, p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_contrib_pav NUMERIC := 0;
    v_contrib_glob NUMERIC := 0;
    v_pav RECORD;
    v_interno NUMERIC;
    v_total NUMERIC;
BEGIN
    FOR v_pav IN
        SELECT pavimento_id, peso
        FROM projeto_pavimentos
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true
          AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
    LOOP
        SELECT COALESCE(SUM(peso), 0) INTO v_interno
        FROM pavimento_etapas
        WHERE pavimento_id = v_pav.pavimento_id
          AND concluida = true
          AND ativo = true;

        v_contrib_pav := v_contrib_pav + (v_pav.peso * v_interno / 100.0);
    END LOOP;

    SELECT COALESCE(SUM(peso), 0) INTO v_contrib_glob
    FROM projeto_etapas_globais
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND concluida = true
      AND ativo = true
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    v_total := v_contrib_pav + v_contrib_glob;
    IF v_total > 100 THEN
        v_total := 100;
    ELSIF v_total < 0 THEN
        v_total := 0;
    END IF;

    RETURN ROUND(v_total, 2);
END;
$function$
;

-- funcao: marcar_area_concluida(uuid,uuid,boolean,uuid)
CREATE OR REPLACE FUNCTION public.marcar_area_concluida(p_projeto_id uuid, p_area_id uuid, p_concluido boolean DEFAULT true, p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_pct NUMERIC(5,2);
BEGIN
    v_pct := CASE WHEN p_concluido THEN 100.00 ELSE 0.00 END;

    IF p_eng_projeto_id IS NOT NULL THEN
        UPDATE engenheiros_projetos
        SET percentual_ponderado = v_pct,
            data_conclusao = CASE WHEN p_concluido THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND id = p_eng_projeto_id
          AND ativo = true;
    ELSE
        UPDATE engenheiros_projetos
        SET percentual_ponderado = v_pct,
            data_conclusao = CASE WHEN p_concluido THEN COALESCE(data_conclusao, CURRENT_DATE) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE projeto_id = p_projeto_id
          AND area_id = p_area_id
          AND ativo = true;
    END IF;

    PERFORM recalcular_rollup_projeto(p_projeto_id);
    RETURN v_pct;
END;
$function$
;

-- funcao: configurar_pavimentos_customizados_area(uuid,uuid,text[],uuid)
CREATE OR REPLACE FUNCTION public.configurar_pavimentos_customizados_area(p_projeto_id uuid, p_area_id uuid, p_pavimentos text[], p_eng_projeto_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_raw TEXT;
    v_nome TEXT;
    v_nomes TEXT[] := ARRAY[]::TEXT[];
    v_globais_count INTEGER;
    v_etapas_pav_count INTEGER;
    v_total_n1 INTEGER;
    v_peso_n1 NUMERIC(5,2);
    v_peso_etapa NUMERIC(5,2);
    v_pavimento_id UUID;
    v_ordem INTEGER := 0;
BEGIN
    FOREACH v_raw IN ARRAY COALESCE(p_pavimentos, ARRAY[]::TEXT[]) LOOP
        v_nome := btrim(regexp_replace(COALESCE(v_raw, ''), '\s+', ' ', 'g'));

        IF v_nome <> ''
           AND NOT EXISTS (
               SELECT 1
               FROM unnest(v_nomes) AS nome_existente(nome)
               WHERE lower(nome_existente.nome) = lower(v_nome)
           )
        THEN
            v_nomes := array_append(v_nomes, v_nome);
        END IF;
    END LOOP;

    IF COALESCE(array_length(v_nomes, 1), 0) = 0 THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_etapas_pav_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'pavimento'
      AND ativo = true;

    IF v_etapas_pav_count = 0 THEN
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_globais_count
    FROM area_etapas_template
    WHERE area_id = p_area_id
      AND tipo = 'global'
      AND ativo = true;

    v_total_n1 := COALESCE(array_length(v_nomes, 1), 0) + v_globais_count;
    IF v_total_n1 = 0 THEN
        RETURN;
    END IF;

    v_peso_n1 := ROUND(100.0 / v_total_n1, 2);
    v_peso_etapa := ROUND(100.0 / v_etapas_pav_count, 2);

    IF EXISTS (
        SELECT 1
        FROM projeto_pavimentos pp
        JOIN pavimento_etapas pe ON pe.pavimento_id = pp.pavimento_id
        WHERE pp.projeto_id = p_projeto_id
          AND pp.area_id = p_area_id
          AND COALESCE(pp.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND pe.concluida = true
    ) OR EXISTS (
        SELECT 1
        FROM projeto_etapas_globais peg
        WHERE peg.projeto_id = p_projeto_id
          AND peg.area_id = p_area_id
          AND COALESCE(peg.eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
              COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND peg.concluida = true
    ) THEN
        RAISE EXCEPTION 'Nao e possivel substituir pavimentos de uma disciplina com progresso concluido';
    END IF;

    DELETE FROM projeto_pavimentos
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    UPDATE projeto_etapas_globais
    SET peso = v_peso_n1
    WHERE projeto_id = p_projeto_id
      AND area_id = p_area_id
      AND ativo = true
      AND COALESCE(eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID) =
          COALESCE(p_eng_projeto_id, '00000000-0000-0000-0000-000000000000'::UUID);

    FOREACH v_nome IN ARRAY v_nomes LOOP
        v_ordem := v_ordem + 1;

        INSERT INTO projeto_pavimentos (
            projeto_id,
            area_id,
            eng_projeto_id,
            nome,
            ordem,
            peso,
            ativo
        ) VALUES (
            p_projeto_id,
            p_area_id,
            p_eng_projeto_id,
            v_nome,
            v_ordem,
            v_peso_n1,
            true
        )
        RETURNING pavimento_id INTO v_pavimento_id;

        INSERT INTO pavimento_etapas (pavimento_id, nome, peso, ativo)
        SELECT v_pavimento_id, nome, v_peso_etapa, true
        FROM area_etapas_template
        WHERE area_id = p_area_id
          AND tipo = 'pavimento'
          AND ativo = true
        ORDER BY ordem;
    END LOOP;

    PERFORM ajustar_residuo_pesos(p_projeto_id, p_area_id, p_eng_projeto_id);
    PERFORM recalcular_rollup_projeto(p_projeto_id);
END;
$function$
;

-- funcao: hoje_brt()
CREATE OR REPLACE FUNCTION public.hoje_brt()
 RETURNS date
 LANGUAGE sql
 STABLE
AS $function$ SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::DATE $function$
;

-- funcao: registrar_retrabalho_dia(uuid,boolean,text,text,text,numeric,numeric,date)
CREATE OR REPLACE FUNCTION public.registrar_retrabalho_dia(p_atribuicao_id uuid, p_necessitou_retrabalho boolean, p_motivo_retrabalho text DEFAULT NULL::text, p_tipo_retrabalho text DEFAULT NULL::text, p_descricao text DEFAULT NULL::text, p_horas_trabalhadas_total numeric DEFAULT NULL::numeric, p_horas_retrabalho numeric DEFAULT NULL::numeric, p_data date DEFAULT NULL::date)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_retrabalho_id UUID;
    v_projeto_id UUID;
    v_eng_id UUID;
    v_status_id INTEGER;
    v_quantidade INTEGER;
    v_existia BOOLEAN;
    v_data DATE := COALESCE(p_data, hoje_brt());
BEGIN
    IF NOT EXISTS (SELECT 1 FROM engenheiros_projetos WHERE id = p_atribuicao_id AND ativo = true) THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Atribuição não encontrada');
    END IF;

    IF v_data > hoje_brt() THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Não é possível apontar horas em data futura');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL AND p_horas_trabalhadas_total < 0 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas trabalhadas totais não podem ser negativas');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL AND p_horas_trabalhadas_total > 24 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas trabalhadas não podem passar de 24h num dia');
    END IF;

    IF p_horas_retrabalho IS NOT NULL AND p_horas_retrabalho < 0 THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas de retrabalho não podem ser negativas');
    END IF;

    IF p_horas_trabalhadas_total IS NOT NULL
       AND p_horas_retrabalho IS NOT NULL
       AND p_horas_retrabalho > p_horas_trabalhadas_total THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Horas de retrabalho não podem exceder as horas trabalhadas totais');
    END IF;

    IF p_necessitou_retrabalho = false THEN
        p_motivo_retrabalho := NULL;
        p_tipo_retrabalho := NULL;
        p_horas_retrabalho := COALESCE(p_horas_retrabalho, 0);
    END IF;

    IF p_necessitou_retrabalho = true AND (p_motivo_retrabalho IS NULL OR TRIM(p_motivo_retrabalho) = '') THEN
        RETURN json_build_object('sucesso', false, 'mensagem', 'Motivo do retrabalho é obrigatório');
    END IF;

    SELECT projeto_id, eng_id, status_id
    INTO v_projeto_id, v_eng_id, v_status_id
    FROM engenheiros_projetos
    WHERE id = p_atribuicao_id;

    SELECT EXISTS (
        SELECT 1 FROM retrabalho_projetos
        WHERE eng_projeto_id = p_atribuicao_id AND data_retrabalho = v_data
    ) INTO v_existia;

    INSERT INTO retrabalho_projetos (
        eng_projeto_id,
        projeto_id,
        eng_id,
        necessitou_retrabalho,
        motivo_retrabalho,
        tipo_retrabalho,
        descricao,
        horas_trabalhadas_total,
        horas_retrabalho,
        data_retrabalho,
        status_id
    ) VALUES (
        p_atribuicao_id,
        v_projeto_id,
        v_eng_id,
        p_necessitou_retrabalho,
        p_motivo_retrabalho,
        p_tipo_retrabalho,
        p_descricao,
        p_horas_trabalhadas_total,
        p_horas_retrabalho,
        v_data,
        v_status_id
    )
    ON CONFLICT (eng_projeto_id, data_retrabalho) DO UPDATE SET
        necessitou_retrabalho = EXCLUDED.necessitou_retrabalho,
        motivo_retrabalho = EXCLUDED.motivo_retrabalho,
        tipo_retrabalho = EXCLUDED.tipo_retrabalho,
        descricao = EXCLUDED.descricao,
        horas_trabalhadas_total = EXCLUDED.horas_trabalhadas_total,
        horas_retrabalho = EXCLUDED.horas_retrabalho
    RETURNING id INTO v_retrabalho_id;

    SELECT COUNT(*) INTO v_quantidade
    FROM retrabalho_projetos
    WHERE eng_projeto_id = p_atribuicao_id
      AND necessitou_retrabalho = true;

    RETURN json_build_object(
        'sucesso', true,
        'mensagem', CASE
            WHEN v_existia THEN 'Registro de retrabalho atualizado'
            ELSE 'Registro de retrabalho criado'
        END,
        'retrabalho_id', v_retrabalho_id,
        'necessitou_retrabalho', p_necessitou_retrabalho,
        'quantidade_total_retrabalhos', v_quantidade,
        'horas_trabalhadas_total', p_horas_trabalhadas_total,
        'horas_retrabalho', p_horas_retrabalho,
        'data', v_data
    );
END;
$function$
;

-- -----------------------------------------------------
-- Views
-- -----------------------------------------------------

-- view: vw_quantidade_retrabalhos
CREATE OR REPLACE VIEW public.vw_quantidade_retrabalhos AS
 SELECT eng_projeto_id,
    count(*) FILTER (WHERE necessitou_retrabalho = true) AS quantidade_retrabalhos,
    count(*) AS total_dias_registrados,
    round(sum(COALESCE(horas_retrabalho, 0::numeric)) / NULLIF(sum(COALESCE(horas_trabalhadas_total, 0::numeric)), 0::numeric) * 100::numeric, 2) AS percentual_retrabalhos,
    COALESCE(sum(COALESCE(horas_trabalhadas_total, 0::numeric)), 0::numeric) AS horas_trabalhadas_total,
    COALESCE(sum(COALESCE(horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM retrabalho_projetos
  GROUP BY eng_projeto_id;

-- view: vw_engenheiros_projetos
CREATE OR REPLACE VIEW public.vw_engenheiros_projetos WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.id AS atribuicao_id,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.status_id,
    s.codigo AS status_codigo,
    s.descricao AS status_descricao,
    ep.percentual_andamento,
    ep.tempo_trabalho_dias,
    ep.observacoes,
    ep.ativo,
    ep.created_at,
    ep.updated_at
   FROM engenheiros_projetos ep
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN status_codes s ON s.status_id = ep.status_id
  WHERE ep.ativo = true AND e.ativo = true AND p.ativo = true;

-- view: vw_resumo_engenheiros
CREATE OR REPLACE VIEW public.vw_resumo_engenheiros WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome,
    e.exclusivo,
    count(DISTINCT ep.projeto_id) AS total_projetos,
    count(ep.id) AS total_atribuicoes,
    avg(ep.percentual_andamento) AS media_percentual,
    sum(
        CASE
            WHEN ep.data_conclusao IS NULL AND ep.ativo = true THEN 1
            ELSE 0
        END) AS projetos_ativos
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome, e.exclusivo;

-- view: vw_projetos_completo
CREATE OR REPLACE VIEW public.vw_projetos_completo AS
 SELECT ep.id AS atribuicao_id,
    e.eng_id,
    e.nome AS engenheiro_nome,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    ep.status_id,
        CASE
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) >= 100::numeric THEN 'Concluído'::text
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) > 0::numeric THEN 'Em Andamento'::text
            ELSE 'Aguardando Início'::text
        END AS status_descricao,
    COALESCE(ep.percentual_ponderado, 0::numeric)::numeric(5,2) AS percentual_andamento,
    ep.tempo_trabalho_dias,
    pr.data_inicio_projeto,
    pr.data_inicio_esperada_cliente,
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
    pr.prazo_interno_dias,
    pr.prazo_cliente_dias,
    COALESCE(vr.quantidade_retrabalhos, 0::bigint) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0::numeric) AS percentual_retrabalhos,
    ( SELECT projetos_previsao.previsao_texto
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultima_previsao,
    ( SELECT projetos_previsao.feito_texto
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultimo_feito,
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric THEN CURRENT_DATE - ep.data_prevista
            ELSE 0
        END AS dias_atraso,
    p.descricao,
    ep.instancia_label,
    COALESCE(vr.horas_trabalhadas_total, 0::numeric) AS horas_trabalhadas_total,
    COALESCE(vr.horas_retrabalho_total, 0::numeric) AS horas_retrabalho_total
   FROM engenheiros_projetos ep
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
  WHERE ep.ativo = true;

-- view: vw_dono_visao_geral
CREATE OR REPLACE VIEW public.vw_dono_visao_geral WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    count(DISTINCT ep.projeto_id) AS total_projetos,
    count(DISTINCT ep.id) AS total_areas,
    round(avg(ep.percentual_andamento), 2) AS media_percentual,
    count(ep.id) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS areas_ativas,
    COALESCE(sum(vr.quantidade_retrabalhos), 0::numeric) AS total_retrabalhos,
    round(avg(ct.nivel), 2) AS complexidade_media,
    sum(ep.tempo_trabalho_dias) FILTER (WHERE ep.ativo = true AND ep.data_conclusao IS NULL) AS dias_trabalho_pendentes,
    count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL AND ep.ativo = true) AS areas_atrasadas
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
     LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
     LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome, e.exclusivo
  ORDER BY (count(DISTINCT ep.projeto_id)) DESC;

-- view: vw_dono_engenheiro_detalhado
CREATE OR REPLACE VIEW public.vw_dono_engenheiro_detalhado WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
    s.descricao AS status_descricao,
    ep.percentual_andamento AS taxa_execucao,
    ep.tempo_trabalho_dias,
    ct.descricao AS complexidade_descricao,
    ct.nivel AS complexidade_nivel,
    COALESCE(vr.quantidade_retrabalhos, 0::bigint) AS quantidade_retrabalhos,
    COALESCE(vr.percentual_retrabalhos, 0::numeric) AS percentual_retrabalhos,
    pr.prazo_final_eng,
    pr.prazo_final_cliente,
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE 0
        END AS dias_atraso,
    ( SELECT projetos_previsao.data_registro
           FROM projetos_previsao
          WHERE projetos_previsao.eng_projeto_id = ep.id
          ORDER BY projetos_previsao.data_registro DESC
         LIMIT 1) AS ultima_atualizacao
   FROM engenheiros e
     JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN status_codes s ON s.status_id = ep.status_id
     LEFT JOIN evandro_distribuicao_tasks edt ON edt.eng_projeto_id = ep.id
     LEFT JOIN complexidade_tarefas ct ON ct.complexidade_id = edt.complexidade_id
     LEFT JOIN vw_quantidade_retrabalhos vr ON vr.eng_projeto_id = ep.id
     LEFT JOIN prazos pr ON pr.eng_projeto_id = ep.id
  WHERE e.ativo = true AND ep.ativo = true
  ORDER BY e.nome, p.codigo_projeto, a.descricao;

-- view: vw_dono_retrabalhos_historico
CREATE OR REPLACE VIEW public.vw_dono_retrabalhos_historico WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    p.projeto_id,
    p.codigo_projeto,
    a.descricao AS area_descricao,
    r.data_retrabalho,
    r.necessitou_retrabalho,
    r.motivo_retrabalho,
    r.tipo_retrabalho,
    r.descricao,
    s.descricao AS status_na_epoca
   FROM retrabalho_projetos r
     JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN status_codes s ON s.status_id = r.status_id
  WHERE r.necessitou_retrabalho = true
  ORDER BY r.data_retrabalho DESC;

-- view: vw_dono_retrabalhos_por_motivo
CREATE OR REPLACE VIEW public.vw_dono_retrabalhos_por_motivo AS
 SELECT motivo_retrabalho,
    count(*) AS quantidade,
    count(DISTINCT eng_id) AS engenheiros_afetados,
    count(DISTINCT projeto_id) AS projetos_afetados,
    COALESCE(sum(COALESCE(horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM retrabalho_projetos
  WHERE necessitou_retrabalho = true AND motivo_retrabalho IS NOT NULL
  GROUP BY motivo_retrabalho
  ORDER BY (count(*)) DESC;

-- view: vw_dono_taxa_execucao_ranking
CREATE OR REPLACE VIEW public.vw_dono_taxa_execucao_ranking WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro_nome,
    e.exclusivo,
    round(avg(ep.percentual_andamento), 2) AS taxa_execucao_media,
    count(ep.id) AS total_areas,
    count(ep.id) FILTER (WHERE ep.percentual_andamento = 100::numeric) AS areas_concluidas,
    round(count(ep.id) FILTER (WHERE ep.percentual_andamento = 100::numeric)::numeric / NULLIF(count(ep.id), 0)::numeric * 100::numeric, 2) AS percentual_conclusao
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome, e.exclusivo
  ORDER BY (round(avg(ep.percentual_andamento), 2)) DESC;

-- view: vw_tipos_projeto
CREATE OR REPLACE VIEW public.vw_tipos_projeto WITH (security_invoker=on) AS
 SELECT tp.codigo,
    tp.area_codigo,
    a.descricao AS area_descricao,
    tp.descricao AS tipo_descricao,
    tp.tempo_trabalho_dias,
    tp.ordem,
    tp.ativo
   FROM tipos_projeto tp
     JOIN areas a ON a.codigo = tp.area_codigo
  WHERE tp.ativo = true
  ORDER BY a.codigo, tp.ordem;

-- view: vw_percentual_retrabalho_geral
CREATE OR REPLACE VIEW public.vw_percentual_retrabalho_geral WITH (security_invoker=on) AS
 SELECT round(count(DISTINCT eng_id) FILTER (WHERE (EXISTS ( SELECT 1
           FROM engenheiros_projetos ep
             JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
          WHERE ep.eng_id = e.eng_id AND r.necessitou_retrabalho = true)))::numeric / NULLIF(count(DISTINCT eng_id), 0)::numeric * 100::numeric, 2) AS percentual_geral_retrabalho
   FROM engenheiros e
  WHERE ativo = true;

-- view: vw_bloco2_atrasos_engenheiro
CREATE OR REPLACE VIEW public.vw_bloco2_atrasos_engenheiro WITH (security_invoker=on) AS
 SELECT e.eng_id,
    e.nome AS engenheiro,
    count(DISTINCT ep.projeto_id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) AS qtde_projetos_atrasados,
    count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) AS qtde_areas_atrasadas,
    round(avg(
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE NULL::integer
        END), 2) AS dias_medios_atraso,
    max(
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE 0
        END) AS atraso_maximo_dias
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
 HAVING count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) > 0
  ORDER BY (round(avg(
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE NULL::integer
        END), 2)) DESC;

-- view: vw_bloco2_atrasos_area
CREATE OR REPLACE VIEW public.vw_bloco2_atrasos_area WITH (security_invoker=on) AS
 SELECT a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) AS qtde_atrasados,
    round(avg(
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE NULL::integer
        END), 2) AS dias_medio_atraso,
    count(DISTINCT ep.projeto_id) AS total_projetos_area
   FROM areas a
     LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
  WHERE a.ativo = true
  GROUP BY a.area_id, a.codigo, a.descricao
 HAVING count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) > 0
  ORDER BY (round(avg(
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL THEN CURRENT_DATE - ep.data_prevista
            ELSE NULL::integer
        END), 2)) DESC;

-- view: vw_bloco5_retrabalho_engenheiro
CREATE OR REPLACE VIEW public.vw_bloco5_retrabalho_engenheiro AS
 SELECT e.eng_id,
    e.nome AS engenheiro,
    count(DISTINCT ep.area_id) FILTER (WHERE r.necessitou_retrabalho = true) AS qtde_areas_retrabalho,
    count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos,
    COALESCE(round(sum(COALESCE(r.horas_retrabalho, 0::numeric)) / NULLIF(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) * 100::numeric, 2), 0::numeric) AS retrabalho_medio_percentual,
    count(DISTINCT r.projeto_id) FILTER (WHERE r.necessitou_retrabalho = true) AS projetos_com_retrabalho,
    COALESCE(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) AS horas_trabalhadas_total,
    COALESCE(sum(COALESCE(r.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
     LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
 HAVING count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) > 0
  ORDER BY (count(r.id) FILTER (WHERE r.necessitou_retrabalho = true)) DESC;

-- view: vw_bloco5_retrabalho_area
CREATE OR REPLACE VIEW public.vw_bloco5_retrabalho_area WITH (security_invoker=on) AS
 SELECT a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS qtde_retrabalhos,
    count(DISTINCT ep.projeto_id) AS projetos_afetados,
    round(count(DISTINCT r.eng_projeto_id)::numeric / NULLIF(count(DISTINCT ep.id), 0)::numeric * 100::numeric, 2) AS percentual_areas_retrabalho
   FROM areas a
     LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
     LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
  WHERE a.ativo = true
  GROUP BY a.area_id, a.codigo, a.descricao
 HAVING count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) > 0
  ORDER BY (count(r.id) FILTER (WHERE r.necessitou_retrabalho = true)) DESC;

-- view: vw_grafico_atrasos_engenheiro
CREATE OR REPLACE VIEW public.vw_grafico_atrasos_engenheiro WITH (security_invoker=on) AS
 SELECT e.nome AS engenheiro,
    count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL) AS qtde_atrasados
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
  ORDER BY (count(ep.id) FILTER (WHERE ep.data_prevista < CURRENT_DATE AND ep.data_conclusao IS NULL)) DESC;

-- view: vw_grafico_retrabalho_area
CREATE OR REPLACE VIEW public.vw_grafico_retrabalho_area WITH (security_invoker=on) AS
 SELECT a.descricao AS area,
    count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS qtde_retrabalhos
   FROM areas a
     LEFT JOIN engenheiros_projetos ep ON ep.area_id = a.area_id AND ep.ativo = true
     LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
  WHERE a.ativo = true
  GROUP BY a.area_id, a.descricao
  ORDER BY (count(r.id) FILTER (WHERE r.necessitou_retrabalho = true)) DESC;

-- view: vw_retrabalho_por_area_projeto
CREATE OR REPLACE VIEW public.vw_retrabalho_por_area_projeto AS
 SELECT p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    a.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area,
    count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos_area,
    COALESCE(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) AS horas_trabalhadas_total,
    COALESCE(sum(COALESCE(r.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total,
    COALESCE(round(sum(COALESCE(r.horas_retrabalho, 0::numeric)) / NULLIF(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) * 100::numeric, 2), 0::numeric) AS percentual_retrabalho_disciplina
   FROM projetos p
     JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
     JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN retrabalho_projetos r ON r.eng_projeto_id = ep.id
  WHERE p.ativo = true
  GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, a.area_id, a.codigo, a.descricao
 HAVING count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) > 0;

-- view: vw_retrabalho_motivos_por_projeto
CREATE OR REPLACE VIEW public.vw_retrabalho_motivos_por_projeto AS
 SELECT p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.motivo_retrabalho,
    count(*) AS quantidade,
    COALESCE(sum(COALESCE(r.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM retrabalho_projetos r
     JOIN projetos p ON p.projeto_id = r.projeto_id
  WHERE r.necessitou_retrabalho = true AND r.motivo_retrabalho IS NOT NULL
  GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, r.motivo_retrabalho
  ORDER BY p.codigo_projeto, (count(*)) DESC;

-- view: vw_progresso_ponderado
CREATE OR REPLACE VIEW public.vw_progresso_ponderado WITH (security_invoker=on) AS
 SELECT projeto_id,
    codigo_projeto,
    cliente,
    percentual_ponderado,
    ( SELECT count(*) AS count
           FROM projeto_pavimentos pp
          WHERE pp.projeto_id = p.projeto_id AND pp.ativo = true) AS total_pavimentos,
    ( SELECT count(*) AS count
           FROM projeto_etapas_globais eg
          WHERE eg.projeto_id = p.projeto_id AND eg.ativo = true) AS total_etapas_globais,
    COALESCE(( SELECT sum(pp.peso) AS sum
           FROM projeto_pavimentos pp
          WHERE pp.projeto_id = p.projeto_id AND pp.ativo = true), 0::numeric) + COALESCE(( SELECT sum(eg.peso) AS sum
           FROM projeto_etapas_globais eg
          WHERE eg.projeto_id = p.projeto_id AND eg.ativo = true), 0::numeric) AS soma_pesos_configurados,
    (COALESCE(( SELECT sum(pp.peso) AS sum
           FROM projeto_pavimentos pp
          WHERE pp.projeto_id = p.projeto_id AND pp.ativo = true), 0::numeric) + COALESCE(( SELECT sum(eg.peso) AS sum
           FROM projeto_etapas_globais eg
          WHERE eg.projeto_id = p.projeto_id AND eg.ativo = true), 0::numeric)) = 100.00 AS pesos_validos
   FROM projetos p
  WHERE ativo = true;

-- view: vw_grafico_projetos_status
CREATE OR REPLACE VIEW public.vw_grafico_projetos_status AS
 SELECT status,
    count(*) AS quantidade,
    round(count(*)::numeric / NULLIF(( SELECT count(*) AS count
           FROM projetos
          WHERE projetos.ativo = true), 0)::numeric * 100::numeric, 2) AS percentual
   FROM ( SELECT p.projeto_id,
                CASE
                    WHEN (EXISTS ( SELECT 1
                       FROM engenheiros_projetos ep
                      WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true)) AND NOT (EXISTS ( SELECT 1
                       FROM engenheiros_projetos ep
                      WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric)) THEN 'Concluído'::text
                    WHEN (EXISTS ( SELECT 1
                       FROM engenheiros_projetos ep
                      WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) > 0::numeric)) THEN 'Em Andamento'::text
                    ELSE 'Aguardando Início'::text
                END AS status
           FROM projetos p
          WHERE p.ativo = true) s
  GROUP BY status
  ORDER BY (count(*)) DESC;

-- view: vw_bloco1_visao_geral
CREATE OR REPLACE VIEW public.vw_bloco1_visao_geral AS
 SELECT ( SELECT count(*) AS count
           FROM projetos
          WHERE projetos.ativo = true) AS total_projetos,
    ( SELECT count(*) AS count
           FROM projetos p
          WHERE p.ativo = true AND (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true)) AND NOT (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric))) AS projetos_concluidos,
    ( SELECT count(*) AS count
           FROM projetos p
          WHERE p.ativo = true AND (EXISTS ( SELECT 1
                   FROM engenheiros_projetos ep
                  WHERE ep.projeto_id = p.projeto_id AND ep.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric))) AS projetos_em_execucao,
    ( SELECT count(DISTINCT p.projeto_id) AS count
           FROM projetos p
             JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
          WHERE p.ativo = true AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric AND ep.data_prevista < CURRENT_DATE) AS projetos_atrasados,
    ( SELECT round(COALESCE(avg(projetos.percentual_ponderado), 0::numeric), 2) AS round
           FROM projetos
          WHERE projetos.ativo = true) AS percentual_concluido_medio,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true) AS total_areas,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true AND engenheiros_projetos.data_conclusao IS NOT NULL) AS areas_concluidas,
    ( SELECT count(*) AS count
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true AND engenheiros_projetos.data_conclusao IS NULL) AS areas_ativas;

-- view: vw_bloco3_carga_trabalho
CREATE OR REPLACE VIEW public.vw_bloco3_carga_trabalho AS
 SELECT e.eng_id,
    e.nome AS engenheiro,
    e.exclusivo,
    COALESCE(sum(ep.tempo_trabalho_dias) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::bigint) AS dias_estimados_totais,
    round(COALESCE(avg(ep.percentual_ponderado) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::numeric), 2) AS percentual_execucao_media,
    round(COALESCE(sum(ep.tempo_trabalho_dias::numeric * (100::numeric - COALESCE(ep.percentual_ponderado, 0::numeric)) / 100.0) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::numeric), 0) AS dias_restantes,
    count(ep.id) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true) AS areas_ativas,
    count(DISTINCT ep.projeto_id) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true) AS projetos_ativos
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome, e.exclusivo
  ORDER BY (round(COALESCE(sum(ep.tempo_trabalho_dias::numeric * (100::numeric - COALESCE(ep.percentual_ponderado, 0::numeric)) / 100.0) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::numeric), 0)) DESC;

-- view: vw_bloco4_execucao_media
CREATE OR REPLACE VIEW public.vw_bloco4_execucao_media AS
 SELECT e.eng_id,
    e.nome AS engenheiro,
    COALESCE(sum(a.tempo_trabalho_dias), 0::bigint) AS dias_estimados_totais,
    round(COALESCE(sum(a.tempo_trabalho_dias::numeric * COALESCE(ep.percentual_ponderado, 0::numeric) / 100.0), 0::numeric), 0) AS dias_executados,
    round(COALESCE(avg(ep.percentual_ponderado), 0::numeric), 2) AS percentual_execucao_media,
    round(COALESCE(sum(a.tempo_trabalho_dias::numeric * (100::numeric - COALESCE(ep.percentual_ponderado, 0::numeric)) / 100.0), 0::numeric), 0) AS dias_restantes
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id AND ep.ativo = true
     LEFT JOIN areas a ON a.area_id = ep.area_id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
  ORDER BY (round(COALESCE(avg(ep.percentual_ponderado), 0::numeric), 2)) DESC;

-- view: vw_grafico_carga_trabalho
CREATE OR REPLACE VIEW public.vw_grafico_carga_trabalho AS
 SELECT e.nome AS engenheiro,
    round(COALESCE(sum(ep.tempo_trabalho_dias::numeric * COALESCE(ep.percentual_ponderado, 0::numeric) / 100.0) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::numeric), 0) AS dias_concluidos,
    round(COALESCE(sum(ep.tempo_trabalho_dias::numeric * (100::numeric - COALESCE(ep.percentual_ponderado, 0::numeric)) / 100.0) FILTER (WHERE ep.data_conclusao IS NULL AND ep.ativo = true), 0::numeric), 0) AS dias_restantes
   FROM engenheiros e
     LEFT JOIN engenheiros_projetos ep ON ep.eng_id = e.eng_id
  WHERE e.ativo = true
  GROUP BY e.eng_id, e.nome
  ORDER BY (COALESCE(sum(ep.tempo_trabalho_dias), 0::bigint)) DESC;

-- view: vw_relatorio_projeto_pdf
CREATE OR REPLACE VIEW public.vw_relatorio_projeto_pdf AS
 WITH disciplinas_projeto AS (
         SELECT ep.projeto_id,
            ep.id AS eng_projeto_id,
            ep.eng_id,
            ep.area_id,
            ep.data_inicio,
            ep.data_conclusao,
            ep.data_prevista,
            ep.percentual_ponderado,
            ep.instancia_label,
            e.nome AS engenheiro_nome,
            a.descricao AS area_descricao,
            a.codigo AS area_codigo
           FROM engenheiros_projetos ep
             LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
             LEFT JOIN areas a ON a.area_id = ep.area_id
          WHERE ep.ativo = true
        ), retrabalho_projeto AS (
         SELECT retrabalho_projetos.projeto_id,
            count(*) AS dias_retrabalho
           FROM retrabalho_projetos
          WHERE retrabalho_projetos.necessitou_retrabalho = true
          GROUP BY retrabalho_projetos.projeto_id
        ), paralisacao_projeto AS (
         SELECT sh.projeto_id,
            count(DISTINCT date(sh.data_mudanca)) AS dias_paralisacao
           FROM status_historico sh
             JOIN status_codes sc ON sc.status_id = sh.status_novo_id
          WHERE sc.codigo = ANY (ARRAY['PARADO_CLIENTE'::text, 'PARADO_TECPRED'::text, 'AGUARDANDO_INF_CLIENTE'::text, 'AGUARDANDO_INICIO'::text])
          GROUP BY sh.projeto_id
        )
 SELECT p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    p.descricao,
    p.percentual_ponderado AS percentual_projeto,
    min(dp.data_inicio) AS data_inicio_projeto,
    max(dp.data_conclusao) AS data_conclusao_projeto,
    COALESCE(EXTRACT(day FROM max(dp.data_conclusao)::timestamp without time zone - min(dp.data_inicio)::timestamp without time zone)::integer, 0) AS dias_execucao_total,
    count(DISTINCT dp.eng_id) AS total_engenheiros,
    count(DISTINCT dp.eng_projeto_id) AS total_disciplinas,
    count(DISTINCT dp.eng_projeto_id) FILTER (WHERE dp.data_conclusao IS NOT NULL OR dp.percentual_ponderado >= 100::numeric) AS disciplinas_concluidas,
    COALESCE(rp.dias_retrabalho, 0::bigint) AS dias_retrabalho,
    COALESCE(pp.dias_paralisacao, 0::bigint) AS dias_paralisacao,
    p.created_at AS projeto_criado_em
   FROM projetos p
     LEFT JOIN disciplinas_projeto dp ON dp.projeto_id = p.projeto_id
     LEFT JOIN retrabalho_projeto rp ON rp.projeto_id = p.projeto_id
     LEFT JOIN paralisacao_projeto pp ON pp.projeto_id = p.projeto_id
  WHERE p.ativo = true
  GROUP BY p.projeto_id, p.codigo_projeto, p.cliente, p.descricao, p.percentual_ponderado, p.created_at, rp.dias_retrabalho, pp.dias_paralisacao;

-- view: vw_relatorio_disciplinas_projeto
CREATE OR REPLACE VIEW public.vw_relatorio_disciplinas_projeto AS
 SELECT ep.projeto_id,
    ep.id AS eng_projeto_id,
    e.nome AS engenheiro_nome,
    a.descricao AS area_descricao,
    a.codigo AS area_codigo,
    ep.instancia_label,
    ep.data_inicio,
    ep.data_conclusao,
    ep.data_prevista,
    ep.percentual_ponderado,
    COALESCE(EXTRACT(day FROM ep.data_conclusao::timestamp without time zone - ep.data_inicio::timestamp without time zone)::integer, 0) AS dias_execucao,
    COALESCE(r.dias_retrabalho, 0::bigint) AS dias_retrabalho
   FROM engenheiros_projetos ep
     LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
     LEFT JOIN areas a ON a.area_id = ep.area_id
     LEFT JOIN ( SELECT retrabalho_projetos.eng_projeto_id,
            count(*) AS dias_retrabalho
           FROM retrabalho_projetos
          WHERE retrabalho_projetos.necessitou_retrabalho = true
          GROUP BY retrabalho_projetos.eng_projeto_id) r ON r.eng_projeto_id = ep.id
  WHERE ep.ativo = true
  ORDER BY ep.data_inicio;

-- view: vw_retrabalho_geral
CREATE OR REPLACE VIEW public.vw_retrabalho_geral AS
 SELECT count(r.id) FILTER (WHERE r.necessitou_retrabalho = true) AS total_retrabalhos_geral,
    count(DISTINCT p.projeto_id) FILTER (WHERE p.ativo = true) AS total_projetos_ativos,
    COALESCE(round(sum(COALESCE(r.horas_retrabalho, 0::numeric)) / NULLIF(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) * 100::numeric, 2), 0::numeric) AS percentual_geral_retrabalho,
    COALESCE(sum(COALESCE(r.horas_trabalhadas_total, 0::numeric)), 0::numeric) AS horas_trabalhadas_total,
    COALESCE(sum(COALESCE(r.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
   FROM projetos p
     LEFT JOIN retrabalho_projetos r ON r.projeto_id = p.projeto_id
  WHERE p.ativo = true;

-- view: vw_retrabalho_por_projeto
CREATE OR REPLACE VIEW public.vw_retrabalho_por_projeto AS
 WITH retrabalho_projeto AS (
         SELECT retrabalho_projetos.projeto_id,
            count(retrabalho_projetos.id) FILTER (WHERE retrabalho_projetos.necessitou_retrabalho = true) AS total_retrabalhos_projeto,
            COALESCE(sum(COALESCE(retrabalho_projetos.horas_trabalhadas_total, 0::numeric)), 0::numeric) AS horas_trabalhadas_total,
            COALESCE(sum(COALESCE(retrabalho_projetos.horas_retrabalho, 0::numeric)), 0::numeric) AS horas_retrabalho_total
           FROM retrabalho_projetos
          GROUP BY retrabalho_projetos.projeto_id
        ), engenheiros_projeto AS (
         SELECT engenheiros_projetos.projeto_id,
            count(DISTINCT engenheiros_projetos.eng_id) AS total_engenheiros_projeto
           FROM engenheiros_projetos
          WHERE engenheiros_projetos.ativo = true
          GROUP BY engenheiros_projetos.projeto_id
        )
 SELECT p.projeto_id,
    p.codigo_projeto,
    p.cliente,
    COALESCE(rp.total_retrabalhos_projeto, 0::bigint) AS total_retrabalhos_projeto,
    COALESCE(ep.total_engenheiros_projeto, 0::bigint) AS total_engenheiros_projeto,
    COALESCE(round(rp.horas_retrabalho_total / NULLIF(rp.horas_trabalhadas_total, 0::numeric) * 100::numeric, 2), 0::numeric) AS percentual_retrabalho_projeto,
    COALESCE(rp.horas_trabalhadas_total, 0::numeric) AS horas_trabalhadas_total,
    COALESCE(rp.horas_retrabalho_total, 0::numeric) AS horas_retrabalho_total
   FROM projetos p
     LEFT JOIN retrabalho_projeto rp ON rp.projeto_id = p.projeto_id
     LEFT JOIN engenheiros_projeto ep ON ep.projeto_id = p.projeto_id
  WHERE p.ativo = true AND COALESCE(rp.total_retrabalhos_projeto, 0::bigint) > 0;

-- view: vw_retrabalho_taxa_area_projeto
CREATE OR REPLACE VIEW public.vw_retrabalho_taxa_area_projeto AS
 SELECT projeto_id,
    codigo_projeto,
    cliente,
    area_id,
    area_codigo,
    area,
    total_retrabalhos_area,
    0::bigint AS dias_com_registro,
    percentual_retrabalho_disciplina AS taxa_retrabalho_por_dia,
    horas_trabalhadas_total,
    horas_retrabalho_total,
    percentual_retrabalho_disciplina
   FROM vw_retrabalho_por_area_projeto
  ORDER BY percentual_retrabalho_disciplina DESC;

-- view: vw_retrabalho_detalhes_projeto
CREATE OR REPLACE VIEW public.vw_retrabalho_detalhes_projeto AS
 SELECT r.id AS retrabalho_id,
    r.projeto_id,
    p.codigo_projeto,
    p.cliente,
    r.data_retrabalho,
    ep.eng_id,
    e.nome AS engenheiro_nome,
    r.motivo_retrabalho,
    ep.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    r.horas_trabalhadas_total,
    r.horas_retrabalho
   FROM retrabalho_projetos r
     JOIN projetos p ON p.projeto_id = r.projeto_id
     JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN areas a ON a.area_id = ep.area_id
  WHERE r.necessitou_retrabalho = true
  ORDER BY p.codigo_projeto, a.codigo, r.data_retrabalho DESC;

-- view: vw_dashboard_producao_apontamentos
CREATE OR REPLACE VIEW public.vw_dashboard_producao_apontamentos AS
 SELECT r.id AS apontamento_id,
    r.data_retrabalho,
    ep.eng_id,
    e.nome AS engenheiro,
    ep.projeto_id,
    p.codigo_projeto,
    p.cliente,
    ep.id AS eng_projeto_id,
    ep.area_id,
    a.codigo AS area_codigo,
    a.descricao AS area_descricao,
    ep.instancia_label,
    r.necessitou_retrabalho,
    COALESCE(r.horas_trabalhadas_total, 0::numeric) AS horas_trabalhadas_total,
    COALESCE(r.horas_retrabalho, 0::numeric) AS horas_retrabalho
   FROM retrabalho_projetos r
     JOIN engenheiros_projetos ep ON ep.id = r.eng_projeto_id
     JOIN engenheiros e ON e.eng_id = ep.eng_id
     JOIN projetos p ON p.projeto_id = ep.projeto_id
     JOIN areas a ON a.area_id = ep.area_id;

-- view: vw_projetos_detalhado
CREATE OR REPLACE VIEW public.vw_projetos_detalhado AS
 SELECT ep.id AS atribuicao_id,
    ep.eng_id,
    ep.area_id,
    p.projeto_id,
    p.codigo_projeto,
    COALESCE(p.cliente, 'Sem cliente'::text) AS cliente,
    p.descricao,
    COALESCE(e.nome, 'Sem engenheiro'::text) AS engenheiro_nome,
    a.codigo AS area_codigo,
    COALESCE(a.descricao, 'Sem area'::text) AS area_descricao,
    ep.instancia_label,
        CASE
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) >= 100::numeric THEN 'Concluido'::text
            WHEN COALESCE(ep.percentual_ponderado, 0::numeric) > 0::numeric THEN 'Em Andamento'::text
            ELSE 'Aguardando Inicio'::text
        END AS status_descricao,
    COALESCE(ep.percentual_ponderado, 0::numeric) AS percentual_andamento,
    ep.data_inicio,
    ep.data_prevista,
    ep.data_conclusao,
        CASE
            WHEN ep.data_prevista < CURRENT_DATE AND COALESCE(ep.percentual_ponderado, 0::numeric) < 100::numeric THEN CURRENT_DATE - ep.data_prevista
            ELSE 0
        END AS dias_atraso,
    ep.observacoes AS motivo_aguardo,
    ep.atribuido_por,
    p.ativo,
    p.created_at
   FROM projetos p
     LEFT JOIN engenheiros_projetos ep ON ep.projeto_id = p.projeto_id AND ep.ativo = true
     LEFT JOIN engenheiros e ON e.eng_id = ep.eng_id
     LEFT JOIN areas a ON a.area_id = ep.area_id
  WHERE p.ativo = true;

-- view: vw_atribuicao_apontamentos
CREATE OR REPLACE VIEW public.vw_atribuicao_apontamentos AS
 SELECT pp.eng_projeto_id AS atribuicao_id,
    ep.projeto_id,
    ep.eng_id,
    pp.data_registro,
    pp.previsao_texto,
    pp.feito_texto
   FROM projetos_previsao pp
     JOIN engenheiros_projetos ep ON ep.id = pp.eng_projeto_id
  WHERE pp.previsao_texto IS NOT NULL OR pp.feito_texto IS NOT NULL;

-- -----------------------------------------------------
-- Triggers
-- -----------------------------------------------------

-- trigger: prazos.trg_calcular_prazos
CREATE TRIGGER trg_calcular_prazos BEFORE INSERT OR UPDATE ON prazos FOR EACH ROW EXECUTE FUNCTION calcular_prazos();

-- trigger: engenheiros.trg_engenheiros_updated_at
CREATE TRIGGER trg_engenheiros_updated_at BEFORE UPDATE ON engenheiros FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: projetos.trg_projetos_updated_at
CREATE TRIGGER trg_projetos_updated_at BEFORE UPDATE ON projetos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: engenheiros_projetos.trg_eng_proj_updated_at
CREATE TRIGGER trg_eng_proj_updated_at BEFORE UPDATE ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: engenheiros_projetos.trg_calcular_tempo_trabalho
CREATE TRIGGER trg_calcular_tempo_trabalho BEFORE INSERT OR UPDATE OF area_id ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION calcular_tempo_trabalho();

-- trigger: engenheiros_projetos.trg_calcular_percentual_status
CREATE TRIGGER trg_calcular_percentual_status BEFORE INSERT OR UPDATE OF status_id ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION calcular_percentual_status();

-- trigger: retrabalho_projetos.trg_validar_motivo_retrabalho
CREATE TRIGGER trg_validar_motivo_retrabalho BEFORE INSERT OR UPDATE ON retrabalho_projetos FOR EACH ROW EXECUTE FUNCTION validar_motivo_retrabalho();

-- trigger: retrabalho_projetos.trg_atualizar_status_retrabalho
CREATE TRIGGER trg_atualizar_status_retrabalho BEFORE INSERT ON retrabalho_projetos FOR EACH ROW EXECUTE FUNCTION atualizar_status_retrabalho();

-- trigger: projetos_previsao.trg_preencher_vars_previsao
CREATE TRIGGER trg_preencher_vars_previsao BEFORE INSERT ON projetos_previsao FOR EACH ROW EXECUTE FUNCTION preencher_variaveis_compartilhadas();

-- trigger: retrabalho_projetos.trg_preencher_vars_retrabalho
CREATE TRIGGER trg_preencher_vars_retrabalho BEFORE INSERT ON retrabalho_projetos FOR EACH ROW EXECUTE FUNCTION preencher_variaveis_compartilhadas();

-- trigger: prazos.trg_preencher_vars_prazos
CREATE TRIGGER trg_preencher_vars_prazos BEFORE INSERT ON prazos FOR EACH ROW EXECUTE FUNCTION preencher_variaveis_compartilhadas();

-- trigger: engenheiros_projetos.trg_auto_conclusao
CREATE TRIGGER trg_auto_conclusao BEFORE INSERT OR UPDATE OF status_id ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION auto_preencher_data_conclusao();

-- trigger: engenheiros_projetos.trg_sync_datas_para_prazos
CREATE TRIGGER trg_sync_datas_para_prazos AFTER INSERT OR UPDATE OF data_inicio, data_prevista ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION sync_datas_para_prazos();

-- trigger: prazos.trg_sync_datas_de_prazos
CREATE TRIGGER trg_sync_datas_de_prazos AFTER INSERT OR UPDATE OF data_inicio_projeto, prazo_final_eng ON prazos FOR EACH ROW EXECUTE FUNCTION sync_datas_de_prazos();

-- trigger: engenheiros_projetos.trg_notificar_novo_projeto
CREATE TRIGGER trg_notificar_novo_projeto AFTER INSERT ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION notificar_novo_projeto();

-- trigger: projeto_pavimentos.trg_pav_updated_at
CREATE TRIGGER trg_pav_updated_at BEFORE UPDATE ON projeto_pavimentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: pavimento_etapas.trg_pav_etapa_updated_at
CREATE TRIGGER trg_pav_etapa_updated_at BEFORE UPDATE ON pavimento_etapas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: projeto_etapas_globais.trg_etapa_global_updated_at
CREATE TRIGGER trg_etapa_global_updated_at BEFORE UPDATE ON projeto_etapas_globais FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- trigger: pavimento_etapas.trg_auto_data_conclusao_pav_etapa
CREATE TRIGGER trg_auto_data_conclusao_pav_etapa BEFORE UPDATE OF concluida ON pavimento_etapas FOR EACH ROW EXECUTE FUNCTION auto_data_conclusao_etapa();

-- trigger: projeto_etapas_globais.trg_auto_data_conclusao_etapa_global
CREATE TRIGGER trg_auto_data_conclusao_etapa_global BEFORE UPDATE OF concluida ON projeto_etapas_globais FOR EACH ROW EXECUTE FUNCTION auto_data_conclusao_etapa();

-- trigger: evandro_distribuicao_tasks.trg_sincronizar_task
CREATE TRIGGER trg_sincronizar_task BEFORE INSERT ON evandro_distribuicao_tasks FOR EACH ROW EXECUTE FUNCTION sincronizar_task_para_engenheiro();

-- trigger: evandro_distribuicao_tasks.trg_notificar_task
CREATE TRIGGER trg_notificar_task AFTER INSERT ON evandro_distribuicao_tasks FOR EACH ROW EXECUTE FUNCTION notificar_task_criada();

-- trigger: engenheiros_projetos.trg_registrar_mudanca_status
CREATE TRIGGER trg_registrar_mudanca_status AFTER UPDATE ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION registrar_mudanca_status();

-- trigger: engenheiros_projetos.trg_validar_instancia_engenheiros_projetos
CREATE TRIGGER trg_validar_instancia_engenheiros_projetos BEFORE INSERT OR UPDATE OF eng_id, projeto_id, area_id, instancia_label, complemento_area_ref_id, ativo ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION validar_instancia_engenheiros_projetos();

-- trigger: pavimento_etapas.trg_recalc_etapa_pavimento
CREATE TRIGGER trg_recalc_etapa_pavimento AFTER INSERT OR DELETE OR UPDATE OF concluida, peso, ativo ON pavimento_etapas FOR EACH ROW EXECUTE FUNCTION atualizar_progresso_area();

-- trigger: projeto_etapas_globais.trg_recalc_etapa_global
CREATE TRIGGER trg_recalc_etapa_global AFTER INSERT OR DELETE OR UPDATE OF concluida, peso, ativo ON projeto_etapas_globais FOR EACH ROW EXECUTE FUNCTION atualizar_progresso_area();

-- trigger: projeto_pavimentos.trg_recalc_pavimento
CREATE TRIGGER trg_recalc_pavimento AFTER INSERT OR DELETE OR UPDATE OF peso, ativo ON projeto_pavimentos FOR EACH ROW EXECUTE FUNCTION atualizar_progresso_area();

-- trigger: engenheiros_projetos.trg_seed_pav_etapa
CREATE TRIGGER trg_seed_pav_etapa AFTER INSERT OR UPDATE OF area_id, ativo ON engenheiros_projetos FOR EACH ROW EXECUTE FUNCTION trg_seed_on_atribuicao();

-- -----------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------

-- rls: engenheiros
ALTER TABLE public.engenheiros ENABLE ROW LEVEL SECURITY;

-- rls: areas
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

-- rls: status_codes
ALTER TABLE public.status_codes ENABLE ROW LEVEL SECURITY;

-- rls: projetos
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- rls: engenheiros_projetos
ALTER TABLE public.engenheiros_projetos ENABLE ROW LEVEL SECURITY;

-- rls: projetos_previsao
ALTER TABLE public.projetos_previsao ENABLE ROW LEVEL SECURITY;

-- rls: retrabalho_projetos
ALTER TABLE public.retrabalho_projetos ENABLE ROW LEVEL SECURITY;

-- rls: prazos
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

-- rls: dono_empresa
ALTER TABLE public.dono_empresa ENABLE ROW LEVEL SECURITY;

-- rls: complexidade_tarefas
ALTER TABLE public.complexidade_tarefas ENABLE ROW LEVEL SECURITY;

-- rls: evandro_distribuicao_tasks
ALTER TABLE public.evandro_distribuicao_tasks ENABLE ROW LEVEL SECURITY;

-- rls: notificacoes_whatsapp
ALTER TABLE public.notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

-- rls: chatbot_logs
ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

-- rls: tipos_obra
ALTER TABLE public.tipos_obra ENABLE ROW LEVEL SECURITY;

-- rls: motivos_retrabalho
ALTER TABLE public.motivos_retrabalho ENABLE ROW LEVEL SECURITY;

-- rls: tipos_projeto
ALTER TABLE public.tipos_projeto ENABLE ROW LEVEL SECURITY;

-- rls: projeto_pavimentos
ALTER TABLE public.projeto_pavimentos ENABLE ROW LEVEL SECURITY;

-- rls: pavimento_etapas
ALTER TABLE public.pavimento_etapas ENABLE ROW LEVEL SECURITY;

-- rls: projeto_etapas_globais
ALTER TABLE public.projeto_etapas_globais ENABLE ROW LEVEL SECURITY;

-- rls: area_pavimentos_template
ALTER TABLE public.area_pavimentos_template ENABLE ROW LEVEL SECURITY;

-- rls: area_etapas_template
ALTER TABLE public.area_etapas_template ENABLE ROW LEVEL SECURITY;

-- rls: user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- rls: status_historico
ALTER TABLE public.status_historico ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Policies
-- -----------------------------------------------------

-- policy: user_profiles.profiles_select_own
CREATE POLICY profiles_select_own ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- policy: engenheiros_projetos.auth_all_engenheiros_projetos
CREATE POLICY auth_all_engenheiros_projetos ON public.engenheiros_projetos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: areas.auth_all_areas
CREATE POLICY auth_all_areas ON public.areas AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: status_codes.auth_all_status_codes
CREATE POLICY auth_all_status_codes ON public.status_codes AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: engenheiros.auth_all_engenheiros
CREATE POLICY auth_all_engenheiros ON public.engenheiros AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: projetos_previsao.auth_all_projetos_previsao
CREATE POLICY auth_all_projetos_previsao ON public.projetos_previsao AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: projetos.auth_all_projetos
CREATE POLICY auth_all_projetos ON public.projetos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: retrabalho_projetos.auth_all_retrabalho_projetos
CREATE POLICY auth_all_retrabalho_projetos ON public.retrabalho_projetos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: prazos.auth_all_prazos
CREATE POLICY auth_all_prazos ON public.prazos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: dono_empresa.auth_all_dono_empresa
CREATE POLICY auth_all_dono_empresa ON public.dono_empresa AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: evandro_distribuicao_tasks.auth_all_evandro_distribuicao_tasks
CREATE POLICY auth_all_evandro_distribuicao_tasks ON public.evandro_distribuicao_tasks AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: complexidade_tarefas.auth_all_complexidade_tarefas
CREATE POLICY auth_all_complexidade_tarefas ON public.complexidade_tarefas AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: notificacoes_whatsapp.auth_all_notificacoes_whatsapp
CREATE POLICY auth_all_notificacoes_whatsapp ON public.notificacoes_whatsapp AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: chatbot_logs.auth_all_chatbot_logs
CREATE POLICY auth_all_chatbot_logs ON public.chatbot_logs AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: area_pavimentos_template.auth_all_area_pavimentos_template
CREATE POLICY auth_all_area_pavimentos_template ON public.area_pavimentos_template AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: tipos_obra.auth_all_tipos_obra
CREATE POLICY auth_all_tipos_obra ON public.tipos_obra AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: motivos_retrabalho.auth_all_motivos_retrabalho
CREATE POLICY auth_all_motivos_retrabalho ON public.motivos_retrabalho AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: tipos_projeto.auth_all_tipos_projeto
CREATE POLICY auth_all_tipos_projeto ON public.tipos_projeto AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: area_etapas_template.auth_all_area_etapas_template
CREATE POLICY auth_all_area_etapas_template ON public.area_etapas_template AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: projeto_pavimentos.auth_all_projeto_pavimentos
CREATE POLICY auth_all_projeto_pavimentos ON public.projeto_pavimentos AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: pavimento_etapas.auth_all_pavimento_etapas
CREATE POLICY auth_all_pavimento_etapas ON public.pavimento_etapas AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- policy: projeto_etapas_globais.auth_all_projeto_etapas_globais
CREATE POLICY auth_all_projeto_etapas_globais ON public.projeto_etapas_globais AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- -----------------------------------------------------
-- Permissoes
-- -----------------------------------------------------

-- permissao: engenheiros
REVOKE ALL ON TABLE public.engenheiros FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.engenheiros TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.engenheiros TO authenticated;

-- permissao: areas
REVOKE ALL ON TABLE public.areas FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.areas TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.areas TO authenticated;

-- permissao: status_codes_status_id_seq
REVOKE ALL ON SEQUENCE public.status_codes_status_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public.status_codes_status_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.status_codes_status_id_seq TO service_role;

-- permissao: status_codes
REVOKE ALL ON TABLE public.status_codes FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.status_codes TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.status_codes TO authenticated;

-- permissao: projetos
REVOKE ALL ON TABLE public.projetos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.projetos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.projetos TO authenticated;

-- permissao: engenheiros_projetos
REVOKE ALL ON TABLE public.engenheiros_projetos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.engenheiros_projetos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.engenheiros_projetos TO authenticated;

-- permissao: projetos_previsao
REVOKE ALL ON TABLE public.projetos_previsao FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.projetos_previsao TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.projetos_previsao TO authenticated;

-- permissao: retrabalho_projetos
REVOKE ALL ON TABLE public.retrabalho_projetos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.retrabalho_projetos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.retrabalho_projetos TO authenticated;

-- permissao: prazos
REVOKE ALL ON TABLE public.prazos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.prazos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.prazos TO authenticated;

-- permissao: dono_empresa
REVOKE ALL ON TABLE public.dono_empresa FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.dono_empresa TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.dono_empresa TO authenticated;

-- permissao: complexidade_tarefas_complexidade_id_seq
REVOKE ALL ON SEQUENCE public.complexidade_tarefas_complexidade_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public.complexidade_tarefas_complexidade_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.complexidade_tarefas_complexidade_id_seq TO service_role;

-- permissao: complexidade_tarefas
REVOKE ALL ON TABLE public.complexidade_tarefas FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.complexidade_tarefas TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.complexidade_tarefas TO authenticated;

-- permissao: evandro_distribuicao_tasks
REVOKE ALL ON TABLE public.evandro_distribuicao_tasks FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.evandro_distribuicao_tasks TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.evandro_distribuicao_tasks TO authenticated;

-- permissao: notificacoes_whatsapp
REVOKE ALL ON TABLE public.notificacoes_whatsapp FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.notificacoes_whatsapp TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.notificacoes_whatsapp TO authenticated;

-- permissao: chatbot_logs
REVOKE ALL ON TABLE public.chatbot_logs FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.chatbot_logs TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.chatbot_logs TO authenticated;

-- permissao: vw_quantidade_retrabalhos
REVOKE ALL ON TABLE public.vw_quantidade_retrabalhos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_quantidade_retrabalhos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_quantidade_retrabalhos TO authenticated;

-- permissao: vw_engenheiros_projetos
REVOKE ALL ON TABLE public.vw_engenheiros_projetos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_engenheiros_projetos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_engenheiros_projetos TO authenticated;

-- permissao: vw_resumo_engenheiros
REVOKE ALL ON TABLE public.vw_resumo_engenheiros FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_resumo_engenheiros TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_resumo_engenheiros TO authenticated;

-- permissao: vw_projetos_completo
REVOKE ALL ON TABLE public.vw_projetos_completo FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_projetos_completo TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_projetos_completo TO authenticated;

-- permissao: vw_dono_visao_geral
REVOKE ALL ON TABLE public.vw_dono_visao_geral FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dono_visao_geral TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dono_visao_geral TO authenticated;

-- permissao: vw_dono_engenheiro_detalhado
REVOKE ALL ON TABLE public.vw_dono_engenheiro_detalhado FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dono_engenheiro_detalhado TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dono_engenheiro_detalhado TO authenticated;

-- permissao: vw_dono_retrabalhos_historico
REVOKE ALL ON TABLE public.vw_dono_retrabalhos_historico FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dono_retrabalhos_historico TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dono_retrabalhos_historico TO authenticated;

-- permissao: vw_dono_retrabalhos_por_motivo
REVOKE ALL ON TABLE public.vw_dono_retrabalhos_por_motivo FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dono_retrabalhos_por_motivo TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dono_retrabalhos_por_motivo TO authenticated;

-- permissao: vw_dono_taxa_execucao_ranking
REVOKE ALL ON TABLE public.vw_dono_taxa_execucao_ranking FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dono_taxa_execucao_ranking TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dono_taxa_execucao_ranking TO authenticated;

-- permissao: tipos_obra
REVOKE ALL ON TABLE public.tipos_obra FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tipos_obra TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.tipos_obra TO authenticated;

-- permissao: motivos_retrabalho
REVOKE ALL ON TABLE public.motivos_retrabalho FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.motivos_retrabalho TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.motivos_retrabalho TO authenticated;

-- permissao: tipos_projeto
REVOKE ALL ON TABLE public.tipos_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.tipos_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.tipos_projeto TO authenticated;

-- permissao: vw_tipos_projeto
REVOKE ALL ON TABLE public.vw_tipos_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_tipos_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_tipos_projeto TO authenticated;

-- permissao: vw_percentual_retrabalho_geral
REVOKE ALL ON TABLE public.vw_percentual_retrabalho_geral FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_percentual_retrabalho_geral TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_percentual_retrabalho_geral TO authenticated;

-- permissao: vw_bloco2_atrasos_engenheiro
REVOKE ALL ON TABLE public.vw_bloco2_atrasos_engenheiro FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco2_atrasos_engenheiro TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco2_atrasos_engenheiro TO authenticated;

-- permissao: vw_bloco2_atrasos_area
REVOKE ALL ON TABLE public.vw_bloco2_atrasos_area FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco2_atrasos_area TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco2_atrasos_area TO authenticated;

-- permissao: vw_bloco5_retrabalho_engenheiro
REVOKE ALL ON TABLE public.vw_bloco5_retrabalho_engenheiro FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco5_retrabalho_engenheiro TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco5_retrabalho_engenheiro TO authenticated;

-- permissao: vw_bloco5_retrabalho_area
REVOKE ALL ON TABLE public.vw_bloco5_retrabalho_area FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco5_retrabalho_area TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco5_retrabalho_area TO authenticated;

-- permissao: vw_grafico_atrasos_engenheiro
REVOKE ALL ON TABLE public.vw_grafico_atrasos_engenheiro FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_grafico_atrasos_engenheiro TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_grafico_atrasos_engenheiro TO authenticated;

-- permissao: vw_grafico_retrabalho_area
REVOKE ALL ON TABLE public.vw_grafico_retrabalho_area FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_grafico_retrabalho_area TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_grafico_retrabalho_area TO authenticated;

-- permissao: vw_retrabalho_por_area_projeto
REVOKE ALL ON TABLE public.vw_retrabalho_por_area_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_por_area_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_por_area_projeto TO authenticated;

-- permissao: vw_retrabalho_motivos_por_projeto
REVOKE ALL ON TABLE public.vw_retrabalho_motivos_por_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_motivos_por_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_motivos_por_projeto TO authenticated;

-- permissao: projeto_pavimentos
REVOKE ALL ON TABLE public.projeto_pavimentos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.projeto_pavimentos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.projeto_pavimentos TO authenticated;

-- permissao: pavimento_etapas
REVOKE ALL ON TABLE public.pavimento_etapas FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.pavimento_etapas TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.pavimento_etapas TO authenticated;

-- permissao: projeto_etapas_globais
REVOKE ALL ON TABLE public.projeto_etapas_globais FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.projeto_etapas_globais TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.projeto_etapas_globais TO authenticated;

-- permissao: vw_progresso_ponderado
REVOKE ALL ON TABLE public.vw_progresso_ponderado FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_progresso_ponderado TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_progresso_ponderado TO authenticated;

-- permissao: area_pavimentos_template_id_seq
REVOKE ALL ON SEQUENCE public.area_pavimentos_template_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public.area_pavimentos_template_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.area_pavimentos_template_id_seq TO service_role;

-- permissao: area_pavimentos_template
REVOKE ALL ON TABLE public.area_pavimentos_template FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.area_pavimentos_template TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.area_pavimentos_template TO authenticated;

-- permissao: area_etapas_template_id_seq
REVOKE ALL ON SEQUENCE public.area_etapas_template_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON SEQUENCE public.area_etapas_template_id_seq TO authenticated;
GRANT SELECT, UPDATE, USAGE ON SEQUENCE public.area_etapas_template_id_seq TO service_role;

-- permissao: area_etapas_template
REVOKE ALL ON TABLE public.area_etapas_template FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.area_etapas_template TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.area_etapas_template TO authenticated;

-- permissao: user_profiles
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.user_profiles TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.user_profiles TO authenticated;

-- permissao: vw_grafico_projetos_status
REVOKE ALL ON TABLE public.vw_grafico_projetos_status FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_grafico_projetos_status TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_grafico_projetos_status TO authenticated;

-- permissao: vw_bloco1_visao_geral
REVOKE ALL ON TABLE public.vw_bloco1_visao_geral FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco1_visao_geral TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco1_visao_geral TO authenticated;

-- permissao: vw_bloco3_carga_trabalho
REVOKE ALL ON TABLE public.vw_bloco3_carga_trabalho FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco3_carga_trabalho TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco3_carga_trabalho TO authenticated;

-- permissao: vw_bloco4_execucao_media
REVOKE ALL ON TABLE public.vw_bloco4_execucao_media FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_bloco4_execucao_media TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_bloco4_execucao_media TO authenticated;

-- permissao: vw_grafico_carga_trabalho
REVOKE ALL ON TABLE public.vw_grafico_carga_trabalho FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_grafico_carga_trabalho TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_grafico_carga_trabalho TO authenticated;

-- permissao: status_historico
REVOKE ALL ON TABLE public.status_historico FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.status_historico TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.status_historico TO authenticated;

-- permissao: vw_relatorio_projeto_pdf
REVOKE ALL ON TABLE public.vw_relatorio_projeto_pdf FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_relatorio_projeto_pdf TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_relatorio_projeto_pdf TO authenticated;

-- permissao: vw_relatorio_disciplinas_projeto
REVOKE ALL ON TABLE public.vw_relatorio_disciplinas_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_relatorio_disciplinas_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_relatorio_disciplinas_projeto TO authenticated;

-- permissao: vw_retrabalho_geral
REVOKE ALL ON TABLE public.vw_retrabalho_geral FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_geral TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_geral TO authenticated;

-- permissao: vw_retrabalho_por_projeto
REVOKE ALL ON TABLE public.vw_retrabalho_por_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_por_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_por_projeto TO authenticated;

-- permissao: vw_retrabalho_taxa_area_projeto
REVOKE ALL ON TABLE public.vw_retrabalho_taxa_area_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_taxa_area_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_taxa_area_projeto TO authenticated;

-- permissao: vw_retrabalho_detalhes_projeto
REVOKE ALL ON TABLE public.vw_retrabalho_detalhes_projeto FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_retrabalho_detalhes_projeto TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_retrabalho_detalhes_projeto TO authenticated;

-- permissao: vw_dashboard_producao_apontamentos
REVOKE ALL ON TABLE public.vw_dashboard_producao_apontamentos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_dashboard_producao_apontamentos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_dashboard_producao_apontamentos TO authenticated;

-- permissao: vw_projetos_detalhado
REVOKE ALL ON TABLE public.vw_projetos_detalhado FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_projetos_detalhado TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_projetos_detalhado TO authenticated;

-- permissao: vw_atribuicao_apontamentos
REVOKE ALL ON TABLE public.vw_atribuicao_apontamentos FROM PUBLIC, anon, authenticated, service_role;
GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.vw_atribuicao_apontamentos TO service_role;
GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER ON TABLE public.vw_atribuicao_apontamentos TO authenticated;

-- permissao: cadastrar_engenheiro(text,boolean)
REVOKE ALL ON FUNCTION cadastrar_engenheiro(text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION cadastrar_engenheiro(text,boolean) TO service_role;

-- permissao: atualizar_engenheiro(uuid,text,boolean)
REVOKE ALL ON FUNCTION atualizar_engenheiro(uuid,text,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_engenheiro(uuid,text,boolean) TO service_role;

-- permissao: criar_projeto(text,text,text)
REVOKE ALL ON FUNCTION criar_projeto(text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION criar_projeto(text,text,text) TO service_role;

-- permissao: atribuir_area_projeto(uuid,uuid,text,date,date,text)
REVOKE ALL ON FUNCTION atribuir_area_projeto(uuid,uuid,text,date,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atribuir_area_projeto(uuid,uuid,text,date,date,text) TO service_role;

-- permissao: atualizar_status_projeto(uuid,text)
REVOKE ALL ON FUNCTION atualizar_status_projeto(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_status_projeto(uuid,text) TO service_role;

-- permissao: atualizar_previsao(uuid,date)
REVOKE ALL ON FUNCTION atualizar_previsao(uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_previsao(uuid,date) TO service_role;

-- permissao: registrar_retrabalho(uuid,text,text)
REVOKE ALL ON FUNCTION registrar_retrabalho(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION registrar_retrabalho(uuid,text,text) TO service_role;

-- permissao: buscar_meus_projetos(uuid)
REVOKE ALL ON FUNCTION buscar_meus_projetos(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION buscar_meus_projetos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_meus_projetos(uuid) TO service_role;

-- permissao: listar_areas_disponiveis()
REVOKE ALL ON FUNCTION listar_areas_disponiveis() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_areas_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION listar_areas_disponiveis() TO service_role;

-- permissao: listar_status_disponiveis()
REVOKE ALL ON FUNCTION listar_status_disponiveis() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_status_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION listar_status_disponiveis() TO service_role;

-- permissao: processar_prompt_chatbot(uuid,text,jsonb)
REVOKE ALL ON FUNCTION processar_prompt_chatbot(uuid,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION processar_prompt_chatbot(uuid,text,jsonb) TO service_role;

-- permissao: registrar_previsao_dia(uuid,text,integer,date)
REVOKE ALL ON FUNCTION registrar_previsao_dia(uuid,text,integer,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION registrar_previsao_dia(uuid,text,integer,date) TO service_role;

-- permissao: atualizar_feito_dia(uuid,text,date)
REVOKE ALL ON FUNCTION atualizar_feito_dia(uuid,text,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_feito_dia(uuid,text,date) TO service_role;

-- permissao: criar_atualizar_prazos(uuid,date,date,date,date,text)
REVOKE ALL ON FUNCTION criar_atualizar_prazos(uuid,date,date,date,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION criar_atualizar_prazos(uuid,date,date,date,date,text) TO service_role;

-- permissao: buscar_historico_previsoes(uuid,integer)
REVOKE ALL ON FUNCTION buscar_historico_previsoes(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION buscar_historico_previsoes(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_historico_previsoes(uuid,integer) TO service_role;

-- permissao: buscar_historico_retrabalhos(uuid)
REVOKE ALL ON FUNCTION buscar_historico_retrabalhos(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION buscar_historico_retrabalhos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION buscar_historico_retrabalhos(uuid) TO service_role;

-- permissao: calcular_prazos()
REVOKE ALL ON FUNCTION calcular_prazos() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_prazos() TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_prazos() TO service_role;

-- permissao: dono_distribuir_tarefa(uuid,uuid,text,text,uuid,text,text,text,date,date,text)
REVOKE ALL ON FUNCTION dono_distribuir_tarefa(uuid,uuid,text,text,uuid,text,text,text,date,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_distribuir_tarefa(uuid,uuid,text,text,uuid,text,text,text,date,date,text) TO service_role;

-- permissao: dono_consultar_status_engenheiro(uuid,uuid)
REVOKE ALL ON FUNCTION dono_consultar_status_engenheiro(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_consultar_status_engenheiro(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION dono_consultar_status_engenheiro(uuid,uuid) TO service_role;

-- permissao: dono_consultar_todos_engenheiros(uuid)
REVOKE ALL ON FUNCTION dono_consultar_todos_engenheiros(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_consultar_todos_engenheiros(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION dono_consultar_todos_engenheiros(uuid) TO service_role;

-- permissao: dono_buscar_historico_retrabalhos(uuid,uuid,uuid,date,date)
REVOKE ALL ON FUNCTION dono_buscar_historico_retrabalhos(uuid,uuid,uuid,date,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_buscar_historico_retrabalhos(uuid,uuid,uuid,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION dono_buscar_historico_retrabalhos(uuid,uuid,uuid,date,date) TO service_role;

-- permissao: dono_recomendar_engenheiro(uuid,integer)
REVOKE ALL ON FUNCTION dono_recomendar_engenheiro(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_recomendar_engenheiro(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION dono_recomendar_engenheiro(uuid,integer) TO service_role;

-- permissao: processar_fila_notificacoes()
REVOKE ALL ON FUNCTION processar_fila_notificacoes() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION processar_fila_notificacoes() TO service_role;

-- permissao: marcar_notificacao_enviada(uuid,boolean,text)
REVOKE ALL ON FUNCTION marcar_notificacao_enviada(uuid,boolean,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marcar_notificacao_enviada(uuid,boolean,text) TO service_role;

-- permissao: update_updated_at_column()
REVOKE ALL ON FUNCTION update_updated_at_column() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;

-- permissao: calcular_tempo_trabalho()
REVOKE ALL ON FUNCTION calcular_tempo_trabalho() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_tempo_trabalho() TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_tempo_trabalho() TO service_role;

-- permissao: calcular_percentual_status()
REVOKE ALL ON FUNCTION calcular_percentual_status() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_percentual_status() TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_percentual_status() TO service_role;

-- permissao: validar_motivo_retrabalho()
REVOKE ALL ON FUNCTION validar_motivo_retrabalho() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION validar_motivo_retrabalho() TO authenticated;
GRANT EXECUTE ON FUNCTION validar_motivo_retrabalho() TO service_role;

-- permissao: atualizar_status_retrabalho()
REVOKE ALL ON FUNCTION atualizar_status_retrabalho() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_status_retrabalho() TO authenticated;
GRANT EXECUTE ON FUNCTION atualizar_status_retrabalho() TO service_role;

-- permissao: preencher_variaveis_compartilhadas()
REVOKE ALL ON FUNCTION preencher_variaveis_compartilhadas() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION preencher_variaveis_compartilhadas() TO authenticated;
GRANT EXECUTE ON FUNCTION preencher_variaveis_compartilhadas() TO service_role;

-- permissao: listar_tipos_obra()
REVOKE ALL ON FUNCTION listar_tipos_obra() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_tipos_obra() TO authenticated;
GRANT EXECUTE ON FUNCTION listar_tipos_obra() TO service_role;

-- permissao: listar_motivos_retrabalho()
REVOKE ALL ON FUNCTION listar_motivos_retrabalho() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_motivos_retrabalho() TO authenticated;
GRANT EXECUTE ON FUNCTION listar_motivos_retrabalho() TO service_role;

-- permissao: gerar_proximo_codigo_projeto()
REVOKE ALL ON FUNCTION gerar_proximo_codigo_projeto() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION gerar_proximo_codigo_projeto() TO service_role;

-- permissao: listar_tipos_projeto_por_area(text)
REVOKE ALL ON FUNCTION listar_tipos_projeto_por_area(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_tipos_projeto_por_area(text) TO authenticated;
GRANT EXECUTE ON FUNCTION listar_tipos_projeto_por_area(text) TO service_role;

-- permissao: listar_tipos_projeto()
REVOKE ALL ON FUNCTION listar_tipos_projeto() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION listar_tipos_projeto() TO authenticated;
GRANT EXECUTE ON FUNCTION listar_tipos_projeto() TO service_role;

-- permissao: sincronizar_task_para_engenheiro()
REVOKE ALL ON FUNCTION sincronizar_task_para_engenheiro() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sincronizar_task_para_engenheiro() TO authenticated;
GRANT EXECUTE ON FUNCTION sincronizar_task_para_engenheiro() TO service_role;

-- permissao: sync_datas_para_prazos()
REVOKE ALL ON FUNCTION sync_datas_para_prazos() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_datas_para_prazos() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_datas_para_prazos() TO service_role;

-- permissao: sync_datas_de_prazos()
REVOKE ALL ON FUNCTION sync_datas_de_prazos() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_datas_de_prazos() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_datas_de_prazos() TO service_role;

-- permissao: auto_preencher_data_conclusao()
REVOKE ALL ON FUNCTION auto_preencher_data_conclusao() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auto_preencher_data_conclusao() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_preencher_data_conclusao() TO service_role;

-- permissao: dono_distribuir_projeto_com_prazos(uuid,uuid,uuid,text,date,date,date,date,text)
REVOKE ALL ON FUNCTION dono_distribuir_projeto_com_prazos(uuid,uuid,uuid,text,date,date,date,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dono_distribuir_projeto_com_prazos(uuid,uuid,uuid,text,date,date,date,date,text) TO service_role;

-- permissao: notificar_novo_projeto()
REVOKE ALL ON FUNCTION notificar_novo_projeto() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION notificar_novo_projeto() TO authenticated;
GRANT EXECUTE ON FUNCTION notificar_novo_projeto() TO service_role;

-- permissao: calcular_progresso_ponderado(uuid)
REVOKE ALL ON FUNCTION calcular_progresso_ponderado(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_progresso_ponderado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_progresso_ponderado(uuid) TO service_role;

-- permissao: atualizar_percentual_ponderado()
REVOKE ALL ON FUNCTION atualizar_percentual_ponderado() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_percentual_ponderado() TO authenticated;
GRANT EXECUTE ON FUNCTION atualizar_percentual_ponderado() TO service_role;

-- permissao: auto_data_conclusao_etapa()
REVOKE ALL ON FUNCTION auto_data_conclusao_etapa() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auto_data_conclusao_etapa() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_data_conclusao_etapa() TO service_role;

-- permissao: trg_seed_on_atribuicao()
REVOKE ALL ON FUNCTION trg_seed_on_atribuicao() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION trg_seed_on_atribuicao() TO authenticated;
GRANT EXECUTE ON FUNCTION trg_seed_on_atribuicao() TO service_role;

-- permissao: sync_conclusao_por_ponderado()
REVOKE ALL ON FUNCTION sync_conclusao_por_ponderado() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_conclusao_por_ponderado() TO authenticated;
GRANT EXECUTE ON FUNCTION sync_conclusao_por_ponderado() TO service_role;

-- permissao: marcar_projeto_concluido(uuid,boolean)
REVOKE ALL ON FUNCTION marcar_projeto_concluido(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marcar_projeto_concluido(uuid,boolean) TO service_role;

-- permissao: recalcular_rollup_projeto(uuid)
REVOKE ALL ON FUNCTION recalcular_rollup_projeto(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION recalcular_rollup_projeto(uuid) TO service_role;

-- permissao: atualizar_progresso_area()
REVOKE ALL ON FUNCTION atualizar_progresso_area() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION atualizar_progresso_area() TO authenticated;
GRANT EXECUTE ON FUNCTION atualizar_progresso_area() TO service_role;

-- permissao: limpar_projetos_finalizados_antigos(integer,boolean)
REVOKE ALL ON FUNCTION limpar_projetos_finalizados_antigos(integer,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION limpar_projetos_finalizados_antigos(integer,boolean) TO service_role;

-- permissao: normalizar_label_compatibilizacao(text,integer)
REVOKE ALL ON FUNCTION normalizar_label_compatibilizacao(text,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION normalizar_label_compatibilizacao(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION normalizar_label_compatibilizacao(text,integer) TO service_role;

-- permissao: validar_instancia_engenheiros_projetos()
REVOKE ALL ON FUNCTION validar_instancia_engenheiros_projetos() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION validar_instancia_engenheiros_projetos() TO authenticated;
GRANT EXECUTE ON FUNCTION validar_instancia_engenheiros_projetos() TO service_role;

-- permissao: transferir_atribuicao(uuid,uuid,text,uuid)
REVOKE ALL ON FUNCTION transferir_atribuicao(uuid,uuid,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION transferir_atribuicao(uuid,uuid,text,uuid) TO service_role;

-- permissao: desativar_atribuicao(uuid,text,uuid)
REVOKE ALL ON FUNCTION desativar_atribuicao(uuid,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desativar_atribuicao(uuid,text,uuid) TO service_role;

-- permissao: notificar_task_criada()
REVOKE ALL ON FUNCTION notificar_task_criada() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION notificar_task_criada() TO authenticated;
GRANT EXECUTE ON FUNCTION notificar_task_criada() TO service_role;

-- permissao: desativar_projeto_completo(uuid,text,uuid)
REVOKE ALL ON FUNCTION desativar_projeto_completo(uuid,text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION desativar_projeto_completo(uuid,text,uuid) TO service_role;

-- permissao: verificar_atribuicao_info(uuid)
REVOKE ALL ON FUNCTION verificar_atribuicao_info(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION verificar_atribuicao_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION verificar_atribuicao_info(uuid) TO service_role;

-- permissao: registrar_mudanca_status()
REVOKE ALL ON FUNCTION registrar_mudanca_status() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION registrar_mudanca_status() TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_mudanca_status() TO service_role;

-- permissao: dashboard_atribuir_projeto_com_pavimentos(text,text,text,uuid,uuid,text,date,text[],text,uuid)
REVOKE ALL ON FUNCTION dashboard_atribuir_projeto_com_pavimentos(text,text,text,uuid,uuid,text,date,text[],text,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION dashboard_atribuir_projeto_com_pavimentos(text,text,text,uuid,uuid,text,date,text[],text,uuid) TO service_role;

-- permissao: seed_pavimentos_etapas(uuid,uuid,uuid)
REVOKE ALL ON FUNCTION seed_pavimentos_etapas(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_pavimentos_etapas(uuid,uuid,uuid) TO service_role;

-- permissao: ajustar_residuo_pesos(uuid,uuid,uuid)
REVOKE ALL ON FUNCTION ajustar_residuo_pesos(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ajustar_residuo_pesos(uuid,uuid,uuid) TO service_role;

-- permissao: calcular_progresso_area(uuid,uuid,uuid)
REVOKE ALL ON FUNCTION calcular_progresso_area(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION calcular_progresso_area(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calcular_progresso_area(uuid,uuid,uuid) TO service_role;

-- permissao: marcar_area_concluida(uuid,uuid,boolean,uuid)
REVOKE ALL ON FUNCTION marcar_area_concluida(uuid,uuid,boolean,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION marcar_area_concluida(uuid,uuid,boolean,uuid) TO service_role;

-- permissao: configurar_pavimentos_customizados_area(uuid,uuid,text[],uuid)
REVOKE ALL ON FUNCTION configurar_pavimentos_customizados_area(uuid,uuid,text[],uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION configurar_pavimentos_customizados_area(uuid,uuid,text[],uuid) TO service_role;

-- permissao: hoje_brt()
REVOKE ALL ON FUNCTION hoje_brt() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION hoje_brt() TO authenticated;
GRANT EXECUTE ON FUNCTION hoje_brt() TO service_role;

-- permissao: registrar_retrabalho_dia(uuid,boolean,text,text,text,numeric,numeric,date)
REVOKE ALL ON FUNCTION registrar_retrabalho_dia(uuid,boolean,text,text,text,numeric,numeric,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION registrar_retrabalho_dia(uuid,boolean,text,text,text,numeric,numeric,date) TO service_role;

-- -----------------------------------------------------
-- Privilegios padrao (so registro)
-- -----------------------------------------------------

-- privilegio_padrao: postgres r
-- default privileges de postgres em public para objetos tabela: {postgres=arwdDxtm/postgres,authenticated=rxtm/postgres,service_role=arwdDxtm/postgres}

-- privilegio_padrao: postgres f
-- default privileges de postgres em public para objetos funcao: {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}

-- privilegio_padrao: postgres S
-- default privileges de postgres em public para objetos sequencia: {postgres=rwU/postgres,authenticated=r/postgres,service_role=rwU/postgres}

-- privilegio_padrao: supabase_admin S
-- default privileges de supabase_admin em public para objetos sequencia: {postgres=rwU/supabase_admin,anon=rwU/supabase_admin,authenticated=rwU/supabase_admin,service_role=rwU/supabase_admin}

-- privilegio_padrao: supabase_admin r
-- default privileges de supabase_admin em public para objetos tabela: {postgres=arwdDxtm/supabase_admin,anon=arwdDxtm/supabase_admin,authenticated=arwdDxtm/supabase_admin,service_role=arwdDxtm/supabase_admin}

-- privilegio_padrao: supabase_admin f
-- default privileges de supabase_admin em public para objetos funcao: {postgres=X/supabase_admin,anon=X/supabase_admin,authenticated=X/supabase_admin,service_role=X/supabase_admin}

