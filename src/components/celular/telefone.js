import { ehCelularAgora } from './ehCelular.js';

// ==========================================
// LIGAR (26/11/2026): no computador abre o MicroSIP (`sip:`), como sempre; no celular abre o discador (`tel:`).
// Use em todo botão "Ligar" do sistema (antes cada tela escrevia `sip:` na mão e no celular não fazia nada).
// O registro da ligação (meio LIGACAO) continua igual: quem chama esta função grava como antes.
// ==========================================
export const linkLigacao = (telefone) => {
    const numero = String(telefone || '').replace(/\D/g, '');
    if (!numero) return '';
    return ehCelularAgora() ? `tel:${numero}` : `sip:${numero}`;
};

export const ligarPara = (telefone) => {
    const link = linkLigacao(telefone);
    if (link) window.location.href = link;
};
