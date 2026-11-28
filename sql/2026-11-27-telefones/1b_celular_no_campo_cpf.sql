-- =====================================================================
-- CONSULTA SÓ DE LEITURA: não muda nada no banco. Cole tudo e clique em Run.
-- Pergunta: dos contatos com telefone estragado, quantos têm um CELULAR guardado no campo CPF?
-- O resultado só tem unidade e quantidades (sem nome, CPF ou telefone): pode mandar o print.
--   telefone_estragado   = contatos na fila ou em Perdido com telefone que não dá para usar
--   celular_no_cpf       = desses, o campo CPF tem cara de celular E não é um CPF de verdade
--   duvida               = o campo CPF tem cara de celular mas também passa como CPF (conferir à parte)
-- Precisa do passo 1 já rodado (usa a função crm_telefone_utilizavel).
-- =====================================================================
with ruins as (
    select unidade, regexp_replace(coalesce(cpf, ''), '\D', '', 'g') as c
    from public.leads
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
),
marcados as (
    select unidade, c,
        (c ~ '^[1-9][1-9]9\d{8}$') as parece_celular,
        case when c ~ '^\d{11}$' and c !~ '^(\d)\1{10}$' then
            -- os dois números de conferência do CPF
            (select ((sum(substr(c, i, 1)::int * (11 - i)) * 10) % 11) % 10 from generate_series(1, 9) i) = substr(c, 10, 1)::int
            and (select ((sum(substr(c, i, 1)::int * (12 - i)) * 10) % 11) % 10 from generate_series(1, 10) i) = substr(c, 11, 1)::int
        else false end as cpf_de_verdade
    from ruins
)
select coalesce(unidade, 'TOTAL') as unidade,
    count(*) as telefone_estragado,
    count(*) filter (where parece_celular and not cpf_de_verdade) as celular_no_cpf,
    count(*) filter (where parece_celular and cpf_de_verdade) as duvida
from marcados
group by rollup (unidade)
order by (unidade is null), 2 desc;
