// ==========================================
// ACESSO PESSOAL COM GOOGLE — regras SEM banco (12/11/2026, decisão do dono). Testável: node scripts/teste-acesso.mjs
// - Líder e Mentor entram com o próprio Google; pedem acesso; o Mentor (só Líder das unidades dele) ou o Admin aprova.
// - Recepção entra com o Google no e-mail da franquia (o mesmo do login da unidade), sem pedido nem confirmação.
// - Líder, Mentor e Admin: telefone obrigatório e confirmação dos dados a cada 30 dias; sessão de 15 min parado.
//   Recepção: cortina de 30 min (como antes).
// ==========================================

export const DIAS_RECONFIRMAR = 30;
export const DIAS_SEM_ACESSO_GRAVE = 7;
export const MINUTOS_SESSAO = 15;           // Líder, Mentor e Admin
export const MINUTOS_ENTRE_BATIDAS = 5;     // "estou ativo" gravado no banco no máximo a cada 5 min
export const PAPEIS_COM_DADOS = ['LIDER', 'MENTOR', 'ADMIN'];

const soNumeros = (t) => String(t || '').replace(/\D/g, '');

// Telefone com DDI: 12 a 15 números (Brasil: 55 + DDD + número = 12 ou 13)
export const telefoneValido = (tel) => { const n = soNumeros(tel); return n.length >= 12 && n.length <= 15; };
// Junta o DDI escolhido com o número digitado (se a pessoa já digitou o 55 na frente, não repete)
export const juntarTelefone = (ddi, numero) => {
    const d = soNumeros(ddi) || '55';
    const n = soNumeros(numero);
    return n.startsWith(d) && n.length >= d.length + 10 ? n : `${d}${n}`;
};
// Telefone do jeito da Equipe (sem o 55): (31) 99751-4508. Fora do Brasil fica +DDI número.
export const telefoneParaEquipe = (tel) => {
    const n = soNumeros(tel);
    if (n.startsWith('55') && (n.length === 12 || n.length === 13)) {
        const l = n.slice(2);
        return l.length === 11 ? `(${l.slice(0, 2)}) ${l.slice(2, 7)}-${l.slice(7)}` : `(${l.slice(0, 2)}) ${l.slice(2, 6)}-${l.slice(6)}`;
    }
    return n ? `+${n}` : '';
};
export const telefoneBonito = (tel) => {
    const n = soNumeros(tel);
    if (!n) return '';
    if (n.startsWith('55') && (n.length === 12 || n.length === 13)) return `+55 ${telefoneParaEquipe(n)}`;
    return `+${n}`;
};

export const normalizarEmail = (e) => String(e || '').trim().toLowerCase();

// Precisa confirmar os dados? (Líder/Mentor/Admin; sem telefone, nunca confirmou ou há mais de 30 dias)
export const precisaConfirmarDados = (perfil, agora = new Date()) => {
    if (!perfil || !PAPEIS_COM_DADOS.includes(String(perfil.role || '').toUpperCase())) return false;
    if (perfil.status === undefined) return false; // banco ainda sem o passo 1 do SQL de 12/11/2026
    if (!telefoneValido(perfil.telefone)) return true;
    if (!perfil.dados_confirmados_em) return true;
    return (agora - new Date(perfil.dados_confirmados_em)) / 86400000 > DIAS_RECONFIRMAR;
};

// O que mostrar depois que a pessoa entrou (situacao = resposta de acesso_situacao)
//   ativo · inativo · aguardando · rejeitado · cadastro (pedir acesso)
export const situacaoDaEntrada = (situacao) => {
    const perfil = situacao?.perfil || null;
    const pedido = situacao?.pedido || null;
    if (perfil && String(perfil.status || 'ATIVO').toUpperCase() === 'ATIVO') return 'ativo';
    if (pedido?.status === 'AGUARDANDO_APROVACAO') return 'aguardando';
    if (perfil && String(perfil.status).toUpperCase() === 'INATIVO') return 'inativo';
    if (pedido?.status === 'REJEITADO') return 'rejeitado';
    return 'cadastro';
};

// Login com senha depois da virada: só Admin ou quem tem a liberação de emergência de 24 h
export const senhaLiberada = ({ perfil, senhaParaTodos, agora = new Date() }) => {
    if (senhaParaTodos) return true;
    if (String(perfil?.role || '').toUpperCase() === 'ADMIN') return true;
    return !!perfil?.emergencia_ate && new Date(perfil.emergencia_ate) > agora;
};

// Método do login pelo "crachá" do Supabase (o token): oauth = Google, password = senha
export const metodoDoToken = (accessToken) => {
    try {
        const corpo = JSON.parse(atob(String(accessToken).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const m = corpo?.amr?.[0]?.method;
        return m === 'oauth' ? 'google' : m === 'password' ? 'senha' : (m || 'desconhecido');
    } catch { return 'desconhecido'; }
};
export const sessaoDoToken = (accessToken) => {
    try { return JSON.parse(atob(String(accessToken).split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))?.session_id || null; } catch { return null; }
};

// Navegador e aparelho em texto curto (para o histórico de acessos)
export const descreverDispositivo = (ua = '') => {
    const s = String(ua);
    const nav = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Chrome\//.test(s) ? 'Chrome' : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'Navegador';
    const sis = /Android/.test(s) ? 'Android' : /iPhone|iPad/.test(s) ? 'iPhone' : /Windows/.test(s) ? 'Windows' : /Mac OS/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : '';
    return [nav, sis].filter(Boolean).join(' · ');
};

const diasDesde = (quando, agora) => (quando ? Math.floor((agora - new Date(quando)) / 86400000) : null);

// Contas da seção "Acessos" da aba Pendências (painel = resposta de acesso_painel)
export const montarPainelAcessos = ({ painel, unidades = [], agora = new Date() }) => {
    const logins = (painel?.logins || []).filter(l => String(l.status || 'ATIVO').toUpperCase() === 'ATIVO');
    const comDados = logins.filter(l => PAPEIS_COM_DADOS.includes(String(l.role || '').toUpperCase()));
    const semAcesso = logins
        .map(l => ({ ...l, dias: diasDesde(l.ultimo_login, agora), nunca: !l.ultimo_login }))
        .filter(l => l.nunca || l.dias >= DIAS_SEM_ACESSO_GRAVE)
        .sort((a, b) => (b.nunca - a.nunca) || (b.dias - a.dias));
    // Líder da unidade = login de nível Líder ativo OU quem foi marcado como líder (ex.: o Admin na SANTA INES 2).
    // painel.lideres vem do banco (passo 5 do SQL); sem ele, vale só o login de nível Líder.
    const lideresPorUnidade = new Map();
    (painel?.lideres || []).forEach(l => { const k = String(l.unidade || '').trim().toUpperCase(); if (!lideresPorUnidade.has(k)) lideresPorUnidade.set(k, []); lideresPorUnidade.get(k).push(l); });
    logins.filter(l => String(l.role || '').toUpperCase() === 'LIDER').forEach(l => {
        const k = String(l.unidade || '').trim().toUpperCase();
        if (!lideresPorUnidade.has(k)) lideresPorUnidade.set(k, []);
        if (!lideresPorUnidade.get(k).some(x => normalizarEmail(x.email) === normalizarEmail(l.email))) lideresPorUnidade.get(k).push(l);
    });
    const nomesUnidades = unidades.map(u => String(u?.nome || u || '').trim().toUpperCase()).filter(Boolean);
    const unidadesSemLider = nomesUnidades.filter(u => !(lideresPorUnidade.get(u) || []).length);
    const lideres = nomesUnidades.map(u => ({ unidade: u, lideres: lideresPorUnidade.get(u) || [] }));
    const naoConfirmados = comDados.filter(l => precisaConfirmarDados({ ...l, status: 'ATIVO' }, agora));
    // Adesão ao login novo: Líder/Recepção ativos que ainda não entraram pelo Google
    const semGoogle = logins.filter(l => ['LIDER', 'RECEPCAO'].includes(String(l.role || '').toUpperCase()) && l.ultimo_metodo !== 'google');
    return {
        pedidos: painel?.pedidos || [],
        trocas: (painel?.pedidos || []).filter(p => p.tipo === 'TROCA_LIDER'),
        semAcesso,
        graves: semAcesso.length,
        unidadesSemLider,
        lideres,
        recentes: painel?.recentes || [],
        naoConfirmados,
        alertas: painel?.alertas || [],
        semGoogle,
        total: (painel?.pedidos || []).length + semAcesso.length + unidadesSemLider.length + naoConfirmados.length + (painel?.alertas || []).length,
    };
};
