-- ============================================================
-- GESTÃO À VISTA — PASSO 1 (decisão do dono, 18/11/2026)
-- a) colaboradores.data_inicio: o "dia 1" da pessoa no sistema. Quem já existe ganha a data em que foi
--    cadastrado (created_at, se a coluna existir; senão fica vazio e a tela trata como "sem data").
--    O fim continua sendo colaboradores.desligado_em (já existe).
-- b) meta_produtos_pessoa: quantos produtos (Whey/Energy/outros) cada Saver e Recepção precisa vender por mês, por
--    unidade. Padrão do sistema = 3 (se a unidade não tiver linha aqui, vale 3).
-- Não mexe em vendas, comissão nem metas das unidades. Desfazer: 9_desfazer.sql
-- ============================================================
alter table public.colaboradores add column if not exists data_inicio date;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='colaboradores' and column_name='created_at') then
    execute 'update public.colaboradores set data_inicio = created_at::date where data_inicio is null';
  end if;
end $$;

create table if not exists public.meta_produtos_pessoa (
    unidade text primary key,
    meta integer not null default 3 check (meta >= 0 and meta <= 99),
    atualizado_por text,
    atualizado_em timestamptz default now()
);
alter table public.meta_produtos_pessoa enable row level security;

drop policy if exists meta_pessoa_ver on public.meta_produtos_pessoa;
create policy meta_pessoa_ver on public.meta_produtos_pessoa
    for select to authenticated using ((select public.seg_papel()) is not null);

drop policy if exists meta_pessoa_criar on public.meta_produtos_pessoa;
create policy meta_pessoa_criar on public.meta_produtos_pessoa
    for insert to authenticated
    with check ((select public.seg_papel()) in ('ADMIN','MENTOR','LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

drop policy if exists meta_pessoa_editar on public.meta_produtos_pessoa;
create policy meta_pessoa_editar on public.meta_produtos_pessoa
    for update to authenticated
    using ((select public.seg_papel()) in ('ADMIN','MENTOR','LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])))
    with check ((select public.seg_papel()) in ('ADMIN','MENTOR','LIDER')
        and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])));

-- Conferência (mande o resultado)
select 'equipe com data_inicio' as item, count(data_inicio)::text as valor from public.colaboradores
union all select 'equipe total', count(*)::text from public.colaboradores
union all select 'tabela de meta criada', (select count(*)::text from public.meta_produtos_pessoa);
