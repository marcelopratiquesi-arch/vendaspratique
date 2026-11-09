// ==========================================
// CATÁLOGO DE PERMISSÕES (decisão do dono, 06/11/2026)
// A lista oficial do que cada nível de acesso pode ver/fazer no sistema, com número.
// Numeração: a CENTENA é a tela (0xx menu, 1xx Nova Venda, 2xx Histórico, 3xx Dashboard, 4xx Fechamento,
// 5xx CRM, 6xx Alunos, 7xx Avaliação, 8xx Cadastros, 9xx Comunicados/Cobranças/Configurações).
// Tela nova ganha a próxima centena livre; permissão nova ganha o próximo número da centena. NUNCA reaproveitar
// um número (o banco guarda as mudanças pelo número).
//
// Campos:
//   padrao  = níveis que têm a permissão quando o Admin não mudou nada (é como o sistema era antes da aba).
//   tipo    = 'ver' (tela/aba — Etapa 1) ou 'fazer' (ação — Etapa 2, 06/11/2026).
//   travada = sempre no padrão (ex.: a aba principal de cada tela; Configurações e catálogo só do Admin).
//   rede    = só funciona com a visão de várias unidades (Admin/Mentor); para Líder/Recepção fica travada.
//   banco   = o banco também confere esta ação pela função seg_pode('codigo') (sql/2026-11-06-permissoes-acoes/).
//             Se a função ainda não existir no banco, a ação fica travada no padrão (senão o botão apareceria e o
//             banco recusaria). Ação com 'banco' nova = acrescentar também na tabela permissoes_padrao (ver o SQL).
//   mudavelPara = só estes níveis podem ser mudados (ex.: a cobrança do relatório só faz sentido para a Recepção).
// O ADMIN fica sempre no padrão (não dá para tirar nada dele, para ninguém se trancar fora).
// A permissão diz O QUE; a unidade continua dizendo ONDE (regras 6 e 13 do CLAUDE.md).
// ==========================================

export const PAPEIS = ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'];
export const NOME_PAPEL = { ADMIN: 'Admin', MENTOR: 'Mentor', LIDER: 'Líder', RECEPCAO: 'Recepção' };

const TODOS = ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'];
const GESTAO = ['ADMIN', 'MENTOR', 'LIDER'];
const GLOBAL = ['ADMIN', 'MENTOR'];
const SO_ADMIN = ['ADMIN'];

export const GRUPOS_PERMISSAO = [
    { centena: 0, nome: 'Menu lateral' },
    { centena: 1, nome: 'Nova Venda' },
    { centena: 2, nome: 'Histórico' },
    { centena: 3, nome: 'Dashboard' },
    { centena: 4, nome: 'Fechamento' },
    { centena: 5, nome: 'CRM' },
    { centena: 6, nome: 'Alunos' },
    { centena: 7, nome: 'Avaliação' },
    { centena: 8, nome: 'Cadastros' },
    { centena: 9, nome: 'Comunicados, cobranças e Configurações' },
];

export const CATALOGO_PERMISSOES = [
    // ---------- 0xx MENU LATERAL ----------
    { codigo: '001', nome: 'Nova Venda', tipo: 'ver', padrao: TODOS },
    { codigo: '002', nome: 'Histórico', tipo: 'ver', padrao: TODOS },
    { codigo: '003', nome: 'Dashboard', tipo: 'ver', padrao: TODOS },
    { codigo: '004', nome: 'Fechamento', tipo: 'ver', padrao: GESTAO },
    { codigo: '005', nome: 'CRM', tipo: 'ver', padrao: TODOS },
    { codigo: '006', nome: 'Alunos', tipo: 'ver', padrao: TODOS },
    { codigo: '007', nome: 'Avaliação', tipo: 'ver', padrao: TODOS },
    { codigo: '008', nome: 'Cadastros', tipo: 'ver', padrao: GESTAO },
    { codigo: '009', nome: 'Comunicados', tipo: 'ver', padrao: TODOS },
    { codigo: '010', nome: 'Pendências', tipo: 'ver', padrao: GLOBAL, rede: true },
    { codigo: '011', nome: 'Configurações', tipo: 'ver', padrao: SO_ADMIN, travada: true, descricao: 'Logins e permissões: só o Admin (as unidades ficam em Cadastros desde 09/11/2026).' },
    { codigo: '012', nome: 'Trocar a unidade no topo', tipo: 'fazer', padrao: GLOBAL, travada: true, descricao: 'Regra das unidades (Admin e Mentor).' },

    // ---------- 1xx NOVA VENDA ----------
    { codigo: '101', nome: 'Lançar venda', tipo: 'fazer', padrao: TODOS },
    { codigo: '102', nome: 'Cadastrar visitante', tipo: 'fazer', padrao: TODOS },
    { codigo: '103', nome: 'Escolher a unidade da venda', tipo: 'fazer', padrao: GLOBAL, travada: true, descricao: 'Regra das unidades: Líder e Recepção lançam sempre na própria unidade.' },

    // ---------- 2xx HISTÓRICO ----------
    { codigo: '201', nome: 'Aba Registros', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Aba principal da tela (para esconder a tela, desligue o 002).' },
    { codigo: '202', nome: 'Aba Duplicidades', tipo: 'ver', padrao: TODOS },
    { codigo: '203', nome: 'Aba Lixeira', tipo: 'ver', padrao: TODOS },
    { codigo: '204', nome: 'Editar venda', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'Histórico e Duplicidades, só nas unidades da pessoa.' },
    { codigo: '205', nome: 'Excluir venda (com motivo)', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'A venda vai para a Lixeira, só nas unidades da pessoa.' },
    { codigo: '206', nome: 'Marcar "Não é duplicidade"', tipo: 'fazer', padrao: GESTAO, banco: true },
    { codigo: '207', nome: 'Restaurar venda da lixeira', tipo: 'fazer', padrao: GLOBAL, travada: true, descricao: 'Por enquanto só Admin e Mentor (a função do banco que restaura ainda precisa ser conferida).' },

    // ---------- 3xx DASHBOARD ----------
    { codigo: '301', nome: 'Aba Dashboard', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Aba principal da tela (para esconder a tela, desligue o 003).' },
    { codigo: '302', nome: 'Aba Metas da unidade', tipo: 'ver', padrao: TODOS },
    { codigo: '303', nome: 'Aba Relatórios', tipo: 'ver', padrao: TODOS },
    { codigo: '304', nome: 'Aba Ranking global', tipo: 'ver', padrao: GLOBAL, rede: true },
    { codigo: '305', nome: 'Aba Saúde da unidade', tipo: 'ver', padrao: TODOS },
    { codigo: '306', nome: 'Visão da Rede (topo em "Todas")', tipo: 'fazer', padrao: GLOBAL, travada: true, descricao: 'Regra das unidades (Admin e Mentor).' },
    { codigo: '307', nome: 'Gravar metas do mês', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'Meta Start e Meta Mensal, só nas unidades da pessoa.' },
    { codigo: '308', nome: 'Lançar movimentação do dia', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'Ativos, cancelamentos e faturamento, só nas unidades da pessoa.' },
    { codigo: '309', nome: 'Marcar "Não tem Personal Class"', tipo: 'fazer', padrao: GESTAO, banco: true },
    { codigo: '310', nome: 'Monitoramento da movimentação', tipo: 'fazer', padrao: GLOBAL, rede: true, descricao: 'Aba Metas com o topo em "Todas".' },
    { codigo: '311', nome: 'Relatórios: Planilha e WhatsApp Geral', tipo: 'fazer', padrao: GESTAO, descricao: 'O WhatsApp Fechamento continua para todos.' },
    { codigo: '312', nome: 'Painel "Relatórios de fechamento enviados"', tipo: 'fazer', padrao: GESTAO },
    { codigo: '313', nome: 'Confirmar envio do relatório de fechamento', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'Conferir no grupo de vendas e marcar Enviado / Não enviado, só nas unidades da pessoa.' },

    // ---------- 4xx FECHAMENTO ----------
    { codigo: '401', nome: 'Aba Conferência', tipo: 'ver', padrao: GESTAO, travada: true, descricao: 'Aba principal da tela (para esconder a tela, desligue o 004).' },
    { codigo: '402', nome: 'Aba Comissões', tipo: 'ver', padrao: GESTAO },
    { codigo: '403', nome: 'Aba Visão Geral', tipo: 'ver', padrao: GESTAO },
    { codigo: '404', nome: 'Aba Auditoria', tipo: 'ver', padrao: GLOBAL },
    { codigo: '405', nome: 'Conferir, editar e excluir venda', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'No Fechamento, só nas unidades da pessoa.' },
    { codigo: '406', nome: 'Marcar todas como conferidas', tipo: 'fazer', padrao: SO_ADMIN, descricao: 'Também precisa do 405 (conferir).' },

    // ---------- 5xx CRM ----------
    { codigo: '501', nome: 'Entrada: aba Equipe', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Aba principal da tela (para esconder a tela, desligue o 005).' },
    { codigo: '502', nome: 'Entrada: aba Painel', tipo: 'ver', padrao: TODOS, descricao: 'Desde 07/11/2026 junta as antigas abas Desempenho e Rede e o Resultado por recepcionista (o antigo 503 deixou de existir).' },
    { codigo: '504', nome: 'Entrada: aba Contatos', tipo: 'ver', padrao: TODOS, descricao: 'Desde 07/11/2026 junta as antigas abas Relatório e Histórico (o antigo 505 deixou de existir).' },
    { codigo: '506', nome: 'CRM da recepcionista: Kanban', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Visão principal do CRM da recepcionista.' },
    { codigo: '507', nome: 'CRM da recepcionista: Lista', tipo: 'ver', padrao: TODOS },
    { codigo: '508', nome: 'CRM da recepcionista: Hoje', tipo: 'ver', padrao: TODOS },
    { codigo: '509', nome: 'CRM da recepcionista: Geladeira', tipo: 'ver', padrao: TODOS },
    { codigo: '510', nome: 'CRM da recepcionista: Migração', tipo: 'ver', padrao: TODOS },
    { codigo: '511', nome: 'CRM da recepcionista: Não contatar', tipo: 'ver', padrao: TODOS },
    { codigo: '512', nome: 'CRM da recepcionista: Métricas', tipo: 'ver', padrao: TODOS },
    { codigo: '513', nome: 'CRM da recepcionista: Relatório de conversão', tipo: 'ver', padrao: TODOS },
    { codigo: '514', nome: 'Apagar contato', tipo: 'fazer', padrao: GESTAO, banco: true },
    { codigo: '515', nome: 'Tirar alguém do "Não contatar"', tipo: 'fazer', padrao: GESTAO, banco: true },
    { codigo: '516', nome: 'Editar mensagens prontas', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'As mensagens valem para a rede inteira.' },
    { codigo: '517', nome: 'Base: Smart Paste, distribuir e mover', tipo: 'fazer', padrao: TODOS },
    { codigo: '518', nome: '"Cobrar no WhatsApp" do Painel da Rede', tipo: 'fazer', padrao: GLOBAL, rede: true },
    { codigo: '519', nome: 'CRM da recepcionista: Conversa', tipo: 'ver', padrao: TODOS, descricao: 'Contatos de um lado e a conversa do contato do outro (como o WhatsApp Business).' },
    { codigo: '520', nome: 'Base: puxar alunos do cadastro', tipo: 'fazer', padrao: TODOS, descricao: 'Traz para o Banco Bruto os alunos da unidade pelo status (Finalizado, Inativo...). Fica dentro da Base (517).' },
    { codigo: '521', nome: 'CRM da recepcionista: Resgate', tipo: 'ver', padrao: TODOS, descricao: 'Alunos finalizados e inativos (status do cadastro) numa fila separada, igual à Migração.' },

    // ---------- 6xx ALUNOS ----------
    { codigo: '601', nome: 'Ficha: aba Dados', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Aba principal da ficha (para esconder a tela, desligue o 006).' },
    { codigo: '602', nome: 'Ficha: aba Planos', tipo: 'ver', padrao: TODOS },
    { codigo: '603', nome: 'Ficha: aba Produtos', tipo: 'ver', padrao: TODOS },
    { codigo: '604', nome: 'Ficha: aba Avaliações', tipo: 'ver', padrao: TODOS },
    { codigo: '605', nome: 'Ficha: aba Contatos', tipo: 'ver', padrao: TODOS },
    { codigo: '606', nome: 'Ficha: aba Histórico', tipo: 'ver', padrao: TODOS },
    { codigo: '607', nome: 'Cadastrar e editar aluno', tipo: 'fazer', padrao: TODOS },
    { codigo: '608', nome: 'Transferir aluno para a minha unidade', tipo: 'fazer', padrao: TODOS },
    { codigo: '609', nome: 'Excluir cadastro de aluno', tipo: 'fazer', padrao: SO_ADMIN, travada: true, descricao: 'Apaga o histórico do aluno: só o Admin.' },
    { codigo: '610', nome: 'Excluir avaliação pela ficha', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'A avaliação vai para a Lixeira.' },

    // ---------- 7xx AVALIAÇÃO ----------
    { codigo: '701', nome: 'Painéis dos avaliadores e nova avaliação', tipo: 'ver', padrao: TODOS, travada: true, descricao: 'Parte principal da tela (para esconder a tela, desligue o 007).' },
    { codigo: '702', nome: 'Dashboard Global', tipo: 'ver', padrao: GLOBAL, rede: true },
    { codigo: '703', nome: 'Dashboard da Unidade', tipo: 'ver', padrao: GESTAO },
    { codigo: '704', nome: 'Editar e excluir avaliação', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'No painel do avaliador; excluir manda para a Lixeira.' },
    { codigo: '705', nome: 'Restaurar avaliação da lixeira', tipo: 'fazer', padrao: GLOBAL, banco: true },
    { codigo: '706', nome: 'Configurar formulário (perguntas)', tipo: 'fazer', padrao: GLOBAL, travada: true, descricao: 'Admin e Mentor (o formulário vale para a rede inteira).' },
    { codigo: '707', nome: 'Lixeira das avaliações (ver)', tipo: 'ver', padrao: TODOS },

    // ---------- 8xx CADASTROS ----------
    { codigo: '801', nome: 'Aba Alunos (Smart Paste)', tipo: 'ver', padrao: GESTAO },
    { codigo: '802', nome: 'Aba Equipe', tipo: 'ver', padrao: GESTAO },
    { codigo: '803', nome: 'Aba Catálogo (ver)', tipo: 'ver', padrao: GESTAO },
    { codigo: '804', nome: 'Aba Setores', tipo: 'ver', padrao: GESTAO },
    { codigo: '805', nome: 'Alterar o catálogo (valor da comissão)', tipo: 'fazer', padrao: SO_ADMIN, travada: true, descricao: 'É o valor da comissão: só o Admin.' },
    { codigo: '806', nome: 'Alterar setores', tipo: 'fazer', padrao: SO_ADMIN, travada: true, descricao: 'Só o Admin.' },
    { codigo: '807', nome: 'Editar a equipe (Líder só a unidade dele)', tipo: 'fazer', padrao: GESTAO, banco: true, descricao: 'Inclui marcar o turno das recepcionistas.' },
    { codigo: '808', nome: 'Aba Unidades', tipo: 'ver', padrao: SO_ADMIN, travada: true, descricao: 'Cadastrar, desativar e excluir unidades: só o Admin. Até 09/11/2026 ficava em Configurações (o antigo 906 deixou de existir).' },

    // ---------- 9xx COMUNICADOS, COBRANÇAS E CONFIGURAÇÕES ----------
    { codigo: '901', nome: 'Criar comunicado', tipo: 'fazer', padrao: GLOBAL },
    { codigo: '902', nome: 'Janela e cartão de cobranças ao entrar', tipo: 'fazer', padrao: ['MENTOR', 'LIDER'], mudavelPara: ['MENTOR', 'LIDER'], descricao: 'Para Líder e Mentor (o Admin vê tudo na aba Pendências).' },
    { codigo: '903', nome: 'Cobrança do relatório de fechamento', tipo: 'fazer', padrao: ['RECEPCAO'], mudavelPara: ['RECEPCAO'], descricao: 'Só a Recepção (o envio só conta pelo login da Recepção); dá para desligar.' },
    { codigo: '904', nome: 'Janela para marcar o turno das recepcionistas', tipo: 'fazer', padrao: ['LIDER'], mudavelPara: ['LIDER'], descricao: 'Só o Líder (da unidade dele); dá para desligar.' },
    { codigo: '909', nome: 'Lembrete para fazer o CRM', tipo: 'fazer', padrao: ['RECEPCAO'], mudavelPara: ['RECEPCAO'], descricao: 'Só a Recepção: janela nos horários do CRM (seg-sex 8h, 10h, 12h, 14h30, 15h30, 17h30, 19h30; sáb/dom/feriado 9h e 11h).' },
    { codigo: '905', nome: 'Configurações: Logins', tipo: 'ver', padrao: SO_ADMIN, travada: true },
    { codigo: '907', nome: 'Configurações: Permissões', tipo: 'ver', padrao: SO_ADMIN, travada: true },
    { codigo: '908', nome: 'Marcar as unidades de cada Mentor', tipo: 'fazer', padrao: SO_ADMIN, travada: true, descricao: 'Só o Admin.' },
];

export const PERMISSAO_POR_CODIGO = new Map(CATALOGO_PERMISSOES.map(p => [p.codigo, p]));

export const grupoDaPermissao = (codigo) => GRUPOS_PERMISSAO.find(g => g.centena === Math.floor(Number(codigo) / 100));

// Este nível pode ter a permissão ligada/desligada pelo Admin?
// bancoPronto = a função seg_pode existe no banco (sem ela, as ações com 'banco' ficam no padrão)
export const podeMudar = (permissao, papel, bancoPronto = true) => {
    if (!permissao || papel === 'ADMIN') return false;
    if (permissao.travada) return false;
    if (permissao.banco && !bancoPronto) return false;
    if (permissao.rede && !['ADMIN', 'MENTOR'].includes(papel)) return false;
    if (permissao.mudavelPara && !permissao.mudavelPara.includes(papel)) return false;
    return true;
};

// Regra única: o nível/login tem a permissão?
// regrasPapel: Map 'PAPEL|codigo' -> boolean (mudanças do Admin para o nível)
// excecoes: Map 'codigo' -> boolean (mudanças do Admin para este login)
export const temPermissao = ({ codigo, papel, regrasPapel, excecoes, bancoPronto = true }) => {
    const p = PERMISSAO_POR_CODIGO.get(String(codigo));
    if (!p) return false;
    const papelUp = String(papel || '').toUpperCase().trim();
    const padrao = p.padrao.includes(papelUp);
    if (!podeMudar(p, papelUp, bancoPronto)) return padrao;
    if (excecoes?.has(p.codigo)) return excecoes.get(p.codigo);
    const chave = `${papelUp}|${p.codigo}`;
    if (regrasPapel?.has(chave)) return regrasPapel.get(chave);
    return padrao;
};

// Para as telas: usa o "pode" que o App coloca no usuário; sem ele, o padrão pelo papel verdadeiro
export const podeVer = (usuario, codigo) => {
    if (typeof usuario?.pode === 'function') return usuario.pode(codigo);
    return temPermissao({ codigo, papel: usuario?.roleReal || usuario?.role });
};

// Mesma regra, com nome de ação (para ler melhor no código: podeFazer(usuario, '307'))
export const podeFazer = podeVer;
