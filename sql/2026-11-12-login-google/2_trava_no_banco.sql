-- =====================================================================
-- PASSO 2: A TRAVA NO BANCO (rode depois do passo 1)
-- Todas as regras de acesso do sistema perguntam ao banco "quem é a pessoa" pela função seg_papel().
-- Este passo GUARDA a função de hoje com o nome seg_papel_base (sem mudar nada nela) e coloca por cima três
-- conferências. Assim a trava vale para TODAS as telas e tabelas de uma vez:
--   1) login INATIVO (ex.: líder trocado) não acessa nada
--   2) com login_senha_todos = 'nao' (depois da virada), quem entrou com SENHA só acessa se for Admin ou tiver a
--      liberação de emergência de 24 h
--   3) com sessao_banco = 'sim', Líder/Mentor/Admin parados há mais de 15 min não acessam (a Recepção não entra)
-- As chaves 2 e 3 começam desligadas: com elas desligadas, só a 1 vale (e hoje todos estão ATIVOS).
-- Desfazer: 9_desfazer.sql (volta a função de hoje).
-- ⚠️ A função get_user_colaborador_info (usada pelo CRM) fica para depois de conferir o texto dela (passo 0).
-- =====================================================================

-- 1) Guarda a função de hoje (só na primeira vez; rodar de novo não estraga)
do $$
declare v_def text;
begin
  if to_regprocedure('public.seg_papel_base()') is null then
    select pg_get_functiondef('public.seg_papel()'::regprocedure) into v_def;
    v_def := replace(v_def, 'FUNCTION public.seg_papel()', 'FUNCTION public.seg_papel_base()');
    execute v_def;
  end if;
end $$;
revoke execute on function public.seg_papel_base() from public, anon;
grant execute on function public.seg_papel_base() to authenticated;

-- 2) A função de sempre, agora com as conferências (o nome não muda: as regras de acesso continuam iguais)
create or replace function public.seg_papel()
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_papel  text := public.seg_papel_base();
  v_email  text;
  v_status text;
  v_emerg  timestamptz;
  v_metodo text;
begin
  if v_papel is null then return null; end if;
  v_email := lower(trim(auth.jwt() ->> 'email'));
  select status, emergencia_ate into v_status, v_emerg from public.usuarios_sistema where lower(trim(email)) = v_email limit 1;
  -- 1) login inativo
  if coalesce(v_status, 'ATIVO') <> 'ATIVO' then return null; end if;
  -- 2) senha depois da virada: só Admin ou liberação de emergência
  v_metodo := auth.jwt() -> 'amr' -> 0 ->> 'method';
  if v_metodo = 'password' and upper(v_papel) <> 'ADMIN'
     and coalesce(public.config_sistema('login_senha_todos'), 'sim') = 'nao'
     and coalesce(v_emerg, '-infinity'::timestamptz) < now() then
    return null;
  end if;
  -- 3) sessão de 15 minutos (Líder, Mentor e Admin; a Recepção fica com a cortina de 30 min)
  if coalesce(public.config_sistema('sessao_banco'), 'nao') = 'sim' and upper(v_papel) <> 'RECEPCAO' then
    if not exists (select 1 from public.acesso_sessoes s
                   where s.session_id = auth.jwt() ->> 'session_id' and s.ultima_atividade > now() - interval '16 minutes') then
      return null;
    end if;
  end if;
  return v_papel;
end;
$$;

-- Conferência (MANDE ESTE RESULTADO): a função de hoje foi guardada e a nova está no lugar
select 'função de hoje guardada (seg_papel_base)' as item, (to_regprocedure('public.seg_papel_base()') is not null)::text as ok
union all select 'função nova no lugar', (pg_get_functiondef('public.seg_papel()'::regprocedure) like '%seg_papel_base%')::text
union all select 'login antigo para todos', coalesce(public.config_sistema('login_senha_todos'), '?')
union all select 'sessão de 15 min no banco', coalesce(public.config_sistema('sessao_banco'), '?');
