-- =====================================================================
-- PASSO 1 — CRIAR OS ÍNDICES (o "atalho" do fichário)
-- SÓ RODAR DEPOIS que o Claude conferir o resultado do passo 0
-- (ele pode ajustar este arquivo conforme o que já existe).
--
-- NÃO MEXE EM NENHUM DADO: não apaga, não altera, não mexe em vendas
-- nem comissão. Só cria atalhos de busca.
-- Rodar À NOITE, com pouca gente usando: enquanto cada índice é criado
-- (segundos), as gravações naquela tabela esperam.
-- Desfazer: 9_desfazer.sql
--
-- COMO FOI RODADO (26/11/2026, ~22h44, conferido: 3 de 3):
-- com o banco travado, rodar o arquivo inteiro dava "connection timeout".
-- Funcionou rodando UM comando por vez no SQL Editor, o analyze por último.
-- O passo 2 (vendas e contatos feitos) também: 4 de 4, com analyze.
-- =====================================================================

-- 1) Histórico do contato: "quais ações tem o contato X?", na ordem da data.
--    Usado pelo "Parado há X dias", reciclagem, carteira que se renova,
--    ficha do contato, Conversa e pela regra de acesso do histórico.
create index if not exists historico_leads_lead_id_data_idx
    on public.historico_leads (lead_id, data_registro);

-- 2) Histórico por data: Painel do CRM, meta do dia, "O que aconteceu".
create index if not exists historico_leads_data_registro_idx
    on public.historico_leads (data_registro);

-- 3) Contatos por unidade e fase: lista do CRM, Banco Bruto, contagens do topo.
create index if not exists leads_unidade_status_idx
    on public.leads (unidade, status);

-- Atualiza as estatísticas para o banco passar a usar os atalhos na hora
analyze public.historico_leads;
analyze public.leads;

-- Conferência: deve listar os 3 índices novos
select tablename as tabela, indexname as indice
from pg_indexes
where schemaname = 'public'
  and indexname in ('historico_leads_lead_id_data_idx', 'historico_leads_data_registro_idx', 'leads_unidade_status_idx');
