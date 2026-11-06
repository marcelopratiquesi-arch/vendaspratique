-- =====================================================================
-- PERMISSÕES — ETAPA 2 (AÇÕES) — PASSO 3: CONFERÊNCIA (só leitura; rode depois do passo 2)
-- Parte A: o que cada login pode fazer nas ações que o banco confere (sim/não), igual à aba Permissões.
-- Parte B: totais de vendas antes × agora (regra 12). Esperado: NENHUMA linha com diferença
--          (uma venda lançada ou excluída depois do passo 0 aparece aqui e é normal: confira qual foi).
-- =====================================================================

-- Parte A: uma linha por login, uma coluna por ação
select u.nome, upper(u.role) as nivel, u.unidade,
  public.seg_pode_de(u.email, u.role, '204') as "204 editar venda",
  public.seg_pode_de(u.email, u.role, '205') as "205 excluir venda",
  public.seg_pode_de(u.email, u.role, '206') as "206 nao e duplicidade",
  public.seg_pode_de(u.email, u.role, '307') as "307 metas",
  public.seg_pode_de(u.email, u.role, '308') as "308 movimentacao",
  public.seg_pode_de(u.email, u.role, '309') as "309 sem personal",
  public.seg_pode_de(u.email, u.role, '405') as "405 fechamento",
  public.seg_pode_de(u.email, u.role, '514') as "514 apagar contato",
  public.seg_pode_de(u.email, u.role, '515') as "515 nao contatar",
  public.seg_pode_de(u.email, u.role, '516') as "516 mensagens",
  public.seg_pode_de(u.email, u.role, '704') as "704 excluir avaliacao",
  public.seg_pode_de(u.email, u.role, '705') as "705 restaurar avaliacao",
  public.seg_pode_de(u.email, u.role, '807') as "807 equipe"
from public.usuarios_sistema u
order by case upper(u.role) when 'ADMIN' then 1 when 'MENTOR' then 2 when 'LIDER' then 3 else 4 end, u.unidade, u.nome;

-- Parte B: totais por unidade e vendedor — antes (passo 0) × agora, só onde mudou
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
full join public.seg_totais_vendas_20261106 b on b.unidade = a.unidade and b.vendedor = a.vendedor
where a.impressao_digital is distinct from b.impressao_digital
order by 1, 2;

-- Parte C: resumo geral (antes × agora)
select 'vendas antes (passo 0)' as item, sum(qtd)::text as valor from public.seg_totais_vendas_20261106
union all select 'vendas agora', count(*)::text from public.vendas
union all select 'comissão antes', sum(soma_comissao)::text from public.seg_totais_vendas_20261106
union all select 'comissão agora', sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0))::text from public.vendas;
