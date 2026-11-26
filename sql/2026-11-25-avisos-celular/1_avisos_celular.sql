-- ============================================================
-- AVISOS NO CELULAR — PASSO 1 (decisão do dono, 25/11/2026; Fase B da receita _FERRAMENTAS/app-no-celular)
-- O Admin manda um aviso e o celular (ou o computador) da equipe apita, mesmo com o sistema fechado.
-- O que cria (tudo NOVO; nenhuma tabela antiga é alterada, vendas e comissão ficam iguais):
--   push_aparelhos         = cada celular/computador que ativou os avisos (endereço do aparelho + e-mail do login).
--                            Cada pessoa só vê os PRÓPRIOS aparelhos.
--   push_avisos_enviados   = histórico (quando, quem mandou, para quem, texto, quantos aparelhos receberam).
--   chave 'avisos_celular' em sistema_config: 'teste' (só o Admin vê a faixa de ativar) | 'ligado' (todos) |
--                            'desligado'. Começa em 'teste'.
--   permissão 913 "Enviar aviso no celular" no padrão (só o Admin; dá para liberar o Mentor na aba Permissões).
--   funções seguras: registrar/soltar aparelho (o próprio), destinatários, gravar envio, remover aparelhos
--                    mortos e trocar o modo (as três últimas só com a permissão 913 / Admin).
-- Quem recebe = logins ATIVOS de usuarios_sistema (o Mentor entra pela unidade marcada em mentor_unidades).
-- Não precisa de passo 0: nada existente é alterado. Desfazer: 9_desfazer.sql
-- ============================================================

create table if not exists public.push_aparelhos (
    id            bigint generated always as identity primary key,
    email         text not null,
    endpoint      text not null unique,
    p256dh        text not null,
    auth          text not null,
    dispositivo   text,
    criado_em     timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create index if not exists push_aparelhos_email_idx on public.push_aparelhos (lower(trim(email)));
alter table public.push_aparelhos enable row level security;
drop policy if exists push_aparelhos_ver_meus on public.push_aparelhos;
create policy push_aparelhos_ver_meus on public.push_aparelhos
    for select to authenticated
    using (lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', ''))));
-- Sem regra de INSERT/UPDATE/DELETE: só pelas funções abaixo.

create table if not exists public.push_avisos_enviados (
    id             bigint generated always as identity primary key,
    criado_em      timestamptz not null default now(),
    enviado_por    text not null default coalesce(auth.jwt() ->> 'email', ''),
    titulo         text not null,
    texto          text not null,
    link           text,
    destino        jsonb,
    destino_resumo text,
    pessoas        int not null default 0,
    aparelhos      int not null default 0,
    entregues      int not null default 0,
    falhas         int not null default 0,
    sem_aparelho   jsonb,
    comunicado_id  text
);
alter table public.push_avisos_enviados enable row level security;
drop policy if exists push_avisos_ver on public.push_avisos_enviados;
create policy push_avisos_ver on public.push_avisos_enviados
    for select to authenticated
    using ((select public.seg_pode('913')));

-- Modo: começa em TESTE (só o Admin vê a faixa de ativar)
insert into public.sistema_config (chave, valor, descricao)
values ('avisos_celular', 'teste', 'Avisos no celular: teste (só o Admin) | ligado (todos) | desligado')
on conflict (chave) do nothing;

-- Permissão 913 no padrão do banco (só o Admin; pode ser liberada para o Mentor)
insert into public.permissoes_padrao (codigo, padrao, travada, rede, mudavel_para)
values ('913', array['ADMIN'], false, false, array['MENTOR'])
on conflict (codigo) do update set padrao = excluded.padrao, travada = excluded.travada, rede = excluded.rede, mudavel_para = excluded.mudavel_para;

-- 1) O aparelho de quem está logado passa a receber avisos (o mesmo aparelho com outro login passa para o novo)
create or replace function public.push_registrar_aparelho(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
begin
  if v_email = '' or public.seg_papel() is null then raise exception 'Entre no sistema para ativar os avisos.'; end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Aparelho sem os dados dos avisos.';
  end if;
  insert into public.push_aparelhos (email, endpoint, p256dh, auth, dispositivo)
  values (v_email, p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 200))
  on conflict (endpoint) do update
     set email = excluded.email, p256dh = excluded.p256dh, auth = excluded.auth,
         dispositivo = excluded.dispositivo, atualizado_em = now();
  return true;
end;
$$;
revoke execute on function public.push_registrar_aparelho(text, text, text, text) from public, anon;
grant execute on function public.push_registrar_aparelho(text, text, text, text) to authenticated;

-- 2) "Sair": o aparelho deixa de receber os avisos deste login (só o próprio)
create or replace function public.push_soltar_aparelho(p_endpoint text)
returns boolean language sql security definer set search_path = public as $$
  with apagados as (
    delete from public.push_aparelhos
     where endpoint = p_endpoint and lower(trim(email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    returning 1)
  select exists (select 1 from apagados)
$$;
revoke execute on function public.push_soltar_aparelho(text) from public, anon;
grant execute on function public.push_soltar_aparelho(text) to authenticated;

-- 3) Para quem vai (só com a permissão 913). Uma linha por aparelho; quem não tem aparelho vem com endpoint vazio.
--    p_destino: {"tipo":"todos"} | {"tipo":"filtro","papeis":["LIDER"],"unidades":["SANTA INES 2"]}
--               | {"tipo":"pessoas","emails":["a@b.com"]} | {"tipo":"comunicado","id":123}
create or replace function public.push_destinatarios(p_destino jsonb)
returns table (email text, nome text, papel text, unidade text, endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tipo     text := coalesce(p_destino ->> 'tipo', '');
  v_papeis   text[];
  v_unidades text[];
  v_emails   text[];
begin
  if not public.seg_pode('913') then raise exception 'Sem permissão para enviar avisos no celular.'; end if;
  v_papeis   := array(select upper(trim(x)) from jsonb_array_elements_text(coalesce(p_destino -> 'papeis', '[]'::jsonb)) x);
  v_unidades := array(select upper(trim(x)) from jsonb_array_elements_text(coalesce(p_destino -> 'unidades', '[]'::jsonb)) x);
  v_emails   := array(select lower(trim(x)) from jsonb_array_elements_text(coalesce(p_destino -> 'emails', '[]'::jsonb)) x);
  if v_tipo not in ('todos', 'filtro', 'pessoas', 'comunicado') then raise exception 'Destino inválido.'; end if;

  return query
  with pessoas as (
    select distinct on (lower(trim(u.email)))
           lower(trim(u.email)) as email, u.nome::text as nome, upper(coalesce(u.role, ''))::text as papel, u.unidade::text as unidade
      from public.usuarios_sistema u
     where coalesce(u.email, '') <> ''
       and upper(coalesce(u.status, 'ATIVO')) = 'ATIVO'
       and (
         v_tipo = 'todos'
         or (v_tipo = 'pessoas' and lower(trim(u.email)) = any (v_emails))
         or (v_tipo = 'comunicado' and exists (
               select 1 from public.comunicado_inbox i
                where i.comunicado_id::text = (p_destino ->> 'id')
                  and lower(trim(i.email_usuario)) = lower(trim(u.email))))
         or (v_tipo = 'filtro'
             and (cardinality(v_papeis) = 0 or upper(coalesce(u.role, '')) = any (v_papeis))
             and (cardinality(v_unidades) = 0
                  or upper(trim(coalesce(u.unidade, ''))) = any (v_unidades)
                  or (upper(coalesce(u.role, '')) = 'MENTOR' and exists (
                        select 1 from public.mentor_unidades m
                         where lower(trim(m.mentor_email)) = lower(trim(u.email))
                           and upper(trim(m.unidade)) = any (v_unidades)))))
       )
     order by lower(trim(u.email))
  )
  select p.email, p.nome, p.papel, p.unidade, a.endpoint, a.p256dh, a.auth
    from pessoas p
    left join public.push_aparelhos a on lower(trim(a.email)) = p.email;
end;
$$;
revoke execute on function public.push_destinatarios(jsonb) from public, anon;
grant execute on function public.push_destinatarios(jsonb) to authenticated;

-- 4) Grava o envio no histórico (só com a permissão 913)
create or replace function public.push_registrar_envio(
    p_titulo text, p_texto text, p_link text, p_destino jsonb, p_resumo text,
    p_pessoas int, p_aparelhos int, p_entregues int, p_falhas int, p_sem_aparelho jsonb, p_comunicado_id text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.seg_pode('913') then raise exception 'Sem permissão para enviar avisos no celular.'; end if;
  insert into public.push_avisos_enviados (titulo, texto, link, destino, destino_resumo, pessoas, aparelhos, entregues, falhas, sem_aparelho, comunicado_id)
  values (left(p_titulo, 120), left(p_texto, 500), p_link, p_destino, left(p_resumo, 300), coalesce(p_pessoas, 0), coalesce(p_aparelhos, 0),
          coalesce(p_entregues, 0), coalesce(p_falhas, 0), p_sem_aparelho, p_comunicado_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.push_registrar_envio(text, text, text, jsonb, text, int, int, int, int, jsonb, text) from public, anon;
grant execute on function public.push_registrar_envio(text, text, text, jsonb, text, int, int, int, int, jsonb, text) to authenticated;

-- 5) Aparelho que não existe mais (app apagado, avisos bloqueados) sai da lista (só com a permissão 913)
create or replace function public.push_remover_aparelhos(p_endpoints text[])
returns int language plpgsql security definer set search_path = public as $$
declare v_qtd int;
begin
  if not public.seg_pode('913') then raise exception 'Sem permissão.'; end if;
  delete from public.push_aparelhos where endpoint = any (coalesce(p_endpoints, array[]::text[]));
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;
revoke execute on function public.push_remover_aparelhos(text[]) from public, anon;
grant execute on function public.push_remover_aparelhos(text[]) to authenticated;

-- 6) Trocar o modo (só o Admin): teste | ligado | desligado
create or replace function public.push_definir_modo(p_modo text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if public.seg_papel() is distinct from 'ADMIN' then raise exception 'Só o Admin muda o modo dos avisos.'; end if;
  if lower(coalesce(p_modo, '')) not in ('teste', 'ligado', 'desligado') then raise exception 'Modo inválido.'; end if;
  insert into public.sistema_config (chave, valor, descricao, atualizado_em)
  values ('avisos_celular', lower(p_modo), 'Avisos no celular: teste (só o Admin) | ligado (todos) | desligado', now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();
  return lower(p_modo);
end;
$$;
revoke execute on function public.push_definir_modo(text) from public, anon;
grant execute on function public.push_definir_modo(text) to authenticated;

notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO): esperado 0, 0, teste, 913 = {ADMIN}
select 'aparelhos' as item, count(*)::text as valor from public.push_aparelhos
union all select 'avisos no histórico', count(*)::text from public.push_avisos_enviados
union all select 'modo dos avisos', (select valor from public.sistema_config where chave = 'avisos_celular')
union all select 'permissão 913', (select padrao::text from public.permissoes_padrao where codigo = '913');
