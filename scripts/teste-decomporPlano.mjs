// Teste da regra "Nutri é adicional" (decomporPlano em src/pages/AnaliseVendas/utils.js).
// Como rodar: node scripts/teste-decomporPlano.mjs  → mostra OK/ERRO para cada caso da tabela do dono.
import { decomporPlano } from '../src/pages/AnaliseVendas/utils.js';

const casos = [
    ['PLUS + NUTRI', 'PLUS', true],
    ['FIT + NUTRI', 'FIT', true],
    ['AFILIADOS PLUS + NUTRI', 'PLUS', true],
    ['AFILIADOS FIT + NUTRI', 'FIT', true],
    ['PRATIQUE NUTRI', null, true],
    ['PLUS', 'PLUS', false],
    ['AFILIADOS PLUS', 'PLUS', false],
    ['PLUS PATRÃO', 'PLUS', false],
    ['FIT', 'FIT', false],
    ['AFILIADOS FIT', 'FIT', false],
    ['FIT PATRÃO', 'FIT', false],
    ['PERSONAL CLASS', 'PERSONAL CLASS', false],
    ['SSP', 'OUTROS PLANOS', false],
    ['PROMO 1200', 'OUTROS PLANOS', false],
    ['FÉRIAS 15 DIAS', 'OUTROS PLANOS', false],
    ['Plus + Nutri', 'PLUS', true],
];

let erros = 0;
casos.forEach(([nome, base, nutri]) => {
    const r = decomporPlano(nome);
    const ok = r.base === base && r.nutri === nutri;
    if (!ok) erros++;
    console.log(`${ok ? 'OK  ' : 'ERRO'} ${nome.padEnd(24)} → base ${String(r.base).padEnd(15)} nutri ${r.nutri}${ok ? '' : `   (esperado: ${base} / ${nutri})`}`);
});
console.log(erros === 0 ? `\nTodos os ${casos.length} casos certos.` : `\n${erros} caso(s) com erro.`);
process.exitCode = erros === 0 ? 0 : 1;
