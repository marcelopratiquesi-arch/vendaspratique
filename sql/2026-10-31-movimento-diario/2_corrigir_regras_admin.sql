-- ============================================================
-- CORREÇÃO (31/10/2026): o Admin não conseguia gravar nem ver a movimentação
-- Erro: "new row violates row-level security policy for table movimento_diario" (código 42501).
-- Motivo: para o Admin, seg_minhas_unidades() devolve NULL (= todas as unidades) e
-- "unidade = any(NULL)" não dá verdadeiro. As outras tabelas usam "seg_eh_global() OU unidade minha";
-- aqui faltou o "seg_eh_global()". Esta correção troca só as 3 regras desta tabela.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Não mexe em nenhuma outra tabela nem em dados.
-- ============================================================

drop policy if exists movimento_diario_ver on public.movimento_diario;
create policy movimento_diario_ver on public.movimento_diario
    for select to authenticated
    using (
        (select public.seg_eh_global())
        or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])
    );

drop policy if exists movimento_diario_criar on public.movimento_diario;
create policy movimento_diario_criar on public.movimento_diario
    for insert to authenticated
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and (
            (select public.seg_eh_global())
            or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])
        )
    );

drop policy if exists movimento_diario_editar on public.movimento_diario;
create policy movimento_diario_editar on public.movimento_diario
    for update to authenticated
    using (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and (
            (select public.seg_eh_global())
            or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])
        )
    )
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and (
            (select public.seg_eh_global())
            or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])
        )
    );

-- Conferência: deve listar as 3 regras novas
select policyname, cmd from pg_policies where tablename = 'movimento_diario' order by policyname;
