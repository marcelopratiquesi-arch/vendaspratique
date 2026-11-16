-- ============================================================
-- DESFAZER o passo 1 (tipos RESGATE e WELLHUB)
-- Tira a trava nova e devolve as travas antigas da tabela leads pela cópia do passo 0.
-- Atenção: contatos já gravados como RESGATE ou WELLHUB continuam assim ("not valid" aceita o que já existe).
-- ============================================================

alter table public.leads drop constraint if exists leads_tipo_lead_valido;

do $$
declare r record;
begin
  for r in select nome, definicao from public.leads_travas_backup_20261116 where definicao ilike '%tipo_lead%' loop
    execute format('alter table public.leads add constraint %I %s not valid', r.nome, replace(r.definicao, ' NOT VALID', ''));
  end loop;
end $$;

notify pgrst, 'reload schema';
