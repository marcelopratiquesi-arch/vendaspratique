# Sondagem 4 — Estrutura comum, Fechamento, Pendências, Acessos, Comunicados, Avaliação, Cadastros, Configurações (26/11/2026)

Só leitura. A = quebra/impede o uso · M = fica ruim · B = acabamento. Nenhum `text-[8px]/[9px]` (466 usos de `text-[10px]`).

## Estrutura comum → feita na Onda 0 (ver PLANO.md)
Zoom 0.8 preso no celular (App 83–84, 379–390) · campos < 16px dão zoom no iPhone (index.css) · `viewport-fit=cover` (index.html 7) · cartões fixos de baixo se sobrepõem (App 1164–1172, CobrancaRelatorioRecepcao 106, AvisoAcessoTemporario 37, BotaoInstalar 60 z-9998) · avisos de cima se sobrepõem (AvisoConexao 60, AvisoVersaoNova 57, IdleCurtain 19, Avisos 34) · X pequenos (Avisos 47, BotaoInstalar 71) · TopBar 201/213 ícones `w-8` · TopBar 218 unidade some no celular · Sidebar mobile 131–135/156/296/333/340/250 toque pequeno · IdleCurtain 28 `h-8` · FiltrosCompactos 107/117/241 menu vaza e sem max-h (A, em todas as telas). CommandPalette 204–207 já é tela cheia (modelo).

## FechamentoCaixa (dia a dia → cartões)
- index.jsx 422 abas `max-md:h-10` (B).
- **ConferenciaTab.jsx**: 421–422 janela de edição sem rolagem (Salvar fora da tela) → `fixed inset-0 overflow-y-auto`, tela cheia, rodapé sticky (A); 423 tirar `cursor-move`; 510–522 rodapé `flex-col-reverse sm:flex-row`, `h-11`; 530 `p-4 md:p-6`; 580–599 `h-10`; **606–781 tabela 5 col. + coluna fixa à direita (~180px), arrasto com mouse (613–616) → cartões** (data/unidade, aluno/CPF, item/vendedor, valor/observação, botão grande OK/PENDENTE `h-11 w-full`, Editar/Apagar) (A); 62 copiar `max-md:opacity-100`; 751/762 Editar/Apagar `h-10` (A); 716 observação `max-md:h-10`.
- **ComissoesTab.jsx**: 217–400 tabela 6 col. com linha que abre (372) → cartões (nome, CPF, banco, total grande, Copiar tudo/Recibo `grid-cols-2`, detalhe embaixo) (A); 47–55 CopyButton `max-md:p-2.5`; 350/361 `h-10`; 173 `p-4 md:p-8`.
- AuditoriaTab.jsx (Admin → arrasta): 143–144 `min-w-[1080px]` 1ª coluna `sticky left-0 z-10 bg-white dark:bg-slate-900`; 136–139/238 `h-10`/`w-10`.
- VisaoGeralTab.jsx: 273–274 tabela 6 col. → cartões por unidade; 62 rótulo da barra só no hover.
- PainelPagamento.jsx: 201 tela cheia no celular; 178–180 `h-10`.
- ReciboComissao.jsx: 68 padding fixo → `p-4 sm:p-11` (impressão igual); 55 `flex-wrap`.

## Pendencias (dia a dia → cartões)
- **index.jsx**: 182–183 tabela `min-w-[1040px]` 7 col. → cartão por unidade (nome+total, bloco por tipo, Líder, Cobrar) (A); 172 filtros `h-10` ou rolagem lateral; 159 `max-md:w-full`; 282 Cobrar `w-10 h-10`; 145 `title` → Dica.
- PainelEnviosRelatorio.jsx: 123/147 duas tabelas → cartões.
- CartaoPendencias.jsx: 79 `max-h-[60vh]` → recolhido no celular (pílula) (A, Onda 0); 103 X `p-2.5 -m-2`; 96/100 `h-10`.
- JanelaPendencias 133 tela cheia; CobrancaRelatorioRecepcao 79 `max-h-[90vh] overflow-y-auto`, 106 para a pilha (Onda 0); JanelaConferirRelatorio 53 e LembreteCrm 59 `max-h-[90vh] overflow-y-auto`; AvisoCadastroEquipe 128 tela cheia.

## Acessos e components/acesso
- pages/Acessos/index.jsx: `Linha` (50–53) já vira cartão; 386–402 "Todos os logins" → arrastar com coluna Pessoa fixa; botões `h-7`/`h-8` (153–166, 295, 303, 334) → `max-md:h-10`.
- AvisoAcessoTemporario 37 para a pilha (Onda 0); 51 `max-h`; 57 X `p-2.5`.
- **TelaAcesso.jsx 203 `grid-cols-3` com "LÍDER DA UNIDADE" estoura → `grid-cols-1 sm:grid-cols-3` (A)**; 183 DDI `w-24`.
- MeusAcessos 55, AbaTemporarios 139/189/237/336–338 `h-10`; FormCadastrarLider 61 X `p-2.5`.

## Comunicados
- index.jsx: 406 `p-4 md:p-8`; 485 estatísticas `grid-cols-2 sm:grid-cols-4`; 493–500 `h-10 flex-1`; 160–164 relatório tabela `min-w-[800px]` → cartões; 197 `h-10`; 529–530 visualizador tela cheia.
- AvisoCelular.jsx: 167–169 `h-10`; 273 tabela 5 col. espremida → cartões; 322 X `p-2.5`.
- Formulario.jsx 377 X `p-2.5`.

## AvaliacaoFisica
- **PainelAvaliador.jsx**: 597 ranking → cartões; **727–734 histórico `min-w-[900px]` (Detalhado = uma coluna por pergunta) → Resumo em cartões, Detalhado arrasta com 1ª coluna fixa (A)**; 649–670/590 `h-10`; 674 `h-10`; 915/919 `max-md:p-3`; 481 janela `max-h-[90vh] overflow-y-auto`; 492 X `w-10`.
- PainelInicial.jsx: 310–315 janela já é tela cheia no celular (modelo); 669–682 tabela 8–9 col. → cartões; 644 `h-10`.
- FormAvaliacao.jsx 40 InfoTooltip só hover → abrir no toque, `w-[min(16rem,80vw)]`; 31 copiar `p-2.5`.
- ModalEvolucaoAluno 186 tela cheia. TabPerguntasAvaliacao 192 `md:sticky p-4 md:p-6`, 270 tela cheia. LixeiraAvaliacoes 129 arrasta com 1ª coluna fixa.

## CadastroGeral (Admin → arrasta com 1ª coluna fixa)
- TabEquipe 216 (Nome fixo), 306–314 `max-md:w-10 h-10`, 131/139–157 `h-10`.
- TabCatalogo 174 fixa, 97/110/121/218 `h-10`. TabSetores 66, GruposCatalogo 215 fixa; GruposCatalogo 60 `max-h-[90vh] overflow-y-auto`.
- TabUnidades 35–36/195 já tem cartões e janela de baixo (modelo).
- AlunosTab 378 fixa; 456–457 Smart Paste tela cheia, prévia 586 arrasta.
- **ModalCatalogo 87 e ModalSetor 46 sem max-h: Salvar some com o teclado (A)** → `max-h-[90dvh] overflow-y-auto` ou janela de baixo. JanelaDesligamento 38 `max-h`. ModalColaborador 88 tela cheia.
- FichaUnidade 133 `max-md:p-0 rounded-none`, 277/312 coluna fixa. FichaColaborador 620 `max-md:p-0`, 625 `h-10`, 666 `p-2.5`, 435/540 coluna fixa. AbaPanorama 143 `grid grid-cols-2 sm:flex`.

## Configuracoes / permissoes (Admin)
- **Configuracoes/index.jsx 202–205 4 abas sem quebra nem rolagem: estoura em 360px → `overflow-x-auto max-w-full h-10` (A).**
- AbaLogins 196 já vira cartões (manter). AbaBackup 205/289/330 `overflow-x-auto min-w-[560px]` 1ª coluna fixa. AvisoBackup 41 `max-h`.
- AbaPermissoes 328 Nº + Permissão fixas; 387 `max-md:h-10`; 27 chave `p-2 -m-2`. HistoricoPermissoes 64 tela cheia, 89 coluna fixa.

## Peças comuns sugeridas
Janela (~25 janelas copiadas à mão) · TabelaOuCartoes · TabelaAdmin (arrasta, 1ª coluna fixa) · PilhaDoCanto / PilhaDoTopo · BotaoIcone e CopyButton únicos · Dica (AuditoriaTab 47) · AbasSegmentadas.
