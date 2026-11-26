# Sondagem 2 — Dashboard, Metas, Relatórios, Ranking, Saúde (26/11/2026)

Só leitura. Pasta `src/pages/AnaliseVendas` (+ `gestaoAVista/GestaoAVistaProdutos.jsx`).

## O MODELO: aba Metas (MetasTab.jsx + MovimentoDiarioPainel.jsx)
1. Uma coluna por padrão: `grid-cols-1 lg:grid-cols-3` (MetasTab:579), `grid-cols-1 lg:grid-cols-2` (744).
2. Linha "rótulo à esquerda, número à direita" (`InputFieldWithSave` 84–127, `LinhaMov` Movimento:28–42): `flex items-center justify-between gap-3`; esquerda `min-w-0 flex-1 truncate`; direita `shrink-0` caixa `w-[72px] h-10`. **É a peça do corpo dos cartões.**
3. Toque: `h-10` campos/botões, `w-10 h-10` ícones, principal `w-full h-10`, janela `h-12`.
4. Letras: mínimo `text-[10px]` uppercase tracking-widest; rótulos `text-[11px]`; números `text-sm font-black tabular-nums`.
5. `inputMode="numeric"/"decimal"`.
6. Dica "?" = `<button aria-label>` que abre com `group-hover` E `group-focus-within`, `w-[min(280px,70vw)]` (Movimento:16–21).
7. `flex flex-wrap` nas faixas de botões; data `flex-1 min-w-[140px]`; cabeçalho `flex flex-col md:flex-row`.
8. Janela: `fixed inset-0 p-4 flex items-center justify-center`, caixa `w-[min(560px,100%)]`.
9. `p-6 md:p-8`, `p-5 md:p-6`.

Ajustes na própria Metas: tabela por dia (Movimento:352, `min-w-[700px]`, 8 col.) → cartões; 348 `md:max-h-[460px]`; MetasTab:223 e 599 `flex-wrap`; JanelaMovimento:65 `max-h-[calc(100dvh-2rem)] overflow-y-auto`; campos `text-base md:text-sm` (zoom iPhone).

## Por arquivo
- **index.jsx** (P): 552 SeletorPeriodo (ver FiltrosCompactos 107/117/241); 544 botões do cabeçalho `grid grid-cols-2 w-full sm:flex sm:w-auto`, Período `col-span-2`; 594 X do filtro `w-8 h-8`; 604 abas `snap-x` + esmaecido na borda.
- **DashboardTab.jsx** (G): 267/293 ModalPlanos tabela `min-w-[640px]` → cartão por aluno; 1285 Assinaturas `min-w-[760px]` 6 col. → cartão por grupo (linha que abre continua); 1395–1418 linha de produto `flex-wrap`, etiquetas embaixo do nome; 1125/1135 botões `h-10` + `flex-wrap`; 1183/1221 gráfico `h-[220px] md:h-[260px]`, margem direita menor; 1218 "Passe o mouse" → "Toque ou passe o mouse"; 1408/1424 `title` → `Dica`; 930 `text-5xl sm:text-[64px]`; 142/151 DraggableWindow `sm:resize`.
- **visaoRede/QuadroPlanosPorUnidade.jsx** (G): 202 tabela 12–15 col. → cartão por unidade (cor+nome+Central; Planos `text-lg` com ▲▼; `grid-cols-3` Plus, Nutri, Produtividade, Produtos, Saídas, Faturamento, Ativos; cartão tocável troca a unidade); ordenação vira `<select>` "Ordenar por"; 256/241/347 textos do `title` visíveis; 280–295 detalhe Nutri `w-[min(210px,70vw)]`; 359 "Clique" → "Toque".
- **visaoRede/RitmoPorUnidade.jsx** (P): 74–90 pílulas `flex-nowrap overflow-x-auto snap-x` abaixo de md, `h-10`; 52 `minTickGap`; 92 `h-[240px] md:h-[300px]`; 124 texto "Toque".
- **gestaoAVista/GestaoAVistaProdutos.jsx** (P): 258, 108, 116–120 `h-10`; 354 `w-full sm:w-40`.
- **MetasTab.jsx** (P): acima + 731/737 `h-10`.
- **MovimentoDiarioPainel.jsx** (M): 352 cartão por dia (dia + lápis `w-10 h-10`; `grid-cols-3` Ativos, Nutri, Entradas, Canc., Saldo, Fat.).
- **MonitorMovimentacao.jsx** (M): 199 tabela 9 col. → cartão por unidade (nome + selo situação, `grid-cols-3`, último lançamento); 189 `h-10 flex-wrap`; 239 ⚠️ visível.
- **HistoricoMetas.jsx** (P): 115 → cartão por mês; 107 fechar `w-10 h-10`; 98 `max-h-[calc(100dvh-2rem)]`.
- **RelatorioTab.jsx** (M): 253 rolagem dentro de rolagem (`max-h-[75vh]` + arrastar com mouse) → só no md; 445 `md:max-h-[160px]`; 467 `line-clamp-2`; 387/394/298/305 `h-10`.
- **relatorio/ModalAuditoria.jsx** (M, Relatório e Ranking): 37 Copiar invisível no toque → `opacity-100 md:opacity-0 md:group-hover...`, `w-8 h-8`; 150/194/238 tabelas → cartões; 294/299 arrasto e resize só no md, tela cheia no celular; 354 busca `h-10 text-base md:text-xs`.
- **RankingGlobalTab.jsx** (G): 404 matriz 10–12 col. → cartão por unidade (posição+nome+% da rede; `grid-cols-3` de botões-número que abrem a auditoria); 283 `classeBotaoNumero` `h-10 min-w-[44px]`; 508 detalhe Nutri só no `title` → visível; 407 Pos dentro da célula Unidade; 317/358 `h-10`.
- **SaudeUnidadeTab.jsx** (M): 630 tabela 7 col. → cartões, ordenação `<select>`; 472–523 resumo `grid grid-cols-2 sm:flex sm:flex-wrap`; 509/520 `Dica`; 476/622 `h-10`; 189 `min-w-14`; 590 `h-56 md:h-64`.
- **Modais.jsx ModalTextoWhatsapp** (P, ALTA): 30 `h-[600px]` → tela cheia no celular / `h-[min(600px,calc(100dvh-2rem))]`; 38 fechar `w-10 h-10 aria-label`.
- **components/BotaoCentralUnidade.jsx:16** 24px → `w-10 h-10 md:...`.

## Peças comuns sugeridas
ListaResponsiva (tabela no md, cartões abaixo; modo `arrastavel` com 1ª coluna sticky para Admin) · LinhaNumero (= LinhaMov) · Dica única (hoje em Movimento:16, Dashboard:200, QuadroPlanos:44, Saúde:126) · JanelaBase · BotoesSegmentados · SeloVariacao · CaixinhaForaDaMeta · DetalheNutri · GraficoLinhaPadrao.
