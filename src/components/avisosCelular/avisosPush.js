// ==========================================
// AVISOS NO CELULAR — o lado do aparelho (25/11/2026, decisão do dono; regra 28 do CLAUDE.md)
// Ativar = pedir licença ao aparelho, criar o "endereço" dele (inscrição) e guardar no banco
// (push_registrar_aparelho) com o login de quem está usando. Sair = soltar o aparelho do login.
// Quem já deu licença tem o aparelho religado sozinho a cada entrada (outra pessoa no mesmo celular passa a
// receber os avisos DELA). Não existe botão de desligar (decisão do dono: ninguém ignora os avisos).
// Modo (sistema_config.avisos_celular): 'teste' = só o Admin vê a faixa | 'ligado' = todos | 'desligado'.
// ==========================================
import { supabase } from '../../supabaseClient.js';
import { ehAppInstalado } from '../appInstalado.js';

export const VAPID_PUBLICA = 'BMZVL4NOtX2JaDD2gFysKB8RPZC3x96aOt39dxLgduwo8VfWXcyUIvz-7x3_kFOJLLwuaZpepVyCXSm8KoVPMZc';
export const EVENTO_AVISOS_ATIVADOS = 'pratique-avisos-ativados';

const seguro = async (fn, padrao = null) => { try { return await fn(); } catch { return padrao; } };

// Cada etapa da ativação tem um limite de tempo (26/11/2026: no Android o botão ficou rodando para sempre).
// Passou do limite = erro com o nome da etapa, para a tela dizer onde travou.
const comPrazo = (promessa, segundos, mensagem) => Promise.race([
    promessa,
    new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error(mensagem)), segundos * 1000)),
]);
export const ERRO_PERGUNTA_NAO_APARECEU = 'O celular não mostrou a pergunta de licença.';

export const ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
export const navegadorAceitaAvisos = () =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Situação deste aparelho:
 * 'instalar'    = iPhone fora do app (o iPhone só recebe avisos com o app instalado na tela de início)
 * 'sem_suporte' = navegador que não recebe avisos
 * 'bloqueado'   = a pessoa negou a licença (só libera nas configurações do aparelho)
 * 'ativar'      = falta tocar em "Ativar avisos"
 * 'ativo'       = recebendo
 */
export async function situacaoDoAparelho() {
    if (ehIphone() && !ehAppInstalado()) return 'instalar';
    if (!navegadorAceitaAvisos()) return 'sem_suporte';
    if (Notification.permission === 'denied') return 'bloqueado';
    if (Notification.permission !== 'granted') return 'ativar';
    const inscricao = await seguro(async () => (await registroDoAjudante())?.pushManager.getSubscription());
    if (!inscricao) return 'ativar';
    const { data, error } = await supabase.from('push_aparelhos').select('id').eq('endpoint', inscricao.endpoint).limit(1);
    if (error) return 'ativo'; // banco sem o SQL: não insiste
    return data?.length ? 'ativo' : 'ativar';
}

async function registroDoAjudante() {
    if (!('serviceWorker' in navigator)) return null;
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
    if (reg.active) return reg;
    return comPrazo(navigator.serviceWorker.ready, 15, 'O ajudante do aparelho não ligou. Feche o app e abra de novo.');
}

const chaveEmBytes = (base64) => {
    const preenchido = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bruto = atob(preenchido.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...bruto].map(c => c.charCodeAt(0)));
};

const descreverAparelho = () => {
    const ua = navigator.userAgent || '';
    const sistema = /iphone|ipad/i.test(ua) ? 'iPhone' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Outro';
    return `${sistema}${ehAppInstalado() ? ' · app' : ' · navegador'}`;
};

async function guardarInscricao(inscricao) {
    const json = inscricao.toJSON();
    const { error } = await comPrazo(supabase.rpc('push_registrar_aparelho', {
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth, p_dispositivo: descreverAparelho(),
    }), 20, 'O banco demorou para guardar o aparelho. Tente de novo.');
    if (error) throw new Error(error.message || 'Não foi possível guardar o aparelho.');
}

/** Botão "Ativar avisos" (precisa ser num toque da pessoa: o iPhone só pergunta assim). */
export async function ativarAvisos() {
    if (!navegadorAceitaAvisos()) throw new Error('Este navegador não recebe avisos.');
    // O Chrome do Android às vezes não mostra a pergunta (modo "silencioso" das notificações) e a promessa nunca
    // termina: depois de 20 s a tela ensina a liberar nas configurações do app.
    const licenca = Notification.permission === 'granted'
        ? 'granted'
        : await comPrazo(Notification.requestPermission(), 20, ERRO_PERGUNTA_NAO_APARECEU);
    if (licenca !== 'granted') throw new Error(licenca === 'denied' ? 'BLOQUEADO' : 'Licença não dada.');
    const reg = await registroDoAjudante();
    let inscricao = await comPrazo(reg.pushManager.getSubscription(), 15, 'O aparelho não respondeu. Tente de novo.');
    if (!inscricao) {
        inscricao = await comPrazo(
            reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(VAPID_PUBLICA) }),
            25, 'O serviço de avisos do Google não respondeu. Confira a internet e o Google Play Services e tente de novo.');
    }
    await guardarInscricao(inscricao);
    window.dispatchEvent(new Event(EVENTO_AVISOS_ATIVADOS));
}

/** A cada entrada: quem já deu licença tem o aparelho ligado ao login atual, sem perguntar nada. */
export async function religarAparelhoEmSilencio() {
    if (!navegadorAceitaAvisos() || Notification.permission !== 'granted') return;
    await seguro(async () => {
        const reg = await registroDoAjudante();
        let inscricao = await reg.pushManager.getSubscription();
        if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(VAPID_PUBLICA) });
        await guardarInscricao(inscricao);
    });
}

/** "Sair": este aparelho deixa de receber os avisos do login que saiu. */
export async function soltarAparelho() {
    await seguro(async () => {
        if (!navegadorAceitaAvisos()) return;
        const reg = await navigator.serviceWorker.getRegistration();
        const inscricao = await reg?.pushManager.getSubscription();
        if (inscricao) await supabase.rpc('push_soltar_aparelho', { p_endpoint: inscricao.endpoint });
    });
}

/** Modo dos avisos: 'teste' | 'ligado' | 'desligado' ('desligado' também quando o banco não tem o SQL). */
export async function lerModoAvisos() {
    const { data, error } = await supabase.from('sistema_config').select('valor').eq('chave', 'avisos_celular').maybeSingle();
    if (error || !data) return 'desligado';
    return String(data.valor || 'desligado').toLowerCase();
}

export async function definirModoAvisos(modo) {
    const { error } = await supabase.rpc('push_definir_modo', { p_modo: modo });
    if (error) throw new Error(error.message);
}

/** Chama o servidor (api/enviar-aviso). somenteContar = só a conferência (quantos recebem, quem não ativou). */
export async function enviarAvisoCelular(corpo) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) throw new Error('Entre no sistema de novo para enviar.');
    let resposta;
    try {
        resposta = await fetch('/api/enviar-aviso', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(corpo),
        });
    } catch {
        throw new Error('Sem conexão com o servidor dos avisos.');
    }
    const json = await resposta.json().catch(() => null);
    if (!resposta.ok || !json) throw new Error(json?.erro || 'O servidor dos avisos não respondeu (no computador de teste o servidor não roda; só no site publicado).');
    return json;
}

export async function lerHistoricoAvisos(limite = 50) {
    const { data, error } = await supabase.from('push_avisos_enviados').select('*').order('criado_em', { ascending: false }).limit(limite);
    if (error) return { lista: [], erro: error.message };
    return { lista: data || [], erro: null };
}

/** Telas que o aviso pode abrir ao tocar (o App abre pelo ?tela=). */
export const TELAS_DO_AVISO = [
    { id: '', nome: 'Só abrir o sistema' },
    { id: 'comunicados', nome: 'Comunicados' },
    { id: 'analise', nome: 'Dashboard' },
    { id: 'analise:visaoGeral', nome: 'Dashboard → Metas (Movimentação)' },
    { id: 'pendencias', nome: 'Pendências' },
    { id: 'fechamento', nome: 'Fechamento de Caixa' },
    { id: 'crm', nome: 'CRM' },
    { id: 'lancamento', nome: 'Nova Venda' },
    { id: 'avaliacao', nome: 'Avaliação Física' },
];
export const linkDaTela = (id) => (id ? `/?tela=${encodeURIComponent(id)}` : '/');
