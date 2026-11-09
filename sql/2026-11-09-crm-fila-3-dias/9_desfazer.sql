-- =====================================================================
-- DESFAZER: volta o prazo para 7 dias (texto guardado no passo 0).
-- =====================================================================
do $$
declare
  r record;
begin
  for r in select funcao, definicao from public.seg_backup_crm_puxar_20261109 loop
    execute r.definicao;
  end loop;
end $$;

select p.proname as funcao,
       position('interval ''7 days''' in pg_get_functiondef(p.oid)) > 0 as voltou_7_dias
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('crm_puxar_migracao', 'crm_puxar_resgate');
