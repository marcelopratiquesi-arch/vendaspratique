// ==========================================
// CONTATOS DO CRM AO VIVO (economia de dados, 09/11/2026)
// O App já escuta a tabela `leads` no tempo real. Em vez de o CRM abrir uma segunda escuta (o Supabase confere a
// permissão de cada pessoa conectada a cada mudança, então escutar duas vezes = o dobro de trabalho no banco),
// o App repassa os avisos para o CRM por um evento do navegador. O CRM encaixa só o contato que mudou.
// Quando o App precisa recarregar tudo (muitos avisos seguidos, aviso incompleto, internet caiu e voltou),
// ele pede ao CRM para recarregar também.
// ==========================================

export const EVENTO_CONTATOS = 'pratique:contatos-ao-vivo';
export const EVENTO_CONTATOS_RECARREGAR = 'pratique:contatos-recarregar';

/** App → CRM: lote de avisos do tempo real ({ eventType, new, old }). */
export const avisarContatos = (eventos) => {
    try { window.dispatchEvent(new CustomEvent(EVENTO_CONTATOS, { detail: eventos })); } catch { /* sem janela */ }
};

/** App → CRM: "recarregue a lista inteira" (pode ter perdido avisos). */
export const pedirRecargaContatos = () => {
    try { window.dispatchEvent(new Event(EVENTO_CONTATOS_RECARREGAR)); } catch { /* sem janela */ }
};

// Contatos de LISTA (Smart Paste, Puxar do cadastro): só o CRM usa. As outras telas (Dashboard, Relatórios)
// contam só os visitantes e já ignoravam estes (AnaliseVendas/index.jsx, visitantesFiltrados).
export const ORIGENS_DE_LISTA = ['CRM', 'SMART_PAGE'];
export const ehContatoDeLista = (lead) => ORIGENS_DE_LISTA.includes(String(lead?.origem || '').toUpperCase());
