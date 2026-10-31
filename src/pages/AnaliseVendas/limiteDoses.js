// ==========================================
// LIMITE DE DOSES ÚNICAS POR UNIDADE (decisão do dono, vale a partir de 01/11/2026)
// - "Dose única" = famílias abaixo (de familiasProdutos.js), qualquer sabor.
// - Cada UNIDADE tem até LIMITE doses únicas por mês, no total (todas as famílias e consultores somados).
// - Contam as primeiras doses do mês na unidade, pela data da venda e, em empate, pela hora do lançamento.
//   Da (LIMITE + 1)ª em diante, nenhuma dose da unidade conta para meta/ranking naquele mês.
// - Quantidade > 1 conta dose por dose (faltava 1 e a venda tem 3 → conta 1).
// - Outros produtos físicos contam sempre. Zera todo dia 1º. Antes de INICIO: todas as doses contam.
// - Venda apagada (lixeira) não está na lista de vendas, então sai da conta sozinha.
// VALE SÓ para: pódio/ranking de produtos do Dashboard, "Enviar ranking no WhatsApp" e o realizado da
// meta de produtos (aba Metas e "Alertar metas"). Comissão, Histórico, Fechamento, Relatórios, Ranking global,
// Saúde da unidade, card "Produtos físicos" e lista "Produtos / Complementos" continuam com o total real.
// ==========================================
import { familiaDoProduto } from './familiasProdutos.js';
import { getCategoriaItem, safeIsoDate } from './utils.js';

// ---------- CONSTANTES (fáceis de editar) ----------
export const FAMILIAS_DOSE_UNICA = ['Energy', 'Whey'];  // nomes das famílias em FAMILIAS_PRODUTOS
export const LIMITE_DOSES_POR_UNIDADE_MES = 10;          // doses que contam por unidade, por mês
export const INICIO_LIMITE_DOSES = '2026-11-01';         // antes desta data: todas as doses contam

// É dose única? (produto das famílias acima, qualquer sabor)
export const ehDoseUnica = (nomeProduto) => {
    const achou = familiaDoProduto(nomeProduto);
    return !!achou && FAMILIAS_DOSE_UNICA.includes(achou.familia.nome);
};

const quantidadeDe = (v) => parseInt(v.quantidade) || 1;
const unidadeDe = (v) => String(v.unidade || '').trim().toUpperCase();
const chaveDaVenda = (v) => v.id ?? v;

// ==========================================
// FUNÇÃO CENTRAL: recebe TODAS as vendas conhecidas (sem filtro de tela) e devolve um Map
// venda → quantidade válida para meta/ranking. Só entram vendas de PRODUTO físico.
// O limite é aplicado em cada unidade e em cada mês separadamente.
// ==========================================
export const aplicarLimiteDoses = (vendas = [], planos = [], produtos = []) => {
    const validas = new Map();
    const dosesPorGrupo = new Map(); // "UNIDADE|AAAA-MM" → lista de doses do mês (a partir de INICIO)

    vendas.forEach(v => {
        if (getCategoriaItem(v.produto, planos, produtos) !== 'PRODUTO') return;
        const qtd = quantidadeDe(v);
        const dia = safeIsoDate(v.data || v.created_at);
        if (!ehDoseUnica(v.produto) || !dia || dia < INICIO_LIMITE_DOSES) {
            validas.set(chaveDaVenda(v), qtd); // outro produto, ou antes da regra: conta tudo
            return;
        }
        const grupo = `${unidadeDe(v)}|${dia.slice(0, 7)}`;
        if (!dosesPorGrupo.has(grupo)) dosesPorGrupo.set(grupo, []);
        dosesPorGrupo.get(grupo).push({ v, qtd, dia });
    });

    dosesPorGrupo.forEach(lista => {
        // Ordem de lançamento: data da venda → hora do lançamento → número da venda
        lista.sort((a, b) => a.dia.localeCompare(b.dia)
            || String(a.v.created_at || '').localeCompare(String(b.v.created_at || ''))
            || (Number(a.v.id) || 0) - (Number(b.v.id) || 0));
        let usadas = 0;
        lista.forEach(({ v, qtd }) => {
            const conta = Math.max(0, Math.min(qtd, LIMITE_DOSES_POR_UNIDADE_MES - usadas));
            usadas += conta;
            validas.set(chaveDaVenda(v), conta);
        });
    });
    return validas;
};

// Quantidade válida de uma venda de produto (se a venda não estiver no mapa, conta a quantidade toda)
export const qtdValidaProduto = (venda, mapa) => {
    const chave = chaveDaVenda(venda);
    return mapa && mapa.has(chave) ? mapa.get(chave) : quantidadeDe(venda);
};

// Doses já válidas de uma unidade num mês (para o aviso da tela Lançar venda)
export const dosesValidasNoMes = (vendas = [], planos = [], produtos = [], unidade, mesAAAAMM) => {
    const mapa = aplicarLimiteDoses(vendas, planos, produtos);
    const alvo = String(unidade || '').trim().toUpperCase();
    return vendas.reduce((soma, v) => {
        if (unidadeDe(v) !== alvo || !ehDoseUnica(v.produto)) return soma;
        const dia = safeIsoDate(v.data || v.created_at);
        if (dia.slice(0, 7) !== mesAAAAMM) return soma;
        return soma + qtdValidaProduto(v, mapa);
    }, 0);
};
