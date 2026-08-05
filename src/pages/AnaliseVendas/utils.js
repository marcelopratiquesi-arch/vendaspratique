export const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
    { val: '03', label: 'Março' }, { val: '04', label: 'Abril' }, { val: '05', label: 'Maio' },
    { val: '06', label: 'Junho' }, { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
    { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' }, { val: '11', label: 'Novembro' },
    { val: '12', label: 'Dezembro' }
];

export const formatMoney = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val);
    if (str.includes(',')) return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

export const safeIsoDate = (dStr) => {
    if (!dStr) return '';
    if (dStr.includes('-')) return dStr.split('T')[0];
    if (dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        return `${y}-${m}-${d}`;
    }
    return dStr;
};

export const getValorRealDaVenda = (venda, planos, produtos) => {
    const valorBanco = safeNumber(venda.valor);
    if (valorBanco > 0) return valorBanco;

    let precoUnitario = 0;
    const planoMatch = planos.find(p => p.nome?.toUpperCase() === venda.produto?.toUpperCase());
    const produtoMatch = produtos.find(p => p.nome?.toUpperCase() === venda.produto?.toUpperCase());

    if (planoMatch) precoUnitario = safeNumber(planoMatch.valor);
    else if (produtoMatch) precoUnitario = safeNumber(produtoMatch.valor);

    const qtd = parseInt(venda.quantidade) || 1;
    return precoUnitario * qtd;
};

export const getCategoriaItem = (nomeProduto, planos, produtos) => {
    const nome = (nomeProduto || '').toUpperCase();

    if (nome.includes('DIÁRIA') || nome.includes('DIARIA') ||
        nome.includes('AVALIAÇÃO') || nome.includes('AVALIACAO') ||
        nome.includes('REAVALIAÇÃO') || nome.includes('TAXA') ||
        nome.includes('MULTA') || nome.includes('DAY USE')) {
        return 'SERVICO';
    }

    if (planos && planos.length > 0 && planos.some(p => p.nome?.toUpperCase() === nome)) return 'PLANO';
    if (produtos && produtos.length > 0 && produtos.some(p => p.nome?.toUpperCase() === nome)) return 'PRODUTO';

    if (nome.includes('NUTRI') || nome.includes('PLUS') || nome.includes('FIT') || nome.includes('PLANO') || nome.includes('MENSAL') || nome.includes('ANUAL') || nome.includes('SSP') || nome.includes('PERSONAL')) {
        return 'PLANO';
    }

    return 'PRODUTO';
};

// ---------------------------------------------------------
// NOVA REGRA: PERSONAL CLASS ISOLADO DOS "OUTROS PLANOS"
// ---------------------------------------------------------
export const criarGruposPlanosVazio = () => ({
    "NUTRI": { total: 0, detalhes: {}, cor: "bg-emerald-500", textCor: "text-emerald-600" },
    "PLUS": { total: 0, detalhes: {}, cor: "bg-blue-600", textCor: "text-blue-700" },
    "FIT": { total: 0, detalhes: {}, cor: "bg-indigo-500", textCor: "text-indigo-600" },
    "PERSONAL CLASS": { total: 0, detalhes: {}, cor: "bg-rose-500", textCor: "text-rose-600" }, 
    "OUTROS PLANOS": { total: 0, detalhes: {}, cor: "bg-slate-500", textCor: "text-slate-700" }
});

export const classificarPlanoEmGrupo = (gruposPlanos, prodUpper, qtd) => {
    if (prodUpper.includes("NUTRI")) {
        gruposPlanos["NUTRI"].total += qtd;
        gruposPlanos["NUTRI"].detalhes[prodUpper] = (gruposPlanos["NUTRI"].detalhes[prodUpper] || 0) + qtd;
    } else if (prodUpper.includes("PLUS")) {
        gruposPlanos["PLUS"].total += qtd;
        gruposPlanos["PLUS"].detalhes[prodUpper] = (gruposPlanos["PLUS"].detalhes[prodUpper] || 0) + qtd;
    } else if (prodUpper.includes("FIT")) {
        gruposPlanos["FIT"].total += qtd;
        gruposPlanos["FIT"].detalhes[prodUpper] = (gruposPlanos["FIT"].detalhes[prodUpper] || 0) + qtd;
    } else if (prodUpper.includes("PERSONAL")) {
        // FILTRANDO O PERSONAL AQUI!
        gruposPlanos["PERSONAL CLASS"].total += qtd;
        gruposPlanos["PERSONAL CLASS"].detalhes[prodUpper] = (gruposPlanos["PERSONAL CLASS"].detalhes[prodUpper] || 0) + qtd;
    } else {
        gruposPlanos["OUTROS PLANOS"].total += qtd;
        gruposPlanos["OUTROS PLANOS"].detalhes[prodUpper] = (gruposPlanos["OUTROS PLANOS"].detalhes[prodUpper] || 0) + qtd;
    }
};