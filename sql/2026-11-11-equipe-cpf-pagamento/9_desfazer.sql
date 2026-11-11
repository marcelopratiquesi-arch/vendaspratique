-- =====================================================================
-- DESFAZER (só em emergência). Volta o banco a como era antes dos passos 1 a 3.
-- ⚠️ Tira a trava dos pagamentos aprovados. A tabela comissoes_pagamentos NÃO é apagada (fica o histórico
--    de quem aprovou o quê); para apagar de vez, tire o "--" da última linha.
-- Valores e comissões das vendas não foram mudados por estes passos, então não há o que restaurar neles.
-- =====================================================================
drop trigger if exists vendas_trava_pagamento_gatilho on public.vendas;
drop function if exists public.vendas_trava_pagamento();
drop function if exists public.comissao_aprovar_pagamento(text, text);
drop function if exists public.comissao_reabrir_pagamento(bigint, text);

drop trigger if exists vendas_cpf_vendedor_gatilho on public.vendas;
drop function if exists public.vendas_preencher_cpf_vendedor();
drop function if exists public.equipe_cpf_do_nome(text, text);
drop index if exists public.vendas_vendedor_cpf_idx;
alter table public.vendas drop column if exists vendedor_cpf;

alter table public.colaboradores drop column if exists desligado_em;
alter table public.colaboradores drop column if exists motivo_desligamento;

-- drop table if exists public.comissoes_pagamentos;
