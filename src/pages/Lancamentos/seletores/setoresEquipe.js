// ==========================================
// SETORES DA EQUIPE — ordem e cores da lista de consultores (decisão do dono, 30/10/2026)
// Fácil de editar: mude a ordem das linhas ou as cores aqui.
// - O setor vem do cadastro da Equipe (campo "role"), o mesmo da Saúde da unidade.
// - "termos": pedaços do nome do setor que identificam o grupo (sem acento, maiúsculo).
// - "fundo"/"texto": avatar no modo claro (contraste do texto sobre o fundo ≥ 4.5:1).
// - "fundoEscuro"/"textoEscuro": avatar no modo escuro.
// - Setor que não estiver na lista entra antes de "Líder", em cinza (SETOR_OUTRO).
// - Líder fica SEMPRE por último.
// ==========================================
import { normalizeString } from '../../AnaliseVendas/utils.js';

export const SETORES_EQUIPE = [
    { chave: 'RECEPCAO', rotulo: 'Recepção', termos: ['RECEP'], cor: '#DC2626', fundo: '#FDECEC', texto: '#B91C1C', fundoEscuro: 'rgba(220,38,38,0.22)', textoEscuro: '#FCA5A5' },
    { chave: 'MUSCULACAO', rotulo: 'Musculação', termos: ['MUSCULA'], cor: '#1D4FD8', fundo: '#E8EEFF', texto: '#1E40AF', fundoEscuro: 'rgba(29,79,216,0.28)', textoEscuro: '#BFDBFE' },
    { chave: 'BEM_ESTAR', rotulo: 'Bem-estar', termos: ['BEM-ESTAR', 'BEM ESTAR', 'BEMESTAR'], cor: '#7C3AED', fundo: '#F1EBFF', texto: '#6D28D9', fundoEscuro: 'rgba(124,58,237,0.25)', textoEscuro: '#DDD6FE' },
    { chave: 'SAVER', rotulo: 'Saver', termos: ['SAVER'], cor: '#0E7490', fundo: '#E0F2F7', texto: '#155E75', fundoEscuro: 'rgba(14,116,144,0.30)', textoEscuro: '#A5F3FC' },
    // Líder: sempre o último grupo
    { chave: 'LIDER', rotulo: 'Líder', termos: ['LIDER'], cor: '#B45309', fundo: '#FEF3C7', texto: '#92400E', fundoEscuro: 'rgba(180,83,9,0.28)', textoEscuro: '#FDE68A' },
];

// Setor fora da lista (entra antes de Líder, em cinza)
export const SETOR_OUTRO = { cor: '#64748B', fundo: '#EEF1F6', texto: '#334155', fundoEscuro: 'rgba(100,116,139,0.30)', textoEscuro: '#E2E8F0' };

const nomeDoSetor = (c) => String(c?.role || c?.setor || c?.cargo || '').trim();

// Setor de um colaborador: um item de SETORES_EQUIPE ou um "outro" com o nome do cadastro
export const setorDoColaborador = (c) => {
    const original = nomeDoSetor(c);
    const n = normalizeString(original);
    const achou = SETORES_EQUIPE.find(s => s.termos.some(t => n.includes(normalizeString(t))));
    if (achou) return achou;
    return { ...SETOR_OUTRO, chave: `OUTRO:${n || 'SEM SETOR'}`, rotulo: original || 'Sem setor', outro: true };
};

// Ordem dos grupos: os da lista (menos Líder) → outros setores (A–Z) → Líder
export const ordemDoSetor = (setor) => {
    if (setor.chave === 'LIDER') return 1000;
    const i = SETORES_EQUIPE.findIndex(s => s.chave === setor.chave);
    return i >= 0 ? i : 500;
};

// ==========================================
// NOME CURTO DO CONSULTOR: primeiro e segundo nome, só a inicial maiúscula ("AENDER CEZAR TADEU" → "Aender Cezar").
// Preposições (da, de, do, das, dos, e) são puladas para não virar "Maria Da".
// Se duas pessoas ficarem com o mesmo nome curto, entra a inicial do nome seguinte ("Maria Silva S.").
// O valor gravado na venda continua sendo o nome COMPLETO (não muda nada na gravação).
// ==========================================
const PREPOSICOES = new Set(['DA', 'DE', 'DO', 'DAS', 'DOS', 'E']);
const capitalizar = (p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
const palavrasDoNome = (nome) => String(nome || '').trim().split(/\s+/).filter(p => p && !PREPOSICOES.has(normalizeString(p)));

export const montarNomesCurtos = (colaboradores = []) => {
    const base = new Map();
    colaboradores.forEach(c => {
        const p = palavrasDoNome(c.nome);
        base.set(c.nome, p.slice(0, 2).map(capitalizar).join(' ') || String(c.nome || ''));
    });
    const contagem = {};
    base.forEach(curto => { contagem[curto] = (contagem[curto] || 0) + 1; });
    const final = new Map();
    base.forEach((curto, nomeCompleto) => {
        if (contagem[curto] > 1) {
            const terceira = palavrasDoNome(nomeCompleto)[2];
            final.set(nomeCompleto, terceira ? `${curto} ${terceira.charAt(0).toUpperCase()}.` : curto);
        } else final.set(nomeCompleto, curto);
    });
    return final;
};

// Iniciais do avatar: primeira letra do 1º e do 2º nome
export const iniciaisDoConsultor = (nome) => {
    const p = palavrasDoNome(nome);
    if (p.length === 0) return '?';
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
};
