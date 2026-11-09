// ==========================================
// CONFIGURAÇÕES → LOGINS (visual novo, 09/11/2026): regras sem tela, para poder testar com node.
// - filtrarLogins: busca (nome/e-mail), nível e unidade (a do login ou, no Mentor, as marcadas para ele)
// - resumoLogins: quantos logins de cada nível
// - conferirLogins: a faixa "para conferir" (nada é mudado sozinho, só avisa)
// Teste: node scripts/teste-configuracoes.mjs
// ==========================================

export const ORDEM_PAPEIS = ['ADMIN', 'MENTOR', 'LIDER', 'RECEPCAO'];

export const normalizarUnidade = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const normalizarBusca = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const papelDe = (u) => String(u?.role || '').toUpperCase().trim();
const emailDe = (u) => String(u?.email || '').toLowerCase().trim();
const ehGlobal = (unidade) => ['', 'TODAS'].includes(normalizarUnidade(unidade));

export const unidadesDoMentorEm = (vinculos, email) => vinculos?.[emailDe({ email })] || [];

// Ordem da lista: Admin, Mentor, Líder, Recepção; dentro do nível, por nome
export const ordenarLogins = (usuarios = []) => [...usuarios].sort((a, b) => {
    const pa = ORDEM_PAPEIS.indexOf(papelDe(a)); const pb = ORDEM_PAPEIS.indexOf(papelDe(b));
    if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
    return String(a.nome || a.email || '').localeCompare(String(b.nome || b.email || ''), 'pt-BR');
});

export const filtrarLogins = (usuarios = [], { busca = '', papel = '', unidade = '', vinculos = {} } = {}) => {
    const termo = normalizarBusca(busca);
    const unid = normalizarUnidade(unidade);
    return usuarios.filter(u => {
        if (papel && papelDe(u) !== papel) return false;
        if (unid) {
            const daPessoa = normalizarUnidade(u.unidade);
            const doMentor = papelDe(u) === 'MENTOR' ? unidadesDoMentorEm(vinculos, u.email).map(normalizarUnidade) : [];
            if (daPessoa !== unid && !doMentor.includes(unid)) return false;
        }
        if (!termo) return true;
        return normalizarBusca(u.nome).includes(termo) || emailDe(u).includes(termo);
    });
};

export const resumoLogins = (usuarios = []) => {
    const porPapel = Object.fromEntries(ORDEM_PAPEIS.map(p => [p, 0]));
    usuarios.forEach(u => { const p = papelDe(u); if (p in porPapel) porPapel[p] += 1; });
    return { total: usuarios.length, porPapel };
};

// Cada aviso: { tipo, email?, unidade? }. A tela monta o texto (traduzido) pelo tipo.
export const conferirLogins = ({ usuarios = [], unidades = [], vinculos = {} } = {}) => {
    const avisos = [];
    const porNome = new Map(unidades.filter(u => u?.nome).map(u => [normalizarUnidade(u.nome), u]));

    ordenarLogins(usuarios).forEach(u => {
        const papel = papelDe(u);
        if (papel === 'MENTOR' && unidadesDoMentorEm(vinculos, u.email).length === 0) {
            avisos.push({ tipo: 'mentor_sem_unidade', email: emailDe(u), nome: u.nome });
        }
        if ((papel === 'LIDER' || papel === 'RECEPCAO') && ehGlobal(u.unidade)) {
            avisos.push({ tipo: 'sem_unidade_propria', email: emailDe(u), nome: u.nome });
            return;
        }
        if (ehGlobal(u.unidade)) return;
        const cadastrada = porNome.get(normalizarUnidade(u.unidade));
        if (!cadastrada) avisos.push({ tipo: 'unidade_inexistente', email: emailDe(u), nome: u.nome, unidade: u.unidade });
        else if (cadastrada.ativa === false) avisos.push({ tipo: 'unidade_desativada', email: emailDe(u), nome: u.nome, unidade: cadastrada.nome });
    });

    const ativas = unidades.filter(u => u?.nome && u.ativa !== false)
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
    ativas.forEach(un => {
        const chave = normalizarUnidade(un.nome);
        const dela = usuarios.filter(u => normalizarUnidade(u.unidade) === chave);
        if (!dela.some(u => papelDe(u) === 'LIDER')) avisos.push({ tipo: 'unidade_sem_lider', unidade: un.nome });
        if (!dela.some(u => papelDe(u) === 'RECEPCAO')) avisos.push({ tipo: 'unidade_sem_recepcao', unidade: un.nome });
    });
    return avisos;
};

// Mentores que têm esta unidade marcada (Cadastros → Unidades, coluna Mentor; 09/11/2026)
export const mentoresDaUnidade = (nome, { usuarios = [], vinculos = {} } = {}) => {
    const chave = normalizarUnidade(nome);
    return ordenarLogins(usuarios.filter(u => papelDe(u) === 'MENTOR'
        && unidadesDoMentorEm(vinculos, u.email).some(n => normalizarUnidade(n) === chave)));
};

const ehSetor = (c, trecho) => normalizarUnidade(c.role || c.setor).includes(trecho);

// "Unidade pronta?" (Cadastros → Unidades, 09/11/2026, decisão do dono): o que uma unidade precisa para funcionar.
// metasPendentes = resultado de metasDaUnidade (pendencias.js): null = metas do mês preenchidas;
// metasLidas = false quando não deu para ler as metas (o item fica de fora em vez de acusar à toa).
// Cada item: { id, rotulo, ok, detalhe }. Os textos são traduzidos na tela.
export const prontidaoDaUnidade = (nome, { usuarios = [], colaboradores = [], vinculos = {}, metasPendentes = null, metasLidas = true } = {}) => {
    const chave = normalizarUnidade(nome);
    const logins = usuarios.filter(u => normalizarUnidade(u.unidade) === chave);
    const equipe = colaboradores.filter(c => normalizarUnidade(c.unidade) === chave && c.ativo !== false);
    const recepcionistas = equipe.filter(c => ehSetor(c, 'RECEP'));
    const semTurno = recepcionistas.filter(c => !c.turno);
    const mentores = mentoresDaUnidade(nome, { usuarios, vinculos });
    const faltaMetas = [metasPendentes?.start && 'Meta Start', metasPendentes?.mensal && 'Meta Mensal'].filter(Boolean);

    const itens = [
        { id: 'login_recepcao', rotulo: 'Login da Recepção', ok: logins.some(u => papelDe(u) === 'RECEPCAO') },
        { id: 'login_lider', rotulo: 'Login do Líder', ok: logins.some(u => papelDe(u) === 'LIDER') },
        { id: 'mentor', rotulo: 'Mentor vinculado', ok: mentores.length > 0, detalhe: mentores.map(m => m.nome || m.email) },
        { id: 'recepcionistas', rotulo: 'Recepcionista ativa na Equipe', ok: recepcionistas.length > 0, qtd: recepcionistas.length },
        { id: 'turno', rotulo: 'Turno (manhã/noite) das recepcionistas', ok: recepcionistas.length > 0 && semTurno.length === 0, detalhe: semTurno.map(c => c.nome) },
    ];
    if (metasLidas) itens.push({ id: 'metas', rotulo: 'Metas do mês preenchidas', ok: !metasPendentes, detalhe: faltaMetas });
    const faltam = itens.filter(i => !i.ok).length;
    return { itens, faltam, pronta: faltam === 0 };
};

// Unidades (aba de Cadastros): o que cada unidade tem ligado a ela (logins e equipe ativa)
export const resumoDaUnidade = (nome, { usuarios = [], colaboradores = [] } = {}) => {
    const chave = normalizarUnidade(nome);
    const logins = usuarios.filter(u => normalizarUnidade(u.unidade) === chave);
    const equipe = colaboradores.filter(c => normalizarUnidade(c.unidade) === chave && c.ativo !== false);
    const setor = (c) => normalizarUnidade(c.role || c.setor);
    return {
        logins: logins.length,
        lideres: logins.filter(u => papelDe(u) === 'LIDER').map(u => u.nome || u.email),
        temRecepcao: logins.some(u => papelDe(u) === 'RECEPCAO'),
        equipe: equipe.length,
        recepcionistas: equipe.filter(c => setor(c).includes('RECEP')).length,
        lideresEquipe: equipe.filter(c => setor(c).includes('LIDER')).map(c => c.nome),
    };
};
