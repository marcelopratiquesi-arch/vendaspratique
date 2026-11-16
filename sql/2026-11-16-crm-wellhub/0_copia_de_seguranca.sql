-- ============================================================
-- CRM: MIGRAÇÃO / RESGATE / WELLHUB NO FUNIL — passo 0 (cópia de segurança e conferência)
-- Rodar ANTES do 1_tipos_do_contato.sql. Supabase → SQL Editor → colar tudo → Run.
-- Só copia e mostra: não muda nada.
-- ============================================================

-- Travas (check) da tabela de contatos do CRM (leads), para o 9_desfazer.sql poder recriar
create table if not exists public.leads_travas_backup_20261116 as
select conname::text as nome, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.leads'::regclass and contype = 'c';

-- Conferência (anote): as travas atuais e quantos contatos há por tipo
select * from public.leads_travas_backup_20261116;
select tipo_lead, count(*) from public.leads group by tipo_lead order by tipo_lead;

-- A trava da tabela de mensagens prontas (se houver): precisa aceitar a chave WELLHUB
select conname::text as nome, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.crm_mensagens_prontas'::regclass and contype = 'c';
