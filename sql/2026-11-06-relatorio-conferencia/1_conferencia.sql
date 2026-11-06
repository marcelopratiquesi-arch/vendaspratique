-- ============================================================
-- CONFERÊNCIA DO RELATÓRIO DE FECHAMENTO NO GRUPO (decisão do dono, 06/11/2026)
-- O sistema só vê o clique em Copiar/Enviar do "WhatsApp Fechamento". Quando ele marca "não enviado",
-- o Líder (na unidade dele), o Mentor (nas dele) ou o Admin confere no GRUPO DE VENDAS da unidade e responde:
--   ENVIADO      = a recepção mandou (o sistema não viu): conta como enviado.
--   NAO_ENVIADO  = confirmado que não mandou.
-- Nos dois casos o turno sai da cobrança. Uma resposta por unidade + dia + turno (dá para corrigir; não apaga).
-- Quem pode: permissão 313 (Configurações → Permissões; padrão Admin, Mentor e Líder), nas unidades da pessoa.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Para desfazer: 9_desfazer.sql.
-- Não mexe em vendas nem em comissões.
-- ============================================================

create table if not exists public.relatorios_fechamento_conferencia (
    id              bigint generated always as identity primary key,
    unidade         text not null,
    data            date not null,
    turno           text not null check (turno in ('MANHA', 'NOITE', 'FIM_DE_SEMANA')),
    resultado       text not null check (resultado in ('ENVIADO', 'NAO_ENVIADO')),
    conferido_por   text,
    conferido_email text default (auth.jwt() ->> 'email'),
    conferido_em    timestamptz not null default now(),
    constraint relatorios_conferencia_um_por_turno unique (unidade, data, turno)
);

create index if not exists relatorios_conferencia_unidade_data_idx on public.relatorios_fechamento_conferencia (unidade, data);

alter table public.relatorios_fechamento_conferencia enable row level security;

-- Ver: unidades que a pessoa enxerga
drop policy if exists relatorios_conferencia_ver on public.relatorios_fechamento_conferencia;
create policy relatorios_conferencia_ver on public.relatorios_fechamento_conferencia
    for select to authenticated
    using (((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

-- Gravar e corrigir: quem tem a permissão 313, nas unidades dele
drop policy if exists relatorios_conferencia_criar on public.relatorios_fechamento_conferencia;
create policy relatorios_conferencia_criar on public.relatorios_fechamento_conferencia
    for insert to authenticated
    with check ((select public.seg_pode('313'))
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

drop policy if exists relatorios_conferencia_editar on public.relatorios_fechamento_conferencia;
create policy relatorios_conferencia_editar on public.relatorios_fechamento_conferencia
    for update to authenticated
    using ((select public.seg_pode('313'))
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])))
    with check ((select public.seg_pode('313'))
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));
-- (sem regra de apagar)

-- Padrão da permissão 313 (o mesmo do catálogo do código)
insert into public.permissoes_padrao (codigo, padrao, travada, rede, mudavel_para)
values ('313', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null)
on conflict (codigo) do update set padrao = excluded.padrao, travada = excluded.travada, rede = excluded.rede, mudavel_para = excluded.mudavel_para;

-- Tempo real: a cobrança some das telas na hora em que alguém confere
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relatorios_fechamento_conferencia') then
    alter publication supabase_realtime add table public.relatorios_fechamento_conferencia;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Conferência (esperado: 0 linhas e padrão 313 = ADMIN, MENTOR, LIDER)
select 'relatorios_fechamento_conferencia criada' as item, count(*)::text as valor from public.relatorios_fechamento_conferencia
union all select 'padrão da permissão 313', array_to_string(padrao, ', ') from public.permissoes_padrao where codigo = '313';
