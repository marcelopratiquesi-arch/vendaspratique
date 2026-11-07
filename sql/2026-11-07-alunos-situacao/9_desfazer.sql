-- =====================================================================
-- CENTRAL DE ALUNOS: SITUAÇÃO — DESFAZER. Volta a listar_alunos_360 exatamente como estava antes do passo 1
-- (texto guardado pelo passo 0 na tabela seg_backup_listar_alunos_20261107).
-- A tela continua funcionando: sem a situação, a coluna mostra "—" e o filtro avisa.
-- =====================================================================
DROP FUNCTION IF EXISTS public.listar_alunos_360(text, text, text, date, date, text, text, integer, integer, text, text, text);

DO $$
DECLARE v_def text;
BEGIN
    SELECT definicao INTO v_def FROM public.seg_backup_listar_alunos_20261107 ORDER BY copiado_em LIMIT 1;
    IF v_def IS NULL THEN
        RAISE EXCEPTION 'Cópia não encontrada (o passo 0 não foi rodado). Rode sql/2026-10-29-mentor-unidades/4_lista_de_alunos.sql para voltar.';
    END IF;
    EXECUTE v_def;
END $$;

notify pgrst, 'reload schema';

-- Conferência: tem_situacao deve ser FALSE
select proname, pg_get_function_arguments(oid) like '%p_situacao%' as tem_situacao from pg_proc where proname = 'listar_alunos_360';
