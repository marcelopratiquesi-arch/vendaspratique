-- Desfaz os avisos no celular (apaga só o que o passo 1 criou; nenhum dado antigo do sistema é tocado).
-- Depois de rodar, os celulares param de receber avisos e o histórico dos avisos some.
drop function if exists public.push_definir_modo(text);
drop function if exists public.push_remover_aparelhos(text[]);
drop function if exists public.push_registrar_envio(text, text, text, jsonb, text, int, int, int, int, jsonb, text);
drop function if exists public.push_destinatarios(jsonb);
drop function if exists public.push_soltar_aparelho(text);
drop function if exists public.push_registrar_aparelho(text, text, text, text);
drop table if exists public.push_avisos_enviados;
drop table if exists public.push_aparelhos;
delete from public.sistema_config where chave = 'avisos_celular';
delete from public.permissoes_padrao where codigo = '913';
notify pgrst, 'reload schema';
