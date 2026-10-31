-- ============================================================
-- DESFAZER o "movimento do dia" (apaga a tabela e tudo que foi digitado nela).
-- Use só se precisar voltar atrás. As vendas e as outras tabelas não são afetadas.
-- Antes de apagar, guarda uma cópia do que foi digitado.
-- ============================================================
create table if not exists public.movimento_diario_backup_desfazer as select * from public.movimento_diario;
alter publication supabase_realtime drop table public.movimento_diario;
drop table if exists public.movimento_diario;
