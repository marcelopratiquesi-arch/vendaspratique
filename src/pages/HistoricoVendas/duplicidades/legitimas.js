// ==========================================
// MEMÓRIA DO "NÃO É DUPLICIDADE" (tabela vendas_duplicidade_legitima, criada no SQL Editor)
// Guarda a chave do grupo, os números das vendas, quem decidiu e quando.
// Admin e Mentor marcam/desfazem em qualquer unidade; o Líder só na dele (regra no banco).
// Se a tabela ainda não existir, nada é escondido e o console avisa.
// ==========================================

export const carregarLegitimas = async (supabase) => {
    const { data, error } = await supabase
        .from('vendas_duplicidade_legitima')
        .select('id, chave, unidade, venda_ids, decidido_por, decidido_em')
        .order('decidido_em', { ascending: false })
        .limit(5000);
    if (error) {
        console.warn('Duplicidades: não deu para ler os grupos marcados como legítimos (a tabela vendas_duplicidade_legitima já foi criada?).', error);
        return [];
    }
    return data || [];
};

export const marcarComoLegitima = async (supabase, grupo, usuarioLogado) => {
    const amostra = grupo.linhas[0] || {};
    const { data, error } = await supabase
        .from('vendas_duplicidade_legitima')
        .insert({
            chave: grupo.chaveBase,
            unidade: amostra.unidade || null,
            venda_ids: grupo.linhas.map(l => Number(l.id)),
            decidido_por: usuarioLogado?.nome || usuarioLogado?.email || null
        })
        .select('id, chave, unidade, venda_ids, decidido_por, decidido_em')
        .single();
    return { marcacao: data || null, error: error || null };
};

export const desfazerLegitima = async (supabase, id) => {
    // .select() devolve o que foi apagado: lista vazia = o banco não deixou (ex.: Líder de outra unidade)
    const { data, error } = await supabase.from('vendas_duplicidade_legitima').delete().eq('id', id).select('id');
    if (error) return error;
    if (!data || data.length === 0) return { message: 'Você não tem permissão para desfazer esta marcação.' };
    return null;
};
