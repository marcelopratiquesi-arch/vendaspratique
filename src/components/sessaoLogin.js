// ==========================================
// LOGIN GUARDADO + LUGAR DA PESSOA (decisão do dono, 09/11/2026)
// - Recarregar a página (pausa, versão nova, F5) NÃO pede a senha de novo: o login fica guardado pelo Supabase
//   no navegador e o App reabre com ele. A senha só é pedida depois de "Sair".
// - O sistema lembra a TELA e a UNIDADE do topo de cada aba do navegador (sessionStorage = some ao fechar a aba)
//   e volta para elas depois de recarregar. "Sair" esquece.
// ==========================================
import { supabase } from '../supabaseClient.js';

/** Perfil do login (usuarios_sistema), no mesmo formato que a tela de login entrega ao App. */
export async function buscarPerfilDoLogin(email) {
    const emailLimpo = String(email || '').toLowerCase().trim();
    if (!emailLimpo) return { perfil: null, erro: null };
    const { data, error } = await supabase
        .from('usuarios_sistema')
        .select('nome, role, unidade')
        .eq('email', emailLimpo)
        .single();
    if (error || !data) return { perfil: null, erro: error || null };
    return { perfil: { nome: data.nome, role: data.role, unidade: data.unidade || 'MATRIZ', email: emailLimpo }, erro: null };
}

const CHAVE_LUGAR = 'pratique_lugar';

/** Tela e unidade guardadas nesta aba, só se forem do mesmo login. */
export function lerLugarSalvo(email) {
    try {
        const lugar = JSON.parse(sessionStorage.getItem(CHAVE_LUGAR) || 'null');
        if (!lugar || lugar.email !== String(email || '').toLowerCase().trim()) return null;
        return lugar;
    } catch { return null; }
}

export function salvarLugar(email, tela, unidade) {
    try {
        sessionStorage.setItem(CHAVE_LUGAR, JSON.stringify({ email: String(email || '').toLowerCase().trim(), tela, unidade }));
    } catch { /* navegador sem acesso ao armazenamento: só não lembra */ }
}

export function esquecerLugar() {
    try { sessionStorage.removeItem(CHAVE_LUGAR); } catch { /* nada a esquecer */ }
}

// Armazenamento do computador (tema, menu, tamanho): nunca deixa o sistema cair se o navegador bloquear
export function lerLocal(chave) {
    try { return localStorage.getItem(chave); } catch { return null; }
}
export function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, String(valor)); } catch { /* bloqueado: só não guarda */ }
}
