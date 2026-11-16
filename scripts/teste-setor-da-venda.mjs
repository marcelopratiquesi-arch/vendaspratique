// Teste do filtro de setor do Fechamento (16/11/2026): node scripts/teste-setor-da-venda.mjs
import { criarLocalizadorDeSetor, listarSetores, vendaDoSetor, setorDaPessoa, SEM_SETOR, TODOS_SETORES } from '../src/pages/FechamentoCaixa/setorDaVenda.js';

let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` — veio ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};

const equipe = [
    { id: 1, nome: 'RAIANE KEROLYM MENDES', cpf: '161.455.366-16', role: 'RECEPÇÃO', unidade: 'VENEZA', ativo: true },
    { id: 2, nome: 'LUCIENE COSTA GOMES', cpf: '06655993660', role: 'SAVER', unidade: 'VENEZA', ativo: true },
    { id: 3, nome: 'VICTOR GABRIEL', cpf: '14475621607', role: 'BEM-ESTAR', unidade: 'VENEZA', ativo: true },
    { id: 4, nome: 'JOÃO DA SILVA', cpf: '11111111111', role: 'LÍDER', unidade: 'VENEZA', ativo: true },
    // Homônimas: uma em cada unidade
    { id: 5, nome: 'ANA SOUZA', cpf: '22222222222', role: 'RECEPCAO', unidade: 'VENEZA', ativo: true },
    { id: 6, nome: 'ANA SOUZA', cpf: '33333333333', role: 'SAVER', unidade: 'PRADO', ativo: true },
    // Mesmo nome: a desligada era da Recepção, a ativa é Saver
    { id: 7, nome: 'BIA LIMA', cpf: '44444444444', role: 'RECEPCAO', unidade: 'VENEZA', ativo: false },
    { id: 8, nome: 'BIA LIMA', cpf: '55555555555', role: 'SAVER', unidade: 'VENEZA', ativo: true },
    { id: 9, nome: 'CARLA SEM SETOR', cpf: '66666666666', role: '', unidade: 'VENEZA', ativo: true },
    { id: 10, nome: 'DUDA PROFESSORA', cpf: '77777777777', role: 'MUSCULAÇÃO', unidade: 'PRADO', ativo: true },
    { id: 11, nome: 'EVA ASPIRA', cpf: '88888888888', role: 'ASPIRA', unidade: 'VENEZA', ativo: true },
];
const setor = criarLocalizadorDeSetor(equipe);
const chave = (v) => setor(v).chave;

igual('pelo CPF do vendedor (mesmo com o nome escrito diferente)', chave({ vendedor: 'RAIANE', vendedor_cpf: '16145536616', unidade: 'VENEZA' }), 'RECEPCAO');
igual('pelo nome exato, sem acento e com espaço a mais', chave({ vendedor: '  joao  da silva ', unidade: 'VENEZA' }), 'LIDER');
igual('Saver', chave({ vendedor: 'LUCIENE COSTA GOMES', unidade: 'VENEZA' }), 'SAVER');
igual('Bem-estar', chave({ vendedor: 'VICTOR GABRIEL', unidade: 'VENEZA' }), 'BEM_ESTAR');
igual('nome parecido NÃO vale (só o exato)', chave({ vendedor: 'VICTOR GABRIEL REHFELD', unidade: 'VENEZA' }), SEM_SETOR);
igual('homônimas: fica a da unidade da venda (Veneza)', chave({ vendedor: 'ANA SOUZA', unidade: 'VENEZA' }), 'RECEPCAO');
igual('homônimas: fica a da unidade da venda (Prado)', chave({ vendedor: 'ANA SOUZA', unidade: 'PRADO' }), 'SAVER');
igual('mesmo nome, uma desligada: fica a ativa', chave({ vendedor: 'BIA LIMA', unidade: 'VENEZA' }), 'SAVER');
igual('CPF da venda aponta a desligada: vale o CPF', chave({ vendedor: 'BIA LIMA', vendedor_cpf: '44444444444', unidade: 'VENEZA' }), 'RECEPCAO');
igual('CPF que não está na Equipe: cai para o nome', chave({ vendedor: 'LUCIENE COSTA GOMES', vendedor_cpf: '99999999999', unidade: 'VENEZA' }), 'SAVER');
igual('vendedor fora da Equipe = Sem setor', chave({ vendedor: 'FULANO QUE SAIU', unidade: 'VENEZA' }), SEM_SETOR);
igual('pessoa sem setor no cadastro = Sem setor', chave({ vendedor: 'CARLA SEM SETOR', unidade: 'VENEZA' }), SEM_SETOR);
igual('venda sem vendedor = Sem setor', chave({ unidade: 'VENEZA' }), SEM_SETOR);
igual('setor fora da lista vira setor próprio', setor({ vendedor: 'EVA ASPIRA', unidade: 'VENEZA' }), { chave: 'OUTRO:ASPIRA', rotulo: 'ASPIRA' });
igual('setorDaPessoa sem ninguém', setorDaPessoa(null).chave, SEM_SETOR);

const vendas = [
    { id: 1, vendedor: 'RAIANE KEROLYM MENDES', vendedor_cpf: '16145536616', unidade: 'VENEZA', valor: 291 },
    { id: 2, vendedor: 'LUCIENE COSTA GOMES', unidade: 'VENEZA', valor: 84 },
    { id: 3, vendedor: 'VICTOR GABRIEL', unidade: 'VENEZA', valor: 54.47 },
    { id: 4, vendedor: 'JOÃO DA SILVA', unidade: 'VENEZA', valor: 20 },
    { id: 5, vendedor: 'FULANO QUE SAIU', unidade: 'VENEZA', valor: 7 },
    { id: 6, vendedor: 'ANA SOUZA', unidade: 'PRADO', valor: 12 },
    { id: 7, vendedor: 'EVA ASPIRA', unidade: 'VENEZA', valor: 3 },
    { id: 8, vendedor: 'DUDA PROFESSORA', unidade: 'PRADO', valor: 9 },
];

const opcoesRede = listarSetores({ colaboradores: equipe, vendas, unidade: null, setorDaVenda: setor });
igual('opções na rede: ordem da Nova Venda, outros antes do Líder, Sem setor no fim',
    opcoesRede.map(s => s.chave), ['RECEPCAO', 'MUSCULACAO', 'BEM_ESTAR', 'SAVER', 'OUTRO:ASPIRA', 'LIDER', SEM_SETOR]);
const vendasVeneza = vendas.filter(v => v.unidade === 'VENEZA');
const opcoesVeneza = listarSetores({ colaboradores: equipe, vendas: vendasVeneza, unidade: 'VENEZA', setorDaVenda: setor });
igual('opções de uma unidade: só os setores dela (sem Musculação)',
    opcoesVeneza.map(s => s.chave), ['RECEPCAO', 'BEM_ESTAR', 'SAVER', 'OUTRO:ASPIRA', 'LIDER', SEM_SETOR]);
igual('sem venda "sem setor", a opção não aparece',
    listarSetores({ colaboradores: equipe, vendas: vendas.filter(v => v.id !== 5), unidade: null, setorDaVenda: setor }).some(s => s.chave === SEM_SETOR), false);

// O mais importante: a soma dos setores (com "Sem setor") é igual ao total sem filtro, e nenhuma venda entra em dois
const centavos = (lista) => Math.round(lista.reduce((s, v) => s + v.valor, 0) * 100);
const somaDosSetores = opcoesRede.reduce((s, o) => s + centavos(vendas.filter(v => vendaDoSetor(v, o.chave, setor))), 0);
igual('soma dos setores = total sem filtro', somaDosSetores, centavos(vendas));
igual('cada venda em um setor só', opcoesRede.reduce((s, o) => s + vendas.filter(v => vendaDoSetor(v, o.chave, setor)).length, 0), vendas.length);
igual('"Todos" não tira nenhuma venda', vendas.filter(v => vendaDoSetor(v, TODOS_SETORES, setor)).length, vendas.length);
igual('só a Recepção', vendas.filter(v => vendaDoSetor(v, 'RECEPCAO', setor)).map(v => v.id), [1]);
igual('só o Saver (Veneza e Prado)', vendas.filter(v => vendaDoSetor(v, 'SAVER', setor)).map(v => v.id), [2, 6]);

console.log(falhas === 0 ? '\nTudo certo.' : `\n${falhas} teste(s) falharam.`);
process.exit(falhas === 0 ? 0 : 1);
