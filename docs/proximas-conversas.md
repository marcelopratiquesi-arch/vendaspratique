# Roteiro das próximas conversas (escrito em 27/11/2026)

Um assunto por conversa. Em cada uma: ler este arquivo, a memória `queda-disk-io-26-11` e o CLAUDE.md.
Ao terminar um assunto, atualizar o "Estado" dele aqui. **Nunca escrever dados pessoais neste arquivo.**

## Já feito e publicado em 26 e 27/11
- Queda do banco resolvida com 7 índices (`sql/2026-11-26-indices-crm/`).
- "Não contatar": arquiva e bloqueia por telefone (`sql/2026-11-27-nao-contatar/`, passos 1 a 3 rodados: 530 arquivados).
- Caminho das ligações (commit 57e7342): tentativas por ciclo, janela agrupada, aba "Fora da fila", Geladeira de 90 dias automática, telefone estragado não entra e a lista boa corrige.
- Receitas: `checkup-sistema`, `mexer-no-banco`, `publicar` (.claude/skills).

## Correção da tela quebrada (27/11)
`dataBR is not defined` em AbaMigracao.jsx (faltava no import; pontos de 16/11 e 26/11) + regra `no-undef` ligada no `.oxlintrc.json`.
**Estado:** PUBLICADA em 27/11 às 12h20 (commit 8c8b2fe). Falta o dono confirmar na tela logada.

## Conversa 1: Migração e Resgate (reescrever)
**Frase para abrir:** "Leia docs/proximas-conversas.md e vamos fazer a Conversa 1: Migração e Resgate."
- Pedido do dono: deixar Migração e Resgate parecidas com o funil (mesma janela agrupada, mesmos destinos).
- Erros relatados: a tela "reseta" ao buscar, puxar e "Enviar para o CRM". Causa confirmada na Migração: `dataBR`. **No Resgate a causa não foi encontrada: reproduzir e pedir o erro do Console.**
- Erros 409 no console ao puxar: `levarPuxadosParaFunil` insere contato cujo CPF já existe em `leads` (CPF único). Suspeita: contato **Arquivado** (Não contatar, Fora da fila, comprou em outra unidade) é ignorado na busca do existente e nem é baixado; ou o contato é de outra unidade. Confirmar antes de corrigir. Com isso o aluno pode ficar preso na "Minha fila".
- Fazer também: **etiqueta "Vai pensar" e "Interessado"** no contato do funil (decidido pelo dono).
- **Parcela vencida e plano trancado: o dono decidiu NÃO criar essas opções.**
- Não mexer em quem já está na Geladeira por causa da contagem antiga (decidido).
- Regra do projeto: mostrar o plano e esperar aprovação.

**Estado (27/11):** PUBLICADA em 27/11 a pedido do dono. Sem SQL. Build, lint e testes ok; telas não conferidas logado.
Falta conferir depois de publicar: puxar 10 no Resgate e na Migração (sem 409 no Console); "Mais" num aluno antigo; marcar "Vai pensar" no funil e ver a etiqueta; buscar no Resgate. Se resetar de novo: F12 → Console → print da linha vermelha (a causa do reset no Resgate não foi confirmada). Não foi medido no banco quanto pesa cada causa do 409.

## Conversa 2: Telefones estragados e Wellhub
**Frase:** "Leia docs/proximas-conversas.md e vamos fazer a Conversa 2: telefones."
- Passo 1 de `sql/2026-11-27-telefones/` **rodado pelo dono**. **NÃO rodar o passo 2 ainda.**
- Prévia: sairiam 4.745 contatos (Prado 2.792, SI2 1.022, Gutierrez 648, Veneza 81, Eldorado 63, Castelinho 56, SI1 55, Oiapoque 27, Neves 1).
- **Ajustar antes do passo 2:** há campos com **dois telefones** no formato "(99)9999-9999 - (99)99999-9999" (Gutierrez cerca de 541, SI1 39, Prado 5, nas linhas mostradas, que são só os 4 formatos mais comuns por unidade). Escolher o celular utilizável e gravar, em vez de separar.
- **Prado:** 2.545 com formato de CPF no telefone, mas só 297 CPFs (total da rede) voltam para o campo CPF. Investigar (só leitura) por quê: provável CPF já usado por outro contato ou repetido; conferir se são contatos duplicados.
- SI2: 984 com texto no lugar do telefone; recuperar reimportando a lista do TECACE (a correção por CPF já está publicada).
- Depois: `3_wellhub_previa.sql` e `4_wellhub_aplicar.sql`.
- Conferir antes: a Geladeira de 90 dias devolve ao Banco Bruto contatos que podem estar com telefone estragado.

**Estado (27/11, noite):** tela com "Número errado" + "Corrigir número" e não distribuição FEITAS no computador. 1b rodado: 4.565 estragados, 919 com celular no campo CPF, 41 em dúvida. Passo 2 REESCRITO (já trata celular no CPF e dois telefones) e testado em banco de mentira. Falta: publicar, rodar 1c (prévia), conferir, e só então o passo 2 FORA do horário de movimento. Os itens acima sobre "ajustar antes do passo 2" já estão no novo passo 2; falta ainda investigar os CPFs do Prado e os de Wellhub.

**Atualização (27/11, ~21h):** 1c e passo 2 RODADOS e conferidos (1.366 consertados, 3.189 separados, 0 estragados na fila, total 45.534 igual). Telas publicadas em seguida. **Não rodar o passo 2 de novo.** Falta: Wellhub (passos 3 e 4) e investigar os telefones do Prado.

## Conversa 3: Banco Bruto com 300
**Frase:** "Leia docs/proximas-conversas.md e vamos fazer a Conversa 3: Banco Bruto de 300."
Decisões fechadas: baixar no máximo **300 por unidade**, os **mais antigos** (ordem do Distribuir); mostrar "300 disponíveis · X no banco"; repor quando a recepção puxa; **busca no banco inteiro da unidade**; "Dividir igualmente" reparte os 300.
Cuidados: rotinas automáticas dependem da lista completa (`listaCompleta`), aba Wellhub, "comprou plano → Fechado", Geladeira de 90 dias, contagens do topo.

## Conversa 4: Gravação lenta do histórico do CRM
**Frase:** "Leia docs/proximas-conversas.md e vamos fazer a Conversa 4: histórico lento."
Inserir em `historico_leads` leva cerca de 180 ms (mínimo 123), igual antes e depois dos índices. Hipótese (não confirmada): a regra `crm_hist_criar` faz o banco percorrer `leads`. Conferir com EXPLAIN. Também: consultas usam `ilike` em unidade, então `leads_unidade_status_idx` provavelmente não ajuda. Comparar `pg_stat_statements` (zerado em 26/11 22h53). `realtime.list_changes` era 48% do tempo.
Memória: antes da queda o swap ficava em ~700 MB (RAM 434 MB); em 27/11 cedo, ~350 MB. Rodar a receita `checkup-sistema` no horário de movimento.

## Conversa 5: Segurança (Comunicados e avisos do Supabase)
**Frase:** "Leia docs/proximas-conversas.md e vamos fazer a Conversa 5: segurança."
Security Advisor: 1 erro (view `vw_comunicados_metricas` com SECURITY DEFINER: conferir quem consegue ler), 139 avisos (vistos: Function Search Path Mutable) e 49 informações ("RLS Enabled No Policy"). Falta o dono exportar o CSV de Security → Warnings.
Performance Advisor (visto): índices idênticos em `alunos` (idx_alunos_cpf / idx_alunos_cpf_busca) e `metas_unidades` (manter a chave principal); `auth_rls_initplan` em algumas regras. Não mexer nas regras permissivas duplas (são o desenho das permissões).

## Conversa 6: Vigia do banco (projeto separado)
**Frase (em uma pasta nova dentro de C:\Users\Micro\Desktop\PROJETOS):** "Quero criar o Vigia do banco do Pratique Vendas."
Opções apresentadas: vigia de velocidade ou completo (swap, disco, CPU; confirmar se o Supabase fornece e o custo; exige chave secreta protegida). **O dono ainda não escolheu.** Avisos no Telegram exigem autorização por escrito e registro em `_FERRAMENTAS\horarios.md`.

## Como gastar menos nas conversas
- Um assunto por conversa; abrir com a frase acima.
- Mandar **resumos e prints**, não arquivos grandes com a lista de pessoas.
- Erro na tela: mandar o print e a linha em vermelho do Console.
- Melhoria futura (proposta, sem aprovação): enxugar o CLAUDE.md sem apagar regras.
