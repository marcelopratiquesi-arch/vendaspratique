-- =====================================================================
-- DESFAZER (só em emergência). Volta o login a como era antes.
-- 1) as chaves voltam ao padrão (todos entram com senha; sem trava de sessão; sem botão do Google)
-- 2) a função seg_papel volta a ser EXATAMENTE a de antes (a guardada no passo 2)
-- As tabelas novas e os campos novos do login ficam (não atrapalham e guardam o histórico). Para apagar de vez,
-- tire o "--" das últimas linhas.
-- =====================================================================
update public.sistema_config set valor = 'sim' where chave = 'login_senha_todos';
update public.sistema_config set valor = 'nao' where chave in ('sessao_banco', 'login_google');

do $$
declare v_def text;
begin
  if to_regprocedure('public.seg_papel_base()') is not null then
    select pg_get_functiondef('public.seg_papel_base()'::regprocedure) into v_def;
    v_def := replace(v_def, 'FUNCTION public.seg_papel_base()', 'FUNCTION public.seg_papel()');
    execute v_def;
    drop function public.seg_papel_base();
  end if;
end $$;

-- Passo 4: o CRM e a unidade voltam ao texto de antes (guardado no passo 0)
do $$
declare v_def text;
begin
  for v_def in select definicao from public.seg_backup_funcoes_20261112 where funcao in ('get_user_colaborador_info', 'seg_unidade') loop
    execute v_def;
  end loop;
end $$;

-- Passo 5: tira o "líder marcado pelo Admin" (as funções acesso_solicitar/acesso_painel voltam rodando de novo o passo 1)
drop function if exists public.acesso_definir_lider(text, text);

drop index if exists public.usuarios_um_lider_ativo_por_unidade;
-- Todos voltam a ATIVO (quem foi inativado pelo login novo volta a entrar):
-- update public.usuarios_sistema set status = 'ATIVO', inativado_em = null, inativado_motivo = null where status = 'INATIVO';

-- drop table if exists public.acesso_solicitacoes, public.lideres_historico, public.acessos_log, public.acesso_sessoes, public.acesso_alertas, public.sistema_config;
