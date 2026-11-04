-- ============================================================
-- ATIVOS POR DIA na movimentação (decisão do dono, 04/11/2026)
-- O líder digita todo dia o TOTAL de alunos ativos (foto do dia, não é acumulado).
-- O sistema mostra quanto ganhou/perdeu em relação ao lançamento anterior.
-- 1) Acrescenta o campo "ativos" na tabela movimento_diario (não apaga nem muda nada que já existe).
-- 2) Ponto de partida: copia o "Qtd. Ativos Atual" deste mês (metas_unidades) para o ÚLTIMO lançamento
--    de cada unidade neste mês, para o próximo lançamento já mostrar o +/−.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- Desfazer: alter table public.movimento_diario drop column if exists ativos;
-- ============================================================

alter table public.movimento_diario
    add column if not exists ativos integer check (ativos is null or ativos >= 0);

with ultimo as (
    select distinct on (upper(unidade)) id, unidade
    from public.movimento_diario
    where data >= date_trunc('month', current_date)::date
    order by upper(unidade), data desc
)
update public.movimento_diario m
set ativos = round(mu.ativos_atual::numeric)::int
from ultimo u
join public.metas_unidades mu
  on upper(trim(mu.unidade)) = upper(trim(u.unidade))
 and mu.mes::int = extract(month from current_date)::int
 and mu.ano::int = extract(year from current_date)::int
where m.id = u.id
  and m.ativos is null
  and mu.ativos_atual is not null;

-- Conferência: ativos de partida por unidade
select unidade, data, ativos from public.movimento_diario where ativos is not null order by unidade, data;
