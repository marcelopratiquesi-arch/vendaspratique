-- ============================================================
-- LIXEIRA DAS AVALIAÇÕES FÍSICAS (decisão do dono, 04/11/2026)
-- Avaliação nunca é apagada direto: excluir_avaliacao(id, motivo) guarda a avaliação INTEIRA na
-- tabela avaliacoes_lixeira (quem, quando, motivo) e tira da avaliacoes_realizadas.
-- Quem exclui: Admin (todas), Mentor (unidades dele) e Líder (a unidade dele).
-- Quem restaura: Admin (todas) e Mentor (unidades dele). Volta com o mesmo número.
-- Quem vê a lixeira: todos, cada um nas unidades que enxerga (Admin todas).
-- Pode rodar mais de uma vez. Para desfazer: 9_desfazer.sql
-- ============================================================

-- 1) Tabela da lixeira (sem regra de acesso: só as funções abaixo leem e gravam)
create table if not exists public.avaliacoes_lixeira (
  id bigserial primary key,
  avaliacao_id text not null,
  unidade text,
  aluno text,
  cpf text,
  professor text,
  data_avaliacao text,
  dados jsonb not null,
  motivo text not null,
  excluido_por text,
  excluido_email text,
  excluido_em timestamptz not null default now(),
  restaurado_em timestamptz,
  restaurado_por text
);
alter table public.avaliacoes_lixeira enable row level security;
create index if not exists avaliacoes_lixeira_excluido_em on public.avaliacoes_lixeira (excluido_em);

-- 2) Cópia das regras de APAGAR atuais da avaliacoes_realizadas (para o 9_desfazer.sql) e remoção:
--    daqui em diante só a função excluir_avaliacao apaga.
create table if not exists public.aval_backup_policies_20261104 as
  select * from pg_policies where schemaname = 'public' and tablename = 'avaliacoes_realizadas' and cmd = 'DELETE';
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'avaliacoes_realizadas' and cmd = 'DELETE' loop
    execute format('drop policy %I on public.avaliacoes_realizadas', p.policyname);
  end loop;
end $$;

-- Nome de quem está logado (para "excluído por")
create or replace function public.seg_meu_nome()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nome from public.usuarios_sistema where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) limit 1),
    auth.jwt() ->> 'email')
$$;

-- 3) Excluir (vai para a lixeira)
create or replace function public.excluir_avaliacao(p_id text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_av public.avaliacoes_realizadas;
  v_dados jsonb;
  v_papel text := public.seg_papel();
begin
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Informe o motivo da exclusão (pelo menos 5 letras).';
  end if;
  select * into v_av from public.avaliacoes_realizadas where id::text = p_id;
  if not found then raise exception 'Avaliação não encontrada (talvez já excluída).'; end if;
  v_dados := to_jsonb(v_av);
  if not (v_papel = 'ADMIN' or (v_papel in ('LIDER', 'MENTOR') and public.seg_ve_unidade(v_dados ->> 'unidade'))) then
    raise exception 'Sem permissão para excluir avaliação desta unidade.';
  end if;
  insert into public.avaliacoes_lixeira (avaliacao_id, unidade, aluno, cpf, professor, data_avaliacao, dados, motivo, excluido_por, excluido_email)
  values (p_id, v_dados ->> 'unidade', v_dados ->> 'aluno', v_dados ->> 'cpf', v_dados ->> 'professor',
          coalesce(v_dados ->> 'data', v_dados ->> 'created_at'), v_dados, trim(p_motivo),
          public.seg_meu_nome(), auth.jwt() ->> 'email');
  delete from public.avaliacoes_realizadas where id::text = p_id;
end;
$$;

-- 4) Restaurar (volta igualzinha, com o mesmo número)
create or replace function public.restaurar_avaliacao(p_lixeira_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_l public.avaliacoes_lixeira;
  v_papel text := public.seg_papel();
begin
  select * into v_l from public.avaliacoes_lixeira where id = p_lixeira_id and restaurado_em is null;
  if not found then raise exception 'Avaliação não está na lixeira.'; end if;
  if not (v_papel = 'ADMIN' or (v_papel = 'MENTOR' and public.seg_ve_unidade(v_l.unidade))) then
    raise exception 'Só o Admin e o Mentor (nas unidades dele) restauram avaliações.';
  end if;
  if exists (select 1 from public.avaliacoes_realizadas where id::text = v_l.avaliacao_id) then
    raise exception 'Já existe uma avaliação com este número.';
  end if;
  insert into public.avaliacoes_realizadas select * from jsonb_populate_record(null::public.avaliacoes_realizadas, v_l.dados);
  update public.avaliacoes_lixeira set restaurado_em = now(), restaurado_por = public.seg_meu_nome() where id = p_lixeira_id;
end;
$$;

-- 5) Listar a lixeira (período pela data da exclusão; unidade opcional; cada um só vê as unidades dele)
create or replace function public.avaliacoes_lixeira_listar(p_inicio timestamptz default null, p_fim timestamptz default null, p_unidade text default null)
returns table (id bigint, avaliacao_id text, unidade text, aluno text, cpf text, professor text, data_avaliacao text,
               motivo text, excluido_por text, excluido_em timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.avaliacao_id, l.unidade, l.aluno, l.cpf, l.professor, l.data_avaliacao, l.motivo, l.excluido_por, l.excluido_em
  from public.avaliacoes_lixeira l
  where l.restaurado_em is null
    and public.seg_papel() is not null
    and public.seg_ve_unidade(l.unidade)
    and (p_inicio is null or l.excluido_em >= p_inicio)
    and (p_fim is null or l.excluido_em < p_fim)
    and (p_unidade is null or public.seg_normalizar(l.unidade) = public.seg_normalizar(p_unidade))
  order by l.excluido_em desc
$$;

grant execute on function public.excluir_avaliacao(text, text) to authenticated;
grant execute on function public.restaurar_avaliacao(bigint) to authenticated;
grant execute on function public.avaliacoes_lixeira_listar(timestamptz, timestamptz, text) to authenticated;

-- Conferência: regras de apagar guardadas na cópia (a lista abaixo deve vir vazia)
select policyname from pg_policies where schemaname = 'public' and tablename = 'avaliacoes_realizadas' and cmd = 'DELETE';
