-- =====================================================================
-- LEITURA POR UNIDADE — PASSO 1 (decisão do dono, 04/11/2026)
-- NÃO muda nenhuma regra de acesso ainda. Só:
--   a) guarda uma CÓPIA das regras atuais de vendas, avaliações e equipe (para o 9_desfazer.sql);
--   b) cria as 2 consultas seguras da ficha do aluno (compras e avaliações do aluno em todas as unidades);
--   c) cria a função de TESTE que mostra o que um login enxerga (para conferir antes e depois).
-- Pode rodar mais de uma vez (a cópia só é feita na primeira vez).
-- =====================================================================

-- a) Cópia das regras atuais
create table if not exists public.seg_backup_policies_20261104 as
  select now() as copiado_em, * from pg_policies
  where schemaname = 'public' and tablename in ('vendas', 'avaliacoes_realizadas', 'colaboradores');

-- b1) Compras do aluno (todas as unidades), pelo CPF. Só para funcionários logados.
create or replace function public.vendas_do_aluno(p_cpf text, p_cpf_formatado text default null)
returns setof public.vendas
language sql stable security definer set search_path = public as $$
  select v.*
  from public.vendas v
  where public.seg_papel() is not null
    and length(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')) = 11
    and v.cpf::text in (regexp_replace(p_cpf, '\D', '', 'g'), coalesce(nullif(trim(p_cpf_formatado), ''), regexp_replace(p_cpf, '\D', '', 'g')))
  order by v.data desc nulls last, v.created_at desc
$$;

-- b2) Avaliações do aluno (todas as unidades). Só para funcionários logados.
create or replace function public.avaliacoes_do_aluno(p_aluno_id text)
returns setof public.avaliacoes_realizadas
language sql stable security definer set search_path = public as $$
  select a.*
  from public.avaliacoes_realizadas a
  where public.seg_papel() is not null
    and coalesce(p_aluno_id, '') <> ''
    and a.aluno_id::text = p_aluno_id
  order by a.created_at desc
$$;

grant execute on function public.vendas_do_aluno(text, text) to authenticated;
grant execute on function public.avaliacoes_do_aluno(text) to authenticated;

-- c) TESTE: finge ser o login informado e conta quantas linhas ele enxerga por unidade.
--    Não grava nada. Usado no 3_teste.sql.
create or replace function public.seg_teste_leitura(p_email text)
returns table (tabela text, unidade text, linhas bigint)
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  return query
    select 'vendas'::text, v.unidade::text, count(*) from public.vendas v group by v.unidade
    union all
    select 'avaliacoes'::text, a.unidade::text, count(*) from public.avaliacoes_realizadas a group by a.unidade
    union all
    select 'equipe'::text, c.unidade::text, count(*) from public.colaboradores c group by c.unidade
    order by 1, 2;
  execute 'reset role';
end;
$$;

-- Conferência: regras guardadas na cópia (deve listar as regras das 3 tabelas)
select tablename, cmd, policyname from public.seg_backup_policies_20261104 order by tablename, cmd;
