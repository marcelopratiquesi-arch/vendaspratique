// ==========================================
// 🧠 UTILITÁRIOS GLOBAIS DE SISTEMA (B2B SaaS)
// Otimizado para Performance, Segurança e i18n
// ==========================================

export const meses = [
    { val: 'TODOS', label: 'Todos os Meses' }, { val: '01', label: 'Janeiro' }, { val: '02', label: 'Fevereiro' },
    { val: '03', label: 'Março' }, { val: '04', label: 'Abril' }, { val: '05', label: 'Maio' },
    { val: '06', label: 'Junho' }, { val: '07', label: 'Julho' }, { val: '08', label: 'Agosto' },
    { val: '09', label: 'Setembro' }, { val: '10', label: 'Outubro' }, { val: '11', label: 'Novembro' },
    { val: '12', label: 'Dezembro' }
];

// 🔥 I18N + PERFORMANCE: Cache de formatadores de Moeda separados por idioma
let currentLocale = 'pt-BR';
export const setGlobalLocale = (locale) => { currentLocale = locale; };

const currencyFormatters = {};
export const formatMoney = (val) => {
    if (!currencyFormatters[currentLocale]) {
        currencyFormatters[currentLocale] = new Intl.NumberFormat(currentLocale, { style: 'currency', currency: 'BRL' });
    }
    return currencyFormatters[currentLocale].format(safeNumber(val));
};

export const safeNumber = (val) => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined || val === '') return 0;
    
    const str = String(val).trim();
    if (str.includes(',')) {
        return parseFloat(str.replace(/[^0-9,-]+/g, '').replace(',', '.')) || 0;
    }
    return parseFloat(str.replace(/[^0-9.-]+/g, '')) || 0;
};

// 🔥 BLINDAGEM DE DATAS (Resolve o bug do Excel de passar 'new Date()')
export const safeIsoDate = (dInput) => {
    if (!dInput) return '';

    if (dInput instanceof Date && !isNaN(dInput)) {
        const year = dInput.getFullYear();
        const month = String(dInput.getMonth() + 1).padStart(2, '0');
        const day = String(dInput.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const dStr = String(dInput);
    if (dStr.includes('T')) return dStr.split('T')[0];
    if (dStr.includes('/')) {
        const partes = dStr.split('/');
        if (partes.length === 3) {
            const [d, m, y] = partes;
            return `${y}-${m}-${d}`;
        }
    }
    return dStr;
};

// ---------------------------------------------------------
// REGRAS DE NEGÓCIO DA ANÁLISE DE VENDAS (PRESERVADAS)
// ---------------------------------------------------------
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
        gruposPlanos["PERSONAL CLASS"].total += qtd;
        gruposPlanos["PERSONAL CLASS"].detalhes[prodUpper] = (gruposPlanos["PERSONAL CLASS"].detalhes[prodUpper] || 0) + qtd;
    } else {
        gruposPlanos["OUTROS PLANOS"].total += qtd;
        gruposPlanos["OUTROS PLANOS"].detalhes[prodUpper] = (gruposPlanos["OUTROS PLANOS"].detalhes[prodUpper] || 0) + qtd;
    }
};

// ---------------------------------------------------------
// UTILITÁRIOS EXTRAS DA TABELA DE HISTÓRICO / DUPLICIDADES
// ---------------------------------------------------------

export const formatDataBR = (dInput) => {
    if (!dInput) return '';
    const dStr = String(dInput);
    if (dStr.includes('/')) return dStr; 
    const partes = dStr.split('-');
    if (partes.length === 3) {
        const day = partes[2].split('T')[0].split(' ')[0];
        const month = partes[1];
        const year = partes[0];
        if (currentLocale === 'en-US') return `${month}/${day}/${year}`;
        return `${day}/${month}/${year}`;
    }
    return dStr;
};

export const extrairHoraCriacao = (isoString) => {
    if (!isoString) return '';
    const dataObj = new Date(isoString);
    if (isNaN(dataObj)) return '';
    return dataObj.toLocaleTimeString(currentLocale, { hour: '2-digit', minute: '2-digit' });
};

export const toTitleCase = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/(?:^|\s)\w/g, match => match.toUpperCase());
};

export const buildCatalogoMap = (catalogoArray) => {
    const map = new Map();
    if (!Array.isArray(catalogoArray)) return map;
    catalogoArray.forEach(item => {
        if (item && item.nome && typeof item.nome === 'string') {
            map.set(item.nome.toUpperCase().trim(), item);
        }
    });
    return map;
};

export const gerarChaveDuplicidade = (venda) => {
    if (!venda) return null;

    const unidade = (venda.unidade || 'MATRIZ').toUpperCase().trim();
    const dataVenda = safeIsoDate(venda.data || venda.created_at);
    const produto = (venda.produto || '').toUpperCase().trim();
    
    let identificadorAluno = '';
    
    if (venda.matricula && String(venda.matricula).trim() !== '') {
        identificadorAluno = `MAT_${String(venda.matricula).trim()}`;
    } else {
        const nomeSujo = venda.nome_aluno || venda.nome || 'ALUNO_NAO_IDENTIFICADO';
        identificadorAluno = `NOME_${nomeSujo.toUpperCase().trim().replace(/\s+/g, ' ')}`;
    }

    return `${unidade}|${dataVenda}|${identificadorAluno}|${produto}`;
};