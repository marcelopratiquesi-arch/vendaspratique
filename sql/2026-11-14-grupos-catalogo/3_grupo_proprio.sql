-- ============================================================
-- GRUPOS DO CATÁLOGO — PASSO 3: grupo sem "como conta" (decisão do dono, 16/11/2026)
-- Um grupo novo (Férias, Piscina...) passa a ser só uma "gaveta" com nome: os itens dentro dele continuam
-- contando como sempre, e os Relatórios/mensagens mostram um bloco com o nome do grupo.
-- Para isso a coluna "conta_como" da tabela de grupos precisa aceitar ficar VAZIA.
-- NÃO mexe em vendas, comissão, itens nem nos grupos que já existem. Pode rodar mais de uma vez.
-- Para voltar, ver o fim deste arquivo.
-- ============================================================

alter table public.catalogo_grupos alter column conta_como drop not null;

-- Conferência: "conta_como" tem que aparecer com is_nullable = YES
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'catalogo_grupos' and column_name = 'conta_como';

-- PARA VOLTAR (só se nenhum grupo estiver sem "como conta"; troque-os antes na tela):
-- alter table public.catalogo_grupos alter column conta_como set not null;
