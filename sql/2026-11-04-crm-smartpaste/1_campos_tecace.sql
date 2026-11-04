-- ============================================================
-- SMART PASTE DO CRM LENDO A LISTA DO TECACE COMPLETA (decisão do dono, 04/11/2026)
-- Acrescenta no contato do CRM (tabela leads) os dados que vêm na exportação do TECACE e eram descartados:
-- matrícula, e-mail, sexo e data de cadastro no TECACE (NÃO é data de nascimento).
-- Não apaga nem muda nada que já existe.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- Desfazer: alter table public.leads drop column if exists matricula, drop column if exists email,
--           drop column if exists sexo, drop column if exists data_cadastro_tecace;
-- ============================================================

alter table public.leads add column if not exists matricula text;
alter table public.leads add column if not exists email text;
alter table public.leads add column if not exists sexo text;
alter table public.leads add column if not exists data_cadastro_tecace date;

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'leads'
  and column_name in ('matricula', 'email', 'sexo', 'data_cadastro_tecace')
order by column_name;
