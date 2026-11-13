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

// ==========================================
// ASPIRA E ACESSO TEMPORÁRIO (13/11/2026, decisão do dono; SQL sql/2026-11-13-aspira-temporario/)
// - Cada unidade tem até 2 líderes fixos: o LÍDER (posto TITULAR) e o ASPIRA. Os dois são nível LIDER (mesmas
//   permissões); trocar um não mexe no outro.
// - Acesso temporário (quem cobre férias/ausência): Líder ou Mentor, 1 ou várias unidades, com data para acabar.
//   Só SOMA ao acesso fixo da pessoa (nunca troca). Só vale com login pelo Google. O banco corta no fim do prazo.
// - Datas sempre no horário de Brasília; hoje conta como dia 1 (dia 13 + 10 dias = até o dia 22, 23:59).
// ==========================================
export const POSTOS = { TITULAR: 'Líder', ASPIRA: 'Aspira' };
export const postoDe = (l) => (String(l?.posto || '').toUpperCase() === 'ASPIRA' ? 'ASPIRA' : 'TITULAR');
export const PRAZOS_TEMPORARIO = [
    ['10d', '10 dias'], ['15d', '15 dias'], ['30d', '30 dias'], ['40d', '40 dias'],
    ['2m', '2 meses'], ['3m', '3 meses'], ['6m', '6 meses'], ['data', 'Escolher data'],
];
export const DIAS_AVISO_TEMPORARIO = [7, 3, 1];
const RANK_PAPEL = { ADMIN: 4, MENTOR: 3, LIDER: 2, RECEPCAO: 1 };

/** Hoje (AAAA-MM-DD) no horário de Brasília. */
export const hojeEmBrasilia = (agora = new Date()) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);

const paraData = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
const paraIso = (d) => d.toISOString().slice(0, 10);
export const somarDiasIso = (iso, n) => { const d = paraData(iso); d.setUTCDate(d.getUTCDate() + n); return paraIso(d); };
// Igual ao banco (data + "N meses"): se o dia não existe no mês final, fica no último dia do mês
export const somarMesesIso = (iso, n) => {
    const d = paraData(iso);
    const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d.getUTCDate(), ultimo));
    return paraIso(alvo);
};
export const diasEntreIso = (de, ate) => Math.round((paraData(ate) - paraData(de)) / 86400000);

/** "Vale até" (mesma conta do banco, acesso_calcular_vale_ate). base = 1º dia (conta como dia 1). null = inválido. */
export const calcularValeAte = (prazo, base, dataEscolhida = null) => {
    if (!base) return null;
    const dias = { '10d': 10, '15d': 15, '30d': 30, '40d': 40 }[prazo];
    const meses = { '2m': 2, '3m': 3, '6m': 6 }[prazo];
    let fim = null;
    if (dias) fim = somarDiasIso(base, dias - 1);
    else if (meses) fim = somarDiasIso(somarMesesIso(base, meses), -1);
    else if (prazo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(String(dataEscolhida || ''))) fim = dataEscolhida;
    if (!fim) return null;
    const maximo = somarDiasIso(somarMesesIso(base, 6), -1);
    if (fim < base || fim > maximo) return null;
    return fim;
};

/** Temporários que estão valendo para quem entrou (só login pelo Google: com senha não valem). */
export const temporariosValendo = (situacao, metodo) => {
    if (metodo === 'senha') return [];
    const hoje = situacao?.hoje || hojeEmBrasilia();
    return (situacao?.temporarios || []).filter(t => t && (!t.vale_ate || String(t.vale_ate) >= String(hoje)));
};

/**
 * Perfil que vale de verdade: o acesso fixo (se ativo) SOMADO aos temporários. Fica com o papel maior;
 * Líder com mais de uma unidade (fixa + temporárias, ou várias temporárias) ganha a lista em unidadesLider.
 * null = sem acesso nenhum.
 */
export const perfilEfetivo = (situacao, metodo) => {
    const perfil = situacao?.perfil || null;
    const fixo = perfil && String(perfil.status || 'ATIVO').toUpperCase() === 'ATIVO' ? perfil : null;
    const temps = temporariosValendo(situacao, metodo);
    if (!fixo && !temps.length) return null;
    const papelFixo = String(fixo?.role || '').toUpperCase();
    let role = papelFixo;
    temps.forEach(t => { const tp = String(t.tipo || '').toUpperCase(); if ((RANK_PAPEL[tp] || 0) > (RANK_PAPEL[role] || 0)) role = tp; });
    const maiusc = (u) => String(u || '').trim().toUpperCase();
    const unidadesTemporarias = [...new Set(temps.flatMap(t => t.unidades || []).map(maiusc).filter(Boolean))];
    const unidadeFixa = fixo && ['LIDER', 'RECEPCAO'].includes(papelFixo) && maiusc(fixo.unidade) && maiusc(fixo.unidade) !== 'TODAS' ? maiusc(fixo.unidade) : null;
    const unidadesLider = role === 'LIDER' ? [...new Set([unidadeFixa, ...unidadesTemporarias].filter(Boolean))] : null;
    return {
        ...(fixo || {}),
        email: fixo?.email || perfil?.email || '',
        nome: fixo?.nome || temps[0]?.nome || '',
        telefone: fixo?.telefone || temps[0]?.telefone || '',
        status: 'ATIVO',
        role,
        unidade: role === 'LIDER' ? (unidadeFixa || unidadesLider[0]) : (fixo?.unidade || 'TODAS'),
        posto: role === 'LIDER' && papelFixo === 'LIDER' ? postoDe(fixo) : null,
        unidadesLider,
        unidadesTemporarias,
        temporarios: temps,
        somenteTemporario: !fixo,
        roleFixo: papelFixo || null, // papel do acesso fixo (o temporário não dá poder de liberar/aprovar acessos)
    };
};

/** O que muda o acesso (papel + unidades). Se mudar, a tela recarrega com o acesso novo. */
export const assinaturaDoAcesso = (p) => (p ? `${String(p.role || '').toUpperCase()}|${[...(p.unidadesLider || []), ...(p.unidadesTemporarias || [])].map(u => String(u).toUpperCase()).sort().join(',')}` : '');

/** Dias até vencer (0 = vence hoje, à meia-noite). */
export const diasParaVencer = (t, hoje = hojeEmBrasilia()) => (t?.vale_ate ? diasEntreIso(hoje, t.vale_ate) : null);
/** Marco do aviso de vencimento (7, 3, 1 ou 0 = hoje) ou null. */
export const marcoDoAviso = (dias) => (dias === null || dias === undefined || dias > 7 ? null : dias <= 0 ? 0 : dias <= 1 ? 1 : dias <= 3 ? 3 : 7);
export const dataBr = (iso) => { const s = String(iso || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—'; };

// Precisa confirmar os dados? (Líder/Mentor/Admin; sem telefone, nunca confirmou ou há mais de 30 dias)
// Quem só tem acesso temporário não confirma (o WhatsApp foi informado na liberação e não há login fixo para gravar).
export const precisaConfirmarDados = (perfil, agora = new Date()) => {
    if (!perfil || perfil.somenteTemporario || !PAPEIS_COM_DADOS.includes(String(perfil.role || '').toUpperCase())) return false;
    if (perfil.status === undefined) return false; // banco ainda sem o passo 1 do SQL de 12/11/2026
    if (!telefoneValido(perfil.telefone)) return true;
    if (!perfil.dados_confirmados_em) return true;
    return (agora - new Date(perfil.dados_confirmados_em)) / 86400000 > DIAS_RECONFIRMAR;
};

// O que mostrar depois que a pessoa entrou (situacao = resposta de acesso_situacao)
//   ativo · inativo · aguardando · rejeitado · cadastro (pedir acesso)
export const situacaoDaEntrada = (situacao, metodo) => {
    const perfil = situacao?.perfil || null;
    const pedido = situacao?.pedido || null;
    if (perfil && String(perfil.status || 'ATIVO').toUpperCase() === 'ATIVO') return 'ativo';
    if (temporariosValendo(situacao, metodo).length) return 'ativo'; // acesso temporário (13/11/2026)
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
export const montarPainelAcessos = ({ painel, unidades = [], agora = new Date(), temporarios = null }) => {
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
    // Acessos temporários (acesso_temp_listar; null = SQL de 13/11/2026 ainda não rodado)
    const listaTemp = temporarios || [];
    const tempAtivos = listaTemp.filter(t => t.situacao === 'ATIVO');
    const tempVencendo = tempAtivos.filter(t => Number(t.dias_para_vencer) <= 7);
    const tempPorUnidade = new Map();
    tempAtivos.forEach(t => (t.unidades || []).forEach(u => {
        const k = String(u || '').trim().toUpperCase();
        if (!tempPorUnidade.has(k)) tempPorUnidade.set(k, []);
        tempPorUnidade.get(k).push(t);
    }));
    return {
        temporarios: listaTemp,
        tempAtivos,
        tempVencendo,
        tempPorUnidade,
        temporariosSemSql: temporarios === null,
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
