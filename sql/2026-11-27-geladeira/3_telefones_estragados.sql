-- =====================================================================
-- SÓ LEITURA e SEM dados pessoais: pode mandar o print para o Claude.
-- Quantos contatos do CRM têm o campo telefone estragado e quantos dá para recuperar pelo cadastro do aluno (CPF).
-- (usa a função nc_chave_telefone, criada em sql/2026-11-27-nao-contatar)
-- =====================================================================
with c as (
    select unidade, status, regexp_replace(coalesce(cpf, ''), '\D', '', 'g') as cpf,
           trim(coalesce(telefone, '')) as tel,
           regexp_replace(coalesce(telefone, ''), '\D', '', 'g') as num
    from public.leads
    where status <> 'Arquivado'
),
r as (
    select unidade, status, cpf,
        case
            when tel = '' or upper(tel) = 'S/N' then '1 vazio ou S/N'
            when tel ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' then '2 CPF no lugar do telefone'
            when length(num) = 0 then '3 texto no lugar do telefone'
            when length(num) = 11 and substr(num, 3, 1) <> '9' then '4 onze numeros sem o 9 (parece CPF)'
            when length(num) < 10 then '5 numero incompleto'
            when public.nc_chave_telefone(tel) = '' then '6 preenchimento ou tamanho errado'
        end as problema
    from c
)
select r.unidade, r.problema,
       count(*) as contatos,
       count(*) filter (where r.status in ('Novo', 'Em Contato')) as ainda_na_fila,
       count(*) filter (where r.status = 'Perdido') as em_perdido,
       count(*) filter (where length(r.cpf) = 11) as com_cpf,
       count(*) filter (where length(r.cpf) = 11 and exists (
           select 1 from public.alunos a
           where a.cpf = r.cpf and public.nc_chave_telefone(a.telefone) <> ''
             and substr(regexp_replace(a.telefone, '\D', '', 'g'), 3, 1) = '9'
       )) as celular_no_cadastro
from r
where r.problema is not null
group by r.unidade, r.problema
order by r.unidade, r.problema;
