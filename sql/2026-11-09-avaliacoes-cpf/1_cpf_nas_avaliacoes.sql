-- PASSO 1 — CPF nas avaliações (09/11/2026)
-- Por quê: a avaliação era gravada sem o CPF do aluno, então a busca por CPF das telas da Avaliação não achava nada.
-- O sistema já passou a gravar o CPF nas avaliações novas. Este passo:
--   (a) cria o campo cpf, se ainda não existir;
--   (b) preenche o CPF das avaliações antigas pelo cadastro do aluno (aluno_id), só onde está vazio.
-- Não mexe em vendas, comissão, peso, medidas nem respostas.
-- ATENÇÃO: rodar FORA do horário de movimento (muitas linhas de uma vez mandam avisos para as telas abertas).

alter table public.avaliacoes_realizadas add column if not exists cpf text;

update public.avaliacoes_realizadas av
   set cpf = regexp_replace(al.cpf::text, '\D', '', 'g')
  from public.alunos al
 where al.id::text = av.aluno_id::text
   and coalesce(av.cpf, '') = ''
   and length(regexp_replace(coalesce(al.cpf::text, ''), '\D', '', 'g')) = 11;

-- Conferência: quantas avaliações ficaram com CPF e quantas sem
select count(*) as total,
       count(*) filter (where coalesce(cpf, '') <> '') as com_cpf,
       count(*) filter (where coalesce(cpf, '') = '') as sem_cpf
  from public.avaliacoes_realizadas;
