-- =====================================================================
-- PRÉVIA DO CONSERTO: não muda nenhum contato (só cria 2 funções de apoio usadas aqui e no passo 2).
-- Precisa do passo 1 já rodado. Cole tudo e clique em Run. Resultado só com unidade e quantidades.
--   consertados_campo_cpf = o celular sai do campo CPF e vai para o telefone
--   consertados_dois_num  = havia dois telefones no mesmo campo: fica um (celular primeiro)
--   repetidos             = já existe outro contato com o mesmo nome e o mesmo número: vai para Fora da fila
--   fora_da_fila          = total que vai para "Fora da fila > Telefone com problema" (inclui os repetidos)
-- A MESMA regra está em src/pages/CrmVisitantes/telefoneValido.js (mudou aqui, mudar lá).
-- =====================================================================
create or replace function public.crm_cpf_de_verdade(p text)
returns boolean language sql immutable set search_path = '' as $$
    select case when d ~ '^\d{11}$' and d !~ '^(\d)\1{10}$' then
        (select ((sum(substr(d, i, 1)::int * (11 - i)) * 10) % 11) % 10 from generate_series(1, 9) i) = substr(d, 10, 1)::int
        and (select ((sum(substr(d, i, 1)::int * (12 - i)) * 10) % 11) % 10 from generate_series(1, 10) i) = substr(d, 11, 1)::int
    else false end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) a
$$;

create or replace function public.crm_telefone_sugerido(p_tel text, p_cpf text)
returns text language sql immutable set search_path = '' as $$
    with pedacos as (
        select t.pedaco, t.ordem
        from regexp_split_to_table(coalesce(p_tel, ''), '\s+-\s+|\s*[/;|,]\s*|\s+[oO][uU]\s+') with ordinality as t(pedaco, ordem)
        where t.pedaco <> ''
    ),
    bons as (
        select case when d ~ '^55\d{10,11}$' then substr(d, 3) else d end as n, ordem
        from (select regexp_replace(pedaco, '\D', '', 'g') as d, ordem from pedacos where public.crm_telefone_utilizavel(pedaco)) a
        where (select count(*) from pedacos) > 1
    ),
    do_cpf as (
        select case when d ~ '^55\d{10,11}$' then substr(d, 3) else d end as n
        from (select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') as d) a
        where coalesce(p_cpf, '') !~ '[[:alpha:]]'
    )
    select coalesce(
        (select n from bons order by (length(n) = 11) desc, ordem limit 1),
        (select n from do_cpf where n ~ '^[1-9][1-9]9\d{8}$' and public.crm_telefone_utilizavel(n) and not public.crm_cpf_de_verdade(n))
    )
$$;

with ruins as (
    select id, unidade, upper(trim(coalesce(nome, ''))) as quem, telefone, cpf,
           public.crm_telefone_sugerido(telefone, cpf) as numero
    from public.leads
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
),
existentes as (
    select distinct unidade, upper(trim(coalesce(nome, ''))) as quem,
        regexp_replace(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '^55(\d{10,11})$', '\1') as numero
    from public.leads where status <> 'Arquivado' and public.crm_telefone_utilizavel(telefone)
),
marcados as (
    -- junção (e não uma procura por linha) para não pesar no banco
    select r.*,
        r.numero is not null and (e.numero is not null or row_number() over (partition by r.unidade, r.quem, r.numero order by r.id) > 1) as repetido,
        r.numero is not null and r.numero = regexp_replace(regexp_replace(coalesce(r.cpf, ''), '\D', '', 'g'), '^55(\d{10,11})$', '\1') as veio_do_cpf
    from ruins r
    left join existentes e on e.unidade = r.unidade and e.quem = r.quem and e.numero = r.numero
)
select coalesce(unidade, 'TOTAL') as unidade,
    count(*) as telefone_estragado,
    count(*) filter (where numero is not null and not repetido and veio_do_cpf) as consertados_campo_cpf,
    count(*) filter (where numero is not null and not repetido and not veio_do_cpf) as consertados_dois_num,
    count(*) filter (where repetido) as repetidos,
    count(*) filter (where numero is null or repetido) as fora_da_fila
from marcados
group by rollup (unidade)
order by (unidade is null), 2 desc;
