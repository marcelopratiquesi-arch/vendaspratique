import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient.js';

// ==========================================
// Carregar avaliações sem o corte escondido do banco (09/11/2026)
// O Supabase devolve no máximo 1.000 linhas por pedido. Antes as telas da Avaliação pediam uma vez só
// e, em períodos longos, o total e o ranking saíam menores sem ninguém saber. Aqui pede de 1.000 em 1.000
// até acabar. montarConsulta(colunas) deve devolver a consulta já com filtros e ordem (sem .range/.limit).
// ==========================================

const TAMANHO_PAGINA = 1000;
const LIMITE_SEGURANCA = 50; // 50 mil linhas: só para nunca ficar num laço infinito

// Pacote 2 (09/11/2026): as listas baixam só o que mostram. A avaliação COMPLETA (braços, pernas, água,
// checklist...) só é lida quando alguém abre a folha (olho/Ver) ou clica em Editar.
// A anamnese (respostas_dinamicas) continua porque a etiqueta "Sem anamnese" e o modo Avançado precisam dela.
export const COLUNAS_LISTA = [
    'id', 'created_at', 'data', 'hora', 'aluno', 'aluno_id', 'cpf', 'unidade', 'professor', 'registrado_por_nome', 'sexo',
    'peso', 'altura', 'mme', 'pgc', 'rcq', 'gv', 'smi_resultado', 'smi_status', 'hidratacao_resultado', 'hidratacao_status',
    'rcq_status', 'gv_status', 'pressao_status', 'sistolica', 'diastolica', 'respostas_dinamicas', 'arquivo_inbody_url',
];

// "column avaliacoes_realizadas.cpf does not exist" → "cpf"
const colunaQueFalta = (erro) => {
    const msg = String(erro?.message || '');
    const m = msg.match(/column\s+(?:[\w"]+\.)?"?(\w+)"?\s+does not exist/i) || msg.match(/'(\w+)' column/i);
    return m ? m[1] : null;
};

export const carregarTodasAvaliacoes = async (montarConsulta, colunasPedidas = '*') => {
    let colunas = Array.isArray(colunasPedidas) ? [...colunasPedidas] : null;
    const todas = [];
    for (let pagina = 0; pagina < LIMITE_SEGURANCA; pagina += 1) {
        const inicio = pagina * TAMANHO_PAGINA;
        const { data, error } = await montarConsulta(colunas ? colunas.join(', ') : '*').range(inicio, inicio + TAMANHO_PAGINA - 1);
        if (error) {
            // Coluna que ainda não existe no banco (ex.: cpf antes do SQL): tira da lista e pede de novo
            const falta = colunas ? colunaQueFalta(error) : null;
            if (falta && colunas.includes(falta)) {
                console.warn(`avaliacoes_realizadas sem o campo "${falta}": lendo sem ele.`);
                colunas = colunas.filter(c => c !== falta);
                pagina -= 1;
                continue;
            }
            if (colunas) { // qualquer outro problema com a lista de colunas: volta a ler tudo, como antes
                console.warn('Lista de colunas da avaliação recusada; lendo tudo:', error.message || error);
                colunas = null;
                pagina -= 1;
                continue;
            }
            return { data: todas, error };
        }
        todas.push(...(data || []));
        if (!data || data.length < TAMANHO_PAGINA) break;
    }
    return { data: todas, error: null };
};

// Avaliação completa de uma linha (para Editar)
export const carregarAvaliacaoCompleta = async (avaliacao) => {
    if (!avaliacao?.id) return avaliacao;
    const { data, error } = await supabase.from('avaliacoes_realizadas').select('*').eq('id', avaliacao.id).maybeSingle();
    if (error || !data) {
        if (error) console.error('Erro ao ler a avaliação completa:', error);
        return null;
    }
    return data;
};

// ==========================================
// Perguntas da anamnese: baixadas UMA vez e usadas pelas 3 telas (antes eram até 3 vezes)
// Todas, inclusive as desativadas (para dar nome às respostas antigas); o formulário usa só as ativas.
// "Configurar Formulário" chama esquecerPerguntasAvaliacao() depois de salvar.
// ==========================================
let promessaPerguntas = null;
const ouvintes = new Set();

const buscarPerguntas = () => {
    if (!promessaPerguntas) {
        promessaPerguntas = supabase.from('avaliacao_perguntas').select('*').order('ordem', { ascending: true })
            .then(({ data, error }) => {
                if (error) { console.error('Erro ao ler as perguntas da avaliação:', error); promessaPerguntas = null; return []; }
                return data || [];
            });
    }
    return promessaPerguntas;
};

export const esquecerPerguntasAvaliacao = () => {
    promessaPerguntas = null;
    ouvintes.forEach(f => f());
};

export const usePerguntasAvaliacao = () => {
    const [estado, setEstado] = useState({ perguntas: [], carregando: true });
    useEffect(() => {
        let ativo = true;
        const ler = () => buscarPerguntas().then(lista => { if (ativo) setEstado({ perguntas: lista, carregando: false }); });
        ler();
        ouvintes.add(ler);
        return () => { ativo = false; ouvintes.delete(ler); };
    }, []);
    return estado;
};

// CPF só com números (para comparar na busca)
export const soNumerosCpf = (v) => String(v || '').replace(/\D/g, '');

// A busca por CPF só vale com pelo menos 3 números digitados (senão "qualquer coisa" combinava com todos)
export const cpfCombina = (cpfAvaliacao, textoBusca) => {
    const digitos = soNumerosCpf(textoBusca);
    if (digitos.length < 3) return false;
    return soNumerosCpf(cpfAvaliacao).includes(digitos);
};
