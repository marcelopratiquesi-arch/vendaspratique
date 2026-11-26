# Versão celular de TODAS as telas — plano (26/11/2026)

## Decisões do dono (26/11/2026)
1. Celular sempre no tamanho **Grande** (zoom 1). Computador continua com Pequeno/Médio/Grande. **(feito na Onda 0)**
2. Tabelas: **cartões** nas telas do dia a dia (Dashboard e abas, Histórico, Pendências, CRM, Fechamento/Conferência/Comissões, Alunos, Comunicados, dashboards da Avaliação); **arrastar para o lado com a 1ª coluna parada** nas de Admin (Cadastros, Configurações, Permissões, Auditoria, Acessos → Todos os logins, Lixeiras).
3. Lançar venda: **Confirmar preso no rodapé**, cada item vira cartão, listas de item e de consultor em **tela cheia com busca**.
4. Publicar direto, sem pedir autorização a cada passo; o dono testa tudo no fim.
5. Praticamente todas as telas são usadas no celular pelos Líderes.

## REGRAS DE OURO (valem para todas as conversas)
- **O computador NÃO muda.** Toda mudança é "classe de celular + `md:` devolvendo o que existe hoje" (ex.: `p-4 md:p-8`, `grid-cols-1 md:grid-cols-3`). Tabela: `<div className="hidden md:block">` (a tabela de hoje, intocada) + `<div className="md:hidden">` (cartões). Celular = até 767px.
- **Nenhuma função some** (regra 2 do CLAUDE.md): tudo que a tabela faz (botões, copiar, ordenar, abrir ficha) precisa existir no cartão.
- **Mexer só nas pastas do seu grupo** (lista abaixo). Precisou de algo fora? Anote no fim do relatório, não mexa.
- **Não mexer** nas peças comuns da Onda 0 (`src/components/celular/`, `App.jsx`, `index.css`, `index.html`, `components/layout/`, `FiltrosCompactos.jsx`, `HistoricoVendas/CopyButton.jsx`, `CartaoPendencias.jsx`, `BotaoInstalar.jsx`, `Avisos.jsx`, `i18n/traduzir.js`). Se uma delas precisar de ajuste, anote.
- **Traduções:** frase nova vai SÓ no arquivo do seu grupo em `src/i18n/frases/celular/` (en-US e es-AR). Não mexer em `frases/en-US.js`/`es-AR.js`. Antes de criar frase, ver se ela já existe (`grep '"Frase":' src/i18n/frases/en-US.js`).
- Visual do CLAUDE.md (regra 7): azul, `font-black`, `uppercase tracking-widest` nos rótulos, `rounded-xl/2xl`, modo escuro (`dark:`), letra mínima 10px, botões tocáveis `h-10` no celular.
- Sem `alert()`; avisos com `avisar()`.
- Ao terminar cada tela: `npm run build` (tem que dar "built") e `npm run lint` (nenhum erro novo). Depois **commit e push no main** (o dono autorizou publicar direto): `git pull --rebase` antes do `git push`. Mensagem: `feat(celular): <grupo> — <telas>`.
- No fim, escrever `docs/celular/feito-LETRA.md` (o que mudou, por tela, e o que ficou pendente) — NÃO editar este PLANO.md (as conversas brigariam pelo mesmo arquivo) — e contar ao dono, em português simples, o que mudou e o que ficou para trás.

## Peças comuns prontas (Onda 0, feita nesta conversa)
| Peça | Onde | Para que |
|---|---|---|
| Zoom 1 no celular | `App.jsx` (efeito "Escala da interface") | letra e botões no tamanho real |
| Campos com 16px no celular | `index.css` | iPhone não dá zoom ao tocar no campo (não precisa `text-base` nos campos) |
| `.tabela-arrasta` | `index.css` | Admin: `<div className="overflow-x-auto"><table className="tabela-arrasta …">` → 1ª coluna parada no celular |
| `.abas-rolaveis` | `index.css` | faixa de abas que rola para o lado no celular (em vez de quebrar em 3 linhas) |
| `--faixa-instalar` | `index.css` + `BotaoInstalar` | altura da faixa "Instale o app"; rodapé fixo novo usa `bottom-[var(--faixa-instalar)]` |
| `useEhCelular()`, `ehCelularAgora()` | `components/celular/ehCelular.js` | só quando o COMPORTAMENTO muda (Conversa em tela cheia, Kanban por abas) |
| `ligarPara(tel)`, `linkLigacao(tel)` | `components/celular/telefone.js` | Ligar: `tel:` no celular, `sip:` (MicroSIP) no computador |
| `<Janela>` | `components/celular/Janela.jsx` | janela padrão: tela cheia no celular (ou `modoCelular="baixo"`), rodapé sempre visível, Esc, X de 40px |
| `<CartaoCelular>`, `<LinhaCartao>`, `<GradeCartao>`, `<NumeroCartao>`, `<OrdenarCelular>` | `components/celular/Cartao.jsx` | cartões no lugar das tabelas; select "Ordenar por" do celular |
| `<Dica>` | `components/celular/Dica.jsx` | "?" que abre no toque (no lugar de `title=` que explica algo) |
| Período e filtros múltiplos | `HistoricoVendas/FiltrosCompactos.jsx` | no celular abrem como folha que sobe de baixo |
| Botão de copiar padrão | `HistoricoVendas/CopyButton.jsx` | maior no celular |
| Topo, menu, cartões do canto, avisos | `layout/*`, `App.jsx`, `CartaoPendencias` (vira pílula "N pendências" no celular), `CobrancaRelatorioRecepcao`, `AvisoAcessoTemporario` | toque maior, nada um em cima do outro, unidade visível no topo |

Modelo de tela boa no celular: **aba Metas** (ver sondagem-2, "O MODELO").

## Grupos (uma conversa por grupo, sem cruzar)
Ordem do menu de cima para baixo. Cada grupo tem o relatório do detetive com linha por linha.

| Grupo | Pastas (só estas) | Relatório | Arquivo de traduções |
|---|---|---|---|
| **A — Lançar venda, Histórico, Alunos** | `pages/Lancamentos`, `pages/HistoricoVendas` (menos FiltrosCompactos/CopyButton), `pages/Alunos`, `components/Modals/ModalAluno.jsx`, `components/AvisoCadastroIncompleto.jsx` | sondagem-1 | `A-vendas-historico-alunos.js` |
| **B — Dashboard (todas as abas)** | `pages/AnaliseVendas`, `components/BotaoCentralUnidade.jsx` | sondagem-2 | `B-dashboard.js` |
| **C — CRM** | `pages/CrmVisitantes` | sondagem-3 | `C-crm.js` |
| **D — Fechamento, Pendências, Acessos, Comunicados** | `pages/FechamentoCaixa`, `pages/Pendencias` (menos CartaoPendencias/CobrancaRelatorioRecepcao), `pages/Acessos`, `components/acesso` (menos AvisoAcessoTemporario), `pages/Comunicados`, `components/avisosCelular` | sondagem-4 | `D-fechamento-pendencias-comunicados.js` |
| **E — Avaliação, Cadastros, Configurações, Permissões** | `pages/AvaliacaoFisica`, `pages/CadastroGeral`, `pages/Configuracoes`, `src/permissoes` | sondagem-4 | `E-avaliacao-cadastros-config.js` |

### Texto para colar na conversa nova (trocar a LETRA)
> Projeto celular, **grupo LETRA**. Leia `docs/celular/PLANO.md` (regras de ouro, peças comuns e a linha do grupo LETRA na tabela) e o relatório do detetive do grupo. Faça todas as telas do grupo, da primeira aba do menu para baixo, seguindo o relatório linha por linha e usando as peças comuns. Mexa só nas pastas do grupo. Não precisa pedir autorização: a cada tela pronta, build + lint, commit e push no main (com `git pull --rebase` antes). No fim, escreva `docs/celular/feito-LETRA.md` e me conte o que mudou e o que ficou pendente.

## Feito
- **Onda 0 (26/11/2026):** peças comuns acima. Build ok, lint sem erro novo.
- Cada grupo: `docs/celular/feito-A.md` … `feito-E.md`.
