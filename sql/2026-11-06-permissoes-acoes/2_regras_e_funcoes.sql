-- =====================================================================
-- PERMISSÕES — ETAPA 2 (AÇÕES) — PASSO 2: LIGA AS AÇÕES NO BANCO  (rode depois dos passos 0 e 1)
-- Como funciona (sem reescrever as regras que já existem):
--   * "liberar": uma regra NOVA que soma às de hoje → quem ganhou a permissão pela aba Permissões pode,
--                SEMPRE nas unidades dele (Admin todas; Mentor as dele; Líder/Recepção a própria).
--   * "trava":   uma regra NOVA obrigatória (restritiva) → quem perdeu a permissão não pode, mesmo que a regra
--                antiga deixasse.
--   Resultado: o banco obedece exatamente à aba Permissões. Sem nenhuma mudança na aba, fica tudo IGUAL a hoje.
-- Funções trocadas (mesmo texto de antes; só a conferência de "quem pode" passa a usar seg_pode):
--   excluir_venda (205/405) · crm_conferir_quem_apaga (514) · excluir_avaliacao (704/610) · restaurar_avaliacao (705)
-- NÃO altera nenhuma venda, comissão, meta ou contato. Para desfazer: 9_desfazer.sql.
-- Rode fora do horário de movimento.
-- =====================================================================

-- Confere que o passo 0 (cópia) e o passo 1 (seg_pode) foram rodados (se não, este comando dá erro: rode-os antes)
select (select count(*) from public.seg_backup_funcoes_20261106) as funcoes_copiadas,
       (select count(*) from public.permissoes_padrao) as numeros_no_padrao;

begin;

-- Ajudante: cria o par "liberar" + "trava" de uma ação numa tabela
--   p_cmd   = INSERT, UPDATE ou DELETE
--   p_pode  = a condição da permissão (ex.: (select public.seg_pode('307')))
--   p_onde  = a condição da unidade (null = vale para a rede inteira, ex.: mensagens prontas)
create or replace function public.seg_tmp_par_de_regras(p_tabela text, p_cmd text, p_nome text, p_pode text, p_onde text)
returns text language plpgsql as $$
declare
  v_libera text := 'perm_' || p_nome;
  v_trava  text := 'perm_' || p_nome || '_trava';
  v_cond   text := case when p_onde is null then p_pode else '(' || p_pode || ' and ' || p_onde || ')' end;
begin
  if to_regclass('public.' || p_tabela) is null then
    return p_tabela || ' / ' || p_cmd || ' → TABELA NÃO EXISTE (pulada)';
  end if;
  execute format('drop policy if exists %I on public.%I', v_libera, p_tabela);
  execute format('drop policy if exists %I on public.%I', v_trava, p_tabela);
  if p_cmd = 'INSERT' then
    execute format('create policy %I on public.%I as permissive for insert to authenticated with check (%s)', v_libera, p_tabela, v_cond);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (%s)', v_trava, p_tabela, p_pode);
  elsif p_cmd = 'UPDATE' then
    execute format('create policy %I on public.%I as permissive for update to authenticated using (%s) with check (%s)', v_libera, p_tabela, v_cond, v_cond);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (%s) with check (%s)', v_trava, p_tabela, p_pode, p_pode);
  else
    execute format('create policy %I on public.%I as permissive for delete to authenticated using (%s)', v_libera, p_tabela, v_cond);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (%s)', v_trava, p_tabela, p_pode);
  end if;
  return p_tabela || ' / ' || p_cmd || ' → ' || v_libera || ' + ' || v_trava;
end;
$$;

-- Tudo num comando só: ou cria todas, ou nenhuma
with p as (select
  -- unidade da linha nas minhas unidades (Admin = todas)
  $r$((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]))$r$ as minha)
select resultado from (
  -- 307 Gravar metas (o 308 também grava "ativos_atual" nas metas, pela movimentação)
            select 1 as ordem, public.seg_tmp_par_de_regras('metas_unidades', 'INSERT', '307_metas_criar',
              $r$((select public.seg_pode('307')) or (select public.seg_pode('308')))$r$, minha) as resultado from p
  union all select 2, public.seg_tmp_par_de_regras('metas_unidades', 'UPDATE', '307_metas_editar',
              $r$((select public.seg_pode('307')) or (select public.seg_pode('308')))$r$, minha) from p
  -- 308 Movimentação do dia
  union all select 3, public.seg_tmp_par_de_regras('movimento_diario', 'INSERT', '308_movimento_criar', $r$(select public.seg_pode('308'))$r$, minha) from p
  union all select 4, public.seg_tmp_par_de_regras('movimento_diario', 'UPDATE', '308_movimento_editar', $r$(select public.seg_pode('308'))$r$, minha) from p
  -- 309 "Não tem Personal Class"
  union all select 5, public.seg_tmp_par_de_regras('unidades_sem_personal', 'INSERT', '309_sem_personal_criar', $r$(select public.seg_pode('309'))$r$, minha) from p
  union all select 6, public.seg_tmp_par_de_regras('unidades_sem_personal', 'UPDATE', '309_sem_personal_editar', $r$(select public.seg_pode('309'))$r$, minha) from p
  -- 807 Editar a equipe
  union all select 7, public.seg_tmp_par_de_regras('colaboradores', 'INSERT', '807_equipe_criar', $r$(select public.seg_pode('807'))$r$, minha) from p
  union all select 8, public.seg_tmp_par_de_regras('colaboradores', 'UPDATE', '807_equipe_editar', $r$(select public.seg_pode('807'))$r$, minha) from p
  -- 204 Editar venda (Histórico/Duplicidades) e 405 Conferir/editar no Fechamento
  union all select 9, public.seg_tmp_par_de_regras('vendas', 'UPDATE', '204_405_vendas_editar',
              $r$((select public.seg_pode('204')) or (select public.seg_pode('405')))$r$, minha) from p
  -- 206 "Não é duplicidade" (marcar e desfazer)
  union all select 10, public.seg_tmp_par_de_regras('vendas_duplicidade_legitima', 'INSERT', '206_legitima_marcar', $r$(select public.seg_pode('206'))$r$, minha) from p
  union all select 11, public.seg_tmp_par_de_regras('vendas_duplicidade_legitima', 'DELETE', '206_legitima_desfazer', $r$(select public.seg_pode('206'))$r$, minha) from p
  -- 515 Tirar do "Não contatar"
  union all select 12, public.seg_tmp_par_de_regras('crm_nao_contatar', 'UPDATE', '515_nao_contatar_tirar', $r$(select public.seg_pode('515'))$r$, minha) from p
  -- 516 Mensagens prontas (valem para a rede inteira: sem unidade)
  union all select 13, public.seg_tmp_par_de_regras('crm_mensagens_prontas', 'INSERT', '516_mensagens_criar', $r$(select public.seg_pode('516'))$r$, null) from p
  union all select 14, public.seg_tmp_par_de_regras('crm_mensagens_prontas', 'UPDATE', '516_mensagens_editar', $r$(select public.seg_pode('516'))$r$, null) from p
) x order by ordem;

drop function public.seg_tmp_par_de_regras(text, text, text, text, text);

-- 205 Excluir venda (Histórico) e 405 (Fechamento): Admin em qualquer unidade; quem tem a permissão, nas unidades dele
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
  if not (v_papel = 'ADMIN'
          or ((public.seg_pode('205') or public.seg_pode('405')) and public.seg_mesma_unidade(v_unidade))) then
    raise exception 'Sem permissão para excluir venda da unidade % (permissão 205).', v_unidade;
  end if;
  perform set_config('app.motivo_exclusao', trim(p_motivo), true);
  delete from public.vendas where id = p_venda_id;
  return format('Venda %s enviada para a lixeira.', p_venda_id);
end;
$$;

-- 514 Apagar contato do CRM
create or replace function public.crm_conferir_quem_apaga()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  -- SQL Editor do Supabase e funções internas do banco podem apagar
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return old;
  end if;
  if public.seg_papel() = 'ADMIN'
     or (public.seg_pode('514') and public.seg_ve_unidade(old.unidade)) then
    return old;
  end if;
  raise exception 'Sem permissão para apagar contatos do CRM desta unidade (permissão 514).';
end;
$function$;

-- 704 / 610 Excluir avaliação (vai para a lixeira)
create or replace function public.excluir_avaliacao(p_id text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_av public.avaliacoes_realizadas;
  v_dados jsonb;
  v_papel text := public.seg_papel();
begin
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da exclusão (pelo menos 5 letras).';
  end if;
  select * into v_av from public.avaliacoes_realizadas where id::text = p_id;
  if not found then raise exception 'Avaliação não encontrada (talvez já excluída).'; end if;
  v_dados := to_jsonb(v_av);
  if not (v_papel = 'ADMIN'
          or ((public.seg_pode('704') or public.seg_pode('610')) and public.seg_ve_unidade(v_dados ->> 'unidade'))) then
    raise exception 'Sem permissão para excluir avaliação desta unidade (permissão 704).';
  end if;
  insert into public.avaliacoes_lixeira (avaliacao_id, unidade, aluno, cpf, professor, data_avaliacao, dados, motivo, excluido_por, excluido_email)
  values (p_id, v_dados ->> 'unidade', v_dados ->> 'aluno', v_dados ->> 'cpf', v_dados ->> 'professor',
          coalesce(v_dados ->> 'data', v_dados ->> 'created_at'), v_dados, trim(p_motivo),
          public.seg_meu_nome(), auth.jwt() ->> 'email');
  delete from public.avaliacoes_realizadas where id::text = p_id;
end;
$$;

-- 705 Restaurar avaliação da lixeira
create or replace function public.restaurar_avaliacao(p_lixeira_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_l public.avaliacoes_lixeira;
  v_papel text := public.seg_papel();
begin
  select * into v_l from public.avaliacoes_lixeira where id = p_lixeira_id and restaurado_em is null;
  if not found then raise exception 'Avaliação não está na lixeira.'; end if;
  if not (v_papel = 'ADMIN' or (public.seg_pode('705') and public.seg_ve_unidade(v_l.unidade))) then
    raise exception 'Sem permissão para restaurar avaliações desta unidade (permissão 705).';
  end if;
  if exists (select 1 from public.avaliacoes_realizadas where id::text = v_l.avaliacao_id) then
    raise exception 'Já existe uma avaliação com este número.';
  end if;
  insert into public.avaliacoes_realizadas select * from jsonb_populate_record(null::public.avaliacoes_realizadas, v_l.dados);
  update public.avaliacoes_lixeira set restaurado_em = now(), restaurado_por = public.seg_meu_nome() where id = p_lixeira_id;
end;
$$;

commit;

notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO): as 28 regras novas (14 "liberar" + 14 "trava")
select tablename as tabela, policyname as regra, permissive as tipo, cmd as acao
from pg_policies
where schemaname = 'public' and policyname like 'perm\_%'
order by tablename, policyname;
