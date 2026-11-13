-- =====================================================================
-- DESFAZER (só em emergência). Volta as funções e regras a como estavam antes do passo 1 (cópia do passo 0).
-- 1) encerra todos os acessos temporários (eles deixam de valer na hora; ficam guardados)
-- 2) apaga as regras "temp_" do CRM
-- 3) volta o texto de TODAS as funções copiadas no passo 0 (seg_papel, seg_minhas_unidades, seg_unidade,
--    get_user_colaborador_info, seg_mentor_ve_unidade, acesso_*...)
-- 4) apaga as funções novas e volta a trava "um líder por unidade" (só se nenhuma unidade tiver Aspira ativo;
--    se tiver, inative o Aspira antes)
-- O campo "posto", a tabela acessos_temporarios e o histórico ficam (não atrapalham e guardam o registro).
-- =====================================================================

update public.acessos_temporarios set encerrado_em = now(), encerrado_por = 'DESFAZER', motivo_encerramento = 'Desfeito pelo 9_desfazer.sql'
where encerrado_em is null;

do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'temp\_%' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Funções com assinatura nova: apaga as novas antes de recriar as antigas
drop function if exists public.acesso_solicitar(text, text, text, text[], text);
drop function if exists public.acesso_aprovar(bigint, text, text[], text);
drop function if exists public.acesso_definir_lider(text, text, text);
drop function if exists public.acesso_lider_atual(text);

do $$ declare v_def text; begin
  for v_def in select definicao from public.seg_backup_funcoes_20261113 loop
    execute v_def;
  end loop;
end $$;

drop function if exists public.acesso_tirar_lider(text, text, text);
drop function if exists public.acesso_mentor_fixo_unidades();
drop function if exists public.acesso_temp_liberar(text, text, text, text, text[], text, date, text);
drop function if exists public.acesso_temp_prorrogar(bigint, text, date, text);
drop function if exists public.acesso_temp_encerrar(bigint, text);
drop function if exists public.acesso_temp_listar();
drop function if exists public.acesso_temp_previa(text, date, bigint);
drop function if exists public.acesso_temp_pode_gerir(text, text[]);
drop function if exists public.acesso_unidades_temporarias();
drop function if exists public.acesso_temp_unidades_de(text, text);
drop function if exists public.acesso_temp_papel_de(text);
drop function if exists public.acesso_temp_ativos_de(text);
drop function if exists public.acesso_calcular_vale_ate(text, date, date);

-- As funções recriadas voltam com as mesmas permissões de antes (só para quem está logado)
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'acesso\_%' and p.proname not in ('acesso_email', 'acesso_hoje', 'acesso_rank_papel', 'acesso_login_google') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.config_sistema(text) to anon;

drop index if exists public.usuarios_um_lider_por_posto;
do $$ begin
  create unique index if not exists usuarios_um_lider_ativo_por_unidade
    on public.usuarios_sistema (upper(trim(unidade))) where upper(role) = 'LIDER' and status = 'ATIVO';
exception when unique_violation then
  raise notice 'ATENÇÃO: há unidade com Líder e Aspira ativos. Inative o Aspira e rode este bloco de novo.';
end $$;

notify pgrst, 'reload schema';

select 'funções devolvidas' as item, count(*)::text as valor from public.seg_backup_funcoes_20261113
union all select 'regras temp_ que sobraram (esperado 0)', count(*)::text from pg_policies where schemaname = 'public' and policyname like 'temp\_%';
