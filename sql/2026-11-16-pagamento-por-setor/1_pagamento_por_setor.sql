-- =====================================================================
-- PASSO 1: APROVAR PAGAMENTO POR SETOR (rode depois do passo 0)
-- Decisão do dono (16/11/2026): no Fechamento → Comissões, com um SETOR escolhido no filtro, "Aprovar pagamento"
-- aprova SÓ aquele setor; os outros setores continuam em aberto. Com "Todos os setores", continua aprovando a
-- unidade inteira (ou o que ainda falta, se algum setor já foi aprovado).
--
-- NÃO altera nenhuma venda, valor ou comissão. O que muda:
--   1) comissoes_pagamentos ganha os campos "setor" e "setor_nome" (vazio = unidade inteira, como hoje)
--      e passa a aceitar uma aprovação ativa por unidade + mês + setor
--   2) equipe_setor_chave(vendedor, cpf do vendedor, unidade): o setor de quem vendeu, pelo cadastro da Equipe.
--      É A MESMA REGRA da tela (src/pages/FechamentoCaixa/setorDaVenda.js). Mudou lá, tem que mudar aqui.
--   3) comissao_aprovar_pagamento_setor(...): aprova um setor. A tela manda o total e a quantidade que está
--      mostrando; o banco calcula sozinho e, se não bater, NÃO aprova.
--   4) comissao_aprovar_pagamento(unidade, mês): igual a antes, mas não paga de novo o que já foi pago num setor
--   5) trava: pagamento de SETOR trava só as vendas daquele pagamento (e não deixa lançar/mover venda nova de
--      alguém daquele setor para o mês pago); pagamento da UNIDADE trava o mês inteiro, como hoje
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Mande o resultado da conferência do fim.
-- =====================================================================

-- 1) Campos novos e uma aprovação ativa por unidade + mês + setor
alter table public.comissoes_pagamentos add column if not exists setor text;
alter table public.comissoes_pagamentos add column if not exists setor_nome text;
drop index if exists public.comissoes_pagamentos_um_ativo;
create unique index if not exists comissoes_pagamentos_um_ativo_setor
  on public.comissoes_pagamentos (upper(trim(unidade)), mes, coalesce(setor, '')) where ativo;

-- 2) Setor de quem vendeu (mesma regra da tela)
--    Pessoa: pelo CPF do vendedor (a ativa primeiro); sem CPF na Equipe, pelo NOME EXATO (sem acento/espaço a mais;
--    homônimos: ficam as ativas, depois as da unidade da venda; empate = o cadastro mais antigo).
--    Setor: campo "role" da Equipe → RECEPCAO, MUSCULACAO, BEM_ESTAR, SAVER, LIDER; outro nome = 'OUTRO:NOME';
--    ninguém achado ou sem setor = 'SEM_SETOR'.
create or replace function public.equipe_setor_chave(p_vendedor text, p_vendedor_cpf text, p_unidade text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_cpf   text := regexp_replace(coalesce(p_vendedor_cpf, ''), '\D', '', 'g');
  v_nome  text := public.equipe_nome_chave(p_vendedor);
  v_un    text := upper(trim(coalesce(p_unidade, '')));
  v_role  text;
  v_achou boolean := false;
  v_n     text;
begin
  if length(v_cpf) = 11 then
    select c.role, true into v_role, v_achou
      from public.colaboradores c
     where regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cpf
     order by (c.ativo is distinct from false) desc, c.id
     limit 1;
  end if;
  if not coalesce(v_achou, false) and v_nome <> '' then
    with cand as (
      select c.id, c.role, (c.ativo is distinct from false) as ativo,
             (v_un <> '' and upper(trim(coalesce(c.unidade, ''))) = v_un) as da_unidade
        from public.colaboradores c
       where public.equipe_nome_chave(c.nome) = v_nome
    ), f1 as (
      select * from cand where ativo or not exists (select 1 from cand where ativo)
    ), f2 as (
      select * from f1 where da_unidade or not exists (select 1 from f1 where da_unidade)
    )
    select f2.role, true into v_role, v_achou from f2 order by f2.id limit 1;
  end if;
  if not coalesce(v_achou, false) then return 'SEM_SETOR'; end if;
  v_n := public.equipe_nome_chave(v_role);
  if v_n = '' then return 'SEM_SETOR'; end if;
  if position('RECEP' in v_n) > 0 then return 'RECEPCAO'; end if;
  if position('MUSCULA' in v_n) > 0 then return 'MUSCULACAO'; end if;
  if position('BEM-ESTAR' in v_n) > 0 or position('BEM ESTAR' in v_n) > 0 or position('BEMESTAR' in v_n) > 0 then return 'BEM_ESTAR'; end if;
  if position('SAVER' in v_n) > 0 then return 'SAVER'; end if;
  if position('LIDER' in v_n) > 0 then return 'LIDER'; end if;
  return 'OUTRO:' || v_n;
end;
$$;
revoke execute on function public.equipe_setor_chave(text, text, text) from public, anon;
grant execute on function public.equipe_setor_chave(text, text, text) to authenticated;

-- 3) Aprovar UM setor
create or replace function public.comissao_aprovar_pagamento_setor(
  p_unidade text, p_mes text, p_setor text, p_setor_nome text, p_total_esperado numeric, p_qtd_esperada integer)
returns public.comissoes_pagamentos language plpgsql security definer set search_path = public as $$
declare
  v_papel     text := public.seg_papel();
  v_email     text := lower(trim(auth.jwt() ->> 'email'));
  v_nome      text;
  v_pend      integer;
  v_qtd       integer;
  v_total     numeric;
  v_un        text := upper(trim(coalesce(p_unidade, '')));
  v_setor     text := trim(coalesce(p_setor, ''));
  v_rotulo    text := coalesce(nullif(trim(coalesce(p_setor_nome, '')), ''), trim(coalesce(p_setor, '')));
  v_mes_atual text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
  v_reg       public.comissoes_pagamentos;
begin
  if v_papel is null or v_papel not in ('ADMIN', 'MENTOR') then
    raise exception 'Só o Admin ou o Mentor aprova o pagamento das comissões.';
  end if;
  if coalesce(p_mes, '') !~ '^\d{4}-\d{2}$' then raise exception 'Mês inválido (use AAAA-MM).'; end if;
  if p_mes >= v_mes_atual then raise exception 'Só dá para aprovar um mês que já terminou.'; end if;
  if v_un = '' or v_un in ('TODAS', 'TODOS') then raise exception 'Escolha uma unidade para aprovar o pagamento.'; end if;
  if v_setor = '' or upper(v_setor) in ('TODAS', 'TODOS') then raise exception 'Escolha um setor para aprovar o pagamento do setor.'; end if;
  if not public.seg_ve_unidade(p_unidade) then raise exception 'A unidade % não é uma das suas.', p_unidade; end if;
  if exists (select 1 from public.comissoes_pagamentos
             where upper(trim(unidade)) = v_un and mes = p_mes and ativo and setor is null) then
    raise exception 'O pagamento de % · % já foi aprovado para a unidade inteira.', v_un, p_mes;
  end if;
  if exists (select 1 from public.comissoes_pagamentos
             where upper(trim(unidade)) = v_un and mes = p_mes and ativo and setor = v_setor) then
    raise exception 'O pagamento de % · % · setor % já foi aprovado.', v_un, p_mes, v_rotulo;
  end if;

  select count(*) into v_pend from public.vendas v
   where upper(trim(v.unidade)) = v_un and left(v.data::text, 7) = p_mes and coalesce(v.conferiu, false) = false
     and public.equipe_setor_chave(v.vendedor, v.vendedor_cpf, v.unidade) = v_setor;
  if v_pend > 0 then
    raise exception 'Ainda há % venda(s) sem conferir do setor % em % · %. Confira tudo antes de aprovar.', v_pend, v_rotulo, v_un, p_mes;
  end if;

  -- Vendas conferidas do setor que ainda não entraram em nenhum pagamento
  select count(*), coalesce(sum(public.seg_numero(v.valor::text)) filter (where public.seg_numero(v.valor::text) > 0), 0)
    into v_qtd, v_total
    from public.vendas v
   where upper(trim(v.unidade)) = v_un and left(v.data::text, 7) = p_mes and coalesce(v.conferiu, false) = true
     and public.equipe_setor_chave(v.vendedor, v.vendedor_cpf, v.unidade) = v_setor
     and not exists (select 1 from public.comissoes_pagamentos p
                      where p.ativo and upper(trim(p.unidade)) = v_un and p.mes = p_mes and v.id = any (p.venda_ids));
  if v_qtd = 0 then raise exception 'O setor % não tem venda conferida para pagar em % · %.', v_rotulo, v_un, p_mes; end if;
  -- A tela e o banco têm que mostrar a mesma coisa (senão alguém aprovaria um valor achando que é outro)
  if round(v_total, 2) <> round(coalesce(p_total_esperado, -1), 2) or v_qtd <> coalesce(p_qtd_esperada, -1) then
    raise exception 'O pagamento NÃO foi aprovado: a tela mostra R$ % (% vendas) e o banco calculou R$ % (% vendas) para o setor %. Recarregue a página (F5) e tente de novo; se continuar, avise o suporte.',
      round(coalesce(p_total_esperado, 0), 2), coalesce(p_qtd_esperada, 0), round(v_total, 2), v_qtd, v_rotulo;
  end if;

  select nome into v_nome from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;

  with vs as (
    select v.id, v.vendedor, v.vendedor_cpf, public.seg_numero(v.valor::text) as valor
      from public.vendas v
     where upper(trim(v.unidade)) = v_un and left(v.data::text, 7) = p_mes and coalesce(v.conferiu, false) = true
       and public.equipe_setor_chave(v.vendedor, v.vendedor_cpf, v.unidade) = v_setor
       and not exists (select 1 from public.comissoes_pagamentos p
                        where p.ativo and upper(trim(p.unidade)) = v_un and p.mes = p_mes and v.id = any (p.venda_ids))
  ), pessoas as (
    select max(vendedor) as nome, max(vendedor_cpf) as cpf, count(*) as qtd, sum(valor) as total
      from vs where valor > 0
     group by coalesce(vendedor_cpf, 'nome:' || public.equipe_nome_chave(vendedor))
  )
  insert into public.comissoes_pagamentos (unidade, mes, setor, setor_nome, aprovado_por, aprovado_por_email, total, qtd_vendas, por_pessoa, venda_ids)
  select v_un, p_mes, v_setor, v_rotulo, coalesce(v_nome, v_email), v_email,
         coalesce((select sum(valor) from vs where valor > 0), 0),
         (select count(*) from vs),
         coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'cpf', cpf, 'qtd', qtd, 'total', total) order by total desc) from pessoas), '[]'::jsonb),
         coalesce((select array_agg(id::bigint order by id) from vs), '{}')
  returning * into v_reg;
  return v_reg;
end;
$$;
revoke execute on function public.comissao_aprovar_pagamento_setor(text, text, text, text, numeric, integer) from public, anon;
grant execute on function public.comissao_aprovar_pagamento_setor(text, text, text, text, numeric, integer) to authenticated;

-- 4) Aprovar a UNIDADE INTEIRA: igual a antes; só não paga de novo o que já foi pago num setor
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
             where upper(trim(unidade)) = upper(trim(p_unidade)) and mes = p_mes and ativo and setor is null) then
    raise exception 'O pagamento de % · % já foi aprovado.', upper(trim(p_unidade)), p_mes;
  end if;
  select count(*) into v_pend from public.vendas
   where upper(trim(unidade)) = upper(trim(p_unidade)) and left(data::text, 7) = p_mes and coalesce(conferiu, false) = false;
  if v_pend > 0 then
    raise exception 'Ainda há % venda(s) sem conferir em % · %. Confira tudo antes de aprovar.', v_pend, upper(trim(p_unidade)), p_mes;
  end if;
  select nome into v_nome from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;

  with vs as (
    select v.id, v.vendedor, v.vendedor_cpf, public.seg_numero(v.valor::text) as valor
      from public.vendas v
     where upper(trim(v.unidade)) = upper(trim(p_unidade)) and left(v.data::text, 7) = p_mes and coalesce(v.conferiu, false) = true
       -- o que já foi pago num setor não entra de novo
       and not exists (select 1 from public.comissoes_pagamentos p
                        where p.ativo and upper(trim(p.unidade)) = upper(trim(p_unidade)) and p.mes = p_mes and v.id = any (p.venda_ids))
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

-- 5) Trava nas vendas
--    Pagamento da UNIDADE (setor vazio): trava o mês inteiro, como antes.
--    Pagamento de SETOR: trava as vendas que estão naquele pagamento; e não deixa LANÇAR venda nova, nem MOVER venda
--    (trocar unidade, data ou vendedor), de alguém daquele setor para o mês já pago. As vendas dos outros setores
--    continuam livres (conferir, editar, apagar).
create or replace function public.vendas_trava_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_setor text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- Só o CPF do vendedor mudou (passo 1 de 11/11/2026): pode, não mexe em dinheiro
    if tg_op = 'UPDATE' and (to_jsonb(new) - 'vendedor_cpf') = (to_jsonb(old) - 'vendedor_cpf') then return new; end if;
    if exists (select 1 from public.comissoes_pagamentos p
               where p.ativo and upper(trim(p.unidade)) = upper(trim(old.unidade)) and p.mes = left(old.data::text, 7)
                 and (p.setor is null or old.id = any (p.venda_ids))) then
      raise exception 'A venda % é de % · % e o pagamento dela já foi aprovado: não pode ser alterada nem apagada. Para corrigir, peça ao Admin para reabrir o pagamento.',
        old.id, upper(trim(old.unidade)), left(old.data::text, 7);
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    if exists (select 1 from public.comissoes_pagamentos p
               where p.ativo and upper(trim(p.unidade)) = upper(trim(new.unidade)) and p.mes = left(new.data::text, 7)
                 and p.setor is null) then
      raise exception 'O pagamento de % · % já foi aprovado: não dá para lançar nem mover venda para esse mês. Para corrigir, peça ao Admin para reabrir o pagamento.',
        upper(trim(new.unidade)), left(new.data::text, 7);
    end if;
    -- Venda nova, ou venda que mudou de unidade, mês ou vendedor: não pode cair num setor já pago
    if tg_op = 'INSERT'
       or upper(trim(new.unidade)) is distinct from upper(trim(old.unidade))
       or left(new.data::text, 7) is distinct from left(old.data::text, 7)
       or new.vendedor is distinct from old.vendedor
       or new.vendedor_cpf is distinct from old.vendedor_cpf then
      if exists (select 1 from public.comissoes_pagamentos p
                 where p.ativo and upper(trim(p.unidade)) = upper(trim(new.unidade)) and p.mes = left(new.data::text, 7)
                   and p.setor is not null) then
        v_setor := public.equipe_setor_chave(new.vendedor, new.vendedor_cpf, new.unidade);
        if exists (select 1 from public.comissoes_pagamentos p
                   where p.ativo and upper(trim(p.unidade)) = upper(trim(new.unidade)) and p.mes = left(new.data::text, 7)
                     and p.setor = v_setor) then
          raise exception 'O pagamento do setor de % em % · % já foi aprovado: não dá para lançar nem mover venda dessa pessoa para esse mês. Para corrigir, peça ao Admin para reabrir o pagamento do setor.',
            coalesce(new.vendedor, '(sem vendedor)'), upper(trim(new.unidade)), left(new.data::text, 7);
        end if;
      end if;
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
select 'campo setor' as item, exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comissoes_pagamentos' and column_name = 'setor')::text as ok
union all select 'trava de uma aprovação por setor', (to_regclass('public.comissoes_pagamentos_um_ativo_setor') is not null)::text
union all select 'função do setor', exists (select 1 from pg_proc where proname = 'equipe_setor_chave')::text
union all select 'função aprovar setor', exists (select 1 from pg_proc where proname = 'comissao_aprovar_pagamento_setor')::text
union all select 'aprovar unidade (versão nova)', exists (select 1 from pg_proc where proname = 'comissao_aprovar_pagamento' and pg_get_functiondef(oid) like '%any (p.venda_ids)%')::text
union all select 'trava nas vendas (versão nova)', exists (select 1 from pg_proc where proname = 'vendas_trava_pagamento' and pg_get_functiondef(oid) like '%equipe_setor_chave%')::text
union all select 'pagamentos já aprovados (continuam valendo)', count(*)::text from public.comissoes_pagamentos where ativo;
