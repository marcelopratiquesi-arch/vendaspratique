import React, { useState, useEffect } from 'react';
import {
    formatMoney,
    getCategoriaItem,
    getValorRealDaVenda,
    criarGruposPlanosVazio,
    classificarPlanoEmGrupo
} from './utils.js';

const DashboardTab = ({ vendasFiltradas, colaboradores, unidadeAtual, metaProdutos, planos, produtos, abrirModalWhatsapp }) => {
    const [grupoExpandido, setGrupoExpandido] = useState(null);

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

    vendasFiltradas.forEach(v => {
        const qtd = parseInt(v.quantidade) || 1;
        faturamento += getValorRealDaVenda(v, planos, produtos);
        const prodUpper = (v.produto || '').toUpperCase();
        const vendUpper = (v.vendedor || '').toUpperCase();
        const categoriaFinal = getCategoriaItem(prodUpper, planos, produtos);

        if (categoriaFinal === 'PLANO') {
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

    const dispararModalCompartilhar = () => {
        let txt = `*🏆 Ranking de Vendas de Produtos 🏆*\n`;
        txt += `*Total de Vendas:* ${String(totalVendasProdutos).padStart(2, '0')} / ${String(metaProdutos).padStart(2, '0')}\n\n`;

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
            txt += `*🚨 BORA ACELERAR, GALERA! 🚀*\n`;
            txt += `_Todos abaixo ainda não pontuaram hoje._\n`;
            txt += `*SOCORRO, DEUS!!! 🙏*\n\n`;
            zerados.forEach((item) => {
                const nome = item[0].split(' ')[0];
                txt += `${posicaoAtual} ❌❌❌ ${nome}\n`;
                posicaoAtual++;
            });
        }

        abrirModalWhatsapp(txt, { titulo: 'Ranking para Grupo', icone: 'send', cor: 'emerald' });
    };

    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    }, [vendasFiltradas, grupoExpandido]);

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Planos Vendidos</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalPlanos).padStart(2, '0')}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Produtos Físicos</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalVendasProdutos).padStart(2, '0')}</p>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-violet-700 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Serviços Avulsos</p>
                    <p className="text-4xl font-black tracking-tight">{String(totalServicos).padStart(2, '0')}</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-[24px] p-6 text-white shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-90 mb-2">Faturamento Bruto</p>
                    <p className="text-2xl lg:text-3xl font-black tracking-tight mt-1">{formatMoney(faturamento)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. VENDAS DE ASSINATURAS (Com Personal Class Isolado) */}
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="layers" className="w-5 h-5 text-blue-500"></i> Venda de Assinaturas
                    </h3>
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
                        {Object.keys(gruposPlanos).every(k => gruposPlanos[k].total === 0) && <p className="text-center text-xs font-bold text-slate-400 py-12">Nenhum plano vendido.</p>}
                    </div>
                </div>

                {/* 2. PRODUTOS / COMPLEMENTOS */}
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="box" className="w-5 h-5 text-amber-500"></i> Produtos / Complementos
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {topProdutosLista.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-700 uppercase"><span className="text-slate-400 font-bold w-4 mr-2">{idx + 1}º</span>{item[0]}</span>
                                <span className="bg-white px-3 py-1 rounded-lg border text-[10px] font-black text-amber-600">{String(item[1]).padStart(2, '0')} un</span>
                            </div>
                        ))}
                        {topProdutosLista.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">Nenhum produto físico vendido.</p>}
                    </div>
                </div>

                {/* 3. PÓDIO FÍSICO */}
                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8 h-[450px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2 border-b pb-4">
                        <i data-lucide="medal" className="w-5 h-5 text-emerald-500"></i> Pódio Físico (Garrafa/Whey)
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
                        {rankingOrdenado.length === 0 && <p className="text-center text-xs font-bold text-slate-400 py-12">Nenhum consultor cadastrado na unidade.</p>}
                    </div>
                    <button onClick={dispararModalCompartilhar} disabled={rankingOrdenado.length === 0} className="mt-4 w-full bg-slate-800 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm">
                        <i data-lucide="share-2" className="w-4 h-4"></i> Ranking WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DashboardTab;