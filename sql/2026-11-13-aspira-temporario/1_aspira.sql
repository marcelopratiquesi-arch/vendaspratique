-- =====================================================================
-- PASSO 1 (ETAPA 1): DOIS LÍDERES FIXOS POR UNIDADE — LÍDER (titular) E ASPIRA (13/11/2026, decisão do dono)
-- Rode depois do passo 0. O que muda:
--   1) campo "posto" no login de nível Líder: TITULAR (o Líder de hoje) ou ASPIRA. Os líderes de hoje viram TITULAR.
--      Os dois continuam no nível LIDER: as MESMAS permissões, e nenhuma regra de vendas/metas/CRM muda.
--   2) a trava "um líder por unidade" vira "um TITULAR + um ASPIRA por unidade". Trocar um não mexe no outro.
--   3) Líder e Recepção sempre com uma unidade de verdade (nunca vazio nem "TODAS") — vale para os novos.
--   4) pedido de acesso, aprovação, "Definir líder" e o painel passam a saber o posto.
--   5) a gestão de acessos do Mentor (aprovar, painel, inativar) usa SÓ as unidades fixas dele (mentor_unidades).
--      Hoje é a mesma coisa; serve para o acesso temporário (passo 2) nunca dar poder de aprovar acessos.
-- Não mexe em vendas, comissões, metas nem contatos. Desfazer: 9_desfazer.sql.
-- =====================================================================

-- ---------- 1) Posto ----------
alter table public.usuarios_sistema add column if not exists posto text;
do $$ begin
  alter table public.usuarios_sistema add constraint usuarios_sistema_posto_valido check (posto is null or posto in ('TITULAR', 'ASPIRA'));
exception when duplicate_object then null; end $$;
update public.usuarios_sistema set posto = 'TITULAR' where upper(role) = 'LIDER' and posto is null;

-- Líder sem posto vira TITULAR; quem deixa de ser Líder perde o posto (feito pelo banco, vale para qualquer tela)
create or replace function public.usuarios_sistema_posto_padrao()
returns trigger language plpgsql as $$
begin
  if upper(coalesce(new.role, '')) = 'LIDER' then
    new.posto := coalesce(nullif(upper(trim(new.posto)), ''), 'TITULAR');
  else
    new.posto := null;
  end if;
  return new;
end;
$$;
drop trigger if exists usuarios_sistema_posto_gatilho on public.usuarios_sistema;
create trigger usuarios_sistema_posto_gatilho
  before insert or update of role, posto on public.usuarios_sistema
  for each row execute function public.usuarios_sistema_posto_padrao();

alter table public.lideres_historico add column if not exists posto text not null default 'TITULAR';
alter table public.acesso_solicitacoes add column if not exists posto text not null default 'TITULAR';
do $$ begin
  alter table public.lideres_historico add constraint lideres_historico_posto_valido check (posto in ('TITULAR', 'ASPIRA'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.acesso_solicitacoes add constraint acesso_solicitacoes_posto_valido check (posto in ('TITULAR', 'ASPIRA'));
exception when duplicate_object then null; end $$;

-- ---------- 2) Trava: 1 TITULAR + 1 ASPIRA por unidade ----------
drop index if exists public.usuarios_um_lider_ativo_por_unidade;
create unique index if not exists usuarios_um_lider_por_posto
  on public.usuarios_sistema (upper(trim(unidade)), coalesce(posto, 'TITULAR'))
  where upper(role) = 'LIDER' and status = 'ATIVO';

-- ---------- 3) Líder/Recepção sempre com unidade (NOT VALID = não recusa os antigos, só os novos e as edições) ----------
do $$ begin
  alter table public.usuarios_sistema add constraint usuarios_sistema_unidade_obrigatoria
    check (upper(coalesce(role, '')) not in ('LIDER', 'RECEPCAO')
           or (trim(coalesce(unidade, '')) <> '' and upper(trim(unidade)) <> 'TODAS')) not valid;
exception when duplicate_object then null; end $$;

-- ---------- 4) Unidades FIXAS do Mentor (para aprovar/inativar acessos) ----------
create or replace function public.acesso_mentor_fixo_unidades()
returns text[] language sql stable security definer set search_path = public as $$
  select case
    when public.seg_papel() is not null
     and upper(coalesce((select role from public.usuarios_sistema
                          where lower(trim(email)) = public.acesso_email() and coalesce(status, 'ATIVO') = 'ATIVO' limit 1), '')) = 'MENTOR'
    then coalesce((select array_agg(distinct public.seg_normalizar(m.unidade)) from public.mentor_unidades m
                   where lower(trim(m.mentor_email)) = public.acesso_email()), '{}'::text[])
    else '{}'::text[] end
$$;

create or replace function public.acesso_pode_aprovar(p_papel text, p_unidades text[])
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[];
begin
  if v_papel = 'ADMIN' then return true; end if;
  if v_papel <> 'MENTOR' or upper(p_papel) <> 'LIDER' then return false; end if;
  v_minhas := public.acesso_mentor_fixo_unidades();
  return coalesce(array_length(p_unidades, 1), 0) > 0
     and not exists (select 1 from unnest(p_unidades) u where not (public.seg_normalizar(u) = any (coalesce(v_minhas, '{}'::text[]))));
end;
$$;

-- ---------- Líder da unidade (com o posto) ----------
drop function if exists public.acesso_lider_atual(text);
create function public.acesso_lider_atual(p_unidade text)
returns table (email text, nome text, telefone text, ultimo_login timestamptz, role text, posto text)
language sql stable security definer set search_path = public as $$
  select u.email::text, u.nome::text, u.telefone::text, u.ultimo_login, u.role::text, h.posto::text
  from public.lideres_historico h
  join public.usuarios_sistema u on lower(trim(u.email)) = lower(trim(h.email))
  where upper(trim(h.unidade)) = upper(trim(p_unidade)) and h.fim is null and u.status = 'ATIVO'
    and not (upper(u.role) = 'LIDER' and upper(trim(u.unidade)) = upper(trim(p_unidade)))
  union
  select u.email::text, u.nome::text, u.telefone::text, u.ultimo_login, u.role::text, coalesce(u.posto, 'TITULAR')::text
  from public.usuarios_sistema u
  where upper(u.role) = 'LIDER' and u.status = 'ATIVO' and upper(trim(u.unidade)) = upper(trim(p_unidade))
$$;

-- Admin marca o Líder ou o Aspira de uma unidade (qualquer login ativo, inclusive ele mesmo). É uma troca SÓ do
-- posto escolhido: quem ocupava aquele posto sai (login de nível Líder fica INATIVO, nada é apagado); o outro posto
-- não é tocado.
drop function if exists public.acesso_definir_lider(text, text);
create or replace function public.acesso_definir_lider(p_unidade text, p_email text, p_posto text default 'TITULAR')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_u      public.usuarios_sistema;
  v_unid   text := upper(trim(coalesce(p_unidade, '')));
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_posto  text := upper(trim(coalesce(nullif(p_posto, ''), 'TITULAR')));
  v_nome_q text := public.acesso_nome_de(public.acesso_email());
  v_rotulo text;
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin define o líder da unidade.'; end if;
  if v_posto not in ('TITULAR', 'ASPIRA') then raise exception 'Posto inválido (Líder ou Aspira).'; end if;
  v_rotulo := case when v_posto = 'ASPIRA' then 'Aspira' else 'Líder' end;
  if not exists (select 1 from public.unidades x where upper(trim(x.nome)) = v_unid) then raise exception 'Unidade não encontrada.'; end if;
  select * into v_u from public.usuarios_sistema where lower(trim(email)) = v_email and status = 'ATIVO';
  if not found then raise exception 'Login não encontrado ou inativo.'; end if;
  if upper(v_u.role) = 'RECEPCAO' then raise exception 'O login da Recepção não pode ser líder.'; end if;
  if upper(v_u.role) = 'LIDER' and upper(trim(v_u.unidade)) <> v_unid then raise exception 'Este login é Líder de outra unidade (%).', v_u.unidade; end if;

  -- Quem ocupava ESTE posto sai (o outro posto fica como está)
  update public.usuarios_sistema
     set status = 'INATIVO', inativado_em = now(), inativado_motivo = v_rotulo || ': trocado por ' || v_u.nome || ' (definido por ' || v_nome_q || ')'
   where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid
     and coalesce(posto, 'TITULAR') = v_posto and lower(trim(email)) <> v_email;
  update public.lideres_historico set fim = now(), motivo_fim = v_rotulo || ': trocado por ' || v_u.nome
   where upper(trim(unidade)) = v_unid and fim is null and posto = v_posto and lower(email) <> v_email;
  -- Se a pessoa estava no OUTRO posto desta unidade, ela muda de posto (fecha o histórico antigo)
  update public.lideres_historico set fim = now(), motivo_fim = 'Passou para ' || v_rotulo
   where upper(trim(unidade)) = v_unid and fim is null and posto <> v_posto and lower(email) = v_email;
  if upper(v_u.role) = 'LIDER' then
    update public.usuarios_sistema set posto = v_posto where lower(trim(email)) = v_email;
  end if;
  if not exists (select 1 from public.lideres_historico where upper(trim(unidade)) = v_unid and fim is null and lower(email) = v_email and posto = v_posto) then
    insert into public.lideres_historico (unidade, email, nome, inicio, origem, posto) values (v_unid, v_email, v_u.nome, now(), 'definido pelo Admin', v_posto);
  end if;
  perform public.acesso_log(v_email, 'TROCA_LIDER', v_unid || ': ' || v_rotulo || ' definido por ' || v_nome_q);
  return 'ok';
end;
$$;

-- Admin tira alguém do posto SEM colocar outro (ex.: a unidade fica sem Aspira). Login de nível Líder fica INATIVO.
create or replace function public.acesso_tirar_lider(p_unidade text, p_email text, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare v_unid text := upper(trim(coalesce(p_unidade, ''))); v_email text := lower(trim(coalesce(p_email, ''))); v_u public.usuarios_sistema;
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin tira o líder da unidade.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  select * into v_u from public.usuarios_sistema where lower(trim(email)) = v_email;
  if not found then raise exception 'Login não encontrado.'; end if;
  if v_email = public.acesso_email() and upper(v_u.role) = 'LIDER' then raise exception 'Você não pode inativar o seu próprio login.'; end if;
  update public.lideres_historico set fim = now(), motivo_fim = trim(p_motivo) where upper(trim(unidade)) = v_unid and fim is null and lower(email) = v_email;
  if upper(v_u.role) = 'LIDER' and upper(trim(v_u.unidade)) = v_unid and v_u.status = 'ATIVO' then
    update public.usuarios_sistema set status = 'INATIVO', inativado_em = now(), inativado_motivo = trim(p_motivo) where lower(trim(email)) = v_email;
  end if;
  perform public.acesso_log(v_email, 'TROCA_LIDER', v_unid || ': saiu da liderança · ' || trim(p_motivo));
  return 'ok';
end;
$$;

-- Pedido de acesso: Líder escolhe o posto (Líder ou Aspira). TROCA quando ESTE posto já está ocupado.
drop function if exists public.acesso_solicitar(text, text, text, text[]);
create or replace function public.acesso_solicitar(p_nome text, p_telefone text, p_papel text, p_unidades text[], p_posto text default 'TITULAR')
returns public.acesso_solicitacoes language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.acesso_email();
  v_tel   text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_papel text := upper(trim(coalesce(p_papel, '')));
  v_posto text := upper(trim(coalesce(nullif(p_posto, ''), 'TITULAR')));
  v_unid  text[];
  v_tipo  text := 'NOVO';
  v_rep   text;
  v_reg   public.acesso_solicitacoes;
begin
  if v_email is null then raise exception 'Entre com o Google antes de pedir acesso.'; end if;
  if exists (select 1 from public.usuarios_sistema where lower(trim(email)) = v_email and status = 'ATIVO') then
    raise exception 'Este e-mail já tem acesso ao sistema.';
  end if;
  if length(trim(coalesce(p_nome, ''))) < 5 or position(' ' in trim(p_nome)) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_tel) < 12 or length(v_tel) > 15 then raise exception 'Telefone inválido: use o código do país e o DDD (ex.: +55 31 99999-9999).'; end if;
  if v_papel not in ('LIDER', 'MENTOR') then raise exception 'Escolha Líder, Aspira ou Mentor.'; end if;
  if v_posto not in ('TITULAR', 'ASPIRA') then raise exception 'Posto inválido.'; end if;
  if v_papel <> 'LIDER' then v_posto := 'TITULAR'; end if;
  select array_agg(distinct upper(trim(u))) into v_unid from unnest(p_unidades) u where trim(coalesce(u, '')) <> '';
  if coalesce(array_length(v_unid, 1), 0) = 0 then raise exception 'Escolha a unidade.'; end if;
  if v_papel = 'LIDER' and array_length(v_unid, 1) <> 1 then raise exception 'O Líder (ou Aspira) escolhe exatamente UMA unidade.'; end if;
  if exists (select 1 from unnest(v_unid) u where not exists (select 1 from public.unidades x where upper(trim(x.nome)) = u and coalesce(x.ativa, true))) then
    raise exception 'Unidade não encontrada.';
  end if;
  if (select count(*) from public.acesso_solicitacoes where lower(email) = v_email and criado_em > now() - interval '24 hours') >= 5 then
    raise exception 'Muitos pedidos em 24 horas. Aguarde a aprovação ou fale com a diretoria.';
  end if;
  if v_papel = 'LIDER' and exists (select 1 from public.acesso_lider_atual(v_unid[1]) l where l.posto = v_posto and lower(trim(l.email)) <> v_email) then
    v_tipo := 'TROCA_LIDER';
  end if;
  select string_agg(nome || ' <' || email || '>', ', ') into v_rep from public.usuarios_sistema
   where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel and lower(trim(email)) <> v_email;
  update public.acesso_solicitacoes set status = 'CANCELADO', decidido_em = now(), decidido_por = 'substituído por novo pedido'
   where lower(email) = v_email and status = 'AGUARDANDO_APROVACAO';
  insert into public.acesso_solicitacoes (email, nome, telefone, papel, unidades, tipo, telefone_repetido_de, posto)
  values (v_email, upper(trim(p_nome)), v_tel, v_papel, v_unid, v_tipo, v_rep, v_posto)
  returning * into v_reg;
  perform public.acesso_log(v_email, 'SOLICITACAO', v_papel || case when v_posto = 'ASPIRA' then ' (ASPIRA)' else '' end
    || ' · ' || array_to_string(v_unid, ', ') || case when v_tipo = 'TROCA_LIDER' then ' · TROCA' else '' end);
  return v_reg;
end;
$$;

-- Aprovar (pode corrigir papel, unidade e posto). Só quem está NO MESMO POSTO sai (fica INATIVO, nada é apagado).
drop function if exists public.acesso_aprovar(bigint, text, text[]);
create or replace function public.acesso_aprovar(p_id bigint, p_papel text default null, p_unidades text[] default null, p_posto text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s        public.acesso_solicitacoes;
  v_papel  text;
  v_unid   text[];
  v_posto  text;
  v_rotulo text;
  v_quem   text := public.acesso_email();
  v_nome_q text;
  v_trocados text;
begin
  select * into s from public.acesso_solicitacoes where id = p_id for update;
  if not found or s.status <> 'AGUARDANDO_APROVACAO' then raise exception 'Pedido não encontrado ou já decidido.'; end if;
  v_papel := upper(coalesce(nullif(trim(p_papel), ''), s.papel));
  v_posto := upper(coalesce(nullif(trim(p_posto), ''), s.posto, 'TITULAR'));
  select array_agg(distinct upper(trim(u))) into v_unid from unnest(coalesce(p_unidades, s.unidades)) u where trim(coalesce(u, '')) <> '';
  if v_papel not in ('LIDER', 'MENTOR') then raise exception 'Papel inválido.'; end if;
  if v_posto not in ('TITULAR', 'ASPIRA') then raise exception 'Posto inválido.'; end if;
  if v_papel = 'LIDER' and coalesce(array_length(v_unid, 1), 0) <> 1 then raise exception 'O Líder (ou Aspira) tem exatamente UMA unidade.'; end if;
  if not public.acesso_pode_aprovar(v_papel, v_unid) then
    raise exception 'Você não pode aprovar este pedido (Mentor aprova só Líder/Aspira das unidades dele; Mentor novo só o Admin).';
  end if;
  v_nome_q := public.acesso_nome_de(v_quem);
  v_rotulo := case when v_posto = 'ASPIRA' then 'Aspira' else 'Líder' end;

  if v_papel = 'LIDER' then
    select string_agg(nome, ', ') into v_trocados from public.usuarios_sistema
     where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid[1]
       and coalesce(posto, 'TITULAR') = v_posto and lower(trim(email)) <> lower(s.email);
    update public.usuarios_sistema
       set status = 'INATIVO', inativado_em = now(), inativado_motivo = v_rotulo || ': trocado por ' || s.nome || ' (aprovado por ' || v_nome_q || ')'
     where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid[1]
       and coalesce(posto, 'TITULAR') = v_posto and lower(trim(email)) <> lower(s.email);
    update public.lideres_historico set fim = now(), motivo_fim = v_rotulo || ': trocado por ' || s.nome
     where upper(trim(unidade)) = v_unid[1] and fim is null and posto = v_posto and lower(email) <> lower(s.email);
    if v_trocados is not null then perform public.acesso_log(s.email, 'TROCA_LIDER', v_unid[1] || ' (' || v_rotulo || '): ' || v_trocados || ' → ' || s.nome); end if;
  end if;

  update public.usuarios_sistema
     set nome = s.nome, role = v_papel, unidade = case when v_papel = 'LIDER' then v_unid[1] else 'TODAS' end,
         posto = case when v_papel = 'LIDER' then v_posto end,
         telefone = s.telefone, status = 'ATIVO', aprovado_por = v_nome_q, aprovado_em = now(),
         inativado_em = null, inativado_motivo = null, dados_confirmados_em = null
   where lower(trim(email)) = lower(s.email);
  if not found then
    insert into public.usuarios_sistema (email, nome, role, unidade, posto, telefone, status, aprovado_por, aprovado_em)
    values (lower(s.email), s.nome, v_papel, case when v_papel = 'LIDER' then v_unid[1] else 'TODAS' end,
            case when v_papel = 'LIDER' then v_posto end, s.telefone, 'ATIVO', v_nome_q, now());
  end if;

  if v_papel = 'LIDER' then
    insert into public.lideres_historico (unidade, email, nome, inicio, origem, posto) values (v_unid[1], lower(s.email), s.nome, now(), 'login novo', v_posto);
  else
    insert into public.mentor_unidades (mentor_email, unidade)
    select lower(s.email), u from unnest(v_unid) u
    where not exists (select 1 from public.mentor_unidades m where lower(trim(m.mentor_email)) = lower(s.email) and upper(trim(m.unidade)) = u);
  end if;

  update public.acesso_solicitacoes
     set status = 'APROVADO', decidido_por = v_nome_q, decidido_em = now(),
         alteracoes = case when v_papel <> s.papel or v_unid <> s.unidades or v_posto <> s.posto
                           then jsonb_build_object('papel_pedido', s.papel, 'papel_aprovado', v_papel, 'unidades_pedidas', s.unidades,
                                                   'unidades_aprovadas', v_unid, 'posto_pedido', s.posto, 'posto_aprovado', v_posto) end
   where id = p_id;
  perform public.acesso_log(s.email, 'APROVACAO', v_papel || case when v_papel = 'LIDER' and v_posto = 'ASPIRA' then ' (ASPIRA)' else '' end
    || ' · ' || array_to_string(v_unid, ', ') || ' · por ' || v_nome_q);
  return jsonb_build_object('ok', true, 'trocados', v_trocados);
end;
$$;

-- Inativar / reativar (Admin qualquer; Mentor só Líder/Aspira e Recepção das unidades FIXAS dele). Nada é apagado.
create or replace function public.acesso_mudar_situacao(p_email text, p_status text, p_motivo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare u public.usuarios_sistema; v_papel text := public.seg_papel(); v_status text := upper(trim(coalesce(p_status, ''))); v_ocupado text;
begin
  select * into u from public.usuarios_sistema where lower(trim(email)) = lower(trim(p_email));
  if not found then raise exception 'Login não encontrado.'; end if;
  if v_status not in ('ATIVO', 'INATIVO') then raise exception 'Situação inválida.'; end if;
  if not (v_papel = 'ADMIN' or (v_papel = 'MENTOR' and upper(u.role) in ('LIDER', 'RECEPCAO')
          and public.seg_normalizar(u.unidade) = any (public.acesso_mentor_fixo_unidades()))) then
    raise exception 'Você não pode mudar este login.';
  end if;
  if lower(trim(p_email)) = public.acesso_email() then raise exception 'Você não pode mudar o seu próprio login.'; end if;
  if v_status = 'INATIVO' and length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  if v_status = 'ATIVO' and upper(u.role) = 'LIDER' then
    select nome into v_ocupado from public.usuarios_sistema
     where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = upper(trim(u.unidade))
       and coalesce(posto, 'TITULAR') = coalesce(u.posto, 'TITULAR') and lower(trim(email)) <> lower(trim(p_email)) limit 1;
    if v_ocupado is not null then
      raise exception '% já tem % ativo: %. Inative ou troque antes de reativar.', u.unidade,
        case when coalesce(u.posto, 'TITULAR') = 'ASPIRA' then 'Aspira' else 'Líder' end, v_ocupado;
    end if;
  end if;
  update public.usuarios_sistema
     set status = v_status,
         inativado_em = case when v_status = 'INATIVO' then now() end,
         inativado_motivo = case when v_status = 'INATIVO' then trim(p_motivo) end
   where lower(trim(email)) = lower(trim(p_email));
  if upper(u.role) = 'LIDER' then
    if v_status = 'INATIVO' then
      update public.lideres_historico set fim = now(), motivo_fim = trim(p_motivo) where lower(email) = lower(trim(p_email)) and fim is null;
    else
      insert into public.lideres_historico (unidade, email, nome, inicio, origem, posto)
      values (upper(trim(u.unidade)), lower(trim(p_email)), u.nome, now(), 'reativado', coalesce(u.posto, 'TITULAR'));
    end if;
  end if;
  perform public.acesso_log(p_email, 'SITUACAO', v_status || coalesce(' · ' || trim(p_motivo), ''));
  return 'ok';
end;
$$;

-- Confirmar os próprios dados: o telefone do Líder/Aspira vai também para a Equipe (setor com LIDER ou ASPIRA)
create or replace function public.acesso_confirmar_dados(p_nome text, p_telefone text, p_telefone_equipe text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := public.acesso_email(); u public.usuarios_sistema; v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g'); v_eq integer := 0;
begin
  select * into u from public.usuarios_sistema where lower(trim(email)) = v_email and status = 'ATIVO';
  if not found then raise exception 'Login não encontrado.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 5 or position(' ' in trim(p_nome)) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_tel) < 12 or length(v_tel) > 15 then raise exception 'Telefone inválido: use o código do país e o DDD.'; end if;
  update public.usuarios_sistema set nome = upper(trim(p_nome)), telefone = v_tel, dados_confirmados_em = now() where lower(trim(email)) = v_email;
  if upper(u.role) = 'LIDER' and coalesce(trim(p_telefone_equipe), '') <> '' then
    update public.colaboradores c set telefone = p_telefone_equipe
     where upper(trim(c.unidade)) = upper(trim(u.unidade)) and c.ativo is distinct from false
       and (upper(coalesce(c.role, '')) like '%LIDER%' or upper(coalesce(c.role, '')) like '%ASPIRA%')
       and public.equipe_nome_chave(c.nome) = public.equipe_nome_chave(p_nome);
    get diagnostics v_eq = row_count;
  end if;
  perform public.acesso_log(v_email, 'DADOS_CONFIRMADOS', 'telefone ' || v_tel || case when v_eq > 0 then ' · Equipe atualizada' else '' end);
  return jsonb_build_object('equipe_atualizada', v_eq);
end;
$$;

-- Painel: + posto (logins, líderes e pedidos). Mentor: só as unidades FIXAS dele.
create or replace function public.acesso_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[]; v_admin boolean;
begin
  if v_papel not in ('ADMIN', 'MENTOR') then
    return jsonb_build_object('logins', '[]'::jsonb, 'pedidos', '[]'::jsonb, 'alertas', '[]'::jsonb, 'historico', '[]'::jsonb, 'lideres', '[]'::jsonb, 'recentes', '[]'::jsonb);
  end if;
  v_admin := v_papel = 'ADMIN';
  v_minhas := case when v_admin then null else public.acesso_mentor_fixo_unidades() end;
  return jsonb_build_object(
    'logins', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select email, nome, role, unidade, posto, telefone, status, ultimo_login, ultimo_metodo, dados_confirmados_em, aprovado_por, aprovado_em, emergencia_ate, inativado_em, inativado_motivo
        from public.usuarios_sistema
        where v_admin or (upper(role) in ('LIDER', 'RECEPCAO') and public.seg_normalizar(unidade) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em) from (
        select s.*, (select jsonb_agg(jsonb_build_object('nome', l.nome, 'email', l.email, 'telefone', l.telefone, 'ultimo_login', l.ultimo_login, 'role', l.role, 'posto', l.posto))
                      from public.acesso_lider_atual(s.unidades[1]) l where s.tipo = 'TROCA_LIDER' and l.posto = s.posto) as lider_atual
        from public.acesso_solicitacoes s
        where s.status = 'AGUARDANDO_APROVACAO' and public.acesso_pode_aprovar(s.papel, s.unidades)) x), '[]'::jsonb),
    'alertas', coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc) from (
        select a.*, u.nome, u.role, u.unidade, l.quando as acesso_quando, l.metodo as acesso_metodo, l.dispositivo as acesso_dispositivo
        from public.acesso_alertas a
        left join public.usuarios_sistema u on lower(trim(u.email)) = lower(a.email)
        left join public.acessos_log l on l.id = a.log_id
        where a.resolvido_em is null and (v_admin or public.seg_normalizar(u.unidade) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(to_jsonb(h) order by h.unidade, h.inicio desc nulls last) from public.lideres_historico h
        where v_admin or public.seg_normalizar(h.unidade) = any (coalesce(v_minhas, '{}'::text[]))), '[]'::jsonb),
    'lideres', coalesce((select jsonb_agg(to_jsonb(x) order by x.unidade, x.posto desc) from (
        select upper(trim(un.nome)) as unidade, l.email, l.nome, l.telefone, l.ultimo_login, l.role, l.posto
        from public.unidades un
        cross join lateral public.acesso_lider_atual(un.nome) l
        where coalesce(un.ativa, true) and (v_admin or public.seg_normalizar(un.nome) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'recentes', coalesce((select jsonb_agg(to_jsonb(x) order by x.quando desc) from (
        select l.id, l.quando, l.evento, l.metodo, l.dispositivo, l.email, u.nome, u.role, u.unidade
        from public.acessos_log l
        left join public.usuarios_sistema u on lower(trim(u.email)) = lower(l.email)
        where l.evento in ('LOGIN', 'LOGOUT', 'EXPIROU', 'NEGADO') and l.quando > now() - interval '48 hours'
          and (v_admin or (upper(u.role) in ('LIDER', 'RECEPCAO') and public.seg_normalizar(u.unidade) = any (coalesce(v_minhas, '{}'::text[]))))
        order by l.quando desc limit 300) x), '[]'::jsonb)
  );
end;
$$;

do $$ declare f text; begin
  foreach f in array array['acesso_mentor_fixo_unidades()', 'acesso_pode_aprovar(text,text[])', 'acesso_lider_atual(text)',
    'acesso_definir_lider(text,text,text)', 'acesso_tirar_lider(text,text,text)', 'acesso_solicitar(text,text,text,text[],text)',
    'acesso_aprovar(bigint,text,text[],text)', 'acesso_mudar_situacao(text,text,text)', 'acesso_confirmar_dados(text,text,text)', 'acesso_painel()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO): Líder e Aspira de cada unidade como o sistema enxerga agora
select un.nome as unidade,
       coalesce(string_agg(l.nome || ' (' || l.role || ')', ' | ') filter (where l.posto = 'TITULAR'), '— sem Líder —') as lider,
       coalesce(string_agg(l.nome || ' (' || l.role || ')', ' | ') filter (where l.posto = 'ASPIRA'), '—') as aspira
from public.unidades un
left join lateral public.acesso_lider_atual(un.nome) l on true
where coalesce(un.ativa, true)
group by un.nome order by un.nome;
