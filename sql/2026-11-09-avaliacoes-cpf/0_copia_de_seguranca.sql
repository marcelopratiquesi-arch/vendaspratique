-- PASSO 0 — Cópia de segurança das avaliações (09/11/2026). Só cria uma cópia; não muda nada.
-- Rodar no SQL Editor do Supabase ANTES do passo 1.
create table if not exists public.avaliacoes_realizadas_backup_20261109 as
  select * from public.avaliacoes_realizadas;

-- Conferência: os dois números precisam ser iguais
select
  (select count(*) from public.avaliacoes_realizadas) as avaliacoes_agora,
  (select count(*) from public.avaliacoes_realizadas_backup_20261109) as avaliacoes_na_copia;
