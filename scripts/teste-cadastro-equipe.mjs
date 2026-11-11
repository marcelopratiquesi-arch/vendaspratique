// Teste da regra "cadastro da equipe incompleto" (11/11/2026): node scripts/teste-cadastro-equipe.mjs
import { problemasDoColaborador, conjuntoDeSetores, colaboradoresComProblema, resumoPorUnidade } from '../src/pages/CadastroGeral/cadastroColaborador.js';

let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` — veio ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};

const setores = conjuntoDeSetores([{ nome: 'SAVER' }, { nome: 'RECEPÇÃO' }, { nome: 'LIDER' }]);
const certo = { nome: 'ANA SILVA', cpf: '081.812.716-37', telefone: '(31) 99751-4508', role: 'SAVER', unidade: 'NEVES', tipo_conta: 'INTER', conta_inter: '16664148-0', ativo: true };

igual('cadastro completo no Inter = nada', problemasDoColaborador(certo, setores), []);
igual('PIX = cobrar troca para o Inter', problemasDoColaborador({ ...certo, tipo_conta: 'PIX_CPF', conta_inter: null }, setores), ['pix']);
igual('Inter sem número = sem conta', problemasDoColaborador({ ...certo, conta_inter: '' }, setores), ['semConta']);
igual('sem tipo de conta = sem conta', problemasDoColaborador({ ...certo, tipo_conta: null }, setores), ['semConta']);
igual('CPF inválido', problemasDoColaborador({ ...certo, cpf: '111.111.111-11' }, setores), ['cpf']);
igual('CPF vazio', problemasDoColaborador({ ...certo, cpf: '' }, setores), ['cpf']);
igual('telefone curto', problemasDoColaborador({ ...certo, telefone: '(31) 9975' }, setores), ['telefone']);
igual('sem setor', problemasDoColaborador({ ...certo, role: '' }, setores), ['semSetor']);
igual('setor fora da lista', problemasDoColaborador({ ...certo, role: 'VENDAS ANTIGO' }, setores), ['setorForaDaLista']);
igual('setor com acento igual à lista', problemasDoColaborador({ ...certo, role: 'Recepcao' }, setores), []);
igual('sem lista de setores não confere setor', problemasDoColaborador({ ...certo, role: 'QUALQUER' }, null), []);
igual('desligado não é cobrado', problemasDoColaborador({ ...certo, tipo_conta: 'PIX_CPF', ativo: false }, setores), []);

const equipe = [
    { ...certo, id: 1 },
    { ...certo, id: 2, nome: 'BRUNO', tipo_conta: 'PIX_CPF' },
    { ...certo, id: 3, nome: 'CARLA', unidade: 'PRADO', telefone: '' },
    { ...certo, id: 4, nome: 'DANI', unidade: 'PRADO', tipo_conta: 'PIX_CPF', cpf: '' },
    { ...certo, id: 5, nome: 'EDU', unidade: 'VENEZA', tipo_conta: 'PIX_CPF' },
];
const doMentor = colaboradoresComProblema(equipe, ['Neves', 'PRADO'], setores);
igual('só as unidades pedidas, por unidade e nome', doMentor.map(i => i.c.id), [2, 3, 4]);
igual('resumo por unidade', resumoPorUnidade(doMentor), [
    { unidade: 'NEVES', total: 1, pix: 1, outros: 0 },
    { unidade: 'PRADO', total: 2, pix: 1, outros: 2 },
]);
igual('null = todas as unidades', colaboradoresComProblema(equipe, null, setores).length, 4);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
