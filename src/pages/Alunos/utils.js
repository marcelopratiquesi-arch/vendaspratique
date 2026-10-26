import { supabase } from '../../supabaseClient.js';

// ==========================================
// 🧠 FORMATADORES E MÁSCARAS SEGUROS (LGPD & UI)
// ==========================================

export const formatarCPF = (cpf) => {
    if (!cpf) return '—';
    const d = String(cpf).replace(/\D/g, '');
    if (d.length !== 11) return cpf;
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

export const formatarTelefone = (tel) => {
    if (!tel) return '—';
    let d = String(tel).replace(/\D/g, '');
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return tel;
};

export const formatarDataBR = (isoOrDate) => {
    if (!isoOrDate) return '—';
    const str = String(isoOrDate).split('T')[0].split(' ')[0];
    const partes = str.split('-');
    if (partes.length === 3) {
        const [y, m, d] = partes;
        if (y.length === 4) return `${d}/${m}/${y}`;
    }
    return str;
};

export const extrairIniciais = (nome) => {
    if (!nome) return 'AL';
    const partes = String(nome).trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'AL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
};

export const limparApenasDigitos = (val) => String(val || '').replace(/\D/g, '');

// ==========================================
// 📋 UTILITÁRIO DE CÓPIA COM FALLBACK SEGURO
// ==========================================
export const copiarTextoSeguro = async (valor, apenasDigitos = false) => {
    if (!valor || valor === '—') return false;
    const textoFinal = apenasDigitos ? limparApenasDigitos(valor) : String(valor).trim();
    if (!textoFinal) return false;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textoFinal);
            return true;
        }
    } catch (_) {}

    try {
        const textArea = document.createElement('textarea');
        textArea.value = textoFinal;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textArea);
        return ok;
    } catch (_) {
        return false;
    }
};

// ==========================================
// ⚡ MOTOR DE BUSCA NO SERVIDOR (RPC + FALLBACK SUPREMO GLOBAL)
// ==========================================
export const buscarAlunosPaginado = async ({
    busca = '',
    unidade = 'TODAS',
    plano = 'TODOS',
    dataInicio = '',
    dataFim = '',
    ordemColuna = 'nome',
    ordemDirecao = 'ASC',
    pagina = 1,
    limite = 25,
    roleUsuario = 'RECEPCAO',
    unidadeUsuario = '',
    signal = null
}) => {
    const termoBusca = String(busca || '').trim();
    const termoNumerico = termoBusca.replace(/\D/g, '');
    
    // Tenta adaptar o termo para a RPC (ex: formata o CPF automaticamente)
    let termoRpc = termoBusca;
    if (termoNumerico.length === 11 && !termoBusca.includes('-')) {
        termoRpc = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }

    let rpcCall = supabase.rpc('listar_alunos_360', {
        p_busca: termoRpc,
        p_unidade: unidade || 'TODAS',
        p_plano: plano || 'TODOS',
        p_data_inicio: dataInicio ? dataInicio : null,
        p_data_fim: dataFim ? dataFim : null,
        p_ordem_coluna: ordemColuna || 'nome',
        p_ordem_direcao: ordemDirecao || 'ASC',
        p_pagina: pagina || 1,
        p_limite: limite || 25,
        p_role_usuario: roleUsuario || 'RECEPCAO',
        p_unidade_usuario: unidadeUsuario || ''
    });

    if (signal && typeof rpcCall.abortSignal === 'function') {
        rpcCall = rpcCall.abortSignal(signal);
    }

    const { data, error } = await rpcCall;
    if (error) console.error("Erro na RPC listar_alunos_360:", error);

    let lista = data || [];
    let totalCount = lista.length > 0 ? Number(lista[0].total_count || 0) : 0;

    // 🔥 FALLBACK SUPREMO GLOBAL
    // Se a busca falhar e o usuário digitou algo, o problema é o filtro de unidade ou caracteres especiais.
    // Ignoramos a unidade e varremos o banco de dados inteiro (igual a Nova Venda).
    if (lista.length === 0 && termoBusca.length >= 2) {
        const cleanTerm = termoBusca.replace(/"/g, ''); 
        const orConditions = [];
        
        orConditions.push(`nome.ilike."%${cleanTerm}%"`);
        orConditions.push(`email.ilike."%${cleanTerm}%"`);
        
        if (termoNumerico.length > 0) {
            if (termoNumerico.length === 11) {
                const cpfMask = termoNumerico.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                orConditions.push(`cpf.eq."${termoNumerico}"`);
                orConditions.push(`cpf.eq."${cpfMask}"`);
            } else {
                orConditions.push(`cpf.ilike."%${termoNumerico}%"`);
            }
            orConditions.push(`telefone.ilike."%${termoNumerico}%"`);
            orConditions.push(`matricula.ilike."%${termoNumerico}%"`);
        }

        const { data: fallbackData, count: fallbackCount, error: fallbackError } = await supabase
            .from('alunos')
            .select('*', { count: 'exact' })
            .or(orConditions.join(','))
            .order(ordemColuna === 'created_at' ? 'created_at' : 'nome', { ascending: ordemDirecao === 'ASC' })
            .range((pagina - 1) * limite, pagina * limite - 1);
            
        if (!fallbackError && fallbackData && fallbackData.length > 0) {
            lista = fallbackData.map(a => ({
                ...a,
                total_count: fallbackCount || fallbackData.length,
                ultimo_plano: a.ultimo_plano || 'NENHUM',
                ultimo_plano_data: a.ultimo_plano_data || null
            }));
            totalCount = fallbackCount || fallbackData.length;
        }
    }

    return {
        alunos: lista,
        totalCount
    };
};

// ==========================================
// 🛡️ EXCLUSÃO SEGURA NO BANCO (SOMENTE ADMIN)
// ==========================================
export const executarExclusaoAluno = async ({
    alunoId,
    roleUsuario,
    nomeUsuario,
    emailUsuario,
    motivo = 'Cadastro indevido'
}) => {
    const { data, error } = await supabase.rpc('excluir_aluno_seguro', {
        p_aluno_id: alunoId,
        p_role_usuario: roleUsuario || '',
        p_nome_usuario: nomeUsuario || 'ADMIN',
        p_email_usuario: emailUsuario || '',
        p_motivo: motivo || 'Cadastro indevido'
    });

    if (error) throw error;
    return data;
};