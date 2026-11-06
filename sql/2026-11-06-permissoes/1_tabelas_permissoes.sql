-- ============================================================
-- PERMISSÕES — ETAPA 1 (decisão do dono, 06/11/2026)
-- Aba "Permissões" em Configurações (só o ADMIN). A lista numerada das permissões fica no código
-- (src/permissoes/catalogoPermissoes.js). Aqui no banco ficam só as MUDANÇAS que o Admin fizer:
--   1) permissoes_papel   : liga/desliga uma permissão para um nível inteiro (MENTOR, LIDER, RECEPCAO).
--   2) permissoes_excecao : liga/desliga uma permissão para UM login só (ex.: a Recepção de uma unidade).
--   3) permissoes_log     : histórico de toda mudança (quem, quando, antes e depois).
-- Sem nenhuma linha nessas tabelas, o sistema funciona exatamente como antes (o padrão vem do código).
-- Ver: qualquer funcionário logado lê as regras do nível dele e as exceções do próprio login.
-- Gravar/apagar: só ADMIN.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Para desfazer: 9_desfazer.sql.
-- Não mexe em vendas, comissões nem em nenhuma tabela que já existe.
-- ============================================================

create table if not exists public.permissoes_papel (
    papel          text not null check (papel in ('MENTOR', 'LIDER', 'RECEPCAO')),
    codigo         text not null,
    permitido      boolean not null,
    atualizado_em  timestamptz not null default now(),
    atualizado_por text default (auth.jwt() ->> 'email'),
    primary key (papel, codigo)
);

create table if not exists public.permissoes_excecao (
    email          text not null,
    codigo         text not null,
    permitido      boolean not null,
    atualizado_em  timestamptz not null default now(),
    atualizado_por text default (auth.jwt() ->> 'email'),
    primary key (email, codigo)
);

create table if not exists public.permissoes_log (
    id         bigint generated always as identity primary key,
    quando     timestamptz not null default now(),
    quem       text default (auth.jwt() ->> 'email'),
    tipo       text not null,          -- PAPEL ou EXCECAO
    alvo       text not null,          -- o nível (LIDER...) ou o e-mail do login
    codigo     text not null,
    antes      boolean,                -- null = estava no padrão do sistema
    depois     boolean                 -- null = voltou ao padrão do sistema
);

alter table public.permissoes_papel   enable row level security;
alter table public.permissoes_excecao enable row level security;
alter table public.permissoes_log     enable row level security;

-- Ler: qualquer funcionário logado lê as regras dos níveis (são poucas linhas e não têm dado de aluno)
drop policy if exists permissoes_papel_ver on public.permissoes_papel;
create policy permissoes_papel_ver on public.permissoes_papel
    for select to authenticated using ((select public.seg_papel()) is not null);

-- Exceções: cada um lê as do próprio login; o Admin lê todas
drop policy if exists permissoes_excecao_ver on public.permissoes_excecao;
create policy permissoes_excecao_ver on public.permissoes_excecao
    for select to authenticated
    using ((select public.seg_papel()) = 'ADMIN' or lower(email) = lower((select auth.jwt() ->> 'email')));

-- Gravar e apagar: só ADMIN
drop policy if exists permissoes_papel_admin on public.permissoes_papel;
create policy permissoes_papel_admin on public.permissoes_papel
    for all to authenticated
    using ((select public.seg_papel()) = 'ADMIN') with check ((select public.seg_papel()) = 'ADMIN');

drop policy if exists permissoes_excecao_admin on public.permissoes_excecao;
create policy permissoes_excecao_admin on public.permissoes_excecao
    for all to authenticated
    using ((select public.seg_papel()) = 'ADMIN') with check ((select public.seg_papel()) = 'ADMIN');

-- Histórico: só o Admin lê; ninguém grava direto (só o gatilho abaixo)
drop policy if exists permissoes_log_ver on public.permissoes_log;
create policy permissoes_log_ver on public.permissoes_log
    for select to authenticated using ((select public.seg_papel()) = 'ADMIN');

-- Gatilho que escreve o histórico de toda mudança
create or replace function public.permissoes_registrar_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_tipo text := case when tg_table_name = 'permissoes_papel' then 'PAPEL' else 'EXCECAO' end;
begin
    if tg_op = 'DELETE' then
        insert into public.permissoes_log (tipo, alvo, codigo, antes, depois)
        values (v_tipo, case when v_tipo = 'PAPEL' then old.papel else old.email end, old.codigo, old.permitido, null);
        return old;
    elsif tg_op = 'UPDATE' then
        if old.permitido is distinct from new.permitido then
            insert into public.permissoes_log (tipo, alvo, codigo, antes, depois)
            values (v_tipo, case when v_tipo = 'PAPEL' then new.papel else new.email end, new.codigo, old.permitido, new.permitido);
        end if;
        return new;
    else
        insert into public.permissoes_log (tipo, alvo, codigo, antes, depois)
        values (v_tipo, case when v_tipo = 'PAPEL' then new.papel else new.email end, new.codigo, null, new.permitido);
        return new;
    end if;
end $$;

drop trigger if exists permissoes_papel_log on public.permissoes_papel;
create trigger permissoes_papel_log after insert or update or delete on public.permissoes_papel
    for each row execute function public.permissoes_registrar_log();

drop trigger if exists permissoes_excecao_log on public.permissoes_excecao;
create trigger permissoes_excecao_log after insert or update or delete on public.permissoes_excecao
    for each row execute function public.permissoes_registrar_log();

-- Tempo real: quando o Admin muda uma permissão, as telas abertas se ajustam sozinhas
alter publication supabase_realtime add table public.permissoes_papel;
alter publication supabase_realtime add table public.permissoes_excecao;

-- Conferência (as três devem aparecer com 0 linhas)
select 'permissoes_papel' as tabela, count(*) as linhas from public.permissoes_papel
union all select 'permissoes_excecao', count(*) from public.permissoes_excecao
union all select 'permissoes_log', count(*) from public.permissoes_log;
