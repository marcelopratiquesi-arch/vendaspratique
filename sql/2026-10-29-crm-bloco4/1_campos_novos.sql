-- =====================================================================
-- CRM · BLOCO 4 (29/10/2026): motivo da perda e próximo contato
-- Rodar no Supabase → SQL Editor. Pode rodar em qualquer horário:
-- só cria 2 campos vazios na tabela de contatos (leads), não muda nenhuma linha
-- e não mexe em vendas nem em comissões.
-- =====================================================================

-- 1) Motivo da perda (preenchido quando o contato vai para "Perdido")
alter table public.leads add column if not exists motivo_perda text;

-- 2) Data do próximo contato (aba "Hoje" do CRM)
alter table public.leads add column if not exists proximo_contato date;

-- 3) Índice para a busca do "próximo contato" ficar rápida (só nas linhas com data)
create index if not exists leads_proximo_contato_idx
    on public.leads (proximo_contato)
    where proximo_contato is not null;

-- 4) Avisa a API do Supabase que a tabela mudou (sem isso, o site demora a enxergar os campos novos)
notify pgrst, 'reload schema';

-- 5) Conferência: deve mostrar as 2 linhas (motivo_perda | text e proximo_contato | date)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'leads'
  and column_name in ('motivo_perda', 'proximo_contato')
order by column_name;
