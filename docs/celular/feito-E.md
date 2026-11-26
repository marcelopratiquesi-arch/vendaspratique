# Grupo E — Avaliação Física, Cadastros, Configurações e Permissões (26/11/2026)

Tudo vale só no celular (até 767px). No computador o desenho é o mesmo. Nenhuma função foi tirada; não mexeu em banco, vendas nem comissão.

## Avaliação Física
- **Faixa do topo:** abas rolam para o lado e os números ficam de 2 em 2.
- **Tela inicial:** "Últimas Avaliações" viraram cartões (aluno, CPF mascarado, saúde, avaliador, unidade, peso, músculo, gordura, "Ver" e "PDF"). Botão "Nova Avaliação" maior.
- **Painel do avaliador e Dashboards:** ranking em lista; histórico no modo **Resumo** em cartões com "Ordenar por" (Detalhes, Evolução, Exame, Editar, Excluir, trocar avaliador); no modo **Avançado** a tabela arrasta com o nome do aluno parado. Filtros, paginação e a janela do relatório ajustados.
- **Formulário:** o "i" abre no toque (a explicação aparece embaixo da tela), botão de copiar sempre visível, medidas e resultados mais compactos.
- **Evolução do aluno:** tela cheia, rola inteira, "Fechar" preso embaixo.
- **Configurar formulário:** o topo não fica mais preso cobrindo a tela; prévia em tela cheia; botões maiores.
- **Lixeira:** arrasta com o nome parado.

## Cadastros
- **Equipe, Catálogo, Grupos, Setores e Alunos:** tabelas arrastam com a 1ª coluna parada; botões maiores.
- **Unidades:** já tinha cartões; botões e filtros maiores.
- **Smart Paste de alunos:** tela cheia; resumo de 2 em 2; na prévia o **nome** fica parado.
- **Janelas** (colaborador, item do catálogo, setor, grupo, desligamento): o Salvar não some mais da tela. A do colaborador abre em tela cheia.
- **Central da Unidade e do Colaborador:** tela cheia, "Voltar/Fechar" preso em cima, números de 2 em 2, tabelas com a 1ª coluna parada.

## Configurações e Permissões
- Abas do topo rolam para o lado (antes estouravam a tela).
- Logins: botões maiores (os cartões já existiam). Backup: tabelas arrastam. Aviso de backup cabe na tela.
- Permissões: **Nº e nome parados** ao arrastar; chave liga/desliga com área de toque maior; em "Exceções por login" os 3 botões ficam um embaixo do outro.
- Histórico das permissões: tela cheia.

## Conferido
- `npm run build`: deu "built". `npm run lint`: nenhum erro nas pastas do grupo (só avisos).
- Testes que passaram: cadastros (22), configurações (40), permissões, acesso, central do colaborador, cadastro da equipe, grupos do catálogo.
- Frases novas (só o "Ordenar por" da Avaliação) em inglês e espanhol, no arquivo do grupo E.

## Pendente
- **Nada foi conferido na tela** (nem em celular de verdade, nem em tela simulada). Precisa do teste do dono.
- Algumas explicações ainda só aparecem ao passar o mouse (`title=`), então no toque não abrem: "?" da coluna Saúde, grupo do item no Catálogo, "?" da data de cadastro em Alunos, telefone/e-mail de preenchimento, cadeado das Permissões, "sem efeito" nas diferenças.
- Nas tabelas que arrastam, não há "Ordenar por": a ordem continua pelo toque no título da coluna.
- Permissões "Por nível" no celular: sobra pouco espaço ao lado do nome, então é preciso arrastar para ver todos os níveis.

## Fora das pastas do grupo
- Nada precisou ser alterado fora delas.
