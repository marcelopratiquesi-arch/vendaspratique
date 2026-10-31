// Teste do limite de 10 doses únicas por unidade (limiteDoses.js). Como rodar: node scripts/teste-limiteDoses.mjs
import { aplicarLimiteDoses, qtdValidaProduto } from '../src/pages/AnaliseVendas/limiteDoses.js';

const produtos = ['WHEY BRIGADEIRO', 'ENERGY LIMÃO', 'DRYBELLY'].map(nome => ({ nome, tipo: 'produto' }));
let id = 1;
let hora = 0;
const venda = (unidade, data, vendedor, produto, quantidade) => ({ id: id++, unidade, data, created_at: `${data}T12:${String(hora++).padStart(2, '0')}:00Z`, vendedor, produto, quantidade });

// Pontos por consultor (todos os produtos físicos válidos), como no pódio
const pontos = (vendas) => {
    const mapa = aplicarLimiteDoses(vendas, [], produtos);
    const r = {};
    vendas.forEach(v => { r[v.vendedor] = (r[v.vendedor] || 0) + qtdValidaProduto(v, mapa); });
    return r;
};
const confere = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    console.log(`${ok ? 'OK  ' : 'ERRO'} ${nome}: ${JSON.stringify(obtido)}${ok ? '' : `  (esperado ${JSON.stringify(esperado)})`}`);
    return ok;
};
const cenario = (mes) => [
    venda('U1', `${mes}-05`, 'Julya', 'WHEY BRIGADEIRO', 6),
    venda('U1', `${mes}-05`, 'Diogo', 'ENERGY LIMÃO', 4),
    venda('U1', `${mes}-06`, 'Tiago', 'WHEY BRIGADEIRO', 5),
    venda('U1', `${mes}-06`, 'Tiago', 'DRYBELLY', 2),
];

let tudoOk = true;
const A = cenario('2026-11');
tudoOk &= confere('A (novembro)', pontos(A), { Julya: 6, Diogo: 4, Tiago: 2 });
tudoOk &= confere('B (outubro, regra antiga)', pontos(cenario('2026-10')), { Julya: 6, Diogo: 4, Tiago: 7 });
const C = A.filter(v => !(v.vendedor === 'Julya')); // venda de 6 Whey da Julya apagada
tudoOk &= confere('C (apagou a da Julya)', { Julya: pontos(C).Julya || 0, ...pontos(C) }, { Julya: 0, Diogo: 4, Tiago: 7 });
const D = [venda('U1', '2026-11-02', 'Ana', 'ENERGY LIMÃO', 9), venda('U1', '2026-11-03', 'Bia', 'WHEY BRIGADEIRO', 3)];
const mapaD = aplicarLimiteDoses(D, [], produtos);
tudoOk &= confere('D (9 válidas + venda de 3)', qtdValidaProduto(D[1], mapaD), 1);
const E = [venda('U1', '2026-11-02', 'Ana', 'WHEY BRIGADEIRO', 10), venda('U2', '2026-11-02', 'Caio', 'ENERGY LIMÃO', 10),
    venda('U1', '2026-11-04', 'Ana', 'WHEY BRIGADEIRO', 2), venda('U2', '2026-11-04', 'Caio', 'ENERGY LIMÃO', 1)];
const mapaE = aplicarLimiteDoses(E, [], produtos);
tudoOk &= confere('E (2 unidades, "Todas as unidades")', E.reduce((s, v) => s + qtdValidaProduto(v, mapaE), 0), 20);
// Extra: o limite zera no dia 1º do mês seguinte
const F = [venda('U1', '2026-11-30', 'Ana', 'WHEY BRIGADEIRO', 12), venda('U1', '2026-12-01', 'Ana', 'WHEY BRIGADEIRO', 3)];
const mapaF = aplicarLimiteDoses(F, [], produtos);
tudoOk &= confere('Extra (zera em 01/12)', [qtdValidaProduto(F[0], mapaF), qtdValidaProduto(F[1], mapaF)], [10, 3]);
console.log(tudoOk ? '\nTodos os testes certos.' : '\nHá teste com erro.');
process.exitCode = tudoOk ? 0 : 1;
