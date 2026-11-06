-- ============================================================
-- DESFAZER as permissões (Etapa 1). O sistema volta a usar só o padrão do código
-- (exatamente como era antes de 06/11/2026). Apaga as mudanças feitas pela aba Permissões.
-- ============================================================
drop trigger if exists permissoes_papel_log on public.permissoes_papel;
drop trigger if exists permissoes_excecao_log on public.permissoes_excecao;
drop function if exists public.permissoes_registrar_log();
drop table if exists public.permissoes_papel;
drop table if exists public.permissoes_excecao;
drop table if exists public.permissoes_log;
