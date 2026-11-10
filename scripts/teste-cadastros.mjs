// Teste da revisão 360 de Cadastros e das subabas do menu (09/11/2026).
// Rodar: node scripts/teste-cadastros.mjs
import fs from 'fs';

let falhas = 0; let n = 0;
const teste = (nome, ok) => { n++; console.log(`${ok ? '✅' : '❌'} ${n}. ${nome}`); if (!ok) falhas++; };
const ler = (f) => fs.readFileSync(f, 'utf8');

// O menu e as telas conversam por eventos do navegador: aqui um "window" de mentira para testar
const ouvintes = {};
globalThis.CustomEvent = class { constructor(tipo, o) { this.type = tipo; this.detail = o?.detail; } };
globalThis.window = {
    addEventListener: (t, f) => { (ouvintes[t] ||= []).push(f); },
    removeEventListener: (t, f) => { ouvintes[t] = (ouvintes[t] || []).filter(x => x !== f); },
    dispatchEvent: (e) => { (ouvintes[e.type] || []).forEach(f => f(e)); return true; },
};

const { grupoDoItem } = await import('../src/pages/CadastroGeral/grupoCatalogo.js');
const sub = await import('../src/components/subAbas.js');

// 1) Grupo do Catálogo = a mesma regra das metas (decomporPlano) e da dose única
teste('grupo do catálogo (Plus, Plus + Nutri, Nutri adicional, Fit, dose única, produto, serviço)',
    grupoDoItem({ tipo: 'plano', nome: 'PLUS' }).texto === 'Plus'
    && grupoDoItem({ tipo: 'plano', nome: 'PLUS + NUTRI' }).texto === 'Plus + Nutri'
    && grupoDoItem({ tipo: 'plano', nome: 'PRATIQUE NUTRI' }).texto === 'Nutri (adicional)'
    && grupoDoItem({ tipo: 'plano', nome: 'FIT TRIMESTRAL' }).texto === 'Fit'
    && grupoDoItem({ tipo: 'plano', nome: 'AFILIADOS PLUS' }).texto === 'Plus'
    && grupoDoItem({ tipo: 'produto', nome: 'WHEY 40G CHOCOLATE' }).texto.startsWith('Dose única')
    && grupoDoItem({ tipo: 'produto', nome: 'GARRAFA' }).texto === 'Produto'
    && grupoDoItem({ tipo: 'servico', nome: 'REAVALIAÇÃO' }).texto === 'Serviço');

// 2) Subabas: o menu pede, a tela consome uma vez só; a tela avisa qual está aberta
let recebido = null;
window.addEventListener(sub.EVENTO_PEDIR_SUBABA, (e) => { recebido = e.detail; });
sub.pedirSubaba('cadastros', 'equipe');
const primeira = sub.consumirSubaba('cadastros');
const segunda = sub.consumirSubaba('cadastros');
let atual = null;
window.addEventListener(sub.EVENTO_SUBABA_ATUAL, (e) => { atual = e.detail; });
sub.avisarSubabaAtual('cadastros', 'setores');
teste('subabas: pedir, consumir uma vez e avisar a aberta',
    recebido?.tela === 'cadastros' && recebido?.aba === 'equipe' && primeira === 'equipe' && segunda === null
    && atual?.aba === 'setores' && sub.subabaAtual('cadastros') === 'setores');

// 3) Menu: Dashboard e Cadastros com subabas e as mesmas regras das telas
const app = ler('src/App.jsx');
teste('App: subabas do Dashboard e do Cadastros com permissões (Ranking só na rede, Unidades só Admin)',
    app.includes("{ id: 'rankingGlobal', label: 'Ranking global', codigo: '304', soRede: true }")
    && app.includes("{ id: 'unidades', label: 'Unidades', codigo: '808', soAdmin: true }")
    && app.includes("pedirAbaAnalise(aba, { rolar: false })") && app.includes('abrirSubaba={abrirSubaba}'));

// 4) Menu lateral: lista embaixo do item, seta para abrir, balão no menu recolhido e posição certa com o zoom
const sidebar = ler('src/components/layout/Sidebar.jsx');
teste('menu lateral: subabas, seta, balão e posição com o zoom',
    sidebar.includes('<ListaSubabas') && sidebar.includes('alternarAberto(tab.id)') && sidebar.includes('{balao && (')
    && sidebar.includes('zoomDaPagina()') && sidebar.includes('EVENTO_SUBABA_ATUAL'));

// 5) Telas avisam a aba aberta e aceitam o pedido do menu
const analise = ler('src/pages/AnaliseVendas/index.jsx');
const cad = ler('src/pages/CadastroGeral/index.jsx');
teste('Dashboard e Cadastros ligados ao menu (sem rolar até a Movimentação ao trocar de aba pelo menu)',
    analise.includes("avisarSubabaAtual('analise', abaMostrada)") && analise.includes('consumirRolarPedido()')
    && cad.includes("consumirSubaba('cadastros')") && cad.includes("avisarSubabaAtual('cadastros', abaMostrada)"));

// 6) Item 1: Equipe esconde Novo/Editar/Desligar sem a permissão 807; dados bancários completos só para o Admin
const equipe = ler('src/pages/CadastroGeral/TabEquipe.jsx');
teste('Equipe: botões só com a permissão 807 e CPF/conta bancária só para o Admin',
    equipe.includes('{podeEditarEquipe && (') && (equipe.match(/podeEditarEquipe && \(/g) || []).length >= 2
    && equipe.includes('{ehAdmin && <span className="block text-[10px] font-mono') && cad.includes('ehAdmin={ehAdmin}'));

// 7) Item 2: o mesmo nome em QUALQUER categoria bloqueia
teste('Catálogo: nome repetido em outra categoria é bloqueado',
    cad.includes('normalizeString(item.nome) === nomeNovo && item.id !== payload.id') && !cad.includes('item.nome === payload.nome && item.tipo === payload.tipo'));

// 8) Item 3: renomear setor troca nas pessoas (com aviso) e excluir só setor vazio
teste('Setores: renomear atualiza a Equipe e excluir só setor sem ninguém',
    cad.includes(".update({ role: payload.nome }).ilike('role', antigo.nome)") && cad.includes("window.confirm(tx('Renomear o setor")
    && cad.includes("if (count > 0) {") && ler('src/pages/CadastroGeral/TabSetores.jsx').includes('Pessoas na equipe'));

// 9) Item 4: busca de Alunos na rede inteira (regra 8) por nome, CPF, telefone, e-mail ou matrícula + ficha + Situação
const alunos = ler('src/pages/CadastroGeral/AlunosTab.jsx');
const utilsAlunos = ler('src/pages/Alunos/utils.js');
teste('Alunos: busca na rede (com matrícula), ficha em pop-up, Situação, cadastro do TECACE e dado de preenchimento',
    alunos.includes('buscarAlunosNaRede({') && utilsAlunos.includes('matricula.ilike') && alunos.includes('<FichaAlunoPopup')
    && alunos.includes('corSituacaoAluno(situacao)') && alunos.includes('a.data_cadastro || a.created_at')
    && alunos.includes('telefoneFalso(a.telefone)') && alunos.includes('<EtiquetasUnidade'));

// 10) Ordenar pelo título (regra única) em Equipe, Catálogo e Setores; nada de botões escondidos no "passar o mouse"
const catalogo = ler('src/pages/CadastroGeral/TabCatalogo.jsx');
const setores = ler('src/pages/CadastroGeral/TabSetores.jsx');
teste('ordenar pelo título e botões sempre visíveis em Equipe, Catálogo e Setores',
    [equipe, catalogo, setores].every(t => t.includes('<TituloOrdenavel') && t.includes('ordenarLinhas(') && !t.includes('opacity-0 group-hover:opacity-100') && !t.includes('lg:opacity-0')));

// 11) Nada foi tirado: Smart Paste, Novo colaborador, Novo item, Novo setor, desligar/reativar, descontinuar/reativar
teste('funções antigas continuam (Smart Paste, novos cadastros, desligar, descontinuar, editar aluno)',
    alunos.includes('setModalPasteOpen(true)') && alunos.includes('setModalAlunoAberto(true)')
    && equipe.includes('onOpenModal') && equipe.includes('onToggleStatus(c)')
    && catalogo.includes('onOpenModal') && catalogo.includes('onToggleStatus(item)')
    && setores.includes('onOpenModal') && setores.includes('onDelete(s.id, s.nome)'));

// 12) O pop-up da ficha continua dizendo "Voltar para o CRM" no CRM (o texto novo é só para Cadastros)
const popup = ler('src/pages/CrmVisitantes/FichaAlunoPopup.jsx');
teste('ficha em pop-up: "Voltar para o CRM" continua o padrão',
    popup.includes('rotuloVoltar = "Voltar para o CRM"') && alunos.includes('rotuloVoltar="Voltar para Cadastros"'));

// ---------- Subabas de 10/11/2026: Histórico, Fechamento, CRM e Avaliação ----------
const appTxt = ler('src/App.jsx');
const temSub = (tela, ids) => ids.every(id => appTxt.includes(`{ id: '${id}'`)) && appTxt.includes(`        ${tela}: [`);

// 13) App: as 4 telas com subabas e as mesmas permissões das telas
teste('App: subabas do Histórico, Fechamento, CRM e Avaliação com as permissões das telas',
    temSub('assinaturas', ['registros', 'duplicidades', 'lixeira']) && appTxt.includes("{ id: 'duplicidades', label: 'Duplicidades', codigo: '202' }")
    && temSub('fechamento', ['conferencia', 'comissoes', 'geral', 'auditoria']) && appTxt.includes("{ id: 'auditoria', label: 'Auditoria', codigo: '404' }")
    && temSub('crm', ['equipe', 'painel', 'contatos']) && appTxt.includes("{ id: 'contatos', label: 'Contatos', codigo: '504' }")
    && temSub('avaliacao', ['avaliadores', 'unidade', 'global']) && appTxt.includes("{ id: 'global', label: 'Dashboard Global', codigo: '702', soRede: true }"));

// 14) Cada tela abre na aba pedida e avisa qual está aberta (o menu marca em azul)
const telasSub = [
    ['src/pages/HistoricoVendas/TabelaHistorico.jsx', 'assinaturas', 'visaoMostrada'],
    ['src/pages/FechamentoCaixa/index.jsx', 'fechamento', 'abaMostrada'],
    ['src/pages/CrmVisitantes/PainelInicialCrm.jsx', 'crm', 'abaMostrada'],
    ['src/pages/AvaliacaoFisica/index.jsx', 'avaliacao', 'subabaMostrada'],
];
teste('Histórico, Fechamento, CRM e Avaliação aceitam o pedido do menu e avisam a aba aberta',
    telasSub.every(([f, tela, v]) => { const t = ler(f); return t.includes(`consumirSubaba('${tela}')`) && t.includes(`avisarSubabaAtual('${tela}', ${v})`) && t.includes('EVENTO_PEDIR_SUBABA'); }));

// 15) CRM: no CRM de uma recepcionista, escolher Equipe/Painel/Contatos volta para a entrada
const crmIndex = ler('src/pages/CrmVisitantes/index.jsx');
teste('CRM: subaba no menu volta para a entrada; no CRM da pessoa nenhuma fica marcada',
    crmIndex.includes("if (e.detail?.tela === 'crm') setConsultorAtivo(null);") && crmIndex.includes("avisarSubabaAtual('crm', null)"));

// 16) Avaliação: os mesmos lugares dos botões da tela inicial, e pergunta antes de sair no meio de uma avaliação
const aval = ler('src/pages/AvaliacaoFisica/index.jsx');
teste('Avaliação: Avaliadores, Dashboards e Lixeira pelo menu, com pergunta antes de largar uma avaliação',
    aval.includes("id: 'GERAL'") && aval.includes("id: 'GLOBAL'") && aval.includes("setAbaAtiva('lixeira')")
    && aval.includes("abaAtivaRef.current === 'nova' && !window.confirm(tx('Sair da avaliação sem salvar?'))"));

// 17) O menu guarda a aba aberta de todas as telas com subabas
teste('menu: lembra a aba aberta das 6 telas', sidebar.length > 0 && ler('src/components/layout/Sidebar.jsx').includes("['analise', 'cadastros', 'assinaturas', 'fechamento', 'crm', 'avaliacao']"));

// ---------- Segunda revisão do Cadastros (10/11/2026): janelas, CPF repetido, planilha e páginas ----------
const { validarCPF } = await import('../src/pages/CadastroGeral/utilsAlunos.js');
const { lerNumeroBR } = await import('../src/pages/AnaliseVendas/movimentoDiario.js');
const mColab = ler('src/pages/CadastroGeral/ModalColaborador.jsx');
const mCat = ler('src/pages/CadastroGeral/ModalCatalogo.jsx');
const mSetor = ler('src/pages/CadastroGeral/ModalSetor.jsx');
const cad2 = ler('src/pages/CadastroGeral/index.jsx');

// 18) Itens 1 e 3: CPF conferido de verdade e turno com os horários do CRM
teste('Equipe: CPF com dígito errado é barrado e o turno mostra 7h–13h / 13h–21h',
    validarCPF('529.982.247-25') && !validarCPF('529.982.247-26') && !validarCPF('111.111.111-11')
    && mColab.includes('if (!validarCPF(cpf))') && mColab.includes("tx('Manhã (7h às 13h)')") && mColab.includes("tx('Noite (13h às 21h)')") && !mColab.includes('5h às 14h'));

// 19) Item 2: o mesmo CPF não entra duas vezes (banco + tela, com e sem pontos)
teste('Equipe: CPF repetido não salva',
    cad2.includes(".in('cpf', [payload.cpf, cpfNumeros])") && cad2.includes("const outro = [...(mesmos || []), ...daTela].find(c => c.id !== payload.id);"));

// 20) Itens 4, 5 e 7: comissão com vírgula, aviso ao mudar a comissão e "Vai contar como"
teste('Catálogo: vírgula na comissão, aviso de que vale só para vendas novas e "Vai contar como"',
    lerNumeroBR('5,50') === 5.5 && lerNumeroBR('5.50') === 5.5 && lerNumeroBR('10') === 10
    && mCat.includes('lerNumeroBR(valor)') && mCat.includes('Vale só para as vendas lançadas a partir de agora') && mCat.includes("tx('Vai contar como:')")
    && !mCat.includes('99.90') && !mCat.includes('type="number"'));

// 21) Itens 6, 8, 9 e 12: setor fora da lista aparece, aviso do nome do setor, unidade azul, copiar PIX, Esc e cursor no 1º campo
teste('Janelas: setor fora da lista, aviso RECEP/LIDER, unidade sem vermelho, copiar PIX, Esc e autoFocus',
    mColab.includes("tx('fora da lista')") && mSetor.includes('Com "RECEP" no nome') && !mColab.includes('text-rose-500 uppercase') && mColab.includes('<CopyButton')
    && [mColab, mCat, mSetor].every(t => t.includes("e.key === 'Escape'") && t.includes('autoFocus')));

// 22) Itens 10 e 11: planilha da Equipe só para o Admin e 50 alunos por página (com páginas em cima e embaixo)
const eq2 = ler('src/pages/CadastroGeral/TabEquipe.jsx');
const al2 = ler('src/pages/CadastroGeral/AlunosTab.jsx');
teste('Equipe: Exportar planilha só Admin · Alunos: 50 por página, páginas em cima e embaixo',
    eq2.includes('{ehAdmin && (\n') && eq2.includes('onClick={exportarPlanilha}') && eq2.includes("'\\ufeff'")
    && al2.includes('const ITENS_POR_PAGINA = 50;') && al2.includes("{barraPaginas('border-b')}") && al2.includes("{barraPaginas('border-t')}"));

console.log(falhas === 0 ? `\nTudo certo: ${n} de ${n} testes passaram.` : `\n${falhas} de ${n} testes FALHARAM.`);
process.exit(falhas ? 1 : 0);
