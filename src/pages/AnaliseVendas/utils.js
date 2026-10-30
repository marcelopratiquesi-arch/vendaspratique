// ==========================================
// 🧠 UTILITÁRIOS GLOBAIS DE SISTEMA (B2B SaaS)
// Otimizado para Performance, Segurança e i18n
// ==========================================

export const getMeses = (t) => [
    { val: 'TODOS', label: t('analytics.months.all', { defaultValue: 'Todos os Meses' }) }, 
    { val: '01', label: t('analytics.months.jan', { defaultValue: 'Janeiro' }) }, 
    { val: '02', label: t('analytics.months.feb', { defaultValue: 'Fevereiro' }) },
    { val: '03', label: t('analytics.months.mar', { defaultValue: 'Março' }) }, 
    { val: '04', label: t('analytics.months.apr', { defaultValue: 'Abril' }) }, 
    { val: '05', label: t('analytics.months.may', { defaultValue: 'Maio' }) },
    { val: '06', label: t('analytics.months.jun', { defaultValue: 'Junho' }) }, 
    { val: '07', label: t('analytics.months.jul', { defaultValue: 'Julho' }) }, 
    { val: '08', label: t('analytics.months.aug', { defaultValue: 'Agosto' }) },
    { val: '09', label: t('analytics.months.sep', { defaultValue: 'Setembro' }) }, 
    { val: '10', label: t('analytics.months.oct', { defaultValue: 'Outubro' }) }, 
    { val: '11', label: t('analytics.months.nov', { defaultValue: 'Novembro' }) },
    { val: '12', label: t('analytics.months.dec', { defaultValue: 'Dezembro' }) }
];

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

// 🔥 NORMALIZAÇÃO RIGOROSA PARA COMPARAR COM O CATÁLOGO
export const normalizeString = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
};

// 🔥 FORMATAÇÃO VISUAL DO CPF
export const formatarCPF = (cpf) => {
    if (!cpf) return 'Não informado';
    const nums = String(cpf).replace(/\D/g, '');
    if (nums.length === 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return cpf;
};

export const getValorRealDaVenda = (venda, planos, produtos) => {
    const valorBanco = safeNumber(venda.valor);
    if (valorBanco > 0) return valorBanco;

    let precoUnitario = 0;
    const nomeNorm = normalizeString(venda.produto);
    const planoMatch = (planos || []).find(p => normalizeString(p.nome) === nomeNorm);
    const produtoMatch = (produtos || []).find(p => normalizeString(p.nome) === nomeNorm);

    if (planoMatch) precoUnitario = safeNumber(planoMatch.valor);
    else if (produtoMatch) precoUnitario = safeNumber(produtoMatch.valor);

    const qtd = parseInt(venda.quantidade) || 1;
    return precoUnitario * qtd;
};

// 🔥 CÉREBRO CORRIGIDO: O Catálogo é a ÚNICA fonte de verdade.
export const getCategoriaItem = (nomeProduto, planos, produtos) => {
    const nomeNorm = normalizeString(nomeProduto);

    // 1. Busca estrita no catálogo de Planos
    if (planos && planos.length > 0 && planos.some(p => normalizeString(p.nome) === nomeNorm)) {
        return 'PLANO';
    }

    // 2. Busca estrita no catálogo de Produtos
    if (produtos && produtos.length > 0) {
        const matchProd = produtos.find(p => normalizeString(p.nome) === nomeNorm);
        if (matchProd) {
            const tipoProd = normalizeString(matchProd.tipo || '');
            if (tipoProd === 'SERVICO' || tipoProd === 'SERVIÇO') return 'SERVICO';
            return 'PRODUTO'; // Se não tiver tipo explícito "Serviço", no cadastro de produtos ele é Produto físico.
        }
    }

    // 3. Fallback Seguro (A pedido da Regra 3, se não achar não chuta plano)
    // Para não quebrar lançamentos antigos que eram serviços óbvios que ficaram sem catálogo
    if (nomeNorm.includes('DIÁRIA') || nomeNorm.includes('DIARIA') ||
        nomeNorm.includes('AVALIAÇÃO') || nomeNorm.includes('AVALIACAO') ||
        nomeNorm.includes('REAVALIAÇÃO') || nomeNorm.includes('TAXA') ||
        nomeNorm.includes('MULTA') || nomeNorm.includes('DAY USE')) {
        return 'SERVICO';
    }

    // Caiu aqui? Não existe no catálogo nem como plano nem como produto.
    return 'NAO_CLASSIFICADO';
};

export const criarGruposPlanosVazio = () => ({
    "NUTRI": { total: 0, detalhes: {}, cor: "bg-emerald-500", textCor: "text-emerald-600" },
    "PLUS": { total: 0, detalhes: {}, cor: "bg-blue-600", textCor: "text-blue-700" },
    "FIT": { total: 0, detalhes: {}, cor: "bg-indigo-500", textCor: "text-indigo-600" },
    "PERSONAL CLASS": { total: 0, detalhes: {}, cor: "bg-rose-500", textCor: "text-rose-600" }, 
    "OUTROS PLANOS": { total: 0, detalhes: {}, cor: "bg-slate-500", textCor: "text-slate-700" }
});

// ==========================================
// NUTRI É ADICIONAL, NÃO PLANO (decisão do dono, 30/10/2026). FUNÇÃO ÚNICA de todas as telas (Dashboard, Metas,
// Relatórios, Ranking global, Saúde da unidade, resumo do Histórico e CRM/Migração). O Fechamento não usa grupos.
// decomporPlano(nome) → { base, nutri }
// - base: 'PLUS' | 'FIT' | 'PERSONAL CLASS' | 'OUTROS PLANOS' | null → o plano que conta como ENTRADA/ATIVO
// - nutri: true/false → conta como ADICIONAL NUTRI
// Com NUTRI no nome: nutri = true e a base sai do resto do nome (PLUS/AFL, FIT ou PERSONAL). Se o resto não
// tiver nenhum desses (ex.: "PRATIQUE NUTRI", "NUTRI MENSAL"), base = null: é só adicional, não é entrada.
// Sem NUTRI: PLUS ou AFL → PLUS; FIT → FIT; PERSONAL → PERSONAL CLASS; qualquer outro → OUTROS PLANOS.
// Só vale para itens que o catálogo classifica como PLANO (getCategoriaItem). Lida na hora de mostrar:
// não mexe em nenhum lançamento, então vale para todos os meses.
// ==========================================
export const decomporPlano = (nomePlano) => {
    const n = normalizeString(nomePlano);
    const nutri = n.includes('NUTRI');
    const resto = nutri ? n.replace(/\+?\s*NUTRI\b/g, ' ').replace(/\s+/g, ' ').trim() : n;
    let base = null;
    if (resto.includes('PLUS') || resto.includes('AFL')) base = 'PLUS';
    else if (resto.includes('FIT')) base = 'FIT';
    else if (resto.includes('PERSONAL')) base = 'PERSONAL CLASS';
    else if (!nutri) base = 'OUTROS PLANOS';
    return { base, nutri };
};

// CONTAGEM ÚNICA DE PLANOS (Dashboard, Metas, Relatórios, Ranking global, Saúde da unidade e resumo do Histórico)
// Planos vendidos com a regra do card: mesma matrícula + mesmo plano + mesmo dia conta 1 vez só.
// NUTRI É ADICIONAL (decisão do dono, 30/10/2026): cada lançamento é decomposto por decomporPlano em
// plano BASE (Plus/Fit/Personal/Outros, conta como entrada) e/ou ADICIONAL NUTRI (não conta como entrada).
// Devolve:
// - total / contados / grupos[PLUS|FIT|PERSONAL CLASS|OUTROS PLANOS]: só planos BASE (o número do card)
// - nutri = { total, contados } e grupos.NUTRI: os adicionais Nutri (combos + PRATIQUE NUTRI)
// Em grupos[...].detalhes fica a quantidade por nome de plano (o mesmo combo aparece no grupo base e no NUTRI).
export const contarPlanosDoCard = (lista, planos, produtos) => {
    const grupos = criarGruposPlanosVazio();
    const contados = [];
    const contadosNutri = [];
    const vistos = new Set();
    let total = 0;
    let totalNutri = 0;
    const somarNoGrupo = (grupo, prodUpper, qtd) => {
        grupos[grupo].total += qtd;
        grupos[grupo].detalhes[prodUpper] = (grupos[grupo].detalhes[prodUpper] || 0) + qtd;
    };
    lista.forEach(v => {
        const prodUpper = (v.produto || '').toUpperCase();
        if (getCategoriaItem(prodUpper, planos, produtos) !== 'PLANO') return;
        let qtd = parseInt(v.quantidade) || 1;
        const matricula = String(v.matricula ?? '').trim();
        if (matricula) {
            const chave = `${matricula}-${prodUpper}-${safeIsoDate(v.data || v.created_at)}`;
            if (vistos.has(chave)) qtd = 0;
            else vistos.add(chave);
        }
        if (qtd === 0) return;
        const { base, nutri } = decomporPlano(prodUpper);
        if (base) {
            total += qtd;
            somarNoGrupo(base, prodUpper, qtd);
            contados.push({ venda: v, qtd, base, nutri });
        }
        if (nutri) {
            totalNutri += qtd;
            somarNoGrupo('NUTRI', prodUpper, qtd);
            contadosNutri.push({ venda: v, qtd, base, nutri });
        }
    });
    return { grupos, contados, total, nutri: { total: totalNutri, contados: contadosNutri } };
};

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
            map.set(normalizeString(item.nome), item);
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