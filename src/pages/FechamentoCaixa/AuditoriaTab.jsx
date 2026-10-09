import React from 'react';
import { 
    ShieldAlert, 
    MapPin, 
    CheckCircle2, 
    Clock, 
    ListChecks, 
    AlertCircle, 
    Target, 
    Check
} from 'lucide-react';

const AuditoriaTab = ({ dadosTabelaAuditoria }) => {
    
    return (
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden animate-[fadeIn_0.3s_ease-out]">
            
            {/* CABEÇALHO PREMIUM DA AUDITORIA */}
            <div className="p-6 md:p-8 border-b border-slate-100 bg-gradient-to-r from-rose-50/50 to-orange-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-[16px] bg-white border border-rose-100 text-rose-500 flex items-center justify-center shadow-sm">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">
                            Desempenho de Conferência por Unidade
                        </h3>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                            Acompanhamento em tempo real da auditoria de caixa
                        </p>
                    </div>
                </div>

                <div className="relative z-10 bg-white/60 backdrop-blur-sm border border-rose-200/50 px-4 py-2 rounded-xl flex items-center gap-2 shadow-inner">
                    <Target className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-black text-rose-700 uppercase tracking-widest">
                        Status Global de Fechamento
                    </span>
                </div>
            </div>
            
            {/* TABELA DE DADOS */}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 w-72 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Unidade Operacional</th>
                            <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-32 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Registros</th>
                            <th className="px-6 py-5 text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-slate-100 bg-emerald-50/30 text-center w-40 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Conferidos (OK)</th>
                            <th className="px-6 py-5 text-[10px] font-black text-rose-600 uppercase tracking-widest border-b border-slate-100 bg-rose-50/30 text-center w-40 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Pendentes</th>
                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Progresso de Auditoria</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {dadosTabelaAuditoria.length > 0 ? dadosTabelaAuditoria.map((row, idx) => {
                            const percentual = row.registrados === 0 ? 0 : Math.round((row.conferidos / row.registrados) * 100);
                            
                            // Lógica de Cores Premium para a barra
                            let corBarra = 'from-rose-500 to-rose-400';
                            let corTextoProgresso = 'text-rose-600';
                            let labelStatus = 'CRÍTICO';
                            
                            if (percentual >= 50 && percentual < 100) {
                                corBarra = 'from-amber-500 to-amber-400';
                                corTextoProgresso = 'text-amber-600';
                                labelStatus = 'EM ANDAMENTO';
                            }
                            if (percentual === 100) {
                                corBarra = 'from-emerald-500 to-emerald-400';
                                corTextoProgresso = 'text-emerald-600';
                                labelStatus = 'CONCLUÍDO';
                            }

                            const isConcluido = percentual === 100;

                            return (
                                <tr key={idx} className={`transition-colors group ${isConcluido ? 'bg-emerald-50/10 hover:bg-emerald-50/30' : 'hover:bg-slate-50/80'}`}>
                                    
                                    {/* COLUNA: UNIDADE */}
                                    <td className="px-8 py-5 align-middle">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner transition-colors ${isConcluido ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200'}`}>
                                                {isConcluido ? <Check className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.unidade}</span>
                                                <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isConcluido ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                    {isConcluido ? 'Auditoria Finalizada' : 'Auditoria Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    
                                    {/* COLUNA: TOTAL REGISTROS */}
                                    <td className="px-6 py-5 align-middle text-center">
                                        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-black shadow-sm w-20">
                                            <ListChecks className="w-3.5 h-3.5 opacity-50" />
                                            {row.registrados}
                                        </div>
                                    </td>
                                    
                                    {/* COLUNA: CONFERIDOS (OK) */}
                                    <td className="px-6 py-5 align-middle text-center bg-emerald-50/10">
                                        <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 rounded-lg text-xs font-black shadow-sm min-w-[5rem]">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            {row.conferidos}
                                        </div>
                                    </td>
                                    
                                    {/* COLUNA: PENDENTES */}
                                    <td className="px-6 py-5 align-middle text-center bg-rose-50/10">
                                        <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white border rounded-lg text-xs font-black shadow-sm min-w-[5rem] transition-colors ${row.pendentes > 0 ? 'border-rose-200 text-rose-600' : 'border-slate-200 text-slate-400'}`}>
                                            {row.pendentes > 0 ? <Clock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5 opacity-50" />}
                                            {row.pendentes}
                                        </div>
                                    </td>
                                    
                                    {/* COLUNA: PROGRESSO (BARRA + STATUS) */}
                                    <td className="px-8 py-5 align-middle">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-end">
                                                <span className={`text-[9px] font-black uppercase tracking-widest ${corTextoProgresso}`}>
                                                    {labelStatus}
                                                </span>
                                                <span className={`text-sm font-black ${corTextoProgresso}`}>
                                                    {percentual}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-2.5 shadow-inner overflow-hidden flex border border-slate-200/50">
                                                <div 
                                                    className={`h-full rounded-full bg-gradient-to-r ${corBarra} transition-all duration-1000 ease-out relative overflow-hidden`} 
                                                    style={{ width: `${percentual}%` }}
                                                >
                                                    {/* Efeito de brilho na barra para dar um visual 3D */}
                                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-white/40"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="5" className="py-24">
                                    <div className="flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4">
                                            <AlertCircle className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Sem Auditorias Pendentes</h4>
                                        <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">
                                            Nenhum lançamento encontrado para auditar nas unidades no período selecionado.
                                        </p>
                                    </div>
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