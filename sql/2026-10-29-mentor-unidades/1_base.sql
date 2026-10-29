-- =====================================================================
-- MENTOR ↔ UNIDADES — PASSO 1: BASE (rode depois do passo 0)
-- Cria a lista central "minhas unidades" e ajusta as funções que todas as regras usam.
--   Admin  -> todas as unidades
--   Mentor -> só as marcadas em mentor_unidades (nenhuma marcada = nenhuma unidade)
--   Líder / Recepção -> a própria unidade (como hoje)
-- ATENÇÃO: entre o passo 1 e o passo 2 o Mentor fica sem acesso. Rode os dois em seguida,
-- fora do horário de movimento.
-- =====================================================================
begin;

-- ---------- Tabela de vínculo: índice, histórico e atualização automática ----------
create index if not exists mentor_unidades_email_idx on public.mentor_unidades (lower(trim(mentor_email)));

create table if not exists public.mentor_unidades_log (
  id           bigserial primary key,
  quando       timestamptz not null default now(),
  operacao     text not null,           -- ADICIONADA ou REMOVIDA
  mentor_email text,
  unidade      text,
  quem_email   text
);
alter table public.mentor_unidades_log enable row level security;
drop policy if exists mentor_unidades_log_ver on public.mentor_unidades_log;
create policy mentor_unidades_log_ver on public.mentor_unidades_log for select to authenticated
  using ((select public.seg_papel()) = 'ADMIN');

create or replace function public.mentor_unidades_registrar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into public.mentor_unidades_log (operacao, mentor_email, unidade, quem_email)
    values ('REMOVIDA', old.mentor_email, old.unidade, coalesce(auth.jwt() ->> 'email', current_user));
    return old;
  end if;
  insert into public.mentor_unidades_log (operacao, mentor_email, unidade, quem_email)
  values ('ADICIONADA', new.mentor_email, new.unidade, coalesce(auth.jwt() ->> 'email', current_user));
  return new;
end;
$$;
drop trigger if exists mentor_unidades_registrar_gatilho on public.mentor_unidades;
create trigger mentor_unidades_registrar_gatilho
  after insert or delete on public.mentor_unidades
  for each row execute function public.mentor_unidades_registrar();

-- Login que deixa de ser Mentor (ou é apagado) perde os vínculos; troca de e-mail leva os vínculos junto
create or replace function public.mentor_unidades_limpar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.mentor_unidades where lower(trim(mentor_email)) = lower(trim(old.email));
    return old;
  end if;
  if upper(trim(coalesce(new.role, ''))) <> 'MENTOR' then
    delete from public.mentor_unidades where lower(trim(mentor_email)) = lower(trim(old.email));
  elsif lower(trim(old.email)) is distinct from lower(trim(new.email)) then
    update public.mentor_unidades set mentor_email = new.email
    where lower(trim(mentor_email)) = lower(trim(old.email));
  end if;
  return new;
end;
$$;
drop trigger if exists mentor_unidades_limpar_gatilho on public.usuarios_sistema;
create trigger mentor_unidades_limpar_gatilho
  after update or delete on public.usuarios_sistema
  for each row execute function public.mentor_unidades_limpar();

-- A tela do Mentor se atualiza sozinha quando o Admin muda as unidades dele
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mentor_unidades') then
    alter publication supabase_realtime add table public.mentor_unidades;
  end if;
end $$;

-- ---------- Lista central "minhas unidades" ----------
-- Devolve NULL para o Admin (= todas), a lista do Mentor, ou a unidade do Líder/Recepção.
create or replace function public.seg_minhas_unidades()
returns text[] language plpgsql stable security definer set search_path = public as $$
declare
  v_papel text := public.seg_papel();
  v_lista text[];
begin
  if v_papel is null then return '{}'::text[]; end if;
  if v_papel = 'ADMIN' then return null; end if;
  if v_papel = 'MENTOR' then
    select coalesce(array_agg(distinct public.seg_normalizar(m.unidade)), '{}'::text[]) into v_lista
    from public.mentor_unidades m
    where lower(trim(m.mentor_email)) = lower(trim(auth.jwt() ->> 'email'));
    return v_lista;
  end if;
  if coalesce(public.seg_unidade(), '') = '' then return '{}'::text[]; end if;
  return array[public.seg_unidade()];
end;
$$;

-- "Posso ver esta unidade?" (usado dentro das funções seguras)
create or replace function public.seg_ve_unidade(p_unidade text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.seg_papel() = 'ADMIN', false)
      or coalesce(public.seg_normalizar(p_unidade) = any (public.seg_minhas_unidades()), false)
$$;

-- "Global" agora é SÓ o Admin (antes o Mentor também era)
create or replace function public.seg_eh_global()
returns boolean language sql stable as $$
  select coalesce(public.seg_papel() = 'ADMIN', false)
$$;

create or replace function public.crm_eh_global()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.seg_papel() = 'ADMIN', false)
$$;

-- Unidade "minha": Líder/Recepção a dele; Mentor qualquer uma das dele
create or replace function public.seg_mesma_unidade(p_unidade text)
returns boolean language sql stable as $$
  select coalesce(public.seg_normalizar(p_unidade) = any (public.seg_minhas_unidades()), false)
$$;

-- Mentor sem unidade marcada NÃO vê nada (antes via tudo)
create or replace function public.seg_mentor_ve_unidade(p_unidade text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mentor_unidades m
                 where lower(trim(m.mentor_email)) = lower(trim(auth.jwt() ->> 'email'))
                   and public.seg_normalizar(m.unidade) = public.seg_normalizar(p_unidade));
$$;

-- Mensagens prontas e "Não contatar": Mentor com unidades faz o mesmo que o Líder
create or replace function public.crm_eh_admin_ou_lider()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.seg_papel() in ('ADMIN', 'LIDER'), false)
      or (coalesce(public.seg_papel() = 'MENTOR', false)
          and coalesce(cardinality(public.seg_minhas_unidades()), 0) > 0);
$$;

revoke execute on function public.seg_minhas_unidades() from public, anon;
grant execute on function public.seg_minhas_unidades() to authenticated;
revoke execute on function public.seg_ve_unidade(text) from public, anon;
grant execute on function public.seg_ve_unidade(text) to authenticated;

commit;

notify pgrst, 'reload schema';
