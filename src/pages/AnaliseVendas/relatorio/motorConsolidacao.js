// src/pages/AnaliseVendas/relatorio/motorConsolidacao.js
import { safeIsoDate, normalizeString, getCategoriaItem, decomporPlano } from '../utils.js';

export const ORDEM_CLASSICA = [
    "NUTRI",
    "PLUS",
    "FIT",
    "PERSONAL CLASS",
    "PROMOÇÕES",
    "FÉRIAS",
    "OUTROS PLANOS",
    "PRODUTOS",
    "SERVIÇOS",
    "NÃO CLASSIFICADOS"
];

export const COLUNAS_MATRIZ = [
    { key: 'PLUS', escopo: 'PLANOS', label: 'PLUS', icone: '⭐', grupos: ['PLUS'], badgeBg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100', headerColor: 'text-blue-600' },
    { key: 'FIT', escopo: 'PLANOS', label: 'FIT', icone: '🏃', grupos: ['FIT'], badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', headerColor: 'text-indigo-600' },
    { key: 'PERSONAL', escopo: 'PLANOS', label: 'PERSONAL', icone: '🏋️', grupos: ['PERSONAL CLASS'], badgeBg: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', headerColor: 'text-rose-600' },
    { key: 'OUTROS_PLANOS', escopo: 'PLANOS', label: 'OUTROS PL.', icone: '🧩', grupos: ['PROMOÇÕES', 'FÉRIAS', 'OUTROS PLANOS'], badgeBg: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200', headerColor: 'text-slate-600' },
    // Nutri: coluna de ADICIONAL (não entra no total de planos; aparece separada na tabela)
    { key: 'NUTRI', escopo: 'PLANOS', label: 'NUTRI', adicional: true, icone: '🥗', grupos: ['NUTRI'], badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', headerColor: 'text-emerald-600' },
    { key: 'PRODUTOS', escopo: 'PRODUTOS', label: 'PRODUTOS', icone: '🛍️', grupos: ['PRODUTOS'], badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', headerColor: 'text-amber-600' },
    { key: 'SERVICOS', escopo: 'SERVICOS', label: 'SERVIÇOS', icone: '🧾', grupos: ['SERVIÇOS', 'NÃO CLASSIFICADOS'], badgeBg: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100', headerColor: 'text-violet-600' }
];

// Nutri é ADICIONAL (decisão do dono, 30/10/2026): o grupo NUTRI aparece como adicional e não soma no total de planos
export const ROTULO_NUTRI_ADICIONAL = 'NUTRI (ADICIONAL)';

// "Outros planos" dos relatórios é dividido em Promoções, Férias e Outros (como antes)
const subgrupoDeOutros = (nomeNorm) => {
    if (nomeNorm.includes('1200') || nomeNorm.includes('PROMO')) return 'PROMOÇÕES';
    if (nomeNorm.includes('FÉRIAS') || nomeNorm.includes('FERIAS')) return 'FÉRIAS';
    return 'OUTROS PLANOS';
};

// Grupos dos relatórios em que um lançamento entra. Plano: decomporPlano → grupo BASE e/ou NUTRI (adicional).
// O mesmo combo (ex.: PLUS + NUTRI) entra no PLUS e no NUTRI; o total de vendas conta o lançamento 1 vez só.
export const gruposDoLancamento = (nome, categoria) => {
    if (categoria === 'PRODUTO') return ['PRODUTOS'];
    if (categoria === 'SERVICO') return ['SERVIÇOS'];
    if (categoria !== 'PLANO') return ['NÃO CLASSIFICADOS'];
    const nomeNorm = normalizeString(nome);
    const { base, nutri } = decomporPlano(nome);
    const lista = [];
    if (base) lista.push(base === 'OUTROS PLANOS' ? subgrupoDeOutros(nomeNorm) : base);
    if (nutri) lista.push('NUTRI');
    return lista;
};

const INFO_ADMIN = {
    'NUTRI': { grupo: ROTULO_NUTRI_ADICIONAL, tipo: 'AGRUPADO', order: 10, icone: '🥗', cor: 'text-emerald-600' },
    'PLUS': { grupo: 'PLUS', tipo: 'AGRUPADO', order: 20, icone: '⭐', cor: 'text-blue-600' },
    'FIT': { grupo: 'FIT', tipo: 'AGRUPADO', order: 30, icone: '🏃', cor: 'text-indigo-600' },
    'PERSONAL CLASS': { grupo: 'PERSONAL CLASS', tipo: 'INDIVIDUAL', order: 40, icone: '🏋️', cor: 'text-rose-600' },
    'PROMOÇÕES': { grupo: 'PROMOÇÕES', tipo: 'INDIVIDUAL', order: 50, icone: '🎯', cor: 'text-purple-600' },
    'FÉRIAS': { grupo: 'FÉRIAS', tipo: 'AGRUPADO', order: 60, icone: '🏖️', cor: 'text-orange-500' },
    'OUTROS PLANOS': { grupo: 'OUTROS PLANOS', tipo: 'AGRUPADO', order: 90, icone: '🧩', cor: 'text-slate-600' },
    'PRODUTOS': { grupo: 'PRODUTOS', tipo: 'AGRUPADO', order: 100, icone: '🛍️', cor: 'text-amber-600' },
    'SERVIÇOS': { grupo: 'SERVIÇOS', tipo: 'AGRUPADO', order: 200, icone: '🧾', cor: 'text-violet-600' },
    'NÃO CLASSIFICADOS': { grupo: 'NÃO CLASSIFICADOS', tipo: 'AGRUPADO', order: 300, icone: '❓', cor: 'text-slate-400' },
};

// Resumo executivo: lista de grupos (com ícone/ordem) em que o lançamento entra
export const classificarParaAdmin = (nome, categoria) => gruposDoLancamento(nome, categoria).map(g => INFO_ADMIN[g]);

export const processarConsolidadas = ({
    vendasFiltradas = [],
    visitantesFiltrados = [],
    avaliacoesFiltradas = [],
    planos = [],
    produtos = []
}) => {
    const relatorioPorUnidade = {};
    let vendasGlobal = 0;

    const inicializarUnidade = (unidade) => {
        if (!relatorioPorUnidade[unidade]) {
            relatorioPorUnidade[unidade] = {
                totalGeralVendas: 0,
                vendedoresTotal: {},
                visitantes: [],
                avaliacoes: [],
                grupos: {
                    "NUTRI": { total: 0, itens: {}, cor: "text-emerald-600", bgIcone: "bg-emerald-100 text-emerald-600", icone: "🥗", escopo: "PLANOS" },
                    "PLUS": { total: 0, itens: {}, cor: "text-blue-600", bgIcone: "bg-blue-100 text-blue-600", icone: "⭐", escopo: "PLANOS" },
                    "FIT": { total: 0, itens: {}, cor: "text-indigo-600", bgIcone: "bg-indigo-100 text-indigo-600", icone: "🏃", escopo: "PLANOS" },
                    "PERSONAL CLASS": { total: 0, itens: {}, cor: "text-rose-600", bgIcone: "bg-rose-100 text-rose-600", icone: "🏋️", escopo: "PLANOS" },
                    "PROMOÇÕES": { total: 0, itens: {}, cor: "text-purple-600", bgIcone: "bg-purple-100 text-purple-600", icone: "🎯", escopo: "PLANOS" },
                    "FÉRIAS": { total: 0, itens: {}, cor: "text-orange-500", bgIcone: "bg-orange-100 text-orange-500", icone: "🏖️", escopo: "PLANOS" },
                    "OUTROS PLANOS": { total: 0, itens: {}, cor: "text-slate-600", bgIcone: "bg-slate-200 text-slate-600", icone: "🧩", escopo: "PLANOS" },
                    "PRODUTOS": { total: 0, itens: {}, cor: "text-amber-600", bgIcone: "bg-amber-100 text-amber-600", icone: "🛍️", escopo: "PRODUTOS" },
                    "SERVIÇOS": { total: 0, itens: {}, cor: "text-violet-600", bgIcone: "bg-violet-100 text-violet-600", icone: "🧾", escopo: "SERVICOS" },
                    "NÃO CLASSIFICADOS": { total: 0, itens: {}, cor: "text-slate-400", bgIcone: "bg-slate-100 text-slate-400", icone: "❓", escopo: "SERVICOS" }
                },
                gruposAdmin: {}
            };
        }
    };

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);

        let qtd = parseInt(v.quantidade, 10) || 1;
        const prodOriginal = (v.produto || 'ITEM NÃO IDENTIFICADO');
        const prodUpper = prodOriginal.toUpperCase().trim();
        const primeiroNomeBruto = v.vendedor ? v.vendedor.trim().split(/\s+/)[0] : 'SISTEMA';
        const vendPrimeiroNome = primeiroNomeBruto.charAt(0).toUpperCase() + primeiroNomeBruto.slice(1).toLowerCase();

        const categoriaMestre = getCategoriaItem(prodOriginal, planos, produtos);

        // Deduplicação estrita para PLANOS: Matrícula + Produto + Data
        if (categoriaMestre === 'PLANO' && v.matricula && String(v.matricula).trim() !== '') {
            const dataLimpa = safeIsoDate(v.data || v.created_at);
            const chaveUnica = `${String(v.matricula).trim()}-${prodUpper}-${dataLimpa}`;

            if (transacoesUnicas.has(chaveUnica)) {
                qtd = 0;
            } else {
                transacoesUnicas.add(chaveUnica);
            }
        }

        const registro = relatorioPorUnidade[unidade];
        registro.totalGeralVendas += qtd;
        vendasGlobal += qtd;
        registro.vendedoresTotal[vendPrimeiroNome] = (registro.vendedoresTotal[vendPrimeiroNome] || 0) + qtd;

        // Plano: grupo base e/ou NUTRI (adicional). Produto, serviço e não classificado: como antes.
        gruposDoLancamento(prodUpper, categoriaMestre).forEach(grupoAlvo => {
            registro.grupos[grupoAlvo].total += qtd;
            if (!registro.grupos[grupoAlvo].itens[prodUpper]) {
                registro.grupos[grupoAlvo].itens[prodUpper] = { total: 0, vendedores: {}, vendasAuditaveis: [] };
            }
            registro.grupos[grupoAlvo].itens[prodUpper].total += qtd;
            registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] =
                (registro.grupos[grupoAlvo].itens[prodUpper].vendedores[vendPrimeiroNome] || 0) + qtd;

            if (qtd > 0) {
                registro.grupos[grupoAlvo].itens[prodUpper].vendasAuditaveis.push({ ...v, qtdConsolidada: qtd });
            }
        });

        classificarParaAdmin(prodOriginal, categoriaMestre).forEach(clAdmin => {
            if (!registro.gruposAdmin[clAdmin.grupo]) {
                registro.gruposAdmin[clAdmin.grupo] = {
                    grupo: clAdmin.grupo,
                    total: 0,
                    itens: {},
                    tipo: clAdmin.tipo,
                    order: clAdmin.order,
                    icone: clAdmin.icone,
                    cor: clAdmin.cor
                };
            }
            registro.gruposAdmin[clAdmin.grupo].total += qtd;

            if (!registro.gruposAdmin[clAdmin.grupo].itens[prodUpper]) {
                registro.gruposAdmin[clAdmin.grupo].itens[prodUpper] = { total: 0 };
            }
            registro.gruposAdmin[clAdmin.grupo].itens[prodUpper].total += qtd;
        });
    });

    visitantesFiltrados.forEach(v => {
        if (v.origem && v.origem !== 'RECEPCAO') return;
        const unidade = v.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].visitantes.push(v);
    });

    avaliacoesFiltradas.forEach(a => {
        const unidade = a.unidade || 'SEM UNIDADE';
        inicializarUnidade(unidade);
        relatorioPorUnidade[unidade].avaliacoes.push(a);
    });

    const unidadesOrdenadas = Object.keys(relatorioPorUnidade).sort();

    // Processamento base da Matriz Executiva Global (4 escopos independentes)
    const baseRankingUnidades = unidadesOrdenadas
        .map(u => {
            const dados = relatorioPorUnidade[u];
            const colunas = {};
            const registrosPorColuna = {};
            const todosRegistrosUnidade = [];
            const registrosPlanosUnidade = [];
            const registrosProdutosUnidade = [];
            const registrosServicosUnidade = [];
            const vistos = new Set();

            COLUNAS_MATRIZ.forEach(col => {
                let soma = 0;
                const regs = [];
                col.grupos.forEach(gName => {
                    const grp = dados.grupos[gName];
                    if (grp) {
                        soma += grp.total || 0;
                        Object.values(grp.itens).forEach(it => {
                            if (it.vendasAuditaveis?.length) {
                                regs.push(...it.vendasAuditaveis);
                            }
                        });
                    }
                });
                colunas[col.key] = soma;
                registrosPorColuna[col.key] = regs;
                // O mesmo combo está no grupo base e no Nutri: guarda cada lançamento uma vez só
                regs.forEach(r => { const chave = r.id ?? r; if (!vistos.has(chave)) { vistos.add(chave); todosRegistrosUnidade.push(r); } });

                if (col.adicional) return; // Nutri não entra na lista de planos
                if (col.escopo === 'PLANOS') registrosPlanosUnidade.push(...regs);
                else if (col.escopo === 'PRODUTOS') registrosProdutosUnidade.push(...regs);
                else if (col.escopo === 'SERVICOS') registrosServicosUnidade.push(...regs);
            });

            // Total de planos = só planos base (o Nutri é adicional e não soma)
            const totalPlanos = (colunas.PLUS || 0) + (colunas.FIT || 0) + (colunas.PERSONAL || 0) + (colunas.OUTROS_PLANOS || 0);
            const totalProdutos = colunas.PRODUTOS || 0;
            const totalServicos = colunas.SERVICOS || 0;

            const itensProdutosDetalhados = Object.entries(dados.grupos['PRODUTOS']?.itens || {})
                .filter(([_, d]) => d.total > 0)
                .sort((a, b) => b[1].total - a[1].total);

            const itensServicosDetalhados = [
                ...Object.entries(dados.grupos['SERVIÇOS']?.itens || {}),
                ...Object.entries(dados.grupos['NÃO CLASSIFICADOS']?.itens || {})
            ]
                .filter(([_, d]) => d.total > 0)
                .sort((a, b) => b[1].total - a[1].total);

            return {
                nome: u,
                vendas: dados.totalGeralVendas,
                totalPlanos,
                totalProdutos,
                totalServicos,
                visitantesCount: dados.visitantes.length,
                avaliacoesCount: dados.avaliacoes.length,
                colunas,
                registrosPorColuna,
                todosRegistrosUnidade,
                registrosPlanosUnidade,
                registrosProdutosUnidade,
                registrosServicosUnidade,
                itensProdutosDetalhados,
                itensServicosDetalhados
            };
        })
        .filter(u => u.vendas > 0);

    const totaisRedeMatriz = COLUNAS_MATRIZ.reduce((acc, col) => {
        acc[col.key] = baseRankingUnidades.reduce((sum, u) => sum + (u.colunas[col.key] || 0), 0);
        return acc;
    }, { totalPlanos: 0, totalProdutos: 0, totalServicos: 0 });

    totaisRedeMatriz.totalPlanos = baseRankingUnidades.reduce((sum, u) => sum + u.totalPlanos, 0);
    totaisRedeMatriz.totalProdutos = baseRankingUnidades.reduce((sum, u) => sum + u.totalProdutos, 0);
    totaisRedeMatriz.totalServicos = baseRankingUnidades.reduce((sum, u) => sum + u.totalServicos, 0);

    return {
        relatorioPorUnidade,
        unidadesOrdenadas,
        vendasGlobal,
        baseRankingUnidades,
        totaisRedeMatriz
    };
};

export const filtrarEOrdenarRanking = (baseRankingUnidades = [], criterioRanking = 'TOTAL', colunaOrdemMatriz = null) => {
    return [...baseRankingUnidades]
        .filter(u => {
            if (criterioRanking === 'PLANOS') return u.totalPlanos > 0;
            if (criterioRanking === 'PRODUTOS') return u.totalProdutos > 0;
            if (criterioRanking === 'SERVICOS') return u.totalServicos > 0;
            return u.vendas > 0;
        })
        .sort((a, b) => {
            if (colunaOrdemMatriz) {
                const valA = a.colunas[colunaOrdemMatriz] || 0;
                const valB = b.colunas[colunaOrdemMatriz] || 0;
                if (valB !== valA) return valB - valA;
            }
            if (criterioRanking === 'PLANOS') {
                if (b.totalPlanos !== a.totalPlanos) return b.totalPlanos - a.totalPlanos;
                return b.vendas - a.vendas;
            }
            if (criterioRanking === 'PRODUTOS') {
                if (b.totalProdutos !== a.totalProdutos) return b.totalProdutos - a.totalProdutos;
                return b.vendas - a.vendas;
            }
            if (criterioRanking === 'SERVICOS') {
                if (b.totalServicos !== a.totalServicos) return b.totalServicos - a.totalServicos;
                return b.vendas - a.vendas;
            }
            if (b.vendas !== a.vendas) return b.vendas - a.vendas;
            return b.totalPlanos - a.totalPlanos;
        });
};