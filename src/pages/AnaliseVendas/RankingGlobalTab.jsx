// src/pages/AnaliseVendas/RankingGlobalTab.jsx
import React, { useState, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
    COLUNAS_MATRIZ,
    processarConsolidadas,
    filtrarEOrdenarRanking
} from './relatorio/motorConsolidacao.js';
import {
    exportarRelatorioGeralCSV,
    montarTextoGlobalWhatsapp
} from './relatorio/exportadorSeguro.js';
import { useResgateCpf } from './relatorio/useResgateCpf.js';
import ModalAuditoria from './relatorio/ModalAuditoria.jsx';
import {
    Download,
    Share2,
    ArrowUpDown,
    FileX2,
    ShieldAlert
} from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

// Visual limpo (decisão do dono, 29/10/2026): números em cinza escuro, uma cor só (azul) e
// a célula fica mais azul quanto maior o número na coluna. Zero = "—".
const tomDaCelula = (valor, maximo) => {
    if (!valor || !maximo) return '';
    const r = valor / maximo;
    if (r >= 1) return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:border-blue-500';
    if (r >= 0.66) return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 dark:bg-blue-500/30 dark:text-blue-200 dark:border-blue-500/30';
    if (r >= 0.33) return 'bg-blue-50 text-blue-800 border-blue-100 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/20';
    return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800';
};

const MEDALHAS = ['🥇', '🥈', '🥉'];
const doisDigitos = (n) => String(n || 0).padStart(2, '0');

const RankingGlobalTab = ({
    vendasFiltradas = [],
    visitantesFiltrados = [],
    avaliacoesFiltradas = [],
    planos = [],
    produtos = [],
    temVisaoGlobal = false,
    labelFiltroAtual = '',
    abrirModalWhatsapp
}) => {
    const { t, locale, language } = useI18n();
    const langAtual = locale || language || 'pt-BR';

    const [visaoDetalhada, setVisaoDetalhada] = useState(false);
    const [criterioRanking, setCriterioRanking] = useState('TOTAL');
    const [colunaOrdemMatriz, setColunaOrdemMatriz] = useState(null);

    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        tipoTabela: '',
        titulo: '',
        subtitulo: '',
        registros: [],
        totalItensUnicos: 0
    });

    // 🧠 Motor de Consolidação Único
    const {
        relatorioPorUnidade,
        unidadesOrdenadas,
        vendasGlobal,
        baseRankingUnidades,
        totaisRedeMatriz
    } = useMemo(() => {
        return processarConsolidadas({
            vendasFiltradas,
            visitantesFiltrados,
            avaliacoesFiltradas,
            planos,
            produtos
        });
    }, [vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas, planos, produtos]);

    // 🪝 Hook de Resgate de CPFs e Nomes no Supabase
    const {
        dicionarioPessoas,
        cacheAlunosBanco,
        buscandoCpfsBanco,
        extrairDadosPessoa
    } = useResgateCpf({
        vendasFiltradas,
        visitantesFiltrados,
        avaliacoesFiltradas,
        modalConfig
    });

    // 📊 Ordenação e Filtro Dinâmico da Matriz
    const rankingUnidades = useMemo(() => {
        return filtrarEOrdenarRanking(baseRankingUnidades, criterioRanking, colunaOrdemMatriz);
    }, [baseRankingUnidades, criterioRanking, colunaOrdemMatriz]);

    // Nutri é ADICIONAL (decisão do dono, 30/10/2026): coluna separada (borda tracejada e fundo verde-claro), fora do total de planos
    const CLASSE_ADICIONAL = 'border-l-2 border-dashed border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-500/5';

    const colunasMatrizVisiveis = useMemo(() => {
        return COLUNAS_MATRIZ.filter(col => {
            if (criterioRanking === 'PLANOS') return col.escopo === 'PLANOS';
            if (criterioRanking === 'PRODUTOS') return col.escopo === 'PRODUTOS';
            if (criterioRanking === 'SERVICOS') return col.escopo === 'SERVICOS';
            return true;
        });
    }, [criterioRanking]);

    // Maior número de cada coluna (para o tom azul da célula)
    const maximoPorColuna = useMemo(() => {
        const m = { TOTAL: 0, PLANOS: 0 };
        rankingUnidades.forEach(u => {
            m.TOTAL = Math.max(m.TOTAL, u.vendas || 0);
            m.PLANOS = Math.max(m.PLANOS, u.totalPlanos || 0);
            COLUNAS_MATRIZ.forEach(c => { m[c.key] = Math.max(m[c.key] || 0, u.colunas[c.key] || 0); });
        });
        return m;
    }, [rankingUnidades]);

    // 🔒 BLINDAGEM DE SEGURANÇA: Oculta completamente para Líder e Recepção (depois dos hooks, regra do React)
    if (!temVisaoGlobal) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center shadow-sm dark:bg-slate-900 dark:border-slate-800">
                <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/30">
                    <ShieldAlert className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">
                    {tx("Acesso Restrito à Diretoria / Mentoria")}
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1 max-w-md dark:text-slate-400">
                    {tx("A Matriz Executiva e o Ranking Global da rede estão disponíveis exclusivamente para perfis com visão global (Admin e Mentor).")}
                </p>
            </div>
        );
    }

    const handleTrocarEscopoRanking = (novoEscopo) => {
        setCriterioRanking(novoEscopo);
        setColunaOrdemMatriz(null);
    };

    const handleOrdenarPorColunaMatriz = (colKey) => {
        setColunaOrdemMatriz(prev => (prev === colKey ? null : colKey));
    };

    const abrirModalAuditoria = (titulo, unidade, tipoTabela, registros, totalUnicos) => {
        setModalConfig({
            isOpen: true,
            titulo,
            subtitulo: `${unidade} — Ref: ${labelFiltroAtual}`,
            tipoTabela,
            registros: registros || [],
            totalItensUnicos: totalUnicos || 0
        });
    };

    const handleExportarCSV = () => {
        exportarRelatorioGeralCSV({
            vendasFiltradas,
            unidadesOrdenadas,
            relatorioPorUnidade,
            visaoDetalhada,
            extrairDadosPessoa,
            dicionarioPessoas,
            cacheAlunosBanco,
            t
        });
    };

    const handleGerarWhatsappGlobal = () => {
        if (unidadesOrdenadas.length === 0) {
            avisar(t('analytics.report.noDataWpp', { defaultValue: "Não há dados para gerar relatório com os filtros atuais." }));
            return;
        }
        const txt = montarTextoGlobalWhatsapp({
            rankingUnidades,
            relatorioPorUnidade,
            vendasGlobal,
            visaoDetalhada,
            labelFiltroAtual,
            langAtual,
            t
        });
        abrirModalWhatsapp(txt, {
            titulo: t('analytics.report.wppGlobalModal', { defaultValue: 'Resumo Global' }),
            icone: 'share-2',
            cor: 'blue'
        });
    };

    const top3Unidades = rankingUnidades.slice(0, 3);
    const totalEscopoAtivoRede = criterioRanking === 'PLANOS'
        ? totaisRedeMatriz.totalPlanos
        : criterioRanking === 'PRODUTOS'
        ? totaisRedeMatriz.totalProdutos
        : criterioRanking === 'SERVICOS'
        ? totaisRedeMatriz.totalServicos
        : vendasGlobal;

    const valorDoEscopo = (uni) => (criterioRanking === 'PLANOS'
        ? uni.totalPlanos
        : criterioRanking === 'PRODUTOS'
        ? uni.totalProdutos
        : criterioRanking === 'SERVICOS'
        ? uni.totalServicos
        : uni.vendas);

    const registrosDoEscopo = (uni) => (criterioRanking === 'PLANOS'
        ? uni.registrosPlanosUnidade
        : criterioRanking === 'PRODUTOS'
        ? uni.registrosProdutosUnidade
        : criterioRanking === 'SERVICOS'
        ? uni.registrosServicosUnidade
        : uni.todosRegistrosUnidade);

    const rotuloDoEscopo = criterioRanking === 'PLANOS'
        ? 'Planos Vendidos'
        : criterioRanking === 'PRODUTOS'
        ? 'Produtos Vendidos'
        : criterioRanking === 'SERVICOS'
        ? 'Serviços Vendidos'
        : 'Vendas Totais';

    const pctDaRede = (v) => (totalEscopoAtivoRede > 0 ? Math.round((v / totalEscopoAtivoRede) * 100) : 0);

    const escopos = [
        ['TOTAL', 'Total geral', vendasGlobal],
        ['PLANOS', 'Só planos', totaisRedeMatriz.totalPlanos],
        ['PRODUTOS', 'Só produtos', totaisRedeMatriz.totalProdutos],
        ['SERVICOS', 'Só serviços', totaisRedeMatriz.totalServicos],
    ];

    const classeBotaoNumero = 'inline-flex items-center justify-center min-w-[40px] px-2.5 py-1 rounded-lg text-[12px] font-black border tabular-nums transition-colors cursor-pointer';

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out] pb-10">
            {/* Modal de Auditoria c/ Busca Interna e Exportação */}
            <ModalAuditoria
                modalConfig={modalConfig}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                dicionarioPessoas={dicionarioPessoas}
                cacheAlunosBanco={cacheAlunosBanco}
                buscandoCpfsBanco={buscandoCpfsBanco}
                extrairDadosPessoa={extrairDadosPessoa}
            />

            {/* RESUMO DA REDE (faixa fina) + EXPORTAÇÃO */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 dark:bg-slate-900 dark:border-slate-800">
                <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx("Total Rede")}</span>
                        <span className="text-lg font-black text-slate-800 tabular-nums dark:text-white">{vendasGlobal}</span>
                    </div>
                    <div className="h-5 w-px bg-slate-200 hidden sm:block self-center dark:bg-slate-700" />
                    {[['Planos', totaisRedeMatriz.totalPlanos], ['Produtos', totaisRedeMatriz.totalProdutos], ['Serviços', totaisRedeMatriz.totalServicos]].map(([rotulo, valor]) => (
                        <div key={rotulo} className="flex items-baseline gap-1.5">
                            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{tx(rotulo)}</span>
                            <span className="text-base font-black text-slate-700 tabular-nums dark:text-slate-200">{valor}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1 dark:bg-slate-800">
                        {[[false, 'Resumo'], [true, 'Detalhado']].map(([valor, rotulo]) => (
                            <button key={rotulo} type="button" onClick={() => setVisaoDetalhada(valor)}
                                className={`h-8 px-3 rounded-lg text-[12px] transition-colors ${visaoDetalhada === valor ? 'bg-white shadow-sm text-blue-700 font-extrabold dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 font-bold dark:text-slate-400 dark:hover:text-white'}`}>
                                {tx(rotulo)}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={handleExportarCSV}
                        className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold flex items-center gap-2 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-200">
                        <Download className="w-4 h-4" />{tx("Planilha")}
                    </button>
                    <button type="button" onClick={handleGerarWhatsappGlobal}
                        className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold flex items-center gap-2 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 dark:text-slate-200">
                        <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{tx("WhatsApp Rede")}
                    </button>
                </div>
            </div>

            {/* RANKING + MATRIZ */}
            {baseRankingUnidades.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center h-56 dark:bg-slate-900 dark:border-slate-800">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4 dark:bg-slate-800">
                        <FileX2 className="w-7 h-7 text-slate-400" />
                    </div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                        {tx("Nenhuma venda encontrada para o período selecionado.")}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
                    {/* Cabeçalho + categoria */}
                    <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 dark:border-slate-800">
                        <div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest dark:text-white">{tx("Ranking da rede")}</h3>
                            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                {tx("Clique nos números para auditar os alunos ou no título da coluna para ordenar •")}{' '}{rankingUnidades.length}{' '}{tx("Unidades Ativas")}
                            </p>
                        </div>
                        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto custom-scrollbar gap-1 max-w-full dark:bg-slate-800" role="tablist" aria-label={tx("Categoria:")}>
                            {escopos.map(([id, rotulo, qtd]) => {
                                const ativo = criterioRanking === id;
                                return (
                                    <button key={id} type="button" role="tab" aria-selected={ativo} onClick={() => handleTrocarEscopoRanking(id)}
                                        className={`h-8 px-3 rounded-lg text-[12px] whitespace-nowrap flex items-center gap-1.5 transition-colors ${ativo ? 'bg-white shadow-sm text-blue-700 font-extrabold dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 font-bold dark:text-slate-400 dark:hover:text-white'}`}>
                                        {tx(rotulo)}
                                        <span className={`text-[11px] tabular-nums ${ativo ? 'text-blue-500' : 'text-slate-400'}`}>{qtd}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pódio (faixa fina) */}
                    {top3Unidades.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 border-b border-slate-200 bg-slate-50 dark:bg-slate-800/60 dark:divide-slate-800 dark:border-slate-800">
                            {top3Unidades.map((uni, idx) => {
                                const valor = valorDoEscopo(uni);
                                const itensTop = criterioRanking === 'PRODUTOS' ? uni.itensProdutosDetalhados : criterioRanking === 'SERVICOS' ? uni.itensServicosDetalhados : null;
                                return (
                                    <button
                                        key={uni.nome}
                                        type="button"
                                        onClick={() => abrirModalAuditoria(`${rotuloDoEscopo} — ${uni.nome}`, uni.nome, 'VENDA', registrosDoEscopo(uni), valor)}
                                        className="text-left px-5 py-3.5 hover:bg-white transition-colors flex items-center gap-3 min-w-0 dark:hover:bg-slate-900"
                                        title={tx("Clique para auditar os alunos desta unidade")}
                                    >
                                        <span className="text-xl shrink-0" aria-label={tx("{pos}º lugar", { pos: idx + 1 })}>{MEDALHAS[idx]}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate dark:text-white" title={uni.nome}>{uni.nome}</p>
                                            <p className="text-[11px] font-semibold text-slate-500 truncate dark:text-slate-400">
                                                {itensTop
                                                    ? itensTop.slice(0, 2).map(([nome, d]) => `${d.total}× ${nome}`).join(' · ')
                                                    : criterioRanking === 'PLANOS'
                                                    ? `NUTRI ${uni.colunas.NUTRI || 0} · PLUS ${uni.colunas.PLUS || 0} · FIT ${uni.colunas.FIT || 0}`
                                                    : tx("{p} planos · {pr} produtos · {s} serviços", { p: uni.totalPlanos, pr: uni.totalProdutos, s: uni.totalServicos })}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-lg font-black text-slate-800 leading-none tabular-nums dark:text-white">{valor}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1">{pctDaRede(valor)}{tx("% da Rede")}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Matriz */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[750px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 dark:bg-slate-800/60 dark:border-slate-800">
                                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-14 text-center dark:text-slate-400">{tx("Pos")}</th>
                                    <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[180px] sticky left-0 bg-slate-50 z-10 dark:bg-slate-800 dark:text-slate-400">{tx("Unidade")}</th>

                                    {criterioRanking === 'TOTAL' && (
                                        <th onClick={() => setColunaOrdemMatriz(null)} title={tx("Ordenar pelo Total Geral")}
                                            className={`py-3 px-3 text-[10px] font-black uppercase tracking-widest text-center w-24 cursor-pointer select-none transition-colors ${colunaOrdemMatriz === null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                            {tx("Total Geral")}
                                        </th>
                                    )}

                                    {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                        <th onClick={() => setColunaOrdemMatriz(null)} title={tx("Ordenar pelo Total de Planos")}
                                            className={`py-3 px-3 text-[10px] font-black uppercase tracking-widest text-center w-24 cursor-pointer select-none border-r border-slate-200 transition-colors dark:border-slate-800 ${criterioRanking === 'PLANOS' && colunaOrdemMatriz === null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                            {criterioRanking === 'PLANOS' ? tx("Total Planos") : tx("Planos")}
                                        </th>
                                    )}

                                    {colunasMatrizVisiveis.map(col => {
                                        const isOrdenada = colunaOrdemMatriz === col.key;
                                        return (
                                            <th key={col.key} onClick={() => handleOrdenarPorColunaMatriz(col.key)} title={tx("Clique para ordenar por {label}", { label: col.label })}
                                                className={`py-3 px-2.5 text-[10px] font-black uppercase tracking-wider text-center w-24 cursor-pointer select-none transition-colors ${col.adicional ? CLASSE_ADICIONAL : ''} ${isOrdenada ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                                                <span className="inline-flex items-center gap-1">
                                                    {tx(col.label)}
                                                    <ArrowUpDown className={`w-3 h-3 ${isOrdenada ? 'opacity-100' : 'opacity-30'}`} />
                                                </span>
                                                {col.adicional && <span className="block text-[10px] font-bold normal-case tracking-normal text-emerald-700 dark:text-emerald-400">{tx('adicional')}</span>}
                                            </th>
                                        );
                                    })}

                                    {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                        <th className="py-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                                            {tx("Composição de Itens Vendidos (Clique para auditar)")}
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rankingUnidades.length === 0 ? (
                                    <tr>
                                        <td colSpan="12" className="py-12 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                                            {tx("Nenhuma venda registrada nesta categoria para o período selecionado.")}
                                        </td>
                                    </tr>
                                ) : (
                                    rankingUnidades.map((uni, idx) => {
                                        const valorEscopoUnidade = valorDoEscopo(uni);
                                        const listaItensEspecificos = criterioRanking === 'PRODUTOS'
                                            ? uni.itensProdutosDetalhados
                                            : uni.itensServicosDetalhados;

                                        return (
                                            <tr key={uni.nome} className="bg-white hover:bg-slate-50 transition-colors dark:bg-slate-900 dark:hover:bg-slate-800/40">
                                                <td className="py-3 px-4 text-center">
                                                    {idx < 3
                                                        ? <span className="text-base" aria-label={tx("{pos}º lugar", { pos: idx + 1 })}>{MEDALHAS[idx]}</span>
                                                        : <span className="text-[12px] font-black text-slate-400 tabular-nums">{idx + 1}º</span>}
                                                </td>
                                                <td className="py-3 px-4 font-black text-slate-800 uppercase tracking-tight text-xs sticky left-0 bg-white z-10 border-r border-slate-100 dark:text-white dark:bg-slate-900 dark:border-slate-800">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate">{uni.nome}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0" title={tx("Participação no total da rede")}>
                                                            {pctDaRede(valorEscopoUnidade)}%
                                                        </span>
                                                    </div>
                                                </td>

                                                {criterioRanking === 'TOTAL' && (
                                                    <td className="py-3 px-3 text-center">
                                                        <button type="button"
                                                            onClick={() => abrirModalAuditoria(`Todas as Vendas — ${uni.nome}`, uni.nome, 'VENDA', uni.todosRegistrosUnidade, uni.vendas)}
                                                            className={`${classeBotaoNumero} ${tomDaCelula(uni.vendas, maximoPorColuna.TOTAL)}`}
                                                            title={tx("Auditar todas as vendas da unidade")}>
                                                            {doisDigitos(uni.vendas)}
                                                        </button>
                                                    </td>
                                                )}

                                                {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                                    <td className="py-3 px-3 text-center border-r border-slate-100 dark:border-slate-800">
                                                        {uni.totalPlanos > 0 ? (
                                                            <button type="button"
                                                                onClick={() => abrirModalAuditoria(`Todos os Planos — ${uni.nome}`, uni.nome, 'VENDA', uni.registrosPlanosUnidade, uni.totalPlanos)}
                                                                className={`${classeBotaoNumero} ${tomDaCelula(uni.totalPlanos, maximoPorColuna.PLANOS)}`}
                                                                title={tx("Auditar apenas os planos vendidos nesta unidade")}>
                                                                {doisDigitos(uni.totalPlanos)}
                                                            </button>
                                                        ) : <span className="text-slate-300 font-bold text-xs select-none dark:text-slate-600">—</span>}
                                                    </td>
                                                )}

                                                {colunasMatrizVisiveis.map(col => {
                                                    const valorCel = uni.colunas[col.key] || 0;
                                                    const regsCel = uni.registrosPorColuna[col.key] || [];
                                                    return (
                                                        <td key={col.key} className={`py-3 px-2.5 text-center ${col.adicional ? CLASSE_ADICIONAL : ''}`}>
                                                            {valorCel > 0 ? (
                                                                <button type="button"
                                                                    onClick={() => abrirModalAuditoria(`${col.label} — ${uni.nome}`, uni.nome, 'VENDA', regsCel, valorCel)}
                                                                    className={`${classeBotaoNumero} ${tomDaCelula(valorCel, maximoPorColuna[col.key])}`}
                                                                    title={tx("Clique para auditar {valorCel} registro(s) de {label} em {nome}", { valorCel: valorCel, label: col.label, nome: uni.nome })}>
                                                                    {doisDigitos(valorCel)}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 font-bold text-xs select-none dark:text-slate-600">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {listaItensEspecificos.map(([nomeItem, itemData]) => (
                                                                <button key={nomeItem} type="button"
                                                                    onClick={() => abrirModalAuditoria(`${nomeItem} — ${uni.nome}`, uni.nome, 'VENDA', itemData.vendasAuditaveis, itemData.total)}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-white hover:bg-blue-50 text-slate-700 border-slate-200 hover:border-blue-300 transition-colors cursor-pointer dark:bg-slate-900 dark:hover:bg-blue-500/10 dark:text-slate-200 dark:border-slate-800 dark:hover:border-blue-500/30"
                                                                    title={tx("Auditar {nomeItem}", { nomeItem: nomeItem })}>
                                                                    <span className="font-black text-blue-700 tabular-nums dark:text-blue-400">{itemData.total}×</span>
                                                                    <span className="uppercase truncate max-w-[180px]">{nomeItem}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* Linha de total da rede */}
                            {rankingUnidades.length > 1 && (
                                <tfoot>
                                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-black dark:bg-slate-800/60 dark:border-slate-700">
                                        <td className="py-3 px-4 text-center text-[11px] text-slate-400">∑</td>
                                        <td className="py-3 px-4 text-[11px] uppercase tracking-widest text-slate-700 sticky left-0 bg-slate-50 z-10 dark:bg-slate-800 dark:text-slate-200">
                                            {tx("TOTAL DA REDE")}
                                        </td>
                                        {criterioRanking === 'TOTAL' && (
                                            <td className="py-3 px-3 text-center text-[13px] text-slate-800 tabular-nums dark:text-white">{doisDigitos(vendasGlobal)}</td>
                                        )}
                                        {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                            <td className="py-3 px-3 text-center text-[13px] text-slate-800 tabular-nums border-r border-slate-200 dark:text-white dark:border-slate-800">{doisDigitos(totaisRedeMatriz.totalPlanos)}</td>
                                        )}
                                        {colunasMatrizVisiveis.map(col => (
                                            <td key={col.key} className={`py-3 px-2.5 text-center text-[13px] text-slate-700 tabular-nums dark:text-slate-200 ${col.adicional ? CLASSE_ADICIONAL : ''}`}>
                                                {totaisRedeMatriz[col.key] > 0 ? doisDigitos(totaisRedeMatriz[col.key]) : '—'}
                                            </td>
                                        ))}
                                        {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                            <td className="py-3 px-4 text-[10px] text-slate-400 uppercase tracking-widest">
                                                {tx("100% da Categoria na Rede")}
                                            </td>
                                        )}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                    <p className="px-5 py-2.5 border-t border-slate-100 text-[11px] font-semibold text-slate-400 dark:border-slate-800">
                        {tx("Quanto mais azul a célula, maior o número naquela coluna. O mais forte é o maior da rede.")}{' '}{tx('A coluna Nutri (verde) é adicional: não entra no total de planos.')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default RankingGlobalTab;
