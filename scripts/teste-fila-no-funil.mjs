// Teste de "aluno puxado no funil" (Migração, Resgate e Wellhub/Gympass, 16/11/2026): node scripts/teste-fila-no-funil.mjs
import { indexarLeadsDeFila, situacaoNoFunil, leadsWellhubDisponiveis } from '../src/pages/CrmVisitantes/filaNoFunil.js';
import { ehContatoDeFila, ehCanceladoOuInativo, classeTipoLead, chaveMensagemDoLead, GRUPO_WELLHUB } from '../src/pages/CrmVisitantes/utils.js';
import { MENSAGENS_PADRAO, ROTULOS_MENSAGENS, separarVersoes } from '../src/pages/CrmVisitantes/embaralhador.js';

const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
let falhas = 0;
const confere = (nome, obtido, esperado) => { const ok = obtido === esperado; if (!ok) falhas++; console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}: ${obtido} (esperado ${esperado})`); };
const hoje = iso(0);

// Contatos
const noFunil = { id: 1, cpf: '111.111.111-11', tipo_lead: 'MIGRACAO', status: 'Novo', puxado_por: 'ANA', unidade: 'PRADO' };
const emEspera = { id: 2, cpf: '22222222222', tipo_lead: 'MIGRACAO', status: 'Em Contato', puxado_por: 'ANA', proximo_contato: iso(2) };
const devolvido = { id: 3, cpf: '33333333333', tipo_lead: 'MIGRACAO', status: 'Novo', puxado_por: null };
const geladeira = { id: 4, cpf: '44444444444', tipo_lead: 'MIGRACAO', status: 'Perdido', perdido_em: new Date().toISOString() };
const geladeiraVencida = { id: 5, cpf: '55555555555', tipo_lead: 'MIGRACAO', status: 'Perdido', perdido_em: new Date(Date.now() - 31 * 86400000).toISOString() };
const fechado = { id: 6, cpf: '66666666666', tipo_lead: 'MIGRACAO', status: 'Fechado', puxado_por: 'ANA' };
const arquivado = { id: 7, cpf: '77777777777', tipo_lead: 'MIGRACAO', status: 'Arquivado' };
const outroTipo = { id: 8, cpf: '88888888888', tipo_lead: 'VISITANTE', status: 'Novo', puxado_por: 'ANA' };

confere('Novo com dona → NO_FUNIL', situacaoNoFunil(noFunil, hoje).tipo, 'NO_FUNIL');
confere('Em Contato com data futura → NO_FUNIL (Em Espera)', situacaoNoFunil(emEspera, hoje).fase, 'Em Espera');
confere('Em Espera guarda a data de volta', situacaoNoFunil(emEspera, hoje).voltaEm, iso(2));
confere('sem dona → DEVOLVIDO (volta para a aba)', situacaoNoFunil(devolvido, hoje).tipo, 'DEVOLVIDO');
confere('Perdido recente → GELADEIRA', situacaoNoFunil(geladeira, hoje).tipo, 'GELADEIRA');
confere('Perdido há 31 dias → LIBERADO', situacaoNoFunil(geladeiraVencida, hoje).tipo, 'LIBERADO');
confere('Fechado → FECHADO', situacaoNoFunil(fechado, hoje).tipo, 'FECHADO');
confere('sem contato → null', situacaoNoFunil(null, hoje), null);

// Índice por CPF: só os tipos pedidos, só com CPF completo, sem arquivado
const mapa = indexarLeadsDeFila([noFunil, devolvido, arquivado, outroTipo, { id: 9, cpf: '123', tipo_lead: 'MIGRACAO', status: 'Novo' }], ['MIGRACAO']);
confere('índice acha pelo CPF só com números', mapa.get('11111111111')?.id, 1);
confere('índice ignora Arquivado', mapa.has('77777777777'), false);
confere('índice ignora outro tipo', mapa.has('88888888888'), false);
confere('índice ignora CPF incompleto', mapa.has('123'), false);
// Dois contatos do mesmo CPF: vale o que está em aberto e com dona
const duplo = indexarLeadsDeFila([{ id: 10, cpf: '12312312312', tipo_lead: 'MIGRACAO', status: 'Perdido' }, { id: 11, cpf: '12312312312', tipo_lead: 'MIGRACAO', status: 'Novo', puxado_por: 'ANA' }], ['MIGRACAO']);
confere('mesmo CPF: vale o em aberto com dona', duplo.get('12312312312').id, 11);

// Grupo Wellhub: tipo WELLHUB, em Novo, sem dona, da unidade
const wh = (extra) => ({ id: 20, tipo_lead: 'WELLHUB', status: 'Novo', puxado_por: null, unidade: 'PRADO', ...extra });
const lista = [wh({ id: 20 }), wh({ id: 21, puxado_por: 'ANA' }), wh({ id: 22, status: 'Em Contato' }), wh({ id: 23, unidade: 'CASTELINHO' }), { ...wh({ id: 24 }), tipo_lead: 'MIGRACAO' }];
confere('Wellhub disponível: só sem dona, em Novo, da unidade', leadsWellhubDisponiveis(lista, 'prado').map(l => l.id).join(','), '20');

// Tipos
confere('MIGRACAO é contato de fila', ehContatoDeFila({ tipo_lead: 'MIGRACAO' }), true);
confere('RESGATE é contato de fila', ehContatoDeFila({ tipo_lead: 'resgate' }), true);
confere('WELLHUB é contato de fila', ehContatoDeFila({ tipo_lead: 'WELLHUB' }), true);
confere('VISITANTE não é contato de fila', ehContatoDeFila({ tipo_lead: 'VISITANTE' }), false);
confere('sem tipo não é contato de fila', ehContatoDeFila({}), false);
confere('RESGATE vale como cancelado/inativo', ehCanceladoOuInativo('RESGATE'), true);
confere('WELLHUB não é cancelado/inativo', ehCanceladoOuInativo('WELLHUB'), false);
confere('etiqueta RESGATE tem cor', classeTipoLead('RESGATE').includes('teal'), true);
confere('etiqueta WELLHUB tem cor', classeTipoLead('WELLHUB').includes('fuchsia'), true);
confere('nome do grupo', GRUPO_WELLHUB, 'WELLHUB / GYMPASS');

// Mensagens: Wellhub oferece só o Nutri; Resgate usa a de cancelado/inativo; Migração continua igual
confere('mensagem do Wellhub em Novo', chaveMensagemDoLead({ tipo_lead: 'WELLHUB', status: 'Novo' }), 'WELLHUB');
confere('mensagem do Wellhub em Em Contato', chaveMensagemDoLead({ tipo_lead: 'WELLHUB', status: 'Em Contato' }), 'WELLHUB');
confere('mensagem da Migração continua', chaveMensagemDoLead({ tipo_lead: 'MIGRACAO', status: 'Novo' }), 'MIGRACAO');
confere('mensagem do Resgate em Novo = cancelado/inativo', chaveMensagemDoLead({ tipo_lead: 'RESGATE', status: 'Novo' }), 'FASE_NOVO_INATIVO');
confere('Wellhub tem 10 versões', separarVersoes(MENSAGENS_PADRAO.WELLHUB).length, 10);
confere('Wellhub tem rótulo no editor', !!ROTULOS_MENSAGENS.WELLHUB, true);
confere('Wellhub não fala de preço nem de Day Use', /pre[çc]o|R\$|day use/i.test(MENSAGENS_PADRAO.WELLHUB), false);

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
