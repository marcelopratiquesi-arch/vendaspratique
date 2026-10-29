-- =====================================================================
-- CRM · BLOCO 4 · DESFAZER (só se precisar voltar atrás)
-- Apaga os 2 campos novos. ATENÇÃO: os motivos de perda e as datas de
-- próximo contato já gravados são perdidos. O site continua funcionando
-- (ele grava sem esses campos e avisa no console).
-- =====================================================================

drop index if exists public.leads_proximo_contato_idx;
alter table public.leads drop column if exists proximo_contato;
alter table public.leads drop column if exists motivo_perda;

notify pgrst, 'reload schema';
