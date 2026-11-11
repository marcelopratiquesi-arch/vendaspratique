-- =====================================================================
-- PASSO 5: LÍDER POR UNIDADE (aceita Admin/Mentor como líder) + ENTRADAS RECENTES (12/11/2026, decisão do dono)
-- 1) acesso_lider_atual(unidade): o líder de uma unidade = login de nível Líder ativo OU quem foi marcado como líder
--    (histórico aberto) — ex.: o Admin que é o líder da SANTA INES 2, sem mudar o nível dele.
-- 2) acesso_definir_lider(unidade, email): SÓ o Admin marca qualquer login ativo como líder da unidade. É uma troca:
--    o líder anterior sai do histórico; se ele era login de nível Líder, fica INATIVO (nada é apagado).
-- 3) pedido de Líder para unidade que já tem líder (inclusive Admin/Mentor marcado) = TROCA DE LÍDER.
-- 4) acesso_painel ganha 'lideres' (líder de cada unidade) e 'recentes' (entradas das últimas 48 h).
-- Não mexe em vendas nem em nada fora do login. Desfazer: rodar de novo o passo 1 (volta as funções de antes) e
-- apagar acesso_lider_atual / acesso_definir_lider (9_desfazer.sql).
-- =====================================================================

create or replace function public.acesso_lider_atual(p_unidade text)
returns table (email text, nome text, telefone text, ultimo_login timestamptz, role text)
language sql stable security definer set search_path = public as $$
  select u.email::text, u.nome::text, u.telefone::text, u.ultimo_login, u.role::text
  from public.lideres_historico h
  join public.usuarios_sistema u on lower(trim(u.email)) = lower(trim(h.email))
  where upper(trim(h.unidade)) = upper(trim(p_unidade)) and h.fim is null and u.status = 'ATIVO'
  union
  select u.email::text, u.nome::text, u.telefone::text, u.ultimo_login, u.role::text
  from public.usuarios_sistema u
  where upper(u.role) = 'LIDER' and u.status = 'ATIVO' and upper(trim(u.unidade)) = upper(trim(p_unidade))
$$;

-- Admin marca o líder de uma unidade (inclusive ele mesmo)
create or replace function public.acesso_definir_lider(p_unidade text, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_u public.usuarios_sistema; v_unid text := upper(trim(coalesce(p_unidade, ''))); v_nome_q text := public.acesso_nome_de(public.acesso_email());
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin define o líder da unidade.'; end if;
  if not exists (select 1 from public.unidades x where upper(trim(x.nome)) = v_unid) then raise exception 'Unidade não encontrada.'; end if;
  select * into v_u from public.usuarios_sistema where lower(trim(email)) = lower(trim(p_email)) and status = 'ATIVO';
  if not found then raise exception 'Login não encontrado ou inativo.'; end if;
  if upper(v_u.role) = 'RECEPCAO' then raise exception 'O login da Recepção não pode ser líder.'; end if;
  if upper(v_u.role) = 'LIDER' and upper(trim(v_u.unidade)) <> v_unid then raise exception 'Este login é Líder de outra unidade (%).', v_u.unidade; end if;
  -- Quem era líder sai (login de nível Líder fica INATIVO; Admin/Mentor só sai da liderança)
  update public.usuarios_sistema
     set status = 'INATIVO', inativado_em = now(), inativado_motivo = 'Trocado por ' || v_u.nome || ' (definido por ' || v_nome_q || ')'
   where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid and lower(trim(email)) <> lower(trim(p_email));
  update public.lideres_historico set fim = now(), motivo_fim = 'Trocado por ' || v_u.nome
   where upper(trim(unidade)) = v_unid and fim is null and lower(email) <> lower(trim(p_email));
  if not exists (select 1 from public.lideres_historico where upper(trim(unidade)) = v_unid and fim is null and lower(email) = lower(trim(p_email))) then
    insert into public.lideres_historico (unidade, email, nome, inicio, origem) values (v_unid, lower(trim(p_email)), v_u.nome, now(), 'definido pelo Admin');
  end if;
  perform public.acesso_log(p_email, 'TROCA_LIDER', v_unid || ': líder definido por ' || v_nome_q);
  return 'ok';
end;
$$;

-- Pedido de acesso: TROCA quando a unidade já tem líder (login Líder OU marcado no histórico)
create or replace function public.acesso_solicitar(p_nome text, p_telefone text, p_papel text, p_unidades text[])
returns public.acesso_solicitacoes language plpgsql security definer set search_path = public as $$
declare
  v_email text := public.acesso_email();
  v_tel   text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_papel text := upper(trim(coalesce(p_papel, '')));
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
  if v_papel not in ('LIDER', 'MENTOR') then raise exception 'Escolha Líder ou Mentor.'; end if;
  select array_agg(distinct upper(trim(u))) into v_unid from unnest(p_unidades) u where trim(coalesce(u, '')) <> '';
  if coalesce(array_length(v_unid, 1), 0) = 0 then raise exception 'Escolha a unidade.'; end if;
  if v_papel = 'LIDER' and array_length(v_unid, 1) <> 1 then raise exception 'O Líder escolhe exatamente UMA unidade.'; end if;
  if exists (select 1 from unnest(v_unid) u where not exists (select 1 from public.unidades x where upper(trim(x.nome)) = u and coalesce(x.ativa, true))) then
    raise exception 'Unidade não encontrada.';
  end if;
  if (select count(*) from public.acesso_solicitacoes where lower(email) = v_email and criado_em > now() - interval '24 hours') >= 5 then
    raise exception 'Muitos pedidos em 24 horas. Aguarde a aprovação ou fale com a diretoria.';
  end if;
  if v_papel = 'LIDER' and exists (select 1 from public.acesso_lider_atual(v_unid[1]) l where lower(trim(l.email)) <> v_email) then
    v_tipo := 'TROCA_LIDER';
  end if;
  select string_agg(nome || ' <' || email || '>', ', ') into v_rep from public.usuarios_sistema
   where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel and lower(trim(email)) <> v_email;
  update public.acesso_solicitacoes set status = 'CANCELADO', decidido_em = now(), decidido_por = 'substituído por novo pedido'
   where lower(email) = v_email and status = 'AGUARDANDO_APROVACAO';
  insert into public.acesso_solicitacoes (email, nome, telefone, papel, unidades, tipo, telefone_repetido_de)
  values (v_email, upper(trim(p_nome)), v_tel, v_papel, v_unid, v_tipo, v_rep)
  returning * into v_reg;
  perform public.acesso_log(v_email, 'SOLICITACAO', v_papel || ' · ' || array_to_string(v_unid, ', ') || case when v_tipo = 'TROCA_LIDER' then ' · TROCA DE LÍDER' else '' end);
  return v_reg;
end;
$$;

-- Painel: + líderes por unidade e entradas das últimas 48 h
create or replace function public.acesso_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[] := public.seg_minhas_unidades(); v_admin boolean;
begin
  if v_papel not in ('ADMIN', 'MENTOR') then
    return jsonb_build_object('logins', '[]'::jsonb, 'pedidos', '[]'::jsonb, 'alertas', '[]'::jsonb, 'historico', '[]'::jsonb, 'lideres', '[]'::jsonb, 'recentes', '[]'::jsonb);
  end if;
  v_admin := v_papel = 'ADMIN';
  return jsonb_build_object(
    'logins', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select email, nome, role, unidade, telefone, status, ultimo_login, ultimo_metodo, dados_confirmados_em, aprovado_por, aprovado_em, emergencia_ate, inativado_em, inativado_motivo
        from public.usuarios_sistema
        where v_admin or (upper(role) in ('LIDER', 'RECEPCAO') and public.seg_normalizar(unidade) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em) from (
        select s.*, (select jsonb_agg(jsonb_build_object('nome', l.nome, 'email', l.email, 'telefone', l.telefone, 'ultimo_login', l.ultimo_login, 'role', l.role))
                      from public.acesso_lider_atual(s.unidades[1]) l where s.tipo = 'TROCA_LIDER') as lider_atual
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
    'lideres', coalesce((select jsonb_agg(to_jsonb(x) order by x.unidade) from (
        select upper(trim(un.nome)) as unidade, l.email, l.nome, l.telefone, l.ultimo_login, l.role
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

revoke execute on function public.acesso_lider_atual(text) from public, anon;
grant execute on function public.acesso_lider_atual(text) to authenticated;
revoke execute on function public.acesso_definir_lider(text, text) from public, anon;
grant execute on function public.acesso_definir_lider(text, text) to authenticated;

-- Conferência (MANDE ESTE RESULTADO): líder de cada unidade como o sistema enxerga agora
select un.nome as unidade, coalesce(string_agg(l.nome || ' (' || l.role || ')', ' | '), '— SEM LÍDER —') as lider
from public.unidades un
left join lateral public.acesso_lider_atual(un.nome) l on true
where coalesce(un.ativa, true)
group by un.nome order by un.nome;
