-- ============================================================
-- NUTRI / TECACE — PASSO 0: cópia de segurança (decisão do dono, 17/11/2026)
-- Só copia e confere. Não muda nada. Rodar ANTES do passo 1.
-- ============================================================
create table if not exists public.movimento_diario_backup_20261117 as
select * from public.movimento_diario;

select
  (select count(*) from public.movimento_diario)                  as linhas_agora,
  (select count(*) from public.movimento_diario_backup_20261117)  as linhas_na_copia;
