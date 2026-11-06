-- ============================================================
-- DESFAZER o relatório de fechamento da recepção (1_envios_e_turno.sql)
-- Apaga a tabela de envios (perde o histórico de quem enviou) e o campo turno da Equipe.
-- Não mexe em vendas nem em comissões. O sistema continua funcionando sem eles (só deixa de cobrar).
-- ============================================================
alter publication supabase_realtime drop table public.relatorios_fechamento_envios;
drop table if exists public.relatorios_fechamento_envios;
alter table public.colaboradores drop constraint if exists colaboradores_turno_valido;
alter table public.colaboradores drop column if exists turno;
