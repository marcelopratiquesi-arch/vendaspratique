-- =====================================================================
-- PASSO 2 (ETAPAS 2 e 3): ACESSO TEMPORÁRIO DE LÍDER E DE MENTOR (13/11/2026, decisão do dono)
-- Rode depois do passo 1. O que faz:
--   1) tabela acessos_temporarios: e-mail, nome, WhatsApp, tipo (LIDER ou MENTOR), unidades, início, "vale até",
--      motivo, quem liberou, prorrogações, encerramento. Sem leitura direta: só pelas funções abaixo.
--   2) datas SEMPRE pela hora do servidor, no horário de Brasília. Hoje conta como dia 1:
--      liberado dia 13 por 10 dias → vale até o dia 22 (23:59); por 2 meses → até o dia 12 do 2º mês.
--   3) quem libera: Admin qualquer um; Mentor só Líder temporário nas unidades FIXAS dele; Mentor temporário só o Admin.
--      Prorrogar/encerrar: o Admin ou quem liberou.
--   4) o temporário SÓ SOMA: as funções que dizem "quem é você" (seg_papel) e "quais são as suas unidades"
--      (seg_minhas_unidades, seg_unidade, seg_mentor_ve_unidade, get_user_colaborador_info) passam a juntar o
--      acesso fixo com os temporários que estão valendo. O acesso fixo (usuarios_sistema) NÃO é alterado.
--      SEM NENHUM TEMPORÁRIO, CADA FUNÇÃO RESPONDE EXATAMENTE COMO ANTES.
--   5) o temporário só vale com login pelo Google (e-mail verificado). No fim do prazo o banco corta sozinho,
--      na próxima consulta, mesmo com a pessoa usando o sistema.
--   6) registro: TEMP_LIBERADO, TEMP_PRORROGADO e TEMP_ENCERRADO em acessos_log (com quem, quando e por quê).
--   7) Mentor com Líder temporário numa unidade fora da lista dele age como LÍDER lá (decisão do dono): as ações
--      que só o Mentor faz (restaurar venda da lixeira, aprovar/inativar acessos, liberar temporário) continuam só
--      nas unidades FIXAS dele.
-- Não mexe em vendas, comissões, metas nem contatos. Desfazer: 9_desfazer.sql.
-- =====================================================================

-- ---------- Ajudas ----------
create or replace function public.acesso_hoje()
returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.acesso_rank_papel(p_papel text)
returns integer language sql immutable as $$
  select case upper(coalesce(p_papel, '')) when 'ADMIN' then 4 when 'MENTOR' then 3 when 'LIDER' then 2 when 'RECEPCAO' then 1 else 0 end
$$;

create or replace function public.acesso_login_google()
returns boolean language sql stable as $$ select coalesce(auth.jwt() -> 'amr' -> 0 ->> 'method', '') = 'oauth' $$;

-- ---------- 1) Tabela ----------
create table if not exists public.acessos_temporarios (
  id                  bigserial primary key,
  email               text not null,
  nome                text not null,
  telefone            text not null,
  tipo                text not null check (tipo in ('LIDER', 'MENTOR')),
  unidades            text[] not null,
  inicio              date not null,
  vale_ate            date not null,
  prazo               text,
  motivo              text not null,
  liberado_por_email  text not null,
  liberado_por_nome   text,
  liberado_em         timestamptz not null default now(),
  prorrogacoes        jsonb not null default '[]'::jsonb,
  encerrado_em        timestamptz,
  encerrado_por       text,
  motivo_encerramento text,
  ultimo_login        timestamptz,
  constraint acessos_temporarios_datas check (vale_ate >= inicio),
  constraint acessos_temporarios_unidades check (cardinality(unidades) > 0)
);
create index if not exists acessos_temporarios_email_idx on public.acessos_temporarios (lower(email));
create index if not exists acessos_temporarios_vale_idx on public.acessos_temporarios (vale_ate);
alter table public.acessos_temporarios enable row level security;
-- (sem regras: ninguém lê nem grava direto, só pelas funções)

-- ---------- 2) Datas ----------
-- p_prazo: 10d, 15d, 30d, 40d, 2m, 3m, 6m ou data (p_data). p_base = primeiro dia (padrão: hoje em Brasília).
create or replace function public.acesso_calcular_vale_ate(p_prazo text, p_data date default null, p_base date default null)
returns date language plpgsql stable as $$
declare v_base date := coalesce(p_base, public.acesso_hoje()); v_fim date; v_max date;
begin
  v_fim := case lower(trim(coalesce(p_prazo, '')))
    when '10d' then v_base + 9
    when '15d' then v_base + 14
    when '30d' then v_base + 29
    when '40d' then v_base + 39
    when '2m'  then (v_base + interval '2 months')::date - 1
    when '3m'  then (v_base + interval '3 months')::date - 1
    when '6m'  then (v_base + interval '6 months')::date - 1
    when 'data' then p_data
    else null end;
  if v_fim is null then raise exception 'Escolha o prazo.'; end if;
  v_max := (v_base + interval '6 months')::date - 1;
  if v_fim < v_base then raise exception 'A data final não pode ser antes de %.', to_char(v_base, 'DD/MM/YYYY'); end if;
  if v_fim > v_max then raise exception 'O prazo máximo é de 6 meses (até %).', to_char(v_max, 'DD/MM/YYYY'); end if;
  return v_fim;
end;
$$;

-- ---------- 3) Temporários valendo (por e-mail; uso interno) ----------
create or replace function public.acesso_temp_ativos_de(p_email text)
returns setof public.acessos_temporarios language sql stable security definer set search_path = public as $$
  select * from public.acessos_temporarios
  where lower(email) = lower(trim(coalesce(p_email, ''))) and encerrado_em is null
    and public.acesso_hoje() between inicio and vale_ate
$$;
create or replace function public.acesso_temp_papel_de(p_email text)
returns text language sql stable security definer set search_path = public as $$
  select case when bool_or(t.tipo = 'MENTOR') then 'MENTOR' when count(*) > 0 then 'LIDER' end
  from public.acesso_temp_ativos_de(p_email) t
$$;
create or replace function public.acesso_temp_unidades_de(p_email text, p_tipo text default null)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct public.seg_normalizar(u)), '{}'::text[])
  from public.acesso_temp_ativos_de(p_email) t cross join lateral unnest(t.unidades) u
  where p_tipo is null or t.tipo = upper(p_tipo)
$$;
revoke execute on function public.acesso_temp_ativos_de(text) from public, anon, authenticated;
revoke execute on function public.acesso_temp_papel_de(text) from public, anon, authenticated;
revoke execute on function public.acesso_temp_unidades_de(text, text) from public, anon, authenticated;

-- Quem está logado (só com login Google). Usadas nas regras de acesso.
create or replace function public.acesso_unidades_temporarias()
returns text[] language sql stable security definer set search_path = public as $$
  select case when public.acesso_login_google() and public.acesso_email() is not null
              then public.acesso_temp_unidades_de(public.acesso_email()) else '{}'::text[] end
$$;
revoke execute on function public.acesso_unidades_temporarias() from public, anon;
grant execute on function public.acesso_unidades_temporarias() to authenticated;

-- ---------- 4) "Quem é você" e "quais são as suas unidades" ----------
create or replace function public.seg_papel()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_papel  text := public.seg_papel_base();
  v_email  text := lower(trim(auth.jwt() ->> 'email'));
  v_metodo text := auth.jwt() -> 'amr' -> 0 ->> 'method';
  v_status text;
  v_emerg  timestamptz;
  v_temp   text;
begin
  -- Acesso fixo: as mesmas conferências de antes
  if v_papel is not null then
    select status, emergencia_ate into v_status, v_emerg from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;
    if coalesce(v_status, 'ATIVO') <> 'ATIVO' then
      v_papel := null;                                     -- 1) login inativo
    elsif v_metodo = 'password' and upper(v_papel) <> 'ADMIN'
       and coalesce(public.config_sistema('login_senha_todos'), 'sim') = 'nao'
       and coalesce(v_emerg, '-infinity'::timestamptz) < now() then
      v_papel := null;                                     -- 2) senha depois da virada
    end if;
  end if;
  -- Acesso temporário: só soma (fica com o maior), só com login Google
  if v_metodo = 'oauth' and coalesce(v_email, '') <> '' then
    v_temp := public.acesso_temp_papel_de(v_email);
    if v_temp is not null and public.acesso_rank_papel(v_temp) > public.acesso_rank_papel(v_papel) then v_papel := v_temp; end if;
  end if;
  if v_papel is null then return null; end if;
  -- 3) sessão de 15 minutos (igual a antes)
  if coalesce(public.config_sistema('sessao_banco'), 'nao') = 'sim' and upper(v_papel) <> 'RECEPCAO' then
    if not exists (select 1 from public.acesso_sessoes s
                   where s.session_id = auth.jwt() ->> 'session_id' and s.ultima_atividade > now() - interval '16 minutes') then
      return null;
    end if;
  end if;
  return v_papel;
end;
$$;

-- Unidade do login: sem temporário, igual a antes; com temporário, a fixa (se ativa) ou a 1ª temporária
create or replace function public.seg_unidade()
returns text language sql stable security definer set search_path to 'public' as $function$
  select case
    when public.seg_papel() is null then null
    when cardinality(public.acesso_unidades_temporarias()) = 0 then (
      select public.seg_normalizar(unidade) from public.usuarios_sistema
      where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) limit 1)
    else coalesce((
      select public.seg_normalizar(unidade) from public.usuarios_sistema
      where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) and coalesce(status, 'ATIVO') = 'ATIVO'
        and upper(role) in ('LIDER', 'RECEPCAO') limit 1), (public.acesso_unidades_temporarias())[1])
  end
$function$;

-- Minhas unidades: Admin = todas (NULL); Mentor = as dele; Líder/Recepção = a dele. + as temporárias.
create or replace function public.seg_minhas_unidades()
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_papel text := public.seg_papel();
  v_lista text[];
  v_temp  text[];
  v_fixa  text;
begin
  if v_papel is null then return '{}'::text[]; end if;
  if v_papel = 'ADMIN' then return null; end if;
  v_temp := public.acesso_unidades_temporarias();
  if cardinality(v_temp) = 0 then
    -- Sem temporário: exatamente como antes
    if v_papel = 'MENTOR' then
      select coalesce(array_agg(distinct public.seg_normalizar(m.unidade)), '{}'::text[]) into v_lista
      from public.mentor_unidades m
      where lower(trim(m.mentor_email)) = lower(trim(auth.jwt() ->> 'email'));
      return v_lista;
    end if;
    if coalesce(public.seg_unidade(), '') = '' then return '{}'::text[]; end if;
    return array[public.seg_unidade()];
  end if;
  -- Com temporário: fixas + temporárias
  select public.seg_normalizar(unidade) into v_fixa from public.usuarios_sistema
   where lower(trim(email)) = public.acesso_email() and coalesce(status, 'ATIVO') = 'ATIVO' and upper(role) in ('LIDER', 'RECEPCAO') limit 1;
  select coalesce(array_agg(distinct public.seg_normalizar(m.unidade)), '{}'::text[]) into v_lista
  from public.mentor_unidades m
  where v_papel = 'MENTOR' and lower(trim(m.mentor_email)) = public.acesso_email();
  select coalesce(array_agg(distinct x), '{}'::text[]) into v_lista
  from unnest(coalesce(v_lista, '{}'::text[]) || coalesce(array[v_fixa], '{}'::text[]) || v_temp) x
  where coalesce(x, '') <> '';
  return v_lista;
end;
$$;

-- Unidades do Mentor (Lixeira, restaurar...): as fixas + as do Mentor TEMPORÁRIO (Líder temporário não entra)
create or replace function public.seg_mentor_ve_unidade(p_unidade text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mentor_unidades m
                 where lower(trim(m.mentor_email)) = lower(trim(auth.jwt() ->> 'email'))
                   and public.seg_normalizar(m.unidade) = public.seg_normalizar(p_unidade))
      or (public.acesso_login_google()
          and public.seg_normalizar(p_unidade) = any (public.acesso_temp_unidades_de(public.acesso_email(), 'MENTOR')));
$$;

-- CRM: igual a antes sem temporário; com temporário devolve o papel que vale e a unidade fixa (ou a 1ª temporária)
create or replace function public.get_user_colaborador_info()
returns table(role text, unidade text)
language plpgsql security definer set search_path to 'public' as $function$
BEGIN
    IF public.seg_papel() IS NULL THEN RETURN; END IF; -- trava de 12/11/2026 (inativo, senha após a virada, sessão vencida)
    IF cardinality(public.acesso_unidades_temporarias()) = 0 THEN
        RETURN QUERY
        SELECT u.role::text, u.unidade::text
        FROM public.usuarios_sistema u
        WHERE u.email = (auth.jwt() ->> 'email')
        LIMIT 1;
        RETURN;
    END IF;
    RETURN QUERY
    SELECT public.seg_papel()::text,
           coalesce((SELECT u.unidade::text FROM public.usuarios_sistema u
                     WHERE lower(trim(u.email)) = public.acesso_email() AND coalesce(u.status, 'ATIVO') = 'ATIVO'
                       AND upper(u.role) IN ('LIDER', 'RECEPCAO') LIMIT 1),
                    (SELECT t.u FROM unnest((SELECT x.unidades FROM public.acesso_temp_ativos_de(public.acesso_email()) x ORDER BY x.liberado_em LIMIT 1)) AS t(u) LIMIT 1));
END;
$function$;

-- ---------- 5) Quem pode liberar ----------
create or replace function public.acesso_temp_pode_gerir(p_tipo text, p_unidades text[])
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_minhas text[];
begin
  if public.seg_papel() = 'ADMIN' then return true; end if;
  if upper(coalesce(p_tipo, '')) <> 'LIDER' then return false; end if;           -- Mentor temporário: só o Admin
  v_minhas := public.acesso_mentor_fixo_unidades();                               -- vazio para quem não é Mentor fixo
  return coalesce(array_length(p_unidades, 1), 0) > 0
     and not exists (select 1 from unnest(p_unidades) u where not (public.seg_normalizar(u) = any (v_minhas)));
end;
$$;

-- Prévia da data final (a tela mostra antes de confirmar). p_id = prorrogação daquele acesso.
create or replace function public.acesso_temp_previa(p_prazo text, p_data date default null, p_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_base date := public.acesso_hoje(); v_fim date; t public.acessos_temporarios;
begin
  if coalesce(public.seg_papel(), '') not in ('ADMIN', 'MENTOR') then raise exception 'Sem permissão.'; end if;
  if p_id is not null then
    select * into t from public.acessos_temporarios where id = p_id;
    if found and t.vale_ate >= v_base then v_base := t.vale_ate + 1; end if;
  end if;
  v_fim := public.acesso_calcular_vale_ate(p_prazo, p_data, v_base);
  return jsonb_build_object('hoje', public.acesso_hoje(), 'inicio', v_base, 'vale_ate', v_fim, 'dias', v_fim - v_base + 1);
end;
$$;

-- Liberar
create or replace function public.acesso_temp_liberar(p_email text, p_nome text, p_telefone text, p_tipo text, p_unidades text[],
                                                     p_prazo text, p_data date default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_tel   text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_tipo  text := upper(trim(coalesce(p_tipo, '')));
  v_unid  text[];
  v_fim   date;
  v_fixo  public.usuarios_sistema;
  v_quem  text := public.acesso_email();
  v_nome_q text := public.acesso_nome_de(public.acesso_email());
  v_reg   public.acessos_temporarios;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido.'; end if;
  if v_email = v_quem then raise exception 'Você não pode liberar acesso para você mesmo.'; end if;
  if length(trim(coalesce(p_nome, ''))) < 5 or position(' ' in trim(p_nome)) = 0 then raise exception 'Informe o nome completo.'; end if;
  if length(v_tel) < 12 or length(v_tel) > 15 then raise exception 'WhatsApp inválido: use o código do país e o DDD (ex.: +55 31 99999-9999).'; end if;
  if v_tipo not in ('LIDER', 'MENTOR') then raise exception 'Escolha o tipo: Líder ou Mentor.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  select array_agg(distinct upper(trim(u))) into v_unid from unnest(p_unidades) u where trim(coalesce(u, '')) <> '';
  if coalesce(array_length(v_unid, 1), 0) = 0 then raise exception 'Escolha pelo menos uma unidade.'; end if;
  if exists (select 1 from unnest(v_unid) u where not exists (select 1 from public.unidades x where upper(trim(x.nome)) = u and coalesce(x.ativa, true))) then
    raise exception 'Unidade não encontrada (ou desativada).';
  end if;
  if not public.acesso_temp_pode_gerir(v_tipo, v_unid) then
    raise exception 'Você não pode liberar este acesso (Mentor libera só Líder temporário nas unidades dele; Mentor temporário só o Admin).';
  end if;
  select * into v_fixo from public.usuarios_sistema where lower(trim(email)) = v_email;
  if found and v_fixo.status = 'ATIVO' and upper(v_fixo.role) = 'ADMIN' then raise exception 'Este e-mail já é Admin (acesso total).'; end if;
  if found and upper(v_fixo.role) = 'RECEPCAO' then raise exception 'Este é o e-mail da Recepção de uma unidade. Use o e-mail pessoal da pessoa.'; end if;
  v_fim := public.acesso_calcular_vale_ate(p_prazo, p_data, public.acesso_hoje());
  insert into public.acessos_temporarios (email, nome, telefone, tipo, unidades, inicio, vale_ate, prazo, motivo, liberado_por_email, liberado_por_nome)
  values (v_email, upper(trim(p_nome)), v_tel, v_tipo, v_unid, public.acesso_hoje(), v_fim, lower(trim(p_prazo)), trim(p_motivo), v_quem, v_nome_q)
  returning * into v_reg;
  perform public.acesso_log(v_email, 'TEMP_LIBERADO', v_tipo || ' · ' || array_to_string(v_unid, ', ') || ' · até '
    || to_char(v_fim, 'DD/MM/YYYY') || ' · ' || trim(p_motivo) || ' · por ' || v_nome_q);
  return jsonb_build_object('id', v_reg.id, 'vale_ate', v_reg.vale_ate);
end;
$$;

-- Prorrogar (conta a partir do dia seguinte ao fim atual; se já venceu, a partir de hoje)
create or replace function public.acesso_temp_prorrogar(p_id bigint, p_prazo text, p_data date default null, p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.acessos_temporarios; v_base date := public.acesso_hoje(); v_fim date; v_nome_q text := public.acesso_nome_de(public.acesso_email());
begin
  select * into t from public.acessos_temporarios where id = p_id for update;
  if not found then raise exception 'Acesso temporário não encontrado.'; end if;
  if t.encerrado_em is not null then raise exception 'Este acesso foi encerrado. Libere um novo.'; end if;
  if not (public.seg_papel() = 'ADMIN' or (t.liberado_por_email = public.acesso_email() and public.acesso_temp_pode_gerir(t.tipo, t.unidades))) then
    raise exception 'Só quem liberou (ou o Admin) pode prorrogar.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  if t.vale_ate >= v_base then v_base := t.vale_ate + 1; end if;
  v_fim := public.acesso_calcular_vale_ate(p_prazo, p_data, v_base);
  update public.acessos_temporarios
     set vale_ate = v_fim,
         prorrogacoes = prorrogacoes || jsonb_build_array(jsonb_build_object('em', now(), 'por', v_nome_q, 'de', t.vale_ate, 'para', v_fim, 'motivo', trim(p_motivo)))
   where id = p_id;
  perform public.acesso_log(t.email, 'TEMP_PRORROGADO', t.tipo || ' · ' || array_to_string(t.unidades, ', ') || ' · de '
    || to_char(t.vale_ate, 'DD/MM/YYYY') || ' para ' || to_char(v_fim, 'DD/MM/YYYY') || ' · ' || trim(p_motivo) || ' · por ' || v_nome_q);
  return jsonb_build_object('id', p_id, 'vale_ate', v_fim);
end;
$$;

-- Encerrar antes do prazo (corta na hora)
create or replace function public.acesso_temp_encerrar(p_id bigint, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare t public.acessos_temporarios; v_nome_q text := public.acesso_nome_de(public.acesso_email());
begin
  select * into t from public.acessos_temporarios where id = p_id for update;
  if not found then raise exception 'Acesso temporário não encontrado.'; end if;
  if t.encerrado_em is not null then raise exception 'Este acesso já foi encerrado.'; end if;
  if not (public.seg_papel() = 'ADMIN' or (t.liberado_por_email = public.acesso_email() and public.acesso_temp_pode_gerir(t.tipo, t.unidades))) then
    raise exception 'Só quem liberou (ou o Admin) pode encerrar.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  update public.acessos_temporarios set encerrado_em = now(), encerrado_por = v_nome_q, motivo_encerramento = trim(p_motivo) where id = p_id;
  perform public.acesso_log(t.email, 'TEMP_ENCERRADO', t.tipo || ' · ' || array_to_string(t.unidades, ', ') || ' · ' || trim(p_motivo) || ' · por ' || v_nome_q);
  return 'ok';
end;
$$;

-- Lista para a aba Acessos → Temporários (Admin: todos; Mentor: os que ele liberou e os Líderes temporários das
-- unidades fixas dele). Valendo + vencidos/encerrados dos últimos 60 dias.
create or replace function public.acesso_temp_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[] := public.acesso_mentor_fixo_unidades(); v_eu text := public.acesso_email(); v_hoje date := public.acesso_hoje();
begin
  if coalesce(v_papel, '') not in ('ADMIN', 'MENTOR') then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.ordem, x.vale_ate) from (
    select t.*,
           case when t.encerrado_em is not null then 'ENCERRADO' when t.vale_ate < v_hoje then 'VENCIDO' else 'ATIVO' end as situacao,
           (t.vale_ate - v_hoje) as dias_para_vencer,
           v_hoje as hoje,
           case when t.encerrado_em is null and t.vale_ate >= v_hoje then 0 else 1 end as ordem,
           (v_papel = 'ADMIN' or (t.liberado_por_email = v_eu and public.acesso_temp_pode_gerir(t.tipo, t.unidades))) as pode_gerir,
           (select jsonb_build_object('role', u.role, 'unidade', u.unidade, 'status', u.status)
              from public.usuarios_sistema u where lower(trim(u.email)) = lower(t.email) limit 1) as acesso_fixo
    from public.acessos_temporarios t
    where (v_papel = 'ADMIN'
           or t.liberado_por_email = v_eu
           or (t.tipo = 'LIDER' and not exists (select 1 from unnest(t.unidades) u where not (public.seg_normalizar(u) = any (v_minhas)))))
      and (t.encerrado_em is null and t.vale_ate >= v_hoje
           or coalesce(t.encerrado_em::date, t.vale_ate) >= v_hoje - 60)
  ) x), '[]'::jsonb);
end;
$$;

-- ---------- 6) Situação de quem entrou: + os temporários valendo e o "hoje" do servidor ----------
create or replace function public.acesso_situacao()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_email text := public.acesso_email(); v_perfil jsonb; v_pedido jsonb; v_temp jsonb;
begin
  if v_email is null then return jsonb_build_object('perfil', null, 'pedido', null, 'temporarios', '[]'::jsonb, 'hoje', public.acesso_hoje()); end if;
  select to_jsonb(x) into v_perfil from (
    select email, nome, role, unidade, posto, telefone, status, dados_confirmados_em, emergencia_ate, inativado_motivo
    from public.usuarios_sistema where lower(trim(email)) = v_email limit 1) x;
  select to_jsonb(x) into v_pedido from (
    select id, papel, unidades, tipo, status, motivo, criado_em, posto from public.acesso_solicitacoes
    where lower(email) = v_email order by criado_em desc limit 1) x;
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome, 'telefone', t.telefone, 'tipo', t.tipo, 'unidades', t.unidades,
                                               'inicio', t.inicio, 'vale_ate', t.vale_ate, 'liberado_por', t.liberado_por_nome,
                                               'dias_para_vencer', t.vale_ate - public.acesso_hoje()) order by t.vale_ate), '[]'::jsonb)
    into v_temp from public.acesso_temp_ativos_de(v_email) t;
  return jsonb_build_object('perfil', v_perfil, 'pedido', v_pedido, 'temporarios', v_temp, 'hoje', public.acesso_hoje());
end;
$$;

-- Registro do login: + último login do acesso temporário
create or replace function public.acesso_registrar_login(p_metodo text, p_dispositivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := public.acesso_email(); v_sessao text := auth.jwt() ->> 'session_id';
begin
  if v_email is null then return; end if;
  perform public.acesso_log(v_email, 'LOGIN', null, left(coalesce(p_metodo, ''), 20), left(coalesce(p_dispositivo, ''), 200));
  if v_sessao is not null then
    insert into public.acesso_sessoes (session_id, email) values (v_sessao, v_email)
    on conflict (session_id) do update set ultima_atividade = now();
  end if;
  update public.usuarios_sistema set ultimo_login = now(), ultimo_metodo = left(coalesce(p_metodo, ''), 20) where lower(trim(email)) = v_email;
  update public.acessos_temporarios set ultimo_login = now()
   where lower(email) = v_email and encerrado_em is null and public.acesso_hoje() between inicio and vale_ate;
end;
$$;

do $$ declare f text; begin
  foreach f in array array['acesso_temp_pode_gerir(text,text[])', 'acesso_temp_previa(text,date,bigint)',
    'acesso_temp_liberar(text,text,text,text,text[],text,date,text)', 'acesso_temp_prorrogar(bigint,text,date,text)',
    'acesso_temp_encerrar(bigint,text)', 'acesso_temp_listar()', 'acesso_situacao()', 'acesso_registrar_login(text,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO). Esperado: as datas do exemplo do dono e "sim" nas funções.
select 'liberado 13/11 por 10 dias vale até' as item, to_char(public.acesso_calcular_vale_ate('10d', null, date '2026-11-13'), 'DD/MM/YYYY') as valor
union all select 'liberado 13/11 por 2 meses vale até', to_char(public.acesso_calcular_vale_ate('2m', null, date '2026-11-13'), 'DD/MM/YYYY')
union all select 'hoje no servidor (Brasília)', to_char(public.acesso_hoje(), 'DD/MM/YYYY')
union all select 'seg_papel com temporário', (pg_get_functiondef('public.seg_papel()'::regprocedure) like '%acesso_temp_papel_de%')::text
union all select 'seg_minhas_unidades com temporário', (pg_get_functiondef('public.seg_minhas_unidades()'::regprocedure) like '%acesso_unidades_temporarias%')::text
union all select 'temporários cadastrados', count(*)::text from public.acessos_temporarios;

-- Permissão 911 "Liberar acesso temporário" no padrão do banco (Admin e Mentor; mudável para o Mentor)
insert into public.permissoes_padrao (codigo, padrao, travada, rede, mudavel_para)
values ('911', array['ADMIN', 'MENTOR'], false, false, array['MENTOR'])
on conflict (codigo) do update set padrao = excluded.padrao, travada = excluded.travada, rede = excluded.rede, mudavel_para = excluded.mudavel_para;
