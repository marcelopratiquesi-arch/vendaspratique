-- =====================================================================
-- CENTRAL DE ALUNOS: SITUAÇÃO — PASSO 0 (cópia de segurança). Rode ANTES do 1. Não muda nada.
-- Guarda o texto da função listar_alunos_360 como está hoje no banco, para o 9_desfazer.sql voltar.
-- =====================================================================
create table if not exists public.seg_backup_listar_alunos_20261107 as
select p.oid::regprocedure::text as assinatura,
       pg_get_functiondef(p.oid) as definicao,
       now() as copiado_em
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'listar_alunos_360';

-- Conferência: deve aparecer 1 linha com igual_ao_combinado = true.
-- Se aparecer FALSE, NÃO rode o passo 1: a função do banco está diferente da que eu usei de base (me avise).
-- (Confere trechos de CÓDIGO: o banco guarda a função sem os comentários "--". Em 07/11/2026 a 1ª versão desta
--  conferência procurava comentários e deu false à toa; a função do banco era idêntica à do arquivo.)
select assinatura,
       position('unidades_norm && v_permitidas' in definicao) > 0
       and position('seg_minhas_unidades()' in definicao) > 0
       and position('p_situacao' in definicao) = 0 as igual_ao_combinado,
       copiado_em
from public.seg_backup_listar_alunos_20261107;
