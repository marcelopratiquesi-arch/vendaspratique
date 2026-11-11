// Teste das regras do acesso pessoal com Google (12/11/2026): node scripts/teste-acesso.mjs
import {
    telefoneValido, juntarTelefone, telefoneParaEquipe, telefoneBonito, precisaConfirmarDados, situacaoDaEntrada,
    senhaLiberada, metodoDoToken, descreverDispositivo, montarPainelAcessos,
} from '../src/components/acesso/regrasAcesso.js';

let falhas = 0;
const igual = (nome, obtido, esperado) => {
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas += 1;
    console.log(`${ok ? '✅' : '❌'} ${nome}${ok ? '' : ` — veio ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};
const agora = new Date('2026-11-12T12:00:00Z');
const diasAtras = (d) => new Date(agora.getTime() - d * 86400000).toISOString();

// Telefone com DDI
igual('telefone com DDI válido / curto', [telefoneValido('5531997514508'), telefoneValido('31997514508')], [true, false]);
igual('junta DDI sem repetir o 55', [juntarTelefone('55', '(31) 99751-4508'), juntarTelefone('55', '5531997514508')], ['5531997514508', '5531997514508']);
igual('telefone para a Equipe (sem o 55)', [telefoneParaEquipe('5531997514508'), telefoneParaEquipe('553134567890')], ['(31) 99751-4508', '(31) 3456-7890']);
igual('telefone bonito', telefoneBonito('5531997514508'), '+55 (31) 99751-4508');

// Confirmação dos dados (Líder/Mentor/Admin; Recepção nunca)
const lider = { role: 'LIDER', status: 'ATIVO', telefone: '5531997514508', dados_confirmados_em: diasAtras(10) };
igual('confirmado há 10 dias: não pede', precisaConfirmarDados(lider, agora), false);
igual('há 31 dias: pede', precisaConfirmarDados({ ...lider, dados_confirmados_em: diasAtras(31) }, agora), true);
igual('sem telefone: pede', precisaConfirmarDados({ ...lider, telefone: '' }, agora), true);
igual('nunca confirmou (primeiro acesso): pede', precisaConfirmarDados({ ...lider, dados_confirmados_em: null }, agora), true);
igual('Recepção nunca confirma', precisaConfirmarDados({ ...lider, role: 'RECEPCAO', telefone: '' }, agora), false);
igual('banco sem o SQL: não pede', precisaConfirmarDados({ role: 'LIDER' }, agora), false);

// O que mostrar depois de entrar com o Google
igual('e-mail novo cai no cadastro', situacaoDaEntrada({ perfil: null, pedido: null }), 'cadastro');
igual('pedido aberto: aguardando', situacaoDaEntrada({ perfil: null, pedido: { status: 'AGUARDANDO_APROVACAO' } }), 'aguardando');
igual('rejeitado mostra o motivo', situacaoDaEntrada({ perfil: null, pedido: { status: 'REJEITADO' } }), 'rejeitado');
igual('líder trocado: inativo', situacaoDaEntrada({ perfil: { status: 'INATIVO' }, pedido: null }), 'inativo');
igual('inativo que pediu de novo: aguardando', situacaoDaEntrada({ perfil: { status: 'INATIVO' }, pedido: { status: 'AGUARDANDO_APROVACAO' } }), 'aguardando');
igual('ativo entra', situacaoDaEntrada({ perfil: { status: 'ATIVO' } }), 'ativo');

// Senha depois da virada
igual('transição: senha para todos', senhaLiberada({ perfil: { role: 'LIDER' }, senhaParaTodos: true }), true);
igual('virada: Líder com senha é barrado', senhaLiberada({ perfil: { role: 'LIDER' }, senhaParaTodos: false, agora }), false);
igual('virada: Admin sempre (emergência)', senhaLiberada({ perfil: { role: 'ADMIN' }, senhaParaTodos: false, agora }), true);
igual('virada: liberação de 24 h vale', senhaLiberada({ perfil: { role: 'RECEPCAO', emergencia_ate: new Date(agora.getTime() + 3600000).toISOString() }, senhaParaTodos: false, agora }), true);
igual('virada: liberação vencida não vale', senhaLiberada({ perfil: { role: 'RECEPCAO', emergencia_ate: diasAtras(1) }, senhaParaTodos: false, agora }), false);

// Método do login pelo token
const token = (amr) => `x.${btoa(JSON.stringify({ amr: [{ method: amr }], session_id: 'abc' })).replace(/=+$/, '')}.y`;
igual('token do Google / da senha', [metodoDoToken(token('oauth')), metodoDoToken(token('password')), metodoDoToken('lixo')], ['google', 'senha', 'desconhecido']);
igual('aparelho', descreverDispositivo('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120 Safari/537'), 'Chrome · Windows');

// Pendências → Acessos
const painel = {
    logins: [
        { email: 'a', role: 'LIDER', unidade: 'PRADO', status: 'ATIVO', ultimo_login: diasAtras(9), ultimo_metodo: 'google', telefone: '5531997514508', dados_confirmados_em: diasAtras(2) },
        { email: 'b', role: 'LIDER', unidade: 'NEVES', status: 'ATIVO', ultimo_login: null, telefone: '' },
        { email: 'c', role: 'RECEPCAO', unidade: 'PRADO', status: 'ATIVO', ultimo_login: diasAtras(1), ultimo_metodo: 'senha' },
        { email: 'd', role: 'LIDER', unidade: 'VENEZA', status: 'INATIVO', ultimo_login: diasAtras(40) },
    ],
    pedidos: [{ id: 1, tipo: 'NOVO' }, { id: 2, tipo: 'TROCA_LIDER' }],
    alertas: [{ id: 9 }],
};
const c = montarPainelAcessos({ painel, unidades: [{ nome: 'PRADO' }, { nome: 'NEVES' }, { nome: 'VENEZA' }], agora });
igual('sem acesso 7+ dias: quem nunca entrou primeiro, inativo fora', c.semAcesso.map(l => l.email), ['b', 'a']);
igual('unidade sem líder ativo (líder inativo não conta)', c.unidadesSemLider, ['VENEZA']);
igual('dados não confirmados (sem telefone)', c.naoConfirmados.map(l => l.email), ['b']);
igual('trocas de líder e alertas', [c.trocas.length, c.alertas.length], [1, 1]);
igual('adesão: Líder/Recepção ainda sem Google', c.semGoogle.map(l => l.email), ['b', 'c']);

// Admin marcado como líder (painel.lideres do banco, passo 5): a unidade NÃO fica "sem líder"
const c2 = montarPainelAcessos({ painel: { ...painel, lideres: [{ unidade: 'VENEZA', email: 'adm', nome: 'DONO', role: 'ADMIN' }] }, unidades: [{ nome: 'PRADO' }, { nome: 'NEVES' }, { nome: 'VENEZA' }], agora });
igual('Admin como líder da unidade conta como líder', c2.unidadesSemLider, []);
igual('lista de líderes por unidade', c2.lideres.map(l => [l.unidade, l.lideres.map(x => x.email)]), [['PRADO', ['a']], ['NEVES', ['b']], ['VENEZA', ['adm']]]);

console.log(falhas ? `\n${falhas} teste(s) falharam` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
