-- =====================================================================
-- EQUIPE: CPF NA VENDA, APROVAR PAGAMENTO E DESLIGAMENTO (11/11/2026, decisão do dono)
-- PASSO 0: CÓPIA DE SEGURANÇA (rode primeiro). Regra 12 do CLAUDE.md.
-- Este passo SÓ COPIA. Não altera nenhuma venda, cadastro ou regra.
--   1) a tabela de vendas inteira
--   2) a tabela da equipe (colaboradores) inteira
--   3) os totais por unidade e por vendedor (para comparar depois no passo 4)
-- As cópias ficam protegidas (ninguém lê pelo site; só o SQL Editor).
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- =====================================================================

-- 1) Vendas inteiras
create table if not exists public.vendas_backup_20261111 as
  select * from public.vendas;
alter table public.vendas_backup_20261111 enable row level security;

-- 2) Equipe inteira
create table if not exists public.colaboradores_backup_20261111 as
  select * from public.colaboradores;
alter table public.colaboradores_backup_20261111 enable row level security;

-- 3) Totais por unidade e vendedor (a "impressão digital" muda se qualquer valor, comissão ou produto mudar)
create table if not exists public.seg_totais_vendas_20261111 as
  select coalesce(unidade, '(sem unidade)') as unidade,
         coalesce(vendedor, '(sem vendedor)') as vendedor,
         count(*) as qtd,
         sum(coalesce(nullif(regexp_replace(replace(valor::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_valor,
         sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_comissao,
         md5(string_agg(id::text || '|' || coalesce(valor::text, '') || '|' || coalesce(comissao::text, '') || '|' || coalesce(produto::text, ''), ',' order by id)) as impressao_digital
  from public.vendas
  group by 1, 2;
alter table public.seg_totais_vendas_20261111 enable row level security;

-- Conferência (MANDE ESTE RESULTADO)
select 'vendas copiadas' as item, count(*)::text as valor from public.vendas_backup_20261111
union all select 'vendas hoje na tabela', count(*)::text from public.vendas
union all select 'equipe copiada', count(*)::text from public.colaboradores_backup_20261111
union all select 'equipe hoje na tabela', count(*)::text from public.colaboradores
union all select 'soma da comissão (vendas)', sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0))::text from public.vendas;
