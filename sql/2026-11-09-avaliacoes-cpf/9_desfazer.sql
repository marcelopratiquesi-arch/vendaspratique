-- DESFAZER o passo 1 (09/11/2026): volta o CPF de cada avaliação ao que estava na cópia do passo 0.
-- Se a cópia não tinha o campo cpf (ele foi criado no passo 1), o CPF volta a ficar vazio.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'avaliacoes_realizadas_backup_20261109' and column_name = 'cpf') then
    update public.avaliacoes_realizadas av
       set cpf = b.cpf
      from public.avaliacoes_realizadas_backup_20261109 b
     where b.id = av.id;
  else
    update public.avaliacoes_realizadas set cpf = null where cpf is not null;
  end if;
end $$;
