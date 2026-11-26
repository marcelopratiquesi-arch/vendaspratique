# Celular — Grupo A feito (26/11/2026)

Lançar venda, Histórico e Alunos. Tudo publicado no `main`.
Computador: nada mudou de propósito (conferido em 1280px nas telas Lançar venda, janela do aluno, Histórico/Registros, lista e ficha do aluno).

## Como foi conferido
Não foi possível entrar no sistema de verdade (o login é pelo Google). Usei uma **bancada temporária**: as telas reais, com dados inventados e banco de mentira, em 360px e 390px (já apagada).
**Não foi testado:** celular de verdade, iPhone (teclado, barra de baixo, campo de data) e gravação no banco real. A lógica de gravar, editar e apagar não foi alterada.

## O que mudou

### Lançar venda
- Confirmar venda e comissão total presos no rodapé, com o aviso do que falta.
- Cada item da venda vira um cartão; categoria em 3 botões da largura toda.
- Listas de item e de consultor em tela cheia, com "Voltar" e busca. O teclado só abre ao tocar na busca.
- Consultor mostra o nome completo embaixo do nome curto.

### Cadastrar visitante
- Botão de salvar/enviar preso no rodapé; lista de sugestões com rolagem; botões maiores.

### Janela de cadastro do aluno (usada também por Avaliação, Cadastros e CRM)
- Tela cheia, meio rolando, Salvar e Cancelar sempre à vista. Antes não dava para chegar no Salvar.
- Campos um embaixo do outro.

### Histórico
- Registros em cartões: ordenar, copiar nome/CPF, abrir ficha, editar (em coluna) e apagar.
- Abas com texto curto; filtros em 2 por linha.
- Duplicidades: botões e campos maiores.
- Lixeira: arrasta para o lado com o **Aluno** parado (segui a decisão do PLANO para Lixeiras; o relatório do detetive pedia cartões).

### Alunos
- Lista em cartões com Vender, Avaliar, Editar e Excluir (Admin) com texto; copiar sempre visível.
- Filtros, resumo e paginação ajustados.
- Janela de exclusão com botões maiores.
- Ficha: topo e botões maiores, resumo em 2 colunas, abas que rolam para o lado, Planos/Produtos/Avaliações em cartões, folha da avaliação em tela cheia.

## Peças novas do grupo
- `src/pages/Lancamentos/celular/camada.jsx`: `CamadaDoApp` (tela cheia por cima da barra do topo) e `RodapeFixo` (botão preso no rodapé; sobe o cartão "N pendências" para não tapar).
- `src/pages/Lancamentos/seletores/CabecalhoLista.jsx`
- `src/pages/HistoricoVendas/CartoesHistorico.jsx`

## Pendente / para quem cuida das peças comuns
1. **`components/celular/Janela.jsx` fica por baixo da barra do topo** quando aberta dentro da área central: título e X somem e o cartão de pendências fica por cima (testado na bancada). Em 26/11 nenhum arquivo importava essa peça. Conserto sugerido: ela usar `CamadaDoApp` (ou mover `camada.jsx` para `components/celular/`). Vale conferir também as outras janelas em tela cheia dos outros grupos; não conferi.
2. `FichaAlunoPopup.jsx` (CRM, grupo C) é uma dessas janelas dentro da área central: no celular o topo dela pode ficar escondido (não testado). A edição e a folha de avaliação abertas por ela ficam por cima normalmente.
3. O cartão "N pendências" pode tapar o último botão de telas que não têm folga no fim. Nas telas do grupo A coloquei a folga; o ideal é resolver no `App.jsx`.
4. Botão de copiar continua com 3 versões (Histórico, lista de Alunos e ficha). Todas ficaram maiores no celular; juntar numa só fica para depois.
5. No botão "voltar" do Android, a lista em tela cheia não fecha sozinha (o botão da tela é "Voltar").
