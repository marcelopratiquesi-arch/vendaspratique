-- ============================================================
-- "NÃO TEM PERSONAL CLASS" por unidade (decisão do dono, 04/11/2026)
-- Marca uma vez e vale para sempre (até alguém desmarcar). Unidade marcada: Personal some das metas
-- (Meta Start e Meta Mensal) e a gratificação mensal fica com 3 indicadores (R$ 50 cada).
-- Quem marca: Líder (na dele), Mentor (nas dele) e Admin. Todos os funcionários leem.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Desfazer: drop table public.unidades_sem_personal;
-- ============================================================

create table if not exists public.unidades_sem_personal (
    unidade        text primary key,
    sem_personal   boolean not null default true,
    atualizado_por text,
    atualizado_em  timestamptz not null default now()
);

alter table public.unidades_sem_personal enable row level security;

drop policy if exists unidades_sem_personal_ver on public.unidades_sem_personal;
create policy unidades_sem_personal_ver on public.unidades_sem_personal
    for select to authenticated using (true);

drop policy if exists unidades_sem_personal_criar on public.unidades_sem_personal;
create policy unidades_sem_personal_criar on public.unidades_sem_personal
    for insert to authenticated
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global())
             or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    );

drop policy if exists unidades_sem_personal_editar on public.unidades_sem_personal;
create policy unidades_sem_personal_editar on public.unidades_sem_personal
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

select 'tabela unidades_sem_personal criada' as resultado, count(*) as linhas from public.unidades_sem_personal;
