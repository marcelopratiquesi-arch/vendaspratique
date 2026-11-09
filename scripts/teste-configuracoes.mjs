// Teste da tela nova de Configurações (Logins) e da aba Unidades de Cadastros (09/11/2026).
// Rodar: node scripts/teste-configuracoes.mjs
import fs from 'fs';
import { filtrarLogins, resumoLogins, ordenarLogins, conferirLogins, resumoDaUnidade } from '../src/pages/Configuracoes/conferenciaLogins.js';
import { temPermissao, CATALOGO_PERMISSOES } from '../src/permissoes/catalogoPermissoes.js';

let falhas = 0; let n = 0;
const teste = (nome, ok) => { n++; console.log(`${ok ? '✅' : '❌'} ${n}. ${nome}`); if (!ok) falhas++; };
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const usuarios = [
    { email: 'rec.neves@x.com', nome: 'RECEPÇÃO NEVES', role: 'RECEPCAO', unidade: 'NEVES' },
    { email: 'admin@x.com', nome: 'MARCELO', role: 'ADMIN', unidade: 'TODAS' },
    { email: 'dayse@x.com', nome: 'DAYSE', role: 'LIDER', unidade: 'PRADO' },
    { email: 'joao@x.com', nome: 'JOÃO MENTOR', role: 'MENTOR', unidade: 'TODAS' },
    { email: 'pedro@x.com', nome: 'PEDRO', role: 'MENTOR', unidade: 'TODAS' },
    { email: 'velho@x.com', nome: 'ANTIGO', role: 'LIDER', unidade: 'FECHADA' },
    { email: 'sumiu@x.com', nome: 'SUMIU', role: 'RECEPCAO', unidade: 'NAO EXISTE' },
    { email: 'global@x.com', nome: 'LIDER GLOBAL', role: 'LIDER', unidade: 'TODAS' },
];
const unidades = [
    { id: 1, nome: 'NEVES', ativa: true }, { id: 2, nome: 'PRADO' },
    { id: 3, nome: 'FECHADA', ativa: false }, { id: 4, nome: 'SANTA INÊS' },
];
const vinculos = { 'joao@x.com': ['NEVES', 'SANTA INÊS'] };

// 1) Busca sem acento acha pelo nome; busca acha pelo e-mail
teste('busca por nome sem acento e por e-mail',
    filtrarLogins(usuarios, { busca: 'joao' }).map(u => u.email).join() === 'joao@x.com'
    && filtrarLogins(usuarios, { busca: 'DAYSE@' }).length === 1);

// 2) Filtro por nível
teste('filtro por nível (Mentor = 2)', filtrarLogins(usuarios, { papel: 'MENTOR' }).length === 2);

// 3) Filtro por unidade traz o login da unidade E o Mentor que tem a unidade marcada
teste('filtro por unidade inclui o Mentor pelas unidades marcadas',
    iguais(filtrarLogins(usuarios, { unidade: 'NEVES', vinculos }).map(u => u.email).sort(), ['joao@x.com', 'rec.neves@x.com']));

// 4) Resumo por nível bate com o total
const r = resumoLogins(usuarios);
teste('resumo por nível soma o total', r.total === 8 && r.porPapel.ADMIN === 1 && r.porPapel.MENTOR === 2 && r.porPapel.LIDER === 3 && r.porPapel.RECEPCAO === 2);

// 5) Ordem: Admin, Mentor, Líder, Recepção
const papeis = ordenarLogins(usuarios).map(u => u.role);
teste('ordem Admin → Mentor → Líder → Recepção', iguais(papeis, ['ADMIN', 'MENTOR', 'MENTOR', 'LIDER', 'LIDER', 'LIDER', 'RECEPCAO', 'RECEPCAO']));

// 6) Mentor sem unidade marcada aparece em "para conferir"; o que tem unidade não
const avisos = conferirLogins({ usuarios, unidades, vinculos });
const tem = (tipo, chave) => avisos.some(a => a.tipo === tipo && (a.email === chave || a.unidade === chave));
teste('Mentor sem unidade é avisado (Pedro sim, João não)', tem('mentor_sem_unidade', 'pedro@x.com') && !tem('mentor_sem_unidade', 'joao@x.com'));

// 7) Login em unidade desativada, inexistente e Líder ligado a "Todas"
teste('avisa unidade desativada, inexistente e Líder em "Todas"',
    tem('unidade_desativada', 'velho@x.com') && tem('unidade_inexistente', 'sumiu@x.com') && tem('sem_unidade_propria', 'global@x.com'));

// 8) Unidade ativa sem Líder / sem Recepção; unidade desativada não é cobrada
teste('unidade sem Líder/Recepção (desativada fica de fora)',
    tem('unidade_sem_lider', 'NEVES') && !tem('unidade_sem_lider', 'PRADO') && tem('unidade_sem_recepcao', 'PRADO')
    && !tem('unidade_sem_recepcao', 'NEVES') && tem('unidade_sem_lider', 'SANTA INÊS') && !avisos.some(a => a.unidade === 'FECHADA' && a.tipo.startsWith('unidade_sem')));

// 9) Resumo da unidade: logins, equipe ATIVA, recepcionistas e Líder da Equipe
const colaboradores = [
    { nome: 'ANA', unidade: 'NEVES', role: 'RECEPÇÃO', ativo: true },
    { nome: 'BIA', unidade: 'NEVES', role: 'RECEPCAO' },
    { nome: 'CAIO', unidade: 'NEVES', role: 'MUSCULAÇÃO', ativo: true },
    { nome: 'DUDA', unidade: 'NEVES', role: 'RECEPÇÃO', ativo: false },
    { nome: 'EDU', unidade: 'neves', role: 'LIDER', ativo: true },
];
const rn = resumoDaUnidade('NEVES', { usuarios, colaboradores });
teste('resumo da unidade (desligado não conta, nome sem diferenciar maiúscula)',
    rn.logins === 1 && rn.equipe === 4 && rn.recepcionistas === 2 && rn.lideres.length === 0 && iguais(rn.lideresEquipe, ['EDU']) && rn.temRecepcao);

// 10) Permissões: aba Unidades (808) só Admin e travada; 906 aposentado; Configurações (011) só Admin;
//     a tela antiga saiu e a nova existe; o App aponta para a pasta nova
const p808 = CATALOGO_PERMISSOES.find(p => p.codigo === '808');
const app = fs.readFileSync('src/App.jsx', 'utf8');
teste('permissão 808 só Admin, 906 aposentado, Configurações só Admin, App ligado',
    !!p808 && p808.travada === true
    && ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'].map(papel => temPermissao({ codigo: '808', papel, regrasPapel: new Map([[`${papel}|808`, true]]) })).join() === 'true,false,false,false'
    && !CATALOGO_PERMISSOES.some(p => p.codigo === '906')
    && temPermissao({ codigo: '011', papel: 'MENTOR' }) === false
    && !fs.existsSync('src/pages/Configuracoes.jsx') && fs.existsSync('src/pages/Configuracoes/index.jsx')
    && app.includes("./pages/Configuracoes/index.jsx") && app.includes('todasUnidades={unidades} setUnidades={setUnidades}'));

// ---------- Rodada 2 (09/11/2026): ficha da unidade, Pronta?, Mentor, ordenação, diferenças e cópia ----------
const { mentoresDaUnidade, prontidaoDaUnidade } = await import('../src/pages/Configuracoes/conferenciaLogins.js');
const { proximaOrdem, ordenarLinhas, ORDEM_NORMAL } = await import('../src/components/ordenacao.js');

// 11) Mentor pelo lado da unidade: João tem NEVES e SANTA INÊS; Pedro nenhuma; sem diferenciar acento/maiúscula
teste('mentores da unidade (NEVES e "santa ines" acham o João; PRADO ninguém)',
    iguais(mentoresDaUnidade('NEVES', { usuarios, vinculos }).map(m => m.email), ['joao@x.com'])
    && mentoresDaUnidade('santa ines', { usuarios, vinculos }).length === 1
    && mentoresDaUnidade('PRADO', { usuarios, vinculos }).length === 0);

// 12) Unidade pronta: tudo certo = Pronta
const usuariosOk = [...usuarios, { email: 'lider.neves@x.com', nome: 'LIDER NEVES', role: 'LIDER', unidade: 'NEVES' }];
const equipeOk = [{ nome: 'ANA', unidade: 'NEVES', role: 'RECEPÇÃO', ativo: true, turno: 'MANHA' }, { nome: 'BIA', unidade: 'NEVES', role: 'RECEPCAO', turno: 'NOITE' }];
const ok = prontidaoDaUnidade('NEVES', { usuarios: usuariosOk, colaboradores: equipeOk, vinculos, metasPendentes: null });
teste('unidade com tudo = Pronta (6 itens, 0 faltando)', ok.pronta && ok.faltam === 0 && ok.itens.length === 6);

// 13) Falta: sem Líder, sem Mentor, recepcionista sem turno e metas pendentes
const falta = prontidaoDaUnidade('PRADO', {
    usuarios: [{ email: 'r@x', role: 'RECEPCAO', unidade: 'PRADO' }],
    colaboradores: [{ nome: 'CAU', unidade: 'PRADO', role: 'RECEPÇÃO', ativo: true }, { nome: 'DESLIGADA', unidade: 'PRADO', role: 'RECEPÇÃO', ativo: false }],
    vinculos, metasPendentes: { start: { falta: ['Nutri'] }, mensal: null },
});
const estado = Object.fromEntries(falta.itens.map(i => [i.id, i.ok]));
teste('acusa Líder, Mentor, turno e metas (desligada não entra)',
    falta.faltam === 4 && estado.login_recepcao && !estado.login_lider && !estado.mentor && estado.recepcionistas
    && !estado.turno && !estado.metas && iguais(falta.itens.find(i => i.id === 'turno').detalhe, ['CAU'])
    && iguais(falta.itens.find(i => i.id === 'metas').detalhe, ['Meta Start']));

// 14) Sem recepcionista na Equipe, o turno também falha; sem conseguir ler as metas, o item sai (não acusa à toa)
const semRecep = prontidaoDaUnidade('NEVES', { usuarios: usuariosOk, colaboradores: [], vinculos, metasLidas: false });
teste('sem recepcionista: turno falha; metas não lidas: item fora',
    semRecep.itens.length === 5 && !semRecep.itens.find(i => i.id === 'turno').ok && semRecep.faltam === 2);

// 15) Ordenar: número = maior primeiro, 2º clique inverte, 3º volta ao normal
let o = proximaOrdem(ORDEM_NORMAL, 'logins');
const o1 = o.direcao; o = proximaOrdem(o, 'logins'); const o2 = o.direcao; o = proximaOrdem(o, 'logins');
teste('ciclo de cliques (maior → menor → normal; texto começa em A→Z)',
    o1 === 'desc' && o2 === 'asc' && o.coluna === null && proximaOrdem(ORDEM_NORMAL, 'nome', true).direcao === 'asc');

// 16) Ordenar coloca o vazio no fim nos dois sentidos e desempata pelo nome
const linhasOrd = [{ n: 'B', v: 2 }, { n: 'A', v: null }, { n: 'C', v: 5 }, { n: 'D', v: 2 }];
const val = { v: l => l.v };
teste('vazio sempre no fim e empate pelo nome',
    ordenarLinhas(linhasOrd, { coluna: 'v', direcao: 'desc' }, val, l => l.n).map(l => l.n).join('') === 'CBDA'
    && ordenarLinhas(linhasOrd, { coluna: 'v', direcao: 'asc' }, val, l => l.n).map(l => l.n).join('') === 'BDCA'
    && ordenarLinhas(linhasOrd, ORDEM_NORMAL, val, l => l.n) === linhasOrd);

// 17) Ordenar por texto usa a ordem natural (SANTA INÊS 2 antes de SANTA INÊS 10)
const nomes = [{ n: 'SANTA INÊS 10' }, { n: 'SANTA INÊS 2' }, { n: 'ELDORADO' }];
teste('texto em ordem natural', ordenarLinhas(nomes, { coluna: 'n', direcao: 'asc' }, { n: l => l.n }, l => l.n).map(l => l.n).join('|') === 'ELDORADO|SANTA INÊS 2|SANTA INÊS 10');

// 18) Telas novas ligadas: ficha, colunas, diferenças e cópia existem no código
// Desde a rodada 5 as ações das unidades moram em dadosUnidades.js (a mesma peça da aba e da Central)
const tab = fs.readFileSync('src/pages/CadastroGeral/TabUnidades.jsx', 'utf8') + fs.readFileSync('src/pages/CadastroGeral/dadosUnidades.js', 'utf8');
const perm = fs.readFileSync('src/permissoes/AbaPermissoes.jsx', 'utf8');
const logins = fs.readFileSync('src/pages/Configuracoes/AbaLogins.jsx', 'utf8');
teste('ficha, Pronta?, Mentor, diferenças, cópia e etiqueta ligadas',
    tab.includes('<FichaUnidade') && tab.includes("titulo('pronta'") && tab.includes("titulo('mentor'")
    && perm.includes('<DiferencasPadrao') && perm.includes('copiarExcecoes') && logins.includes('etiquetaExcecoes(u)'));

// 19) Tabela de Logins: a ordem dos títulos é a mesma das células (Nome, E-mail, Nível, Exceções, Unidade)
const ordemTitulos = [...logins.matchAll(/TituloOrdenavel coluna="(\w+)"/g)].map(m => m[1]).join(',');
const corpo = logins.slice(logins.indexOf('<tbody'));
const ordemCelulas = ['{u.email}', 'EtiquetaPapel papel', 'etiquetaExcecoes(u) ||', 'colunaUnidade(u)}</td>'].map(t => corpo.indexOf(t));
teste('títulos e células na mesma ordem', ordemTitulos === 'nome,email,nivel,excecoes,unidade' && ordemCelulas.every((pos, i) => pos > 0 && (i === 0 || pos > ordemCelulas[i - 1])));

// 20) Nada foi tirado: cadastrar, desativar/reativar, excluir (unidade_uso) e unidades do Mentor continuam
const cfg = fs.readFileSync('src/pages/Configuracoes/index.jsx', 'utf8');
teste('funções antigas continuam (unidade_definir_ativa, unidade_uso, mentor_unidades, signUp, revogar)',
    tab.includes("rpc('unidade_definir_ativa'") && tab.includes("rpc('unidade_uso'") && tab.includes("from('unidades').insert")
    && cfg.includes('auth.signUp') && cfg.includes("from('mentor_unidades')") && cfg.includes("from('usuarios_sistema').delete()"));

// ---------- Rodada 3 (09/11/2026): fichas no modelo da ficha do aluno (janela no meio, sem painel lateral) ----------
const fichaU = fs.readFileSync('src/pages/CadastroGeral/FichaUnidade.jsx', 'utf8');
const fichaR = fs.readFileSync('src/pages/CrmVisitantes/FichaRecepcionista.jsx', 'utf8');
const painelCrm = fs.readFileSync('src/pages/CrmVisitantes/PainelInicialCrm.jsx', 'utf8');
const janelaNoMeio = (s) => s.includes('items-start justify-center') && s.includes('overflow-y-auto') && s.includes('max-w-6xl') && !s.includes('flex justify-end');

// 21) Central da Unidade: janela no meio com rolagem (o topo não some com o zoom) e as 5 abas
teste('Central da Unidade em janela no meio, com as 5 abas',
    janelaNoMeio(fichaU) && ["'geral'", "'equipe'", "'logins'", "'mentor'", "'config'"].every(a => fichaU.includes(`[${a}`)));

// 22) Central da Unidade mantém tudo o que a ficha antiga fazia
teste('Central da Unidade mantém Mentores, Personal Class, Desativar e Excluir',
    ['onSalvarMentores(', 'onMarcarPersonal(', 'onAtivar(unidade', 'onExcluir(unidade', 'Voltar para Unidades'].every(t => fichaU.includes(t)));

// 23) Ficha da recepcionista: janela no meio, e o CRM não tem mais o painel lateral
teste('ficha da recepcionista em janela no meio; painel lateral removido',
    janelaNoMeio(fichaR) && painelCrm.includes('<FichaRecepcionista') && !painelCrm.includes('<aside className="w-full sm:w-[420px]'));

// 24) Nenhum número da ficha antiga sumiu (regra 2)
const camposAntigos = ['acoes', 'fechados', 'emAtendimento', 'prazos', 'boasVindas', 'migracao', 'semContato', 'semWhatsApp', 'perdidos', 'whatsapp', 'ligacoes', 'notas', 'puxados', 'visitantes', 'cancelados'];
teste('todos os números da ficha antiga continuam na nova', camposAntigos.every(c => fichaR.includes(`l.${c}`) || fichaR.includes(`l?.${c}`)));

// 25) Botões antigos continuam: Ver relatório e Abrir o CRM dela; Esc não fecha as duas janelas juntas
teste('Ver relatório, Abrir o CRM dela e Esc respeitando a ficha do aluno',
    painelCrm.includes('onVerRelatorio={() => abrirRelatorioDe(resumoDe.nome)}') && painelCrm.includes('onEscolher(c)')
    && painelCrm.includes('bloquearEsc={!!contatoFicha}') && fichaR.includes('!bloquearEsc'));

// ---------- Rodada 4 (09/11/2026): Panorama da unidade (mesmas contas das outras telas) ----------
const P = await import('../src/pages/CadastroGeral/panorama/contasPanorama.js');
const { contarPlanosDoCard: contarCard } = await import('../src/pages/AnaliseVendas/utils.js');
const catPlanos = ['PLUS', 'PLUS + NUTRI', 'FIT', 'PRATIQUE NUTRI'].map(nome => ({ nome }));
const catProdutos = [{ nome: 'WHEY 40G CHOCOLATE', tipo: 'produto' }];
const vendasP = [
    { id: 1, data: '2026-11-02', produto: 'PLUS', quantidade: 1, comissao: 10, vendedor: 'ANA', matricula: '1', conferiu: true },
    { id: 2, data: '2026-11-02', produto: 'PLUS', quantidade: 1, comissao: 10, vendedor: 'ANA', matricula: '1' }, // repetido no dia: conta 1 plano
    { id: 3, data: '2026-11-03', produto: 'PLUS + NUTRI', quantidade: 1, comissao: 15, vendedor: 'BIA', matricula: '2' },
    { id: 4, data: '2026-11-04', produto: 'PRATIQUE NUTRI', quantidade: 1, comissao: 5, vendedor: 'BIA', matricula: '3' },
    { id: 5, data: '2026-11-05', produto: 'DIÁRIA', quantidade: 2, comissao: 4, vendedor: 'ANA' },
    { id: 6, data: '2026-10-30', produto: 'FIT', quantidade: 1, comissao: 5, vendedor: 'ANA', matricula: '9' }, // fora do período
    ...Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, unidade: 'PRADO', data: '2026-11-06', created_at: `2026-11-06T1${i % 10}:00:00Z`, produto: 'WHEY 40G CHOCOLATE', quantidade: 1, comissao: 2, vendedor: 'BIA' })),
];
const faixaNov = { inicio: '2026-11-01', fim: '2026-11-30' };
const rv = P.resumoVendas({ vendas: vendasP, faixa: faixaNov, planos: catPlanos, produtos: catProdutos });

// 26) Planos e Nutri iguais ao card do Dashboard (contarPlanosDoCard) no mesmo período
const doPeriodoP = vendasP.filter(v => v.data >= faixaNov.inicio && v.data <= faixaNov.fim);
const card = contarCard(doPeriodoP, catPlanos, catProdutos);
teste('Panorama: planos e Nutri iguais ao Dashboard', rv.planos === card.total && rv.nutri === card.nutri.total && rv.planos === 2 && rv.nutri === 2);

// 27) Produtos: 12 vendidos, só 10 contam para a meta (limite de doses); serviços pela mesma regra do Dashboard
teste('Panorama: produtos vendidos x na meta (limite de 10 doses) e serviços', rv.produtosVendidos === 12 && rv.produtosNaMeta === 10 && rv.servicos === 2);

// 28) Comissão = soma das vendas do período (não é faturamento); consultor ordenado por itens
teste('Panorama: comissão do período e ranking de consultores',
    rv.comissao === 10 + 10 + 15 + 5 + 4 + 24 && rv.consultores[0].nome === 'BIA' && rv.consultores[0].itens === 14 && rv.lancamentos === 17 && rv.conferidas === 1);

// 29) Faturamento vem da Movimentação (digitado, acumulado do mês → valor do dia) e fica separado da comissão
const mov = P.resumoMovimento({ linhas: [
    { unidade: 'PRADO', data: '2026-10-31', faturamento: 50000, cancelamentos: 9, ativos: 590 },
    { unidade: 'PRADO', data: '2026-11-03', faturamento: 21000, cancelamentos: 4, ativos: 598 },
    { unidade: 'PRADO', data: '2026-11-08', faturamento: 84200, cancelamentos: 11, ativos: 612 },
], faixa: faixaNov });
teste('Panorama: faturamento e saídas do período pela Movimentação; ativos = último lançado',
    mov.faturamento === 84200 && mov.cancelamentos === 11 && mov.ativos === 612 && mov.ativosEm === '2026-11-08');

// 30) Metas do mês: mesmo placar da aba Metas, Produto com limite de doses, Personal some sem Personal Class
const placar = P.placarDoMes({ vendas: vendasP, metaLinha: { meta_nutri: 4, meta_produtos: 20, meta_personal: 3, meta_plus_mensal: 10 }, semPersonal: true, planos: catPlanos, produtos: catProdutos, agora: new Date(2026, 10, 9) });
const pegar = (lista, id) => lista.find(i => i.id === id);
teste('Panorama: metas do mês (Nutri 2/4, Produtos 10 pelo limite, sem Personal)',
    pegar(placar.start, 'start_nutri').resultado.vendido === 2 && pegar(placar.start, 'start_produtos').resultado.vendido === 10
    && !placar.start.some(i => /PERSONAL/i.test(i.rotulo)) && !placar.mensal.some(i => /PERSONAL/i.test(i.rotulo)));

// 31) CRM: pessoas diferentes hoje (5 mensagens para a mesma pessoa = 1), ações só do período, fechou sem compra automática
const hojeT = '2026-11-09';
const hist = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: i, lead_id: 7, consultor: 'ISADORA', tipo_acao: 'WhatsApp', data_registro: `2026-11-09T1${i}:00:00` })),
    { id: 10, lead_id: 8, consultor: 'ISADORA', tipo_acao: 'Ligação', data_registro: '2026-11-09T15:00:00' },
    { id: 11, lead_id: 9, consultor: 'ISADORA', tipo_acao: 'Mudança de Fase', observacao: 'Movido de "Em Contato" para "Fechado"', data_registro: '2026-11-02T10:00:00' },
    { id: 12, lead_id: 10, consultor: 'ISADORA', tipo_acao: 'Mudança de Fase', observacao: 'Movido para "Fechado" (automático: comprou PLUS)', data_registro: '2026-11-03T10:00:00' },
    { id: 13, lead_id: 11, consultor: 'KAIO', tipo_acao: 'WhatsApp', data_registro: '2026-10-20T10:00:00' }, // fora do período
];
const crm = P.resumoCrm({ historico: hist, feitosHoje: [{ id: 1, aluno_id: 55, consultor: 'ISADORA' }], recepcionistas: [{ nome: 'ISADORA' }, { nome: 'KAIO' }], hojeIso: hojeT,
    faixa: faixaNov, ehMudancaPorCompra: (o) => String(o || '').includes('(automático: comprou ') });
teste('Panorama: CRM conta pessoas (não cliques), meta 150 por recepcionista e não conta compra automática',
    crm.pessoasHoje === 3 && crm.metaHoje === 300 && crm.acoes === 8 && crm.whatsapp === 5 && crm.fechados === 1 && crm.porPessoa[1].acoes === 0);

// 32) Avaliações do período, por avaliador, e incompletas pela regra da Avaliação
const pend = (a) => (a.mme ? [] : ['Bioimpedância']);
const av = P.resumoAvaliacoes({ avaliacoes: [{ data: '2026-11-02', professor: 'CARLOS', mme: 30 }, { data: '2026-11-05', professor: 'CARLOS' }, { data: '2026-11-06', professor: 'MARIA', mme: 20 }, { data: '2026-10-01', professor: 'MARIA', mme: 1 }], faixa: faixaNov, pendenciasAvaliacao: pend });
teste('Panorama: avaliações do período e incompletas', av.total === 3 && av.incompletas === 1 && av.avaliadores[0].nome === 'CARLOS' && av.avaliadores[0].qtd === 2);

// 33) Período: "fim" do seletor não entra (vira o dia anterior) e ▲▼ igual ao Dashboard
const fx = P.faixaEmIso({ inicio: new Date(2026, 10, 1), fim: new Date(2026, 11, 1) });
teste('Panorama: período convertido e variação', fx.inicio === '2026-11-01' && fx.fim === '2026-11-30'
    && Math.round(P.variacao(24, 18).perc * 100) === 33 && P.variacao(5, 0).dif === 5 && P.variacao(5, null) === null);

// 34) Ligado na Central: aba Panorama, botão "Ver tudo da unidade", só carrega ao abrir, e o App troca a unidade do topo
const appTxt = fs.readFileSync('src/App.jsx', 'utf8');
const fichaU2 = fs.readFileSync('src/pages/CadastroGeral/FichaUnidade.jsx', 'utf8');
teste('Panorama ligado: aba, botão, carga só ao abrir e "Abrir a tela completa"',
    fichaU2.includes("['panorama', 'Panorama'") && fichaU2.includes("setAba('panorama')") && fichaU2.includes("aba === 'panorama' && (")
    && appTxt.includes('const abrirTelaDaUnidade') && appTxt.includes('abrirTela={abrirTelaDaUnidade}') && appTxt.includes('pendencias={pendencias.lista}'));

// 35) Só leitura: o Panorama não grava nada no banco
const arquivosPanorama = ['contasPanorama.js', 'usePanoramaUnidade.js', 'AbaPanorama.jsx'].map(f => fs.readFileSync(`src/pages/CadastroGeral/panorama/${f}`, 'utf8')).join('\n');
teste('Panorama é só leitura (sem insert/update/upsert/delete/rpc)', !/\.(insert|update|upsert|delete|rpc)\(/.test(arquivosPanorama));

// ---------- Rodada 5 (09/11/2026): botão "Central" em Dashboard, Metas, Relatórios e Ranking ----------
const { unidadePermitida } = await import('../src/components/centralUnidade.js');
const ler = (f) => fs.readFileSync(f, 'utf8');

// 36) Quem abre qual unidade: Admin todas; Mentor só as dele; Líder só a própria (sem acento/maiúscula)
teste('Central: Admin todas, Mentor as dele, Líder a própria',
    unidadePermitida({ papel: 'ADMIN', nome: 'NEVES', unidadesPermitidas: null })
    && unidadePermitida({ papel: 'MENTOR', nome: 'santa ines', unidadesPermitidas: ['SANTA INÊS', 'PRADO'] })
    && !unidadePermitida({ papel: 'MENTOR', nome: 'NEVES', unidadesPermitidas: ['SANTA INÊS', 'PRADO'] })
    && unidadePermitida({ papel: 'LIDER', nome: 'PRADO', unidadesPermitidas: ['PRADO'] })
    && !unidadePermitida({ papel: 'LIDER', nome: 'NEVES', unidadesPermitidas: ['PRADO'] })
    && !unidadePermitida({ papel: 'LIDER', nome: '', unidadesPermitidas: ['PRADO'] }));

// 37) Permissão 314: padrão Admin, Mentor e Líder; Recepção não (e não dá para liberar para ela)
teste('permissão 314 (Admin, Mentor, Líder; Recepção nunca)',
    ['ADMIN', 'MENTOR', 'LIDER'].every(papel => temPermissao({ codigo: '314', papel }))
    && !temPermissao({ codigo: '314', papel: 'RECEPCAO' })
    && !temPermissao({ codigo: '314', papel: 'RECEPCAO', regrasPapel: new Map([['RECEPCAO|314', true]]) })
    && !temPermissao({ codigo: '314', papel: 'LIDER', regrasPapel: new Map([['LIDER|314', false]]) }));

// 38) O botão está nas telas pedidas (Dashboard: quadro e cabeçalho; Metas; Relatórios; Ranking) e não atrapalha o clique da linha
const telas = ['src/pages/AnaliseVendas/visaoRede/QuadroPlanosPorUnidade.jsx', 'src/pages/AnaliseVendas/index.jsx', 'src/pages/AnaliseVendas/MonitorMovimentacao.jsx', 'src/pages/AnaliseVendas/RelatorioTab.jsx', 'src/pages/AnaliseVendas/RankingGlobalTab.jsx'];
const quadroTxt = ler(telas[0]);
teste('botão Central em Dashboard, cabeçalho, Metas, Relatórios e Ranking; linha do Dashboard continua trocando o topo',
    telas.every(f => ler(f).includes('<BotaoCentralUnidade')) && ler('src/components/BotaoCentralUnidade.jsx').includes('e.stopPropagation()')
    && quadroTxt.includes('onClick={() => onAbrirUnidade(l.nome)}'));

// 39) Mentor e Líder: Central em modo leitura (só Panorama e Equipe, sem Desativar/Excluir/Logins/Mentores)
const fichaU3 = ler('src/pages/CadastroGeral/FichaUnidade.jsx');
const centralG = ler('src/pages/CadastroGeral/CentralUnidadeGlobal.jsx');
teste('modo leitura para Mentor e Líder',
    centralG.includes("modo={ehAdmin ? 'completo' : 'leitura'}") && centralG.includes('completo: ehAdmin')
    && fichaU3.includes("id === 'panorama' || id === 'equipe'") && fichaU3.includes('{completo && <button type="button" onClick={() => onAtivar(')
    && fichaU3.includes('{completo && <button type="button" onClick={() => onExcluir('));

// 40) Uma peça só: aba Unidades e Central do Dashboard usam useDadosUnidades; o App monta a Central uma vez com as unidades certas
const tabU = ler('src/pages/CadastroGeral/TabUnidades.jsx');
const app2 = ler('src/App.jsx');
teste('mesma peça de dados e Central montada no App com as unidades de cada perfil',
    tabU.includes('useDadosUnidades(') && centralG.includes('useDadosUnidades(') && !tabU.includes("from('usuarios_sistema')")
    && app2.includes('<CentralUnidadeGlobal') && app2.includes("usuarioLogado?.role === 'ADMIN' ? null : usuarioLogado?.role === 'MENTOR' ? unidadesVisiveis.map(u => u.nome)"));

console.log(falhas === 0 ? `\nTudo certo: ${n} de ${n} testes passaram.` : `\n${falhas} de ${n} testes FALHARAM.`);
process.exit(falhas ? 1 : 0);
