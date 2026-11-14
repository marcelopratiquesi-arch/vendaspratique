-- ============================================================
-- GRUPOS DO CATÁLOGO — PASSO 2: "Plano à parte" (decisão do dono, 14/11/2026)
-- Deixa o banco aceitar duas opções novas em "como conta":
--   A_PARTE       = plano que aparece com o NOME DO GRUPO nos Relatórios/mensagens e CONTA como plano vendido
--   A_PARTE_FORA  = plano que aparece com o NOME DO GRUPO e NÃO conta como plano vendido
-- Só troca a lista de opções permitidas. NÃO mexe em vendas, comissão, itens nem grupos que já existem.
-- Pode rodar mais de uma vez. Para voltar, ver o fim deste arquivo.
-- ============================================================

-- Tira a regra antiga de opções (qualquer que seja o nome que o banco deu a ela)
do $$
declare r record;
begin
    for r in select conname from pg_constraint
             where conrelid = 'public.catalogo_grupos'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) ilike '%conta_como%'
    loop
        execute format('alter table public.catalogo_grupos drop constraint %I', r.conname);
    end loop;
end $$;

alter table public.catalogo_grupos add constraint catalogo_grupos_conta_como_check check (conta_como in (
    'PLUS', 'PLUS_NUTRI', 'FIT', 'FIT_NUTRI', 'PERSONAL', 'PERSONAL_NUTRI', 'OUTROS',
    'A_PARTE', 'A_PARTE_FORA',
    'NUTRI', 'PRODUTO', 'DOSE_UNICA', 'SERVICO'));

-- Conferência: tem que aparecer a regra com A_PARTE e A_PARTE_FORA
select conname as regra, pg_get_constraintdef(oid) as opcoes
from pg_constraint
where conrelid = 'public.catalogo_grupos'::regclass and contype = 'c';

-- PARA VOLTAR (só se nenhum grupo estiver como "Plano à parte"; troque-os antes na tela):
-- alter table public.catalogo_grupos drop constraint if exists catalogo_grupos_conta_como_check;
-- alter table public.catalogo_grupos add constraint catalogo_grupos_conta_como_check check (conta_como in (
--     'PLUS', 'PLUS_NUTRI', 'FIT', 'FIT_NUTRI', 'PERSONAL', 'PERSONAL_NUTRI', 'OUTROS',
--     'NUTRI', 'PRODUTO', 'DOSE_UNICA', 'SERVICO'));
