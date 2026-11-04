-- Desfaz 1_desativar_e_trava.sql (as unidades e os dados delas não são apagados)
drop trigger if exists unidades_trava_apagar on public.unidades;
drop function if exists public.unidade_conferir_antes_de_apagar();
drop function if exists public.unidade_definir_ativa(text, boolean);
drop function if exists public.unidade_uso(text);
-- Atenção: tirar o campo faz as unidades desativadas voltarem a aparecer em tudo
alter table public.unidades drop column if exists ativa;
