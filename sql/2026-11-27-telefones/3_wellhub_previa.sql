-- =====================================================================
-- WELLHUB — PRÉVIA (SÓ LEITURA, sem nome nem telefone). 27/11/2026: vão para o grupo Wellhub / Gympass.
-- Mostra cada ESCRITA diferente que será reconhecida e quantos contatos. A última linha diz se o banco
-- aceita o tipo WELLHUB (se disser NAO, rodar antes sql/2026-11-16-crm-wellhub).
-- =====================================================================
select motivo_perda as escrita, unidade, count(*) as contatos
from public.leads where status = 'Perdido' and motivo_perda like 'Outro:%' and motivo_perda ~* '(w.{0,4}l+h?u+b|gym *pass|^outro: *ellhub)'
group by 1, 2
union all
select 'BANCO ACEITA O TIPO WELLHUB?',
       case when exists (select 1 from pg_constraint where conrelid = 'public.leads'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tipo_lead%' and pg_get_constraintdef(oid) not ilike '%WELLHUB%')
            then 'NAO' else 'SIM' end, null
order by 1, 3 desc;
