-- DESFAZER o passo 2: devolve fase, CPF e demais campos de quem foi separado por telefone.
update public.leads l set status = b.status, motivo_perda = b.motivo_perda, perdido_em = b.perdido_em,
    proximo_contato = b.proximo_contato, puxado_em = b.puxado_em, puxado_por = b.puxado_por, cpf = b.cpf
from public.leads_backup_20261127_tel b
where b.id = l.id and l.status = 'Arquivado' and l.motivo_perda = 'Telefone com problema';

select status, count(*) from public.leads group by status order by 2 desc;
