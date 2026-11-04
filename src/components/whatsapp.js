// ==========================================
// ABRIR O WHATSAPP SEM ESTRAGAR OS EMOJIS (04/11/2026)
// A página de passagem do WhatsApp (wa.me e api.whatsapp.com: "Conversar com... / Abrir app") troca os
// emojis por "�". Por isso o sistema NÃO passa por ela:
//  - computador: WhatsApp Web direto (web.whatsapp.com/send), sempre na MESMA aba (o WhatsApp Web só
//    funciona em uma aba por vez); ou o aplicativo instalado (whatsapp://send), se a pessoa escolher;
//  - celular: aplicativo direto (whatsapp://send).
// A escolha Web/Aplicativo fica guardada no computador (botões na Revisão de Mensagem do CRM).
// Usado pelo CRM, pelos relatórios da Análise de Vendas e pela Avaliação Física.
// ==========================================
const CHAVE_DESTINO_WHATSAPP = 'pratique_whatsapp_destino';
const ehCelular = () => typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

export const destinoWhatsApp = () => {
    if (ehCelular()) return 'app';
    try { return localStorage.getItem(CHAVE_DESTINO_WHATSAPP) === 'app' ? 'app' : 'web'; } catch { return 'web'; }
};
export const definirDestinoWhatsApp = (destino) => {
    try { localStorage.setItem(CHAVE_DESTINO_WHATSAPP, destino === 'app' ? 'app' : 'web'); } catch { /* sem armazenamento: fica no Web */ }
};
export const podeEscolherDestinoWhatsApp = () => !ehCelular();

// Número com 55 (sem repetir quando já vem com o código do Brasil); vazio = sem número (a pessoa escolhe o contato)
const numeroWhatsApp = (telefone) => {
    let numero = String(telefone || '').replace(/\D/g, '');
    if (!numero) return '';
    if (!(numero.length >= 12 && numero.startsWith('55'))) numero = '55' + numero;
    return numero;
};

export const linkWhatsApp = (telefone, texto) => {
    const numero = numeroWhatsApp(telefone);
    const params = `${numero ? `phone=${numero}&` : ''}text=${encodeURIComponent(texto || '')}`;
    return destinoWhatsApp() === 'app' ? `whatsapp://send?${params}` : `https://web.whatsapp.com/send?${params}`;
};

// Abre a conversa: aplicativo pelo próprio endereço; WhatsApp Web sempre na mesma aba ("whatsapp_pratique")
export const abrirNoWhatsApp = (telefone, texto) => {
    const link = linkWhatsApp(telefone, texto);
    if (link.startsWith('whatsapp://')) { window.location.href = link; return; }
    const aba = window.open(link, 'whatsapp_pratique');
    if (aba) aba.focus();
};
