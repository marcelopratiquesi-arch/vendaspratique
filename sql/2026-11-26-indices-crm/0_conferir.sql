-- =====================================================================
-- PASSO 0 — CONFERÊNCIA (SÓ LEITURA, NÃO MUDA NADA)
-- 26/11/2026: o banco esgotou a cota de disco (Disk IO Budget).
-- Suspeita: falta índice no histórico do CRM (historico_leads foi lido
-- inteiro 147 mil vezes; leads, 268 mil vezes).
-- Rode tudo de uma vez e mande o print do resultado.
-- =====================================================================

-- Uma tabela só com tudo: índices que já existem, regras de acesso e tipos das colunas
select 'INDICE' as o_que, tablename as tabela, indexname as nome, indexdef as detalhe
from pg_indexes
where schemaname = 'public' and tablename in ('historico_leads', 'leads')

union all

select 'REGRA', tablename, policyname,
       cmd || ' | usando: ' || coalesce(qual, '-') || ' | conferindo: ' || coalesce(with_check, '-')
from pg_policies
where schemaname = 'public' and tablename in ('historico_leads', 'leads')

union all

select 'COLUNA', table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'historico_leads' and column_name in ('id', 'lead_id', 'data_registro', 'tipo_acao'))
    or (table_name = 'leads' and column_name in ('id', 'unidade', 'status')))

union all

select 'TAMANHO', relname, pg_size_pretty(pg_total_relation_size(relid)), n_live_tup::text || ' linhas'
from pg_stat_user_tables
where relname in ('historico_leads', 'leads')

order by 1, 2, 3;
