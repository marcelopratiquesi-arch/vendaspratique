-- ============================================================
-- UNIDADES: desativar em vez de apagar (decisão do dono, 04/11/2026)
-- 1) campo "ativa" (unidade desativada some do seletor e das listas, mas os dados ficam)
-- 2) unidade_uso(nome): quantas vendas/alunos/contatos/equipe/logins/avaliações/metas a unidade tem
-- 3) unidade_definir_ativa(id, ativa): desativar/reativar (só Admin)
-- 4) trava: o banco NÃO deixa apagar unidade que tenha qualquer dado ligado a ela
-- Pode rodar mais de uma vez. Para desfazer: 9_desfazer.sql
-- ============================================================

alter table public.unidades add column if not exists ativa boolean not null default true;

-- Quanto a unidade é usada (compara pelo nome normalizado, sem acento e maiúsculo)
create or replace function public.unidade_uso(p_nome text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  n text := public.seg_normalizar(p_nome);
  r jsonb;
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then
    raise exception 'Só o Admin pode consultar o uso da unidade.';
  end if;
  select jsonb_build_object(
    'vendas',       (select count(*) from public.vendas where public.seg_normalizar(unidade) = n),
    'alunos',       (select count(*) from public.alunos_unidades where public.seg_normalizar(unidade) = n),
    'contatos',     (select count(*) from public.leads where public.seg_normalizar(unidade) = n),
    'equipe',       (select count(*) from public.colaboradores where public.seg_normalizar(unidade) = n),
    'logins',       (select count(*) from public.usuarios_sistema where public.seg_normalizar(unidade) = n),
    'avaliacoes',   (select count(*) from public.avaliacoes_realizadas where public.seg_normalizar(unidade) = n),
    'metas',        (select count(*) from public.metas_unidades where public.seg_normalizar(unidade) = n),
    'movimentacao', (select count(*) from public.movimento_diario where public.seg_normalizar(unidade) = n)
  ) into r;
  return r;
end;
$$;

-- Desativar / reativar (só Admin; a auditoria de cadastros registra a mudança)
create or replace function public.unidade_definir_ativa(p_id text, p_ativa boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.seg_papel(), '') <> 'ADMIN' then
    raise exception 'Só o Admin pode desativar ou reativar unidades.';
  end if;
  update public.unidades set ativa = p_ativa where id::text = p_id;
  if not found then raise exception 'Unidade não encontrada.'; end if;
end;
$$;

-- Trava: apagar unidade com dados ligados é recusado pelo banco (mesmo por fora da tela)
create or replace function public.unidade_conferir_antes_de_apagar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n text := public.seg_normalizar(old.nome);
begin
  if exists (select 1 from public.vendas where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.alunos_unidades where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.leads where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.colaboradores where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.usuarios_sistema where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.avaliacoes_realizadas where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.metas_unidades where public.seg_normalizar(unidade) = n)
     or exists (select 1 from public.movimento_diario where public.seg_normalizar(unidade) = n) then
    raise exception 'A unidade % tem dados ligados a ela (vendas, alunos, contatos, equipe...). Só é possível desativar.', old.nome;
  end if;
  return old;
end;
$$;

drop trigger if exists unidades_trava_apagar on public.unidades;
create trigger unidades_trava_apagar before delete on public.unidades
  for each row execute function public.unidade_conferir_antes_de_apagar();

grant execute on function public.unidade_uso(text) to authenticated;
grant execute on function public.unidade_definir_ativa(text, boolean) to authenticated;

-- Conferência: todas as unidades continuam ativas
select nome, ativa from public.unidades order by nome;
