-- ============================================================
-- NUTRI / TECACE — PASSO 1: campo novo na movimentação (decisão do dono, 17/11/2026)
-- O Líder digita todo dia o TOTAL de planos Nutri do MÊS que aparece no Tecace (acumulado do mês, não soma dos dias).
-- O sistema calcula sozinho: adicional = máx(0, Tecace − vendas Nutri do sistema); Nutri total = vendas + adicional.
-- Vazio (null) = ainda não lançado. Zero é um lançamento válido.
-- Não mexe em vendas, comissão, nem nas outras colunas. As regras de acesso da tabela continuam as mesmas
-- (Líder na unidade dele, Mentor nas dele, Admin todas; quem gravou e quando = atualizado_por / atualizado_em).
-- Desfazer: 9_desfazer.sql
-- ============================================================
alter table public.movimento_diario
    add column if not exists nutri_tecace integer check (nutri_tecace is null or nutri_tecace >= 0);

-- Conferência: a coluna existe e começa vazia
select count(*) as linhas, count(nutri_tecace) as com_nutri_tecace from public.movimento_diario;
