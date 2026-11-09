-- =====================================================================
-- PERMISSÕES — ETAPA 2 (AÇÕES) — PASSO 1: A REGRA DO BANCO seg_pode('codigo')  (rode depois do passo 0)
-- O banco passa a responder "este login pode fazer a ação X?" com a MESMA regra da tela
-- (src/permissoes/catalogoPermissoes.js → temPermissao):
--   não é funcionário → não · Admin, ação travada, ação "rede" para Líder/Recepção, nível fora do "mudavelPara" → padrão
--   · exceção do login (permissoes_excecao) · regra do nível (permissoes_papel) · padrão.
-- A tabela permissoes_padrao guarda o PADRÃO de cada número (cópia do catálogo do código).
-- Se o catálogo mudar: node scripts/gerar-padroes-permissoes.mjs e trocar a lista abaixo (o teste avisa).
-- Este passo NÃO muda nenhuma regra de acesso: só cria a tabela e as funções.
-- =====================================================================

create table if not exists public.permissoes_padrao (
    codigo       text primary key,
    padrao       text[] not null,      -- níveis que têm a permissão sem mudança do Admin
    travada      boolean not null default false,
    rede         boolean not null default false,
    mudavel_para text[]                -- null = todos os níveis podem ser mudados
);
alter table public.permissoes_padrao enable row level security;
drop policy if exists permissoes_padrao_ver on public.permissoes_padrao;
create policy permissoes_padrao_ver on public.permissoes_padrao
    for select to authenticated using ((select public.seg_papel()) is not null);

-- Lista do catálogo (grava ou atualiza: pode rodar de novo sem problema)
insert into public.permissoes_padrao (codigo, padrao, travada, rede, mudavel_para) values
  ('001', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('002', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('003', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('004', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('005', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('006', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('007', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('008', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('009', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('010', array['ADMIN', 'MENTOR'], false, true, null),
  ('011', array['ADMIN'], true, false, null),
  ('012', array['ADMIN', 'MENTOR'], true, false, null),
  ('101', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('102', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('103', array['ADMIN', 'MENTOR'], true, false, null),
  ('201', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('202', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('203', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('204', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('205', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('206', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('207', array['ADMIN', 'MENTOR'], true, false, null),
  ('301', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('302', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('303', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('304', array['ADMIN', 'MENTOR'], false, true, null),
  ('305', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('306', array['ADMIN', 'MENTOR'], true, false, null),
  ('307', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('308', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('309', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('310', array['ADMIN', 'MENTOR'], false, true, null),
  ('311', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('312', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('313', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('401', array['ADMIN', 'MENTOR', 'LIDER'], true, false, null),
  ('402', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('403', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('404', array['ADMIN', 'MENTOR'], false, false, null),
  ('405', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('406', array['ADMIN'], false, false, null),
  ('501', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('502', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('504', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('506', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('507', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('508', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('509', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('510', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('511', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('512', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('513', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('514', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('515', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('516', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('517', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('518', array['ADMIN', 'MENTOR'], false, true, null),
  ('519', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('520', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('521', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('601', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('602', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('603', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('604', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('605', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('606', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('607', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('608', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('609', array['ADMIN'], true, false, null),
  ('610', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('701', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], true, false, null),
  ('702', array['ADMIN', 'MENTOR'], false, true, null),
  ('703', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('704', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('705', array['ADMIN', 'MENTOR'], false, false, null),
  ('706', array['ADMIN', 'MENTOR'], true, false, null),
  ('707', array['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'], false, false, null),
  ('801', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('802', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('803', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('804', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('805', array['ADMIN'], true, false, null),
  ('806', array['ADMIN'], true, false, null),
  ('807', array['ADMIN', 'MENTOR', 'LIDER'], false, false, null),
  ('808', array['ADMIN'], true, false, null),
  ('901', array['ADMIN', 'MENTOR'], false, false, null),
  ('902', array['MENTOR', 'LIDER'], false, false, array['MENTOR', 'LIDER']),
  ('903', array['RECEPCAO'], false, false, array['RECEPCAO']),
  ('904', array['LIDER'], false, false, array['LIDER']),
  ('909', array['RECEPCAO'], false, false, array['RECEPCAO']),
  ('905', array['ADMIN'], true, false, null),
  ('907', array['ADMIN'], true, false, null),
  ('908', array['ADMIN'], true, false, null)
on conflict (codigo) do update
   set padrao = excluded.padrao, travada = excluded.travada, rede = excluded.rede, mudavel_para = excluded.mudavel_para;

-- A regra, para um e-mail e um nível (usada pela seg_pode e pelo teste do passo 3)
create or replace function public.seg_pode_de(p_email text, p_papel text, p_codigo text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  v_papel  text := upper(trim(coalesce(p_papel, '')));
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_p      public.permissoes_padrao;
  v_padrao boolean;
  v_valor  boolean;
begin
  if v_papel = '' then return false; end if;
  select * into v_p from public.permissoes_padrao where codigo = p_codigo;
  if not found then return v_papel = 'ADMIN'; end if;   -- número desconhecido: só o Admin (ninguém se tranca fora)
  v_padrao := v_papel = any (v_p.padrao);
  if v_papel = 'ADMIN' or v_p.travada then return v_padrao; end if;
  if v_p.rede and v_papel not in ('ADMIN', 'MENTOR') then return v_padrao; end if;
  if v_p.mudavel_para is not null and not (v_papel = any (v_p.mudavel_para)) then return v_padrao; end if;
  select permitido into v_valor from public.permissoes_excecao where lower(trim(email)) = v_email and codigo = p_codigo;
  if found then return v_valor; end if;
  select permitido into v_valor from public.permissoes_papel where papel = v_papel and codigo = p_codigo;
  if found then return v_valor; end if;
  return v_padrao;
end;
$$;
revoke execute on function public.seg_pode_de(text, text, text) from public, anon, authenticated;

-- A regra para quem está logado (é esta que as regras de acesso e as funções seguras usam)
create or replace function public.seg_pode(p_codigo text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.seg_pode_de(auth.jwt() ->> 'email', public.seg_papel(), p_codigo)
$$;
revoke execute on function public.seg_pode(text) from public, anon;
grant execute on function public.seg_pode(text) to authenticated;

notify pgrst, 'reload schema';

-- Conferência (MANDE ESTE RESULTADO): quantos números e a resposta em 3 exemplos (esperado: 90, true, false, false)
select 'números no padrão' as item, count(*)::text as valor from public.permissoes_padrao
union all select 'Admin pode 307 (gravar metas)?', public.seg_pode_de('admin@teste', 'ADMIN', '307')::text
union all select 'Recepção pode 307 sem mudança?', public.seg_pode_de('ninguem@teste', 'RECEPCAO', '307')::text
union all select 'Líder pode 805 (catálogo, travada)?', public.seg_pode_de('ninguem@teste', 'LIDER', '805')::text;
