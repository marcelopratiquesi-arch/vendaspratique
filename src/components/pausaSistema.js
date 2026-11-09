// ==========================================
// PAUSA POR INATIVIDADE (decisão do dono, 07/11/2026)
// Depois de 30 minutos sem uso o sistema PAUSA DE VERDADE: desliga o "ao vivo" do banco (realtime), para as
// releituras automáticas e a renovação do login. Assim um computador esquecido aberto não fica gastando banco.
// Voltar = recarregar SEMPRE na versão mais nova publicada (sem reaproveitar a página antiga guardada pelo
// navegador). Quem estava parado e saiu versão nova é recarregado sozinho (AvisoVersaoNova).
// ==========================================
import { supabase } from '../supabaseClient.js';

export const MINUTOS_PARA_PAUSAR = 30;
export const SEGUNDOS_DE_AVISO = 60; // cartão com contagem regressiva antes de pausar
export const EVENTO_PAUSA = 'sistema-pausado';

let pausado = false;

/** true enquanto a cortina de inatividade está na tela: releituras automáticas não devem ir ao banco. */
export const sistemaPausado = () => pausado;

/** Pausa: desliga tudo que fala com o banco sozinho. A volta é sempre recarregando a página. */
export function pausarSistema() {
    if (pausado) return;
    pausado = true;
    try { supabase.removeAllChannels(); } catch { /* nada a desligar */ }
    try { supabase.realtime?.disconnect?.(); } catch { /* já desligado */ }
    try { supabase.auth.stopAutoRefresh?.(); } catch { /* versão antiga da biblioteca */ }
    window.dispatchEvent(new Event(EVENTO_PAUSA));
}

/**
 * Recarrega garantindo a versão mais nova: limpa caches do navegador (se houver), força o navegador a baixar de
 * novo a página inicial e abre o endereço com uma marca de tempo (o navegador não pode reaproveitar a antiga).
 */
let recarregando = false;
export async function recarregarNaVersaoMaisNova() {
    if (recarregando) return; // já está recarregando (ex.: "Sair" e o aviso de login encerrado juntos)
    recarregando = true;
    try {
        if (window.caches?.keys) {
            const chaves = await window.caches.keys();
            await Promise.all(chaves.map(c => window.caches.delete(c)));
        }
    } catch { /* sem cache para limpar */ }
    try {
        const regs = await navigator.serviceWorker?.getRegistrations?.();
        await Promise.all((regs || []).map(r => r.unregister()));
    } catch { /* sem service worker */ }
    try {
        await Promise.all([
            fetch('/', { cache: 'reload' }),
            fetch('/index.html', { cache: 'reload' }),
        ]);
    } catch { /* sem internet: recarrega assim mesmo */ }
    const url = new URL(window.location.href);
    url.searchParams.set('atualizado', String(Date.now()));
    window.location.replace(url.toString());
}

/** Ao abrir: tira a marca "?atualizado=" do endereço (só serviu para furar o cache). */
export function limparMarcaDeAtualizacao() {
    try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has('atualizado')) return;
        url.searchParams.delete('atualizado');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    } catch { /* endereço estranho: deixa como está */ }
}
