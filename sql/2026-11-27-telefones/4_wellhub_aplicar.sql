-- =====================================================================
-- WELLHUB — APLICAR. SÓ RODAR depois da prévia (3) conferida e de separar os telefones (2).
-- Vão para a aba Migração, grupo WELLHUB / GYMPASS (fase Novo, sem recepcionista). Nada é apagado.
-- =====================================================================
create table if not exists public.leads_backup_20261127_hub as select * from public.leads;
alter table public.leads_backup_20261127_hub enable row level security;

with movidos as (
    update public.leads set status = 'Novo', tipo_lead = 'WELLHUB', puxado_em = null, puxado_por = null,
        perdido_em = null, motivo_perda = null, proximo_contato = null
    where status = 'Perdido' and motivo_perda like 'Outro:%' and motivo_perda ~* '(w.{0,4}l+h?u+b|gym *pass|^outro: *ellhub)'
    returning id
)
insert into public.historico_leads (lead_id, tipo_acao, consultor, observacao)
select id::text, 'Reciclagem', 'Sistema', 'Foi para o grupo WELLHUB / GYMPASS da aba Migração (estava escrito no motivo da perda).' from movidos;

select 'NO GRUPO WELLHUB' as o_que, count(*) as contatos from public.leads where tipo_lead = 'WELLHUB' and status = 'Novo' and puxado_por is null;
