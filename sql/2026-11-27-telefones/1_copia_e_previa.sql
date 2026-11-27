-- =====================================================================
-- PASSO 1 — CÓPIA DE SEGURANÇA + PRÉVIA (não muda nenhum contato)
-- Telefones estragados (27/11/2026, decisão 2-A do dono). Cole tudo e clique em Run.
-- O resultado NÃO tem nome nem telefone: pode mandar o print.
--   QUEM_SAI  = contatos que vão para "Fora da fila > Telefone com problema", por unidade
--   FORMATO   = o "desenho" do que está escrito (9 = um número, a = uma letra), os mais comuns
--   CPF       = quantos CPFs que estão no lugar do telefone voltam para o campo CPF
-- =====================================================================
create table if not exists public.leads_backup_20261127_tel as select * from public.leads;
alter table public.leads_backup_20261127_tel enable row level security;

-- A MESMA regra de src/pages/CrmVisitantes/telefoneValido.js (mudou aqui, mudar lá)
create or replace function public.crm_telefone_utilizavel(p_tel text)
returns boolean language sql immutable set search_path = '' as $$
    select coalesce(p_tel, '') !~ '[[:alpha:]]'
       and coalesce(p_tel, '') !~ '\d{3}\.\d{3}\.\d{3}-\d{2}'
       and n ~ '^\d{10,11}$'
       and (length(n) = 10 or substr(n, 3, 1) = '9')
       and n !~ '^(\d)\1+$' and n !~ '^\d{2}(\d)\1{7,8}$'
    from (
        select case when d ~ '^55\d{10,11}$' then substr(d, 3) else d end as n
        from (select regexp_replace(coalesce(p_tel, ''), '\D', '', 'g') as d) a
    ) b
$$;

with candidatos as (
    select id, regexp_replace(substring(telefone from '\d{3}\.\d{3}\.\d{3}-\d{2}'), '\D', '', 'g') as novo_cpf
    from public.leads
    where coalesce(trim(cpf), '') = '' and telefone ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' and status <> 'Arquivado'
),
unicos as (
    select c.id, c.novo_cpf from candidatos c
    where (select count(*) from candidatos o where o.novo_cpf = c.novo_cpf) = 1
      and not exists (select 1 from public.leads l where regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g') = c.novo_cpf)
),
ruins as (
    select unidade, status, telefone from public.leads
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
),
formatos as (
    select unidade, left(regexp_replace(regexp_replace(coalesce(telefone, ''), '\d', '9', 'g'), '[[:alpha:]]', 'a', 'g'), 40) as desenho, count(*) as q
    from ruins group by 1, 2
),
top_formatos as (
    select *, row_number() over (partition by unidade order by q desc) as pos from formatos
)
select 'CPF' as secao, 'voltam para o campo CPF' as item, null::bigint as na_fila, null::bigint as em_perdido, count(*) as total from unicos
union all
select 'QUEM_SAI', unidade, count(*) filter (where status <> 'Perdido'), count(*) filter (where status = 'Perdido'), count(*) from ruins group by unidade
union all
select 'FORMATO', unidade || ' | [' || desenho || ']', null, null, q from top_formatos where pos <= 4
order by 1, 5 desc;
