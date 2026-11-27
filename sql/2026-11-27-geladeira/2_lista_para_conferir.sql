-- =====================================================================
-- SÓ LEITURA: não muda nada (27/11/2026, decisões 1-B e 2-A do dono).
-- Lista com nome e telefone para a EQUIPE conferir. Tem dado pessoal: use Export no SQL Editor,
-- guarde no computador e NÃO envie em conversa, grupo ou GitHub.
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
select grupo, unidade, nome, telefone, motivo_perda as anotacao, puxado_por as recepcionista, perdido_em::date as quando
from perdidos
order by grupo, unidade, perdido_em desc;
