-- ============================================================
-- CONFERÊNCIA ETAPA 2 "NUTRI É ADICIONAL" — METAS, RELATÓRIOS e RANKING GLOBAL (antes × depois)
-- SÓ LEITURA: este comando não altera nada no banco (é só um SELECT).
-- Como usar: Supabase → SQL Editor → colar tudo → Run. Unidade: troque 'SANTA INES 2' (sem acento, maiúsculo).
--
-- METAS ANTES  = regra antiga da aba Metas (sem tirar repetidos; NUTRI primeiro; PLUS só sem Nutri)
-- METAS DEPOIS = regra nova (repetido no mesmo dia para a mesma matrícula conta 1; Plus inclui PLUS + NUTRI)
-- RELATÓRIOS/RANKING ANTES  = regra antiga (tira repetidos; NUTRI primeiro: combo contava só no Nutri)
-- RELATÓRIOS/RANKING DEPOIS = regra nova (combo conta no grupo base E no Nutri; PRATIQUE NUTRI só no Nutri)
-- ============================================================
with
norm as (
    select 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç'::text as de, 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'::text as para
),
catalogo_tipos as (
    select distinct upper(translate(trim(c.nome), n.de, n.para)) as nome_norm, lower(c.tipo) as tipo
    from public.catalogo c, norm n
),
base as (
    select
        v.id,
        to_char(v.data::date, 'YYYY-MM') as mes,
        upper(translate(trim(v.produto), n.de, n.para)) as nome,
        upper(trim(v.produto)) as produto_upper,
        coalesce(nullif(nullif(trim(v.quantidade::text), ''), '0')::numeric::int, 1) as qtd,
        nullif(trim(coalesce(v.matricula::text, '')), '') as matricula,
        v.data::date as dia
    from public.vendas v, norm n
    where upper(translate(trim(v.unidade), n.de, n.para)) = 'SANTA INES 2'
      and v.data::date between date '2026-09-01' and date '2026-10-31'
),
classificado as (
    select b.*, ct.tipo,
        case when ct.tipo = 'plano' and b.matricula is not null
             then row_number() over (partition by (ct.tipo = 'plano'), b.matricula, b.produto_upper, b.dia order by b.id)
             else 1 end as ordem,
        regexp_replace(b.nome, '\+?\s*NUTRI\M', ' ', 'g') as resto
    from base b
    left join catalogo_tipos ct on ct.nome_norm = b.nome
),
regras as (
    select mes, tipo, qtd, ordem, nome,
        -- Metas ANTES (grupoDaMeta): NUTRI → PERSONAL → PLUS/AFL
        case when tipo = 'plano' and nome like '%NUTRI%' then 'NUTRI'
             when tipo = 'plano' and nome like '%PERSONAL%' then 'PERSONAL'
             when tipo = 'plano' and (nome like '%PLUS%' or nome like '%AFL%') then 'PLUS'
             when tipo = 'produto' then 'PRODUTO' end as meta_antes,
        -- Relatórios ANTES: NUTRI → PLUS/AFL → FIT → PERSONAL → outros
        case when nome like '%NUTRI%' then 'NUTRI'
             when nome like '%PLUS%' or nome like '%AFL%' then 'PLUS'
             when nome like '%FIT%' then 'FIT'
             when nome like '%PERSONAL%' then 'PERSONAL'
             else 'OUTROS' end as rel_antes,
        -- DEPOIS (decomporPlano)
        (nome like '%NUTRI%') as nutri,
        case when resto like '%PLUS%' or resto like '%AFL%' then 'PLUS'
             when resto like '%FIT%' then 'FIT'
             when resto like '%PERSONAL%' then 'PERSONAL'
             when nome not like '%NUTRI%' then 'OUTROS'
             else null end as base_depois
    from classificado
)
select
    mes as "Mês",
    -- METAS
    sum(qtd) filter (where meta_antes = 'PLUS') as "META Plus ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and base_depois = 'PLUS') as "META Plus DEPOIS",
    sum(qtd) filter (where meta_antes = 'NUTRI') as "META Nutri ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and nutri) as "META Nutri DEPOIS",
    sum(qtd) filter (where meta_antes = 'PERSONAL') as "META Personal ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and base_depois = 'PERSONAL') as "META Personal DEPOIS",
    sum(qtd) filter (where tipo = 'produto') as "META Produto (igual)",
    -- RELATÓRIOS e RANKING GLOBAL
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and rel_antes = 'PLUS') as "REL Plus ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and base_depois = 'PLUS') as "REL Plus DEPOIS",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and rel_antes = 'FIT') as "REL Fit ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and base_depois = 'FIT') as "REL Fit DEPOIS",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and rel_antes = 'NUTRI') as "REL Nutri ANTES",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and nutri) as "REL Nutri DEPOIS",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1) as "REL total planos ANTES (com Nutri)",
    sum(qtd) filter (where tipo = 'plano' and ordem = 1 and base_depois is not null) as "REL total planos DEPOIS",
    -- Repetidos (mesmo plano + mesma matrícula + mesmo dia): se for > 0, a meta DEPOIS fica menor por causa deles
    sum(qtd) filter (where tipo = 'plano' and ordem > 1) as "Planos repetidos no mesmo dia"
from regras
group by mes
order by mes;
