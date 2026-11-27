-- =====================================================================
-- SÓ LEITURA: não muda nada (27/11/2026, decisões 1-B e 2-A do dono).
-- Resumo SEM dados pessoais: pode mandar o print para o Claude.
-- =====================================================================
with perdidos as (
    select id, nome, unidade, telefone, motivo_perda, puxado_por, perdido_em,
           regexp_replace(coalesce(telefone, ''), '\D', '', 'g') as num,
           case when motivo_perda ~* '(w.{0,3}l+h?u+b|gym *pass)' then 'WELLHUB'
                when motivo_perda ~* '(ina?v.{0,2}li|inalido|invaido|n(ã|a)o +cham|n +chama|nem +cham|m(ã|a)o +chama|n(ã|a)o +est.{1,3} +chama|inexist|(n(ã|a)o|n) +exist|n(ã|a)o +(est.{1,3} +)?cadastrad|bloq|n(u|ú)mero +errado|sem +n(u|ú)mero|sem +contato|n(ã|a)o +tem +n(u|ú)mero|n(ã|a)o +disca|nem +discando)' then 'NUMERO COM PROBLEMA'
                else 'OUTRO ASSUNTO' end as grupo
    from public.leads
    where status = 'Perdido' and motivo_perda like 'Outro:%'
)
select grupo, unidade, count(*) as contatos,
       count(*) filter (where length(num) not in (10, 11, 12, 13)) as numero_incompleto,
       count(*) filter (where motivo_perda ~* 'cancelad|disca') as fala_de_falha_geral,
       min(perdido_em)::date as primeira_anotacao,
       max(perdido_em)::date as ultima_anotacao
from perdidos
group by grupo, unidade
order by grupo, contatos desc;
