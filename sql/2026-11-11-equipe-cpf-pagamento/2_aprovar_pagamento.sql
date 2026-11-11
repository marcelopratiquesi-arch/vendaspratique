-- =====================================================================
-- PASSO 2: APROVAR PAGAMENTO DAS COMISSÕES + TRAVA (rode depois do passo 1)
-- Decisão do dono (11/11/2026): depois que o Líder confere e o Mentor/Admin "bate o martelo", a conferência
-- daquele mês e daquela unidade fica INALTERÁVEL.
--
-- O que faz:
--   1) tabela comissoes_pagamentos (unidade + mês + quem aprovou + quanto para cada pessoa + números das vendas)
--   2) comissao_aprovar_pagamento(unidade, 'AAAA-MM'): só ADMIN ou MENTOR (Mentor nas unidades dele);
--      só mês que já terminou; só com TODAS as vendas do mês conferidas; uma aprovação por unidade e mês
--   3) comissao_reabrir_pagamento(id, motivo): SÓ o ADMIN, com motivo (fica registrado; a linha não é apagada)
--   4) trava nas vendas: venda de unidade+mês aprovado não pode ser alterada, apagada nem desconferida, e não dá
--      para lançar/mover venda para esse mês (vale para o site, a Lixeira e o SQL Editor). Só o campo
--      vendedor_cpf pode ser preenchido (não mexe em dinheiro).
-- =====================================================================

-- 1) Tabela
create table if not exists public.comissoes_pagamentos (
  id                 bigserial primary key,
  unidade            text not null,
  mes                text not null check (mes ~ '^\d{4}-\d{2}$'),
  aprovado_em        timestamptz not null default now(),
  aprovado_por       text,
  aprovado_por_email text,
  total              numeric not null default 0,
  qtd_vendas         integer not null default 0,
  por_pessoa         jsonb not null default '[]'::jsonb,
  venda_ids          bigint[] not null default '{}',
  ativo              boolean not null default true,
  reaberto_em        timestamptz,
  reaberto_por       text,
  motivo_reabertura  text
);
create unique index if not exists comissoes_pagamentos_um_ativo
  on public.comissoes_pagamentos (upper(trim(unidade)), mes) where ativo;

alter table public.comissoes_pagamentos enable row level security;
-- Ler: funcionário, só das unidades dele (Admin todas). Gravar: só pelas funções abaixo.
drop policy if exists comissoes_pagamentos_ver on public.comissoes_pagamentos;
create policy comissoes_pagamentos_ver on public.comissoes_pagamentos
  for select to authenticated
  using ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

-- Valor em número (o campo pode estar como texto em vendas antigas)
create or replace function public.seg_numero(p text)
returns numeric language sql immutable as $$
  select coalesce(nullif(regexp_replace(replace(coalesce(p, ''), ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)
$$;

-- 2) Aprovar
create or replace function public.comissao_aprovar_pagamento(p_unidade text, p_mes text)
returns public.comissoes_pagamentos language plpgsql security definer set search_path = public as $$
declare
  v_papel     text := public.seg_papel();
  v_email     text := lower(trim(auth.jwt() ->> 'email'));
  v_nome      text;
  v_pend      integer;
  v_mes_atual text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
  v_reg       public.comissoes_pagamentos;
begin
  if v_papel is null or v_papel not in ('ADMIN', 'MENTOR') then
    raise exception 'Só o Admin ou o Mentor aprova o pagamento das comissões.';
  end if;
  if coalesce(p_mes, '') !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido (use AAAA-MM).'; end if;
  if p_mes >= v_mes_atual then raise exception 'Só dá para aprovar um mês que já terminou.'; end if;
  if coalesce(trim(p_unidade), '') = '' or upper(trim(p_unidade)) in ('TODAS', 'TODOS') then
    raise exception 'Escolha uma unidade para aprovar o pagamento.';
  end if;
  if not public.seg_ve_unidade(p_unidade) then raise exception 'A unidade % não é uma das suas.', p_unidade; end if;
  if exists (select 1 from public.comissoes_pagamentos
             where upper(trim(unidade)) = upper(trim(p_unidade)) and mes = p_mes and ativo) then
    raise exception 'O pagamento de % · % já foi aprovado.', upper(trim(p_unidade)), p_mes;
  end if;
  select count(*) into v_pend from public.vendas
   where upper(trim(unidade)) = upper(trim(p_unidade)) and left(data::text, 7) = p_mes and coalesce(conferiu, false) = false;
  if v_pend > 0 then
    raise exception 'Ainda há % venda(s) sem conferir em % · %. Confira tudo antes de aprovar.', v_pend, upper(trim(p_unidade)), p_mes;
  end if;
  select nome into v_nome from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;

  with vs as (
    select id, vendedor, vendedor_cpf, public.seg_numero(valor::text) as valor
      from public.vendas
     where upper(trim(unidade)) = upper(trim(p_unidade)) and left(data::text, 7) = p_mes and coalesce(conferiu, false) = true
  ), pessoas as (
    select max(vendedor) as nome, max(vendedor_cpf) as cpf, count(*) as qtd, sum(valor) as total
      from vs where valor > 0
     group by coalesce(vendedor_cpf, 'nome:' || public.equipe_nome_chave(vendedor))
  )
  insert into public.comissoes_pagamentos (unidade, mes, aprovado_por, aprovado_por_email, total, qtd_vendas, por_pessoa, venda_ids)
  select upper(trim(p_unidade)), p_mes, coalesce(v_nome, v_email), v_email,
         coalesce((select sum(valor) from vs where valor > 0), 0),
         (select count(*) from vs),
         coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'cpf', cpf, 'qtd', qtd, 'total', total) order by total desc) from pessoas), '[]'::jsonb),
         coalesce((select array_agg(id::bigint order by id) from vs), '{}')
  returning * into v_reg;
  return v_reg;
end;
$$;
revoke execute on function public.comissao_aprovar_pagamento(text, text) from public, anon;
grant execute on function public.comissao_aprovar_pagamento(text, text) to authenticated;

-- 3) Reabrir (só o Admin, com motivo; a aprovação antiga fica guardada como "reaberta")
create or replace function public.comissao_reabrir_pagamento(p_id bigint, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(auth.jwt() ->> 'email'));
  v_nome  text;
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin reabre um pagamento aprovado.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  select nome into v_nome from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;
  update public.comissoes_pagamentos
     set ativo = false, reaberto_em = now(), reaberto_por = coalesce(v_nome, v_email), motivo_reabertura = trim(p_motivo)
   where id = p_id and ativo;
  if not found then raise exception 'Pagamento não encontrado ou já reaberto.'; end if;
  return 'Pagamento reaberto: a conferência desse mês voltou a poder ser mexida.';
end;
$$;
revoke execute on function public.comissao_reabrir_pagamento(bigint, text) from public, anon;
grant execute on function public.comissao_reabrir_pagamento(bigint, text) to authenticated;

-- 4) Trava nas vendas
create or replace function public.vendas_trava_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- Só o CPF do vendedor mudou (passo 1): pode, não mexe em dinheiro
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'vendedor_cpf') = (to_jsonb(old) - 'vendedor_cpf') then return new; end if;
    if exists (select 1 from public.comissoes_pagamentos p
               where p.ativo and upper(trim(p.unidade)) = upper(trim(old.unidade)) and p.mes = left(old.data::text, 7)) then
      raise exception 'A venda % é de % · % e o pagamento desse mês já foi aprovado: não pode ser alterada nem apagada. Para corrigir, peça ao Admin para reabrir o pagamento.',
        old.id, upper(trim(old.unidade)), left(old.data::text, 7);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if exists (select 1 from public.comissoes_pagamentos p
               where p.ativo and upper(trim(p.unidade)) = upper(trim(new.unidade)) and p.mes = left(new.data::text, 7)) then
      raise exception 'O pagamento de % · % já foi aprovado: não dá para lançar nem mover venda para esse mês. Para corrigir, peça ao Admin para reabrir o pagamento.',
        upper(trim(new.unidade)), left(new.data::text, 7);
    end if;
    return new;
  end if;
  return old;
end;
$$;
drop trigger if exists vendas_trava_pagamento_gatilho on public.vendas;
create trigger vendas_trava_pagamento_gatilho
  before insert or update or delete on public.vendas
  for each row execute function public.vendas_trava_pagamento();

-- Conferência (MANDE ESTE RESULTADO): tudo criado?
select 'tabela comissoes_pagamentos' as item, (to_regclass('public.comissoes_pagamentos') is not null)::text as ok
union all select 'função aprovar', exists (select 1 from pg_proc where proname = 'comissao_aprovar_pagamento')::text
union all select 'função reabrir', exists (select 1 from pg_proc where proname = 'comissao_reabrir_pagamento')::text
union all select 'trava nas vendas', exists (select 1 from pg_trigger where tgname = 'vendas_trava_pagamento_gatilho')::text
union all select 'gatilho do CPF', exists (select 1 from pg_trigger where tgname = 'vendas_cpf_vendedor_gatilho')::text;
