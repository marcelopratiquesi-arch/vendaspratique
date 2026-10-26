const CHAVE_PREFIXO = 'pratique_recentes_';
const MAX_RECENTES = 15; // 🔥 Limite aumentado para 15 alunos

const mascararCpfLgpd = (cpf) => {
    if (!cpf) return null;
    const apenasNumeros = String(cpf).replace(/\D/g, '');
    if (apenasNumeros.length !== 11) return '***.***.***-**';
    return `***.${apenasNumeros.substring(3, 6)}.${apenasNumeros.substring(6, 9)}-**`;
};

export const getRecentes = (usuarioEmail) => {
    const key = usuarioEmail || 'local_user';
    try {
        const dados = localStorage.getItem(`${CHAVE_PREFIXO}${key}`);
        return dados ? JSON.parse(dados) : [];
    } catch (e) {
        console.error("Erro ao ler recentes:", e);
        return [];
    }
};

export const addRecente = (usuarioEmail, aluno, acaoLabel = 'Visitado recentemente') => {
    const key = usuarioEmail || 'local_user';
    
    const uniqueId = aluno?.id || aluno?.id_aluno || aluno?.matricula || aluno?.cpf || aluno?.nome;
    if (!aluno || !uniqueId) return;

    try {
        const recentes = getRecentes(key);
        const filtrados = recentes.filter(r => (r.id || r.id_aluno || r.matricula || r.cpf || r.nome) !== uniqueId);
        
        const alunoSeguro = {
            ...aluno,
            id: uniqueId, 
            nome: aluno.nome,
            matricula: aluno.matricula || null,
            unidade: aluno.unidade || null,
            cpf: mascararCpfLgpd(aluno.cpf), 
            ultimo_plano: aluno.ultimo_plano || null,
            acao_label: acaoLabel,
            foto_url: aluno.foto_url || aluno.foto || null
        };

        filtrados.unshift(alunoSeguro); // Coloca o aluno mais novo no topo da lista
        if (filtrados.length > MAX_RECENTES) filtrados.pop(); // Remove o 16º aluno se passar de 15

        localStorage.setItem(`${CHAVE_PREFIXO}${key}`, JSON.stringify(filtrados));
    } catch (e) {
        console.error("Erro ao salvar recente:", e);
    }
};

export const removerRecente = (usuarioEmail, alunoId) => {
    const key = usuarioEmail || 'local_user';
    if (!alunoId) return;
    try {
        const recentes = getRecentes(key).filter(r => (r.id || r.id_aluno || r.matricula || r.cpf || r.nome) !== alunoId);
        localStorage.setItem(`${CHAVE_PREFIXO}${key}`, JSON.stringify(recentes));
    } catch (e) {
        console.error("Erro ao remover recente:", e);
    }
};

export const limparRecentes = (usuarioEmail) => {
    const key = usuarioEmail || 'local_user';
    try {
        localStorage.removeItem(`${CHAVE_PREFIXO}${key}`);
    } catch (e) {
        console.error("Erro ao limpar recentes:", e);
    }
};