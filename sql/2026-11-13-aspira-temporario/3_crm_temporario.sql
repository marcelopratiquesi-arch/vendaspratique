-- =====================================================================
-- PASSO 3: O CRM PARA QUEM TEM ACESSO TEMPORÁRIO (13/11/2026). Rode depois do passo 2.
-- As regras das tabelas antigas do CRM (leads, historico_leads, crm_contatos_feitos, crm_migracao...) foram criadas
-- direto no SQL Editor e olham UMA unidade só. Em vez de reescrever essas regras sem ver o texto, este passo
-- ACRESCENTA regras novas (nomes começando com "temp_") que liberam ver, criar e editar contatos SÓ nas unidades
-- temporárias de quem está logado. As regras de hoje ficam intactas.
-- Sem nenhum temporário valendo, as regras novas não liberam nada para ninguém.
-- Apagar contato continua com o gatilho crm_conferir_quem_apaga (já olha a lista de unidades, permissão 514).
-- As tabelas novas do CRM (Resgate, resultados, Puxar do cadastro...) já usam a lista de unidades: não precisam.
-- Desfazer: 9_desfazer.sql (apaga só as regras "temp_").
-- =====================================================================

do $$
declare
  t      text;
  v_cond text := $c$(public.seg_normalizar(unidade) = any ((select public.acesso_unidades_temporarias())::text[]))$c$;
begin
  foreach t in array array['leads', 'crm_contatos_feitos', 'crm_migracao', 'crm_nao_contatar'] loop
    if to_regclass('public.' || t) is null then
      raise notice '% não existe: pulada', t; continue;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'unidade') then
      raise notice '% não tem a coluna unidade: pulada', t; continue;
    end if;
    execute format('drop policy if exists %I on public.%I', 'temp_' || t || '_ver', t);
    execute format('drop policy if exists %I on public.%I', 'temp_' || t || '_criar', t);
    execute format('drop policy if exists %I on public.%I', 'temp_' || t || '_editar', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', 'temp_' || t || '_ver', t, v_cond);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', 'temp_' || t || '_criar', t, v_cond);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', 'temp_' || t || '_editar', t, v_cond, v_cond);
    raise notice '%: regras temp_ criadas', t;
  end loop;

  -- Apagar contato: o gatilho decide (Admin; ou permissão 514 nas minhas unidades, que já inclui as temporárias)
  if to_regclass('public.leads') is not null then
    execute 'drop policy if exists temp_leads_apagar on public.leads';
    execute format('create policy temp_leads_apagar on public.leads for delete to authenticated using (%s)', v_cond);
  end if;

  -- Histórico dos contatos: segue o contato (lead_id)
  if to_regclass('public.historico_leads') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'historico_leads' and column_name = 'lead_id') then
    execute 'drop policy if exists temp_historico_leads_ver on public.historico_leads';
    execute 'drop policy if exists temp_historico_leads_criar on public.historico_leads';
    execute $p$create policy temp_historico_leads_ver on public.historico_leads for select to authenticated
      using (exists (select 1 from public.leads l where l.id::text = historico_leads.lead_id::text
                     and public.seg_normalizar(l.unidade) = any ((select public.acesso_unidades_temporarias())::text[])))$p$;
    execute $p$create policy temp_historico_leads_criar on public.historico_leads for insert to authenticated
      with check (exists (select 1 from public.leads l where l.id::text = historico_leads.lead_id::text
                     and public.seg_normalizar(l.unidade) = any ((select public.acesso_unidades_temporarias())::text[])))$p$;
  end if;
end $$;

-- Conferência (MANDE ESTE RESULTADO): as regras temp_ criadas
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and policyname like 'temp\_%' order by tablename, policyname;
