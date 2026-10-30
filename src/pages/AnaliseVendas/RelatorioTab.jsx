// src/pages/AnaliseVendas/RelatorioTab.jsx
import React, { useState, useRef, useMemo } from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
    ORDEM_CLASSICA,
    processarConsolidadas,
    filtrarEOrdenarRanking
} from './relatorio/motorConsolidacao.js';
import {
    exportarRelatorioGeralCSV,
    montarTextoGlobalWhatsapp,
    montarTextoFechamentoUnidade
} from './relatorio/exportadorSeguro.js';
import { useResgateCpf } from './relatorio/useResgateCpf.js';
import ModalAuditoria from './relatorio/ModalAuditoria.jsx';
import {
    Download,
    Share2,
    LayoutList,
    ChevronDown,
    ChevronUp,
    Building2,
    FileX2,
    Users
} from 'lucide-react';
import { avisar } from '../../components/avisar.js';
import { tx } from '../../i18n/traduzir.js';

const RelatorioTab = ({
    vendasFiltradas = [],
    visitantesFiltrados = [],
    avaliacoesFiltradas = [],
    planos = [],
    produtos = [],
    temVisaoGlobal = false,
    labelFiltroAtual = '',
    abrirModalWhatsapp,
    usuarioLogado
}) => {
    const { t, locale, language } = useI18n();
    const langAtual = locale || language || 'pt-BR';

    const [unidadesRecolhidas, setUnidadesRecolhidas] = useState({});
    const [visaoDetalhada, setVisaoDetalhada] = useState(false);

    // Estado do Modal de Auditoria (Vendas, Visitantes e Avaliações)
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        tipoTabela: '', // 'VENDA', 'VISITANTE', 'AVALIACAO'
        titulo: '',
        subtitulo: '',
        registros: [],
        totalItensUnicos: 0
    });

    const permissaoGerencial = temVisaoGlobal || (usuarioLogado && usuarioLogado.role === 'LIDER');

    // 🧠 Motor Único de Consolidação e Deduplicação
    const {
        relatorioPorUnidade,
        unidadesOrdenadas,
        vendasGlobal,
        baseRankingUnidades
    } = useMemo(() => {
        return processarConsolidadas({
            vendasFiltradas,
            visitantesFiltrados,
            avaliacoesFiltradas,
            planos,
            produtos
        });
    }, [vendasFiltradas, visitantesFiltrados, avaliacoesFiltradas, planos, produtos]);

    const rankingUnidades = useMemo(() => {
        return filtrarEOrdenarRanking(baseRankingUnidades, 'TOTAL', null);
    }, [baseRankingUnidades]);

    // 🪝 Hook Universal de Resgate de CPFs e Nomes no Supabase
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

    const toggleUnidade = (unidade) => {
        setUnidadesRecolhidas(prev => ({
            ...prev,
            [unidade]: !prev[unidade]
        }));
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

    // Rolagem suave com o rato (drag-to-scroll)
    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const scrollTop = useRef(0);

    const onMouseDown = (e) => {
        if (e.target.closest('button') || e.target.closest('.no-drag') || e.target.closest('.cursor-pointer')) return;
        isDragging.current = true;
        scrollRef.current.classList.add('cursor-grabbing');
        scrollRef.current.classList.remove('cursor-grab');
        scrollRef.current.style.userSelect = 'none';
        startY.current = e.pageY - scrollRef.current.offsetTop;
        scrollTop.current = scrollRef.current.scrollTop;
    };

    const onMouseLeaveOrUp = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.classList.remove('cursor-grabbing');
            scrollRef.current.classList.add('cursor-grab');
            scrollRef.current.style.userSelect = 'auto';
        }
    };

    const onMouseMove = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const y = e.pageY - scrollRef.current.offsetTop;
        const walk = (y - startY.current) * 1.5;
        scrollRef.current.scrollTop = scrollTop.current - walk;
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

    const handleGerarRelatorioGlobalWhatsapp = () => {
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

    const handleGerarTextoFechamento = (unidadeAlvo) => {
        const txt = montarTextoFechamentoUnidade({
            unidadeAlvo,
            relatorioPorUnidade,
            labelFiltroAtual,
            langAtual,
            t
        });
        abrirModalWhatsapp(txt, {
            titulo: `${t('analytics.report.reportName', { defaultValue: 'Relatório' })}: ${unidadeAlvo}`,
            icone: 'file-text',
            cor: 'blue'
        });
    };

    return (
        <div
            className="animate-[fadeIn_0.3s_ease-out] max-h-[75vh] overflow-y-auto custom-scrollbar cursor-grab px-2 pb-10"
            ref={scrollRef}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeaveOrUp}
            onMouseUp={onMouseLeaveOrUp}
            onMouseMove={onMouseMove}
        >
            {/* Modal de Auditoria com Pesquisa Interna e Download de Lista */}
            <ModalAuditoria
                modalConfig={modalConfig}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                dicionarioPessoas={dicionarioPessoas}
                cacheAlunosBanco={cacheAlunosBanco}
                buscandoCpfsBanco={buscandoCpfsBanco}
                extrairDadosPessoa={extrairDadosPessoa}
            />

            <div className="space-y-8">
                {/* 📌 BARRA DE AÇÕES GERENCIAIS E EXPORTAÇÃO */}
                {unidadesOrdenadas.length > 0 && permissaoGerencial && (
                    <div className="bg-white p-4 md:p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between no-drag dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-4 w-full md:w-auto">
                            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-md shrink-0">
                                <LayoutList className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest dark:text-white">
                                    {tx("Fechamento Operacional")}
                                </h3>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                    {tx("Auditoria por Unidade, Visitantes, Avaliações e Exportação")}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-4 items-center">
                            <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto dark:bg-slate-800 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setVisaoDetalhada(false)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!visaoDetalhada ? 'bg-white shadow-sm text-blue-700 dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    {tx("Resumo")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setVisaoDetalhada(true)}
                                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visaoDetalhada ? 'bg-white shadow-sm text-blue-700 dark:bg-slate-900 dark:text-blue-400' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                                >
                                    {tx("Detalhado")}
                                </button>
                            </div>

                            <div className="flex w-full sm:w-auto gap-3">
                                <button
                                    type="button"
                                    onClick={handleExportarCSV}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-800"
                                >
                                    <Download className="w-4 h-4" />{' '}{tx("Planilha")}
                                </button>
                                {temVisaoGlobal && (
                                    <button
                                        type="button"
                                        onClick={handleGerarRelatorioGlobalWhatsapp}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                                    >
                                        <Share2 className="w-4 h-4" />{' '}{tx("WhatsApp Geral")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 🏢 CARDS SANFONA POR UNIDADE COM INTERAÇÃO DE MODAL */}
                {unidadesOrdenadas.length === 0 ? (
                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60 pointer-events-none dark:bg-slate-900 dark:border-slate-800">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 dark:bg-slate-800">
                            <FileX2 className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">
                            {t('analytics.report.emptyData', { defaultValue: 'Nenhum dado neste período.' })}
                        </p>
                    </div>
                ) : (
                    unidadesOrdenadas.map(unidade => {
                        const dados = relatorioPorUnidade[unidade];
                        const isRecolhido = unidadesRecolhidas[unidade];

                        const hasVisitantes = dados.visitantes.length > 0;
                        const hasAvaliacoes = dados.avaliacoes.length > 0;

                        const gruposUnidadeFiltrados = Object.entries(dados.grupos)
                            .sort((a, b) => ORDEM_CLASSICA.indexOf(a[0]) - ORDEM_CLASSICA.indexOf(b[0]))
                            .filter(([_, info]) => info.total > 0);

                        return (
                            <div key={unidade} className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden transition-all duration-300 dark:bg-slate-900 dark:border-slate-800">
                                <div
                                    className="bg-slate-900 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-colors cursor-pointer select-none group"
                                    onClick={() => toggleUnidade(unidade)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shrink-0 group-hover:bg-blue-500/20 group-hover:border-blue-500/30 transition-colors">
                                            <Building2 className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tight line-clamp-1">
                                                {unidade}
                                            </h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                {t('analytics.report.perfOps', { defaultValue: 'Performance Operacional' })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 no-drag">
                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl flex items-center gap-2" title={tx("Total de Vendas Registradas")}>
                                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                                                {String(dados.totalGeralVendas).padStart(2, '0')} {t('analytics.report.salesUnit', { defaultValue: 'Vendas' })}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleGerarTextoFechamento(unidade); }}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                                        >
                                            <Share2 className="w-3.5 h-3.5" />{' '}{tx("WhatsApp Fechamento")}
                                        </button>

                                        <button
                                            type="button"
                                            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 transition-colors shrink-0"
                                            title={isRecolhido ? t('analytics.report.btnExpand', { defaultValue: 'Expandir' }) : t('analytics.report.btnCollapse', { defaultValue: 'Recolher' })}
                                        >
                                            {isRecolhido ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div className={`transition-all duration-300 ${isRecolhido ? 'h-0 opacity-0 overflow-hidden' : 'p-6 md:p-8 bg-slate-50/50 border-t border-slate-200 dark:bg-slate-800/40 dark:border-slate-800'}`}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {/* VENDAS POR GRUPO (CLICÁVEIS) */}
                                        {gruposUnidadeFiltrados.map(([grupo, info]) => (
                                            <div key={grupo} className="bg-white border border-slate-200 rounded-2xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700">
                                                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white dark:border-slate-800 dark:bg-slate-900">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${info.bgIcone}`}>
                                                            {info.icone}
                                                        </span>
                                                        <span className={`text-xs font-black uppercase tracking-wider ${info.cor}`}>
                                                            {tx(grupo)}
                                                            {/* Nutri é adicional: não soma no total de planos */}
                                                            {grupo === 'NUTRI' && <span className="ml-1.5 text-[10px] font-bold normal-case tracking-normal text-slate-500 dark:text-slate-400">· {tx('adicional, não soma nos planos')}</span>}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-800">
                                                        {String(info.total).padStart(2, '0')} UN
                                                    </span>
                                                </div>

                                                <div className="flex-1 divide-y divide-slate-100 bg-slate-50/30 max-h-[160px] overflow-y-auto custom-scrollbar animate-[fadeIn_0.3s_ease-out] no-drag dark:divide-slate-800 dark:bg-slate-800/40">
                                                    {Object.entries(info.itens).sort((a, b) => b[1].total - a[1].total).map(([nomeItem, itemData]) => {
                                                        if (itemData.total === 0) return null;

                                                        const stringConsultores = Object.entries(itemData.vendedores)
                                                            .filter(([_, vQtd]) => vQtd > 0)
                                                            .sort((a, b) => b[1] - a[1])
                                                            .map(([vNome, vQtd]) => `${vNome} (${String(vQtd).padStart(2, '0')})`)
                                                            .join(', ');

                                                        return (
                                                            <div
                                                                key={nomeItem}
                                                                onClick={(e) => { e.stopPropagation(); abrirModalAuditoria(nomeItem, unidade, 'VENDA', itemData.vendasAuditaveis, itemData.total); }}
                                                                className="px-5 py-3.5 flex justify-between items-center bg-white hover:bg-blue-50/60 cursor-pointer transition-colors group dark:bg-slate-900 dark:hover:bg-blue-500/10"
                                                                title={tx("Clique para detalhar auditoria")}
                                                            >
                                                                <div className="flex flex-col pr-4">
                                                                    <span className="text-[11px] font-black text-slate-700 uppercase group-hover:text-blue-600 transition-colors line-clamp-1 dark:text-slate-200 dark:group-hover:text-blue-400">
                                                                        {nomeItem}
                                                                    </span>
                                                                    {stringConsultores && (
                                                                        <span className="text-[10px] font-bold text-slate-400 mt-0.5 line-clamp-1 flex items-center gap-1" title={stringConsultores}>
                                                                            <Users className="w-2.5 h-2.5 inline-block opacity-70 shrink-0" />
                                                                            {stringConsultores}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[11px] font-black text-slate-800 shrink-0 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 shadow-sm group-hover:bg-blue-100 group-hover:border-blue-200 group-hover:text-blue-700 transition-colors dark:text-white dark:bg-slate-800 dark:border-slate-800 dark:group-hover:bg-blue-500/20 dark:group-hover:border-blue-500/30 dark:group-hover:text-blue-400">
                                                                    {String(itemData.total).padStart(2, '0')}x
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {/* VISITANTES DE BALCÃO (CLICÁVEL) */}
                                        <div
                                            className={`bg-white border no-drag dark:bg-slate-900 ${hasVisitantes ? 'border-slate-200 hover:border-blue-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group dark:border-slate-800 dark:hover:border-blue-500/30' : 'border-slate-200 border-dashed opacity-80 pointer-events-none dark:border-slate-800'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if (hasVisitantes) { e.stopPropagation(); abrirModalAuditoria('Visitantes Capturados', unidade, 'VISITANTE', dados.visitantes, dados.visitantes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-blue-50/50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-blue-500/10">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasVisitantes ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                        👥
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasVisitantes ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardVisitors', { defaultValue: 'VISITANTES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasVisitantes ? 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30 dark:group-hover:bg-blue-500/20' : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/60 dark:border-slate-800'}`}>
                                                    {String(dados.visitantes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-blue-50/20 transition-colors dark:bg-slate-800/40 dark:group-hover:bg-blue-500/10">
                                                {hasVisitantes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-600/70 transition-colors dark:text-slate-400">
                                                            {t('analytics.report.totalCaptured', { defaultValue: 'Total Capturado' })}
                                                        </p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-blue-700 transition-colors dark:text-white dark:group-hover:text-blue-400">
                                                            {dados.visitantes.length}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {t('analytics.report.emptyVisitors', { defaultValue: 'Nenhuma visita' })}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* AVALIAÇÕES FÍSICAS (CLICÁVEL) */}
                                        <div
                                            className={`bg-white border no-drag dark:bg-slate-900 ${hasAvaliacoes ? 'border-slate-200 hover:border-orange-300 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md cursor-pointer group dark:border-slate-800 dark:hover:border-orange-500/30' : 'border-slate-200 border-dashed opacity-80 pointer-events-none dark:border-slate-800'} rounded-2xl flex flex-col overflow-hidden transition-all`}
                                            onClick={(e) => { if (hasAvaliacoes) { e.stopPropagation(); abrirModalAuditoria('Avaliações Realizadas', unidade, 'AVALIACAO', dados.avaliacoes, dados.avaliacoes.length); } }}
                                        >
                                            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white group-hover:bg-orange-50/50 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-orange-500/10">
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${hasAvaliacoes ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                                        📋
                                                    </span>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${hasAvaliacoes ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                                                        {t('analytics.report.cardAssessments', { defaultValue: 'AVALIAÇÕES' })}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border transition-colors ${hasAvaliacoes ? 'bg-orange-50 text-orange-600 border-orange-200 group-hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/30 dark:group-hover:bg-orange-500/20' : 'bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/60 dark:border-slate-800'}`}>
                                                    {String(dados.avaliacoes.length).padStart(2, '0')} UN
                                                </span>
                                            </div>
                                            <div className="flex-1 bg-slate-50/30 p-5 flex flex-col items-center justify-center text-center min-h-[160px] group-hover:bg-orange-50/20 transition-colors dark:bg-slate-800/40 dark:group-hover:bg-orange-500/10">
                                                {hasAvaliacoes ? (
                                                    <>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1 group-hover:text-orange-600/70 transition-colors dark:text-slate-400">
                                                            {t('analytics.report.doneToday', { defaultValue: 'Realizadas' })}
                                                        </p>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-800 group-hover:text-orange-700 transition-colors dark:text-white dark:group-hover:text-orange-400">
                                                            {dados.avaliacoes.length}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-4xl md:text-5xl font-black text-slate-300 mb-2">00</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                            {t('analytics.report.emptyAssessments', { defaultValue: 'Nenhuma avaliação' })}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default RelatorioTab;