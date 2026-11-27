-- =====================================================================
-- DESFAZER o passo 1: apaga só os 3 atalhos criados. Nenhum dado muda.
-- =====================================================================
drop index if exists public.historico_leads_lead_id_data_idx;
drop index if exists public.historico_leads_data_registro_idx;
drop index if exists public.leads_unidade_status_idx;
