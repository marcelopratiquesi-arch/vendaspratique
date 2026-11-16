-- =====================================================================
-- DESFAZER (só em emergência). Volta o pagamento das comissões a como era antes do passo 1 (só unidade inteira).
-- Valores e comissões das vendas NÃO foram mudados por estes passos: não há o que restaurar nelas.
--
-- ⚠️ ANTES: se já existir pagamento aprovado POR SETOR (ativo), ele precisa ser reaberto pelo Admin na tela
--    (Fechamento → Comissões → Reabrir), porque o modelo antigo só aceita uma aprovação por unidade e mês.
--    O bloco 1 mostra quais são. Só siga para o bloco 2 quando o bloco 1 não devolver nenhuma linha.
-- Cole UM bloco por vez no SQL Editor.
-- =====================================================================

-- BLOCO 1) Pagamentos por setor ainda ativos (esperado antes de desfazer: NENHUMA linha)
select id, unidade, mes, setor_nome, total, aprovado_por, aprovado_em
  from public.comissoes_pagamentos
 where ativo and setor is not null
 order by mes desc, unidade;

-- BLOCO 2) Volta as funções e a trava ao texto guardado no passo 0 (seg_backup_pagamento_setor_20261116)
do $$
declare
  r record;
begin
  if exists (select 1 from public.comissoes_pagamentos where ativo and setor is not null) then
    raise exception 'Ainda há pagamento por setor ativo. Reabra pela tela antes de desfazer (veja o bloco 1).';
  end if;
  if (select count(*) from public.seg_backup_pagamento_setor_20261116) < 2 then
    raise exception 'A cópia do passo 0 não tem as duas funções. Não desfiz nada.';
  end if;
  for r in select texto from public.seg_backup_pagamento_setor_20261116 loop
    execute r.texto;
  end loop;
  drop function if exists public.comissao_aprovar_pagamento_setor(text, text, text, text, numeric, integer);
  drop function if exists public.equipe_setor_chave(text, text, text);
  drop index if exists public.comissoes_pagamentos_um_ativo_setor;
  create unique index if not exists comissoes_pagamentos_um_ativo
    on public.comissoes_pagamentos (upper(trim(unidade)), mes) where ativo;
end;
$$;
-- Os campos "setor" e "setor_nome" ficam na tabela (guardam o histórico dos pagamentos por setor já reabertos).

-- BLOCO 3) Conferência
select 'função aprovar setor (esperado: false)' as item, exists (select 1 from pg_proc where proname = 'comissao_aprovar_pagamento_setor')::text as valor
union all select 'trava antiga de volta (esperado: true)', exists (select 1 from pg_proc where proname = 'vendas_trava_pagamento' and pg_get_functiondef(oid) not like '%equipe_setor_chave%')::text
union all select 'uma aprovação por unidade e mês (esperado: true)', (to_regclass('public.comissoes_pagamentos_um_ativo') is not null)::text;
