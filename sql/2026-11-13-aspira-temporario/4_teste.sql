-- =====================================================================
-- PASSO 4: TESTE (SÓ LEITURA). Rode depois dos passos 1 a 3. Não muda nada.
-- Mostra, para cada login, o que o banco enxerga: posto, unidades e temporários. Sem temporário cadastrado,
-- a coluna "temporário" fica vazia e o resto deve ser igual ao de antes.
-- =====================================================================

-- 1) Datas (o exemplo do dono): esperado 22/11/2026, 12/01/2027, 26/11/2026, 11/12/2026
select 'dia 13 + 10 dias' as caso, to_char(public.acesso_calcular_vale_ate('10d', null, date '2026-11-13'), 'DD/MM/YYYY') as vale_ate
union all select 'dia 13 + 2 meses', to_char(public.acesso_calcular_vale_ate('2m', null, date '2026-11-13'), 'DD/MM/YYYY')
union all select 'a partir de 12/11 por 15 dias', to_char(public.acesso_calcular_vale_ate('15d', null, date '2026-11-12'), 'DD/MM/YYYY')
union all select 'a partir de 12/11 por 30 dias', to_char(public.acesso_calcular_vale_ate('30d', null, date '2026-11-12'), 'DD/MM/YYYY');

-- 2) Líder e Aspira por unidade
select un.nome as unidade, l.posto, l.nome, l.role
from public.unidades un cross join lateral public.acesso_lider_atual(un.nome) l
where coalesce(un.ativa, true) order by un.nome, l.posto desc;

-- 3) Temporários e o que cada um soma
select t.email, t.nome, t.tipo, array_to_string(t.unidades, ', ') as unidades, to_char(t.vale_ate, 'DD/MM/YYYY') as vale_ate,
       case when t.encerrado_em is not null then 'ENCERRADO' when t.vale_ate < public.acesso_hoje() then 'VENCIDO' else 'VALENDO' end as situacao,
       coalesce(u.role || ' · ' || u.unidade || ' · ' || u.status, '— sem acesso fixo —') as acesso_fixo
from public.acessos_temporarios t
left join public.usuarios_sistema u on lower(trim(u.email)) = lower(t.email)
order by situacao desc, t.vale_ate;

-- 4) Ninguém ficou com dois Líderes no mesmo posto (esperado: nenhuma linha)
select upper(trim(unidade)) as unidade, coalesce(posto, 'TITULAR') as posto, count(*)
from public.usuarios_sistema where upper(role) = 'LIDER' and status = 'ATIVO'
group by 1, 2 having count(*) > 1;
