-- Desfaz 1_lixeira.sql: recria as regras de APAGAR da avaliacoes_realizadas pela cópia e tira as funções.
-- A tabela avaliacoes_lixeira NÃO é apagada (guarda as avaliações excluídas). Para restaurar todas antes:
--   select public.restaurar_avaliacao(id) from public.avaliacoes_lixeira where restaurado_em is null;
do $$
declare p record;
begin
  for p in select * from public.aval_backup_policies_20261104 loop
    execute format('create policy %I on public.avaliacoes_realizadas as %s for delete to %s using (%s)',
      p.policyname, p.permissive, array_to_string(p.roles, ', '), p.qual);
  end loop;
end $$;
drop function if exists public.avaliacoes_lixeira_listar(timestamptz, timestamptz, text);
drop function if exists public.restaurar_avaliacao(bigint);
drop function if exists public.excluir_avaliacao(text, text);
