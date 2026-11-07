-- ============================================================
-- CRM: ABA RESGATE + RESULTADO DO CONTATO — passo 1 (decisão do dono, 07/11/2026)
-- 1) crm_resgate: fila de trabalho dos alunos FINALIZADOS / INATIVOS (igual à crm_migracao).
-- 2) crm_puxar_resgate: puxa alunos livres para a fila da recepcionista (nunca tira da fila de outra).
-- 3) crm_resultados_contato: cada "Como foi o contato?" marcado (Migração e Resgate), para o relatório
--    "Resultado por recepcionista" (responderam, não responderam, interessados, não querem).
-- 4) crm_contatos_feitos passa a aceitar o tipo RESGATE e o meio LIGACAO.
-- Não apaga nem muda nenhum dado. Antes: 0_copia_de_seguranca.sql. Desfazer: 9_desfazer.sql.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================

-- 1) Fila do Resgate ------------------------------------------------------------
create table if not exists public.crm_resgate (
  aluno_id      uuid primary key,
  unidade       text not null,
  status        text not null default 'NA_FILA'
                check (status in ('NA_FILA', 'CONTATADO', 'INTERESSADO', 'NAO_QUER', 'SEM_RESPOSTA')),
  puxado_por    text,
  puxado_em     timestamptz,
  volta_em      date,
  tentativas    integer not null default 0,
  resultado     text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
create index if not exists crm_resgate_unidade_idx on public.crm_resgate (unidade);

alter table public.crm_resgate enable row level security;

drop policy if exists crm_resgate_ver on public.crm_resgate;
create policy crm_resgate_ver on public.crm_resgate for select to authenticated
  using ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

drop policy if exists crm_resgate_criar on public.crm_resgate;
create policy crm_resgate_criar on public.crm_resgate for insert to authenticated
  with check ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

drop policy if exists crm_resgate_editar on public.crm_resgate;
create policy crm_resgate_editar on public.crm_resgate for update to authenticated
  using ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade))
  with check ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

-- 2) Puxar para a fila (mesma regra da Migração) ---------------------------------
create or replace function public.crm_puxar_resgate(p_unidade text, p_aluno_ids uuid[], p_operador text)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_destino  text := upper(trim(coalesce(p_unidade, '')));
  v_meu_nome text;
  v_dono     text;
begin
  if public.seg_papel() is null then
    raise exception 'Acesso negado: somente funcionários.';
  end if;
  if v_destino = '' or v_destino = 'TODAS' then
    raise exception 'Unidade de destino inválida.';
  end if;
  if not public.seg_ve_unidade(v_destino) then
    raise exception 'Você só pode puxar alunos das suas unidades.';
  end if;

  select trim(us.nome) into v_meu_nome
  from public.usuarios_sistema us
  where us.email = (auth.jwt() ->> 'email')
  limit 1;

  select c.nome into v_dono
  from public.colaboradores c
  where upper(trim(c.nome)) = upper(trim(coalesce(p_operador, '')))
    and upper(trim(c.unidade)) = v_destino
    and coalesce(c.ativo, true)
    and upper(coalesce(to_jsonb(c) ->> 'role', to_jsonb(c) ->> 'setor', to_jsonb(c) ->> 'cargo', '')) like '%RECEP%'
  limit 1;
  if v_dono is null then
    raise exception 'A fila só pode ser de uma recepcionista ativa da unidade %.', v_destino;
  end if;

  return query
  insert into public.crm_resgate as r (aluno_id, unidade, status, puxado_por, puxado_em, atualizado_em, atualizado_por)
  select x.id, v_destino, 'NA_FILA', v_dono, now(), now(), coalesce(v_meu_nome, v_dono)
  from unnest(p_aluno_ids) as x(id)
  on conflict (aluno_id) do update
     set status = 'NA_FILA', unidade = excluded.unidade,
         puxado_por = excluded.puxado_por, puxado_em = excluded.puxado_em,
         atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por,
         volta_em = null, tentativas = 0, resultado = null
   where r.status = 'NA_FILA'
     and (r.puxado_por is null
          or r.puxado_em is null
          or r.puxado_em < now() - interval '7 days'
          or exists (select 1 from public.colaboradores c
                     where upper(trim(c.nome)) = upper(trim(r.puxado_por)) and c.ativo = false))
  returning r.aluno_id;
end;
$$;
revoke execute on function public.crm_puxar_resgate(text, uuid[], text) from public, anon;
grant execute on function public.crm_puxar_resgate(text, uuid[], text) to authenticated;

-- 3) Resultado de cada contato (Migração e Resgate) ------------------------------
create table if not exists public.crm_resultados_contato (
  id         bigserial primary key,
  criado_em  timestamptz not null default now(),
  unidade    text not null,
  consultor  text not null,
  origem     text not null check (origem in ('MIGRACAO', 'RESGATE')),
  aluno_id   uuid,
  resultado  text not null check (resultado in ('PENSANDO', 'SEM_RESPOSTA', 'INTERESSADO', 'NAO_QUER'))
);
create index if not exists crm_resultados_contato_data_idx on public.crm_resultados_contato (criado_em);

alter table public.crm_resultados_contato enable row level security;

drop policy if exists crm_resultados_ver on public.crm_resultados_contato;
create policy crm_resultados_ver on public.crm_resultados_contato for select to authenticated
  using ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

drop policy if exists crm_resultados_criar on public.crm_resultados_contato;
create policy crm_resultados_criar on public.crm_resultados_contato for insert to authenticated
  with check ((select public.seg_papel()) is not null and public.seg_ve_unidade(unidade));

-- 4) Contatos feitos: aceitar RESGATE (tipo) e LIGACAO (meio) ----------------------
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.crm_contatos_feitos'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%tipo%' or pg_get_constraintdef(oid) ilike '%canal%')
  loop
    execute format('alter table public.crm_contatos_feitos drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.crm_contatos_feitos add constraint crm_contatos_feitos_tipo_valido
  check (tipo in ('VISITANTE_24H', 'VISITANTE_48H', 'ANIVERSARIO', 'MIGRACAO', 'CANCELADO', 'INATIVO', 'RESGATE')) not valid;
alter table public.crm_contatos_feitos add constraint crm_contatos_feitos_canal_valido
  check (canal in ('WHATSAPP', 'MANUAL', 'LIGACAO')) not valid;

notify pgrst, 'reload schema';

-- Conferência: tabelas e função novas (3 linhas) e as travas novas (2 linhas)
select 'tabela' as tipo, tablename::text as nome from pg_tables where schemaname = 'public' and tablename in ('crm_resgate', 'crm_resultados_contato')
union all
select 'funcao', proname::text from pg_proc where proname = 'crm_puxar_resgate';
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.crm_contatos_feitos'::regclass and contype = 'c';
