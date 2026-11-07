-- ============================================================
-- DESFAZER o passo 1 (aba Resgate + resultado do contato)
-- Atenção: apaga a fila do Resgate e os resultados marcados (as tabelas novas).
-- Os contatos feitos continuam; as travas antigas da crm_contatos_feitos voltam pela cópia do passo 0.
-- ============================================================

drop function if exists public.crm_puxar_resgate(text, uuid[], text);
drop table if exists public.crm_resgate;
drop table if exists public.crm_resultados_contato;

alter table public.crm_contatos_feitos drop constraint if exists crm_contatos_feitos_tipo_valido;
alter table public.crm_contatos_feitos drop constraint if exists crm_contatos_feitos_canal_valido;

do $$
declare r record;
begin
  for r in select nome, definicao from public.crm_contatos_feitos_travas_backup_20261107 loop
    -- "not valid": as linhas já gravadas como RESGATE/LIGACAO ficam como estão
    execute format('alter table public.crm_contatos_feitos add constraint %I %s not valid', r.nome, replace(r.definicao, ' NOT VALID', ''));
  end loop;
end $$;

notify pgrst, 'reload schema';
