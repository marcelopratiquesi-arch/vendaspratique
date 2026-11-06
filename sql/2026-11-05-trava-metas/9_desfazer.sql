-- =====================================================================
-- TRAVA DAS METAS — DESFAZER (só se algo der errado)
-- Volta a tabela metas_unidades exatamente como estava antes do 1_trava_metas.sql,
-- pelas cópias seg_backup_metas_20261105 e seg_backup_metas_rls_20261105. Não mexe em nenhum dado.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- =====================================================================
do $$
declare p record; b record; ligada boolean;
begin
  -- tira as regras novas
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'metas_unidades' loop
    execute format('drop policy %I on public.metas_unidades', p.policyname);
  end loop;

  -- recria as regras antigas
  for b in select * from public.seg_backup_metas_20261105 loop
    execute format('create policy %I on public.metas_unidades as %s for %s to %s%s%s',
      b.policyname, b.permissive, b.cmd, array_to_string(b.roles, ', '),
      case when b.qual is not null then format(' using (%s)', b.qual) else '' end,
      case when b.with_check is not null then format(' with check (%s)', b.with_check) else '' end);
  end loop;

  -- volta a proteção como estava (ligada ou desligada)
  select protecao_ligada into ligada from public.seg_backup_metas_rls_20261105 limit 1;
  if ligada then
    execute 'alter table public.metas_unidades enable row level security';
  else
    execute 'alter table public.metas_unidades disable row level security';
  end if;
end $$;

select policyname, cmd, qual, with_check from pg_policies
where schemaname = 'public' and tablename = 'metas_unidades' order by policyname;
