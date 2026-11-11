// ==========================================
// ACESSO PESSOAL — conversa com o banco (12/11/2026). Funções seguras do SQL sql/2026-11-12-login-google/.
// Sem o SQL rodado, tudo cai no jeito de hoje (login com senha, sem pedidos) e avisa no console.
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { tx } from '../../i18n/traduzir.js';
import { metodoDoToken, sessaoDoToken, descreverDispositivo } from './regrasAcesso.js';

const PADRAO_CHAVES = { login_google: false, login_senha_todos: true, sessao_banco: false };
let chavesEmMemoria = null;

/** Chaves do login (sistema_config). Lidas uma vez por abertura do sistema. */
export async function carregarChavesLogin() {
    if (chavesEmMemoria) return chavesEmMemoria;
    const { data, error } = await supabase.from('sistema_config').select('chave, valor');
    if (error) {
        console.warn('Chaves do login indisponíveis (rode sql/2026-11-12-login-google): usando o login de hoje.', error.message || error);
        chavesEmMemoria = { ...PADRAO_CHAVES, semSql: true };
        return chavesEmMemoria;
    }
    const mapa = Object.fromEntries((data || []).map(l => [l.chave, String(l.valor).toLowerCase() === 'sim']));
    chavesEmMemoria = {
        login_google: mapa.login_google ?? PADRAO_CHAVES.login_google,
        login_senha_todos: mapa.login_senha_todos ?? PADRAO_CHAVES.login_senha_todos,
        sessao_banco: mapa.sessao_banco ?? PADRAO_CHAVES.sessao_banco,
        semSql: false,
    };
    return chavesEmMemoria;
}

/** Entrar com o Google: o Supabase leva para a tela do Google e volta para o sistema já logado. */
export async function entrarComGoogle() {
    return supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } },
    });
}

/** Situação de quem está logado: { perfil, pedido }. null = função ainda não existe no banco. */
export async function situacaoDoAcesso() {
    const { data, error } = await supabase.rpc('acesso_situacao');
    if (error) { console.warn('acesso_situacao indisponível:', error.message || error); return null; }
    return data || { perfil: null, pedido: null };
}

export const unidadesParaCadastro = async () => {
    const { data, error } = await supabase.rpc('acesso_unidades_para_cadastro');
    if (error) throw error;
    return (data || []).map(l => l.nome);
};

export const pedirAcesso = async ({ nome, telefone, papel, unidades }) => {
    const { data, error } = await supabase.rpc('acesso_solicitar', { p_nome: nome, p_telefone: telefone, p_papel: papel, p_unidades: unidades });
    if (error) throw error;
    return data;
};

export const aprovarPedido = async (id, papel, unidades) => {
    const { data, error } = await supabase.rpc('acesso_aprovar', { p_id: id, p_papel: papel || null, p_unidades: unidades || null });
    if (error) throw error;
    return data;
};
export const rejeitarPedido = async (id, motivo) => {
    const { error } = await supabase.rpc('acesso_rejeitar', { p_id: id, p_motivo: motivo });
    if (error) throw error;
};

export const confirmarDados = async ({ nome, telefone, telefoneEquipe }) => {
    const { data, error } = await supabase.rpc('acesso_confirmar_dados', { p_nome: nome, p_telefone: telefone, p_telefone_equipe: telefoneEquipe || null });
    if (error) throw error;
    return data || {};
};

export const painelDeAcessos = async () => {
    const { data, error } = await supabase.rpc('acesso_painel');
    if (error) { console.warn('acesso_painel indisponível:', error.message || error); return null; }
    return data;
};

export const meusAcessos = async () => {
    const { data, error } = await supabase.rpc('acesso_meus_acessos');
    if (error) throw error;
    return data || [];
};
export const avisarNaoFuiEu = async (logId, texto) => {
    const { error } = await supabase.rpc('acesso_nao_fui_eu', { p_log_id: logId, p_texto: texto || null });
    if (error) throw error;
};
export const resolverAlerta = async (id) => {
    const { error } = await supabase.rpc('acesso_resolver_alerta', { p_id: id });
    if (error) throw error;
};
// Liberação com senha (só Admin): 24 h, 3 dias ou 7 dias; 0 = encerrar. Os prazos diferentes de 24 h precisam do
// passo 6 (sql/2026-11-12-login-google/6_emergencia_ate_7_dias.sql); sem ele, 24 h usa a função antiga.
export const liberarEmergencia = async (email, horas = 24) => {
    const { data, error } = await supabase.rpc('acesso_liberar_emergencia', { p_email: email, p_horas: horas });
    if (!error) return data;
    const semPasso6 = error.code === 'PGRST202' || /could not find|schema cache/i.test(error.message || '');
    if (!semPasso6) throw error;
    if (horas === 24) {
        const antigo = await supabase.rpc('acesso_liberar_emergencia', { p_email: email });
        if (antigo.error) throw antigo.error;
        return antigo.data;
    }
    throw new Error(tx('Para liberar por mais de 24 horas (ou encerrar), rode no Supabase o passo 6 de sql/2026-11-12-login-google.'));
};
export const definirLider = async (unidade, email) => {
    const { error } = await supabase.rpc('acesso_definir_lider', { p_unidade: unidade, p_email: email });
    if (error) throw error;
};
export const mudarSituacao = async (email, status, motivo) => {
    const { error } = await supabase.rpc('acesso_mudar_situacao', { p_email: email, p_status: status, p_motivo: motivo || null });
    if (error) throw error;
};

// ---------- Registro do login e da atividade ----------
const CHAVE_REGISTRADO = 'pratique_login_registrado';

/** Método (google/senha) e sessão do login atual, lidos do token. */
export async function dadosDoLoginAtual() {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return { metodo: token ? metodoDoToken(token) : 'desconhecido', sessao: token ? sessaoDoToken(token) : null };
}

/** Registra o login UMA vez por sessão (F5 não registra de novo). Nunca impede a entrada. */
export async function registrarLoginUmaVez() {
    try {
        const { metodo, sessao } = await dadosDoLoginAtual();
        let jaRegistrado = null;
        try { jaRegistrado = sessionStorage.getItem(CHAVE_REGISTRADO); } catch { /* sem armazenamento */ }
        if (sessao && jaRegistrado === sessao) { await supabase.rpc('acesso_atividade'); return metodo; }
        const { error } = await supabase.rpc('acesso_registrar_login', { p_metodo: metodo, p_dispositivo: descreverDispositivo(navigator.userAgent) });
        if (error) { console.warn('Login não registrado (rode sql/2026-11-12-login-google):', error.message || error); return metodo; }
        try { if (sessao) sessionStorage.setItem(CHAVE_REGISTRADO, sessao); } catch { /* sem armazenamento */ }
        return metodo;
    } catch (e) {
        console.warn('Login não registrado:', e?.message || e);
        return 'desconhecido';
    }
}

let ultimaBatida = 0;
/** "Estou ativo" no banco, no máximo a cada 5 minutos. */
export function baterAtividade(minutos = 5) {
    const agora = Date.now();
    if (agora - ultimaBatida < minutos * 60 * 1000) return;
    ultimaBatida = agora;
    supabase.rpc('acesso_atividade').then(({ error }) => { if (error) console.warn('acesso_atividade:', error.message || error); });
}

export function registrarEvento(evento, detalhe) {
    return supabase.rpc('acesso_registrar_evento', { p_evento: evento, p_detalhe: detalhe || null }).then(({ error }) => {
        if (error) console.warn('Evento de acesso não registrado:', error.message || error);
    });
}

export function esquecerRegistroDoLogin() {
    try { sessionStorage.removeItem(CHAVE_REGISTRADO); } catch { /* nada */ }
}
