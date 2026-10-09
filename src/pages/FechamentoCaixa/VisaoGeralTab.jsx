import React from 'react';
import { formatMoney } from './utils.js';
import { BarChart2, Building2, MapPin, TrendingUp, AlertCircle, LineChart } from 'lucide-react';

const VisaoGeralTab = ({ mesAtualLabel, totalGeralRedeAtual, visaoGeralUnidades }) => {
    
    // Calcula o maior valor de toda a rede para nivelar o gráfico (opcional, mas visualmente mais coerente)
    const maxValorGlobal = Math.max(
        ...visaoGeralUnidades.flatMap(row => row.historico.map(h => h.total)), 
        0
    );

    return (
        <div className="space-y-6 animate-[fadeIn_0.4s_ease-out] max-w-[1400px] mx-auto pb-10">
            
            {/* 🚀 HERO SECTION: Visão Global Financeira */}
            <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-800 rounded-[24px] shadow-2xl p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border border-violet-500/30">
                {/* Efeitos de Iluminação (Glassmorphism + Blur) */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-10 rounded-full blur-[80px] -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400 opacity-20 rounded-full blur-[60px] -mb-10 pointer-events-none"></div>
                <div className="absolute top-1/2 left-0 w-40 h-40 bg-fuchsia-400 opacity-10 rounded-full blur-[50px] -translate-y-1/2 pointer-events-none"></div>
                
                <div className="relative z-10 text-white flex gap-5 items-center">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                        <LineChart className="w-8 h-8 text-violet-200" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight drop-shadow-sm">
                            Visão Geral de Custos
                        </h2>
                        <p className="text-sm font-bold text-violet-200/80 uppercase tracking-widest mt-1">
                            Análise de comissões pagas nos últimos 6 meses
                        </p>
                    </div>
                </div>

                <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 px-8 py-5 rounded-[20px] flex flex-col items-end shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                    <span className="text-[11px] font-black text-violet-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Total Rede ({mesAtualLabel})
                    </span>
                    <span className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none drop-shadow-md">
                        {formatMoney(totalGeralRedeAtual)}
                    </span>
                </div>
            </div>

            {/* 📊 TABELA E GRÁFICOS: Desempenho por Unidade */}
            <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden relative z-20">
                <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center shadow-inner border border-violet-200">
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Mapa Gráfico de Unidades</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Comparativo de performance e tendências</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-100 text-slate-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 shadow-inner flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5" />
                        {visaoGeralUnidades.length} Unidades Analisadas
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Unidade</th>
                                <th className="px-8 py-5 text-[10px] font-black text-violet-600 uppercase tracking-widest border-b border-slate-100 bg-violet-50/50 text-right w-48 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Mês Atual ({mesAtualLabel})</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white text-center w-80 shadow-[0_4px_10px_rgba(0,0,0,0.01)]">Tendência (Últimos 6 Meses)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {visaoGeralUnidades.length > 0 ? visaoGeralUnidades.map((row, idx) => {
                                // Pega o maior valor específico desta unidade para escalar o gráfico localmente
                                const maxValorLocal = Math.max(...row.historico.map(h => h.total), 1); // Evita divisão por zero
                                
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-8 py-6 align-middle">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200/50 shadow-inner group-hover:bg-violet-50 group-hover:text-violet-500 group-hover:border-violet-200 transition-colors">
                                                    <MapPin className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{row.unidade}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Operação Ativa</span>
                                                </div>
                                            </div>
                                        </td>
                                        
                                        <td className="px-8 py-6 align-middle bg-violet-50/20 border-l border-r border-slate-50">
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-black text-violet-700 tracking-tight">{formatMoney(row.totalAtual)}</span>
                                                <span className="text-[9px] font-black text-violet-400 uppercase tracking-widest mt-1 bg-white px-2 py-0.5 rounded border border-violet-100 shadow-sm">
                                                    Auditado
                                                </span>
                                            </div>
                                        </td>
                                        
                                        <td className="px-8 py-6 align-middle">
                                            <div className="flex items-end justify-center gap-3 h-16 pt-4">
                                                {row.historico.map((mesHist, i) => {
                                                    const alturaPercentual = Math.max((mesHist.total / maxValorLocal) * 100, 5); // Mínimo de 5% para sempre mostrar uma barrinha
                                                    const isMesAtual = i === row.historico.length - 1;

                                                    return (
                                                        <div key={i} className="group/bar relative flex flex-col justify-end items-center h-full w-8 cursor-crosshair">
                                                            
                                                            {/* TOOLTIP PREMIUM FLUTUANTE */}
                                                            <div className="absolute -top-12 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl pointer-events-none whitespace-nowrap z-50 flex flex-col items-center transform -translate-y-2 group-hover/bar:translate-y-0">
                                                                <span className="text-slate-300 text-[8px] uppercase tracking-widest">{mesHist.label}</span>
                                                                <span className="text-emerald-400 mt-0.5">{formatMoney(mesHist.total)}</span>
                                                                <div className="absolute -bottom-1 w-2 h-2 bg-slate-800 rotate-45"></div>
                                                            </div>

                                                            {/* TRILHA DE FUNDO (BACKGROUND TRACK) */}
                                                            <div className="absolute w-full h-full bg-slate-100 rounded-t-md z-0"></div>

                                                            {/* BARRA DE DADOS */}
                                                            <div 
                                                                className={`w-full rounded-t-md transition-all duration-700 ease-out z-10 relative overflow-hidden ${isMesAtual ? 'bg-gradient-to-t from-violet-600 to-violet-400 shadow-[0_4px_10px_rgba(124,58,237,0.3)]' : 'bg-slate-300 group-hover/bar:bg-violet-300'}`}
                                                                style={{ height: `${alturaPercentual}%` }} 
                                                            >
                                                                {isMesAtual && <div className="absolute top-0 left-0 w-full h-1 bg-white/40"></div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* LABELS DOS MESES (EIXO X) */}
                                            <div className="flex items-center justify-center gap-3 mt-2">
                                                {row.historico.map((mesHist, i) => {
                                                    const isMesAtual = i === row.historico.length - 1;
                                                    return (
                                                        <div key={i} className={`w-8 text-center text-[9px] font-black uppercase tracking-wider ${isMesAtual ? 'text-violet-600' : 'text-slate-400'}`}>
                                                            {mesHist.label.split('/')[0]}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan="3" className="py-24">
                                        <div className="flex flex-col items-center justify-center text-center">
                                            <div className="w-16 h-16 bg-slate-50 border border-slate-200 border-dashed rounded-full flex items-center justify-center mb-4">
                                                <AlertCircle className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Sem Dados Financeiros</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm">
                                                Não há comissões processadas ou auditadas para as unidades no período selecionado.
                                            </p>
                                        </div>
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