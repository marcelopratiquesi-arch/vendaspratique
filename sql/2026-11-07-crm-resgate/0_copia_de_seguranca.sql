-- ============================================================
-- CRM: ABA RESGATE + RESULTADO DO CONTATO — passo 0 (cópia de segurança)
-- Rodar ANTES do 1_resgate.sql. Supabase → SQL Editor → colar tudo → Run.
-- Só copia: não muda nada.
-- ============================================================

-- Travas (check) da tabela de contatos feitos, para o 9_desfazer.sql poder recriar
create table if not exists public.crm_contatos_feitos_travas_backup_20261107 as
select conname::text as nome, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.crm_contatos_feitos'::regclass and contype = 'c';

-- Conferência: as travas atuais e quantos contatos há por tipo e meio (anote)
select * from public.crm_contatos_feitos_travas_backup_20261107;
select tipo, canal, count(*) from public.crm_contatos_feitos group by tipo, canal order by tipo, canal;
