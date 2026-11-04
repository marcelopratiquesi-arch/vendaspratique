-- =====================================================================
-- LEITURA POR UNIDADE — DESFAZER: volta as regras de vendas, avaliações e equipe exatamente como
-- estavam antes do passo 2 (pela cópia seg_backup_policies_20261104). Não mexe em nenhum dado.
-- As consultas seguras da ficha do aluno continuam existindo (não atrapalham).
-- =====================================================================
do $$
declare b record;
begin
  for b in select * from public.seg_backup_policies_20261104
           where cmd in ('SELECT', 'INSERT', 'UPDATE')
             and exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = b.tablename and p.policyname = b.policyname) loop
    if b.qual is not null and b.with_check is not null then
      execute format('alter policy %I on public.%I using (%s) with check (%s)', b.policyname, b.tablename, b.qual, b.with_check);
    elsif b.qual is not null then
      execute format('alter policy %I on public.%I using (%s)', b.policyname, b.tablename, b.qual);
    elsif b.with_check is not null then
      execute format('alter policy %I on public.%I with check (%s)', b.policyname, b.tablename, b.with_check);
    end if;
  end loop;
end $$;

select tablename, cmd, policyname, qual from pg_policies
where schemaname = 'public' and tablename in ('vendas', 'avaliacoes_realizadas', 'colaboradores')
order by tablename, cmd;
