-- Desfaz o passo 1 da Gestão à Vista. (A cópia colaboradores_backup_20261118 continua guardada.)
drop table if exists public.meta_produtos_pessoa;
alter table public.colaboradores drop column if exists data_inicio;
