-- =====================================================================
-- MENTOR ↔ UNIDADES — DESFAZER (só use se algo der errado depois dos passos 1 a 4)
-- Volta as 12 funções e as regras de acesso das tabelas mexidas para o texto guardado no passo 0.
-- A tabela mentor_unidades, o histórico e os gatilhos novos continuam (não atrapalham nada).
-- =====================================================================
begin;

-- Funções: recria cada uma com o texto de antes
do $$
declare r record;
begin
  for r in select funcao, definicao from public.seg_backup_funcoes_20261029 loop
    execute r.definicao;
  end loop;
end $$;

-- Regras de acesso: apaga a atual e recria a de antes, tabela por tabela
do $$
declare r record;
begin
  for r in select * from public.seg_backup_policies_20261029
           where tablename in ('vendas', 'avaliacoes_realizadas', 'colaboradores', 'unidades', 'alunos',
                               'alunos_unidades', 'leads', 'crm_contatos_feitos', 'crm_migracao',
                               'crm_nao_contatar', 'vendas_auditoria', 'vendas_duplicidade_legitima') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s %s %s',
      r.policyname, r.tablename, r.permissive, r.cmd,
      (select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') from unnest(r.roles::text[]) x),
      case when r.qual is not null then 'using (' || r.qual || ')' else '' end,
      case when r.with_check is not null then 'with check (' || r.with_check || ')' else '' end);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
