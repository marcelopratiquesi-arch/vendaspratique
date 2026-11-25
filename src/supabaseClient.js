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
// APP NO CELULAR (25/11/2026, decisão do dono): aberto pelo ícone, o login fica SEMPRE guardado no celular (fechar o
// app não sai; o App.jsx corta depois de 12 horas, components/appInstalado.js). O app usa uma chave própria
// ('sb-app-...'), porque no Android o app e o Chrome dividem o mesmo armazenamento: assim o login do app não vaza
// para o navegador (que continua saindo ao fechar) e o navegador não apaga o do app.
const MARCA_LEMBRAR = 'pratique_lembrar_login';
const CHAVE_LOGIN_APP = 'sb-app-pratique-auth';
const seguro = (fn, padrao = null) => { try { return fn(); } catch { return padrao; } };
const NO_APP = seguro(() => Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true), false);
const ehChaveDoLogin = (k) => String(k).startsWith('sb-') && (NO_APP ? String(k).startsWith(CHAVE_LOGIN_APP) : !String(k).startsWith(CHAVE_LOGIN_APP));
const lembrado = () => NO_APP || seguro(() => localStorage.getItem(MARCA_LEMBRAR) !== '0', true);

const armazenamentoDoLogin = {
    getItem: (k) => seguro(() => sessionStorage.getItem(k)) ?? seguro(() => localStorage.getItem(k)),
    setItem: (k, v) => {
        seguro(() => sessionStorage.setItem(k, v));
        if (lembrado()) seguro(() => localStorage.setItem(k, v));
        else seguro(() => localStorage.removeItem(k));
    },
    removeItem: (k) => { seguro(() => sessionStorage.removeItem(k)); seguro(() => localStorage.removeItem(k)); },
};

export const definirLoginLembrado = (pedido) => {
    const lembrar = NO_APP || pedido;
    if (!NO_APP) seguro(() => localStorage.setItem(MARCA_LEMBRAR, lembrar ? '1' : '0'));
    const chaves = seguro(() => Object.keys(sessionStorage).filter(ehChaveDoLogin), []);
    chaves.forEach(k => {
        if (lembrar) seguro(() => localStorage.setItem(k, sessionStorage.getItem(k)));
        else seguro(() => localStorage.removeItem(k));
    });
    if (!lembrar) seguro(() => Object.keys(localStorage).filter(ehChaveDoLogin).forEach(k => localStorage.removeItem(k)));
};

// Cria e exporta a conexão para o resto do aplicativo usar
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: armazenamentoDoLogin, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
        ...(NO_APP ? { storageKey: CHAVE_LOGIN_APP } : {}),
    },
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
