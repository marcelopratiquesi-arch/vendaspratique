-- =====================================================================
-- PASSO 6: ACESSO DE EMERGÊNCIA ATÉ 7 DIAS (decisão do dono, 12/11/2026)
-- Antes: o Admin liberava a entrada com senha por 24 h fixas. Agora escolhe 24 h, 3 dias ou 7 dias (máximo 7 dias,
-- 168 horas) e pode ENCERRAR antes (0 horas). Liberar de novo vale a partir de agora (renova).
-- Continua só o Admin. Tudo fica no registro de acessos (evento EMERGENCIA).
-- Desfazer: rodar de novo o trecho da função acesso_liberar_emergencia do 1_acesso_pessoal.sql (volta às 24 h fixas)
-- depois de "drop function public.acesso_liberar_emergencia(text, integer);".
-- =====================================================================

drop function if exists public.acesso_liberar_emergencia(text);

create or replace function public.acesso_liberar_emergencia(p_email text, p_horas integer default 24)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_ate timestamptz;
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then raise exception 'Só o Admin libera acesso de emergência.'; end if;
  if p_horas is null or p_horas < 0 or p_horas > 168 then raise exception 'Escolha de 1 hora a 7 dias (ou 0 para encerrar).'; end if;
  v_ate := case when p_horas = 0 then null else now() + make_interval(hours => p_horas) end;
  update public.usuarios_sistema set emergencia_ate = v_ate where lower(trim(email)) = lower(trim(p_email));
  if not found then raise exception 'Login não encontrado.'; end if;
  perform public.acesso_log(p_email, 'EMERGENCIA',
    case when v_ate is null then 'liberação com senha encerrada'
         else 'liberado até ' || to_char(v_ate at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI') || ' (' || p_horas || ' h)' end);
  return v_ate;
end;
$$;

revoke execute on function public.acesso_liberar_emergencia(text, integer) from public, anon;
grant execute on function public.acesso_liberar_emergencia(text, integer) to authenticated;

-- Conferência (MANDE ESTE RESULTADO): deve aparecer uma linha só, com "p_email text, p_horas integer"
select p.oid::regprocedure as funcao, pg_get_function_arguments(p.oid) as parametros
from pg_proc p where p.proname = 'acesso_liberar_emergencia';
