# Grupo C — CRM no celular (26/11/2026)

Pasta mexida: `src/pages/CrmVisitantes` (só ela). Relatório seguido: `sondagem-3-crm.md`.
No computador o desenho continua o mesmo. As mudanças valem abaixo de 768px.

## O que mudou, por tela

### Entrada do CRM
- **Cabeçalho:** abas em linha própria, ocupando a largura toda.
- **Equipe:** cartões em 1 coluna (2 a partir de 400px). Botão "Carteira vazia" maior.
- **Painel:** a tabela virou cartões (nome, turno, ⚠️, meta, Começou, Ligações, WhatsApp, Fechou, Última ação, Público; no Detalhado, as outras colunas). Unidades abrem e fecham como antes. Caixa "Ordenar por". Os números do topo ganharam "?" que abre no toque. A "Cobrança do dia" rola e tem botões grandes.
- **Ficha da recepcionista:** últimas ações em lista, sem arrastar para o lado.
- **Contatos:** "Pessoas contatadas" e "O que aconteceu" em cartões.
- **Abastecer carteiras:** Smart Paste, Distribuir e Mover ajustados; Banco Bruto em cartões (tocar marca o contato, com "selecionar a página").

### CRM da recepcionista
- **Topo:** nome e meta quebram em linhas; Voltar e Fechar Turno dividem a largura (era isso que fazia a página inteira rolar para o lado).
- **Abas:** uma faixa que arrasta para o lado. O menu **Mais** sobe de baixo.
- **Kanban:** uma fase por vez, escolhida em botões com a quantidade.
- **Lista:** cartões com as mesmas ações, ordenar, filtrar e selecionar todos.
- **Conversa:** abre em tela cheia; o botão "voltar" do aparelho volta para a lista; Detalhes sobem de baixo; caixa de envio presa embaixo.
- **Hoje:** WhatsApp e Ligar grandes; os outros botões na linha de baixo.
- **Migração e Resgate:** um cartão por aluno (peça nova `CartaoAlunoFila.jsx`). "Enviar para o CRM", "Devolver" e "Não contatar" ficam no botão **⋯**.
- **Geladeira, Não contatar, Métricas e Relatório:** ajustados. No Relatório (tela de Admin) a tabela arrasta com a unidade parada.

### Janelas
- **WhatsApp, Ficha do contato e Fechar Turno:** tela cheia. Na Ficha, a linha do tempo não fica mais espremida.
- **"Como foi o contato?":** sobe de baixo e rola.
- **Próximo contato, motivo da perda, Não contatar, Mensagens prontas, Puxar do cadastro:** cabem na tela, com toque maior.

### Ligar
Todos os botões "Ligar" do CRM usam o discador no celular e o MicroSIP no computador. Não sobrou `sip:` escrito à mão no sistema.

## Conferências
- `npm run build`: ok. `npm run lint`: nenhum erro novo no CRM (o aviso do `Modais.jsx` já existia).
- `teste-em-espera.mjs` e `teste-fila-no-funil.mjs`: passaram.
- Traduções: as 117 frases das linhas mexidas têm inglês e espanhol (nova em `C-crm.js`: "Selecionar todos").
- Chrome em 390px, com **dados inventados e o banco bloqueado**: nenhuma das telas abertas passou da largura. Foi olhando as fotos que apareceram 4 defeitos (caixas de escolha cortando texto, título de Migração/Resgate, botões da aba Hoje, linha "Ordem" do Kanban), já corrigidos.

## O que NÃO foi testado
- Celular de verdade (Android e iPhone), com login e dados reais.
- Botão "voltar" do aparelho na Conversa.
- Teclado do iPhone aberto na Conversa e na Ficha.
- Ligar abrindo o discador.
- Aparência no computador (não tirei foto da tela grande).
- Sem foto: Smart Paste, Puxar do cadastro, Mensagens prontas, Geladeira, janelas de próximo contato / motivo da perda / Não contatar, "Cobrar no WhatsApp", Resgate. Em Migração a tela abriu vazia; o cartão do aluno foi testado à parte.

## Pontos de atenção
- No computador, as janelas pequenas (Cobrança do dia, motivos, próximo contato, "Como foi o contato?") agora rolam quando não cabem na altura.
- Com a Conversa em tela cheia, a pílula de pendências fica escondida atrás dela até voltar para a lista.
- As abas Migração, Resgate e Mais ficam à direita: é preciso arrastar a faixa.
- A ficha completa do aluno aberta pelo CRM usa telas do grupo A.
- As opções "Telefone / WhatsApp não funciona" e "Não contatar" da janela "Como foi o contato?" (commit `6c09c3e`) vieram de outra conversa, não deste grupo, e não foram revisadas aqui.

## Nada anotado para as peças comuns
Não foi preciso mexer nas peças da Onda 0.

## Para as próximas conversas em paralelo
Todas usam a mesma pasta no computador. **Não usar `git stash`** (guarda também o trabalho das outras). Fazer `git commit -- <arquivos>` só com os próprios arquivos. Rodei `git stash` uma vez aqui; voltou tudo, sem conflito.
