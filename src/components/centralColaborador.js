// ==========================================
// ABRIR A CENTRAL DO COLABORADOR DE QUALQUER TELA (11/11/2026, decisão do dono)
// Qualquer tela chama abrirCentralColaborador(colaborador) — o objeto da Equipe (ou { nome, unidade } quando a
// venda tem um nome que não está na Equipe). A janela (CadastroGeral/colaborador/CentralColaboradorGlobal.jsx) fica
// montada uma vez no App, confere quem pode ver (permissão 809: Admin todas as unidades, Mentor as dele, Líder a
// própria; a Recepção NÃO abre) e abre por cima da tela. Fechar = volta para a mesma tela.
// opcoes.onEditar: quando a tela sabe editar o cadastro (Cadastros → Equipe), a Central mostra "Editar"/"Corrigir".
// ==========================================

export const EVENTO_CENTRAL_COLABORADOR = 'abrir-central-colaborador';
export const CODIGO_PERMISSAO_CENTRAL_COLABORADOR = '809';

export const abrirCentralColaborador = (colaborador, opcoes = {}) => {
    if (!colaborador?.nome) return;
    window.dispatchEvent(new CustomEvent(EVENTO_CENTRAL_COLABORADOR, { detail: { colaborador, ...opcoes } }));
};
