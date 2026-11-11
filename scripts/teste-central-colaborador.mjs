// Teste das contas da Central do Colaborador (11/11/2026): node scripts/teste-central-colaborador.mjs
import { resumoColaborador, comissaoPorMes, posicaoNaUnidade, nomesParecidos, resumoVisitantes, diasEntre, mesmoNomeColaborador, padraoBuscaNome, resumoCrmColaborador, resumoAvaliacoesColaborador, situacaoPagamentoDoMes } from '../src/pages/CadastroGeral/colaborador/contasColaborador.js';
import { mesDaFaixa, mesJaTerminou, vendaTravada, pagamentoDe, mensagemDaTrava } from '../src/pages/FechamentoCaixa/regrasPagamento.js';

let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` — veio ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};

const planos = [{ nome: 'PLUS', categoria: 'plano' }, { nome: 'FIT', categoria: 'plano' }, { nome: 'PLUS + NUTRI', categoria: 'plano' }];
const produtos = [{ nome: 'WHEY 40G', tipo: 'PRODUTO' }];
const vendas = [
    { id: 1, data: '2026-11-03', produto: 'PLUS', quantidade: 1, valor: 10, comissao: 10, conferiu: true, matricula: '1', cpf: '1' },
    { id: 2, data: '2026-11-05', produto: 'PLUS + NUTRI', quantidade: 1, valor: 15, comissao: 15, conferiu: false, matricula: '2', cpf: '2' },
    { id: 3, data: '2026-11-05', produto: 'WHEY 40G', quantidade: 2, valor: 4, comissao: 4, conferiu: true, matricula: '3', cpf: '3' },
    { id: 4, data: '2026-10-04', produto: 'FIT', quantidade: 1, valor: 5, comissao: 5, conferiu: true, matricula: '4', cpf: '4' },
    { id: 5, data: '2026-06-20', produto: 'FIT', quantidade: 1, valor: 5, comissao: 5, conferiu: true, matricula: '5', cpf: '5' },
];
const nov = { inicio: '2026-11-01', fim: '2026-11-11' };
const r = resumoColaborador({ vendas, faixa: nov, planos, produtos, hojeIso: '2026-11-11' });
igual('comissão do período', r.comissao, 29);
igual('conferida × aguardando', [r.conferida, r.aguardando], [14, 15]);
igual('lançamentos', r.lancamentos, 3);
igual('planos base (PLUS e PLUS + NUTRI) e Nutri adicional', [r.planos, r.nutri], [2, 1]);
igual('produtos pela quantidade', r.produtos, 2);
igual('última venda e dias sem vender', [r.ultimaVenda, r.diasSemVender], ['2026-11-05', 6]);
igual('vendas por dia', r.porDia.map(d => [d.dia, d.vendas, d.comissao]), [['2026-11-03', 1, 10], ['2026-11-05', 2, 19]]);

const meses = comissaoPorMes({ vendas, meses: 6, agora: new Date(2026, 10, 11) });
igual('6 meses, de jun a nov', meses.map(m => m.mes), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
igual('comissão de cada mês', meses.map(m => m.total), [5, 0, 0, 0, 5, 29]);
igual('novembro: conferida e aguardando', [meses[5].conferida, meses[5].aguardando, meses[5].vendas], [14, 15, 3]);

const unidade = [{ vendedor: 'ANA SILVA', comissao: 30 }, { vendedor: 'Bruno', comissao: 50 }, { vendedor: 'ana  silva', comissao: 5 }];
igual('posição na unidade (soma o mesmo nome escrito diferente de maiúscula/espaço)', posicaoNaUnidade(unidade, 'Ana Silva'), { posicao: 2, total: 2, lider: { nome: 'BRUNO', comissao: 50 } });
igual('nomes parecidos (fora o próprio)', nomesParecidos([{ vendedor: 'ANA SILVA' }, { vendedor: 'ANA M SILVA' }, { vendedor: 'ANA M SILVA' }], 'Ana Silva'), [{ nome: 'ANA M SILVA', qtd: 2 }]);
igual('visitantes e fechados', resumoVisitantes([{ status: 'Fechado' }, { status: 'Em Contato' }]), { total: 2, fechados: 1 });
igual('dias entre datas', diasEntre('2026-10-30', '2026-11-02'), 3);

// Nome com/sem acento e espaço a mais
igual('nome igual sem acento/maiúscula/espaço', [mesmoNomeColaborador('JOSÉ  da Silva', 'Jose Da SILVA'), mesmoNomeColaborador('JOSE SILVA', 'JOSE SILVA SANTOS')], [true, false]);
igual('filtro largo do banco aceita acento', padraoBuscaNome('José Silva'), '%J_S_%S_LV_%');

// CRM da recepcionista
const iso = (dia, hora = '10:00') => new Date(`${dia}T${hora}:00`).toISOString();
const historico = [
    { lead_id: 1, tipo_acao: 'WhatsApp', observacao: 'Mensagem enviada (Boas-vindas): "Oi"', data_registro: iso('2026-11-10') },
    { lead_id: 2, tipo_acao: 'Ligação', observacao: '', data_registro: iso('2026-11-10') },
    { lead_id: 2, tipo_acao: 'WhatsApp', observacao: '', data_registro: iso('2026-11-10', '11:00') },
    { lead_id: 3, tipo_acao: 'Mudança de Fase', observacao: 'Movido de "Em Contato" para "Fechado"', data_registro: iso('2026-11-11') },
    { lead_id: 4, tipo_acao: 'Mudança de Fase', observacao: 'Movido de "Novo" para "Fechado" (automático: comprou PLUS)', data_registro: iso('2026-11-11') },
    { lead_id: 2, tipo_acao: 'Agendamento', observacao: 'Resultado: respondeu, vai pensar.', data_registro: iso('2026-11-10', '12:00') },
    { lead_id: 1, tipo_acao: 'Agendamento', observacao: 'Resultado: não respondeu', data_registro: iso('2026-11-11') },
    { lead_id: 9, tipo_acao: 'WhatsApp', observacao: '', data_registro: iso('2026-10-10') },
];
const feitos = [
    { id: 70, aluno_id: 7, lead_id: null, canal: 'WHATSAPP', tipo: 'MIGRACAO', criado_em: iso('2026-11-11') },
    { id: 71, aluno_id: 8, lead_id: null, canal: 'MANUAL', tipo: 'RESGATE', criado_em: iso('2026-11-11') },
];
const resultados = [{ resultado: 'INTERESSADO', criado_em: iso('2026-11-11') }, { resultado: 'SEM_RESPOSTA', criado_em: iso('2026-11-11') }];
const crm = resumoCrmColaborador({ historico, feitos, resultados, faixa: nov, hojeIso: '2026-11-11', ehMudancaPorCompra: (t) => String(t).includes('(automático: comprou') });
igual('pessoas por dia (lead e aluno sem lead)', crm.dias, [{ dia: '2026-11-10', pessoas: 2 }, { dia: '2026-11-11', pessoas: 4 }]);
igual('hoje, média e total', [crm.pessoasHoje, crm.mediaPorDia, crm.totalPessoas], [4, 3, 6]);
igual('ações, WhatsApp, ligações (fora do período não conta)', [crm.acoes, crm.whatsapp, crm.ligacoes], [5, 2, 1]);
igual('sem WhatsApp, boas-vindas, fechou (compra automática não conta)', [crm.semWhatsapp, crm.boasVindas, crm.fechou], [1, 1, 1]);
igual('respostas: funil + Migração/Resgate', [crm.responderam, crm.naoResponderam, crm.interessados], [2, 2, 1]);
igual('por tipo de contato', crm.porTipo, { MIGRACAO: 1, RESGATE: 1 });

// Avaliações
const avals = [
    { id: 1, data: '2026-11-02', aluno: 'A', aluno_id: 1 }, { id: 2, data: '2026-11-08', aluno: 'B', aluno_id: 2, incompleta: true },
    { id: 3, data: '2026-11-09', aluno: 'A', aluno_id: 1 }, { id: 4, data: '2026-09-15', aluno: 'C', aluno_id: 3 },
];
const ra = resumoAvaliacoesColaborador({ avaliacoes: avals, faixa: nov, agora: new Date(2026, 10, 11), estaIncompleta: (a) => !!a.incompleta });
igual('avaliações: período, alunos, incompletas, última', [ra.total, ra.alunos, ra.incompletas, ra.ultimaEm], [3, 2, 1, '2026-11-09']);
igual('avaliações por mês (6 meses)', ra.porMes.map(m => m.qtd), [0, 0, 0, 1, 0, 3]);

// Pagamento das comissões (Fechamento)
igual('mês inteiro escolhido = mês do pagamento', [mesDaFaixa('2026-10-01', '2026-11-01'), mesDaFaixa('2026-11-01', '2026-11-12'), mesDaFaixa('2026-10-05', '2026-11-01'), mesDaFaixa('2026-10-01', '2026-12-01')], ['2026-10', '2026-11', null, null]);
igual('só mês que já terminou', [mesJaTerminou('2026-10', new Date(2026, 10, 11)), mesJaTerminou('2026-11', new Date(2026, 10, 11))], [true, false]);
const aprovados = [{ unidade: 'PRADO', mes: '2026-10', ativo: true, id: 1 }, { unidade: 'NEVES', mes: '2026-10', ativo: false, id: 2 }];
igual('venda travada só no mês e unidade aprovados (reaberto não trava)', [vendaTravada({ unidade: 'prado', data: '2026-10-20' }, aprovados), vendaTravada({ unidade: 'PRADO', data: '2026-11-02' }, aprovados), vendaTravada({ unidade: 'NEVES', data: '2026-10-20' }, aprovados)], [true, false, false]);
igual('aprovação da unidade e mês', pagamentoDe('Prado', '2026-10', aprovados)?.id, 1);
igual('mensagem da trava do banco', [mensagemDaTrava({ message: 'O pagamento de PRADO · 2026-10 já foi aprovado' }) !== null, mensagemDaTrava({ message: 'timeout' })], [true, null]);
const vendasPg = [{ data: '2026-10-03', unidade: 'PRADO' }, { data: '2026-10-09', unidade: 'NEVES' }, { data: '2026-09-09', unidade: 'PRADO' }];
const pgs = [{ unidade: 'PRADO', mes: '2026-10', ativo: true, aprovado_em: '2026-11-10T12:00:00Z', aprovado_por: 'ADMIN' }, { unidade: 'PRADO', mes: '2026-09', ativo: true, aprovado_em: '2026-10-10T12:00:00Z' }];
igual('situação do pagamento por mês', ['2026-10', '2026-09', '2026-08'].map(mes => situacaoPagamentoDoMes({ mes, vendas: vendasPg, pagamentos: pgs }).situacao), ['parcial', 'aprovado', 'sem_vendas']);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
