-- ============================================================
-- CRM: MIGRAÇÃO / RESGATE / WELLHUB NO FUNIL — passo 1 (decisão do dono, 16/11/2026)
-- Os alunos puxados na Migração e no Resgate agora viram contatos do funil (coluna Novo) com a etiqueta do tipo:
--   MIGRACAO · RESGATE · WELLHUB (cliente Wellhub / Gympass, a quem se oferece só o Nutri).
-- Se a tabela leads tiver uma trava (check) que limita os valores de tipo_lead, ela passa a aceitar também
-- RESGATE e WELLHUB. Se NÃO houver trava, este passo não muda nada.
-- Não apaga nem muda nenhum contato (a trava nova é criada "not valid": só vale para o que for gravado daqui para frente).
-- Antes: 0_copia_de_seguranca.sql. Desfazer: 9_desfazer.sql.
-- Como rodar: Supabase → SQL Editor → colar tudo → Run.
-- ============================================================

do $$
declare
  r record;
  achou boolean := false;
begin
  -- procura as travas (check) da tabela leads que falam do campo tipo_lead
  for r in
    select conname::text as nome
    from pg_constraint
    where conrelid = 'public.leads'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo_lead%'
  loop
    execute format('alter table public.leads drop constraint %I', r.nome);
    achou := true;
  end loop;

  if achou then
    alter table public.leads add constraint leads_tipo_lead_valido
      check (tipo_lead is null or upper(tipo_lead) in (
        'VISITANTE', 'CANCELADO', 'INATIVO', 'CANCELADO/INATIVO', 'MIGRACAO', 'RESGATE', 'WELLHUB'
      )) not valid;
  end if;
end $$;

-- Conferência: as travas atuais da tabela leads (se não aparecer nenhuma de tipo_lead, não havia trava e está tudo certo)
select conname::text as nome, pg_get_constraintdef(oid) as definicao
from pg_constraint
where conrelid = 'public.leads'::regclass and contype = 'c';

notify pgrst, 'reload schema';
