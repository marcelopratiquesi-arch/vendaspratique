-- =====================================================================
-- LOGIN COM GOOGLE E ACESSO PESSOAL (12/11/2026, decisão do dono)
-- PASSO 0: CÓPIA DE SEGURANÇA (rode primeiro). Só copia, não muda nada.
--   1) a tabela de logins (usuarios_sistema) e os vínculos dos Mentores
--   2) o TEXTO atual das funções que dizem "quem é a pessoa" (elas foram criadas direto no Supabase e não estão
--      nos arquivos do projeto). O passo 2 acrescenta a trava POR CIMA delas, sem mudar o que já fazem.
-- No fim, MANDE O RESULTADO da última consulta (o texto das funções) para conferência.
-- =====================================================================

create table if not exists public.usuarios_sistema_backup_20261112 as select * from public.usuarios_sistema;
alter table public.usuarios_sistema_backup_20261112 enable row level security;

create table if not exists public.mentor_unidades_backup_20261112 as select * from public.mentor_unidades;
alter table public.mentor_unidades_backup_20261112 enable row level security;

create table if not exists public.seg_backup_funcoes_20261112 as
  select now() as copiado_em, p.proname as funcao, pg_get_function_identity_arguments(p.oid) as argumentos,
         pg_get_functiondef(p.oid) as definicao
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('seg_papel', 'seg_unidade', 'get_user_colaborador_info', 'crm_eh_funcionario');
alter table public.seg_backup_funcoes_20261112 enable row level security;

-- Conferência (MANDE ESTE RESULTADO)
select 'logins copiados' as item, count(*)::text as valor from public.usuarios_sistema_backup_20261112
union all select 'logins hoje', count(*)::text from public.usuarios_sistema
union all select 'vínculos de Mentor copiados', count(*)::text from public.mentor_unidades_backup_20261112
union all select 'funções copiadas (esperado 4)', count(*)::text from public.seg_backup_funcoes_20261112;

-- Líderes ativos por unidade (o passo 1 cria a trava "um líder por unidade": se alguma unidade tiver 2 ou mais,
-- aparece aqui e precisa ser resolvida antes)
select upper(trim(unidade)) as unidade, count(*) as lideres, string_agg(nome || ' <' || email || '>', ' | ') as quem
from public.usuarios_sistema where upper(role) = 'LIDER'
group by 1 having count(*) > 1;

-- Texto das funções (MANDE ESTE RESULTADO também)
select funcao, argumentos, definicao from public.seg_backup_funcoes_20261112 order by funcao;
