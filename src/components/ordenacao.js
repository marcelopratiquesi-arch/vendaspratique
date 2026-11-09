// ==========================================
// ORDENAR TABELA CLICANDO NO TÍTULO (padrão do sistema, igual à Visão da Rede e ao Painel do CRM)
// 1º clique: número = maior primeiro / texto = A→Z · 2º clique: inverte · 3º clique: volta à ordem normal.
// Vazio (null/undefined/'') fica sempre no fim. Empate: pelo desempate (ex.: nome).
// Sem tela: dá para testar com node (scripts/teste-configuracoes.mjs).
// ==========================================

export const ORDEM_NORMAL = { coluna: null, direcao: 'desc' };

export const proximaOrdem = (atual, coluna, ehTexto = false) => {
    const primeira = ehTexto ? 'asc' : 'desc';
    if (!atual || atual.coluna !== coluna) return { coluna, direcao: primeira };
    if (atual.direcao === primeira) return { coluna, direcao: primeira === 'asc' ? 'desc' : 'asc' };
    return ORDEM_NORMAL;
};

const vazio = (v) => v === null || v === undefined || v === '';

// valores: { coluna: (linha) => número | texto }; desempate: (linha) => texto
export const ordenarLinhas = (linhas = [], ordem = ORDEM_NORMAL, valores = {}, desempate = () => '') => {
    const pegar = ordem?.coluna ? valores[ordem.coluna] : null;
    if (!pegar) return linhas;
    const sinal = ordem.direcao === 'asc' ? 1 : -1;
    const textoDe = (l) => String(desempate(l) || '');
    return [...linhas].sort((a, b) => {
        const va = pegar(a); const vb = pegar(b);
        if (vazio(va) !== vazio(vb)) return vazio(va) ? 1 : -1;
        if (vazio(va)) return textoDe(a).localeCompare(textoDe(b), 'pt-BR');
        const dif = typeof va === 'string' || typeof vb === 'string'
            ? String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
            : va - vb;
        return dif * sinal || textoDe(a).localeCompare(textoDe(b), 'pt-BR');
    });
};
