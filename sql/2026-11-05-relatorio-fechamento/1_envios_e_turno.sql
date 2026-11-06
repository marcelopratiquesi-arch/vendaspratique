-- ============================================================
-- RELATÓRIO DE FECHAMENTO DA RECEPÇÃO (decisão do dono, 05/11/2026)
-- 1) Tabela relatorios_fechamento_envios: cada vez que o login da RECEPÇÃO clica em Copiar ou Enviar
--    no "WhatsApp Fechamento" (Relatórios, período Hoje, a própria unidade) DENTRO do horário do turno,
--    o sistema grava 1 linha por unidade + dia + turno (o primeiro clique vale; os outros são ignorados).
--    Turnos: MANHA (seg-sex, 13h–17h59), NOITE (seg-sex, 22h–23h59), FIM_DE_SEMANA (sáb/dom, a partir de 12h).
-- 2) Campo colaboradores.turno (MANHA / NOITE): turno de cada recepcionista, para cobrar pelo nome.
-- Quem grava o envio: só RECEPÇÃO, só na própria unidade. Quem vê: quem enxerga a unidade.
-- Ninguém edita nem apaga envio (é o registro da cobrança).
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Para desfazer: 9_desfazer.sql.
-- Não mexe em vendas nem em comissões.
-- ============================================================

create table if not exists public.relatorios_fechamento_envios (
    id           bigint generated always as identity primary key,
    unidade      text not null,
    data         date not null,
    turno        text not null check (turno in ('MANHA', 'NOITE', 'FIM_DE_SEMANA')),
    acao         text not null check (acao in ('COPIAR', 'ENVIAR')),
    login_email  text default (auth.jwt() ->> 'email'),
    login_nome   text,
    enviado_em   timestamptz not null default now(),
    constraint relatorios_fechamento_envios_um_por_turno unique (unidade, data, turno)
);

create index if not exists relatorios_fechamento_envios_unidade_data_idx on public.relatorios_fechamento_envios (unidade, data);

alter table public.relatorios_fechamento_envios enable row level security;

-- Ver: unidades que a pessoa enxerga (Admin todas; Mentor as dele; Líder/Recepção a própria)
drop policy if exists relatorios_envios_ver on public.relatorios_fechamento_envios;
create policy relatorios_envios_ver on public.relatorios_fechamento_envios
    for select to authenticated
    using (((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

-- Gravar: só o login da RECEPÇÃO, só na própria unidade
drop policy if exists relatorios_envios_criar on public.relatorios_fechamento_envios;
create policy relatorios_envios_criar on public.relatorios_fechamento_envios
    for insert to authenticated
    with check (
        (select public.seg_papel()) = 'RECEPCAO'
        and public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])
    );
-- (sem regra de editar nem de apagar)

-- Tempo real: a cobrança some das telas na hora em que a recepção envia
alter publication supabase_realtime add table public.relatorios_fechamento_envios;

-- Turno da recepcionista no cadastro da Equipe
alter table public.colaboradores add column if not exists turno text;
alter table public.colaboradores drop constraint if exists colaboradores_turno_valido;
alter table public.colaboradores add constraint colaboradores_turno_valido check (turno is null or turno in ('MANHA', 'NOITE'));

-- Conferência
select 'relatorios_fechamento_envios criada' as resultado, count(*) as linhas from public.relatorios_fechamento_envios
union all
select 'colaboradores.turno criado', count(*) from information_schema.columns where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'turno';
