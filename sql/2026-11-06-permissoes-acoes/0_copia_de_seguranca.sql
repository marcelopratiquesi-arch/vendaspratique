-- =====================================================================
-- PERMISSÕES — ETAPA 2 (AÇÕES) — PASSO 0: CÓPIA DE SEGURANÇA (rode primeiro)
-- Regra 12 do CLAUDE.md: antes de mexer em qualquer coisa ligada a vendas, cópia + totais.
-- Este passo SÓ COPIA. Não altera nenhuma venda, regra ou função.
--   1) as regras de acesso atuais das tabelas que a Etapa 2 vai tocar
--   2) o texto atual das 4 funções que a Etapa 2 vai trocar
--   3) a tabela de vendas inteira
--   4) os totais por unidade e por vendedor (para comparar depois no passo 3)
-- As cópias ficam protegidas (ninguém lê pelo site; só o SQL Editor).
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- =====================================================================

-- 1) Regras de acesso de hoje
create table if not exists public.seg_backup_policies_20261106 as
  select now() as copiado_em, p.*
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('metas_unidades', 'movimento_diario', 'unidades_sem_personal', 'colaboradores', 'vendas',
                        'vendas_duplicidade_legitima', 'crm_nao_contatar', 'crm_mensagens_prontas', 'leads',
                        'avaliacoes_realizadas');
alter table public.seg_backup_policies_20261106 enable row level security;

-- 2) Funções de hoje (excluir venda, apagar contato do CRM, excluir e restaurar avaliação)
create table if not exists public.seg_backup_funcoes_20261106 as
  select now() as copiado_em, p.proname as funcao, pg_get_functiondef(p.oid) as definicao
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('excluir_venda', 'crm_conferir_quem_apaga', 'excluir_avaliacao', 'restaurar_avaliacao');
alter table public.seg_backup_funcoes_20261106 enable row level security;

-- 3) Vendas inteiras
create table if not exists public.vendas_backup_20261106 as
  select * from public.vendas;
alter table public.vendas_backup_20261106 enable row level security;

-- 4) Totais por unidade e vendedor (comissão)
create table if not exists public.seg_totais_vendas_20261106 as
  select coalesce(unidade, '(sem unidade)') as unidade,
         coalesce(vendedor, '(sem vendedor)') as vendedor,
         count(*) as qtd,
         sum(coalesce(nullif(regexp_replace(replace(valor::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_valor,
         sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0)) as soma_comissao,
         md5(string_agg(id::text || '|' || coalesce(valor::text, '') || '|' || coalesce(comissao::text, '') || '|' || coalesce(produto::text, ''), ',' order by id)) as impressao_digital
  from public.vendas
  group by 1, 2;
alter table public.seg_totais_vendas_20261106 enable row level security;

-- Conferência (MANDE ESTE RESULTADO): quanto foi copiado
select 'regras de acesso copiadas' as item, count(*)::text as valor from public.seg_backup_policies_20261106
union all select 'funções copiadas (esperado 4)', count(*)::text from public.seg_backup_funcoes_20261106
union all select 'vendas copiadas', count(*)::text from public.vendas_backup_20261106
union all select 'vendas hoje na tabela', count(*)::text from public.vendas
union all select 'soma da comissão (vendas)', sum(coalesce(nullif(regexp_replace(replace(comissao::text, ',', '.'), '[^0-9.-]', '', 'g'), '')::numeric, 0))::text from public.vendas;
