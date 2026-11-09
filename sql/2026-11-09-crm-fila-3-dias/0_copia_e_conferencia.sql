-- =====================================================================
-- CRM: Migração e Resgate — puxado e não contatado volta em 3 dias (era 7)
-- Decisão do dono, 09/11/2026. PASSO 0: cópia das funções + conferência (não muda nada).
-- Rodar no SQL Editor do Supabase, um passo de cada vez.
-- =====================================================================

-- 1) Cópia de segurança do texto atual das duas funções
create table if not exists public.seg_backup_crm_puxar_20261109 as
select p.proname as funcao, pg_get_functiondef(p.oid) as definicao, now() as copiado_em
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('crm_puxar_migracao', 'crm_puxar_resgate');

-- 2) Conferência: as duas devem aparecer com tem_7_dias = true
select funcao,
       position('interval ''7 days''' in definicao) > 0 as tem_7_dias,
       copiado_em
from public.seg_backup_crm_puxar_20261109;
