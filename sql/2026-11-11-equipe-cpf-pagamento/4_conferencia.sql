-- =====================================================================
-- PASSO 4: CONFERÊNCIA DEPOIS DOS PASSOS 1 A 3 (só leitura; regra 12: totais antes × agora)
-- Esperado: a Parte A volta VAZIA (nenhuma unidade/vendedor com valor, comissão ou produto diferente)
-- e a Parte B mostra os mesmos números antes e agora.
-- =====================================================================

-- Parte A: totais por unidade e vendedor — antes (passo 0) × agora, só onde mudou
with agora as (
  select coalesce(unidade, '(sem unidade)') as unidade,
         coalesce(vendedor, '(sem vendedor)') as vendedor,
         count(*) as qtd,
         sum(coalesce(nullif(regexp_replace(replace(valor::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_valor,
         sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_comissao,
         md5(string_agg(id::text || '|' || coalesce(valor::text, '') || '|' || coalesce(comissao::text, '') || '|' || coalesce(produto::text, ''), ',' order by id)) as impressao_digital
  from public.vendas
  group by 1, 2
)
select coalesce(a.unidade, b.unidade) as unidade, coalesce(a.vendedor, b.vendedor) as vendedor,
       b.qtd as qtd_antes, a.qtd as qtd_agora,
       b.soma_comissao as comissao_antes, a.soma_comissao as comissao_agora
from agora a
full join public.seg_totais_vendas_20261111 b on b.unidade = a.unidade and b.vendedor = a.vendedor
where a.impressao_digital is distinct from b.impressao_digital
order by 1, 2;

-- Parte B: resumo geral (antes × agora) e quantas vendas ganharam o CPF do vendedor
select 'vendas antes (passo 0)' as item, sum(qtd)::text as valor from public.seg_totais_vendas_20261111
union all select 'vendas agora', count(*)::text from public.vendas
union all select 'comissão antes', sum(soma_comissao)::text from public.seg_totais_vendas_20261111
union all select 'comissão agora', sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0))::text from public.vendas
union all select 'vendas com CPF do vendedor', count(*)::text from public.vendas where vendedor_cpf is not null
union all select 'vendas sem CPF do vendedor', count(*)::text from public.vendas where vendedor_cpf is null
union all select 'pagamentos aprovados (ativos)', count(*)::text from public.comissoes_pagamentos where ativo;
