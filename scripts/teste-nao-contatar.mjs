// Teste do bloqueio por telefone do "Não contatar": node scripts/teste-nao-contatar.mjs
import assert from 'node:assert/strict';
import { chaveTelefoneBloqueio as k } from '../src/pages/CrmVisitantes/telefoneBloqueio.js';

let n = 0;
const teste = (nome, fn) => { fn(); n++; console.log('ok -', nome); };

teste('o mesmo número escrito de jeitos diferentes dá a mesma chave', () => {
    const esperado = '3187654321';
    ['31987654321', '(31) 98765-4321', '5531987654321', '+55 31 98765-4321', '3187654321'].forEach(t => assert.equal(k(t), esperado, t));
});
teste('DDD diferente é outra pessoa', () => assert.notEqual(k('31987654321'), k('11987654321')));
teste('número de preenchimento não bloqueia ninguém', () => {
    ['31999999999', '9999999999', '31000000000', '0000000000'].forEach(t => assert.equal(k(t), '', t));
});
teste('sem DDD, incompleto ou vazio não bloqueia', () => {
    ['987654321', '12345', '', null, undefined].forEach(t => assert.equal(k(t), '', String(t)));
});

console.log(`\n${n} testes passaram.`);
