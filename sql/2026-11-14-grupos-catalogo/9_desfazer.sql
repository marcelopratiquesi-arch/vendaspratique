-- ============================================================
-- GRUPOS DO CATÁLOGO — DESFAZER (volta tudo para a regra pelo nome)
-- Guarda uma cópia dos grupos e do grupo de cada item antes de apagar.
-- Vendas e comissões não são tocadas.
-- ============================================================
create table if not exists public.catalogo_grupos_backup_desfazer as select * from public.catalogo_grupos;
create table if not exists public.catalogo_grupo_item_backup_desfazer as
    select id, nome, grupo_id from public.catalogo where grupo_id is not null;

alter table public.catalogo drop column if exists grupo_id;
alter publication supabase_realtime drop table public.catalogo_grupos;
drop table if exists public.catalogo_grupos;

select 'grupos do catálogo desfeitos' as resultado, count(*) as itens_no_catalogo from public.catalogo;
