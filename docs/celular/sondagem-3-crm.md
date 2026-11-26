# Sondagem 3 — CRM (26/11/2026)

Só leitura. Pasta `src/pages/CrmVisitantes`. Nenhum `text-[8px]/[9px]`. `components/whatsapp.js` já abre o aplicativo no celular. Conversa já tem começo de "lista OU conversa" (`hidden md:flex` + voltar `md:hidden`).

## Vale para o CRM todo
- Campos com letra < 16px dão zoom no iPhone → `text-base md:text-xs` (buscas, notas, textarea, select, data). ALTA
- **Ligar com `sip:` não funciona no celular** (Conversa 396, Kanban 233, Lista 36, Modais 89, contatosFeitos.js 69) → função comum `ligarPara(tel)`: `tel:` no celular, `sip:` no computador. ALTA
- Dicas só no mouse (`title`, `cursor-help`): colunas do Painel, chips, "(?)" Kanban 305, "feito por" index 1913 → `Dica` que abre no toque.
- Alturas em `vh` → `dvh` + `pb-[env(safe-area-inset-bottom)]` nas barras de baixo.
- Botões `h-8`/`py-1.5`/`p-2` → `max-md:h-10 max-md:min-w-10`.

## Por arquivo
- **PainelCrm.jsx** (G, PRIORIDADE MÁXIMA): 553–554 tabela `min-w-[760px]` 8 col. (Resumido) a 18 (Detalhado; COLUNAS 340–359), coluna fixa do nome ~200px → cartões abaixo de md (nome, turno, ⚠️; barra de meta; `grid-cols-3` Começou/Ligações/WhatsApp; Fechou/Público/Última ação; no Detalhado mais um `grid-cols-3` com as extras), reaproveitando `c.celula(p)`; unidades continuam grupos que abrem/fecham (`abertas`). 559 select "Ordenar por" `md:hidden` ligado ao `ordem`. 486/491/503 `max-md:h-10`, modo em `grid-cols-2`. 524–535 Cobrança do dia `max-h-[90dvh] overflow-y-auto`, botões `grid-cols-2`. 528 X `w-10 h-10`.
- **PainelInicialCrm.jsx** (M): 471 grade dos cartões `grid-cols-1 min-[400px]:grid-cols-2 ...`; 444/449 `max-md:whitespace-normal`; 518 abas `max-md:w-full max-md:order-last`, `flex-1`; 597–609 chips `grid grid-cols-2 sm:flex sm:flex-wrap`; 629–633 sub-abas `max-md:grid-cols-2 h-10`; 665 busca `w-full sm:w-64 text-base md:text-xs`; 680–717 "O que aconteceu" 7 col. → cartões.
- **FichaRecepcionista.jsx** (P): 168 tabela `min-w-[620px]` → cartões (tirar `max-w-[360px] truncate` 185); 78/103/106 `h-10`; 74 `p-4 md:p-6`; 88 `break-words`.
- **index.jsx** (M, CRM da recepcionista): **1927–1940 faixa Contatos de hoje/Voltar/Trocar/Fechar Turno sem quebra (~420px) → página inteira rola para o lado** → `max-md:grid max-md:grid-cols-3 gap-2`, `h-10`, rótulo curto. 1907–1919 linha nome/unidade/feito por/meta `flex-wrap`. 1944–1989 abas numa faixa com rolagem lateral `max-md:flex-nowrap overflow-x-auto snap-x`, `h-10`. 1974 menu "Mais" `w-56` sai da tela → folha de baixo no celular. 2068–2076 barra do Kanban `flex-wrap`. 2109/1574 `h-10`. 1593 Smart Paste `p-4 md:p-6`. 1743–1757 barra de seleção do Banco Bruto `flex-wrap`. 1762–1820 tabela do Banco Bruto → cartões (toque marca). 1841/1845 `h-10`. 1994–2000 Geladeira `p-4 md:p-8`, `text-lg md:text-2xl`.
- **Kanban.jsx** (M/G): 291/298 colunas `min-w-[250px]` lado a lado → no celular **abas por fase** (chips com número) e só a fase escolhida em largura total (rápido: `snap-x snap-mandatory` + `min-w-[85vw]`). 316 `maxHeight:'68vh'` inline → `md:max-h-[68vh] md:overflow-y-auto`. 57 lixeira `p-2.5`. 133/147 `text-base md:text-[10px] h-10`.
- **Lista.jsx** (M): 113 barra (~580px) `flex-wrap`, busca `w-full sm:w-64`; 115 `flex-wrap`; 166–276 tabela 6 col. com 6 botões `w-8` → cartões (fase `w-full h-10`, botões `grid-cols-4 h-10`); 178–187 ordenar só no hover → select; 103 `p-4 md:p-6 md:min-h-[600px]`.
- **Conversa.jsx** (M): 488 `h-[78vh] min-h-[560px]` → ver proposta abaixo; 396 `ligarPara`; 675/682 `h-10 w-10`; 604/658 voltar `p-2.5`; 689 detalhes → gaveta; 722–748 `max-md:h-10`, "Mensagens"/"Gerar outra" só ícone; 756/759 textarea `text-base md:text-sm`, `rows=2`; 504/506/512 `max-md:h-10`; 596 dica do teclado `hidden md:inline`; 719 `pb-[max(0.75rem,env(safe-area-inset-bottom))]`.
- **Modais.jsx** (M): 267 (WhatsApp), 330 (Ficha), 527 (Turno) tamanho/resize/translate em style inline → tela cheia no celular (`max-md:w-full! max-md:h-dvh! max-md:max-h-none! max-md:rounded-none max-md:transform-none!`) ou passar os tamanhos para classes `md:`. 277 `flex-wrap min-w-0 break-words`. 303/506/551 `text-base md:text-sm`. **349/451/458 provável bug: coluna direita `overflow-hidden flex-1` esmaga a linha do tempo → `max-lg:overflow-visible max-lg:flex-none` (testar).** 352 `lg:border-r`. 508 `max-md:px-4`. 333/355 `p-4 lg:p-6`.
- **AbaMigracao.jsx / AbaResgate.jsx** (G / M; linhas do Resgate entre parênteses): 511 (488) 4 visões ~400px → `max-md:grid-cols-2`; 522 (499) busca `w-full sm:w-64 text-base`; 546 (522) tabela 6–7 col. com até 8 botões de 28px → `CartaoAluno` comum (nome abre ficha; plano · compra; telefone; andamento; WhatsApp + Ligar `grid-cols-2 h-11`; resultado `grid-cols-2`; Enviar p/ CRM, Devolver, Não contatar num menu "⋯"); 593–647 `max-md:h-10`; 461 (440) `p-4 md:p-6`.
- **BotoesResultadoLinha.jsx** (P): 11 `max-md:h-10 justify-center`; quem usa: `grid grid-cols-2 gap-2 md:contents`.
- **AbaHoje.jsx** (P): 108–124 `max-md:h-10`, ícones `max-md:p-3`, WhatsApp/Ligar `max-md:flex-1`.
- **ContatosDeHoje.jsx** (P): 183–190 `min-w-0 flex-wrap`; 201 `max-h-[75dvh]`; 225–235 `max-md:h-10`.
- **JanelaResultadoContato.jsx** (P): 27 `max-h-[calc(100dvh-2rem)] overflow-y-auto`, folha de baixo no celular; 34 X `p-2.5 -m-2`.
- **JanelasContato.jsx** (P): 19 `max-h-[90dvh] overflow-y-auto`; 28 X `p-2.5`; 44/178 `text-base md:text-sm`.
- **RelatorioConsultor.jsx** (P/M): 215 tabela 6 col. → cartões; 177/181 `max-md:h-10 flex-1`.
- **AbaNaoContatar.jsx** (P): 66 `w-full sm:w-56`; 84 cartões; 107 `h-10`.
- PuxarDoCadastro `max-md:h-10`; MensagensProntas 83 `text-base md:text-[13px]`; RelatorioCrm e Metricas podem arrastar para o lado. FichaAlunoPopup ok (a FichaAluno é do grupo Alunos).

## Conversa no celular (proposta)
1. Lista em tela cheia; busca e filtros numa faixa com rolagem lateral; itens ≥ 56px.
2. Toque no contato → conversa em TELA CHEIA (`max-md:fixed max-md:inset-0 max-md:z-40 max-md:h-dvh`), cabeçalho com Voltar 40px, Ligar (`tel:`), Detalhes.
3. Caixa de envio presa embaixo com espaço da barra do iPhone e `text-base`; Enviar grande; "Gerar outra"/"Mensagens" só ícones.
4. Detalhes numa gaveta de baixo (`fixed inset-x-0 bottom-0 max-h-[80dvh] rounded-t-2xl overflow-y-auto z-50`, fundo escuro, fecha ao tocar fora). Entre md e xl fica como hoje.
5. Botão "voltar" do aparelho fecha a conversa (`history.pushState` ao abrir + `popstate` → `fecharSelecao`).

## Peças comuns sugeridas
`ligarPara` · `useEhCelular` (já solto em BotaoInstalar.jsx:17) · tabela→cartões com `CartaoLinha` · `CartaoAluno` (Migração/Resgate) · `CampoBusca` · `Janela` · `AbasSegmentadas` · `BarraMeta` · `BotoesContato` (WhatsApp + Ligar) · `Dica` · classe `seletor` (copiada em 3 lugares).
