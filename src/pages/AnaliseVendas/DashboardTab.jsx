import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nContext.jsx';
import {
    formatMoney,
    getCategoriaItem,
    getValorRealDaVenda,
    criarGruposPlanosVazio,
    classificarPlanoEmGrupo,
    safeIsoDate
} from './utils.js';
import { TrendingUp, X } from 'lucide-react'; 

const DashboardTab = ({ vendasFiltradas, colaboradores, unidadeAtual, metaProdutos, metaNutri, metaPersonal, planos, produtos, abrirModalWhatsapp }) => {
    const { t, locale } = useI18n(); 
    const [grupoExpandido, setGrupoExpandido] = useState(null);
    
    const [modalProdOpen, setModalProdOpen] = useState(false);

    const rankingConsultoresFisicos = {};
    const equipeLocal = (colaboradores || []).filter(c =>
        unidadeAtual === 'TODOS' ? true : c.unidade?.toUpperCase() === unidadeAtual?.toUpperCase()
    );
    equipeLocal.forEach(colab => { rankingConsultoresFisicos[colab.nome.toUpperCase()] = 0; });

    let totalVendasProdutos = 0;
    let totalPlanos = 0;
    let totalServicos = 0;
    let faturamento = 0;
    const rankingProdutosFisicos = {};
    const gruposPlanos = criarGruposPlanosVazio();

    const transacoesUnicas = new Set();

    vendasFiltradas.forEach(v => {
        let qtd = parseInt(v.quantidade) || 1;
        const valorFaturado = getValorRealDaVenda(v, planos, produtos);
        
        const prodUpper = (v.produto || '').toUpperCase();
        const vendUpper = (v.vendedor || '').toUpperCase();
        const categoriaFinal = getCategoriaItem(prodUpper, planos, produtos);

        if (categoriaFinal === 'PLANO' && v.matricula && v.matricula.trim() !== '') {
            const dataLimpa = safeIsoDate(v.data || v.created_at);
            const chaveUnica = `${v.matricula.trim()}-${prodUpper}-${dataLimpa}`;

            if (transacoesUnicas.has(chaveUnica)) {
                qtd = 0;
            } else {
                transacoesUnicas.add(chaveUnica);
            }
        }

        faturamento += valorFaturado;

        if (categoriaFinal === 'PLANO') {
            // 🔥 CORREÇÃO: O Nutri (e todos os outros planos) voltam a somar normalmente no Total de Entradas
            totalPlanos += qtd;
            classificarPlanoEmGrupo(gruposPlanos, prodUpper, qtd);
        } else if (categoriaFinal === 'PRODUTO') {
            totalVendasProdutos += qtd;
            rankingProdutosFisicos[prodUpper] = (rankingProdutosFisicos[prodUpper] || 0) + qtd;
            if (rankingConsultoresFisicos[vendUpper] !== undefined) {
                rankingConsultoresFisicos[vendUpper] += qtd;
            } else {
                rankingConsultoresFisicos[vendUpper] = qtd;
            }
        } else if (categoriaFinal === 'SERVICO') {
            totalServicos += qtd;
        }
    });

    const topProdutosLista = Object.entries(rankingProdutosFisicos).sort((a, b) => b[1] - a[1]);
    const rankingOrdenado = Object.entries(rankingConsultoresFisicos).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });

    const toggleGrupoPlanos = (nomeGrupo) => {
        setGrupoExpandido(prev => prev === nomeGrupo ? null : nomeGrupo);
    };

    // ==========================================
    // 🧠 CÁLCULO DE PRODUTIVIDADE DA UNIDADE (UPSELL)
    // ==========================================
    const totalFit = gruposPlanos["FIT"]?.total || 0;
    const percentualFit = totalPlanos > 0 ? (totalFit / totalPlanos) * 100 : 0;
    const produtividadeUpsell = totalPlanos > 0 ? Math.max(100 - percentualFit, 0) : 0;

    // 🔥 PREPARAÇÃO DOS DADOS PARA O MODAL
    const todosPlanosDetalhados = [];
    Object.values(gruposPlanos).forEach(grupo => {
        Object.entries(grupo.detalhes).forEach(([nome, qtd]) => {
            if (qtd > 0) todosPlanosDetalhados.push({ nome, qtd });
        });
    });
    todosPlanosDetalhados.sort((a, b) => b.qtd - a.qtd); 

    // ==========================================
    // 🧠 ALERTA DE METAS (START E COMPARTILHAR)
    // ==========================================
    const dispararModalMetas = () => {
        const mesAtual = new Date().toLocaleString(locale || 'pt-BR', { month: 'long' }).toUpperCase();
        
        const nutriRealizado = gruposPlanos["NUTRI"]?.total || 0;
        const personalRealizado = gruposPlanos["PERSONAL CLASS"]?.total || 0;
        const produtosRealizado = totalVendasProdutos || 0;

        const mNutri = metaNutri || 0;
        const mProd = metaProdutos || 0;
        const mPers = metaPersonal || 0;

        const faltaNutri = Math.max(mNutri - nutriRealizado, 0);
        const faltaProd = Math.max(mProd - produtosRealizado, 0);
        const faltaPers = Math.max(mPers - personalRealizado, 0);

        const iconNutri = (faltaNutri === 0 && mNutri > 0) ? '✅' : '🔴';
        const iconProd = (faltaProd === 0 && mProd > 0) ? '✅' : '🔴';
        const iconPers = (faltaPers === 0 && mPers > 0) ? '✅' : '🔴';

        let txt = `✅ Meta Start - ${mesAtual} ✅\n\n`;
        
        txt += `👉 Nutri: ${nutriRealizado} / ${mNutri} ${iconNutri}\n`;
        txt += `👉 Produto: ${produtosRealizado} / ${mProd} ${iconProd}\n`;
        txt += `👉 Personal Class: ${personalRealizado} / ${mPers} ${iconPers}\n\n`;

        if (faltaNutri > 0) txt += `❌ Falta ${faltaNutri} Nutri - para liberar gratificação\n`;
        else if (mNutri > 0) txt += `🎉 Meta Nutri BATIDA!\n`;

        if (faltaProd > 0) txt += `❌ Falta ${faltaProd} Produto - para liberar gratificação\n`;
        else if (mProd > 0) txt += `🎉 Meta Produto BATIDA!\n`;

        if (faltaPers > 0) txt += `❌ Falta ${faltaPers} Class - para liberar gratificação\n`;
        else if (mPers > 0) txt += `🎉 Meta Personal Class BATIDA!\n`;

        abrirModalWhatsapp(txt, { titulo: 'Status das Metas', icone: 'target', cor: 'blue' });
    };

    const dispararModalCompartilhar = () => {
        let txt = `${t('analytics.dashboard.wppRankingTitle', { defaultValue: '*🏆 Ranking de Vendas de Produtos 🏆*' })}\n`;
        txt += `${t('analytics.dashboard.wppTotalSales', { defaultValue: '*Total de Vendas:*' })} ${String(totalVendasProdutos).padStart(2, '0')} / ${String(metaProdutos || 0).padStart(2, '0')}\n\n`;

        const vendidos = rankingOrdenado.filter(item => item[1] > 0);
        const zerados = rankingOrdenado.filter(item => item[1] === 0);
        let posicaoAtual = 1;

        vendidos.forEach((item) => {
            const nome = item[0].split(' ')[0];
            const qtd = item[1];
            let emoji = "🟢❌❌";
            if (qtd === 2) emoji = "🟢🟢❌";
            else if (qtd >= 3) emoji = "✅✅✅";
            txt += `${posicaoAtual} ${emoji} ${nome} ${String(qtd).padStart(2, '0')}\n`;
            posicaoAtual++;
        });

        if (zerados.length > 0) {
            txt += `\n➖➖➖➖➖➖➖➖➖➖\n`;
            txt += `${t('analytics.dashboard.wppAlertPush', { defaultValue: '*🚨 BORA ACELERAR, GALERA! 🚀*' })}\n`;
            txt += `${t('analytics.dashboard.wppAlertSub', { defaultValue: '_Todos abaixo ainda não pontuaram hoje._' })}\n`;
            txt += `${t('analytics.dashboard.wppAlertHelp', { defaultValue: '*SOCORRO, DEUS!!! 🙏*' })}\n\n`;
            zerados.forEach((item) => {
                const nome = item[0].split(' ')[0];
                txt += `${posicaoAtual} ❌❌❌ ${nome}\n`;
                posicaoAtual++;
            });
        }

        abrirModalWhatsapp(txt, { titulo: t('analytics.dashboard.wppModalTitle', { defaultValue: 'Ranking para Grupo' }), icone: 'send', cor: 'emerald' });
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendasFiltradas, grupoExpandido, modalProdOpen]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out] relative">
            
            {/* 🔥 MODAL DE PRODUTIVIDADE */}
            {modalProdOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
                    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-200 resize-y">
                        
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-rose-500" /> Memória de Cálculo - Produtividade
                                </h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">Transparência dos dados e conversão</p>
                            </div>
                            <button onClick={() => setModalProdOpen(false)} className="hover:rotate-90 transition-transform bg-white/10 p-2 rounded-full hover:bg-white/20">
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        
                        <div className="p-6 md:p-8 bg-slate-50 flex-1 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-8">
                            
                            <div>
                                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i data-lucide="layers" className="w-4 h-4 text-blue-500"></i> Planos Vendidos no Período
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {todosPlanosDetalhados.map((p, i) => (
                                        <div key={i} className="bg-white border border-slate-200 p-3.5 rounded-xl flex justify-between items-center shadow-sm">
                                            <span className="text-[10px] font-bold text-slate-700 uppercase truncate mr-2" title={p.nome}>{p.nome}</span>
                                            <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">{p.qtd}</span>
                                        </div>
                                    ))}
                                    {todosPlanosDetalhados.length === 0 && (
                                        <p className="text-xs font-bold text-slate-400 italic col-span-full">Nenhum plano registrado neste filtro.</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <i data-lucide="calculator" className="w-4 h-4 text-rose-500"></i> Fórmula de Upsell Aplicada
                                </h4>
                                <div className="bg-white border border-slate-200 rounded-[20px] p-6 shadow-sm space-y-5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">1. Total de Entradas (Todos os Planos)</span>
                                        <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{totalPlanos}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">2. Quantidade de Planos "FIT" (Básicos)</span>
                                        <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">{totalFit}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase">3. Percentual FIT <span className="text-[9px] lowercase normal-case text-slate-400">(Fit ÷ Entradas × 100)</span></span>
                                        <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1 rounded-lg">{percentualFit.toFixed(1)}%</span>
                                    </div>
                                    <div className="pt-5 border-t border-slate-200 flex justify-between items-center">
                                        <div>
                                            <span className="block text-xs font-black text-slate-800 uppercase tracking-widest">Produtividade Final</span>
                                            <span className="block text-[9px] font-bold text-slate-400 mt-0.5">100% - Percentual FIT</span>
                                        </div>
                                        <span className="text-2xl font-black text-emerald-600">{produtividadeUpsell.toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiPlans', { defaultValue: 'Planos Vendidos' })}</p>
                    <p className="text-4xl font-black tracking-tight" title={t('analytics.dashboard.kpiTooltip', { defaultValue: 'Métrica deduplicada para espelhar número real de alunos' })}>{String(totalPlanos).padStart(2, '0')}</p>
                </div>
                
                <div 
                    onClick={() => setModalProdOpen(true)}
                    className="bg-gradient-to-br from-pink-600 to-rose-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden group cursor-pointer hover:ring-4 hover:ring-rose-500/30 hover:-translate-y-1 transition-all duration-300"
                    title="Clique para ver a Memória de Cálculo"
                >
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <TrendingUp className="w-32 h-32" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2 relative z-10 flex items-center gap-1.5">
                        Produtividade <i data-lucide="info" className="w-3 h-3 opacity-70"></i>
                    </p>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <p className="text-4xl font-black tracking-tight">{produtividadeUpsell.toFixed(0)}</p>
                        <span className="text-xl font-bold opacity-80">%</span>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiProducts', { defaultValue: 'Produtos Físicos' })}</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalVendasProdutos).padStart(2, '0')}</p>
                </div>

                <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiServices', { defaultValue: 'Serviços Avulsos' })}</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalServicos).padStart(2, '0')}</p>
                </div>

                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">{t('analytics.dashboard.kpiRevenue', { defaultValue: 'Faturamento Bruto' })}</p>
                    <p className="text-2xl lg:text-3xl font-black tracking-tight mt-1">{formatMoney(faturamento)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <div className="flex justify-between items-center border-b border-slate-100 mb-6 pb-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                            <i data-lucide="layers" className="w-5 h-5 text-blue-500"></i> {t('analytics.dashboard.plansTitle', { defaultValue: 'Venda de Assinaturas' })}
                        </h3>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {Object.entries(gruposPlanos).filter(([_, data]) => data.total > 0).map(([nomeGrupo, data]) => {
                            const perc = totalPlanos > 0 ? (data.total / totalPlanos) * 100 : 0;
                            const isSingleLooseItem = Object.keys(data.detalhes).length === 1 && Object.keys(data.detalhes)[0] === nomeGrupo;
                            const isExpanded = grupoExpandido === nomeGrupo && !isSingleLooseItem;

                            return (
                                <div key={nomeGrupo} className="group flex flex-col gap-1 border border-slate-100 rounded-xl p-3 bg-slate-50 transition-all">
                                    <div className={`flex justify-between items-center select-none ${!isSingleLooseItem ? 'cursor-pointer' : ''}`} onClick={() => !isSingleLooseItem && toggleGrupoPlanos(nomeGrupo)}>
                                        <div className="flex items-center gap-2">
                                            {!isSingleLooseItem ? <i data-lucide={isExpanded ? "chevron-up" : "chevron-down"} className="w-4 h-4 text-slate-400"></i> : <div className="w-1 h-1 rounded-full bg-slate-400 ml-1.5 mr-1.5"></div>}
                                            <span className={`text-[11px] font-black uppercase tracking-wider ${data.textCor}`}>{nomeGrupo}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 text-[10px] font-bold">{perc.toFixed(0)}%</span>
                                            <span className="bg-white px-2 py-0.5 rounded text-[10px] border shadow-sm font-black">{String(data.total).padStart(2, '0')} un</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                                        <div className={`h-full rounded-full transition-all duration-700 ease-out ${data.cor}`} style={{ width: `${perc}%` }}></div>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                                            {Object.entries(data.detalhes).sort((a,b)=>b[1]-a[1]).map(([nomePlano, qtdPlano]) => (
                                                <div key={nomePlano} className="flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase">
                                                    <span className="truncate max-w-[180px] pl-2 border-l-2 border-slate-300">{nomePlano}</span>
                                                    <span className="bg-white border border-slate-100 px-1.5 rounded shadow-sm">{String(qtdPlano).padStart(2, '0')} un</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                        {Object.keys(gruposPlanos).every(k => gruposPlanos[k].total === 0) && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyPlans', { defaultValue: 'Nenhum plano vendido.' })}</p>}
                    </div>
                    <button onClick={dispararModalMetas} className="mt-4 w-full bg-blue-600 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
                        <i data-lucide="share-2" className="w-4 h-4 text-blue-200"></i> ALERTAR METAS (WHATSAPP)
                    </button>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="box" className="w-5 h-5 text-amber-500"></i> {t('analytics.dashboard.productsTitle', { defaultValue: 'Produtos / Complementos' })}
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {topProdutosLista.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-700 uppercase"><span className="text-slate-400 font-bold w-4 mr-2">{idx + 1}º</span>{item[0]}</span>
                                <span className="bg-white px-3 py-1 rounded-lg border text-[10px] font-black text-amber-600">{String(item[1]).padStart(2, '0')} un</span>
                            </div>
                        ))}
                        {topProdutosLista.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyProducts', { defaultValue: 'Nenhum produto físico vendido.' })}</p>}
                    </div>
                </div>

                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> {t('analytics.dashboard.podiumTitle', { defaultValue: 'Pódio Físico (Garrafa/Whey)' })}
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {rankingOrdenado.map(([nome, qtd], idx) => {
                            let emojiUI = "🟢 ❌ ❌";
                            if (qtd === 0) emojiUI = "❌ ❌ ❌";
                            else if (qtd === 2) emojiUI = "🟢 🟢 ❌";
                            else if (qtd >= 3) emojiUI = "✅ ✅ ✅";

                            return (
                                <div key={idx} className={`flex justify-between items-center p-3 rounded-xl border ${qtd === 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}>
                                    <span className={`text-[10px] font-black uppercase truncate max-w-[120px] ${qtd === 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                                        {idx+1}º {nome.split(' ')[0]}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] tracking-widest">{emojiUI}</span>
                                        <span className={`text-[10px] font-black bg-white px-2 py-0.5 rounded border shadow-sm ${qtd === 0 ? 'text-rose-500 border-rose-200' : 'text-emerald-600 border-slate-200'}`}>{String(qtd).padStart(2, '0')} un</span>
                                    </div>
                                </div>
                            )
                        })}
                        {rankingOrdenado.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">{t('analytics.dashboard.emptyConsultants', { defaultValue: 'Nenhum consultor cadastrado na unidade.' })}</p>}
                    </div>
                    <button onClick={dispararModalCompartilhar} disabled={rankingOrdenado.length === 0} className="mt-4 w-full bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
                        <i data-lucide="share-2" className="w-4 h-4"></i> {t('analytics.dashboard.wppButton', { defaultValue: 'Ranking WhatsApp' })}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardTab;