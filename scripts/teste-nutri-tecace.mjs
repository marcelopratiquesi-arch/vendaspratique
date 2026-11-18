// Teste das regras do Nutri / Tecace (17/11/2026): node scripts/teste-nutri-tecace.mjs
import { consolidarNutri, tecaceVigentePorUnidade, tecaceVigentePorMes, nutriDaUnidade, INICIO_COBRANCA_NUTRI } from '../src/pages/AnaliseVendas/nutriTecace.js';
let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas++;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : `\n   obtido:   ${JSON.stringify(obtido)}\n   esperado: ${JSON.stringify(esperado)}`}`);
};
const resumo = (c) => [c.total, c.adicional, c.divergencia];

igual('01 sem lançamento Tecace: 17 internas → 17, adicional 0', resumo(consolidarNutri(17, null)), [17, 0, false]);
igual('01b Tecace vazio (undefined)', resumo(consolidarNutri(17, undefined)), [17, 0, false]);
igual('02 Tecace 27 > internas 17 → 27, adicional 10', resumo(consolidarNutri(17, 27)), [27, 10, false]);
igual('03 Tecace 17 = internas 17 → 17, adicional 0', resumo(consolidarNutri(17, 17)), [17, 0, false]);
igual('04 Tecace 15 < internas 17 → 17, adicional 0 e divergência', resumo(consolidarNutri(17, 15)), [17, 0, true]);
igual('05 Tecace 27 → 30: 30 e adicional 13 (não soma 27+30)', resumo(consolidarNutri(17, 30)), [30, 13, false]);
igual('06 nova venda: 18 internas e Tecace 27 → 27, adicional 9', resumo(consolidarNutri(18, 27)), [27, 9, false]);
igual('0 digitado vale como lançamento (unidade sem Nutri)', resumo(consolidarNutri(0, 0)), [0, 0, false]);
igual('08 meta 30, realizado 27 → 90%', Math.round(consolidarNutri(17, 27).total / 30 * 100), 90);
igual('08b faltam 3', Math.max(30 - consolidarNutri(17, 27).total, 0), 3);

// O valor vigente do mês é o ÚLTIMO lançamento (nunca soma os dias)
const linhas = [
    { unidade: 'Santa Ines 2', data: '2026-11-18', nutri_tecace: 20 },
    { unidade: 'SANTA INES 2', data: '2026-11-20', nutri_tecace: 27 },
    { unidade: 'SANTA INES 2', data: '2026-11-19', nutri_tecace: 24 },
    { unidade: 'PRADO', data: '2026-11-18', nutri_tecace: 0 },
    { unidade: 'NEVES', data: '2026-11-18', nutri_tecace: null },
];
const vig = tecaceVigentePorUnidade(linhas);
igual('vigente = último lançamento do mês (27), sem somar', vig.get('SANTA INES 2'), 27);
igual('zero lançado vale (0 ≠ vazio)', vig.get('PRADO'), 0);
igual('vazio não entra', vig.has('NEVES'), false);
igual('"até" corta lançamentos futuros', tecaceVigentePorUnidade(linhas, '2026-11-19').get('SANTA INES 2'), 24);
igual('07 meses separados (novo mês não herda o anterior)', [...tecaceVigentePorMes([
    { unidade: 'PRADO', data: '2026-10-30', nutri_tecace: 40 }, { unidade: 'PRADO', data: '2026-11-18', nutri_tecace: 5 },
])], [['2026-10|PRADO', 40], ['2026-11|PRADO', 5]]);
igual('período que não é mês (mapa null) = só interno', nutriDaUnidade(null, 'PRADO', 17).total, 17);
igual('mapa sem a unidade = só interno', nutriDaUnidade(new Map(), 'PRADO', 17).total, 17);
igual('com mapa: 27', nutriDaUnidade(vig, 'santa ines 2', 17).total, 27);
igual('cobrança começa em 18/11/2026', INICIO_COBRANCA_NUTRI, '2026-11-18');

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
