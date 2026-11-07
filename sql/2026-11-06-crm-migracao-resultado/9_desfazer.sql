-- ============================================================
-- DESFAZER o passo 1 (resultado do contato na Migração)
-- Tira os campos novos e recria as travas antigas. Quem estava na geladeira (NAO_QUER / SEM_RESPOSTA) volta
-- para CONTATADO. A cópia crm_migracao_backup_20261106 continua guardada para conferência.
-- ============================================================

alter table public.crm_migracao drop constraint if exists crm_migracao_status_valido;

-- Quem ficou como NAO_QUER / SEM_RESPOSTA volta para CONTATADO (para caber nas travas antigas)
update public.crm_migracao set status = 'CONTATADO' where status in ('NAO_QUER', 'SEM_RESPOSTA');

alter table public.crm_migracao drop column if exists volta_em;
alter table public.crm_migracao drop column if exists tentativas;
alter table public.crm_migracao drop column if exists resultado;

-- Recria as travas antigas
do $$
declare r record;
begin
  for r in select nome, definicao from public.crm_migracao_travas_backup_20261106 loop
    execute format('alter table public.crm_migracao add constraint %I %s', r.nome, r.definicao);
  end loop;
end $$;

notify pgrst, 'reload schema';

select status, count(*) from public.crm_migracao group by status order by status;
