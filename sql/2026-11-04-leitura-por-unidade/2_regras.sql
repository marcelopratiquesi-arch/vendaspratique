-- =====================================================================
-- LEITURA POR UNIDADE — PASSO 2: TROCA AS REGRAS (rode só depois do passo 1 e da publicação do sistema)
-- Vendas, avaliações e equipe: cada um LÊ só as suas unidades
--   (Admin = todas; Mentor = as dele; Líder e Recepção = a própria).
-- Avaliações: gravar e editar também só nas suas unidades.
-- Equipe: além da unidade, cada um sempre enxerga o próprio cadastro (pelo e-mail).
-- NÃO altera nenhuma venda, avaliação ou comissão: só quem pode ler.
-- Se alguma tabela não tiver exatamente 1 regra do tipo esperado, NADA é alterado.
-- Para voltar como estava: 9_desfazer.sql
-- =====================================================================

-- Confere que a cópia do passo 1 existe (se não existir, este comando dá erro e é só rodar o passo 1)
select count(*) as regras_na_copia from public.seg_backup_policies_20261104;

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

-- Tudo num comando só: ou troca as 5 regras, ou não troca nenhuma
with p as (select
  -- funcionário logado E (Admin OU unidade da linha nas minhas unidades)
  $r$((select public.seg_papel()) is not null and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[])))$r$ as minha,
  $r$((select public.seg_papel()) is not null and ((select public.seg_eh_global()) or public.seg_normalizar(unidade) = any ((select public.seg_minhas_unidades())::text[]) or lower(trim(coalesce(email, ''))) = lower(trim(coalesce((select auth.jwt() ->> 'email'), '')))))$r$ as equipe)
select resultado from (
            select 1 as ordem, public.seg_tmp_trocar_regra('vendas', 'SELECT', minha, null) as resultado from p
  union all select 2, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'SELECT', minha, null) from p
  union all select 3, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'INSERT', null, minha) from p
  union all select 4, public.seg_tmp_trocar_regra('avaliacoes_realizadas', 'UPDATE', minha, minha) from p
  union all select 5, public.seg_tmp_trocar_regra('colaboradores', 'SELECT', equipe, null) from p
) x order by ordem;

drop function public.seg_tmp_trocar_regra(text, text, text, text);

-- Conferência: as regras novas
select tablename, cmd, policyname, qual from pg_policies
where schemaname = 'public' and tablename in ('vendas', 'avaliacoes_realizadas', 'colaboradores') and cmd in ('SELECT', 'INSERT', 'UPDATE')
order by tablename, cmd;
