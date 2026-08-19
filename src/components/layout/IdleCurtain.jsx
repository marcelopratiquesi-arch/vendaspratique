import React from 'react';
import { Lock, Zap } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext.jsx';

export default function IdleCurtain({ isIdle }) {
    const { t } = useI18n();
    
    if (!isIdle) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
            <div className="bg-white dark:bg-[#111827]/80 backdrop-blur-xl p-8 sm:p-10 rounded-[32px] shadow-2xl flex flex-col items-center max-w-md w-[90%] text-center border border-slate-200 dark:border-white/10 animate-[slideDown_0.4s_ease-out]">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <Lock className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">{t('idle.title')}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed px-4">{t('idle.description')}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs transition-all shadow-[0_4px_20px_rgba(37,99,235,0.3)] dark:shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-95 flex items-center justify-center gap-2 border border-blue-400/20"
                >
                    <Zap className="w-4 h-4 fill-current text-amber-300" /> {t('idle.button')}
                </button>
            </div>
        </div>
    );
}