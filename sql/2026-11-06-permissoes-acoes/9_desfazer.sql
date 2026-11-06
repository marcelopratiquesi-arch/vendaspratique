-- =====================================================================
-- PERMISSÕES — ETAPA 2 (AÇÕES) — DESFAZER (só use se algo der errado)
-- 1) Apaga as regras novas "perm_..." (as regras antigas nunca foram mexidas, continuam lá).
-- 2) Volta as 4 funções para o texto guardado no passo 0.
-- 3) Apaga seg_pode / seg_pode_de / permissoes_padrao → as telas voltam a usar só o padrão nas ações.
-- As cópias (seg_backup_..._20261106, vendas_backup_20261106) continuam guardadas.
-- =====================================================================
begin;

do $$
declare r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' and policyname like 'perm\_%' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in select funcao, definicao from public.seg_backup_funcoes_20261106 loop
    execute r.definicao;
  end loop;
end $$;

drop function if exists public.seg_pode(text);
drop function if exists public.seg_pode_de(text, text, text);
drop table if exists public.permissoes_padrao;

commit;

notify pgrst, 'reload schema';

select 'regras perm_ que sobraram (esperado 0)' as item, count(*)::text as valor
from pg_policies where schemaname = 'public' and policyname like 'perm\_%';
