-- =====================================================================
-- LEITURA POR UNIDADE — TESTE (só leitura, não grava nada)
-- Mostra quantas vendas / avaliações / pessoas da equipe um login de RECEPÇÃO enxerga, por unidade.
--   ANTES do passo 2: aparecem TODAS as unidades (é a falha).
--   DEPOIS do passo 2: aparece SÓ a unidade daquele login.
-- Para testar outro login, troque o e-mail entre aspas na última linha.
-- =====================================================================

-- Qual login de Recepção será usado no teste (o primeiro da lista)
select email, unidade from public.usuarios_sistema where role = 'RECEPCAO' order by email limit 1;

-- O que esse login enxerga
select * from public.seg_teste_leitura((select email from public.usuarios_sistema where role = 'RECEPCAO' order by email limit 1));

-- Para testar um login específico, use:
-- select * from public.seg_teste_leitura('email-do-login@exemplo.com');
