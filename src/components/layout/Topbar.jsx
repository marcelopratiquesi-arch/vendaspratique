import React from 'react';
import { Menu } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

export default function Topbar({
    setIsMobileMenuOpen, ActiveIcon, tabAtual, 
    ehChefe, unidadeGlobal, setUnidadeGlobal, unidades, usuarioLogado
}) {
    const { t } = useI18n();

    return (
        <header className="h-[88px] shrink-0 border-b border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-[#111827]/40 backdrop-blur-2xl flex items-center justify-between px-4 sm:px-8 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-5">
                <button onClick={() => setIsMobileMenuOpen(true)} className="xl:hidden p-2.5 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 shadow-sm">
                    <Menu className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex w-12 h-12 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl items-center justify-center text-slate-400 dark:text-slate-300 shadow-sm shrink-0">
                        <ActiveIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 drop-shadow-sm" strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none drop-shadow-sm">{tabAtual.label}</h2>
                        
                        {ehChefe ? (
                            <div className="flex items-center gap-2 mt-2 bg-slate-100 dark:bg-[#0c101a] py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${unidadeGlobal === 'TODAS' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`}></span>
                                <select 
                                    value={unidadeGlobal} 
                                    onChange={(e) => setUnidadeGlobal(e.target.value)}
                                    className="bg-transparent text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest outline-none cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                                >
                                    <option value="TODAS" className="bg-white dark:bg-slate-900 font-bold">{t('header.globalView')}</option>
                                    {unidades.map(u => <option key={u.id} value={u.nome} className="bg-white dark:bg-slate-900">{u.nome}</option>)}
                                </select>
                            </div>
                        ) : (
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                                {usuarioLogado.unidade}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
