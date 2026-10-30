-- ============================================================
-- CONFERÊNCIA "NUTRI É ADICIONAL" — ANTES × DEPOIS (Dashboard)
-- SÓ LEITURA: este comando não altera nada no banco (é só um SELECT).
-- Como usar: Supabase → SQL Editor → colar tudo → Run.
-- Mostra, para setembro e outubro de 2026 da unidade Santa Inês 2:
--   ANTES  = regra antiga do Dashboard (Nutri era um grupo de plano, "PLUS + NUTRI" contava como Nutri)
--   DEPOIS = regra nova (Nutri é adicional; o plano conta no grupo base; PRATIQUE NUTRI não é entrada)
-- Mesma contagem do card: plano repetido no mesmo dia para a mesma matrícula conta 1 vez.
-- Para outra unidade, troque 'SANTA INES 2' abaixo (sem acento, maiúsculo).
-- ============================================================
with
catalogo_planos as (
    select distinct upper(translate(trim(nome), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) as nome_norm
    from public.catalogo
    where lower(tipo) = 'plano'
),
vendas_planos as (
    select
        v.id,
        to_char(v.data::date, 'YYYY-MM') as mes,
        upper(translate(trim(v.produto), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) as n,
        coalesce(nullif(nullif(trim(v.quantidade::text), ''), '0')::numeric::int, 1) as qtd,
        nullif(trim(coalesce(v.matricula::text, '')), '') as matricula,
        upper(trim(v.produto)) as produto_upper,
        v.data::date as dia
    from public.vendas v
    where upper(translate(trim(v.unidade), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')) = 'SANTA INES 2'
      and v.data::date between date '2026-09-01' and date '2026-10-31'
),
so_planos as (
    select vp.*,
           case when vp.matricula is null then 1
                else row_number() over (partition by vp.matricula, vp.produto_upper, vp.dia order by vp.id) end as ordem
    from vendas_planos vp
    join catalogo_planos cp on cp.nome_norm = vp.n
),
contados as (
    select mes, n, qtd,
        -- ANTES: grupoDoPlano (NUTRI primeiro, depois PLUS, FIT, PERSONAL, resto)
        case when n like '%NUTRI%' then 'NUTRI'
             when n like '%PLUS%' then 'PLUS'
             when n like '%FIT%' then 'FIT'
             when n like '%PERSONAL%' then 'PERSONAL'
             else 'OUTROS' end as grupo_antes,
        -- DEPOIS: decomporPlano (base sem o Nutri + adicional Nutri)
        (n like '%NUTRI%') as nutri,
        case
            when regexp_replace(n, '\+?\s*NUTRI\M', ' ', 'g') like '%PLUS%'
              or regexp_replace(n, '\+?\s*NUTRI\M', ' ', 'g') like '%AFL%' then 'PLUS'
            when regexp_replace(n, '\+?\s*NUTRI\M', ' ', 'g') like '%FIT%' then 'FIT'
            when regexp_replace(n, '\+?\s*NUTRI\M', ' ', 'g') like '%PERSONAL%' then 'PERSONAL'
            when n not like '%NUTRI%' then 'OUTROS'
            else null end as base_depois
    from so_planos
    where ordem = 1
)
select
    mes as "Mês",
    -- ANTES
    sum(qtd) as "ANTES planos vendidos",
    sum(qtd) filter (where grupo_antes = 'NUTRI') as "ANTES Nutri",
    sum(qtd) filter (where grupo_antes = 'PLUS') as "ANTES Plus",
    sum(qtd) filter (where grupo_antes = 'FIT') as "ANTES Fit",
    sum(qtd) filter (where grupo_antes = 'PERSONAL') as "ANTES Personal",
    sum(qtd) filter (where grupo_antes = 'OUTROS') as "ANTES Outros",
    round(100 - 100.0 * coalesce(sum(qtd) filter (where grupo_antes = 'FIT'), 0) / nullif(sum(qtd), 0), 1) as "ANTES produtividade %",
    -- DEPOIS
    sum(qtd) filter (where base_depois is not null) as "DEPOIS planos vendidos",
    sum(qtd) filter (where base_depois = 'PLUS') as "DEPOIS Plus",
    sum(qtd) filter (where base_depois = 'FIT') as "DEPOIS Fit",
    sum(qtd) filter (where base_depois = 'PERSONAL') as "DEPOIS Personal",
    sum(qtd) filter (where base_depois = 'OUTROS') as "DEPOIS Outros",
    sum(qtd) filter (where nutri) as "DEPOIS adicionais Nutri",
    round(100 - 100.0 * coalesce(sum(qtd) filter (where base_depois = 'FIT'), 0) / nullif(sum(qtd) filter (where base_depois is not null), 0), 1) as "DEPOIS produtividade %"
from contados
group by mes
order by mes;
