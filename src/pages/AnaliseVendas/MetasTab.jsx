import React from 'react';
import { getCategoriaItem } from './utils.js';

const MetasTab = ({
    temVisaoGlobal, vendasFiltradas, unidadesUnicas, usuarioLogado,
    metaNutri, metaProdutos, metaPersonal,
    setMetaNutri, setMetaProdutos, setMetaPersonal,
    salvarMetasNuvem, isSalvandoMetas, planos, produtos
}) => {
    const listaUnidadesMetas = unidadesUnicas.filter(u => u !== 'TODOS' && (temVisaoGlobal ? true : u === usuarioLogado?.unidade));

    const dadosMetasPorUnidade = listaUnidadesMetas.map(unidade => {
        const vendasDaUnidade = vendasFiltradas.filter(v => v.unidade === unidade);
        let nutriRealizado = 0; let produtosRealizado = 0; let personalRealizado = 0;

        vendasDaUnidade.forEach(v => {
            const qtd = parseInt(v.quantidade) || 1;
            const prodUpper = (v.produto || '').toUpperCase();
            const cat = getCategoriaItem(prodUpper, planos, produtos);

            if (cat === 'PLANO') {
                if (prodUpper.includes("NUTRI")) nutriRealizado += qtd;
                if (prodUpper.includes("PERSONAL")) personalRealizado += qtd;
            } else if (cat === 'PRODUTO') {
                produtosRealizado += qtd;
            }
        });

        return {
            unidade, nutriRealizado, produtosRealizado, personalRealizado,
            faltaNutri: Math.max(metaNutri - nutriRealizado, 0),
            faltaProdutos: Math.max(metaProdutos - produtosRealizado, 0),
            faltaPersonal: Math.max(metaPersonal - personalRealizado, 0)
        };
    });

    return (
        <div className="space-y-6 animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm p-8">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <i data-lucide="sliders" className="w-5 h-5 text-blue-600"></i> Painel de Metas Mensais
                    </h3>
                    {temVisaoGlobal && (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg">Selecione uma unidade no filtro para editar</span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-[20px] border border-slate-100 mb-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Planos Nutri</label>
                        <input type="number" min="0" value={metaNutri} onChange={(e) => setMetaNutri(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Produtos Físicos</label>
                        <input type="number" min="0" value={metaProdutos} onChange={(e) => setMetaProdutos(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Meta: Personal Class</label>
                        <input type="number" min="0" value={metaPersonal} onChange={(e) => setMetaPersonal(parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 rounded-xl p-4 font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button onClick={salvarMetasNuvem} disabled={isSalvandoMetas} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all flex items-center gap-2 disabled:opacity-50">
                        {isSalvandoMetas ? <i data-lucide="loader-2" className="w-4 h-4 animate-spin"></i> : <i data-lucide="save" className="w-4 h-4"></i>}
                        Salvar Metas da Unidade
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr className="bg-slate-50">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Academia / Unidade</th>
                                <th className="px-8 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Nutri</th>
                                <th className="px-8 py-5 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Produtos</th>
                                <th className="px-8 py-5 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center border-b border-slate-100">Progresso Personal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {dadosMetasPorUnidade.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6 text-sm font-black text-slate-800 uppercase">{item.unidade}</td>
                                    <td className="px-8 py-6 text-center text-[11px] font-black">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={item.faltaNutri === 0 && metaNutri > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.nutriRealizado} / {metaNutri} un</span>
                                            <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.faltaNutri === 0 && metaNutri > 0 ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: metaNutri === 0 ? '0%' : `${Math.min((item.nutriRealizado/metaNutri)*100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center text-[11px] font-black">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={item.faltaProdutos === 0 && metaProdutos > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.produtosRealizado} / {metaProdutos} un</span>
                                            <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.faltaProdutos === 0 && metaProdutos > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: metaProdutos === 0 ? '0%' : `${Math.min((item.produtosRealizado/metaProdutos)*100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center text-[11px] font-black">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className={item.faltaPersonal === 0 && metaPersonal > 0 ? 'text-emerald-600' : 'text-slate-400'}>{item.personalRealizado} / {metaPersonal} un</span>
                                            <div className="w-32 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                <div className={`h-full ${item.faltaPersonal === 0 && metaPersonal > 0 ? 'bg-emerald-500' : 'bg-indigo-400'}`} style={{ width: metaPersonal === 0 ? '0%' : `${Math.min((item.personalRealizado/metaPersonal)*100, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MetasTab;