import React from 'react';
import { Clock } from 'lucide-react';

const TabLinhaTempo = ({ eventos, alunoNome }) => {
    if (!eventos || eventos.length === 0) return null;

    return (
        <div className="animate-[fadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-8 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <Clock className="w-5 h-5 text-slate-400" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Todas as interações e compras de <strong className="uppercase">{alunoNome}</strong>, ordenadas por data.
                </p>
            </div>

            <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-6 pb-6">
                {eventos.map((e) => {
                    const Icone = e.icone;
                    return (
                        <div key={e.id} className="relative">
                            <div className={`absolute -left-[35px] w-8 h-8 rounded-full ${e.corBg} text-white flex items-center justify-center shadow-sm border-[3px] border-white dark:border-slate-900`}>
                                <Icone className="w-3.5 h-3.5" />
                            </div>
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 mb-1.5">
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-tight uppercase">{e.titulo}</h4>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                        {e.data_real.toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{e.descricao}</p>
                            </div>
                        </div>
                    );
                })}
                <div className="absolute -bottom-2 -left-[9px] w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 border-[3px] border-white dark:border-slate-900"></div>
            </div>
        </div>
    );
};
export default TabLinhaTempo;