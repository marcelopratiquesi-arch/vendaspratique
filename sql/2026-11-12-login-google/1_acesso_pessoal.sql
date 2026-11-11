-- =====================================================================
-- PASSO 1: ACESSO PESSOAL (rode depois do passo 0). NÃO muda o login de hoje: tudo começa DESLIGADO
-- (tabela sistema_config). O que cria:
--   1) chaves: login_google (botão "Entrar com Google"), login_senha_todos (login antigo com senha para todos,
--      durante a transição), sessao_banco (o banco recusa quem ficou 15 min parado; Líder/Mentor/Admin)
--   2) no login (usuarios_sistema): telefone, situação, último login, confirmação dos dados, quem aprovou,
--      liberação de emergência de 24 h, inativação
--   3) pedidos de acesso, histórico de líderes, registro de acessos, sessões e avisos "Não fui eu"
--   4) funções seguras: pedir, aprovar, rejeitar (Mentor só nas unidades dele e só Líder; Mentor novo só o
--      Admin), confirmar dados (o telefone do Líder vai também para a Equipe), registrar login/atividade,
--      painel de acessos (aba Pendências), liberar emergência, inativar/reativar
--   5) trava: UMA unidade nunca tem dois líderes ativos
-- Recepção: entra com o Google no e-mail da franquia (o mesmo do login dela), sem pedido nem confirmação.
-- =====================================================================

-- ---------- 1) Chaves ----------
create table if not exists public.sistema_config (
  chave         text primary key,
  valor         text not null,
  descricao     text,
  atualizado_em timestamptz not null default now()
);
alter table public.sistema_config enable row level security;
drop policy if exists sistema_config_ler on public.sistema_config;
create policy sistema_config_ler on public.sistema_config for select to anon, authenticated using (true);
insert into public.sistema_config (chave, valor, descricao) values
  ('login_google', 'nao', 'sim = mostra "Entrar com Google" (ligue depois de configurar o Google no Supabase)'),
  ('login_senha_todos', 'sim', 'sim = todos ainda podem entrar com senha (transição). nao = só o Admin e quem tiver liberação de emergência'),
  ('sessao_banco', 'nao', 'sim = o banco recusa Líder/Mentor/Admin parados há mais de 15 min (Recepção não)')
on conflict (chave) do nothing;

create or replace function public.config_sistema(p_chave text)
returns text language sql stable security definer set search_path = public as $$
  select valor from public.sistema_config where chave = p_chave
$$;

-- ---------- 2) Campos novos no login ----------
alter table public.usuarios_sistema add column if not exists telefone text;
alter table public.usuarios_sistema add column if not exists status text not null default 'ATIVO';
alter table public.usuarios_sistema add column if not exists ultimo_login timestamptz;
alter table public.usuarios_sistema add column if not exists ultimo_metodo text;
alter table public.usuarios_sistema add column if not exists dados_confirmados_em timestamptz;
alter table public.usuarios_sistema add column if not exists aprovado_por text;
alter table public.usuarios_sistema add column if not exists aprovado_em timestamptz;
alter table public.usuarios_sistema add column if not exists emergencia_ate timestamptz;
alter table public.usuarios_sistema add column if not exists inativado_em timestamptz;
alter table public.usuarios_sistema add column if not exists inativado_motivo text;
do $$ begin
  alter table public.usuarios_sistema add constraint usuarios_sistema_status_valido check (status in ('ATIVO', 'INATIVO'));
exception when duplicate_object then null; end $$;

-- ---------- 3) Tabelas novas (sem leitura direta: só pelas funções) ----------
create table if not exists public.acesso_solicitacoes (
  id                 bigserial primary key,
  email              text not null,
  nome               text not null,
  telefone           text not null,
  papel              text not null check (papel in ('LIDER', 'MENTOR')),
  unidades           text[] not null,
  tipo               text not null default 'NOVO' check (tipo in ('NOVO', 'TROCA_LIDER')),
  telefone_repetido_de text,
  status             text not null default 'AGUARDANDO_APROVACAO' check (status in ('AGUARDANDO_APROVACAO', 'APROVADO', 'REJEITADO', 'CANCELADO')),
  motivo             text,
  criado_em          timestamptz not null default now(),
  decidido_por       text,
  decidido_em        timestamptz,
  alteracoes         jsonb
);
create index if not exists acesso_solicitacoes_email_idx on public.acesso_solicitacoes (lower(email));
create index if not exists acesso_solicitacoes_status_idx on public.acesso_solicitacoes (status);
alter table public.acesso_solicitacoes enable row level security;

create table if not exists public.lideres_historico (
  id       bigserial primary key,
  unidade  text not null,
  email    text not null,
  nome     text,
  inicio   timestamptz,
  fim      timestamptz,
  motivo_fim text,
  origem   text
);
create index if not exists lideres_historico_unidade_idx on public.lideres_historico (upper(trim(unidade)));
alter table public.lideres_historico enable row level security;
-- Líderes de hoje entram no histórico (início desconhecido: antes do login novo)
insert into public.lideres_historico (unidade, email, nome, inicio, origem)
select upper(trim(u.unidade)), lower(trim(u.email)), u.nome, null, 'antes do login novo'
from public.usuarios_sistema u
where upper(u.role) = 'LIDER'
  and not exists (select 1 from public.lideres_historico h where lower(h.email) = lower(trim(u.email)));

create table if not exists public.acessos_log (
  id          bigserial primary key,
  email       text not null,
  quando      timestamptz not null default now(),
  evento      text not null,          -- LOGIN, LOGOUT, EXPIROU, NEGADO, SOLICITACAO, APROVACAO, REJEICAO, TROCA_LIDER, DADOS_CONFIRMADOS, SITUACAO, EMERGENCIA
  metodo      text,                   -- google, senha
  dispositivo text,
  session_id  text,
  detalhe     text,
  feito_por   text
);
create index if not exists acessos_log_email_idx on public.acessos_log (lower(email), quando desc);
alter table public.acessos_log enable row level security;

create table if not exists public.acesso_sessoes (
  session_id       text primary key,
  email            text not null,
  criado_em        timestamptz not null default now(),
  ultima_atividade timestamptz not null default now()
);
alter table public.acesso_sessoes enable row level security;

create table if not exists public.acesso_alertas (
  id         bigserial primary key,
  email      text not null,
  log_id     bigint,
  texto      text,
  criado_em  timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por text
);
alter table public.acesso_alertas enable row level security;

-- ---------- Ajudas ----------
create or replace function public.acesso_email() returns text language sql stable as $$
  select lower(trim(auth.jwt() ->> 'email'))
$$;
create or replace function public.acesso_nome_de(p_email text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nome from public.usuarios_sistema where lower(trim(email)) = lower(trim(p_email)) limit 1), p_email)
$$;
create or replace function public.acesso_log(p_email text, p_evento text, p_detalhe text default null, p_metodo text default null, p_dispositivo text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.acessos_log (email, evento, detalhe, metodo, dispositivo, session_id, feito_por)
  values (lower(trim(p_email)), p_evento, p_detalhe, p_metodo, p_dispositivo, auth.jwt() ->> 'session_id', public.acesso_email())
$$;
-- Quem pode aprovar: Admin tudo; Mentor só pedido de LÍDER nas unidades dele (Mentor novo: só o Admin)
create or replace function public.acesso_pode_aprovar(p_papel text, p_unidades text[])
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[];
begin
  if v_papel = 'ADMIN' then return true; end if;
  if v_papel <> 'MENTOR' or upper(p_papel) <> 'LIDER' then return false; end if;
  v_minhas := public.seg_minhas_unidades();
  return coalesce(array_length(p_unidades, 1), 0) > 0
     and not exists (select 1 from unnest(p_unidades) u where not (public.seg_normalizar(u) = any (coalesce(v_minhas, '{}'::text[]))));
end;
$$;

-- ---------- 4) Funções ----------
-- Situação de quem acabou de entrar (perfil e último pedido). Usada pela tela depois do "Entrar com Google".
create or replace function public.acesso_situacao()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_email text := public.acesso_email(); v_perfil jsonb; v_pedido jsonb;
begin
  if v_email is null then return jsonb_build_object('perfil', null, 'pedido', null); end if;
  select to_jsonb(x) into v_perfil from (
    select email, nome, role, unidade, telefone, status, dados_confirmados_em, emergencia_ate, inativado_motivo
    from public.usuarios_sistema where lower(trim(email)) = v_email limit 1) x;
  select to_jsonb(x) into v_pedido from (
    select id, papel, unidades, tipo, status, motivo, criado_em from public.acesso_solicitacoes
    where lower(email) = v_email order by criado_em desc limit 1) x;
  return jsonb_build_object('perfil', v_perfil, 'pedido', v_pedido);
end;
$$;

-- Unidades para o cadastro (só nomes das ativas; quem pede ainda não tem acesso às tabelas)
create or replace function public.acesso_unidades_para_cadastro()
returns table (nome text) language sql stable security definer set search_path = public as $$
  select u.nome::text from public.unidades u where coalesce(u.ativa, true) and public.acesso_email() is not null order by u.nome
$$;

-- Pedir acesso (Líder: UMA unidade; Mentor: várias). Unidade com líder ativo = TROCA DE LÍDER.
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
  if v_papel = 'LIDER' and exists (select 1 from public.usuarios_sistema where upper(role) = 'LIDER' and status = 'ATIVO'
                                     and upper(trim(unidade)) = v_unid[1] and lower(trim(email)) <> v_email) then
    v_tipo := 'TROCA_LIDER';
  end if;
  select string_agg(nome || ' <' || email || '>', ', ') into v_rep from public.usuarios_sistema
   where regexp_replace(coalesce(telefone, ''), '\D', '', 'g') = v_tel and lower(trim(email)) <> v_email;
  -- Um pedido aberto por e-mail: o novo substitui o anterior
  update public.acesso_solicitacoes set status = 'CANCELADO', decidido_em = now(), decidido_por = 'substituído por novo pedido'
   where lower(email) = v_email and status = 'AGUARDANDO_APROVACAO';
  insert into public.acesso_solicitacoes (email, nome, telefone, papel, unidades, tipo, telefone_repetido_de)
  values (v_email, upper(trim(p_nome)), v_tel, v_papel, v_unid, v_tipo, v_rep)
  returning * into v_reg;
  perform public.acesso_log(v_email, 'SOLICITACAO', v_papel || ' · ' || array_to_string(v_unid, ', ') || case when v_tipo = 'TROCA_LIDER' then ' · TROCA DE LÍDER' else '' end);
  return v_reg;
end;
$$;

-- Aprovar (pode corrigir papel e unidades). Líder: os líderes ativos da unidade ficam INATIVOS (nada é apagado).
create or replace function public.acesso_aprovar(p_id bigint, p_papel text default null, p_unidades text[] default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s        public.acesso_solicitacoes;
  v_papel  text;
  v_unid   text[];
  v_quem   text := public.acesso_email();
  v_nome_q text;
  v_trocados text;
begin
  select * into s from public.acesso_solicitacoes where id = p_id for update;
  if not found or s.status <> 'AGUARDANDO_APROVACAO' then raise exception 'Pedido não encontrado ou já decidido.'; end if;
  v_papel := upper(coalesce(nullif(trim(p_papel), ''), s.papel));
  select array_agg(distinct upper(trim(u))) into v_unid from unnest(coalesce(p_unidades, s.unidades)) u where trim(coalesce(u, '')) <> '';
  if v_papel not in ('LIDER', 'MENTOR') then raise exception 'Papel inválido.'; end if;
  if v_papel = 'LIDER' and coalesce(array_length(v_unid, 1), 0) <> 1 then raise exception 'O Líder tem exatamente UMA unidade.'; end if;
  if not public.acesso_pode_aprovar(v_papel, v_unid) then
    raise exception 'Você não pode aprovar este pedido (Mentor aprova só Líder das unidades dele; Mentor novo só o Admin).';
  end if;
  v_nome_q := public.acesso_nome_de(v_quem);

  if v_papel = 'LIDER' then
    -- Troca de líder: quem era líder ativo da unidade vira INATIVO (dados preservados) e o histórico fecha
    select string_agg(nome, ', ') into v_trocados from public.usuarios_sistema
     where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid[1] and lower(trim(email)) <> lower(s.email);
    update public.usuarios_sistema
       set status = 'INATIVO', inativado_em = now(), inativado_motivo = 'Trocado por ' || s.nome || ' (aprovado por ' || v_nome_q || ')'
     where upper(role) = 'LIDER' and status = 'ATIVO' and upper(trim(unidade)) = v_unid[1] and lower(trim(email)) <> lower(s.email);
    update public.lideres_historico set fim = now(), motivo_fim = 'Trocado por ' || s.nome
     where upper(trim(unidade)) = v_unid[1] and fim is null and lower(email) <> lower(s.email);
    if v_trocados is not null then perform public.acesso_log(s.email, 'TROCA_LIDER', v_unid[1] || ': ' || v_trocados || ' → ' || s.nome); end if;
  end if;

  update public.usuarios_sistema
     set nome = s.nome, role = v_papel, unidade = case when v_papel = 'LIDER' then v_unid[1] else 'TODAS' end,
         telefone = s.telefone, status = 'ATIVO', aprovado_por = v_nome_q, aprovado_em = now(),
         inativado_em = null, inativado_motivo = null, dados_confirmados_em = null
   where lower(trim(email)) = lower(s.email);
  if not found then
    insert into public.usuarios_sistema (email, nome, role, unidade, telefone, status, aprovado_por, aprovado_em)
    values (lower(s.email), s.nome, v_papel, case when v_papel = 'LIDER' then v_unid[1] else 'TODAS' end, s.telefone, 'ATIVO', v_nome_q, now());
  end if;

  if v_papel = 'LIDER' then
    insert into public.lideres_historico (unidade, email, nome, inicio, origem) values (v_unid[1], lower(s.email), s.nome, now(), 'login novo');
  else
    insert into public.mentor_unidades (mentor_email, unidade)
    select lower(s.email), u from unnest(v_unid) u
    where not exists (select 1 from public.mentor_unidades m where lower(trim(m.mentor_email)) = lower(s.email) and upper(trim(m.unidade)) = u);
  end if;

  update public.acesso_solicitacoes
     set status = 'APROVADO', decidido_por = v_nome_q, decidido_em = now(),
         alteracoes = case when v_papel <> s.papel or v_unid <> s.unidades
                           then jsonb_build_object('papel_pedido', s.papel, 'papel_aprovado', v_papel, 'unidades_pedidas', s.unidades, 'unidades_aprovadas', v_unid) end
   where id = p_id;
  perform public.acesso_log(s.email, 'APROVACAO', v_papel || ' · ' || array_to_string(v_unid, ', ') || ' · por ' || v_nome_q);
  return jsonb_build_object('ok', true, 'trocados', v_trocados);
end;
$$;

create or replace function public.acesso_rejeitar(p_id bigint, p_motivo text)
returns text language plpgsql security definer set search_path = public as $$
declare s public.acesso_solicitacoes; v_nome_q text := public.acesso_nome_de(public.acesso_email());
begin
  select * into s from public.acesso_solicitacoes where id = p_id for update;
  if not found or s.status <> 'AGUARDANDO_APROVACAO' then raise exception 'Pedido não encontrado ou já decidido.'; end if;
  if not public.acesso_pode_aprovar(s.papel, s.unidades) then raise exception 'Você não pode decidir este pedido.'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  update public.acesso_solicitacoes set status = 'REJEITADO', motivo = trim(p_motivo), decidido_por = v_nome_q, decidido_em = now() where id = p_id;
  perform public.acesso_log(s.email, 'REJEICAO', trim(p_motivo) || ' · por ' || v_nome_q);
  return 'Pedido rejeitado.';
end;
$$;

-- Confirmar os próprios dados (primeiro acesso e a cada 30 dias). O telefone do LÍDER vai também para a Equipe
-- (cadastro do setor Líder na mesma unidade e com o mesmo nome), que é o telefone das cobranças no WhatsApp.
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
       and upper(coalesce(c.role, '')) like '%LIDER%'
       and public.equipe_nome_chave(c.nome) = public.equipe_nome_chave(p_nome);
    get diagnostics v_eq = row_count;
  end if;
  perform public.acesso_log(v_email, 'DADOS_CONFIRMADOS', 'telefone ' || v_tel || case when v_eq > 0 then ' · Equipe atualizada' else '' end);
  return jsonb_build_object('equipe_atualizada', v_eq);
end;
$$;

-- Registro de login (todo login), atividade (no máximo a cada 5 min) e outros eventos
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
end;
$$;
create or replace function public.acesso_atividade()
returns void language plpgsql security definer set search_path = public as $$
declare v_email text := public.acesso_email(); v_sessao text := auth.jwt() ->> 'session_id';
begin
  if v_email is null or v_sessao is null then return; end if;
  insert into public.acesso_sessoes (session_id, email) values (v_sessao, v_email)
  on conflict (session_id) do update set ultima_atividade = now();
end;
$$;
create or replace function public.acesso_registrar_evento(p_evento text, p_detalhe text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.acesso_email() is null or upper(p_evento) not in ('LOGOUT', 'EXPIROU', 'NEGADO') then return; end if;
  perform public.acesso_log(public.acesso_email(), upper(p_evento), left(coalesce(p_detalhe, ''), 300));
end;
$$;

-- "Meus acessos" e "Não fui eu"
create or replace function public.acesso_meus_acessos()
returns table (id bigint, quando timestamptz, evento text, metodo text, dispositivo text) language sql stable security definer set search_path = public as $$
  select l.id, l.quando, l.evento, l.metodo, l.dispositivo from public.acessos_log l
  where lower(l.email) = public.acesso_email() and l.evento in ('LOGIN', 'LOGOUT', 'EXPIROU', 'NEGADO')
  order by l.quando desc limit 60
$$;
create or replace function public.acesso_nao_fui_eu(p_log_id bigint, p_texto text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  if public.acesso_email() is null then raise exception 'Entre no sistema.'; end if;
  insert into public.acesso_alertas (email, log_id, texto) values (public.acesso_email(), p_log_id, left(coalesce(p_texto, ''), 500));
  return 'Aviso enviado à diretoria.';
end;
$$;

-- Painel de acessos (aba Pendências): Admin tudo; Mentor só logins/pedidos das unidades dele (sem outros Mentores)
create or replace function public.acesso_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_papel text := public.seg_papel(); v_minhas text[] := public.seg_minhas_unidades(); v_admin boolean;
begin
  if v_papel not in ('ADMIN', 'MENTOR') then return jsonb_build_object('logins', '[]'::jsonb, 'pedidos', '[]'::jsonb, 'alertas', '[]'::jsonb, 'historico', '[]'::jsonb); end if;
  v_admin := v_papel = 'ADMIN';
  return jsonb_build_object(
    'logins', coalesce((select jsonb_agg(to_jsonb(x)) from (
        select email, nome, role, unidade, telefone, status, ultimo_login, ultimo_metodo, dados_confirmados_em, aprovado_por, aprovado_em, emergencia_ate, inativado_em, inativado_motivo
        from public.usuarios_sistema
        where v_admin or (upper(role) in ('LIDER', 'RECEPCAO') and public.seg_normalizar(unidade) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'pedidos', coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em) from (
        select s.*, (select jsonb_agg(jsonb_build_object('nome', u.nome, 'email', u.email, 'telefone', u.telefone, 'ultimo_login', u.ultimo_login))
                      from public.usuarios_sistema u where s.tipo = 'TROCA_LIDER' and upper(u.role) = 'LIDER' and u.status = 'ATIVO'
                      and upper(trim(u.unidade)) = s.unidades[1]) as lider_atual
        from public.acesso_solicitacoes s
        where s.status = 'AGUARDANDO_APROVACAO' and public.acesso_pode_aprovar(s.papel, s.unidades)) x), '[]'::jsonb),
    'alertas', coalesce((select jsonb_agg(to_jsonb(x) order by x.criado_em desc) from (
        select a.*, u.nome, u.role, u.unidade, l.quando as acesso_quando, l.metodo as acesso_metodo, l.dispositivo as acesso_dispositivo
        from public.acesso_alertas a
        left join public.usuarios_sistema u on lower(trim(u.email)) = lower(a.email)
        left join public.acessos_log l on l.id = a.log_id
        where a.resolvido_em is null and (v_admin or public.seg_normalizar(u.unidade) = any (coalesce(v_minhas, '{}'::text[])))) x), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(to_jsonb(h) order by h.unidade, h.inicio desc nulls last) from public.lideres_historico h
        where v_admin or public.seg_normalizar(h.unidade) = any (coalesce(v_minhas, '{}'::text[]))), '[]'::jsonb)
  );
end;
$$;

-- Liberação de emergência por 24 h (só o Admin): a pessoa entra com a senha antiga mesmo depois da virada
create or replace function public.acesso_liberar_emergencia(p_email text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_ate timestamptz := now() + interval '24 hours';
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin libera acesso de emergência.'; end if;
  update public.usuarios_sistema set emergencia_ate = v_ate where lower(trim(email)) = lower(trim(p_email));
  if not found then raise exception 'Login não encontrado.'; end if;
  perform public.acesso_log(p_email, 'EMERGENCIA', 'liberado até ' || to_char(v_ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'));
  return v_ate;
end;
$$;

-- Inativar / reativar (Admin qualquer; Mentor só Líder e Recepção das unidades dele). Nada é apagado.
create or replace function public.acesso_mudar_situacao(p_email text, p_status text, p_motivo text default null)
returns text language plpgsql security definer set search_path = public as $$
declare u public.usuarios_sistema; v_papel text := public.seg_papel(); v_status text := upper(trim(coalesce(p_status, '')));
begin
  select * into u from public.usuarios_sistema where lower(trim(email)) = lower(trim(p_email));
  if not found then raise exception 'Login não encontrado.'; end if;
  if v_status not in ('ATIVO', 'INATIVO') then raise exception 'Situação inválida.'; end if;
  if not (v_papel = 'ADMIN' or (v_papel = 'MENTOR' and upper(u.role) in ('LIDER', 'RECEPCAO') and public.seg_mesma_unidade(u.unidade))) then
    raise exception 'Você não pode mudar este login.';
  end if;
  if lower(trim(p_email)) = public.acesso_email() then raise exception 'Você não pode mudar o seu próprio login.'; end if;
  if v_status = 'INATIVO' and length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo (mínimo 5 letras).'; end if;
  update public.usuarios_sistema
     set status = v_status,
         inativado_em = case when v_status = 'INATIVO' then now() end,
         inativado_motivo = case when v_status = 'INATIVO' then trim(p_motivo) end
   where lower(trim(email)) = lower(trim(p_email));
  if upper(u.role) = 'LIDER' then
    if v_status = 'INATIVO' then
      update public.lideres_historico set fim = now(), motivo_fim = trim(p_motivo) where lower(email) = lower(trim(p_email)) and fim is null;
    else
      insert into public.lideres_historico (unidade, email, nome, inicio, origem) values (upper(trim(u.unidade)), lower(trim(p_email)), u.nome, now(), 'reativado');
    end if;
  end if;
  perform public.acesso_log(p_email, 'SITUACAO', v_status || coalesce(' · ' || trim(p_motivo), ''));
  return 'ok';
end;
$$;

-- Resolver um aviso "Não fui eu" (Admin)
create or replace function public.acesso_resolver_alerta(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.seg_papel(), '') not in ('ADMIN', 'MENTOR') then raise exception 'Sem permissão.'; end if;
  update public.acesso_alertas set resolvido_em = now(), resolvido_por = public.acesso_nome_de(public.acesso_email()) where id = p_id;
  return 'ok';
end;
$$;

do $$ declare f text; begin
  foreach f in array array['config_sistema(text)', 'acesso_situacao()', 'acesso_unidades_para_cadastro()', 'acesso_solicitar(text,text,text,text[])',
    'acesso_aprovar(bigint,text,text[])', 'acesso_rejeitar(bigint,text)', 'acesso_confirmar_dados(text,text,text)', 'acesso_registrar_login(text,text)',
    'acesso_atividade()', 'acesso_registrar_evento(text,text)', 'acesso_meus_acessos()', 'acesso_nao_fui_eu(bigint,text)', 'acesso_painel()',
    'acesso_liberar_emergencia(text)', 'acesso_mudar_situacao(text,text,text)', 'acesso_resolver_alerta(bigint)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant execute on function public.config_sistema(text) to anon;

-- ---------- 5) Trava: UM líder ativo por unidade ----------
do $$ begin
  create unique index if not exists usuarios_um_lider_ativo_por_unidade
    on public.usuarios_sistema (upper(trim(unidade))) where upper(role) = 'LIDER' and status = 'ATIVO';
exception when unique_violation then
  raise notice 'ATENÇÃO: há unidade com dois ou mais líderes ativos (veja o passo 0). Resolva e rode este bloco de novo.';
end $$;

-- Conferência (MANDE ESTE RESULTADO)
select 'chaves criadas' as item, count(*)::text as valor from public.sistema_config
union all select 'logins ativos', count(*)::text from public.usuarios_sistema where status = 'ATIVO'
union all select 'líderes no histórico', count(*)::text from public.lideres_historico
union all select 'trava 1 líder por unidade', (to_regclass('public.usuarios_um_lider_ativo_por_unidade') is not null)::text;
