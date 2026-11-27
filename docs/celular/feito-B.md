# Grupo B — Dashboard (todas as abas) — feito em 26/11/2026

> **ATENÇÃO (27/11/2026): o dono reprovou parte dos cartões.** Voltaram para TABELA: planos por unidade, movimentação por dia, monitoramento, metas anteriores, ranking global, item por item (Saúde), lista de planos e janela de auditoria. Onde a tabela abaixo falar em cartão nessas partes, não vale mais.
> **Aprovado como está:** card Planos vendidos, Produtividade, Ritmo do mês, Assinaturas, Produtos, Ranking de produtos, Gestão à Vista, Metas da unidade, Relatórios na visão de Líder, resumo e gráficos da Saúde.
> **Decisões:** tabela com o nome parado e arrastar para o lado em tudo (inclusive lista de alunos); linhas de 40px; mesma ordem de colunas do computador.
> **Proposta 3 APROVADA e publicada em 27/11/2026:** nome e título parados (`pages/AnaliseVendas/tabelaCelular.css`, classes `tc-rolar`/`tc-tabela`), ordenar pelo título (Movimentação e Monitoramento passaram a ordenar, também no computador) e Relatórios de Admin/Mentor no celular com total colorido + tabela de unidades (`relatorio/ComparativoUnidadesCelular.jsx`) + cartões fechados. O dono vai testar no celular e pedir os ajustes.
> **Ajustes de 27/11 (tarde), publicados:** no celular o botão da Central vira a ÚLTIMA coluna (Planos por unidade, Monitoramento e Ranking; no computador continua ao lado do nome); Planos por unidade com linha de 40px, sem a mini barra, selos curtos (11 unidades cabem em 390×844); Relatórios enviados com várias unidades = tabela com a unidade parada e ordenar (uma unidade continua em cartões por dia). Saúde aprovada.


Regra seguida: no celular (até 767px) o desenho muda; no computador nada muda (classes `md:` devolvem o de antes).
Build ("built") e lint (só avisos antigos) conferidos a cada tela. Commits `feat(celular): B — …` no main.

## O que mudou, por tela

| Tela | No celular |
|---|---|
| **Cabeçalho da Análise de Vendas** (index.jsx) | Botões em 2 colunas; período na largura toda (abre como folha de baixo); abas rolam para o lado com encaixe; filtros ativos com X de 32px. |
| **Botão Central** (BotaoCentralUnidade) | 40×40 no celular (24 no computador). |
| **Janela do WhatsApp** (Modais.jsx) | Tela cheia, botões de 48px, X de 40px, rodapé com espaço da barra do iPhone. Era fixa em 600px e cortava. |
| **Dashboard** | Número de planos `text-5xl`; lista de planos (janela) em cartões por aluno e tela cheia; **Assinaturas** em cartão por grupo (a seta continua abrindo os planos e o "Ver todos"); linha de produto quebra em 2 linhas, nome inteiro, "X não conta" com "?" que abre no toque; sabores mostram o nome completo; gráficos 220px e menos margem; texto "Toque num dia…"; botões Por unidade/Rede e Por dia/Acumulado com 40px; janelas arrastáveis sem redimensionar. |
| **Planos por unidade** (visão da rede) | Cartão por unidade (cor, nome, Central, planos com ▲▼ e mini barra; grade com Plus, Nutri com "sistema · Tecace" escrito, Produtividade, Produtos "fora da meta", Saídas/Saldo, Faturamento, Ativos; Detalhado mostra também Fit, Personal, Outros, Serviços); **tocar no cartão troca a unidade** (igual à linha); "Ordenar por" no lugar do clique no título; cartão "Rede" no fim; selo "Sem plano há X dias" com a explicação escrita. |
| **Ritmo por unidade** | Nomes das unidades numa faixa que arrasta para o lado (40px); gráfico 240px; dias do eixo mais espaçados; texto "Toque…". |
| **Gestão à Vista** | Filtros e botões com 40px; busca na largura toda; linha da pessoa com nome em cima e gráfico/frase embaixo. |
| **Metas** | Cabeçalhos dos cards Start/Mensal e o rodapé do cartão de meta quebram linha; botões "Compartilhar" com 40px; **Movimentação por dia** em cartão por dia (lápis 40px, Ativos, Nutri, Entradas, Cancelamentos, Saldo, Faturamento com acumulado) + cartão "Total do período"; janela "Falta preencher" rola e os botões ficam na largura toda; **Monitoramento** em cartão por unidade (situação, "Falta:", números, ⚠️ do Tecace escrito, último lançamento) + total; botões Detalhado/Resumo 40px; **Metas anteriores** em tela cheia com cartão por mês ("meta → realizado ✅/❌"). |
| **Relatórios** | Sem rolagem dentro de rolagem (a caixa de 75% e o arrastar com mouse ficam só no computador); listas dos quadros sem altura máxima; consultores em até 2 linhas; botões 40px; nome da unidade inteiro. |
| **Janela de auditoria** (Relatórios e Ranking) | Tela cheia, sem arrastar; **cartão por registro** (vendas, visitantes, avaliações) com os botões de copiar nome/CPF **sempre visíveis** (antes só apareciam com o mouse); busca e "Baixar lista" com 40px. |
| **Ranking global** | Cartão por unidade: medalha/posição, nome, % da rede, Central; grade de **botões-número de 40px que abrem a auditoria** (Total, Planos, cada coluna; Nutri com "sistema · Tecace" escrito e borda tracejada de adicional); itens de Produtos/Serviços como botões; "Ordenar por"; cartão "Total da rede". |
| **Saúde da unidade** | Resumo em 2 colunas; seletor de equipe na largura toda; "?" no toque (fora da meta, Nutri, comparação); gráfico 224px; abas de categoria 40px; **Item por item** em cartões (Agora, Antes, % do total, comissão, situação) com "Ordenar por". |

Frases novas (en-US e es-AR) em `src/i18n/frases/celular/B-dashboard.js`.

## O que ficou pendente / não deu para conferir
- **Não abri as telas num celular de verdade.** O sistema pede login com Google e eu não consigo entrar; conferi só build e lint. Precisa do teste do dono no celular.
- O "?" com explicação longa dentro da tabela do computador continua com `title=` (no computador funciona). No celular, essas explicações viraram texto escrito ou `Dica`.
- Dicas locais repetidas (`Dica` dentro de Movimento, Dashboard, Quadro, Saúde) não foram trocadas pela peça única `components/celular/Dica.jsx` no computador (mexer mudaria o computador); no celular onde faltava, usei a peça única.
- Peças comuns sugeridas pelo detetive (ListaResponsiva, SeloVariacao único etc.) não foram criadas: estão fora da pasta do grupo. Fica a sugestão para uma Onda futura.
- Nada fora das pastas do grupo precisou de ajuste.
