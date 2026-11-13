// Teste das regras do Aspira e do acesso temporário (13/11/2026): node scripts/teste-aspira-temporario.mjs
// (as mesmas contas do banco: sql/2026-11-13-aspira-temporario/; o banco é quem garante, a tela acompanha)
import {
    calcularValeAte, perfilEfetivo, assinaturaDoAcesso, marcoDoAviso, diasParaVencer, temporariosValendo, postoDe,
    situacaoDaEntrada, precisaConfirmarDados, montarPainelAcessos, hojeEmBrasilia,
} from '../src/components/acesso/regrasAcesso.js';
import { lideresDaUnidade } from '../src/pages/FechamentoCaixa/cobrancaAuditoria.js';

let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` — veio ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};

// ---------- Datas: hoje conta como dia 1 (exemplo do dono) ----------
igual('dia 13 + 10 dias = até o dia 22', calcularValeAte('10d', '2026-11-13'), '2026-11-22');
igual('dia 13 + 15 / 30 / 40 dias', ['15d', '30d', '40d'].map(p => calcularValeAte(p, '2026-11-13')), ['2026-11-27', '2026-12-12', '2026-12-22']);
igual('dia 13 + 2 meses = dia 12 do 2º mês', calcularValeAte('2m', '2026-11-13'), '2027-01-12');
igual('dia 13 + 3 e 6 meses', [calcularValeAte('3m', '2026-11-13'), calcularValeAte('6m', '2026-11-13')], ['2027-02-12', '2027-05-12']);
igual('31/01 + 2 meses (mês curto, igual ao banco)', calcularValeAte('2m', '2027-01-31'), '2027-03-30');
igual('data escolhida: válida / antes de hoje / passa de 6 meses',
    [calcularValeAte('data', '2026-11-13', '2026-12-01'), calcularValeAte('data', '2026-11-13', '2026-11-12'), calcularValeAte('data', '2026-11-13', '2027-06-01')],
    ['2026-12-01', null, null]);
igual('prazo desconhecido', calcularValeAte('99d', '2026-11-13'), null);
igual('hoje em Brasília (23h30 de 13/11 em Brasília = 02h30 de 14/11 UTC)', hojeEmBrasilia(new Date('2026-11-14T02:30:00Z')), '2026-11-13');

// ---------- Perfil que vale: o temporário SÓ SOMA ----------
const temp = (tipo, unidades, vale_ate = '2026-11-22') => ({ id: `${tipo}-${unidades.join()}`, tipo, unidades, vale_ate, nome: 'JOAO DA SILVA', telefone: '5531999990000' });
const fixoLider = { email: 'jose@x', nome: 'JOSE', role: 'LIDER', unidade: 'PRADO', status: 'ATIVO', posto: 'ASPIRA' };
const sit = (perfil, temporarios) => ({ perfil, temporarios, hoje: '2026-11-13', pedido: null });
const ef = (perfil, temps, metodo = 'google') => perfilEfetivo(sit(perfil, temps), metodo);

igual('sem temporário: igual ao acesso fixo', [ef(fixoLider, []).role, ef(fixoLider, []).unidade, ef(fixoLider, []).unidadesLider], ['LIDER', 'PRADO', ['PRADO']]);
igual('Líder fixo + Líder temporário: 2 unidades e a fixa continua a principal',
    [ef(fixoLider, [temp('LIDER', ['NEVES'])]).unidadesLider, ef(fixoLider, [temp('LIDER', ['NEVES'])]).unidade], [['PRADO', 'NEVES'], 'PRADO']);
igual('o posto Aspira do acesso fixo é mantido', ef(fixoLider, [temp('LIDER', ['NEVES'])]).posto, 'ASPIRA');
igual('sem acesso fixo: entra só com o temporário',
    (() => { const p = ef(null, [temp('LIDER', ['NEVES', 'VENEZA'])]); return [p.role, p.unidade, p.unidadesLider, p.somenteTemporario, p.roleFixo]; })(),
    ['LIDER', 'NEVES', ['NEVES', 'VENEZA'], true, null]);
igual('acesso fixo INATIVO + temporário: vale só o temporário', ef({ ...fixoLider, status: 'INATIVO' }, [temp('LIDER', ['NEVES'])]).unidadesLider, ['NEVES']);
igual('Mentor fixo + Líder temporário: continua Mentor e soma a unidade',
    (() => { const p = ef({ email: 'm', role: 'MENTOR', unidade: 'TODAS', status: 'ATIVO' }, [temp('LIDER', ['NEVES'])]); return [p.role, p.unidadesTemporarias, p.roleFixo]; })(),
    ['MENTOR', ['NEVES'], 'MENTOR']);
igual('Líder fixo + Mentor temporário: vira Mentor (só o Admin libera)', ef(fixoLider, [temp('MENTOR', ['NEVES'])]).role, 'MENTOR');
igual('Recepção (login da unidade) nunca é rebaixada', ef({ email: 'r', role: 'RECEPCAO', unidade: 'PRADO', status: 'ATIVO' }, []).role, 'RECEPCAO');
igual('com SENHA o temporário não vale', [ef(null, [temp('LIDER', ['NEVES'])], 'senha'), situacaoDaEntrada(sit(null, [temp('LIDER', ['NEVES'])]), 'senha')], [null, 'cadastro']);
igual('com Google, só o temporário já deixa entrar', situacaoDaEntrada(sit(null, [temp('LIDER', ['NEVES'])]), 'google'), 'ativo');
igual('vencido não vale', temporariosValendo(sit(null, [temp('LIDER', ['NEVES'], '2026-11-12')]), 'google').length, 0);
igual('último dia ainda vale', temporariosValendo(sit(null, [temp('LIDER', ['NEVES'], '2026-11-13')]), 'google').length, 1);
igual('só temporário: não pede para confirmar os dados', precisaConfirmarDados(ef(null, [temp('LIDER', ['NEVES'])]), new Date('2026-11-13T12:00:00Z')), false);
igual('assinatura muda quando perde uma unidade', assinaturaDoAcesso(ef(fixoLider, [temp('LIDER', ['NEVES'])])) !== assinaturaDoAcesso(ef(fixoLider, [])), true);
igual('assinatura igual quando só o prazo muda', assinaturaDoAcesso(ef(fixoLider, [temp('LIDER', ['NEVES'])])) === assinaturaDoAcesso(ef(fixoLider, [temp('LIDER', ['NEVES'], '2026-12-30')])), true);
igual('avisos faltando 7, 3, 1 dia e no dia', [10, 7, 5, 3, 2, 1, 0].map(marcoDoAviso), [null, 7, 7, 3, 3, 1, 0]);
igual('dias para vencer', diasParaVencer({ vale_ate: '2026-11-22' }, '2026-11-13'), 9);
igual('posto', [postoDe({ posto: 'ASPIRA' }), postoDe({}), postoDe({ posto: 'titular' })], ['ASPIRA', 'TITULAR', 'TITULAR']);

// ---------- Cobrança para os dois (Líder e Aspira) ----------
const equipe = [
    { nome: 'ANA LIDER', unidade: 'PRADO', role: 'LIDER', telefone: '(31) 99999-0000' },
    { nome: 'BIA ASPIRA', unidade: 'PRADO', role: 'ASPIRA', telefone: '(31) 98888-0000' },
    { nome: 'CAIO', unidade: 'PRADO', role: 'RECEPCAO' },
    { nome: 'DANI', unidade: 'NEVES', role: 'LIDER', ativo: false },
];
igual('Líder e Aspira da Equipe, Líder primeiro', lideresDaUnidade(equipe, 'PRADO').map(l => [l.nome, l.posto]), [['ANA LIDER', 'TITULAR'], ['BIA ASPIRA', 'ASPIRA']]);
igual('desligado não é cobrado; sem ninguém usa os líderes de Acessos',
    lideresDaUnidade(equipe, 'NEVES', [{ unidade: 'NEVES', lideres: [{ nome: 'EVA', telefone: '5531977770000', posto: 'TITULAR' }, { nome: 'FABI', telefone: '', posto: 'ASPIRA' }] }]).map(l => [l.nome, l.posto]),
    [['EVA', 'TITULAR'], ['FABI', 'ASPIRA']]);
igual('Aspira só no Acessos completa a Equipe', lideresDaUnidade(equipe.slice(0, 1), 'PRADO', [{ unidade: 'PRADO', lideres: [{ nome: 'GIL', telefone: '', posto: 'ASPIRA' }] }]).map(l => l.nome), ['ANA LIDER', 'GIL']);
igual('unidade sem ninguém: lista vazia', lideresDaUnidade(equipe, 'VENEZA'), []);

// ---------- Painel: temporários ----------
const c3 = montarPainelAcessos({ painel: { logins: [], pedidos: [] }, unidades: [{ nome: 'PRADO' }], temporarios: [
    { id: 1, situacao: 'ATIVO', dias_para_vencer: 3, unidades: ['PRADO'] },
    { id: 2, situacao: 'ATIVO', dias_para_vencer: 20, unidades: ['PRADO', 'NEVES'] },
    { id: 3, situacao: 'VENCIDO', unidades: ['PRADO'] }] });
igual('temporários: valendo, vencendo em 7 dias e por unidade', [c3.tempAtivos.length, c3.tempVencendo.map(t => t.id), (c3.tempPorUnidade.get('PRADO') || []).length, c3.temporariosSemSql], [2, [1], 2, false]);
igual('sem o SQL de 13/11: avisa', montarPainelAcessos({ painel: { logins: [] }, unidades: [] }).temporariosSemSql, true);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
