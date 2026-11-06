-- DESFAZER a conferência do relatório de fechamento (só se algo der errado).
-- Apaga a tabela de conferências (as respostas dos líderes somem; os envios da recepção continuam).
drop table if exists public.relatorios_fechamento_conferencia;
delete from public.permissoes_padrao where codigo = '313';
notify pgrst, 'reload schema';
