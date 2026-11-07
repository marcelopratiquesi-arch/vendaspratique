-- ============================================================
-- IMPORTAÇÃO DE ALUNOS (Cadastro → Alunos → Smart Paste) — decisão do dono, 06/11/2026
-- Acrescenta no cadastro do aluno (tabela alunos) os dados da planilha que hoje são descartados:
--   status_aluno          → Status da planilha (ATIVO, FINALIZADO, INATIVO, VISITANTE...). Vale a partir de hoje.
--   status_atualizado_em  → quando esse status foi importado (para saber "desde quando").
--   data_cadastro         → "Data de Cadastro" da planilha (quando o aluno foi cadastrado na academia).
--                           NÃO é a data de nascimento.
--   sexo                  → já existe na maioria dos bancos; o "if not exists" só cria se faltar.
-- A unidade NÃO é guardada aqui: a unidade do aluno é a do nosso sistema (vínculo em alunos_unidades).
--
-- Não apaga nem muda nenhum dado que já existe (só cria campos vazios).
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- Antes: rode o 0_copia_de_seguranca.sql. Desfazer: 9_desfazer.sql.
-- ============================================================

alter table public.alunos add column if not exists status_aluno text;
alter table public.alunos add column if not exists status_atualizado_em timestamptz;
alter table public.alunos add column if not exists data_cadastro date;
alter table public.alunos add column if not exists sexo text;

-- Para o CRM puxar rápido "alunos FINALIZADOS / INATIVOS" (etapa seguinte)
create index if not exists alunos_status_aluno_idx on public.alunos (status_aluno);

notify pgrst, 'reload schema';

-- Conferência: devem aparecer as 4 linhas
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'alunos'
  and column_name in ('status_aluno', 'status_atualizado_em', 'data_cadastro', 'sexo')
order by column_name;
