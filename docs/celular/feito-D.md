# Celular — grupo D: Fechamento, Pendências, Acessos e Comunicados (26/11/2026)

Tudo publicado no `main`. O computador continua como era (as mudanças só valem até 767px de largura).
Nenhuma conta, gravação no banco, venda ou comissão foi alterada: só o desenho das telas.

## O que mudou, por tela

### Fechamento de Caixa
- **Abas e filtros do topo:** botões maiores; setor e unidade ocupam a largura.
- **Conferência:** filtros em duas colunas; a tabela virou um cartão por venda (data, unidade, aluno e CPF com copiar,
  item, vendedor, valor, observação, botão grande OK/PENDENTE ou cadeado "Pago", quem conferiu, Editar e Apagar) e o
  seletor "Ordenar por". Os cartões entram de **30 em 30** ("Mostrar mais"), para o celular não travar; "Conferir Tela"
  e "Exportar" continuam valendo para todas as vendas filtradas. A janela de editar a venda ocupa a tela toda, com os
  botões presos embaixo.
- **Comissões:** um cartão por consultor (nome abre a Central, aviso de cadastro, total, CPF, banco, Copiar tudo,
  Emitir recibo, resumo das vendas que abre e fecha, ordenar).
- **Pagamento das comissões:** botões maiores e janela de aprovar em tela cheia.
- **Recibo:** cabe na tela do celular; a impressão não mudou.
- **Visão Geral:** um cartão por unidade, mais o total; as barrinhas dos 6 meses mostram o valor ao tocar.
- **Auditoria** (tela de Admin): a tabela arrasta para o lado com a unidade parada; botões maiores. Corrigido um
  problema que fazia a página inteira arrastar para o lado.

### Pendências
- Um cartão por unidade, com um bloco para cada tipo, os Líderes e o botão **Cobrar** de cada um. No relatório da
  recepção o nome da recepcionista aparece escrito (no celular não existe "passar o mouse"). O "?" dos prazos abre no
  toque e os filtros rolam para o lado.
- **Relatórios de fechamento enviados:** cartão por dia (uma unidade) ou por unidade (várias), com "Foi enviado" e
  "Não foi" maiores.
- **Janelas** (pendências ao entrar, cadastro da equipe, turno, conferir no grupo, lembrete do CRM): tela cheia ou com
  rolagem, botões sempre alcançáveis e X maior.

### Acessos
- Botões e campos maiores.
- **Todos os logins:** tabela que arrasta, com a Pessoa parada (decisão do plano).
- **Pedir acesso:** os 3 botões de função não estouram mais a tela.
- Temporários, pedidos, "Meus acessos" e a janela de pedidos: toques maiores; a janela de pedidos abre em tela cheia.

### Comunicados e avisos no celular
- Lista mais compacta, com botões grandes.
- **Relatório do comunicado:** um cartão por pessoa, com o botão Liberar.
- Visualizador do comunicado em tela cheia.
- **Aviso no celular:** o histórico virou cartões; botões da janela de conferir presos embaixo.
- **Novo comunicado:** bolinha da resposta certa e botões de apagar maiores.
- **Faixa "Ative os avisos":** botão na largura toda.

## Como foi conferido
- `npm run build` terminou com "built" em todas as etapas; `npm run lint` sem aviso novo nas pastas do grupo.
- Teste visual em 390px de largura, **com dados inventados** e sem login: Conferência, Comissões, Auditoria, Pendências
  e Acessos (pedidos, todos os logins e líderes por unidade).

## O que ficou pendente
1. **Testar no celular de verdade, com login.** Não passaram pelo teste visual: Visão Geral, quadro e janela do
   pagamento, recibo, janela de editar a venda, relatórios enviados, as janelas que abrem ao entrar, Pedir acesso,
   Temporários e todo o Comunicados. Nelas só valem o build e a revisão do código.
2. **Conferência:** nos filtros de duas colunas o texto de dentro aparece cortado ("TODOS OS SE"); o título em cima
   diz qual é cada um.
3. **Defeito antigo achado (não corrigido, fora do projeto celular):** o **CPF não sai no Recibo de comissão**. Em
   `src/pages/FechamentoCaixa/ReciboComissao.jsx` (linhas 45 e 46) faltam as barras do código que lê o CPF (`/D/g` e
   `d{3}` no lugar de `\D` e `\d{3}`). Com o CPF gravado com pontos, a linha some; só com números, sai sem pontos.
   Existe desde 17/11/2026. Corrigir mexe só no que o recibo mostra.

## Fora das pastas do grupo
- A janela de mensagem do WhatsApp usada em Auditoria, Pendências e Temporários é da pasta do grupo B.
- O Panorama da unidade (grupo E) reaproveita o relatório compacto de Pendências; ele continua igual lá.
