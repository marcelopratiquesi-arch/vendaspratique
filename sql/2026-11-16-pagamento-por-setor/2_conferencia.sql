-- =====================================================================
-- PASSO 2: CONFERÊNCIA (só leitura; rode depois do passo 1). Não altera nada.
--   A) As vendas não mudaram: totais por unidade iguais aos copiados no passo 0 (tem que dar 0 linhas)
--   B) Comissão conferida POR SETOR de um mês, como o banco enxerga. Compare com a linha "Por setor" do quadro
--      "Pagamento das comissões" (Fechamento → Comissões, uma unidade + o mês). Tem que ser igual.
--      Troque o mês na linha marcada se quiser outro (está 2026-10).
--   C) Pagamentos aprovados (unidade inteira e por setor)
-- Como rodar: cole UM bloco por vez no SQL Editor (o Supabase só mostra o resultado do último comando).
-- =====================================================================

-- A) Unidades em que alguma venda mudou desde o passo 0 (esperado: NENHUMA linha, se ninguém lançou/conferiu venda no meio)
with agora as (
  select coalesce(unidade, '(sem unidade)') as unidade,
         count(*) as qtd,
         sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_comissao
    from public.vendas group by 1
)
select coalesce(a.unidade, b.unidade) as unidade, b.qtd as qtd_antes, a.qtd as qtd_agora, b.soma_comissao as comissao_antes, a.soma_comissao as comissao_agora
  from agora a full join public.seg_totais_vendas_20261116 b on b.unidade = a.unidade
 where a.qtd is distinct from b.qtd or a.soma_comissao is distinct from b.soma_comissao
 order by 1;

-- B) Comissão conferida por unidade e setor no mês
select upper(trim(v.unidade)) as unidade,
       public.equipe_setor_chave(v.vendedor, v.vendedor_cpf, v.unidade) as setor,
       count(*) as vendas_conferidas,
       sum(public.seg_numero(v.valor::text)) filter (where public.seg_numero(v.valor::text) > 0) as comissao,
       count(distinct coalesce(v.vendedor_cpf, 'nome:' || public.equipe_nome_chave(v.vendedor))) filter (where public.seg_numero(v.valor::text) > 0) as pessoas
  from public.vendas v
 where left(v.data::text, 7) = '2026-10'      -- <<< mês (AAAA-MM)
   and coalesce(v.conferiu, false) = true
 group by 1, 2
 order by 1, 2;

-- C) Pagamentos aprovados
select id, unidade, mes, coalesce(setor_nome, 'UNIDADE INTEIRA') as setor, total, qtd_vendas, aprovado_por, aprovado_em, ativo, motivo_reabertura
  from public.comissoes_pagamentos
 order by mes desc, unidade, aprovado_em;
