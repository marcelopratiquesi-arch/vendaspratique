-- Desfaz o campo Nutri/Tecace (só apaga a coluna nova; vendas e comissões não são tocadas).
alter table public.movimento_diario drop column if exists nutri_tecace;
