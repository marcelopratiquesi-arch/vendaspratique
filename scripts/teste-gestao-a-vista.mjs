// Teste das regras da Gestão à Vista — Produtos (node scripts/teste-gestao-a-vista.mjs)
import assert from 'node:assert/strict';
import { montarGestao, filtrarLinhas, resumir, agruparPorUnidade, mesesDaFaixa, faixaDosDias } from '../src/pages/AnaliseVendas/gestaoAVista/regrasGestao.js';

const produtos = [{ nome: 'GARRAFA', ativo: true }, { nome: 'WHEY 40G', ativo: true }];
const hoje = '2026-11-18';
const faixa = faixaDosDias(120, hoje);
const c = (id, nome, role, unidade, extra = {}) => ({ id, nome, role, unidade, ativo: true, ...extra });
const colabs = [
    c(1, 'ANA SOUZA', 'RECEPCAO', 'GUTIERREZ', { data_inicio: '2026-01-01' }),
    c(2, 'BRUNO LIMA', 'SAVER', 'GUTIERREZ', { data_inicio: '2026-01-01' }),
    c(3, 'CARLA DIAS', 'SAVER', 'GUTIERREZ', { data_inicio: '2026-01-01' }),
    c(4, 'LIDER UM', 'LIDER', 'GUTIERREZ'),
    c(5, 'NOVO NOME', 'SAVER', 'GUTIERREZ', { data_inicio: '2026-10-20' }),
    c(6, 'SAIU ANTES', 'SAVER', 'GUTIERREZ', { ativo: false, desligado_em: '2026-06-01', data_inicio: '2026-01-01' }),
    c(7, 'SAIU NO MEIO', 'SAVER', 'GUTIERREZ', { ativo: false, desligado_em: '2026-10-05', data_inicio: '2026-01-01' }),
];
const v = (vendedor, dia, qtd = 1, produto = 'GARRAFA') => ({ id: Math.random(), vendedor, data: dia, produto, quantidade: qtd, unidade: 'GUTIERREZ' });
const vendas = [v('ANA SOUZA', '2026-11-02', 3), v('BRUNO LIMA', '2026-11-03', 1), v('LIDER UM', '2026-11-04', 1), v('ANA SOUZA', '2026-09-10', 1)];
const { linhas, mesDaMeta } = montarGestao({ colaboradores: colabs, vendas, planos: [], produtos, dosesValidas: null, faixa, hoje });
const por = (n) => linhas.find(l => l.nome === n);

assert.equal(mesDaMeta, '2026-11');
assert.equal(por('ANA SOUZA').statusMes, 'atingida');          // 3 de 3 em novembro
assert.equal(por('ANA SOUZA').geral, 'abaixo');                // mas em setembro vendeu 1: no período inteiro faltou
assert.equal(por('BRUNO LIMA').geral, 'abaixo');
assert.equal(por('LIDER UM').geral, 'inativo');
assert.equal(por('BRUNO LIMA').statusMes, 'abaixo');           // vendeu 1, não é "sem vendas"
assert.equal(por('BRUNO LIMA').semVendas, false);
assert.equal(por('CARLA DIAS').semVendas, true);               // nenhuma venda
assert.equal(por('CARLA DIAS').statusMes, 'abaixo');
assert.ok(!por('LIDER UM') || !por('LIDER UM').cobrado);       // líder não é cobrado (aparece só como histórico)
assert.equal(por('LIDER UM').statusMes, 'inativo');
assert.equal(por('SAIU ANTES'), undefined);                    // saiu antes do período: não aparece
assert.equal(por('SAIU NO MEIO').statusMes, 'inativo');        // mês atual: já tinha saído
const meses = por('SAIU NO MEIO').meses;
assert.equal(meses.find(m => m.mes === '2026-10').obrigada, true);
assert.equal(meses.find(m => m.mes === '2026-11').obrigada, false);
// quem entrou em 20/10: julho a setembro não são cobrados
const novo = por('NOVO NOME').meses;
assert.equal(novo.find(m => m.mes === '2026-08').obrigada, false);
assert.equal(novo.find(m => m.mes === '2026-10').obrigada, true);
assert.equal(por('NOVO NOME').periodoCurto, true);
// ANA vendeu 1 em setembro: abaixo em setembro
assert.equal(por('ANA SOUZA').meses.find(m => m.mes === '2026-09').status, 'abaixo');
// meta da unidade 5 muda o resultado
const m5 = montarGestao({ colaboradores: colabs, vendas, planos: [], produtos, dosesValidas: null, faixa, hoje, metasPorUnidade: { GUTIERREZ: 5 } }).linhas;
assert.equal(m5.find(l => l.nome === 'ANA SOUZA').statusMes, 'abaixo');
// filtros
assert.deepEqual(filtrarLinhas(linhas, { situacao: 'semvendas' }).map(l => l.nome), ['CARLA DIAS', 'NOVO NOME', 'SAIU NO MEIO']);
assert.ok(filtrarLinhas(linhas, { situacao: 'semvendas' }).every(l => l.cobrado && l.semVendas && l.geral !== 'inativo'));
assert.ok(filtrarLinhas(linhas, { situacao: 'abaixo' }).every(l => l.geral === 'abaixo'));
assert.ok(!filtrarLinhas(linhas, { situacao: 'atingida' }).some(l => l.nome === 'ANA SOUZA')); // vendeu mês sim, mês não: não é atingida
// quem bateu a meta em todos os meses cobrados aparece em atingida
const bom = montarGestao({ colaboradores: colabs, vendas: ['2026-07-05','2026-08-05','2026-09-05','2026-10-05','2026-11-05'].map(d => v('CARLA DIAS', d, 3)), planos: [], produtos, dosesValidas: null, faixa, hoje }).linhas;
assert.equal(bom.find(l => l.nome === 'CARLA DIAS').geral, 'atingida');
assert.ok(filtrarLinhas(bom, { situacao: 'atingida' }).some(l => l.nome === 'CARLA DIAS'));
// vendas não duplicam: total do período da Ana = 3 + 1
assert.equal(por('ANA SOUZA').totalPeriodo, 4);
// agrupamento e resumo coerentes
const g = agruparPorUnidade(linhas);
assert.equal(g.length, 1);
assert.equal(g[0].resumo.cobrados, resumir(linhas).cobrados);
assert.deepEqual(mesesDaFaixa('2026-07-01', '2026-11-18'), ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
// filtro de mês: Ana bateu em novembro, mas faltou em setembro
import { situacaoDe, mensagemGestao } from '../src/pages/AnaliseVendas/gestaoAVista/regrasGestao.js';
assert.equal(situacaoDe(por('ANA SOUZA'), '2026-11'), 'atingida');
assert.equal(situacaoDe(por('ANA SOUZA'), '2026-09'), 'abaixo');
assert.ok(filtrarLinhas(linhas, { situacao: 'atingida', mesFoco: '2026-11' }).some(l => l.nome === 'ANA SOUZA'));
assert.ok(!filtrarLinhas(linhas, { situacao: 'abaixo', mesFoco: '2026-11' }).some(l => l.nome === 'ANA SOUZA'));
assert.ok(filtrarLinhas(linhas, { situacao: 'abaixo', mesFoco: '2026-09' }).some(l => l.nome === 'ANA SOUZA'));
// mensagem: unidade única, mostra mês e quanto vendeu, sem CPF
const grp = agruparPorUnidade(filtrarLinhas(linhas, { situacao: 'abaixo', unidade: 'GUTIERREZ' }));
const msg = mensagemGestao({ grupos: grp, situacao: 'abaixo', rotuloPeriodo: 'ÚLTIMOS 120 DIAS', mesAtual: '2026-11' });
assert.ok(msg.includes('*GUTIERREZ* (meta: 3') && msg.includes('ANA SOUZA — faltou: ') && msg.includes('Set 1/3') && !/cpf/i.test(msg));
console.log('Gestão à Vista: todos os testes passaram.');
