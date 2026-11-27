// Teste das tentativas por ciclo e do telefone válido: node scripts/teste-tentativas-telefone.mjs
import assert from 'node:assert/strict';
import { telefoneUtilizavel } from '../src/pages/CrmVisitantes/telefoneValido.js';
import { tentativasAnteriores, inicioDoCiclo, contarDiasDeContato } from '../src/pages/CrmVisitantes/tentativas.js';

let n = 0;
const teste = (nome, fn) => { fn(); n++; console.log('ok -', nome); };
const nr = (d) => ({ observacao: 'Resultado: não respondeu (tentativa 1 de 3).', data_registro: d });
const pensou = (d) => ({ observacao: 'Resultado: respondeu, vai pensar.', data_registro: d });
const dia = (d, h = '12') => `2026-11-${d}T${h}:00:00-03:00`;

teste('quem respondeu recomeça a contagem', () => {
    assert.equal(tentativasAnteriores([nr(dia('01')), nr(dia('03')), pensou(dia('05'))], dia('01', '08'), '2026-11-10'), 0);
    assert.equal(tentativasAnteriores([nr(dia('01')), pensou(dia('05')), nr(dia('07'))], dia('01', '08'), '2026-11-10'), 1);
});
teste('voltar para a carteira (puxado_em novo) começa um ciclo', () => {
    assert.equal(tentativasAnteriores([nr(dia('01')), nr(dia('03')), nr(dia('05'))], dia('20', '08'), '2026-11-21'), 0);
});
teste('no máximo uma tentativa por dia', () => {
    assert.equal(tentativasAnteriores([nr(dia('03', '09')), nr(dia('03', '16'))], dia('01'), '2026-11-10'), 1);
});
teste('a marcação de hoje não soma duas vezes', () => {
    assert.equal(tentativasAnteriores([nr(dia('03')), nr(dia('10', '09'))], dia('01'), '2026-11-10'), 1);
});
teste('rotina: WhatsApp e ligação no mesmo dia contam 1', () => {
    assert.equal(contarDiasDeContato([dia('03', '09'), dia('03', '10'), dia('04')], inicioDoCiclo(dia('01'), [])), 2);
});
teste('telefones bons passam', () => {
    ['31987654321', '(31) 98765-4321', '5531987654321', '3133334444', '(31)33334444 '].forEach(t => assert.ok(telefoneUtilizavel(t), t));
});
teste('telefones estragados não passam', () => {
    ['', 'S/N', 'NOME DA UNIDADE', '111.444.777-35', '01234567890', '12345678909', '31999999999', '62999999999', '12345678', '33712345678', null].forEach(t => assert.ok(!telefoneUtilizavel(t), String(t)));
});

console.log(`\n${n} testes passaram.`);
