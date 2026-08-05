import React, { useEffect } from 'react';
import { formatMoney } from './utils.js';

const VisaoGeralTab = ({ mesAtualLabel, totalGeralRedeAtual, visaoGeralUnidades }) => {
    
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    });

    return (
        <div className="space-y-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-violet-600 rounded-[24px] shadow-lg p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-32 w-40 h-40 bg-black opacity-10 rounded-full blur-2xl -mb-10 pointer-events-none"></div>
                
                <div className="relative z-10 text-white">
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                        <i data-lucide="bar-chart-2" className="w-7 h-7 text-violet-300"></i> Visão Geral de Custos
                    </h2>
                    <p className="text-xs font-bold text-violet-200 uppercase tracking-widest mt-1.5 opacity-90">Análise de comissões pagas nos últimos 6 meses</p>
                </div>

                <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl flex flex-col items-end">
                    <span className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-0.5">Total Rede ({mesAtualLabel})</span>
                    <span className="text-4xl font-black text-white tracking-tight leading-none">{formatMoney(totalGeralRedeAtual)}</span>
                </div>
            </div>

            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                        <i data-lucide="building-2" className="w-5 h-5 text-violet-500"></i> Mapa Gráfico de Unidades
                    </h3>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Unidade</th>
                                <th className="px-8 py-5 text-[10px] font-black text-violet-600 uppercase tracking-widest border-b border-slate-100 bg-violet-50/30 text-right w-48">Mês Atual ({mesAtualLabel})</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-72">Tendência (Últimos 6 Meses)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {visaoGeralUnidades.length > 0 ? visaoGeralUnidades.map((row, idx) => {
                                const maxValor = Math.max(...row.historico.map(h => h.total));
                                
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-8 py-6 text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                                                <i data-lucide="map-pin" className="w-4 h-4"></i>
                                            </div>
                                            {row.unidade}
                                        </td>
                                        <td className="px-8 py-6 text-lg font-black text-violet-700 text-right bg-violet-50/10">
                                            {formatMoney(row.totalAtual)}
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-end justify-center gap-2 h-12">
                                                {row.historico.map((mesHist, i) => {
                                                    const alturaPercentual = maxValor === 0 ? 5 : (mesHist.total / maxValor) * 100;
                                                    const isMesAtual = i === row.historico.length - 1;

                                                    return (
                                                        <div 
                                                            key={i} 
                                                            title={`${mesHist.label}: ${formatMoney(mesHist.total)}`}
                                                            className={`w-8 rounded-t-sm transition-all duration-500 group-hover:opacity-100 ${isMesAtual ? 'bg-violet-500' : 'bg-slate-200 opacity-60'}`}
                                                            style={{ height: `${Math.max(alturaPercentual, 5)}%` }} 
                                                        ></div>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex items-center justify-center gap-2 mt-2">
                                                {row.historico.map((mesHist, i) => (
                                                    <div key={i} className={`w-8 text-center text-[8px] font-bold ${i === row.historico.length - 1 ? 'text-violet-600' : 'text-slate-400'}`}>
                                                        {mesHist.label.split('/')[0]}
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="3" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                        Nenhum dado financeiro processado para as unidades.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VisaoGeralTab;