-- =====================================================================
-- PASSO 3 de 3 — LIGA AS TRAVAS E ARQUIVA OS BLOQUEADOS
-- SÓ RODAR depois que a prévia do passo 2 for conferida.
-- Cole o arquivo INTEIRO e clique em Run. Nenhum contato é apagado. Desfazer: 9_desfazer.sql
-- =====================================================================

-- Trava 1: ao ENTRAR na lista, guarda os telefones da pessoa
create or replace function public.nc_guardar_telefones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    new.telefones_chave := nc_telefones_da_pessoa(new.cpf, new.lead_id, new.aluno_id::text);
    return new;
end $$;

drop trigger if exists nc_guardar_telefones_gatilho on public.crm_nao_contatar;
create trigger nc_guardar_telefones_gatilho before insert on public.crm_nao_contatar
    for each row execute function public.nc_guardar_telefones();

-- Trava 2: entrou na lista → arquiva os contatos da pessoa (rede inteira).
--          saiu da lista   → volta para o BANCO BRUTO (nunca para a Geladeira).
create or replace function public.nc_aplicar_nos_contatos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
    ids bigint[];
    cpf_pontos text := regexp_replace(coalesce(new.cpf, ''), '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4');
begin
    select array_agg(a.id) into ids from (
        select id from leads where new.lead_id is not null and id::text = new.lead_id
        union
        select id from leads where coalesce(new.cpf, '') <> '' and cpf in (new.cpf, cpf_pontos)
        union
        select id from leads where nc_chave_telefone(telefone) = any(new.telefones_chave)
    ) a;
    if ids is null then return new; end if;

    if new.ativo then
        update leads set status = 'Arquivado', bloqueado_nc = true, proximo_contato = null
        where id = any(ids) and coalesce(status, '') not in ('Arquivado', 'Fechado');
    else
        update leads l set status = 'Novo', bloqueado_nc = false, puxado_em = null, puxado_por = null,
            vendedor = case when upper(coalesce(l.origem, '')) = 'RECEPCAO' then l.vendedor else 'Importação' end,
            perdido_em = null, motivo_perda = null, proximo_contato = null
        where l.id = any(ids) and l.bloqueado_nc and not nc_bloqueado(l.cpf, l.id::text, l.telefone);
    end if;
    return new;
end $$;

drop trigger if exists nc_aplicar_nos_contatos_gatilho on public.crm_nao_contatar;
create trigger nc_aplicar_nos_contatos_gatilho after insert or update of ativo on public.crm_nao_contatar
    for each row execute function public.nc_aplicar_nos_contatos();

-- Trava 3: contato novo (lista, cadastro) ou reaberto de pessoa bloqueada já nasce/fica Arquivado
create or replace function public.nc_travar_contato() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    if coalesce(new.status, '') not in ('Fechado', 'Arquivado') and nc_bloqueado(new.cpf, new.id::text, new.telefone) then
        new.status := 'Arquivado';
        new.bloqueado_nc := true;
        new.proximo_contato := null;
    elsif tg_op = 'INSERT' and new.status = 'Arquivado' and nc_bloqueado(new.cpf, new.id::text, new.telefone) then
        new.bloqueado_nc := true;
    end if;
    return new;
end $$;

drop trigger if exists nc_travar_contato_gatilho on public.leads;
create trigger nc_travar_contato_gatilho before insert or update of status, telefone, cpf on public.leads
    for each row execute function public.nc_travar_contato();

-- Arquiva os que já estão na lista (Fechado continua Fechado: é história de venda)
update public.leads l set status = 'Arquivado', bloqueado_nc = true, proximo_contato = null
where coalesce(l.status, '') not in ('Arquivado', 'Fechado')
  and l.id in (
    select x.id from public.crm_nao_contatar n join public.leads x on x.id::text = n.lead_id where n.ativo
    union
    select x.id from public.crm_nao_contatar n join public.leads x on x.cpf = n.cpf where n.ativo and coalesce(n.cpf, '') <> ''
    union
    select x.id from public.crm_nao_contatar n join public.leads x on public.nc_chave_telefone(x.telefone) = any(n.telefones_chave) where n.ativo
  );

-- Conferência: antes (cópia) x agora. O TOTAL tem que ser igual (ou maior, se entrou contato novo)
with antes as (select coalesce(status, '(vazio)') as status, count(*) as q from public.leads_backup_20261127 group by 1),
     agora as (select coalesce(status, '(vazio)') as status, count(*) as q from public.leads group by 1),
     juntos as (
        select coalesce(a.status, b.status) as status, coalesce(a.q, 0) as antes, coalesce(b.q, 0) as agora
        from antes a full join agora b on a.status = b.status
     )
select status, antes, agora, agora - antes as diferenca from juntos
union all
select 'TOTAL', sum(antes), sum(agora), sum(agora) - sum(antes) from juntos
union all
select 'ARQUIVADOS PELO NAO CONTATAR', null, count(*), null from public.leads where bloqueado_nc;
