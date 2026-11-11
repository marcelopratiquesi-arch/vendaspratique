-- =====================================================================
-- PASSO 1: CPF DO VENDEDOR NA VENDA (rode depois do passo 0)
-- ⚠️ RODE FORA DO HORÁRIO DE MOVIMENTO (à noite): o item 4 atualiza muitas vendas de uma vez e cada uma
--    manda um aviso de tempo real para as telas abertas (regra 12 do CLAUDE.md). Valor e comissão NÃO mudam.
--
-- O que faz:
--   1) cria o campo vendas.vendedor_cpf (só números)
--   2) equipe_cpf_do_nome: acha o CPF pelo nome da Equipe (sem acento/maiúscula/espaço a mais), SÓ quando uma
--      única pessoa tem aquele nome (empate = a ativa da unidade da venda; se ainda empatar, fica em branco)
--   3) gatilho: toda venda nova (e toda troca de vendedor) ganha o CPF sozinha, mesmo se a tela não mandar
--   4) preenche as vendas antigas (só onde o nome bate com UMA pessoa)
--   5) mostra quem ficou sem CPF (nome da venda que não está na Equipe) para o dono conferir
-- =====================================================================

-- 1) Campo novo
alter table public.vendas add column if not exists vendedor_cpf text;
create index if not exists vendas_vendedor_cpf_idx on public.vendas (vendedor_cpf);

-- 2) Nome "chave" (sem acento, maiúsculo, um espaço só) e CPF pelo nome
create or replace function public.equipe_nome_chave(p text)
returns text language sql immutable as $$
  select upper(regexp_replace(trim(translate(coalesce(p, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'))
$$;

create or replace function public.equipe_cpf_do_nome(p_nome text, p_unidade text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_cpfs text[];
begin
  if coalesce(trim(p_nome), '') = '' then return null; end if;
  select array_agg(distinct regexp_replace(c.cpf, '\D', '', 'g')) into v_cpfs
  from public.colaboradores c
  where public.equipe_nome_chave(c.nome) = public.equipe_nome_chave(p_nome)
    and length(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')) = 11;
  if coalesce(array_length(v_cpfs, 1), 0) = 1 then return v_cpfs[1]; end if;
  -- Mesmo nome com CPFs diferentes: a pessoa ATIVA da unidade da venda
  if coalesce(array_length(v_cpfs, 1), 0) > 1 and p_unidade is not null then
    select array_agg(distinct regexp_replace(c.cpf, '\D', '', 'g')) into v_cpfs
    from public.colaboradores c
    where public.equipe_nome_chave(c.nome) = public.equipe_nome_chave(p_nome)
      and upper(trim(c.unidade)) = upper(trim(p_unidade))
      and c.ativo is distinct from false
      and length(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')) = 11;
    if coalesce(array_length(v_cpfs, 1), 0) = 1 then return v_cpfs[1]; end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.equipe_cpf_do_nome(text, text) from public, anon;
grant execute on function public.equipe_cpf_do_nome(text, text) to authenticated;

-- 3) Gatilho: preenche sozinho (venda nova e troca de vendedor). Não mexe em valor nem comissão.
create or replace function public.vendas_preencher_cpf_vendedor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.vendedor_cpf is not null then
    new.vendedor_cpf := nullif(regexp_replace(new.vendedor_cpf, '\D', '', 'g'), '');
  end if;
  -- Trocou o vendedor e a tela não mandou o CPF novo: procura de novo pelo nome
  if tg_op = 'UPDATE' and new.vendedor is distinct from old.vendedor and new.vendedor_cpf is not distinct from old.vendedor_cpf then
    new.vendedor_cpf := null;
  end if;
  if new.vendedor_cpf is null then
    new.vendedor_cpf := public.equipe_cpf_do_nome(new.vendedor, new.unidade);
  end if;
  return new;
end;
$$;
drop trigger if exists vendas_cpf_vendedor_gatilho on public.vendas;
create trigger vendas_cpf_vendedor_gatilho
  before insert or update of vendedor, vendedor_cpf on public.vendas
  for each row execute function public.vendas_preencher_cpf_vendedor();

-- 4) Vendas antigas: só onde o nome bate com UMA pessoa (as outras ficam em branco e aparecem no item 5)
update public.vendas v
   set vendedor_cpf = public.equipe_cpf_do_nome(v.vendedor, v.unidade)
 where v.vendedor_cpf is null
   and public.equipe_cpf_do_nome(v.vendedor, v.unidade) is not null;

-- 5) Conferência (MANDE ESTE RESULTADO)
select 'vendas com CPF do vendedor' as item, count(*)::text as valor from public.vendas where vendedor_cpf is not null
union all select 'vendas SEM CPF do vendedor', count(*)::text from public.vendas where vendedor_cpf is null;

-- Quem ficou sem CPF (o nome da venda não está na Equipe, ou há duas pessoas com o mesmo nome)
select unidade, vendedor, count(*) as vendas, min(data) as primeira, max(data) as ultima
from public.vendas
where vendedor_cpf is null
group by unidade, vendedor
order by count(*) desc;
