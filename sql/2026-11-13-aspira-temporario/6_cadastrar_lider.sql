-- =====================================================================
-- PASSO 6: CADASTRAR LÍDER OU ASPIRA PELO E-MAIL (13/11/2026, decisão do dono)
-- Em Acessos → Líderes por unidade, cada vaga (Líder / Aspira) tem "Cadastrar pessoa": nome, e-mail (Google) e
-- WhatsApp. A pessoa NÃO precisa pedir acesso: quando entrar com o Google nesse e-mail, já cai como Líder (ou
-- Aspira) da unidade. Quem ocupava a MESMA vaga fica INATIVO (perde o acesso; nada da unidade é apagado);
-- a outra vaga não muda. Nem toda unidade precisa ter Aspira.
-- Quem pode: Admin (qualquer unidade) e Mentor (só nas unidades FIXAS dele, como na aprovação de pedidos).
-- Não mexe em vendas, comissões, metas nem contatos. Desfazer: drop function public.acesso_cadastrar_lider(text,text,text,text,text);
-- =====================================================================

create or replace function public.acesso_cadastrar_lider(p_unidade text, p_email text, p_nome text, p_telefone text, p_posto text default 'TITULAR')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_unid   text := upper(trim(coalesce(p_unidade, '')));
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_tel    text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_posto  text := upper(trim(coalesce(nullif(p_posto, ''), 'TITULAR')));
  v_rotulo text;
  v_nome_q text := public.acesso_nome_de(public.acesso_email());
  v_u      public.usuarios_sistema;
  v_trocados text;
  v_existe boolean;
begin
  if not public.acesso_pode_aprovar('LIDER', array[v_unid]) then
    raise exception 'Você não pode cadastrar líder nesta unidade (Admin: todas; Mentor: só as unidades dele).';
  end if;
  if v_posto not in ('TITULAR', 'ASPIRA') then raise exception 'Escolha Líder ou Aspira.'; end if;
  v_rotulo := case when v_posto = 'ASPIRA' then 'Aspira' else 'Líder' end;
  if not exists (select 1 from public.unidades x where upper(trim(x.nome)) = v_unid and coalesce(x.ativa, true)) then raise exception 'Unidade não encontrada.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if v_email = public.acesso_email() then raise exception 'Você não pode cadastrar o seu próprio e-mail aqui.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 5 or position(' ' in trim(p_nome)) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_tel) < 12 or length(v_tel) > 15 then raise exception 'WhatsApp inválido: use o código do país e o DDD (ex.: +55 31 99999-9999).'; end if;

  select * into v_u from public.usuarios_sistema where lower(trim(email)) = v_email;
  v_existe := found;
  if v_existe and v_u.status = 'ATIVO' then
    if upper(v_u.role) in ('ADMIN', 'MENTOR') then raise exception 'Este e-mail já é % (use "Escolher" na lista, só o Admin).', v_u.role; end if;
    if upper(v_u.role) = 'RECEPCAO' then raise exception 'Este é o e-mail da Recepção de uma unidade. Use o e-mail pessoal da pessoa.'; end if;
    if upper(v_u.role) = 'LIDER' and upper(trim(v_u.unidade)) <> v_unid then raise exception 'Este e-mail já é Líder de outra unidade (%). Para cobrir as duas, use o acesso temporário.', v_u.unidade; end if;
  end if;

  -- Quem ocupava ESTA vaga sai (fica INATIVO; a outra vaga não muda)
  select string_agg(nome, ', ') into v_trocados from public.usuarios_sistema
   where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid and coalesce(posto, 'TITULAR') = v_posto and lower(trim(email)) <> v_email;
  update public.usuarios_sistema
     set status = 'INATIVO', inativado_em = now(), inativado_motivo = v_rotulo || ': trocado por ' || upper(trim(p_nome)) || ' (cadastrado por ' || v_nome_q || ')'
   where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid and coalesce(posto, 'TITULAR') = v_posto and lower(trim(email)) <> v_email;
  update public.lideres_historico set fim = now(), motivo_fim = v_rotulo || ': trocado por ' || upper(trim(p_nome))
   where upper(trim(unidade)) = v_unid and fim is null and posto = v_posto and lower(email) <> v_email;
  -- Se a pessoa estava na outra vaga desta unidade, muda de vaga
  update public.lideres_historico set fim = now(), motivo_fim = 'Passou para ' || v_rotulo
   where upper(trim(unidade)) = v_unid and fim is null and posto <> v_posto and lower(email) = v_email;

  if v_existe then
    update public.usuarios_sistema
       set nome = upper(trim(p_nome)), role = 'LIDER', unidade = v_unid, posto = v_posto, telefone = v_tel, status = 'ATIVO',
           aprovado_por = v_nome_q, aprovado_em = now(), inativado_em = null, inativado_motivo = null
     where lower(trim(email)) = v_email;
  else
    insert into public.usuarios_sistema (email, nome, role, unidade, posto, telefone, status, aprovado_por, aprovado_em)
    values (v_email, upper(trim(p_nome)), 'LIDER', v_unid, v_posto, v_tel, 'ATIVO', v_nome_q, now());
  end if;
  insert into public.lideres_historico (unidade, email, nome, inicio, origem, posto) values (v_unid, v_email, upper(trim(p_nome)), now(), 'cadastrado em Acessos', v_posto);
  -- Pedido de acesso aberto do mesmo e-mail deixa de valer (já tem acesso)
  update public.acesso_solicitacoes set status = 'CANCELADO', decidido_em = now(), decidido_por = 'cadastrado direto por ' || v_nome_q
   where lower(email) = v_email and status = 'AGUARDANDO_APROVACAO';
  perform public.acesso_log(v_email, 'APROVACAO', 'LIDER' || case when v_posto = 'ASPIRA' then ' (ASPIRA)' else '' end || ' · ' || v_unid
    || ' · cadastrado por ' || v_nome_q || coalesce(' · saiu: ' || v_trocados, ''));
  return jsonb_build_object('ok', true, 'trocados', v_trocados);
end;
$$;
revoke execute on function public.acesso_cadastrar_lider(text, text, text, text, text) from public, anon;
grant execute on function public.acesso_cadastrar_lider(text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO): esperado 1
select count(*) as funcao_criada from pg_proc where proname = 'acesso_cadastrar_lider';
