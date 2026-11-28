-- DESFAZER o passo 2. Mexe só em quem o passo 2 mudou (pelo registro no histórico do contato).

-- a) Telefones consertados em massa: voltam o telefone e o CPF de antes
update public.leads l set telefone = b.telefone, cpf = b.cpf
from public.leads_backup_20261127_tel2 b
where b.id = l.id and exists (select 1 from public.historico_leads h
    where h.lead_id = l.id::text and h.observacao like 'Telefone corrigido em massa (27/11/2026)%');

-- b) Quem foi separado: volta fase, CPF e demais campos
update public.leads l set status = b.status, motivo_perda = b.motivo_perda, perdido_em = b.perdido_em,
    proximo_contato = b.proximo_contato, puxado_em = b.puxado_em, puxado_por = b.puxado_por, cpf = b.cpf
from public.leads_backup_20261127_tel2 b
where b.id = l.id and l.status = 'Arquivado' and l.motivo_perda = 'Telefone com problema'
  and exists (select 1 from public.historico_leads h
    where h.lead_id = l.id::text and h.observacao like 'Saiu da fila: telefone com problema (separação em massa%');

select status, count(*) from public.leads group by status order by 2 desc;
