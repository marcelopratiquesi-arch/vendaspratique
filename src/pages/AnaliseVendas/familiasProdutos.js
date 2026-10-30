// ==========================================
// FAMÍLIAS DE PRODUTOS COM SABORES (decisão do dono, 30/10/2026)
// Lista fixa, editada SÓ aqui. Produto cujo nome começa com um dos "prefixos" entra na família
// e o resto do nome vira o sabor (ex.: "ENERGY LARANJA" → família Energy, sabor Laranja).
// Produto fora da lista aparece sozinho, sem expandir.
// Para criar uma família nova: copie uma linha, troque o nome, o complemento e os prefixos.
// ==========================================
import { normalizeString } from './utils.js';

export const FAMILIAS_PRODUTOS = [
    { nome: 'Energy', complemento: 'dose única 20g', prefixos: ['ENERGY'] },
    { nome: 'Whey', complemento: 'dose única 40g', prefixos: ['WHEY'] },
];

// Palavras que às vezes aparecem no nome e não são sabor (tiradas do texto do sabor)
const NAO_E_SABOR = ['DOSE ÚNICA', 'DOSE UNICA', 'DOSE', 'ÚNICA', 'UNICA', '20G', '40G', '20 G', '40 G'];

const limparSabor = (texto) => {
    let t = ` ${texto} `;
    NAO_E_SABOR.forEach(p => { t = t.split(` ${p} `).join(' '); });
    return t.replace(/^[\s\-–·:]+|[\s\-–·:]+$/g, '').replace(/\s+/g, ' ').trim();
};

// Família de um produto (ou null) e o sabor dele
export const familiaDoProduto = (nomeProduto) => {
    const n = normalizeString(nomeProduto);
    for (const fam of FAMILIAS_PRODUTOS) {
        const prefixo = fam.prefixos.find(p => n === p || n.startsWith(`${p} `));
        // O sabor sai do nome original (com acento); os prefixos não têm acento, então o corte é no mesmo lugar
        const original = String(nomeProduto || '').trim().toUpperCase();
        if (prefixo) return { familia: fam, sabor: limparSabor(original.slice(prefixo.length)) || original };
    }
    return null;
};

// [[nome, qtd], ...] → linhas agrupadas por família, do maior total para o menor
export const agruparProdutos = (listaProdutos) => {
    const linhas = new Map();
    listaProdutos.forEach(([nome, qtd]) => {
        const achou = familiaDoProduto(nome);
        if (!achou) {
            linhas.set(`P:${nome}`, { chave: `P:${nome}`, nome, complemento: '', total: qtd, sabores: null });
            return;
        }
        const chave = `F:${achou.familia.nome}`;
        const linha = linhas.get(chave) || { chave, nome: achou.familia.nome, complemento: achou.familia.complemento, total: 0, sabores: [] };
        linha.total += qtd;
        linha.sabores.push({ nome: achou.sabor, produto: nome, qtd });
        linhas.set(chave, linha);
    });
    return [...linhas.values()]
        .map(l => (l.sabores ? { ...l, sabores: [...l.sabores].sort((a, b) => b.qtd - a.qtd) } : l))
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
};
