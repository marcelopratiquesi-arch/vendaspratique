-- =====================================================================
-- MENTOR ↔ UNIDADES — PASSO 0: CÓPIA DE SEGURANÇA (rode primeiro)
-- Guarda o texto atual de todas as regras de acesso e das funções que vão mudar.
-- O arquivo 9_desfazer.sql usa estas cópias para voltar tudo como estava.
-- =====================================================================

create table if not exists public.seg_backup_policies_20261029 as
  select * from pg_policies where schemaname = 'public';

create table if not exists public.seg_backup_funcoes_20261029 as
  select p.proname::text as funcao, pg_get_functiondef(p.oid) as definicao
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.proname in ('seg_eh_global', 'seg_mesma_unidade', 'seg_mentor_ve_unidade',
                      'crm_eh_global', 'crm_eh_admin_ou_lider', 'crm_conferir_quem_apaga',
                      'crm_aniversariantes_do_dia', 'crm_migracao_alunos', 'crm_puxar_migracao',
                      'mover_vinculo_alunos', 'listar_alunos_360', 'excluir_venda');

-- Ninguém lê essas cópias pelo sistema (só pelo SQL Editor)
alter table public.seg_backup_policies_20261029 enable row level security;
alter table public.seg_backup_funcoes_20261029 enable row level security;

-- Conferência: devem aparecer cerca de 70 regras e 12 funções
select (select count(*) from public.seg_backup_policies_20261029) as regras_copiadas,
       (select count(*) from public.seg_backup_funcoes_20261029) as funcoes_copiadas;
