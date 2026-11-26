// ==========================================
// AVISOS NO CELULAR — regras sem banco (25/11/2026). Usadas pelo servidor (api/enviar-aviso.js) e pelo teste
// scripts/teste-avisos-celular.mjs. Arquivo com "_" na frente: a Vercel NÃO o publica como endereço.
// ==========================================
export const LIMITE_TITULO = 60;
export const LIMITE_TEXTO = 240;
const TIPOS = ['todos', 'filtro', 'pessoas', 'comunicado'];

/** Confere o pedido. Devolve o texto do erro ou null. */
export function validarAviso(corpo) {
    const titulo = String(corpo?.titulo || '').trim();
    const texto = String(corpo?.texto || '').trim();
    if (!titulo) return 'Escreva o título do aviso.';
    if (titulo.length > LIMITE_TITULO) return `O título passa de ${LIMITE_TITULO} letras.`;
    if (!texto) return 'Escreva o texto do aviso.';
    if (texto.length > LIMITE_TEXTO) return `O texto passa de ${LIMITE_TEXTO} letras.`;
    const link = corpo?.link;
    if (link && (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//'))) return 'Tela para abrir inválida.';
    const destino = corpo?.destino;
    if (!destino || !TIPOS.includes(destino.tipo)) return 'Escolha para quem vai o aviso.';
    if (destino.tipo === 'pessoas' && !(Array.isArray(destino.emails) && destino.emails.length)) return 'Escolha pelo menos uma pessoa.';
    if (destino.tipo === 'comunicado' && !destino.id) return 'Comunicado sem número.';
    return null;
}

/**
 * Junta as linhas do banco (uma por aparelho; quem não tem aparelho vem com endpoint vazio) em:
 * pessoas (diferentes), aparelhos (com os dados para enviar) e semAparelho (quem ainda não ativou).
 */
export function separarDestinatarios(linhas) {
    const pessoas = new Map();
    const aparelhos = [];
    const vistos = new Set();
    for (const l of linhas || []) {
        const email = String(l.email || '').trim().toLowerCase();
        if (!email) continue;
        if (!pessoas.has(email)) pessoas.set(email, { email, nome: l.nome || '', papel: l.papel || '', unidade: l.unidade || '', aparelhos: 0 });
        if (l.endpoint && l.p256dh && l.auth && !vistos.has(l.endpoint)) {
            vistos.add(l.endpoint);
            aparelhos.push({ email, endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } });
            pessoas.get(email).aparelhos += 1;
        }
    }
    const lista = [...pessoas.values()];
    const semAparelho = lista.filter(p => p.aparelhos === 0)
        .map(({ email, nome, papel, unidade }) => ({ email, nome, papel, unidade }))
        .sort((a, b) => String(a.unidade).localeCompare(String(b.unidade)) || String(a.nome).localeCompare(String(b.nome)));
    return { pessoas: lista.length, aparelhos, semAparelho };
}

/** O que vai dentro do aviso (o celular mostra título e texto; ao tocar, abre o link). */
export function montarMensagem(corpo) {
    return JSON.stringify({
        titulo: String(corpo.titulo).trim(),
        texto: String(corpo.texto).trim(),
        link: corpo.link || '/',
    });
}

/** Aparelho que não existe mais (o serviço do celular responde 404 ou 410): sai da lista. */
export const aparelhoMorto = (statusCode) => statusCode === 404 || statusCode === 410;
