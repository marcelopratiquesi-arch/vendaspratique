import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient.js';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// ==========================================
// LIXEIRA DAS AVALIAÇÕES (decisão do dono, 04/11/2026)
// Avaliação nunca é apagada direto: pede o MOTIVO e chama a função segura excluir_avaliacao,
// que guarda a avaliação inteira em avaliacoes_lixeira. Admin e Mentor restauram (restaurar_avaliacao).
// Usado no painel do avaliador e na ficha do aluno.
// ==========================================

export const MOTIVO_EXCLUSAO_AVALIACAO_MINIMO = 5;

// Pergunta o motivo. Devolve o texto ou null (cancelou / motivo curto).
export const pedirMotivoExclusaoAvaliacao = () => {
    const resposta = window.prompt(tx("Excluir esta avaliação?\n\nEla vai para a LIXEIRA (o Admin ou o Mentor pode restaurar), com o seu nome e a data.\n\nEscreva o MOTIVO da exclusão (ex.: \"lançada no aluno errado\"):"));
    if (resposta === null) return null;
    const motivo = resposta.trim();
    if (motivo.length < MOTIVO_EXCLUSAO_AVALIACAO_MINIMO) {
        avisar(tx("Exclusão cancelada: o motivo precisa ter pelo menos {qtd} letras.", { qtd: MOTIVO_EXCLUSAO_AVALIACAO_MINIMO }), 'atencao');
        return null;
    }
    return motivo;
};

// Pede o motivo e manda para a lixeira. Devolve true se excluiu.
export const excluirAvaliacaoComMotivo = async (id) => {
    const motivo = pedirMotivoExclusaoAvaliacao();
    if (!motivo) return false;
    const { error } = await supabase.rpc('excluir_avaliacao', { p_id: String(id), p_motivo: motivo });
    if (error) {
        console.error('Erro ao excluir avaliação:', error);
        avisar(tx("Não foi possível excluir a avaliação: {v1}", { v1: error.message || '' }), 'erro');
        return false;
    }
    avisar(tx("Avaliação enviada para a lixeira."), 'sucesso');
    return true;
};

// Total na lixeira da unidade (para o contador vermelho do botão da tela inicial). unidade null = todas que a pessoa vê.
export const useTotalLixeiraAvaliacoes = (unidade) => {
    const [total, setTotal] = useState(0);
    useEffect(() => {
        let ativo = true;
        supabase.rpc('avaliacoes_lixeira_listar', { p_inicio: null, p_fim: null, p_unidade: unidade || null })
            .then(({ data, error }) => { if (ativo && !error) setTotal((data || []).length); });
        return () => { ativo = false; };
    }, [unidade]);
    return total;
};
