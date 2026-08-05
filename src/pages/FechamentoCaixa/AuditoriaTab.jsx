import React, { useEffect } from 'react';

const AuditoriaTab = ({ dadosTabelaAuditoria }) => {
    
    useEffect(() => {
        if (window.lucide) window.lucide.createIcons();
    });

    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            <div className="p-6 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                    <i data-lucide="activity" className="w-5 h-5 text-rose-500"></i> Desempenho de Conferência por Unidade
                </h3>
            </div>
            
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-64">Unidade</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-32">Total Registros</th>
                            <th className="px-8 py-5 text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b border-slate-100 bg-emerald-50/30 text-center w-32">Conferidos (OK)</th>
                            <th className="px-8 py-5 text-[10px] font-black text-rose-500 uppercase tracking-widest border-b border-slate-100 bg-rose-50/30 text-center w-32">Pendentes</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">Progresso de Auditoria</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {dadosTabelaAuditoria.length > 0 ? dadosTabelaAuditoria.map((row, idx) => {
                            const percentual = row.registrados === 0 ? 0 : Math.round((row.conferidos / row.registrados) * 100);
                            let corBarra = 'bg-rose-500';
                            if (percentual >= 50) corBarra = 'bg-amber-400';
                            if (percentual === 100) corBarra = 'bg-emerald-500';

                            return (
                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="px-8 py-5 text-sm font-black text-slate-800 uppercase flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200">
                                            <i data-lucide="map-pin" className="w-3.5 h-3.5"></i>
                                        </div>
                                        {row.unidade}
                                    </td>
                                    <td className="px-8 py-5 text-sm font-black text-slate-600 text-center">{row.registrados}</td>
                                    <td className="px-8 py-5 text-sm font-black text-emerald-600 bg-emerald-50/10 text-center">{row.conferidos}</td>
                                    <td className="px-8 py-5 text-sm font-black text-rose-600 bg-rose-50/10 text-center">{row.pendentes}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-full bg-slate-100 rounded-full h-2.5 shadow-inner overflow-hidden flex">
                                                <div className={`${corBarra} h-2.5 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${percentual}%` }}></div>
                                            </div>
                                            <span className={`text-xs font-black w-10 text-right ${percentual === 100 ? 'text-emerald-600' : 'text-slate-600'}`}>{percentual}%</span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="5" className="text-center py-16 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    Nenhum lançamento encontrado para auditar neste período.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditoriaTab;