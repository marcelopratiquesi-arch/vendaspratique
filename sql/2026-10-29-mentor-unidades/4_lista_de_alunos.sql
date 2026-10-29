-- =====================================================================
-- MENTOR ↔ UNIDADES — PASSO 4: LISTA DE ALUNOS (listar_alunos_360) (rode depois do passo 3)
-- É a mesma função de hoje, com 3 mudanças (marcadas com "MENTOR"):
--   1) "visão global" só vale se o banco confirmar que é Admin ou Mentor de verdade
--      (antes bastava a tela mandar o texto "ADMIN");
--   2) Mentor sem unidade não recebe nada; Mentor numa unidade fora das dele não recebe nada;
--   3) Mentor em "Todas as minhas unidades" SEM busca vê só os alunos das unidades dele.
--      COM busca digitada, continua a rede inteira (regra 8, decisão do dono).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.listar_alunos_360(p_busca text DEFAULT ''::text, p_unidade text DEFAULT 'TODAS'::text, p_plano text DEFAULT 'TODOS'::text, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date, p_ordem_coluna text DEFAULT 'nome'::text, p_ordem_direcao text DEFAULT 'ASC'::text, p_pagina integer DEFAULT 1, p_limite integer DEFAULT 25, p_role_usuario text DEFAULT 'RECEPCAO'::text, p_unidade_usuario text DEFAULT ''::text)
 RETURNS TABLE(id uuid, nome text, cpf text, email text, telefone text, data_nascimento date, genero text, foto_url text, matricula text, unidade text, total_vinculos bigint, ultimo_plano text, ultimo_plano_data text, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql
AS $function$DECLARE
    v_eh_global boolean;
    v_unidade_efetiva text;
    v_uni_acento text;
    v_uni_sem_acento text;
    v_busca_limpa text;
    v_busca_numeros text;
    v_offset integer;
    v_papel text := public.seg_papel();            -- MENTOR: papel conferido no banco
    v_permitidas text[] := NULL;                     -- MENTOR: unidades dele (NULL = sem limite)
BEGIN
    -- MENTOR (1): a tela não decide sozinha quem é global
    v_eh_global := upper(trim(coalesce(p_role_usuario, ''))) IN ('ADMIN', 'MENTOR')
                   AND coalesce(v_papel, '') IN ('ADMIN', 'MENTOR');

    -- MENTOR (2): sem unidade marcada, nada
    IF v_papel = 'MENTOR' THEN
        v_permitidas := public.seg_minhas_unidades();
        IF coalesce(cardinality(v_permitidas), 0) = 0 THEN
            RETURN;
        END IF;
    END IF;

    IF v_eh_global THEN
        v_unidade_efetiva := upper(trim(coalesce(p_unidade, 'TODAS')));
        IF v_unidade_efetiva = '' OR v_unidade_efetiva = 'TODOS' OR v_unidade_efetiva LIKE '%GLOBAL%' THEN
            v_unidade_efetiva := 'TODAS';
        END IF;
    ELSE
        v_unidade_efetiva := upper(trim(coalesce(p_unidade_usuario, '')));
        IF v_unidade_efetiva = '' THEN
            RETURN;
        END IF;
    END IF;

    -- MENTOR (2): unidade escolhida precisa ser uma das dele
    IF v_permitidas IS NOT NULL AND v_unidade_efetiva <> 'TODAS'
       AND NOT (public.seg_normalizar(v_unidade_efetiva) = ANY (v_permitidas)) THEN
        RETURN;
    END IF;

    v_uni_acento := replace(v_unidade_efetiva, 'INES', 'INÊS');
    v_uni_sem_acento := replace(v_unidade_efetiva, 'INÊS', 'INES');

    v_busca_limpa := public.f_unaccent_upper(trim(coalesce(p_busca, ''))::text);
    v_busca_limpa := regexp_replace(v_busca_limpa, '^#', '');
    v_busca_numeros := regexp_replace(coalesce(p_busca, ''), '\D', '', 'g');

    IF length(v_busca_numeros) IN (12, 13) AND left(v_busca_numeros, 2) = '55' THEN
        v_busca_numeros := substring(v_busca_numeros FROM 3);
    END IF;

    v_offset := greatest(0, (coalesce(p_pagina, 1) - 1) * coalesce(p_limite, 25));

    RETURN QUERY
    WITH base_alunos AS (
        SELECT
            a.id,
            a.nome::text AS nome,
            a.cpf::text AS cpf,
            a.email::text AS email,
            a.telefone::text AS telefone,
            a.data_nascimento,
            coalesce(a.genero, a.sexo, '')::text AS genero,
            a.foto_url::text AS foto_url,
            coalesce(nullif(trim(vinc.matricula_local::text), ''), nullif(trim(a.matricula::text), ''), '')::text AS matricula_final,
            coalesce(nullif(trim(vinc.unidade_local::text), ''), 'SEM VÍNCULO')::text AS unidade_final,
            coalesce(vinc.qtd_vinculos, 0)::bigint AS total_vinculos,
            a.created_at
        FROM public.alunos a
        LEFT JOIN LATERAL (
            SELECT
                (array_agg(au.matricula::text ORDER BY
                    CASE WHEN v_unidade_efetiva <> 'TODAS' AND upper(trim(au.unidade::text)) IN (v_unidade_efetiva, v_uni_acento, v_uni_sem_acento) THEN 0 ELSE 1 END,
                    au.id DESC
                ))[1] AS matricula_local,
                (array_agg(au.unidade::text ORDER BY
                    CASE WHEN v_unidade_efetiva <> 'TODAS' AND upper(trim(au.unidade::text)) IN (v_unidade_efetiva, v_uni_acento, v_uni_sem_acento) THEN 0 ELSE 1 END,
                    au.id DESC
                ))[1] AS unidade_local,
                count(*)::bigint AS qtd_vinculos,
                bool_or(upper(trim(au.unidade::text)) IN (v_unidade_efetiva, v_uni_acento, v_uni_sem_acento)) AS pertence_unidade_alvo,
                array_agg(public.seg_normalizar(au.unidade::text)) AS unidades_norm   -- MENTOR (3)
            FROM public.alunos_unidades au
            WHERE au.aluno_id = a.id
        ) vinc ON true
        WHERE
            (
                -- MENTOR (3): "Todas as minhas unidades" sem busca = só as unidades dele
                (v_unidade_efetiva = 'TODAS'
                 AND (v_permitidas IS NULL OR v_busca_limpa <> '' OR v_busca_numeros <> '' OR vinc.unidades_norm && v_permitidas))
                OR vinc.pertence_unidade_alvo = true
            )
            AND (p_data_inicio IS NULL OR a.created_at::date >= p_data_inicio)
            AND (p_data_fim IS NULL OR a.created_at::date <= p_data_fim)
            AND (
                v_busca_limpa = ''
                -- 🔥 VELOCIDADE DA LUZ: Sem curinga inicial ('%'). Permite Index Scan.
                OR public.f_unaccent_upper(a.nome::text) LIKE replace(v_busca_limpa, ' ', '%') || '%'
                OR lower(coalesce(a.email::text, '')) LIKE lower(trim(p_busca)) || '%'
                OR trim(coalesce(vinc.matricula_local::text, a.matricula::text, '')) ILIKE v_busca_limpa || '%'
                OR (
                    v_busca_numeros <> ''
                    AND (
                        regexp_replace(coalesce(a.cpf::text, ''), '\D', '', 'g') LIKE v_busca_numeros || '%'
                        OR regexp_replace(coalesce(a.telefone::text, ''), '\D', '', 'g') LIKE v_busca_numeros || '%'
                        OR trim(coalesce(vinc.matricula_local::text, a.matricula::text, '')) LIKE v_busca_numeros || '%'
                    )
                )
            )
    ),
    alunos_com_plano AS (
        SELECT
            ba.*,
            ult_venda.produto::text AS ultimo_plano,
            ult_venda.data_venda::text AS ultimo_plano_data
        FROM base_alunos ba
        LEFT JOIN LATERAL (
            SELECT
                v.produto::text AS produto,
                coalesce(v.data::text, left(v.created_at::text, 10))::text AS data_venda
            FROM public.vendas v
            LEFT JOIN public.catalogo cat
                ON public.f_unaccent_upper(cat.nome::text) = public.f_unaccent_upper(v.produto::text)
            WHERE
                (
                    (
                        length(regexp_replace(coalesce(ba.cpf, ''), '\D', '', 'g')) = 11
                        AND regexp_replace(coalesce(v.cpf::text, ''), '\D', '', 'g') = regexp_replace(ba.cpf, '\D', '', 'g')
                    )
                    OR (
                        ba.matricula_final <> ''
                        AND ba.matricula_final <> 'VISITANTE'
                        AND trim(coalesce(v.matricula::text, '')) = ba.matricula_final
                        AND (v_unidade_efetiva = 'TODAS' OR upper(trim(coalesce(v.unidade::text, ''))) IN (v_unidade_efetiva, v_uni_acento, v_uni_sem_acento))
                    )
                )
                AND coalesce(lower(trim(cat.tipo::text)), 'plano') = 'plano'
                AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%DIARIA%'
                AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%AVALIACAO%'
                AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%TAXA%'
            ORDER BY coalesce(v.data::text, left(v.created_at::text, 10)) DESC, v.id DESC
            LIMIT 1
        ) ult_venda ON true
        WHERE
            coalesce(upper(trim(p_plano)), 'TODOS') IN ('TODOS', '')
            OR (upper(trim(p_plano)) = 'SEM_PLANO' AND ult_venda.produto IS NULL)
            OR (upper(trim(p_plano)) <> 'SEM_PLANO' AND public.f_unaccent_upper(ult_venda.produto::text) = public.f_unaccent_upper(p_plano::text))
    )
    SELECT
        acp.id,
        acp.nome::text,
        acp.cpf::text,
        acp.email::text,
        acp.telefone::text,
        acp.data_nascimento,
        acp.genero::text,
        acp.foto_url::text,
        acp.matricula_final::text AS matricula,
        acp.unidade_final::text AS unidade,
        acp.total_vinculos::bigint,
        acp.ultimo_plano::text,
        acp.ultimo_plano_data::text,
        acp.created_at,
        count(*) OVER()::bigint AS total_count
    FROM alunos_com_plano acp
    ORDER BY
        -- 🔥 ORDENAÇÃO INTELIGENTE (Prioridade 0 para quem começa com a palavra/número buscado)
        CASE
            WHEN v_busca_limpa <> '' AND public.f_unaccent_upper(acp.nome::text) LIKE v_busca_limpa || '%' THEN 0
            WHEN v_busca_numeros <> '' AND regexp_replace(coalesce(acp.cpf::text, ''), '\D', '', 'g') LIKE v_busca_numeros || '%' THEN 0
            WHEN v_busca_limpa <> '' THEN 1
            ELSE 0
        END ASC,
        -- Restante das regras de ordenação normais das colunas
        CASE WHEN lower(p_ordem_coluna) = 'nome' AND upper(p_ordem_direcao) = 'ASC' THEN public.f_unaccent_upper(acp.nome::text) END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'nome' AND upper(p_ordem_direcao) = 'DESC' THEN public.f_unaccent_upper(acp.nome::text) END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'cpf' AND upper(p_ordem_direcao) = 'ASC' THEN acp.cpf END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'cpf' AND upper(p_ordem_direcao) = 'DESC' THEN acp.cpf END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'email' AND upper(p_ordem_direcao) = 'ASC' THEN lower(coalesce(acp.email, '')) END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'email' AND upper(p_ordem_direcao) = 'DESC' THEN lower(coalesce(acp.email, '')) END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'telefone' AND upper(p_ordem_direcao) = 'ASC' THEN acp.telefone END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'telefone' AND upper(p_ordem_direcao) = 'DESC' THEN acp.telefone END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'unidade' AND upper(p_ordem_direcao) = 'ASC' THEN acp.unidade_final END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'unidade' AND upper(p_ordem_direcao) = 'DESC' THEN acp.unidade_final END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'plano' AND upper(p_ordem_direcao) = 'ASC' THEN coalesce(acp.ultimo_plano, 'ZZZZ') END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'plano' AND upper(p_ordem_direcao) = 'DESC' THEN coalesce(acp.ultimo_plano, '') END DESC,
        CASE WHEN lower(p_ordem_coluna) = 'cadastro' AND upper(p_ordem_direcao) = 'ASC' THEN acp.created_at END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'cadastro' AND upper(p_ordem_direcao) = 'DESC' THEN acp.created_at END DESC,
        public.f_unaccent_upper(acp.nome::text) ASC
    LIMIT coalesce(p_limite, 25)
    OFFSET v_offset;
END;$function$;

notify pgrst, 'reload schema';
