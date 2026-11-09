// ==========================================
// ABRIR A CENTRAL DA UNIDADE DE QUALQUER TELA (09/11/2026, decisão do dono)
// Qualquer tela chama abrirCentralUnidade('PRADO'); a janela (CadastroGeral/CentralUnidadeGlobal.jsx) fica montada
// uma vez no App, confere quem pode ver aquela unidade (Admin todas, Mentor as dele, Líder a própria; permissão 314)
// e abre por cima da tela, já na aba Panorama. Fechar = volta para a mesma tela, com os mesmos filtros.
// ==========================================

export const EVENTO_CENTRAL_UNIDADE = 'abrir-central-unidade';
export const CODIGO_PERMISSAO_CENTRAL = '314';

export const abrirCentralUnidade = (nome, aba = 'panorama') => {
    if (!nome || String(nome).toUpperCase() === 'TODAS' || String(nome).toUpperCase() === 'TODOS') return;
    window.dispatchEvent(new CustomEvent(EVENTO_CENTRAL_UNIDADE, { detail: { nome: String(nome), aba } }));
};

// Quem pode abrir a Central de qual unidade: Admin todas; Mentor e Líder só as da lista (as dele / a própria).
// unidadesPermitidas = null para o Admin. Sem acento e sem diferenciar maiúscula.
const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
export const unidadePermitida = ({ papel, nome, unidadesPermitidas }) => {
    if (!nome) return false;
    if (String(papel || '').toUpperCase() === 'ADMIN') return true;
    return (unidadesPermitidas || []).some(u => normalizar(u) === normalizar(nome));
};
