-- =====================================================================
-- TRAVA DAS METAS NO BANCO (decisão do dono, 05/11/2026) — tabela metas_unidades
-- Quem GRAVA metas (Meta Start, Meta Mensal e os "ativos do mês"): Líder (na unidade dele),
-- Mentor (nas unidades dele) e Admin (todas). A Recepção só VÊ.
-- Quem LÊ: todo funcionário logado (igual a hoje: Dashboard, Ranking, Histórico de metas).
-- Ninguém apaga meta pelo sistema (não existe regra de apagar; o sistema nunca apaga meta).
--
-- NÃO muda nenhum dado: só as regras de acesso da tabela.
-- Antes de mudar, guarda uma CÓPIA das regras atuais (para o 9_desfazer.sql).
-- Pode rodar mais de uma vez.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Mande o resultado da última consulta.
-- =====================================================================

-- a) Cópia das regras atuais e de como a proteção estava (só na primeira vez)
create table if not exists public.seg_backup_metas_20261105 as
  select now() as copiado_em, p.*
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'metas_unidades';

create table if not exists public.seg_backup_metas_rls_20261105 as
  select now() as copiado_em, c.relrowsecurity as protecao_ligada
  from pg_class c
  where c.oid = 'public.metas_unidades'::regclass;

-- b) Tira as regras antigas desta tabela (estão guardadas na cópia acima)
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'metas_unidades' loop
    execute format('drop policy %I on public.metas_unidades', p.policyname);
  end loop;
end $$;

-- c) Liga a proteção e cria as regras novas
alter table public.metas_unidades enable row level security;

-- Ver: todo funcionário logado (como hoje)
create policy metas_ver on public.metas_unidades
    for select to authenticated
    using ((select public.seg_papel()) is not null);

-- Criar: só Líder, Mentor e Admin, nas unidades deles
create policy metas_criar on public.metas_unidades
    for insert to authenticated
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global())
             or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    );

-- Editar: só Líder, Mentor e Admin, nas unidades deles
create policy metas_editar on public.metas_unidades
    for update to authenticated
    using (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global())
             or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    )
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global())
             or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    );

-- d) Conferência (MANDE ESTE RESULTADO): regras antigas guardadas, regras novas e quantas metas existem
select 'regras antigas guardadas' as item, count(*)::text as valor from public.seg_backup_metas_20261105
union all
select 'protecao estava ligada antes?', coalesce((select protecao_ligada::text from public.seg_backup_metas_rls_20261105 limit 1), '?')
union all
select 'protecao ligada agora?', (select relrowsecurity::text from pg_class where oid = 'public.metas_unidades'::regclass)
union all
select 'regras novas', (select string_agg(policyname || ' (' || cmd || ')', ', ' order by policyname) from pg_policies where schemaname = 'public' and tablename = 'metas_unidades')
union all
select 'linhas de metas na tabela (nao muda)', count(*)::text from public.metas_unidades;
