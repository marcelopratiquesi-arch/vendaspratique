-- GESTÃO À VISTA — PASSO 0: cópia de segurança da Equipe (decisão do dono, 18/11/2026)
-- Só guarda uma cópia da tabela colaboradores. Não muda nada. Pode rodar mais de uma vez.
create table if not exists public.colaboradores_backup_20261118 as select * from public.colaboradores;
select (select count(*) from public.colaboradores) as equipe_agora, (select count(*) from public.colaboradores_backup_20261118) as na_copia;
