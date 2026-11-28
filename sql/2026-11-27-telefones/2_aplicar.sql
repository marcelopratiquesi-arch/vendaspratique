-- =====================================================================
-- PASSO 2 — CONSERTA OS TELEFONES E SEPARA OS QUE NÃO TÊM CONSERTO. MUDA DADOS.
-- SÓ RODAR depois que a prévia do passo 1c for conferida.
-- Rode FORA do horário de movimento (muda milhares de contatos: as telas abertas recarregam).
-- Nada é apagado. Desfazer: 9_desfazer.sql. Não mexe em vendas nem comissão.
-- =====================================================================

-- 0) Cópia NOVA, de agora (a do passo 1 já está velha)
create table if not exists public.leads_backup_20261127_tel2 as select * from public.leads;
alter table public.leads_backup_20261127_tel2 enable row level security;

-- a) Conserta quem tem o número guardado em outro lugar (campo CPF, ou dois telefones no mesmo campo).
--    Quem tem outro contato com o MESMO nome e o MESMO número é repetido: não é consertado (sai no passo c).
with ruins as (
    select id, unidade, upper(trim(coalesce(nome, ''))) as quem, telefone, cpf,
           public.crm_telefone_sugerido(telefone, cpf) as numero
    from public.leads
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
),
existentes as (
    select distinct unidade, upper(trim(coalesce(nome, ''))) as quem,
        regexp_replace(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), '^55(\d{10,11})$', '\1') as numero
    from public.leads where status <> 'Arquivado' and public.crm_telefone_utilizavel(telefone)
),
marcados as (
    select r.*, row_number() over (partition by r.unidade, r.quem, r.numero order by r.id) as vez
    from ruins r where r.numero is not null
),
consertar as (
    select m.id, m.numero, m.telefone as telefone_antigo,
        m.numero = regexp_replace(regexp_replace(coalesce(m.cpf, ''), '\D', '', 'g'), '^55(\d{10,11})$', '\1') as veio_do_cpf
    from marcados m
    where m.vez = 1
      and not exists (select 1 from existentes e where e.unidade = m.unidade and e.quem = m.quem and e.numero = m.numero)
),
feitos as (
    update public.leads l set telefone = c.numero, cpf = case when c.veio_do_cpf then null else l.cpf end
    from consertar c where c.id = l.id
    returning l.id, c.numero, c.telefone_antigo, c.veio_do_cpf
)
insert into public.historico_leads (lead_id, tipo_acao, consultor, observacao)
select id::text, 'Reciclagem', 'Sistema',
    'Telefone corrigido em massa (27/11/2026): de "' || coalesce(telefone_antigo, '') || '" para "' || numero || '"'
    || case when veio_do_cpf then ' (o número estava no campo CPF).' else ' (havia dois telefones).' end
from feitos;

-- b) CPF que estava no lugar do telefone volta para o campo CPF (assim a lista do TECACE reconhece a pessoa)
with candidatos as (
    select id, regexp_replace(substring(telefone from '\d{3}\.\d{3}\.\d{3}-\d{2}'), '\D', '', 'g') as novo_cpf
    from public.leads
    where coalesce(trim(cpf), '') = '' and telefone ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' and status <> 'Arquivado'
      and not public.crm_telefone_utilizavel(telefone)
),
unicos as (
    select c.id, c.novo_cpf from candidatos c
    where (select count(*) from candidatos o where o.novo_cpf = c.novo_cpf) = 1
      and not exists (select 1 from public.leads l where regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g') = c.novo_cpf)
)
update public.leads l set cpf = u.novo_cpf from unicos u where l.id = u.id;

-- c) O que continua estragado sai da fila: "Fora da fila > Telefone com problema" (não bloqueia ninguém)
with movidos as (
    update public.leads set status = 'Arquivado', motivo_perda = 'Telefone com problema',
        perdido_em = null, proximo_contato = null, puxado_em = null, puxado_por = null
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
    returning id
)
insert into public.historico_leads (lead_id, tipo_acao, consultor, observacao)
select id::text, 'Reciclagem', 'Sistema', 'Saiu da fila: telefone com problema (separação em massa de 27/11/2026).' from movidos;

-- Conferência: o TOTAL antes e agora precisa ser igual (ou maior, se entrou contato novo)
select 'TOTAL DE CONTATOS' as o_que, (select count(*) from public.leads_backup_20261127_tel2) as antes, (select count(*) from public.leads) as agora
union all
select 'TELEFONES CONSERTADOS', null, count(distinct lead_id) from public.historico_leads where observacao like 'Telefone corrigido em massa (27/11/2026)%'
union all
select 'FORA DA FILA (telefone)', null, count(*) from public.leads where status = 'Arquivado' and motivo_perda = 'Telefone com problema'
union all
select 'AINDA NA FILA COM TELEFONE ESTRAGADO', null, count(*) from public.leads where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone);
