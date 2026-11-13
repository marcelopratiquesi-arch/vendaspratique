-- =====================================================================
-- PASSO 5: TIRAR AS REGRAS "temp_" DO CRM (13/11/2026). Rode depois do passo 3.
-- O levantamento do passo 0 mostrou que as regras antigas do CRM (leads, historico_leads, crm_contatos_feitos,
-- crm_migracao, crm_nao_contatar) JÁ usam a lista de unidades da pessoa (seg_minhas_unidades), e o passo 2
-- colocou as unidades temporárias nessa lista. Então as regras "temp_" do passo 3 não fazem falta: este passo
-- só as apaga (deixa o CRM mais leve). Nenhuma regra de antes é tocada.
-- =====================================================================

do $$ declare r record; begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'temp\_%' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Conferência (MANDE ESTE RESULTADO): esperado 0 regras temp_ e as regras antigas do CRM continuam (esperado 23)
select 'regras temp_ que sobraram (esperado 0)' as item, count(*)::text as valor from pg_policies where schemaname = 'public' and policyname like 'temp\_%'
union all select 'regras antigas do CRM (esperado 23)', count(*)::text from pg_policies
  where schemaname = 'public' and tablename in ('leads', 'historico_leads', 'crm_contatos_feitos', 'crm_migracao', 'crm_nao_contatar', 'crm_mensagens_prontas');
