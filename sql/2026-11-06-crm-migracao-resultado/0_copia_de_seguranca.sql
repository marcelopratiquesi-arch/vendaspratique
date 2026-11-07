-- ============================================================
-- MIGRAÇÃO: RESULTADO DO CONTATO, TENTATIVAS E GELADEIRA — passo 0 (cópia de segurança)
-- Rodar ANTES do 1_campos_novos.sql. Supabase → SQL Editor → colar tudo → Run.
-- Só copia: não muda nada.
-- ============================================================

-- Cópia da tabela inteira do andamento da Migração
create table if not exists public.crm_migracao_backup_20261106 as
select * from public.crm_migracao;

-- Cópia das travas (check) da tabela, para o 9_desfazer.sql poder recriar
create table if not exists public.crm_migracao_travas_backup_20261106 as
select conname::text as nome, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.crm_migracao'::regclass and contype = 'c';

-- Conferência: quantas linhas por situação (anote; tem que dar igual depois do passo 1)
select status, count(*) from public.crm_migracao group by status order by status;
select * from public.crm_migracao_travas_backup_20261106;
