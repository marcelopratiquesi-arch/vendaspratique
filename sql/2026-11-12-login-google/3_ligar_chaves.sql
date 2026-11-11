-- =====================================================================
-- PASSO 3: LIGAR AS CHAVES (um comando de cada vez, quando for a hora)
-- Rode SÓ a linha que quer. Para desligar, troque 'sim' por 'nao' (ou o contrário) e rode de novo.
-- =====================================================================

-- A) Depois de configurar o Google no Supabase (passo a passo em docs/login-google.md):
--    mostra o botão "Entrar com Google" na tela de entrada
update public.sistema_config set valor = 'sim', atualizado_em = now() where chave = 'login_google';

-- B) Depois de testar o Google com o Admin e um Líder: o banco passa a recusar Líder/Mentor/Admin parados há
--    mais de 15 minutos (a tela já faz isso sozinha; esta é a trava extra no banco)
-- update public.sistema_config set valor = 'sim', atualizado_em = now() where chave = 'sessao_banco';

-- C) VIRADA (quando o relatório de adesão na aba Pendências mostrar todos entrando pelo Google):
--    o login com senha passa a valer só para o Admin e para quem tiver a liberação de emergência de 24 h
-- update public.sistema_config set valor = 'nao', atualizado_em = now() where chave = 'login_senha_todos';

-- Como estão as chaves agora
select chave, valor, descricao, atualizado_em from public.sistema_config order by chave;
