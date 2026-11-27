-- =====================================================================
-- DESFAZER: desliga as travas e devolve a fase que cada contato arquivado tinha antes.
-- Não apaga as cópias de segurança nem as colunas novas.
-- =====================================================================
drop trigger if exists nc_travar_contato_gatilho on public.leads;
drop trigger if exists nc_aplicar_nos_contatos_gatilho on public.crm_nao_contatar;
drop trigger if exists nc_guardar_telefones_gatilho on public.crm_nao_contatar;

update public.leads l
set status = b.status, proximo_contato = b.proximo_contato, bloqueado_nc = false
from public.leads_backup_20261127 b
where b.id = l.id and l.bloqueado_nc and l.status = 'Arquivado';

select status, count(*) from public.leads group by status order by 2 desc;
