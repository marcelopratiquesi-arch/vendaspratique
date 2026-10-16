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
    Trophy,
    Download,
    Share2,
    ArrowUpDown,
    FileX2,
    ShieldAlert,
    Building2,
    Layers,
    Package,
    Briefcase
} from 'lucide-react';

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

    // 🔒 BLINDAGEM DE SEGURANÇA: Oculta completamente para Líder e Recepção
    if (!temVisaoGlobal) {
        return (
            <div className="bg-white rounded-[24px] border border-rose-200 p-12 flex flex-col items-center justify-center text-center shadow-sm">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-100">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase tracking-widest">
                    Acesso Restrito à Diretoria / Mentoria
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1 max-w-md">
                    A Matriz Executiva e o Ranking Global da rede estão disponíveis exclusivamente para perfis com visão global (Admin e Mentor).
                </p>
            </div>
        );
    }

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

    const colunasMatrizVisiveis = useMemo(() => {
        return COLUNAS_MATRIZ.filter(col => {
            if (criterioRanking === 'PLANOS') return col.escopo === 'PLANOS';
            if (criterioRanking === 'PRODUTOS') return col.escopo === 'PRODUTOS';
            if (criterioRanking === 'SERVICOS') return col.escopo === 'SERVICOS';
            return true;
        });
    }, [criterioRanking]);

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
            alert(t('analytics.report.noDataWpp', { defaultValue: "Não há dados para gerar relatório com os filtros atuais." }));
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

    return (
        <div className="space-y-8 animate-[fadeIn_0.3s_ease-out] pb-10">
            {/* Modal de Auditoria c/ Busca Interna e Exportação */}
            <ModalAuditoria
                modalConfig={modalConfig}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                dicionarioPessoas={dicionarioPessoas}
                cacheAlunosBanco={cacheAlunosBanco}
                buscandoCpfsBanco={buscandoCpfsBanco}
                extrairDadosPessoa={extrairDadosPessoa}
            />

            {/* 📌 BARRA DE TOPO: KPIs RÁPIDOS DA REDE + EXPORTAÇÃO GLOBAL */}
            <div className="bg-white p-5 md:p-6 rounded-[24px] shadow-sm border border-slate-200 flex flex-col xl:flex-row gap-6 items-stretch xl:items-center justify-between">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                    <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center gap-3.5 shadow-sm">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-amber-400 shrink-0">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">Total Rede</span>
                            <span className="text-xl font-black leading-none">{String(vendasGlobal).padStart(2, '0')}</span>
                        </div>
                    </div>

                    <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700/70 block">Planos</span>
                            <span className="text-xl font-black text-emerald-700 leading-none">{String(totaisRedeMatriz.totalPlanos).padStart(2, '0')}</span>
                        </div>
                    </div>

                    <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-700/70 block">Produtos</span>
                            <span className="text-xl font-black text-amber-700 leading-none">{String(totaisRedeMatriz.totalProdutos).padStart(2, '0')}</span>
                        </div>
                    </div>

                    <div className="bg-violet-50/70 border border-violet-200 p-4 rounded-2xl flex items-center gap-3.5">
                        <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shrink-0">
                            <Briefcase className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-violet-700/70 block">Serviços</span>
                            <span className="text-xl font-black text-violet-700 leading-none">{String(totaisRedeMatriz.totalServicos).padStart(2, '0')}</span>
                        </div>
                    </div>
                </div>

                {/* Controles de Exportação Global (Planilha e WhatsApp da Rede) */}
                <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setVisaoDetalhada(false)}
                            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Resumo
                        </button>
                        <button
                            type="button"
                            onClick={() => setVisaoDetalhada(true)}
                            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${visaoDetalhada ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Detalhado
                        </button>
                    </div>

                    <div className="flex w-full sm:w-auto gap-2.5">
                        <button
                            type="button"
                            onClick={handleExportarCSV}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-200"
                        >
                            <Download className="w-4 h-4" /> Planilha
                        </button>
                        <button
                            type="button"
                            onClick={handleGerarWhatsappGlobal}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-emerald-200"
                        >
                            <Share2 className="w-4 h-4" /> WhatsApp Rede
                        </button>
                    </div>
                </div>
            </div>

            {/* 🏆 MATRIZ EXECUTIVA ALINHADA + PÓDIO TOP 3 */}
            {baseRankingUnidades.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm flex flex-col items-center justify-center h-64 opacity-60">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <FileX2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
                        Nenhuma venda encontrada para o período selecionado.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-slate-200 overflow-hidden">
                    {/* CABEÇALHO DO RANKING + 4 BOTÕES DE CATEGORIA */}
                    <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-inner">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                    Ranking Global & Matriz de Composição
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    Clique nos números para auditar os alunos ou no título da coluna para ordenar • {rankingUnidades.length} Unidades Ativas
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Categoria:</span>
                            <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleTrocarEscopoRanking('TOTAL')}
                                    className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'TOTAL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Total Geral ({vendasGlobal})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTrocarEscopoRanking('PLANOS')}
                                    className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'PLANOS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Só Planos ({totaisRedeMatriz.totalPlanos})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTrocarEscopoRanking('PRODUTOS')}
                                    className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'PRODUTOS' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Só Produtos ({totaisRedeMatriz.totalProdutos})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleTrocarEscopoRanking('SERVICOS')}
                                    className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${criterioRanking === 'SERVICOS' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Só Serviços ({totaisRedeMatriz.totalServicos})
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 🥇🥈🥉 PÓDIO TOP 3 DINÂMICO */}
                    {top3Unidades.length > 0 && (
                        <div className="p-6 bg-slate-50/70 border-b border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
                            {top3Unidades.map((uni, idx) => {
                                const valorPrincipalPodio = criterioRanking === 'PLANOS'
                                    ? uni.totalPlanos
                                    : criterioRanking === 'PRODUTOS'
                                    ? uni.totalProdutos
                                    : criterioRanking === 'SERVICOS'
                                    ? uni.totalServicos
                                    : uni.vendas;

                                const labelPrincipalPodio = criterioRanking === 'PLANOS'
                                    ? 'Planos Vendidos'
                                    : criterioRanking === 'PRODUTOS'
                                    ? 'Produtos Vendidos'
                                    : criterioRanking === 'SERVICOS'
                                    ? 'Serviços Vendidos'
                                    : 'Vendas Totais';

                                const registrosDoPodio = criterioRanking === 'PLANOS'
                                    ? uni.registrosPlanosUnidade
                                    : criterioRanking === 'PRODUTOS'
                                    ? uni.registrosProdutosUnidade
                                    : criterioRanking === 'SERVICOS'
                                    ? uni.registrosServicosUnidade
                                    : uni.todosRegistrosUnidade;

                                const pctShareRede = totalEscopoAtivoRede > 0
                                    ? Math.round((valorPrincipalPodio / totalEscopoAtivoRede) * 100)
                                    : 0;

                                const estilosPodio = [
                                    {
                                        medalha: '🥇 1º LUGAR',
                                        card: 'bg-gradient-to-br from-amber-50/90 via-white to-white border-amber-300 ring-1 ring-amber-200/60',
                                        badge: 'bg-amber-100 text-amber-800 border-amber-300',
                                        numero: 'text-amber-600'
                                    },
                                    {
                                        medalha: '🥈 2º LUGAR',
                                        card: 'bg-gradient-to-br from-slate-100/80 via-white to-white border-slate-300',
                                        badge: 'bg-slate-200/80 text-slate-700 border-slate-300',
                                        numero: 'text-slate-700'
                                    },
                                    {
                                        medalha: '🥉 3º LUGAR',
                                        card: 'bg-gradient-to-br from-orange-50/70 via-white to-white border-orange-200',
                                        badge: 'bg-orange-100 text-orange-800 border-orange-200',
                                        numero: 'text-orange-600'
                                    }
                                ][idx];

                                return (
                                    <div
                                        key={uni.nome}
                                        onClick={() => abrirModalAuditoria(`${labelPrincipalPodio} — ${uni.nome}`, uni.nome, 'VENDA', registrosDoPodio, valorPrincipalPodio)}
                                        className={`p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${estilosPodio.card}`}
                                        title="Clique para auditar os alunos desta unidade"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${estilosPodio.badge}`}>
                                                        {estilosPodio.medalha}
                                                    </span>
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        {pctShareRede}% da Rede
                                                    </span>
                                                </div>
                                                <h4 className="text-base font-black text-slate-800 uppercase tracking-tight truncate mt-2" title={uni.nome}>
                                                    {uni.nome}
                                                </h4>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`text-3xl font-black leading-none ${estilosPodio.numero}`}>
                                                    {String(valorPrincipalPodio).padStart(2, '0')}
                                                </span>
                                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {labelPrincipalPodio}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 border-t border-slate-200/60">
                                            {criterioRanking === 'TOTAL' && (() => {
                                                const tot = uni.vendas || 1;
                                                const pctPlanos = Math.round((uni.totalPlanos / tot) * 100);
                                                const pctProd = Math.round((uni.totalProdutos / tot) * 100);
                                                const pctServ = Math.max(0, 100 - pctPlanos - pctProd);
                                                return (
                                                    <>
                                                        <div className="flex flex-wrap justify-between text-[9px] font-black uppercase tracking-wider mb-1.5 gap-1">
                                                            <span className="text-emerald-600">📋 {String(uni.totalPlanos).padStart(2, '0')} Planos ({pctPlanos}%)</span>
                                                            <span className="text-amber-600">🛍️ {String(uni.totalProdutos).padStart(2, '0')} Prod ({pctProd}%)</span>
                                                            <span className="text-violet-600">🧾 {String(uni.totalServicos).padStart(2, '0')} Serv ({pctServ}%)</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                                            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pctPlanos}%` }}></div>
                                                            <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${pctProd}%` }}></div>
                                                            <div className="bg-violet-500 h-full transition-all duration-500" style={{ width: `${pctServ}%` }}></div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {criterioRanking === 'PLANOS' && (() => {
                                                const totP = uni.totalPlanos || 1;
                                                const pNutri = Math.round(((uni.colunas.NUTRI || 0) / totP) * 100);
                                                const pPlus = Math.round(((uni.colunas.PLUS || 0) / totP) * 100);
                                                const pFit = Math.round(((uni.colunas.FIT || 0) / totP) * 100);
                                                const pOutros = Math.max(0, 100 - pNutri - pPlus - pFit);
                                                return (
                                                    <>
                                                        <div className="flex flex-wrap justify-between text-[9px] font-black uppercase tracking-wider mb-1.5 gap-1">
                                                            <span className="text-emerald-600">🥗 Nutri: {String(uni.colunas.NUTRI || 0).padStart(2, '0')}</span>
                                                            <span className="text-blue-600">⭐ Plus: {String(uni.colunas.PLUS || 0).padStart(2, '0')}</span>
                                                            <span className="text-indigo-600">🏃 Fit: {String(uni.colunas.FIT || 0).padStart(2, '0')}</span>
                                                            <span className="text-rose-600">🏋️ Pers/Out: {String((uni.colunas.PERSONAL || 0) + (uni.colunas.OUTROS_PLANOS || 0)).padStart(2, '0')}</span>
                                                        </div>
                                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                                                            <div className="bg-emerald-500 h-full" style={{ width: `${pNutri}%` }}></div>
                                                            <div className="bg-blue-500 h-full" style={{ width: `${pPlus}%` }}></div>
                                                            <div className="bg-indigo-500 h-full" style={{ width: `${pFit}%` }}></div>
                                                            <div className="bg-rose-400 h-full" style={{ width: `${pOutros}%` }}></div>
                                                        </div>
                                                    </>
                                                );
                                            })()}

                                            {criterioRanking === 'PRODUTOS' && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {uni.itensProdutosDetalhados.slice(0, 3).map(([nomeItem, d]) => (
                                                        <span key={nomeItem} className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black uppercase truncate max-w-[140px]">
                                                            {String(d.total).padStart(2, '0')}x {nomeItem}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {criterioRanking === 'SERVICOS' && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {uni.itensServicosDetalhados.slice(0, 3).map(([nomeItem, d]) => (
                                                        <span key={nomeItem} className="inline-flex items-center gap-1 bg-violet-50 border border-violet-200 text-violet-800 px-2 py-0.5 rounded text-[9px] font-black uppercase truncate max-w-[140px]">
                                                            {String(d.total).padStart(2, '0')}x {nomeItem}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 📊 TABELA MATRIZ EXECUTIVA ALINHADA */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[750px]">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-100/70">
                                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Pos</th>
                                    <th className="py-3.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[180px] sticky left-0 bg-slate-100/95 backdrop-blur z-10">Unidade</th>

                                    {criterioRanking === 'TOTAL' && (
                                        <th
                                            onClick={() => setColunaOrdemMatriz(null)}
                                            className="py-3.5 px-3 text-[10px] font-black text-slate-800 uppercase tracking-widest text-center bg-slate-200/60 w-28 cursor-pointer hover:bg-slate-200 transition-colors"
                                            title="Ordenar pelo Total Geral"
                                        >
                                            Total Geral
                                        </th>
                                    )}

                                    {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                        <th
                                            onClick={() => setColunaOrdemMatriz(null)}
                                            className="py-3.5 px-3 text-[10px] font-black text-emerald-700 uppercase tracking-widest text-center bg-emerald-50/70 border-x border-slate-200/70 w-28 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                                            title="Ordenar pelo Total de Planos"
                                        >
                                            {criterioRanking === 'PLANOS' ? 'Total Planos' : 'Planos'}
                                        </th>
                                    )}

                                    {colunasMatrizVisiveis.map(col => {
                                        const isOrdenada = colunaOrdemMatriz === col.key;
                                        return (
                                            <th
                                                key={col.key}
                                                onClick={() => handleOrdenarPorColunaMatriz(col.key)}
                                                className={`py-3.5 px-2.5 text-[10px] font-black uppercase tracking-wider text-center w-28 cursor-pointer select-none transition-colors ${isOrdenada ? 'bg-blue-50/80 ring-1 ring-inset ring-blue-300' : 'hover:bg-slate-200/50'}`}
                                                title={`Clique para ordenar por ${col.label}`}
                                            >
                                                <div className="flex flex-col items-center justify-center leading-tight">
                                                    <span className="text-xs mb-0.5">{col.icone}</span>
                                                    <span className={`flex items-center gap-0.5 ${col.headerColor}`}>
                                                        {col.label}
                                                        <ArrowUpDown className={`w-2.5 h-2.5 ${isOrdenada ? 'opacity-100 text-blue-600' : 'opacity-30'}`} />
                                                    </span>
                                                </div>
                                            </th>
                                        );
                                    })}

                                    {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                        <th className="py-3.5 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            Composição de Itens Vendidos (Clique para auditar)
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rankingUnidades.length === 0 ? (
                                    <tr>
                                        <td colSpan="12" className="py-12 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Nenhuma venda registrada nesta categoria para o período selecionado.
                                        </td>
                                    </tr>
                                ) : (
                                    rankingUnidades.map((uni, idx) => {
                                        const isTop1 = idx === 0;
                                        const isTop2 = idx === 1;
                                        const isTop3 = idx === 2;

                                        const posBadge = isTop1
                                            ? 'bg-amber-400 text-slate-900 shadow-sm'
                                            : isTop2
                                            ? 'bg-slate-300 text-slate-800'
                                            : isTop3
                                            ? 'bg-orange-200 text-orange-900'
                                            : 'bg-slate-100 text-slate-500';

                                        const valorEscopoUnidade = criterioRanking === 'PLANOS'
                                            ? uni.totalPlanos
                                            : criterioRanking === 'PRODUTOS'
                                            ? uni.totalProdutos
                                            : criterioRanking === 'SERVICOS'
                                            ? uni.totalServicos
                                            : uni.vendas;

                                        const pctRedeUnidade = totalEscopoAtivoRede > 0
                                            ? Math.round((valorEscopoUnidade / totalEscopoAtivoRede) * 100)
                                            : 0;

                                        const listaItensEspecificos = criterioRanking === 'PRODUTOS'
                                            ? uni.itensProdutosDetalhados
                                            : uni.itensServicosDetalhados;

                                        return (
                                            <tr key={uni.nome} className={`transition-colors hover:bg-blue-50/30 ${isTop1 ? 'bg-amber-50/15' : 'bg-white'}`}>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[11px] font-black ${posBadge}`}>
                                                        {idx + 1}º
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 font-black text-slate-800 uppercase tracking-tight text-xs sticky left-0 bg-white/95 backdrop-blur z-10 border-r border-slate-100">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate">{uni.nome}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0" title="Participação no total da rede">
                                                            {pctRedeUnidade}%
                                                        </span>
                                                    </div>
                                                </td>

                                                {criterioRanking === 'TOTAL' && (
                                                    <td className="py-3.5 px-3 text-center bg-slate-50/70">
                                                        <button
                                                            type="button"
                                                            onClick={() => abrirModalAuditoria(`Todas as Vendas — ${uni.nome}`, uni.nome, 'VENDA', uni.todosRegistrosUnidade, uni.vendas)}
                                                            className="inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-lg text-xs font-black bg-slate-800 text-white hover:bg-blue-600 transition-colors shadow-sm"
                                                            title="Auditar todas as vendas da unidade"
                                                        >
                                                            {String(uni.vendas).padStart(2, '0')}
                                                        </button>
                                                    </td>
                                                )}

                                                {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                                    <td className="py-3.5 px-3 text-center bg-emerald-50/20 border-x border-slate-100">
                                                        <button
                                                            type="button"
                                                            onClick={() => abrirModalAuditoria(`Todos os Planos — ${uni.nome}`, uni.nome, 'VENDA', uni.registrosPlanosUnidade, uni.totalPlanos)}
                                                            className="inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-lg text-xs font-black text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 transition-colors shadow-sm"
                                                            title="Auditar apenas os planos vendidos nesta unidade"
                                                        >
                                                            {String(uni.totalPlanos).padStart(2, '0')}
                                                        </button>
                                                    </td>
                                                )}

                                                {colunasMatrizVisiveis.map(col => {
                                                    const valorCel = uni.colunas[col.key] || 0;
                                                    const regsCel = uni.registrosPorColuna[col.key] || [];
                                                    const isColOrdenada = colunaOrdemMatriz === col.key;

                                                    return (
                                                        <td key={col.key} className={`py-3.5 px-2.5 text-center ${isColOrdenada ? 'bg-blue-50/20' : ''}`}>
                                                            {valorCel > 0 ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => abrirModalAuditoria(`${col.label} — ${uni.nome}`, uni.nome, 'VENDA', regsCel, valorCel)}
                                                                    className={`inline-flex items-center justify-center min-w-[38px] px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all shadow-sm cursor-pointer ${col.badgeBg}`}
                                                                    title={`Clique para auditar ${valorCel} registro(s) de ${col.label} em ${uni.nome}`}
                                                                >
                                                                    {String(valorCel).padStart(2, '0')}
                                                                </button>
                                                            ) : (
                                                                <span className="text-slate-300 font-bold text-xs select-none">—</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}

                                                {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {listaItensEspecificos.map(([nomeItem, itemData]) => (
                                                                <button
                                                                    key={nomeItem}
                                                                    type="button"
                                                                    onClick={() => abrirModalAuditoria(`${nomeItem} — ${uni.nome}`, uni.nome, 'VENDA', itemData.vendasAuditaveis, itemData.total)}
                                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all shadow-sm cursor-pointer ${
                                                                        criterioRanking === 'PRODUTOS'
                                                                            ? 'bg-white hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                                                                            : 'bg-white hover:bg-violet-50 text-slate-700 border-slate-200 hover:border-violet-300'
                                                                    }`}
                                                                    title={`Auditar ${nomeItem}`}
                                                                >
                                                                    <span className={criterioRanking === 'PRODUTOS' ? 'text-amber-600' : 'text-violet-600'}>
                                                                        {String(itemData.total).padStart(2, '0')}x
                                                                    </span>
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

                            {/* RODAPÉ TOTALIZADOR DA REDE */}
                            {rankingUnidades.length > 1 && (
                                <tfoot>
                                    <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-300">
                                        <td className="py-3.5 px-4 text-center text-[10px] uppercase tracking-widest text-amber-400">∑</td>
                                        <td className="py-3.5 px-4 text-[11px] uppercase tracking-widest sticky left-0 bg-slate-900 z-10">
                                            TOTAL DA REDE
                                        </td>
                                        {criterioRanking === 'TOTAL' && (
                                            <td className="py-3.5 px-3 text-center text-xs text-amber-400 bg-slate-800">
                                                {String(vendasGlobal).padStart(2, '0')}
                                            </td>
                                        )}
                                        {(criterioRanking === 'TOTAL' || criterioRanking === 'PLANOS') && (
                                            <td className="py-3.5 px-3 text-center text-xs text-emerald-400 bg-slate-800/80 border-x border-slate-700">
                                                {String(totaisRedeMatriz.totalPlanos).padStart(2, '0')}
                                            </td>
                                        )}
                                        {colunasMatrizVisiveis.map(col => (
                                            <td key={col.key} className="py-3.5 px-2.5 text-center text-xs text-slate-200">
                                                {totaisRedeMatriz[col.key] > 0 ? String(totaisRedeMatriz[col.key]).padStart(2, '0') : '—'}
                                            </td>
                                        ))}
                                        {(criterioRanking === 'PRODUTOS' || criterioRanking === 'SERVICOS') && (
                                            <td className="py-3.5 px-4 text-[10px] text-slate-400 uppercase tracking-widest">
                                                100% da Categoria na Rede
                                            </td>
                                        )}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RankingGlobalTab;