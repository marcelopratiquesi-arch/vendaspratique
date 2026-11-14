-- ============================================================
-- GRUPOS DO CATÁLOGO — PASSO 0: cópia de segurança (decisão do dono, 14/11/2026)
-- Guarda o catálogo como está hoje. Não muda nada. Rodar ANTES do passo 1.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================
create table if not exists public.catalogo_backup_20261114 as select * from public.catalogo;

-- Conferência: os dois números têm que ser iguais
select (select count(*) from public.catalogo) as itens_no_catalogo,
       (select count(*) from public.catalogo_backup_20261114) as itens_na_copia;
