-- ============================================================
-- MIGRAÇÃO: RESULTADO DO CONTATO, TENTATIVAS E GELADEIRA — passo 1 (decisão do dono, 06/11/2026)
-- Depois do WhatsApp/ligação a recepcionista marca o resultado:
--   Respondeu, vai pensar   → volta para ela em 3 dias
--   Não respondeu/atendeu   → volta em 2 dias; na 3ª tentativa vai para a geladeira (SEM_RESPOSTA) por 30 dias
--   Interessado             → vai para o funil do CRM (como já era)
--   Não quer                → geladeira da Migração (NAO_QUER) por 30 dias; NÃO entra no "Não contatar"
-- Campos novos na crm_migracao:
--   volta_em    → dia em que o aluno volta para a lista "Para hoje"
--   tentativas  → quantas vezes seguidas não respondeu
--   resultado   → último resultado marcado (PENSANDO, SEM_RESPOSTA, INTERESSADO, NAO_QUER)
-- Situações novas no campo status: NAO_QUER e SEM_RESPOSTA. Se existir trava (check) que só aceita as
-- antigas, ela é trocada por uma que aceita as antigas + as novas.
-- Não apaga nem muda nenhuma linha. Antes: 0_copia_de_seguranca.sql. Desfazer: 9_desfazer.sql.
-- ============================================================

alter table public.crm_migracao add column if not exists volta_em date;
alter table public.crm_migracao add column if not exists tentativas integer not null default 0;
alter table public.crm_migracao add column if not exists resultado text;

-- Trava do status: tira a antiga (se houver) e cria uma com todas as situações
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.crm_migracao'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.crm_migracao drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.crm_migracao add constraint crm_migracao_status_valido
  check (status in ('NA_FILA', 'CONTATADO', 'INTERESSADO', 'MIGROU', 'NAO_QUER', 'SEM_RESPOSTA')) not valid;

notify pgrst, 'reload schema';

-- Conferência 1: os 3 campos novos
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'crm_migracao'
  and column_name in ('volta_em', 'tentativas', 'resultado')
order by column_name;

-- Conferência 2: as mesmas quantidades do passo 0
select status, count(*) from public.crm_migracao group by status order by status;
