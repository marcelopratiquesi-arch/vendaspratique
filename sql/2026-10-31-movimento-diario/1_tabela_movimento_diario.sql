-- ============================================================
-- MOVIMENTO DO DIA (decisão do dono, 31/10/2026)
-- Uma linha por UNIDADE + DIA com o FATURAMENTO do dia (valor digitado, dinheiro que entrou — não é comissão)
-- e os CANCELAMENTOS do dia (digitados). As ENTRADAS não ficam aqui: são calculadas das vendas (planos base).
-- Quem vê: quem enxerga a unidade (Admin todas; Mentor as dele; Líder/Recepção a própria).
-- Quem grava: Líder (na dele), Mentor (nas dele) e Admin (todas). Recepção só vê.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Para desfazer: 9_desfazer.sql.
-- Não mexe em nenhuma tabela existente.
-- ============================================================

create table if not exists public.movimento_diario (
    id            bigint generated always as identity primary key,
    unidade       text not null,
    data          date not null,
    faturamento   numeric(12,2),            -- R$ do dia (digitado)
    cancelamentos integer check (cancelamentos is null or cancelamentos >= 0),
    atualizado_por text,                    -- nome de quem gravou por último
    atualizado_em  timestamptz not null default now(),
    criado_em      timestamptz not null default now(),
    constraint movimento_diario_unidade_dia unique (unidade, data)
);

create index if not exists movimento_diario_unidade_data_idx on public.movimento_diario (unidade, data);

alter table public.movimento_diario enable row level security;

-- Ver: unidades que a pessoa enxerga
drop policy if exists movimento_diario_ver on public.movimento_diario;
create policy movimento_diario_ver on public.movimento_diario
    for select to authenticated
    using (((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

-- Criar / editar: Líder, Mentor e Admin, só nas unidades que enxergam (Recepção não grava)
drop policy if exists movimento_diario_criar on public.movimento_diario;
create policy movimento_diario_criar on public.movimento_diario
    for insert to authenticated
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    );

drop policy if exists movimento_diario_editar on public.movimento_diario;
create policy movimento_diario_editar on public.movimento_diario
    for update to authenticated
    using (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    )
    with check (
        (select public.seg_papel()) in ('ADMIN', 'MENTOR', 'LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))
    );
-- (sem regra de apagar: para "zerar" um dia, grava em branco)

-- Tempo real: as telas abertas se atualizam quando alguém grava
alter publication supabase_realtime add table public.movimento_diario;

-- Conferência
select 'tabela movimento_diario criada' as resultado, count(*) as linhas from public.movimento_diario;
