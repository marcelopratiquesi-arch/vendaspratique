import { gerarChaveDuplicidade, safeNumber, PREFIXO_REGRA_ANTIGA } from '../utils.js';

// ==========================================
// MOTOR DE DETECÇÃO DE DUPLICIDADES (aba "Duplicidades" do Histórico)
// Junta as vendas pela chave UNIDADE | DIA | CPF | PRODUTO (gerarChaveDuplicidade em ../utils.js)
// e devolve só os grupos com mais de um lançamento. Vendas antigas sem CPF usam a regra antiga
// (matrícula ou nome) e só se agrupam entre si: esses grupos vêm com regraAntiga = true.
// - Ordem dos grupos: primeiro os maiores; no empate, o que tem o lançamento MAIS RECENTE.
// - Dentro do grupo: do lançamento mais novo para o mais antigo.
// - O lançamento mais antigo é o "original"; os outros são os EXCEDENTES (a comissão deles é a "sob suspeita").
// - Grupos marcados como "Não é duplicidade" (tabela vendas_duplicidade_legitima) saem da lista,
//   a não ser que tenha entrado uma venda nova no grupo depois da marcação.
// ==========================================

const momentoDoLancamento = (venda) => {
    const t = venda?.created_at ? new Date(venda.created_at).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
};

// Mais novo primeiro; no empate de horário, o número de venda maior (lançado depois)
const maisNovoPrimeiro = (a, b) => (momentoDoLancamento(b) - momentoDoLancamento(a)) || (Number(b.id) - Number(a.id));

export const comissaoDaVenda = (venda) => safeNumber(venda?.comissao ?? venda?.valor);

// A marcação vale enquanto TODAS as vendas do grupo estiverem nela (venda nova = o grupo volta)
const acharMarcacao = (grupo, legitimas) => legitimas.find(m =>
    m.chave === grupo.chaveBase
    && Array.isArray(m.venda_ids)
    && grupo.linhas.every(l => m.venda_ids.map(Number).includes(Number(l.id)))
);

export const agruparDuplicidades = (vendas = [], legitimas = []) => {
    const mapa = new Map();

    vendas.forEach(venda => {
        const chave = gerarChaveDuplicidade(venda);
        if (!chave) return;

        if (!mapa.has(chave)) mapa.set(chave, { chaveBase: chave, linhas: [] });
        mapa.get(chave).linhas.push(venda);
    });

    const todos = Array.from(mapa.values())
        .filter(grupo => grupo.linhas.length > 1)
        .map(grupo => {
            const linhas = [...grupo.linhas].sort(maisNovoPrimeiro);
            // A última linha é a mais antiga (o original); as demais são excedentes
            const excedentes = linhas.slice(0, -1);
            return {
                ...grupo,
                linhas,
                regraAntiga: grupo.chaveBase.startsWith(PREFIXO_REGRA_ANTIGA),
                excedentes: excedentes.length,
                comissaoSuspeita: excedentes.reduce((soma, v) => soma + comissaoDaVenda(v), 0)
            };
        })
        .sort((a, b) => {
            if (b.linhas.length !== a.linhas.length) return b.linhas.length - a.linhas.length;
            return momentoDoLancamento(b.linhas[0]) - momentoDoLancamento(a.linhas[0]);
        });

    const grupos = [];
    const gruposLegitimos = [];
    todos.forEach(grupo => {
        const marcacao = acharMarcacao(grupo, legitimas);
        if (marcacao) gruposLegitimos.push({ ...grupo, marcacao });
        else grupos.push(grupo);
    });

    return {
        grupos,
        gruposLegitimos,
        excedentes: grupos.reduce((soma, g) => soma + g.excedentes, 0),
        comissaoSuspeita: grupos.reduce((soma, g) => soma + g.comissaoSuspeita, 0)
    };
};
