-- =====================================================================
-- PASSO 2 de 3 — GUARDA OS TELEFONES DOS BLOQUEADOS E MOSTRA A PRÉVIA
-- Ainda NÃO arquiva ninguém. Cole tudo, Run, e MANDE O PRINT antes do passo 3.
-- "so_pelo_telefone" = contatos que só seriam arquivados por terem o mesmo telefone de um bloqueado.
-- =====================================================================

update public.crm_nao_contatar
set telefones_chave = public.nc_telefones_da_pessoa(cpf, lead_id, aluno_id::text)
where ativo;

with achados as (
    select l.id, l.status, true as direto
    from public.crm_nao_contatar n join public.leads l on l.id::text = n.lead_id
    where n.ativo
    union all
    select l.id, l.status, true
    from public.crm_nao_contatar n join public.leads l on l.cpf = n.cpf
    where n.ativo and coalesce(n.cpf, '') <> ''
    union all
    select l.id, l.status, false
    from public.crm_nao_contatar n join public.leads l on public.nc_chave_telefone(l.telefone) = any(n.telefones_chave)
    where n.ativo
),
por_contato as (select id, status, bool_or(direto) as direto from achados group by id, status)
select status,
       count(*) as contatos,
       count(*) filter (where not direto) as so_pelo_telefone,
       case when status in ('Fechado', 'Arquivado') then 'fica como está' else 'será arquivado' end as o_que_acontece
from por_contato
group by status
order by contatos desc;
