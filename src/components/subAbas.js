// ==========================================
// SUBABAS NO MENU LATERAL (Dashboard e Cadastros; 09/11/2026, decisão do dono)
// - O menu pede uma aba: pedirSubaba('cadastros', 'equipe') (a tela abre nela, mesmo se ainda não estava aberta).
// - A tela avisa qual aba está aberta: avisarSubabaAtual('cadastros', 'equipe') (o menu marca em azul).
// O Dashboard continua usando pedirAbaAnalise (movimentoDiario.js); aqui ficam o Cadastros e o aviso das duas.
// ==========================================

const pedidas = {};
export const EVENTO_PEDIR_SUBABA = 'pedir-subaba';
export const EVENTO_SUBABA_ATUAL = 'subaba-atual';

export const pedirSubaba = (tela, aba) => {
    pedidas[tela] = aba;
    window.dispatchEvent(new CustomEvent(EVENTO_PEDIR_SUBABA, { detail: { tela, aba } }));
};
export const consumirSubaba = (tela) => { const a = pedidas[tela] || null; delete pedidas[tela]; return a; };

const atuais = {};
export const avisarSubabaAtual = (tela, aba) => {
    if (atuais[tela] === aba) return;
    atuais[tela] = aba;
    window.dispatchEvent(new CustomEvent(EVENTO_SUBABA_ATUAL, { detail: { tela, aba } }));
};
export const subabaAtual = (tela) => atuais[tela] || null;
