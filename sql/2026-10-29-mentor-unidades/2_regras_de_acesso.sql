-- =====================================================================
-- MENTOR ↔ UNIDADES — PASSO 2: REGRAS DE ACESSO DAS TABELAS (rode logo depois do passo 1)
-- Troca "Admin ou Mentor vê tudo" por "Admin vê tudo; os outros só as minhas unidades".
-- Líder e Recepção continuam exatamente como hoje (a lista deles é a própria unidade).
-- Leitura de vendas, avaliações, equipe e unidades: fecha só para o Mentor (Líder/Recepção como hoje).
-- Se alguma tabela não tiver exatamente 1 regra do tipo esperado, NADA é alterado (tudo volta).
-- =====================================================================
begin;

-- Ajudante temporário: acha a regra pela tabela + tipo e troca o texto dela
create or replace function public.seg_tmp_trocar_regra(p_tabela text, p_cmd text, p_using text, p_check text)
returns text language plpgsql as $$
declare
  v_nome text;
  v_qtd  integer;
begin
  select count(*), min(policyname) into v_qtd, v_nome
  from pg_policies where schemaname = 'public' and tablename = p_tabela and cmd = p_cmd;
  if v_qtd <> 1 then
    raise exception 'A tabela % tem % regras do tipo % (esperado 1). Nada foi alterado.', p_tabela, v_qtd, p_cmd;
  end if;
  if p_using is not null and p_check is not null then
    execute format('alter policy %I on public.%I using (%s) with check (%s)', v_nome, p_tabela, p_using, p_check);
  elsif p_using is not null then
    execute format('alter policy %I on public.%I using (%s)', v_nome, p_tabela, p_using);
  else
    execute format('alter policy %I on public.%I with check (%s)', v_nome, p_tabela, p_check);
  end if;
  return p_tabela || ' / ' || p_cmd || ' (' || v_nome || ')';
end;
$$;

-- Pedaços de regra (o banco calcula a lista UMA vez por consulta, por causa do "(select ...)")
--   minha   = a unidade da linha está nas minhas unidades
--   global  = Admin
--   le      = funcionário; se for Mentor, só as unidades dele
--   gestor  = Admin, ou Líder/Mentor nas unidades dele
create temporary table seg_tmp_pedacos on commit drop as select
  $p$public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades()))$p$ as minha,
  $p$(select public.seg_eh_global())$p$ as global,
  $p$(select public.crm_eh_global())$p$ as crm_global,
  $p$(select public.seg_papel())$p$ as papel;

select resultado from (
  select 1 as ordem, public.seg_tmp_trocar_regra('vendas', 'SELECT',
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha), null) as resultado from seg_tmp_pedacos
  union all select 2, public.seg_tmp_trocar_regra('vendas', 'INSERT', null,
           format('(%s or %s)', global, minha)) from seg_tmp_pedacos
  union all select 3, public.seg_tmp_trocar_regra('vendas', 'UPDATE',
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha),
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha)) from seg_tmp_pedacos

  union all select 10, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'SELECT',
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha), null) from seg_tmp_pedacos
  union all select 11, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'INSERT', null,
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha)) from seg_tmp_pedacos
  union all select 12, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'UPDATE',
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha),
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha)) from seg_tmp_pedacos
  union all select 13, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'DELETE',
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha), null) from seg_tmp_pedacos

  union all select 20, public.seg_tmp_trocar_regra('colaboradores', 'SELECT',
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or %2$s))', papel, minha), null) from seg_tmp_pedacos
  union all select 21, public.seg_tmp_trocar_regra('colaboradores', 'INSERT', null,
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha)) from seg_tmp_pedacos
  union all select 22, public.seg_tmp_trocar_regra('colaboradores', 'UPDATE',
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha),
           format('(%s or (%s in (''LIDER'', ''MENTOR'') and %s))', global, papel, minha)) from seg_tmp_pedacos

  union all select 30, public.seg_tmp_trocar_regra('unidades', 'SELECT',
           format('(%1$s is not null and (%1$s <> ''MENTOR'' or public.seg_normalizar(nome) = any ((select public.seg_minhas_unidades()))))', papel), null) from seg_tmp_pedacos

  union all select 40, public.seg_tmp_trocar_regra('alunos', 'SELECT',
           format('((not exists (select 1 from public.alunos_unidades au where au.aluno_id = alunos.id)) or exists (select 1 from public.alunos_unidades au where au.aluno_id = alunos.id and (%s or public.seg_normalizar(au.unidade) = any ((select public.seg_minhas_unidades())))))', global), null) from seg_tmp_pedacos
  union all select 41, public.seg_tmp_trocar_regra('alunos_unidades', 'SELECT',
           format('(%s or %s)', global, minha), null) from seg_tmp_pedacos
  union all select 42, public.seg_tmp_trocar_regra('alunos_unidades', 'INSERT', null,
           format('(%s or %s)', global, minha)) from seg_tmp_pedacos
  union all select 43, public.seg_tmp_trocar_regra('alunos_unidades', 'UPDATE',
           format('(%s or %s)', global, minha), format('(%s or %s)', global, minha)) from seg_tmp_pedacos

  union all select 50, public.seg_tmp_trocar_regra('leads', 'SELECT', format('(%s or %s)', crm_global, minha), null) from seg_tmp_pedacos
  union all select 51, public.seg_tmp_trocar_regra('leads', 'INSERT', null, format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos
  union all select 52, public.seg_tmp_trocar_regra('leads', 'UPDATE',
           format('(%s or %s)', crm_global, minha), format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos
  union all select 53, public.seg_tmp_trocar_regra('leads', 'DELETE', format('(%s or %s)', crm_global, minha), null) from seg_tmp_pedacos

  union all select 60, public.seg_tmp_trocar_regra('crm_contatos_feitos', 'SELECT', format('(%s or %s)', crm_global, minha), null) from seg_tmp_pedacos
  union all select 61, public.seg_tmp_trocar_regra('crm_contatos_feitos', 'INSERT', null, format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos
  union all select 62, public.seg_tmp_trocar_regra('crm_migracao', 'SELECT', format('(%s or %s)', crm_global, minha), null) from seg_tmp_pedacos
  union all select 63, public.seg_tmp_trocar_regra('crm_migracao', 'INSERT', null, format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos
  union all select 64, public.seg_tmp_trocar_regra('crm_migracao', 'UPDATE',
           format('(%s or %s)', crm_global, minha), format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos
  union all select 65, public.seg_tmp_trocar_regra('crm_nao_contatar', 'INSERT', null, format('(%s or %s)', crm_global, minha)) from seg_tmp_pedacos

  union all select 70, public.seg_tmp_trocar_regra('vendas_auditoria', 'SELECT',
           format('(%1$s = ''ADMIN'' or (%1$s = ''MENTOR'' and %2$s))', papel, minha), null) from seg_tmp_pedacos
  union all select 71, public.seg_tmp_trocar_regra('vendas_duplicidade_legitima', 'INSERT', null,
           format('(%1$s = ''ADMIN'' or (%1$s in (''LIDER'', ''MENTOR'') and %2$s))', papel, minha)) from seg_tmp_pedacos
  union all select 72, public.seg_tmp_trocar_regra('vendas_duplicidade_legitima', 'DELETE',
           format('(%1$s = ''ADMIN'' or (%1$s in (''LIDER'', ''MENTOR'') and %2$s))', papel, minha), null) from seg_tmp_pedacos
) x order by ordem;

drop function public.seg_tmp_trocar_regra(text, text, text, text);

commit;
