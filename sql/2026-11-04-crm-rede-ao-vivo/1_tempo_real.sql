-- ============================================================
-- PAINEL DA REDE "AO VIVO" (decisão do dono, 04/11/2026)
-- Liga o aviso em tempo real das tabelas de ações do CRM, para o Painel da Rede mostrar
-- cada ligação / WhatsApp / contato na hora. Não muda nenhum dado nem regra de acesso
-- (cada pessoa continua recebendo só o que pode ver).
-- Como rodar: Supabase → SQL Editor → colar tudo → Run. Pode rodar mais de uma vez.
-- Desfazer: alter publication supabase_realtime drop table public.historico_leads;
--           alter publication supabase_realtime drop table public.crm_contatos_feitos;
-- ============================================================

do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'historico_leads') then
        alter publication supabase_realtime add table public.historico_leads;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_contatos_feitos') then
        alter publication supabase_realtime add table public.crm_contatos_feitos;
    end if;
end $$;

select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename in ('historico_leads', 'crm_contatos_feitos')
order by tablename;
