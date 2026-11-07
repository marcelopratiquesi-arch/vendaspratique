-- ============================================================
-- DESFAZER os campos novos da importação de alunos (06/11/2026)
-- Apaga só os campos criados pelo 1_campos_novos.sql (o "sexo" NÃO é apagado: ele já existia).
-- Os status e datas de cadastro importados se perdem. As cópias *_backup_20261106 continuam.
-- ============================================================

drop index if exists public.alunos_status_aluno_idx;
alter table public.alunos drop column if exists status_aluno;
alter table public.alunos drop column if exists status_atualizado_em;
alter table public.alunos drop column if exists data_cadastro;

notify pgrst, 'reload schema';
