-- =====================================================================
-- PASSO 4: A MESMA TRAVA NO CRM (rode depois do passo 2)
-- O CRM pergunta "quem é a pessoa" por outra função, get_user_colaborador_info (e o crm_eh_funcionario usa ela).
-- A seg_unidade também é usada sozinha por algumas regras. As duas passam a responder NADA quando a seg_papel()
-- (já com a trava do passo 2) diz que a pessoa não tem acesso: login INATIVO, senha depois da virada sem
-- liberação, sessão de 15 min vencida. O resto do texto é IDÊNTICO ao de hoje (copiado no passo 0, tabela
-- seg_backup_funcoes_20261112). Desfazer: 9_desfazer.sql.
-- =====================================================================

-- CRM: igual a hoje + "só se a pessoa tem acesso"
create or replace function public.get_user_colaborador_info()
returns table(role text, unidade text)
language plpgsql security definer set search_path to 'public' as $function$
BEGIN
    IF public.seg_papel() IS NULL THEN RETURN; END IF; -- trava de 12/11/2026 (inativo, senha após a virada, sessão vencida)
    RETURN QUERY
    SELECT u.role::text, u.unidade::text
    FROM public.usuarios_sistema u
    WHERE u.email = (auth.jwt() ->> 'email')
    LIMIT 1;
END;
$function$;

-- Unidade: igual a hoje + "só se a pessoa tem acesso"
create or replace function public.seg_unidade()
returns text language sql stable security definer set search_path to 'public' as $function$
  select case when public.seg_papel() is null then null else (
    select public.seg_normalizar(unidade) from public.usuarios_sistema
    where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) limit 1
  ) end
$function$;

-- Conferência (MANDE ESTE RESULTADO)
select 'CRM com a trava' as item, (pg_get_functiondef('public.get_user_colaborador_info()'::regprocedure) like '%seg_papel() IS NULL%')::text as ok
union all select 'unidade com a trava', (pg_get_functiondef('public.seg_unidade()'::regprocedure) like '%seg_papel() is null%')::text
union all select 'cópia das funções de antes', (select count(*)::text from public.seg_backup_funcoes_20261112);
