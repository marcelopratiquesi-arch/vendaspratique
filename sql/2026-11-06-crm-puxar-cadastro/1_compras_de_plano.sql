-- ============================================================
-- CRM: COMPRAS DE PLANO NA REDE (decisão do dono, 06/11/2026)
-- Consulta segura usada pelo CRM para:
--   1) "Puxar do cadastro" (Base): deixar de fora quem comprou plano nos últimos 30 dias (em qualquer unidade);
--   2) Contato do CRM que comprou plano: na MESMA unidade vai sozinho para "Fechado";
--      em OUTRA unidade sai do CRM ("Arquivado").
-- Por quê: desde 04/11/2026 Líder/Recepção só leem as vendas da própria unidade. Esta consulta responde só
-- "este CPF comprou o plano X na unidade Y no dia Z" — SEM valor, SEM comissão, SEM vendedor.
-- Só funcionário logado. Não grava nada, não muda nenhuma tabela.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.  Desfazer: 9_desfazer.sql
-- ============================================================

create or replace function public.crm_compras_de_plano(p_cpfs text[], p_desde date)
returns table(cpf text, produto text, unidade text, dia date, lancado_em timestamptz)
language sql stable security definer set search_path = public as $$
  with cpfs as (
    select distinct regexp_replace(coalesce(c, ''), '\D', '', 'g') as cpf
    from unnest(coalesce(p_cpfs, array[]::text[])) as c
  ),
  planos_validos as (
    select upper(trim(c.nome)) as nome
    from public.catalogo c
    where lower(c.tipo) = 'plano'
      and upper(c.nome) not like '%REAVALIA%'
      and upper(c.nome) not like 'FÉRIAS%'
      and upper(c.nome) not like 'FERIAS%'
  )
  select regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g')::text,
         v.produto::text,
         upper(trim(v.unidade))::text,
         case when v.data::text ~ '^\d{4}-\d{2}-\d{2}' then left(v.data::text, 10)::date end,
         v.created_at
  from public.vendas v
  where public.seg_papel() is not null
    and regexp_replace(coalesce(v.cpf, ''), '\D', '', 'g') in (select c.cpf from cpfs c where length(c.cpf) = 11)
    and upper(trim(v.produto)) in (select pv.nome from planos_validos pv)
    -- (o "case" evita erro com data escrita fora do padrão: essa linha fica de fora)
    and (case when v.data::text ~ '^\d{4}-\d{2}-\d{2}' then left(v.data::text, 10)::date end) >= coalesce(p_desde, current_date - 30)
  order by 4 desc, 5 desc
$$;

grant execute on function public.crm_compras_de_plano(text[], date) to authenticated;

notify pgrst, 'reload schema';

-- Conferência: deve aparecer 1 linha com o nome da função
select proname from pg_proc where proname = 'crm_compras_de_plano';
