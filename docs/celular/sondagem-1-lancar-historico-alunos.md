# Sondagem 1 — Lançar venda, Histórico, Alunos (26/11/2026)

Feita só lendo o código. Correções com classes de celular + `md:` devolvendo o desenho atual (computador não muda).

## Vale para o grupo todo
- Nenhum `text-[8px]`/`[9px]`.
- Campos de digitar com letra < 16px fazem o iPhone dar zoom sozinho: `text-base md:text-sm` em `campoBase`, `inputClassBase`, `inputEdicao`, `campo`.

## Lancamentos
- **FormVenda.jsx** (G): 394 `pb-32 md:pb-10`; 643–662 total + Confirmar em barra fixa no rodapé no celular (`fixed inset-x-0 bottom-0 z-40 border-t pb-[max(1rem,env(safe-area-inset-bottom))] md:static`), mostrar o `oQueFalta` (655, hoje só no `title`) dentro da barra; 524–529 cada item vira cartão (`rounded-2xl border p-3` abaixo de 900px, `space-y-3`); 534–545 categoria em `grid grid-cols-3 w-full min-[900px]:inline-flex`; 557/575 `w-full min-[900px]:max-w-[340px]/[280px]`; 588/606 Qtd/Comissão `flex-1 min-[900px]:w-[108px]`; 591/598 −/+ `w-11 min-[900px]:w-9`.
- **seletores/comum.js:52 `CLASSE_PAINEL`** + SeletorCatalogo 91–124 + SeletorConsultor 84–134 (M): lista em TELA CHEIA no celular (`fixed inset-0 z-[200] flex flex-col md:absolute ...`), cabeçalho "← Voltar" `md:hidden`, travar rolagem do fundo, `flex-1 md:max-h-72`; nome completo do consultor numa 2ª linha no celular (hoje só `title`); "Mais vendidos" `h-10`.
- **FormVisitante.jsx** (M): 606 sugestões sem altura máxima → `max-h-[60vh] overflow-y-auto`; 558/561/577/753/791 botões pequenos → `min-h-10`; 797–806 enviar no rodapé fixo igual ao FormVenda; 521 `flex-wrap`.
- **index.jsx** (P): 49 abas `w-full sm:w-fit`, abas `flex-1`.
- HubSelecao.jsx não é importado por ninguém (não mexer).

## HistoricoVendas
- **TabelaHistorico.jsx** (G): 396–638 tabela → cartões abaixo de md (`hidden md:table` + `md:hidden`), edição do cartão em formulário em coluna (base: AbaDuplicidades 202–218); 394 maxHeight só no md; 599–621 Editar/Apagar `h-10`; 643–660 paginação `h-10`; 338 abas com texto curto no celular.
- **FiltrosCompactos.jsx** (M, usado no sistema todo): 117 SeletorPeriodo e 241 FiltroMultiplo `w-72` vazam da tela → painel de baixo no celular (`fixed inset-x-0 bottom-0 rounded-t-2xl max-h-[80dvh] overflow-y-auto md:absolute md:w-72 md:rounded-2xl`); 107 `w-full sm:w-auto sm:min-w-[200px]`; 66–69/251/258 alturas `h-10`.
- **index.jsx** (P): 425 `flex-wrap`; 449 busca `basis-full sm:basis-auto`; 460/494 botões X maiores.
- **AbaDuplicidades.jsx** (P, já são cartões): botões `h-10`, `inputEdicao` maior.
- **AbaLixeira.jsx** (M): 91–145 tabela 8–9 colunas → cartões; Restaurar `h-10 w-full`.
- **CopyButton.jsx** (P): 47 `p-2.5 md:p-1`.

## Alunos
- **ListaAlunos.jsx** (G): 237–409 tabela com 1ª coluna presa de 300px + Ações presa → cartões abaixo de md; 49 copiar só aparece no mouse → `opacity-100 md:opacity-0 md:group-hover...`; 363–400 ações com texto (Vender/Avaliar/Editar) `h-10` no cartão; 120/235 maxHeight só no md; 417–432 paginação com quebra e `h-9/h-10`; 217 select `h-10`.
- **FiltrosAlunos.jsx** (P): 60 `flex-wrap`; 132 SeletorPeriodo vaza (resolvido no FiltrosCompactos).
- **index.jsx** (P): 346 aviso fixo `inset-x-4 bottom-4 md:...`.
- **ModaisAlunos.jsx** (P): 118 botões `flex-col-reverse sm:flex-row`; 55 `max-h-[90dvh] overflow-y-auto`.
- **ficha/**: index 248 Voltar `h-10`; CabecalhoFicha 106 e-mail `break-all`, 77–110 copiar `!w-9 !h-9 md:!w-6 md:!h-6`, 119–130 botões `h-10`; ResumoCardsFicha 64 `grid-cols-2 lg:grid-cols-5`, `min-h-0 md:min-h-[105px]`; TabPlanos/TabProdutos tabelas → cartões (mesmo componente); TabAvaliacoes 463–511 tabela → cartões, 307/309 setas maiores (a janela 282–288 já é tela cheia no celular = modelo); CopyButton 49 `w-9 h-9 md:w-6 md:h-6`.

## components/Modals/ModalAluno.jsx (M, ALTA)
- 433–434 janela sem rolagem: no celular não chega no Salvar (trava a Nova Venda). Tela cheia no celular (`h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-[24px]`, formulário `flex-1 overflow-y-auto`).
- 501–580 `grid-cols-1 sm:grid-cols-2`; 583–589 rodapé `sticky bottom-0`, botões `flex-col-reverse sm:flex-row w-full sm:w-auto h-11`.

## Peças comuns sugeridas
Botão de copiar único (há 3 versões) · TabelaOuCartoes · Paginacao · Janela (tela cheia no celular) · PainelSuspenso (lista/menu que vira tela cheia/painel de baixo) · RodapeAcaoFixo · AbasRolaveis.
