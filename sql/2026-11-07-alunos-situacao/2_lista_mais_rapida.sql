-- =====================================================================
-- CENTRAL DE ALUNOS: LISTA MAIS RÁPIDA — PASSO 2 (07/11/2026; rode depois do 1)
-- Problema: com "Todo o período" + todas as unidades, a lista dava erro 500 (o banco desiste depois do tempo
-- máximo: "canceling statement due to statement timeout"). Para cada um dos ~22 mil alunos a função varria
-- as vendas de novo atrás do último plano.
-- Correção: as vendas de plano são lidas UMA vez só e o último plano de cada CPF/matrícula é encaixado no aluno
-- (blocos marcados "RÁPIDA"). O resultado é o mesmo; o resto da função (Mentor, busca, situação) não muda.
-- Mesma lista de colunas: troca por cima, sem apagar. Desfazer: rodar de novo o 1_lista_com_situacao.sql.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.listar_alunos_360(p_busca text DEFAULT ''::text, p_unidade text DEFAULT 'TODAS'::text, p_plano text DEFAULT 'TODOS'::text, p_data_inicio date DEFAULT NULL::date, p_data_fim date DEFAULT NULL::date, p_ordem_coluna text DEFAULT 'nome'::text, p_ordem_direcao text DEFAULT 'ASC'::text, p_pagina integer DEFAULT 1, p_limite integer DEFAULT 25, p_role_usuario text DEFAULT 'RECEPCAO'::text, p_unidade_usuario text DEFAULT ''::text, p_situacao text DEFAULT 'TODAS'::text)
 RETURNS TABLE(id uuid, nome text, cpf text, email text, telefone text, data_nascimento date, genero text, foto_url text, matricula text, unidade text, total_vinculos bigint, ultimo_plano text, ultimo_plano_data text, created_at timestamp with time zone, situacao text, situacao_desde timestamp with time zone, total_count bigint)
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
            a.created_at,
            upper(trim(coalesce(a.status_aluno::text, '')))::text AS situacao,   -- SITUAÇÃO (07/11/2026)
            a.status_atualizado_em AS situacao_desde
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
            -- SITUAÇÃO (07/11/2026): TODAS · ATIVOS (ATIVO/CLIENTE) · NAO_ATIVOS (as outras) · SEM (nunca importado) · ou o nome exato
            AND (
                upper(trim(coalesce(p_situacao, 'TODAS'))) IN ('TODAS', 'TODOS', '')
                OR (upper(trim(p_situacao)) = 'ATIVOS' AND upper(trim(coalesce(a.status_aluno::text, ''))) IN ('ATIVO', 'CLIENTE'))
                OR (upper(trim(p_situacao)) = 'NAO_ATIVOS' AND upper(trim(coalesce(a.status_aluno::text, ''))) NOT IN ('', 'ATIVO', 'CLIENTE'))
                OR (upper(trim(p_situacao)) = 'SEM' AND trim(coalesce(a.status_aluno::text, '')) = '')
                OR upper(trim(coalesce(a.status_aluno::text, ''))) = upper(trim(p_situacao))
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
    -- RÁPIDA (07/11/2026): as vendas de plano são lidas UMA vez só (antes era uma varredura por aluno,
    -- e com "Todo o período" + todas as unidades o banco desistia por tempo). Mesmo resultado de antes:
    -- último plano pelo CPF ou pela matrícula (na unidade escolhida; em "Todas", qualquer unidade), o mais recente.
    vendas_planos AS (
        SELECT
            v.id AS venda_id,
            v.produto::text AS produto,
            coalesce(v.data::text, left(v.created_at::text, 10))::text AS data_venda,
            regexp_replace(coalesce(v.cpf::text, ''), '\D', '', 'g') AS cpf_digitos,
            trim(coalesce(v.matricula::text, '')) AS matricula_venda,
            upper(trim(coalesce(v.unidade::text, ''))) AS unidade_venda
        FROM public.vendas v
        LEFT JOIN public.catalogo cat
            ON public.f_unaccent_upper(cat.nome::text) = public.f_unaccent_upper(v.produto::text)
        WHERE coalesce(lower(trim(cat.tipo::text)), 'plano') = 'plano'
          AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%DIARIA%'
          AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%AVALIACAO%'
          AND public.f_unaccent_upper(v.produto::text) NOT LIKE '%TAXA%'
    ),
    ultima_por_cpf AS (
        SELECT DISTINCT ON (vp.cpf_digitos) vp.cpf_digitos, vp.produto, vp.data_venda, vp.venda_id
        FROM vendas_planos vp
        WHERE length(vp.cpf_digitos) = 11
        ORDER BY vp.cpf_digitos, vp.data_venda DESC, vp.venda_id DESC
    ),
    ultima_por_matricula AS (
        SELECT DISTINCT ON (vp.matricula_venda) vp.matricula_venda, vp.produto, vp.data_venda, vp.venda_id
        FROM vendas_planos vp
        WHERE vp.matricula_venda <> ''
          AND (v_unidade_efetiva = 'TODAS' OR vp.unidade_venda IN (v_unidade_efetiva, v_uni_acento, v_uni_sem_acento))
        ORDER BY vp.matricula_venda, vp.data_venda DESC, vp.venda_id DESC
    ),
    alunos_com_plano AS (
        SELECT
            ba.*,
            esc.produto::text AS ultimo_plano,
            esc.data_venda::text AS ultimo_plano_data
        FROM base_alunos ba
        LEFT JOIN ultima_por_cpf uc
            ON length(regexp_replace(coalesce(ba.cpf, ''), '\D', '', 'g')) = 11
           AND uc.cpf_digitos = regexp_replace(ba.cpf, '\D', '', 'g')
        LEFT JOIN ultima_por_matricula um
            ON ba.matricula_final <> ''
           AND ba.matricula_final <> 'VISITANTE'
           AND um.matricula_venda = ba.matricula_final
        CROSS JOIN LATERAL (
            SELECT
                CASE WHEN um.venda_id IS NOT NULL AND (uc.venda_id IS NULL OR (um.data_venda, um.venda_id) > (uc.data_venda, uc.venda_id))
                     THEN um.produto ELSE uc.produto END AS produto,
                CASE WHEN um.venda_id IS NOT NULL AND (uc.venda_id IS NULL OR (um.data_venda, um.venda_id) > (uc.data_venda, uc.venda_id))
                     THEN um.data_venda ELSE uc.data_venda END AS data_venda
        ) esc
        WHERE
            coalesce(upper(trim(p_plano)), 'TODOS') IN ('TODOS', '')
            OR (upper(trim(p_plano)) = 'SEM_PLANO' AND esc.produto IS NULL)
            OR (upper(trim(p_plano)) <> 'SEM_PLANO' AND public.f_unaccent_upper(esc.produto::text) = public.f_unaccent_upper(p_plano::text))
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
        acp.situacao::text,
        acp.situacao_desde,
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
        CASE WHEN lower(p_ordem_coluna) = 'situacao' AND upper(p_ordem_direcao) = 'ASC' THEN coalesce(nullif(acp.situacao, ''), 'ZZZZ') END ASC,
        CASE WHEN lower(p_ordem_coluna) = 'situacao' AND upper(p_ordem_direcao) = 'DESC' THEN acp.situacao END DESC,
        public.f_unaccent_upper(acp.nome::text) ASC
    LIMIT coalesce(p_limite, 25)
    OFFSET v_offset;
END;$function$;



notify pgrst, 'reload schema';

-- Conferência (deve voltar o total de alunos e terminar em poucos segundos):
select count(*) as linhas, max(total_count) as total from public.listar_alunos_360('', 'TODAS', 'TODOS', null, null, 'nome', 'ASC', 1, 25, 'ADMIN', '', 'TODAS');
