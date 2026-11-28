-- SÓ LEITURA: o passo 2 rodou, não rodou ou ainda está rodando?
select
    (select count(*) from pg_stat_activity
      where state = 'active' and pid <> pg_backend_pid() and query ilike '%leads_backup_20261127_tel2%') as ainda_rodando,
    to_regclass('public.leads_backup_20261127_tel2') is not null as copia_criada,
    count(*) filter (where observacao like 'Telefone corrigido em massa%') as consertados,
    count(*) filter (where observacao like 'Saiu da fila: telefone com problema (separação em massa%') as separados
from public.historico_leads
where tipo_acao = 'Reciclagem';
