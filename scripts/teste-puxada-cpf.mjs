// Teste de puxar aluno com CPF já no CRM e da etiqueta do resultado: node scripts/teste-puxada-cpf.mjs
import assert from 'node:assert/strict';
import { decidirPuxada, consultarCpfs, escolherPuxaveis, cpfsNoWellhub } from '../src/pages/CrmVisitantes/contatosPorCpf.js';
import { etiquetaDoResultado } from '../src/pages/CrmVisitantes/tentativas.js';

let n = 0;
const teste = async (nome, fn) => { await fn(); n++; console.log('ok -', nome); };
const ctx = { unidade: 'VENEZA', operador: 'Maria Teste' };
const contato = (campos) => ({ id: 1, unidade: 'VENEZA', status: 'Novo', puxado_por: null, ...campos });
const acao = (lista, extra = {}) => decidirPuxada(lista, { ...ctx, ...extra }).acao;

await teste('sem contato: cria; só existe em outra unidade: não puxa', () => {
    assert.equal(acao([]), 'CRIAR');
    assert.equal(acao([], { existeNaRede: true }), 'OUTRA_UNIDADE');
    assert.equal(acao([contato({ unidade: 'PRADO', status: 'Fechado' })]), 'OUTRA_UNIDADE');
});
await teste('da própria unidade: Fechado, Perdido, sem dona e arquivado por compra reabrem', () => {
    ['Fechado', 'Perdido', 'Novo', 'Em Contato', 'Arquivado'].forEach(status => assert.equal(acao([contato({ status })]), 'REABRIR', status));
});
await teste('com dona: minha não duplica; de outra não puxa', () => {
    assert.equal(acao([contato({ status: 'Em Contato', puxado_por: 'MARIA TESTE' })]), 'JA_MEU');
    assert.equal(acao([contato({ status: 'Novo', puxado_por: 'Outra Pessoa' })]), 'COM_OUTRA');
});
await teste('Não contatar e Fora da fila não são puxados', () => {
    assert.equal(acao([contato({ status: 'Arquivado', bloqueado_nc: true })]), 'NAO_CONTATAR');
    ['Telefone com problema', 'Já é aluno', 'É personal trainer'].forEach(motivo_perda => assert.equal(acao([contato({ status: 'Arquivado', motivo_perda })]), 'FORA_DA_FILA', motivo_perda));
});

// Banco de mentira: guarda os contatos e responde como o Supabase
const banco = (contatos, rede = []) => ({
    from: () => ({ select: () => ({ in: async (_c, cpfs) => ({ data: contatos.filter(c => cpfs.includes(c.cpf)), error: null }) }) }),
    rpc: async (_nome, { p_cpfs }) => ({ data: rede.filter(c => p_cpfs.includes(c)).map(cpf => ({ cpf })), error: null })
});
const cpf = (i) => String(10000000000 + i);

await teste('consulta junta banco da unidade e consulta da rede (CPF com pontos também)', async () => {
    const r = await consultarCpfs(banco([contato({ cpf: '100.000.000-01', status: 'Fechado' })], [cpf(2)]), [cpf(1), cpf(2), cpf(3)], ctx);
    assert.deepEqual([r.get(cpf(1)).acao, r.get(cpf(2)).acao, r.get(cpf(3)).acao], ['REABRIR', 'OUTRA_UNIDADE', 'CRIAR']);
});
await teste('quem não pode é pulado e o próximo entra, completando a quantidade', async () => {
    const linhas = Array.from({ length: 60 }, (_, i) => ({ aluno_id: i, nome: `A${i}`, cpf: cpf(i) }));
    const rede = [cpf(0), cpf(3), cpf(4)];
    const r = await escolherPuxaveis(banco([], rede), linhas, 10, ctx);
    assert.equal(r.aceitos.length, 10);
    assert.deepEqual(r.impedidos.map(i => i.linha.aluno_id), [0, 3, 4]);
    assert.equal(r.aceitos.at(-1).aluno_id, 12);
});
await teste('linha que já tem o contato e aluno sem CPF passam direto', async () => {
    const r = await escolherPuxaveis(banco([], [cpf(1)]), [{ aluno_id: 1, cpf: cpf(1), lead_id: 9 }, { aluno_id: 2, cpf: '' }], 5, ctx);
    assert.equal(r.aceitos.length, 2);
});
await teste('erro ao ler os contatos não deixa puxar às cegas', async () => {
    const quebrado = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: new Error('sem rede') }) }) }) };
    await assert.rejects(consultarCpfs(quebrado, [cpf(1)], ctx));
});
await teste('grupo Wellhub: só os sem dona, da unidade', () => {
    const s = cpfsNoWellhub([contato({ cpf: cpf(1), tipo_lead: 'WELLHUB' }), contato({ cpf: cpf(2), tipo_lead: 'WELLHUB', puxado_por: 'X' }), contato({ cpf: cpf(3), tipo_lead: 'WELLHUB', unidade: 'PRADO' })], 'VENEZA');
    assert.deepEqual([...s], [cpf(1)]);
});

const h = (observacao, d, hora = '12') => ({ observacao, data_registro: `2026-11-${d}T${hora}:00:00-03:00` });
const pensou = (d) => h('Resultado: respondeu, vai pensar.', d);
const interessado = (d) => h('Resultado: interessado.', d, '15');
const semResposta = (d, hora) => h('Resultado: não respondeu (tentativa 1 de 3).', d, hora);
const puxado = '2026-11-01T08:00:00-03:00';

await teste('etiqueta: continua depois do não respondeu e conta dias diferentes', () => {
    assert.deepEqual(etiquetaDoResultado([pensou('02')], puxado), { tipo: 'PENSANDO', semResposta: 0 });
    assert.deepEqual(etiquetaDoResultado([pensou('02'), semResposta('05', '09'), semResposta('05', '16'), semResposta('07')], puxado), { tipo: 'PENSANDO', semResposta: 2 });
});
await teste('etiqueta: vale a última resposta; não respondeu antes dela não conta', () => {
    assert.deepEqual(etiquetaDoResultado([semResposta('02'), pensou('03'), interessado('04')], puxado), { tipo: 'INTERESSADO', semResposta: 0 });
});
await teste('etiqueta: sem resposta nenhuma ou de carteira antiga não aparece', () => {
    assert.equal(etiquetaDoResultado([semResposta('02')], puxado), null);
    assert.equal(etiquetaDoResultado([pensou('02')], '2026-11-10T08:00:00-03:00'), null);
    assert.equal(etiquetaDoResultado(undefined, puxado), null);
});

console.log(`\n${n} testes passaram`);
