-- ============================================================
-- GRUPOS DO CATÁLOGO — PASSO 1 (decisão do dono, 14/11/2026)
-- O lugar único que diz como cada item conta no sistema (Cadastros → Catálogo Geral → Grupos).
-- - Tabela catalogo_grupos: nome livre + "como conta" (lista fixa, igual à do site: regrasGrupos.js).
-- - Campo catalogo.grupo_id: o grupo de cada item (vazio = conta pelo nome, como antes).
-- NÃO mexe em vendas nem em comissão. Nenhum item ganha grupo aqui: quem coloca é o Admin, na tela
-- (botão "Colocar nos grupos", que usa a regra de hoje e não muda nenhum número).
-- Quem lê: todo funcionário. Quem grava: só o Admin (é a regra das metas, como o catálogo).
-- Desfazer: 9_desfazer.sql
-- ============================================================

create table if not exists public.catalogo_grupos (
    id          bigint generated always as identity primary key,
    nome        text not null,
    conta_como  text not null check (conta_como in (
                    'PLUS', 'PLUS_NUTRI', 'FIT', 'FIT_NUTRI', 'PERSONAL', 'PERSONAL_NUTRI', 'OUTROS',
                    'NUTRI', 'PRODUTO', 'DOSE_UNICA', 'SERVICO')),
    criado_em   timestamptz not null default now()
);

-- Nome do grupo não se repete (sem diferenciar maiúsculas)
create unique index if not exists catalogo_grupos_nome_unico on public.catalogo_grupos (upper(trim(nome)));

alter table public.catalogo_grupos enable row level security;

drop policy if exists catalogo_grupos_ver on public.catalogo_grupos;
create policy catalogo_grupos_ver on public.catalogo_grupos
    for select to authenticated using ((select public.seg_papel()) is not null);

drop policy if exists catalogo_grupos_criar on public.catalogo_grupos;
create policy catalogo_grupos_criar on public.catalogo_grupos
    for insert to authenticated with check ((select public.seg_papel()) = 'ADMIN');

drop policy if exists catalogo_grupos_editar on public.catalogo_grupos;
create policy catalogo_grupos_editar on public.catalogo_grupos
    for update to authenticated
    using ((select public.seg_papel()) = 'ADMIN')
    with check ((select public.seg_papel()) = 'ADMIN');

drop policy if exists catalogo_grupos_apagar on public.catalogo_grupos;
create policy catalogo_grupos_apagar on public.catalogo_grupos
    for delete to authenticated using ((select public.seg_papel()) = 'ADMIN');

-- O grupo de cada item. "on delete restrict": grupo com itens não pode ser apagado.
alter table public.catalogo add column if not exists grupo_id bigint
    references public.catalogo_grupos (id) on delete restrict;

-- Tempo real: as telas abertas se atualizam quando o Admin mexe nos grupos
alter publication supabase_realtime add table public.catalogo_grupos;

-- Conferência
select 'tabela catalogo_grupos criada' as resultado,
       (select count(*) from public.catalogo_grupos) as grupos,
       (select count(*) from public.catalogo where grupo_id is not null) as itens_com_grupo;
