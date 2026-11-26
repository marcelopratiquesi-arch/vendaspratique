/* global process */
// ==========================================
// AVISOS NO CELULAR — o servidor que envia (25/11/2026, decisão do dono). Roda na Vercel.
// Quem pode: só quem tem a permissão 913 (o Admin). QUEM CONFERE É O BANCO: o servidor chama as funções seguras
// com o login da própria pessoa (push_destinatarios recusa quem não tem a permissão). Nenhuma chave do banco
// fica aqui além da pública do site.
// Chave secreta: variável VAPID_PRIVATE_KEY na Vercel (nunca no código, no chat ou no GitHub).
// Pedido (POST, JSON): { titulo, texto, link?, destino, destinoResumo?, somenteContar?, comunicadoId? }
//   somenteContar = true: só devolve quantos recebem e quem ainda não ativou (a janela de conferência).
// ==========================================
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import { validarAviso, separarDestinatarios, montarMensagem, aparelhoMorto } from './_avisos.js';

const SUPABASE_URL = 'https://livtoslncxrgvrvwtjpw.supabase.co';
const SUPABASE_CHAVE_PUBLICA = 'sb_publishable_rHWR5B0R5enSblJVhn3pLg_XbgEPL1V';
export const VAPID_PUBLICA = 'BMZVL4NOtX2JaDD2gFysKB8RPZC3x96aOt39dxLgduwo8VfWXcyUIvz-7x3_kFOJLLwuaZpepVyCXSm8KoVPMZc';
const CONTATO = 'https://vendaspratique.vercel.app';

const lerCorpo = (req) => {
    if (req.body && typeof req.body === 'object') return req.body;
    try { return JSON.parse(req.body || '{}'); } catch { return null; }
};

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST.' });

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ erro: 'Entre no sistema para enviar aviso.' });

    const corpo = lerCorpo(req);
    if (!corpo) return res.status(400).json({ erro: 'Pedido inválido.' });
    const erroDeCampo = validarAviso(corpo);
    if (erroDeCampo) return res.status(400).json({ erro: erroDeCampo });

    // Conexão com o login da PRÓPRIA pessoa: o banco decide o que ela pode
    const banco = createClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: linhas, error } = await banco.rpc('push_destinatarios', { p_destino: corpo.destino });
    if (error) {
        const msg = String(error.message || '');
        if (/permiss/i.test(msg)) return res.status(403).json({ erro: 'Só o administrador envia avisos no celular.' });
        if (/push_destinatarios|function|schema cache/i.test(msg)) return res.status(500).json({ erro: 'O banco ainda não tem os avisos no celular (rode sql/2026-11-25-avisos-celular/1_avisos_celular.sql).' });
        return res.status(500).json({ erro: `Não consegui ler os destinatários: ${msg}` });
    }
    const { pessoas, aparelhos, semAparelho } = separarDestinatarios(linhas);

    if (corpo.somenteContar) return res.status(200).json({ pessoas, aparelhos: aparelhos.length, semAparelho });

    const privada = process.env.VAPID_PRIVATE_KEY;
    if (!privada) return res.status(500).json({ erro: 'O servidor ainda não tem a chave secreta dos avisos (VAPID_PRIVATE_KEY na Vercel).' });
    try {
        webpush.setVapidDetails(CONTATO, VAPID_PUBLICA, privada.trim());
    } catch {
        return res.status(500).json({ erro: 'A chave secreta dos avisos na Vercel está errada.' });
    }

    const mensagem = montarMensagem(corpo);
    const resultados = await Promise.allSettled(aparelhos.map(a =>
        webpush.sendNotification({ endpoint: a.endpoint, keys: a.keys }, mensagem, { TTL: 24 * 60 * 60, urgency: 'high' })));
    let entregues = 0;
    const mortos = [];
    resultados.forEach((r, i) => {
        if (r.status === 'fulfilled') entregues += 1;
        else if (aparelhoMorto(r.reason?.statusCode)) mortos.push(aparelhos[i].endpoint);
    });
    const falhas = aparelhos.length - entregues;
    if (mortos.length) await banco.rpc('push_remover_aparelhos', { p_endpoints: mortos });

    const { error: erroHist } = await banco.rpc('push_registrar_envio', {
        p_titulo: String(corpo.titulo).trim(),
        p_texto: String(corpo.texto).trim(),
        p_link: corpo.link || null,
        p_destino: corpo.destino,
        p_resumo: corpo.destinoResumo || null,
        p_pessoas: pessoas,
        p_aparelhos: aparelhos.length,
        p_entregues: entregues,
        p_falhas: falhas,
        p_sem_aparelho: semAparelho,
        p_comunicado_id: corpo.comunicadoId ? String(corpo.comunicadoId) : null,
    });

    return res.status(200).json({ pessoas, aparelhos: aparelhos.length, entregues, falhas, removidos: mortos.length, semAparelho, historicoGravado: !erroHist });
}
