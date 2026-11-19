-- Desfaz o histórico de backups (apaga só a tabela nova e a permissão 912 do padrão; nenhum dado do sistema é tocado).
-- Os arquivos de backup já baixados continuam no computador / Google Drive.
drop table if exists public.backups_log;
delete from public.permissoes_padrao where codigo = '912';
