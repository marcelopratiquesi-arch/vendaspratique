-- =====================================================================
-- ASPIRA + ACESSO TEMPORÁRIO (13/11/2026, decisão do dono)
-- PASSO 0: CÓPIA DE SEGURANÇA E LEVANTAMENTO (rode primeiro). SÓ COPIA E LÊ, não muda nada.
--   1) cópia dos logins, do histórico de líderes e dos vínculos dos Mentores
--   2) cópia do TEXTO de todas as funções que os passos 1 a 3 trocam (o 9_desfazer.sql volta tudo daqui)
--   3) cópia de todas as regras de acesso (policies) do banco
--   4) levantamento: as regras do CRM que foram criadas direto no SQL Editor (não estão no projeto)
-- MANDE O RESULTADO das 3 últimas consultas.
-- =====================================================================

create table if not exists public.usuarios_sistema_backup_20261113 as select * from public.usuarios_sistema;
alter table public.usuarios_sistema_backup_20261113 enable row level security;

create table if not exists public.lideres_historico_backup_20261113 as select * from public.lideres_historico;
alter table public.lideres_historico_backup_20261113 enable row level security;

create table if not exists public.mentor_unidades_backup_20261113 as select * from public.mentor_unidades;
alter table public.mentor_unidades_backup_20261113 enable row level security;

create table if not exists public.seg_backup_funcoes_20261113 as
  select now() as copiado_em, p.proname as funcao, pg_get_function_identity_arguments(p.oid) as argumentos,
         pg_get_functiondef(p.oid) as definicao
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (p.proname in ('seg_papel', 'seg_papel_base', 'seg_unidade', 'seg_minhas_unidades', 'seg_mentor_ve_unidade',
                       'get_user_colaborador_info', 'crm_eh_funcionario', 'crm_minha_unidade', 'crm_eh_global')
         or p.proname like 'acesso\_%');
alter table public.seg_backup_funcoes_20261113 enable row level security;

create table if not exists public.seg_backup_policies_20261113 as
  select now() as copiado_em, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public';
alter table public.seg_backup_policies_20261113 enable row level security;

-- Conferência (MANDE ESTE RESULTADO)
select 'logins copiados' as item, count(*)::text as valor from public.usuarios_sistema_backup_20261113
union all select 'logins hoje', count(*)::text from public.usuarios_sistema
union all select 'histórico de líderes copiado', count(*)::text from public.lideres_historico_backup_20261113
union all select 'vínculos de Mentor copiados', count(*)::text from public.mentor_unidades_backup_20261113
union all select 'funções copiadas', count(*)::text from public.seg_backup_funcoes_20261113
union all select 'regras de acesso copiadas', count(*)::text from public.seg_backup_policies_20261113
union all select 'Líder/Recepção sem unidade de verdade (o passo 1 trava novos)', count(*)::text from public.usuarios_sistema
  where upper(coalesce(role, '')) in ('LIDER', 'RECEPCAO') and (trim(coalesce(unidade, '')) = '' or upper(trim(unidade)) = 'TODAS');

-- Levantamento 1 (MANDE ESTE RESULTADO): regras que olham UMA unidade só (seg_unidade / CRM)
select tablename, policyname, cmd, permissive, qual, with_check
from public.seg_backup_policies_20261113
where coalesce(qual, '') || coalesce(with_check, '') ~ '(seg_unidade|get_user_colaborador_info|crm_minha_unidade|crm_eh_funcionario)'
order by tablename, policyname;

-- Levantamento 2 (MANDE ESTE RESULTADO): regras das tabelas antigas do CRM
select tablename, policyname, cmd, permissive, qual, with_check
from public.seg_backup_policies_20261113
where tablename in ('leads', 'historico_leads', 'crm_contatos_feitos', 'crm_migracao', 'crm_nao_contatar', 'crm_mensagens_prontas')
order by tablename, policyname;
