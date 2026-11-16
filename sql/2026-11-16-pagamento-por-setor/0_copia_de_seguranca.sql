-- =====================================================================
-- PAGAMENTO DAS COMISSÕES POR SETOR (16/11/2026, decisão do dono)
-- PASSO 0: CÓPIA DE SEGURANÇA (rode primeiro). Regra 12 do CLAUDE.md.
-- Este passo SÓ COPIA. Não altera nenhuma venda, pagamento ou regra.
--   1) os pagamentos já aprovados (tabela comissoes_pagamentos inteira)
--   2) o TEXTO das funções e da trava que o passo 1 vai trocar (para o desfazer voltar exatamente ao que era)
--   3) os totais das vendas por unidade (para comparar depois no passo 2: têm que ficar IGUAIS)
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Mande o resultado da conferência do fim.
-- =====================================================================

-- 1) Pagamentos aprovados
create table if not exists public.comissoes_pagamentos_backup_20261116 as
  select * from public.comissoes_pagamentos;
alter table public.comissoes_pagamentos_backup_20261116 enable row level security;

-- 2) Texto das funções de hoje
create table if not exists public.seg_backup_pagamento_setor_20261116 as
  select p.proname as nome, pg_get_function_identity_arguments(p.oid) as argumentos, pg_get_functiondef(p.oid) as texto, now() as copiado_em
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('comissao_aprovar_pagamento', 'vendas_trava_pagamento');
alter table public.seg_backup_pagamento_setor_20261116 enable row level security;

-- 3) Totais das vendas por unidade (a "impressão digital" muda se qualquer valor, comissão ou produto mudar)
create table if not exists public.seg_totais_vendas_20261116 as
  select coalesce(unidade, '(sem unidade)') as unidade,
         count(*) as qtd,
         sum(coalesce(nullif(regexp_replace(replace(valor::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_valor,
         sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_comissao,
         md5(string_agg(id::text || '|' || coalesce(valor::text, '') || '|' || coalesce(comissao::text, '') || '|' || coalesce(produto::text, '') || '|' || coalesce(conferiu::text, ''), ',' order by id)) as impressao_digital
  from public.vendas
  group by 1;
alter table public.seg_totais_vendas_20261116 enable row level security;

-- Conferência (MANDE ESTE RESULTADO)
select 'pagamentos copiados' as item, count(*)::text as valor from public.comissoes_pagamentos_backup_20261116
union all select 'pagamentos hoje na tabela', count(*)::text from public.comissoes_pagamentos
union all select 'funções copiadas (esperado: 2)', count(*)::text from public.seg_backup_pagamento_setor_20261116
union all select 'unidades nos totais', count(*)::text from public.seg_totais_vendas_20261116
union all select 'vendas hoje na tabela', count(*)::text from public.vendas
union all select 'soma da comissão (vendas)', sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0))::text from public.vendas;
