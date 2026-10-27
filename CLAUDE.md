# Pratique Vendas — regras do projeto

Sistema de vendas usado por uma rede de academias (Pratique). O dono do projeto **não é programador**.

## Regras de trabalho (obrigatórias)

1. **Responder sempre em português**, em linguagem simples, explicando como para um leigo (sem jargão; quando um termo técnico for inevitável, explicar o que ele significa).
2. **Nunca remover funcionalidades que já existem.** Ao mexer em uma tela, tudo que ela já fazia deve continuar funcionando. Se algo parecer inútil, perguntar antes de tirar.
3. **Antes de mudar qualquer coisa, mostrar o plano e esperar aprovação.** O plano deve dizer, em português simples: o que vai mudar, em quais arquivos e o que o usuário vai ver de diferente. Só editar depois do "pode fazer".
4. **Depois de mudar, rodar o projeto para conferir que nada quebrou:**
   - `npm run build` — precisa terminar com "built" sem erros.
   - `npm run lint` — não pode surgir erro novo (avisos antigos já existem).
   - Quando a mudança for visual, abrir com `npm run dev` e conferir a tela.
   - Contar ao usuário o resultado de forma honesta, inclusive se algo falhou.
5. **O sistema trabalha com COMISSÃO, não com valor de plano.**
   - No catálogo (tabela `catalogo`), o campo `valor` de cada plano/produto/serviço é a **comissão** paga ao vendedor (ex.: plano FIT = R$ 5,00), não o preço que o aluno paga.
   - Na tabela `vendas`, `valor` e `comissao` guardam a mesma coisa: a comissão daquele lançamento.
   - Totais, rankings, metas e o Fechamento de Caixa somam comissões. Nunca apresentar esses números como faturamento ou preço de plano.
6. **A unidade escolhida no seletor do topo vale para o sistema inteiro.**
   - O estado fica em `unidadeGlobal` no [src/App.jsx](src/App.jsx) (`'TODAS'` = visão de todas as unidades).
   - Só ADMIN e MENTOR podem trocar de unidade. Quando escolhem uma unidade, o App cria o `usuarioVirtual` (age como LIDER daquela unidade) e todas as telas recebem esse usuário.
   - Toda tela nova ou alterada deve respeitar essa unidade (filtrar dados por ela) e não criar um seletor de unidade próprio que contradiga o do topo.
7. **Manter o visual atual:**
   - Tailwind CSS (sem outras bibliotecas de estilo).
   - Letras fortes: `font-black` / `font-bold`, títulos e rótulos em `uppercase` com `tracking-widest`.
   - Cantos arredondados: `rounded-xl`, `rounded-2xl`.
   - **Azul como cor principal** (botões e destaques em `blue-*`); verde (`emerald`) para dinheiro/sucesso, vermelho (`rose`) para erro.
   - Sempre manter o modo escuro funcionando (classes `dark:`).
   - Fonte Inter. Ícones da biblioteca `lucide-react`.

8. **A busca de alunos é sempre na rede inteira (decisão do dono — não "corrigir").**
   - O sistema é de comissão e unificado: um aluno de uma unidade pode comprar em outra (ex.: aluno de Neves compra em Santa Inês). É melhor achar o cadastro dele do que cadastrar de novo.
   - Vale para todos os perfis (ADMIN, MENTOR, LIDER e RECEPCAO) na busca Ctrl+K, na busca da lista de Alunos e na busca do Novo Visitante. A função que faz isso é `buscarAlunosNaRede` em [src/pages/Alunos/utils.js](src/pages/Alunos/utils.js).
   - Os alunos da unidade de quem está buscando aparecem primeiro; depois os das outras unidades.
   - Sempre mostrar a etiqueta com a unidade de origem do aluno (componente [src/components/EtiquetasUnidade.jsx](src/components/EtiquetasUnidade.jsx)). Se o aluno estiver ligado a mais de uma unidade, mostrar todas e o aviso "ligado a mais de uma unidade, conferir".
   - A etiqueta depende da consulta segura **`unidades_dos_alunos`** criada no Supabase (SQL Editor). Motivo: a regra de acesso `RLS_SELECT_VINCULOS` da tabela `alunos_unidades` deixa Recepção/Líder ver só os vínculos da própria unidade, então sem essa consulta aparece "SEM VÍNCULO". Ela devolve só o nome da unidade e só responde a funcionários (`get_user_colaborador_info`). **Não apagar** essa consulta nem trocar por uma leitura direta da tabela. Se ela não existir, o código cai para os vínculos visíveis e avisa no console.
   - A lista de Alunos **sem** busca digitada continua mostrando só a unidade (a rede inteira só entra quando há uma busca).
   - A venda e a visita são sempre lançadas na unidade de quem está vendendo/atendendo, **nunca** na unidade de origem do aluno.
   - Isto é uma exceção à regra 6, que continua valendo para vendas, relatórios, metas, caixa e os demais dados.

9. **A Nova Venda busca o aluno SOMENTE pelo CPF completo (decisão do dono).**
   - O CPF é a garantia de não lançar a venda e a comissão no aluno errado.
   - Não adicionar busca por nome nem por matrícula na Nova Venda.

## Como rodar

- `npm install` — instala as dependências (só na primeira vez).
- `npm run dev` — abre o sistema em modo de desenvolvimento.
- `npm run build` — gera a versão final (pasta `dist`).
- `npm run lint` — procura problemas no código.

## Como o sistema está organizado

- **Tecnologia:** React 19 + Vite, estilo com Tailwind 4, gráficos com Recharts, banco de dados e login no **Supabase** ([src/supabaseClient.js](src/supabaseClient.js)).
- **[src/App.jsx](src/App.jsx)** — o "cérebro": faz login, carrega os dados (vendas, visitantes, avaliações dos últimos 90 dias, catálogo, equipe, unidades), mantém tudo atualizado em tempo real, controla o seletor de unidade, o tema claro/escuro, os comunicados obrigatórios e decide qual tela mostrar conforme o perfil do usuário.
- **Perfis de acesso:** ADMIN, MENTOR (visão de todas as unidades), LIDER e RECEPCAO (só a própria unidade).
- **src/components/layout/** — menu lateral (Sidebar), barra do topo (TopBar, com busca global e seletor de unidade), paleta de comandos e cortina de inatividade.
- **src/pages/** — uma pasta por tela do menu:
  - `Lancamentos` — Nova venda e cadastro de visitante.
  - `HistoricoVendas` — Histórico de lançamentos.
  - `AnaliseVendas` — Painel, metas, ranking e relatórios.
  - `FechamentoCaixa` — Conferência, comissões a pagar e auditoria.
  - `CrmVisitantes` — Funil de visitantes (kanban, lista, métricas).
  - `Alunos` — Ficha completa do aluno (dados, planos, produtos, avaliações, contatos, linha do tempo).
  - `AvaliacaoFisica` — Avaliações físicas, inclusive leitura de PDF de bioimpedância (InBody/Superbio).
  - `CadastroGeral` — Equipe, catálogo (planos/produtos/serviços), setores e alunos.
  - `Comunicados` — Central de comunicados (alguns podem bloquear o uso até serem lidos).
  - `Configuracoes.jsx` — Unidades (só ADMIN). `Login.jsx` — tela de entrada.
- **src/i18n/** — traduções (português, inglês e espanhol). Textos novos de menu/interface devem ser adicionados nos três idiomas quando a tela já usa `t(...)`.
- **src/data/** — dados de exemplo antigos (o sistema real usa o Supabase).
