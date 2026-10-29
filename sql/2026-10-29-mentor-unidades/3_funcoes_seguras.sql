-- =====================================================================
-- MENTOR ↔ UNIDADES — PASSO 3: FUNÇÕES SEGURAS (rode depois do passo 2)
-- Cada função abaixo é a mesma de hoje; só muda a conferência de "quem pode":
-- em vez de "Admin ou Mentor = tudo", passa a usar as unidades de quem está logado.
-- =====================================================================
begin;

-- Excluir venda: Admin em qualquer unidade; Líder e Mentor só nas unidades deles
create or replace function public.excluir_venda(p_venda_id integer, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_papel   text := public.seg_papel();
  v_unidade text;
begin
  if v_papel is null then raise exception 'Acesso negado: somente funcionários.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da exclusão (mínimo 5 letras).';
  end if;
  select unidade into v_unidade from public.vendas where id = p_venda_id;
  if not found then raise exception 'Venda % não encontrada.', p_venda_id; end if;
  if not (v_papel = 'ADMIN' or (v_papel in ('LIDER', 'MENTOR') and public.seg_mesma_unidade(v_unidade))) then
    raise exception 'Só o Admin, ou o Líder/Mentor da unidade %, pode excluir esta venda.', v_unidade;
  end if;
  perform set_config('app.motivo_exclusao', trim(p_motivo), true);
  delete from public.vendas where id = p_venda_id;
  return format('Venda %s enviada para a lixeira.', p_venda_id);
end;
$$;

-- Aniversariantes do dia (CRM)
create or replace function public.crm_aniversariantes_do_dia(p_unidade text)
returns table(aluno_id uuid, nome text, cpf text, telefone text, data_nascimento date)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.crm_eh_funcionario() then
    raise exception 'Acesso negado: somente funcionários.';
  end if;
  if not public.seg_ve_unidade(p_unidade) then
    raise exception 'Você só pode ver os aniversariantes das suas unidades.';
  end if;
  return query
    select a.id, a.nome::text, a.cpf::text, a.telefone::text, a.data_nascimento::date
    from public.alunos a
    join public.alunos_unidades au on au.aluno_id = a.id
    where upper(trim(au.unidade)) = upper(trim(p_unidade))
      and a.data_nascimento is not null
      and to_char(a.data_nascimento::date, 'MM-DD') = to_char((now() at time zone 'America/Sao_Paulo')::date, 'MM-DD');
end;
$function$;

-- Migração (CRM): alunos da unidade e o último plano comprado
create or replace function public.crm_migracao_alunos(p_unidade text)
returns table(aluno_id uuid, nome text, cpf text, telefone text, ultimo_plano text, data_compra date)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.crm_eh_funcionario() then
    raise exception 'Acesso negado: somente funcionários.';
  end if;
  if not public.seg_ve_unidade(p_unidade) then
    raise exception 'Você só pode ver os alunos das suas unidades.';
  end if;
  return query
  with alunos_da_unidade as (
    select a.id, a.nome, a.cpf, a.telefone, regexp_replace(coalesce(a.cpf, ''), '\D', '', 'g') as cpf_digitos
    from public.alunos a
    join public.alunos_unidades au on au.aluno_id = a.id
    where upper(trim(au.unidade)) = upper(trim(p_unidade))
  ),
  planos_validos as (
    select upper(trim(c.nome)) as nome
    from public.catalogo c
    where lower(c.tipo) = 'plano'
      and upper(c.nome) not like '%REAVALIA%'
      and upper(c.nome) not like 'FÉRIAS%'
      and upper(c.nome) not like 'FERIAS%'
  ),
  ultimas as (
    select distinct on (regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g'))
           regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g') as cpf_digitos,
           v.produto,
           case when v.data::text ~ '^\d{4}-\d{2}-\d{2}' then left(v.data::text, 10)::date end as dia
    from public.vendas v
    where upper(trim(v.produto)) in (select pv.nome from planos_validos pv)
      and regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g') in (select ad.cpf_digitos from alunos_da_unidade ad)
    order by regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g'),
             case when v.data::text ~ '^\d{4}-\d{2}-\d{2}' then left(v.data::text, 10)::date end desc nulls last,
             v.created_at desc
  )
  select ad.id, ad.nome::text, ad.cpf::text, ad.telefone::text, u.produto::text, u.dia
  from alunos_da_unidade ad
  join ultimas u on u.cpf_digitos = ad.cpf_digitos;
end;
$function$;

-- Fila da Migração (CRM): só nas unidades de quem puxa
create or replace function public.crm_puxar_migracao(p_unidade text, p_aluno_ids uuid[], p_operador text)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_destino  text := upper(trim(coalesce(p_unidade, '')));
  v_meu_nome text;
  v_dono     text;
begin
  if public.seg_papel() is null then
    raise exception 'Acesso negado: somente funcionários.';
  end if;
  if v_destino = '' or v_destino = 'TODAS' then
    raise exception 'Unidade de destino inválida.';
  end if;
  if not public.seg_ve_unidade(v_destino) then
    raise exception 'Você só pode puxar alunos das suas unidades.';
  end if;

  select trim(us.nome) into v_meu_nome
  from public.usuarios_sistema us
  where us.email = (auth.jwt() ->> 'email')
  limit 1;

  select c.nome into v_dono
  from public.colaboradores c
  where upper(trim(c.nome)) = upper(trim(coalesce(p_operador, '')))
    and upper(trim(c.unidade)) = v_destino
    and coalesce(c.ativo, true)
    and upper(coalesce(to_jsonb(c) ->> 'role', to_jsonb(c) ->> 'setor', to_jsonb(c) ->> 'cargo', '')) like '%RECEP%'
  limit 1;
  if v_dono is null then
    raise exception 'A fila só pode ser de uma recepcionista ativa da unidade %.', v_destino;
  end if;

  return query
  insert into public.crm_migracao as m (aluno_id, unidade, status, puxado_por, puxado_em, atualizado_em, atualizado_por)
  select x.id, v_destino, 'NA_FILA', v_dono, now(), now(), coalesce(v_meu_nome, v_dono)
  from unnest(p_aluno_ids) as x(id)
  on conflict (aluno_id) do update
     set status = 'NA_FILA', unidade = excluded.unidade,
         puxado_por = excluded.puxado_por, puxado_em = excluded.puxado_em,
         atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por
   where m.status = 'NA_FILA'
     and (m.puxado_por is null
          or m.puxado_em is null
          or m.puxado_em < now() - interval '7 days'
          or exists (select 1 from public.colaboradores c
                     where upper(trim(c.nome)) = upper(trim(m.puxado_por)) and c.ativo = false))
  returning m.aluno_id;
end;
$$;
revoke execute on function public.crm_puxar_migracao(text, uuid[], text) from public, anon;
grant execute on function public.crm_puxar_migracao(text, uuid[], text) to authenticated;

-- Apagar contato do CRM: Admin; Líder na dele; Mentor nas dele (mesma regra do Líder)
create or replace function public.crm_conferir_quem_apaga()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  v_role text;
  v_unidade text;
begin
  -- SQL Editor do Supabase e funções internas do banco podem apagar
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return old;
  end if;

  select upper(u.role), upper(trim(u.unidade)) into v_role, v_unidade
  from public.get_user_colaborador_info() u(role, unidade)
  limit 1;

  if v_role = 'ADMIN'
     or (v_role = 'LIDER' and v_unidade = upper(trim(old.unidade)))
     or (v_role = 'MENTOR' and public.seg_mentor_ve_unidade(old.unidade)) then
    return old;
  end if;

  raise exception 'Somente Líder, Mentor (nas unidades dele) ou Admin podem apagar contatos do CRM.';
end;
$function$;

-- Mover vínculo de alunos: só para as unidades de quem move
create or replace function public.mover_vinculo_alunos(p_unidade text, p_aluno_ids uuid[], p_matriculas text[] default null::text[])
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  v_destino text := upper(trim(p_unidade));
  v_aluno uuid;
  v_matricula text;
  v_total integer := 0;
  i integer;
begin
  if public.seg_papel() is null then
    raise exception 'Acesso negado: somente funcionários podem mover vínculos de alunos.';
  end if;
  if v_destino is null or v_destino = '' or v_destino = 'TODAS' then
    raise exception 'Unidade de destino inválida.';
  end if;
  if not public.seg_ve_unidade(v_destino) then
    raise exception 'Você só pode mover alunos para as suas unidades.';
  end if;

  for i in 1 .. coalesce(array_length(p_aluno_ids, 1), 0) loop
    v_aluno := p_aluno_ids[i];
    continue when v_aluno is null;
    v_matricula := nullif(trim(case when p_matriculas is null then null else p_matriculas[i] end), '');

    -- Sem matrícula nova: aproveita a que o aluno já tiver na unidade de destino
    if v_matricula is null then
      select au.matricula into v_matricula
      from public.alunos_unidades au
      where au.aluno_id = v_aluno and upper(trim(au.unidade)) = v_destino
      order by au.updated_at desc nulls last
      limit 1;
    end if;

    -- Um vínculo por aluno: apaga todos e deixa um só na unidade de destino
    delete from public.alunos_unidades where aluno_id = v_aluno;
    insert into public.alunos_unidades (aluno_id, unidade, matricula, status, updated_at)
    values (v_aluno, v_destino, v_matricula, 'ATIVO', now());

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$function$;

commit;

notify pgrst, 'reload schema';
