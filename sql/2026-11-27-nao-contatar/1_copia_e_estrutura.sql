-- =====================================================================
-- PASSO 1 de 3 — CÓPIA DE SEGURANÇA + ESTRUTURA (não muda nenhum contato)
-- "Não contatar" → Arquivado, bloqueando também pelo TELEFONE (27/11/2026, decisão do dono).
-- Cole o arquivo INTEIRO no SQL Editor e clique em Run. No fim aparece a conferência.
-- Não mexe em vendas nem comissão.
-- =====================================================================

-- Cópias de segurança (com o acesso pelo site TRANCADO)
create table if not exists public.leads_backup_20261127 as select * from public.leads;
alter table public.leads_backup_20261127 enable row level security;
create table if not exists public.crm_nao_contatar_backup_20261127 as select * from public.crm_nao_contatar;
alter table public.crm_nao_contatar_backup_20261127 enable row level security;

-- Marca os contatos que foram arquivados POR CAUSA do "Não contatar" (só eles voltam se alguém sair da lista)
alter table public.leads add column if not exists bloqueado_nc boolean not null default false;
alter table public.crm_nao_contatar add column if not exists telefones_chave text[] not null default '{}';

-- A MESMA regra de src/pages/CrmVisitantes/telefoneBloqueio.js: DDD + 8 últimos números.
-- Vazio (não bloqueia): sem DDD, incompleto ou número de preenchimento (31999999999 e parecidos).
create or replace function public.nc_chave_telefone(p_telefone text)
returns text language sql immutable set search_path = '' as $$
    select case
        when n !~ '^\d{10,11}$' then ''
        when n ~ '^(\d)\1+$' or n ~ '^\d{2}(\d)\1{7,8}$' then ''
        else left(n, 2) || right(n, 8)
    end
    from (
        select case when d ~ '^55\d{10,11}$' then substr(d, 3) else d end as n
        from (select regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g') as d) a
    ) b
$$;

create index if not exists leads_nc_telefone_idx on public.leads (public.nc_chave_telefone(telefone));

-- Todos os telefones da pessoa bloqueada (do contato, do CPF e do cadastro de aluno).
-- Trava de segurança: número usado por MAIS DE 5 contatos é tratado como número de preenchimento e não bloqueia.
create or replace function public.nc_telefones_da_pessoa(p_cpf text, p_lead_id text, p_aluno_id text)
returns text[] language sql stable security definer set search_path = public as $$
    with achados as (
        select telefone from leads where p_lead_id is not null and id::text = p_lead_id
        union all
        select telefone from leads where coalesce(p_cpf, '') <> '' and cpf = p_cpf
        union all
        select telefone from alunos where coalesce(p_cpf, '') <> '' and cpf = p_cpf
        union all
        select telefone from alunos where p_aluno_id is not null and id::text = p_aluno_id
    ),
    chaves as (select distinct nc_chave_telefone(telefone) as k from achados)
    select coalesce(array_agg(k), '{}')
    from chaves
    where k <> '' and (select count(*) from leads l where nc_chave_telefone(l.telefone) = chaves.k) <= 5
$$;

-- Esta pessoa está no "Não contatar"? (CPF, contato ou telefone)
create or replace function public.nc_bloqueado(p_cpf text, p_lead_id text, p_telefone text)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from crm_nao_contatar n,
             (select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') as cpf, nc_chave_telefone(p_telefone) as tel) p
        where n.ativo and (
            (p.cpf <> '' and n.cpf = p.cpf)
            or (p_lead_id is not null and n.lead_id = p_lead_id)
            or (p.tel <> '' and p.tel = any(n.telefones_chave))
        )
    )
$$;

-- Estas duas só servem para as travas: ninguém chama pelo site
revoke execute on function public.nc_telefones_da_pessoa(text, text, text) from public, anon, authenticated;
revoke execute on function public.nc_bloqueado(text, text, text) from public, anon, authenticated;

-- Conferência: as duas linhas de cada tabela precisam ter números IGUAIS
select 'leads' as tabela, (select count(*) from public.leads) as agora, (select count(*) from public.leads_backup_20261127) as copia
union all
select 'crm_nao_contatar', (select count(*) from public.crm_nao_contatar), (select count(*) from public.crm_nao_contatar_backup_20261127);
