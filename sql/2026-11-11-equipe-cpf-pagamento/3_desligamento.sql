-- =====================================================================
-- PASSO 3: DATA E MOTIVO DO DESLIGAMENTO (pode rodar a qualquer hora; não mexe em vendas)
-- Ao desligar alguém na Equipe, a tela pede a data e o motivo. Reativar apaga os dois.
-- A tabela colaboradores já é auditada (auditoria_cadastros): a mudança fica registrada.
-- =====================================================================
alter table public.colaboradores add column if not exists desligado_em date;
alter table public.colaboradores add column if not exists motivo_desligamento text;

-- Conferência
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'colaboradores' and column_name in ('desligado_em', 'motivo_desligamento');
