-- =====================================================================
-- PASSO 2 — SEPARA OS TELEFONES ESTRAGADOS. SÓ RODAR depois que a prévia do passo 1 for conferida.
-- Rode FORA do horário de movimento se possível (muda milhares de contatos: as telas abertas recarregam).
-- Nada é apagado. Desfazer: 9_desfazer.sql. Não mexe em vendas nem comissão.
-- =====================================================================

-- a) CPF que estava no lugar do telefone volta para o campo CPF (assim a lista do TECACE reconhece a pessoa)
with candidatos as (
    select id, regexp_replace(substring(telefone from '\d{3}\.\d{3}\.\d{3}-\d{2}'), '\D', '', 'g') as novo_cpf
    from public.leads
    where coalesce(trim(cpf), '') = '' and telefone ~ '\d{3}\.\d{3}\.\d{3}-\d{2}' and status <> 'Arquivado'
),
unicos as (
    select c.id, c.novo_cpf from candidatos c
    where (select count(*) from candidatos o where o.novo_cpf = c.novo_cpf) = 1
      and not exists (select 1 from public.leads l where regexp_replace(coalesce(l.cpf, ''), '\D', '', 'g') = c.novo_cpf)
)
update public.leads l set cpf = u.novo_cpf from unicos u where l.id = u.id;

-- b) Telefone estragado sai da fila: "Fora da fila > Telefone com problema" (não bloqueia ninguém)
with movidos as (
    update public.leads set status = 'Arquivado', motivo_perda = 'Telefone com problema',
        perdido_em = null, proximo_contato = null, puxado_em = null, puxado_por = null
    where status in ('Novo', 'Em Contato', 'Perdido') and not public.crm_telefone_utilizavel(telefone)
    returning id
)
insert into public.historico_leads (lead_id, tipo_acao, consultor, observacao)
select id::text, 'Reciclagem', 'Sistema', 'Saiu da fila: telefone com problema (separação em massa de 27/11/2026).' from movidos;

-- Conferência: o TOTAL antes e agora precisa ser igual (ou maior, se entrou contato novo)
select 'TOTAL' as o_que, (select count(*) from public.leads_backup_20261127_tel) as antes, (select count(*) from public.leads) as agora
union all
select 'FORA DA FILA (telefone)', null, count(*) from public.leads where status = 'Arquivado' and motivo_perda = 'Telefone com problema';
