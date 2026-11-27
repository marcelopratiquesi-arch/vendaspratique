-- =====================================================================
-- PASSO 2 — ATALHOS EM VENDAS E NOS CONTATOS FEITOS DO CRM (26/11/2026)
-- NÃO MEXE EM NENHUM DADO: nenhuma venda, valor ou comissão muda (regra 12).
-- Só cria atalhos de busca. Rodar UM comando por vez no SQL Editor.
-- Desfazer: no fim do arquivo.
-- =====================================================================

-- Vendas: o App abre "vendas dos últimos 90 dias" pela data de lançamento
create index if not exists vendas_created_at_idx on public.vendas (created_at);

-- Vendas: Dashboard, Histórico, Fechamento, Metas filtram por unidade + data da venda
create index if not exists vendas_unidade_data_idx on public.vendas (unidade, data);

-- Contatos feitos do CRM: "quem foi contatado hoje / no período" (Painel, meta do dia, relatórios)
create index if not exists crm_contatos_feitos_criado_em_idx on public.crm_contatos_feitos (criado_em);

-- Contatos feitos do CRM: ficha da recepcionista (por pessoa + período)
create index if not exists crm_contatos_feitos_consultor_idx on public.crm_contatos_feitos (consultor, criado_em);

analyze public.vendas;
analyze public.crm_contatos_feitos;

-- Conferência: deve listar 4 linhas
select indexname from pg_indexes
where schemaname = 'public'
  and indexname in ('vendas_created_at_idx', 'vendas_unidade_data_idx', 'crm_contatos_feitos_criado_em_idx', 'crm_contatos_feitos_consultor_idx');

-- DESFAZER (só se precisar):
-- drop index if exists public.vendas_created_at_idx;
-- drop index if exists public.vendas_unidade_data_idx;
-- drop index if exists public.crm_contatos_feitos_criado_em_idx;
-- drop index if exists public.crm_contatos_feitos_consultor_idx;
