-- DESFAZER a consulta segura crm_compras_de_plano (06/11/2026).
-- Sem ela, o "Puxar do cadastro" fica travado (avisa para rodar o SQL) e o CRM não confere compras.
drop function if exists public.crm_compras_de_plano(text[], date);
notify pgrst, 'reload schema';
