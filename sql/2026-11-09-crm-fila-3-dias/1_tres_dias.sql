-- =====================================================================
-- PASSO 1: troca "7 days" por "3 days" nas duas funções de puxar (Migração e Resgate).
-- Usa o texto que JÁ ESTÁ no banco (não reescreve a função), então nada mais muda.
-- Se alguma função não tiver o "7 days", para com erro e não muda nada.
-- =====================================================================
do $$
declare
  r record;
  qtd int := 0;
begin
  for r in
    select p.proname as funcao, pg_get_functiondef(p.oid) as definicao
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('crm_puxar_migracao', 'crm_puxar_resgate')
  loop
    if position('interval ''7 days''' in r.definicao) = 0 then
      raise exception 'A função % não tem o prazo de 7 dias. Nada foi mudado.', r.funcao;
    end if;
    execute replace(r.definicao, 'interval ''7 days''', 'interval ''3 days''');
    qtd := qtd + 1;
  end loop;
  if qtd <> 2 then
    raise exception 'Esperava 2 funções, achei %. Nada foi mudado.', qtd;
  end if;
end $$;

-- Conferência: as duas devem aparecer com tem_3_dias = true
select p.proname as funcao,
       position('interval ''3 days''' in pg_get_functiondef(p.oid)) > 0 as tem_3_dias
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('crm_puxar_migracao', 'crm_puxar_resgate');
