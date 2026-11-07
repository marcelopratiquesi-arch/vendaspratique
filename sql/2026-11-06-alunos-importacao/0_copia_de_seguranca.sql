-- ============================================================
-- CÓPIA DE SEGURANÇA antes dos campos novos da importação de alunos (06/11/2026)
-- Rode ANTES do 1_campos_novos.sql. Só copia, não muda nada.
-- ============================================================

create table if not exists public.alunos_backup_20261106 as select * from public.alunos;
create table if not exists public.alunos_unidades_backup_20261106 as select * from public.alunos_unidades;

-- Conferência: os números de cada par têm que ser iguais
select 'alunos' as tabela,
       (select count(*) from public.alunos) as original,
       (select count(*) from public.alunos_backup_20261106) as copia
union all
select 'alunos_unidades',
       (select count(*) from public.alunos_unidades),
       (select count(*) from public.alunos_unidades_backup_20261106);
