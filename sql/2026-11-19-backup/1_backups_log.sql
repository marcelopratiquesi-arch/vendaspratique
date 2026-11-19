-- ============================================================
-- BACKUP — PASSO 1: histórico das cópias de segurança (decisão do dono, 19/11/2026)
-- Configurações → Backup (só o Admin). Cada vez que o Admin faz uma cópia pela tela, fica uma linha aqui:
-- quando, quem, tipo (DADOS = tabelas; ARQUIVOS = fotos e PDFs), tamanho e quantas linhas de cada tabela.
-- Serve para mostrar "Última cópia há X dias" e o aviso ao entrar quando passar de 7 dias.
-- Não mexe em nenhuma outra tabela (vendas, comissão etc. ficam iguais). Só o Admin lê e grava. Ninguém altera
-- nem apaga uma linha pela tela (não há regra de UPDATE/DELETE).
-- Não precisa de passo 0: a tabela é nova e nada é alterado.
-- Desfazer: 9_desfazer.sql
-- ============================================================
create table if not exists public.backups_log (
    id              bigint generated always as identity primary key,
    criado_em       timestamptz not null default now(),
    criado_por      text not null default coalesce(auth.jwt() ->> 'email', ''),
    criado_por_nome text,
    tipo            text not null default 'DADOS' check (tipo in ('DADOS', 'ARQUIVOS')),
    tamanho_bytes   bigint,
    linhas          jsonb,          -- { "vendas": 6727, ... }
    erros           jsonb,          -- { "tabela": "motivo" } das tabelas que o banco não deixou ler
    arquivos_ate    timestamptz     -- ARQUIVOS: data do arquivo mais novo incluído (a próxima cópia pega só os novos)
);

alter table public.backups_log enable row level security;

drop policy if exists backups_log_ver on public.backups_log;
create policy backups_log_ver on public.backups_log
    for select to authenticated
    using ((select public.seg_papel()) = 'ADMIN');

drop policy if exists backups_log_criar on public.backups_log;
create policy backups_log_criar on public.backups_log
    for insert to authenticated
    with check ((select public.seg_papel()) = 'ADMIN');

-- Permissão 912 "Configurações: Backup" no padrão do banco (só o Admin, travada)
insert into public.permissoes_padrao (codigo, padrao, travada, rede, mudavel_para)
values ('912', array['ADMIN'], true, false, null)
on conflict (codigo) do update set padrao = excluded.padrao, travada = excluded.travada, rede = excluded.rede, mudavel_para = excluded.mudavel_para;

-- Conferência: a tabela existe, vazia, com a proteção ligada
select count(*) as linhas,
       (select relrowsecurity from pg_class where oid = 'public.backups_log'::regclass) as protecao_ligada
from public.backups_log;
