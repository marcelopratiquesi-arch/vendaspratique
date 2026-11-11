import { createClient } from '@supabase/supabase-js';

// A URL do seu banco de dados (Project URL)
const supabaseUrl = 'https://livtoslncxrgvrvwtjpw.supabase.co';

// A sua chave PÚBLICA (Publishable key) - Nunca coloque a Secret Key aqui!
const supabaseAnonKey = 'sb_publishable_rHWR5B0R5enSblJVhn3pLg_XbgEPL1V';

// ==========================================
// ONDE O LOGIN FICA GUARDADO (12/11/2026, decisão do dono)
// - Sempre na aba (sessionStorage): o F5 não pede login de novo.
// - No computador (localStorage) SÓ quando o login é lembrado: a Recepção (computador da unidade, o dia todo) ou
//   enquanto o login com Google não está ligado (transição, igual a antes). Líder, Mentor e Admin com o Google
//   ligado: fechar o navegador = sair.
// - Ao ler, procura primeiro na aba e depois no computador (assim ninguém é deslogado no dia da mudança).
// definirLoginLembrado(true/false) é chamado pelo App depois de saber quem entrou.
// ==========================================
const MARCA_LEMBRAR = 'pratique_lembrar_login';
const ehChaveDoLogin = (k) => String(k).startsWith('sb-');
const seguro = (fn, padrao = null) => { try { return fn(); } catch { return padrao; } };
const lembrado = () => seguro(() => localStorage.getItem(MARCA_LEMBRAR) !== '0', true);

const armazenamentoDoLogin = {
    getItem: (k) => seguro(() => sessionStorage.getItem(k)) ?? seguro(() => localStorage.getItem(k)),
    setItem: (k, v) => {
        seguro(() => sessionStorage.setItem(k, v));
        if (lembrado()) seguro(() => localStorage.setItem(k, v));
        else seguro(() => localStorage.removeItem(k));
    },
    removeItem: (k) => { seguro(() => sessionStorage.removeItem(k)); seguro(() => localStorage.removeItem(k)); },
};

export const definirLoginLembrado = (lembrar) => {
    seguro(() => localStorage.setItem(MARCA_LEMBRAR, lembrar ? '1' : '0'));
    const chaves = seguro(() => Object.keys(sessionStorage).filter(ehChaveDoLogin), []);
    chaves.forEach(k => {
        if (lembrar) seguro(() => localStorage.setItem(k, sessionStorage.getItem(k)));
        else seguro(() => localStorage.removeItem(k));
    });
    if (!lembrar) seguro(() => Object.keys(localStorage).filter(ehChaveDoLogin).forEach(k => localStorage.removeItem(k)));
};

// Cria e exporta a conexão para o resto do aplicativo usar
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { storage: armazenamentoDoLogin, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Conexão separada, SÓ para criar login novo (Configurações → Acessos).
// Criar login pela conexão principal troca a sessão do navegador para a pessoa nova,
// e aí o Admin deixa de ser Admin no meio da gravação (o banco barra). Esta não guarda sessão nenhuma.
let clienteCriarLogin = null;
export const conexaoParaCriarLogin = () => {
    if (!clienteCriarLogin) {
        clienteCriarLogin = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'pratique-criar-login' }
        });
    }
    return clienteCriarLogin;
};
